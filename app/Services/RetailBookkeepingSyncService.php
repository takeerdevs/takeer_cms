<?php

namespace App\Services;

use App\Models\Order;
use App\Models\RetailAuditLog;
use App\Models\RetailBookkeepingEntry;

class RetailBookkeepingSyncService
{
    public function syncOnlineOrder(Order $order): ?RetailBookkeepingEntry
    {
        if ($order->source === 'pos') {
            return null;
        }

        if (!in_array($order->payment_status, ['escrow_locked', 'resolved_merchant_paid'], true)) {
            return null;
        }

        $order->loadMissing(['merchant.currency', 'product', 'variant']);
        $amount = (float) ($order->grand_total ?? $order->total_paid ?? 0);

        if ($amount <= 0) {
            return null;
        }

        $metadata = [
            'source' => 'online_order',
            'order_id' => $order->id,
            'public_id' => $order->public_id,
            'payment_status' => $order->payment_status,
            'product_id' => $order->product_id,
            'variant_id' => $order->variant_id,
            'product_title' => $order->product?->title,
            'variant_name' => $order->variant?->name,
            'quantity' => (float) ($order->requested_quantity ?? $order->quantity ?? 1),
            'payment_gateway' => $order->payment_gateway,
            'gateway_ref' => $order->gateway_ref,
            'transaction_ref' => $order->transaction_ref,
        ];

        $entry = RetailBookkeepingEntry::query()
            ->where('merchant_id', $order->merchant_id)
            ->where('entry_type', 'income')
            ->where('metadata->source', 'online_order')
            ->where('metadata->order_id', $order->id)
            ->first();

        $payload = [
            'merchant_id' => $order->merchant_id,
            'staff_id' => null,
            'user_id' => null,
            'entry_type' => 'income',
            'category' => 'Online Orders',
            'counterparty' => null,
            'amount' => $amount,
            'currency_code' => $order->merchant?->currency?->code ?? 'TZS',
            'payment_method' => 'takeer_wallet',
            'reference_type' => 'bank_transaction',
            'reference_number' => $order->gateway_ref ?: ($order->transaction_ref ?: ($order->public_id ? "ORDER-{$order->public_id}" : null)),
            'transaction_date' => $order->created_at?->toDateString() ?? now()->toDateString(),
            'description' => "Auto-recorded online order {$order->public_id}.",
            'proof_status' => 'reference_only',
            'review_status' => 'approved',
            'reviewed_at' => now(),
            'reconciliation_status' => $order->gateway_ref || $order->transaction_ref ? 'matched' : 'unmatched',
            'statement_reference' => $order->gateway_ref ?: $order->transaction_ref,
            'status' => 'active',
            'metadata' => $metadata,
        ];

        if ($entry) {
            $before = $entry->only($this->auditedFields());
            $entry->update($payload);
            $entry->refresh();

            RetailAuditLog::create([
                'merchant_id' => $order->merchant_id,
                'action' => 'BOOKKEEPING_ONLINE_ORDER_ENTRY_SYNCED',
                'description' => "Bookkeeping online order income entry synced for {$order->public_id}.",
                'metadata' => [
                    'entry_id' => $entry->id,
                    'order_id' => $order->id,
                    'before' => $before,
                    'after' => $entry->only($this->auditedFields()),
                ],
            ]);

            app(FiscalReceiptService::class)->createOrQueueForOrder($order, $entry);

            return $entry;
        }

        $entry = RetailBookkeepingEntry::create($payload);

        RetailAuditLog::create([
            'merchant_id' => $order->merchant_id,
            'action' => 'BOOKKEEPING_ONLINE_ORDER_ENTRY_CREATED',
            'description' => "Bookkeeping online order income entry created for {$order->public_id}.",
            'metadata' => [
                'entry_id' => $entry->id,
                'order_id' => $order->id,
            ],
        ]);

        app(FiscalReceiptService::class)->createOrQueueForOrder($order, $entry);

        return $entry;
    }

    public function voidOnlineOrder(Order $order, ?string $reason = null): void
    {
        if ($order->source === 'pos') {
            return;
        }

        $entry = RetailBookkeepingEntry::query()
            ->where('merchant_id', $order->merchant_id)
            ->where('metadata->source', 'online_order')
            ->where('metadata->order_id', $order->id)
            ->where('status', 'active')
            ->first();

        if (!$entry) {
            return;
        }

        $before = $entry->only($this->auditedFields());
        $entry->update([
            'status' => 'voided',
            'voided_at' => now(),
            'void_reason' => $reason ?: 'Online order payment voided or refunded.',
        ]);

        RetailAuditLog::create([
            'merchant_id' => $order->merchant_id,
            'action' => 'BOOKKEEPING_ONLINE_ORDER_ENTRY_VOIDED',
            'description' => "Bookkeeping online order income entry voided for {$order->public_id}.",
            'metadata' => [
                'entry_id' => $entry->id,
                'order_id' => $order->id,
                'before' => $before,
                'after' => $entry->fresh()->only($this->auditedFields()),
            ],
        ]);

        app(FiscalReceiptService::class)->markVoidedForOrder($order, $reason);
    }

