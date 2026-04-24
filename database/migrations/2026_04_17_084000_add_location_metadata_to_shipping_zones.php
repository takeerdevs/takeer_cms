<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->string('destination_city')->nullable()->after('destination_region');
            $table->string('destination_country')->nullable()->after('destination_city');
        });
    }

    public function down(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->dropColumn(['destination_city', 'destination_country']);
        });
    }
};
