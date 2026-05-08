<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class ProductController extends Controller
{
    /**
     * GET /api/pwa/product/{product}
     * Returns lightweight product data for Link-in-Bio / web view.
     */
    public function show(Product $product): JsonResponse
    {
        $product->loadMissing(['attributes', 'unitType', 'packageContentUnitType', 'returnPolicy', 'faqs', 'merchant.user', 'merchant.locations', 'variants.locationInventories', 'locationInventories']);

        return response()->json([
            'product' => ProductResource::make($product),
        ]);
    }

    /**
     * POST /api/merchant/products/{product}/sync
     * Quick stock level adjustment from dashboard.
     */
    public function syncStock(Product $product): JsonResponse
    {
        if ($product->has_variants) {
            return response()->json([
                'message' => 'This product uses variants. Update stock at variant level from product edit.',
            ], 422);
        }

        $validated = request()->validate([
            'inventory_count' => 'required|integer|min:0',
            'buffer_stock' => 'nullable|integer|min:0',
        ]);

        // Security check: ensure merchant owns the product
        if ($product->merchant_id !== request()->user()->id) {
            abort(403, 'Unauthorized.');
        }

        $product->update([
            'inventory_count' => $validated['inventory_count'],
            'inventory_quantity' => $validated['inventory_count'],
            'buffer_stock' => $validated['buffer_stock'] ?? $product->buffer_stock,
        ]);

        // Option here to check if stock <= 2 and send warning SMS

        return response()->json([
            'message' => 'Stock imesasishwa kikamilifu.',
            'available_stock' => $product->available_stock,
        ]);
    }
}
