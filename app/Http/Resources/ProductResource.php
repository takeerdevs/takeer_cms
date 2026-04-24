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

        $user = $request->user();
        $hasAccess = false;
        $latestOrderId = null;
        
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

        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type,
            'has_access' => $hasAccess,
            'latest_order_id' => $latestOrderId,
            'has_variants' => (bool) $this->has_variants,
            'price' => (float) $this->price,
            'compare_at_price' => $this->compare_at_price !== null ? (float) $this->compare_at_price : null,
            'discounted_price' => (float) $this->discounted_price,
            'inventory_count' => $this->inventory_count,
            'available_stock' => $this->available_stock,
            'in_stock' => $this->isInStock(),
            'image_url' => $this->images->first()?->image_url ?? $this->url,
            'url' => $this->url,
            'download_link' => $this->download_link,
            'service_pricing_model' => $this->service_pricing_model ?: 'fixed_price',
            'service_booking_type' => $this->service_booking_type ?: 'instant',
            'service_hourly_rate' => $this->service_hourly_rate !== null ? (float) $this->service_hourly_rate : null,
            'service_min_hours' => $this->service_min_hours !== null ? (int) $this->service_min_hours : null,
            'service_deposit_amount' => $this->service_deposit_amount !== null ? (float) $this->service_deposit_amount : null,
            'service_is_showcase' => (bool) ($this->service_is_showcase ?? false),
            'delivery_mode' => $this->type === 'digital'
                ? ($isExternal ? 'external_link' : 'uploaded_file')
                : null,
            'has_uploaded_file' => $this->type === 'digital' ? !$isExternal && filled($rawDelivery) : false,
            'digital_file_name' => $this->type === 'digital' && $basename ? urldecode($basename) : null,
            'digital_file_extension' => $this->type === 'digital' && $extension ? Str::upper($extension) : null,
            'slug' => $this->slug,
            'status' => ($this->post_tags_count ?? null) > 0 ? 'published' : 'draft',
            'purchases_count' => isset($this->purchases_count) ? (int) $this->purchases_count : 0,
            'views_count' => $viewsCount ?? 0,
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
                'hotspots' => $img->hotspots ?? [],
                'order' => $img->order,
            ])),
            'merchant' => $this->whenLoaded('merchant', fn() => [
                'id' => $this->merchant->id,
                'name' => $this->merchant->name,
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
                'location_inventories' => $variant->whenLoaded('locationInventories', fn() => $variant->locationInventories->map(fn($inv) => [
                    'merchant_location_id' => $inv->merchant_location_id,
                    'quantity' => (int) $inv->quantity,
                ])),
            ])),
        ];
    }
}
