<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->json('item_layouts')->nullable()->after('featured_product_id');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->dropColumn('item_layouts');
        });
    }
};
