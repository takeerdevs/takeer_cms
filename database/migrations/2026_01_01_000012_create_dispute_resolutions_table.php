<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('dispute_resolutions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('verdict')->comment('ruled_for_merchant | ruled_for_buyer');
            $table->text('reason_notes')->nullable();
            $table->timestamps();

            $table->index('admin_id');
            $table->index('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispute_resolutions');
    }
};
