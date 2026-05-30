<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_followers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->json('notification_preferences')->nullable();
            $table->timestamp('followed_at')->useCurrent();
            $table->timestamps();

            $table->unique(['merchant_id', 'user_id']);
            $table->index(['user_id', 'followed_at']);
            $table->index(['merchant_id', 'followed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_followers');
    }
};
