<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\MerchantLocation;
use App\Models\ProductLocationInventory;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_location_inventories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_location_id')->constrained('merchant_locations')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->cascadeOnDelete();
            $table->unsignedInteger('quantity')->default(0);
            $table->timestamps();

            $table->unique(['merchant_location_id', 'product_id', 'product_variant_id'], 'location_product_variant_unique');
        });

        // Initialize stock for existing products and variants to their primary merchant location
        $this->initializeStock();
    }

    private function initializeStock(): void
    {
        // Standalone products
        Product::where('has_variants', false)->chunk(100, function ($products) {
            foreach ($products as $product) {
                $primaryLocation = MerchantLocation::where('merchant_id', $product->merchant_id)
                    ->where('is_primary', true)
                    ->first() ?? MerchantLocation::where('merchant_id', $product->merchant_id)->first();

                if ($primaryLocation) {
                    ProductLocationInventory::updateOrCreate(
                        [
                            'merchant_location_id' => $primaryLocation->id,
                            'product_id' => $product->id,
                            'product_variant_id' => null,
                        ],
                        ['quantity' => $product->inventory_count]
                    );
                }
            }
        });

        // Variants
        ProductVariant::chunk(100, function ($variants) {
            foreach ($variants as $variant) {
                // Get merchant_id from product
                $merchantId = $variant->product->merchant_id ?? null;
                if (!$merchantId) continue;

                $primaryLocation = MerchantLocation::where('merchant_id', $merchantId)
                    ->where('is_primary', true)
                    ->first() ?? MerchantLocation::where('merchant_id', $merchantId)->first();

                if ($primaryLocation) {
                    ProductLocationInventory::updateOrCreate(
                        [
                            'merchant_location_id' => $primaryLocation->id,
                            'product_id' => null,
                            'product_variant_id' => $variant->id,
                        ],
                        ['quantity' => $variant->inventory_count]
                    );
                }
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_location_inventories');
    }
};
