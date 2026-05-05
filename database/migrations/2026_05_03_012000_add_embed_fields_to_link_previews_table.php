<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('link_previews', function (Blueprint $table) {
            $table->string('embed_provider', 64)->nullable()->after('status');
            $table->string('embed_type', 32)->nullable()->after('embed_provider');
            $table->string('embed_url', 2048)->nullable()->after('embed_type');
            $table->string('external_id', 255)->nullable()->after('embed_url');
        });
    }

    public function down(): void
    {
        Schema::table('link_previews', function (Blueprint $table) {
            $table->dropColumn([
                'embed_provider',
                'embed_type',
                'embed_url',
                'external_id',
            ]);
        });
    }
};
