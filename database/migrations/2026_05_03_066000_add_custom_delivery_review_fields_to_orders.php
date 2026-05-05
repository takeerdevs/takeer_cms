<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('custom_delivery_status')->nullable()->after('custom_delivery_delivered_at');
            $table->text('custom_delivery_revision_message')->nullable()->after('custom_delivery_status');
            $table->timestamp('custom_delivery_revision_requested_at')->nullable()->after('custom_delivery_revision_message');
            $table->timestamp('custom_delivery_accepted_at')->nullable()->after('custom_delivery_revision_requested_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'custom_delivery_status',
                'custom_delivery_revision_message',
                'custom_delivery_revision_requested_at',
                'custom_delivery_accepted_at',
            ]);
        });
    }
};
