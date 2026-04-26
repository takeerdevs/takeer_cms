<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductBrand;
use App\Models\ProductBrandModel;
use App\Models\ProductCategory;
use App\Models\ProductCategoryAttribute;
use App\Models\ProductCategoryAttributeValue;
use App\Models\ProductVariant;
use App\Models\Post;
use App\Models\Bundle;
use App\Models\BundleItem;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\SubscriptionPlan;
use App\Models\SubscriptionPlanItem;
use App\Models\PostProductTag;
use App\Models\ProductImage;
use App\Http\Resources\ProductResource;
use App\Services\EntitlementService;
use App\Services\MediaUploadService;
use App\Services\ProductIntelligenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Exception;

class UploadController extends Controller
{
    /**
     * List all products for the logged-in merchant.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $status = $request->input('status'); // optional filter: all|published|draft
        $type = $request->input('type'); // optional filter: physical|digital|service

        $query = $user->products()->with(['attributes', 'images', 'categoryAttributeValues.categoryAttribute'])
            ->with(['variants', 'postTags.post:id,views_count'])
            ->withCount('postTags')
            ->withCount([
                'orders as purchases_count' => fn ($orders) => $orders->whereNotIn('payment_status', ['pending', 'failed']),
            ])
            ->latest();

        if (in_array($type, ['physical', 'digital', 'service'], true)) {
            $query->where('type', $type);
        }

        if ($status === 'published') {
            $query->has('postTags');
        } elseif ($status === 'draft') {
            $query->doesntHave('postTags');
        }

        $products = $query->paginate(20);

        return ProductResource::collection($products)->response();
    }

    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $product = $user->products()
            ->with(['attributes', 'images', 'categoryAttributeValues.categoryAttribute', 'variants.locationInventories', 'locationInventories', 'postTags.post:id,views_count'])
            ->withCount('postTags')
            ->withCount([
                'orders as purchases_count' => fn ($orders) => $orders->whereNotIn('payment_status', ['pending', 'failed']),
            ])
            ->findOrFail($id);

        return ProductResource::make($product)->response();
    }

    /**
     * Catalog schema for merchant upload flow: categories, attributes, and allowed brands/models.
     */
    public function catalogSchema(Request $request): JsonResponse
    {
        $categories = ProductCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name', 'slug']);

        $topLevel = $categories->whereNull('parent_id')->values();
        $childrenByParent = $categories->whereNotNull('parent_id')->groupBy('parent_id');

        $selectedCategoryId = (int) $request->input('category_id', 0);
        $selectedCategory = $selectedCategoryId > 0
            ? ProductCategory::with(['attributes', 'brands.models', 'brandModels'])->find($selectedCategoryId)
            : null;

        return response()->json([
            'categories' => $topLevel->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'children' => ($childrenByParent[$category->id] ?? collect())->map(fn ($child) => [
                    'id' => $child->id,
                    'name' => $child->name,
                    'slug' => $child->slug,
                ])->values(),
            ])->values(),
            'selected' => $selectedCategory ? [
                'id' => $selectedCategory->id,
                'name' => $selectedCategory->name,
                'parent_id' => $selectedCategory->parent_id,
                'attributes' => $selectedCategory->attributes->map(fn ($attr) => [
                    'id' => $attr->id,
                    'key' => $attr->key,
                    'label' => $attr->label,
                    'input_type' => $attr->input_type,
                    'ui_hint' => $attr->ui_hint,
                    'options' => $attr->options ?? [],
                    'unit_options' => $attr->unit_options ?? [],
                    'is_required' => (bool) $attr->is_required,
                    'is_filterable' => (bool) $attr->is_filterable,
                    'is_variant_axis' => (bool) $attr->is_variant_axis,
                    'ai_extractable' => (bool) $attr->ai_extractable,
                    'sort_order' => (int) $attr->sort_order,
                ])->values(),
                'brands' => $selectedCategory->brands->map(function ($brand) use ($selectedCategory) {
                    $modelsByBrand = $selectedCategory->brandModels
                        ->filter(fn ($model) => (int) data_get($model, 'pivot.brand_id') === (int) $brand->id)
                        ->where('is_active', true)
                        ->values();

                    $models = $modelsByBrand->isNotEmpty()
                        ? $modelsByBrand
                        : $brand->models->where('is_active', true)->values();

                    return [
                        'id' => $brand->id,
                        'name' => $brand->name,
                        'models' => $models->map(fn ($model) => [
                            'id' => $model->id,
                            'name' => $model->name,
                        ])->values(),
                    ];
                })->values(),
            ] : null,
        ]);
    }

    /**
     * General purpose endpoint for uploading media (images, digital files) during the draft phase.
     */
    public function uploadMedia(
        Request $request, 
        \App\Services\MediaUploadService $mediaService,
        \App\Services\StorageQuotaService $quotaService
    ): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:512000', // max 500MB
            'type' => 'required|string|in:public,private',
            'folder' => 'required|string',
        ]);

        $file = $request->file('file');
        $isPrivate = $request->input('type') === 'private';
        $folder = $request->input('folder');
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if ($merchant && !$quotaService->canUpload($merchant, $file->getSize())) {
            return response()->json([
                'message' => 'Nafasi yako ya kuhifadhi faili imejaa (Storage Full). Tafadhali bofya "Upgrade Storage" ili kuongeza nafasi.',
                'quota_exceeded' => true,
            ], 403);
        }

        try {
            $url = $mediaService->uploadFile($file, $folder, $isPrivate);
            
            if ($merchant) {
                $quotaService->recordUpload($merchant, $file->getSize());
            }

            $normalizedUrl = $isPrivate && !str_starts_with($url, 'private://')
                ? "private://{$url}"
                : $url;

            return response()->json([
                'url' => $normalizedUrl,
                'name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'mime' => $file->getMimeType(),
                'storage_used_mb' => $merchant ? $merchant->fresh()->storage_used_mb : 0,
                'storage_percentage' => $merchant ? $merchant->fresh()->storage_percentage : 0,
            ]);
        } catch (Exception $e) {
            Log::error('Media upload failed: ' . $e->getMessage());
            return response()->json(['message' => 'Imeshindwa kupakia faili.'], 500);
        }
    }

    /**
     * Accept an uploaded image url from the merchant, perform AI tagging,
     * modify the physical image, and return the drafted Product.
     */
    public function draftProduct(Request $request, ProductIntelligenceService $aiService): JsonResponse
    {
        $request->validate([
            'image_url' => 'required|string',
        ]);

        $imageUrl = $request->input('image_url');
        $user = $request->user();
        $merchantProfile = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if ($this->shouldBlockListingForKyc($merchantProfile)) {
            return response()->json([
                'message' => 'Umekaribia kiwango cha juu cha mauzo. Tafadhali kamilisha KYC kabla ya kuweka bidhaa mpya.',
            ], 403);
        }

        if (!$merchantProfile) {
            return response()->json(['message' => 'Tafadhali tengeneza biashara kwanza.'], 403);
        }

        // 1. Ask Vision AI to tag and describe the product.
        // We need to fetch the image content from the URL to pass to the AI Service.
        try {
            // Convert app url to absolute if it's relative
            $fullUrl = str_starts_with($imageUrl, '/') ? url($imageUrl) : $imageUrl;

            // For base64 AI analysis we need the raw content
            $imageContent = file_get_contents($fullUrl);
            if ($imageContent === false) {
                throw new Exception("Could not download image from URL for AI analysis.");
            }
            $base64 = base64_encode($imageContent);
            $aiTags = $aiService->analyzeProductImage($base64);
        } catch (Exception $e) {
            Log::error('Upload AI analysis failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'AI haiwezi kuchambua picha sasa hivi.',
                'error_detail' => $e->getMessage(),
                'ai_unavailable' => true,
            ], 503);
        }

        if (!$aiTags || !isset($aiTags['category'])) {
            return response()->json([
                'message' => 'AI ilishindwa kutambua bidhaa. Tafadhali jaribu picha nyingine au endelea mwenyewe.',
                'ai_unavailable' => true,
            ], 422);
        }

        // 2. Draft the product in the database
        $product = Product::create([
            'merchant_id' => $merchantProfile->id,
            'title' => $aiTags['category'] . ' - ' . ($aiTags['sub_category'] ?? 'Mpya'),
            'price' => 0,
            'inventory_count' => 0,
            'buffer_stock' => 0,
        ]);

        // 3. Attach AI extracted tags
        $product->attributes()->create([
            'category' => $aiTags['category'] ?? 'Nyingine',
            'sub_category' => $aiTags['sub_category'] ?? 'Nyingine',
            'colors' => $aiTags['colors'] ?? [],
            'material' => $aiTags['material'] ?? null,
            'style' => $aiTags['style'] ?? null,
            'detected_gender' => $aiTags['detected_gender'] ?? null,
            'suggested_description' => $aiTags['suggested_description_swahili'] ?? '',
            'ai_extracted' => $aiTags,
        ]);

        return response()->json([
            'product_id' => $product->id,
            'ai_draft' => $aiTags,
            'message' => 'Maelezo yameandaliwa na AI. Tafadhali weka bei na idadi.',
        ]);
    }

    /**
     * Create a blank product draft without AI — for when AI is unavailable.
     */
    public function manualDraft(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'category_id' => 'required|integer|exists:product_categories,id',
            'sub_category_id' => 'nullable|integer|exists:product_categories,id',
        ]);

        $user = $request->user();
        $merchantProfile = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchantProfile) {
            return response()->json(['message' => 'Tafadhali tengeneza biashara kwanza.'], 403);
        }

        $product = Product::create([
            'merchant_id' => $merchantProfile->id,
            'title' => $request->input('title'),
            'price' => 0,
            'inventory_count' => 0,
            'buffer_stock' => 0,
        ]);

        $category = $request->filled('category_id') ? ProductCategory::find((int) $request->input('category_id')) : null;
        $subCategory = $request->filled('sub_category_id') ? ProductCategory::find((int) $request->input('sub_category_id')) : null;

        $product->attributes()->create([
            'category_id' => $category?->id,
            'sub_category_id' => $subCategory?->id,
            'category' => $category?->name,
            'sub_category' => $subCategory?->name,
            'colors' => [],
            'suggested_description' => '',
        ]);

        return response()->json([
            'product_id' => $product->id,
            'message' => 'Bidhaa imeandaliwa mwenyewe. Tafadhali weka bei na idadi.',
        ]);
    }

    /**
     * Finalize the product, store images, and create a social post.
     */
    public function publishProduct(Request $request, MediaUploadService $mediaService, EntitlementService $entitlementService): JsonResponse
    {
        $request->validate([
            'image_urls' => 'nullable|array',
            'type' => 'required|string|in:physical,digital,service',
            'price' => 'nullable|numeric|min:0',
            'title' => 'required|string|max:255',
            'category_id' => [Rule::requiredIf($request->input('type') === 'physical'), 'nullable', 'integer', 'exists:product_categories,id'],
            'sub_category_id' => 'nullable|integer|exists:product_categories,id',
            'brand_id' => 'nullable|integer|exists:product_brands,id',
            'model_id' => 'nullable|integer|exists:product_brand_models,id',
            'has_variants' => 'nullable|boolean',
            'variants' => 'nullable|array',
            'variants.*.name' => 'nullable|string|max:140',
            'variants.*.sku' => 'nullable|string|max:80',
            'variants.*.price' => 'nullable|numeric|min:0',
            'variants.*.compare_price' => 'nullable|numeric|min:0',
            'variants.*.quantity' => 'nullable|integer|min:0',
            'variants.*.attributes' => 'nullable|array',
            'variants.*.swatch_image_url' => 'nullable|string|max:2048',
            'variants.*.is_active' => 'nullable|boolean',
            'variants.*.sort_order' => 'nullable|integer|min:0',
            'attribute_values' => 'nullable|array',
            'attribute_values.*.category_attribute_id' => 'required|integer|exists:product_category_attributes,id',
            'attribute_values.*.value_text' => 'nullable|string',
            'attribute_values.*.value_number' => 'nullable|numeric',
            'attribute_values.*.value_boolean' => 'nullable|boolean',
            'attribute_values.*.value_json' => 'nullable|array',
            'description' => 'nullable|string',
            'quantity' => 'nullable|integer',
            'url' => 'nullable|string',
            'digital_file_url' => 'nullable|string',
            'service_pricing_model' => 'nullable|string|in:fixed_price,hourly_rate,contract_quote,deposit_required,showcase_only',
            'service_booking_type' => 'nullable|string|in:instant,request,manual_confirm',
            'service_hourly_rate' => 'nullable|numeric|min:0',
            'service_min_hours' => 'nullable|integer|min:1',
            'service_deposit_amount' => 'nullable|numeric|min:0',
            'service_is_showcase' => 'nullable|boolean',
            'hotspots' => 'nullable|array',
            'product_id' => 'nullable|integer|exists:products,id',
            'access_group_type' => 'nullable|string|in:bundle,plan',
            'access_group_id' => 'nullable|integer',
            'shipping_profile_id' => 'nullable|integer|exists:shipping_profiles,id',
            'is_course' => 'nullable|boolean',
            'curriculum' => 'nullable|array',
            'curriculum.*.title' => 'required_if:is_course,true|string',
            'curriculum.*.lessons' => 'required_if:is_course,true|array',
            'location_inventories' => 'nullable|array', // { location_id: quantity }
            'variants.*.location_inventories' => 'nullable|array',
        ]);

        $user = $request->user();
        $merchantProfile = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();
        if ($this->shouldBlockListingForKyc($merchantProfile)) {
            return response()->json([
                'message' => 'Umekaribia kiwango cha juu cha mauzo. Tafadhali kamilisha KYC kabla ya kuweka bidhaa mpya.',
            ], 403);
        }

        $accessGroupType = $request->input('access_group_type');
        $accessGroupId = $request->input('access_group_id');
        $hasVariants = $request->input('type') === 'physical' && (bool) $request->boolean('has_variants');
        $incomingVariants = collect($request->input('variants', []));
        $category = $request->filled('category_id') ? ProductCategory::find((int) $request->input('category_id')) : null;
        $subCategory = $request->filled('sub_category_id') ? ProductCategory::find((int) $request->input('sub_category_id')) : null;
        $effectiveCategory = $subCategory ?: $category;
        $variantAxisLabelMap = collect();
        if ($effectiveCategory) {
            $variantAxisLabelMap = ProductCategoryAttribute::query()
                ->where('category_id', $effectiveCategory->id)
                ->where('is_variant_axis', true)
                ->pluck('label', 'key');
        }
        $preparedVariants = $incomingVariants
            ->map(function ($variant, int $index) use ($variantAxisLabelMap, $request) {
                $variant = (array) $variant;
                $rawPrice = $variant['price'] ?? null;
                $rawQuantity = $variant['quantity'] ?? null;
                $hasPrice = $rawPrice !== null && $rawPrice !== '' && is_numeric($rawPrice);
                $hasQuantity = $rawQuantity !== null && $rawQuantity !== '' && is_numeric($rawQuantity);
                if (!$hasPrice || !$hasQuantity) {
                    return null;
                }

                $baseTitle = trim((string) $request->input('title', 'Variant'));
                $attributePairs = collect((array) ($variant['attributes'] ?? []))
                    ->filter(fn ($value) => filled($value))
                    ->map(function ($value, $key) use ($variantAxisLabelMap) {
                        $label = $variantAxisLabelMap->get($key) ?: Str::headline((string) $key);
                        return "{$label}:{$value}";
                    })
                    ->values()
                    ->all();
                $derivedName = trim($baseTitle . (count($attributePairs) ? ' ' . implode(' ', $attributePairs) : ''));

                return [
                    'name' => $derivedName,
                    'sku' => filled($variant['sku'] ?? null) ? (string) $variant['sku'] : null,
                    'price' => (float) $rawPrice,
                    'compare_price' => array_key_exists('compare_price', $variant) && $variant['compare_price'] !== null && $variant['compare_price'] !== '' ? (float) $variant['compare_price'] : null,
                    'quantity' => max(0, (int) $rawQuantity),
                    'attributes' => is_array($variant['attributes'] ?? null) ? $variant['attributes'] : [],
                    'swatch_image_url' => $variant['swatch_image_url'] ?? null,
                    'sort_order' => array_key_exists('sort_order', $variant) ? (int) $variant['sort_order'] : $index,
                    'location_inventories' => $variant['location_inventories'] ?? [],
                ];
            })
            ->filter()
            ->values();
        if ($accessGroupType && !$accessGroupId) {
            return response()->json(['message' => 'Access group ID is required when access group type is set.'], 422);
        }
        if ($accessGroupId && !$accessGroupType) {
            return response()->json(['message' => 'Access group type is required when access group is set.'], 422);
        }

        // 1. Capture already uploaded image urls
        $imageUrls = $request->input('image_urls', []);

        $shippingProfileId = $request->input('shipping_profile_id');
        if (!$shippingProfileId && $request->input('type') === 'physical') {
            $shippingProfileId = \App\Models\ShippingProfile::where('merchant_id', $merchantProfile->id)
                ->where('is_default', true)
                ->value('id') 
                ?? \App\Models\ShippingProfile::where('merchant_id', $merchantProfile->id)->value('id');
        }

        if ($request->input('type') === 'physical' && count($imageUrls) === 0) {
            return response()->json(['message' => 'Physical product requires at least one image.'], 422);
        }

        if ($hasVariants && $preparedVariants->isEmpty()) {
            return response()->json(['message' => 'At least one variant is required when variants are enabled.'], 422);
        }

        // 2. Capture already uploaded digital file url (direct file takes priority over external URL)
        $productUrl = $request->input('url');
        if ($request->input('type') === 'digital' && $request->filled('digital_file_url')) {
            $productUrl = $request->input('digital_file_url');

            // Normalize uploaded private file references so download flow can resolve storage paths.
            if (!str_starts_with($productUrl, 'private://') && !preg_match('/^https?:\/\//i', $productUrl)) {
                $productUrl = "private://{$productUrl}";
            }
        } elseif ($request->input('type') === 'physical' && count($imageUrls) > 0) {
            // For physical products, we store the first image in the 'url' field 
            // since we don't have a separate product_images table yet.
            $productUrl = $imageUrls[0];
        }

        // 3. Create or update the Product
        $servicePricingModel = $request->input('service_pricing_model', 'fixed_price');
        $serviceBookingType = $request->input('service_booking_type', 'instant');
        $serviceHourlyRate = $request->input('service_hourly_rate');
        $serviceMinHours = $request->input('service_min_hours');
        $serviceDepositAmount = $request->input('service_deposit_amount');
        $serviceIsShowcase = (bool) $request->boolean('service_is_showcase');

        if ($request->input('type') === 'service') {
            if ($servicePricingModel === 'hourly_rate' && ($serviceHourlyRate === null || $serviceHourlyRate === '')) {
                return response()->json(['message' => 'Service ya hourly inahitaji rate kwa saa.'], 422);
            }

            if ($servicePricingModel === 'deposit_required' && ($serviceDepositAmount === null || $serviceDepositAmount === '')) {
                return response()->json(['message' => 'Service ya deposit inahitaji kiasi cha deposit.'], 422);
            }
        } else {
            $servicePricingModel = 'fixed_price';
            $serviceBookingType = 'instant';
            $serviceHourlyRate = null;
            $serviceMinHours = null;
            $serviceDepositAmount = null;
            $serviceIsShowcase = false;
        }

        $computedBasePrice = $request->input('price') === null ? 0 : (float) $request->input('price');
        if ($request->input('type') === 'service') {
            if ($servicePricingModel === 'hourly_rate') {
                $computedBasePrice = (float) $serviceHourlyRate;
            } elseif ($servicePricingModel === 'deposit_required') {
                $computedBasePrice = (float) $serviceDepositAmount;
            } elseif (in_array($servicePricingModel, ['contract_quote', 'showcase_only'], true) || $serviceIsShowcase) {
                $computedBasePrice = 0;
            }
        }

        $productData = [
            'merchant_id' => $merchantProfile->id,
            'type' => $request->input('type'),
            'has_variants' => $hasVariants,
            'title' => $request->input('title'),
            'price' => $computedBasePrice,
            'compare_at_price' => $request->input('compare_price'),
            'discounted_price' => $computedBasePrice,
            'inventory_count' => $request->input('type') === 'physical'
                ? ($hasVariants
                    ? (int) $preparedVariants->sum(fn ($variant) => (int) ($variant['quantity'] ?? 0))
                    : ($request->input('quantity') ?? 0))
                : 99999,
            'url' => $productUrl,
            'download_link' => $request->input('type') === 'digital' ? $productUrl : null,
            'service_pricing_model' => $servicePricingModel,
            'service_booking_type' => $serviceBookingType,
            'service_hourly_rate' => $serviceHourlyRate !== null && $serviceHourlyRate !== '' ? (float) $serviceHourlyRate : null,
            'service_min_hours' => $serviceMinHours !== null && $serviceMinHours !== '' ? (int) $serviceMinHours : null,
            'service_deposit_amount' => $serviceDepositAmount !== null && $serviceDepositAmount !== '' ? (float) $serviceDepositAmount : null,
            'service_is_showcase' => $serviceIsShowcase,
            'shipping_profile_id' => $shippingProfileId,
        ];

        if ($request->filled('product_id')) {
            $product = $user->products()->findOrFail($request->input('product_id'));
            $product->update($productData);
            // Clear existing images and post tags if updating? 
            // For simplicity, we create a NEW post every time it's "published" to the feed,
            // but we update the product record itself.
            $product->images()->delete();
        } else {
            $productData['slug'] = Str::slug($request->input('title')) . '-' . time();
            $product = Product::create($productData);
        }

        if ($request->input('type') === 'physical') {
            if ($hasVariants) {
                // Delete existing and re-create to keep sync simple
                $product->variants()->delete();
                $totalInventory = 0;

                foreach ($preparedVariants as $vData) {
                    $variant = $product->variants()->create([
                        'name' => $vData['name'],
                        'sku' => $vData['sku'],
                        'price' => $vData['price'],
                        'compare_at_price' => $vData['compare_price'],
                        'inventory_count' => $vData['quantity'],
                        'attributes' => $vData['attributes'],
                        'swatch_image_url' => $vData['swatch_image_url'],
                        'is_active' => true,
                        'sort_order' => $vData['sort_order'],
                    ]);

                    $variantLocInventories = $vData['location_inventories'] ?? [];
                    $variantSum = 0;

                    if (!empty($variantLocInventories)) {
                        foreach ($variantLocInventories as $locId => $qty) {
                            $quantity = max(0, (int) $qty);
                            $variant->locationInventories()->updateOrCreate(
                                ['merchant_location_id' => $locId, 'product_id' => null],
                                ['quantity' => $quantity]
                            );
                            $variantSum += $quantity;
                        }
                    } else {
                        // Fallback to primary location if no inventories provided
                        $primaryLoc = $merchantProfile->locations()->where('is_primary', true)->first() 
                            ?? $merchantProfile->locations()->first();
                        if ($primaryLoc) {
                            $quantity = max(0, (int) ($vData['quantity'] ?? 0));
                            $variant->locationInventories()->create([
                                'merchant_location_id' => $primaryLoc->id,
                                'quantity' => $quantity,
                            ]);
                            $variantSum = $quantity;
                        }
                    }
                    
                    // Update variant's cached count
                    $variant->update(['inventory_count' => $variantSum]);
                    $totalInventory += $variantSum;
                }

                $product->update(['inventory_count' => $totalInventory]);
            } else {
                $product->variants()->delete();
                $locInventories = $request->input('location_inventories', []);
                $totalInventory = 0;

                if (!empty($locInventories)) {
                    foreach ($locInventories as $locId => $qty) {
                        $quantity = max(0, (int) $qty);
                        $product->locationInventories()->updateOrCreate(
                            ['merchant_location_id' => $locId, 'product_variant_id' => null],
                            ['quantity' => $quantity]
                        );
                        $totalInventory += $quantity;
                    }
                } else {
                    // Fallback to primary location
                    $primaryLoc = $merchantProfile->locations()->where('is_primary', true)->first() 
                        ?? $merchantProfile->locations()->first();
                    if ($primaryLoc) {
                        $quantity = max(0, (int) ($request->input('quantity') ?? 0));
                        $product->locationInventories()->updateOrCreate(
                            ['merchant_location_id' => $primaryLoc->id, 'product_variant_id' => null],
                            ['quantity' => $quantity]
                        );
                        $totalInventory = $quantity;
                    }
                }
                
                $product->update(['inventory_count' => $totalInventory]);
            }
        } else {
            $product->variants()->delete();
            $product->locationInventories()->delete();
        }

        // 3.1 Handle Course Curriculum
        if ($request->boolean('is_course')) {
            $course = $product->course()->updateOrCreate([], [
                'welcome_message' => $request->input('description'),
            ]);

            // Sync Modules and Lessons
            $course->modules()->delete(); // Cascades to lessons
            foreach ($request->input('curriculum', []) as $mIdx => $mInput) {
                $module = $course->modules()->create([
                    'title' => $mInput['title'],
                    'sort_order' => $mIdx,
                ]);
                foreach ($mInput['lessons'] as $lIdx => $lInput) {
                    $module->lessons()->create([
                        'title' => $lInput['title'],
                        'type' => $lInput['type'] ?? 'video',
                        'content_url' => $lInput['content_url'],
                        'is_preview' => (bool) ($lInput['is_preview'] ?? false),
                        'sort_order' => $lIdx,
                    ]);
                }
            }
        }

        $brand = $request->filled('brand_id') ? ProductBrand::find((int) $request->input('brand_id')) : null;
        $model = $request->filled('model_id') ? ProductBrandModel::find((int) $request->input('model_id')) : null;

        if ($model && $brand && $model->brand_id !== $brand->id) {
            return response()->json(['message' => 'Selected model does not belong to selected brand.'], 422);
        }

        if ($effectiveCategory && $brand) {
            $brandAllowed = $effectiveCategory->brands()
                ->whereKey($brand->id)
                ->exists();

            if (!$brandAllowed) {
                return response()->json(['message' => 'Selected brand is not allowed for this category.'], 422);
            }
        }

        if ($model && $effectiveCategory) {
            $brandId = $brand?->id ?: $model->brand_id;
            $hasScopedModels = DB::table('product_category_brand_models')
                ->where('category_id', $effectiveCategory->id)
                ->where('brand_id', $brandId)
                ->exists();

            if ($hasScopedModels) {
                $modelAllowed = DB::table('product_category_brand_models')
                    ->where('category_id', $effectiveCategory->id)
                    ->where('brand_id', $brandId)
                    ->where('model_id', $model->id)
                    ->exists();

                if (!$modelAllowed) {
                    return response()->json(['message' => 'Selected model is not allowed for this category.'], 422);
                }
            }
        }

        // 4. Create a social Post for this product
        $post = Post::create([
            'merchant_id' => $merchantProfile->id,
            'title' => $request->input('title'),
            'caption' => $request->input('description') ?: $request->input('title'),
            'excerpt' => $request->input('description'),
        ]);

        // 4.5 Store detailed records for each image in the gallery
        if (count($imageUrls) > 0) {
            $incomingHotspots = $request->input('hotspots', []); // { [index]: [...] }
            foreach ($imageUrls as $index => $imageUrl) {
                $productImage = ProductImage::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'order' => $index,
                    ],
                    [
                        'image_url' => $imageUrl,
                        'hotspots' => $incomingHotspots[$index] ?? [],
                    ]
                );

                // Create PostMedia linking to the ProductImage
                $post->media()->create([
                    'product_image_id' => $productImage->id,
                    'media_type' => 'image',
                ]);
            }

            // Cleanup any extra images if the count decreased
            $product->images()->where('order', '>=', count($imageUrls))->delete();
        }

        // Connect the specific product to this new feed post
        PostProductTag::create([
            'post_id' => $post->id,
            'product_id' => $product->id,
            'x_coordinate' => 50, // default center position
            'y_coordinate' => 50,
        ]);

        // Optional: assign digital product to bundle/subscription group for gated access flow
        if ($request->input('type') === 'digital' && $accessGroupType && $accessGroupId) {
            if ($accessGroupType === 'bundle') {
                $bundle = Bundle::where('merchant_id', $merchantProfile->id)->findOrFail((int) $accessGroupId);
                BundleItem::firstOrCreate(
                    [
                        'bundle_id' => $bundle->id,
                        'item_type' => 'product',
                        'item_id' => $product->id,
                    ],
                    [
                        'sort_order' => (int) BundleItem::where('bundle_id', $bundle->id)->count(),
                    ]
                );

                $post->update([
                    'is_restricted' => true,
                    'promotable_type' => Bundle::class,
                    'promotable_id' => $bundle->id,
                ]);

                $entitlementService->syncActiveEntitlementsForBundle((int) $bundle->id);
            }

            if ($accessGroupType === 'plan') {
                $plan = SubscriptionPlan::where('merchant_id', $merchantProfile->id)->findOrFail((int) $accessGroupId);
                SubscriptionPlanItem::firstOrCreate(
                    [
                        'subscription_plan_id' => $plan->id,
                        'item_type' => 'product',
                        'item_id' => $product->id,
                    ],
                    [
                        'unlock_after_days' => 0,
                    ]
                );

                $post->update([
                    'is_restricted' => true,
                    'promotable_type' => SubscriptionPlan::class,
                    'promotable_id' => $plan->id,
                ]);

                $entitlementService->syncActiveSubscribersForPlan((int) $plan->id);
            }
        }

        // 5. Create or update ProductAttribute with the description
        // This is crucial for Digital/Service products so ProductDetail.jsx can render it natively.
        $product->attributes()->updateOrCreate(
            ['product_id' => $product->id],
            [
                'category_id' => $category?->id,
                'sub_category_id' => $subCategory?->id,
                'brand_id' => $brand?->id,
                'model_id' => $model?->id,
                'category' => $category?->name,
                'sub_category' => $subCategory?->name,
                'suggested_description' => $request->input('description', ''),
            ]
        );

        $incomingValues = collect($request->input('attribute_values', []))
            ->filter(fn ($item) => !empty($item['category_attribute_id']))
            ->map(function (array $item) use ($product) {
                $rawValueText = $item['value_text'] ?? null;
                $rawValueJson = $item['value_json'] ?? null;
                $normalizedValueJson = $rawValueJson;

                if (is_array($rawValueJson) || is_object($rawValueJson)) {
                    $normalizedValueJson = json_encode($rawValueJson, JSON_UNESCAPED_UNICODE);
                }

                // Guard against malformed payloads where complex values are posted into value_text.
                if (is_array($rawValueText) || is_object($rawValueText)) {
                    if ($normalizedValueJson === null) {
                        $normalizedValueJson = json_encode($rawValueText, JSON_UNESCAPED_UNICODE);
                    }
                    $rawValueText = null;
                }

                return [
                    'product_id' => $product->id,
                    'category_attribute_id' => (int) $item['category_attribute_id'],
                    'value_text' => $rawValueText,
                    'value_number' => $item['value_number'] ?? null,
                    'value_boolean' => array_key_exists('value_boolean', $item) ? (bool) $item['value_boolean'] : null,
                    'value_json' => $normalizedValueJson,
                    'source' => 'merchant',
                    'is_verified' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ];
            })
            ->values();

        if ($incomingValues->isNotEmpty()) {
            ProductCategoryAttributeValue::upsert(
                $incomingValues->all(),
                ['product_id', 'category_attribute_id'],
                ['value_text', 'value_number', 'value_boolean', 'value_json', 'source', 'is_verified', 'updated_at']
            );

            $allowedAttributeIds = $incomingValues->pluck('category_attribute_id')->all();
            ProductCategoryAttributeValue::query()
                ->where('product_id', $product->id)
                ->whereNotIn('category_attribute_id', $allowedAttributeIds)
                ->delete();
        } else {
            ProductCategoryAttributeValue::query()
                ->where('product_id', $product->id)
                ->delete();
        }

        return response()->json([
            'message' => 'Hongera! Bidhaa yako imewekwa sokoni.',
            'product_id' => $product->id
        ]);
    }

    /**
     * Delete (archive) a product.
     */
    public function deleteProduct(Request $request, $id): JsonResponse
    {
        $user = $request->user();
        $product = $user->products()->findOrFail($id);

        if ($product->orders()->exists()) {
            return response()->json([
                'message' => 'Bidhaa hii ina oda tayari. Huwezi kuifuta; badili stock iwe 0 ili isiuzwe.',
            ], 422);
        }

        DB::transaction(function () use ($product) {
            $postIds = PostProductTag::query()
                ->where('product_id', $product->id)
                ->pluck('post_id')
                ->unique()
                ->values();

            // Remove this product tags first.
            PostProductTag::query()
                ->where('product_id', $product->id)
                ->delete();

            // If any post is now left without product tags, remove that post + media.
            if ($postIds->isNotEmpty()) {
                $orphanPosts = Post::query()
                    ->whereIn('id', $postIds->all())
                    ->whereDoesntHave('productTags')
                    ->get();

                if ($orphanPosts->isNotEmpty()) {
                    foreach ($orphanPosts as $orphanPost) {
                        $orphanPost->media()->delete();
                        $orphanPost->comments()->delete();
                        $orphanPost->likes()->delete();
                        $orphanPost->reactions()->delete();
                        $orphanPost->productTags()->delete();
                        $orphanPost->forceDelete();
                    }
                }
            }

            // Explicit cleanup for product-owned associations.
            $product->images()->delete();
            $product->variants()->delete();
            $product->categoryAttributeValues()->delete();
            $product->attributes()->delete();
            $product->embedding()->delete();
            BundleItem::query()
                ->where('item_type', 'product')
                ->where('item_id', $product->id)
                ->delete();
            SubscriptionPlanItem::query()
                ->where('item_type', 'product')
                ->where('item_id', $product->id)
                ->delete();

            // Hard delete product.
            $product->delete();
        });

        return response()->json(['message' => 'Bidhaa imeondolewa.']);
    }

    /**
     * Real-time hotspot sync for a specific image index.
     */
    public function syncHotspots(Request $request, $id): JsonResponse
    {
        $request->validate([
            'image_index' => 'required|integer',
            'hotspots' => 'required|array',
        ]);

        $user = $request->user();
        $product = $user->products()->findOrFail($id);
        $index = $request->input('image_index');
        $hotspots = $request->input('hotspots');

        // Identify the image record by the order index
        $image = $product->images()->where('order', $index)->first();

        if ($image) {
            $image->update(['hotspots' => $hotspots]);
            return response()->json(['message' => 'Alama zimehifadhiwa.']);
        }

        return response()->json(['message' => 'Picha haikupatikana kwa kusawazisha.'], 404);
    }

    private function shouldBlockListingForKyc(?\App\Models\Merchant $merchant): bool
    {
        if (!$merchant) {
            return false;
        }

        $status = strtolower((string) $merchant->kyc_status);
        if (in_array($status, ['approved', 'verified'], true)) {
            return false;
        }

        // 1. Mandatory KYC for all Business accounts
        if ($merchant->type === 'business') {
            return true;
        }

        // 2. Personal accounts follow threshold logic
        $mode = (string) AdminSetting::get('kyc_enforcement_mode', 'off');
        if ($mode !== 'listings_and_withdrawals') {
            return false;
        }

        $gmvThreshold = (float) AdminSetting::get('kyc_trigger_gmv_tzs', 0);
        $ordersThreshold = (int) AdminSetting::get('kyc_trigger_order_count', 0);

        $merchantGmv = (float) Order::query()
            ->where('merchant_id', $merchant->id)
            ->whereNotIn('payment_status', ['pending', 'failed'])
            ->sum('total_paid');
        $merchantOrderCount = (int) Order::query()
            ->where('merchant_id', $merchant->id)
            ->whereNotIn('payment_status', ['pending', 'failed'])
            ->count();

        return ($gmvThreshold == 0 || $merchantGmv >= $gmvThreshold)
            && ($ordersThreshold == 0 || $merchantOrderCount >= $ordersThreshold);
    }
}
