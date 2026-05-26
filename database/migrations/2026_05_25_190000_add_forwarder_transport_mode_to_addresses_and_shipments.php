<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_addresses', function (Blueprint $table) {
            if (!Schema::hasColumn('user_addresses', 'forwarder_transport_mode')) {
                $table->string('forwarder_transport_mode')->nullable()->after('forwarder_location_id');
            }
        });

        Schema::table('forwarder_shipments', function (Blueprint $table) {
            if (!Schema::hasColumn('forwarder_shipments', 'transport_mode')) {
                $table->string('transport_mode')->nullable()->after('forwarder_route_id')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('forwarder_shipments', function (Blueprint $table) {
            if (Schema::hasColumn('forwarder_shipments', 'transport_mode')) {
                $table->dropColumn('transport_mode');
            }
        });

        Schema::table('user_addresses', function (Blueprint $table) {
            if (Schema::hasColumn('user_addresses', 'forwarder_transport_mode')) {
                $table->dropColumn('forwarder_transport_mode');
            }
        });
    }
};
