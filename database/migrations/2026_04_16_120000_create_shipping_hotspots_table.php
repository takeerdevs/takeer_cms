<?php
/* [NEW] shipping_hotspots_table */
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_hotspots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipping_zone_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->decimal('latitude', 10, 8);
            $table->decimal('longitude', 11, 8);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_hotspots');
    }
};
