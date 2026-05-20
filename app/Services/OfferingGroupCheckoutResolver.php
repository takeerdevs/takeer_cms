<?php

namespace App\Services;

use App\Models\OfferingGroup;
use App\Models\OfferingGroupItem;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;
use RuntimeException;

class OfferingGroupCheckoutResolver
{
    public function resolve(OfferingGroup $group, array $requestedSelection = []): array
    {
        $group->loadMissing(['items']);

        $selectionByItemId = collect($requestedSelection)
            ->filter(fn ($row) => !empty($row['group_item_id']))
            ->keyBy(fn ($row) => (int) $row['group_item_id']);

        $lines = $this->resolveGroupLines($group, $selectionByItemId);
        $childrenTotal = $lines->sum('line_total');
        $basePrice = (float) ($group->base_price ?? 0);

        $total = match ($group->pricing_mode) {
            'fixed' => $basePrice,
            'fixed_or_sum' => max($basePrice, $childrenTotal),
            'free', 'quote_only' => 0.0,
            default => $childrenTotal,
        };

        return [
            'group' => [
                'id' => $group->id,
                'title' => $group->title,
                'slug' => $group->slug,
                'pricing_mode' => $group->pricing_mode,
                'checkout_mode' => $group->checkout_mode,
            ],
            'lines' => $lines->values()->all(),
            'subtotal' => round($total, 2),
            'has_physical_items' => $lines->contains(fn ($line) => ($line['product_type'] ?? null) === 'physical'),
            'requires_inquiry' => $group->checkout_mode === 'request_quote'
                || $group->pricing_mode === 'quote_only'
                || $lines->contains(fn ($line) => (bool) ($line['requires_inquiry'] ?? false)),
        ];
    }

    private function resolveGroupLines(OfferingGroup $group, Collection $selectionByItemId, array $trail = []): Collection
    {
        if (in_array((int) $group->id, $trail, true)) {
            throw new RuntimeException('Offering group nesting has a circular reference.');
        }

        $trail[] = (int) $group->id;
        $lines = collect();
        $selectedItems = collect();

        foreach ($group->items as $item) {
            $selection = $selectionByItemId->get((int) $item->id);
            $selectedByDefault = $item->is_required || $item->is_default_selected || in_array($item->role, ['included', 'required_choice'], true);
            $isSelected = (bool) ($selection['selected'] ?? $selectedByDefault);

            if (!$isSelected) {
                continue;
            }

            $selectedItems->push($item);

            if (!$item->is_orderable_in_group) {
                throw new RuntimeException("{$this->itemLabel($item)} cannot be ordered inside this group.");
            }

            $quantity = $this->normalizeQuantity((float) ($selection['quantity'] ?? $item->quantity_min ?? 1), $item);
            $children = collect($selection['children'] ?? []);
            $selectedAddOns = $this->selectedAddOns($item, $selection['add_ons'] ?? []);
            $addOnsUnitTotal = collect($selectedAddOns)->sum('price');

            if ($item->item_type === OfferingGroupItem::TYPE_PRODUCT) {
                $product = Product::query()
                    ->with(['images'])
                    ->whereKey($item->item_id)
                    ->first();
                if (!$product) {
                    throw new RuntimeException('One selected item is no longer available.');
                }

                $variant = null;
                if ($product->has_variants) {
                    $variantId = (int) ($selection['selected_variant_id'] ?? 0);
                    $variant = ProductVariant::query()
                        ->where('product_id', $product->id)
                        ->where('is_active', true)
                        ->find($variantId);
                    if (!$variant) {
                        throw new RuntimeException("Please select an available variant for {$product->title}.");
                    }
                }

                $unitPrice = $this->itemUnitPrice($item, $product, $variant);
                $lines->push([
                    'group_item_id' => $item->id,
                    'item_type' => 'product',
                    'item_id' => $product->id,
                    'title' => $product->title,
                    'section' => $item->section,
                    'role' => $item->role,
                    'pricing_behavior' => $item->pricing_behavior,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'selected_add_ons' => $selectedAddOns,
                    'add_ons_unit_total' => round($addOnsUnitTotal, 2),
                    'line_total' => round(($unitPrice + $addOnsUnitTotal) * $quantity, 2),
                    'selected_variant_id' => $variant?->id,
                    'product_type' => $product->type,
                    'image_url' => $product->image_url,
                    'requires_inquiry' => $product->isPhysical() || (
                        $product->isService()
                        && in_array($product->service_pricing_model, ['contract_quote', 'showcase_only'], true)
                    ),
                ]);
                continue;
            }

            $childGroup = OfferingGroup::query()
                ->with('items')
                ->whereKey($item->item_id)
                ->first();
            if (!$childGroup) {
                throw new RuntimeException('One nested group is no longer available.');
            }

            $childLines = $this->resolveGroupLines(
                $childGroup,
                $children->keyBy(fn ($row) => (int) ($row['group_item_id'] ?? 0)),
                $trail,
            );
            $childTotal = $childLines->sum('line_total');
            $unitPrice = $this->groupUnitPrice($item, $childGroup, $childTotal);

            $lines->push([
                'group_item_id' => $item->id,
                'item_type' => 'offering_group',
                'item_id' => $childGroup->id,
                'title' => $childGroup->title,
                'section' => $item->section,
                'role' => $item->role,
                'pricing_behavior' => $item->pricing_behavior,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'selected_add_ons' => $selectedAddOns,
                'add_ons_unit_total' => round($addOnsUnitTotal, 2),
                'line_total' => round(($unitPrice + $addOnsUnitTotal) * $quantity, 2),
                'child_lines' => $childLines->values()->all(),
                'requires_inquiry' => $childGroup->checkout_mode === 'request_quote' || $childGroup->pricing_mode === 'quote_only',
            ]);
        }

        $this->validateChoiceRules($group, $selectedItems);

        return $lines;
    }

