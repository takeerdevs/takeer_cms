<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductLocationInventory;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class RetailOnboardingController extends Controller
{
    /**
     * Bulk Import Inventory from CSV.
     */
    public function import(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $file = $request->file('file');
        $data = array_map('str_getcsv', file($file->getPathname()));
        $header = array_shift($data); // Expecting: sku, location_id, quantity

        $results = [
            'success' => 0,
            'failed' => 0,
            'errors' => []
        ];

        DB::transaction(function () use ($data, $merchant, &$results) {
            foreach ($data as $row) {
                if (count($row) < 3) continue;

                $sku = $row[0];
                $locationId = $row[1];
                $quantity = (int) $row[2];

                $product = Product::where('merchant_id', $merchant->id)
                    ->where('sku', $sku)
                    ->first();

                if (!$product) {
                    $results['failed']++;
                    $results['errors'][] = "SKU {$sku} not found.";
                    continue;
                }

                // Update Location Inventory
                ProductLocationInventory::updateOrCreate(
                    [
                        'merchant_location_id' => $locationId,
                        'product_id' => $product->id,
                    ],
                    ['quantity' => $quantity]
                );

                // Recalculate Global Stock
                $totalStock = ProductLocationInventory::where('product_id', $product->id)->sum('quantity');
                $product->update(['inventory_count' => $totalStock]);

                $results['success']++;
            }
        });

        return response()->json([
            'message' => 'Bulk import completed.',
            'results' => $results
        ]);
    }

    /**
     * Generate a template for the merchant.
     */
    public function downloadTemplate(Request $request)
    {
        $merchant = $request->attributes->get('active_merchant');
        $locations = $merchant->locations()->get(['id', 'name']);

        $filename = "inventory_template.csv";
        
        return response()->streamDownload(function() use ($locations) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['sku', 'location_id', 'quantity', 'title', 'price', 'image_url']);
            
            foreach ($locations as $loc) {
                fputcsv($handle, ['SAMPLE-SKU-1', $loc->id, 100, 'My Product Name', 50000, 'https://example.com/image.jpg']);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }
}
