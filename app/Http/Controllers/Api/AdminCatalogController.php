<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductBrand;
use App\Models\ProductBrandModel;
use App\Models\ProductCategory;
use App\Models\ProductCategoryAttribute;
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
            'children.attributes',
            'children.brands.models',
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

        return response()->json([
            'message' => 'Category created.',
            'category' => $category->fresh(['attributes', 'brands.models']),
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

        return response()->json([
            'message' => 'Category updated.',
            'category' => $category->fresh(['attributes', 'brands.models']),
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
            'input_type' => 'required|string|in:text,number,select,boolean',
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
            'options' => $validated['input_type'] === 'select' ? ($validated['options'] ?? []) : null,
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
            'input_type' => 'nullable|string|in:text,number,select,boolean',
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

        if (array_key_exists('input_type', $validated) && $validated['input_type'] !== 'select') {
            $validated['options'] = null;
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

    public function indexBrands(): JsonResponse
    {
        $brands = ProductBrand::with('models')
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
            'model' => $model,
        ], 201);
    }

    public function updateBrandModel(Request $request, ProductBrandModel $brandModel): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'is_active' => 'nullable|boolean',
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

        $brandModel->update($validated);

        return response()->json([
            'message' => 'Brand model updated.',
            'model' => $brandModel->fresh(),
        ]);
    }

    public function destroyBrandModel(ProductBrandModel $brandModel): JsonResponse
    {
        $brandModel->delete();

        return response()->json(['message' => 'Brand model deleted.']);
    }
}
