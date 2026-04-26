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
        $merchant->load('country');

        return response()->json([
            'kyc' => $kyc,
            'merchant_kyc_status' => $merchant->kyc_status,
            'is_verified' => (bool) $merchant->is_verified,
            'country' => $merchant->country,
            'is_country_active' => (bool) ($merchant->country?->is_active ?? true),
        ]);
    }

    /**
     * Submit KYC data for verification.
     */
    public function store(Request $request, Merchant $merchant, MediaUploadService $mediaService): JsonResponse
    {
        // Check if country is active for selling
        $merchant->load('country');
        if ($merchant->country && !$merchant->country->is_active) {
            return response()->json([
                'message' => "Huduma ya Takeer haijapatikana bado nchini {$merchant->country->name}. Tunafanyia kazi upanuzi wetu!",
            ], 403);
        }

        if ($merchant->kyc_status === 'verified') {
            return response()->json(['message' => 'Account is already verified.'], 400);
        }
        
        $isPersonal = in_array($request->business_type, ['personal', 'individual']);
        
        $rules = [
            'business_type' => 'required|string|in:personal,individual,sole_proprietor,business,ngo',
            'first_name' => $isPersonal ? 'required|string|max:100' : 'nullable|string|max:100',
            'last_name' => $isPersonal ? 'required|string|max:100' : 'nullable|string|max:100',
            'id_type' => $isPersonal ? 'required|string|in:National ID Card (NIDA),Passport,Voter ID,Driver License' : 'nullable|string',
            'id_number' => $isPersonal ? 'required|string|max:50' : 'nullable|string|max:50',
            'id_front' => $isPersonal ? 'required|file|image|max:5120' : 'nullable|file|image|max:5120', // 5MB max
            'id_back' => 'nullable|file|image|max:5120',
            'date_of_birth' => $isPersonal ? 'required|date|before:today' : 'nullable|date',
            'gender' => $isPersonal ? 'required|string|in:Male,Female,Other' : 'nullable|string',
            'residential_address' => $isPersonal ? 'required|string|max:255' : 'nullable|string|max:255',
            'occupation' => $isPersonal ? 'required|string|max:100' : 'nullable|string|max:100',
        ];

        // Level 2 - Business specific rules
        if ($request->business_type === 'sole_proprietor') {
            $rules['tin_number'] = 'required|string|max:50';
            $rules['tin_document'] = 'required|file|image|max:5120';
        } elseif ($request->business_type === 'business') {
            $rules['tin_number'] = 'required|string|max:50';
            $rules['tin_document'] = 'required|file|image|max:5120';
            $rules['brela_number'] = 'required|string|max:50';
            $rules['business_license'] = 'required|file|image|max:5120';
        } elseif ($request->business_type === 'ngo') {
            $rules['registration_doc'] = 'required|file|image|max:5120';
        }

        $validated = $request->validate($rules);

        try {
            $data = [
                'business_type' => $validated['business_type'],
                'first_name' => $validated['first_name'] ?? null,
                'last_name' => $validated['last_name'] ?? null,
                'id_type' => $validated['id_type'] ?? null,
                'id_number' => $validated['id_number'] ?? null,
                'date_of_birth' => $validated['date_of_birth'] ?? null,
                'gender' => $validated['gender'] ?? null,
                'residential_address' => $validated['residential_address'] ?? null,
                'occupation' => $validated['occupation'] ?? null,
                'tin_number' => $validated['tin_number'] ?? null,
                'brela_number' => $validated['brela_number'] ?? null,
                'status' => 'pending',
            ];

            // If not personal, try to copy identity data from user's verified profile
            if (!$isPersonal) {
                $verifiedKyc = MerchantKyc::whereHas('merchant', function($q) use ($merchant) {
                        $q->where('user_id', $merchant->user_id)
                          ->where('is_verified', true);
                    })
                    ->whereIn('business_type', ['personal', 'individual'])
                    ->first();

                if ($verifiedKyc) {
                    $data['first_name'] = $verifiedKyc->first_name;
                    $data['last_name'] = $verifiedKyc->last_name;
                    $data['id_type'] = $verifiedKyc->id_type;
                    $data['id_number'] = $verifiedKyc->id_number;
                    $data['id_front_url'] = $verifiedKyc->id_front_url;
                    $data['id_back_url'] = $verifiedKyc->id_back_url;
                    $data['date_of_birth'] = $verifiedKyc->date_of_birth;
                    $data['gender'] = $verifiedKyc->gender;
                    $data['residential_address'] = $verifiedKyc->residential_address;
                    $data['occupation'] = $verifiedKyc->occupation;
                }
            }

            // Upload ID documents if provided
            if ($request->hasFile('id_front')) {
                $path = $mediaService->uploadFile($request->file('id_front'), 'kyc/' . $merchant->id, true);
                $data['id_front_url'] = "private://{$path}";
            }
            if ($request->hasFile('id_back')) {
                $path = $mediaService->uploadFile($request->file('id_back'), 'kyc/' . $merchant->id, true);
                $data['id_back_url'] = "private://{$path}";
            }
            
            // Upload Business documents
            if ($request->hasFile('tin_document')) {
                $path = $mediaService->uploadFile($request->file('tin_document'), 'kyc/' . $merchant->id . '/docs', true);
                $data['tin_document_url'] = "private://{$path}";
            }
            if ($request->hasFile('business_license')) {
                $path = $mediaService->uploadFile($request->file('business_license'), 'kyc/' . $merchant->id . '/docs', true);
                $data['business_license_url'] = "private://{$path}";
            }
            if ($request->hasFile('registration_doc')) {
                $path = $mediaService->uploadFile($request->file('registration_doc'), 'kyc/' . $merchant->id . '/docs', true);
                $data['registration_doc_url'] = "private://{$path}";
            }

            // Create or update KYC record
            $kyc = MerchantKyc::updateOrCreate(
                ['merchant_id' => $merchant->id],
                $data
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
