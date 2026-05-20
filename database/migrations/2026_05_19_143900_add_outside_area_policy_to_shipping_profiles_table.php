<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipping_profiles', function (Blueprint $table) {
            $table->string('outside_area_policy')->default('inquiry')->after('is_default');
        });
    }

    public function down(): void
    {
        Schema::table('shipping_profiles', function (Blueprint $table) {
            $table->dropColumn('outside_area_policy');
        });
    }
};
