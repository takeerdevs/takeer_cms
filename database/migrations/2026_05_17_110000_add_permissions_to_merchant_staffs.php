<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_staffs', function (Blueprint $table) {
            $table->json('permissions')->nullable()->after('role');
            $table->boolean('dashboard_access_enabled')->default(false)->after('permissions');
            $table->boolean('pos_access_enabled')->default(true)->after('dashboard_access_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_staffs', function (Blueprint $table) {
            $table->dropColumn([
                'permissions',
                'dashboard_access_enabled',
                'pos_access_enabled',
            ]);
        });
    }
};
