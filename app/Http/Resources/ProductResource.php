<?php

namespace App\Http\Resources;

use App\Models\MerchantGroupSaleCampaign;
use App\Services\EntitlementService;
use App\Support\ServiceTemplateRegistry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $this->loadMissing(['createdByUser:id,name', 'createdByStaff:id,display_name,job_title,user_id']);

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
        $productRating = $this->productRatingSummary();
        $groupSaleOffer = $this->getAttribute('group_sale_offer');
        if (! $groupSaleOffer && $this->type === 'physical' && ($this->fulfillment_mode ?: 'own_stock') === 'group_sale') {
            $autoGroupSale = MerchantGroupSaleCampaign::query()
                ->where('product_id', $this->id)
                ->whereIn('status', ['active', 'successful'])
                ->where('ends_at', '>=', now())
                ->latest()
                ->first();

            if ($autoGroupSale) {
                $groupSaleOffer = [
                    'id' => $autoGroupSale->id,
                    'slug' => $autoGroupSale->slug,
                    'title' => $autoGroupSale->title,
                    'campaign_price' => (float) $autoGroupSale->campaign_price,
                    'regular_price' => $autoGroupSale->regular_price !== null ? (float) $autoGroupSale->regular_price : null,
                    'goal_quantity' => (int) $autoGroupSale->goal_quantity,
                    'reserved_quantity' => (int) $autoGroupSale->reserved_quantity,
                    'progress_percent' => $autoGroupSale->progressPercent(),
                    'status' => $autoGroupSale->status,
                    'is_checkout_open' => $autoGroupSale->status === 'successful' || $autoGroupSale->reserved_quantity >= $autoGroupSale->goal_quantity,
                    'url' => url('/group-sale/'.$autoGroupSale->slug),
                ];
            }
        }

        $user = $request->user();
        $hasAccess = false;
        $latestOrderId = null;
        $isOwner = $user && $this->relationLoaded('merchant') && $this->merchant
            ? (int) $this->merchant->user_id === (int) $user->id
            : (bool) ($user && (int) ($this->merchant?->user_id ?? 0) === (int) $user->id);
        
        if ($user && ($this->type === 'digital' || $this->type === 'service')) {
            $entitlementQuery = \App\Models\Entitlement::where('user_id', $user->id)
                ->where('item_type', 'product')
                ->where('item_id', $this->id)
                ->where('status', 'active')
                ->where(function ($query) {
                    $query->whereNull('starts_at')->orWhere('starts_at', '<=', now());
                })
                ->where(function ($query) {
                    $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
                });

            $entitlement = (clone $entitlementQuery)
                ->latest()
                ->first();
                
            if ($entitlement) {
                $hasAccess = true;
                $latestOrderId = (clone $entitlementQuery)
                    ->where('source_type', 'order')
                    ->latest()
                    ->value('source_id');
            }
        }
        $canExposeDigitalDelivery = $this->type !== 'digital' || $hasAccess || $isOwner;
        $digitalDeliveryType = $this->type === 'digital' ? ($this->digital_delivery_type ?: 'file') : null;
        $canViewPremiumVideo = $this->type === 'digital'
            && $digitalDeliveryType === 'video_stream'
            && $canExposeDigitalDelivery
            && filled($this->paid_video_url);
        $canViewPremiumAudio = $this->type === 'digital'
            && $digitalDeliveryType === 'audio_stream'
            && $canExposeDigitalDelivery
            && filled($this->paid_audio_url);
        $galleryItems = collect($this->paid_gallery_items ?: [])->filter(fn ($item) => filled($item['url'] ?? null))->values();
        $canViewGalleryPack = $this->type === 'digital'
            && $digitalDeliveryType === 'gallery_pack'
            && $canExposeDigitalDelivery
            && $galleryItems->isNotEmpty();
        $isLiveEvent = $this->type === 'digital' && $digitalDeliveryType === 'live_event';
        $canReadDocument = $this->type === 'digital'
            && $canExposeDigitalDelivery
            && $digitalDeliveryType === 'file'
            && strtolower((string) $extension) === 'pdf'
            && filled($rawDelivery);
        $softwareReleases = $this->type === 'digital' && $this->digital_content_type === 'software'
            ? $this->softwareReleases()->where('status', 'published')->get()
            : collect();
        $softwareLicenseKey = null;
        if ($this->type === 'digital' && $this->digital_content_type === 'software' && $canExposeDigitalDelivery && $user) {
            $licenseQuery = \App\Models\ProductLicenseKey::query()
                ->where('product_id', $this->id)
                ->where('user_id', $user->id)
                ->where('status', 'active');
            if ($latestOrderId) {
                $licenseQuery->where('order_id', $latestOrderId);
            }
            $softwareLicenseKey = $licenseQuery->latest('issued_at')->latest('id')->first();
        }
        $firstMedia = $this->images->first();
        $fallbackImageMedia = $this->images->first(fn ($item) => ($item->media_type ?: 'image') === 'image');
        $publicImageUrl = $firstMedia?->thumbnail_url
            ?? $fallbackImageMedia?->image_url
            ?? ($this->type === 'digital' || preg_match('/\.(mp4|mov|webm|ogg)(\?|$)/i', (string) $this->url) ? null : $this->url);
        $serviceRelatedProductIds = collect($this->service_related_product_ids ?: [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();
        $serviceRelatedProducts = $this->type === 'service' && $serviceRelatedProductIds->isNotEmpty()
            ? \App\Models\Product::query()
                ->where('merchant_id', $this->merchant_id)
                ->where('type', 'physical')
                ->whereIn('id', $serviceRelatedProductIds)
                ->with(['images', 'unitType', 'packageContentUnitType', 'returnPolicy', 'faqs'])
                ->withCount('postTags')
                ->get()
                ->filter(fn ($product) => ($product->post_tags_count ?? 0) > 0 || $isOwner)
                ->sortBy(fn ($product) => $serviceRelatedProductIds->search((int) $product->id))
                ->map(fn ($product) => [
                    'id' => $product->id,
                    'slug' => $product->slug,
                    'title' => $product->title,
                    'type' => $product->type,
                    'price' => $product->price !== null ? (float) $product->price : null,
                    'discounted_price' => $product->discounted_price !== null ? (float) $product->discounted_price : null,
                    'checkout_price' => $product->discounted_price > 0 ? (float) $product->discounted_price : (float) $product->price,
                    'image_url' => $product->image_url,
                    'fulfillment_mode' => $product->fulfillment_mode ?: 'own_stock',
                    'available_stock' => $product->available_stock,
                    'unit_type' => $product->product_unit_type_id ? [
                        'id' => $product->product_unit_type_id,
                        'name' => $product->unitType?->name,
                        'code' => $product->unitType?->code,
                        'symbol' => $product->unitType?->symbol,
                        'unit_category' => $product->unitType?->unit_category,
                    ] : null,
                    'sellable_quantity' => $product->sellable_quantity !== null ? (float) $product->sellable_quantity : 1,
                    'package_content_quantity' => $product->package_content_quantity !== null ? (float) $product->package_content_quantity : null,
                    'package_content_unit_type' => $product->package_content_unit_type_id ? [
                        'id' => $product->package_content_unit_type_id,
                        'name' => $product->packageContentUnitType?->name,
                        'code' => $product->packageContentUnitType?->code,
                        'symbol' => $product->packageContentUnitType?->symbol,
                        'unit_category' => $product->packageContentUnitType?->unit_category,
                    ] : null,
                    'package_contents' => $product->package_contents,
                    'package_content_items' => $product->package_content_items ?: [],
                    'return_policy' => $product->returnPolicy ? [
                        'id' => $product->returnPolicy->id,
                        'name' => $product->returnPolicy->name,
                        'policy' => $product->returnPolicy->policy,
                        'window_days' => $product->returnPolicy->window_days,
                        'note' => $product->returnPolicy->note,
                    ] : null,
                    'faqs' => $product->faqs
                        ->where('is_published', true)
                        ->map(fn ($faq) => [
                            'id' => $faq->id,
                            'question' => $faq->question,
                            'answer' => $faq->answer,
                            'source' => $faq->source,
                        ])
                        ->values()
                        ->all(),
                    'url' => url('/product/'.($product->slug ?: $product->id)),
                ])
                ->values()
                ->all()
            : [];

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'type' => $this->type,
            'created_by' => $this->creatorPayload(),
            'has_access' => $hasAccess,
            'latest_order_id' => $latestOrderId,
            'has_variants' => (bool) $this->has_variants,
            'fulfillment_mode' => $this->fulfillment_mode ?: 'own_stock',
            'source_details' => $isOwner ? ($this->source_details ?: []) : [],
            'availability_lead_time_days' => $this->availability_lead_time_days !== null ? (int) $this->availability_lead_time_days : null,
            'availability_lead_time_hours' => ($this->fulfillment_mode ?: 'own_stock') === 'supplier_sourced' && data_get($this->source_details ?: [], 'confirmation_hours') !== null
                ? (int) data_get($this->source_details ?: [], 'confirmation_hours')
                : null,
            'available_from' => $this->available_from?->toDateString(),
            'group_sale_goal_quantity' => $this->group_sale_goal_quantity !== null ? (int) $this->group_sale_goal_quantity : null,
            'group_sale_deadline' => $this->group_sale_deadline?->toDateString(),
            'price' => (float) $this->price,
            'checkout_price' => $this->getAttribute('checkout_price') !== null ? (float) $this->getAttribute('checkout_price') : null,
            'group_sale_offer' => $groupSaleOffer,
            'compare_at_price' => $this->compare_at_price !== null ? (float) $this->compare_at_price : null,
            'discounted_price' => (float) $this->discounted_price,
            'inventory_count' => $this->inventory_count,
            'inventory_quantity' => $this->inventory_quantity !== null ? (float) $this->inventory_quantity : null,
            'sellable_quantity' => $this->sellable_quantity !== null ? (float) $this->sellable_quantity : 1,
            'package_content_quantity' => $this->package_content_quantity !== null ? (float) $this->package_content_quantity : null,
            'package_content_unit_type' => $this->package_content_unit_type_id ? [
                'id' => $this->package_content_unit_type_id,
                'name' => $this->packageContentUnitType?->name,
                'code' => $this->packageContentUnitType?->code,
                'symbol' => $this->packageContentUnitType?->symbol,
                'unit_category' => $this->packageContentUnitType?->unit_category,
                'allows_decimal' => (bool) ($this->packageContentUnitType?->allows_decimal ?? false),
            ] : null,
            'package_contents' => $this->package_contents,
            'package_content_items' => $this->package_content_items ?: [],
            'min_order_quantity' => $this->min_order_quantity !== null ? (float) $this->min_order_quantity : null,
            'order_increment' => $this->order_increment !== null ? (float) $this->order_increment : null,
            'unit_type' => $this->product_unit_type_id ? [
                'id' => $this->product_unit_type_id,
                'name' => $this->unitType?->name,
                'code' => $this->unitType?->code,
                'symbol' => $this->unitType?->symbol,
                'unit_category' => $this->unitType?->unit_category,
                'allows_decimal' => (bool) ($this->unitType?->allows_decimal ?? false),
                'common_quantities' => $this->unitType?->common_quantities ?? [],
            ] : null,
            'available_stock' => $this->available_stock,
            'in_stock' => $this->isInStock(),
            'rating_average' => $productRating['average'],
            'ratings_count' => $productRating['count'],
            'image_url' => $publicImageUrl,
            'url' => $canExposeDigitalDelivery ? $this->url : null,
            'download_link' => $canExposeDigitalDelivery && ($this->allow_download ?? true) ? $this->download_link : null,
            'digital_delivery_type' => $digitalDeliveryType,
            'refund_policy' => [
                'id' => $this->returnPolicy?->id,
                'name' => $this->returnPolicy?->name,
                'policy' => $this->refund_policy ?: $this->returnPolicy?->policy ?: ($this->type === 'digital' ? 'strict' : 'standard'),
                'window_days' => $this->refund_window_days !== null ? (int) $this->refund_window_days : $this->returnPolicy?->window_days,
                'note' => $this->refund_policy_note ?: $this->returnPolicy?->note,
            ],
            'faqs' => $this->whenLoaded('faqs', fn () => $this->faqs
                ->filter(fn ($faq) => $isOwner || $faq->is_published)
                ->map(fn ($faq) => [
                    'id' => $faq->id,
                    'question' => $faq->question,
                    'answer' => $faq->answer,
                    'source' => $faq->source,
                    'is_published' => (bool) $faq->is_published,
                    'sort_order' => (int) $faq->sort_order,
                ])
                ->values()
                ->all()),
            'digital_content_type' => $this->type === 'digital' ? $this->digital_content_type : null,
            'digital_usage_license' => $this->type === 'digital' ? $this->digital_usage_license : null,
            'digital_access_instructions' => $canExposeDigitalDelivery && $this->type === 'digital'
                ? $this->digital_access_instructions
                : null,
            'license_key_enabled' => (bool) ($this->license_key_enabled ?? false),
            'license_key_prefix' => $isOwner ? $this->license_key_prefix : null,
            'license_activation_limit' => $isOwner || $softwareLicenseKey ? (int) ($this->license_activation_limit ?? 1) : null,
            'software_license_key' => $softwareLicenseKey ? [
                'id' => $softwareLicenseKey->id,
                'key' => $softwareLicenseKey->license_key,
                'status' => $softwareLicenseKey->status,
                'issued_at' => $softwareLicenseKey->issued_at?->toISOString(),
                'offline_license_url' => $latestOrderId ? route('api.orders.license-file', ['order' => $latestOrderId]) : null,
            ] : null,
            'document_reader' => $canReadDocument ? [
                'url' => route('product.document.read', ['product' => $this->slug ?: $this->id]),
                'name' => $basename ? urldecode($basename) : 'Document.pdf',
                'mime' => 'application/pdf',
            ] : null,
            'software_releases' => $softwareReleases->isNotEmpty() ? $softwareReleases->map(fn ($release) => [
                'id' => $release->id,
                'version' => $release->version,
                'title' => $release->title,
                'changelog' => $release->changelog,
                'status' => $release->status,
                'is_latest' => (bool) $release->is_latest,
                'published_at' => $release->published_at?->toISOString(),
                'mime' => $release->mime,
                'size' => $release->size !== null ? (int) $release->size : null,
                'download_url' => $canExposeDigitalDelivery
                    ? route('product.releases.download', ['product' => $this->slug ?: $this->id, 'release' => $release->id])
                    : null,
            ])->values()->all() : [],
            'allow_download' => (bool) ($this->allow_download ?? true),
            'premium_video' => $canViewPremiumVideo ? [
                'url' => route('product.video.stream', ['product' => $this->slug ?: $this->id]),
                'hls_url' => $this->premium_video_hls_path
                    ? route('product.video.hls', [
                        'product' => $this->slug ?: $this->id,
                        'path' => basename($this->premium_video_hls_path),
                    ])
                    : null,
                'status' => $this->premium_video_status,
                'processing_error' => $isOwner ? $this->premium_video_error : null,
                'mime' => $this->paid_video_mime,
                'size' => $this->paid_video_size !== null ? (int) $this->paid_video_size : null,
                'duration_seconds' => $this->paid_video_duration_seconds !== null ? (int) $this->paid_video_duration_seconds : null,
            ] : null,
            'premium_audio' => $canViewPremiumAudio ? [
                'url' => route('product.audio.stream', ['product' => $this->slug ?: $this->id]),
                'mime' => $this->paid_audio_mime,
                'size' => $this->paid_audio_size !== null ? (int) $this->paid_audio_size : null,
                'duration_seconds' => $this->paid_audio_duration_seconds !== null ? (int) $this->paid_audio_duration_seconds : null,
            ] : null,
            'gallery_pack' => $canViewGalleryPack ? [
                'items' => $galleryItems->map(fn ($item, $index) => [
                    'url' => route('product.gallery.item', ['product' => $this->slug ?: $this->id, 'index' => $index]),
                    'original_url' => ($this->allow_download ?? false) || $isOwner
                        ? route('product.gallery.original', ['product' => $this->slug ?: $this->id, 'index' => $index])
                        : null,
                    'name' => $item['name'] ?? 'Gallery image',
                    'mime' => $item['preview_mime'] ?? $item['mime'] ?? null,
                    'size' => isset($item['preview_size']) ? (int) $item['preview_size'] : (isset($item['size']) ? (int) $item['size'] : null),
                    'original_mime' => $item['mime'] ?? null,
                    'original_size' => isset($item['size']) ? (int) $item['size'] : null,
                ])->all(),
            ] : null,
            'live_event' => $isLiveEvent ? [
                'starts_at' => $this->live_event_starts_at?->toISOString(),
                'duration_minutes' => $this->live_event_duration_minutes !== null ? (int) $this->live_event_duration_minutes : null,
                'timezone' => $this->live_event_timezone,
                'capacity' => $this->live_event_capacity !== null ? (int) $this->live_event_capacity : null,
                'seats_sold' => $this->live_event_capacity ? $this->liveEventSeatsSold() : null,
                'seats_remaining' => $this->live_event_capacity ? $this->liveEventSeatsRemaining() : null,
                'venue' => $canExposeDigitalDelivery ? $this->live_event_venue : null,
                'access_url' => $canExposeDigitalDelivery ? $this->live_event_access_url : null,
                'replay_url' => $canExposeDigitalDelivery ? $this->live_event_replay_url : null,
                'instructions' => $canExposeDigitalDelivery ? $this->live_event_instructions : null,
                'has_access' => (bool) $canExposeDigitalDelivery,
            ] : null,
            'paid_video_url' => $isOwner ? $this->paid_video_url : null,
            'paid_audio_url' => $isOwner ? $this->paid_audio_url : null,
            'paid_gallery_items' => $isOwner ? $this->paid_gallery_items : null,
            'service_pricing_model' => $this->service_pricing_model ?: 'fixed_price',
            'service_booking_type' => $this->service_booking_type ?: 'instant',
            'service_hourly_rate' => $this->service_hourly_rate !== null ? (float) $this->service_hourly_rate : null,
            'service_min_hours' => $this->service_min_hours !== null ? (int) $this->service_min_hours : null,
            'service_deposit_amount' => $this->service_deposit_amount !== null ? (float) $this->service_deposit_amount : null,
            'service_is_showcase' => (bool) ($this->service_is_showcase ?? false),
            'service_mode' => $this->service_mode ?: $this->legacyServiceMode(),
            'service_scheduling_type' => $this->service_scheduling_type ?: 'none',
            'service_category' => $this->service_category,
            'service_category_id' => $this->service_category_id,
            'service_subcategory' => $this->service_subcategory,
            'service_subcategory_id' => $this->service_subcategory_id,
            'service_template_key' => $this->service_template_key,
            'service_price_display' => $this->service_price_display ?: $this->legacyServicePriceDisplay(),
            'service_charges' => $this->service_charges ?? [],
            'service_options' => $this->service_options ?? [],
            'service_details' => $this->service_details ?? [],
            'service_duration_minutes' => $this->service_duration_minutes !== null ? (int) $this->service_duration_minutes : null,
            'service_location_type' => $this->service_location_type,
            'service_provider_location' => $this->service_provider_location,
            'service_area' => $this->service_area ?? [],
            'service_client_requirements' => $this->service_client_requirements,
            'service_intake_form' => $this->service_intake_form ?? [],
            'service_related_product_ids' => $serviceRelatedProductIds->all(),
            'service_related_products' => $serviceRelatedProducts,
            'service_booking_provider' => $this->service_booking_provider ?: 'manual',
            'service_contact_channel' => $this->service_contact_channel,
            'service_contact_value' => $this->service_contact_value,
            'service_trust' => $serviceTrust,
            'service_request_payment' => $this->getAttribute('service_request_payment'),
            'service_template' => $this->type === 'service' ? ServiceTemplateRegistry::forProduct($this->resource) : null,
            'module_key' => $this->module_key,
            'module_details' => $this->module_details ?? [],
            'delivery_mode' => $this->type === 'digital'
                ? (in_array($digitalDeliveryType, ['video_stream', 'audio_stream', 'gallery_pack', 'live_event', 'custom_delivery'], true) ? $digitalDeliveryType : ($isExternal ? 'external_link' : 'uploaded_file'))
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
                    'ui_hint' => $value->categoryAttribute?->ui_hint,
                    'options' => $value->categoryAttribute?->options ?? [],
                    'is_required' => (bool) ($value->categoryAttribute?->is_required ?? false),
                    'is_filterable' => (bool) ($value->categoryAttribute?->is_filterable ?? false),
                ],
                'value_text' => $value->value_text,
                'value_number' => $value->value_number !== null ? (float) $value->value_number : null,
                'value_boolean' => $value->value_boolean,
                'value_json' => $value->value_json,
                'source' => $value->source,
                'confidence' => $value->confidence !== null ? (float) $value->confidence : null,
                'is_verified' => (bool) $value->is_verified,
            ])),
            'images' => $this->whenLoaded('images', fn() => $this->images->map(function ($img) use ($isOwner) {
                $isVideo = ($img->media_type ?: 'image') === 'video';
                $publicMediaUrl = $isVideo
                    ? ($img->processed_url ?: ($isOwner ? $img->image_url : null))
                    : $img->image_url;

                return [
                    'image_url' => $publicMediaUrl,
                    'url' => $publicMediaUrl,
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
                ];
            })),
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
                    'is_primary' => (bool) $loc->is_primary,
                    'allow_self_pickup' => (bool) $loc->allow_self_pickup,
                    'contact_phone' => $loc->contact_phone,
                    'type' => $loc->type,
                ])->values() : [],
            ]),
            'location_inventories' => $this->whenLoaded('locationInventories', fn() => $this->locationInventories->map(fn($inv) => [
                'merchant_location_id' => $inv->merchant_location_id,
                'product_variant_id' => $inv->product_variant_id,
                'location_name' => $inv->location?->name,
                'quantity' => (int) $inv->quantity,
                'quantity_decimal' => $inv->quantity_decimal !== null ? (float) $inv->quantity_decimal : (float) $inv->quantity,
            ])),
            'availability_location_ids' => $this->whenLoaded('locationAvailabilities', fn() => $this->locationAvailabilities
                ->where('availability_type', 'serves')
                ->where('is_enabled', true)
                ->pluck('merchant_location_id')
                ->map(fn ($id) => (int) $id)
                ->values()),
            'location_availabilities' => $this->whenLoaded('locationAvailabilities', fn() => $this->locationAvailabilities
                ->where('availability_type', 'serves')
                ->where('is_enabled', true)
                ->map(fn ($row) => [
                    'merchant_location_id' => (int) $row->merchant_location_id,
                    'location_name' => $row->location?->name,
                    'availability_type' => $row->availability_type,
                ])
                ->values()),
            'variants' => $this->whenLoaded('variants', fn() => $this->variants->map(fn($variant) => [
                'id' => $variant->id,
                'name' => $variant->name,
                'sku' => $variant->sku,
                'price' => $variant->price !== null ? (float) $variant->price : null,
                'compare_at_price' => $variant->compare_at_price !== null ? (float) $variant->compare_at_price : null,
                'inventory_count' => (int) $variant->inventory_count,
                'inventory_quantity' => $variant->inventory_quantity !== null ? (float) $variant->inventory_quantity : null,
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
                        'quantity_decimal' => $inv->quantity_decimal !== null ? (float) $inv->quantity_decimal : (float) $inv->quantity,
                    ])->values()
                    : [],
            ])),
        ];
    }

    private function creatorPayload(): ?array
    {
        $staff = $this->relationLoaded('createdByStaff') ? $this->createdByStaff : null;
        $user = $this->relationLoaded('createdByUser') ? $this->createdByUser : null;

        if (! $staff && ! $user) {
            return null;
        }

        $displayName = $staff?->display_name
            ?: $staff?->job_title
            ?: $user?->name;

        return [
            'user_id' => $user?->id,
            'staff_id' => $staff?->id,
            'name' => $displayName,
            'user_name' => $user?->name,
            'job_title' => $staff?->job_title,
            'label' => $displayName ? "via {$displayName}" : null,
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

    private function productRatingSummary(): array
    {
        $query = \App\Models\ProductReview::query()
            ->where('product_id', $this->id);

        $count = (clone $query)->count();

        return [
            'average' => $count > 0 ? round((float) (clone $query)->avg('rating'), 1) : null,
            'count' => $count,
        ];
    }
}
