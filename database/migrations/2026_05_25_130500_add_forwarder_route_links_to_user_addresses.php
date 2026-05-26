<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_addresses', function (Blueprint $table) {
            if (!Schema::hasColumn('user_addresses', 'forwarder_route_id')) {
                $table->foreignId('forwarder_route_id')->nullable()->after('forwarder_id')->constrained('forwarder_routes')->nullOnDelete();
            }

            if (!Schema::hasColumn('user_addresses', 'forwarder_location_id')) {
                $table->foreignId('forwarder_location_id')->nullable()->after('forwarder_route_id')->constrained('forwarder_locations')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_addresses', function (Blueprint $table) {
            if (Schema::hasColumn('user_addresses', 'forwarder_location_id')) {
                $table->dropConstrainedForeignId('forwarder_location_id');
            }

            if (Schema::hasColumn('user_addresses', 'forwarder_route_id')) {
                $table->dropConstrainedForeignId('forwarder_route_id');
            }
        });
    }
};
