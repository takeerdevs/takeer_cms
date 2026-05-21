<?php

namespace App\Http\Controllers;

use App\Models\OfferingGroup;
use App\Models\OfferingGroupItem;
use App\Models\Product;
use App\Services\OfferingGroupCheckoutResolver;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Support\Str;

class OfferingGroupController extends Controller
{
    public function show(Request $request, OfferingGroup $offeringGroup): Response
    {
        abort_unless($offeringGroup->status === 'published', 404);

        $offeringGroup->load(['merchant.user', 'merchant.locations', 'items', 'locationAvailabilities.location']);

        $defaultSelection = $offeringGroup->items
            ->filter(fn (OfferingGroupItem $item) => $item->is_required || $item->is_default_selected || in_array($item->role, ['included', 'required_choice'], true))
            ->map(fn (OfferingGroupItem $item) => [
                'group_item_id' => $item->id,
                'selected' => true,
                'quantity' => (float) ($item->quantity_min ?? 1),
            ])
            ->values()
            ->all();

        $resolved = app(OfferingGroupCheckoutResolver::class)->resolve($offeringGroup, $defaultSelection);

        return Inertia::render('OfferingGroupDetail', [
            'offeringGroup' => [
                'id' => $offeringGroup->id,
                'title' => $offeringGroup->title,
                'slug' => $offeringGroup->slug,
                'description' => $offeringGroup->description,
                'cover_image_url' => $offeringGroup->cover_image_url,
                'group_type' => $offeringGroup->group_type,
                'template_key' => $offeringGroup->template_key,
                'display_settings' => $offeringGroup->display_settings,
                'pricing_mode' => $offeringGroup->pricing_mode,
                'base_price' => $offeringGroup->base_price !== null ? (float) $offeringGroup->base_price : null,
                'checkout_mode' => $offeringGroup->checkout_mode,
                'checkout_rules' => $offeringGroup->checkout_rules,
                'availability_mode' => $offeringGroup->availability_mode,
                'availability_location_ids' => $offeringGroup->locationAvailabilities
                    ->where('availability_type', 'serves')
                    ->where('is_enabled', true)
                    ->pluck('merchant_location_id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all(),
                'checkout_price' => (float) ($resolved['subtotal'] ?? 0),
                'has_physical_items' => (bool) ($resolved['has_physical_items'] ?? false),
                'requires_inquiry' => (bool) ($resolved['requires_inquiry'] ?? false),
                'items' => $offeringGroup->items->map(fn (OfferingGroupItem $item) => $this->itemPayload($item))->values(),
                'merchant' => [
                    'id' => $offeringGroup->merchant->id,
                    'username' => $offeringGroup->merchant->username,
                    'display_name' => $offeringGroup->merchant->display_name,
                    'name' => $offeringGroup->merchant->display_name,
                    'phone_number' => $offeringGroup->merchant->user?->phone_number,
                    'can_self_pickup' => $offeringGroup->merchant->locations->where('allow_self_pickup', true)->isNotEmpty(),
                    'locations' => $offeringGroup->merchant->locations ?? [],
                ],
            ],
        ]);
    }

    private function itemPayload(OfferingGroupItem $item): array
    {
        $model = $item->itemModel();

        return [
            'id' => $item->id,
            'item_type' => $item->item_type,
            'item_id' => $item->item_id,
            'title' => $model?->title,
            'description' => $model instanceof Product ? ($model->description ?? null) : ($model?->description ?? null),
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
}
