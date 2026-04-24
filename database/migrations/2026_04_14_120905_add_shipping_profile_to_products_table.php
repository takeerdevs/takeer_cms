<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('shipping_profile_id')->nullable()->after('merchant_id')->constrained('shipping_profiles')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['shipping_profile_id']);
            $table->dropColumn('shipping_profile_id');
        });
    }
};
