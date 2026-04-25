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
        Schema::table('merchants', function (Blueprint $table) {
            $table->unsignedBigInteger('storage_limit_mb')->default(500)->after('is_active');
            $table->unsignedBigInteger('storage_used_bytes')->default(0)->after('storage_limit_mb');
            $table->string('subscription_tier')->default('free')->after('storage_used_bytes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            $table->dropColumn(['storage_limit_mb', 'storage_used_bytes', 'subscription_tier']);
        });
    }
};
