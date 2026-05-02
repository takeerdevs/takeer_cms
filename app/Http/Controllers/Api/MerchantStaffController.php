<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MerchantStaff;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class MerchantStaffController extends Controller
{
    /**
     * List all staff for the active merchant.
     */
    public function index(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $user = $request->user();

        // Security: Only Owners or Managers can manage staff
        $isOwner = $merchant->user_id === $user->id;
        $isManager = \App\Models\MerchantStaff::where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->where('role', 'MANAGER')
            ->where('is_active', true)
            ->exists();

        if (!$isOwner && !$isManager) {
            return response()->json(['message' => 'Huna ruhusa ya kusimamia mhudumu.'], 403);
        }
        
        $staff = $merchant->staff()
            ->with(['user', 'location'])
            ->get();

        return response()->json(['data' => $staff]);
    }

    /**
     * Enroll a new staff member (Shadow User flow).
     */
    public function store(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'phone_number' => 'required|string', // Format check usually done by middleware or service
            'name' => 'required|string|max:255',
            'role' => ['required', Rule::in(['MANAGER', 'CASHIER', 'STOREKEEPER'])],
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
            'pin_hash' => Hash::make($validated['pin']),
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Staff member enrolled successfully.',
            'data' => $staff->load('user')
        ], 201);
    }

    /**
     * Update a staff member.
     */
    public function update(Request $request, MerchantStaff $staff): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        
        if ($staff->merchant_id !== $merchant->id) {
            abort(403);
        }

        $validated = $request->validate([
            'role' => [Rule::in(['MANAGER', 'CASHIER', 'STOREKEEPER'])],
            'assigned_location_id' => 'nullable|exists:merchant_locations,id',
            'is_active' => 'boolean',
            'pin' => 'nullable|string|size:4',
        ]);

        $staff->update($validated);

        if (!empty($validated['pin'])) {
            $staff->update(['pin_hash' => Hash::make($validated['pin'])]);
        }

        return response()->json([
            'message' => 'Staff record updated.',
            'data' => $staff->load(['user', 'location'])
        ]);
    }

    /**
     * Reset a staff member's terminal PIN.
     */
    public function resetPin(Request $request, MerchantStaff $staff): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($staff->merchant_id !== $merchant->id) abort(403);

        $validated = $request->validate([
            'pin' => 'required|string|size:4',
        ]);

        $staff->update([
            'pin_hash' => Hash::make($validated['pin'])
        ]);

        return response()->json(['message' => 'PIN imewekwa upya mafanikio.']);
    }

    /**
     * Clear all trusted devices for a staff member.
     * Forces OTP on next login.
     */
    public function clearDevices(Request $request, MerchantStaff $staff): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($staff->merchant_id !== $merchant->id) abort(403);

        $staff->authorizedDevices()->delete();

        return response()->json(['message' => 'Vifaa vyote vimeondolewa. OTP itatakiwa kwenye login ijayo.']);
    }

    /**
     * Remove/Deactivate a staff member.
     */
    public function destroy(Request $request, MerchantStaff $staff): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        if ($staff->merchant_id !== $merchant->id) {
            abort(403);
        }

        // We soft-deactivate rather than delete to maintain audit logs
        $staff->update(['is_active' => false]);

        return response()->json(['message' => 'Staff member deactivated.']);
    }
}
