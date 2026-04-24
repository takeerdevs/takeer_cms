<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckMerchantStatus
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->role === 'merchant') {
            $merchant = $user->merchantProfiles()->where('is_default', true)->first()
                ?? $user->merchantProfiles()->first();

            if ($merchant && $merchant->is_suspended) {
                return response()->json([
                    'message' => 'Akaunti yako ya muuzaji imefungiwa na utawala kwa muda. Tafadhali wasiliana na usaidizi.',
                    'suspended' => true,
                ], 403);
            }
        }

        return $next($request);
    }
}
