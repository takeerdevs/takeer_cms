<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    public const CUSTOM_DELIVERY_REVISION_LIMIT = 3;

    protected $fillable = [
        'public_id',
        'pickup_code',
        'buyer_id',
        'merchant_id',
        'product_id',
        'variant_id',
        'variant_snapshot',
        'bundle_item_selection',
        'offering_group_selection',
        'purchasable_type',
        'purchasable_id',
        'order_kind',
        'quantity',
        'requested_quantity',
        'product_unit_type_id',
        'unit_snapshot',
        'unit_price',
        'total_paid',
        'payment_status',
        'merchant_dispatch_video_url',
        'transaction_ref',
        'idempotency_key',
        'account_phone',
        'payment_phone',
        'is_inquiry',
        'inquiry_status',
        'shipping_fee',
        'discount_amount',
        'merchant_coupon_id',
        'coupon_code',
        'merchant_referral_link_id',
        'group_sale_campaign_id',
        'referral_code',
        'referral_commission_amount',
        'referral_commission_status',
        'referral_commission_paid_at',
        'referral_reward_snapshot',
        // Payment gateway tracking (multi-country / multi-gateway)
        'payment_gateway', // e.g. 'azampay', 'mpesa_ke'
        'country_code',    // ISO 3166-1 alpha-2, e.g. 'TZ', 'KE'
        'gateway_ref',     // Gateway's own transaction ID for reconciliation
        'extra_items',     // Suggested items added during chat
        'expires_at',
        'payment_page_id',
        'source',
        'payment_mode',
        'pos_staff_id',
        'customer_name',
        'customer_phone',
        'grand_total',
        'approval_status',
        'approved_by_staff_id',
        'approval_requested_at',
        'counter_total',
        'manager_notes',
        'agreement_snapshot',
        'agreed_at',
        'inventory_reserved_at',
        'merchant_confirmed_at',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'paid_out_at',
        'live_event_attendance_status',
        'live_event_checked_in_at',
        'live_event_access_last_sent_at',
        'custom_delivery_file_url',
        'custom_delivery_file_name',
        'custom_delivery_file_mime',
        'custom_delivery_file_size',
        'custom_delivery_message',
        'custom_delivery_due_at',
        'custom_delivery_delivered_at',
        'custom_delivery_status',
        'custom_delivery_revision_message',
        'custom_delivery_revision_requested_at',
        'custom_delivery_revision_count',
        'custom_delivery_accepted_at',
        'download_count',
        'first_downloaded_at',
        'refund_locked_at',
        'refund_lock_reason',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'requested_quantity' => 'decimal:3',
            'product_unit_type_id' => 'integer',
            'unit_snapshot' => 'array',
            'variant_id' => 'integer',
            'variant_snapshot' => 'array',
            'bundle_item_selection' => 'array',
            'offering_group_selection' => 'array',
            'unit_price' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'referral_commission_amount' => 'decimal:2',
            'referral_reward_snapshot' => 'array',
            'total_paid' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'counter_total' => 'decimal:2',
            'agreement_snapshot' => 'array',
            'agreed_at' => 'datetime',
            'inventory_reserved_at' => 'datetime',
            'merchant_confirmed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'paid_out_at' => 'datetime',
            'is_inquiry' => 'boolean',
            'extra_items' => 'array',
            'expires_at' => 'datetime',
            'referral_commission_paid_at' => 'datetime',
            'approval_requested_at' => 'datetime',
            'live_event_checked_in_at' => 'datetime',
            'live_event_access_last_sent_at' => 'datetime',
            'custom_delivery_file_size' => 'integer',
            'custom_delivery_due_at' => 'datetime',
            'custom_delivery_delivered_at' => 'datetime',
            'custom_delivery_revision_requested_at' => 'datetime',
            'custom_delivery_revision_count' => 'integer',
            'custom_delivery_accepted_at' => 'datetime',
            'download_count' => 'integer',
            'first_downloaded_at' => 'datetime',
            'refund_locked_at' => 'datetime',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function customDeliveryDueAtFrom($start = null)
    {
        $this->loadMissing('product');

        if (! $this->product?->isDigital() || ($this->product?->digital_delivery_type ?? null) !== 'custom_delivery') {
            return null;
        }

        $leadTimeDays = (int) ($this->product?->availability_lead_time_days ?? 0);

        return $leadTimeDays > 0
            ? ($start ?: now())->copy()->addDays($leadTimeDays)
            : null;
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(MerchantCoupon::class, 'merchant_coupon_id');
    }

    public function referralLink(): BelongsTo
    {
        return $this->belongsTo(MerchantReferralLink::class, 'merchant_referral_link_id');
    }

    public function groupSaleCampaign(): BelongsTo
    {
        return $this->belongsTo(MerchantGroupSaleCampaign::class, 'group_sale_campaign_id');
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            if (! $order->public_id) {
                $order->public_id = static::generatePublicId();
            }
            if (! $order->pickup_code) {
                $order->pickup_code = static::generatePickupCode();
            }
        });

        static::created(function (Order $order): void {
            app(\App\Services\PulseNotificationService::class)->orderCreated($order);
        });

        static::updated(function (Order $order): void {
            app(\App\Services\PulseNotificationService::class)->orderUpdated($order);

            if (! $order->wasChanged('payment_status')) {
                return;
            }

            if ($order->isReferralCommissionEarnedStatus()) {
                app(\App\Services\RetailBookkeepingSyncService::class)->syncOnlineOrder($order);
                $order->ensureReferralCommission();
                if (! in_array($order->getOriginal('payment_status'), ['escrow_locked', 'resolved_merchant_paid'], true)) {
                    $order->recordGroupSaleConversion();
                    $order->recordReferralConversion();
                }
                return;
            }

            if ($order->isReferralCommissionVoidStatus()) {
                app(\App\Services\RetailBookkeepingSyncService::class)->voidOnlineOrder($order);
                if (in_array($order->getOriginal('payment_status'), ['escrow_locked', 'resolved_merchant_paid', 'disputed'], true)) {
                    $order->reverseGroupSaleConversion();
                }
                if (in_array($order->getOriginal('payment_status'), ['escrow_locked', 'resolved_merchant_paid', 'disputed'], true)) {
                    $order->reverseReferralConversion();
                }
                $order->voidReferralCommission();
            }
        });
    }

    public static function generatePickupCode(int $length = 6): string
    {
        do {
            $code = strtoupper(\Illuminate\Support\Str::random($length));
            // Remove ambiguous chars
            $code = str_replace(['0', 'O', '1', 'I'], ['8', 'A', '2', 'B'], $code);
        } while (static::query()->where('pickup_code', $code)->exists());

        return $code;
    }

    public static function generatePublicId(int $length = 16): string
    {
        do {
            $candidate = \Illuminate\Support\Str::random($length);
        } while (static::query()->where('public_id', $candidate)->exists());

        return $candidate;
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function delivery(): HasOne
    {
        return $this->hasOne(Delivery::class);
    }

    public function dispute(): HasOne
    {
        return $this->hasOne(Dispute::class);
    }

    public function customDeliveryEvents(): HasMany
    {
        return $this->hasMany(CustomDeliveryEvent::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(ProductReview::class);
    }

    public function resolutions(): HasMany
    {
        return $this->hasMany(DisputeResolution::class);
    }

    public function posStaff(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'pos_staff_id');
    }

    public function posItems(): HasMany
    {
        return $this->hasMany(PosSaleItem::class);
    }

    public function fiscalReceipts(): HasMany
    {
        return $this->hasMany(FiscalReceipt::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(SubscriptionInvoice::class);
    }

    public function getResolvedPurchasableAttribute()
    {
        return match ($this->purchasable_type) {
            'product' => $this->product,
            'bundle' => Bundle::find($this->purchasable_id),
            'offering_group' => OfferingGroup::find($this->purchasable_id),
            'content_item' => ContentItem::find($this->purchasable_id),
            'subscription_plan' => SubscriptionPlan::find($this->purchasable_id),
            'post' => Post::find($this->purchasable_id),
            default => $this->product,
        };
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isEscrowLocked(): bool
    {
        return $this->payment_status === 'escrow_locked';
    }

    public function isDisputed(): bool
    {
        return $this->payment_status === 'disputed';
    }

    public function isInquiry(): bool
    {
        return (bool) $this->is_inquiry;
    }

    public function isPendingQuote(): bool
    {
        return $this->is_inquiry && $this->inquiry_status === 'pending';
    }

    public function isQuotedPhysicalInquiry(): bool
    {
        return $this->requiresPhysicalFulfillment()
            && $this->is_inquiry
            && $this->inquiry_status === 'quoted'
            && $this->payment_status === 'pending';
    }

    public function isPaidOut(): bool
    {
        return $this->paid_out_at !== null || $this->payment_status === 'resolved_merchant_paid';
    }

    public function canBeCancelledBeforePayment(): bool
    {
        return $this->payment_status === 'pending';
    }

    public function markPhysicalAgreement(array $snapshot = []): void
    {
        $this->forceFill([
            'is_inquiry' => true,
            'inquiry_status' => 'quoted',
            'agreement_snapshot' => array_filter([
                'unit_price' => $snapshot['unit_price'] ?? ($this->unit_price !== null ? (float) $this->unit_price : null),
                'shipping_fee' => $snapshot['shipping_fee'] ?? ($this->shipping_fee !== null ? (float) $this->shipping_fee : null),
                'quantity' => $snapshot['quantity'] ?? (int) max(1, $this->quantity ?: 1),
                'total_paid' => $snapshot['total_paid'] ?? ($this->total_paid !== null ? (float) $this->total_paid : null),
                'delivery_type' => $snapshot['delivery_type'] ?? $this->delivery?->delivery_type,
                'physical_address' => $snapshot['physical_address'] ?? $this->delivery?->physical_address,
                'notes' => $snapshot['notes'] ?? null,
                'agreed_at' => now()->toISOString(),
            ], fn ($value) => $value !== null && $value !== ''),
            'agreed_at' => now(),
        ])->save();
    }

    public function isReferralCommissionEarnedStatus(): bool
    {
        return in_array($this->payment_status, ['escrow_locked', 'resolved_merchant_paid'], true);
    }

    public function isReferralCommissionVoidStatus(): bool
    {
        return in_array($this->payment_status, ['failed', 'resolved_buyer_refunded'], true);
    }

    public function markDigitalAccessed(string $reason = 'download'): void
    {
        $updates = [
            'download_count' => (int) $this->download_count + 1,
            'first_downloaded_at' => $this->first_downloaded_at ?: now(),
        ];

        if (! $this->refund_locked_at) {
            $updates['refund_locked_at'] = now();
            $updates['refund_lock_reason'] = $reason;
        }

        $this->forceFill($updates)->save();
    }

    public function refundPolicyContext(): array
    {
        $this->loadMissing('product');
        $product = $this->product;
        $deliveryType = (string) ($product?->digital_delivery_type ?? '');
        $isDigital = $product?->type === 'digital';
        $isService = $product?->type === 'service';
        $policy = (string) ($product?->refund_policy ?: 'standard');
        $windowDays = $product?->refund_window_days;
        $createdAt = $this->created_at ?: now();
        $windowEndsAt = $windowDays ? $createdAt->copy()->addDays((int) $windowDays) : null;
        $status = 'eligible';
        $reason = 'Eligible for review while payment is held by Takeer.';

        if (! in_array($this->payment_status, ['escrow_locked', 'shipped'], true)) {
            $status = 'not_eligible';
            $reason = 'Refund claims are only available while payment is still held or shipment is active.';
        } elseif ($policy === 'final_sale') {
            $status = 'not_eligible';
            $reason = 'The creator marked this item as final sale.';
        } elseif ($windowEndsAt && now()->greaterThan($windowEndsAt)) {
            $status = 'not_eligible';
            $reason = 'The refund window has ended.';
        } elseif ($isDigital && $deliveryType === 'custom_delivery' && $this->custom_delivery_status === 'accepted') {
            $status = 'not_eligible';
            $reason = 'Custom work was accepted by the buyer.';
        } elseif ($isDigital && $deliveryType === 'live_event' && $product?->live_event_starts_at) {
            $endsAt = $product->live_event_starts_at->copy()->addMinutes((int) ($product->live_event_duration_minutes ?: 120));
            if (now()->greaterThan($endsAt)) {
                $status = 'not_eligible';
                $reason = 'The live event has already ended.';
            }
        } elseif ($isDigital && (int) $this->download_count > 0 && $deliveryType !== 'custom_delivery') {
            $status = 'not_eligible';
            $reason = 'Digital content has already been accessed or downloaded.';
        } elseif ($isDigital && $this->refund_locked_at && $deliveryType !== 'custom_delivery') {
            $status = 'not_eligible';
            $reason = 'Digital access has already started.';
        } elseif ($isService) {
            $reason = 'Service refund requests are reviewed against delivery evidence and SafePay status.';
        } elseif ($isDigital && $deliveryType === 'custom_delivery') {
            $reason = 'Custom work can be disputed before acceptance; revisions should be requested first when possible.';
        } elseif ($isDigital) {
            $reason = 'Digital purchases are refundable only before access/download begins.';
        }

        return [
            'status' => $status,
            'reason' => $reason,
            'policy' => $policy,
            'window_days' => $windowDays ? (int) $windowDays : null,
            'window_ends_at' => $windowEndsAt?->toISOString(),
            'note' => $product?->refund_policy_note,
            'download_count' => (int) $this->download_count,
            'first_downloaded_at' => $this->first_downloaded_at?->toISOString(),
            'refund_locked_at' => $this->refund_locked_at?->toISOString(),
            'refund_lock_reason' => $this->refund_lock_reason,
        ];
    }

    public function canOpenRefundDispute(): bool
    {
        return ($this->refundPolicyContext()['status'] ?? null) === 'eligible';
    }

    public function ensureReferralCommission(): void
    {
        if (! $this->merchant_referral_link_id) {
            return;
        }

        if ($this->referral_commission_status && $this->referral_commission_status !== 'void') {
            return;
        }

        $link = $this->referralLink()->first();
        if (! $link || $link->reward_type === 'none') {
            return;
        }

        $amount = match ($link->reward_type) {
            'percent' => (float) $this->total_paid * ((float) $link->reward_value / 100),
            'fixed' => (float) $link->reward_value,
            default => 0,
        };
        $amount = round(max(0, min((float) $this->total_paid, $amount)), 2);

        if ($amount <= 0) {
            return;
        }

        $this->forceFill([
            'referral_commission_amount' => $amount,
            'referral_commission_status' => 'pending',
            'referral_commission_paid_at' => null,
            'referral_reward_snapshot' => [
                'reward_type' => $link->reward_type,
                'reward_value' => (float) $link->reward_value,
                'calculated_from' => (float) $this->total_paid,
                'calculated_at' => now()->toISOString(),
            ],
        ])->saveQuietly();
    }

    public function voidReferralCommission(): void
    {
        if (! $this->merchant_referral_link_id || ! $this->referral_commission_status) {
            return;
        }

        if ($this->referral_commission_status === 'paid') {
            return;
        }

        $this->forceFill([
            'referral_commission_status' => 'void',
            'referral_commission_paid_at' => null,
        ])->saveQuietly();
    }

    public function recordReferralConversion(): void
    {
        if (! $this->merchant_referral_link_id) {
            return;
        }

        $link = $this->referralLink()->first();
        if (! $link) {
            return;
        }

        $link->increment('conversions_count');
        $link->increment('revenue_amount', (float) $this->total_paid);
        $link->forceFill(['last_converted_at' => now()])->save();
    }

    public function reverseReferralConversion(): void
    {
        if (! $this->merchant_referral_link_id) {
            return;
        }

        $link = $this->referralLink()->first();
        if (! $link) {
            return;
        }

        $link->forceFill([
            'conversions_count' => max(0, (int) $link->conversions_count - 1),
            'revenue_amount' => max(0, (float) $link->revenue_amount - (float) $this->total_paid),
        ])->save();
    }

    public function recordGroupSaleConversion(): void
    {
        if (! $this->group_sale_campaign_id) {
            return;
        }

        $campaign = $this->groupSaleCampaign()->first();
        if (! $campaign) {
            return;
        }

        $campaign->increment('converted_quantity', $this->groupSaleQuantityUnits());
        $this->markGroupSaleParticipantConverted();
    }

    public function reverseGroupSaleConversion(): void
    {
        if (! $this->group_sale_campaign_id) {
            return;
        }

        $campaign = $this->groupSaleCampaign()->first();
        if (! $campaign) {
            return;
        }

        $campaign->forceFill([
            'converted_quantity' => max(0, (int) $campaign->converted_quantity - $this->groupSaleQuantityUnits()),
        ])->save();

        MerchantGroupSaleParticipant::query()
            ->where('campaign_id', $this->group_sale_campaign_id)
            ->where('converted_order_id', $this->id)
            ->update([
                'status' => 'notified',
                'converted_order_id' => null,
            ]);
    }

    private function markGroupSaleParticipantConverted(): void
    {
        if (! $this->group_sale_campaign_id) {
            return;
        }

        $query = MerchantGroupSaleParticipant::query()
            ->where('campaign_id', $this->group_sale_campaign_id)
            ->whereIn('status', ['joined', 'notified'])
            ->whereNull('converted_order_id');

        if ($this->buyer_id) {
            $participant = (clone $query)->where('user_id', $this->buyer_id)->oldest('id')->first();
            if ($participant) {
                $participant->update([
                    'status' => 'converted',
                    'converted_order_id' => $this->id,
                ]);
                return;
            }
        }

        $phone = $this->normalizedGroupSalePhone($this->account_phone ?: $this->payment_phone ?: $this->customer_phone);
        if ($phone === '') {
            return;
        }

        $participant = $query->get()
            ->first(fn (MerchantGroupSaleParticipant $entry) => $this->normalizedGroupSalePhone($entry->phone) === $phone);

        if ($participant) {
            $participant->update([
                'status' => 'converted',
                'converted_order_id' => $this->id,
            ]);
        }
    }

    private function groupSaleQuantityUnits(): int
    {
        return max(1, (int) round($this->effectivePackageQuantity()));
    }

    private function effectivePackageQuantity(): float
    {
        $requestedQuantity = max(0.001, (float) ($this->requested_quantity ?: $this->quantity ?: 1));

        if (! $this->isPackageUnitSnapshot()) {
            return $requestedQuantity;
        }

        if ((bool) data_get($this->unit_snapshot, 'quantity_represents_packages')) {
            return $requestedQuantity;
        }

        $sellableQuantity = max(0.001, (float) data_get($this->unit_snapshot, 'sellable_quantity', 1));
        return $requestedQuantity / $sellableQuantity;
    }

    private function isPackageUnitSnapshot(): bool
    {
        $snapshot = $this->unit_snapshot ?: [];
        $code = strtolower((string) data_get($snapshot, 'code', ''));
        $symbol = strtolower((string) data_get($snapshot, 'symbol', ''));
        $name = strtolower((string) data_get($snapshot, 'name', ''));

        return (bool) data_get($snapshot, 'package_content_quantity')
            || in_array($code, ['pack', 'package', 'pkg'], true)
            || in_array($symbol, ['pack', 'package', 'pkg'], true)
            || str_contains($name, 'package')
            || str_contains($name, 'pack');
    }

    private function normalizedGroupSalePhone(?string $phone): string
    {
        return preg_replace('/\D+/', '', (string) $phone) ?: '';
    }

    public function isCompleted(): bool
    {
        return in_array($this->payment_status, [
            'resolved_merchant_paid',
            'resolved_buyer_refunded',
        ]);
    }

    public function hasPhysicalBundleItems(): bool
    {
        if (!in_array($this->purchasable_type, ['bundle', 'offering_group'], true)) {
            return false;
        }

        $lines = $this->purchasable_type === 'offering_group'
            ? $this->flattenOfferingGroupLines($this->offering_group_selection['lines'] ?? [])
            : ($this->bundle_item_selection ?? []);

        foreach ($lines as $lineItem) {
            if (($lineItem['item_type'] ?? null) === 'product' && ($lineItem['product_type'] ?? null) === 'physical') {
                return true;
            }
        }

        return false;
    }

    public function requiresPhysicalFulfillment(): bool
    {
        return ($this->purchasable_type === 'product' && $this->product?->isPhysical())
            || $this->hasPhysicalBundleItems();
    }

    /**
     * Releases inventory back to the product/variant pool.
     */
    public function releaseInventory(): void
    {
        if (! $this->inventory_reserved_at) {
            return;
        }

        // 1. Individual Product/Variant
        if ($this->purchasable_type === 'product' && $this->product) {
            if ($this->product->isPhysical()) {
                $requestedQuantity = $this->effectivePackageQuantity();
                $quantity = max(1, (int) ceil($requestedQuantity));
                if ($this->variant_id) {
                    ProductVariant::whereKey($this->variant_id)->increment('inventory_count', $quantity);
                    ProductVariant::whereKey($this->variant_id)->increment('inventory_quantity', $requestedQuantity);
                }
                Product::whereKey($this->product_id)->increment('inventory_count', $quantity);
                Product::whereKey($this->product_id)->increment('inventory_quantity', $requestedQuantity);
            }
        }

        // 2. Bundles and offering groups
        if (in_array($this->purchasable_type, ['bundle', 'offering_group'], true)) {
            $lines = $this->purchasable_type === 'offering_group'
                ? $this->flattenOfferingGroupLines($this->offering_group_selection['lines'] ?? [])
                : ($this->bundle_item_selection ?? []);

            foreach ($lines as $lineItem) {
                if (($lineItem['item_type'] ?? null) !== 'product') continue;
                if (($lineItem['product_type'] ?? null) !== 'physical') continue;

                $qty = max(1, (int) ceil((float) ($lineItem['quantity'] ?? 1)));
                $productId = (int) ($lineItem['item_id'] ?? 0);
                $variantId = (int) ($lineItem['selected_variant_id'] ?? 0);

                if ($variantId > 0) {
                    ProductVariant::whereKey($variantId)->increment('inventory_count', $qty);
                }
                Product::whereKey($productId)->increment('inventory_count', $qty);
            }
        }

        $this->forceFill(['inventory_reserved_at' => null])->saveQuietly();
    }

    private function flattenOfferingGroupLines(array $lines): array
    {
        $flat = [];

        foreach ($lines as $line) {
            $flat[] = $line;
            if (!empty($line['child_lines']) && is_array($line['child_lines'])) {
                $flat = array_merge($flat, $this->flattenOfferingGroupLines($line['child_lines']));
            }
        }

        return $flat;
    }
}
