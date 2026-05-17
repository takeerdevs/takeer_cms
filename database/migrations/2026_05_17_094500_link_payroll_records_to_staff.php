<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('retail_payroll_records', function (Blueprint $table) {
            $table->foreignId('merchant_staff_id')
                ->nullable()
                ->after('user_id')
                ->constrained('merchant_staffs')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('retail_payroll_records', function (Blueprint $table) {
            $table->dropConstrainedForeignId('merchant_staff_id');
        });
    }
};
