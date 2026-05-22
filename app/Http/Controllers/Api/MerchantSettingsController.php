<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Support\BusinessCategoryRegistry;
use App\Support\BusinessModuleRegistry;
use App\Support\BusinessOperationRegistry;
use App\Support\CommerceModeRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MerchantSettingsController extends Controller
{
    /**
     * Update the merchant's store settings.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchant) {
            return response()->json(['message' => 'Huna akaunti ya muuzaji.'], 403);
        }

        $validated = $request->validate([
            'display_name' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'country_id' => 'nullable|exists:countries,id',
            'currency_id' => 'nullable|exists:currencies,id',
            'is_active' => 'nullable|boolean',
            'business_category_key' => ['nullable', 'string', Rule::in(array_keys(BusinessCategoryRegistry::all()))],
            'business_subcategory_key' => ['nullable', 'string', 'max:80'],
            'business_profile' => 'nullable|array',
            'business_profile.primary_operation' => ['nullable', 'string', Rule::in(BusinessOperationRegistry::keys())],
            'business_profile.operations' => 'nullable|array',
            'business_profile.operations.*' => ['string', Rule::in(BusinessOperationRegistry::keys())],
            'business_profile.commerce_modes' => 'nullable|array',
            'business_profile.commerce_modes.*' => ['string', Rule::in(CommerceModeRegistry::keys())],
            'active_modules' => 'nullable|array',
            'active_modules.*' => ['string', Rule::in(BusinessModuleRegistry::keys())],
        ]);

        $businessCategory = $validated['business_category_key'] ?? $merchant->business_category_key;
        $businessSubcategory = $validated['business_subcategory_key'] ?? $merchant->business_subcategory_key;
        $businessConfig = BusinessCategoryRegistry::get($businessCategory, $businessSubcategory);
        if ($businessCategory && ! $businessConfig) {
            return response()->json(['message' => 'Invalid business category.'], 422);
        }
        if ($businessSubcategory && ! isset(($businessConfig['subcategories'] ?? [])[$businessSubcategory])) {
            return response()->json(['message' => 'Invalid business subcategory.'], 422);
        }

        if (isset($validated['display_name'])) {
            $merchant->display_name = $validated['display_name'];
        }
        if (isset($validated['bio'])) {
            $merchant->bio = $validated['bio'];
        }
        if (isset($validated['country_id'])) {
            $merchant->country_id = $validated['country_id'];
        }
        if (isset($validated['currency_id'])) {
            $merchant->currency_id = $validated['currency_id'];
        }
        if (isset($validated['is_active'])) {
            $merchant->is_active = $validated['is_active'];
        }
        if (array_key_exists('business_category_key', $validated)) {
            $merchant->business_category_key = $businessCategory;
            $merchant->business_subcategory_key = $businessSubcategory;
            $merchant->business_profile = $validated['business_profile'] ?? null;
            if ($merchant->isBusinessProfile()) {
                $operationConfig = BusinessOperationRegistry::get(
                    ($merchant->business_profile ?? [])['primary_operation'] ?? null,
                    ($merchant->business_profile ?? [])['operations'] ?? []
                );
                $merchant->business_profile = array_merge($merchant->business_profile ?? [], [
                    'primary_operation' => $operationConfig['primary_operation'],
                    'operations' => $operationConfig['operations'],
                    'operation_labels' => $operationConfig['operation_labels'],
                    'recommended_modules' => $operationConfig['recommended_modules'],
                    'recommended_commerce_modes' => $operationConfig['recommended_commerce_modes'],
                    'commerce_modes' => CommerceModeRegistry::normalize(($merchant->business_profile ?? [])['commerce_modes'] ?? $operationConfig['recommended_commerce_modes']),
                ]);
                if ($businessConfig) {
                    $merchant->business_profile = array_merge($merchant->business_profile ?? [], [
                        'category_label' => $businessConfig['label'],
                        'subcategory_label' => $businessConfig['subcategory_label'],
                    ]);
                }
            }
        }
        if (array_key_exists('active_modules', $validated)) {
            $activeModules = BusinessModuleRegistry::normalizeConfigurable($validated['active_modules'] ?? []);
            if ($merchant->hasModule('retail_ops')) {
                $activeModules[] = 'retail_ops';
            }
            $merchant->active_modules = $activeModules;
        }

        $merchant->save();

        return response()->json([
            'message' => 'Mipangilio ya biashara imehifadhiwa.',
            'merchant' => $merchant->fresh(),
        ]);
    }
}
