<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forwarder_route_transport_modes', function (Blueprint $table): void {
            $table->string('payment_term', 60)->default('pay_on_pickup')->after('minimum_charge');
            $table->string('deposit_type', 24)->nullable()->after('payment_term');
            $table->string('deposit_value', 80)->nullable()->after('deposit_type');
            $table->string('balance_due', 120)->nullable()->after('deposit_value');
            $table->text('payment_notes')->nullable()->after('balance_due');
        });
    }

    public function down(): void
    {
        Schema::table('forwarder_route_transport_modes', function (Blueprint $table): void {
            $table->dropColumn([
                'payment_term',
                'deposit_type',
                'deposit_value',
                'balance_due',
                'payment_notes',
            ]);
        });
    }
};
