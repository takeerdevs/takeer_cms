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

class MerchantProfileController extends Controller
{
    /**
     * Show the form for editing the merchant profile.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_default', true)->first() 
            ?? $user->merchantProfiles()->first();

        if (!$merchant) {
            abort(404, 'Merchant profile not found.');
        }

        $merchant->loadMissing(['storefrontSetting', 'kyc', 'country']);

        return Inertia::render('Merchant/Settings', [
            'merchant' => $merchant,
            'merchantUsername' => $merchant->username,
            'retailEligible' => $merchant->isRetailEligible(),
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
        $merchant = $user->merchantProfiles()->where('is_default', true)->first() 
            ?? $user->merchantProfiles()->first();

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
        ]);

        $merchant->update([
            'display_name' => $validated['display_name'],
            'bio' => $validated['bio'] ?? null,
            'country_id' => $validated['country_id'] ?? null,
            'currency_id' => $validated['currency_id'] ?? null,
            'timezone' => $validated['timezone'] ?? $selectedCountry?->defaultTimezone(),
            'avatar_url' => $validated['avatar_url'] ?? null,
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
