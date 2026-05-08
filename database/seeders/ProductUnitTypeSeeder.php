<?php

namespace Database\Seeders;

use App\Models\ProductUnitType;
use Illuminate\Database\Seeder;

class ProductUnitTypeSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->units() as $index => $unit) {
            ProductUnitType::updateOrCreate(
                ['code' => $unit['code']],
                [
                    ...$unit,
                    'sort_order' => $unit['sort_order'] ?? $index,
                    'is_active' => $unit['is_active'] ?? true,
                ]
            );
        }
    }

    private function units(): array
    {
        return [
            $this->unit('Piece', 'piece', 'pc', 'count', null, 1, false, [
                ['label' => '1 piece', 'quantity' => 1, 'aliases' => ['moja', 'kipande kimoja']],
                ['label' => '2 pieces', 'quantity' => 2, 'aliases' => ['mbili']],
                ['label' => '5 pieces', 'quantity' => 5],
            ]),
            $this->unit('Unit', 'unit', 'unit', 'count', null, 1, false, [
                ['label' => '1 unit', 'quantity' => 1],
            ]),
            $this->unit('Pair', 'pair', 'pair', 'count', 'piece', 2, false, [
                ['label' => '1 pair', 'quantity' => 1, 'aliases' => ['jozi moja']],
            ]),
            $this->unit('Dozen', 'dozen', 'doz', 'count', 'piece', 12, false, [
                ['label' => '1 dozen', 'quantity' => 1, 'aliases' => ['dazeni moja']],
            ]),
            $this->unit('Set', 'set', 'set', 'count', 'piece', 1, false, [
                ['label' => '1 set', 'quantity' => 1],
            ]),
            $this->unit('Tray', 'tray', 'tray', 'count', 'piece', 30, false, [
                ['label' => '1 tray', 'quantity' => 1, 'aliases' => ['trei moja']],
            ]),
            $this->unit('Kilogram', 'kg', 'kg', 'weight', 'g', 1000, true, [
                ['label' => 'Robo kilo', 'quantity' => 0.25, 'aliases' => ['robo', 'quarter kilo']],
                ['label' => 'Nusu kilo', 'quantity' => 0.5, 'aliases' => ['nusu', 'half kilo']],
                ['label' => 'Robo tatu', 'quantity' => 0.75, 'aliases' => ['three quarters']],
                ['label' => '1 kg', 'quantity' => 1, 'aliases' => ['kilo moja']],
                ['label' => '2.25 kg', 'quantity' => 2.25, 'aliases' => ['kilo mbili na robo']],
            ]),
            $this->unit('Gram', 'g', 'g', 'weight', 'g', 1, true, [
                ['label' => '100 g', 'quantity' => 100],
                ['label' => '250 g', 'quantity' => 250],
                ['label' => '500 g', 'quantity' => 500],
            ]),
            $this->unit('Tonne', 'tonne', 't', 'weight', 'g', 1000000, true, [
                ['label' => '1 tonne', 'quantity' => 1],
            ]),
            $this->unit('Litre', 'litre', 'L', 'volume', 'ml', 1000, true, [
                ['label' => 'Nusu lita', 'quantity' => 0.5, 'aliases' => ['half litre']],
                ['label' => '1 litre', 'quantity' => 1, 'aliases' => ['lita moja']],
                ['label' => '2 litres', 'quantity' => 2, 'aliases' => ['lita mbili']],
            ]),
            $this->unit('Millilitre', 'ml', 'ml', 'volume', 'ml', 1, true, [
                ['label' => '250 ml', 'quantity' => 250],
                ['label' => '500 ml', 'quantity' => 500],
            ]),
            $this->unit('Meter', 'meter', 'm', 'length', 'cm', 100, true, [
                ['label' => '0.5 m', 'quantity' => 0.5],
                ['label' => '1 m', 'quantity' => 1],
                ['label' => '2 m', 'quantity' => 2],
            ]),
            $this->unit('Centimeter', 'cm', 'cm', 'length', 'cm', 1, true, [
                ['label' => '10 cm', 'quantity' => 10],
                ['label' => '50 cm', 'quantity' => 50],
            ]),
            $this->unit('Square Meter', 'sqm', 'm2', 'area', 'sqcm', 10000, true, [
                ['label' => '1 m2', 'quantity' => 1],
            ]),
            $this->unit('Pack', 'pack', 'pack', 'package', null, 1, false, [
                ['label' => '1 pack', 'quantity' => 1],
            ]),
            $this->unit('Box', 'box', 'box', 'package', null, 1, false, [
                ['label' => '1 box', 'quantity' => 1],
            ]),
            $this->unit('Carton', 'carton', 'carton', 'package', null, 1, false, [
                ['label' => '1 carton', 'quantity' => 1],
            ]),
            $this->unit('Crate', 'crate', 'crate', 'package', null, 1, false, [
                ['label' => '1 crate', 'quantity' => 1],
            ]),
            $this->unit('Bag', 'bag', 'bag', 'package', null, 1, false, [
                ['label' => '1 bag', 'quantity' => 1],
            ]),
            $this->unit('Bottle', 'bottle', 'bottle', 'package', null, 1, false, [
                ['label' => '1 bottle', 'quantity' => 1],
            ]),
            $this->unit('Sachet', 'sachet', 'sachet', 'package', null, 1, false, [
                ['label' => '1 sachet', 'quantity' => 1],
            ]),
            $this->unit('Tube', 'tube', 'tube', 'package', null, 1, false, [
                ['label' => '1 tube', 'quantity' => 1],
            ]),
            $this->unit('Roll', 'roll', 'roll', 'package', null, 1, false, [
                ['label' => '1 roll', 'quantity' => 1],
            ]),
            $this->unit('Bundle', 'bundle', 'bundle', 'package', null, 1, false, [
                ['label' => '1 bundle', 'quantity' => 1],
            ]),
            $this->unit('Pallet', 'pallet', 'pallet', 'package', null, 1, false, [
                ['label' => '1 pallet', 'quantity' => 1],
            ]),
        ];
    }

    private function unit(
        string $name,
        string $code,
        string $symbol,
        string $category,
        ?string $baseUnitCode,
        float $conversionFactor,
        bool $allowsDecimal,
        array $commonQuantities
    ): array {
        return [
            'name' => $name,
            'code' => $code,
            'symbol' => $symbol,
            'unit_category' => $category,
            'base_unit_code' => $baseUnitCode,
            'conversion_factor_to_base' => $conversionFactor,
            'allows_decimal' => $allowsDecimal,
            'localized_labels' => [
                'sw' => $this->swahiliLabel($code),
                'en' => $name,
                'zh' => $name,
            ],
            'common_quantities' => $commonQuantities,
        ];
    }

    private function swahiliLabel(string $code): string
    {
        return [
            'piece' => 'kipande',
            'unit' => 'unit',
            'pair' => 'jozi',
            'dozen' => 'dazeni',
            'tray' => 'trei',
            'kg' => 'kilo',
            'g' => 'gramu',
            'litre' => 'lita',
            'ml' => 'mililita',
            'meter' => 'mita',
            'cm' => 'sentimita',
            'pack' => 'pakiti',
            'box' => 'boksi',
            'carton' => 'katoni',
            'crate' => 'kreti',
            'bag' => 'mfuko',
            'bottle' => 'chupa',
            'sachet' => 'sacheti',
            'tube' => 'tubu',
            'roll' => 'roli',
        ][$code] ?? $code;
    }
}
