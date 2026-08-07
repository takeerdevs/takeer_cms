<?php

namespace App\Policies;

use App\Models\SocialCommerceRequest;
use App\Models\User;

class SocialCommerceRequestPolicy
{
    public function view(User $user, SocialCommerceRequest $request): bool
    {
        return (int) $request->buyer_id === (int) $user->id
            || (int) $request->claimedMerchant?->user_id === (int) $user->id
            || (bool) $user->is_admin
            || $user->role === 'admin';
    }

    public function cancel(User $user, SocialCommerceRequest $request): bool
    {
        return (int) $request->buyer_id === (int) $user->id && $request->order_id === null;
    }
}
