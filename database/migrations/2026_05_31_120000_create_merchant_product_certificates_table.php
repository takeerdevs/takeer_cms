<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_product_certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('certificate_type', 80)->nullable();
            $table->text('description')->nullable();
            $table->string('document_number', 120)->nullable();
            $table->string('issuer', 160)->nullable();
            $table->string('authority', 160)->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('document_url', 2048);
            $table->string('visibility', 40)->default('public_summary');
            $table->string('status', 40)->default('merchant_provided');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['merchant_id', 'visibility']);
        });

        Schema::create('merchant_product_certificate_product', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_product_certificate_id')
                ->constrained('merchant_product_certificates')
                ->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('public_note', 500)->nullable();
            $table->timestamps();

            $table->unique(['merchant_product_certificate_id', 'product_id'], 'certificate_product_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_product_certificate_product');
        Schema::dropIfExists('merchant_product_certificates');
    }
};
