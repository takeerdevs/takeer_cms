<?php

namespace App\Payments;

use App\Models\ProviderPayout;
use App\Models\ProviderEvent;
use App\Models\ProviderRefund;
use App\Services\MarketplaceSettlementService;

class VerifiedPayoutCallbackProcessor
{
    public function __construct(private readonly MarketplaceSettlementService $settlements) {}

    public function process(PaymentEvent $event, ProviderEvent $providerEvent): void
    {
        if (! $providerEvent->signature_valid) {
            return;
        }

        if ($event->direction === 'refund') {
            $refund = ProviderRefund::query()
                ->with('settlement')
                ->where('provider_refund_reference', $event->providerReference)
                ->orWhere('provider_idempotency_key', $event->takeerReference)
                ->first();
            if (! $refund) {
                return;
            }
            try {
                if ($event->isSuccessful()) {
                    $this->settlements->completeRefund($refund, $event, $providerEvent);
                } elseif ($event->isFailed()) {
                    $this->settlements->failRefund($refund, $event, $providerEvent);
                }
            } catch (\Throwable $exception) {
                $providerEvent->update([
                    'validation_state' => 'review',
                    'processing_result' => 'refund_validation_failed',
                    'validation_errors' => ['refund' => $exception->getMessage()],
                ]);
            }
            return;
        }

        if ($event->direction !== 'payout') {
            return;
        }

        $payout = ProviderPayout::query()
            ->with('allocations.settlement')
            ->where('provider_payout_reference', $event->providerReference)
            ->orWhere('provider_idempotency_key', $event->takeerReference)
            ->first();
        if (! $payout) {
            return;
        }

        try {
            if ($event->isSuccessful()) {
                $this->settlements->completePayout($payout, $event, $providerEvent);
            } elseif ($event->isFailed()) {
                $this->settlements->failPayout($payout, $event, $providerEvent);
            }
        } catch (\Throwable $exception) {
            $providerEvent->update([
                'validation_state' => 'review',
                'processing_result' => 'payout_validation_failed',
                'validation_errors' => ['payout' => $exception->getMessage()],
            ]);
        }
    }
}
