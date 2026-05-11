<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('deliveries')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check');
            DB::statement("ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_status_check CHECK (delivery_status::text = ANY (ARRAY['inquiry'::character varying, 'awaiting_boda'::character varying, 'awaiting_pickup'::character varying, 'in_transit'::character varying, 'ready_at_terminal'::character varying, 'delivered'::character varying, 'disputed'::character varying, 'customer_confirmed'::character varying]::text[]))");
        } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE deliveries MODIFY COLUMN delivery_status ENUM('inquiry', 'awaiting_boda', 'awaiting_pickup', 'in_transit', 'ready_at_terminal', 'delivered', 'disputed', 'customer_confirmed') DEFAULT 'awaiting_boda'");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('deliveries')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check');
            DB::statement("ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_status_check CHECK (delivery_status::text = ANY (ARRAY['inquiry'::character varying, 'awaiting_boda'::character varying, 'in_transit'::character varying, 'ready_at_terminal'::character varying, 'delivered'::character varying]::text[]))");
        } elseif (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE deliveries MODIFY COLUMN delivery_status ENUM('inquiry', 'awaiting_boda', 'in_transit', 'ready_at_terminal', 'delivered') DEFAULT 'awaiting_boda'");
        }
    }
};
