<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('license_key_enabled')->default(false)->after('digital_access_instructions');
            $table->string('license_key_prefix', 24)->nullable()->after('license_key_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['license_key_enabled', 'license_key_prefix']);
        });
    }
};
