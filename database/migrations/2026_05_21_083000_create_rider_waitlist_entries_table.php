<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rider_waitlist_entries', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('phone');
            $table->string('phone_normalized')->unique();
            $table->string('city')->nullable();
            $table->string('main_station')->nullable();
            $table->string('vehicle_type')->nullable();
            $table->foreignId('source_delivery_id')->nullable()->constrained('deliveries')->nullOnDelete();
            $table->foreignId('source_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->string('status')->default('pending');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rider_waitlist_entries');
    }
};
