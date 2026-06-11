<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->decimal('pickup_cancellation_penalty_percent', 5, 2)->default(0)->after('pickup_advance_days');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('pickup_cancellation_penalty_percent', 5, 2)->nullable()->after('pickup_no_show_reason');
            $table->decimal('pickup_cancellation_penalty_amount', 12, 2)->nullable()->after('pickup_cancellation_penalty_percent');
            $table->decimal('pickup_cancellation_refund_amount', 12, 2)->nullable()->after('pickup_cancellation_penalty_amount');
            $table->timestamp('pickup_cancelled_after_grace_at')->nullable()->after('pickup_cancellation_refund_amount');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'pickup_cancellation_penalty_percent',
                'pickup_cancellation_penalty_amount',
                'pickup_cancellation_refund_amount',
                'pickup_cancelled_after_grace_at',
            ]);
        });

        Schema::table('merchant_locations', function (Blueprint $table) {
            $table->dropColumn([
                'pickup_cancellation_penalty_percent',
            ]);
        });
    }
};
