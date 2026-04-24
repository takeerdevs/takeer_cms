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
        Schema::create('exchange_rate_histories', function (Blueprint $table) {
            $table->id();
            $table->string('currency_code', 3);
            $table->decimal('rate', 20, 10);
            $table->date('effective_date');
            $table->boolean('is_manual')->default(false);
            $table->timestamps();

            $table->foreign('currency_code')
                ->references('code')
                ->on('currencies')
                ->onDelete('cascade');

            // Add index for efficient querying
            $table->index(['currency_code', 'effective_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('exchange_rate_histories');
    }
};
