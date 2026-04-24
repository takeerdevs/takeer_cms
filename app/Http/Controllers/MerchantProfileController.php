<?php

namespace App\Http\Controllers;

use App\Models\Merchant;
use App\Models\Country;
use App\Models\Currency;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\JsonResponse;

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

        $merchant->loadMissing('storefrontSetting');

        return Inertia::render('Merchant/Settings', [
            'merchant' => $merchant,
            'storefrontSettings' => [
                'allow_post_comments' => (bool) ($merchant->storefrontSetting?->allow_post_comments ?? true),
                'allow_post_reactions' => (bool) ($merchant->storefrontSetting?->allow_post_reactions ?? true),
                'service_hours' => $merchant->storefrontSetting?->service_hours ?? [],
                'service_timezone' => $merchant->storefrontSetting?->service_timezone,
                'service_area_type' => $merchant->storefrontSetting?->service_area_type,
                'service_locations' => $merchant->storefrontSetting?->service_locations ?? [],
            ],
            'countries' => Country::select('id', 'name', 'iso_alpha2 as code')->get(),
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

        $validated = $request->validate([
            'display_name' => 'required|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'country_id' => 'nullable|exists:countries,id',
            'currency_id' => 'nullable|exists:currencies,id',
            'avatar_url' => 'nullable|string',
            'allow_post_comments' => 'nullable|boolean',
            'allow_post_reactions' => 'nullable|boolean',
            'service_hours' => 'nullable|array',
            'service_hours.*.day' => 'required_with:service_hours|string|in:mon,tue,wed,thu,fri,sat,sun',
            'service_hours.*.is_open' => 'nullable|boolean',
            'service_hours.*.open' => ['nullable', 'regex:/^\d{2}:\d{2}$/'],
            'service_hours.*.close' => ['nullable', 'regex:/^\d{2}:\d{2}$/'],
            'service_timezone' => 'nullable|string|max:64',
            'service_area_type' => 'nullable|string|in:onsite,remote,hybrid',
            'service_locations' => 'nullable',
        ]);

        $merchant->update([
            'display_name' => $validated['display_name'],
            'bio' => $validated['bio'] ?? null,
            'country_id' => $validated['country_id'] ?? null,
            'currency_id' => $validated['currency_id'] ?? null,
            'avatar_url' => $validated['avatar_url'] ?? null,
        ]);

        $rawLocations = $request->input('service_locations');
        $locations = is_array($rawLocations)
            ? $rawLocations
            : preg_split('/\r\n|\r|\n/', (string) $rawLocations);

        $merchant->storefrontSetting()->updateOrCreate(
            ['merchant_profile_id' => $merchant->id],
            [
                'allow_post_comments' => (bool) ($validated['allow_post_comments'] ?? true),
                'allow_post_reactions' => (bool) ($validated['allow_post_reactions'] ?? true),
                'service_hours' => $this->normalizeServiceHours($validated['service_hours'] ?? []),
                'service_timezone' => $validated['service_timezone'] ?? null,
                'service_area_type' => $validated['service_area_type'] ?? null,
                'service_locations' => collect($locations ?? [])
                    ->map(fn ($location) => trim((string) $location))
                    ->filter(fn ($location) => $location !== '')
                    ->map(fn ($location) => substr($location, 0, 255))
                    ->values()
                    ->all(),
            ]
        );

        return redirect()->back()->with('message', 'Mipangilio imesasishwa kikamilifu.');
    }

    private function normalizeServiceHours(array $rows): array
    {
        $validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

        return collect($rows)
            ->filter(fn ($row) => in_array((string) ($row['day'] ?? ''), $validDays, true))
            ->map(function ($row) {
                $isOpen = (bool) ($row['is_open'] ?? false);
                return [
                    'day' => (string) $row['day'],
                    'is_open' => $isOpen,
                    'open' => $isOpen ? ($row['open'] ?? null) : null,
                    'close' => $isOpen ? ($row['close'] ?? null) : null,
                ];
            })
            ->values()
            ->all();
    }
}
