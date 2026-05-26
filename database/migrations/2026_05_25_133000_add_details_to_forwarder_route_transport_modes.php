<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarder_route_transport_modes', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarder_route_transport_modes', 'details')) {
                $table->json('details')->nullable()->after('disallowed_items');
            }
        });
    }

    public function down(): void
    {
        Schema::table('forwarder_route_transport_modes', function (Blueprint $table) {
            if (Schema::hasColumn('forwarder_route_transport_modes', 'details')) {
                $table->dropColumn('details');
            }
        });
    }
};
