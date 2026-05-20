<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offering_group_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offering_group_id')->constrained()->cascadeOnDelete();
            $table->string('item_type');
            $table->unsignedBigInteger('item_id');
            $table->string('section')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('role')->default('optional');
            $table->string('pricing_behavior')->default('separate');
            $table->decimal('price_override', 12, 2)->nullable();
            $table->decimal('quantity_min', 10, 3)->nullable();
            $table->decimal('quantity_max', 10, 3)->nullable();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_default_selected')->default(false);
            $table->boolean('is_orderable_alone')->default(true);
            $table->boolean('is_orderable_in_group')->default(true);
            $table->json('choice_rules')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['offering_group_id', 'section', 'sort_order']);
            $table->index(['item_type', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offering_group_items');
    }
};
