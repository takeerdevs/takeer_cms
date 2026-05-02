<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('source', 40)->default('authored')->after('content_item_id');
            $table->index(['merchant_id', 'source']);
        });

        DB::table('posts')
            ->whereNotNull('content_item_id')
            ->update(['source' => 'content_publish']);

        DB::table('posts')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('post_promotables')
                    ->whereColumn('post_promotables.post_id', 'posts.id');
            })
            ->whereNull('body')
            ->update(['source' => 'bundle_publish']);

        DB::table('posts')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('post_product_tags')
                    ->whereColumn('post_product_tags.post_id', 'posts.id');
            })
            ->whereNull('body')
            ->where('source', 'authored')
            ->update(['source' => 'catalog_publish']);
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['merchant_id', 'source']);
            $table->dropColumn('source');
        });
    }
};
