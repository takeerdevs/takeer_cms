<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->foreignId('shipping_profile_id')->nullable()->after('merchant_id')->constrained('shipping_profiles')->cascadeOnDelete();
        });

        // Data Migration: Move existing zones to a default profile for each merchant
        $merchantIds = DB::table('shipping_zones')
            ->whereNull('shipping_profile_id')
            ->distinct()
            ->pluck('merchant_id');

        foreach ($merchantIds as $merchantId) {
            $profileId = DB::table('shipping_profiles')->insertGetId([
                'merchant_id' => $merchantId,
                'name' => 'General Shipping',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('shipping_zones')
                ->where('merchant_id', $merchantId)
                ->whereNull('shipping_profile_id')
                ->update(['shipping_profile_id' => $profileId]);
        }

        // Now make it non-nullable if we want strictness, 
        // but for safety in SQLite/existing apps we might keep it nullable or do it in two steps.
        // Let's keep it nullable but constrained for now.
    }

    public function down(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->dropForeign(['shipping_profile_id']);
            $table->dropColumn('shipping_profile_id');
        });
    }
};
