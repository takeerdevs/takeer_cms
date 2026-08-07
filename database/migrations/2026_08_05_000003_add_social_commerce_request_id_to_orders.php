<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (!Schema::hasColumn('orders', 'social_commerce_request_id')) {
                $table->foreignId('social_commerce_request_id')
                    ->nullable()
                    ->unique()
                    ->after('merchant_id')
                    ->constrained('social_commerce_requests')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (Schema::hasColumn('orders', 'social_commerce_request_id')) {
                $table->dropConstrainedForeignId('social_commerce_request_id');
            }
        });
    }
};
