<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantStaff;
use App\Models\User;
use App\Services\MerchantAuditService;
use App\Support\MerchantPermissions;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class MerchantStaffController extends Controller
{
    private const ROLES = [
        'MANAGER',
        'CASHIER',
        'STOREKEEPER',
        'RECEPTIONIST',
        'BOOKING_MANAGER',
        'INSTRUCTOR',
        'FULFILLMENT',
        'ACCOUNTANT',
        'MARKETER',
        'CONTENT_MANAGER',
        'SUPPORT',
    ];

    public function __construct(private MerchantAuditService $audit)
    {
    }

    /**
     * List all staff for the active merchant.
     */
    public function index(Request $request, ?Merchant $merchant = null): JsonResponse
    {
        $merchant = $merchant ?: $request->attributes->get('active_merchant');
        $user = $request->user();

        if (!MerchantPermissions::can($user, $merchant, 'team.view')) {
            return response()->json(['message' => 'Huna ruhusa ya kusimamia mhudumu.'], 403);
        }
        
        $staff = $merchant->staff()
            ->with(['user', 'location'])
            ->get();

        return response()->json([
            'data' => $staff->map(function (MerchantStaff $staff) {
                $staff->setAttribute('effective_permissions', MerchantPermissions::permissionsForStaff($staff));
                return $staff;
            }),
            'permission_registry' => MerchantPermissions::registry(),
            'permission_presets' => MerchantPermissions::presets(),
            'roles' => self::ROLES,
        ]);
    }

    /**
     * Enroll a new staff member (Shadow User flow).
     */
    public function store(Request $request, ?Merchant $merchant = null): JsonResponse
    {
        $merchant = $merchant ?: $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'phone_number' => 'required|string', // Format check usually done by middleware or service
            'name' => 'required|string|max:255',
            'role' => ['required', Rule::in(self::ROLES)],
            'permissions' => 'nullable|array',
            'permissions.*' => ['string', Rule::in(MerchantPermissions::all())],
            'dashboard_access_enabled' => 'nullable|boolean',
            'pos_access_enabled' => 'nullable|boolean',
            'job_title' => 'nullable|string|max:120',
            'display_name' => 'nullable|string|max:160',
            'avatar_url' => 'nullable|string|max:2048',
            'assigned_location_id' => 'nullable|exists:merchant_locations,id',
            'pin' => 'required|string|size:4',
        ]);

        // 1. Find or Create the Shadow User
        $user = User::where('phone_number', $validated['phone_number'])->first();

        if (!$user) {
            $user = User::create([
                'name' => $validated['name'],
                'phone_number' => $validated['phone_number'],
                'role' => 'buyer', // Default role for guest/shadow users
                'password' => Hash::make(str()->random(32)), // Random password they'll never use
                'is_shadow_user' => true,
                'shadow_source' => 'merchant_staff',
            ]);
        }

        // 2. Check if already staff for THIS merchant
        $existing = MerchantStaff::where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'This user is already a staff member for your business.'], 422);
        }

        // 3. Create the Staff record
        $staff = MerchantStaff::create([
            'merchant_id' => $merchant->id,
            'user_id' => $user->id,
            'assigned_location_id' => $validated['assigned_location_id'],
            'role' => $validated['role'],
            'permissions' => $validated['permissions'] ?? [],
            'dashboard_access_enabled' => (bool) ($validated['dashboard_access_enabled'] ?? false),
            'pos_access_enabled' => (bool) ($validated['pos_access_enabled'] ?? true),
            'job_title' => $validated['job_title'] ?? null,
            'display_name' => $validated['display_name'] ?? null,
            'avatar_url' => $validated['avatar_url'] ?? null,
            'pin_hash' => Hash::make($validated['pin']),
            'is_active' => true,
        ]);

        $this->audit->record($request, $merchant, 'TEAM_MEMBER_CREATED', 'Team member enrolled.', [
            'target_type' => MerchantStaff::class,
            'target_id' => $staff->id,
            'staff_user_id' => $staff->user_id,
            'after' => $this->staffAuditSnapshot($staff->fresh(['user', 'location'])),
        ]);

        return response()->json([
            'message' => 'Staff member enrolled successfully.',
            'data' => $staff->load('user')
        ], 201);
    }

    /**
     * Update a staff member.
     */
    public function update(Request $request, ?Merchant $merchant = null, ?MerchantStaff $staff = null): JsonResponse
    {
        $merchant = $merchant ?: $request->attributes->get('active_merchant');
        $staff = $staff ?: $request->route('staff');
        
        if ($staff->merchant_id !== $merchant->id) {
            abort(403);
        }

        $before = $this->staffAuditSnapshot($staff->fresh(['user', 'location']));

        $validated = $request->validate([
            'role' => [Rule::in(self::ROLES)],
            'permissions' => 'nullable|array',
            'permissions.*' => ['string', Rule::in(MerchantPermissions::all())],
            'dashboard_access_enabled' => 'boolean',
            'pos_access_enabled' => 'boolean',
            'job_title' => 'nullable|string|max:120',
            'display_name' => 'nullable|string|max:160',
            'avatar_url' => 'nullable|string|max:2048',
            'assigned_location_id' => 'nullable|exists:merchant_locations,id',
            'is_active' => 'boolean',
            'pin' => 'nullable|string|size:4',
        ]);

        $staff->update($validated);

        if (!empty($validated['pin'])) {
            $staff->update(['pin_hash' => Hash::make($validated['pin'])]);
        }

        $after = $this->staffAuditSnapshot($staff->fresh(['user', 'location']));

        $this->audit->record($request, $merchant, 'TEAM_MEMBER_UPDATED', 'Team member access updated.', [
            'target_type' => MerchantStaff::class,
            'target_id' => $staff->id,
            'staff_user_id' => $staff->user_id,
            'changed_fields' => array_keys($validated),
            'before' => $before,
            'after' => $after,
        ]);

        return response()->json([
            'message' => 'Staff record updated.',
            'data' => $staff->load(['user', 'location'])
        ]);
    }

    /**
     * Reset a staff member's terminal PIN.
     */
    public function resetPin(Request $request, ?Merchant $merchant = null, ?MerchantStaff $staff = null): JsonResponse
    {
        $merchant = $merchant ?: $request->attributes->get('active_merchant');
        $staff = $staff ?: $request->route('staff');
        if ($staff->merchant_id !== $merchant->id) abort(403);

        $validated = $request->validate([
            'pin' => 'required|string|size:4',
        ]);

        $staff->update([
            'pin_hash' => Hash::make($validated['pin'])
        ]);

        $this->audit->record($request, $merchant, 'TEAM_MEMBER_PIN_RESET', 'Team member POS PIN reset.', [
            'target_type' => MerchantStaff::class,
            'target_id' => $staff->id,
            'staff_user_id' => $staff->user_id,
        ]);

        return response()->json(['message' => 'PIN imewekwa upya mafanikio.']);
    }

    /**
     * Clear all trusted devices for a staff member.
     * Forces OTP on next login.
     */
    public function clearDevices(Request $request, ?Merchant $merchant = null, ?MerchantStaff $staff = null): JsonResponse
    {
        $merchant = $merchant ?: $request->attributes->get('active_merchant');
        $staff = $staff ?: $request->route('staff');
        if ($staff->merchant_id !== $merchant->id) abort(403);

        $deviceCount = $staff->authorizedDevices()->count();
        $staff->authorizedDevices()->delete();

        $this->audit->record($request, $merchant, 'TEAM_MEMBER_DEVICES_CLEARED', 'Team member trusted devices cleared.', [
            'target_type' => MerchantStaff::class,
            'target_id' => $staff->id,
            'staff_user_id' => $staff->user_id,
            'devices_cleared' => $deviceCount,
        ]);

        return response()->json(['message' => 'Vifaa vyote vimeondolewa. OTP itatakiwa kwenye login ijayo.']);
    }

    /**
     * Remove/Deactivate a staff member.
     */
    public function destroy(Request $request, ?Merchant $merchant = null, ?MerchantStaff $staff = null): JsonResponse
    {
        $merchant = $merchant ?: $request->attributes->get('active_merchant');
        $staff = $staff ?: $request->route('staff');

        if ($staff->merchant_id !== $merchant->id) {
            abort(403);
        }

        // We soft-deactivate rather than delete to maintain audit logs
        $before = $this->staffAuditSnapshot($staff->fresh(['user', 'location']));
        $staff->update(['is_active' => false]);

        $this->audit->record($request, $merchant, 'TEAM_MEMBER_DEACTIVATED', 'Team member deactivated.', [
            'target_type' => MerchantStaff::class,
            'target_id' => $staff->id,
            'staff_user_id' => $staff->user_id,
            'before' => $before,
            'after' => $this->staffAuditSnapshot($staff->fresh(['user', 'location'])),
        ]);

        return response()->json(['message' => 'Staff member deactivated.']);
    }

    private function staffAuditSnapshot(MerchantStaff $staff): array
    {
        return [
            'id' => $staff->id,
            'user_id' => $staff->user_id,
            'user_name' => $staff->user?->name,
            'user_phone' => $staff->user?->phone_number,
            'role' => $staff->role,
            'job_title' => $staff->job_title,
            'display_name' => $staff->display_name,
            'assigned_location_id' => $staff->assigned_location_id,
            'assigned_location_name' => $staff->location?->name,
            'is_active' => (bool) $staff->is_active,
            'dashboard_access_enabled' => (bool) $staff->dashboard_access_enabled,
            'pos_access_enabled' => (bool) $staff->pos_access_enabled,
            'permissions' => $staff->permissions ?? [],
            'effective_permissions' => MerchantPermissions::permissionsForStaff($staff),
        ];
    }
}
