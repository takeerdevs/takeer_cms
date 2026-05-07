<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\Merchant;
use App\Models\Order;

class PayoutPolicyService
{
    public const MODE_AUTOMATIC = 'automatic';
    public const MODE_MANUAL_WITHDRAWAL = 'manual_withdrawal';
    public const MODE_ESCROW_HOLD = 'escrow_hold';
    public const MODE_PAYOUT_PAUSED = 'payout_paused';
    public const MODE_PLATFORM_DEFAULT = 'platform_default';

    public const BUCKETS = [
        'digital_downloads' => 'Downloads/assets',
        'premium_media' => 'Premium media',
        'live_events' => 'Live events',
        'custom_work' => 'Custom work',
        'paid_writing' => 'Paid writing',
        'courses_bundles' => 'Courses/bundles',
        'creator_club' => 'Creator Club',
        'services' => 'Services',
        'physical' => 'Physical',
    ];

    public const DEFAULT_MODES = [
        'digital_downloads' => self::MODE_AUTOMATIC,
        'premium_media' => self::MODE_AUTOMATIC,
        'live_events' => self::MODE_AUTOMATIC,
        'custom_work' => self::MODE_ESCROW_HOLD,
        'paid_writing' => self::MODE_AUTOMATIC,
        'courses_bundles' => self::MODE_AUTOMATIC,
        'creator_club' => self::MODE_AUTOMATIC,
        'services' => self::MODE_AUTOMATIC,
        'physical' => self::MODE_ESCROW_HOLD,
    ];

    public const ACTIVE_MODES = [
        self::MODE_AUTOMATIC,
        self::MODE_MANUAL_WITHDRAWAL,
        self::MODE_ESCROW_HOLD,
        self::MODE_PAYOUT_PAUSED,
    ];

    public const MERCHANT_OVERRIDE_MODES = [
        self::MODE_PLATFORM_DEFAULT,
        self::MODE_AUTOMATIC,
        self::MODE_MANUAL_WITHDRAWAL,
        self::MODE_ESCROW_HOLD,
        self::MODE_PAYOUT_PAUSED,
    ];

    public function resolveForOrder(Order $order): array
    {
        $order->loadMissing(['product', 'merchant']);

        $bucket = $this->bucketForOrder($order);
        $merchant = $order->merchant;
        $merchantMode = $merchant ? $this->merchantOverrideMode($merchant, $bucket) : self::MODE_PLATFORM_DEFAULT;

        if ($merchantMode !== self::MODE_PLATFORM_DEFAULT) {
            return [
                'bucket' => $bucket,
                'bucket_label' => self::BUCKETS[$bucket],
                'mode' => $merchantMode,
                'source' => 'merchant_override',
                'holds_funds' => $this->modeHoldsFunds($merchantMode),
            ];
        }

        $mode = $this->platformMode($bucket);

        return [
            'bucket' => $bucket,
            'bucket_label' => self::BUCKETS[$bucket],
            'mode' => $mode,
            'source' => 'platform_default',
            'holds_funds' => $this->modeHoldsFunds($mode),
        ];
    }

    public function bucketForOrder(Order $order): string
    {
        $order->loadMissing('product');

        if ($order->purchasable_type === 'subscription_plan') {
            return 'creator_club';
        }

        if (in_array($order->purchasable_type, ['post', 'content_item'], true)) {
            return 'paid_writing';
        }

        if ($order->purchasable_type === 'bundle') {
            return 'courses_bundles';
        }

        if ($order->product?->type === 'service') {
            return 'services';
        }

        if ($order->product?->type === 'physical') {
            return 'physical';
        }

        if (in_array($order->product?->digital_delivery_type, ['video_stream', 'audio_stream', 'gallery_pack'], true)) {
            return 'premium_media';
        }

        if ($order->product?->digital_delivery_type === 'live_event') {
            return 'live_events';
        }

        if ($order->product?->digital_delivery_type === 'custom_delivery') {
            return 'custom_work';
        }

        return 'digital_downloads';
    }

    public function platformMode(string $bucket): string
    {
        $fallback = self::DEFAULT_MODES[$bucket] ?? self::MODE_AUTOMATIC;
        $mode = (string) AdminSetting::get($this->settingKey($bucket), $fallback);

        return in_array($mode, self::ACTIVE_MODES, true) ? $mode : $fallback;
    }

    public function merchantOverrideMode(Merchant $merchant, string $bucket): string
    {
        $controls = $merchant->retail_settings['payout_controls'] ?? [];
        $mode = (string) data_get($controls, "overrides.{$bucket}", self::MODE_PLATFORM_DEFAULT);

        return in_array($mode, self::MERCHANT_OVERRIDE_MODES, true) ? $mode : self::MODE_PLATFORM_DEFAULT;
    }

    public function modeHoldsFunds(string $mode): bool
    {
        return in_array($mode, [self::MODE_ESCROW_HOLD, self::MODE_PAYOUT_PAUSED], true);
    }

    public function settingKey(string $bucket): string
    {
        return "payout_policy_{$bucket}";
    }

    public function defaultSettings(): array
    {
        return collect(self::DEFAULT_MODES)
            ->mapWithKeys(fn (string $mode, string $bucket) => [$this->settingKey($bucket) => $mode])
            ->all();
    }

    public function labels(): array
    {
        return [
            self::MODE_PLATFORM_DEFAULT => 'Platform default',
            self::MODE_AUTOMATIC => 'Automatic',
            self::MODE_MANUAL_WITHDRAWAL => 'Manual withdrawal',
            self::MODE_ESCROW_HOLD => 'Escrow held',
            self::MODE_PAYOUT_PAUSED => 'Payout paused',
        ];
    }
}
