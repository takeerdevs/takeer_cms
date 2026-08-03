<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeePolicy;
use App\Services\PaymentProviderCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class AdminFeePolicyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $catalog = app(PaymentProviderCatalogService::class);

        $category = $request->query('category');

        $policies = FeePolicy::query()
            ->select([
                'id',
                'name',
                'category',
                'scope',
                'country_code',
                'currency_code',
                'merchant_id',
                'payment_channel',
                'sellable_type',
                'fee_type',
                'percentage_rate',
                'fixed_amount',
                'fixed_fee_currency_code',
                'min_fee',
                'max_fee',
                'unit_size_gb',
                'billing_interval',
                'effective_from',
                'effective_until',
                'is_active',
                'notes',
                'created_by',
                'updated_by',
                'created_at',
                'updated_at',
            ])
            ->with(['merchant:id,display_name,username', 'creator:id,name', 'updater:id,name'])
            ->when($category, fn ($query) => $query->where('category', $category))
            ->orderBy('category')
            ->orderByRaw("CASE scope WHEN 'global' THEN 1 WHEN 'country' THEN 2 WHEN 'currency' THEN 3 WHEN 'sellable_type' THEN 4 ELSE 5 END")
            ->orderByDesc('is_active')
            ->latest('effective_from')
            ->latest()
            ->get();

        return response()->json([
            'policies' => $policies,
            'payment_channels' => $catalog->feePolicyChannelOptions(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;

        $policy = FeePolicy::query()->create($data);

        return response()->json(['policy' => $policy->fresh(), 'message' => 'Fee policy created.'], 201);
    }

    public function update(Request $request, FeePolicy $feePolicy): JsonResponse
    {
        $data = $this->validated($request);
        $data['updated_by'] = $request->user()->id;

        $feePolicy->update($data);

        return response()->json(['policy' => $feePolicy->fresh(), 'message' => 'Fee policy updated.']);
    }

    public function destroy(FeePolicy $feePolicy): JsonResponse
    {
        $feePolicy->update(['is_active' => false]);

        return response()->json(['message' => 'Fee policy deactivated.']);
    }

    private function validated(Request $request): array
    {
        app(PaymentProviderCatalogService::class)->ensureDefaults();

        $request->merge([
            'currency_code' => $request->filled('currency_code') ? strtoupper((string) $request->input('currency_code')) : null,
            'fixed_fee_currency_code' => $request->filled('fixed_fee_currency_code') ? strtoupper((string) $request->input('fixed_fee_currency_code')) : null,
            'payment_channel' => $request->filled('payment_channel') ? strtolower((string) $request->input('payment_channel')) : null,
        ]);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'category' => ['required', Rule::in(['sale', 'subscription', 'storage'])],
            'scope' => ['required', Rule::in(['global', 'country', 'currency', 'merchant', 'payment_channel', 'sellable_type'])],
            'country_code' => ['nullable', 'string', 'size:2'],
            'currency_code' => ['nullable', 'string', 'size:3', Rule::exists('currencies', 'code')->where('is_active', true)],
            'merchant_id' => ['nullable', 'integer', 'exists:merchants,id'],
            'payment_channel' => [
                'nullable',
                'string',
                'max:100',
                Rule::requiredIf(fn () => $request->input('scope') === 'payment_channel'),
                Rule::exists('payment_provider_channels', 'key'),
            ],
            'sellable_type' => [
                'nullable',
                'string',
                Rule::requiredIf(fn () => $request->input('scope') === 'sellable_type'),
                Rule::in(['physical', 'digital', 'service']),
            ],
            'fee_type' => ['required', Rule::in(['percentage', 'fixed', 'hybrid'])],
            'percentage_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'fixed_fee_currency_code' => ['nullable', 'string', 'size:3', Rule::exists('currencies', 'code')->where('is_active', true)],
            'min_fee' => ['nullable', 'numeric', 'min:0'],
            'max_fee' => ['nullable', 'numeric', 'min:0'],
            'unit_size_gb' => ['nullable', 'numeric', 'min:0'],
            'billing_interval' => ['nullable', Rule::in(['one_time', 'monthly', 'yearly'])],
            'effective_from' => ['nullable', 'date'],
            'effective_until' => ['nullable', 'date', 'after:effective_from'],
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if (($data['scope'] ?? null) === 'sellable_type' && ($data['category'] ?? null) !== 'sale') {
            throw ValidationException::withMessages([
                'scope' => 'Sellable type policies apply to sale transactions only.',
            ]);
        }

        $data['country_code'] = $data['scope'] === 'country' ? strtoupper((string) $data['country_code']) : null;
        $data['currency_code'] = $data['scope'] === 'currency' ? strtoupper((string) $data['currency_code']) : null;
        $data['merchant_id'] = $data['scope'] === 'merchant' ? ($data['merchant_id'] ?? null) : null;
        $data['payment_channel'] = $data['scope'] === 'payment_channel' ? strtolower((string) $data['payment_channel']) : null;
        $data['sellable_type'] = $data['scope'] === 'sellable_type' ? strtolower((string) $data['sellable_type']) : null;
        $data['percentage_rate'] = $data['percentage_rate'] ?? 0;
        $data['fixed_amount'] = $data['fixed_amount'] ?? 0;
        $data['fixed_fee_currency_code'] = strtoupper((string) ($data['fixed_fee_currency_code'] ?? 'USD'));
        $data['is_active'] = $data['is_active'] ?? true;

        return $data;
    }
}
