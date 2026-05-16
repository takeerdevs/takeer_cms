<?php

namespace App\Services;

use App\Models\FiscalReceipt;
use App\Models\MerchantFiscalIntegration;
use App\Models\Order;
use App\Models\RetailBookkeepingEntry;
use App\Services\Fiscal\FiscalProviderManager;

class FiscalReceiptService
{
    public function createOrQueueForOrder(Order $order, ?RetailBookkeepingEntry $entry = null): ?FiscalReceipt
    {
        $order->loadMissing('merchant.country');
        $merchant = $order->merchant;

        if (!$merchant?->country_id) {
            return null;
        }

        $integration = MerchantFiscalIntegration::query()
            ->where('merchant_id', $merchant->id)
            ->where('country_id', $merchant->country_id)
            ->where('status', 'active')
            ->with(['provider', 'regime'])
            ->first();

        if (!$integration || !$integration->hasUsableCredentials()) {
            $this->markManualFallback($entry, $this->fallbackReason($integration));
            return null;
        }

        $receipt = FiscalReceipt::firstOrCreate(
            [
                'order_id' => $order->id,
                'retail_bookkeeping_entry_id' => $entry?->id,
                'source_type' => $order->source === 'pos' ? 'pos_order' : 'online_order',
            ],
            [
                'merchant_id' => $merchant->id,
                'country_id' => $integration->country_id,
                'fiscal_regime_id' => $integration->fiscal_regime_id,
                'fiscal_provider_id' => $integration->fiscal_provider_id,
                'merchant_fiscal_integration_id' => $integration->id,
                'status' => 'pending',
                'request_payload' => $this->payloadForOrder($order, $entry),
            ]
        );

        if ($receipt->status !== 'issued') {
            $receipt->update(['status' => $receipt->status === 'pending' ? 'queued' : $receipt->status]);
            \App\Jobs\IssueFiscalReceipt::dispatch($receipt->id);
        }

        return $receipt->fresh();
    }

    public function markVoidedForOrder(Order $order, ?string $reason = null): void
    {
        FiscalReceipt::query()
            ->where('order_id', $order->id)
            ->whereNotIn('status', ['issued'])
            ->update([
                'status' => 'voided',
                'failure_reason' => $reason ?: 'Source order was voided before fiscal receipt issuance.',
            ]);
    }

    public function retry(FiscalReceipt $receipt): FiscalReceipt
    {
        $receipt->loadMissing('integration.provider');

        if (!$receipt->integration || $receipt->status === 'issued') {
            return $receipt;
        }

        return $this->attemptIssue($receipt, $receipt->integration);
    }

    public function attemptIssue(FiscalReceipt $receipt, MerchantFiscalIntegration $integration): FiscalReceipt
    {
        if (!$integration->hasUsableCredentials()) {
            $receipt->update([
                'status' => 'manual_fallback',
                'attempts' => $receipt->attempts + 1,
                'last_attempted_at' => now(),
                'failure_reason' => $this->fallbackReason($integration),
            ]);
            $this->markManualFallback($receipt->bookkeepingEntry, $this->fallbackReason($integration));

            return $receipt->fresh();
        }

        $provider = app(FiscalProviderManager::class)->forProvider($integration->provider);
        $result = $provider->issue($integration, $receipt);

        $receipt->update([
            'status' => $result->status,
            'receipt_number' => $result->receiptNumber,
            'verification_code' => $result->verificationCode,
            'verification_url' => $result->verificationUrl,
            'qr_code_data' => $result->qrCodeData,
            'z_report_reference' => $result->zReportReference,
            'provider_response' => $result->providerResponse,
            'attempts' => $receipt->attempts + 1,
            'issued_at' => $result->successful ? now() : null,
            'last_attempted_at' => now(),
            'failure_reason' => $result->failureReason,
        ]);

        if ($result->fallbackToManual) {
            $this->markManualFallback($receipt->bookkeepingEntry, $result->failureReason);
        }

        return $receipt->fresh();
    }

    private function markManualFallback(?RetailBookkeepingEntry $entry, ?string $reason = null): void
    {
        if (!$entry || $entry->status !== 'active') {
            return;
        }

        $metadata = $entry->metadata ?? [];
        $metadata['fiscal_receipt'] = [
            'mode' => 'manual_fallback',
            'reason' => $reason ?: 'Automated fiscal receipt integration is not active.',
            'requires_manual_reference' => true,
            'marked_at' => now()->toISOString(),
        ];

        $entry->update([
            'proof_status' => $entry->reference_number ? 'reference_only' : 'missing',
            'metadata' => $metadata,
        ]);
    }

    private function fallbackReason(?MerchantFiscalIntegration $integration): string
    {
        if (!$integration) {
            return 'No active fiscal provider integration is configured for this merchant country.';
        }

        if ($integration->providerAccessExpired()) {
            return 'Fiscal provider access appears expired. Merchant should renew with the provider or enter receipt references manually.';
        }

        if (!$integration->hasUsableCredentials()) {
            return 'Fiscal provider credentials are incomplete or inactive.';
        }

        return 'Automated fiscal receipt could not be issued.';
    }

    private function payloadForOrder(Order $order, ?RetailBookkeepingEntry $entry): array
    {
        $order->loadMissing(['merchant', 'posItems.product', 'posItems.variant', 'product', 'variant']);

        return [
            'order_id' => $order->id,
            'public_id' => $order->public_id,
            'source' => $order->source,
            'amount' => (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0),
            'currency' => $entry?->currency_code ?? 'TZS',
            'payment_mode' => $order->payment_mode,
            'bookkeeping_entry_id' => $entry?->id,
            'items' => $order->source === 'pos'
                ? $order->posItems->map(fn($item) => [
                    'name' => $item->product?->title,
                    'variant' => $item->variant?->name,
                    'quantity' => (float) ($item->quantity_decimal ?? $item->quantity),
                    'unit_price' => (float) $item->unit_price,
                    'line_total' => (float) $item->price_at_sale,
                ])->values()->all()
                : [[
                    'name' => $order->product?->title,
                    'variant' => $order->variant?->name,
                    'quantity' => (float) ($order->requested_quantity ?? $order->quantity ?? 1),
                    'unit_price' => (float) ($order->unit_price ?? $order->total_paid ?? 0),
                    'line_total' => (float) ($order->grand_total ?? $order->total_paid ?? 0),
                ]],
        ];
    }
}
