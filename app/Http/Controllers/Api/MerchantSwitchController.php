<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Support\MerchantPermissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

class MerchantSwitchController extends Controller
{
    /**
     * Switch the active merchant profile in the session.
     */
    public function switch(Request $request, $username)
    {
        $user = $request->user();
        
        $merchant = MerchantPermissions::accessibleMerchantsFor($user)
            ->firstWhere('username', $username);

        abort_unless($merchant, 404);

        if ((int) $merchant->user_id === (int) $user->id) {
            Merchant::where('user_id', $user->id)->update(['is_default' => false]);
            $merchant->update(['is_default' => true]);
        }

        // Store the active merchant ID in the session
        Session::put('active_merchant_id', $merchant->id);

        return back()->with('success', 'Umebadili akaunti kwenda ' . $merchant->display_name);
    }
}
