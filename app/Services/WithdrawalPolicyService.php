<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\Order;

class WithdrawalPolicyService
{
    public const MODE_AUTOMATIC_WITHDRAWAL = 'automatic_withdrawal';
    public const MODE_MANUAL_WITHDRAWAL = 'manual_withdrawal';
    public const MODE_WITHDRAWALS_PAUSED = 'withdrawals_paused';

    public const ACTIVE_MODES = [
        self::MODE_MANUAL_WITHDRAWAL,
        self::MODE_AUTOMATIC_WITHDRAWAL,
        self::MODE_WITHDRAWALS_PAUSED,
    ];

    public const DEFAULT_MODES = [
        'digital_downloads' => self::MODE_MANUAL_WITHDRAWAL,
        'premium_media' => self::MODE_MANUAL_WITHDRAWAL,
        'live_events' => self::MODE_MANUAL_WITHDRAWAL,
        'custom_work' => self::MODE_MANUAL_WITHDRAWAL,
        'paid_writing' => self::MODE_MANUAL_WITHDRAWAL,
        'courses_bundles' => self::MODE_MANUAL_WITHDRAWAL,
        'creator_club' => self::MODE_MANUAL_WITHDRAWAL,
        'services' => self::MODE_MANUAL_WITHDRAWAL,
        'physical' => self::MODE_MANUAL_WITHDRAWAL,
    ];

    public function resolveForOrder(Order $order): array
    {
        $bucket = app(PayoutPolicyService::class)->bucketForOrder($order);
        $mode = $this->platformMode($bucket);

        return [
            'bucket' => $bucket,
            'bucket_label' => PayoutPolicyService::BUCKETS[$bucket],
            'mode' => $mode,
            'source' => 'platform_default',
            'automatic_withdrawal' => $mode === self::MODE_AUTOMATIC_WITHDRAWAL,
            'withdrawals_paused' => $mode === self::MODE_WITHDRAWALS_PAUSED,
        ];
    }

    public function platformMode(string $bucket): string
    {
        $fallback = self::DEFAULT_MODES[$bucket] ?? self::MODE_MANUAL_WITHDRAWAL;
        $mode = (string) AdminSetting::get($this->settingKey($bucket), $fallback);

        return in_array($mode, self::ACTIVE_MODES, true) ? $mode : $fallback;
    }

    public function settingKey(string $bucket): string
    {
        return "payment_withdrawal_policy_{$bucket}";
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
            self::MODE_MANUAL_WITHDRAWAL => 'Manual withdrawal',
            self::MODE_AUTOMATIC_WITHDRAWAL => 'Withdraw automatically',
            self::MODE_WITHDRAWALS_PAUSED => 'Withdrawals paused',
        ];
    }
}
