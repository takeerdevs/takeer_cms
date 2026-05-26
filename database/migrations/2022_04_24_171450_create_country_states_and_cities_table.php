<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('country_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('country_id')->constrained('countries')->cascadeOnDelete();
            $table->string('name');
            $table->string('normalized_name');
            $table->string('code')->nullable();
            $table->timestamps();

            $table->unique(['country_id', 'normalized_name']);
            $table->index(['country_id', 'code']);
        });

        Schema::create('country_cities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('country_id')->constrained('countries')->cascadeOnDelete();
            $table->foreignId('state_id')->nullable()->constrained('country_states')->nullOnDelete();
            $table->string('name');
            $table->string('normalized_name');
            $table->timestamps();

            $table->unique(['country_id', 'state_id', 'normalized_name']);
            $table->index(['country_id', 'normalized_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('country_cities');
        Schema::dropIfExists('country_states');
    }
};
