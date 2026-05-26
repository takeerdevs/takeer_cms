<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarders', 'merchant_id')) {
                $table->foreignId('merchant_id')->nullable()->after('id')->constrained('merchants')->nullOnDelete();
            }

            if (!Schema::hasColumn('forwarders', 'product_id')) {
                $table->foreignId('product_id')->nullable()->after('merchant_id')->constrained('products')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            if (Schema::hasColumn('forwarders', 'product_id')) {
                $table->dropConstrainedForeignId('product_id');
            }

            if (Schema::hasColumn('forwarders', 'merchant_id')) {
                $table->dropConstrainedForeignId('merchant_id');
            }
        });
    }
};
