<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('posts') || ! Schema::hasTable('content_items')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->foreign('content_item_id')
                ->references('id')
                ->on('content_items')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('posts')) {
            return;
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropForeign(['content_item_id']);
        });
    }
};
