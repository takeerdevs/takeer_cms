<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MerchantStaff;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class StaffAuthController extends Controller
{
    /**
     * PIN-based login for the POS Terminal.
     */
    public function pinLogin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone_number' => 'required|string',
            'pin' => 'required|string|size:4',
            'device_id' => 'required|string', // Frontend generated UUID
            'otp' => 'nullable|string|size:6',
        ]);

        $user = User::where('phone_number', $validated['phone_number'])->first();

        if (!$user) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        // Find active staff records for this user
        $staffRecords = MerchantStaff::where('user_id', $user->id)
            ->where('is_active', true)
            ->with(['merchant', 'location'])
            ->get();

        if ($staffRecords->isEmpty()) {
            return response()->json(['message' => 'No active staff profile found for this number.'], 401);
        }

        // Check PIN against the staff record (supporting first business for now)
        $staff = $staffRecords->first();
        if (!Hash::check($validated['pin'], $staff->pin_hash)) {
            return response()->json(['message' => 'Invalid PIN.'], 401);
        }

        // Check Device Authorization
        $device = \App\Models\StaffAuthorizedDevice::firstOrCreate([
            'merchant_staff_id' => $staff->id,
            'device_id' => $validated['device_id'],
        ]);

        if (!$device->is_verified) {
            // Handle OTP Verification
            if ($validated['otp']) {
                if ($device->otp_code === $validated['otp'] && now()->lt($device->otp_expires_at)) {
                    $device->update([
                        'is_verified' => true,
                        'otp_code' => null,
                        'otp_expires_at' => null,
                        'last_used_at' => now(),
                    ]);
                    // Fall through to token generation
                } else {
                    return response()->json(['message' => 'Invalid or expired OTP.'], 422);
                }
            } else {
                // Generate and Log OTP
                $otp = str_pad((string)rand(0, 999999), 6, '0', STR_PAD_LEFT);
                $device->update([
                    'otp_code' => $otp,
                    'otp_expires_at' => now()->addMinutes(10),
                ]);

                \Illuminate\Support\Facades\Log::info("POS Terminal OTP for {$validated['phone_number']}: {$otp}");

                return response()->json([
                    'status' => 'needs_otp',
                    'message' => 'New device detected. Please enter the OTP sent to your phone.',
                ]);
            }
        }

        $device->update(['last_used_at' => now()]);

        // Create a special token for the staff terminal session
        $token = $user->createToken('staff-terminal', ['retail:operate'])->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'staff' => $staff,
            'merchant' => $staff->merchant,
            'location' => $staff->location,
            'landing_path' => match (strtoupper((string) $staff->role)) {
                'STOREKEEPER' => "/merchant/{$staff->merchant->username}/retail/storekeeper",
                default => "/merchant/{$staff->merchant->username}/retail/pos",
            },
        ]);
    }

    /**
     * PIN Override for sensitive actions (Voids, Discounts).
     */
    public function pinOverride(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'merchant_id' => 'required|exists:merchants,id',
            'pin' => 'required|string|size:4',
        ]);

        // Find any MANAGER or the OWNER (who might have a staff record too) for this merchant
        $staff = MerchantStaff::where('merchant_id', $validated['merchant_id'])
            ->where('role', 'MANAGER')
            ->where('is_active', true)
            ->get()
            ->filter(fn($s) => Hash::check($validated['pin'], $s->pin_hash))
            ->first();

        if (!$staff) {
            return response()->json(['message' => 'Override denied. Invalid Manager PIN.'], 403);
        }

        return response()->json([
            'message' => 'Override approved.',
            'manager' => $staff->load('user')
        ]);
    }
}
