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
        Schema::table('forwarders', function (Blueprint $table) {
            $table->foreignId('country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->text('rates_info')->nullable();
            $table->text('description')->nullable();
            $table->string('logo_url')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('forwarders', function (Blueprint $table) {
            $table->dropForeign(['country_id']);
            $table->dropColumn(['country_id', 'rates_info', 'description', 'logo_url']);
        });
    }
};
