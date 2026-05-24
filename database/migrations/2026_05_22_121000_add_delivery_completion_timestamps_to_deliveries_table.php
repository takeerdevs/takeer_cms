<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            if (! Schema::hasColumn('deliveries', 'delivered_at')) {
                $table->timestamp('delivered_at')->nullable()->after('delivery_status');
            }

            if (! Schema::hasColumn('deliveries', 'confirmed_at')) {
                $table->timestamp('confirmed_at')->nullable()->after('delivered_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            if (Schema::hasColumn('deliveries', 'confirmed_at')) {
                $table->dropColumn('confirmed_at');
            }

            if (Schema::hasColumn('deliveries', 'delivered_at')) {
                $table->dropColumn('delivered_at');
            }
        });
    }
};
