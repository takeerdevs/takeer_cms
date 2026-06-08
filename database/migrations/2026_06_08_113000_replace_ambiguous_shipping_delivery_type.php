<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('deliveries')
            ->where('delivery_type', 'shipping')
            ->update(['delivery_type' => 'local_boda']);
    }

    public function down(): void
    {
        // Intentionally left blank: after conversion, local_boda rows cannot be
        // reliably distinguished from rows that were always explicit local delivery.
    }
};
