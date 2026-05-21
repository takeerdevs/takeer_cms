<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_categories', function (Blueprint $table) {
            $table->json('allowed_template_keys')->nullable()->after('service_template_key');
            $table->json('template_rules')->nullable()->after('template_config');
        });
    }

    public function down(): void
    {
        Schema::table('service_categories', function (Blueprint $table) {
            $table->dropColumn(['allowed_template_keys', 'template_rules']);
        });
    }
};
