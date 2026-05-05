<?php

namespace Database\Seeders;

use App\Models\ProductCategory;
use App\Models\ProductCategoryAttribute;
use Illuminate\Database\Seeder;

class ProductSafetyAttributeSeeder extends Seeder
{
    public function run(): void
    {
        $presets = [
            'health-beauty' => [
                $this->textarea('ingredients', 'Ingredients', true, true, 10),
                $this->textarea('usage_directions', 'Usage Directions', false, true, 20),
                $this->textarea('cautions', 'Cautions / Warnings', true, true, 30),
                $this->multi('allergens', 'Allergens', ['Fragrance', 'Nuts', 'Dairy', 'Gluten', 'Latex', 'Parabens', 'Sulfates'], false, true, 40),
                $this->date('expiry_date', 'Expiry Date', false, true, 50),
                $this->text('batch_number', 'Batch Number', false, true, 60),
                $this->text('registration_number', 'Registration / Certification Number', false, true, 70),
            ],
            'skincare' => [
                $this->multi('skin_type', 'Skin Type', ['All', 'Dry', 'Oily', 'Combination', 'Sensitive', 'Acne-prone'], false, true, 80),
            ],
            'haircare' => [
                $this->multi('hair_type', 'Hair Type', ['All', 'Natural', 'Relaxed', 'Curly', 'Straight', 'Coily', '4A', '4B', '4C', 'Dandruff-prone'], false, true, 80),
            ],
            'food' => [
                $this->textarea('ingredients', 'Ingredients', true, true, 10),
                $this->textarea('nutrition_facts', 'Nutrition Facts', false, true, 20),
                $this->multi('allergens', 'Allergens', ['Nuts', 'Dairy', 'Gluten', 'Soy', 'Eggs', 'Fish', 'Shellfish'], true, true, 30),
                $this->date('expiry_date', 'Expiry Date', true, true, 40),
                $this->textarea('storage_instructions', 'Storage Instructions', false, true, 50),
                $this->text('certification_number', 'Certification / Registration Number', false, true, 60),
            ],
            'supplements' => [
                $this->textarea('ingredients', 'Ingredients', true, true, 10),
                $this->textarea('dosage', 'Dosage / Usage Directions', true, true, 20),
                $this->textarea('cautions', 'Cautions / Contraindications', true, true, 30),
                $this->multi('allergens', 'Allergens', ['Nuts', 'Dairy', 'Gluten', 'Soy', 'Eggs', 'Fish', 'Shellfish'], false, true, 40),
                $this->date('expiry_date', 'Expiry Date', true, true, 50),
                $this->text('registration_number', 'Registration / Certification Number', true, true, 60),
            ],
        ];

        foreach ($presets as $slug => $attributes) {
            $category = ProductCategory::query()->where('slug', $slug)->first();
            if (! $category) {
                continue;
            }

            foreach ($attributes as $attribute) {
                ProductCategoryAttribute::query()->updateOrCreate(
                    ['category_id' => $category->id, 'key' => $attribute['key']],
                    $attribute + ['category_id' => $category->id]
                );
            }
        }
    }

    private function text(string $key, string $label, bool $required, bool $aiExtractable, int $sortOrder): array
    {
        return $this->base($key, $label, 'text', $required, $aiExtractable, $sortOrder);
    }

    private function textarea(string $key, string $label, bool $required, bool $aiExtractable, int $sortOrder): array
    {
        return $this->base($key, $label, 'textarea', $required, $aiExtractable, $sortOrder);
    }

    private function date(string $key, string $label, bool $required, bool $aiExtractable, int $sortOrder): array
    {
        return $this->base($key, $label, 'date', $required, $aiExtractable, $sortOrder);
    }

    private function multi(string $key, string $label, array $options, bool $required, bool $aiExtractable, int $sortOrder): array
    {
        return $this->base($key, $label, 'multiselect', $required, $aiExtractable, $sortOrder) + [
            'options' => $options,
        ];
    }

    private function base(string $key, string $label, string $type, bool $required, bool $aiExtractable, int $sortOrder): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'input_type' => $type,
            'ui_hint' => null,
            'options' => null,
            'unit_options' => null,
            'is_required' => $required,
            'is_filterable' => true,
            'is_variant_axis' => false,
            'ai_extractable' => $aiExtractable,
            'sort_order' => $sortOrder,
        ];
    }
}
