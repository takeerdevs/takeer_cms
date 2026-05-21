<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantLocationable;
use App\Models\OfferingGroup;
use App\Models\OfferingGroupItem;
use App\Models\Post;
use App\Models\Product;
use App\Support\MerchantPermissions;
use App\Support\OfferingGroupTemplateRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MerchantOfferingGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $groups = OfferingGroup::query()
            ->where('merchant_id', $merchant->id)
            ->withCount('items')
            ->when($request->filled('group_type'), fn ($query) => $query->where('group_type', $request->string('group_type')->toString()))
            ->when($request->filled('template_key'), fn ($query) => $query->where('template_key', $request->string('template_key')->toString()))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->latest()
            ->paginate((int) min(50, max(1, $request->integer('per_page', 20))));

        $groups->setCollection($groups->getCollection()->map(fn (OfferingGroup $group) => $this->groupPayload($group)));

        return response()->json([
            'templates' => OfferingGroupTemplateRegistry::all(),
            'groups' => $groups,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $validated = $this->validatedGroup($request);
        $template = OfferingGroupTemplateRegistry::get($validated['template_key'] ?? null);

        $group = OfferingGroup::create([
            ...$this->groupAttributes($merchant, $validated, $template),
            'created_by_user_id' => $request->user()?->id,
        ]);

        $this->syncItems($group, $validated['items'] ?? []);
        if (array_key_exists('availability_location_ids', $validated)) {
            $this->syncLocationAvailability($group, $merchant, $validated['availability_location_ids'] ?? []);
        }
        $this->syncFeedPostForGroup($group->fresh(['items']), $this->shouldPublishToTakeer($validated));

        return response()->json([
            'message' => 'Offering group created.',
            'group' => $this->groupPayload($group->fresh(['items', 'locationAvailabilities.location'])),
        ], 201);
    }

    public function show(Request $request, OfferingGroup $offeringGroup): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant, $offeringGroup);

        return response()->json([
            'templates' => OfferingGroupTemplateRegistry::all(),
            'group' => $this->groupPayload($offeringGroup->load(['items', 'locationAvailabilities.location'])),
        ]);
    }

    public function catalog(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $search = trim((string) $request->query('search', ''));

        $products = Product::query()
            ->where('merchant_id', $merchant->id)
            ->when($search !== '', fn ($query) => $query->where('title', 'like', "%{$search}%"))
            ->latest()
            ->limit(60)
            ->get()
            ->map(fn (Product $product) => [
                'item_type' => OfferingGroupItem::TYPE_PRODUCT,
                'item_id' => $product->id,
                'title' => $product->title,
                'kind' => $product->type,
                'price' => $product->discounted_price !== null ? (float) $product->discounted_price : (float) ($product->price ?? 0),
                'image_url' => $product->image_url,
                'add_ons' => $this->sanitizeAddOns($product->module_details['add_ons'] ?? []),
                'status' => $product->status ?? null,
                'has_variants' => (bool) $product->has_variants,
            ]);

        $groups = OfferingGroup::query()
            ->where('merchant_id', $merchant->id)
            ->when($request->filled('exclude_group_id'), fn ($query) => $query->whereKeyNot((int) $request->query('exclude_group_id')))
            ->when($search !== '', fn ($query) => $query->where('title', 'like', "%{$search}%"))
            ->latest()
            ->limit(60)
            ->get()
            ->map(fn (OfferingGroup $group) => [
                'item_type' => OfferingGroupItem::TYPE_OFFERING_GROUP,
                'item_id' => $group->id,
                'title' => $group->title,
                'kind' => $group->template_key,
                'price' => $group->base_price !== null ? (float) $group->base_price : null,
                'image_url' => $group->cover_image_url,
                'status' => $group->status,
                'has_variants' => false,
            ]);

        return response()->json([
            'products' => $products,
            'groups' => $groups,
            'items' => $products->concat($groups)->values(),
        ]);
    }

    public function update(Request $request, OfferingGroup $offeringGroup): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant, $offeringGroup);

        $validated = $this->validatedGroup($request, partial: true);
        $template = OfferingGroupTemplateRegistry::get($validated['template_key'] ?? $offeringGroup->template_key);

        $offeringGroup->fill($this->groupAttributes($merchant, $validated, $template, $offeringGroup));
        $offeringGroup->save();

        if (array_key_exists('items', $validated)) {
            $this->syncItems($offeringGroup, $validated['items'] ?? []);
        }
        if (array_key_exists('availability_location_ids', $validated)) {
            $this->syncLocationAvailability($offeringGroup, $merchant, $validated['availability_location_ids'] ?? []);
        }

        $this->syncFeedPostForGroup($offeringGroup->fresh(['items']), $this->shouldPublishToTakeer($validated));

        return response()->json([
            'message' => 'Offering group updated.',
            'group' => $this->groupPayload($offeringGroup->fresh(['items', 'locationAvailabilities.location'])),
        ]);
    }

    public function destroy(Request $request, OfferingGroup $offeringGroup): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant, $offeringGroup);
        $this->deleteFeedPostForGroup($offeringGroup);
        $offeringGroup->delete();

        return response()->json(['message' => 'Offering group archived.']);
    }

    private function validatedGroup(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'title' => [$required, 'string', 'max:180'],
            'slug' => ['nullable', 'string', 'max:200'],
            'group_type' => ['nullable', 'string', 'max:60'],
            'template_key' => ['nullable', 'string', Rule::in(OfferingGroupTemplateRegistry::keys())],
            'status' => ['nullable', 'string', Rule::in(['draft', 'published', 'archived'])],
            'description' => ['nullable', 'string', 'max:5000'],
            'cover_image_url' => ['nullable', 'string', 'max:2048'],
            'pricing_mode' => ['nullable', 'string', Rule::in(['sum_children', 'fixed', 'fixed_or_sum', 'starts_from', 'quote_only', 'free'])],
            'base_price' => ['nullable', 'numeric', 'min:0'],
            'checkout_mode' => ['nullable', 'string', Rule::in(['select_items', 'book_group', 'request_quote', 'buy_group', 'visible_only'])],
            'availability_mode' => ['nullable', 'string', Rule::in(['inherit_children', 'group_schedule', 'always_available', 'manual_confirm'])],
            'display_settings' => ['nullable', 'array'],
            'checkout_rules' => ['nullable', 'array'],
            'availability_rules' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
            'availability_location_ids' => ['nullable', 'array'],
            'availability_location_ids.*' => ['integer', 'exists:merchant_locations,id'],
            'publish_targets' => ['nullable', 'array'],
            'publish_targets.takeer' => ['nullable', 'boolean'],
            'publish_targets.instagram' => ['nullable', 'boolean'],
            'publish_targets.facebook' => ['nullable', 'boolean'],
            'publish_targets.x' => ['nullable', 'boolean'],
            'items' => ['nullable', 'array'],
            'items.*.item_type' => ['required_with:items', Rule::in([OfferingGroupItem::TYPE_PRODUCT, OfferingGroupItem::TYPE_OFFERING_GROUP])],
            'items.*.item_id' => ['required_with:items', 'integer', 'min:1'],
            'items.*.section' => ['nullable', 'string', 'max:120'],
            'items.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'items.*.role' => ['nullable', 'string', Rule::in(['included', 'optional', 'add_on', 'required_choice', 'choose_one', 'choose_many', 'visible_only'])],
            'items.*.pricing_behavior' => ['nullable', 'string', Rule::in(['included', 'separate', 'override', 'starts_from', 'quote_only'])],
            'items.*.price_override' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity_min' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity_max' => ['nullable', 'numeric', 'min:0'],
            'items.*.is_required' => ['nullable', 'boolean'],
            'items.*.is_default_selected' => ['nullable', 'boolean'],
            'items.*.is_orderable_alone' => ['nullable', 'boolean'],
            'items.*.is_orderable_in_group' => ['nullable', 'boolean'],
            'items.*.choice_rules' => ['nullable', 'array'],
            'items.*.metadata' => ['nullable', 'array'],
            'items.*.metadata.add_ons' => ['nullable', 'array'],
            'items.*.metadata.add_ons.*.name' => ['nullable', 'string', 'max:120'],
            'items.*.metadata.add_ons.*.price' => ['nullable', 'numeric', 'min:0'],
        ]);
    }

    private function groupAttributes(Merchant $merchant, array $validated, ?array $template, ?OfferingGroup $existing = null): array
    {
        $title = $validated['title'] ?? $existing?->title;
        $slug = $validated['slug'] ?? ($title ? Str::slug($title) : $existing?->slug);
        $metadata = $validated['metadata'] ?? $existing?->metadata;
        if (array_key_exists('publish_targets', $validated)) {
            $metadata = [
                ...(is_array($metadata) ? $metadata : []),
                'publish_targets' => $validated['publish_targets'] ?? [],
            ];
        }

        return [
            'merchant_id' => $merchant->id,
            'title' => $title,
            'slug' => $this->uniqueSlug($merchant, $slug ?: 'offering-group', $existing?->id),
            'group_type' => $validated['group_type'] ?? $template['group_type'] ?? $existing?->group_type ?? 'package',
            'template_key' => $validated['template_key'] ?? $existing?->template_key ?? 'service_package',
            'status' => $validated['status'] ?? $existing?->status ?? 'draft',
            'description' => $validated['description'] ?? $existing?->description,
            'cover_image_url' => $validated['cover_image_url'] ?? $existing?->cover_image_url,
            'pricing_mode' => $validated['pricing_mode'] ?? $template['default_pricing_mode'] ?? $existing?->pricing_mode ?? 'sum_children',
            'base_price' => $validated['base_price'] ?? $existing?->base_price,
            'checkout_mode' => $validated['checkout_mode'] ?? $template['default_checkout_mode'] ?? $existing?->checkout_mode ?? 'select_items',
            'availability_mode' => $validated['availability_mode'] ?? $template['default_availability_mode'] ?? $existing?->availability_mode ?? 'inherit_children',
            'display_settings' => $validated['display_settings'] ?? $existing?->display_settings,
            'checkout_rules' => $validated['checkout_rules'] ?? $existing?->checkout_rules,
            'availability_rules' => $validated['availability_rules'] ?? $existing?->availability_rules,
            'metadata' => $metadata,
        ];
    }

    private function shouldPublishToTakeer(array $validated): bool
    {
        $targets = (array) ($validated['publish_targets'] ?? []);

        return ! array_key_exists('takeer', $targets)
            || filter_var($targets['takeer'], FILTER_VALIDATE_BOOLEAN);
    }

    private function syncLocationAvailability(OfferingGroup $group, Merchant $merchant, array $locationIds): void
    {
        $requestedLocationIds = collect($locationIds)->map(fn ($id) => (int) $id)->filter()->unique()->values();
        $validLocationIds = $merchant->locations()
            ->whereIn('id', $requestedLocationIds->all())
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        abort_if($requestedLocationIds->count() !== $validLocationIds->count(), 422, 'Offering group inaweza kuhusishwa na maeneo yako pekee.');

        $group->locationAvailabilities()
            ->where('availability_type', 'serves')
            ->whereNotIn('merchant_location_id', $validLocationIds->all())
            ->delete();

        foreach ($validLocationIds as $locationId) {
            MerchantLocationable::updateOrCreate(
                [
                    'merchant_location_id' => $locationId,
                    'locationable_type' => OfferingGroup::class,
                    'locationable_id' => $group->id,
                    'availability_type' => 'serves',
                ],
                [
                    'merchant_id' => $merchant->id,
                    'is_enabled' => true,
                ]
            );
        }
    }

    private function syncFeedPostForGroup(OfferingGroup $group, bool $publishToTakeer): void
    {
        if (! $publishToTakeer || $group->status !== 'published') {
            $this->deleteFeedPostForGroup($group);
            return;
        }

        $existingFeedPost = Post::query()
            ->where('merchant_id', $group->merchant_id)
            ->whereHas('promotableOfferingGroups', fn ($query) => $query->where('offering_groups.id', $group->id))
            ->first();

        $captionLines = array_filter([
            $group->title,
            trim((string) ($group->description ?? '')),
        ]);

        $post = $existingFeedPost ?: new Post([
            'merchant_id' => $group->merchant_id,
            'source' => 'offering_group_publish',
        ]);

        $post->fill([
            'title' => $group->title,
            'source' => 'offering_group_publish',
            'excerpt' => trim((string) ($group->description ?? '')),
            'caption' => implode("\n\n", $captionLines),
            'is_restricted' => false,
            'restricted_price' => null,
            'bg_style' => $existingFeedPost?->bg_style,
        ]);
        $post->save();
        $post->promotableOfferingGroups()->syncWithoutDetaching([$group->id]);

        if (!empty($group->cover_image_url)) {
            $post->media()->updateOrCreate(
                ['post_id' => $post->id, 'media_type' => 'image'],
                ['media_url' => $group->cover_image_url]
            );
        }
    }

    private function deleteFeedPostForGroup(OfferingGroup $group): void
    {
        Post::query()
            ->where('merchant_id', $group->merchant_id)
            ->whereHas('promotableOfferingGroups', fn ($query) => $query->where('offering_groups.id', $group->id))
            ->get()
            ->each
            ->delete();
    }

    private function syncItems(OfferingGroup $group, array $items): void
    {
        $group->items()->delete();

        foreach (array_values($items) as $index => $item) {
            $this->ensureItemBelongsToMerchant($group, $item);

            $group->items()->create([
                'item_type' => $item['item_type'],
                'item_id' => $item['item_id'],
                'section' => $item['section'] ?? null,
                'sort_order' => $item['sort_order'] ?? $index,
                'role' => $item['role'] ?? 'optional',
                'pricing_behavior' => $item['pricing_behavior'] ?? 'separate',
                'price_override' => $item['price_override'] ?? null,
                'quantity_min' => $item['quantity_min'] ?? null,
                'quantity_max' => $item['quantity_max'] ?? null,
                'is_required' => $item['is_required'] ?? false,
                'is_default_selected' => $item['is_default_selected'] ?? false,
                'is_orderable_alone' => $item['is_orderable_alone'] ?? true,
                'is_orderable_in_group' => $item['is_orderable_in_group'] ?? true,
                'choice_rules' => $item['choice_rules'] ?? null,
                'metadata' => $this->itemMetadata($item['metadata'] ?? null),
            ]);
        }
    }

    private function itemMetadata(?array $metadata): ?array
    {
        if (! is_array($metadata)) {
            return null;
        }

        $metadata['add_ons'] = $this->sanitizeAddOns($metadata['add_ons'] ?? []);

        return $metadata;
    }

    private function sanitizeAddOns(array $addOns): array
    {
        return collect($addOns)
            ->map(fn ($row) => [
                'name' => Str::limit(trim((string) ($row['name'] ?? '')), 120, ''),
                'price' => isset($row['price']) && $row['price'] !== '' ? max(0, (float) $row['price']) : 0,
            ])
            ->filter(fn ($row) => $row['name'] !== '')
            ->take(20)
            ->values()
            ->all();
    }

    private function ensureItemBelongsToMerchant(OfferingGroup $group, array $item): void
    {
        if (($item['item_type'] ?? null) === OfferingGroupItem::TYPE_PRODUCT) {
            abort_unless(Product::where('merchant_id', $group->merchant_id)->whereKey($item['item_id'])->exists(), 422, 'One or more products do not belong to this merchant.');
            return;
        }

        $child = OfferingGroup::where('merchant_id', $group->merchant_id)->whereKey($item['item_id'])->first();
        abort_unless($child, 422, 'One or more child groups do not belong to this merchant.');
        abort_if($group->exists && (int) $child->id === (int) $group->id, 422, 'A group cannot include itself.');
        abort_if($group->exists && $this->groupContainsGroup($child, (int) $group->id), 422, 'Nested groups cannot contain their own parent.');
    }

    private function groupContainsGroup(OfferingGroup $candidate, int $targetGroupId, array $visited = []): bool
    {
        if (in_array((int) $candidate->id, $visited, true)) {
            return false;
        }

        $visited[] = (int) $candidate->id;
        $children = OfferingGroupItem::query()
            ->where('offering_group_id', $candidate->id)
            ->where('item_type', OfferingGroupItem::TYPE_OFFERING_GROUP)
            ->pluck('item_id');

        foreach ($children as $childId) {
            if ((int) $childId === $targetGroupId) {
                return true;
            }

            $child = OfferingGroup::find($childId);
            if ($child && $this->groupContainsGroup($child, $targetGroupId, $visited)) {
                return true;
            }
        }

        return false;
    }

    private function groupPayload(OfferingGroup $group): array
    {
        return [
            'id' => $group->id,
            'merchant_id' => $group->merchant_id,
            'title' => $group->title,
            'slug' => $group->slug,
            'group_type' => $group->group_type,
            'template_key' => $group->template_key,
            'status' => $group->status,
            'description' => $group->description,
            'cover_image_url' => $group->cover_image_url,
            'pricing_mode' => $group->pricing_mode,
            'base_price' => $group->base_price !== null ? (float) $group->base_price : null,
            'checkout_mode' => $group->checkout_mode,
            'availability_mode' => $group->availability_mode,
            'display_settings' => $group->display_settings,
            'checkout_rules' => $group->checkout_rules,
            'availability_rules' => $group->availability_rules,
            'metadata' => $group->metadata,
            'availability_location_ids' => $group->relationLoaded('locationAvailabilities')
                ? $group->locationAvailabilities
                    ->where('availability_type', 'serves')
                    ->where('is_enabled', true)
                    ->pluck('merchant_location_id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all()
                : [],
            'location_availabilities' => $group->relationLoaded('locationAvailabilities')
                ? $group->locationAvailabilities
                    ->where('availability_type', 'serves')
                    ->where('is_enabled', true)
                    ->map(fn ($row) => [
                        'merchant_location_id' => (int) $row->merchant_location_id,
                        'location_name' => $row->location?->name,
                        'availability_type' => $row->availability_type,
                    ])
                    ->values()
                    ->all()
                : [],
            'publish_targets' => is_array($group->metadata ?? null) ? ($group->metadata['publish_targets'] ?? null) : null,
            'items_count' => $group->items_count ?? $group->items->count(),
            'items' => $group->relationLoaded('items')
                ? $group->items->map(fn (OfferingGroupItem $item) => $this->itemPayload($item))->values()
                : [],
            'created_at' => $group->created_at?->toISOString(),
            'updated_at' => $group->updated_at?->toISOString(),
        ];
    }

    private function itemPayload(OfferingGroupItem $item): array
    {
        $model = $item->itemModel();

        return [
            'id' => $item->id,
            'item_type' => $item->item_type,
            'item_id' => $item->item_id,
            'title' => $model?->title,
            'kind' => $model instanceof Product ? $model->type : ($model?->template_key ?? null),
            'price' => $model instanceof Product
                ? ($model->discounted_price !== null ? (float) $model->discounted_price : (float) ($model->price ?? 0))
                : ($model?->base_price !== null ? (float) $model->base_price : null),
            'image_url' => $model instanceof Product ? $model->image_url : ($model?->cover_image_url ?? null),
            'add_ons' => $this->availableAddOnsForItem($item, $model),
            'section' => $item->section,
            'sort_order' => $item->sort_order,
            'role' => $item->role,
            'pricing_behavior' => $item->pricing_behavior,
            'price_override' => $item->price_override !== null ? (float) $item->price_override : null,
            'quantity_min' => $item->quantity_min !== null ? (float) $item->quantity_min : null,
            'quantity_max' => $item->quantity_max !== null ? (float) $item->quantity_max : null,
            'is_required' => (bool) $item->is_required,
            'is_default_selected' => (bool) $item->is_default_selected,
            'is_orderable_alone' => (bool) $item->is_orderable_alone,
            'is_orderable_in_group' => (bool) $item->is_orderable_in_group,
            'choice_rules' => $item->choice_rules,
            'metadata' => $item->metadata,
        ];
    }

    private function availableAddOnsForItem(OfferingGroupItem $item, Product|OfferingGroup|null $model): array
    {
        $productAddOns = $model instanceof Product
            ? $this->sanitizeAddOns($model->module_details['add_ons'] ?? [])
            : [];
        $groupItemAddOns = $this->sanitizeAddOns($item->metadata['add_ons'] ?? []);

        return collect($productAddOns)
            ->concat($groupItemAddOns)
            ->unique(fn ($row) => mb_strtolower($row['name']))
            ->values()
            ->all();
    }

    private function uniqueSlug(Merchant $merchant, string $slug, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug) ?: 'offering-group';
        $candidate = $base;
        $suffix = 2;

        while (OfferingGroup::where('merchant_id', $merchant->id)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->where('slug', $candidate)
            ->exists()) {
            $candidate = "{$base}-{$suffix}";
            $suffix++;
        }

        return $candidate;
    }

    private function merchantFromRequest(Request $request): Merchant
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($merchant instanceof Merchant) {
            return $merchant;
        }

        $user = $request->user();
        $merchantId = $request->input('merchant_id') ?? $request->query('merchant_id') ?? session('active_merchant_id');
        if ($merchantId) {
            $merchant = MerchantPermissions::accessibleMerchantsFor($user)->firstWhere('id', (int) $merchantId);
            if ($merchant) {
                return $merchant;
            }
        }

        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first()
            ?? MerchantPermissions::accessibleMerchantsFor($user)->first();

        abort_unless($merchant, 403, 'Merchant profile not found.');

        return $merchant;
    }

    private function ensureOwnership(Merchant $merchant, OfferingGroup $group): void
    {
        abort_unless((int) $group->merchant_id === (int) $merchant->id, 403);
    }
}
