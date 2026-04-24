<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_category_attributes', function (Blueprint $table) {
            $table->string('ui_hint', 40)->nullable()->after('input_type');
            $table->json('unit_options')->nullable()->after('options');
        });
    }

    public function down(): void
    {
        Schema::table('product_category_attributes', function (Blueprint $table) {
            $table->dropColumn(['ui_hint', 'unit_options']);
        });
    }
};
