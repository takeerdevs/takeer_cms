<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Country;
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
            'country' => $country->load('currency')
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
}
