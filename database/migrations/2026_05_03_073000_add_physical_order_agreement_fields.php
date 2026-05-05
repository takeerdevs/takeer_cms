<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->json('agreement_snapshot')->nullable()->after('manager_notes');
            $table->timestamp('agreed_at')->nullable()->after('agreement_snapshot');
            $table->timestamp('inventory_reserved_at')->nullable()->after('agreed_at')->index();
            $table->timestamp('merchant_confirmed_at')->nullable()->after('inventory_reserved_at');
            $table->timestamp('cancelled_at')->nullable()->after('merchant_confirmed_at');
            $table->string('cancelled_by')->nullable()->after('cancelled_at');
            $table->text('cancellation_reason')->nullable()->after('cancelled_by');
            $table->timestamp('paid_out_at')->nullable()->after('cancellation_reason')->index();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'agreement_snapshot',
                'agreed_at',
                'inventory_reserved_at',
                'merchant_confirmed_at',
                'cancelled_at',
                'cancelled_by',
                'cancellation_reason',
                'paid_out_at',
            ]);
        });
    }
};
