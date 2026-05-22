<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Support\BusinessCategoryRegistry;
use App\Support\BusinessModuleRegistry;
use App\Support\CommerceModeRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MerchantModuleSetupController extends Controller
{
    public function show(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);

        return response()->json($this->payload($merchant));
    }

    public function update(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);

        $validated = $request->validate([
            'active_modules' => ['required', 'array'],
            'active_modules.*' => ['string', Rule::in(BusinessModuleRegistry::keys())],
            'commerce_modes' => ['nullable', 'array'],
            'commerce_modes.*' => ['string', Rule::in(CommerceModeRegistry::keys())],
        ]);

        $activeModules = BusinessModuleRegistry::normalizeConfigurable($validated['active_modules'] ?? []);
        if ($merchant->hasModule('retail_ops')) {
            $activeModules[] = 'retail_ops';
        }

        $commerceModes = CommerceModeRegistry::normalize($validated['commerce_modes'] ?? []);
        $profile = array_merge($merchant->business_profile ?? [], [
            'commerce_modes' => $commerceModes,
        ]);

        $merchant->forceFill([
            'active_modules' => $activeModules,
            'business_profile' => $profile,
        ])->save();

        return response()->json([
            'message' => 'Business modules updated.',
            ...$this->payload($merchant->fresh()),
        ]);
    }

    private function payload(Merchant $merchant): array
    {
        $profile = $merchant->business_profile ?? [];
        $businessContext = $merchant->businessCategory() ?: [
            'label' => 'Business operations',
            'subcategory_label' => null,
            'offer_types' => $profile['operations'] ?? [],
            'recommended_modules' => $profile['recommended_modules'] ?? [],
            'recommended_commerce_modes' => $profile['recommended_commerce_modes'] ?? [],
            'commerce_modes' => $profile['commerce_modes'] ?? [],
        ];
        $commerceModes = $profile['commerce_modes'] ?? [];
        $modeModules = CommerceModeRegistry::modulesFor($commerceModes);
        $recommendedModules = BusinessModuleRegistry::normalizeConfigurable($businessContext['recommended_modules'] ?? []);
        $recommendedModes = CommerceModeRegistry::normalize($businessContext['recommended_commerce_modes'] ?? []);
        $activeModules = BusinessModuleRegistry::normalizeConfigurable($merchant->active_modules ?? []);

        return [
            'merchant' => [
                'id' => $merchant->id,
                'username' => $merchant->username,
                'display_name' => $merchant->display_name,
                'type' => $merchant->type,
                'business_category_key' => $merchant->business_category_key,
                'business_subcategory_key' => $merchant->business_subcategory_key,
                'active_modules' => $activeModules,
                'commerce_modes' => $commerceModes,
                'retail_eligible' => $merchant->isRetailEligible(),
            ],
            'business_context' => $businessContext,
            'business_categories' => BusinessCategoryRegistry::all(),
            'business_modules' => BusinessModuleRegistry::configurable(),
            'commerce_modes' => CommerceModeRegistry::all(),
            'recommended_modules' => $recommendedModules,
            'recommended_commerce_modes' => $recommendedModes,
            'commerce_mode_modules' => $modeModules,
            'presets' => [
                [
                    'key' => 'category',
                    'label' => 'Operation preset',
                    'description' => 'Use the recommended module set for this business operation.',
                    'modules' => $recommendedModules,
                    'commerce_modes' => $recommendedModes,
                ],
                [
                    'key' => 'commerce_modes',
                    'label' => 'Commerce mode preset',
                    'description' => 'Add modules suggested by the selected selling modes.',
                    'modules' => $modeModules,
                    'commerce_modes' => $commerceModes,
                ],
            ],
        ];
    }
}
