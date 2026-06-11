<?php

use App\Services\PayoutPolicyService;
use App\Services\WithdrawalPolicyService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $settings = [];

        foreach (PayoutPolicyService::DEFAULT_MODES as $bucket => $mode) {
            $settings[] = [
                'key' => "payment_release_policy_{$bucket}",
                'value' => $mode,
                'description' => 'Controls when paid funds are released into the merchant wallet.',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (WithdrawalPolicyService::DEFAULT_MODES as $bucket => $mode) {
            $settings[] = [
                'key' => "payment_withdrawal_policy_{$bucket}",
                'value' => $mode,
                'description' => 'Controls how funds leave the merchant wallet after release.',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('admin_settings')->where('key', 'like', 'payout_policy_%')->delete();
        DB::table('admin_settings')->upsert($settings, ['key'], ['value', 'description', 'updated_at']);

        DB::table('merchants')
            ->select(['id', 'retail_settings'])
            ->whereNotNull('retail_settings')
            ->orderBy('id')
            ->each(function ($merchant) use ($now): void {
                $settings = json_decode($merchant->retail_settings, true) ?: [];
                unset($settings['payout_controls'], $settings['payment_release_controls']);

                DB::table('merchants')
                    ->where('id', $merchant->id)
                    ->update([
                        'retail_settings' => json_encode($settings),
                        'updated_at' => $now,
                    ]);
            });
    }

    public function down(): void
    {
        DB::table('admin_settings')->where('key', 'like', 'payment_release_policy_%')->delete();
        DB::table('admin_settings')->where('key', 'like', 'payment_withdrawal_policy_%')->delete();
    }
};
