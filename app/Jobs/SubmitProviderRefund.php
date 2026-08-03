<?php

namespace App\Jobs;

use App\Models\ProviderRefund;
use App\Payments\Contracts\PaymentProviderAdapterInterface;
use App\Payments\GatewayRegistry;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SubmitProviderRefund implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly int $providerRefundId)
    {
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(GatewayRegistry $gateways): void
    {
        $refund = ProviderRefund::query()->with(['provider', 'settlement'])->find($this->providerRefundId);
        if (! $refund || in_array($refund->state, ['completed', 'failed'], true)) {
            return;
        }

        $driver = $refund->provider?->driver ?: $refund->provider?->key;
        $adapter = $driver ? $gateways->resolveByName($driver) : null;
        if (! $adapter instanceof PaymentProviderAdapterInterface) {
            $this->failClosed($refund, 'provider_refund_adapter_not_certified');
            return;
        }

        $refund->update(['state' => 'processing']);
        $result = $adapter->createRefund([
            'takeer_reference' => $refund->provider_idempotency_key,
            'provider_idempotency_key' => $refund->provider_idempotency_key,
            'provider_transaction_reference' => $refund->provider_transaction_reference,
            'amount' => $refund->amount_minor / 100,
            'amount_minor' => $refund->amount_minor,
            'currency' => $refund->currency,
            'reason_code' => $refund->reason_code,
            'order_id' => $refund->settlement?->order_id,
            'metadata' => $refund->metadata ?: [],
        ]);

        if (! $result->success) {
            $this->failClosed($refund, $result->errorCode ?: $result->message);
            return;
        }

        $refund->update([
            'state' => 'submitted',
            'provider_refund_reference' => $result->gatewayRef,
            'metadata' => array_merge($refund->metadata ?: [], ['submission_response' => $result->raw]),
        ]);
    }

    private function failClosed(ProviderRefund $refund, string $reason): void
    {
        $refund->update([
            'state' => 'failed',
            'failed_at' => now(),
            'metadata' => array_merge($refund->metadata ?: [], ['failure' => $reason]),
        ]);
        $refund->settlement?->update([
            'settlement_state' => 'provider_exception',
            'hold_reason' => 'PSP refund could not be submitted; provider status review required.',
        ]);
    }
}
