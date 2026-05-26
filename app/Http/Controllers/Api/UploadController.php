<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Forwarder;
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
use App\Models\MerchantGroupSaleCampaign;
use App\Models\MerchantLocationable;
use App\Jobs\ProcessPremiumProductVideo;
use App\Jobs\ProcessPromotableVideo;
use App\Http\Resources\ProductResource;
use App\Services\EntitlementService;
use App\Services\GalleryImageService;
use App\Services\MediaUploadService;
use App\Services\ProductIntelligenceService;
use App\Support\MerchantPermissions;
use App\Support\ServiceTemplateRegistry;
use App\Support\GeographyResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Exception;

class UploadController extends Controller
{
    private const DEFAULT_UPLOAD_EXTENSIONS = 'jpg,jpeg,png,webp,gif,mp4,mov,webm,mp3,wav,m4a,aac,ogg,flac,pdf,zip,rar,7z,doc,docx,xls,xlsx,ppt,pptx,csv,txt,epub,psd,ai,eps,svg,fig,sketch,xd,indd,ase,abr,pat,atn,xmp,lrtemplate,dng,otf,ttf,woff,woff2,aep,prproj,fcpxml,blend,c4d,obj,fbx,glb,gltf';
    private const DEFAULT_UPLOAD_MIME_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/vnd.adobe.photoshop,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/flac,application/pdf,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain,application/epub+zip,application/postscript,application/illustrator,application/vnd.ms-fontobject,font/otf,font/ttf,font/woff,font/woff2,application/octet-stream,model/gltf+json,model/gltf-binary';

    /**
     * List all products for the logged-in merchant.
     */
    public function index(Request $request): JsonResponse
    {
        $merchantProfile = $this->merchantFromRequest($request);
        $status = $request->input('status'); // optional filter: all|published|draft
        $type = $request->input('type'); // optional filter: physical|digital|service
        $module = $request->input('module'); // optional filter: menu, rooms, etc.

        $query = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->with(['attributes.brand', 'attributes.model', 'images', 'categoryAttributeValues.categoryAttribute', 'unitType', 'packageContentUnitType', 'returnPolicy', 'faqs', 'serviceCategory.parent', 'serviceSubcategory.parent', 'locationAvailabilities.location', 'createdByUser:id,name', 'createdByStaff:id,display_name,job_title,user_id'])
            ->with(['variants', 'postTags.post:id,views_count'])
            ->withCount('postTags')
            ->withCount([
                'orders as purchases_count' => fn ($orders) => $orders->whereNotIn('payment_status', ['pending', 'failed']),
            ])
            ->latest();

        if (in_array($type, ['physical', 'digital', 'service'], true)) {
            $query->where('products.type', $type);
        }

        if (in_array($module, ['menu', 'rooms', 'tour_departures', 'custom_orders', 'appointments', 'reservations', 'rentals', 'workshops', 'forwarders'], true) && Schema::hasColumn('products', 'module_key')) {
            $query->where('products.module_key', $module);
        }

        if ($status === 'published') {
            $query->has('postTags');
        } elseif ($status === 'draft') {
            $query->doesntHave('postTags');
        }

        $products = $query->paginate(20);

        return ProductResource::collection($products)->response();
    }

    public function show(Request $request, Merchant|string|int|null $merchantOrId = null, string|int|null $id = null): JsonResponse
    {
        $merchantProfile = $this->merchantFromRequest($request);
        $productId = $id ?? $merchantOrId;
        $product = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->with(['attributes.brand', 'attributes.model', 'images', 'categoryAttributeValues.categoryAttribute', 'unitType', 'packageContentUnitType', 'returnPolicy', 'faqs', 'serviceCategory.parent', 'serviceSubcategory.parent', 'variants.locationInventories.location', 'locationInventories.location', 'locationAvailabilities.location', 'postTags.post:id,views_count', 'createdByUser:id,name', 'createdByStaff:id,display_name,job_title,user_id'])
            ->withCount('postTags')
            ->withCount([
                'orders as purchases_count' => fn ($orders) => $orders->whereNotIn('payment_status', ['pending', 'failed']),
            ])
            ->findOrFail($productId);

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
            ->get(['id', 'parent_id', 'name', 'localized_labels', 'slug', 'risk_level', 'allowed_fulfillment_modes', 'requires_verified_business', 'requires_manual_review']);

        $topLevel = $categories->whereNull('parent_id')->values();
        $childrenByParent = $categories->whereNotNull('parent_id')->groupBy('parent_id');

        $selectedCategoryId = (int) $request->input('category_id', 0);
        $selectedCategory = $selectedCategoryId > 0
            ? ProductCategory::with(['attributes', 'brands.models', 'brandModels', 'unitTypes'])->find($selectedCategoryId)
            : null;

        return response()->json([
            'categories' => $topLevel->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'localized_labels' => $category->localized_labels ?? [],
                'slug' => $category->slug,
                'risk_level' => $category->risk_level ?? 'standard',
                'allowed_fulfillment_modes' => $category->allowed_fulfillment_modes ?? [],
                'requires_verified_business' => (bool) ($category->requires_verified_business ?? false),
                'requires_manual_review' => (bool) ($category->requires_manual_review ?? false),
                'children' => ($childrenByParent[$category->id] ?? collect())->map(fn ($child) => [
                    'id' => $child->id,
                    'name' => $child->name,
                    'localized_labels' => $child->localized_labels ?? [],
                    'slug' => $child->slug,
                    'risk_level' => $child->risk_level ?? $category->risk_level ?? 'standard',
                    'allowed_fulfillment_modes' => $child->allowed_fulfillment_modes ?? $category->allowed_fulfillment_modes ?? [],
                    'requires_verified_business' => (bool) ($child->requires_verified_business ?? $category->requires_verified_business ?? false),
                    'requires_manual_review' => (bool) ($child->requires_manual_review ?? $category->requires_manual_review ?? false),
                ])->values(),
            ])->values(),
            'selected' => $selectedCategory ? [
                'id' => $selectedCategory->id,
                'name' => $selectedCategory->name,
                'localized_labels' => $selectedCategory->localized_labels ?? [],
                'risk_level' => $selectedCategory->risk_level ?? 'standard',
                'allowed_fulfillment_modes' => $selectedCategory->allowed_fulfillment_modes ?? [],
                'requires_verified_business' => (bool) ($selectedCategory->requires_verified_business ?? false),
                'requires_manual_review' => (bool) ($selectedCategory->requires_manual_review ?? false),
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

                    return [
                        'id' => $brand->id,
                        'name' => $brand->name,
                        'models' => $modelsByBrand->map(fn ($model) => [
                            'id' => $model->id,
                            'name' => $model->name,
                        ])->values(),
                    ];
                })->values(),
                'unit_types' => $selectedCategory->unitTypes->map(fn ($unit) => [
                    'id' => $unit->id,
                    'name' => $unit->name,
                    'code' => $unit->code,
                    'symbol' => $unit->symbol,
                    'unit_category' => $unit->unit_category,
                    'base_unit_code' => $unit->base_unit_code,
                    'conversion_factor_to_base' => (float) $unit->conversion_factor_to_base,
                    'allows_decimal' => (bool) $unit->allows_decimal,
                    'localized_labels' => $unit->localized_labels ?? [],
                    'common_quantities' => $unit->common_quantities ?? [],
                    'is_default' => (bool) ($unit->pivot?->is_default ?? false),
                    'min_order_quantity' => $unit->pivot?->min_order_quantity !== null ? (float) $unit->pivot->min_order_quantity : null,
                    'order_increment' => $unit->pivot?->order_increment !== null ? (float) $unit->pivot->order_increment : null,
                ])->values(),
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
        if ($request->has('chunk_index') || $request->has('upload_id')) {
            return $this->uploadMediaChunk($request, $mediaService, $quotaService);
        }

        $folder = (string) $request->input('folder', '');
        $configuredMaxMb = (int) AdminSetting::get('upload_max_file_mb', 500);
        $maxFileMb = in_array($folder, ['premium-videos', 'premium-audio', 'premium-gallery'], true)
            ? max(1, min(5120, max($configuredMaxMb, 2048)))
            : max(1, min(500, $configuredMaxMb));

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
                'message' => 'Complete KYC before uploading product or private commerce files.',
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

