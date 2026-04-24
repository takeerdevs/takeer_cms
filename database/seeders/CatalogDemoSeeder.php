<?php

namespace Database\Seeders;

use App\Models\ProductBrand;
use App\Models\ProductBrandModel;
use App\Models\ProductCategory;
use App\Models\ProductCategoryAttribute;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class CatalogDemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedCatalog();
    }

    private function seedCatalog(): void
    {
        $brandMap = $this->seedBrands();

        $catalog = [
            [
                'name' => 'Electronics',
                'slug' => 'electronics',
                'sort_order' => 1,
                'brands' => ['apple', 'samsung', 'xiaomi', 'tecno', 'infinix', 'huawei', 'hp', 'dell', 'lenovo', 'sony', 'jbl'],
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED', 'REFURBISHED', 'BROKEN'], true, true),
                    $this->textFacet('color', 'Color', false, true),
                    $this->numberFacet('warranty_months', 'Warranty (months)', false, false),
                ],
                'children' => [
                    [
                        'name' => 'Smartphones',
                        'slug' => 'smartphones',
                        'brands' => ['apple', 'samsung', 'xiaomi', 'tecno', 'infinix', 'huawei'],
                        'brand_models' => [
                            'apple' => ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15'],
                            'samsung' => ['Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy A54', 'Galaxy Z Flip 5'],
                            'xiaomi' => ['Redmi Note 12', 'Redmi Note 13', 'Mi 11', 'Poco X5'],
                            'tecno' => ['Camon 20', 'Camon 30', 'Spark 10', 'Phantom X2'],
                            'infinix' => ['Hot 30', 'Note 30', 'Zero 30'],
                            'huawei' => ['Mate 50', 'P50', 'Nova 11'],
                        ],
                        'attributes' => [
                            $this->numberWithUnitFacet('ram', 'RAM', ['GB', 'TB'], true, true),
                            $this->numberWithUnitFacet('storage_size', 'Storage Size', ['GB', 'TB'], true, true),
                            $this->selectFacet('storage_type', 'Storage Type', ['eMMC', 'UFS', 'SSD'], false, true),
                            $this->numberFacet('battery_mah', 'Battery (mAh)', false, true),
                            $this->booleanFacet('dual_sim', 'Dual SIM', false, true),
                        ],
                    ],
                    [
                        'name' => 'Laptops',
                        'slug' => 'laptops',
                        'brands' => ['apple', 'hp', 'dell', 'lenovo'],
                        'brand_models' => [
                            'apple' => ['MacBook Air M1', 'MacBook Pro 14'],
                            'hp' => ['Pavilion 15', 'EliteBook 840', 'Victus 16'],
                            'dell' => ['Inspiron 15', 'XPS 13', 'Latitude 7420'],
                            'lenovo' => ['ThinkPad X1', 'IdeaPad 3', 'Legion 5'],
                        ],
                        'attributes' => [
                            $this->numberWithUnitFacet('ram', 'RAM', ['GB', 'TB'], true, true),
                            $this->numberWithUnitFacet('storage_size', 'Storage Size', ['GB', 'TB'], true, true),
                            $this->selectFacet('storage_type', 'Storage Type', ['HDD', 'SSD', 'NVMe'], false, true),
                            $this->numberWithUnitFacet('screen_size', 'Screen Size', ['inch'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Audio, Video & TV',
                        'slug' => 'audio-video-tv',
                        'brands' => ['sony', 'samsung', 'jbl', 'hisense'],
                        'brand_models' => [
                            'sony' => ['Bravia X80', 'WH-1000XM5', 'SRS-XB23'],
                            'samsung' => ['QLED TV Series'],
                            'jbl' => ['Charge 5', 'Flip 6', 'Tune 760NC'],
                            'hisense' => ['A6 Series', 'U7 Series'],
                        ],
                        'attributes' => [
                            $this->selectFacet('condition', 'Condition', ['NEW', 'USED', 'REFURBISHED'], true, true),
                            $this->selectFacet('connectivity', 'Connectivity', ['Bluetooth', 'WiFi', 'Wired', 'HDMI'], false, true),
                            $this->booleanFacet('remote_included', 'Remote Included', false, false),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Groceries',
                'slug' => 'groceries',
                'sort_order' => 2,
                'attributes' => [
                    $this->numberFacet('weight_kg', 'Weight (kg)', true, true),
                    $this->selectFacet('packaging', 'Packaging', ['Loose', 'Pack', 'Box', 'Bottle', 'Can'], false, true),
                    $this->textFacet('origin_country', 'Origin Country', false, true),
                    $this->textFacet('warnings', 'Warnings', false, false, true),
                ],
                'children' => [
                    [
                        'name' => 'Fruits',
                        'slug' => 'fruits',
                        'attributes' => [
                            $this->selectFacet('freshness', 'Freshness', ['FRESH', 'RIPE', 'VERY RIPE'], false, true),
                            $this->booleanFacet('organic', 'Organic', false, true),
                        ],
                    ],
                    [
                        'name' => 'Vegetables',
                        'slug' => 'vegetables',
                        'attributes' => [
                            $this->selectFacet('freshness', 'Freshness', ['FRESH', 'RIPE'], false, true),
                            $this->booleanFacet('organic', 'Organic', false, true),
                        ],
                    ],
                    [
                        'name' => 'Cooking Essentials',
                        'slug' => 'cooking-essentials',
                        'attributes' => [
                            $this->textFacet('ingredients', 'Ingredients', true, false, true),
                            $this->textFacet('allergens', 'Allergens', false, false, true),
                            $this->selectFacet('diet', 'Diet', ['Halal', 'Vegan', 'Vegetarian', 'Gluten Free'], false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Fashion',
                'slug' => 'fashion',
                'sort_order' => 3,
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED'], true, true),
                    $this->textFacet('color', 'Color', false, true),
                    $this->textFacet('material', 'Material', false, true, true),
                    $this->selectFacet('gender', 'Gender', ['Men', 'Women', 'Unisex', 'Kids'], false, true),
                ],
                'children' => [
                    [
                        'name' => 'Men Clothing',
                        'slug' => 'men-clothing',
                        'attributes' => [
                            $this->selectFacet('size', 'Size', ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], true, true, true),
                            $this->selectFacet('fit', 'Fit', ['Slim', 'Regular', 'Oversized'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Women Clothing',
                        'slug' => 'women-clothing',
                        'attributes' => [
                            $this->selectFacet('size', 'Size', ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], true, true, true),
                            $this->selectFacet('fit', 'Fit', ['Slim', 'Regular', 'Oversized'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Shoes',
                        'slug' => 'shoes',
                        'brands' => ['nike', 'adidas', 'puma', 'new-balance'],
                        'brand_models' => [
                            'nike' => ['Air Force 1', 'Air Max 90', 'Court Vision'],
                            'adidas' => ['Stan Smith', 'Ultraboost', 'Superstar'],
                            'puma' => ['Smash v2', 'RS-X'],
                            'new-balance' => ['574', '327'],
                        ],
                        'attributes' => [
                            $this->selectFacet('size', 'Size', ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'], true, true, true),
                            $this->selectFacet('shoe_type', 'Type', ['Sneakers', 'Formal', 'Boots', 'Sandals', 'Slippers'], false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Home & Kitchen',
                'slug' => 'home-kitchen',
                'sort_order' => 4,
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED'], true, true),
                    $this->textFacet('color', 'Color', false, true),
                    $this->numberFacet('weight_kg', 'Weight (kg)', false, true),
                ],
                'children' => [
                    [
                        'name' => 'Appliances',
                        'slug' => 'appliances',
                        'brands' => ['samsung', 'lg', 'hisense'],
                        'brand_models' => [
                            'samsung' => ['QLED TV Series'],
                            'lg' => ['Dual Inverter AC', 'Smart TV UQ75'],
                            'hisense' => ['A6 Series', 'U7 Series'],
                        ],
                        'attributes' => [
                            $this->numberFacet('power_watts', 'Power (Watts)', false, true),
                            $this->booleanFacet('energy_saving', 'Energy Saving', false, true),
                        ],
                    ],
                    [
                        'name' => 'Furniture',
                        'slug' => 'furniture',
                        'attributes' => [
                            $this->textFacet('material', 'Material', false, true),
                            $this->textFacet('dimensions', 'Dimensions', false, false),
                            $this->booleanFacet('assembly_required', 'Assembly Required', false, false),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Health & Beauty',
                'slug' => 'health-beauty',
                'sort_order' => 5,
                'attributes' => [
                    $this->textFacet('ingredients', 'Ingredients', false, false, true),
                    $this->textFacet('warnings', 'Warnings', false, false, true),
                    $this->selectFacet('skin_type', 'Skin Type', ['All', 'Dry', 'Oily', 'Combination', 'Sensitive'], false, true),
                    $this->textFacet('expiry_date', 'Expiry Date', false, false),
                ],
                'children' => [
                    [
                        'name' => 'Skincare',
                        'slug' => 'skincare',
                        'attributes' => [
                            $this->selectFacet('product_type', 'Product Type', ['Cleanser', 'Serum', 'Moisturizer', 'Sunscreen', 'Mask'], true, true),
                        ],
                    ],
                    [
                        'name' => 'Haircare',
                        'slug' => 'haircare',
                        'attributes' => [
                            $this->selectFacet('hair_type', 'Hair Type', ['All', 'Curly', 'Straight', 'Coily'], false, true),
                        ],
                    ],
                ],
            ],
        ];

        foreach ($catalog as $rootData) {
            $root = $this->upsertCategory($rootData, null);
            $this->syncCategoryAttributes($root, $rootData['attributes'] ?? []);
            $this->syncCategoryBrands($root, $rootData['brands'] ?? [], $brandMap);
            $this->syncCategoryBrandModels($root, $rootData['brand_models'] ?? [], $brandMap);

            foreach ($rootData['children'] ?? [] as $childData) {
                $child = $this->upsertCategory($childData, $root->id);
                $this->syncCategoryAttributes($child, $childData['attributes'] ?? []);
                $this->syncCategoryBrands($child, $childData['brands'] ?? $rootData['brands'] ?? [], $brandMap);
                $this->syncCategoryBrandModels($child, $childData['brand_models'] ?? [], $brandMap);
            }
        }
    }

    /**
     * @return array<string, ProductBrand>
     */
    private function seedBrands(): array
    {
        $definitions = [
            'apple' => ['name' => 'Apple', 'models' => ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15', 'MacBook Air M1', 'MacBook Pro 14']],
            'samsung' => ['name' => 'Samsung', 'models' => ['Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy A54', 'Galaxy Z Flip 5', 'QLED TV Series']],
            'xiaomi' => ['name' => 'Xiaomi', 'models' => ['Redmi Note 12', 'Redmi Note 13', 'Mi 11', 'Poco X5']],
            'tecno' => ['name' => 'Tecno', 'models' => ['Camon 20', 'Camon 30', 'Spark 10', 'Phantom X2']],
            'infinix' => ['name' => 'Infinix', 'models' => ['Hot 30', 'Note 30', 'Zero 30']],
            'huawei' => ['name' => 'Huawei', 'models' => ['Mate 50', 'P50', 'Nova 11']],
            'hp' => ['name' => 'HP', 'models' => ['Pavilion 15', 'EliteBook 840', 'Victus 16']],
            'dell' => ['name' => 'Dell', 'models' => ['Inspiron 15', 'XPS 13', 'Latitude 7420']],
            'lenovo' => ['name' => 'Lenovo', 'models' => ['ThinkPad X1', 'IdeaPad 3', 'Legion 5']],
            'sony' => ['name' => 'Sony', 'models' => ['Bravia X80', 'WH-1000XM5', 'SRS-XB23']],
            'jbl' => ['name' => 'JBL', 'models' => ['Charge 5', 'Flip 6', 'Tune 760NC']],
            'hisense' => ['name' => 'Hisense', 'models' => ['A6 Series', 'U7 Series']],
            'lg' => ['name' => 'LG', 'models' => ['Dual Inverter AC', 'Smart TV UQ75']],
            'nike' => ['name' => 'Nike', 'models' => ['Air Force 1', 'Air Max 90', 'Court Vision']],
            'adidas' => ['name' => 'Adidas', 'models' => ['Stan Smith', 'Ultraboost', 'Superstar']],
            'puma' => ['name' => 'Puma', 'models' => ['Smash v2', 'RS-X']],
            'new-balance' => ['name' => 'New Balance', 'models' => ['574', '327']],
        ];

        $map = [];

        foreach ($definitions as $slug => $definition) {
            $brand = ProductBrand::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $definition['name'],
                    'is_active' => true,
                ]
            );

            foreach ($definition['models'] as $modelName) {
                $modelSlug = Str::slug($modelName);
                ProductBrandModel::updateOrCreate(
                    [
                        'brand_id' => $brand->id,
                        'slug' => $modelSlug,
                    ],
                    [
                        'name' => $modelName,
                        'is_active' => true,
                    ]
                );
            }

            $map[$slug] = $brand;
        }

        return $map;
    }

    private function upsertCategory(array $data, ?int $parentId): ProductCategory
    {
        return ProductCategory::updateOrCreate(
            ['slug' => $data['slug']],
            [
                'parent_id' => $parentId,
                'name' => $data['name'],
                'image_url' => $data['image_url'] ?? null,
                'is_active' => true,
                'sort_order' => $data['sort_order'] ?? 0,
            ]
        );
    }

    private function syncCategoryBrands(ProductCategory $category, array $brandSlugs, array $brandMap): void
    {
        $brandIds = collect($brandSlugs)
            ->map(fn (string $slug) => $brandMap[$slug] ?? null)
            ->filter()
            ->map(fn (ProductBrand $brand) => $brand->id)
            ->values()
            ->all();

        $category->brands()->sync($brandIds);
    }

    private function syncCategoryBrandModels(ProductCategory $category, array $brandModelsBySlug, array $brandMap): void
    {
        $rows = [];

        foreach ($brandModelsBySlug as $brandSlug => $modelNames) {
            $brand = $brandMap[$brandSlug] ?? null;
            if (!$brand || !is_array($modelNames) || empty($modelNames)) {
                continue;
            }

            $models = ProductBrandModel::query()
                ->where('brand_id', $brand->id)
                ->whereIn('name', $modelNames)
                ->get(['id', 'brand_id']);

            foreach ($models as $model) {
                $rows[] = [
                    'category_id' => $category->id,
                    'brand_id' => $model->brand_id,
                    'model_id' => $model->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        DB::table('product_category_brand_models')->where('category_id', $category->id)->delete();
        if (!empty($rows)) {
            DB::table('product_category_brand_models')->insert($rows);
        }
    }

    private function syncCategoryAttributes(ProductCategory $category, array $attributes): void
    {
        $seenKeys = [];

        foreach ($attributes as $index => $attr) {
            $key = Str::slug($attr['key'], '_');
            $seenKeys[] = $key;

            ProductCategoryAttribute::updateOrCreate(
                [
                    'category_id' => $category->id,
                    'key' => $key,
                ],
                [
                    'label' => $attr['label'],
                    'input_type' => $attr['input_type'],
                    'ui_hint' => $attr['ui_hint'] ?? null,
                    'options' => $attr['input_type'] === 'select' ? ($attr['options'] ?? []) : null,
                    'unit_options' => $attr['input_type'] === 'number' ? ($attr['unit_options'] ?? null) : null,
                    'is_required' => (bool) ($attr['is_required'] ?? false),
                    'is_filterable' => (bool) ($attr['is_filterable'] ?? true),
                    'is_variant_axis' => (bool) ($attr['is_variant_axis'] ?? false),
                    'ai_extractable' => (bool) ($attr['ai_extractable'] ?? false),
                    'sort_order' => $attr['sort_order'] ?? ($index + 1),
                ]
            );
        }

        ProductCategoryAttribute::query()
            ->where('category_id', $category->id)
            ->whereNotIn('key', $seenKeys)
            ->delete();
    }

    private function textFacet(string $key, string $label, bool $required, bool $filterable, bool $aiExtractable = false): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'input_type' => 'text',
            'is_required' => $required,
            'is_filterable' => $filterable,
            'ai_extractable' => $aiExtractable,
        ];
    }

    private function numberFacet(string $key, string $label, bool $required, bool $filterable): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'input_type' => 'number',
            'ui_hint' => null,
            'unit_options' => null,
            'is_required' => $required,
            'is_filterable' => $filterable,
            'ai_extractable' => false,
        ];
    }

    private function booleanFacet(string $key, string $label, bool $required, bool $filterable): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'input_type' => 'boolean',
            'is_required' => $required,
            'is_filterable' => $filterable,
            'ai_extractable' => false,
        ];
    }

    private function selectFacet(string $key, string $label, array $options, bool $required, bool $filterable, bool $isVariantAxis = false): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'input_type' => 'select',
            'ui_hint' => null,
            'unit_options' => null,
            'options' => $options,
            'is_required' => $required,
            'is_filterable' => $filterable,
            'is_variant_axis' => $isVariantAxis,
            'ai_extractable' => false,
        ];
    }

    private function numberWithUnitFacet(string $key, string $label, array $unitOptions, bool $required, bool $filterable): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'input_type' => 'number',
            'ui_hint' => 'number_with_unit',
            'unit_options' => $unitOptions,
            'is_required' => $required,
            'is_filterable' => $filterable,
            'ai_extractable' => false,
        ];
    }
}
