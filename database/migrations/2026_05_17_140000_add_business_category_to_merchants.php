<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            $table->string('business_category_key', 80)->nullable()->after('type');
            $table->string('business_subcategory_key', 80)->nullable()->after('business_category_key');
            $table->json('business_profile')->nullable()->after('business_subcategory_key');
        });
    }

    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            $table->dropColumn(['business_category_key', 'business_subcategory_key', 'business_profile']);
        });
    }
};
