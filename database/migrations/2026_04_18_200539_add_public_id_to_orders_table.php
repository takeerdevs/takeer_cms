<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('public_id', 20)->unique()->nullable()->after('id');
        });

        // Initialize for all existing orders
        foreach (\App\Models\Order::all() as $order) {
            $order->update(['public_id' => \App\Models\Order::generatePublicId()]);
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->string('public_id', 20)->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            //
        });
    }
};
