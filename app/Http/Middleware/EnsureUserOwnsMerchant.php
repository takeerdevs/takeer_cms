<?php

namespace App\Http\Middleware;

use App\Models\Merchant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserOwnsMerchant
{
    /**
     * Verify the authenticated user owns the {merchant} route parameter.
     * Aborts with 403 if they don't.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $merchant = $request->route('merchant');

        // Route model binding may give us the model already
        if (!$merchant instanceof Merchant) {
            $merchant = Merchant::where('username', $merchant)->firstOrFail();
        }

        if (!$request->user() || !$request->user()->merchantProfiles()->where('id', $merchant->id)->exists()) {
            abort(403, 'Huna ruhusa ya kufikia dashibodi hii ya biashara.');
        }

        // Share the resolved merchant with the request and session so SPA API calls are contextualized
        $request->attributes->set('resolved_merchant', $merchant);
        session(['active_merchant_id' => $merchant->id]);

        return $next($request);
    }
}
