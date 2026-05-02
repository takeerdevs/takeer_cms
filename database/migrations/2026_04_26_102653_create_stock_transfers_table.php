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
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_variant_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('from_location_id')->constrained('merchant_locations')->onDelete('cascade');
            $table->foreignId('to_location_id')->constrained('merchant_locations')->onDelete('cascade');
            $table->integer('quantity');
            $table->foreignId('requested_by_staff_id')->nullable()->constrained('merchant_staffs')->onDelete('set null');
            $table->foreignId('dispatched_by_staff_id')->nullable()->constrained('merchant_staffs')->onDelete('set null');
            $table->foreignId('received_by_staff_id')->nullable()->constrained('merchant_staffs')->onDelete('set null');
            $table->enum('status', ['PENDING', 'DISPATCHED', 'RECEIVED', 'CANCELLED'])->default('PENDING');
            $table->text('notes')->nullable();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_transfers');
    }
};
