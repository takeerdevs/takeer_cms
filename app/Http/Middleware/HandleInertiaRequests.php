<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $this->sharedUser($request),
            ],
            'geo' => [
                'country' => $request->session()->get('user_session_country'),
                'currency' => $request->session()->get('user_session_currency'),
            ],
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
        ];
    }

    private function sharedUser(Request $request): ?array
    {
        $user = $request->user();

        if (! $user) {
            return null;
        }

        $merchantProfiles = $user->merchantProfiles()
            ->select([
                'id',
                'username',
                'display_name',
                'avatar_url',
                'bio',
                'type',
                'is_default',
                'is_verified',
                'is_active',
                'kyc_status',
            ])
            ->get()
            ->map(fn ($merchant) => [
                'id' => $merchant->id,
                'username' => $merchant->username,
                'display_name' => $merchant->display_name,
                'avatar_url' => $merchant->avatar_url,
                'bio' => $merchant->bio,
                'type' => $merchant->type,
                'is_default' => (bool) $merchant->is_default,
                'is_verified' => (bool) $merchant->is_verified,
                'is_active' => (bool) $merchant->is_active,
                'kyc_status' => $merchant->kyc_status,
            ])
            ->values();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone_number' => $user->phone_number,
            'role' => $user->role,
            'is_admin' => (bool) $user->is_admin,
            'is_banned' => (bool) $user->is_banned,
            'is_merchant' => $user->is_merchant,
            'merchant_profiles' => $merchantProfiles,
        ];
    }
}
