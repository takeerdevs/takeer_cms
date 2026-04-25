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
        Schema::create('payment_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('cover_image')->nullable();
            $table->decimal('amount', 14, 2)->nullable()->comment('For fixed amount pages');
            $table->string('currency')->default('TZS');
            $table->string('theme_color')->default('#059669'); // Takeer Green
            $table->json('settings')->nullable()->comment('Config for display options');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('merchant_id');
            $table->index('slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_pages');
    }
};
