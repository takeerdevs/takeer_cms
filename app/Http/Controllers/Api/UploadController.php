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
use App\Models\Merchant;
use App\Models\MerchantServiceCredential;
use App\Models\ServiceCategory;
use App\Models\Post;
use App\Models\Bundle;
use App\Models\BundleItem;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\SubscriptionPlan;
use App\Models\SubscriptionPlanItem;
use App\Models\PostProductTag;
use App\Models\ProductImage;
use App\Jobs\ProcessPromotableVideo;
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
    private const DEFAULT_UPLOAD_EXTENSIONS = 'jpg,jpeg,png,webp,gif,mp4,mov,webm,pdf,zip,doc,docx,xls,xlsx,ppt,pptx,csv,txt';
    private const DEFAULT_UPLOAD_MIME_TYPES = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain';

    /**
     * List all products for the logged-in merchant.
     */
    public function index(Request $request): JsonResponse
    {
        $merchantProfile = $this->merchantFromRequest($request);
        $status = $request->input('status'); // optional filter: all|published|draft
        $type = $request->input('type'); // optional filter: physical|digital|service

        $query = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->with(['attributes.brand', 'attributes.model', 'images', 'categoryAttributeValues.categoryAttribute'])
            ->with(['variants', 'postTags.post:id,views_count'])
            ->withCount('postTags')
            ->withCount([
                'orders as purchases_count' => fn ($orders) => $orders->whereNotIn('payment_status', ['pending', 'failed']),
            ])
            ->latest();

        if (in_array($type, ['physical', 'digital', 'service'], true)) {
            $query->where('products.type', $type);
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
        $merchantProfile = $this->merchantFromRequest($request);
        $product = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->with(['attributes.brand', 'attributes.model', 'images', 'categoryAttributeValues.categoryAttribute', 'variants.locationInventories.location', 'locationInventories.location', 'postTags.post:id,views_count'])
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
        $maxFileMb = max(1, min(500, (int) AdminSetting::get('upload_max_file_mb', 500)));

        $request->validate([
            'file' => "required|file|max:" . ($maxFileMb * 1024),
            'type' => 'required|string|in:public,private',
            'folder' => ['required', 'string', 'max:120', 'regex:/\A[A-Za-z0-9][A-Za-z0-9\/_-]*\z/'],
        ]);

        $file = $request->file('file');
        $this->ensureUploadIsAllowed($file);

        $isPrivate = $request->input('type') === 'private';
        $folder = $request->input('folder');
        $isFreePostMedia = $this->isFreePostMediaUpload($folder, $isPrivate);
        $merchant = $isFreePostMedia
            ? $this->merchantFromRequestOrNull($request)
            : $this->merchantFromRequest($request);

        if (! $isFreePostMedia && $merchant && ! $merchant->canSellProducts()) {
            return response()->json([
                'message' => 'Complete KYC before uploading product, course, or private commerce files.',
                'verification_url' => "/merchant/{$merchant->username}/verification",
            ], 403);
        }

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

    private function ensureUploadIsAllowed(\Illuminate\Http\UploadedFile $file): void
    {
        $extension = strtolower((string) ($file->getClientOriginalExtension() ?: $file->extension()));
        $mimeType = strtolower((string) $file->getMimeType());

        $allowedExtensions = $this->settingList('upload_allowed_extensions', self::DEFAULT_UPLOAD_EXTENSIONS);
        $allowedMimeTypes = $this->settingList('upload_allowed_mime_types', self::DEFAULT_UPLOAD_MIME_TYPES);

        abort_if(
            $extension === '' || !in_array($extension, $allowedExtensions, true),
            422,
            'Aina ya faili hairuhusiwi. Tafadhali pakia faili yenye extension inayokubalika.'
        );

        abort_if(
            $mimeType === '' || !in_array($mimeType, $allowedMimeTypes, true),
            422,
            'Aina ya faili hairuhusiwi. Tafadhali pakia faili yenye MIME type inayokubalika.'
        );
    }

    private function settingList(string $key, string $default): array
    {
        return collect(preg_split('/[\s,]+/', strtolower((string) AdminSetting::get($key, $default))))
            ->map(fn ($item) => trim($item, " \t\n\r\0\x0B."))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    private function normalizePromotableMediaItem(array $item): array
    {
        $url = trim((string) ($item['url'] ?? $item['image_url'] ?? $item['media_url'] ?? ''));
        $rawType = strtolower((string) ($item['media_type'] ?? $item['type'] ?? ''));
        $mime = strtolower((string) ($item['mime'] ?? ''));

        if (!in_array($rawType, ['image', 'video'], true)) {
            $rawType = str_starts_with($mime, 'video/') || preg_match('/\.(mp4|mov|webm|ogg)(\?|$)/i', $url)
                ? 'video'
                : 'image';
        }

        $processingStatus = strtolower((string) ($item['processing_status'] ?? ($rawType === 'video' ? 'pending' : 'ready')));
        if (!in_array($processingStatus, ['pending', 'processing', 'ready', 'failed'], true)) {
            $processingStatus = 'ready';
        }

        return [
            'url' => $url,
            'media_type' => $rawType,
            'thumbnail_url' => trim((string) ($item['thumbnail_url'] ?? '')) ?: null,
            'processed_url' => trim((string) ($item['processed_url'] ?? '')) ?: null,
            'hls_url' => trim((string) ($item['hls_url'] ?? '')) ?: null,
            'mime' => $mime ?: null,
            'size' => isset($item['size']) && $item['size'] !== '' ? (int) $item['size'] : null,
            'duration_seconds' => isset($item['duration_seconds']) && $item['duration_seconds'] !== '' ? (int) $item['duration_seconds'] : null,
            'width' => isset($item['width']) && $item['width'] !== '' ? (int) $item['width'] : null,
            'height' => isset($item['height']) && $item['height'] !== '' ? (int) $item['height'] : null,
            'processing_status' => $processingStatus,
        ];
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
        $merchantProfile = $this->merchantFromRequest($request);

        if (! $merchantProfile->canSellProducts()) {
            return response()->json([
                'message' => 'Complete KYC before creating product listings.',
                'verification_url' => "/merchant/{$merchantProfile->username}/verification",
            ], 403);
        }

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

        $merchantProfile = $this->merchantFromRequest($request);

        if (!$merchantProfile) {
            return response()->json(['message' => 'Tafadhali tengeneza biashara kwanza.'], 403);
        }

        if (! $merchantProfile->canSellProducts()) {
            return response()->json([
                'message' => 'Complete KYC before creating product listings.',
                'verification_url' => "/merchant/{$merchantProfile->username}/verification",
            ], 403);
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
            'media_items' => 'nullable|array',
            'media_items.*.url' => 'required_with:media_items|string|max:2048',
            'media_items.*.type' => 'nullable|string|in:image,video',
            'media_items.*.media_type' => 'nullable|string|in:image,video',
            'media_items.*.thumbnail_url' => 'nullable|string|max:2048',
            'media_items.*.processed_url' => 'nullable|string|max:2048',
            'media_items.*.hls_url' => 'nullable|string|max:2048',
            'media_items.*.mime' => 'nullable|string|max:255',
            'media_items.*.size' => 'nullable|integer|min:0',
            'media_items.*.duration_seconds' => 'nullable|integer|min:0',
            'media_items.*.width' => 'nullable|integer|min:0',
            'media_items.*.height' => 'nullable|integer|min:0',
            'media_items.*.processing_status' => 'nullable|string|in:pending,processing,ready,failed',
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
            'service_mode' => 'nullable|string|in:showcase_only,request_quote,book_appointment,pay_now,external_booking',
            'service_scheduling_type' => 'nullable|string|in:none,recurring,fixed_sessions,external',
            'service_category' => 'nullable|string|max:120',
            'service_subcategory' => 'nullable|string|max:120',
            'service_price_display' => 'nullable|string|in:hidden,fixed,starts_from,hourly,daily,nightly,weekly,monthly,yearly,per_person,per_visit,per_session,per_project,package,quote_only',
            'service_charges' => 'nullable|array',
            'service_charges.*.name' => 'required_with:service_charges|string|max:160',
            'service_charges.*.amount' => 'nullable|numeric|min:0',
            'service_charges.*.unit' => 'nullable|string|in:fixed,hourly,daily,nightly,weekly,monthly,yearly,per_person,per_visit,per_session,per_project,optional,refundable_deposit',
            'service_charges.*.required' => 'nullable|boolean',
            'service_charges.*.included_in_checkout' => 'nullable|boolean',
            'service_charges.*.description' => 'nullable|string|max:300',
            'service_options' => 'nullable|array',
            'service_options.*.id' => 'nullable|string|max:80',
            'service_options.*.name' => 'required_with:service_options|string|max:160',
            'service_options.*.description' => 'nullable|string|max:500',
            'service_options.*.price' => 'nullable|numeric|min:0',
            'service_options.*.price_display' => 'nullable|string|in:fixed,starts_from,hourly,daily,nightly,weekly,monthly,yearly,per_person,per_visit,per_session,per_project,package,quote_only',
            'service_options.*.capacity_type' => 'nullable|string|in:limited,unlimited',
            'service_options.*.capacity' => 'nullable|integer|min:1|max:100000',
            'service_options.*.max_guests' => 'nullable|integer|min:1|max:100000',
            'service_options.*.duration_minutes' => 'nullable|integer|min:1|max:10080',
            'service_options.*.checkin_time' => 'nullable|date_format:H:i',
            'service_options.*.checkout_time' => 'nullable|date_format:H:i',
            'service_options.*.buffer_minutes' => 'nullable|integer|min:0|max:10080',
            'service_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'service_location_type' => 'nullable|string|in:provider_location,customer_location,remote,hybrid',
            'service_provider_location' => 'nullable|array',
            'service_provider_location.name' => 'nullable|string|max:160',
            'service_provider_location.address' => 'nullable|string|max:500',
            'service_provider_location.extraDetails' => 'nullable|string|max:500',
            'service_provider_location.lat' => 'nullable|numeric',
            'service_provider_location.lng' => 'nullable|numeric',
            'service_area' => 'nullable|array',
            'service_area.*' => 'nullable|string|max:120',
            'service_client_requirements' => 'nullable|string|max:3000',
            'service_intake_form' => 'nullable|array',
            'service_intake_form.*.id' => 'required_with:service_intake_form|string|max:80',
            'service_intake_form.*.type' => 'required_with:service_intake_form|string|in:text,textarea,phone,email,number,date,select,checkbox,file,image,location',
            'service_intake_form.*.label' => 'required_with:service_intake_form|string|max:160',
            'service_intake_form.*.required' => 'nullable|boolean',
            'service_intake_form.*.placeholder' => 'nullable|string|max:180',
            'service_intake_form.*.options' => 'nullable|array',
            'service_intake_form.*.options.*' => 'nullable|string|max:120',
            'service_booking_provider' => 'nullable|string|in:manual,external,google_calendar',
            'service_booking_mode' => 'nullable|string|in:takeer,internal,external',
            'service_contact_channel' => 'nullable|string|in:whatsapp,phone,email,external_link,in_person',
            'service_contact_value' => 'nullable|string|max:2048',
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

        $merchantProfile = $this->merchantFromRequest($request);
        if (! $merchantProfile->canSellProducts()) {
            return response()->json([
                'message' => 'Complete KYC before publishing products.',
                'verification_url' => "/merchant/{$merchantProfile->username}/verification",
            ], 403);
        }

        if ($this->shouldBlockListingForKyc($merchantProfile)) {
            return response()->json([
                'message' => 'Umekaribia kiwango cha juu cha mauzo. Tafadhali kamilisha KYC kabla ya kuweka bidhaa mpya.',
            ], 403);
        }
        if ($request->input('type') === 'service') {
            $serviceTrustBlock = $this->serviceTrustRequirementBlock($request, $merchantProfile);
            if ($serviceTrustBlock) {
                return $serviceTrustBlock;
            }
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

        // 1. Capture already uploaded promotable media.
        $mediaItems = collect($request->input('media_items', []))
            ->map(fn ($item) => $this->normalizePromotableMediaItem((array) $item))
            ->filter(fn ($item) => filled($item['url']))
            ->values()
            ->all();

        if (count($mediaItems) === 0) {
            $mediaItems = collect($request->input('image_urls', []))
                ->filter()
                ->map(fn ($url) => $this->normalizePromotableMediaItem(['url' => $url, 'type' => 'image']))
                ->values()
                ->all();
        }
        $imageUrls = collect($mediaItems)->pluck('url')->filter()->values()->all();

        $shippingProfileId = $request->input('shipping_profile_id');
        if (!$shippingProfileId && $request->input('type') === 'physical') {
            $shippingProfileId = \App\Models\ShippingProfile::where('merchant_id', $merchantProfile->id)
                ->where('is_default', true)
                ->value('id') 
                ?? \App\Models\ShippingProfile::where('merchant_id', $merchantProfile->id)->value('id');
        }

        if ($request->input('type') === 'physical' && count($mediaItems) === 0) {
            return response()->json(['message' => 'Physical product requires at least one media item.'], 422);
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
        } elseif ($request->input('type') === 'physical' && count($mediaItems) > 0) {
            $productUrl = $mediaItems[0]['thumbnail_url'] ?: $mediaItems[0]['url'];
        }

        // 3. Create or update the Product
        $servicePricingModel = $request->input('service_pricing_model', 'fixed_price');
        $serviceBookingType = $request->input('service_booking_type', 'instant');
        $serviceHourlyRate = $request->input('service_hourly_rate');
        $serviceMinHours = $request->input('service_min_hours');
        $serviceDepositAmount = $request->input('service_deposit_amount');
        $serviceIsShowcase = (bool) $request->boolean('service_is_showcase');
        $serviceMode = $request->input('service_mode');
        $serviceSchedulingType = $request->input('service_scheduling_type');
        $serviceCategory = $request->input('service_category');
        $serviceSubcategory = $request->input('service_subcategory');
        $servicePriceDisplay = $request->input('service_price_display');
        $serviceCharges = collect($request->input('service_charges', []))
            ->map(function (array $charge) {
                $amount = $charge['amount'] ?? null;

                return [
                    'name' => trim((string) ($charge['name'] ?? '')),
                    'amount' => $amount !== null && $amount !== '' ? (float) $amount : null,
                    'unit' => $charge['unit'] ?? 'fixed',
                    'required' => (bool) ($charge['required'] ?? true),
                    'included_in_checkout' => (bool) ($charge['included_in_checkout'] ?? false),
                    'description' => trim((string) ($charge['description'] ?? '')),
                ];
            })
            ->filter(fn (array $charge) => $charge['name'] !== '')
            ->values()
            ->all();
        $serviceOptions = collect($request->input('service_options', []))
            ->map(function (array $option) {
                $name = trim((string) ($option['name'] ?? ''));
                $price = $option['price'] ?? null;
                $capacityType = ($option['capacity_type'] ?? 'limited') === 'unlimited' ? 'unlimited' : 'limited';

                return [
                    'id' => trim((string) ($option['id'] ?? '')) ?: 'option_'.Str::random(10),
                    'name' => $name,
                    'description' => trim((string) ($option['description'] ?? '')),
                    'price' => $price !== null && $price !== '' ? (float) $price : null,
                    'price_display' => $option['price_display'] ?? null,
                    'capacity_type' => $capacityType,
                    'capacity' => $capacityType === 'unlimited' ? null : max(1, (int) ($option['capacity'] ?? 1)),
                    'max_guests' => isset($option['max_guests']) && $option['max_guests'] !== '' ? max(1, (int) $option['max_guests']) : null,
                    'duration_minutes' => isset($option['duration_minutes']) && $option['duration_minutes'] !== '' ? max(1, (int) $option['duration_minutes']) : null,
                    'checkin_time' => $option['checkin_time'] ?? null,
                    'checkout_time' => $option['checkout_time'] ?? null,
                    'buffer_minutes' => isset($option['buffer_minutes']) && $option['buffer_minutes'] !== '' ? max(0, (int) $option['buffer_minutes']) : null,
                ];
            })
            ->filter(fn (array $option) => $option['name'] !== '')
            ->values()
            ->all();
        $serviceDurationMinutes = $request->input('service_duration_minutes');
        $serviceLocationType = $request->input('service_location_type');
        $serviceProviderLocation = $request->input('service_provider_location');
        if (is_array($serviceProviderLocation)) {
            $serviceProviderLocation = [
                'name' => trim((string) ($serviceProviderLocation['name'] ?? '')),
                'address' => trim((string) ($serviceProviderLocation['address'] ?? '')),
                'extraDetails' => trim((string) ($serviceProviderLocation['extraDetails'] ?? '')),
                'lat' => $serviceProviderLocation['lat'] ?? null,
                'lng' => $serviceProviderLocation['lng'] ?? null,
            ];
        }
        $serviceArea = collect($request->input('service_area', []))
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->values()
            ->all();
        $serviceClientRequirements = $request->input('service_client_requirements');
        $serviceIntakeForm = collect($request->input('service_intake_form', []))
            ->map(function (array $field) {
                $options = collect($field['options'] ?? [])
                    ->map(fn ($value) => trim((string) $value))
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'id' => trim((string) ($field['id'] ?? '')),
                    'type' => $field['type'] ?? 'text',
                    'label' => trim((string) ($field['label'] ?? '')),
                    'required' => (bool) ($field['required'] ?? false),
                    'placeholder' => trim((string) ($field['placeholder'] ?? '')),
                    'options' => $options,
                ];
            })
            ->filter(fn (array $field) => $field['id'] !== '' && $field['label'] !== '')
            ->values()
            ->all();
        $serviceBookingProvider = $request->input('service_booking_provider', 'manual');
        $serviceBookingMode = $request->input('service_booking_mode');
        $serviceContactChannel = $request->input('service_contact_channel');
        $serviceContactValue = $request->input('service_contact_value');

        if ($request->input('type') === 'service') {
            $serviceMode = $serviceMode ?: $this->legacyServiceModeFromRequest($servicePricingModel, $serviceIsShowcase, $productUrl);
            $servicePriceDisplay = $servicePriceDisplay ?: $this->legacyServicePriceDisplayFromRequest($servicePricingModel);

            if (in_array($serviceMode, ['showcase_only', 'request_quote'], true)) {
                $serviceIsShowcase = $serviceMode === 'showcase_only';
                $servicePricingModel = $serviceMode === 'request_quote' ? 'contract_quote' : 'showcase_only';
            } elseif ($servicePriceDisplay === 'hourly') {
                $servicePricingModel = 'hourly_rate';
            } elseif ($serviceDepositAmount !== null && $serviceDepositAmount !== '') {
                $servicePricingModel = 'deposit_required';
            } else {
                $servicePricingModel = 'fixed_price';
            }

            if ($serviceMode === 'external_booking' || $serviceSchedulingType === 'external') {
                $serviceBookingProvider = 'external';
                $serviceBookingMode = 'external';
            }

            if ($servicePricingModel === 'hourly_rate' && ($serviceHourlyRate === null || $serviceHourlyRate === '')) {
                return response()->json(['message' => 'Service ya hourly inahitaji rate kwa saa.'], 422);
            }

            if ($servicePricingModel === 'deposit_required' && ($serviceDepositAmount === null || $serviceDepositAmount === '')) {
                return response()->json(['message' => 'Service ya deposit inahitaji kiasi cha deposit.'], 422);
            }

            $usesTakeerBooking = $serviceBookingMode === 'takeer'
                || (in_array($serviceSchedulingType, ['recurring', 'fixed_sessions'], true) && $serviceBookingProvider !== 'external');

            if (in_array($serviceMode, ['showcase_only', 'request_quote', 'pay_now'], true)
                && ! $usesTakeerBooking
                && $serviceBookingProvider !== 'external'
                && empty($serviceContactValue)
                && empty($productUrl)
            ) {
                return response()->json(['message' => 'Tafadhali weka njia ya mawasiliano kwa huduma hii.'], 422);
            }

            if (($serviceMode === 'external_booking' || $serviceSchedulingType === 'external' || $serviceBookingProvider === 'external') && empty($productUrl)) {
                return response()->json(['message' => 'Tafadhali weka link ya booking.'], 422);
            }
        } else {
            $servicePricingModel = 'fixed_price';
            $serviceBookingType = 'instant';
            $serviceHourlyRate = null;
            $serviceMinHours = null;
            $serviceDepositAmount = null;
            $serviceIsShowcase = false;
            $serviceMode = 'pay_now';
            $serviceCategory = null;
            $serviceSubcategory = null;
            $servicePriceDisplay = 'fixed';
            $serviceCharges = [];
            $serviceOptions = [];
            $serviceDurationMinutes = null;
            $serviceLocationType = null;
            $serviceProviderLocation = null;
            $serviceArea = [];
            $serviceClientRequirements = null;
            $serviceIntakeForm = [];
            $serviceBookingProvider = 'manual';
            $serviceContactChannel = null;
            $serviceContactValue = null;
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
            'service_mode' => $serviceMode ?: 'pay_now',
            'service_scheduling_type' => $serviceSchedulingType ?: $this->defaultServiceSchedulingType($serviceMode, $request->input('service_booking_provider')),
            'service_category' => $serviceCategory,
            'service_subcategory' => $serviceSubcategory,
            'service_price_display' => $servicePriceDisplay ?: 'fixed',
            'service_charges' => $serviceCharges,
            'service_options' => $serviceOptions,
            'service_duration_minutes' => $serviceDurationMinutes !== null && $serviceDurationMinutes !== '' ? (int) $serviceDurationMinutes : null,
            'service_location_type' => $serviceLocationType,
            'service_provider_location' => in_array($serviceLocationType, ['provider_location', 'hybrid'], true) ? $serviceProviderLocation : null,
            'service_area' => $serviceArea,
            'service_client_requirements' => $serviceClientRequirements,
            'service_intake_form' => $serviceIntakeForm,
            'service_booking_provider' => $serviceBookingProvider ?: 'manual',
            'service_contact_channel' => $serviceContactChannel,
            'service_contact_value' => $serviceContactValue,
            'shipping_profile_id' => $shippingProfileId,
        ];

        if ($request->filled('product_id')) {
            $product = Product::query()
                ->where('merchant_id', $merchantProfile->id)
                ->findOrFail($request->input('product_id'));
            $product->update($productData);
            // For simplicity, we create a NEW post every time it's "published" to the feed,
            // but we update the product record itself.
            // We DO NOT delete images here, to preserve relations for old posts.
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
            'source' => 'catalog_publish',
            'title' => $request->input('title'),
            'caption' => $request->input('description') ?: $request->input('title'),
            'excerpt' => $request->input('description'),
        ]);

        // 4.5 Store detailed records for each image in the gallery
        if (count($mediaItems) > 0) {
            $incomingHotspots = $request->input('hotspots', []); // { [index]: [...] }
            foreach ($mediaItems as $index => $mediaItem) {
                $productImage = ProductImage::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'order' => $index,
                    ],
                    [
                        'image_url' => $mediaItem['url'],
                        'media_type' => $mediaItem['media_type'],
                        'thumbnail_url' => $mediaItem['thumbnail_url'],
                        'processed_url' => $mediaItem['processed_url'],
                        'hls_url' => $mediaItem['hls_url'],
                        'mime' => $mediaItem['mime'],
                        'size' => $mediaItem['size'],
                        'duration_seconds' => $mediaItem['duration_seconds'],
                        'width' => $mediaItem['width'],
                        'height' => $mediaItem['height'],
                        'processing_status' => $mediaItem['processing_status'],
                        'hotspots' => $mediaItem['media_type'] === 'image' ? ($incomingHotspots[$index] ?? []) : [],
                    ]
                );

                // Create PostMedia linking to the ProductImage
                $postMedia = $post->media()->create([
                    'product_image_id' => $productImage->id,
                    'media_url' => $mediaItem['url'], // Fallback if product media is deleted
                    'media_type' => $mediaItem['media_type'],
                    'thumbnail_url' => $mediaItem['thumbnail_url'],
                    'processed_url' => $mediaItem['processed_url'],
                    'hls_url' => $mediaItem['hls_url'],
                    'mime' => $mediaItem['mime'],
                    'size' => $mediaItem['size'],
                    'duration_seconds' => $mediaItem['duration_seconds'],
                    'width' => $mediaItem['width'],
                    'height' => $mediaItem['height'],
                    'processing_status' => $mediaItem['processing_status'],
                ]);

                if ($mediaItem['media_type'] === 'video') {
                    ProcessPromotableVideo::dispatch($productImage->id, $postMedia->id)->afterCommit();
                }
            }

            // Cleanup any extra images if the count decreased
            $product->images()->where('order', '>=', count($mediaItems))->delete();
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

                // Ensure value_text is populated from value_json for select types if missing
                if (empty($rawValueText) && !empty($rawValueJson) && is_array($rawValueJson)) {
                    $rawValueText = $rawValueJson[0] ?? null;
                }

                return [
                    'product_id' => $product->id,
                    'category_attribute_id' => (int) $item['category_attribute_id'],
                    'value_text' => $rawValueText,
                    'value_number' => $item['value_number'] ?? null,
                    'value_boolean' => (array_key_exists('value_boolean', $item) && $item['value_boolean'] !== null) ? (bool) $item['value_boolean'] : null,
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
        $merchantProfile = $this->merchantFromRequest($request);
        $product = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->findOrFail($id);

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

        $merchantProfile = $this->merchantFromRequest($request);
        $product = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->findOrFail($id);
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

    private function isFreePostMediaUpload(string $folder, bool $isPrivate): bool
    {
        if ($isPrivate) {
            return false;
        }

        return in_array($folder, ['posts', 'content', 'avatars'], true);
    }

    private function serviceTrustRequirementBlock(Request $request, ?Merchant $merchant): ?JsonResponse
    {
        if (! $merchant) {
            return response()->json(['message' => 'Tafadhali tengeneza biashara kwanza.'], 403);
        }

        $categoryName = trim((string) $request->input('service_category', ''));
        $subcategoryName = trim((string) $request->input('service_subcategory', ''));

        if ($categoryName === '') {
            return response()->json([
                'message' => 'Tafadhali chagua category ya huduma ili Takeer iweze kutumia kanuni sahihi za usalama.',
            ], 422);
        }

        $category = $this->serviceCategoryForTrust($categoryName, $subcategoryName);
        if (! $category) {
            return response()->json([
                'message' => 'Category ya huduma haijatambulika. Tafadhali chagua tena category kwenye orodha.',
            ], 422);
        }

        if ($category->parent_id === null && $category->children()->exists() && $subcategoryName === '') {
            return response()->json([
                'message' => 'Tafadhali chagua subcategory ya huduma ili Takeer iweze kutumia kanuni sahihi za usalama.',
            ], 422);
        }

        $merchant->loadMissing('kyc');
        $kyc = $merchant->kyc;
        $kycApproved = in_array(strtolower((string) $merchant->kyc_status), ['approved', 'verified'], true)
            && $kyc
            && in_array(strtolower((string) $kyc->status), ['approved', 'verified'], true);

        $requiredDocuments = collect($category->required_documents ?: ['identity'])
            ->map(fn ($document) => (string) $document)
            ->filter()
            ->unique()
            ->values();

        if ($requiredDocuments->contains('identity') && ! $kycApproved) {
            return response()->json([
                'message' => 'Huduma zinahitaji KYC iliyothibitishwa kabla ya kuchapishwa. Tafadhali kamilisha Verification Center kwanza.',
                'verification_url' => "/merchant/{$merchant->username}/verification",
            ], 403);
        }

        $missing = $requiredDocuments
            ->reject(fn ($document) => $this->merchantHasTrustDocument($document, $kyc, $merchant, $category))
            ->values();

        if ($missing->isNotEmpty()) {
            return response()->json([
                'message' => 'Huduma hii inahitaji nyaraka zaidi kabla ya kuchapishwa: ' . $this->trustDocumentLabels($missing->all()) . '. Tafadhali zipakie Verification Center.',
                'verification_url' => "/merchant/{$merchant->username}/verification",
                'missing_documents' => $missing->all(),
            ], 403);
        }

        if ($category->requires_manual_review && ! $kycApproved) {
            return response()->json([
                'message' => 'Huduma hii inahitaji review ya Takeer kabla ya kuchapishwa. Tafadhali kamilisha Verification Center kwanza.',
                'verification_url' => "/merchant/{$merchant->username}/verification",
            ], 403);
        }

        $firstQuoteLimit = $category->max_first_quote_amount !== null ? (float) $category->max_first_quote_amount : null;
        $requestedPrice = (float) ($request->input('price') ?? 0);
        if ($firstQuoteLimit && $requestedPrice > $firstQuoteLimit) {
            $merchantOrderCount = Order::query()
                ->where('merchant_id', $merchant->id)
                ->whereNotIn('payment_status', ['pending', 'failed', 'cancelled'])
                ->count();

            if ($merchantOrderCount === 0) {
                return response()->json([
                    'message' => 'Kwa usalama wa wateja, huduma hii ina kikomo cha bei kwa mtoa huduma mpya. Punguza bei au wasiliana na Takeer kwa review.',
                ], 403);
            }
        }

        return null;
    }

    private function serviceCategoryForTrust(string $categoryName, string $subcategoryName): ?ServiceCategory
    {
        $parent = ServiceCategory::query()
            ->whereNull('parent_id')
            ->whereRaw('LOWER(name) = ?', [Str::lower($categoryName)])
            ->first();

        if (! $parent) {
            return null;
        }

        if ($subcategoryName !== '') {
            $child = ServiceCategory::query()
                ->where('parent_id', $parent->id)
                ->whereRaw('LOWER(name) = ?', [Str::lower($subcategoryName)])
                ->first();

            if ($child) {
                return $child;
            }

            return null;
        }

        return $parent;
    }

    private function merchantHasTrustDocument(string $document, mixed $kyc, Merchant $merchant, ServiceCategory $category): bool
    {
        if (! $kyc) {
            return false;
        }

        return match ($document) {
            'identity' => filled($kyc->id_front_url) && filled($kyc->id_back_url),
            'tin' => filled($kyc->tin_document_url),
            'business_license' => filled($kyc->business_license_url) || filled($kyc->registration_doc_url),
            'registration' => filled($kyc->registration_doc_url),
            'professional_license' => $this->merchantHasApprovedServiceCredential($merchant, $category),
            default => false,
        };
    }

    private function merchantHasApprovedServiceCredential(Merchant $merchant, ServiceCategory $category): bool
    {
        $categoryIds = array_filter([$category->id, $category->parent_id]);

        return MerchantServiceCredential::query()
            ->where('merchant_id', $merchant->id)
            ->where('status', 'verified')
            ->whereIn('service_category_id', $categoryIds)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhereDate('expires_at', '>=', now()->toDateString());
            })
            ->exists();
    }

    private function trustDocumentLabels(array $documents): string
    {
        $labels = [
            'identity' => 'kitambulisho',
            'tin' => 'TIN',
            'business_license' => 'leseni ya biashara',
            'registration' => 'usajili wa biashara',
            'professional_license' => 'leseni au cheti cha taaluma',
        ];

        return collect($documents)
            ->map(fn ($document) => $labels[$document] ?? $document)
            ->implode(', ');
    }

    private function legacyServiceModeFromRequest(?string $pricingModel, bool $isShowcase, ?string $productUrl): string
    {
        if ($isShowcase || $pricingModel === 'showcase_only') {
            return 'showcase_only';
        }

        if ($pricingModel === 'contract_quote') {
            return 'request_quote';
        }

        if (filled($productUrl) && preg_match('/^https?:\/\//i', (string) $productUrl)) {
            return 'external_booking';
        }

        return 'pay_now';
    }

    private function legacyServicePriceDisplayFromRequest(?string $pricingModel): string
    {
        return match ($pricingModel) {
            'hourly_rate' => 'hourly',
            'contract_quote', 'showcase_only' => 'quote_only',
            default => 'fixed',
        };
    }

    private function defaultServiceSchedulingType(?string $serviceMode, ?string $bookingProvider): string
    {
        if ($serviceMode === 'book_appointment') {
            return 'recurring';
        }

        if ($serviceMode === 'external_booking' || $bookingProvider === 'external') {
            return 'external';
        }

        return 'none';
    }

    private function merchantFromRequest(Request $request): Merchant
    {
        $routeMerchant = $request->route('merchant');
        if ($routeMerchant instanceof Merchant) {
            return $routeMerchant;
        }

        $user = $request->user();
        $merchantId = $request->input('merchant_id') ?? $request->query('merchant_id') ?? session('active_merchant_id');
        if ($merchantId) {
            $merchant = $user->merchantProfiles()->where('merchants.id', (int) $merchantId)->first();
            if ($merchant) {
                return $merchant;
            }
        }

        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        abort_unless($merchant, 403, 'Merchant profile not found.');

        return $merchant;
    }

    private function merchantFromRequestOrNull(Request $request): ?Merchant
    {
        $routeMerchant = $request->route('merchant');
        if ($routeMerchant instanceof Merchant) {
            return $routeMerchant;
        }

        $user = $request->user();
        if (! $user) {
            return null;
        }

        $merchantId = $request->input('merchant_id') ?? $request->query('merchant_id') ?? session('active_merchant_id');
        if ($merchantId) {
            $merchant = $user->merchantProfiles()->where('merchants.id', (int) $merchantId)->first();
            if ($merchant) {
                return $merchant;
            }
        }

        return $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();
    }
}
