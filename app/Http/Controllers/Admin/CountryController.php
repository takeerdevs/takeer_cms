<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Models\Currency;
use App\Models\RetailBusinessObligation;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CountryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Countries', [
            'countries' => Country::with('currency')->get()
        ]);
    }

    public function settings(Country $country): Response
    {
        return Inertia::render('Admin/CountrySettings', [
            'country' => $country->load('currency'),
            'currencies' => Currency::query()
                ->where('is_active', true)
                ->orderByRaw('code = ? desc', [$country->currency?->code ?? 'TZS'])
                ->orderBy('code')
                ->get(['code', 'name', 'symbol']),
            'complianceSuggestions' => $this->complianceSuggestions($country),
        ]);
    }

    public function update(Request $request, Country $country): \Illuminate\Http\RedirectResponse
    {
        $validated = $request->validate([
            'is_active' => 'required|boolean',
            'settings' => 'nullable|array',
            'default_tax_rate' => 'nullable|numeric|min:0',
            'tax_label' => 'nullable|string|max:20',
        ]);

        $country->update($validated);

        return back()->with('success', 'Country settings updated successfully.');
    }

    public function toggleStatus(Country $country): \Illuminate\Http\RedirectResponse
    {
        $country->update(['is_active' => !$country->is_active]);
        return back()->with('success', 'Country status toggled.');
    }

    private function complianceSuggestions(Country $country): array
    {
        return RetailBusinessObligation::query()
            ->with('merchant:id,country_id,display_name')
            ->whereHas('merchant', fn ($query) => $query->where('country_id', $country->id))
            ->where('metadata->suggested_country_template', true)
            ->latest()
            ->limit(100)
            ->get()
            ->groupBy(fn (RetailBusinessObligation $obligation) => strtolower(trim(implode('|', [
                $obligation->title,
                $obligation->authority,
                $obligation->obligation_type,
            ]))))
            ->map(function ($group) {
                $first = $group->first();

                return [
                    'title' => $first->title,
                    'type' => $first->obligation_type,
                    'authority' => $first->authority,
                    'remind_days_before' => $first->remind_days_before,
                    'description' => $first->description,
                    'suggested_frequency' => '',
                    'recurrence_frequency' => $first->recurrence_frequency ?? 'none',
                    'recurrence_interval' => $first->recurrence_interval ?? 1,
                    'estimated_amount' => $first->estimated_amount,
                    'currency_code' => $first->currency_code,
                    'sector_tags' => $first->metadata['sector_tags'] ?? [],
                    'applies_when' => $first->metadata['applies_when'] ?? '',
                    'count' => $group->count(),
                    'latest_business' => $first->merchant?->display_name,
                    'latest_added_at' => $first->created_at?->toDateString(),
                ];
            })
            ->values()
            ->all();
    }
}
