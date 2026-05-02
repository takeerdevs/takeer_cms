<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\BundleCourseModule;
use App\Models\BundleItem;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MerchantBundleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $bundles = Bundle::where('merchant_id', $merchant->id)
            ->with(['items', 'courseModules.lessons.assets', 'courseModules.lessons.liveSession', 'cohorts'])
            ->latest()
            ->get();

        return response()->json(['bundles' => $bundles]);
    }

    public function show(Request $request, Bundle $bundle): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $bundle->merchant_id);

        $bundle->load(['items', 'courseModules.lessons.assets', 'courseModules.lessons.liveSession', 'cohorts']);

        return response()->json(['bundle' => $bundle]);
    }

    public function store(Request $request, EntitlementService $entitlementService): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'currency_id' => 'nullable|integer|exists:currencies,id',
            'is_individual_sale' => 'nullable|boolean',
            'is_course' => 'nullable|boolean',
            'course_format' => 'nullable|string|in:self_paced,cohort,live',
            'course_outcomes' => 'nullable|array',
            'course_outcomes.*' => 'nullable|string|max:255',
            'course_requirements' => 'nullable|array',
            'course_requirements.*' => 'nullable|string|max:255',
            'course_cover_image_url' => 'nullable|string|max:1000',
            ...$this->courseValidationRules(),
            'status' => 'nullable|string|in:draft,published,archived',
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:product,content_item',
            'items.*.item_id' => 'required_with:items|integer|min:1',
            'items.*.selected_variant_id' => 'nullable|integer|min:1',
            'items.*.section_title' => 'nullable|string|max:255',
            'items.*.lesson_title' => 'nullable|string|max:255',
            'items.*.lesson_summary' => 'nullable|string|max:2000',
            'items.*.supporting_materials' => 'nullable|array',
            'items.*.supporting_materials.*.name' => 'required_with:items.*.supporting_materials|string|max:255',
            'items.*.supporting_materials.*.url' => 'required_with:items.*.supporting_materials|string|max:1000',
            'items.*.supporting_materials.*.mime' => 'nullable|string|max:255',
            'items.*.supporting_materials.*.size' => 'nullable|integer|min:0',
            'items.*.lesson_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'items.*.unlock_after_days' => 'nullable|integer|min:0|max:3650',
            'items.*.is_preview' => 'nullable|boolean',
            'items.*.sort_order' => 'nullable|integer|min:0',
        ]);

        $bundle = DB::transaction(function () use ($validated, $merchant) {
            $bundle = Bundle::create([
                'merchant_id' => $merchant->id,
                'title' => $validated['title'],
                'slug' => Str::slug($validated['title']) . '-' . Str::lower(Str::random(6)),
                'description' => $validated['description'] ?? null,
                'price' => $validated['price'] ?? null,
                'currency_id' => $validated['currency_id'] ?? null,
                'is_individual_sale' => $validated['is_individual_sale'] ?? true,
                'is_course' => $validated['is_course'] ?? false,
                'course_format' => $validated['course_format'] ?? null,
                'course_outcomes' => $this->sanitizeStringArray($validated['course_outcomes'] ?? []),
                'course_requirements' => $this->sanitizeStringArray($validated['course_requirements'] ?? []),
                'course_cover_image_url' => $validated['course_cover_image_url'] ?? null,
                'status' => $validated['status'] ?? 'draft',
            ]);

            foreach ($validated['items'] ?? [] as $item) {
                $this->assertItemBelongsToMerchant($merchant->id, $item['item_type'], (int) $item['item_id']);
                $resolvedVariant = $this->resolveSelectedVariantForBundleItem(
                    $item['item_type'],
                    (int) $item['item_id'],
                    isset($item['selected_variant_id']) ? (int) $item['selected_variant_id'] : null,
                );
                $bundle->items()->create([
                    'item_type' => $item['item_type'],
                    'item_id' => $item['item_id'],
                    'selected_variant_id' => $resolvedVariant['selected_variant_id'],
                    'selected_variant_snapshot' => $resolvedVariant['selected_variant_snapshot'],
                    'section_title' => $item['section_title'] ?? null,
                    'lesson_title' => $item['lesson_title'] ?? null,
                    'lesson_summary' => $item['lesson_summary'] ?? null,
                    'supporting_materials' => $this->sanitizeSupportingMaterials($item['supporting_materials'] ?? []),
                    'lesson_duration_minutes' => $item['lesson_duration_minutes'] ?? null,
                    'unlock_after_days' => (int) ($item['unlock_after_days'] ?? 0),
                    'is_preview' => (bool) ($item['is_preview'] ?? false),
                    'sort_order' => $item['sort_order'] ?? 0,
                ]);
            }

            if (($validated['is_course'] ?? false) && array_key_exists('course_modules', $validated)) {
                $this->syncCourseStructure(
                    $bundle,
                    $validated['course_modules'] ?? [],
                    $validated['cohorts'] ?? [],
                    $merchant
                );
            }

            return $bundle;
        });

        $entitlementService->syncActiveEntitlementsForBundle((int) $bundle->id);
        if (($validated['status'] ?? 'draft') === 'published') {
            $this->syncFeedPostForPublishedBundle($bundle->fresh());
        }

        return response()->json([
            'message' => 'Bundle created.',
            'bundle' => $bundle->load(['items', 'courseModules.lessons.assets', 'courseModules.lessons.liveSession', 'cohorts']),
        ], 201);
    }

    public function update(Request $request, Bundle $bundle, EntitlementService $entitlementService): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $bundle->merchant_id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'nullable|numeric|min:0',
            'currency_id' => 'nullable|integer|exists:currencies,id',
            'is_individual_sale' => 'nullable|boolean',
            'is_course' => 'nullable|boolean',
            'course_format' => 'nullable|string|in:self_paced,cohort,live',
            'course_outcomes' => 'nullable|array',
            'course_outcomes.*' => 'nullable|string|max:255',
            'course_requirements' => 'nullable|array',
            'course_requirements.*' => 'nullable|string|max:255',
            'course_cover_image_url' => 'nullable|string|max:1000',
            ...$this->courseValidationRules(),
            'status' => 'nullable|string|in:draft,published,archived',
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:product,content_item',
            'items.*.item_id' => 'required_with:items|integer|min:1',
            'items.*.selected_variant_id' => 'nullable|integer|min:1',
            'items.*.section_title' => 'nullable|string|max:255',
            'items.*.lesson_title' => 'nullable|string|max:255',
            'items.*.lesson_summary' => 'nullable|string|max:2000',
            'items.*.supporting_materials' => 'nullable|array',
            'items.*.supporting_materials.*.name' => 'required_with:items.*.supporting_materials|string|max:255',
            'items.*.supporting_materials.*.url' => 'required_with:items.*.supporting_materials|string|max:1000',
            'items.*.supporting_materials.*.mime' => 'nullable|string|max:255',
            'items.*.supporting_materials.*.size' => 'nullable|integer|min:0',
            'items.*.lesson_duration_minutes' => 'nullable|integer|min:1|max:10080',
            'items.*.unlock_after_days' => 'nullable|integer|min:0|max:3650',
            'items.*.is_preview' => 'nullable|boolean',
            'items.*.sort_order' => 'nullable|integer|min:0',
        ]);

        if (array_key_exists('course_outcomes', $validated)) {
            $validated['course_outcomes'] = $this->sanitizeStringArray($validated['course_outcomes'] ?? []);
        }
        if (array_key_exists('course_requirements', $validated)) {
            $validated['course_requirements'] = $this->sanitizeStringArray($validated['course_requirements'] ?? []);
        }

        DB::transaction(function () use ($validated, $bundle, $merchant) {
            $titleChanged = array_key_exists('title', $validated)
                && trim((string) $validated['title']) !== (string) $bundle->title;

            $bundle->update([
                ...collect($validated)->except(['items', 'course_modules', 'cohorts'])->toArray(),
                'slug' => $titleChanged
                    ? Str::slug($validated['title']) . '-' . Str::lower(Str::random(6))
                    : $bundle->slug,
            ]);

            if (($validated['is_course'] ?? $bundle->is_course) && array_key_exists('course_modules', $validated)) {
                $this->syncCourseStructure(
                    $bundle,
                    $validated['course_modules'] ?? [],
                    $validated['cohorts'] ?? [],
                    $merchant
                );
            } elseif (array_key_exists('items', $validated)) {
                $bundle->items()->delete();
                foreach ($validated['items'] as $item) {
                    $this->assertItemBelongsToMerchant($merchant->id, $item['item_type'], (int) $item['item_id']);
                    $resolvedVariant = $this->resolveSelectedVariantForBundleItem(
                        $item['item_type'],
                        (int) $item['item_id'],
                        isset($item['selected_variant_id']) ? (int) $item['selected_variant_id'] : null,
                    );
                    BundleItem::create([
                        'bundle_id' => $bundle->id,
                        'item_type' => $item['item_type'],
                        'item_id' => $item['item_id'],
                        'selected_variant_id' => $resolvedVariant['selected_variant_id'],
                        'selected_variant_snapshot' => $resolvedVariant['selected_variant_snapshot'],
                        'section_title' => $item['section_title'] ?? null,
                        'lesson_title' => $item['lesson_title'] ?? null,
                        'lesson_summary' => $item['lesson_summary'] ?? null,
                        'supporting_materials' => $this->sanitizeSupportingMaterials($item['supporting_materials'] ?? []),
                        'lesson_duration_minutes' => $item['lesson_duration_minutes'] ?? null,
                        'unlock_after_days' => (int) ($item['unlock_after_days'] ?? 0),
                        'is_preview' => (bool) ($item['is_preview'] ?? false),
                        'sort_order' => $item['sort_order'] ?? 0,
                    ]);
                }
            }
        });

        $newStatus = $bundle->fresh()->status;
        if ($newStatus === 'published') {
            $this->syncFeedPostForPublishedBundle($bundle->fresh());
        } else {
            $this->deleteFeedPostForBundle($bundle);
        }

        $entitlementService->syncActiveEntitlementsForBundle((int) $bundle->id);

        return response()->json([
            'message' => 'Bundle updated.',
            'bundle' => $bundle->fresh()->load(['items', 'courseModules.lessons.assets', 'courseModules.lessons.liveSession', 'cohorts']),
        ]);
    }

    public function destroy(Request $request, Bundle $bundle): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $bundle->merchant_id);

        $this->deleteFeedPostForBundle($bundle);
        $bundle->delete();

        return response()->json(['message' => 'Bundle deleted.']);
    }

    private function assertItemBelongsToMerchant(int $merchantId, string $itemType, int $itemId): void
    {
        if ($itemType === 'product') {
            $exists = Product::where('id', $itemId)->where('merchant_id', $merchantId)->exists();
            abort_unless($exists, 422, 'Bundle item product is invalid.');
            return;
        }

        if ($itemType === 'content_item') {
            $exists = ContentItem::where('id', $itemId)->where('merchant_id', $merchantId)->exists();
            abort_unless($exists, 422, 'Bundle item content is invalid.');
            return;
        }

        if ($itemType === 'post') {
            $exists = Post::where('id', $itemId)
                ->where('merchant_id', $merchantId)
                ->where('source', 'authored')
                ->exists();
            abort_unless($exists, 422, 'Course lesson post is invalid.');
            return;
        }

        abort(422, 'Unsupported bundle item type.');
    }

    private function merchantFromRequest(Request $request)
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

    private function ensureOwnership(int $merchantId, int $bundleMerchantId): void
    {
        abort_if($merchantId !== $bundleMerchantId, 403, 'Unauthorized.');
    }

    private function sanitizeStringArray(array $items): array
    {
        return collect($items)
            ->map(fn ($item) => trim((string) $item))
            ->filter(fn ($item) => $item !== '')
            ->values()
            ->all();
    }

    private function sanitizeSupportingMaterials(array $materials): array
    {
        return collect($materials)
            ->map(function ($material) {
                $material = (array) $material;

                return [
                    'name' => trim((string) ($material['name'] ?? 'Material')),
                    'url' => trim((string) ($material['url'] ?? '')),
                    'mime' => isset($material['mime']) ? trim((string) $material['mime']) : null,
                    'size' => isset($material['size']) ? max(0, (int) $material['size']) : null,
                ];
            })
            ->filter(fn ($material) => $material['name'] !== '' && $material['url'] !== '')
            ->values()
            ->all();
    }

    private function courseValidationRules(): array
    {
        return [
            'course_modules' => 'nullable|array',
            'course_modules.*.title' => 'nullable|string|max:255',
            'course_modules.*.sort_order' => 'nullable|integer|min:0',
            'course_modules.*.lessons' => 'nullable|array',
            'course_modules.*.lessons.*.title' => 'required_with:course_modules.*.lessons|string|max:255',
            'course_modules.*.lessons.*.summary' => 'nullable|string|max:2000',
            'course_modules.*.lessons.*.duration_minutes' => 'nullable|integer|min:1|max:10080',
            'course_modules.*.lessons.*.unlock_after_days' => 'nullable|integer|min:0|max:3650',
            'course_modules.*.lessons.*.is_preview' => 'nullable|boolean',
            'course_modules.*.lessons.*.sort_order' => 'nullable|integer|min:0',
            'course_modules.*.lessons.*.assets' => 'nullable|array',
            'course_modules.*.lessons.*.assets.*.role' => 'nullable|string|in:primary,supporting',
            'course_modules.*.lessons.*.assets.*.asset_type' => 'nullable|string|in:product,content_item,post,file',
            'course_modules.*.lessons.*.assets.*.asset_id' => 'nullable|integer|min:1',
            'course_modules.*.lessons.*.assets.*.selected_variant_id' => 'nullable|integer|min:1',
            'course_modules.*.lessons.*.assets.*.name' => 'nullable|string|max:255',
            'course_modules.*.lessons.*.assets.*.url' => 'nullable|string|max:1000',
            'course_modules.*.lessons.*.assets.*.mime' => 'nullable|string|max:255',
            'course_modules.*.lessons.*.assets.*.size' => 'nullable|integer|min:0',
            'course_modules.*.lessons.*.assets.*.sort_order' => 'nullable|integer|min:0',
            'course_modules.*.lessons.*.live_session' => 'nullable|array',
            'course_modules.*.lessons.*.live_session.starts_at' => 'nullable|date',
            'course_modules.*.lessons.*.live_session.duration_minutes' => 'nullable|integer|min:1|max:10080',
            'course_modules.*.lessons.*.live_session.timezone' => 'nullable|string|max:255',
            'course_modules.*.lessons.*.live_session.meeting_url' => 'nullable|string|max:1000',
            'course_modules.*.lessons.*.live_session.venue' => 'nullable|string|max:255',
            'course_modules.*.lessons.*.live_session.capacity' => 'nullable|integer|min:1|max:100000',
            'course_modules.*.lessons.*.live_session.notes' => 'nullable|string|max:2000',
            'cohorts' => 'nullable|array',
            'cohorts.*.name' => 'nullable|string|max:255',
            'cohorts.*.starts_at' => 'nullable|date',
            'cohorts.*.enrollment_deadline' => 'nullable|date',
            'cohorts.*.capacity' => 'nullable|integer|min:1|max:100000',
            'cohorts.*.access_rule' => 'nullable|string|in:all_on_start,weekly,manual',
            'cohorts.*.status' => 'nullable|string|in:upcoming,active,closed',
        ];
    }

    private function syncCourseStructure(Bundle $bundle, array $modules, array $cohorts, Merchant $merchant): void
    {
        $bundle->courseModules()->delete();
        $bundle->cohorts()->delete();
        $bundle->items()->delete();

        foreach ($modules as $moduleIndex => $moduleData) {
            $module = $bundle->courseModules()->create([
                'title' => trim((string) ($moduleData['title'] ?? 'Moduli ya ' . ($moduleIndex + 1))),
                'sort_order' => (int) ($moduleData['sort_order'] ?? $moduleIndex),
            ]);

            foreach (($moduleData['lessons'] ?? []) as $lessonIndex => $lessonData) {
                $lessonTitle = trim((string) ($lessonData['title'] ?? 'Somo la ' . ($lessonIndex + 1)));
                if ($lessonTitle === '') {
                    continue;
                }

                $lesson = $module->lessons()->create([
                    'title' => $lessonTitle,
                    'summary' => $lessonData['summary'] ?? null,
                    'duration_minutes' => $lessonData['duration_minutes'] ?? null,
                    'unlock_after_days' => (int) ($lessonData['unlock_after_days'] ?? 0),
                    'is_preview' => (bool) ($lessonData['is_preview'] ?? false),
                    'sort_order' => (int) ($lessonData['sort_order'] ?? $lessonIndex),
                ]);

                foreach (($lessonData['assets'] ?? []) as $assetIndex => $assetData) {
                    $assetType = $assetData['asset_type'] ?? 'file';
                    $role = $assetData['role'] ?? ($assetIndex === 0 ? 'primary' : 'supporting');
                    $assetId = isset($assetData['asset_id']) ? (int) $assetData['asset_id'] : null;
                    $resolvedVariant = ['selected_variant_id' => null, 'selected_variant_snapshot' => null];

                    if (in_array($assetType, ['product', 'content_item', 'post'], true)) {
                        abort_unless($assetId, 422, 'Course lesson attachment is missing an item.');
                        $this->assertItemBelongsToMerchant($merchant->id, $assetType, $assetId);
                        if ($assetType === 'product') {
                            $isDigitalProduct = Product::query()
                                ->where('merchant_id', $merchant->id)
                                ->whereKey($assetId)
                                ->where('type', 'digital')
                                ->exists();
                            abort_unless($isDigitalProduct, 422, 'Course lessons can only use digital products, authored posts, content, or files.');
                        }
                        $resolvedVariant = $this->resolveSelectedVariantForBundleItem(
                            $assetType,
                            $assetId,
                            isset($assetData['selected_variant_id']) ? (int) $assetData['selected_variant_id'] : null,
                        );

                        if (in_array($assetType, ['product', 'content_item'], true)) {
                            $this->mirrorCourseAssetToBundleItem($bundle, $module, $lesson, $assetType, $assetId, $resolvedVariant, $assetIndex);
                        }
                    } else {
                        $url = trim((string) ($assetData['url'] ?? ''));
                        if ($url === '') {
                            continue;
                        }
                    }

                    $lesson->assets()->create([
                        'role' => $role === 'primary' ? 'primary' : 'supporting',
                        'asset_type' => $assetType,
                        'asset_id' => $assetId,
                        'selected_variant_id' => $resolvedVariant['selected_variant_id'],
                        'selected_variant_snapshot' => $resolvedVariant['selected_variant_snapshot'],
                        'name' => trim((string) ($assetData['name'] ?? '')),
                        'url' => trim((string) ($assetData['url'] ?? '')),
                        'mime' => isset($assetData['mime']) ? trim((string) $assetData['mime']) : null,
                        'size' => isset($assetData['size']) ? max(0, (int) $assetData['size']) : null,
                        'sort_order' => (int) ($assetData['sort_order'] ?? $assetIndex),
                    ]);
                }

                $liveSession = $lessonData['live_session'] ?? null;
                if (is_array($liveSession) && $this->hasLiveSessionData($liveSession)) {
                    $lesson->liveSession()->create([
                        'starts_at' => $liveSession['starts_at'] ?? null,
                        'duration_minutes' => $liveSession['duration_minutes'] ?? null,
                        'timezone' => $liveSession['timezone'] ?? null,
                        'meeting_url' => $liveSession['meeting_url'] ?? null,
                        'venue' => $liveSession['venue'] ?? null,
                        'capacity' => $liveSession['capacity'] ?? null,
                        'notes' => $liveSession['notes'] ?? null,
                    ]);
                }
            }
        }

        foreach ($cohorts as $index => $cohortData) {
            $hasCohortData = collect(['name', 'starts_at', 'enrollment_deadline', 'capacity'])
                ->contains(fn ($key) => filled($cohortData[$key] ?? null));
            if (!$hasCohortData) {
                continue;
            }

            $bundle->cohorts()->create([
                'name' => $cohortData['name'] ?? 'Cohort ' . ($index + 1),
                'starts_at' => $cohortData['starts_at'] ?? null,
                'enrollment_deadline' => $cohortData['enrollment_deadline'] ?? null,
                'capacity' => $cohortData['capacity'] ?? null,
                'access_rule' => $cohortData['access_rule'] ?? 'all_on_start',
                'status' => $cohortData['status'] ?? 'upcoming',
            ]);
        }
    }

    private function mirrorCourseAssetToBundleItem(Bundle $bundle, BundleCourseModule $module, $lesson, string $assetType, int $assetId, array $resolvedVariant, int $sortOrder): void
    {
        BundleItem::firstOrCreate(
            [
                'bundle_id' => $bundle->id,
                'item_type' => $assetType,
                'item_id' => $assetId,
            ],
            [
                'selected_variant_id' => $resolvedVariant['selected_variant_id'],
                'selected_variant_snapshot' => $resolvedVariant['selected_variant_snapshot'],
                'section_title' => $module->title,
                'lesson_title' => $lesson->title,
                'lesson_summary' => $lesson->summary,
                'lesson_duration_minutes' => $lesson->duration_minutes,
                'unlock_after_days' => (int) ($lesson->unlock_after_days ?? 0),
                'is_preview' => (bool) ($lesson->is_preview ?? false),
                'sort_order' => $sortOrder,
            ]
        );
    }

    private function hasLiveSessionData(array $liveSession): bool
    {
        return collect(['starts_at', 'duration_minutes', 'meeting_url', 'venue', 'capacity', 'notes'])
            ->contains(fn ($key) => filled($liveSession[$key] ?? null));
    }

    private function resolveSelectedVariantForBundleItem(string $itemType, int $itemId, ?int $selectedVariantId): array
    {
        if ($itemType !== 'product') {
            abort_if(!empty($selectedVariantId), 422, 'Variant can only be set for product items.');

            return [
                'selected_variant_id' => null,
                'selected_variant_snapshot' => null,
            ];
        }

        $product = Product::query()->find($itemId);
        abort_unless($product, 422, 'Bundle item product is invalid.');

        if (!$product->has_variants) {
            return [
                'selected_variant_id' => null,
                'selected_variant_snapshot' => null,
            ];
        }

        abort_if(empty($selectedVariantId), 422, 'Please select a variant for each product that uses variants.');

        $variant = ProductVariant::query()
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->find($selectedVariantId);
        abort_unless($variant, 422, 'Selected variant is invalid or inactive for this product.');

        return [
            'selected_variant_id' => (int) $variant->id,
            'selected_variant_snapshot' => [
                'id' => (int) $variant->id,
                'name' => $variant->name,
                'sku' => $variant->sku,
                'price' => $variant->price !== null ? (float) $variant->price : null,
                'attributes' => $variant->attributes ?? [],
                'swatch_image_url' => $variant->swatch_image_url,
            ],
        ];
    }

    private function syncFeedPostForPublishedBundle(Bundle $bundle): void
    {
        if ($bundle->status !== 'published') {
            return;
        }

        $bundle->loadMissing('items');
        $existingFeedPost = Post::query()
            ->where('merchant_id', $bundle->merchant_id)
            ->whereHas('promotableBundles', fn ($query) => $query->where('bundles.id', $bundle->id))
            ->first();

        $itemsCount = (int) ($bundle->items?->count() ?? 0);
        $excerpt = trim((string) ($bundle->description ?? ''));
        $captionLines = array_filter([
            $bundle->title,
            trim((string) ($bundle->description ?? '')),
        ]);

        $post = $existingFeedPost ?: new Post([
            'merchant_id' => $bundle->merchant_id,
            'source' => 'bundle_publish',
        ]);

        $post->fill([
            'title' => $bundle->title,
            'source' => 'bundle_publish',
            'excerpt' => $excerpt,
            'caption' => implode("\n\n", $captionLines),
            'is_restricted' => true,
            'restricted_price' => null,
            'bg_style' => $existingFeedPost?->bg_style,
        ]);
        $post->save();
        $post->promotableBundles()->syncWithoutDetaching([$bundle->id]);

        if (!empty($bundle->course_cover_image_url)) {
            $post->media()->updateOrCreate(
                ['post_id' => $post->id, 'media_type' => 'image'],
                ['media_url' => $bundle->course_cover_image_url]
            );
        }
    }

    private function deleteFeedPostForBundle(Bundle $bundle): void
    {
        Post::query()
            ->where('merchant_id', $bundle->merchant_id)
            ->whereHas('promotableBundles', fn ($query) => $query->where('bundles.id', $bundle->id))
            ->get()
            ->each
            ->delete();
    }
}
