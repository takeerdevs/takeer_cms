<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('digital_content_type')->nullable()->after('digital_delivery_type');
            $table->string('digital_usage_license')->nullable()->after('digital_content_type');
            $table->text('digital_access_instructions')->nullable()->after('digital_usage_license');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'digital_content_type',
                'digital_usage_license',
                'digital_access_instructions',
            ]);
        });
    }
};
