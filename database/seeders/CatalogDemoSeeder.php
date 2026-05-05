<?php

namespace Database\Seeders;

use App\Models\ProductBrand;
use App\Models\ProductBrandModel;
use App\Models\ProductCategory;
use App\Models\ProductCategoryAttribute;
use App\Models\ProductUnitType;
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
                'unit_types' => ['piece', 'pair', 'pack', 'box'],
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
                'unit_types' => ['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'bag', 'box', 'bottle'],
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
                'unit_types' => ['piece', 'pair', 'pack', 'box'],
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
                'unit_types' => ['piece', 'pair', 'meter', 'sqm', 'pack', 'box', 'roll'],
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
                'unit_types' => ['piece', 'bottle', 'sachet', 'tube', 'pack', 'box', 'ml', 'g'],
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
                            $this->selectFacet('size', 'Size / Volume', ['30 ml', '50 ml', '100 ml', '150 ml', '200 ml', '250 ml', '500 ml', '1 litre'], false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Haircare',
                        'slug' => 'haircare',
                        'attributes' => [
                            $this->selectFacet('hair_type', 'Hair Type', ['All', 'Curly', 'Straight', 'Coily'], false, true),
                            $this->selectFacet('size', 'Size / Volume', ['50 ml', '100 ml', '150 ml', '200 ml', '250 ml', '500 ml', '1 litre'], false, true, true),
                        ],
                    ],
                ],
            ],
        ];

        $catalog = $this->mergeCatalogChildren($catalog, $this->additionalChildrenByRoot());
        $catalog = array_merge($catalog, $this->additionalRootCatalog());

        foreach ($catalog as $rootData) {
            $root = $this->upsertCategory($rootData, null);
            $this->syncCategoryAttributes($root, $rootData['attributes'] ?? []);
            $this->syncCategoryBrands($root, $rootData['brands'] ?? [], $brandMap);
            $this->syncCategoryBrandModels($root, $rootData['brand_models'] ?? [], $brandMap);
            $this->syncCategoryUnitTypes($root, $rootData['unit_types'] ?? ['piece']);

            foreach ($rootData['children'] ?? [] as $childData) {
                $child = $this->upsertCategory($childData, $root->id);
                $this->syncCategoryAttributes($child, $childData['attributes'] ?? []);
                $this->syncCategoryBrands($child, $childData['brands'] ?? $rootData['brands'] ?? [], $brandMap);
                $this->syncCategoryBrandModels($child, $childData['brand_models'] ?? [], $brandMap);
                $this->syncCategoryUnitTypes($child, $childData['unit_types'] ?? $rootData['unit_types'] ?? ['piece']);
            }
        }
    }

    private function mergeCatalogChildren(array $catalog, array $childrenByRootSlug): array
    {
        return collect($catalog)
            ->map(function (array $root) use ($childrenByRootSlug) {
                $extraChildren = $childrenByRootSlug[$root['slug']] ?? [];
                if (!empty($extraChildren)) {
                    $root['children'] = array_merge($root['children'] ?? [], $extraChildren);
                }

                return $root;
            })
            ->all();
    }

    private function additionalChildrenByRoot(): array
    {
        return [
            'electronics' => [
                [
                    'name' => 'Phone Accessories',
                    'slug' => 'phone-accessories',
                    'brands' => ['anker', 'baseus', 'ugreen', 'orico', 'xiaomi'],
                    'brand_models' => [
                        'anker' => ['PowerCore', 'Soundcore'],
                        'baseus' => ['GaN Charger', 'Power Bank'],
                        'ugreen' => ['Nexode Charger', 'HDMI Cable'],
                    ],
                    'attributes' => [
                        $this->selectFacet('accessory_type', 'Accessory Type', ['Charger', 'Cable', 'Power Bank', 'Case', 'Screen Protector', 'Earphones', 'Mount'], true, true),
                        $this->selectFacet('connector', 'Connector', ['USB-C', 'Lightning', 'Micro USB', 'USB-A', 'Wireless'], false, true),
                        $this->numberFacet('power_watts', 'Power (Watts)', false, true),
                    ],
                ],
                [
                    'name' => 'Computer Accessories',
                    'slug' => 'computer-accessories',
                    'brands' => ['anker', 'baseus', 'ugreen', 'orico', 'deli'],
                    'attributes' => [
                        $this->selectFacet('accessory_type', 'Accessory Type', ['Keyboard', 'Mouse', 'Webcam', 'Monitor Stand', 'Laptop Bag', 'USB Hub', 'Docking Station'], true, true),
                        $this->selectFacet('connectivity', 'Connectivity', ['USB', 'USB-C', 'Bluetooth', 'Wireless', 'HDMI', 'VGA'], false, true),
                    ],
                ],
                [
                    'name' => 'Networking & Routers',
                    'slug' => 'networking-routers',
                    'brands' => ['tp-link', 'tenda', 'huawei', 'xiaomi'],
                    'brand_models' => [
                        'tp-link' => ['Archer C64', 'Deco M4', 'TL-WR840N'],
                        'tenda' => ['F3 Router', 'AC10 Router', 'Nova Mesh'],
                    ],
                    'attributes' => [
                        $this->selectFacet('network_type', 'Network Type', ['Router', 'Mesh WiFi', 'Range Extender', 'Switch', 'Modem', 'Access Point'], true, true),
                        $this->selectFacet('speed_class', 'Speed Class', ['150 Mbps', '300 Mbps', 'AC1200', 'AX1800', 'Gigabit'], false, true),
                    ],
                ],
                [
                    'name' => 'CCTV & Security Cameras',
                    'slug' => 'cctv-security-cameras',
                    'brands' => ['hikvision', 'dahua', 'tp-link', 'tenda'],
                    'brand_models' => [
                        'hikvision' => ['Turbo HD Camera', 'NVR Kit', 'ColorVu Camera'],
                        'dahua' => ['HDCVI Camera', 'NVR Kit', 'TiOC Camera'],
                    ],
                    'attributes' => [
                        $this->selectFacet('camera_type', 'Camera Type', ['Dome', 'Bullet', 'PTZ', 'WiFi Camera', 'Doorbell Camera', 'NVR Kit'], true, true),
                        $this->selectFacet('resolution', 'Resolution', ['720p', '1080p', '2K', '4MP', '5MP', '4K'], false, true),
                        $this->booleanFacet('night_vision', 'Night Vision', false, true),
                    ],
                ],
                [
                    'name' => 'Drones & Cameras',
                    'slug' => 'drones-cameras',
                    'brands' => ['dji', 'sony'],
                    'brand_models' => [
                        'dji' => ['Mini 3', 'Mini 4 Pro', 'Osmo Mobile'],
                    ],
                    'attributes' => [
                        $this->selectFacet('device_type', 'Device Type', ['Drone', 'Action Camera', 'Gimbal', 'Camera', 'Tripod'], true, true),
                        $this->selectFacet('resolution', 'Resolution', ['1080p', '2.7K', '4K', '5.4K'], false, true),
                    ],
                ],
                [
                    'name' => 'Gaming & Consoles',
                    'slug' => 'gaming-consoles',
                    'brands' => ['sony', 'lenovo'],
                    'attributes' => [
                        $this->selectFacet('item_type', 'Item Type', ['Console', 'Controller', 'Game Disc', 'Gaming Chair', 'Gaming Headset', 'Arcade Machine'], true, true),
                        $this->selectFacet('condition', 'Condition', ['NEW', 'USED', 'REFURBISHED'], true, true),
                    ],
                ],
            ],
            'fashion' => [
                [
                    'name' => 'Kids Clothing',
                    'slug' => 'kids-clothing',
                    'attributes' => [
                        $this->selectFacet('age_group', 'Age Group', ['Baby', 'Toddler', 'Kids', 'Teen'], true, true),
                        $this->selectFacet('size', 'Size', ['0-3M', '3-6M', '6-12M', '1-2Y', '3-4Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y'], true, true, true),
                    ],
                ],
                [
                    'name' => 'Bags & Luggage',
                    'slug' => 'bags-luggage',
                    'attributes' => [
                        $this->selectFacet('bag_type', 'Bag Type', ['Handbag', 'Backpack', 'Travel Bag', 'Suitcase', 'School Bag', 'Wallet', 'Crossbody'], true, true),
                        $this->textFacet('material', 'Material', false, true, true),
                    ],
                ],
                [
                    'name' => 'Jewelry & Watches',
                    'slug' => 'jewelry-watches',
                    'attributes' => [
                        $this->selectFacet('item_type', 'Item Type', ['Watch', 'Necklace', 'Bracelet', 'Ring', 'Earrings', 'Set'], true, true),
                        $this->textFacet('material', 'Material', false, true, true),
                    ],
                ],
                [
                    'name' => 'Fabrics & Tailoring Materials',
                    'slug' => 'fabrics-tailoring-materials',
                    'unit_types' => ['meter', 'roll', 'piece', 'pack', 'box'],
                    'attributes' => [
                        $this->selectFacet('fabric_type', 'Fabric Type', ['Cotton', 'Polyester', 'Chiffon', 'Satin', 'Denim', 'Kitenge', 'Linen'], true, true),
                        $this->numberWithUnitFacet('width', 'Width', ['inch', 'cm', 'meter'], false, true),
                    ],
                ],
            ],
            'home-kitchen' => [
                [
                    'name' => 'Kitchenware & Cookware',
                    'slug' => 'kitchenware-cookware',
                    'brands' => ['supor', 'joyoung', 'midea'],
                    'attributes' => [
                        $this->selectFacet('item_type', 'Item Type', ['Cookware Set', 'Pot', 'Pan', 'Knife Set', 'Plate Set', 'Storage Container', 'Thermos'], true, true),
                        $this->textFacet('material', 'Material', false, true, true),
                    ],
                ],
                [
                    'name' => 'Bedding & Towels',
                    'slug' => 'bedding-towels',
                    'unit_types' => ['piece', 'set', 'pack', 'box'],
                    'attributes' => [
                        $this->selectFacet('item_type', 'Item Type', ['Bedsheet', 'Duvet', 'Blanket', 'Pillow', 'Towel', 'Mosquito Net'], true, true),
                        $this->selectFacet('bed_size', 'Bed Size', ['Single', 'Double', 'Queen', 'King'], false, true),
                    ],
                ],
                [
                    'name' => 'Home Decor',
                    'slug' => 'home-decor',
                    'attributes' => [
                        $this->selectFacet('item_type', 'Item Type', ['Curtains', 'Carpet', 'Wall Art', 'Mirror', 'Clock', 'Artificial Flowers', 'Lamp'], true, true),
                        $this->textFacet('material', 'Material', false, true),
                    ],
                ],
                [
                    'name' => 'Cleaning Supplies',
                    'slug' => 'cleaning-supplies',
                    'unit_types' => ['piece', 'pack', 'box', 'bottle', 'litre', 'ml', 'kg', 'g'],
                    'attributes' => [
                        $this->selectFacet('item_type', 'Item Type', ['Detergent', 'Disinfectant', 'Mop', 'Broom', 'Brush', 'Sponge', 'Trash Bag'], true, true),
                        $this->textFacet('scent', 'Scent', false, true),
                    ],
                ],
            ],
            'health-beauty' => [
                [
                    'name' => 'Makeup & Cosmetics',
                    'slug' => 'makeup-cosmetics',
                    'attributes' => [
                        $this->selectFacet('product_type', 'Product Type', ['Foundation', 'Powder', 'Lipstick', 'Mascara', 'Eyeshadow', 'Makeup Kit'], true, true),
                        $this->selectFacet('shade', 'Shade', ['Light', 'Medium', 'Tan', 'Deep', 'Red', 'Pink', 'Nude', 'Brown', 'Black', 'Clear', 'Mixed Set'], false, true, true),
                    ],
                ],
                [
                    'name' => 'Fragrances',
                    'slug' => 'fragrances',
                    'unit_types' => ['bottle', 'ml', 'piece', 'pack', 'box'],
                    'attributes' => [
                        $this->selectFacet('fragrance_type', 'Fragrance Type', ['Perfume', 'Body Mist', 'Oil', 'Deodorant', 'Cologne'], true, true),
                        $this->selectFacet('size', 'Bottle Size', ['3 ml', '6 ml', '10 ml', '15 ml', '30 ml', '50 ml', '100 ml', '200 ml', '500 ml'], false, true, true),
                        $this->numberWithUnitFacet('volume', 'Volume', ['ml'], false, true),
                    ],
                ],
                [
                    'name' => 'Beauty Tools',
                    'slug' => 'beauty-tools',
                    'attributes' => [
                        $this->selectFacet('tool_type', 'Tool Type', ['Hair Dryer', 'Hair Clipper', 'Straightener', 'Makeup Brush', 'Nail Lamp', 'Massager'], true, true),
                        $this->numberFacet('power_watts', 'Power (Watts)', false, true),
                    ],
                ],
                [
                    'name' => 'Personal Care & Hygiene',
                    'slug' => 'personal-care-hygiene',
                    'unit_types' => ['piece', 'pack', 'box', 'bottle', 'sachet', 'tube', 'ml', 'g'],
                    'attributes' => [
                        $this->selectFacet('product_type', 'Product Type', ['Soap', 'Toothpaste', 'Sanitary Pads', 'Tissue', 'Diapers', 'Wipes', 'Lotion'], true, true),
                        $this->selectFacet('size', 'Size / Pack', ['Small', 'Medium', 'Large', 'Single', 'Pack of 3', 'Pack of 6', 'Pack of 12', '50 ml', '100 ml', '250 ml', '500 ml', '1 litre'], false, true, true),
                        $this->textFacet('warnings', 'Warnings', false, false, true),
                    ],
                ],
            ],
            'groceries' => [
                [
                    'name' => 'Beverages',
                    'slug' => 'beverages',
                    'unit_types' => ['bottle', 'litre', 'ml', 'pack', 'box', 'carton', 'piece'],
                    'attributes' => [
                        $this->selectFacet('beverage_type', 'Beverage Type', ['Water', 'Juice', 'Soda', 'Energy Drink', 'Tea', 'Coffee', 'Milk'], true, true),
                        $this->numberWithUnitFacet('volume', 'Volume', ['ml', 'litre'], false, true),
                    ],
                ],
                [
                    'name' => 'Snacks & Confectionery',
                    'slug' => 'snacks-confectionery',
                    'unit_types' => ['piece', 'pack', 'box', 'carton', 'g', 'kg'],
                    'attributes' => [
                        $this->selectFacet('snack_type', 'Snack Type', ['Biscuits', 'Chips', 'Chocolate', 'Candy', 'Nuts', 'Popcorn'], true, true),
                        $this->textFacet('allergens', 'Allergens', false, false, true),
                    ],
                ],
                [
                    'name' => 'Household Groceries',
                    'slug' => 'household-groceries',
                    'unit_types' => ['kg', 'g', 'litre', 'ml', 'pack', 'bag', 'box', 'bottle'],
                    'attributes' => [
                        $this->selectFacet('product_type', 'Product Type', ['Rice', 'Flour', 'Sugar', 'Cooking Oil', 'Pasta', 'Canned Food', 'Spices'], true, true),
                        $this->textFacet('ingredients', 'Ingredients', false, false, true),
                    ],
                ],
                [
                    'name' => 'Food Staples & Dry Goods',
                    'slug' => 'food-staples-dry-goods',
                    'unit_types' => ['kg', 'g', 'tonne', 'bag', 'pack', 'box'],
                    'attributes' => [
                        $this->selectFacet('staple_type', 'Staple Type', ['Sugar', 'Rice', 'Maize Flour', 'Wheat Flour', 'Beans', 'Lentils', 'Pasta', 'Salt', 'Spices'], true, true),
                        $this->selectFacet('grade', 'Grade', ['Retail', 'Wholesale', 'Premium', 'Standard', 'Broken', 'Mixed'], false, true),
                        $this->selectFacet('pack_size', 'Pack Size', ['500 g', '1 kg', '2 kg', '5 kg', '10 kg', '25 kg', '50 kg', 'Loose'], false, true, true),
                        $this->numberWithUnitFacet('package_size', 'Package Size', ['g', 'kg', 'tonne'], false, true),
                    ],
                ],
                [
                    'name' => 'Wholesale Food Commodities',
                    'slug' => 'wholesale-food-commodities',
                    'unit_types' => ['kg', 'tonne', 'bag', 'pallet'],
                    'attributes' => [
                        $this->selectFacet('commodity_type', 'Commodity Type', ['Sugar', 'Rice', 'Maize', 'Wheat', 'Beans', 'Cooking Oil', 'Flour', 'Salt'], true, true),
                        $this->selectFacet('trade_pack', 'Trade Pack', ['Loose', '25 kg Bag', '50 kg Bag', '100 kg Bag', 'Tonne', 'Pallet'], false, true, true),
                        $this->textFacet('origin_country', 'Origin Country', false, true),
                    ],
                ],
            ],
        ];
    }

    private function additionalRootCatalog(): array
    {
        return [
            [
                'name' => 'Automotive & Motorcycle',
                'slug' => 'automotive-motorcycle',
                'sort_order' => 6,
                'unit_types' => ['piece', 'pair', 'set', 'litre', 'ml', 'pack', 'box', 'carton'],
                'brands' => ['byd', 'changan', 'great-wall', 'geely', 'chery', 'foton', 'sinotruk', 'shacman', 'jac', 'yutong'],
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED', 'REFURBISHED'], true, true),
                    $this->textFacet('vehicle_fitment', 'Vehicle Fitment', false, true, true),
                ],
                'children' => [
                    [
                        'name' => 'Car Parts & Accessories',
                        'slug' => 'car-parts-accessories',
                        'attributes' => [
                            $this->selectFacet('part_type', 'Part Type', ['Brake Parts', 'Filters', 'Lights', 'Mirrors', 'Suspension', 'Body Parts', 'Interior Accessory'], true, true),
                            $this->textFacet('part_number', 'Part Number', false, true),
                        ],
                    ],
                    [
                        'name' => 'Motorcycle Parts',
                        'slug' => 'motorcycle-parts',
                        'attributes' => [
                            $this->selectFacet('part_type', 'Part Type', ['Tyre', 'Chain', 'Brake Pad', 'Helmet', 'Mirror', 'Battery', 'Engine Part'], true, true),
                            $this->textFacet('bike_fitment', 'Bike Fitment', false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Tyres, Wheels & Batteries',
                        'slug' => 'tyres-wheels-batteries',
                        'unit_types' => ['piece', 'set', 'pair', 'box'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Car Tyre', 'Motorcycle Tyre', 'Wheel Rim', 'Battery', 'Tube'], true, true),
                            $this->textFacet('size', 'Size', true, true, true),
                        ],
                    ],
                    [
                        'name' => 'Vehicle Electronics',
                        'slug' => 'vehicle-electronics',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Car Stereo', 'Dash Camera', 'Reverse Camera', 'GPS Tracker', 'Alarm', 'OBD Scanner'], true, true),
                            $this->selectFacet('voltage', 'Voltage', ['12V', '24V', 'Universal'], false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Tools, Hardware & Building',
                'slug' => 'tools-hardware-building',
                'sort_order' => 7,
                'unit_types' => ['piece', 'pair', 'set', 'kg', 'g', 'litre', 'meter', 'sqm', 'pack', 'bag', 'box', 'roll'],
                'brands' => ['total-tools', 'ingco', 'dongcheng', 'deli'],
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED', 'REFURBISHED'], true, true),
                    $this->textFacet('material', 'Material', false, true, true),
                ],
                'children' => [
                    [
                        'name' => 'Power Tools',
                        'slug' => 'power-tools',
                        'brands' => ['total-tools', 'ingco', 'dongcheng'],
                        'attributes' => [
                            $this->selectFacet('tool_type', 'Tool Type', ['Drill', 'Grinder', 'Saw', 'Sander', 'Welding Machine', 'Compressor', 'Generator'], true, true),
                            $this->selectFacet('power_source', 'Power Source', ['Corded', 'Cordless', 'Petrol', 'Manual'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Hand Tools',
                        'slug' => 'hand-tools',
                        'brands' => ['total-tools', 'ingco', 'deli'],
                        'attributes' => [
                            $this->selectFacet('tool_type', 'Tool Type', ['Spanner', 'Screwdriver', 'Pliers', 'Hammer', 'Tape Measure', 'Tool Box', 'Tool Set'], true, true),
                            $this->textFacet('size', 'Size', false, true),
                        ],
                    ],
                    [
                        'name' => 'Building Materials',
                        'slug' => 'building-materials',
                        'unit_types' => ['piece', 'bag', 'kg', 'tonne', 'meter', 'sqm', 'roll', 'bundle', 'pallet'],
                        'attributes' => [
                            $this->selectFacet('material_type', 'Material Type', ['Cement', 'Tiles', 'Steel Bar', 'Roofing Sheet', 'Pipe', 'Board', 'Paint'], true, true),
                            $this->textFacet('grade', 'Grade / Spec', false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Plumbing & Sanitary',
                        'slug' => 'plumbing-sanitary',
                        'unit_types' => ['piece', 'set', 'meter', 'pack', 'box'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Pipe', 'Fitting', 'Tap', 'Sink', 'Toilet', 'Shower', 'Water Tank'], true, true),
                            $this->textFacet('size', 'Size', false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Paints & Adhesives',
                        'slug' => 'paints-adhesives',
                        'unit_types' => ['litre', 'ml', 'kg', 'g', 'bottle', 'tube', 'pack', 'box'],
                        'attributes' => [
                            $this->selectFacet('product_type', 'Product Type', ['Wall Paint', 'Spray Paint', 'Glue', 'Sealant', 'Tile Adhesive', 'Wood Finish'], true, true),
                            $this->textFacet('color', 'Color', false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Solar, Electrical & Lighting',
                'slug' => 'solar-electrical-lighting',
                'sort_order' => 8,
                'unit_types' => ['piece', 'set', 'meter', 'roll', 'pack', 'box', 'carton'],
                'brands' => ['jinko', 'longi', 'growatt', 'deye', 'felicitysolar', 'chint'],
                'attributes' => [
                    $this->selectFacet('voltage', 'Voltage', ['5V', '12V', '24V', '48V', '110V', '220V', '380V'], false, true),
                    $this->numberFacet('power_watts', 'Power (Watts)', false, true),
                ],
                'children' => [
                    [
                        'name' => 'Solar Panels & Kits',
                        'slug' => 'solar-panels-kits',
                        'brands' => ['jinko', 'longi', 'felicitysolar'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Solar Panel', 'Solar Kit', 'Charge Controller', 'Mounting Kit'], true, true),
                            $this->numberFacet('power_watts', 'Power (Watts)', true, true),
                        ],
                    ],
                    [
                        'name' => 'Inverters & Batteries',
                        'slug' => 'inverters-batteries',
                        'brands' => ['growatt', 'deye', 'felicitysolar'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Inverter', 'Hybrid Inverter', 'Lithium Battery', 'Gel Battery', 'Battery Cabinet'], true, true),
                            $this->numberWithUnitFacet('capacity', 'Capacity', ['Ah', 'kWh', 'W'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Electrical Components',
                        'slug' => 'electrical-components',
                        'brands' => ['chint', 'deli'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Breaker', 'Socket', 'Switch', 'Cable', 'Distribution Box', 'Contactor', 'Relay'], true, true),
                            $this->textFacet('rating', 'Rating', false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Lighting',
                        'slug' => 'lighting',
                        'unit_types' => ['piece', 'set', 'pack', 'box', 'carton'],
                        'attributes' => [
                            $this->selectFacet('light_type', 'Light Type', ['Bulb', 'Tube Light', 'Panel Light', 'Street Light', 'Flood Light', 'Decor Light'], true, true),
                            $this->selectFacet('color_temperature', 'Color Temperature', ['Warm White', 'Neutral White', 'Cool White', 'RGB'], false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Baby, Kids & Toys',
                'slug' => 'baby-kids-toys',
                'sort_order' => 9,
                'unit_types' => ['piece', 'pair', 'set', 'pack', 'box'],
                'attributes' => [
                    $this->selectFacet('age_group', 'Age Group', ['Newborn', '0-6M', '6-12M', '1-3Y', '3-6Y', '6-12Y', 'Teen'], false, true),
                    $this->textFacet('safety_notes', 'Safety Notes', false, false, true),
                ],
                'children' => [
                    [
                        'name' => 'Baby Gear',
                        'slug' => 'baby-gear',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Stroller', 'Car Seat', 'Baby Carrier', 'Crib', 'Walker', 'High Chair'], true, true),
                            $this->numberFacet('max_weight_kg', 'Max Weight (kg)', false, true),
                        ],
                    ],
                    [
                        'name' => 'Diapers & Feeding',
                        'slug' => 'diapers-feeding',
                        'unit_types' => ['piece', 'pack', 'box', 'bottle', 'ml', 'g'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Diapers', 'Baby Wipes', 'Bottle', 'Sterilizer', 'Baby Food', 'Bibs'], true, true),
                            $this->selectFacet('size', 'Size', ['Newborn', 'S', 'M', 'L', 'XL', 'XXL'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Toys & Games',
                        'slug' => 'toys-games',
                        'attributes' => [
                            $this->selectFacet('toy_type', 'Toy Type', ['Educational', 'Remote Control', 'Doll', 'Blocks', 'Outdoor Toy', 'Board Game', 'Ride-On'], true, true),
                            $this->booleanFacet('battery_required', 'Battery Required', false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Office, School & Stationery',
                'slug' => 'office-school-stationery',
                'sort_order' => 10,
                'unit_types' => ['piece', 'set', 'pack', 'box', 'carton'],
                'brands' => ['deli', 'hp', 'lenovo'],
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED'], true, true),
                    $this->textFacet('color', 'Color', false, true),
                ],
                'children' => [
                    [
                        'name' => 'Stationery',
                        'slug' => 'stationery',
                        'brands' => ['deli'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Notebook', 'Pen', 'Marker', 'File', 'Calculator', 'Stapler', 'Tape'], true, true),
                            $this->textFacet('paper_size', 'Paper Size', false, true),
                        ],
                    ],
                    [
                        'name' => 'Office Equipment',
                        'slug' => 'office-equipment',
                        'brands' => ['hp', 'lenovo', 'deli'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Printer', 'Scanner', 'Projector', 'Shredder', 'Laminator', 'POS Printer'], true, true),
                            $this->selectFacet('connectivity', 'Connectivity', ['USB', 'WiFi', 'Bluetooth', 'Ethernet'], false, true),
                        ],
                    ],
                    [
                        'name' => 'School Supplies',
                        'slug' => 'school-supplies',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['School Bag', 'Uniform', 'Exercise Book', 'Geometry Set', 'Lunch Box', 'Water Bottle'], true, true),
                            $this->textFacet('grade_level', 'Grade Level', false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Sports, Fitness & Outdoor',
                'slug' => 'sports-fitness-outdoor',
                'sort_order' => 11,
                'unit_types' => ['piece', 'pair', 'set', 'pack', 'box'],
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED'], true, true),
                    $this->textFacet('size', 'Size', false, true),
                ],
                'children' => [
                    [
                        'name' => 'Fitness Equipment',
                        'slug' => 'fitness-equipment',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Dumbbell', 'Treadmill', 'Exercise Bike', 'Yoga Mat', 'Resistance Band', 'Bench'], true, true),
                            $this->numberFacet('weight_kg', 'Weight (kg)', false, true),
                        ],
                    ],
                    [
                        'name' => 'Sports Gear',
                        'slug' => 'sports-gear',
                        'attributes' => [
                            $this->selectFacet('sport', 'Sport', ['Football', 'Basketball', 'Tennis', 'Boxing', 'Swimming', 'Cycling', 'Running'], true, true),
                            $this->selectFacet('item_type', 'Item Type', ['Ball', 'Shoes', 'Jersey', 'Gloves', 'Protective Gear', 'Net'], true, true),
                        ],
                    ],
                    [
                        'name' => 'Outdoor & Camping',
                        'slug' => 'outdoor-camping',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Tent', 'Sleeping Bag', 'Cooler Box', 'Flashlight', 'Camping Chair', 'Backpack'], true, true),
                            $this->booleanFacet('waterproof', 'Waterproof', false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Agriculture & Livestock',
                'slug' => 'agriculture-livestock',
                'sort_order' => 12,
                'unit_types' => ['piece', 'set', 'kg', 'g', 'litre', 'ml', 'bag', 'pack', 'box', 'tonne'],
                'attributes' => [
                    $this->textFacet('usage_instructions', 'Usage Instructions', false, false, true),
                    $this->textFacet('warnings', 'Warnings', false, false, true),
                ],
                'children' => [
                    [
                        'name' => 'Farm Tools & Equipment',
                        'slug' => 'farm-tools-equipment',
                        'brands' => ['total-tools', 'ingco'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Sprayer', 'Pump', 'Hoe', 'Irrigation Kit', 'Greenhouse Kit', 'Seeder', 'Milking Machine'], true, true),
                            $this->selectFacet('power_source', 'Power Source', ['Manual', 'Electric', 'Petrol', 'Solar'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Seeds, Fertilizer & Chemicals',
                        'slug' => 'seeds-fertilizer-chemicals',
                        'unit_types' => ['kg', 'g', 'litre', 'ml', 'bag', 'bottle', 'pack', 'box'],
                        'attributes' => [
                            $this->selectFacet('product_type', 'Product Type', ['Seeds', 'Fertilizer', 'Pesticide', 'Herbicide', 'Fungicide', 'Animal Feed'], true, true),
                            $this->textFacet('crop_or_animal', 'Crop / Animal', false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Harvested Crops & Grains',
                        'slug' => 'harvested-crops-grains',
                        'unit_types' => ['kg', 'g', 'tonne', 'bag', 'pallet'],
                        'attributes' => [
                            $this->selectFacet('crop_type', 'Crop Type', ['Maize', 'Rice Paddy', 'Beans', 'Wheat', 'Sorghum', 'Millet', 'Cassava', 'Sweet Potato', 'Groundnuts'], true, true),
                            $this->selectFacet('processing_state', 'Processing State', ['Fresh', 'Dried', 'Shelled', 'Milled', 'Cleaned', 'Unprocessed'], true, true),
                            $this->numberFacet('moisture_percent', 'Moisture (%)', false, true),
                            $this->textFacet('harvest_location', 'Harvest Location', false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Oilseeds & Cash Crops',
                        'slug' => 'oilseeds-cash-crops',
                        'unit_types' => ['kg', 'g', 'tonne', 'bag', 'pallet'],
                        'attributes' => [
                            $this->selectFacet('crop_type', 'Crop Type', ['Sunflower', 'Sesame', 'Soybean', 'Cotton Seed', 'Cashew', 'Coffee', 'Cocoa', 'Tobacco'], true, true),
                            $this->selectFacet('processing_state', 'Processing State', ['Raw', 'Dried', 'Cleaned', 'Hulled', 'Roasted', 'Graded'], true, true),
                            $this->selectFacet('grade', 'Grade', ['Grade A', 'Grade B', 'Standard', 'Mixed', 'Export Quality'], false, true),
                            $this->textFacet('harvest_location', 'Harvest Location', false, true, true),
                        ],
                    ],
                    [
                        'name' => 'Livestock Supplies',
                        'slug' => 'livestock-supplies',
                        'attributes' => [
                            $this->selectFacet('animal_type', 'Animal Type', ['Poultry', 'Cattle', 'Goats', 'Pigs', 'Fish', 'Pets'], true, true),
                            $this->selectFacet('item_type', 'Item Type', ['Feed', 'Drinker', 'Feeder', 'Cage', 'Medicine', 'Incubator'], true, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Medical & Lab Supplies',
                'slug' => 'medical-lab-supplies',
                'sort_order' => 13,
                'unit_types' => ['piece', 'pair', 'pack', 'box', 'bottle', 'ml', 'g'],
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED', 'REFURBISHED'], true, true),
                    $this->textFacet('certification', 'Certification', false, true, true),
                    $this->textFacet('warnings', 'Warnings', false, false, true),
                ],
                'children' => [
                    [
                        'name' => 'Medical Equipment',
                        'slug' => 'medical-equipment',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['BP Monitor', 'Thermometer', 'Nebulizer', 'Oxygen Concentrator', 'Wheelchair', 'Hospital Bed'], true, true),
                            $this->booleanFacet('requires_professional_use', 'Requires Professional Use', false, true),
                        ],
                    ],
                    [
                        'name' => 'PPE & Disposables',
                        'slug' => 'ppe-disposables',
                        'unit_types' => ['piece', 'pair', 'pack', 'box', 'carton'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Gloves', 'Mask', 'Gown', 'Syringe', 'Test Strip', 'Cotton', 'Bandage'], true, true),
                            $this->booleanFacet('sterile', 'Sterile', false, true),
                        ],
                    ],
                    [
                        'name' => 'Lab Supplies',
                        'slug' => 'lab-supplies',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Microscope', 'Test Tube', 'Beaker', 'Reagent', 'Centrifuge', 'Scale'], true, true),
                            $this->textFacet('specification', 'Specification', false, true, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Packaging, Wholesale & Retail Supplies',
                'slug' => 'packaging-wholesale-retail-supplies',
                'sort_order' => 14,
                'unit_types' => ['piece', 'pack', 'box', 'carton', 'roll', 'bundle', 'kg'],
                'attributes' => [
                    $this->textFacet('material', 'Material', false, true, true),
                    $this->textFacet('dimensions', 'Dimensions', false, true, true),
                ],
                'children' => [
                    [
                        'name' => 'Bags, Boxes & Containers',
                        'slug' => 'bags-boxes-containers',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Shopping Bag', 'Courier Bag', 'Carton Box', 'Food Container', 'Bottle', 'Jar'], true, true),
                            $this->selectFacet('material', 'Material', ['Paper', 'Plastic', 'Glass', 'Aluminium', 'Cardboard', 'Biodegradable'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Labels, Stickers & Printing Supplies',
                        'slug' => 'labels-stickers-printing-supplies',
                        'unit_types' => ['piece', 'roll', 'pack', 'box'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Sticker Roll', 'Label', 'Thermal Paper', 'Receipt Roll', 'Ink', 'Ribbon'], true, true),
                            $this->textFacet('size', 'Size', false, true),
                        ],
                    ],
                    [
                        'name' => 'Retail Fixtures & Displays',
                        'slug' => 'retail-fixtures-displays',
                        'unit_types' => ['piece', 'set', 'pack', 'box'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Shelf', 'Mannequin', 'Display Stand', 'Hanger', 'Price Tag', 'POS Stand'], true, true),
                            $this->textFacet('material', 'Material', false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Industrial, Machinery & Safety',
                'slug' => 'industrial-machinery-safety',
                'sort_order' => 15,
                'unit_types' => ['piece', 'pair', 'set', 'kg', 'tonne', 'meter', 'pack', 'box', 'pallet'],
                'brands' => ['sinotruk', 'shacman', 'foton', 'jac', 'yutong', 'total-tools', 'ingco'],
                'attributes' => [
                    $this->selectFacet('condition', 'Condition', ['NEW', 'USED', 'REFURBISHED'], true, true),
                    $this->textFacet('specification', 'Specification', false, true, true),
                ],
                'children' => [
                    [
                        'name' => 'Industrial Machinery',
                        'slug' => 'industrial-machinery',
                        'attributes' => [
                            $this->selectFacet('machine_type', 'Machine Type', ['Compressor', 'Mixer', 'Packaging Machine', 'Water Pump', 'Generator', 'CNC', 'Sewing Machine'], true, true),
                            $this->selectFacet('power_source', 'Power Source', ['Electric', 'Diesel', 'Petrol', 'Manual'], false, true),
                        ],
                    ],
                    [
                        'name' => 'Safety Gear',
                        'slug' => 'safety-gear',
                        'unit_types' => ['piece', 'pair', 'set', 'pack', 'box'],
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Helmet', 'Boots', 'Gloves', 'Reflective Vest', 'Harness', 'Goggles', 'Respirator'], true, true),
                            $this->textFacet('standard', 'Standard', false, true),
                        ],
                    ],
                    [
                        'name' => 'Trucks, Buses & Heavy Equipment',
                        'slug' => 'trucks-buses-heavy-equipment',
                        'brands' => ['sinotruk', 'shacman', 'foton', 'jac', 'yutong'],
                        'brand_models' => [
                            'sinotruk' => ['HOWO', 'Sitrak', 'Hohan'],
                            'shacman' => ['F3000', 'X3000', 'L3000'],
                            'foton' => ['Tunland', 'Aumark', 'View'],
                            'jac' => ['T8', 'N-Series Truck', 'Sunray'],
                            'yutong' => ['City Bus', 'Coach Bus', 'School Bus'],
                        ],
                        'attributes' => [
                            $this->selectFacet('vehicle_type', 'Vehicle Type', ['Truck', 'Bus', 'Trailer', 'Forklift', 'Loader', 'Excavator'], true, true),
                            $this->numberFacet('model_year', 'Model Year', false, true),
                        ],
                    ],
                ],
            ],
            [
                'name' => 'Pets & Animals',
                'slug' => 'pets-animals',
                'sort_order' => 16,
                'unit_types' => ['piece', 'pack', 'bag', 'box', 'kg', 'g', 'litre', 'ml'],
                'attributes' => [
                    $this->selectFacet('animal_type', 'Animal Type', ['Dog', 'Cat', 'Bird', 'Fish', 'Rabbit', 'Other'], true, true),
                    $this->textFacet('warnings', 'Warnings', false, false, true),
                ],
                'children' => [
                    [
                        'name' => 'Pet Food & Treats',
                        'slug' => 'pet-food-treats',
                        'attributes' => [
                            $this->selectFacet('food_type', 'Food Type', ['Dry Food', 'Wet Food', 'Treats', 'Milk', 'Supplement'], true, true),
                            $this->textFacet('ingredients', 'Ingredients', false, false, true),
                        ],
                    ],
                    [
                        'name' => 'Pet Accessories',
                        'slug' => 'pet-accessories',
                        'attributes' => [
                            $this->selectFacet('item_type', 'Item Type', ['Collar', 'Leash', 'Cage', 'Bed', 'Bowl', 'Toy', 'Grooming Tool'], true, true),
                            $this->textFacet('size', 'Size', false, true),
                        ],
                    ],
                ],
            ],
        ];
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
            'oppo' => ['name' => 'OPPO', 'models' => ['A58', 'A78', 'Reno 10', 'Reno 11']],
            'vivo' => ['name' => 'Vivo', 'models' => ['Y17s', 'Y27', 'V29', 'V30']],
            'realme' => ['name' => 'Realme', 'models' => ['C55', 'C67', 'Narzo 60']],
            'honor' => ['name' => 'Honor', 'models' => ['X7b', 'X8b', 'Magic 5 Lite']],
            'itel' => ['name' => 'Itel', 'models' => ['A70', 'S23', 'P55']],
            'anker' => ['name' => 'Anker', 'models' => ['PowerCore', 'Soundcore', 'Nebula']],
            'baseus' => ['name' => 'Baseus', 'models' => ['Bowie', 'GaN Charger', 'Power Bank']],
            'ugreen' => ['name' => 'UGREEN', 'models' => ['USB-C Hub', 'Nexode Charger', 'HDMI Cable']],
            'orico' => ['name' => 'ORICO', 'models' => ['SSD Enclosure', 'USB Hub', 'Docking Station']],
            'tp-link' => ['name' => 'TP-Link', 'models' => ['Archer C64', 'Deco M4', 'TL-WR840N']],
            'tenda' => ['name' => 'Tenda', 'models' => ['F3 Router', 'AC10 Router', 'Nova Mesh']],
            'hikvision' => ['name' => 'Hikvision', 'models' => ['Turbo HD Camera', 'NVR Kit', 'ColorVu Camera']],
            'dahua' => ['name' => 'Dahua', 'models' => ['HDCVI Camera', 'NVR Kit', 'TiOC Camera']],
            'dji' => ['name' => 'DJI', 'models' => ['Mini 3', 'Mini 4 Pro', 'Osmo Mobile']],
            'tcl' => ['name' => 'TCL', 'models' => ['P635 TV', 'C645 TV', 'Split AC']],
            'haier' => ['name' => 'Haier', 'models' => ['Double Door Fridge', 'Top Load Washer', 'Chest Freezer']],
            'midea' => ['name' => 'Midea', 'models' => ['Split AC', 'Microwave', 'Water Dispenser']],
            'gree' => ['name' => 'Gree', 'models' => ['Inverter AC', 'Portable AC', 'Air Cooler']],
            'skyworth' => ['name' => 'Skyworth', 'models' => ['Android TV', 'LED TV', 'Soundbar']],
            'changhong' => ['name' => 'Changhong', 'models' => ['LED TV', 'Chest Freezer', 'Refrigerator']],
            'supor' => ['name' => 'SUPOR', 'models' => ['Rice Cooker', 'Pressure Cooker', 'Cookware Set']],
            'joyoung' => ['name' => 'Joyoung', 'models' => ['Blender', 'Soy Milk Maker', 'Air Fryer']],
            'total-tools' => ['name' => 'TOTAL Tools', 'models' => ['Cordless Drill', 'Angle Grinder', 'Tool Set']],
            'ingco' => ['name' => 'INGCO', 'models' => ['Impact Drill', 'Angle Grinder', 'Hand Tool Set']],
            'dongcheng' => ['name' => 'Dongcheng', 'models' => ['Rotary Hammer', 'Cutting Machine', 'Drill']],
            'deli' => ['name' => 'Deli', 'models' => ['Office Stationery', 'Tool Set', 'Calculator']],
            'chint' => ['name' => 'CHINT', 'models' => ['Circuit Breaker', 'Contactor', 'Distribution Box']],
            'jinko' => ['name' => 'Jinko Solar', 'models' => ['Tiger Neo Panel', 'Mono Solar Panel']],
            'longi' => ['name' => 'LONGi', 'models' => ['Hi-MO Panel', 'Mono Solar Panel']],
            'growatt' => ['name' => 'Growatt', 'models' => ['SPF Inverter', 'Hybrid Inverter']],
            'deye' => ['name' => 'Deye', 'models' => ['Hybrid Inverter', 'String Inverter']],
            'felicitysolar' => ['name' => 'Felicity Solar', 'models' => ['Lithium Battery', 'Solar Inverter']],
            'byd' => ['name' => 'BYD', 'models' => ['Atto 3', 'Dolphin', 'Seal']],
            'changan' => ['name' => 'Changan', 'models' => ['Alsvin', 'CS35 Plus', 'Hunter']],
            'great-wall' => ['name' => 'Great Wall / Haval', 'models' => ['H6', 'Jolion', 'Wingle']],
            'geely' => ['name' => 'Geely', 'models' => ['Coolray', 'Emgrand', 'Okavango']],
            'chery' => ['name' => 'Chery', 'models' => ['Tiggo 4 Pro', 'Tiggo 7 Pro', 'Arrizo 5']],
            'foton' => ['name' => 'Foton', 'models' => ['Tunland', 'Aumark', 'View']],
            'sinotruk' => ['name' => 'Sinotruk', 'models' => ['HOWO', 'Sitrak', 'Hohan']],
            'shacman' => ['name' => 'Shacman', 'models' => ['F3000', 'X3000', 'L3000']],
            'jac' => ['name' => 'JAC', 'models' => ['T8', 'N-Series Truck', 'Sunray']],
            'yutong' => ['name' => 'Yutong', 'models' => ['City Bus', 'Coach Bus', 'School Bus']],
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
        $policy = $this->categoryFulfillmentPolicy($data['slug']);

        return ProductCategory::updateOrCreate(
            ['slug' => $data['slug']],
            [
                'parent_id' => $parentId,
                'name' => $data['name'],
                'localized_labels' => $data['localized_labels'] ?? $this->localizedCategoryLabels($data['slug'], $data['name']),
                'image_url' => $data['image_url'] ?? null,
                'risk_level' => $data['risk_level'] ?? $policy['risk_level'],
                'allowed_fulfillment_modes' => $data['allowed_fulfillment_modes'] ?? $policy['allowed_fulfillment_modes'],
                'requires_verified_business' => (bool) ($data['requires_verified_business'] ?? $policy['requires_verified_business']),
                'requires_manual_review' => (bool) ($data['requires_manual_review'] ?? $policy['requires_manual_review']),
                'required_documents' => $data['required_documents'] ?? $policy['required_documents'],
                'payout_hold_days' => $data['payout_hold_days'] ?? $policy['payout_hold_days'],
                'is_active' => true,
                'sort_order' => $data['sort_order'] ?? 0,
            ]
        );
    }

    private function categoryFulfillmentPolicy(string $slug): array
    {
        $allModes = ['own_stock', 'supplier_sourced', 'made_to_order', 'farm_harvest', 'preorder', 'group_sale'];
        $policy = [
            'risk_level' => 'standard',
            'allowed_fulfillment_modes' => $allModes,
            'requires_verified_business' => false,
            'requires_manual_review' => false,
            'required_documents' => ['identity'],
            'payout_hold_days' => 3,
        ];

        $lowRiskFoodFarm = [
            'food-staples-dry-goods',
            'fresh-produce',
            'wholesale-food-commodities',
            'harvested-crops-grains',
            'oilseeds-cash-crops',
            'agriculture-inputs',
            'farm-tools-equipment',
        ];
        if (in_array($slug, $lowRiskFoodFarm, true)) {
            return [
                ...$policy,
                'risk_level' => 'low',
                'allowed_fulfillment_modes' => ['own_stock', 'supplier_sourced', 'farm_harvest', 'preorder', 'group_sale'],
                'payout_hold_days' => 2,
            ];
        }

        $reviewedReseller = [
            'skincare',
            'haircare',
            'makeup-cosmetics',
            'fragrances',
            'personal-care-hygiene',
            'baby-products',
            'electronics',
            'smartphones',
            'laptops',
            'drones-cameras',
            'automotive',
            'vehicle-spare-parts',
        ];
        if (in_array($slug, $reviewedReseller, true)) {
            return [
                ...$policy,
                'risk_level' => 'elevated',
                'requires_manual_review' => true,
                'payout_hold_days' => 7,
            ];
        }

        $businessOnly = [
            'medical-lab',
            'medical-devices',
            'supplements-wellness',
            'chemicals-lubricants',
            'industrial-machinery',
        ];
        if (in_array($slug, $businessOnly, true)) {
            return [
                ...$policy,
                'risk_level' => 'high',
                'allowed_fulfillment_modes' => ['own_stock', 'supplier_sourced', 'preorder'],
                'requires_verified_business' => true,
                'requires_manual_review' => true,
                'required_documents' => ['identity', 'business_registration'],
                'payout_hold_days' => 14,
            ];
        }

        return $policy;
    }

    private function localizedCategoryLabels(string $slug, string $englishName): array
    {
        $swahili = [
            'electronics' => 'Elektroniki',
            'smartphones' => 'Simu janja',
            'laptops' => 'Laptop',
            'audio-video-tv' => 'Vifaa vya sauti, video na TV',
            'phone-accessories' => 'Vifaa vya simu',
            'computer-accessories' => 'Vifaa vya kompyuta',
            'networking-routers' => 'Router na vifaa vya intaneti',
            'cctv-security-cameras' => 'CCTV na kamera za ulinzi',
            'drones-cameras' => 'Drone na kamera',
            'gaming-consoles' => 'Michezo na konsole',
            'groceries' => 'Vyakula na mahitaji ya duka',
            'fruits' => 'Matunda',
            'vegetables' => 'Mboga mboga',
            'cooking-essentials' => 'Mahitaji ya kupikia',
            'beverages' => 'Vinywaji',
            'snacks-confectionery' => 'Biskuti, pipi na snacks',
            'household-groceries' => 'Mahitaji ya nyumbani',
            'food-staples-dry-goods' => 'Sukari, mchele na vyakula vikavu',
            'wholesale-food-commodities' => 'Vyakula vya jumla na magunia',
            'fashion' => 'Nguo na mitindo',
            'men-clothing' => 'Nguo za wanaume',
            'women-clothing' => 'Nguo za wanawake',
            'kids-clothing' => 'Nguo za watoto',
            'shoes' => 'Viatu',
            'bags-luggage' => 'Mabegi na masanduku',
            'jewelry-watches' => 'Vito na saa',
            'fabrics-tailoring-materials' => 'Vitambaa na vifaa vya ushonaji',
            'home-kitchen' => 'Nyumbani na jikoni',
            'appliances' => 'Vifaa vya umeme vya nyumbani',
            'furniture' => 'Samani',
            'kitchenware-cookware' => 'Vyombo vya jikoni',
            'bedding-towels' => 'Mashuka, blanketi na taulo',
            'home-decor' => 'Mapambo ya nyumba',
            'cleaning-supplies' => 'Sabuni na vifaa vya usafi',
            'health-beauty' => 'Afya na urembo',
            'skincare' => 'Huduma ya ngozi',
            'haircare' => 'Huduma ya nywele',
            'makeup-cosmetics' => 'Makeup na vipodozi',
            'fragrances' => 'Manukato',
            'beauty-tools' => 'Vifaa vya saluni na urembo',
            'personal-care-hygiene' => 'Usafi binafsi',
            'automotive-motorcycle' => 'Magari na pikipiki',
            'car-parts-accessories' => 'Spea na vifaa vya gari',
            'motorcycle-parts' => 'Spea za pikipiki',
            'tyres-wheels-batteries' => 'Matairi, rims na betri',
            'vehicle-electronics' => 'Elektroniki za gari',
            'tools-hardware-building' => 'Zana, hardware na ujenzi',
            'power-tools' => 'Zana za umeme',
            'hand-tools' => 'Zana za mkono',
            'building-materials' => 'Vifaa vya ujenzi',
            'plumbing-sanitary' => 'Mabomba na vifaa vya chooni/bafuni',
            'paints-adhesives' => 'Rangi na gundi',
            'solar-electrical-lighting' => 'Solar, umeme na taa',
            'solar-panels-kits' => 'Paneli na vifaa vya solar',
            'inverters-batteries' => 'Inverter na betri',
            'electrical-components' => 'Vifaa vya umeme',
            'lighting' => 'Taa',
            'baby-kids-toys' => 'Watoto na midoli',
            'baby-gear' => 'Vifaa vya mtoto',
            'diapers-feeding' => 'Nepi na vifaa vya kulishia',
            'toys-games' => 'Midoli na michezo',
            'office-school-stationery' => 'Ofisi, shule na stationery',
            'stationery' => 'Stationery',
            'office-equipment' => 'Vifaa vya ofisi',
            'school-supplies' => 'Vifaa vya shule',
            'sports-fitness-outdoor' => 'Michezo, mazoezi na outdoor',
            'fitness-equipment' => 'Vifaa vya mazoezi',
            'sports-gear' => 'Vifaa vya michezo',
            'outdoor-camping' => 'Camping na outdoor',
            'agriculture-livestock' => 'Kilimo na mifugo',
            'farm-tools-equipment' => 'Zana na vifaa vya shamba',
            'seeds-fertilizer-chemicals' => 'Mbegu, mbolea na dawa za kilimo',
            'harvested-crops-grains' => 'Mazao ya shamba na nafaka',
            'oilseeds-cash-crops' => 'Alizeti, ufuta na mazao ya biashara',
            'livestock-supplies' => 'Vifaa vya mifugo',
            'medical-lab-supplies' => 'Vifaa vya afya na maabara',
            'medical-equipment' => 'Vifaa vya hospitali',
            'ppe-disposables' => 'Gloves, mask na vifaa vya matumizi moja',
            'lab-supplies' => 'Vifaa vya maabara',
            'packaging-wholesale-retail-supplies' => 'Vifungashio na vifaa vya duka',
            'bags-boxes-containers' => 'Mifuko, maboksi na kontena',
            'labels-stickers-printing-supplies' => 'Label, sticker na vifaa vya print',
            'retail-fixtures-displays' => 'Rafu na display za duka',
            'industrial-machinery-safety' => 'Mashine za viwandani na usalama',
            'industrial-machinery' => 'Mashine za viwandani',
            'safety-gear' => 'Vifaa vya usalama kazini',
            'trucks-buses-heavy-equipment' => 'Malori, mabasi na mitambo mizito',
            'pets-animals' => 'Pets na wanyama',
            'pet-food-treats' => 'Chakula cha pets',
            'pet-accessories' => 'Vifaa vya pets',
        ][$slug] ?? $englishName;

        return [
            'en' => $englishName,
            'sw' => $swahili,
        ];
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

    private function syncCategoryUnitTypes(ProductCategory $category, array $unitCodes): void
    {
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
            $category->unitTypes()->sync($payload);
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
