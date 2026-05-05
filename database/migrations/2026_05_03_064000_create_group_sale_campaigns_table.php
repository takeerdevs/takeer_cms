<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_group_sale_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->decimal('campaign_price', 12, 2);
            $table->decimal('regular_price', 12, 2)->nullable();
            $table->unsignedInteger('goal_quantity');
            $table->unsignedInteger('reserved_quantity')->default(0);
            $table->unsignedInteger('converted_quantity')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at');
            $table->enum('status', ['draft', 'active', 'successful', 'expired', 'cancelled'])->default('draft');
            $table->boolean('allow_sms_updates')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['product_id', 'status']);
        });

        Schema::create('merchant_group_sale_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained('merchant_group_sale_campaigns')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->enum('status', ['joined', 'notified', 'converted', 'cancelled'])->default('joined');
            $table->boolean('wants_sms_updates')->default(true);
            $table->foreignId('converted_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->index(['campaign_id', 'status']);
            $table->index(['phone', 'campaign_id']);
            $table->index(['user_id', 'campaign_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_group_sale_participants');
        Schema::dropIfExists('merchant_group_sale_campaigns');
    }
};
