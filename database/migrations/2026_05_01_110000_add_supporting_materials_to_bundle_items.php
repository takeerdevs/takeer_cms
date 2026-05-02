<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bundle_items', function (Blueprint $table) {
            $table->json('supporting_materials')
                ->nullable()
                ->after('lesson_summary');
        });
    }

    public function down(): void
    {
        Schema::table('bundle_items', function (Blueprint $table) {
            $table->dropColumn('supporting_materials');
        });
    }
};
