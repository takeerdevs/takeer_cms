<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('merchant_kycs', function (Blueprint $table) {
            $table->string('business_type')->default('individual')->after('merchant_id'); // individual, sole_proprietor, business, ngo
            $table->string('tin_number')->nullable()->after('occupation');
            $table->string('brela_number')->nullable()->after('tin_number');
            $table->string('business_license_url')->nullable()->after('brela_number');
            $table->string('registration_doc_url')->nullable()->after('business_license_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('merchant_kycs', function (Blueprint $table) {
            $table->dropColumn(['business_type', 'tin_number', 'brela_number', 'business_license_url', 'registration_doc_url']);
        });
    }
};
