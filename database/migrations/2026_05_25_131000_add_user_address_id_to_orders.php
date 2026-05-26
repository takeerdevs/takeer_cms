<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'user_address_id')) {
                $table->foreignId('user_address_id')->nullable()->after('buyer_id')->constrained('user_addresses')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'user_address_id')) {
                $table->dropConstrainedForeignId('user_address_id');
            }
        });
    }
};
