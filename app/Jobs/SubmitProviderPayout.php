<?php

namespace App\Jobs;

use App\Models\ProviderPayout;
use App\Payments\Contracts\PaymentProviderAdapterInterface;
use App\Payments\GatewayRegistry;
use App\Services\MarketplaceSettlementService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Sends one order-allocated payout instruction to the PSP.
 *
 * The provider idempotency key is reused on every retry. A timeout therefore
 * produces a provider-status/reconciliation case rather than a second payout.
 */
class SubmitProviderPayout implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly int $providerPayoutId)
    {
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(GatewayRegistry $gateways, MarketplaceSettlementService $settlements): void
    {
        $payout = ProviderPayout::query()
            ->with(['provider', 'sellerProfile', 'allocations.settlement.order'])
            ->find($this->providerPayoutId);

        if (! $payout || in_array($payout->state, ['completed', 'failed'], true)) {
            return;
        }

        $settlement = $payout->allocations->first()?->settlement;
        if (! $settlement || ! in_array($settlement->settlement_state, ['release_requested', 'payout_processing'], true)) {
            return;
        }

        $driver = $payout->provider?->driver ?: $payout->provider?->key;
        if (! $driver) {
            $this->failClosed($payout, $settlement, 'provider_driver_missing');
            return;
        }

        $adapter = $gateways->resolveByName($driver);
        if (! $adapter instanceof PaymentProviderAdapterInterface) {
            $this->failClosed($payout, $settlement, 'provider_payout_adapter_not_certified');
            return;
        }

        // Mark the instruction as in-flight before the external call. The
        // same idempotency key is sent if the worker is retried after a timeout.
        DB::transaction(function () use ($payout, $settlement): void {
            $locked = ProviderPayout::query()->lockForUpdate()->findOrFail($payout->id);
            $locked->update([
                'state' => 'processing',
                'submitted_at' => $locked->submitted_at ?: now(),
                'retry_count' => (int) $locked->retry_count + 1,
            ]);

            if ($settlement->settlement_state === 'release_requested') {
                $settlement->update(['settlement_state' => 'payout_processing']);
                $settlements->transition(
                    $settlement,
                    'release_requested',
                    'payout_processing',
                    'psp_payout_submission_started',
                    evidence: ['provider_payout_id' => $payout->id],
                );
            }
        });

        try {
            $profile = $payout->sellerProfile;
            $result = $adapter->createPayout([
                'takeer_reference' => $payout->provider_idempotency_key,
                'provider_idempotency_key' => $payout->provider_idempotency_key,
                'provider_merchant_id' => $profile?->provider_merchant_id,
                'provider_submerchant_id' => $profile?->provider_submerchant_id,
                'amount' => $payout->amount_minor / 100,
                'amount_minor' => $payout->amount_minor,
                'currency' => $payout->currency,
                'method' => data_get($profile?->metadata, 'payout_method', 'mobile_money'),
                'network' => data_get($profile?->metadata, 'payout_network'),
                'details' => data_get($profile?->metadata, 'provider_payout_details', []),
                'narration' => 'Takeer order settlement ' . $settlement->order_id,
            ]);

            $payout->update([
                'state' => $result->success ? 'submitted' : 'failed',
                'provider_payout_reference' => $result->gatewayRef ?: $payout->provider_payout_reference,
                'failure_code' => $result->success ? null : $result->errorCode,
                'failure_message' => $result->success ? null : $result->message,
                'failed_at' => $result->success ? null : now(),
                'metadata' => array_merge($payout->metadata ?: [], [
                    'submission_response' => $result->raw,
                    'submitted_at' => now()->toISOString(),
                ]),
            ]);

            if (! $result->success) {
                $settlement->update([
                    'settlement_state' => 'provider_exception',
                    'hold_reason' => 'PSP payout submission failed; provider status review required.',
                ]);
            }
        } catch (\Throwable $exception) {
            if ($this->attempts() >= $this->tries) {
                $this->failClosed($payout, $settlement, $exception->getMessage());
                return;
            }

            throw $exception;
        }
    }

    private function failClosed(ProviderPayout $payout, $settlement, string $reason): void
    {
        $payout->update([
            'state' => 'failed',
            'failed_at' => now(),
            'failure_code' => 'provider_payout_unavailable',
            'failure_message' => $reason,
        ]);
        $settlement->update([
            'settlement_state' => 'provider_exception',
            'hold_reason' => 'PSP payout could not be submitted; no Takeer-held balance was created.',
        ]);
    }
}
