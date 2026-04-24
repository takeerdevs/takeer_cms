<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\BundleItem;
use App\Models\ContentItem;
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
            ->with('items')
            ->latest()
            ->get();

        return response()->json(['bundles' => $bundles]);
    }

    public function show(Request $request, Bundle $bundle): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $bundle->merchant_id);

        $bundle->load('items');

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
            'status' => 'nullable|string|in:draft,published,archived',
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:product,content_item',
            'items.*.item_id' => 'required_with:items|integer|min:1',
            'items.*.selected_variant_id' => 'nullable|integer|min:1',
            'items.*.section_title' => 'nullable|string|max:255',
            'items.*.lesson_title' => 'nullable|string|max:255',
            'items.*.lesson_summary' => 'nullable|string|max:2000',
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
                    'lesson_duration_minutes' => $item['lesson_duration_minutes'] ?? null,
                    'unlock_after_days' => (int) ($item['unlock_after_days'] ?? 0),
                    'is_preview' => (bool) ($item['is_preview'] ?? false),
                    'sort_order' => $item['sort_order'] ?? 0,
                ]);
            }

            return $bundle;
        });

        $entitlementService->syncActiveEntitlementsForBundle((int) $bundle->id);
        if (($validated['status'] ?? 'draft') === 'published') {
            $this->syncFeedPostForPublishedBundle($bundle->fresh());
        }

        return response()->json([
            'message' => 'Bundle created.',
            'bundle' => $bundle->load('items'),
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
            'status' => 'nullable|string|in:draft,published,archived',
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:product,content_item',
            'items.*.item_id' => 'required_with:items|integer|min:1',
            'items.*.selected_variant_id' => 'nullable|integer|min:1',
            'items.*.section_title' => 'nullable|string|max:255',
            'items.*.lesson_title' => 'nullable|string|max:255',
            'items.*.lesson_summary' => 'nullable|string|max:2000',
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
            $bundle->update([
                ...collect($validated)->except(['items'])->toArray(),
                'slug' => array_key_exists('title', $validated)
                    ? Str::slug($validated['title']) . '-' . Str::lower(Str::random(6))
                    : $bundle->slug,
            ]);

            if (array_key_exists('items', $validated)) {
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
            Post::where('merchant_id', $bundle->merchant_id)
                ->where('promotable_type', Bundle::class)
                ->where('promotable_id', $bundle->id)
                ->delete();
        }

        $entitlementService->syncActiveEntitlementsForBundle((int) $bundle->id);

        return response()->json([
            'message' => 'Bundle updated.',
            'bundle' => $bundle->fresh()->load('items'),
        ]);
    }

    public function destroy(Request $request, Bundle $bundle): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $bundle->merchant_id);

        Post::where('merchant_id', $bundle->merchant_id)
            ->where('promotable_type', Bundle::class)
            ->where('promotable_id', $bundle->id)
            ->delete();
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

        abort(422, 'Unsupported bundle item type.');
    }

    private function merchantFromRequest(Request $request)
    {
        $merchant = $request->user()
            ->merchantProfiles()
            ->where('is_default', true)
            ->first() ?? $request->user()->merchantProfiles()->first();

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

    private function resolveSelectedVariantForBundleItem(string $itemType, int $itemId, ?int $selectedVariantId): array
    {
        if ($itemType !== 'product') {
            abort_if(!empty($selectedVariantId), 422, 'Variant can only be set for product bundle items.');

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
        $existingFeedPost = Post::where('merchant_id', $bundle->merchant_id)
            ->where('promotable_type', Bundle::class)
            ->where('promotable_id', $bundle->id)
            ->first();

        $itemsCount = (int) ($bundle->items?->count() ?? 0);
        $excerpt = trim((string) ($bundle->description ?? ''));
        $captionLines = array_filter([
            $bundle->title,
            trim((string) ($bundle->description ?? '')),
        ]);

        $post = Post::updateOrCreate(
            [
                'merchant_id' => $bundle->merchant_id,
                'promotable_type' => Bundle::class,
                'promotable_id' => $bundle->id,
            ],
            [
                'title' => $bundle->title,
                'excerpt' => $excerpt,
                'caption' => implode("\n\n", $captionLines),
                'is_restricted' => true,
                'restricted_price' => null,
                'bg_style' => $existingFeedPost?->bg_style,
            ]
        );

        if (!empty($bundle->course_cover_image_url)) {
            $post->media()->updateOrCreate(
                ['post_id' => $post->id, 'media_type' => 'image'],
                ['media_url' => $bundle->course_cover_image_url]
            );
        }
    }
}
