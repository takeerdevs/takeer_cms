<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('forwarders', 'verification_status')) {
            return;
        }

        DB::table('forwarders')
            ->where('is_verified', true)
            ->where('verification_status', 'pending')
            ->update([
                'verification_status' => 'verified',
                'verified_at' => now(),
            ]);

        if (!Schema::hasTable('forwarder_locations')) {
            return;
        }

        DB::table('forwarder_locations')
            ->join('forwarders', 'forwarders.id', '=', 'forwarder_locations.forwarder_id')
            ->where('forwarders.is_verified', true)
            ->where('forwarders.verification_status', 'verified')
            ->where('forwarder_locations.is_verified', false)
            ->update([
                'forwarder_locations.is_verified' => true,
                'forwarder_locations.verified_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Verification status sync is not reversible without losing admin intent.
    }
};
