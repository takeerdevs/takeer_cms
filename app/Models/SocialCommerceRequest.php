<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use InvalidArgumentException;

class SocialCommerceRequest extends Model
{
    use HasFactory;

    public const AWAITING_SELLER = 'awaiting_seller';
    public const CLAIMED = 'claimed';
    public const ONBOARDING = 'onboarding';
    public const PRODUCT_SETUP = 'product_setup';
    public const OFFER_READY = 'offer_ready';
    public const CONVERTED = 'converted';
    public const DECLINED = 'declined';
    public const EXPIRED = 'expired';
    public const CANCELLED = 'cancelled';
    public const BLOCKED = 'blocked';

    public const STATUSES = [
        self::AWAITING_SELLER, self::CLAIMED, self::ONBOARDING, self::PRODUCT_SETUP,
        self::OFFER_READY, self::CONVERTED, self::DECLINED, self::EXPIRED,
        self::CANCELLED, self::BLOCKED,
    ];

    public const TRANSITIONS = [
        self::AWAITING_SELLER => [self::CLAIMED, self::DECLINED, self::EXPIRED, self::CANCELLED, self::BLOCKED],
        self::CLAIMED => [self::ONBOARDING, self::PRODUCT_SETUP, self::DECLINED, self::BLOCKED],
        self::ONBOARDING => [self::PRODUCT_SETUP, self::DECLINED, self::EXPIRED, self::BLOCKED],
        self::PRODUCT_SETUP => [self::OFFER_READY, self::DECLINED, self::EXPIRED, self::BLOCKED],
        self::OFFER_READY => [self::PRODUCT_SETUP, self::CONVERTED, self::DECLINED, self::EXPIRED, self::CANCELLED, self::BLOCKED],
        self::CONVERTED => [],
        self::DECLINED => [],
        self::EXPIRED => [],
        self::CANCELLED => [],
        self::BLOCKED => [],
    ];

    protected $fillable = [
        'public_id', 'buyer_id', 'platform', 'original_url', 'normalized_url', 'url_hash',
        'external_post_id', 'external_seller_handle', 'external_seller_name', 'external_seller_profile_url',
        'link_preview_id', 'preview_status', 'preview_provenance', 'preview_snapshot', 'buyer_screenshot_path',
        'buyer_product_note', 'buyer_variant_note', 'requested_quantity', 'observed_unit_price',
        'observed_currency_code', 'destination_country_id', 'destination_state_id', 'destination_city_id',
        'destination_summary', 'delivery_context_encrypted', 'preferred_delivery_type', 'seller_phone_encrypted',
        'seller_phone_hash', 'seller_phone_source', 'seller_contact_attested_at', 'status', 'claimed_merchant_id',
        'product_id', 'offer_snapshot', 'offer_expires_at', 'order_id', 'idempotency_key', 'claim_started_at',
        'claimed_at', 'offer_ready_at', 'converted_at', 'declined_at', 'expires_at', 'closed_reason', 'lock_version',
    ];

    protected function casts(): array
    {
        return [
            'preview_snapshot' => 'array',
            'offer_snapshot' => 'array',
            'requested_quantity' => 'decimal:3',
            'observed_unit_price' => 'decimal:2',
            'delivery_context_encrypted' => 'encrypted:array',
            'seller_phone_encrypted' => 'encrypted',
            'seller_contact_attested_at' => 'datetime',
            'offer_expires_at' => 'datetime',
            'claim_started_at' => 'datetime',
            'claimed_at' => 'datetime',
            'offer_ready_at' => 'datetime',
            'converted_at' => 'datetime',
            'declined_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    protected static function booted(): void
    {
        static::creating(function (self $request): void {
            $request->public_id ??= Str::random(20);
        });
    }

    public function buyer(): BelongsTo { return $this->belongsTo(User::class, 'buyer_id'); }
    public function claimedMerchant(): BelongsTo { return $this->belongsTo(Merchant::class, 'claimed_merchant_id'); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function linkPreview(): BelongsTo { return $this->belongsTo(LinkPreview::class); }
    public function invitations(): HasMany { return $this->hasMany(SocialCommerceRequestInvitation::class); }
    public function events(): HasMany { return $this->hasMany(SocialCommerceRequestEvent::class)->latest('occurred_at'); }

    public function transitionTo(string $status): void
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new InvalidArgumentException("Unknown social-commerce request status [{$status}].");
        }

        if ($this->status === $status) {
            return;
        }

        if (!in_array($status, self::TRANSITIONS[$this->status] ?? [], true)) {
            throw new InvalidArgumentException("Cannot move social-commerce request from [{$this->status}] to [{$status}].");
        }

        $this->status = $status;
    }

    public function sellerPhone(): ?string
    {
        return $this->seller_phone_encrypted;
    }

    public function deliveryContext(): array
    {
        return is_array($this->delivery_context_encrypted) ? $this->delivery_context_encrypted : [];
    }
}
