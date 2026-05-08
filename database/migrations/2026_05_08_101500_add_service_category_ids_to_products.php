<?php

use App\Models\Product;
use App\Models\ServiceCategory;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('service_category_id')->nullable()->after('service_category')->constrained('service_categories')->nullOnDelete();
            $table->foreignId('service_subcategory_id')->nullable()->after('service_subcategory')->constrained('service_categories')->nullOnDelete();
        });

        $categories = ServiceCategory::query()->get()->groupBy(fn (ServiceCategory $category) => Str::lower(trim((string) $category->name)));

        Product::query()
            ->where('type', 'service')
            ->whereNotNull('service_category')
            ->select(['id', 'service_category', 'service_subcategory'])
            ->chunkById(200, function ($products) use ($categories): void {
                foreach ($products as $product) {
                    $parent = ($categories[Str::lower(trim((string) $product->service_category))] ?? collect())
                        ->first(fn (ServiceCategory $category) => $category->parent_id === null);

                    $child = null;
                    if ($parent && filled($product->service_subcategory)) {
                        $child = ($categories[Str::lower(trim((string) $product->service_subcategory))] ?? collect())
                            ->first(fn (ServiceCategory $category) => (int) $category->parent_id === (int) $parent->id);
                    }

                    Product::query()
                        ->whereKey($product->id)
                        ->update([
                            'service_category_id' => $parent?->id,
                            'service_subcategory_id' => $child?->id,
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('service_subcategory_id');
            $table->dropConstrainedForeignId('service_category_id');
        });
    }
};
