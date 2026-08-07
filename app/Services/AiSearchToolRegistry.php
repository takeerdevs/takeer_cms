<?php

namespace App\Services;

use App\Models\Product;
use App\Search\UnifiedSearchService;

/**
 * The server-owned tool contract for Takeer's commerce copilot.
 *
 * The model can request these read-only operations, but it can never supply
 * SQL, call an arbitrary URL, or mutate an order. Checkout remains an
 * explicit UI action after the shopper sees a product card.
 */
class AiSearchToolRegistry
{
    public function __construct(private UnifiedSearchService $unifiedSearch)
    {
    }

    public function definitions(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'search_takeer',
                    'description' => 'Search all public Takeer content, including products, services, posts, articles, merchants, digital downloads, courses, memberships, packages, and freight routes. Supports structured budget and attribute filters.',
                    'parameters' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'properties' => [
                            'query' => [
                                'type' => 'string',
                                'description' => 'Natural-language discovery request in the shopper language.',
                            ],
                            'category' => [
                                'type' => ['string', 'null'],
                                'description' => 'Optional product category or sub-category.',
                            ],
                            'color' => [
                                'type' => ['string', 'null'],
                                'description' => 'Optional color preference.',
                            ],
                            'entity_types' => [
                                'type' => ['array', 'null'],
                                'items' => ['type' => 'string', 'enum' => ['merchant', 'post', 'content_item', 'product', 'service', 'bundle', 'subscription_plan', 'offering_group', 'forwarder_route']],
                                'description' => 'Optional result entity types.',
                            ],
                            'content_types' => [
                                'type' => ['array', 'null'],
                                'items' => ['type' => 'string'],
                                'description' => 'Optional detailed types such as physical_product, digital_download, service, article, course, or subscription.',
                            ],
                            'min_price' => [
                                'type' => ['number', 'null'],
                                'description' => 'Optional minimum price in the product currency.',
                            ],
                            'max_price' => [
                                'type' => ['number', 'null'],
                                'description' => 'Optional maximum price in the product currency.',
                            ],
                            'limit' => [
                                'type' => 'integer',
                                'minimum' => 1,
                                'maximum' => 8,
                                'description' => 'Number of products to return, between 1 and 8.',
                            ],
                        ],
                        'required' => ['query'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_product_details',
                    'description' => 'Read the current public details of one Takeer product after it has been found in the catalog.',
                    'parameters' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'properties' => [
                            'product_id' => [
                                'type' => 'integer',
                                'description' => 'Takeer product ID from a previous catalog result.',
                            ],
                        ],
                        'required' => ['product_id'],
                    ],
                ],
            ],
            [
                'type' => 'function',
                'function' => [
                    'name' => 'get_product_options',
                    'description' => 'Read public variants, option names, prices, and availability for a Takeer product.',
                    'parameters' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'properties' => [
                            'product_id' => [
                                'type' => 'integer',
                                'description' => 'Takeer product ID from a previous catalog result.',
                            ],
                        ],
                        'required' => ['product_id'],
                    ],
                ],
            ],
        ];
    }

    public function execute(string $name, array $arguments): array
    {
        return match ($name) {
            'search_takeer' => $this->searchTakeer($arguments),
            'get_product_details' => $this->getProductDetails($arguments),
            'get_product_options' => $this->getProductOptions($arguments),
            default => [
                'model' => [
                    'error' => 'unknown_tool',
                    'message' => 'That commerce operation is not available.',
                ],
                'ui' => null,
            ],
        };
    }

    private function searchTakeer(array $arguments): array
    {
        $attributes = [];
        if (filled($arguments['color'] ?? null)) {
            $attributes['color'] = [(string) $arguments['color']];
        }
        $input = [
            'q' => trim((string) ($arguments['query'] ?? '').' '.(string) ($arguments['category'] ?? '')),
            'mode' => config('search.hybrid_enabled') ? 'hybrid' : 'lexical',
            'entity_types' => $arguments['entity_types'] ?? [],
            'content_types' => $arguments['content_types'] ?? [],
            'min_price' => is_numeric($arguments['min_price'] ?? null) ? (float) $arguments['min_price'] : null,
            'max_price' => is_numeric($arguments['max_price'] ?? null) ? (float) $arguments['max_price'] : null,
            'attributes' => $attributes,
            'per_page' => min(8, max(1, (int) ($arguments['limit'] ?? 6))),
        ];
        $results = $this->unifiedSearch->search($input);

        return [
            'model' => [
                'type' => 'search_results',
                'query' => $input['q'],
                'total' => $results['meta']['total'] ?? count($results['data']),
                'results' => $results['data'],
            ],
            'ui' => [
                'type' => 'search_results',
                'title' => count($results['data']) > 0 ? 'Results from Takeer' : 'No matching results found',
                'results' => $results['data'],
            ],
        ];
    }

    private function getProductDetails(array $arguments): array
    {
        $product = $this->publicProduct((int) ($arguments['product_id'] ?? 0), [
            'merchant:id,display_name,username,is_verified',
            'attributes',
            'images',
            'variants',
        ]);

        if (! $product) {
            return ['model' => ['error' => 'product_not_found', 'message' => 'The product is no longer available.'], 'ui' => null];
        }

        $payload = $this->compactProduct($product, true);

        return [
            'model' => ['type' => 'product_details', 'product' => $payload],
            'ui' => ['type' => 'product_detail', 'product' => $payload],
        ];
    }

    private function getProductOptions(array $arguments): array
    {
        $product = $this->publicProduct((int) ($arguments['product_id'] ?? 0), ['variants', 'merchant:id,display_name,username,is_verified']);
        if (! $product) {
            return ['model' => ['error' => 'product_not_found', 'message' => 'The product is no longer available.'], 'ui' => null];
        }

        $variants = $product->variants
            ->where('is_active', true)
            ->map(fn ($variant): array => [
                'id' => (int) $variant->id,
                'name' => $variant->name,
                'price' => $variant->price !== null ? (float) $variant->price : (float) $product->price,
                'attributes' => $variant->attributes ?: [],
                'available_stock' => max(0, (float) ($variant->inventory_quantity ?? $variant->inventory_count ?? 0)),
                'in_stock' => (float) ($variant->inventory_quantity ?? $variant->inventory_count ?? 0) > 0,
            ])
            ->values()
            ->all();

        return [
            'model' => [
                'type' => 'product_options',
                'product_id' => (int) $product->id,
                'has_variants' => (bool) $product->has_variants,
                'variants' => $variants,
            ],
            'ui' => [
                'type' => 'product_options',
                'product_id' => (int) $product->id,
                'variants' => $variants,
            ],
        ];
    }

    private function publicProduct(int $productId, array $with): ?Product
    {
        if ($productId < 1) {
            return null;
        }

        return Product::query()
            ->whereKey($productId)
            ->whereHas('merchant', function ($merchant): void {
                $merchant->where('is_active', true)->where('is_suspended', false);
            })
            ->with($with)
            ->first();
    }

    private function compactProduct(Product $product, bool $includeImages = false): array
    {
        $checkoutPrice = (float) ($product->discounted_price ?: $product->price);
        $payload = [
            'id' => (int) $product->id,
            'slug' => $product->slug,
            'title' => $product->title,
            'description' => $product->description,
            'type' => $product->type,
            'price' => (float) $product->price,
            'discounted_price' => (float) $product->discounted_price,
            'checkout_price' => $checkoutPrice,
            'currency_code' => 'TZS',
            'image_url' => $product->image_url,
            'url' => '/product/'.($product->slug ?: $product->id),
            'available_stock' => $product->available_stock,
            'in_stock' => $product->isInStock(),
            'has_variants' => (bool) $product->has_variants,
            'fulfillment_mode' => $product->fulfillment_mode ?: 'own_stock',
            'merchant' => $product->merchant ? [
                'id' => (int) $product->merchant->id,
                'name' => $product->merchant->display_name ?: $product->merchant->username,
                'username' => $product->merchant->username,
                'is_verified' => (bool) $product->merchant->is_verified,
            ] : null,
            'attributes' => $product->relationLoaded('attributes') && $product->attributes ? [
                'category' => $product->attributes->category,
                'sub_category' => $product->attributes->sub_category,
                'colors' => $product->attributes->colors ?: [],
                'material' => $product->attributes->material,
                'style' => $product->attributes->style,
                'detected_gender' => $product->attributes->detected_gender,
            ] : null,
            'try_on' => [
                'enabled' => (bool) $product->try_on_enabled,
            ],
        ];

        if ($includeImages) {
            $payload['images'] = $product->images->map(fn ($image): array => [
                'url' => $image->thumbnail_url ?: $image->image_url,
                'media_type' => $image->media_type ?: 'image',
            ])->values()->all();
            $payload['variants'] = $product->variants->where('is_active', true)->map(fn ($variant): array => [
                'id' => (int) $variant->id,
                'name' => $variant->name,
                'price' => $variant->price !== null ? (float) $variant->price : $checkoutPrice,
                'attributes' => $variant->attributes ?: [],
                'in_stock' => (float) ($variant->inventory_quantity ?? $variant->inventory_count ?? 0) > 0,
            ])->values()->all();
        }

        return $payload;
    }

}