    public function syncPosSale(Order $order, ?int $staffId = null, ?int $userId = null, array $extraMetadata = []): ?RetailBookkeepingEntry
    {
        if ($order->source !== 'pos') {
            return null;
        }

        if (($order->approval_status ?? 'approved') !== 'approved') {
            return null;
        }

        if (in_array($order->payment_status, ['failed', 'resolved_buyer_refunded'], true)) {
            return null;
        }

        $order->loadMissing(['merchant.currency', 'posStaff.user', 'posItems.product', 'posItems.variant']);
        $amount = (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0);

        if ($amount <= 0) {
            return null;
        }

        $metadata = array_merge([
            'source' => 'pos_sale',
            'order_id' => $order->id,
            'public_id' => $order->public_id,
            'payment_status' => $order->payment_status,
            'approval_status' => $order->approval_status,
            'item_count' => $order->posItems->count(),
            'items' => $order->posItems->map(fn($item) => [
                'product_id' => $item->product_id,
                'variant_id' => $item->product_variant_id,
                'title' => $item->product?->title,
                'variant' => $item->variant?->name,
                'quantity' => (float) ($item->quantity_decimal ?? $item->quantity),
                'unit_price' => (float) $item->unit_price,
                'line_total' => (float) $item->price_at_sale,
            ])->values()->all(),
        ], $extraMetadata);

        $entry = RetailBookkeepingEntry::query()
            ->where('merchant_id', $order->merchant_id)
            ->where('entry_type', 'income')
            ->where('metadata->source', 'pos_sale')
            ->where('metadata->order_id', $order->id)
            ->first();

        $payload = [
            'merchant_id' => $order->merchant_id,
            'staff_id' => $staffId ?? $order->pos_staff_id,
            'user_id' => $userId ?? $order->posStaff?->user_id,
            'entry_type' => 'income',
            'category' => 'POS Sales',
            'counterparty' => $order->customer_name,
            'amount' => $amount,
            'currency_code' => $order->merchant?->currency?->code ?? 'TZS',
            'payment_method' => $this->paymentMethodFor($order->payment_mode),
            'reference_type' => $this->referenceTypeFor($order->payment_mode),
            'reference_number' => $order->public_id ? "POS-{$order->public_id}" : null,
            'transaction_date' => $order->created_at?->toDateString() ?? now()->toDateString(),
            'description' => "Auto-recorded POS sale {$order->public_id}.",
            'proof_status' => 'reference_only',
            'review_status' => 'approved',
            'reviewed_by_user_id' => $userId,
            'reviewed_at' => now(),
            'reconciliation_status' => in_array($order->payment_mode, ['online_escrow'], true) ? 'matched' : 'unmatched',
            'statement_reference' => $order->gateway_ref ?: $order->transaction_ref,
            'status' => 'active',
            'metadata' => $metadata,
        ];

        if ($entry) {
            $before = $entry->only($this->auditedFields());
            $entry->update($payload);
            $entry->refresh();

            RetailAuditLog::create([
                'merchant_id' => $order->merchant_id,
                'staff_id' => $staffId ?? $order->pos_staff_id,
                'user_id' => $userId,
                'action' => 'BOOKKEEPING_POS_ENTRY_SYNCED',
                'description' => "Bookkeeping POS income entry synced for {$order->public_id}.",
                'metadata' => [
                    'entry_id' => $entry->id,
                    'order_id' => $order->id,
                    'before' => $before,
                    'after' => $entry->only($this->auditedFields()),
                ],
            ]);

            app(FiscalReceiptService::class)->createOrQueueForOrder($order, $entry);

            return $entry;
        }

        $entry = RetailBookkeepingEntry::create($payload);

        RetailAuditLog::create([
            'merchant_id' => $order->merchant_id,
            'staff_id' => $staffId ?? $order->pos_staff_id,
            'user_id' => $userId,
            'action' => 'BOOKKEEPING_POS_ENTRY_CREATED',
            'description' => "Bookkeeping POS income entry created for {$order->public_id}.",
            'metadata' => [
                'entry_id' => $entry->id,
                'order_id' => $order->id,
            ],
        ]);

        app(FiscalReceiptService::class)->createOrQueueForOrder($order, $entry);

        return $entry;
    }

    public function voidPosSale(Order $order, ?int $staffId = null, ?int $userId = null, ?string $reason = null): void
    {
        $entry = RetailBookkeepingEntry::query()
            ->where('merchant_id', $order->merchant_id)
            ->where('metadata->source', 'pos_sale')
            ->where('metadata->order_id', $order->id)
            ->where('status', 'active')
            ->first();

        if (!$entry) {
            return;
        }

        $before = $entry->only($this->auditedFields());
        $entry->update([
            'status' => 'voided',
            'voided_by_user_id' => $userId,
            'voided_at' => now(),
            'void_reason' => $reason ?: 'POS sale voided.',
        ]);

        RetailAuditLog::create([
            'merchant_id' => $order->merchant_id,
            'staff_id' => $staffId ?? $order->pos_staff_id,
            'user_id' => $userId,
            'action' => 'BOOKKEEPING_POS_ENTRY_VOIDED',
            'description' => "Bookkeeping POS income entry voided for {$order->public_id}.",
            'metadata' => [
                'entry_id' => $entry->id,
                'order_id' => $order->id,
                'before' => $before,
                'after' => $entry->fresh()->only($this->auditedFields()),
            ],
        ]);

        app(FiscalReceiptService::class)->markVoidedForOrder($order, $reason);
    }

    private function paymentMethodFor(?string $paymentMode): string
    {
        return match ($paymentMode) {
            'cash' => 'cash',
            'merchant_mm' => 'mobile_money',
            'online_escrow' => 'takeer_wallet',
            'store_credit' => 'other',
            default => 'other',
        };
    }

    private function referenceTypeFor(?string $paymentMode): ?string
    {
        return match ($paymentMode) {
            'merchant_mm' => 'mobile_money',
            'online_escrow' => 'bank_transaction',
            default => 'other',
        };
    }

    private function auditedFields(): array
    {
        return [
            'entry_type',
            'category',
            'counterparty',
            'amount',
            'payment_method',
            'reference_type',
            'reference_number',
            'transaction_date',
            'proof_status',
            'review_status',
            'reconciliation_status',
            'statement_reference',
            'status',
            'void_reason',
        ];
    }
}
