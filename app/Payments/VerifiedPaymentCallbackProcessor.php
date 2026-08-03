<?php

namespace App\Payments;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\ProviderEvent;
use App\Services\MarketplaceSettlementService;
use App\Services\ProviderEventRecorder;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class VerifiedPaymentCallbackProcessor
{
    public function __construct(
        private readonly MarketplaceSettlementService $settlements,
        private readonly ProviderEventRecorder $events,
    ) {}

    public function process(PaymentEvent $payment, ProviderEvent $providerEvent): void
    {
        if (! $providerEvent->signature_valid) {
            $this->events->mark($providerEvent, 'rejected', 'invalid_signature');
            return;
        }

        $reference = trim((string) $payment->takeerReference);
        if ($reference === '') {
            $this->events->mark($providerEvent, 'rejected', 'missing_takeer_reference', ['reference' => 'missing']);
            return;
        }

        $attempt = PaymentAttempt::query()->with(['order', 'provider', 'channel'])->where('takeer_reference', $reference)->first();
        if (! $attempt) {
            $this->events->mark($providerEvent, 'review', 'attempt_not_found', ['reference' => 'unknown']);
            return;
        }
        if ((int) $attempt->payment_provider_id !== (int) $providerEvent->payment_provider_id) {
            $this->events->mark($providerEvent, 'rejected', 'provider_mismatch', ['provider' => 'mismatch']);
            return;
        }
        if ($attempt->provider?->key && strcasecmp((string) $attempt->provider->key, (string) $payment->provider) !== 0) {
            $this->events->mark($providerEvent, 'rejected', 'provider_key_mismatch');
            return;
        }
        if ($payment->channelKey && $attempt->channel?->key && $payment->channelKey !== $attempt->channel->key) {
            $this->events->mark($providerEvent, 'rejected', 'channel_mismatch');
            return;
        }
        if ($payment->direction !== 'payin') {
            $this->events->mark($providerEvent, 'review', 'unexpected_direction');
            return;
        }

        try {
            if ($payment->isSuccessful()) {
                $settlement = $this->settlements->confirmPayment($attempt->order, $attempt, $payment);
                $this->events->mark($providerEvent, 'processed', 'payment_confirmed');
                if ($attempt->order->product) {
                    event(new \App\Events\OrderPaid($attempt->order->fresh(['product', 'buyer'])));
                }
                if ($attempt->order->product?->isPhysical()) {
                    \App\Jobs\DispatchCourier::dispatch($attempt->order->fresh(['product', 'buyer']));
                }
                Log::info('Authenticated provider payment applied to order settlement.', [
                    'order_id' => $attempt->order_id,
                    'settlement_id' => $settlement->id,
                    'provider_event_id' => $providerEvent->id,
                ]);
            } elseif ($payment->isFailed()) {
                $this->settlements->failPayment($attempt->order, $attempt, $payment);
                $this->events->mark($providerEvent, 'processed', 'payment_failed');
            } else {
                $this->events->mark($providerEvent, 'pending', 'provider_status_pending');
            }
        } catch (RuntimeException $exception) {
            $this->events->mark($providerEvent, 'review', 'validation_failed', ['payment' => $exception->getMessage()]);
            Log::warning('Provider payment event requires operations review.', [
                'provider_event_id' => $providerEvent->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
