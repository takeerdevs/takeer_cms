<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_service_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category_name', 120);
            $table->string('subcategory_name', 120)->nullable();
            $table->string('document_type', 60)->default('professional_license');
            $table->string('document_name', 160);
            $table->string('document_number', 120)->nullable();
            $table->string('issuer', 160)->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('document_url');
            $table->string('status', 24)->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['service_category_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_service_credentials');
    }
};
