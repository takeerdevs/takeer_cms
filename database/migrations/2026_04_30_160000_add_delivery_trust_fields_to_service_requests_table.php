<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->string('delivery_status')->default('not_started')->after('payment_status');
            $table->timestamp('delivered_at')->nullable()->after('delivery_status');
            $table->timestamp('customer_confirmed_at')->nullable()->after('delivered_at');
            $table->timestamp('disputed_at')->nullable()->after('customer_confirmed_at');
            $table->timestamp('auto_confirm_after')->nullable()->after('disputed_at');
        });
    }

    public function down(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_status',
                'delivered_at',
                'customer_confirmed_at',
                'disputed_at',
                'auto_confirm_after',
            ]);
        });
    }
};
