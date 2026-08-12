<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class ProductCodeLookupController extends Controller
{
    public function show(string $code): JsonResponse
    {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
        if (!preg_match('/^TK[0-9]{5,18}$/', $code)) {
            return response()->json(['message' => 'Weka namba sahihi ya bidhaa, mfano TK12345.'], 422);
        }

        $product = Product::query()
            ->with(['images', 'merchant.currency'])
            ->where('product_code', $code)
            ->first();

        if (!$product || !$product->merchant || !$product->merchant->is_active || $product->merchant->is_suspended) {
            return response()->json(['message' => "Hakuna bidhaa iliyopatikana kwa namba {$code}."], 404);
        }

        $productUrl = route('product.show', ['product' => $product->slug ?: $product->id]);

        return response()->json([
            'found' => true,
            'product' => [
                'id' => $product->id,
                'code' => $product->product_code,
                'title' => $product->title,
                'type' => $product->type,
                'price' => $product->discounted_price > 0 ? (float) $product->discounted_price : (float) $product->price,
                'currency_code' => $product->merchant->currency?->code ?: 'TZS',
                'image_url' => $product->image_url,
                'url' => $productUrl,
                'tracking_url' => $productUrl.'?'.http_build_query([
                    'source' => 'product_code',
                    'utm_source' => 'takeer_code',
                    'utm_medium' => 'live_commerce',
                    'product_code' => $product->product_code,
                ]),
                'merchant' => [
                    'display_name' => $product->merchant->display_name,
                    'username' => $product->merchant->username,
                    'is_verified' => (bool) $product->merchant->is_verified,
                ],
            ],
        ]);
    }
}
