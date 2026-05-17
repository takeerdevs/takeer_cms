<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_staffs', function (Blueprint $table) {
            $table->string('display_name')->nullable()->after('job_title');
            $table->string('avatar_url')->nullable()->after('display_name');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_staffs', function (Blueprint $table) {
            $table->dropColumn(['display_name', 'avatar_url']);
        });
    }
};