    private function validateChoiceRules(OfferingGroup $group, Collection $selectedItems): void
    {
        $sectionRules = data_get($group->checkout_rules, 'section_rules', []);
        if (!is_array($sectionRules) || $sectionRules === []) {
            return;
        }

        foreach ($sectionRules as $section => $rule) {
            if (!is_array($rule)) {
                continue;
            }

            $count = $selectedItems
                ->filter(fn (OfferingGroupItem $item) => (string) ($item->section ?: 'Main') === (string) $section)
                ->count();

            $min = isset($rule['min_selected']) && $rule['min_selected'] !== null && $rule['min_selected'] !== ''
                ? (int) $rule['min_selected']
                : null;
            $max = isset($rule['max_selected']) && $rule['max_selected'] !== null && $rule['max_selected'] !== ''
                ? (int) $rule['max_selected']
                : null;

            if ($min !== null && $min > 0 && $count < $min) {
                throw new RuntimeException("Select at least {$min} item".($min === 1 ? '' : 's')." from {$section}.");
            }

            if ($max !== null && $max > 0 && $count > $max) {
                throw new RuntimeException("Select no more than {$max} item".($max === 1 ? '' : 's')." from {$section}.");
            }
        }
    }

    private function itemUnitPrice(OfferingGroupItem $item, Product $product, ?ProductVariant $variant): float
    {
        return match ($item->pricing_behavior) {
            'included', 'quote_only' => 0.0,
            'override' => (float) ($item->price_override ?? 0),
            default => (float) ($variant?->price ?? $product->discounted_price ?? $product->price ?? 0),
        };
    }

    private function selectedAddOns(OfferingGroupItem $item, array $requestedAddOns): array
    {
        $available = collect($this->availableAddOns($item))->keyBy(fn ($row) => mb_strtolower($row['name']));

        return collect($requestedAddOns)
            ->map(function ($row) use ($available) {
                $name = trim((string) ($row['name'] ?? ''));
                $match = $available->get(mb_strtolower($name));

                if (! $match) {
                    return null;
                }

                return [
                    'name' => $match['name'],
                    'price' => (float) ($match['price'] ?? 0),
                ];
            })
            ->filter()
            ->unique(fn ($row) => mb_strtolower($row['name']))
            ->values()
            ->all();
    }

    private function availableAddOns(OfferingGroupItem $item): array
    {
        $productAddOns = [];

        if ($item->item_type === OfferingGroupItem::TYPE_PRODUCT) {
            $product = Product::query()->whereKey($item->item_id)->first(['id', 'module_details']);
            $productAddOns = is_array($product?->module_details ?? null)
                ? ($product->module_details['add_ons'] ?? [])
                : [];
        }

        $itemAddOns = $item->metadata['add_ons'] ?? [];

        return collect($productAddOns)
            ->concat($itemAddOns)
            ->map(fn ($row) => [
                'name' => trim((string) ($row['name'] ?? '')),
                'price' => isset($row['price']) && $row['price'] !== '' ? max(0, (float) $row['price']) : 0,
            ])
            ->filter(fn ($row) => $row['name'] !== '')
            ->unique(fn ($row) => mb_strtolower($row['name']))
            ->values()
            ->all();
    }

    private function groupUnitPrice(OfferingGroupItem $item, OfferingGroup $group, float $childTotal): float
    {
        return match ($item->pricing_behavior) {
            'included', 'quote_only' => 0.0,
            'override' => (float) ($item->price_override ?? 0),
            default => match ($group->pricing_mode) {
                'fixed' => (float) ($group->base_price ?? 0),
                'fixed_or_sum' => max((float) ($group->base_price ?? 0), $childTotal),
                'free', 'quote_only' => 0.0,
                default => $childTotal,
            },
        };
    }

    private function normalizeQuantity(float $quantity, OfferingGroupItem $item): float
    {
        $minimum = max(0.001, (float) ($item->quantity_min ?? 1));
        $maximum = $item->quantity_max !== null ? (float) $item->quantity_max : null;
        $quantity = max($minimum, $quantity);

        if ($maximum !== null && $maximum > 0) {
            $quantity = min($quantity, $maximum);
        }

        return $quantity;
    }

    private function itemLabel(OfferingGroupItem $item): string
    {
        return $item->item_type === OfferingGroupItem::TYPE_OFFERING_GROUP
            ? 'This nested group'
            : 'This item';
    }
}
