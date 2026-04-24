<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->string('contact_phone')->nullable()->after('allow_self_pickup');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->dropColumn('contact_phone');
        });
    }
};
