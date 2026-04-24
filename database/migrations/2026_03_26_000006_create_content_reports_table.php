<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('content_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('item_type')->comment('post|product|content_item|bundle');
            $table->unsignedBigInteger('item_id');
            $table->enum('reason', ['adult_content', 'political_content', 'misleading', 'other'])->default('other');
            $table->text('notes')->nullable();
            $table->enum('status', ['open', 'under_review', 'resolved', 'dismissed'])->default('open');
            $table->timestamps();

            $table->index('reporter_id');
            $table->index('merchant_id');
            $table->index(['item_type', 'item_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_reports');
    }
};
