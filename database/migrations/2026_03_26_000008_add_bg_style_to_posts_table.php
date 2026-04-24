<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('posts') || Schema::hasColumn('posts', 'bg_style')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->string('bg_style', 80)->nullable()->after('caption');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('posts') || ! Schema::hasColumn('posts', 'bg_style')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('bg_style');
        });
    }
};
