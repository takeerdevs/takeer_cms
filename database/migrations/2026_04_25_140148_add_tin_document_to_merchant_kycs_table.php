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
            $table->string('tin_document_url')->nullable()->after('tin_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('merchant_kycs', function (Blueprint $table) {
            $table->dropColumn('tin_document_url');
        });
    }
};
