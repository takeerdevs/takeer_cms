<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductLocationInventory;
use App\Models\RetailAuditLog;
use App\Models\MerchantLocation;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class RetailInventoryController extends Controller
{
    private function activeStaffContext(Request $request): ?\App\Models\MerchantStaff
    {
        $merchant = $request->attributes->get('active_merchant');
        $user = $request->user();
        if (!$merchant || !$user) return null;

        return \App\Models\MerchantStaff::where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();
    }

    public function index(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $staff = $this->activeStaffContext($request);
        $locationId = (int) $request->input('merchant_location_id');
        $search = trim((string) $request->input('q', ''));

        $staffRole = strtoupper((string) ($staff?->role ?? ''));
        if ($staffRole === 'STOREKEEPER') {
            $assignedLocationId = (int) ($staff?->assigned_location_id ?? 0);
            if ($assignedLocationId <= 0) {
                return response()->json(['message' => 'Storekeeper has no assigned location.'], 403);
            }
            if ($locationId !== $assignedLocationId) {
                return response()->json(['message' => 'Huna ruhusa ya kuona inventory ya location hii.'], 403);
            }
        }

        $location = MerchantLocation::where('merchant_id', $merchant->id)
            ->where('id', $locationId)
            ->firstOrFail();

        $query = ProductLocationInventory::query()
            ->where('merchant_location_id', $location->id)
            ->with(['product.unitType:id,name,code,symbol,allows_decimal', 'variant:id,name,sku,product_id,is_active,attributes']);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', function ($pq) use ($search) {
                    $pq->where('title', 'like', "%{$search}%");
                })->orWhereHas('variant', function ($vq) use ($search) {
                    $vq->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                });
            });
        }

        $rows = $query->orderByDesc('id')->limit(500)->get();

        $normalized = $rows->map(function ($row) {
            return [
                'id' => $row->id,
                'row_key' => $row->product_id . ':' . ($row->product_variant_id ?? '0'),
                'product_id' => $row->product_id,
                'product_variant_id' => $row->product_variant_id,
                'quantity' => $row->quantity_decimal !== null ? (float) $row->quantity_decimal : (float) $row->quantity,
                'product' => $row->product ? [
                    'id' => $row->product->id,
                    'title' => $row->product->title,
                    'slug' => $row->product->slug,
                    'has_variants' => (bool) $row->product->has_variants,
                    'unit_type' => $row->product->unitType ? [
                        'id' => $row->product->unitType->id,
                        'name' => $row->product->unitType->name,
                        'code' => $row->product->unitType->code,
                        'symbol' => $row->product->unitType->symbol,
                        'allows_decimal' => (bool) $row->product->unitType->allows_decimal,
                    ] : null,
                ] : null,
                'variant' => $row->variant ? [
                    'id' => $row->variant->id,
                    'name' => $row->variant->name,
                    'sku' => $row->variant->sku,
                    'attributes' => $row->variant->attributes,
                ] : null,
            ];
        });

        // For products with variants, include missing active variants as zero-quantity rows
        // so matrix combinations are visible even before first stock entry.
        $productsWithVariants = $normalized
            ->filter(fn ($r) => (bool) ($r['product']['has_variants'] ?? false) || !empty($r['product_variant_id']))
            ->pluck('product_id')
            ->unique()
            ->values();

        if ($productsWithVariants->isNotEmpty()) {
            $activeVariants = ProductVariant::query()
                ->whereIn('product_id', $productsWithVariants)
                ->where('is_active', true)
                ->get(['id', 'product_id', 'name', 'sku', 'attributes']);

            $existingKeys = $normalized
                ->map(fn ($r) => $r['product_id'] . ':' . ($r['product_variant_id'] ?? '0'))
                ->flip();

            $productMeta = $normalized
                ->pluck('product', 'product_id');

            foreach ($activeVariants as $variant) {
                $key = $variant->product_id . ':' . $variant->id;
                if ($existingKeys->has($key)) {
                    continue;
                }

                $normalized->push([
                    'id' => null,
                    'row_key' => $key,
                    'product_id' => $variant->product_id,
                    'product_variant_id' => $variant->id,
                    'quantity' => 0,
                    'product' => $productMeta->get($variant->product_id),
                    'variant' => [
                        'id' => $variant->id,
                        'name' => $variant->name,
                        'sku' => $variant->sku,
                        'attributes' => $variant->attributes,
                    ],
                ]);
            }
        }

        return response()->json([
            'data' => $normalized->values(),
            'meta' => [
                'location' => $location,
            ],
        ]);
    }

    public function submitCount(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $staff = $this->activeStaffContext($request);

        $validated = $request->validate([
            'merchant_location_id' => 'required|exists:merchant_locations,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.product_variant_id' => 'nullable|exists:product_variants,id',
            'items.*.counted_quantity' => 'required|numeric|min:0',
        ]);

        $staffRole = strtoupper((string) ($staff?->role ?? ''));
        if ($staffRole === 'STOREKEEPER') {
            $assignedLocationId = (int) ($staff?->assigned_location_id ?? 0);
            if ($assignedLocationId <= 0 || (int) $validated['merchant_location_id'] !== $assignedLocationId) {
                return response()->json(['message' => 'Huna ruhusa ya kuhesabu inventory kwa location hii.'], 403);
            }
        }

        $location = MerchantLocation::where('merchant_id', $merchant->id)
            ->where('id', $validated['merchant_location_id'])
            ->firstOrFail();

        $updated = 0;
        $varianceTotal = 0;

        DB::transaction(function () use ($validated, $merchant, $location, $request, &$updated, &$varianceTotal) {
            foreach ($validated['items'] as $row) {
                $inventory = ProductLocationInventory::firstOrCreate([
                    'product_id' => $row['product_id'],
                    'merchant_location_id' => $location->id,
                    'product_variant_id' => $row['product_variant_id'] ?? null,
                ], ['quantity' => 0, 'quantity_decimal' => 0]);

                $expected = (float) ($inventory->quantity_decimal ?? $inventory->quantity);
                $counted = (float) $row['counted_quantity'];
                $variance = $counted - $expected;

                if ($variance !== 0) {
                    $inventory->update(['quantity' => (int) ceil($counted), 'quantity_decimal' => $counted]);
                    $this->syncGlobalStock($row['product_id']);
                    $updated++;
                    $varianceTotal += $variance;
                }
            }

            RetailAuditLog::create([
                'merchant_id' => $merchant->id,
                'merchant_location_id' => $location->id,
                'user_id' => $request->user()->id,
                'action' => 'DAILY_COUNT',
                'description' => "Daily stock count submitted at {$location->name}. Adjusted lines: {$updated}, net variance: {$varianceTotal}.",
            ]);
        });

        return response()->json([
            'message' => 'Daily count submitted successfully.',
            'data' => [
                'updated_lines' => $updated,
                'net_variance' => $varianceTotal,
            ],
        ]);
    }

    /**
     * Restock a specific product at a location.
     */
    public function restock(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'merchant_location_id' => 'required|exists:merchant_locations,id',
            'product_variant_id' => 'nullable|exists:product_variants,id',
            'add_quantity' => 'required|numeric|min:0.001',
        ]);

        // Verify location belongs to merchant
        $location = MerchantLocation::where('merchant_id', $merchant->id)
            ->where('id', $validated['merchant_location_id'])
            ->firstOrFail();

        $inventory = ProductLocationInventory::firstOrCreate([
            'product_id' => $validated['product_id'],
            'merchant_location_id' => $validated['merchant_location_id'],
            'product_variant_id' => $validated['product_variant_id'] ?? null,
        ], ['quantity' => 0, 'quantity_decimal' => 0]);

        $addQuantity = (float) $validated['add_quantity'];
        $newQuantity = (float) ($inventory->quantity_decimal ?? $inventory->quantity ?? 0) + $addQuantity;
        $inventory->update([
            'quantity' => (int) ceil($newQuantity),
            'quantity_decimal' => $newQuantity,
        ]);

        // Recalculate global product stock
        $this->syncGlobalStock($validated['product_id']);

        // Log the action
        RetailAuditLog::create([
            'merchant_id' => $merchant->id,
            'merchant_location_id' => $location->id,
            'user_id' => $request->user()->id,
            'action' => 'RESTOCK',
            'description' => "Restocked product #{$validated['product_id']} (+{$validated['add_quantity']}) at {$location->name}. New qty: {$inventory->quantity}",
        ]);

        return response()->json([
            'message' => 'Restocked successfully.',
            'new_quantity' => $inventory->quantity
        ]);
    }

    /**
     * Bulk import inventory from CSV.
     */
    public function bulkImport(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $data = array_map('str_getcsv', file($file->getRealPath()));
        
        $header = array_shift($data); 
        // Expected: sku, location_id, quantity, title (opt), price (opt), image_url (opt)
        
        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => []
        ];

        DB::beginTransaction();
        try {
            foreach ($data as $index => $row) {
                if (count($row) < 3) continue;

                $sku = trim($row[0]);
                $locationId = (int) $row[1];
                $quantity = (int) $row[2];
                $title = trim($row[3] ?? '');
                $price = (float) ($row[4] ?? 0);
                $imageUrl = trim($row[5] ?? '');

                if ($quantity < 0) continue;

                // Search by SKU in variants first (since products table has no SKU column)
                $variant = ProductVariant::whereHas('product', function($q) use ($merchant) {
                    $q->where('merchant_id', $merchant->id);
                })->where('sku', $sku)->first();

                if ($variant) {
                    $product = $variant->product;
                    $variantId = $variant->id;
                } else if (!empty($title)) {
                    // Create new product
                    $product = Product::create([
                        'merchant_id' => $merchant->id,
                        'title' => $title,
                        'price' => $price,
                        'type' => 'physical',
                        'slug' => \Illuminate\Support\Str::slug($title) . '-' . \Illuminate\Support\Str::random(5),
                    ]);

                    // Create a default variant to store the SKU
                    $newVariant = $product->variants()->create([
                        'name' => 'Standard',
                        'sku' => $sku,
                        'price' => $price,
                        'inventory_count' => 0,
                        'is_active' => true,
                    ]);
                    $variantId = $newVariant->id;

                    if ($imageUrl) {
                        $product->images()->create([
                            'image_url' => $imageUrl,
                            'order' => 0
                        ]);
                    }
                } else {
                    $results['failed']++;
                    $results['errors'][] = "Row " . ($index + 2) . ": SKU $sku not found and no title provided for creation.";
                    continue;
                }

                // Validate location
                $location = MerchantLocation::where('merchant_id', $merchant->id)
                    ->where('id', $locationId)
                    ->first();

                if (!$location) {
                    $results['failed']++;
                    $results['errors'][] = "Row " . ($index + 2) . ": Location ID $locationId invalid.";
                    continue;
                }

                ProductLocationInventory::updateOrCreate([
                    'product_id' => $product->id,
                    'merchant_location_id' => $locationId,
                    'product_variant_id' => $variantId,
                ], [
                    'quantity' => $quantity
                ]);

                $this->syncGlobalStock($product->id);
                $results['success']++;
            }

            RetailAuditLog::create([
                'merchant_id' => $merchant->id,
                'user_id' => $request->user()->id,
                'action' => 'BULK_IMPORT',
                'description' => "Imported inventory for {$results['success']} items.",
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Import completed.',
            'results' => $results
        ]);
    }

    private function syncGlobalStock($productId)
    {
        $total = (float) ProductLocationInventory::where('product_id', $productId)->sum(DB::raw('COALESCE(quantity_decimal, quantity)'));
        Product::where('id', $productId)->update(['inventory_count' => (int) ceil($total), 'inventory_quantity' => $total]);
    }
}
