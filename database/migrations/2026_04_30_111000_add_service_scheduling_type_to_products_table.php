<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('service_scheduling_type')->default('none')->after('service_mode');
        });

        DB::table('products')
            ->where('type', 'service')
            ->where('service_mode', 'book_appointment')
            ->update(['service_scheduling_type' => 'recurring']);

        DB::table('products')
            ->where('type', 'service')
            ->where('service_mode', 'external_booking')
            ->update(['service_scheduling_type' => 'external']);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('service_scheduling_type');
        });
    }
};