    private function uploadMediaChunk(Request $request, MediaUploadService $mediaService, \App\Services\StorageQuotaService $quotaService): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:65536',
            'upload_id' => 'required|string|max:80|regex:/^[A-Za-z0-9_-]+$/',
            'chunk_index' => 'required|integer|min:0',
            'total_chunks' => 'required|integer|min:1|max:10000',
            'original_name' => 'required|string|max:255',
            'mime' => 'nullable|string|max:255',
            'folder' => 'required|string|in:digital-products,premium-videos,premium-audio,premium-gallery',
            'type' => 'nullable|string|in:public,private',
        ]);

        $chunkIndex = (int) $request->input('chunk_index');
        $totalChunks = (int) $request->input('total_chunks');

        if ($chunkIndex >= $totalChunks) {
            return response()->json(['message' => 'Chunk index si sahihi.'], 422);
        }

        $merchant = $this->merchantFromRequest($request);
        if ($merchant && ! $merchant->canSellProducts()) {
            return response()->json([
                'message' => 'Complete KYC before uploading product or private commerce files.',
                'verification_url' => "/merchant/{$merchant->username}/verification",
            ], 403);
        }

        $uploadId = (string) $request->input('upload_id');
        $chunkDir = storage_path('app/private/upload-chunks/'.$uploadId);
        File::ensureDirectoryExists($chunkDir, 0755, true);

        $request->file('file')->move($chunkDir, 'chunk.'.$chunkIndex);

        $receivedChunks = 0;
        for ($i = 0; $i < $totalChunks; $i++) {
            if (File::exists($chunkDir.'/chunk.'.$i)) {
                $receivedChunks++;
            }
        }

        if ($receivedChunks < $totalChunks) {
            return response()->json([
                'complete' => false,
                'received_chunks' => $receivedChunks,
                'total_chunks' => $totalChunks,
            ]);
        }

        $extension = strtolower(pathinfo((string) $request->input('original_name'), PATHINFO_EXTENSION));
        $finalName = Str::uuid().($extension ? '.'.$extension : '');
        $finalPath = $chunkDir.'/'.$finalName;
        $output = fopen($finalPath, 'wb');

        if (!$output) {
            File::deleteDirectory($chunkDir);
            return response()->json(['message' => 'Imeshindwa kuunganisha video chunks.'], 500);
        }

        try {
            for ($i = 0; $i < $totalChunks; $i++) {
                $input = fopen($chunkDir.'/chunk.'.$i, 'rb');
                if (!$input) {
                    throw new Exception('Chunk haikupatikana.');
                }
                stream_copy_to_stream($input, $output);
                fclose($input);
            }
        } catch (Exception) {
            fclose($output);
            File::deleteDirectory($chunkDir);
            return response()->json(['message' => 'Imeshindwa kuunganisha video chunks.'], 500);
        }

        fclose($output);

        $assembled = new UploadedFile(
            $finalPath,
            (string) $request->input('original_name'),
            $request->input('mime') ?: (mime_content_type($finalPath) ?: null),
            null,
            true
        );
        $this->ensureUploadIsAllowed($assembled);

        try {
            $size = filesize($finalPath) ?: 0;
            if ($merchant && !$quotaService->canUpload($merchant, $size)) {
                return response()->json([
                    'message' => 'Nafasi yako ya kuhifadhi faili imejaa (Storage Full). Tafadhali bofya "Upgrade Storage" ili kuongeza nafasi.',
                    'quota_exceeded' => true,
                ], 403);
            }

            $storedPath = $mediaService->uploadFile($assembled, (string) $request->input('folder'), true);
            if ($merchant) {
                $quotaService->recordUpload($merchant, $size);
            }
        } finally {
            File::deleteDirectory($chunkDir);
        }

        $normalizedUrl = str_starts_with($storedPath, 'private://') ? $storedPath : "private://{$storedPath}";

        return response()->json([
            'complete' => true,
            'url' => $normalizedUrl,
            'mime' => $request->input('mime') ?: $assembled->getMimeType(),
            'size' => $size,
            'storage_used_mb' => $merchant ? $merchant->fresh()->storage_used_mb : 0,
            'storage_percentage' => $merchant ? $merchant->fresh()->storage_percentage : 0,
        ]);
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

    private function mediaItemsFromRequest(Request $request): array
    {
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

        return $mediaItems;
    }

    private function syncProductDraftMedia(Product $product, array $mediaItems, array $hotspots = []): void
    {
        foreach ($mediaItems as $index => $mediaItem) {
            ProductImage::updateOrCreate(
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
                    'hotspots' => $mediaItem['media_type'] === 'image' ? ($hotspots[$index] ?? []) : [],
                ]
            );
        }

        $product->images()->where('order', '>=', count($mediaItems))->delete();

        if (count($mediaItems) > 0) {
            $first = $mediaItems[0];
            $product->forceFill([
                'url' => $first['thumbnail_url'] ?: $first['url'],
            ])->save();
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
            'media_items' => 'nullable|array',
            'image_urls' => 'nullable|array',
            'hotspots' => 'nullable|array',
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

        $actingStaff = $request->user()
            ? MerchantPermissions::staffFor($request->user(), $merchantProfile)
            : null;

        // 2. Draft the product in the database
        $product = Product::create([
            'merchant_id' => $merchantProfile->id,
            'created_by_user_id' => $request->user()?->id,
            'created_by_staff_id' => $actingStaff?->id,
            'title' => $aiTags['category'] . ' - ' . ($aiTags['sub_category'] ?? 'Mpya'),
            'price' => 0,
            'inventory_count' => 0,
            'buffer_stock' => 0,
            'slug' => Str::slug($aiTags['category'] . ' ' . ($aiTags['sub_category'] ?? 'mpya')) . '-' . time(),
            'url' => $imageUrl,
        ]);

        $mediaItems = $this->mediaItemsFromRequest($request);
        if (count($mediaItems) === 0) {
            $mediaItems = [$this->normalizePromotableMediaItem(['url' => $imageUrl, 'type' => 'image'])];
        }
        $this->syncProductDraftMedia($product, $mediaItems, (array) $request->input('hotspots', []));

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
            'media_items' => 'nullable|array',
            'image_urls' => 'nullable|array',
            'hotspots' => 'nullable|array',
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

        $actingStaff = $request->user()
            ? MerchantPermissions::staffFor($request->user(), $merchantProfile)
            : null;

        $product = Product::create([
            'merchant_id' => $merchantProfile->id,
            'created_by_user_id' => $request->user()?->id,
            'created_by_staff_id' => $actingStaff?->id,
            'title' => $request->input('title'),
            'price' => 0,
            'inventory_count' => 0,
            'buffer_stock' => 0,
            'slug' => Str::slug($request->input('title')) . '-' . time(),
        ]);

        $mediaItems = $this->mediaItemsFromRequest($request);
        if (count($mediaItems) > 0) {
            $this->syncProductDraftMedia($product, $mediaItems, (array) $request->input('hotspots', []));
        }

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

    public function syncDraftMedia(Request $request, Product $product): JsonResponse
    {
        $merchantProfile = $this->merchantFromRequest($request);

        abort_unless((int) $product->merchant_id === (int) $merchantProfile->id, 404);

        $request->validate([
            'media_items' => 'nullable|array',
            'image_urls' => 'nullable|array',
            'hotspots' => 'nullable|array',
        ]);

        $mediaItems = $this->mediaItemsFromRequest($request);
        $this->syncProductDraftMedia($product, $mediaItems, (array) $request->input('hotspots', []));

        return ProductResource::make($product->fresh(['images']))->response();
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
            'module_key' => 'nullable|string|in:menu,rooms,tour_departures,custom_orders,appointments,reservations,rentals,workshops,forwarders',
            'module_details' => 'nullable|array',
            'module_details.section' => 'nullable|string|max:80',
            'module_details.item_type' => 'nullable|string|max:80',
            'module_details.prep_time_minutes' => 'nullable|integer|min:0|max:1440',
            'module_details.dietary_tags' => 'nullable|array',
            'module_details.dietary_tags.*' => 'string|max:40',
            'module_details.availability' => 'nullable|array',
            'module_details.availability.*' => 'string|max:80',
            'module_details.add_ons' => 'nullable|array',
            'module_details.add_ons.*.name' => 'nullable|string|max:120',
            'module_details.add_ons.*.price' => 'nullable|numeric|min:0',
            'module_details.room_type' => 'nullable|string|max:80',
            'module_details.bed_type' => 'nullable|string|max:80',
            'module_details.max_guests' => 'nullable|integer|min:1|max:100000',
            'module_details.room_count' => 'nullable|integer|min:1|max:100000',
            'module_details.bathrooms' => 'nullable|numeric|min:0|max:1000',
            'module_details.checkin_time' => 'nullable|date_format:H:i',
            'module_details.checkout_time' => 'nullable|date_format:H:i',
            'module_details.amenities' => 'nullable|array',
            'module_details.amenities.*' => 'string|max:80',
            'module_details.booking_policy' => 'nullable|string|max:80',
            'module_details.destination' => 'nullable|string|max:160',
            'module_details.duration_label' => 'nullable|string|max:80',
            'module_details.pickup_point' => 'nullable|string|max:160',
            'module_details.dropoff_point' => 'nullable|string|max:160',
            'module_details.group_size' => 'nullable|integer|min:1|max:100000',
            'module_details.departure_type' => 'nullable|string|max:80',
            'module_details.itinerary' => 'nullable|array',
            'module_details.itinerary.*.day' => 'nullable|integer|min:1|max:365',
            'module_details.itinerary.*.title' => 'nullable|string|max:160',
            'module_details.itinerary.*.description' => 'nullable|string|max:500',
            'module_details.included' => 'nullable|array',
            'module_details.included.*' => 'string|max:160',
            'module_details.excluded' => 'nullable|array',
            'module_details.excluded.*' => 'string|max:160',
            'module_details.requirements' => 'nullable|string|max:3000',
            'module_details.customization_notes' => 'nullable|string|max:3000',
            'module_details.lead_time' => 'nullable|string|max:160',
            'module_details.pickup_delivery_notes' => 'nullable|string|max:3000',
            'module_details.quote_policy' => 'nullable|string|max:160',
            'module_details.minimum_order' => 'nullable|integer|min:1|max:100000',
            'module_details.appointment_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'module_details.buffer_minutes' => 'nullable|integer|min:0|max:10080',
            'module_details.capacity' => 'nullable|integer|min:1|max:100000',
            'module_details.appointment_location_mode' => 'nullable|string|max:80',
            'module_details.preparation_notes' => 'nullable|string|max:3000',
            'module_details.reservation_type' => 'nullable|string|max:80',
            'module_details.seating_type' => 'nullable|string|max:80',
            'module_details.reservation_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'module_details.party_size_limit' => 'nullable|integer|min:1|max:100000',
            'module_details.reservation_policy' => 'nullable|string|max:80',
            'module_details.deposit_amount' => 'nullable|numeric|min:0',
            'module_details.deposit_note' => 'nullable|string|max:1000',
            'module_details.reservation_notes' => 'nullable|string|max:3000',
            'module_details.rental_type' => 'nullable|string|max:80',
            'module_details.rental_unit' => 'nullable|string|max:80',
            'module_details.rental_duration_minutes' => 'nullable|integer|min:1|max:5256000',
            'module_details.available_units' => 'nullable|integer|min:1|max:100000',
            'module_details.security_deposit' => 'nullable|numeric|min:0',
            'module_details.rental_policy' => 'nullable|string|max:80',
            'module_details.pickup_return_notes' => 'nullable|string|max:3000',
            'module_details.included_items' => 'nullable|array',
            'module_details.included_items.*' => 'string|max:160',
            'module_details.rental_requirements' => 'nullable|string|max:3000',
            'module_details.workshop_format' => 'nullable|string|max:80',
            'module_details.session_count' => 'nullable|integer|min:1|max:1000',
            'module_details.workshop_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'module_details.workshop_capacity' => 'nullable|integer|min:1|max:100000',
            'module_details.workshop_level' => 'nullable|string|max:80',
            'module_details.enrollment_policy' => 'nullable|string|max:80',
            'module_details.workshop_location_mode' => 'nullable|string|max:80',
            'module_details.workshop_start_note' => 'nullable|string|max:160',
            'module_details.learning_outcomes' => 'nullable|array',
            'module_details.learning_outcomes.*' => 'string|max:160',
            'module_details.workshop_requirements' => 'nullable|array',
            'module_details.workshop_requirements.*' => 'string|max:160',
            'module_details.materials_included' => 'nullable|array',
            'module_details.materials_included.*' => 'string|max:160',
            'module_details.legal_name' => 'nullable|string|max:160',
            'module_details.contact_person' => 'nullable|string|max:120',
            'module_details.contact_email' => 'nullable|email|max:160',
            'module_details.whatsapp_phone' => 'nullable|string|max:40',
            'module_details.website' => 'nullable|string|max:2048',
            'module_details.logo_url' => 'nullable|string|max:2048',
            'module_details.service_types' => 'nullable|array',
            'module_details.service_types.*' => 'string|max:80',
            'module_details.required_fields' => 'nullable|array',
            'module_details.required_fields.*' => 'string|max:80',
            'module_details.origin_locations' => 'nullable|array',
            'module_details.origin_locations.*.name' => 'nullable|string|max:120',
            'module_details.origin_locations.*.country_name' => 'nullable|string|max:120',
            'module_details.origin_locations.*.country_iso2' => 'nullable|string|max:2',
            'module_details.origin_locations.*.state_name' => 'nullable|string|max:120',
            'module_details.origin_locations.*.city_name' => 'nullable|string|max:120',
            'module_details.origin_locations.*.address_line' => 'nullable|string|max:500',
            'module_details.origin_locations.*.contact_phone' => 'nullable|string|max:40',
            'module_details.origin_locations.*.instructions' => 'nullable|string|max:1000',
            'module_details.destination_locations' => 'nullable|array',
            'module_details.destination_locations.*.name' => 'nullable|string|max:120',
            'module_details.destination_locations.*.country_name' => 'nullable|string|max:120',
            'module_details.destination_locations.*.country_iso2' => 'nullable|string|max:2',
            'module_details.destination_locations.*.state_name' => 'nullable|string|max:120',
            'module_details.destination_locations.*.city_name' => 'nullable|string|max:120',
            'module_details.destination_locations.*.address_line' => 'nullable|string|max:500',
            'module_details.destination_locations.*.contact_phone' => 'nullable|string|max:40',
            'module_details.destination_locations.*.instructions' => 'nullable|string|max:1000',
            'module_details.merchant_instructions' => 'nullable|string|max:3000',
            'module_details.customer_instructions' => 'nullable|string|max:3000',
            'module_details.license_notes' => 'nullable|string|max:3000',
            'module_details.rates_info' => 'nullable|string|max:3000',
            'fulfillment_mode' => 'nullable|string|in:own_stock,made_to_order,supplier_sourced,farm_harvest,preorder,group_sale',
            'source_details' => 'nullable|array',
            'source_details.supplier_name' => 'nullable|string|max:160',
            'source_details.supplier_phone' => 'nullable|string|max:40',
            'source_details.supplier_location' => 'nullable|string|max:255',
            'source_details.confirmation_hours' => 'nullable|integer|min:0|max:8760',
            'source_details.source_note' => 'nullable|string|max:1000',
            'availability_lead_time_days' => 'nullable|integer|min:0|max:365',
            'available_from' => 'nullable|date',
            'group_sale_goal_quantity' => 'nullable|integer|min:2|max:1000000',
            'group_sale_deadline' => 'nullable|date',
            'price' => 'nullable|numeric|min:0',
            'title' => 'required|string|max:255',
            'category_id' => [Rule::requiredIf($request->input('type') === 'physical' && $request->input('module_key') !== 'menu'), 'nullable', 'integer', 'exists:product_categories,id'],
            'sub_category_id' => 'nullable|integer|exists:product_categories,id',
            'brand_id' => 'nullable|integer|exists:product_brands,id',
            'model_id' => 'nullable|integer|exists:product_brand_models,id',
            'has_variants' => 'nullable|boolean',
            'variants' => 'nullable|array',
            'variants.*.name' => 'nullable|string|max:140',
            'variants.*.sku' => 'nullable|string|max:80',
            'variants.*.price' => 'nullable|numeric|min:0',
            'variants.*.compare_price' => 'nullable|numeric|min:0',
            'variants.*.quantity' => 'nullable|numeric|min:0',
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
            'quantity' => 'nullable|numeric|min:0',
            'product_unit_type_id' => 'nullable|integer|exists:product_unit_types,id',
            'sellable_quantity' => 'nullable|numeric|min:0.001',
            'package_content_unit_type_id' => 'nullable|integer|exists:product_unit_types,id',
            'package_content_quantity' => 'nullable|numeric|min:0.001',
            'package_contents' => 'nullable|string|max:500',
            'package_content_items' => 'nullable|array',
            'package_content_items.*.qty' => 'nullable|numeric|min:0.001',
            'package_content_items.*.unit' => 'nullable|string|max:40',
            'package_content_items.*.name' => 'nullable|string|max:160',
            'return_policy_id' => 'nullable|integer|exists:merchant_return_policies,id',
            'faqs' => 'nullable|array',
            'faqs.*.question' => 'nullable|string|max:1000',
            'faqs.*.answer' => 'nullable|string|max:3000',
            'faqs.*.is_published' => 'nullable|boolean',
            'min_order_quantity' => 'nullable|numeric|min:0.001',
            'order_increment' => 'nullable|numeric|min:0.001',
            'url' => 'nullable|string',
            'digital_file_url' => 'nullable|string',
            'digital_delivery_type' => 'nullable|string|in:file,external_link,video_stream,audio_stream,gallery_pack,live_event,custom_delivery',
            'digital_content_type' => 'nullable|string|in:file,ebook,template_asset,creative_asset,audio,video,gallery,software,document,live_event,custom_commission',
            'digital_usage_license' => 'nullable|string|in:personal,commercial,extended_commercial,exclusive,custom',
            'digital_access_instructions' => 'nullable|string|max:5000',
            'license_key_enabled' => 'nullable|boolean',
            'license_key_prefix' => 'nullable|string|max:24',
            'license_activation_limit' => 'nullable|integer|min:1|max:50',
            'paid_video_url' => 'nullable|string|max:2048',
            'paid_video_mime' => 'nullable|string|max:255',
            'paid_video_size' => 'nullable|integer|min:0',
            'paid_video_duration_seconds' => 'nullable|integer|min:0',
            'paid_audio_url' => 'nullable|string|max:2048',
            'paid_audio_mime' => 'nullable|string|max:255',
            'paid_audio_size' => 'nullable|integer|min:0',
            'paid_audio_duration_seconds' => 'nullable|integer|min:0',
            'paid_gallery_items' => 'nullable|array',
            'paid_gallery_items.*.url' => 'required_with:paid_gallery_items|string|max:2048',
            'paid_gallery_items.*.preview_url' => 'nullable|string|max:2048',
            'paid_gallery_items.*.name' => 'nullable|string|max:255',
            'paid_gallery_items.*.mime' => 'nullable|string|max:255',
            'paid_gallery_items.*.size' => 'nullable|integer|min:0',
            'paid_gallery_items.*.preview_mime' => 'nullable|string|max:255',
            'paid_gallery_items.*.preview_size' => 'nullable|integer|min:0',
            'allow_download' => 'nullable|boolean',
            'refund_policy' => 'nullable|string|in:standard,strict,final_sale',
            'refund_window_days' => 'nullable|integer|min:0|max:30',
            'refund_policy_note' => 'nullable|string|max:1000',
            'live_event_starts_at' => 'nullable|date',
            'live_event_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'live_event_timezone' => ['nullable', 'timezone'],
            'live_event_access_url' => 'nullable|string|max:2048',
            'live_event_venue' => 'nullable|string|max:255',
            'live_event_capacity' => 'nullable|integer|min:1|max:100000',
            'live_event_replay_url' => 'nullable|string|max:2048',
            'live_event_instructions' => 'nullable|string|max:5000',
            'service_pricing_model' => 'nullable|string|in:fixed_price,hourly_rate,contract_quote,deposit_required,showcase_only',
            'service_booking_type' => 'nullable|string|in:instant,request,manual_confirm',
            'service_hourly_rate' => 'nullable|numeric|min:0',
            'service_min_hours' => 'nullable|integer|min:1',
            'service_deposit_amount' => 'nullable|numeric|min:0',
            'service_is_showcase' => 'nullable|boolean',
            'service_mode' => 'nullable|string|in:showcase_only,request_quote,book_appointment,pay_now,external_booking',
            'service_scheduling_type' => 'nullable|string|in:none,recurring,fixed_sessions,external',
            'service_category' => 'nullable|string|max:120',
            'service_category_id' => 'nullable|integer|exists:service_categories,id',
            'service_subcategory' => 'nullable|string|max:120',
            'service_subcategory_id' => 'nullable|integer|exists:service_categories,id',
            'service_template_key' => 'nullable|string|max:80',
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
            'service_details' => 'nullable|array',
            'service_duration_minutes' => 'nullable|integer|min:1|max:5256000',
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
            'service_related_product_ids' => 'nullable|array|max:12',
            'service_related_product_ids.*' => 'integer|exists:products,id',
            'service_booking_provider' => 'nullable|string|in:manual,external,google_calendar',
            'service_booking_mode' => 'nullable|string|in:takeer,internal,external',
            'service_contact_channel' => 'nullable|string|in:whatsapp,phone,email,external_link,in_person',
            'service_contact_value' => 'nullable|string|max:2048',
            'hotspots' => 'nullable|array',
            'product_id' => 'nullable|integer|exists:products,id',
            'access_group_type' => 'nullable|string|in:bundle,plan',
            'access_group_id' => 'nullable|integer',
            'shipping_profile_id' => 'nullable|integer|exists:shipping_profiles,id',
            'delivery_promise_override_enabled' => 'nullable|boolean',
            'delivery_handling_min_days' => 'nullable|integer|min:0|max:365',
            'delivery_handling_max_days' => 'nullable|integer|min:0|max:365|gte:delivery_handling_min_days',
            'delivery_transit_min_days' => 'nullable|integer|min:0|max:365',
            'delivery_transit_max_days' => 'nullable|integer|min:0|max:365|gte:delivery_transit_min_days',
            'delivery_cutoff_time' => 'nullable|date_format:H:i',
            'delivery_business_days_only' => 'nullable|boolean',
            'delivery_promise_label' => 'nullable|string|max:255',
            'delivery_promise_note' => 'nullable|string|max:1000',
            'delivery_requires_confirmation' => 'nullable|boolean',
            'location_inventories' => 'nullable|array', // { location_id: quantity }
            'location_inventories.*' => 'nullable|numeric|min:0',
            'availability_location_ids' => 'nullable|array',
            'availability_location_ids.*' => 'integer|exists:merchant_locations,id',
            'variants.*.location_inventories' => 'nullable|array',
            'variants.*.location_inventories.*' => 'nullable|numeric|min:0',
            'publish_targets' => 'nullable|array',
            'publish_targets.takeer' => 'nullable|boolean',
            'publish_targets.instagram' => 'nullable|boolean',
            'publish_targets.facebook' => 'nullable|boolean',
            'publish_targets.x' => 'nullable|boolean',
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

            if (in_array($request->input('service_location_type', 'provider_location'), ['provider_location', 'customer_location', 'hybrid'], true)
                && (! $request->filled('service_provider_location.lat') || ! $request->filled('service_provider_location.lng'))) {
                return response()->json([
                    'message' => 'Tafadhali chagua eneo la huduma kwenye ramani ili wateja waliokaribu waweze kukuona kwenye Near me.',
                ], 422);
            }
        }

        $accessGroupType = $request->input('access_group_type');
        $accessGroupId = $request->input('access_group_id');
        $publishTargets = (array) $request->input('publish_targets', []);
        $publishToTakeer = ! array_key_exists('takeer', $publishTargets)
            || filter_var($publishTargets['takeer'], FILTER_VALIDATE_BOOLEAN);
        $isFocusedPhysicalModule = $request->input('type') === 'physical' && $request->input('module_key') === 'menu';
        $hasVariants = $request->input('type') === 'physical' && (bool) $request->boolean('has_variants');
        $fulfillmentMode = $request->input('type') === 'physical'
            ? (string) ($request->input('fulfillment_mode') ?: 'own_stock')
            : 'own_stock';
        $requiresLocationInventory = $request->input('type') === 'physical' && ! $isFocusedPhysicalModule && $fulfillmentMode === 'own_stock';
        $sourceDetails = collect((array) $request->input('source_details', []))
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->filter(fn ($value) => $value !== null && $value !== '')
            ->all();
        $incomingVariants = collect($request->input('variants', []));
        $merchantLocationIds = $request->input('type') === 'physical'
            ? $merchantProfile->locations()->pluck('id')->map(fn ($id) => (int) $id)
            : collect();
        $allMerchantLocationIds = $merchantProfile->locations()->pluck('id')->map(fn ($id) => (int) $id);
        $availabilityLocationIds = collect((array) $request->input('availability_location_ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();
        $invalidAvailabilityLocationIds = $availabilityLocationIds
            ->filter(fn ($locationId) => ! $allMerchantLocationIds->contains((int) $locationId))
            ->values();

        if ($invalidAvailabilityLocationIds->isNotEmpty()) {
            return response()->json(['message' => 'Huduma/bidhaa inaweza kuhusishwa na maeneo yako pekee.'], 422);
        }
        $sumMerchantLocationStock = function (array $inventories) use ($merchantLocationIds): float {
            return collect($inventories)
                ->filter(fn ($quantity, $locationId) => $merchantLocationIds->contains((int) $locationId))
                ->sum(fn ($quantity) => max(0, (float) $quantity));
        };

        if ($request->input('type') === 'physical' && ! $isFocusedPhysicalModule) {
            if ($requiresLocationInventory && $merchantLocationIds->isEmpty()) {
                return response()->json(['message' => 'Tafadhali ongeza angalau duka au eneo la stock/pickup kwenye Mipangilio kabla ya kuuza bidhaa uliyonayo mkononi.'], 422);
            }

            $inventoryLocationIds = collect(array_keys((array) $request->input('location_inventories', [])));
            $variantInventoryLocationIds = $incomingVariants
                ->flatMap(fn ($variant) => array_keys((array) (((array) $variant)['location_inventories'] ?? [])));
            $invalidLocationIds = $inventoryLocationIds
                ->merge($variantInventoryLocationIds)
                ->filter(fn ($locationId) => ! $merchantLocationIds->contains((int) $locationId))
                ->unique()
                ->values();

            if ($invalidLocationIds->isNotEmpty()) {
                return response()->json(['message' => 'Stock inaweza kuwekwa kwenye maduka au maeneo yako ya stock/pickup pekee.'], 422);
            }

            if ($fulfillmentMode === 'supplier_sourced') {
                if (empty($sourceDetails['supplier_name'] ?? null) || empty($sourceDetails['supplier_phone'] ?? null)) {
                    return response()->json(['message' => 'Tafadhali weka jina na simu ya supplier. Taarifa hizi ni za Takeer tu.'], 422);
                }
                if (! isset($sourceDetails['confirmation_hours']) || $sourceDetails['confirmation_hours'] === '') {
                    return response()->json(['message' => 'Tafadhali weka masaa ya kuthibitisha/kupata bidhaa kutoka kwa supplier.'], 422);
                }
            }

            if ($fulfillmentMode === 'made_to_order' && ! $request->filled('availability_lead_time_days')) {
                return response()->json(['message' => 'Tafadhali weka muda wa kuandaa bidhaa baada ya oda.'], 422);
            }

            if (in_array($fulfillmentMode, ['preorder', 'farm_harvest'], true) && ! $request->filled('available_from')) {
                return response()->json(['message' => 'Tafadhali weka tarehe ambayo bidhaa inatarajiwa kupatikana.'], 422);
            }

            if ($fulfillmentMode === 'group_sale') {
                if (! $request->filled('group_sale_goal_quantity') || ! $request->filled('group_sale_deadline')) {
                    return response()->json(['message' => 'Group sale inahitaji target quantity na deadline.'], 422);
                }
                if (Carbon::parse($request->input('group_sale_deadline'))->endOfDay()->isPast()) {
                    return response()->json(['message' => 'Group sale deadline lazima iwe leo au siku zijazo.'], 422);
                }
                if (! $request->filled('available_from')) {
                    return response()->json(['message' => 'Tafadhali weka tarehe ya matarajio ya fulfillment kwa group sale.'], 422);
                }
            }
        }
        $category = $request->filled('category_id') ? ProductCategory::find((int) $request->input('category_id')) : null;
        $subCategory = $request->filled('sub_category_id') ? ProductCategory::find((int) $request->input('sub_category_id')) : null;
        $effectiveCategory = $subCategory ?: $category;
        if ($request->input('type') === 'physical' && $effectiveCategory) {
            $allowedModes = collect($effectiveCategory->allowed_fulfillment_modes ?: [])
                ->map(fn ($mode) => (string) $mode)
                ->filter()
                ->values();
            if ($allowedModes->isNotEmpty() && ! $allowedModes->contains($fulfillmentMode)) {
                return response()->json(['message' => 'Fulfillment/source mode hii hairuhusiwi kwa category hii.'], 422);
            }

            if ((bool) ($effectiveCategory->requires_verified_business ?? false) && ! $merchantProfile->hasVerifiedBusinessKyc()) {
                return response()->json([
                    'message' => 'Category hii inahitaji verified merchant/KYB kabla ya kuchapishwa.',
                    'verification_url' => "/merchant/{$merchantProfile->username}/verification",
                ], 403);
            }
        }
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
                $merchantName = trim((string) ($variant['name'] ?? ''));

                return [
                    'name' => $merchantName !== '' ? $merchantName : $derivedName,
                    'sku' => filled($variant['sku'] ?? null) ? (string) $variant['sku'] : null,
                    'price' => (float) $rawPrice,
                    'compare_price' => array_key_exists('compare_price', $variant) && $variant['compare_price'] !== null && $variant['compare_price'] !== '' ? (float) $variant['compare_price'] : null,
                    'quantity' => max(0, (float) $rawQuantity),
                    'attributes' => is_array($variant['attributes'] ?? null) ? $variant['attributes'] : [],
                    'swatch_image_url' => $variant['swatch_image_url'] ?? null,
                    'sort_order' => array_key_exists('sort_order', $variant) ? (int) $variant['sort_order'] : $index,
                    'location_inventories' => $variant['location_inventories'] ?? [],
                ];
            })
            ->filter()
            ->values();

        if ($request->input('type') === 'physical' && $effectiveCategory) {
            $requiredAttributes = ProductCategoryAttribute::query()
                ->where('category_id', $effectiveCategory->id)
                ->where('is_required', true)
                ->orderBy('sort_order')
                ->get();
            $incomingAttributeValues = collect($request->input('attribute_values', []))
                ->keyBy(fn ($item) => (int) ($item['category_attribute_id'] ?? 0));

            foreach ($requiredAttributes as $requiredAttribute) {
                $row = (array) ($incomingAttributeValues->get($requiredAttribute->id) ?? []);
                $hasValue = match ($requiredAttribute->input_type) {
                    'number' => array_key_exists('value_number', $row) && $row['value_number'] !== null && $row['value_number'] !== '',
                    'boolean' => true,
                    'multiselect' => !empty($row['value_json']) && is_array($row['value_json']),
                    default => filled($row['value_text'] ?? null),
                };

                if (! $hasValue) {
                    return response()->json(['message' => "Tafadhali jaza {$requiredAttribute->label} kabla ya kuweka bidhaa sokoni."], 422);
                }
            }
        }
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
        if ($shippingProfileId && !\App\Models\ShippingProfile::where('merchant_id', $merchantProfile->id)->whereKey($shippingProfileId)->exists()) {
            return response()->json(['message' => 'Shipping profile haipo kwenye biashara hii.'], 422);
        }

        if ($request->input('type') === 'physical' && count($mediaItems) === 0) {
            return response()->json(['message' => 'Physical product requires at least one media item.'], 422);
        }

        if ($hasVariants && $preparedVariants->isEmpty()) {
            return response()->json(['message' => 'At least one variant is required when variants are enabled.'], 422);
        }

        if ($request->input('type') === 'physical') {
            if ($requiresLocationInventory && $hasVariants) {
                $variantLocationStockTotal = $preparedVariants->sum(fn ($variant) => $sumMerchantLocationStock((array) ($variant['location_inventories'] ?? [])));
                if ($variantLocationStockTotal <= 0) {
                    return response()->json(['message' => 'Tafadhali weka stock ya angalau variant moja kwenye duka au eneo la stock/pickup.'], 422);
                }
            } elseif ($requiresLocationInventory && $sumMerchantLocationStock((array) $request->input('location_inventories', [])) <= 0) {
                return response()->json(['message' => 'Tafadhali weka stock kwenye angalau duka au eneo la stock/pickup.'], 422);
            }
        }

        $returnPolicyId = null;
        if ($request->input('type') === 'physical' && $request->filled('return_policy_id')) {
            $returnPolicyId = \App\Models\MerchantReturnPolicy::query()
                ->where('merchant_id', $merchantProfile->id)
                ->where('id', (int) $request->input('return_policy_id'))
                ->value('id');
        }

        if ($request->input('type') === 'physical' && ! $returnPolicyId) {
            $returnPolicyId = \App\Models\MerchantReturnPolicy::query()
                ->where('merchant_id', $merchantProfile->id)
                ->where('is_default', true)
                ->value('id');
        }

        $packageContentItems = collect($request->input('package_content_items', []))
            ->map(fn ($item) => [
                'qty' => isset($item['qty']) && $item['qty'] !== '' ? (float) $item['qty'] : 1,
                'unit' => trim((string) ($item['unit'] ?? '')),
                'name' => trim((string) ($item['name'] ?? '')),
            ])
            ->filter(fn ($item) => $item['name'] !== '')
            ->values()
            ->all();
        $productFaqs = collect($request->input('faqs', []))
            ->map(fn ($item, $index) => [
                'question' => trim((string) ($item['question'] ?? '')),
                'answer' => trim((string) ($item['answer'] ?? '')),
                'is_published' => array_key_exists('is_published', (array) $item) ? (bool) $item['is_published'] : true,
                'sort_order' => (int) $index,
            ])
            ->filter(fn ($item) => $item['question'] !== '' && $item['answer'] !== '')
            ->values()
            ->take(20)
            ->all();

        // 2. Capture already uploaded digital file url (direct file takes priority over external URL)
        $productUrl = $request->input('url');
        $digitalDeliveryType = $request->input('type') === 'digital'
            ? ($request->input('digital_delivery_type') ?: ($request->filled('url') ? 'external_link' : 'file'))
            : null;
        $paidVideoUrl = null;
        if ($request->input('type') === 'digital' && $digitalDeliveryType === 'video_stream') {
            if (!$request->filled('paid_video_url')) {
                return response()->json(['message' => 'Tafadhali pakia full premium video.'], 422);
            }

            $paidVideoUrl = $request->input('paid_video_url');
            if (!str_starts_with($paidVideoUrl, 'private://') && !preg_match('/^https?:\/\//i', $paidVideoUrl)) {
                $paidVideoUrl = "private://{$paidVideoUrl}";
            }
            $productUrl = null;
        } elseif ($request->input('type') === 'digital' && $digitalDeliveryType === 'audio_stream') {
            if (!$request->filled('paid_audio_url')) {
                return response()->json(['message' => 'Tafadhali pakia premium audio.'], 422);
            }

            $productUrl = $request->input('paid_audio_url');
            if (!str_starts_with($productUrl, 'private://') && !preg_match('/^https?:\/\//i', $productUrl)) {
                $productUrl = "private://{$productUrl}";
            }
        } elseif ($request->input('type') === 'digital' && $digitalDeliveryType === 'gallery_pack') {
            if (!is_array($request->input('paid_gallery_items')) || count($request->input('paid_gallery_items')) === 0) {
                return response()->json(['message' => 'Tafadhali pakia picha za gallery pack.'], 422);
            }
            $productUrl = null;
        } elseif ($request->input('type') === 'digital' && $digitalDeliveryType === 'live_event') {
            if (!$request->filled('live_event_starts_at')) {
                return response()->json(['message' => 'Tafadhali weka muda wa live event/webinar.'], 422);
            }
            if (!$request->filled('live_event_access_url') && !$request->filled('live_event_venue')) {
                return response()->json(['message' => 'Weka meeting link au venue ya tukio.'], 422);
            }
            $productUrl = null;
        } elseif ($request->input('type') === 'digital' && $digitalDeliveryType === 'custom_delivery') {
            if (! $request->filled('availability_lead_time_days')) {
                return response()->json(['message' => 'Custom work inahitaji delivery deadline/turnaround days.'], 422);
            }
            $productUrl = null;
        } elseif ($request->input('type') === 'digital' && $request->filled('digital_file_url')) {
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
        $serviceCategoryModel = $request->input('type') === 'service'
            ? $this->serviceCategoryForTrust($serviceCategory ?: '', $serviceSubcategory ?: '', $request->integer('service_category_id') ?: null, $request->integer('service_subcategory_id') ?: null)
            : null;
        $serviceParentCategory = $serviceCategoryModel?->parent ?: ($serviceCategoryModel?->parent_id === null ? $serviceCategoryModel : null);
        $serviceCategoryId = $request->integer('service_category_id') ?: $serviceParentCategory?->id;
        $serviceSubcategoryId = $request->integer('service_subcategory_id') ?: ($serviceCategoryModel?->parent_id ? $serviceCategoryModel->id : null);
        $serviceTemplateKey = $request->input('service_template_key')
            ?: ($serviceCategoryModel?->service_template_key ?: ServiceTemplateRegistry::templateKeyForCategory($serviceCategoryModel));
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
        $serviceDetails = $request->input('type') === 'service'
            ? $this->sanitizeServiceDetails((array) $request->input('service_details', []), $serviceTemplateKey)
            : [];
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
        $serviceRelatedProductIds = $request->input('type') === 'service'
            ? Product::query()
                ->where('merchant_id', $merchantProfile->id)
                ->where('type', 'physical')
                ->whereIn('id', collect((array) $request->input('service_related_product_ids', []))->map(fn ($id) => (int) $id)->filter()->unique()->take(12)->values())
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
            : [];
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
            $serviceTemplateKey = null;
            $serviceDetails = [];
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

        $paidGalleryItems = null;
        if ($request->input('type') === 'digital' && $digitalDeliveryType === 'gallery_pack') {
            $galleryWatermark = 'Takeer / @'.($merchantProfile->username ?: $request->input('title'));
            $galleryService = app(GalleryImageService::class);
            $paidGalleryItems = collect($request->input('paid_gallery_items', []))
                ->map(fn ($item) => $galleryService->prepareItem((array) $item, $galleryWatermark))
                ->filter(fn ($item) => filled($item['url']))
                ->values()
                ->all();
        }

        $actingStaff = $request->user()
            ? MerchantPermissions::staffFor($request->user(), $merchantProfile)
            : null;

        $productData = [
            'merchant_id' => $merchantProfile->id,
            'type' => $request->input('type'),
            'has_variants' => $hasVariants,
            'title' => $request->input('title'),
            'fulfillment_mode' => $request->input('type') === 'physical' ? $fulfillmentMode : 'own_stock',
            'source_details' => $request->input('type') === 'physical' ? $sourceDetails : null,
            'availability_lead_time_days' => (($request->input('type') === 'physical') || ($request->input('type') === 'digital' && $digitalDeliveryType === 'custom_delivery')) && $request->filled('availability_lead_time_days')
                ? (int) $request->input('availability_lead_time_days')
                : null,
            'available_from' => $request->input('type') === 'physical' && $request->filled('available_from')
                ? $request->input('available_from')
                : null,
            'group_sale_goal_quantity' => $request->input('type') === 'physical' && $request->filled('group_sale_goal_quantity')
                ? (int) $request->input('group_sale_goal_quantity')
                : null,
            'group_sale_deadline' => $request->input('type') === 'physical' && $request->filled('group_sale_deadline')
                ? $request->input('group_sale_deadline')
                : null,
            'price' => $computedBasePrice,
            'compare_at_price' => $request->input('compare_price'),
            'discounted_price' => $computedBasePrice,
            'inventory_count' => $request->input('type') === 'physical'
                ? ($hasVariants
                    ? (int) ceil((float) $preparedVariants->sum(fn ($variant) => (float) ($variant['quantity'] ?? 0)))
                    : (int) ceil((float) ($requiresLocationInventory ? ($request->input('quantity') ?? 0) : 99999)))
                : 99999,
            'inventory_quantity' => $request->input('type') === 'physical'
                ? ($hasVariants
                    ? (float) $preparedVariants->sum(fn ($variant) => (float) ($variant['quantity'] ?? 0))
                    : (float) ($requiresLocationInventory ? ($request->input('quantity') ?? 0) : 99999))
                : 99999,
            'product_unit_type_id' => $request->input('type') === 'physical' ? ($request->input('product_unit_type_id') ?: null) : null,
            'sellable_quantity' => $request->input('type') === 'physical' ? (float) ($request->input('sellable_quantity') ?: 1) : 1,
            'package_content_unit_type_id' => $request->input('type') === 'physical' ? ($request->input('package_content_unit_type_id') ?: null) : null,
            'package_content_quantity' => $request->input('type') === 'physical' && $request->filled('package_content_quantity') ? (float) $request->input('package_content_quantity') : null,
            'package_contents' => $request->input('type') === 'physical' ? ($request->input('package_contents') ?: null) : null,
            'package_content_items' => $request->input('type') === 'physical' ? $packageContentItems : null,
            'return_policy_id' => $request->input('type') === 'physical' ? $returnPolicyId : null,
            'min_order_quantity' => $request->input('type') === 'physical' && $request->filled('min_order_quantity') ? (float) $request->input('min_order_quantity') : null,
            'order_increment' => $request->input('type') === 'physical' && $request->filled('order_increment') ? (float) $request->input('order_increment') : null,
            'url' => $productUrl,
            'download_link' => $request->input('type') === 'digital' ? $productUrl : null,
            'digital_delivery_type' => $request->input('type') === 'digital' ? $digitalDeliveryType : 'file',
            'digital_content_type' => $request->input('type') === 'digital' ? ($request->input('digital_content_type') ?: null) : null,
            'digital_usage_license' => $request->input('type') === 'digital' ? ($request->input('digital_usage_license') ?: null) : null,
            'digital_access_instructions' => $request->input('type') === 'digital' ? ($request->input('digital_access_instructions') ?: null) : null,
            'license_key_enabled' => $request->input('type') === 'digital' && $request->input('digital_content_type') === 'software'
                ? (bool) $request->boolean('license_key_enabled')
                : false,
            'license_key_prefix' => $request->input('type') === 'digital' && $request->input('digital_content_type') === 'software'
                ? ($request->input('license_key_prefix') ?: null)
                : null,
            'license_activation_limit' => $request->input('type') === 'digital' && $request->input('digital_content_type') === 'software'
                ? max(1, (int) ($request->input('license_activation_limit') ?: 1))
                : 1,
            'paid_video_url' => $paidVideoUrl,
            'paid_video_mime' => $request->input('type') === 'digital' && $digitalDeliveryType === 'video_stream' ? $request->input('paid_video_mime') : null,
            'paid_video_size' => $request->input('type') === 'digital' && $digitalDeliveryType === 'video_stream' ? $request->input('paid_video_size') : null,
            'paid_video_duration_seconds' => $request->input('type') === 'digital' && $digitalDeliveryType === 'video_stream' ? $request->input('paid_video_duration_seconds') : null,
            'premium_video_status' => $request->input('type') === 'digital' && $digitalDeliveryType === 'video_stream' ? 'queued' : null,
            'premium_video_hls_path' => null,
            'premium_video_hls_disk' => null,
            'premium_video_thumbnail_path' => null,
            'premium_video_error' => null,
            'premium_video_processed_at' => null,
            'paid_audio_url' => $request->input('type') === 'digital' && $digitalDeliveryType === 'audio_stream' ? $productUrl : null,
            'paid_audio_mime' => $request->input('type') === 'digital' && $digitalDeliveryType === 'audio_stream' ? $request->input('paid_audio_mime') : null,
            'paid_audio_size' => $request->input('type') === 'digital' && $digitalDeliveryType === 'audio_stream' ? $request->input('paid_audio_size') : null,
            'paid_audio_duration_seconds' => $request->input('type') === 'digital' && $digitalDeliveryType === 'audio_stream' ? $request->input('paid_audio_duration_seconds') : null,
            'paid_gallery_items' => $paidGalleryItems,
            'allow_download' => $request->input('type') === 'digital' && in_array($digitalDeliveryType, ['video_stream', 'audio_stream', 'gallery_pack'], true)
                ? (bool) $request->boolean('allow_download')
                : true,
            'refund_policy' => $request->input('refund_policy') ?: ($request->input('type') === 'digital' ? 'strict' : 'standard'),
            'refund_window_days' => $request->filled('refund_window_days')
                ? (int) $request->input('refund_window_days')
                : ($request->input('type') === 'physical' ? 7 : null),
            'refund_policy_note' => $request->input('refund_policy_note') ?: null,
            'live_event_starts_at' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? $request->input('live_event_starts_at')
                : null,
            'live_event_duration_minutes' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? ($request->input('live_event_duration_minutes') ?: null)
                : null,
            'live_event_timezone' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? ($request->input('live_event_timezone') ?: config('app.timezone'))
                : null,
            'live_event_access_url' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? ($request->input('live_event_access_url') ?: null)
                : null,
            'live_event_venue' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? ($request->input('live_event_venue') ?: null)
                : null,
            'live_event_capacity' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? ($request->input('live_event_capacity') ?: null)
                : null,
            'live_event_replay_url' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? ($request->input('live_event_replay_url') ?: null)
                : null,
            'live_event_instructions' => $request->input('type') === 'digital' && $digitalDeliveryType === 'live_event'
                ? ($request->input('live_event_instructions') ?: null)
                : null,
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
            'service_template_key' => $serviceTemplateKey,
            'service_price_display' => $servicePriceDisplay ?: 'fixed',
            'service_charges' => $serviceCharges,
            'service_options' => $serviceOptions,
            'service_details' => $serviceDetails,
            'service_duration_minutes' => $serviceDurationMinutes !== null && $serviceDurationMinutes !== '' ? (int) $serviceDurationMinutes : null,
            'service_location_type' => $serviceLocationType,
            'service_provider_location' => in_array($serviceLocationType, ['provider_location', 'customer_location', 'hybrid'], true) ? $serviceProviderLocation : null,
            'service_area' => $serviceArea,
            'service_client_requirements' => $serviceClientRequirements,
            'service_intake_form' => $serviceIntakeForm,
            'service_related_product_ids' => $serviceRelatedProductIds,
            'service_booking_provider' => $serviceBookingProvider ?: 'manual',
            'service_contact_channel' => $serviceContactChannel,
            'service_contact_value' => $serviceContactValue,
            'shipping_profile_id' => $shippingProfileId,
            'delivery_promise_override_enabled' => $request->boolean('delivery_promise_override_enabled'),
            'delivery_handling_min_days' => $request->input('delivery_handling_min_days'),
            'delivery_handling_max_days' => $request->input('delivery_handling_max_days'),
            'delivery_transit_min_days' => $request->input('delivery_transit_min_days'),
            'delivery_transit_max_days' => $request->input('delivery_transit_max_days'),
            'delivery_cutoff_time' => $request->input('delivery_cutoff_time'),
            'delivery_business_days_only' => $request->boolean('delivery_business_days_only', true),
            'delivery_promise_label' => $request->input('delivery_promise_label'),
            'delivery_promise_note' => $request->input('delivery_promise_note'),
            'delivery_requires_confirmation' => $request->boolean('delivery_requires_confirmation'),
        ];

        if (Schema::hasColumn('products', 'module_key')) {
            $requestedModule = $request->input('module_key');
            $productData['module_key'] = match (true) {
                $requestedModule === 'menu' && $request->input('type') === 'physical' => 'menu',
                $requestedModule === 'rooms' && $request->input('type') === 'service' => 'rooms',
                $requestedModule === 'tour_departures' && $request->input('type') === 'service' => 'tour_departures',
                $requestedModule === 'custom_orders' && $request->input('type') === 'service' => 'custom_orders',
                $requestedModule === 'appointments' && $request->input('type') === 'service' => 'appointments',
                $requestedModule === 'reservations' && $request->input('type') === 'service' => 'reservations',
                $requestedModule === 'rentals' && $request->input('type') === 'service' => 'rentals',
                $requestedModule === 'workshops' && $request->input('type') === 'service' => 'workshops',
                $requestedModule === 'forwarders' && $request->input('type') === 'service' => 'forwarders',
                default => null,
            };
            $productData['module_details'] = match ($productData['module_key']) {
                'menu' => $this->sanitizeMenuModuleDetails($request->input('module_details', [])),
                'rooms' => $this->sanitizeRoomModuleDetails($request->input('module_details', [])),
                'tour_departures' => $this->sanitizeTourModuleDetails($request->input('module_details', [])),
                'custom_orders' => $this->sanitizeCustomOrderModuleDetails($request->input('module_details', [])),
                'appointments' => $this->sanitizeAppointmentModuleDetails($request->input('module_details', [])),
                'reservations' => $this->sanitizeReservationModuleDetails($request->input('module_details', [])),
                'rentals' => $this->sanitizeRentalModuleDetails($request->input('module_details', [])),
                'workshops' => $this->sanitizeWorkshopModuleDetails($request->input('module_details', [])),
                'forwarders' => $this->sanitizeForwarderModuleDetails($request->input('module_details', [])),
                default => null,
            };
        }

        if ($request->input('type') === 'service' && Schema::hasColumn('products', 'service_category_id')) {
            $productData['service_category_id'] = $serviceCategoryId;
            $productData['service_subcategory_id'] = $serviceSubcategoryId;
        }

        if ($request->filled('product_id')) {
            $product = Product::query()
                ->where('merchant_id', $merchantProfile->id)
                ->findOrFail($request->input('product_id'));
            if (! $product->slug) {
                $productData['slug'] = Str::slug($request->input('title')) . '-' . time();
            }
            $product->update($productData);
            // For simplicity, we create a NEW post every time it's "published" to the feed,
            // but we update the product record itself.
            // We DO NOT delete images here, to preserve relations for old posts.
        } else {
            $productData['slug'] = Str::slug($request->input('title')) . '-' . time();
            $productData['created_by_user_id'] = $request->user()?->id;
            $productData['created_by_staff_id'] = $actingStaff?->id;
            $product = Product::create($productData);
        }

        if ($request->input('type') === 'digital' && $digitalDeliveryType === 'video_stream') {
            ProcessPremiumProductVideo::dispatch($product->id)->afterCommit();
        }

        if (($productData['module_key'] ?? null) === 'forwarders') {
            $this->syncForwarderService($product, $merchantProfile, $request->user()?->id);
        } else {
            Forwarder::query()
                ->where('product_id', $product->id)
                ->where('merchant_id', $merchantProfile->id)
                ->delete();
        }

        if ($request->has('availability_location_ids')) {
            $this->syncLocationAvailability($product, $merchantProfile, $availabilityLocationIds->all());
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
                        'inventory_count' => (int) ceil((float) $vData['quantity']),
                        'inventory_quantity' => (float) $vData['quantity'],
                        'attributes' => $vData['attributes'],
                        'swatch_image_url' => $vData['swatch_image_url'],
                        'is_active' => true,
                        'sort_order' => $vData['sort_order'],
                    ]);

                    $variantLocInventories = $vData['location_inventories'] ?? [];
                    $variantSum = $requiresLocationInventory ? 0.0 : (float) ($vData['quantity'] ?? 0);

                    if ($requiresLocationInventory && !empty($variantLocInventories)) {
                        foreach ($variantLocInventories as $locId => $qty) {
                            $quantity = max(0, (float) $qty);
                            $variant->locationInventories()->updateOrCreate(
                                ['merchant_location_id' => $locId, 'product_id' => null],
                                ['quantity' => (int) ceil($quantity), 'quantity_decimal' => $quantity]
                            );
                            $variantSum += $quantity;
                        }
                    }
                    
                    // Update variant's cached count
                    $variant->update(['inventory_count' => (int) ceil($variantSum), 'inventory_quantity' => $variantSum]);
                    $totalInventory += $variantSum;
                }

                $product->update(['inventory_count' => (int) ceil($totalInventory), 'inventory_quantity' => $totalInventory]);
            } else {
                $product->variants()->delete();
                $locInventories = $request->input('location_inventories', []);
                $totalInventory = $requiresLocationInventory ? 0.0 : (float) ($request->input('quantity') ?? 99999);

                if ($requiresLocationInventory && !empty($locInventories)) {
                    foreach ($locInventories as $locId => $qty) {
                        $quantity = max(0, (float) $qty);
                        $product->locationInventories()->updateOrCreate(
                            ['merchant_location_id' => $locId, 'product_variant_id' => null],
                            ['quantity' => (int) ceil($quantity), 'quantity_decimal' => $quantity]
                        );
                        $totalInventory += $quantity;
                    }
                } elseif (! $requiresLocationInventory) {
                    $product->locationInventories()->delete();
                }

                $product->update(['inventory_count' => (int) ceil($totalInventory), 'inventory_quantity' => $totalInventory]);
            }
        } else {
            $product->variants()->delete();
            $product->locationInventories()->delete();
        }

        $product->faqs()->where('source', 'merchant')->delete();
        foreach ($productFaqs as $faq) {
            $product->faqs()->create([
                'merchant_id' => $merchantProfile->id,
                'question' => $faq['question'],
                'answer' => $faq['answer'],
                'source' => 'merchant',
                'is_published' => $faq['is_published'],
                'sort_order' => $faq['sort_order'],
            ]);
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

        // 4. Optionally create a Takeer feed post for this product.
        $post = null;
        if ($publishToTakeer) {
            $post = Post::create([
                'merchant_id' => $merchantProfile->id,
                'created_by_user_id' => $request->user()?->id ?: $product->created_by_user_id,
                'created_by_staff_id' => $actingStaff?->id ?: $product->created_by_staff_id,
                'source' => 'catalog_publish',
                'title' => $request->input('title'),
                'caption' => $request->input('description') ?: $request->input('title'),
                'excerpt' => $request->input('description'),
            ]);
        }

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

                if ($post) {
                    // Create PostMedia linking to the ProductImage.
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
            }

            // Cleanup any extra images if the count decreased
            $product->images()->where('order', '>=', count($mediaItems))->delete();
        }

        // Connect the specific product to this new feed post.
        if ($post) {
            PostProductTag::create([
                'post_id' => $post->id,
                'product_id' => $product->id,
                'x_coordinate' => 50, // default center position
                'y_coordinate' => 50,
            ]);
        }

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

                if ($post) {
                    $post->update([
                        'is_restricted' => true,
                        'promotable_type' => Bundle::class,
                        'promotable_id' => $bundle->id,
                    ]);
                }

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

                if ($post) {
                    $post->update([
                        'is_restricted' => true,
                        'promotable_type' => SubscriptionPlan::class,
                        'promotable_id' => $plan->id,
                    ]);
                }

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

                // Ensure searchable text is populated from value_json for select/multiselect types if missing.
                if (empty($rawValueText) && !empty($rawValueJson) && is_array($rawValueJson)) {
                    $rawValueText = implode(', ', array_filter(array_map('strval', $rawValueJson)));
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

        $groupSaleCampaign = $this->syncFulfillmentGroupSaleCampaign($product, $merchantProfile, $request);

        return response()->json([
            'message' => 'Hongera! Bidhaa yako imewekwa sokoni.',
            'product_id' => $product->id,
            'group_sale_campaign' => $groupSaleCampaign ? [
                'id' => $groupSaleCampaign->id,
                'slug' => $groupSaleCampaign->slug,
                'url' => url('/group-sale/'.$groupSaleCampaign->slug),
            ] : null,
        ]);
    }

    private function syncLocationAvailability(Product $product, Merchant $merchant, array $locationIds): void
    {
        $requestedLocationIds = collect($locationIds)->map(fn ($id) => (int) $id)->filter()->unique()->values();
        $validLocationIds = $merchant->locations()
            ->whereIn('id', $requestedLocationIds->all())
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        abort_if($requestedLocationIds->count() !== $validLocationIds->count(), 422, 'Huduma/bidhaa inaweza kuhusishwa na maeneo yako pekee.');

        $product->locationAvailabilities()
            ->where('availability_type', 'serves')
            ->whereNotIn('merchant_location_id', $validLocationIds->all())
            ->delete();

        foreach ($validLocationIds as $locationId) {
            MerchantLocationable::updateOrCreate(
                [
                    'merchant_location_id' => $locationId,
                    'locationable_type' => Product::class,
                    'locationable_id' => $product->id,
                    'availability_type' => 'serves',
                ],
                [
                    'merchant_id' => $merchant->id,
                    'is_enabled' => true,
                ]
            );
        }
    }

    private function syncFulfillmentGroupSaleCampaign(Product $product, Merchant $merchant, Request $request): ?MerchantGroupSaleCampaign
    {
        $autoCampaigns = MerchantGroupSaleCampaign::query()
            ->where('merchant_id', $merchant->id)
            ->where('product_id', $product->id)
            ->get()
            ->filter(fn (MerchantGroupSaleCampaign $campaign) => ($campaign->metadata['source'] ?? null) === 'product_fulfillment_mode');

        if ($product->type !== 'physical' || ($product->fulfillment_mode ?: 'own_stock') !== 'group_sale') {
            $autoCampaigns
                ->filter(fn (MerchantGroupSaleCampaign $campaign) => in_array($campaign->status, ['draft', 'active'], true) && (int) $campaign->reserved_quantity === 0)
                ->each(fn (MerchantGroupSaleCampaign $campaign) => $campaign->update(['status' => 'cancelled']));

            return null;
        }

        $deadline = Carbon::parse($request->input('group_sale_deadline'))->endOfDay();
        $availableFrom = $request->input('available_from');
        $sourceNote = trim((string) data_get((array) $request->input('source_details', []), 'source_note', ''));
        $description = trim((string) ($request->input('description') ?: ''));
        $fulfillmentNote = trim(implode("\n\n", array_filter([
            $description,
            $availableFrom ? "Expected fulfillment from {$availableFrom}." : null,
            $sourceNote ? "Source note: {$sourceNote}" : null,
        ])));

        $data = [
            'merchant_id' => $merchant->id,
            'product_id' => $product->id,
            'title' => $request->input('title'),
            'description' => $fulfillmentNote ?: null,
            'campaign_price' => (float) ($request->input('price') ?? $product->price ?? 0),
            'regular_price' => $request->filled('compare_price') ? (float) $request->input('compare_price') : null,
            'goal_quantity' => (int) $request->input('group_sale_goal_quantity'),
            'starts_at' => now(),
            'ends_at' => $deadline,
            'status' => 'active',
            'allow_sms_updates' => true,
            'metadata' => [
                'source' => 'product_fulfillment_mode',
                'fulfillment_mode' => 'group_sale',
                'available_from' => $availableFrom,
            ],
        ];

        $campaign = $autoCampaigns->sortByDesc('id')->first();
        if ($campaign) {
            if ((int) $data['goal_quantity'] < (int) $campaign->reserved_quantity) {
                $data['goal_quantity'] = (int) $campaign->reserved_quantity;
            }
            $campaign->update($data);

            return $campaign->fresh();
        }

        return MerchantGroupSaleCampaign::query()->create($data);
    }

    /**
     * Delete (archive) a product.
     */
    public function deleteProduct(Request $request, Merchant|string|int|null $merchantOrId = null, string|int|null $id = null): JsonResponse
    {
        $merchantProfile = $this->merchantFromRequest($request);
        $productId = $id ?? $merchantOrId;
        $product = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->findOrFail($productId);

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
    public function syncHotspots(Request $request, Merchant|string|int|null $merchantOrId = null, string|int|null $id = null): JsonResponse
    {
        $request->validate([
            'image_index' => 'required|integer',
            'hotspots' => 'required|array',
        ]);

        $merchantProfile = $this->merchantFromRequest($request);
        $productId = $id ?? $merchantOrId;
        $product = Product::query()
            ->where('merchant_id', $merchantProfile->id)
            ->findOrFail($productId);
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

        $category = $this->serviceCategoryForTrust(
            $categoryName,
            $subcategoryName,
            $request->integer('service_category_id') ?: null,
            $request->integer('service_subcategory_id') ?: null
        );
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

    private function serviceCategoryForTrust(string $categoryName, string $subcategoryName, ?int $categoryId = null, ?int $subcategoryId = null): ?ServiceCategory
    {
        if ($subcategoryId) {
            $child = ServiceCategory::query()
                ->whereKey($subcategoryId)
                ->whereNotNull('parent_id')
                ->first();

            if ($child) {
                return $child;
            }
        }

        if ($categoryId) {
            $parent = ServiceCategory::query()
                ->whereKey($categoryId)
                ->whereNull('parent_id')
                ->first();

            if ($parent && $subcategoryName === '') {
                return $parent;
            }
        }

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

    private function sanitizeServiceDetails(array $details, ?string $templateKey): array
    {
        $serviceSubtype = Str::limit(Str::slug(trim((string) ($details['service_subtype'] ?? ($details['rental_type'] ?? ''))), '_'), 80, '');
        $stringList = fn (mixed $values, int $limit = 30) => collect((array) $values)
            ->map(fn ($value) => trim((string) $value))
            ->filter()
            ->unique()
            ->take($limit)
            ->values()
            ->all();

        return match ($templateKey) {
            'tour' => [
                'service_subtype' => $serviceSubtype,
                'destination' => Str::limit(trim((string) ($details['destination'] ?? '')), 160, ''),
                'duration_label' => Str::limit(trim((string) ($details['duration_label'] ?? '')), 80, ''),
                'pickup_point' => Str::limit(trim((string) ($details['pickup_point'] ?? '')), 220, ''),
                'dropoff_point' => Str::limit(trim((string) ($details['dropoff_point'] ?? '')), 220, ''),
                'itinerary' => collect((array) ($details['itinerary'] ?? []))
                    ->map(fn ($day, $index) => [
                        'day' => (int) ($day['day'] ?? ($index + 1)),
                        'title' => Str::limit(trim((string) ($day['title'] ?? '')), 120, ''),
                        'description' => Str::limit(trim((string) ($day['description'] ?? '')), 1200, ''),
                    ])
                    ->filter(fn ($day) => $day['title'] !== '' || $day['description'] !== '')
                    ->take(30)
                    ->values()
                    ->all(),
                'included' => $stringList($details['included'] ?? []),
                'excluded' => $stringList($details['excluded'] ?? []),
                'requirements' => Str::limit(trim((string) ($details['requirements'] ?? '')), 2000, ''),
            ],
            'stay' => [
                'service_subtype' => $serviceSubtype,
                'amenities' => $stringList($details['amenities'] ?? []),
                'house_rules' => Str::limit(trim((string) ($details['house_rules'] ?? '')), 2000, ''),
                'cancellation_policy' => Str::limit(trim((string) ($details['cancellation_policy'] ?? '')), 1200, ''),
            ],
            'learning' => [
                'service_subtype' => $serviceSubtype,
                'outcomes' => $stringList($details['outcomes'] ?? []),
                'requirements' => $stringList($details['requirements'] ?? []),
                'certificate' => Str::limit(trim((string) ($details['certificate'] ?? '')), 300, ''),
            ],
            'orderable_service' => [
                'service_subtype' => $serviceSubtype,
                'customization_notes' => Str::limit(trim((string) ($details['customization_notes'] ?? '')), 2000, ''),
                'lead_time' => Str::limit(trim((string) ($details['lead_time'] ?? '')), 120, ''),
                'pickup_delivery_notes' => Str::limit(trim((string) ($details['pickup_delivery_notes'] ?? '')), 1200, ''),
            ],
            default => collect($details)
                ->map(fn ($value) => is_string($value) ? Str::limit(trim($value), 2000, '') : $value)
                ->filter(fn ($value) => $value !== null && $value !== '' && $value !== [])
                ->all(),
        };
    }

    private function legacyServicePriceDisplayFromRequest(?string $pricingModel): string
    {
        return match ($pricingModel) {
            'hourly_rate' => 'hourly',
            'contract_quote', 'showcase_only' => 'quote_only',
            default => 'fixed',
        };
    }

    private function sanitizeMenuModuleDetails(array $details): array
    {
        $dietaryTags = collect($details['dietary_tags'] ?? [])
            ->filter(fn ($tag) => is_string($tag) && trim($tag) !== '')
            ->map(fn ($tag) => Str::limit(Str::slug(trim($tag), '_'), 40, ''))
            ->unique()
            ->values()
            ->all();

        $availability = collect($details['availability'] ?? [])
            ->filter(fn ($mode) => in_array($mode, ['dine_in', 'pickup', 'delivery'], true))
            ->unique()
            ->values()
            ->all();

        $addOns = collect($details['add_ons'] ?? [])
            ->map(fn ($row) => [
                'name' => Str::limit(trim((string) ($row['name'] ?? '')), 120, ''),
                'price' => isset($row['price']) && $row['price'] !== '' ? max(0, (float) $row['price']) : 0,
            ])
            ->filter(fn ($row) => $row['name'] !== '')
            ->take(20)
            ->values()
            ->all();

        return [
            'section' => Str::limit(trim((string) ($details['section'] ?? 'Main menu')), 80, ''),
            'item_type' => Str::limit(trim((string) ($details['item_type'] ?? 'food')), 80, ''),
            'prep_time_minutes' => isset($details['prep_time_minutes']) && $details['prep_time_minutes'] !== ''
                ? max(0, min(1440, (int) $details['prep_time_minutes']))
                : null,
            'dietary_tags' => $dietaryTags,
            'availability' => $availability ?: ['dine_in', 'pickup'],
            'add_ons' => $addOns,
        ];
    }

    private function sanitizeRoomModuleDetails(array $details): array
    {
        $amenities = collect($details['amenities'] ?? [])
            ->filter(fn ($amenity) => is_string($amenity) && trim($amenity) !== '')
            ->map(fn ($amenity) => Str::limit(Str::slug(trim($amenity), '_'), 80, ''))
            ->unique()
            ->values()
            ->all();

        $availability = collect($details['availability'] ?? [])
            ->filter(fn ($mode) => in_array($mode, ['available', 'limited', 'occupied', 'maintenance'], true))
            ->unique()
            ->values()
            ->all();

        return [
            'room_type' => Str::limit(trim((string) ($details['room_type'] ?? 'Standard room')), 80, ''),
            'bed_type' => Str::limit(trim((string) ($details['bed_type'] ?? 'Double bed')), 80, ''),
            'max_guests' => isset($details['max_guests']) && $details['max_guests'] !== ''
                ? max(1, min(100000, (int) $details['max_guests']))
                : 2,
            'room_count' => isset($details['room_count']) && $details['room_count'] !== ''
                ? max(1, min(100000, (int) $details['room_count']))
                : 1,
            'bathrooms' => isset($details['bathrooms']) && $details['bathrooms'] !== ''
                ? max(0, min(1000, (float) $details['bathrooms']))
                : null,
            'checkin_time' => preg_match('/^\d{2}:\d{2}$/', (string) ($details['checkin_time'] ?? ''))
                ? $details['checkin_time']
                : '14:00',
            'checkout_time' => preg_match('/^\d{2}:\d{2}$/', (string) ($details['checkout_time'] ?? ''))
                ? $details['checkout_time']
                : '10:00',
            'amenities' => $amenities,
            'availability' => $availability ?: ['available'],
            'booking_policy' => Str::limit(trim((string) ($details['booking_policy'] ?? 'manual_confirm')), 80, ''),
        ];
    }

    private function sanitizeTourModuleDetails(array $details): array
    {
        $cleanList = fn ($items) => collect($items ?? [])
            ->filter(fn ($item) => is_string($item) && trim($item) !== '')
            ->map(fn ($item) => Str::limit(trim($item), 160, ''))
            ->unique()
            ->values()
            ->all();

        $itinerary = collect($details['itinerary'] ?? [])
            ->map(fn ($row, $index) => [
                'day' => isset($row['day']) && $row['day'] !== '' ? max(1, min(365, (int) $row['day'])) : $index + 1,
                'title' => Str::limit(trim((string) ($row['title'] ?? '')), 160, ''),
                'description' => Str::limit(trim((string) ($row['description'] ?? '')), 500, ''),
            ])
            ->filter(fn ($row) => $row['title'] !== '' || $row['description'] !== '')
            ->take(30)
            ->values()
            ->all();

        return [
            'destination' => Str::limit(trim((string) ($details['destination'] ?? '')), 160, ''),
            'duration_label' => Str::limit(trim((string) ($details['duration_label'] ?? '')), 80, ''),
            'pickup_point' => Str::limit(trim((string) ($details['pickup_point'] ?? '')), 160, ''),
            'dropoff_point' => Str::limit(trim((string) ($details['dropoff_point'] ?? '')), 160, ''),
            'group_size' => isset($details['group_size']) && $details['group_size'] !== ''
                ? max(1, min(100000, (int) $details['group_size']))
                : null,
            'departure_type' => Str::limit(trim((string) ($details['departure_type'] ?? 'scheduled')), 80, ''),
            'itinerary' => $itinerary,
            'included' => $cleanList($details['included'] ?? []),
            'excluded' => $cleanList($details['excluded'] ?? []),
            'requirements' => Str::limit(trim((string) ($details['requirements'] ?? '')), 3000, ''),
        ];
    }

    private function sanitizeCustomOrderModuleDetails(array $details): array
    {
        return [
            'customization_notes' => Str::limit(trim((string) ($details['customization_notes'] ?? '')), 3000, ''),
            'lead_time' => Str::limit(trim((string) ($details['lead_time'] ?? '')), 160, ''),
            'pickup_delivery_notes' => Str::limit(trim((string) ($details['pickup_delivery_notes'] ?? '')), 3000, ''),
            'quote_policy' => Str::limit(trim((string) ($details['quote_policy'] ?? 'quote_after_request')), 160, ''),
            'minimum_order' => isset($details['minimum_order']) && $details['minimum_order'] !== ''
                ? max(1, min(100000, (int) $details['minimum_order']))
                : null,
        ];
    }

    private function sanitizeAppointmentModuleDetails(array $details): array
    {
        $locationMode = (string) ($details['appointment_location_mode'] ?? 'provider_location');
        $bookingPolicy = (string) ($details['booking_policy'] ?? 'manual_confirm');

        return [
            'appointment_duration_minutes' => isset($details['appointment_duration_minutes']) && $details['appointment_duration_minutes'] !== ''
                ? max(1, min(10080, (int) $details['appointment_duration_minutes']))
                : 60,
            'buffer_minutes' => isset($details['buffer_minutes']) && $details['buffer_minutes'] !== ''
                ? max(0, min(10080, (int) $details['buffer_minutes']))
                : 15,
            'capacity' => isset($details['capacity']) && $details['capacity'] !== ''
                ? max(1, min(100000, (int) $details['capacity']))
                : 1,
            'appointment_location_mode' => in_array($locationMode, ['provider_location', 'customer_location', 'remote', 'hybrid'], true)
                ? $locationMode
                : 'provider_location',
            'booking_policy' => in_array($bookingPolicy, ['instant', 'manual_confirm', 'request_first'], true)
                ? $bookingPolicy
                : 'manual_confirm',
            'preparation_notes' => Str::limit(trim((string) ($details['preparation_notes'] ?? '')), 3000, ''),
        ];
    }

    private function sanitizeReservationModuleDetails(array $details): array
    {
        $reservationType = (string) ($details['reservation_type'] ?? 'table');
        $reservationPolicy = (string) ($details['reservation_policy'] ?? 'manual_confirm');

        return [
            'reservation_type' => in_array($reservationType, ['table', 'private_room', 'venue', 'seat', 'booth', 'visit', 'event_space', 'activity', 'other'], true)
                ? $reservationType
                : 'table',
            'seating_type' => Str::limit(trim((string) ($details['seating_type'] ?? 'Standard seating')), 80, ''),
            'reservation_duration_minutes' => isset($details['reservation_duration_minutes']) && $details['reservation_duration_minutes'] !== ''
                ? max(1, min(10080, (int) $details['reservation_duration_minutes']))
                : 90,
            'party_size_limit' => isset($details['party_size_limit']) && $details['party_size_limit'] !== ''
                ? max(1, min(100000, (int) $details['party_size_limit']))
                : null,
            'reservation_policy' => in_array($reservationPolicy, ['instant', 'manual_confirm', 'request_first'], true)
                ? $reservationPolicy
                : 'manual_confirm',
            'deposit_amount' => isset($details['deposit_amount']) && $details['deposit_amount'] !== ''
                ? max(0, (float) $details['deposit_amount'])
                : null,
            'deposit_note' => Str::limit(trim((string) ($details['deposit_note'] ?? '')), 1000, ''),
            'reservation_notes' => Str::limit(trim((string) ($details['reservation_notes'] ?? '')), 3000, ''),
        ];
    }

    private function sanitizeRentalModuleDetails(array $details): array
    {
        $rentalType = (string) ($details['rental_type'] ?? ($details['service_subtype'] ?? 'tools_equipment'));
        $rentalUnit = (string) ($details['rental_unit'] ?? 'day');
        $rentalPolicy = (string) ($details['rental_policy'] ?? 'manual_confirm');

        return [
            'service_subtype' => in_array($rentalType, ['none', 'tools_equipment', 'equipment', 'vehicle', 'space', 'property', 'event_equipment', 'event_gear', 'costume', 'other'], true)
                ? $rentalType
                : 'tools_equipment',
            'rental_type' => in_array($rentalType, ['none', 'tools_equipment', 'equipment', 'vehicle', 'space', 'property', 'event_equipment', 'event_gear', 'costume', 'other'], true)
                ? $rentalType
                : 'tools_equipment',
            'rental_unit' => in_array($rentalUnit, ['hour', 'day', 'night', 'week', 'month', 'year', 'trip', 'event'], true)
                ? $rentalUnit
                : 'day',
            'rental_duration_minutes' => isset($details['rental_duration_minutes']) && $details['rental_duration_minutes'] !== ''
                ? max(1, min(5256000, (int) $details['rental_duration_minutes']))
                : 1440,
            'available_units' => isset($details['available_units']) && $details['available_units'] !== ''
                ? max(1, min(100000, (int) $details['available_units']))
                : 1,
            'security_deposit' => isset($details['security_deposit']) && $details['security_deposit'] !== ''
                ? max(0, (float) $details['security_deposit'])
                : null,
            'rental_policy' => in_array($rentalPolicy, ['instant', 'manual_confirm', 'request_first'], true)
                ? $rentalPolicy
                : 'manual_confirm',
            'pickup_return_notes' => Str::limit(trim((string) ($details['pickup_return_notes'] ?? '')), 3000, ''),
            'included_items' => collect($details['included_items'] ?? [])
                ->map(fn ($item) => Str::limit(trim((string) $item), 160, ''))
                ->filter()
                ->values()
                ->all(),
            'rental_requirements' => Str::limit(trim((string) ($details['rental_requirements'] ?? '')), 3000, ''),
        ];
    }

    private function sanitizeWorkshopModuleDetails(array $details): array
    {
        $stringList = fn ($value, int $limit = 12) => collect((array) $value)
            ->map(fn ($item) => Str::limit(trim((string) $item), 160, ''))
            ->filter()
            ->unique()
            ->take($limit)
            ->values()
            ->all();

        $format = (string) ($details['workshop_format'] ?? 'live_session');
        $policy = (string) ($details['enrollment_policy'] ?? 'manual_confirm');
        $locationMode = (string) ($details['workshop_location_mode'] ?? 'provider_location');

        return [
            'workshop_format' => in_array($format, ['live_session', 'bootcamp', 'seminar', 'webinar', 'cohort', 'private_group'], true)
                ? $format
                : 'live_session',
            'session_count' => isset($details['session_count']) && $details['session_count'] !== ''
                ? max(1, min(1000, (int) $details['session_count']))
                : 1,
            'workshop_duration_minutes' => isset($details['workshop_duration_minutes']) && $details['workshop_duration_minutes'] !== ''
                ? max(1, min(10080, (int) $details['workshop_duration_minutes']))
                : 120,
            'workshop_capacity' => isset($details['workshop_capacity']) && $details['workshop_capacity'] !== ''
                ? max(1, min(100000, (int) $details['workshop_capacity']))
                : null,
            'workshop_level' => Str::limit(trim((string) ($details['workshop_level'] ?? 'All levels')), 80, ''),
            'enrollment_policy' => in_array($policy, ['instant', 'manual_confirm', 'request_first'], true)
                ? $policy
                : 'manual_confirm',
            'workshop_location_mode' => in_array($locationMode, ['provider_location', 'customer_location', 'remote', 'hybrid'], true)
                ? $locationMode
                : 'provider_location',
            'workshop_start_note' => Str::limit(trim((string) ($details['workshop_start_note'] ?? '')), 160, ''),
            'learning_outcomes' => $stringList($details['learning_outcomes'] ?? []),
            'workshop_requirements' => $stringList($details['workshop_requirements'] ?? []),
            'materials_included' => $stringList($details['materials_included'] ?? []),
        ];
    }

    private function sanitizeForwarderModuleDetails(array $details): array
    {
        $stringList = fn ($value, int $limit = 12) => collect((array) $value)
            ->map(fn ($item) => Str::limit(trim((string) $item), 80, ''))
            ->filter()
            ->unique()
            ->take($limit)
            ->values()
            ->all();

        $locations = fn ($value) => collect((array) $value)
            ->map(fn ($row) => [
                'name' => Str::limit(trim((string) ($row['name'] ?? '')), 120, ''),
                'country_name' => Str::limit(trim((string) ($row['country_name'] ?? '')), 120, ''),
                'country_iso2' => strtoupper(Str::limit(trim((string) ($row['country_iso2'] ?? '')), 2, '')),
                'state_name' => Str::limit(trim((string) ($row['state_name'] ?? '')), 120, ''),
                'city_name' => Str::limit(trim((string) ($row['city_name'] ?? '')), 120, ''),
                'address_line' => Str::limit(trim((string) ($row['address_line'] ?? '')), 500, ''),
                'contact_phone' => Str::limit(trim((string) ($row['contact_phone'] ?? '')), 40, ''),
                'instructions' => Str::limit(trim((string) ($row['instructions'] ?? '')), 1000, ''),
            ])
            ->filter(fn ($row) => $row['name'] !== '' || $row['address_line'] !== '' || $row['country_name'] !== '' || $row['city_name'] !== '')
            ->take(20)
            ->values()
            ->all();

        $serviceTypes = $stringList($details['service_types'] ?? ['import_forwarding']);
        $requiredFields = collect($stringList($details['required_fields'] ?? ['customer_id']))
            ->map(fn ($field) => Str::slug($field, '_'))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return [
            'legal_name' => Str::limit(trim((string) ($details['legal_name'] ?? '')), 160, ''),
            'contact_person' => Str::limit(trim((string) ($details['contact_person'] ?? '')), 120, ''),
            'contact_email' => Str::limit(trim((string) ($details['contact_email'] ?? '')), 160, ''),
            'whatsapp_phone' => Str::limit(trim((string) ($details['whatsapp_phone'] ?? '')), 40, ''),
            'website' => Str::limit(trim((string) ($details['website'] ?? '')), 2048, ''),
            'logo_url' => Str::limit(trim((string) ($details['logo_url'] ?? '')), 2048, ''),
            'service_types' => $serviceTypes ?: ['import_forwarding'],
            'required_fields' => $requiredFields ?: ['customer_id'],
            'origin_locations' => $locations($details['origin_locations'] ?? []),
            'destination_locations' => $locations($details['destination_locations'] ?? []),
            'merchant_instructions' => Str::limit(trim((string) ($details['merchant_instructions'] ?? '')), 3000, ''),
            'customer_instructions' => Str::limit(trim((string) ($details['customer_instructions'] ?? '')), 3000, ''),
            'license_notes' => Str::limit(trim((string) ($details['license_notes'] ?? '')), 3000, ''),
            'rates_info' => Str::limit(trim((string) ($details['rates_info'] ?? '')), 3000, ''),
        ];
    }

    private function syncForwarderService(Product $product, Merchant $merchant, ?int $userId): void
    {
        $details = $product->module_details ?? [];
        $allLocations = collect($details['destination_locations'] ?? [])
            ->merge($details['origin_locations'] ?? []);
        $primaryLocation = $allLocations->firstWhere('address_line') ?? $allLocations->first() ?? [];

        $forwarder = Forwarder::query()->updateOrCreate(
            ['product_id' => $product->id],
            [
                'merchant_id' => $merchant->id,
                'name' => $product->title,
                'legal_name' => $details['legal_name'] ?: $product->title,
                'address_line' => $primaryLocation['address_line'] ?? ($merchant->display_name ?: $product->title),
                'contact_phone' => $details['whatsapp_phone'] ?: null,
                'contact_person' => $details['contact_person'] ?: null,
                'contact_email' => $details['contact_email'] ?: null,
                'whatsapp_phone' => $details['whatsapp_phone'] ?: null,
                'website' => $details['website'] ?: null,
                'logo_url' => $details['logo_url'] ?: $product->image_url,
                'description' => $product->description,
                'rates_info' => $details['rates_info'] ?: null,
                'required_fields' => $details['required_fields'] ?? ['customer_id'],
                'service_types' => $details['service_types'] ?? ['import_forwarding'],
                'documents' => array_filter([
                    'license_notes' => $details['license_notes'] ?? null,
                ]),
                'submitted_by_user_id' => $userId,
                'verification_status' => 'pending',
                'is_verified' => false,
                'verified_at' => null,
            ]
        );

        $forwarder->locations()->delete();
        $this->syncForwarderServiceLocations($forwarder, $details['origin_locations'] ?? [], 'origin', $details);
        $this->syncForwarderServiceLocations($forwarder, $details['destination_locations'] ?? [], 'destination', $details);
    }

    private function syncForwarderServiceLocations(Forwarder $forwarder, array $locations, string $role, array $details): void
    {
        $resolver = app(GeographyResolver::class);

        foreach ($locations as $location) {
            $geo = $resolver->resolve(
                countryIso2: $location['country_iso2'] ?? null,
                countryName: $location['country_name'] ?? null,
                stateName: $location['state_name'] ?? null,
                cityName: $location['city_name'] ?? null,
            );

            $forwarder->locations()->create([
                'roles' => [$role],
                'name' => $location['name'] ?: ($role === 'origin' ? 'Origin warehouse' : 'Collection office'),
                'address_line' => $location['address_line'] ?: trim(collect([
                    $location['city_name'] ?? null,
                    $location['state_name'] ?? null,
                    $location['country_name'] ?? null,
                ])->filter()->join(', ')),
                'country_id' => $geo['country_id'] ?? null,
                'state_id' => $geo['state_id'] ?? null,
                'city_id' => $geo['city_id'] ?? null,
                'contact_phone' => $location['contact_phone'] ?: ($details['whatsapp_phone'] ?? null),
                'merchant_instructions' => $role === 'origin'
                    ? ($location['instructions'] ?: ($details['merchant_instructions'] ?? null))
                    : null,
                'customer_instructions' => $role === 'destination'
                    ? ($location['instructions'] ?: ($details['customer_instructions'] ?? null))
                    : null,
                'required_fields' => $details['required_fields'] ?? ['customer_id'],
                'is_verified' => false,
                'is_active' => true,
            ]);
        }
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
            $merchant = \App\Support\MerchantPermissions::accessibleMerchantsFor($user)
                ->firstWhere('id', (int) $merchantId);
            if ($merchant) {
                return $merchant;
            }
        }

        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first()
            ?? \App\Support\MerchantPermissions::accessibleMerchantsFor($user)->first();

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
            $merchant = \App\Support\MerchantPermissions::accessibleMerchantsFor($user)
                ->firstWhere('id', (int) $merchantId);
            if ($merchant) {
                return $merchant;
            }
        }

        return $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first()
            ?? \App\Support\MerchantPermissions::accessibleMerchantsFor($user)->first();
    }
}
