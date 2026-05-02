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
        Schema::create('merchant_customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // If they have a platform account
            $table->string('name')->nullable();
            $table->string('phone')->index();
            $table->decimal('total_spent', 15, 2)->default(0);
            $table->integer('order_count')->default(0);
            $table->timestamp('last_purchase_at')->nullable();
            $table->timestamps();
            
            $table->unique(['merchant_id', 'phone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('merchant_customers');
    }
};
