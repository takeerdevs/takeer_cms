<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_license_keys', function (Blueprint $table) {
            $table->unsignedInteger('activation_count')->default(0)->after('status');
            $table->timestamp('last_activated_at')->nullable()->after('activation_count');
            $table->string('last_activation_ip', 45)->nullable()->after('last_activated_at');
            $table->json('activation_meta')->nullable()->after('last_activation_ip');
        });
    }

    public function down(): void
    {
        Schema::table('product_license_keys', function (Blueprint $table) {
            $table->dropColumn([
                'activation_count',
                'last_activated_at',
                'last_activation_ip',
                'activation_meta',
            ]);
        });
    }
};
