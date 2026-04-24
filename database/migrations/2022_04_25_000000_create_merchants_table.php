<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('merchants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('username')->unique();
            $table->string('display_name');
            $table->string('avatar_url')->nullable();
            $table->text('bio')->nullable();
            $table->boolean('is_default')->default(false);
            
            // Scalability & Global Support fields
            $table->foreignId('country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->foreignId('currency_id')->nullable()->constrained('currencies')->nullOnDelete();
            $table->boolean('is_suspended')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_active')->default(true); // Merchant-controlled deactivation
            
            // KYC and Payout Details
            $table->string('kyc_status')->default('unverified'); // 'unverified', 'pending', 'verified', 'rejected'
            $table->string('subaccount_id')->nullable();
            
            // Counters/Stats
            $table->unsignedInteger('successful_sales')->default(0);
            $table->unsignedInteger('unsuccessful_sales')->default(0);
            
            $table->timestamps();

            $table->index('user_id');
            $table->index('country_id');
            $table->index('currency_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('merchants');
    }
};
