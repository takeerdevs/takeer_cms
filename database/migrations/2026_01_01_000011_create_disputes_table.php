<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('disputes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('buyer_unboxing_video_url')->comment('S3 URL of buyer dispute video');
            $table->text('dispute_reason')->nullable();
            $table->text('admin_resolution_notes')->nullable();
            $table->enum('status', ['open', 'ruled_for_buyer', 'ruled_for_merchant'])->default('open');
            $table->timestamps();

            $table->unique('order_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disputes');
    }
};
