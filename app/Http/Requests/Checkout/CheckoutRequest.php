<?php

namespace App\Http\Requests\Checkout;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Country;
use App\Models\Merchant;
use App\Models\OfferingGroup;
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
            'purchasable_type' => ['nullable', 'string', Rule::in(['product', 'bundle', 'offering_group', 'content_item', 'subscription_plan', 'post'])],
            'purchasable_id' => 'nullable|integer|min:1',
            'selected_offering_group_items' => 'nullable|array',
            'selected_offering_group_items.*.group_item_id' => 'required_with:selected_offering_group_items|integer|min:1',
            'selected_offering_group_items.*.selected' => 'nullable|boolean',
            'selected_offering_group_items.*.selected_variant_id' => 'nullable|integer|exists:product_variants,id',
            'selected_offering_group_items.*.quantity' => 'nullable|numeric|min:0.001|max:100000',
            'selected_offering_group_items.*.add_ons' => 'nullable|array',
            'selected_offering_group_items.*.add_ons.*.name' => 'required_with:selected_offering_group_items.*.add_ons|string|max:120',
            'selected_offering_group_items.*.children' => 'nullable|array',
            'selected_bundle_items' => 'nullable|array',
            'selected_bundle_items.*.item_type' => ['required_with:selected_bundle_items', 'string', Rule::in(['product', 'content_item'])],
            'selected_bundle_items.*.item_id' => 'required_with:selected_bundle_items|integer|min:1',
            'selected_bundle_items.*.selected_variant_id' => 'nullable|integer|exists:product_variants,id',
            'selected_bundle_items.*.quantity' => 'nullable|integer|min:1|max:99',
            'quantity' => 'nullable|numeric|min:0.001|max:100000',
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
            'delivery_type' => ['nullable', 'string', Rule::in(['shipping', 'local_boda', 'intercity_bus', 'self_pickup'])],
            'idempotency_key' => 'required|string|max:255',
            'payment_page_id' => 'nullable|integer|exists:payment_pages,id',
            'coupon_code' => 'nullable|string|max:64',
            'referral_code' => 'nullable|string|max:80',
            'attribution_session_id' => 'nullable|string|max:80',
            'attribution_source' => 'nullable|string|max:80',
            'landing_url' => 'nullable|string|max:1000',
            'referrer_url' => 'nullable|string|max:1000',
            'utm_source' => 'nullable|string|max:120',
            'utm_medium' => 'nullable|string|max:120',
            'utm_campaign' => 'nullable|string|max:160',
            'utm_content' => 'nullable|string|max:160',
            'utm_term' => 'nullable|string|max:160',
            'group_sale_campaign_id' => 'nullable|integer|exists:merchant_group_sale_campaigns,id',
            'service_request_id' => 'nullable|integer|exists:service_requests,id',
            'service_request_token' => 'nullable|string|max:100',
            'service_pricing_inputs' => 'nullable|array',
            'service_pricing_inputs.service_option_id' => 'nullable|string|max:80',
            'service_pricing_inputs.people' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.guests' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.attendees' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.hours' => 'nullable|numeric|min:0.25|max:100000',
            'service_pricing_inputs.quantity' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.rooms' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.units' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.start_date' => 'nullable|date',
            'service_pricing_inputs.end_date' => 'nullable|date|after:service_pricing_inputs.start_date',
            'service_pricing_inputs.check_in' => 'nullable|date',
            'service_pricing_inputs.check_out' => 'nullable|date|after:service_pricing_inputs.check_in',
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

        $servicePricingInputs = $this->input('service_pricing_inputs');
        if (is_array($servicePricingInputs)) {
            $normalizedInputs = $servicePricingInputs;

            $normalizedInputs['people'] ??= $servicePricingInputs['guests']
                ?? $servicePricingInputs['attendees']
                ?? null;
            $normalizedInputs['quantity'] ??= $servicePricingInputs['rooms']
                ?? $servicePricingInputs['units']
                ?? null;
            $normalizedInputs['start_date'] ??= $servicePricingInputs['check_in'] ?? null;
            $normalizedInputs['end_date'] ??= $servicePricingInputs['check_out'] ?? null;

            $this->merge([
                'service_pricing_inputs' => array_filter(
                    $normalizedInputs,
                    fn ($value) => $value !== null && $value !== ''
                ),
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
                'offering_group' => OfferingGroup::whereKey($id)->where('status', 'published')->exists(),
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

                if ($this->filled('service_request_id')) {
                    $serviceRequest = \App\Models\ServiceRequest::query()->find((int) $this->input('service_request_id'));
                    if (!$product?->isService() || !$serviceRequest || (int) $serviceRequest->product_id !== (int) $product->id) {
                        $validator->errors()->add('service_request_id', 'Service request does not match this service.');
                        return;
                    }
                    if (!$serviceRequest->payment_token || !hash_equals((string) $serviceRequest->payment_token, (string) $this->input('service_request_token'))) {
                        $validator->errors()->add('service_request_token', 'Service payment link is invalid.');
                        return;
                    }
                    if (!in_array($serviceRequest->status, ['quoted', 'confirmed'], true) || (float) $serviceRequest->quoted_amount <= 0) {
                        $validator->errors()->add('service_request_id', 'Service request is not payable yet.');
                        return;
                    }
                    if (in_array($serviceRequest->payment_status, ['paid', 'held', 'released', 'disputed', 'payment_initiated'], true)) {
                        $validator->errors()->add('service_request_id', 'Service request payment is already completed or pending.');
                        return;
                    }
                    if ($serviceRequest->payment_link_expires_at && $serviceRequest->payment_link_expires_at->isPast()) {
                        $validator->errors()->add('service_request_id', 'Service payment link has expired.');
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
            'offering_group' => OfferingGroup::query()->whereKey($id)->value('merchant_id'),
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
