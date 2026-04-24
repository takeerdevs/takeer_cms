<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Models\Dispute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSettingsController extends Controller
{
    /**
     * Return all settings + platform stats.
     */
    public function index(): JsonResponse
    {
        $settings = array_merge([
            'ai_provider' => 'openrouter',
            'openrouter_api_key' => '',
            'openrouter_default_model' => 'google/gemini-2.5-flash',
            'gemini_api_key' => '',
            'gemini_default_model' => 'gemini-1.5-flash',
            'kyc_enforcement_mode' => 'off',
            'kyc_trigger_gmv_tzs' => '0',
            'kyc_trigger_order_count' => '0',
            'kyc_trigger_withdrawal_tzs' => '0',
            'catalog_item_picker_default_limit' => '5',
        ], AdminSetting::allAsMap());

        // Mask secret keys for display (show last 4 chars only)
        foreach (['openrouter_api_key', 'gemini_api_key'] as $keyField) {
            if (!empty($settings[$keyField])) {
                $val = $settings[$keyField];
                $settings[$keyField . '_masked'] = '•••••••' . substr($val, -4);
                $settings[$keyField] = ''; // never expose full key in JSON
            }
        }

        // Platform stats
        $stats = [
            'total_users' => User::count(),
            'total_merchants' => User::where('role', 'merchant')->count(),
            'total_admins' => User::where('is_admin', true)->count(),
            'total_orders' => Order::count(),
            'open_disputes' => Dispute::where('status', 'open')->count(),
            'pending_withdrawals' => WithdrawalRequest::where('status', 'pending')->count(),
        ];

        return response()->json(['settings' => $settings, 'stats' => $stats]);
    }

    /**
     * Batch-update settings from the admin UI.
     */
    public function update(Request $request): JsonResponse
    {
        $allowed = [
            'ai_provider',
            'openrouter_api_key',
            'openrouter_default_model',
            'gemini_api_key',
            'gemini_default_model',
            'kyc_enforcement_mode',
            'kyc_trigger_gmv_tzs',
            'kyc_trigger_order_count',
            'kyc_trigger_withdrawal_tzs',
            'catalog_item_picker_default_limit',
        ];

        foreach ($allowed as $key) {
            if ($request->has($key)) {
                $value = $request->input($key);
                if ($key === 'catalog_item_picker_default_limit') {
                    $value = (string) max(1, min(20, (int) $value));
                }
                // Skip if the field was masked (user didn't change it)
                if ($value === '' && $request->input($key . '_masked')) {
                    continue;
                }
                AdminSetting::set($key, $value);
            }
        }

        return response()->json(['message' => 'Settings saved successfully.']);
    }

    /**
     * Get all users for the Users admin page.
     */
    public function users(Request $request): JsonResponse
    {
        $users = User::select('id', 'name', 'phone_number', 'role', 'is_admin', 'is_banned', 'created_at')
            ->when($request->search, fn($q) => $q->where('name', 'like', '%' . $request->search . '%')
                ->orWhere('phone_number', 'like', '%' . $request->search . '%'))
            ->latest()
            ->paginate(20);

        return response()->json($users);
    }

    /**
     * Toggle merchant or admin role for a user.
     * is_merchant is derived from 'role' field (string), is_admin is a boolean column.
     */
    public function toggleRole(Request $request, User $user): JsonResponse
    {
        $request->validate(['role' => 'required|in:is_merchant,is_admin']);

        $role = $request->input('role');

        if ($role === 'is_merchant') {
            // Toggle between merchant and buyer roles
            $user->update(['role' => $user->role === 'merchant' ? 'buyer' : 'merchant']);
        } else {
            // Toggle is_admin boolean
            $user->update(['is_admin' => !$user->is_admin]);
        }

        return response()->json([
            'message' => 'User role updated successfully.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'is_merchant' => $user->isMerchant(),
                'is_admin' => $user->isAdmin(),
            ],
        ]);
    }

    /**
     * Toggle user ban status.
     */
    public function toggleBan(User $user): JsonResponse
    {
        $user->update(['is_banned' => !$user->is_banned]);

        return response()->json([
            'message' => $user->is_banned
                ? 'User has been banned.'
                : 'User ban removed.',
            'user' => [
                'id' => $user->id,
                'is_banned' => (bool) $user->is_banned,
            ],
        ]);
    }

    /**
     * Get pending withdrawals.
     */
    public function withdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::with('user:id,name,phone_number')
            ->where('status', 'pending')
            ->latest()
            ->get();

        return response()->json(['withdrawals' => $withdrawals]);
    }
}
