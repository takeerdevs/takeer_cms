<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('comments_enabled_override')->nullable()->after('restricted_price');
            $table->boolean('reactions_enabled_override')->nullable()->after('comments_enabled_override');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['comments_enabled_override', 'reactions_enabled_override']);
        });
    }
};

