<?php
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

try {
    DB::statement('ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_status_check');
    DB::statement("ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_status_check CHECK (delivery_status::text = ANY (ARRAY['inquiry'::character varying, 'awaiting_boda'::character varying, 'in_transit'::character varying, 'ready_at_terminal'::character varying, 'delivered'::character varying]::text[]))");
    echo "Constraint updated successfully.\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
