<?php

namespace App\Http\Middleware;

use App\Models\MerchantStaff;
use App\Support\MerchantPermissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRetailStaffRole
{
    /**
     * Legacy alias retained for routes that used to check role names.
     * New usage should pass explicit permissions, e.g. retail_role:retail.transfers.
     */
    public function handle(Request $request, Closure $next, string ...$requiredPermissions): Response
    {
        $user = $request->user();
        $merchant = $request->route('merchant')
            ?? $request->attributes->get('active_merchant')
            ?? $request->attributes->get('resolved_merchant');

        if (!$user || !$merchant) {
            return $this->deny($request, 'Unauthorized retail access.');
        }

        // Merchant owner bypass for all retail pages.
        if ((int) $merchant->user_id === (int) $user->id) {
            return $next($request);
        }

        $staff = MerchantStaff::where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->where('pos_access_enabled', true)
            ->first();

        if (!$staff) {
            return $this->deny($request, 'Retail staff profile not found for this merchant.');
        }

        $normalizedRequired = collect($requiredPermissions)
            ->flatMap(fn(string $chunk) => explode(',', $chunk))
            ->map(fn(string $permission) => trim($permission))
            ->filter()
            ->values();

        if (
            $normalizedRequired->isNotEmpty()
            && ! $normalizedRequired->contains(fn (string $permission) => MerchantPermissions::can($user, $merchant, $permission))
        ) {
            return $this->deny($request, 'You do not have permission to access this retail page.');
        }

        $request->attributes->set('active_staff', $staff);

        return $next($request);
    }

    private function deny(Request $request, string $message): Response
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $message], 403);
        }

        abort(403, $message);
    }
}
