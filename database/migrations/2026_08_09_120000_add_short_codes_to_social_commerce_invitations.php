<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_commerce_request_invitations', function (Blueprint $table): void {
            $table->string('short_code', 16)->nullable()->unique()->after('public_id');
            $table->char('short_token_hash', 64)->nullable()->unique()->after('token_hash');
        });
    }

    public function down(): void
    {
        Schema::table('social_commerce_request_invitations', function (Blueprint $table): void {
            $table->dropUnique(['short_code']);
            $table->dropUnique(['short_token_hash']);
            $table->dropColumn(['short_code', 'short_token_hash']);
        });
    }
};
