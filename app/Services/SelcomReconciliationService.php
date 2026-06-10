<?php

namespace App\Services;

use App\Models\Order;
use App\Models\WithdrawalRequest;
use App\Payments\Drivers\Selcom\SelcomClient;
use App\Payments\Drivers\Selcom\SelcomGateway;
use App\Payments\PaymentCallbackProcessor;
use App\Payments\PaymentEvent;
use Illuminate\Support\Facades\Log;

class SelcomReconciliationService
{
    public function __construct(
        private readonly SelcomGateway $selcom,
        private readonly PaymentCallbackProcessor $paymentCallbackProcessor,
    ) {
    }

    public function reconcile(int $limit = 50): array
    {
        $limit = max(1, min($limit, 250));

        return [
            'orders' => $this->reconcileOrders($limit),
            'withdrawals' => $this->reconcileWithdrawals($limit),
        ];
    }

    private function reconcileOrders(int $limit): array
    {
        $summary = ['checked' => 0, 'successful' => 0, 'failed' => 0, 'pending' => 0, 'errors' => 0];

        Order::query()
            ->where('payment_gateway', 'selcom')
            ->where('payment_status', 'pending')
            ->where('created_at', '<=', now()->subMinutes(3))
            ->orderBy('created_at')
            ->limit($limit)
            ->get()
            ->each(function (Order $order) use (&$summary): void {
                $summary['checked']++;

                try {
                    $event = $this->selcom->queryCheckoutOrderStatus(
                        SelcomClient::cleanReference((string) $order->transaction_ref, 'ORD')
                    );

                    $this->recordOrderStatus($order, $event);

                    if ($event->isSuccessful()) {
                        $this->paymentCallbackProcessor->handleSuccess(
                            $order->fresh(),
                            (string) ($event->providerReference ?: $event->takeerReference),
                            'selcom'
                        );
                        $summary['successful']++;
                        return;
                    }

                    if ($event->isFailed()) {
                        $this->paymentCallbackProcessor->handleFailure($order->fresh(), $event->failureReason ?: 'Selcom payment failed.');
                        $summary['failed']++;
                        return;
                    }

                    $summary['pending']++;
                } catch (\Throwable $exception) {
                    $summary['errors']++;
                    Log::error('Selcom order reconciliation failed.', [
                        'order_id' => $order->id,
                        'error' => $exception->getMessage(),
                    ]);
                }
            });

        return $summary;
    }

    private function reconcileWithdrawals(int $limit): array
    {
        $summary = ['checked' => 0, 'successful' => 0, 'failed' => 0, 'pending' => 0, 'errors' => 0];

        WithdrawalRequest::query()
            ->with(['paymentProvider', 'paymentProviderChannel.provider'])
            ->where('status', 'processing')
            ->where(function ($query): void {
                $query->whereHas('paymentProvider', fn ($provider) => $provider->where('key', 'selcom'))
                    ->orWhereHas('paymentProviderChannel.provider', fn ($provider) => $provider->where('key', 'selcom'))
                    ->orWhere('payout_snapshot->provider', 'selcom');
            })
            ->where('updated_at', '<=', now()->subMinutes(3))
            ->orderBy('updated_at')
            ->limit($limit)
            ->get()
            ->each(function (WithdrawalRequest $withdrawal) use (&$summary): void {
                $summary['checked']++;

                try {
                    $reference = (string) data_get($withdrawal->payout_snapshot, 'provider_takeer_reference');
                    if ($reference === '') {
                        $reference = (string) data_get($withdrawal->payout_snapshot, 'provider_reference');
                    }

                    if ($reference === '') {
                        $this->recordWithdrawalStatus($withdrawal, new PaymentEvent(
                            provider: 'selcom',
                            direction: 'payout',
                            status: 'pending',
                            failureReason: 'Missing Selcom payout reference.',
                        ));
                        $summary['pending']++;
                        return;
                    }

                    $method = $withdrawal->paymentProviderChannel?->method
                        ?: data_get($withdrawal->payout_snapshot, 'provider_channel_method')
                        ?: $withdrawal->method;

                    $event = $method === 'bank'
                        ? $this->selcom->queryStatus($reference)
                        : $this->selcom->queryWalletCashinStatus($reference);

                    $this->recordWithdrawalStatus($withdrawal, $event);

                    if ($event->isSuccessful()) {
                        $withdrawal->update(['status' => 'approved']);
                        app(ProviderTreasuryService::class)->captureWithdrawal($withdrawal->fresh());
                        $summary['successful']++;
                        return;
                    }

                    if ($event->isFailed()) {
                        $withdrawal->update(['status' => 'failed']);
                        app(ProviderTreasuryService::class)->releaseWithdrawal($withdrawal->fresh());
                        app(WithdrawalFailureRecoveryService::class)->refundWalletDebit($withdrawal->fresh());
                        $summary['failed']++;
                        return;
                    }

                    $summary['pending']++;
                } catch (\Throwable $exception) {
                    $summary['errors']++;
                    Log::error('Selcom withdrawal reconciliation failed.', [
                        'withdrawal_id' => $withdrawal->id,
                        'error' => $exception->getMessage(),
                    ]);
                }
            });

        return $summary;
    }

    private function recordOrderStatus(Order $order, PaymentEvent $event): void
    {
        $snapshot = $order->payment_channel_snapshot ?: [];
        $snapshot['provider'] = 'selcom';
        $snapshot['reconciliation'] = [
            'last_checked_at' => now()->toISOString(),
            'status' => $event->status,
            'provider_reference' => $event->providerReference,
            'takeer_reference' => $event->takeerReference,
            'failure_reason' => $event->failureReason,
            'raw' => $event->rawPayload,
        ];

        $order->update(['payment_channel_snapshot' => $snapshot]);
    }

    private function recordWithdrawalStatus(WithdrawalRequest $withdrawal, PaymentEvent $event): void
    {
        $snapshot = $withdrawal->payout_snapshot ?: [];
        $snapshot['provider'] = 'selcom';
        $snapshot['provider_status'] = $event->status;
        $snapshot['provider_reference'] = $event->providerReference ?: ($snapshot['provider_reference'] ?? null);
        $snapshot['reconciliation'] = [
            'last_checked_at' => now()->toISOString(),
            'status' => $event->status,
            'provider_reference' => $event->providerReference,
            'takeer_reference' => $event->takeerReference,
            'failure_reason' => $event->failureReason,
            'raw' => $event->rawPayload,
        ];

        $withdrawal->update(['payout_snapshot' => $snapshot]);
    }
}
