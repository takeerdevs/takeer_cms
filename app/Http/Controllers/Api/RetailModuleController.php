<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use App\Models\MerchantPlatformSubscription;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class RetailModuleController extends Controller
{
    /**
     * Activate the Retail Ops module for the merchant.
     */
    public function activate(Request $request): JsonResponse
    {
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_active', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchant) {
            return response()->json(['message' => 'Merchant profile not found.'], 404);
        }

        if (! $merchant->isRetailEligible()) {
            return response()->json([
                'message' => 'Retail Operations is only available for verified business accounts with completed business KYC.',
            ], 403);
        }

        $accessMode = (string) AdminSetting::get('retail_access_mode', 'free');

        if ($accessMode !== 'free') {
            $subscription = MerchantPlatformSubscription::query()
                ->where('merchant_id', $merchant->id)
                ->where('feature', 'retail_ops')
                ->whereIn('status', ['trialing', 'active', 'free'])
                ->latest('id')
                ->first();

            $hasAccess = $subscription
                && (! $subscription->current_period_end || $subscription->current_period_end->isFuture());

            if (! $hasAccess) {
                return response()->json([
                    'message' => $accessMode === 'trial_then_paid'
                        ? 'Retail Ops requires a trial or active subscription.'
                        : 'Retail Ops requires an active subscription.',
                    'requires_subscription' => true,
                    'access_mode' => $accessMode,
                    'redirect_url' => "/merchant/{$merchant->username}/platform-subscriptions/retail-operations",
                ], 402);
            }
        }

        $modules = $merchant->active_modules ?? [];
        if (!in_array('retail_ops', $modules)) {
            $modules[] = 'retail_ops';
            $merchant->update(['active_modules' => $modules]);
        }

        return response()->json([
            'message' => 'Takeer Retail Ops module activated successfully.',
            'active_modules' => $merchant->active_modules
        ]);
    }

    /**
     * Deactivate the Retail Ops module.
     */
    public function deactivate(Request $request): JsonResponse
    {
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_active', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchant) {
            return response()->json(['message' => 'Merchant profile not found.'], 404);
        }

        $modules = $merchant->active_modules ?? [];
        $merchant->update([
            'active_modules' => array_values(array_diff($modules, ['retail_ops']))
        ]);

        return response()->json([
            'message' => 'Takeer Retail Ops module deactivated.',
            'active_modules' => $merchant->active_modules
        ]);
    }
}
