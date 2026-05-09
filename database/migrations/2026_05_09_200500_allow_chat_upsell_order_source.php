<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check');
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_source_check CHECK (source::text = ANY (ARRAY['online'::character varying, 'pos'::character varying, 'chat_upsell'::character varying]::text[]))");
        } else {
            DB::statement("ALTER TABLE orders MODIFY COLUMN source ENUM('online', 'pos', 'chat_upsell') DEFAULT 'online'");
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        DB::table('orders')
            ->where('source', 'chat_upsell')
            ->update(['source' => 'online']);

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check');
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_source_check CHECK (source::text = ANY (ARRAY['online'::character varying, 'pos'::character varying]::text[]))");
        } else {
            DB::statement("ALTER TABLE orders MODIFY COLUMN source ENUM('online', 'pos') DEFAULT 'online'");
        }
    }
};
