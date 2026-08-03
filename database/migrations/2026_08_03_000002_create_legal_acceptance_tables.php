<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legal_documents', function (Blueprint $table) {
            $table->id();
            $table->string('document_type')->index();
            $table->string('version');
            $table->timestamp('effective_at');
            $table->char('content_hash_sha256', 64);
            $table->string('immutable_storage_uri')->nullable();
            $table->string('approval_reference')->nullable();
            $table->string('status')->default('draft')->index();
            $table->timestamps();

            $table->unique(['document_type', 'version']);
        });

        Schema::create('legal_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('legal_document_id')->constrained('legal_documents')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->timestamp('accepted_at');
            $table->ipAddress('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            $table->string('locale', 12)->nullable();
            $table->string('acceptance_action');
            $table->json('evidence_payload')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'legal_document_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_acceptances');
        Schema::dropIfExists('legal_documents');
    }
};
