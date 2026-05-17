<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('service_categories', function (Blueprint $table) {
            $table->string('service_template_key', 80)->nullable()->after('option_template');
            $table->json('template_config')->nullable()->after('service_template_key');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('service_template_key', 80)->nullable()->after('service_subcategory_id');
            $table->json('service_details')->nullable()->after('service_options');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['service_template_key', 'service_details']);
        });

        Schema::table('service_categories', function (Blueprint $table) {
            $table->dropColumn(['service_template_key', 'template_config']);
        });
    }
};
