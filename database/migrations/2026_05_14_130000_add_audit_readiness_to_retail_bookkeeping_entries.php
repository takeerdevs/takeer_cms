<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retail_bookkeeping_entries', function (Blueprint $table) {
            $table->enum('proof_status', ['attached', 'reference_only', 'missing', 'needs_replacement'])->default('missing')->after('attachment_size');
            $table->enum('review_status', ['pending', 'approved', 'rejected'])->default('approved')->after('proof_status');
            $table->foreignId('reviewed_by_user_id')->nullable()->after('review_status')->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by_user_id');
            $table->text('review_note')->nullable()->after('reviewed_at');
            $table->enum('reconciliation_status', ['unmatched', 'matched', 'needs_review'])->default('unmatched')->after('review_note');
            $table->string('statement_reference')->nullable()->after('reconciliation_status');
            $table->foreignId('reconciled_by_user_id')->nullable()->after('statement_reference')->constrained('users')->nullOnDelete();
            $table->timestamp('reconciled_at')->nullable()->after('reconciled_by_user_id');

            $table->index(['merchant_id', 'proof_status']);
            $table->index(['merchant_id', 'review_status']);
            $table->index(['merchant_id', 'reconciliation_status']);
        });

        Schema::create('retail_bookkeeping_period_locks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('period_key', 7);
            $table->foreignId('locked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['merchant_id', 'period_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retail_bookkeeping_period_locks');

        Schema::table('retail_bookkeeping_entries', function (Blueprint $table) {
            $table->dropIndex(['merchant_id', 'proof_status']);
            $table->dropIndex(['merchant_id', 'review_status']);
            $table->dropIndex(['merchant_id', 'reconciliation_status']);
            $table->dropConstrainedForeignId('reviewed_by_user_id');
            $table->dropConstrainedForeignId('reconciled_by_user_id');
            $table->dropColumn([
                'proof_status',
                'review_status',
                'reviewed_at',
                'review_note',
                'reconciliation_status',
                'statement_reference',
                'reconciled_at',
            ]);
        });
    }
};
