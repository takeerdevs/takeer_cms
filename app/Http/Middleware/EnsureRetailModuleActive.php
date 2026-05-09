<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\AdminSetting;
use App\Models\Merchant;
use App\Models\MerchantPlatformSubscription;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRetailModuleActive
{
    /**
     * Handle an incoming request.
     * Works for both API (JSON) and Inertia (web) routes.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
            return redirect('/welcome');
        }

        // For web routes, prefer the merchant bound by own_merchant middleware (from route param).
        // For API routes from the SPA, only accept merchant IDs owned by this user or assigned to this staff user.
        $merchant = $request->route('merchant');
        if (!$merchant instanceof Merchant) {
            $merchantId = $request->input('merchant_id') ?? session('active_merchant_id');
            $merchant = $merchantId ? $this->merchantForUser($request, (int) $merchantId) : null;
        }

        $merchant = $merchant
            ?? $user->merchantProfiles()->where('is_active', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchant || !$merchant->isRetailEligible()) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Retail Operations is only available for verified business accounts with completed business KYC.'
                ], 403);
            }

            return redirect('/profile')->with('error', 'Retail Operations is only available for verified business accounts with completed business KYC.');
        }

        if (! $merchant->hasModule('retail_ops')) {
            $accessMode = (string) AdminSetting::get('retail_access_mode', 'free');

            if ($accessMode === 'free' || $this->hasActiveRetailSubscription($merchant)) {
                $modules = $merchant->active_modules ?? [];
                $modules[] = 'retail_ops';
                $merchant->forceFill(['active_modules' => array_values(array_unique($modules))])->save();
                $merchant->refresh();
            }
        }

        if (!$merchant->hasModule('retail_ops')) {
            $redirectUrl = "/merchant/{$merchant->username}/platform-subscriptions/retail-operations";

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Retail Ops requires an active subscription.',
                    'requires_subscription' => true,
                    'redirect_url' => $redirectUrl,
                ], 402);
            }

            return redirect($redirectUrl)->with('error', 'Retail Ops requires an active subscription.');
        }

        // Share merchant in the request for easy access in controllers
        $request->attributes->set('active_merchant', $merchant);

        return $next($request);
    }

    private function hasActiveRetailSubscription(Merchant $merchant): bool
    {
        $subscription = MerchantPlatformSubscription::query()
            ->where('merchant_id', $merchant->id)
            ->where('feature', 'retail_ops')
            ->whereIn('status', ['trialing', 'active', 'free'])
            ->latest('id')
            ->first();

        return $subscription
            && (! $subscription->current_period_end || $subscription->current_period_end->isFuture());
    }

    private function merchantForUser(Request $request, int $merchantId): ?Merchant
    {
        $user = $request->user();

        $owned = $user->merchantProfiles()
            ->where('merchants.id', $merchantId)
            ->first();

        if ($owned) {
            return $owned;
        }

        $staff = \App\Models\MerchantStaff::query()
            ->where('merchant_id', $merchantId)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();

        return $staff ? Merchant::find($merchantId) : null;
    }
}
