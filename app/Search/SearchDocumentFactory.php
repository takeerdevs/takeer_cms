<?php

namespace App\Search;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\ForwarderRoute;
use App\Models\Merchant;
use App\Models\OfferingGroup;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class SearchDocumentFactory
{
    public const TYPES = [
        'merchant' => Merchant::class,
        'post' => Post::class,
        'content_item' => ContentItem::class,
        'product' => Product::class,
        'bundle' => Bundle::class,
        'subscription_plan' => SubscriptionPlan::class,
        'offering_group' => OfferingGroup::class,
        'forwarder_route' => ForwarderRoute::class,
    ];

    public function build(string $type, int $id): ?array
    {
        return match ($type) {
            'merchant' => $this->merchant($id),
            'post' => $this->post($id),
            'content_item' => $this->contentItem($id),
            'product' => $this->product($id),
            'bundle' => $this->bundle($id),
            'subscription_plan' => $this->subscriptionPlan($id),
            'offering_group' => $this->offeringGroup($id),
            'forwarder_route' => $this->forwarderRoute($id),
            default => null,
        };
    }

    public function sourceModel(string $type): ?string
    {
        return self::TYPES[$type] ?? null;
    }

    private function merchant(int $id): ?array
    {
        $merchant = Merchant::query()->with(['currency', 'locations'])->find($id);
        if (! $merchant || ! $this->merchantEligible($merchant)) {
            return null;
        }

        $location = $merchant->locations->firstWhere('is_primary', true) ?: $merchant->locations->first();
        $category = method_exists($merchant, 'businessCategory') ? $merchant->businessCategory() : null;
        $categoryLabel = is_array($category) ? ($category['subcategory_label'] ?? $category['label'] ?? null) : null;
        $title = (string) ($merchant->display_name ?: $merchant->username);
        $summary = trim(implode(' ', array_filter([$merchant->bio, $categoryLabel])));

        return $this->document($merchant, 'merchant', 'merchant', 'merchant_profile', 'merchant', [
            'merchant_id' => $merchant->id,
            'title' => $title,
            'subtitle' => $merchant->username ? '@'.$merchant->username : null,
            'summary' => $summary,
            'keywords' => $this->text([$merchant->username, $merchant->type, $categoryLabel, $location?->name, $location?->city, $location?->region]),
            'url' => '/m/'.$merchant->username,
            'image_url' => $merchant->avatar_url,
            'country_id' => $merchant->country_id,
            'city' => $location?->city,
            'region' => $location?->region,
            'latitude' => $location?->latitude,
            'longitude' => $location?->longitude,
            'quality_score' => $merchant->is_verified ? 10 : 0,
            'facets' => [
                'merchant_type' => $merchant->type,
                'business_category' => $categoryLabel,
                'is_verified' => (bool) $merchant->is_verified,
            ],
            'display_data' => [
                'id' => $merchant->id,
                'name' => $title,
                'username' => $merchant->username,
                'avatar_url' => $merchant->avatar_url,
                'bio' => $merchant->bio,
                'is_verified' => (bool) $merchant->is_verified,
                'store_url' => '/m/'.$merchant->username,
                'primary_location' => $location ? [
                    'name' => $location->name,
                    'city' => $location->city,
                    'region' => $location->region,
                ] : null,
            ],
            'chunks' => [$this->chunk('summary', 'summary', $this->text([$title, $merchant->username, $summary, $categoryLabel]))],
        ]);
    }

    private function product(int $id): ?array
    {
        $product = Product::withTrashed()->with([
            'merchant.currency', 'merchant.locations', 'currency', 'attributes', 'images', 'variants',
            'categoryAttributeValues.categoryAttribute', 'faqs', 'specifications', 'detailSections', 'unitType',
            'postTags.post',
        ])->find($id);
        if (! $product || $product->trashed() || ! $product->merchant || ! $this->merchantEligible($product->merchant)) {
            return null;
        }

        $isService = $product->type === 'service';
        $entityType = $isService ? 'service' : 'product';
        $contentType = $isService ? $this->serviceContentType($product) : $this->productContentType($product);
        $cardType = $isService ? 'service' : ($product->type === 'digital' ? 'digital_product' : 'product');
        $description = (string) ($product->description ?: $product->attributes?->suggested_description ?: '');
        $catalogPosts = $product->postTags
            ->map(fn ($tag) => $tag->post)
            ->filter(fn ($post) => $post && $post->source === 'catalog_publish' && ! $post->is_restricted)
            ->unique('id')
            ->values();
        $catalogPostTerms = $catalogPosts->map(fn ($post) => $this->text([
            $post->title, $post->caption, $post->excerpt, $post->body,
        ]))->all();
        $location = $product->merchant->locations->firstWhere('is_primary', true) ?: $product->merchant->locations->first();
        $currency = $product->currency?->code ?: $product->merchant->currency?->code ?: 'TZS';
        $variants = $product->variants->where('is_active', true)->values();
        $basePrice = $this->effectivePrice($product);
        $prices = $variants->map(fn ($variant) => $variant->price !== null ? (float) $variant->price : $basePrice)->push($basePrice)->filter(fn ($price) => $price >= 0);
        $chunks = [
            $this->chunk('summary', 'summary', $this->text([
                $product->title, $description, $product->type, $product->digital_content_type,
                $product->digital_delivery_type, $product->service_category, $product->service_subcategory,
                $catalogPostTerms,
            ])),
        ];

        foreach ($variants as $variant) {
            $attributes = is_array($variant->attributes) ? $variant->attributes : [];
            $variantPrice = $variant->price !== null ? (float) $variant->price : $basePrice;
            $variantStock = (float) ($variant->inventory_quantity ?? $variant->inventory_count ?? 0);
            $chunks[] = $this->chunk(
                'variant:'.$variant->id,
                'variant',
                $this->text([$product->title, $variant->name, $variant->sku, array_values($attributes)]),
                $attributes + ['variant_id' => $variant->id, 'variant_name' => $variant->name, 'sku' => $variant->sku],
                $variantPrice,
                $variantPrice,
                $variantStock > 0,
            );
        }

        foreach ($product->faqs->where('is_published', true)->take(20) as $faq) {
            $chunks[] = $this->chunk('faq:'.$faq->id, 'faq', $this->text([$faq->question, $faq->answer]));
        }
        foreach ($product->specifications->take(30) as $specification) {
            $chunks[] = $this->chunk('specification:'.$specification->id, 'specification', $this->text([
                $specification->label ?? null, $specification->name ?? null, $specification->value ?? null,
            ]));
        }

        $categoryValues = $product->categoryAttributeValues->map(fn ($value) => $this->text([
            $value->categoryAttribute?->label,
            $value->value_text,
            $value->value_number,
            is_array($value->value_json) ? array_values($value->value_json) : $value->value_json,
        ]))->all();
        $attributeTerms = $this->text([
            $product->attributes?->category, $product->attributes?->sub_category, $product->attributes?->material,
            $product->attributes?->style, $product->attributes?->detected_gender, $product->attributes?->colors,
            $categoryValues, $product->service_options, $product->service_charges, $product->package_contents,
        ]);

        return $this->document($product, 'product', $entityType, $contentType, $cardType, [
            'merchant_id' => $product->merchant_id,
            'canonical_group_key' => 'product:'.$product->id,
            'title' => $product->title,
            'subtitle' => $product->merchant->display_name,
            'summary' => Str::limit(strip_tags($description), 600),
            'keywords' => $this->text([$attributeTerms, $catalogPostTerms, $product->slug, $product->module_key, $product->service_template_key]),
            'url' => '/product/'.($product->slug ?: $product->id),
            'image_url' => $product->image_url,
            'currency_code' => $currency,
            'price_min' => $prices->min(),
            'price_max' => $prices->max(),
            'price_min_base' => $prices->min(),
            'price_max_base' => $prices->max(),
            'in_stock' => $product->isInStock(),
            'is_available' => $product->type !== 'physical' || $product->isInStock(),
            'country_id' => $product->merchant->country_id,
            'city' => $location?->city,
            'region' => $location?->region,
            'latitude' => $location?->latitude,
            'longitude' => $location?->longitude,
            'popularity_score' => log(1 + (int) ($product->views_count ?? 0)),
            'quality_score' => $product->merchant->is_verified ? 5 : 0,
            'facets' => array_filter([
                'product_type' => $product->type,
                'digital_content_type' => $product->digital_content_type,
                'digital_delivery_type' => $product->digital_delivery_type,
                'service_category' => $product->service_category,
                'service_subcategory' => $product->service_subcategory,
                'service_category_id' => $product->service_category_id,
                'service_subcategory_id' => $product->service_subcategory_id,
                'module_key' => $product->module_key,
                'category_id' => $product->attributes?->category_id,
                'sub_category_id' => $product->attributes?->sub_category_id,
                'colors' => $product->attributes?->colors,
                'material' => $product->attributes?->material,
                'style' => $product->attributes?->style,
                'fulfillment_mode' => $product->fulfillment_mode,
                'price_kind' => $isService && in_array($product->service_mode, ['contact', 'quote'], true) ? 'quote' : 'fixed',
            ], fn ($value) => $value !== null && $value !== '' && $value !== []),
            'display_data' => [
                'id' => $product->id,
                'slug' => $product->slug,
                'title' => $product->title,
                'description' => $description,
                'type' => $product->type,
                'price' => (float) $product->price,
                'discounted_price' => $product->discounted_price !== null ? (float) $product->discounted_price : null,
                'image_url' => $product->image_url,
                'url' => '/product/'.($product->slug ?: $product->id),
                'catalog_post' => $catalogPosts->isNotEmpty() ? [
                    'id' => $catalogPosts->first()->id,
                    'public_id' => $catalogPosts->first()->public_id,
                    'permalink' => '/p/'.($catalogPosts->first()->public_id ?: $catalogPosts->first()->id),
                ] : null,
            ],
            'chunks' => array_values(array_filter($chunks, fn ($chunk) => $chunk['content'] !== '')),
        ]);
    }

    private function post(int $id): ?array
    {
        $post = Post::withTrashed()->with(['merchant', 'linkedContentItem', 'media.productImage', 'productTags.product'])->find($id);
        if (! $post || $post->trashed() || ! $post->merchant || ! $this->merchantEligible($post->merchant)) {
            return null;
        }
        if ($post->content_item_id) {
            return null;
        }
        if ($post->source === 'catalog_publish' && $post->productTags->count() === 1) {
            return null;
        }

        $restricted = (bool) $post->is_restricted;
        $publicBody = $restricted ? null : $post->body;
        $title = (string) ($post->title ?: Str::limit(trim((string) $post->caption), 100) ?: 'Post');
        $media = $post->media->first();
        $summary = trim((string) ($post->excerpt ?: $post->caption));
        $tagTerms = $post->productTags->map(fn ($tag) => $tag->product?->title)->filter()->all();

        return $this->document($post, 'post', 'post', $post->body ? 'long_post' : 'short_post', 'post', [
            'merchant_id' => $post->merchant_id,
            'title' => $title,
            'subtitle' => $post->merchant->display_name,
            'summary' => Str::limit(strip_tags($summary), 600),
            'keywords' => $this->text([$post->source, $tagTerms]),
            'url' => '/p/'.($post->public_id ?: $post->id),
            'image_url' => $media?->thumbnail_url ?? $media?->media_url ?? $media?->productImage?->image_url,
            'country_id' => $post->merchant->country_id,
            'published_at' => $post->created_at,
            'popularity_score' => log(1 + (int) $post->views_count + (int) $post->likes_count * 2 + (int) $post->comment_count * 3),
            'facets' => ['source' => $post->source, 'media_types' => $post->media->pluck('media_type')->unique()->values()->all()],
            'display_data' => ['id' => $post->id, 'public_id' => $post->public_id, 'title' => $post->title, 'caption' => $post->caption],
            'chunks' => $this->textChunks($this->text([$title, $summary, $publicBody, $tagTerms]), 'body'),
        ]);
    }

    private function contentItem(int $id): ?array
    {
        $content = ContentItem::withTrashed()->with('merchant')->find($id);
        if (! $content || $content->trashed() || $content->visibility !== 'published' || $content->moderation_status !== 'approved' || ! $content->merchant || ! $this->merchantEligible($content->merchant)) {
            return null;
        }

        $linkedPost = Post::query()->where('content_item_id', $content->id)->latest('id')->first();
        $paid = $content->price !== null;
        $publicBody = $paid ? null : $content->body;
        $url = $linkedPost ? '/p/'.($linkedPost->public_id ?: $linkedPost->id) : '/content/'.$content->slug;

        return $this->document($content, 'content_item', 'content_item', $paid ? 'paid_content' : 'article', 'long_content', [
            'merchant_id' => $content->merchant_id,
            'canonical_group_key' => 'content_item:'.$content->id,
            'title' => $content->title,
            'subtitle' => $content->merchant->display_name,
            'summary' => Str::limit(strip_tags((string) $content->excerpt), 600),
            'keywords' => $content->format,
            'url' => $url,
            'price_min' => $content->price,
            'price_max' => $content->price,
            'price_min_base' => $content->price,
            'price_max_base' => $content->price,
            'country_id' => $content->merchant->country_id,
            'published_at' => $content->published_at,
            'facets' => ['format' => $content->format, 'is_paid' => $paid],
            'display_data' => ['id' => $content->id, 'slug' => $content->slug, 'title' => $content->title, 'excerpt' => $content->excerpt, 'format' => $content->format, 'price' => $content->price, 'url' => $url],
            'chunks' => $this->textChunks($this->text([$content->title, $content->excerpt, $publicBody]), 'body'),
        ]);
    }

    private function bundle(int $id): ?array
    {
        $bundle = Bundle::withTrashed()->with(['merchant', 'currency', 'items'])->find($id);
        if (! $bundle || $bundle->trashed() || $bundle->status !== 'published' || ! $bundle->merchant || ! $this->merchantEligible($bundle->merchant)) {
            return null;
        }
        $contentType = $bundle->is_course ? 'course' : 'bundle';
        $itemTerms = $bundle->items->map(fn ($item) => $this->text([$item->lesson_title ?? null, $item->lesson_summary ?? null, $item->item_type]))->all();

        return $this->document($bundle, 'bundle', 'bundle', $contentType, $contentType, [
            'merchant_id' => $bundle->merchant_id,
            'title' => $bundle->title,
            'subtitle' => $bundle->merchant->display_name,
            'summary' => Str::limit(strip_tags((string) $bundle->description), 600),
            'keywords' => $this->text([$bundle->course_outcomes, $bundle->course_requirements, $itemTerms]),
            'url' => '/bundle/'.$bundle->slug,
            'image_url' => $bundle->course_cover_image_url,
            'currency_code' => $bundle->currency?->code ?: 'TZS',
            'price_min' => $bundle->price,
            'price_max' => $bundle->price,
            'price_min_base' => $bundle->price,
            'price_max_base' => $bundle->price,
            'country_id' => $bundle->merchant->country_id,
            'facets' => ['is_course' => (bool) $bundle->is_course, 'course_format' => $bundle->course_format],
            'display_data' => ['id' => $bundle->id, 'slug' => $bundle->slug, 'title' => $bundle->title, 'description' => $bundle->description, 'price' => $bundle->price, 'is_course' => (bool) $bundle->is_course, 'url' => '/bundle/'.$bundle->slug],
            'chunks' => [$this->chunk('summary', 'summary', $this->text([$bundle->title, $bundle->description, $itemTerms]))],
        ]);
    }

    private function subscriptionPlan(int $id): ?array
    {
        $plan = SubscriptionPlan::withTrashed()->with(['merchant', 'currency', 'items'])->find($id);
        if (! $plan || $plan->trashed() || $plan->status !== 'active' || ! $plan->merchant || ! $this->merchantEligible($plan->merchant)) {
            return null;
        }
        $itemTerms = $plan->items->map(fn ($item) => $this->text([$item->item_type, $item->item_id]))->all();

        return $this->document($plan, 'subscription_plan', 'subscription_plan', 'subscription', 'subscription', [
            'merchant_id' => $plan->merchant_id,
            'title' => $plan->name,
            'subtitle' => $plan->merchant->display_name,
            'summary' => Str::limit(strip_tags((string) $plan->description), 600),
            'keywords' => $this->text([$plan->billing_interval, $itemTerms]),
            'url' => '/plan/'.$plan->slug,
            'currency_code' => $plan->currency?->code ?: 'TZS',
            'price_min' => $plan->price,
            'price_max' => $plan->price,
            'price_min_base' => $plan->price,
            'price_max_base' => $plan->price,
            'country_id' => $plan->merchant->country_id,
            'facets' => ['billing_interval' => $plan->billing_interval, 'tier' => $plan->tier],
            'display_data' => ['id' => $plan->id, 'slug' => $plan->slug, 'name' => $plan->name, 'description' => $plan->description, 'price' => $plan->price, 'billing_interval' => $plan->billing_interval, 'url' => '/plan/'.$plan->slug],
            'chunks' => [$this->chunk('summary', 'summary', $this->text([$plan->name, $plan->description, $plan->billing_interval, $itemTerms]))],
        ]);
    }

    private function offeringGroup(int $id): ?array
    {
        $group = OfferingGroup::withTrashed()->with(['merchant', 'items'])->find($id);
        if (! $group || $group->trashed() || $group->status !== 'published' || ! $group->merchant || ! $this->merchantEligible($group->merchant)) {
            return null;
        }
        return $this->document($group, 'offering_group', 'offering_group', $group->group_type ?: 'package', 'offering_group', [
            'merchant_id' => $group->merchant_id,
            'title' => $group->title,
            'subtitle' => $group->merchant->display_name,
            'summary' => Str::limit(strip_tags((string) $group->description), 600),
            'keywords' => $this->text([$group->template_key, $group->group_type]),
            'url' => '/offerings/'.$group->id,
            'image_url' => $group->cover_image_url,
            'price_min' => $group->base_price,
            'price_max' => $group->base_price,
            'price_min_base' => $group->base_price,
            'price_max_base' => $group->base_price,
            'country_id' => $group->merchant->country_id,
            'facets' => ['group_type' => $group->group_type, 'template_key' => $group->template_key, 'pricing_mode' => $group->pricing_mode],
            'display_data' => ['id' => $group->id, 'slug' => $group->slug, 'title' => $group->title, 'description' => $group->description, 'base_price' => $group->base_price, 'cover_image_url' => $group->cover_image_url, 'url' => '/offerings/'.$group->id],
            'chunks' => [$this->chunk('summary', 'summary', $this->text([$group->title, $group->description, $group->template_key, $group->group_type]))],
        ]);
    }

    private function forwarderRoute(int $id): ?array
    {
        $route = ForwarderRoute::with(['forwarder.merchant', 'originCountry', 'destinationCountry', 'originLocations', 'destinationLocations', 'transportModes'])->find($id);
        if (! $route || ! $route->is_active || ! $route->forwarder?->is_verified) {
            return null;
        }
        $origin = $route->originCountry?->name ?: $route->originLocations->pluck('name')->filter()->join(', ');
        $destination = $route->destinationCountry?->name ?: $route->destinationLocations->pluck('name')->filter()->join(', ');
        $title = trim($origin.' to '.$destination);
        $modes = $route->transportModes->pluck('mode')->filter()->all();
        $chunks = [$this->chunk('summary', 'summary', $this->text([$title, $route->estimate, $route->rates_info, $route->customer_instructions, $modes]))];
        foreach ($route->transportModes as $mode) {
            $chunks[] = $this->chunk('route_mode:'.$mode->id, 'route_mode', $this->text([$mode->mode, $mode->estimate, $mode->pricing_model, $mode->price_amount, $mode->notes, $mode->allowed_items]));
        }

        return $this->document($route, 'forwarder_route', 'forwarder_route', 'shipping_route', 'forwarder_route', [
            'merchant_id' => $route->forwarder->merchant_id,
            'title' => $title ?: $route->route_uid,
            'subtitle' => $route->forwarder->name,
            'summary' => Str::limit($this->text([$route->estimate, $route->rates_info]), 600),
            'keywords' => $this->text([$origin, $destination, $modes]),
            'url' => '/freight/routes/'.$route->route_uid,
            'image_url' => $route->forwarder->logo_url,
            'country_id' => $route->destination_country_id,
            'facets' => ['origin_country_id' => $route->origin_country_id, 'destination_country_id' => $route->destination_country_id, 'transport_modes' => $modes],
            'display_data' => ['id' => $route->id, 'route_uid' => $route->route_uid, 'title' => $title, 'origin' => $origin, 'destination' => $destination, 'estimate' => $route->estimate, 'rates_info' => $route->rates_info, 'transport_modes' => $modes, 'url' => '/freight/routes/'.$route->route_uid],
            'chunks' => $chunks,
        ]);
    }

    private function document(Model $source, string $sourceType, string $entityType, string $contentType, string $cardType, array $data): array
    {
        return array_merge([
            'source_type' => $sourceType,
            'source_id' => (int) $source->getKey(),
            'entity_type' => $entityType,
            'entity_id' => (int) $source->getKey(),
            'canonical_group_key' => $entityType.':'.$source->getKey(),
            'content_type' => $contentType,
            'card_type' => $cardType,
            'visibility' => 'public',
            'is_searchable' => true,
            'is_available' => true,
            'source_updated_at' => $source->updated_at,
            'published_at' => $source->created_at,
            'facets' => [],
            'display_data' => [],
            'chunks' => [],
        ], $data);
    }

    private function chunk(string $key, string $type, string $content, array $facets = [], ?float $min = null, ?float $max = null, ?bool $inStock = null): array
    {
        return ['chunk_key' => $key, 'chunk_type' => $type, 'content' => trim($content), 'facets' => $facets, 'price_min' => $min, 'price_max' => $max, 'in_stock' => $inStock];
    }

    private function textChunks(string $text, string $type): array
    {
        $text = trim(strip_tags($text));
        if ($text === '') {
            return [];
        }
        $parts = preg_split('/\s*\n\s*|(?<=[.!?])\s+/u', $text) ?: [$text];
        $chunks = [];
        $buffer = '';
        foreach ($parts as $part) {
            if (mb_strlen($buffer.' '.$part) > 1200 && $buffer !== '') {
                $chunks[] = $this->chunk($type.':'.count($chunks), $type, $buffer);
                $buffer = '';
            }
            $buffer = trim($buffer.' '.$part);
        }
        if ($buffer !== '') {
            $chunks[] = $this->chunk($type.':'.count($chunks), $type, $buffer);
        }
        return array_slice($chunks, 0, 40);
    }

    private function text(array $values): string
    {
        $flatten = function ($value) use (&$flatten): array {
            if ($value instanceof Collection) {
                $value = $value->all();
            }
            if (is_array($value)) {
                return array_merge(...array_map($flatten, $value) ?: [[]]);
            }
            if (is_bool($value) || $value === null) {
                return [];
            }
            return [trim(strip_tags((string) $value))];
        };

        return collect($flatten($values))->filter()->unique()->join(' ');
    }

    private function merchantEligible(Merchant $merchant): bool
    {
        return (bool) ($merchant->is_active ?? true) && ! (bool) ($merchant->is_suspended ?? false);
    }

    private function effectivePrice(Product $product): float
    {
        return (float) (($product->discounted_price !== null && (float) $product->discounted_price > 0) ? $product->discounted_price : $product->price);
    }

    private function productContentType(Product $product): string
    {
        if ($product->type === 'physical') {
            return 'physical_product';
        }
        return match ((string) $product->digital_delivery_type) {
            'video_stream' => 'premium_video',
            'audio_stream' => 'premium_audio',
            'gallery_pack' => 'gallery_pack',
            'live_event' => 'live_event',
            'custom_delivery' => 'custom_delivery',
            default => $product->digital_content_type === 'software' ? 'software' : 'digital_download',
        };
    }

    private function serviceContentType(Product $product): string
    {
        return match ((string) $product->module_key) {
            'appointments' => 'appointment',
            'reservations' => 'reservation',
            'rentals' => 'rental',
            'rooms' => 'room',
            'tour_departures' => 'tour',
            'workshops' => 'workshop',
            'custom_orders' => 'custom_order',
            default => 'service',
        };
    }
}
