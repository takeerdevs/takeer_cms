<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bundle_live_sessions', function (Blueprint $table) {
            $table->string('check_in_code', 12)->nullable()->after('notes');
            $table->timestamp('check_in_code_expires_at')->nullable()->after('check_in_code');
            $table->boolean('check_in_enabled')->default(false)->after('check_in_code_expires_at');
        });

        Schema::create('bundle_live_session_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_live_session_id')->constrained('bundle_live_sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('marked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('present')->comment('present|late|absent|excused');
            $table->string('method')->default('pin')->comment('pin|merchant_manual|qr');
            $table->timestamp('checked_in_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['bundle_live_session_id', 'user_id'], 'bundle_live_session_user_unique');
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bundle_live_session_attendances');

        Schema::table('bundle_live_sessions', function (Blueprint $table) {
            $table->dropColumn([
                'check_in_code',
                'check_in_code_expires_at',
                'check_in_enabled',
            ]);
        });
    }
};
