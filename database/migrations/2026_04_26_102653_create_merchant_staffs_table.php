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
        Schema::create('merchant_staffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('assigned_location_id')->nullable()->constrained('merchant_locations')->onDelete('set null');
            $table->enum('role', ['MANAGER', 'CASHIER', 'STOREKEEPER'])->default('CASHIER');
            $table->string('pin_hash')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('merchant_staffs');
    }
};
