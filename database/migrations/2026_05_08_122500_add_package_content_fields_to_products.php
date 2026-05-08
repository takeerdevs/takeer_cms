<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('package_content_unit_type_id')
                ->nullable()
                ->after('sellable_quantity')
                ->constrained('product_unit_types')
                ->nullOnDelete();
            $table->decimal('package_content_quantity', 12, 3)->nullable()->after('package_content_unit_type_id');
            $table->string('package_contents', 500)->nullable()->after('package_content_quantity');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('package_contents');
            $table->dropColumn('package_content_quantity');
            $table->dropConstrainedForeignId('package_content_unit_type_id');
        });
    }
};
