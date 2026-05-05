<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductBrand;
use App\Models\ProductBrandModel;
use App\Models\ProductCategory;
use App\Models\ProductCategoryAttribute;
use App\Models\ProductUnitType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminCatalogController extends Controller
{
    public function indexCategories(Request $request): JsonResponse
    {
        $perPage = max(1, min((int) $request->input('per_page', 10), 50));

        $categories = ProductCategory::with([
            'attributes',
            'brands.models',
            'unitTypes',
            'children.attributes',
            'children.brands.models',
            'children.unitTypes',
        ])
            ->whereNull('parent_id')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($perPage);

        return response()->json([
            'data' => $categories->items(),
            'pagination' => [
                'current_page' => $categories->currentPage(),
                'last_page' => $categories->lastPage(),
                'per_page' => $categories->perPage(),
                'total' => $categories->total(),
            ],
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'parent_id' => 'nullable|integer|exists:product_categories,id',
            'image_url' => 'nullable|string|max:2048',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'brand_ids' => 'nullable|array',
            'brand_ids.*' => 'integer|exists:product_brands,id',
            'unit_type_ids' => 'nullable|array',
            'unit_type_ids.*' => 'integer|exists:product_unit_types,id',
        ]);

        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        $counter = 2;
        while (ProductCategory::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $category = ProductCategory::create([
            'parent_id' => $validated['parent_id'] ?? null,
            'name' => $validated['name'],
            'slug' => $slug,
            'image_url' => $validated['image_url'] ?? null,
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
        ]);

        if (isset($validated['brand_ids'])) {
            $category->brands()->sync($validated['brand_ids']);
        }
        if (isset($validated['unit_type_ids'])) {
            $category->unitTypes()->sync($this->unitSyncPayload($validated['unit_type_ids']));
        }

        return response()->json([
            'message' => 'Category created.',
            'category' => $category->fresh(['attributes', 'brands.models', 'unitTypes']),
        ], 201);
    }

    public function updateCategory(Request $request, ProductCategory $category): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'parent_id' => 'nullable|integer|exists:product_categories,id',
            'image_url' => 'nullable|string|max:2048',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'brand_ids' => 'nullable|array',
            'brand_ids.*' => 'integer|exists:product_brands,id',
            'unit_type_ids' => 'nullable|array',
            'unit_type_ids.*' => 'integer|exists:product_unit_types,id',
        ]);

        if (array_key_exists('name', $validated)) {
            $baseSlug = Str::slug($validated['name']);
            $slug = $baseSlug;
            $counter = 2;
            while (ProductCategory::where('slug', $slug)->where('id', '!=', $category->id)->exists()) {
                $slug = "{$baseSlug}-{$counter}";
                $counter++;
            }
            $validated['slug'] = $slug;
        }

        if (array_key_exists('parent_id', $validated) && (int) $validated['parent_id'] === $category->id) {
            return response()->json(['message' => 'Category cannot be its own parent.'], 422);
        }

        $category->update($validated);

        if (isset($validated['brand_ids'])) {
            $category->brands()->sync($validated['brand_ids']);
        }
        if (isset($validated['unit_type_ids'])) {
            $category->unitTypes()->sync($this->unitSyncPayload($validated['unit_type_ids']));
        }

        return response()->json([
            'message' => 'Category updated.',
            'category' => $category->fresh(['attributes', 'brands.models', 'unitTypes']),
        ]);
    }

    public function destroyCategory(ProductCategory $category): JsonResponse
    {
        $category->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    public function storeAttribute(Request $request, ProductCategory $category): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:80',
            'label' => 'required|string|max:120',
            'input_type' => 'required|string|in:text,textarea,number,select,multiselect,date,boolean',
            'ui_hint' => 'nullable|string|in:number_with_unit',
            'options' => 'nullable|array',
            'options.*' => 'string|max:120',
            'unit_options' => 'nullable|array',
            'unit_options.*' => 'string|max:20',
            'is_required' => 'nullable|boolean',
            'is_filterable' => 'nullable|boolean',
            'is_variant_axis' => 'nullable|boolean',
            'ai_extractable' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $attribute = ProductCategoryAttribute::create([
            'category_id' => $category->id,
            'key' => Str::slug($validated['key'], '_'),
            'label' => $validated['label'],
            'input_type' => $validated['input_type'],
            'ui_hint' => $validated['ui_hint'] ?? null,
            'options' => in_array($validated['input_type'], ['select', 'multiselect'], true) ? ($validated['options'] ?? []) : null,
            'unit_options' => $validated['input_type'] === 'number' ? ($validated['unit_options'] ?? null) : null,
            'is_required' => (bool) ($validated['is_required'] ?? false),
            'is_filterable' => (bool) ($validated['is_filterable'] ?? true),
            'is_variant_axis' => $validated['input_type'] === 'select' ? (bool) ($validated['is_variant_axis'] ?? false) : false,
            'ai_extractable' => (bool) ($validated['ai_extractable'] ?? false),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
        ]);

        return response()->json([
            'message' => 'Attribute created.',
            'attribute' => $attribute,
        ], 201);
    }

    public function updateAttribute(Request $request, ProductCategoryAttribute $attribute): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'sometimes|required|string|max:80',
            'label' => 'sometimes|required|string|max:120',
            'input_type' => 'nullable|string|in:text,textarea,number,select,multiselect,date,boolean',
            'ui_hint' => 'nullable|string|in:number_with_unit',
            'options' => 'nullable|array',
            'options.*' => 'string|max:120',
            'unit_options' => 'nullable|array',
            'unit_options.*' => 'string|max:20',
            'is_required' => 'nullable|boolean',
            'is_filterable' => 'nullable|boolean',
            'is_variant_axis' => 'nullable|boolean',
            'ai_extractable' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if (array_key_exists('key', $validated)) {
            $validated['key'] = Str::slug($validated['key'], '_');
        }

        if (array_key_exists('input_type', $validated) && !in_array($validated['input_type'], ['select', 'multiselect'], true)) {
            $validated['options'] = null;
        }
        if (array_key_exists('input_type', $validated) && $validated['input_type'] !== 'select') {
            $validated['is_variant_axis'] = false;
        }
        if (array_key_exists('input_type', $validated) && $validated['input_type'] !== 'number') {
            $validated['ui_hint'] = null;
            $validated['unit_options'] = null;
        }

        $attribute->update($validated);

        return response()->json([
            'message' => 'Attribute updated.',
            'attribute' => $attribute->fresh(),
        ]);
    }

    public function destroyAttribute(ProductCategoryAttribute $attribute): JsonResponse
    {
        $attribute->delete();

        return response()->json(['message' => 'Attribute deleted.']);
    }

    public function indexUnitTypes(): JsonResponse
    {
        $units = ProductUnitType::query()
            ->orderBy('unit_category')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $units]);
    }

    public function storeUnitType(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'code' => 'required|string|max:40|unique:product_unit_types,code',
            'symbol' => 'nullable|string|max:24',
            'unit_category' => 'required|string|in:count,weight,volume,length,area,package',
            'base_unit_code' => 'nullable|string|max:40',
            'conversion_factor_to_base' => 'nullable|numeric|min:0.000001',
            'allows_decimal' => 'nullable|boolean',
            'localized_labels' => 'nullable|array',
            'common_quantities' => 'nullable|array',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $unit = ProductUnitType::create([
            'name' => $validated['name'],
            'code' => Str::slug($validated['code'], '_'),
            'symbol' => $validated['symbol'] ?? null,
            'unit_category' => $validated['unit_category'],
            'base_unit_code' => $validated['base_unit_code'] ?? null,
            'conversion_factor_to_base' => $validated['conversion_factor_to_base'] ?? 1,
            'allows_decimal' => (bool) ($validated['allows_decimal'] ?? false),
            'localized_labels' => $validated['localized_labels'] ?? null,
            'common_quantities' => $validated['common_quantities'] ?? [],
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
        ]);

        return response()->json([
            'message' => 'Unit type created.',
            'unit_type' => $unit,
        ], 201);
    }

    public function updateUnitType(Request $request, ProductUnitType $unitType): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'code' => 'sometimes|required|string|max:40|unique:product_unit_types,code,'.$unitType->id,
            'symbol' => 'nullable|string|max:24',
            'unit_category' => 'sometimes|required|string|in:count,weight,volume,length,area,package',
            'base_unit_code' => 'nullable|string|max:40',
            'conversion_factor_to_base' => 'nullable|numeric|min:0.000001',
            'allows_decimal' => 'nullable|boolean',
            'localized_labels' => 'nullable|array',
            'common_quantities' => 'nullable|array',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if (array_key_exists('code', $validated)) {
            $validated['code'] = Str::slug($validated['code'], '_');
        }

        $unitType->update($validated);

        return response()->json([
            'message' => 'Unit type updated.',
            'unit_type' => $unitType->fresh(),
        ]);
    }

    public function destroyUnitType(ProductUnitType $unitType): JsonResponse
    {
        $unitType->delete();

        return response()->json(['message' => 'Unit type deleted.']);
    }

    public function indexBrands(): JsonResponse
    {
        $brands = ProductBrand::with(['models.categories:id,name,slug,parent_id'])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $brands]);
    }

    public function storeBrand(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        $counter = 2;
        while (ProductBrand::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $brand = ProductBrand::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return response()->json([
            'message' => 'Brand created.',
            'brand' => $brand,
        ], 201);
    }

    public function updateBrand(Request $request, ProductBrand $brand): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'is_active' => 'nullable|boolean',
        ]);

        if (array_key_exists('name', $validated)) {
            $baseSlug = Str::slug($validated['name']);
            $slug = $baseSlug;
            $counter = 2;
            while (ProductBrand::where('slug', $slug)->where('id', '!=', $brand->id)->exists()) {
                $slug = "{$baseSlug}-{$counter}";
                $counter++;
            }
            $validated['slug'] = $slug;
        }

        $brand->update($validated);

        return response()->json([
            'message' => 'Brand updated.',
            'brand' => $brand->fresh('models'),
        ]);
    }

    public function destroyBrand(ProductBrand $brand): JsonResponse
    {
        $brand->delete();

        return response()->json(['message' => 'Brand deleted.']);
    }

    public function storeBrandModel(Request $request, ProductBrand $brand): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'is_active' => 'nullable|boolean',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:product_categories,id',
        ]);

        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        $counter = 2;
        while (ProductBrandModel::where('brand_id', $brand->id)->where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $model = ProductBrandModel::create([
            'brand_id' => $brand->id,
            'name' => $validated['name'],
            'slug' => $slug,
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return response()->json([
            'message' => 'Brand model created.',
            'model' => $this->syncBrandModelCategories($model, $validated['category_ids'] ?? [])->fresh('categories'),
        ], 201);
    }

    public function updateBrandModel(Request $request, ProductBrandModel $brandModel): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'is_active' => 'nullable|boolean',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:product_categories,id',
        ]);

        if (array_key_exists('name', $validated)) {
            $baseSlug = Str::slug($validated['name']);
            $slug = $baseSlug;
            $counter = 2;
            while (ProductBrandModel::where('brand_id', $brandModel->brand_id)->where('slug', $slug)->where('id', '!=', $brandModel->id)->exists()) {
                $slug = "{$baseSlug}-{$counter}";
                $counter++;
            }
            $validated['slug'] = $slug;
        }

        $categoryIds = $validated['category_ids'] ?? null;
        unset($validated['category_ids']);

        $brandModel->update($validated);

        if ($categoryIds !== null) {
            $this->syncBrandModelCategories($brandModel, $categoryIds);
        }

        return response()->json([
            'message' => 'Brand model updated.',
            'model' => $brandModel->fresh('categories'),
        ]);
    }

    public function destroyBrandModel(ProductBrandModel $brandModel): JsonResponse
    {
        $brandModel->delete();

        return response()->json(['message' => 'Brand model deleted.']);
    }

    private function unitSyncPayload(array $unitTypeIds): array
    {
        $ids = collect($unitTypeIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        return $ids->mapWithKeys(fn ($id, $index) => [
            $id => [
                'is_default' => $index === 0,
                'min_order_quantity' => null,
                'order_increment' => null,
            ],
        ])->all();
    }

    private function syncBrandModelCategories(ProductBrandModel $brandModel, array $categoryIds): ProductBrandModel
    {
        $payload = collect($categoryIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->mapWithKeys(fn ($id) => [
                $id => ['brand_id' => $brandModel->brand_id],
            ])
            ->all();

        $brandModel->categories()->sync($payload);

        return $brandModel;
    }
}
