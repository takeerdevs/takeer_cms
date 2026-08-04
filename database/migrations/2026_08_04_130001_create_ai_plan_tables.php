<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_plans', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->string('currency_code', 3)->default('TZS');
            $table->string('billing_interval')->default('monthly');
            $table->decimal('included_credits', 16, 4)->default(0);
            $table->boolean('overage_allowed')->default(false);
            $table->decimal('overage_credit_price', 12, 4)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(100);
            $table->timestamps();
        });

        Schema::create('ai_plan_limits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_plan_id')->constrained('ai_plans')->cascadeOnDelete();
            $table->string('task_key');
            $table->decimal('included_units', 16, 4)->nullable();
            $table->decimal('credit_cost_override', 12, 4)->nullable();
            $table->string('period')->default('billing_period');
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();

            $table->unique(['ai_plan_id', 'task_key']);
            $table->index(['task_key', 'is_enabled']);
        });

        Schema::create('user_ai_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('ai_plan_id')->constrained('ai_plans')->restrictOnDelete();
            $table->string('status')->default('active');
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['source_type', 'source_id']);
        });

        DB::table('ai_plans')->insert([
            'key' => 'free',
            'name' => 'AI Free',
            'description' => 'A small free allowance for trying Takeer AI features.',
            'price' => 0,
            'currency_code' => 'TZS',
            'billing_interval' => 'monthly',
            'included_credits' => 0,
            'overage_allowed' => false,
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('user_ai_subscriptions');
        Schema::dropIfExists('ai_plan_limits');
        Schema::dropIfExists('ai_plans');
    }
};
