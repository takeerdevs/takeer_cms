<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_moderation_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 40);
            $table->string('reason_code', 80)->nullable();
            $table->string('public_reason')->nullable();
            $table->text('internal_note')->nullable();
            $table->boolean('show_public_notice')->default(true);
            $table->timestamps();

            $table->index(['post_id', 'created_at']);
            $table->index(['action', 'reason_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_moderation_actions');
    }
};
