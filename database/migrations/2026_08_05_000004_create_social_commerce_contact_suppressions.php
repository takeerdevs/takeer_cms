<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_commerce_contact_suppressions', function (Blueprint $table): void {
            $table->id();
            $table->char('contact_hash', 64)->unique();
            $table->string('reason', 120)->nullable();
            $table->timestamp('created_at');
            $table->timestamp('expires_at')->nullable();
            $table->index(['contact_hash', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_commerce_contact_suppressions');
    }
};
