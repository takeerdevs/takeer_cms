<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckUserBan
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && (bool) ($user->is_banned ?? false)) {
            if ($request->expectsJson() || str_starts_with($request->path(), 'api/')) {
                return response()->json([
                    'message' => 'Akaunti yako imezuiwa kwa ukiukaji wa sera. Tafadhali wasiliana na support.',
                    'banned' => true,
                ], 403);
            }

            auth()->guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect('/welcome')->with('error', 'Akaunti yako imezuiwa kwa ukiukaji wa sera.');
        }

        return $next($request);
    }
}

