<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarders', 'destinations_config')) {
                $table->json('destinations_config')->nullable()->after('operating_country_ids');
            }

            if (!Schema::hasColumn('forwarders', 'shipping_schedules')) {
                $table->json('shipping_schedules')->nullable()->after('destinations_config');
            }

            if (!Schema::hasColumn('forwarders', 'logistics_updates')) {
                $table->json('logistics_updates')->nullable()->after('shipping_schedules');
            }
        });
    }

    public function down(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            foreach (['logistics_updates', 'shipping_schedules', 'destinations_config'] as $column) {
                if (Schema::hasColumn('forwarders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
