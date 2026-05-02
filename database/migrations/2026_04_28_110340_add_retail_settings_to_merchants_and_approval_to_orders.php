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
            $table->json('retail_settings')->nullable()->comment('POS discount thresholds, PIN requirements, etc');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('approval_status')->nullable()->index()->comment('pending, approved, rejected');
            $table->foreignId('approved_by_staff_id')->nullable()->constrained('merchant_staffs')->nullOnDelete();
            $table->timestamp('approval_requested_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            $table->dropColumn('retail_settings');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['approval_status', 'approved_by_staff_id', 'approval_requested_at']);
        });
    }
};
