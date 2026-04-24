<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->json('custom_sections')->nullable()->after('links');
            $table->json('hidden_sections')->nullable()->after('custom_sections');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->dropColumn(['custom_sections', 'hidden_sections']);
        });
    }
};
