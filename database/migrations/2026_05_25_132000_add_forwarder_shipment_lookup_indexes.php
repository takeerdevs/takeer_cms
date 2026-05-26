<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarder_shipments', function (Blueprint $table) {
            $table->index(['forwarder_id', 'tracking_number'], 'forwarder_shipments_forwarder_tracking_idx');
            $table->index(['forwarder_id', 'external_order_ref'], 'forwarder_shipments_forwarder_external_ref_idx');
            $table->index(['forwarder_id', 'public_id'], 'forwarder_shipments_forwarder_public_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('forwarder_shipments', function (Blueprint $table) {
            $table->dropIndex('forwarder_shipments_forwarder_tracking_idx');
            $table->dropIndex('forwarder_shipments_forwarder_external_ref_idx');
            $table->dropIndex('forwarder_shipments_forwarder_public_id_idx');
        });
    }
};
