<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_request_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_request_id')->constrained('service_requests')->cascadeOnDelete();
            $table->string('channel');
            $table->string('recipient')->nullable();
            $table->string('subject')->nullable();
            $table->text('message');
            $table->string('status')->default('pending');
            $table->string('provider')->nullable();
            $table->string('provider_message_id')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('prepared_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['service_request_id', 'channel']);
            $table->index(['status', 'channel']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_request_notifications');
    }
};
