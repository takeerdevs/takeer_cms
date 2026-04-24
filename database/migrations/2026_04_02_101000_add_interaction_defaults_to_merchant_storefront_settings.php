<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->boolean('allow_post_comments')->default(true)->after('featured_product_id');
            $table->boolean('allow_post_reactions')->default(true)->after('allow_post_comments');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->dropColumn(['allow_post_comments', 'allow_post_reactions']);
        });
    }
};

