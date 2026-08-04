<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

/**
 * The server-owned tool contract for Takeer's commerce copilot.
 *
 * The model can request these read-only operations, but it can never supply
 * SQL, call an arbitrary URL, or mutate an order. Checkout remains an
 * explicit UI action after the shopper sees a product card.
 */
class AiSearchToolRegistry
{
    public function definitions(): array
    {
        return [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'search_products',
                    'description' => 'Search Takeer catalog products using the shopper request and optional price, color, or category filters. Use this for product discovery and recommendations.',
                    'parameters' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'properties' => [
                            'query' => [
                                'type' => 'string',
                                'description' => 'Natural-language product request in the shopper language.',
                            ],
                            'category' => [
                                'type' => ['string', 'null'],
                                'description' => 'Optional product category or sub-category.',
                            ],
                            'color' => [
                                'type' => ['string', 'null'],
                                'description' => 'Optional color preference.',
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
            'search_products' => $this->searchProducts($arguments),
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

    private function searchProducts(array $arguments): array
    {
        $query = trim((string) ($arguments['query'] ?? ''));
        $category = trim((string) ($arguments['category'] ?? ''));
        $color = trim((string) ($arguments['color'] ?? ''));
        $minPrice = is_numeric($arguments['min_price'] ?? null) ? max(0, (float) $arguments['min_price']) : null;
        $maxPrice = is_numeric($arguments['max_price'] ?? null) ? max(0, (float) $arguments['max_price']) : null;
        $limit = min(8, max(1, (int) ($arguments['limit'] ?? 6)));
        $driver = DB::connection()->getDriverName();
        $operator = $driver === 'pgsql' ? 'ilike' : 'like';
        $tokens = $this->tokens(trim($query.' '.$category));

        $products = Product::query()
            ->whereHas('merchant', function ($merchant): void {
                $merchant->where('is_active', true)->where('is_suspended', false);
            })
            ->where(function ($available): void {
                $available
                    ->whereIn('type', ['digital', 'service'])
                    ->orWhere('fulfillment_mode', 'supplier_sourced')
                    ->orWhere('inventory_quantity', '>', 0)
                    ->orWhere('inventory_count', '>', 0)
                    ->orWhereHas('variants', function ($variant): void {
                        $variant->where('is_active', true)
                            ->where(function ($stock): void {
                                $stock->where('inventory_quantity', '>', 0)->orWhere('inventory_count', '>', 0);
                            });
                    });
            })
            ->when($minPrice !== null, fn ($builder) => $builder->whereRaw(
                'CASE WHEN discounted_price IS NOT NULL AND discounted_price > 0 THEN discounted_price ELSE price END >= ?',
                [$minPrice]
            ))
            ->when($maxPrice !== null, fn ($builder) => $builder->whereRaw(
                'CASE WHEN discounted_price IS NOT NULL AND discounted_price > 0 THEN discounted_price ELSE price END <= ?',
                [$maxPrice]
            ))
            ->when($color !== '', function ($builder) use ($color, $driver, $operator): void {
                $builder->whereHas('attributes', function ($attributes) use ($color, $driver, $operator): void {
                    $like = '%'.$color.'%';
                    if ($driver === 'pgsql') {
                        $attributes->whereRaw('CAST(colors AS TEXT) '.$operator.' ?', [$like]);
                    } else {
                        $attributes->where('colors', $operator, $like);
                    }
                });
            })
            ->when($tokens !== [], function ($builder) use ($tokens, $driver, $operator): void {
                $builder->where(function ($terms) use ($tokens, $driver, $operator): void {
                    foreach ($tokens as $token) {
                        $like = '%'.$token.'%';
                        $terms->orWhere('title', $operator, $like)
                            ->orWhereHas('attributes', function ($attributes) use ($like, $driver, $operator): void {
                            $attributes->where('category', $operator, $like)
                                ->orWhere('sub_category', $operator, $like)
                                ->orWhere('material', $operator, $like)
                                ->orWhere('style', $operator, $like)
                                ->orWhere('detected_gender', $operator, $like)
                                ->orWhere('suggested_description', $operator, $like);
                            if ($driver === 'pgsql') {
                                $attributes->orWhereRaw('CAST(colors AS TEXT) '.$operator.' ?', [$like]);
                            } else {
                                $attributes->orWhere('colors', $operator, $like);
                            }
                            });
                    }
                });
            })
            ->with([
                'merchant:id,display_name,username,is_verified',
                'attributes',
                'images',
                'variants',
            ])
            ->orderByDesc('views_count')
            ->orderByDesc('id')
            ->limit($limit * 4)
            ->get()
            ->filter(fn (Product $product): bool => $product->isInStock())
            ->take($limit)
            ->values();

        $payload = $products->map(fn (Product $product): array => $this->compactProduct($product))->all();

        return [
            'model' => [
                'type' => 'product_results',
                'query' => $query,
                'total' => count($payload),
                'products' => $payload,
            ],
            'ui' => [
                'type' => 'product_carousel',
                'title' => count($payload) > 0 ? 'Products from Takeer' : 'No matching products found',
                'products' => $payload,
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

    private function tokens(string $value): array
    {
        $stopWords = [
            'a', 'an', 'and', 'for', 'from', 'in', 'is', 'it', 'me', 'na', 'ni', 'kwa', 'la', 'ya', 'za', 'wa',
            'the', 'to', 'with', 'want', 'nina', 'nataka', 'tafuta', 'tafutie', 'please', 'bei', 'price',
        ];

        return collect(preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($value)) ?: [])
            ->map(fn ($token) => trim((string) $token))
            ->filter(fn ($token) => mb_strlen($token) >= 2 && ! in_array($token, $stopWords, true))
            ->unique()
            ->take(8)
            ->values()
            ->all();
    }
}
