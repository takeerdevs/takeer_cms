<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->foreignId('shipping_hotspot_id')->nullable()->after('shipping_zone_id')->constrained('shipping_hotspots')->nullOnDelete();
            $table->decimal('latitude', 10, 8)->nullable()->after('physical_address');
            $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            
            // Adjust delivery_status enum to include 'inquiry'
            // NOTE: Changing enum types via Schema::table can be tricky in some DB drivers (MySQL vs SQLite vs Postgres).
            // For MySQL, a raw query is safer if it's already an enum.
        });
        
        // Use raw query to update enum safely for MySQL/MariaDB and Postgres
        try {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check');
                DB::statement("ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_status_check CHECK (delivery_status::text = ANY (ARRAY['inquiry'::character varying, 'awaiting_boda'::character varying, 'in_transit'::character varying, 'ready_at_terminal'::character varying, 'delivered'::character varying]::text[]))");
            } else {
                DB::statement("ALTER TABLE deliveries MODIFY COLUMN delivery_status ENUM('inquiry', 'awaiting_boda', 'in_transit', 'ready_at_terminal', 'delivered') DEFAULT 'awaiting_boda'");
            }
        } catch (\Exception $e) {
            // Fallback for drivers that don't support this
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropForeign(['shipping_hotspot_id']);
            $table->dropColumn(['shipping_hotspot_id', 'latitude', 'longitude']);
        });
    }
};
