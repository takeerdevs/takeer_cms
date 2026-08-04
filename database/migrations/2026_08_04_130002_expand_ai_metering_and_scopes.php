<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_plans', function (Blueprint $table) {
            $table->string('scope_type')->default('user')->after('key');
            $table->string('feature_group')->nullable()->after('description');
            $table->index(['scope_type', 'is_active']);
        });

        Schema::create('ai_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_plan_id')->constrained('ai_plans')->restrictOnDelete();
            $table->string('scope_type')->default('user');
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->cascadeOnDelete();
            $table->string('status')->default('active');
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['scope_type', 'user_id', 'status']);
            $table->index(['scope_type', 'merchant_id', 'status']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::table('ai_credit_accounts', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->change();
            $table->foreignId('merchant_id')->nullable()->after('user_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('scope_type')->default('user')->after('merchant_id');
            $table->index(['merchant_id', 'scope_type']);
            $table->unique('merchant_id');
        });

        Schema::table('ai_usage_records', function (Blueprint $table) {
            $table->string('scope_type')->default('user')->after('user_id');
            $table->foreignId('merchant_id')->nullable()->after('scope_type')->constrained('merchants')->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->after('merchant_id')->constrained('users')->nullOnDelete();
            $table->string('provider_key')->nullable()->after('ai_provider_id');
            $table->string('model_key')->nullable()->after('ai_model_id');
            $table->string('credential_hint', 16)->nullable()->after('model_key');
            $table->string('route_version')->nullable()->after('task_key');
            $table->unsignedSmallInteger('attempt_number')->default(1)->after('status');
            $table->string('fallback_reason')->nullable()->after('attempt_number');
            $table->decimal('billable_units', 16, 4)->default(1)->after('output_units');
            $table->string('unit_type')->default('request')->after('billable_units');
            $table->decimal('input_rate_per_million', 16, 8)->nullable()->after('provider_cost');
            $table->decimal('output_rate_per_million', 16, 8)->nullable()->after('input_rate_per_million');
            $table->string('pricing_source')->nullable()->after('output_rate_per_million');
            $table->string('provider_cost_currency', 3)->default('USD')->after('pricing_source');
            $table->unsignedInteger('latency_ms')->nullable()->after('completed_at');
            $table->string('error_code')->nullable()->after('latency_ms');
            $table->text('error_message')->nullable()->after('error_code');

            $table->index(['task_key', 'created_at']);
            $table->index(['model_key', 'created_at']);
            $table->index(['scope_type', 'merchant_id', 'created_at']);
            $table->index(['scope_type', 'user_id', 'created_at']);
        });

        Schema::table('ai_credit_transactions', function (Blueprint $table) {
            $table->string('scope_type')->default('user')->after('user_id');
            $table->foreignId('merchant_id')->nullable()->after('scope_type')->constrained('merchants')->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->after('merchant_id')->constrained('users')->nullOnDelete();
            $table->index(['scope_type', 'merchant_id', 'created_at']);
            $table->index(['scope_type', 'user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('ai_credit_transactions', function (Blueprint $table) {
            $table->dropIndex(['scope_type', 'merchant_id', 'created_at']);
            $table->dropIndex(['scope_type', 'user_id', 'created_at']);
            $table->dropForeign(['merchant_id']);
            $table->dropColumn(['scope_type', 'merchant_id', 'actor_user_id']);
        });

        Schema::table('ai_usage_records', function (Blueprint $table) {
            $table->dropIndex(['task_key', 'created_at']);
            $table->dropIndex(['model_key', 'created_at']);
            $table->dropIndex(['scope_type', 'merchant_id', 'created_at']);
            $table->dropIndex(['scope_type', 'user_id', 'created_at']);
            $table->dropForeign(['merchant_id']);
            $table->dropForeign(['actor_user_id']);
            $table->dropColumn([
                'scope_type', 'merchant_id', 'actor_user_id', 'provider_key', 'model_key',
                'credential_hint', 'route_version', 'attempt_number', 'fallback_reason',
                'billable_units', 'unit_type', 'input_rate_per_million',
                'output_rate_per_million', 'pricing_source', 'provider_cost_currency',
                'latency_ms', 'error_code', 'error_message',
            ]);
        });

        Schema::table('ai_credit_accounts', function (Blueprint $table) {
            $table->dropUnique(['merchant_id']);
            $table->dropIndex(['merchant_id', 'scope_type']);
            $table->dropForeign(['merchant_id']);
            $table->dropColumn(['merchant_id', 'scope_type']);
            $table->foreignId('user_id')->nullable(false)->change();
        });

        Schema::dropIfExists('ai_subscriptions');

        Schema::table('ai_plans', function (Blueprint $table) {
            $table->dropIndex(['scope_type', 'is_active']);
            $table->dropColumn(['scope_type', 'feature_group']);
        });
    }
};
