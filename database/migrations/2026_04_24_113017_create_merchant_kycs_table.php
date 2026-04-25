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
        Schema::create('merchant_kycs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            
            $table->string('first_name');
            $table->string('last_name');
            $table->string('id_type'); // NIDA, Passport, Voter ID, Driver License
            $table->string('id_number');
            $table->string('id_front_url');
            $table->string('id_back_url')->nullable(); // Passports might only have one side
            
            $table->date('date_of_birth');
            $table->string('gender'); // male, female, other
            $table->string('residential_address');
            $table->string('occupation');
            
            $table->string('status')->default('pending'); // pending, verified, rejected
            $table->text('rejection_reason')->nullable();
            
            $table->timestamps();

            $table->index('merchant_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('merchant_kycs');
    }
};
