<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('product_categories', 'localized_labels')) {
            return;
        }

        Schema::table('product_categories', function (Blueprint $table) {
            $table->json('localized_labels')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('product_categories', 'localized_labels')) {
            return;
        }

        Schema::table('product_categories', function (Blueprint $table) {
            $table->dropColumn('localized_labels');
        });
    }
};
