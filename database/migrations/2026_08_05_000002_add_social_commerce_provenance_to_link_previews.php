<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('link_previews', function (Blueprint $table): void {
            $table->string('preview_provenance', 64)->nullable()->after('status');
            $table->string('failure_reason', 80)->nullable()->after('preview_provenance');
            $table->string('external_platform', 40)->nullable()->after('failure_reason');
            $table->string('external_post_id', 255)->nullable()->after('external_platform');
        });
    }

    public function down(): void
    {
        Schema::table('link_previews', function (Blueprint $table): void {
            $table->dropColumn(['preview_provenance', 'failure_reason', 'external_platform', 'external_post_id']);
        });
    }
};
