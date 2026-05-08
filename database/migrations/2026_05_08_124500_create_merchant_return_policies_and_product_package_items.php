<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_return_policies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('policy', 40)->default('standard');
            $table->unsignedSmallInteger('window_days')->nullable();
            $table->text('note')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['merchant_id', 'is_default']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('return_policy_id')
                ->nullable()
                ->after('package_contents')
                ->constrained('merchant_return_policies')
                ->nullOnDelete();
            $table->json('package_content_items')->nullable()->after('package_contents');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('package_content_items');
            $table->dropConstrainedForeignId('return_policy_id');
        });

        Schema::dropIfExists('merchant_return_policies');
    }
};
