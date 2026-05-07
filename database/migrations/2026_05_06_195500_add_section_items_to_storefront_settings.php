<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('merchant_storefront_settings', 'section_items')) {
                $table->json('section_items')->nullable()->after('item_layouts');
            }

            if (! Schema::hasColumn('merchant_storefront_settings', 'hidden_item_keys')) {
                $table->json('hidden_item_keys')->nullable()->after('section_items');
            }
        });
    }

    public function down(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            if (Schema::hasColumn('merchant_storefront_settings', 'hidden_item_keys')) {
                $table->dropColumn('hidden_item_keys');
            }

            if (Schema::hasColumn('merchant_storefront_settings', 'section_items')) {
                $table->dropColumn('section_items');
            }
        });
    }
};
