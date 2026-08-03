<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use App\Models\Dispute;
use App\Models\Order;
use App\Models\PaymentProviderChannel;
use App\Models\ProviderPayout;
use App\Models\ProviderReconciliationBreak;
use App\Models\RefundRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSettingsController extends Controller
{
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
            'catalog_item_picker_default_limit' => '5',
            'upload_allowed_extensions' => 'jpg,jpeg,png,webp,gif,mp4,mov,webm,pdf,zip,doc,docx,xls,xlsx,ppt,pptx,csv,txt',
            'upload_allowed_mime_types' => 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/zip,text/csv,text/plain',
            'upload_max_file_mb' => '500',
            'storage_access_mode' => 'free',
            'storage_free_mb' => '500',
            'storage_trial_days' => '0',
            'retail_access_mode' => 'free',
            'retail_trial_days' => '0',
            'analytics_retention_days' => '365',
            'analytics_exclude_admins' => '1',
        ], AdminSetting::allAsMap());

        foreach (['openrouter_api_key', 'gemini_api_key'] as $keyField) {
            if (! empty($settings[$keyField])) {
                $settings[$keyField . '_masked'] = '•••••••' . substr((string) $settings[$keyField], -4);
                $settings[$keyField] = '';
            }
        }

        return response()->json([
            'settings' => $settings,
            'provider_channels' => PaymentProviderChannel::query()
                ->with('provider')
                ->where('direction', 'payin')
                ->orderBy('country_code')
                ->orderBy('priority')
                ->get()
                ->map(fn (PaymentProviderChannel $channel) => [
                    'id' => $channel->id,
                    'key' => $channel->key,
                    'name' => $channel->name,
                    'provider' => $channel->provider?->key,
                    'country_code' => $channel->country_code,
                    'method' => $channel->method,
                    'currencies' => $channel->currencies ?: [],
                    'status' => $channel->status,
                ])
                ->values(),
            'stats' => [
                'total_users' => User::count(),
                'total_merchants' => User::where('role', 'merchant')->count(),
                'total_admins' => User::where('is_admin', true)->count(),
                'total_orders' => Order::count(),
                'open_disputes' => Dispute::where('status', 'open')->count(),
                'pending_provider_payouts' => ProviderPayout::whereIn('status', ['created', 'submitted', 'processing'])->count(),
                'reconciliation_breaks' => ProviderReconciliationBreak::whereIn('status', ['open', 'investigating'])->count(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $allowed = [
            'ai_provider', 'openrouter_api_key', 'openrouter_default_model', 'gemini_api_key', 'gemini_default_model',
            'kyc_enforcement_mode', 'kyc_trigger_gmv_tzs', 'kyc_trigger_order_count',
            'catalog_item_picker_default_limit', 'upload_allowed_extensions', 'upload_allowed_mime_types',
            'upload_max_file_mb', 'storage_access_mode', 'storage_free_mb', 'storage_trial_days',
            'retail_access_mode', 'retail_trial_days', 'analytics_retention_days', 'analytics_exclude_admins',
        ];

        foreach ($allowed as $key) {
            if (! $request->has($key)) {
                continue;
            }

            $value = $request->input($key);
            if (in_array($key, ['openrouter_api_key', 'gemini_api_key'], true)
                && $value === '' && $request->input($key . '_masked')) {
                continue;
            }

            if ($key === 'catalog_item_picker_default_limit') {
                $value = (string) max(1, min(20, (int) $value));
            } elseif ($key === 'upload_max_file_mb') {
                $value = (string) max(1, min(500, (int) $value));
            } elseif (in_array($key, ['storage_free_mb', 'storage_trial_days', 'retail_trial_days', 'kyc_trigger_order_count'], true)) {
                $value = (string) max(0, (int) $value);
            } elseif ($key === 'analytics_retention_days') {
                $value = (string) max(30, min(1095, (int) $value));
            } elseif ($key === 'analytics_exclude_admins') {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? '1' : '0';
            } elseif (in_array($key, ['storage_access_mode', 'retail_access_mode'], true)) {
                $value = in_array($value, ['free', 'trial_then_paid', 'paid'], true) ? $value : 'free';
            } elseif (in_array($key, ['upload_allowed_extensions', 'upload_allowed_mime_types'], true)) {
                $value = collect(preg_split('/[\s,]+/', strtolower((string) $value)))
                    ->map(fn ($item) => trim($item, " \t\n\r\0\x0B."))
                    ->filter()
                    ->unique()
                    ->implode(',');
            }

            AdminSetting::set($key, $value);
        }

        return response()->json(['message' => 'Settings saved successfully.']);
    }

    public function users(Request $request): JsonResponse
    {
        $users = User::select('id', 'name', 'phone_number', 'role', 'is_admin', 'is_banned', 'created_at')
            ->when($request->search, fn ($query) => $query->where(function ($nested) use ($request) {
                $nested->where('name', 'like', '%' . $request->search . '%')
                    ->orWhere('phone_number', 'like', '%' . $request->search . '%');
            }))
            ->latest()
            ->paginate(20);

        return response()->json($users);
    }

    public function toggleRole(Request $request, User $user): JsonResponse
    {
        $request->validate(['role' => 'required|in:is_merchant,is_admin']);
        $role = $request->input('role');
        $user->update($role === 'is_merchant'
            ? ['role' => $user->role === 'merchant' ? 'buyer' : 'merchant']
            : ['is_admin' => ! $user->is_admin]);

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

    public function toggleBan(User $user): JsonResponse
    {
        $user->update(['is_banned' => ! $user->is_banned]);

        return response()->json([
            'message' => $user->is_banned ? 'User has been banned.' : 'User ban removed.',
            'user' => ['id' => $user->id, 'is_banned' => (bool) $user->is_banned],
        ]);
    }

    public function refunds(Request $request): JsonResponse
    {
        $status = strtolower((string) $request->query('status', 'pending'));
        $allowedStatuses = ['pending', 'approved', 'rejected', 'all'];
        $status = in_array($status, $allowedStatuses, true) ? $status : 'pending';
        $perPage = min(100, max(10, (int) $request->query('per_page', 20)));

        $refunds = RefundRequest::query()
            ->with(['buyer:id,name,phone_number', 'merchant:id,display_name,username', 'order:id,public_id,total_paid,payment_status', 'approver:id,name'])
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate($perPage);

        return response()->json([
            'refunds' => $refunds->getCollection()->map(fn (RefundRequest $refund) => [
                'id' => $refund->id,
                'source' => $refund->source,
                'status' => $refund->status,
                'amount' => (float) $refund->amount,
                'currency_code' => $refund->currency_code ?: 'TZS',
                'reason' => $refund->reason,
                'snapshot' => $refund->snapshot ?: [],
                'admin_notes' => $refund->admin_notes,
                'approved_at' => $refund->approved_at?->toISOString(),
                'rejected_at' => $refund->rejected_at?->toISOString(),
                'created_at' => $refund->created_at?->toISOString(),
                'buyer' => $refund->buyer,
                'merchant' => $refund->merchant,
                'order' => $refund->order ? [
                    'id' => $refund->order->id,
                    'public_id' => $refund->order->public_id,
                    'total_paid' => (float) $refund->order->total_paid,
                    'payment_status' => $refund->order->payment_status,
                ] : null,
                'approver' => $refund->approver,
            ]),
            'pagination' => [
                'current_page' => $refunds->currentPage(),
                'last_page' => $refunds->lastPage(),
                'per_page' => $refunds->perPage(),
                'total' => $refunds->total(),
            ],
        ]);
    }
}
