<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MerchantKyc;
use App\Models\Merchant;
use App\Services\MediaUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;

class MerchantKycController extends Controller
{
    /**
     * Get the KYC status and data for the current merchant.
     */
    public function show(Request $request, Merchant $merchant): JsonResponse
    {
        $kyc = $merchant->kyc;

        return response()->json([
            'kyc' => $kyc,
            'merchant_kyc_status' => $merchant->kyc_status,
            'is_verified' => (bool) $merchant->is_verified,
        ]);
    }

    /**
     * Submit KYC data for verification.
     */
    public function store(Request $request, Merchant $merchant, MediaUploadService $mediaService): JsonResponse
    {
        if ($merchant->kyc_status === 'verified') {
            return response()->json(['message' => 'Account is already verified.'], 400);
        }

        $validated = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'id_type' => 'required|string|in:National ID Card (NIDA),Passport,Voter ID,Driver License',
            'id_number' => 'required|string|max:50',
            'id_front' => 'required|file|image|max:5120', // 5MB max
            'id_back' => 'nullable|file|image|max:5120',
            'date_of_birth' => 'required|date|before:today',
            'gender' => 'required|string|in:Male,Female,Other',
            'residential_address' => 'required|string|max:255',
            'occupation' => 'required|string|max:100',
        ]);

        try {
            // Upload ID documents to private storage
            $idFrontUrl = $mediaService->uploadFile($request->file('id_front'), 'kyc/' . $merchant->id, true);
            $idBackUrl = $request->hasFile('id_back') 
                ? $mediaService->uploadFile($request->file('id_back'), 'kyc/' . $merchant->id, true)
                : null;

            // Normalize URLs for private storage
            $idFrontUrl = "private://{$idFrontUrl}";
            if ($idBackUrl) {
                $idBackUrl = "private://{$idBackUrl}";
            }

            // Create or update KYC record
            $kyc = MerchantKyc::updateOrCreate(
                ['merchant_id' => $merchant->id],
                [
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                    'id_type' => $validated['id_type'],
                    'id_number' => $validated['id_number'],
                    'id_front_url' => $idFrontUrl,
                    'id_back_url' => $idBackUrl,
                    'date_of_birth' => $validated['date_of_birth'],
                    'gender' => $validated['gender'],
                    'residential_address' => $validated['residential_address'],
                    'occupation' => $validated['occupation'],
                    'status' => 'pending',
                ]
            );

            // Update merchant status to pending
            $merchant->update(['kyc_status' => 'pending']);

            return response()->json([
                'message' => 'KYC data submitted successfully. Your account is now under review.',
                'kyc' => $kyc,
            ]);
        } catch (Exception $e) {
            Log::error('KYC submission failed: ' . $e->getMessage());
            return response()->json(['message' => 'Imeshindwa kutuma maelezo ya KYC. Tafadhali jaribu tena.'], 500);
        }
    }
}
