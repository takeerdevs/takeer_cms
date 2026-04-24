<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockWaitlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WaitlistController extends Controller
{
    /**
     * Toggle waitlist status for a product/variant.
     */
    public function toggle(Request $request, Product $product): JsonResponse
    {
        $user = $request->user();
        $variantId = $request->input('variant_id');

        $existing = StockWaitlist::where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->where('variant_id', $variantId)
            ->first();

        if ($existing) {
            $existing->delete();
            return response()->json([
                'status' => 'removed',
                'message' => 'Umeondolewa kwenye waitlist.',
            ]);
        }

        StockWaitlist::create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'variant_id' => $variantId,
        ]);

        return response()->json([
            'status' => 'added',
            'message' => 'Nimepokea! Nitakujulisha stock ikiongezwa.',
        ]);
    }

    /**
     * Check if user is on the waitlist for a product/variant.
     */
    public function status(Request $request, Product $product): JsonResponse
    {
        $user = $request->user();
        if (!$user) return response()->json(['on_waitlist' => false]);
        
        $variantId = $request->input('variant_id');

        $exists = StockWaitlist::where('user_id', $user->id)
            ->where('product_id', $product->id)
            ->where('variant_id', $variantId)
            ->exists();

        return response()->json(['on_waitlist' => $exists]);
    }
}
