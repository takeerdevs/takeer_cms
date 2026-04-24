<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('bundle_items', function (Blueprint $table) {
            $table->foreignId('selected_variant_id')
                ->nullable()
                ->after('item_id')
                ->constrained('product_variants')
                ->nullOnDelete();
            $table->json('selected_variant_snapshot')
                ->nullable()
                ->after('selected_variant_id');
            $table->index('selected_variant_id');
        });
    }

    public function down(): void
    {
        Schema::table('bundle_items', function (Blueprint $table) {
            $table->dropIndex(['selected_variant_id']);
            $table->dropConstrainedForeignId('selected_variant_id');
            $table->dropColumn('selected_variant_snapshot');
        });
    }
};
