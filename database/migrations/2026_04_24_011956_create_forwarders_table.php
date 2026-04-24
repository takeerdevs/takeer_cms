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
        Schema::create('forwarders', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('address_line');
            $table->decimal('latitude', 11, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->string('contact_phone')->nullable();
            $table->string('website')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->json('required_fields')->nullable(); // e.g. ["customer_id", "container_mark"]
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forwarders');
    }
};
