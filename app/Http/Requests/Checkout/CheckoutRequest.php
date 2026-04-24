<?php

namespace App\Http\Requests\Checkout;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Country;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Already protected by auth:sanctum middleware
    }

    public function rules(): array
    {
        $productId = $this->input('product_id') ?: ($this->input('purchasable_type') === 'product' ? $this->input('purchasable_id') : null);
        $isPhysical = false;

        if ($productId) {
            $product = \App\Models\Product::find($productId);
            if ($product && $product->isPhysical()) {
                $isPhysical = true;
            }
        }

        $requiresShipping = $isPhysical && $this->input('delivery_type') !== 'self_pickup';

        return [
            'buyer_name' => [Rule::requiredIf(!$this->user()), 'nullable', 'string', 'max:255'],
            'product_id' => 'nullable|exists:products,id',
            'variant_id' => 'nullable|integer|exists:product_variants,id',
            'purchasable_type' => ['nullable', 'string', Rule::in(['product', 'bundle', 'content_item', 'subscription_plan', 'post'])],
            'purchasable_id' => 'nullable|integer|min:1',
            'selected_bundle_items' => 'nullable|array',
            'selected_bundle_items.*.item_type' => ['required_with:selected_bundle_items', 'string', Rule::in(['product', 'content_item'])],
            'selected_bundle_items.*.item_id' => 'required_with:selected_bundle_items|integer|min:1',
            'selected_bundle_items.*.selected_variant_id' => 'nullable|integer|exists:product_variants,id',
            'selected_bundle_items.*.quantity' => 'nullable|integer|min:1|max:99',
            'country_iso2' => 'nullable|string|size:2',
            'account_phone' => [Rule::requiredIf(!$this->user()), 'nullable', 'string', 'max:24'],
            'payment_number' => 'required|string|max:24',
            'delivery_zone_id' => [
                Rule::requiredIf($requiresShipping),
                'nullable',
                'exists:shipping_zones,id'
            ],
            'physical_address' => [
                Rule::requiredIf($requiresShipping),
                'nullable',
                'string',
                'min:3',
            ],
            'buyer_lat' => [Rule::requiredIf($requiresShipping), 'nullable', 'numeric', 'between:-90,90'],
            'buyer_lng' => [Rule::requiredIf($requiresShipping), 'nullable', 'numeric', 'between:-180,180'],
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'shipping_hotspot_id' => 'nullable|integer|exists:shipping_hotspots,id',
            'delivery_type' => ['nullable', 'string', Rule::in(['local_boda', 'intercity_bus', 'self_pickup'])],
            'idempotency_key' => 'required|string|max:255',
        ];
    }

    protected function prepareForValidation(): void
    {
        if (!$this->filled('payment_number') && $this->filled('account_phone')) {
            $this->merge([
                'payment_number' => $this->input('account_phone'),
            ]);
        }

        if ($this->filled('account_phone')) {
            $this->merge([
                'account_phone' => $this->normalizePhoneByRegions((string) $this->input('account_phone')),
            ]);
        }

        if ($this->filled('payment_number')) {
            $this->merge([
                'payment_number' => $this->normalizePhoneByRegions((string) $this->input('payment_number')),
            ]);
        }

        if ($this->filled('product_id') && !$this->filled('purchasable_type') && !$this->filled('purchasable_id')) {
            $this->merge([
                'purchasable_type' => 'product',
                'purchasable_id' => $this->input('product_id'),
            ]);
        }
    }

    public function messages(): array
    {
        return [
            'buyer_name.required' => 'Jina kamili linahitajika.',
            'account_phone.required' => 'Namba ya akaunti inahitajika.',
            'account_phone.max' => 'Namba ya akaunti ni ndefu mno.',
            'payment_number.max' => 'Namba ya simu ni ndefu mno.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if (!$this->user()) {
                $accountPhone = (string) $this->input('account_phone');
                if (!preg_match('/^\+[1-9][0-9]{6,14}$/', $accountPhone)) {
                    $validator->errors()->add('account_phone', 'Weka namba sahihi ya akaunti (mfano: +255..., +254..., +1...).');
                }
            }

            $phone = (string) $this->input('payment_number');
            if (!preg_match('/^\+[1-9][0-9]{6,14}$/', $phone)) {
                $validator->errors()->add('payment_number', 'Weka namba sahihi ya malipo (mfano: +255..., +254..., +1...).');
            }

            $type = $this->input('purchasable_type');
            $id = $this->input('purchasable_id');

            if (!$type || !$id) {
                $validator->errors()->add('purchasable_id', 'A purchasable item is required.');
                return;
            }

            $exists = match ($type) {
                'product' => \App\Models\Product::whereKey($id)->exists(),
                'bundle' => \App\Models\Bundle::whereKey($id)->exists(),
                'content_item' => \App\Models\ContentItem::whereKey($id)->exists(),
                'subscription_plan' => \App\Models\SubscriptionPlan::whereKey($id)->exists(),
                'post' => \App\Models\Post::whereKey($id)->exists(),
                default => false,
            };

            if (!$exists) {
                $validator->errors()->add('purchasable_id', 'Selected purchasable item was not found.');
                return;
            }

            if ($type === 'product') {
                $product = \App\Models\Product::query()->find($id);
                $variantId = $this->input('variant_id');

                if ($product?->has_variants && empty($variantId)) {
                    $validator->errors()->add('variant_id', 'Please select a product variant.');
                }

                if (!empty($variantId) && $product) {
                    $variantBelongsToProduct = \App\Models\ProductVariant::query()
                        ->whereKey((int) $variantId)
                        ->where('product_id', $product->id)
                        ->where('is_active', true)
                        ->where('inventory_count', '>', 0)
                        ->exists();

                    if (!$variantBelongsToProduct) {
                        $validator->errors()->add('variant_id', 'Selected variant is unavailable or out of stock.');
                    }
                }
            }
        });
    }

    private function normalizePhoneByRegions(string $rawNumber): string
    {
        $rawNumber = trim($rawNumber);
        if ($rawNumber === '') {
            return $rawNumber;
        }

        $regions = $this->resolveNormalizationRegions();
        foreach ($regions as $region) {
            $formatted = \App\Services\PhoneService::formatToE164($rawNumber, $region);
            if (!empty($formatted)) {
                return $formatted;
            }
        }

        return $rawNumber;
    }

    private function resolveNormalizationRegions(): array
    {
        $regions = [];

        $requestCountry = $this->input('country_iso2');
        if (is_string($requestCountry) && strlen(trim($requestCountry)) === 2) {
            $regions[] = strtoupper(trim($requestCountry));
        }

        $merchantRegion = $this->resolveMerchantCountryIso();
        if (!empty($merchantRegion)) {
            $regions[] = strtoupper($merchantRegion);
        }

        $sessionCountry = session('user_session_country');
        $sessionRegion = $sessionCountry['iso_alpha2'] ?? null;
        if (!empty($sessionRegion)) {
            $regions[] = strtoupper($sessionRegion);
        }

        $regions[] = 'TZ';

        return array_values(array_unique(array_filter($regions)));
    }

    private function resolveMerchantCountryIso(): ?string
    {
        $type = $this->input('purchasable_type');
        $id = (int) $this->input('purchasable_id');

        if (!$type || $id <= 0) {
            return null;
        }

        $merchantId = match ($type) {
            'product' => Product::query()->whereKey($id)->value('merchant_id'),
            'bundle' => Bundle::query()->whereKey($id)->value('merchant_id'),
            'content_item' => ContentItem::query()->whereKey($id)->value('merchant_id'),
            'subscription_plan' => SubscriptionPlan::query()->whereKey($id)->value('merchant_id'),
            'post' => Post::query()->whereKey($id)->value('merchant_id'),
            default => null,
        };

        if (!$merchantId) {
            return null;
        }

        $countryId = Merchant::query()->whereKey($merchantId)->value('country_id');
        if (!$countryId) {
            return null;
        }

        return Country::query()->whereKey($countryId)->value('iso_alpha2');
    }
}
