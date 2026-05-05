<?php

namespace Database\Seeders;

use App\Models\ProductCategory;
use App\Models\ProductUnitType;
use Illuminate\Database\Seeder;

class ProductCategoryUnitSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->mapping() as $categorySlug => $unitCodes) {
            $category = ProductCategory::query()->where('slug', $categorySlug)->first();
            if (! $category) {
                continue;
            }

            $unitIds = ProductUnitType::query()
                ->whereIn('code', $unitCodes)
                ->pluck('id', 'code');

            $payload = collect($unitCodes)
                ->map(fn (string $code) => $unitIds[$code] ?? null)
                ->filter()
                ->unique()
                ->values()
                ->mapWithKeys(fn ($id, $index) => [
                    $id => [
                        'is_default' => $index === 0,
                        'min_order_quantity' => null,
                        'order_increment' => null,
                    ],
                ])
                ->all();

            if (!empty($payload)) {
                $category->unitTypes()->syncWithoutDetaching($payload);
            }
        }
    }

    private function mapping(): array
    {
        return [
            'electronics' => ['piece', 'pair', 'pack', 'box'],
            'smartphones' => ['piece', 'pack', 'box'],
            'laptops' => ['piece', 'pack', 'box'],
            'audio-video-tv' => ['piece', 'pair', 'pack', 'box'],
            'groceries' => ['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'bag', 'box', 'bottle'],
            'fruits' => ['kg', 'g', 'piece', 'pack', 'box'],
            'vegetables' => ['kg', 'g', 'piece', 'pack', 'bag'],
            'cooking-essentials' => ['kg', 'g', 'litre', 'ml', 'pack', 'bag', 'bottle'],
            'fashion' => ['piece', 'pair', 'pack', 'box'],
            'men-clothing' => ['piece', 'pack', 'box'],
            'women-clothing' => ['piece', 'pack', 'box'],
            'shoes' => ['pair', 'piece', 'box'],
            'home-kitchen' => ['piece', 'pair', 'meter', 'sqm', 'pack', 'box', 'roll'],
            'appliances' => ['piece', 'pack', 'box'],
            'furniture' => ['piece', 'set', 'meter', 'sqm', 'box'],
            'health-beauty' => ['piece', 'bottle', 'sachet', 'tube', 'pack', 'box', 'ml', 'g'],
            'skincare' => ['bottle', 'sachet', 'tube', 'pack', 'ml', 'g'],
            'haircare' => ['bottle', 'sachet', 'tube', 'pack', 'ml', 'g'],
            'phone-accessories' => ['piece', 'pair', 'pack', 'box'],
            'computer-accessories' => ['piece', 'pair', 'set', 'pack', 'box'],
            'networking-routers' => ['piece', 'set', 'pack', 'box'],
            'cctv-security-cameras' => ['piece', 'set', 'pack', 'box'],
            'drones-cameras' => ['piece', 'set', 'pack', 'box'],
            'gaming-consoles' => ['piece', 'set', 'pack', 'box'],
            'kids-clothing' => ['piece', 'set', 'pack', 'box'],
            'bags-luggage' => ['piece', 'set', 'pack', 'box'],
            'jewelry-watches' => ['piece', 'set', 'pack', 'box'],
            'fabrics-tailoring-materials' => ['meter', 'roll', 'piece', 'pack', 'box'],
            'kitchenware-cookware' => ['piece', 'set', 'pack', 'box'],
            'bedding-towels' => ['piece', 'set', 'pack', 'box'],
            'home-decor' => ['piece', 'set', 'meter', 'sqm', 'roll', 'pack', 'box'],
            'cleaning-supplies' => ['piece', 'pack', 'box', 'bottle', 'litre', 'ml', 'kg', 'g'],
            'makeup-cosmetics' => ['piece', 'bottle', 'tube', 'sachet', 'pack', 'box', 'ml', 'g'],
            'fragrances' => ['bottle', 'ml', 'piece', 'pack', 'box'],
            'beauty-tools' => ['piece', 'set', 'pack', 'box'],
            'personal-care-hygiene' => ['piece', 'pack', 'box', 'bottle', 'sachet', 'tube', 'ml', 'g'],
            'beverages' => ['bottle', 'litre', 'ml', 'pack', 'box', 'carton', 'piece'],
            'snacks-confectionery' => ['piece', 'pack', 'box', 'carton', 'g', 'kg'],
            'household-groceries' => ['kg', 'g', 'litre', 'ml', 'pack', 'bag', 'box', 'bottle'],
            'food-staples-dry-goods' => ['kg', 'g', 'tonne', 'bag', 'pack', 'box'],
            'wholesale-food-commodities' => ['kg', 'tonne', 'bag', 'pallet'],
            'automotive-motorcycle' => ['piece', 'pair', 'set', 'litre', 'ml', 'pack', 'box', 'carton'],
            'car-parts-accessories' => ['piece', 'pair', 'set', 'litre', 'ml', 'pack', 'box'],
            'motorcycle-parts' => ['piece', 'pair', 'set', 'pack', 'box'],
            'tyres-wheels-batteries' => ['piece', 'pair', 'set', 'box'],
            'vehicle-electronics' => ['piece', 'set', 'pack', 'box'],
            'tools-hardware-building' => ['piece', 'pair', 'set', 'kg', 'g', 'litre', 'meter', 'sqm', 'pack', 'bag', 'box', 'roll'],
            'power-tools' => ['piece', 'set', 'pack', 'box'],
            'hand-tools' => ['piece', 'pair', 'set', 'pack', 'box'],
            'building-materials' => ['piece', 'bag', 'kg', 'tonne', 'meter', 'sqm', 'roll', 'bundle', 'pallet'],
            'plumbing-sanitary' => ['piece', 'set', 'meter', 'pack', 'box'],
            'paints-adhesives' => ['litre', 'ml', 'kg', 'g', 'bottle', 'tube', 'pack', 'box'],
            'solar-electrical-lighting' => ['piece', 'set', 'meter', 'roll', 'pack', 'box', 'carton'],
            'solar-panels-kits' => ['piece', 'set', 'pack', 'box', 'pallet'],
            'inverters-batteries' => ['piece', 'set', 'pack', 'box'],
            'electrical-components' => ['piece', 'set', 'meter', 'roll', 'pack', 'box'],
            'lighting' => ['piece', 'set', 'pack', 'box', 'carton'],
            'baby-kids-toys' => ['piece', 'pair', 'set', 'pack', 'box'],
            'baby-gear' => ['piece', 'set', 'pack', 'box'],
            'diapers-feeding' => ['piece', 'pack', 'box', 'bottle', 'ml', 'g'],
            'toys-games' => ['piece', 'set', 'pack', 'box'],
            'office-school-stationery' => ['piece', 'set', 'pack', 'box', 'carton'],
            'stationery' => ['piece', 'set', 'pack', 'box', 'carton'],
            'office-equipment' => ['piece', 'set', 'pack', 'box'],
            'school-supplies' => ['piece', 'set', 'pack', 'box'],
            'sports-fitness-outdoor' => ['piece', 'pair', 'set', 'pack', 'box'],
            'fitness-equipment' => ['piece', 'pair', 'set', 'kg', 'pack', 'box'],
            'sports-gear' => ['piece', 'pair', 'set', 'pack', 'box'],
            'outdoor-camping' => ['piece', 'set', 'pack', 'box'],
            'agriculture-livestock' => ['piece', 'set', 'kg', 'g', 'litre', 'ml', 'bag', 'pack', 'box', 'tonne'],
            'farm-tools-equipment' => ['piece', 'set', 'pack', 'box'],
            'seeds-fertilizer-chemicals' => ['kg', 'g', 'litre', 'ml', 'bag', 'bottle', 'pack', 'box'],
            'harvested-crops-grains' => ['kg', 'g', 'tonne', 'bag', 'pallet'],
            'oilseeds-cash-crops' => ['kg', 'g', 'tonne', 'bag', 'pallet'],
            'livestock-supplies' => ['piece', 'set', 'kg', 'g', 'litre', 'ml', 'bag', 'pack', 'box'],
            'medical-lab-supplies' => ['piece', 'pair', 'pack', 'box', 'bottle', 'ml', 'g'],
            'medical-equipment' => ['piece', 'set', 'pack', 'box'],
            'ppe-disposables' => ['piece', 'pair', 'pack', 'box', 'carton'],
            'lab-supplies' => ['piece', 'set', 'pack', 'box', 'bottle', 'ml', 'g'],
            'packaging-wholesale-retail-supplies' => ['piece', 'pack', 'box', 'carton', 'roll', 'bundle', 'kg'],
            'bags-boxes-containers' => ['piece', 'pack', 'box', 'carton', 'bundle'],
            'labels-stickers-printing-supplies' => ['piece', 'roll', 'pack', 'box'],
            'retail-fixtures-displays' => ['piece', 'set', 'pack', 'box'],
            'industrial-machinery-safety' => ['piece', 'pair', 'set', 'kg', 'tonne', 'meter', 'pack', 'box', 'pallet'],
            'industrial-machinery' => ['piece', 'set', 'pack', 'box', 'pallet'],
            'safety-gear' => ['piece', 'pair', 'set', 'pack', 'box'],
            'trucks-buses-heavy-equipment' => ['piece', 'set'],
            'pets-animals' => ['piece', 'pack', 'bag', 'box', 'kg', 'g', 'litre', 'ml'],
            'pet-food-treats' => ['pack', 'bag', 'box', 'kg', 'g'],
            'pet-accessories' => ['piece', 'set', 'pack', 'box'],
        ];
    }
}
