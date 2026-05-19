<?php

namespace App\Http\Controllers;

use App\Models\Merchant;
use App\Models\Country;
use App\Models\Currency;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use App\Support\BusinessCategoryRegistry;
use App\Support\BusinessModuleRegistry;
use App\Support\BusinessOperationRegistry;
use App\Support\CommerceModeRegistry;

class MerchantProfileController extends Controller
{
    /**
     * Show the form for editing the merchant profile.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $merchant = $request->route('merchant') instanceof Merchant
            ? $request->route('merchant')
            : ($request->attributes->get('resolved_merchant')
                ?? $user->merchantProfiles()->where('is_default', true)->first()
                ?? $user->merchantProfiles()->first());

        if (!$merchant) {
            abort(404, 'Merchant profile not found.');
        }

        $merchant->loadMissing(['storefrontSetting', 'kyc', 'country']);

        return Inertia::render('Merchant/Settings', [
            'merchant' => $merchant,
            'merchantUsername' => $merchant->username,
            'retailEligible' => $merchant->isRetailEligible(),
            'businessCategories' => BusinessCategoryRegistry::all(),
            'businessOperations' => BusinessOperationRegistry::all(),
            'businessModules' => BusinessModuleRegistry::all(),
            'commerceModes' => CommerceModeRegistry::all(),
            'businessContext' => $merchant->businessCategory(),
            'storefrontSettings' => [
                'allow_post_comments' => (bool) ($merchant->storefrontSetting?->allow_post_comments ?? true),
                'allow_post_reactions' => (bool) ($merchant->storefrontSetting?->allow_post_reactions ?? true),
            ],
            'countries' => Country::select('id', 'name', 'iso_alpha2 as code', 'timezone', 'settings')->get(),
            'currencies' => Currency::select('id', 'code', 'symbol', 'name')->get(),
        ]);
    }

    /**
     * Update the merchant profile in storage.
     */
    public function update(Request $request): \Illuminate\Http\RedirectResponse
    {
        $user = $request->user();
        $merchant = $request->route('merchant') instanceof Merchant
            ? $request->route('merchant')
            : ($request->attributes->get('resolved_merchant')
                ?? $user->merchantProfiles()->where('is_default', true)->first()
                ?? $user->merchantProfiles()->first());

        if (!$merchant) {
            abort(404, 'Merchant profile not found.');
        }

        $selectedCountry = Country::find($request->input('country_id') ?: $merchant->country_id);
        $countryTimezones = $selectedCountry?->timezones() ?? [];

        $validated = $request->validate([
            'display_name' => 'required|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'country_id' => 'nullable|exists:countries,id',
            'currency_id' => 'nullable|exists:currencies,id',
            'timezone' => ['nullable', 'timezone', Rule::in($countryTimezones ?: timezone_identifiers_list())],
            'avatar_url' => 'nullable|string',
            'allow_post_comments' => 'nullable|boolean',
            'allow_post_reactions' => 'nullable|boolean',
            'business_category_key' => ['nullable', 'string', Rule::in(array_keys(BusinessCategoryRegistry::all()))],
            'business_subcategory_key' => ['nullable', 'string', 'max:80'],
            'business_profile' => 'nullable|array',
            'business_profile.description' => 'nullable|string|max:1000',
            'business_profile.default_offer_mode' => 'nullable|string|max:80',
            'business_profile.primary_operation' => ['nullable', 'string', Rule::in(BusinessOperationRegistry::keys())],
            'business_profile.operations' => 'nullable|array',
            'business_profile.operations.*' => ['string', Rule::in(BusinessOperationRegistry::keys())],
            'business_profile.commerce_modes' => 'nullable|array',
            'business_profile.commerce_modes.*' => ['string', Rule::in(CommerceModeRegistry::keys())],
            'active_modules' => 'nullable|array',
            'active_modules.*' => ['string', Rule::in(BusinessModuleRegistry::keys())],
        ]);

        $businessCategory = $validated['business_category_key'] ?? null;
        $businessSubcategory = $validated['business_subcategory_key'] ?? null;
        $businessConfig = BusinessCategoryRegistry::get($businessCategory, $businessSubcategory);
        if ($businessCategory && ! $businessConfig) {
            abort(422, 'Invalid business category.');
        }
        if ($businessSubcategory && ! isset(($businessConfig['subcategories'] ?? [])[$businessSubcategory])) {
            abort(422, 'Invalid business subcategory.');
        }

        $profile = $validated['business_profile'] ?? null;
        if ($merchant->isBusinessProfile()) {
            $operationConfig = BusinessOperationRegistry::get(
                $profile['primary_operation'] ?? ($merchant->business_profile['primary_operation'] ?? null),
                $profile['operations'] ?? ($merchant->business_profile['operations'] ?? [])
            );
            $profile = array_merge($profile ?? [], [
                'primary_operation' => $operationConfig['primary_operation'],
                'operations' => $operationConfig['operations'],
                'operation_labels' => $operationConfig['operation_labels'],
                'recommended_modules' => $operationConfig['recommended_modules'],
                'recommended_commerce_modes' => $operationConfig['recommended_commerce_modes'],
                'commerce_modes' => CommerceModeRegistry::normalize($profile['commerce_modes'] ?? $operationConfig['recommended_commerce_modes']),
            ]);
        }
        if ($merchant->isBusinessProfile() && $businessConfig) {
            $profile = array_merge($profile ?? [], [
                'category_label' => $businessConfig['label'],
                'subcategory_label' => $businessConfig['subcategory_label'],
                'offer_types' => $businessConfig['offer_types'],
                'recommended_modules' => $businessConfig['recommended_modules'],
                'recommended_commerce_modes' => $businessConfig['recommended_commerce_modes'],
                'commerce_modes' => CommerceModeRegistry::normalize($profile['commerce_modes'] ?? []),
            ]);
        }

        $activeModules = array_key_exists('active_modules', $validated)
            ? BusinessModuleRegistry::normalize($validated['active_modules'] ?? [])
            : ($merchant->active_modules ?? []);

        $merchant->update([
            'display_name' => $validated['display_name'],
            'bio' => $validated['bio'] ?? null,
            'country_id' => $validated['country_id'] ?? null,
            'currency_id' => $validated['currency_id'] ?? null,
            'timezone' => $validated['timezone'] ?? $selectedCountry?->defaultTimezone(),
            'avatar_url' => $validated['avatar_url'] ?? null,
            'business_category_key' => $businessCategory,
            'business_subcategory_key' => $businessSubcategory,
            'business_profile' => $profile,
            'active_modules' => $activeModules,
        ]);

        $merchant->storefrontSetting()->updateOrCreate(
            ['merchant_profile_id' => $merchant->id],
            [
                'allow_post_comments' => (bool) ($validated['allow_post_comments'] ?? true),
                'allow_post_reactions' => (bool) ($validated['allow_post_reactions'] ?? true),
            ]
        );

        return redirect()->back()->with('message', 'Mipangilio imesasishwa kikamilifu.');
    }

}
