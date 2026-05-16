<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retail_bookkeeping_share_links', function (Blueprint $table) {
            $table->string('password_hash')->nullable()->after('token');
            $table->boolean('include_proofs')->default(true)->after('sections');
            $table->boolean('allow_downloads')->default(false)->after('include_proofs');
            $table->dateTime('revoked_at')->nullable()->after('last_accessed_at');
        });

        Schema::create('retail_bookkeeping_share_access_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('retail_bookkeeping_share_link_id')->constrained('retail_bookkeeping_share_links')->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('event')->default('viewed')->index();
            $table->string('ip_address', 64)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retail_bookkeeping_share_access_logs');

        Schema::table('retail_bookkeeping_share_links', function (Blueprint $table) {
            $table->dropColumn(['password_hash', 'include_proofs', 'allow_downloads', 'revoked_at']);
        });
    }
};
