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
        Schema::create('countries', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('iso_alpha2')->unique(); // two letter country code
            $table->string('phone_code')->nullable();
            $table->string('continent')->nullable();
            $table->string('flag')->nullable();
            $table->string('timezone')->nullable(); // e.g., 'UTC+0', 'UTC+5:30'
            $table->string('default_language')->nullable()->default('en');
            $table->boolean('is_active')->default(true);
            $table->foreignId('default_currency_id')->nullable()
                ->constrained('currencies')->nullOnDelete();
            $table->decimal('default_tax_rate', 5, 2)->nullable()->default(0); // Default tax/VAT rate
            $table->string('tax_label')->nullable()->default('VAT');
            $table->boolean('apply_tax_by_default')->default(false);
            $table->string('state_name')->default('State')->comment('Custom name for state/region level');
            $table->string('city_name')->default('City')->comment('Custom name for city/district level');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('countries');
    }
};
