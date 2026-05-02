<?php

namespace App\Http\Resources;

use App\Services\EntitlementService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $rawDelivery = (string) ($this->download_link ?: $this->url ?: '');
        $isExternal = preg_match('/^https?:\/\//i', $rawDelivery) === 1;
        $normalizedPath = preg_replace('/^private:\/\//', '', $rawDelivery);
        $basename = $normalizedPath ? basename(parse_url($normalizedPath, PHP_URL_PATH) ?: $normalizedPath) : null;
        $extension = $basename ? pathinfo($basename, PATHINFO_EXTENSION) : null;
        $viewsCount = $this->relationLoaded('postTags')
            ? (int) $this->postTags->sum(fn ($tag) => (int) ($tag->post?->views_count ?? 0))
            : null;
        $serviceTrust = $this->type === 'service' ? $this->serviceTrustSignals() : null;
        $merchantRating = $this->relationLoaded('merchant') && $this->merchant
            ? $this->merchantRatingSummary($this->merchant)
            : null;

        $user = $request->user();
        $hasAccess = false;
        $latestOrderId = null;
        $isOwner = $user && $this->relationLoaded('merchant') && $this->merchant
            ? (int) $this->merchant->user_id === (int) $user->id
            : (bool) ($user && (int) ($this->merchant?->user_id ?? 0) === (int) $user->id);
        
        if ($user && ($this->type === 'digital' || $this->type === 'service')) {
            $entitlement = \App\Models\Entitlement::where('user_id', $user->id)
                ->where('item_type', 'product')
                ->where('item_id', $this->id)
                ->where('status', 'active')
                ->latest()
                ->first();
                
            if ($entitlement) {
                $hasAccess = true;
                if ($entitlement->source_type === 'order') {
                    $latestOrderId = $entitlement->source_id;
                }
            }
        }
        $canExposeDigitalDelivery = $this->type !== 'digital' || $hasAccess || $isOwner;
        $firstMedia = $this->images->first();
        $fallbackImageMedia = $this->images->first(fn ($item) => ($item->media_type ?: 'image') === 'image');
        $publicImageUrl = $firstMedia?->thumbnail_url
            ?? $fallbackImageMedia?->image_url
            ?? ($this->type === 'digital' || preg_match('/\.(mp4|mov|webm|ogg)(\?|$)/i', (string) $this->url) ? null : $this->url);

        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type,
            'has_access' => $hasAccess,
            'latest_order_id' => $latestOrderId,
            'has_variants' => (bool) $this->has_variants,
            'price' => (float) $this->price,
            'checkout_price' => $this->getAttribute('checkout_price') !== null ? (float) $this->getAttribute('checkout_price') : null,
            'compare_at_price' => $this->compare_at_price !== null ? (float) $this->compare_at_price : null,
            'discounted_price' => (float) $this->discounted_price,
            'inventory_count' => $this->inventory_count,
            'available_stock' => $this->available_stock,
            'in_stock' => $this->isInStock(),
            'image_url' => $publicImageUrl,
            'url' => $canExposeDigitalDelivery ? $this->url : null,
            'download_link' => $canExposeDigitalDelivery ? $this->download_link : null,
            'service_pricing_model' => $this->service_pricing_model ?: 'fixed_price',
            'service_booking_type' => $this->service_booking_type ?: 'instant',
            'service_hourly_rate' => $this->service_hourly_rate !== null ? (float) $this->service_hourly_rate : null,
            'service_min_hours' => $this->service_min_hours !== null ? (int) $this->service_min_hours : null,
            'service_deposit_amount' => $this->service_deposit_amount !== null ? (float) $this->service_deposit_amount : null,
            'service_is_showcase' => (bool) ($this->service_is_showcase ?? false),
            'service_mode' => $this->service_mode ?: $this->legacyServiceMode(),
            'service_scheduling_type' => $this->service_scheduling_type ?: 'none',
            'service_category' => $this->service_category,
            'service_subcategory' => $this->service_subcategory,
            'service_price_display' => $this->service_price_display ?: $this->legacyServicePriceDisplay(),
            'service_charges' => $this->service_charges ?? [],
            'service_options' => $this->service_options ?? [],
            'service_duration_minutes' => $this->service_duration_minutes !== null ? (int) $this->service_duration_minutes : null,
            'service_location_type' => $this->service_location_type,
            'service_provider_location' => $this->service_provider_location,
            'service_area' => $this->service_area ?? [],
            'service_client_requirements' => $this->service_client_requirements,
            'service_intake_form' => $this->service_intake_form ?? [],
            'service_booking_provider' => $this->service_booking_provider ?: 'manual',
            'service_contact_channel' => $this->service_contact_channel,
            'service_contact_value' => $this->service_contact_value,
            'service_trust' => $serviceTrust,
            'service_request_payment' => $this->getAttribute('service_request_payment'),
            'delivery_mode' => $this->type === 'digital'
                ? ($isExternal ? 'external_link' : 'uploaded_file')
                : null,
            'has_uploaded_file' => $this->type === 'digital' ? !$isExternal && filled($rawDelivery) : false,
            'digital_file_name' => $this->type === 'digital' && $basename ? urldecode($basename) : null,
            'digital_file_extension' => $this->type === 'digital' && $extension ? Str::upper($extension) : null,
            'slug' => $this->slug,
            'status' => ($this->post_tags_count ?? null) > 0 ? 'published' : 'draft',
            'purchases_count' => isset($this->purchases_count) ? (int) $this->purchases_count : 0,
            'views_count' => (int) ($this->views_count ?? 0),
            'shipping_profile_id' => $this->shipping_profile_id,
            'attributes' => $this->whenLoaded('attributes', function() {
                $attr = $this->getRelationValue('attributes');
                return [
                    'category' => $attr?->category,
                    'sub_category' => $attr?->sub_category,
                    'category_id' => $attr?->category_id,
                    'sub_category_id' => $attr?->sub_category_id,
                    'brand_id' => $attr?->brand_id,
                    'model_id' => $attr?->model_id,
                    'brand_name' => $attr?->brand?->name,
                    'model_name' => $attr?->model?->name,
                    'colors' => $attr?->colors ?? [],
                    'material' => $attr?->material,
                    'style' => $attr?->style,
                    'detected_gender' => $attr?->detected_gender,
                    'suggested_description' => $attr?->suggested_description,
                    'ai_extracted' => $attr?->ai_extracted ?? [],
                ];
            }),
            'category_attribute_values' => $this->whenLoaded('categoryAttributeValues', fn() => $this->categoryAttributeValues->map(fn($value) => [
                'category_attribute_id' => $value->category_attribute_id,
                'attribute' => [
                    'id' => $value->categoryAttribute?->id,
                    'key' => $value->categoryAttribute?->key,
                    'label' => $value->categoryAttribute?->label,
                    'input_type' => $value->categoryAttribute?->input_type,
                    'options' => $value->categoryAttribute?->options ?? [],
                ],
                'value_text' => $value->value_text,
                'value_number' => $value->value_number !== null ? (float) $value->value_number : null,
                'value_boolean' => $value->value_boolean,
                'value_json' => $value->value_json,
                'source' => $value->source,
                'confidence' => $value->confidence !== null ? (float) $value->confidence : null,
                'is_verified' => (bool) $value->is_verified,
            ])),
            'images' => $this->whenLoaded('images', fn() => $this->images->map(fn($img) => [
                'image_url' => $img->image_url,
                'url' => $img->image_url,
                'media_type' => $img->media_type ?: 'image',
                'type' => $img->media_type ?: 'image',
                'thumbnail_url' => $img->thumbnail_url,
                'processed_url' => $img->processed_url,
                'hls_url' => $img->hls_url,
                'mime' => $img->mime,
                'size' => $img->size !== null ? (int) $img->size : null,
                'duration_seconds' => $img->duration_seconds !== null ? (int) $img->duration_seconds : null,
                'width' => $img->width !== null ? (int) $img->width : null,
                'height' => $img->height !== null ? (int) $img->height : null,
                'processing_status' => $img->processing_status ?: 'ready',
                'hotspots' => $img->hotspots ?? [],
                'order' => $img->order,
            ])),
            'merchant' => $this->whenLoaded('merchant', fn() => [
                'id' => $this->merchant->id,
                'name' => $this->merchant->name,
                'display_name' => $this->merchant->display_name,
                'username' => $this->merchant->username,
                'is_verified' => (bool) $this->merchant->is_verified,
                'kyc_status' => $this->merchant->kyc_status,
                'successful_sales' => (int) ($this->merchant->successful_sales ?? 0),
                'unsuccessful_sales' => (int) ($this->merchant->unsuccessful_sales ?? 0),
                'rating_average' => $merchantRating['average'] ?? null,
                'ratings_count' => $merchantRating['count'] ?? 0,
                'phone_number' => $this->merchant->phone_number ?? $this->merchant->user?->phone_number,
                'can_self_pickup' => $this->merchant->relationLoaded('locations') ? $this->merchant->locations->where('allow_self_pickup', true)->isNotEmpty() : false,
                'locations' => $this->merchant->relationLoaded('locations') ? $this->merchant->locations->map(fn($loc) => [
                    'id' => $loc->id,
                    'name' => $loc->name,
                    'address' => $loc->address,
                    'latitude' => (float) $loc->latitude,
                    'longitude' => (float) $loc->longitude,
                    'allow_self_pickup' => (bool) $loc->allow_self_pickup,
                    'contact_phone' => $loc->contact_phone,
                ])->values() : [],
            ]),
            'location_inventories' => $this->whenLoaded('locationInventories', fn() => $this->locationInventories->map(fn($inv) => [
                'merchant_location_id' => $inv->merchant_location_id,
                'product_variant_id' => $inv->product_variant_id,
                'location_name' => $inv->location?->name,
                'quantity' => (int) $inv->quantity,
            ])),
            'variants' => $this->whenLoaded('variants', fn() => $this->variants->map(fn($variant) => [
                'id' => $variant->id,
                'name' => $variant->name,
                'sku' => $variant->sku,
                'price' => $variant->price !== null ? (float) $variant->price : null,
                'compare_at_price' => $variant->compare_at_price !== null ? (float) $variant->compare_at_price : null,
                'inventory_count' => (int) $variant->inventory_count,
                'attributes' => $variant->attributes ?? [],
                'swatch_image_url' => $variant->swatch_image_url,
                'is_active' => (bool) $variant->is_active,
                'sort_order' => (int) $variant->sort_order,
                'location_inventories' => $variant->relationLoaded('locationInventories')
                    ? $variant->locationInventories->map(fn($inv) => [
                        'merchant_location_id' => $inv->merchant_location_id,
                        'product_variant_id' => $inv->product_variant_id,
                        'location_name' => $inv->location?->name,
                        'quantity' => (int) $inv->quantity,
                    ])->values()
                    : [],
            ])),
        ];
    }

    private function legacyServiceMode(): string
    {
        if ($this->type !== 'service') {
            return 'pay_now';
        }

        if ((bool) ($this->service_is_showcase ?? false) || $this->service_pricing_model === 'showcase_only') {
            return 'showcase_only';
        }

        if ($this->service_pricing_model === 'contract_quote') {
            return 'request_quote';
        }

        if (filled($this->url) && preg_match('/^https?:\/\//i', (string) $this->url)) {
            return 'external_booking';
        }

        return 'pay_now';
    }

    private function legacyServicePriceDisplay(): string
    {
        return match ($this->service_pricing_model) {
            'hourly_rate' => 'hourly',
            'contract_quote', 'showcase_only' => 'quote_only',
            'deposit_required' => 'fixed',
            default => 'fixed',
        };
    }

    private function serviceTrustSignals(): array
    {
        $merchant = $this->relationLoaded('merchant') ? $this->merchant : $this->merchant()->first();
        $identityVerified = $merchant
            && (bool) $merchant->is_verified
            && in_array(strtolower((string) $merchant->kyc_status), ['approved', 'verified'], true);

        $category = $this->serviceTrustCategory();
        $requiredDocuments = collect($category?->required_documents ?: ['identity'])->values();
        $credentialRequired = $requiredDocuments->contains('professional_license');
        $credentialVerified = ! $credentialRequired;
        $credential = null;

        if ($merchant && $credentialRequired && $category) {
            $categoryIds = array_filter([$category->id, $category->parent_id]);
            $credential = \App\Models\MerchantServiceCredential::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'verified')
                ->whereIn('service_category_id', $categoryIds)
                ->where(function ($query) {
                    $query->whereNull('expires_at')
                        ->orWhereDate('expires_at', '>=', now()->toDateString());
                })
                ->latest('reviewed_at')
                ->first();
            $credentialVerified = (bool) $credential;
        }

        $completedCount = \App\Models\ServiceRequest::query()
            ->where('product_id', $this->id)
            ->where(function ($query) {
                $query->where('payment_status', 'released')
                    ->orWhere('delivery_status', 'customer_confirmed')
                    ->orWhere('status', 'completed');
            })
            ->count();

        $disputeCount = \App\Models\Dispute::query()
            ->whereHas('order', fn ($query) => $query->where('product_id', $this->id))
            ->count();

        return [
            'identity_verified' => (bool) $identityVerified,
            'safepay_enabled' => true,
            'category_risk_level' => $category?->risk_level ?? 'standard',
            'requires_manual_review' => (bool) ($category?->requires_manual_review ?? false),
            'required_documents' => $requiredDocuments->all(),
            'credential_required' => $credentialRequired,
            'credential_verified' => $credentialVerified,
            'credential_label' => $credential?->document_name,
            'credential_expires_at' => $credential?->expires_at?->toDateString(),
            'payout_hold_days' => (int) ($category?->payout_hold_days ?? 3),
            'completed_services_count' => (int) $completedCount,
            'disputes_count' => (int) $disputeCount,
            'trust_ready' => (bool) ($identityVerified && $credentialVerified),
        ];
    }

    private function serviceTrustCategory(): ?\App\Models\ServiceCategory
    {
        $categoryName = trim((string) $this->service_category);
        $subcategoryName = trim((string) $this->service_subcategory);

        if ($categoryName === '') {
            return null;
        }

        $parent = \App\Models\ServiceCategory::query()
            ->whereNull('parent_id')
            ->whereRaw('LOWER(name) = ?', [Str::lower($categoryName)])
            ->first();

        if (! $parent) {
            return null;
        }

        if ($subcategoryName !== '') {
            return \App\Models\ServiceCategory::query()
                ->where('parent_id', $parent->id)
                ->whereRaw('LOWER(name) = ?', [Str::lower($subcategoryName)])
                ->first() ?: $parent;
        }

        return $parent;
    }

    private function merchantRatingSummary(\App\Models\Merchant $merchant): array
    {
        $query = \App\Models\ProductReview::query()
            ->whereHas('product', fn ($productQuery) => $productQuery->where('merchant_id', $merchant->id));

        $count = (clone $query)->count();

        return [
            'average' => $count > 0 ? round((float) (clone $query)->avg('rating'), 1) : null,
            'count' => $count,
        ];
    }
}
