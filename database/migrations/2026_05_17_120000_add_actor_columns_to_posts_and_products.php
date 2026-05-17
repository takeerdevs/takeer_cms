<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->foreignId('created_by_user_id')->nullable()->after('merchant_id')->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_staff_id')->nullable()->after('created_by_user_id')->constrained('merchant_staffs')->nullOnDelete();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('created_by_user_id')->nullable()->after('merchant_id')->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_staff_id')->nullable()->after('created_by_user_id')->constrained('merchant_staffs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by_staff_id');
            $table->dropConstrainedForeignId('created_by_user_id');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by_staff_id');
            $table->dropConstrainedForeignId('created_by_user_id');
        });
    }
};
