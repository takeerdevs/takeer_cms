<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offering_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_staff_id')->nullable()->constrained('merchant_staffs')->nullOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->string('group_type')->default('package');
            $table->string('template_key')->default('service_package');
            $table->string('status')->default('draft');
            $table->text('description')->nullable();
            $table->string('cover_image_url')->nullable();
            $table->string('pricing_mode')->default('sum_children');
            $table->decimal('base_price', 12, 2)->nullable();
            $table->string('checkout_mode')->default('select_items');
            $table->string('availability_mode')->default('inherit_children');
            $table->json('display_settings')->nullable();
            $table->json('checkout_rules')->nullable();
            $table->json('availability_rules')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'slug']);
            $table->index(['merchant_id', 'group_type', 'status']);
            $table->index(['merchant_id', 'template_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offering_groups');
    }
};
