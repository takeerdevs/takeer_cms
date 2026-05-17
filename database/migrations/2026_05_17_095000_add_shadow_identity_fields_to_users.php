<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_shadow_user')->default(false)->after('is_banned');
            $table->string('shadow_source')->nullable()->after('is_shadow_user');
            $table->timestamp('onboarded_at')->nullable()->after('shadow_source');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_shadow_user', 'shadow_source', 'onboarded_at']);
        });
    }
};
