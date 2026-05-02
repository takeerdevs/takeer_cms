<?php

namespace App\Http\Middleware;

use App\Models\MerchantStaff;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRetailStaffRole
{
    /**
     * Enforce staff role for a retail route.
     * Usage: middleware('retail_role:MANAGER,STOREKEEPER')
     */
    public function handle(Request $request, Closure $next, string ...$allowedRoles): Response
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
            ->first();

        if (!$staff) {
            return $this->deny($request, 'Retail staff profile not found for this merchant.');
        }

        $normalizedAllowed = collect($allowedRoles)
            ->flatMap(fn(string $chunk) => explode(',', $chunk))
            ->map(fn(string $role) => strtoupper(trim($role)))
            ->filter()
            ->values();

        $staffRole = strtoupper((string) $staff->role);
        if ($normalizedAllowed->isNotEmpty() && !$normalizedAllowed->contains($staffRole)) {
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
