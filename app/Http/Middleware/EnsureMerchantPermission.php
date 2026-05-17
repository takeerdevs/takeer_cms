<?php

namespace App\Http\Middleware;

use App\Models\Merchant;
use App\Support\MerchantPermissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureMerchantPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();
        $merchant = $request->route('merchant')
            ?? $request->attributes->get('resolved_merchant')
            ?? $request->attributes->get('active_merchant');

        if (!$merchant instanceof Merchant) {
            $merchantId = $request->input('merchant_id') ?? session('active_merchant_id');
            $merchant = $merchantId ? Merchant::find($merchantId) : null;
        }

        if (!$user || !$merchant) {
            return $this->deny($request, 'Unauthorized merchant access.');
        }

        $allowed = collect($permissions)
            ->flatMap(fn (string $chunk) => explode(',', $chunk))
            ->map(fn (string $permission) => trim($permission))
            ->filter()
            ->contains(fn (string $permission) => MerchantPermissions::can($user, $merchant, $permission));

        if (!$allowed) {
            return $this->deny($request, 'You do not have permission to access this business area.');
        }

        $request->attributes->set('resolved_merchant', $merchant);
        $request->attributes->set('active_merchant', $merchant);

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
