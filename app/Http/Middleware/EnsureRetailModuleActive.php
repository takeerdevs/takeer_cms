<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\Merchant;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Inertia\Inertia;

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

        if (!$merchant->hasModule('retail_ops')) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'The Retail Ops module is not active for this merchant account.'
                ], 403);
            }
            // Web: redirect to settings with a message
            return redirect()->back()->with('error', 'Please enable the Retail Ops module from your Business Settings first.');
        }

        // Share merchant in the request for easy access in controllers
        $request->attributes->set('active_merchant', $merchant);

        return $next($request);
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
