<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->enum('type', ['STORE', 'SHOP'])->default('SHOP')->after('merchant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
