<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_providers', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('base_url')->nullable();
            $table->string('provider_type')->default('gateway');
            $table->boolean('is_active')->default(true);
            $table->json('config')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_provider_id')->constrained('ai_providers')->cascadeOnDelete();
            $table->string('name');
            $table->text('secret');
            $table->string('key_hint', 16)->nullable();
            $table->string('status')->default('active');
            $table->unsignedSmallInteger('priority')->default(100);
            $table->unsignedSmallInteger('weight')->default(100);
            $table->unsignedInteger('failure_count')->default(0);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('last_failed_at')->nullable();
            $table->timestamp('disabled_until')->nullable();
            $table->timestamps();

            $table->index(['ai_provider_id', 'status', 'priority']);
        });

        Schema::create('ai_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_provider_id')->constrained('ai_providers')->cascadeOnDelete();
            $table->string('model_key');
            $table->string('label');
            $table->json('capabilities')->nullable();
            $table->decimal('input_cost_per_million', 16, 8)->nullable();
            $table->decimal('output_cost_per_million', 16, 8)->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('config')->nullable();
            $table->timestamps();

            $table->unique(['ai_provider_id', 'model_key']);
            $table->index(['ai_provider_id', 'is_active']);
        });

        Schema::create('ai_task_routes', function (Blueprint $table) {
            $table->id();
            $table->string('task_key')->unique();
            $table->string('label');
            $table->text('description')->nullable();
            $table->string('required_capability')->nullable();
            $table->foreignId('primary_model_id')->nullable()->constrained('ai_models')->nullOnDelete();
            $table->json('fallback_model_ids')->nullable();
            $table->decimal('credit_cost', 12, 4)->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('ai_credit_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->decimal('balance', 16, 4)->default(0);
            $table->decimal('reserved_balance', 16, 4)->default(0);
            $table->timestamps();
        });

        Schema::create('ai_usage_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('task_key');
            $table->foreignId('ai_provider_id')->nullable()->constrained('ai_providers')->nullOnDelete();
            $table->foreignId('ai_credential_id')->nullable()->constrained('ai_credentials')->nullOnDelete();
            $table->foreignId('ai_model_id')->nullable()->constrained('ai_models')->nullOnDelete();
            $table->string('provider_request_id')->nullable();
            $table->string('status')->default('started');
            $table->decimal('input_units', 16, 4)->nullable();
            $table->decimal('output_units', 16, 4)->nullable();
            $table->decimal('provider_cost', 16, 8)->nullable();
            $table->decimal('charged_credits', 16, 4)->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['task_key', 'status']);
            $table->index(['user_id', 'created_at']);
            $table->index('provider_request_id');
        });

        Schema::create('ai_credit_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ai_credit_account_id')->nullable()->constrained('ai_credit_accounts')->nullOnDelete();
            $table->foreignId('ai_usage_record_id')->nullable()->constrained('ai_usage_records')->nullOnDelete();
            $table->string('transaction_type');
            $table->decimal('amount', 16, 4);
            $table->decimal('balance_after', 16, 4)->nullable();
            $table->string('task_key')->nullable();
            $table->string('idempotency_key')->unique();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['transaction_type', 'task_key']);
        });

        $now = now();
        DB::table('ai_providers')->insert([
            'key' => 'openrouter',
            'name' => 'OpenRouter',
            'base_url' => 'https://openrouter.ai/api/v1',
            'provider_type' => 'gateway',
            'is_active' => true,
            'config' => json_encode(['supports' => ['chat', 'vision']]),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $providerId = (int) DB::table('ai_providers')->where('key', 'openrouter')->value('id');
        $legacyModel = (string) (DB::table('admin_settings')->where('key', 'openrouter_default_model')->value('value') ?: 'google/gemini-2.5-flash');
        DB::table('ai_models')->insert([
            'ai_provider_id' => $providerId,
            'model_key' => $legacyModel,
            'label' => $legacyModel,
            'capabilities' => json_encode(['text', 'vision', 'structured_output']),
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $modelId = (int) DB::table('ai_models')
            ->where('ai_provider_id', $providerId)
            ->where('model_key', $legacyModel)
            ->value('id');

        $tasks = [
            ['product_information_extraction', 'Product information extraction', 'Extract catalog data from merchant product photos.', 'vision_json', true],
            ['product_photo_editing', 'Product photo editing', 'Create or edit product imagery while preserving catalog context.', 'image_edit', true],
            ['ai_search', 'AI search', 'Convert natural language or visual searches into commerce intent.', 'vision_json', true],
            ['waybill_ocr', 'Waybill OCR', 'Extract delivery metadata from waybills and receipts.', 'vision_json', true],
            ['virtual_try_on', 'Virtual try-on', 'Place a merchant garment on a shopper portrait.', 'image_generation', false],
        ];

        foreach ($tasks as [$taskKey, $label, $description, $capability, $hasDefaultModel]) {
            DB::table('ai_task_routes')->insert([
                'task_key' => $taskKey,
                'label' => $label,
                'description' => $description,
                'required_capability' => $capability,
                'primary_model_id' => $hasDefaultModel ? $modelId : null,
                'fallback_model_ids' => json_encode([]),
                'credit_cost' => $taskKey === 'virtual_try_on' ? 5 : 1,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $legacyKey = (string) DB::table('admin_settings')->where('key', 'openrouter_api_key')->value('value');
        if ($legacyKey !== '') {
            DB::table('ai_credentials')->insert([
                'ai_provider_id' => $providerId,
                'name' => 'Migrated OpenRouter key',
                'secret' => Crypt::encryptString($legacyKey),
                'key_hint' => substr($legacyKey, -4),
                'status' => 'active',
                'priority' => 100,
                'weight' => 100,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Remove AI credentials from the generic settings bag after they have
        // been migrated to the encrypted control-plane table. The historical
        // migration remains untouched, but direct Gemini is no longer an
        // active platform provider.
        DB::table('admin_settings')
            ->whereIn('key', ['openrouter_api_key', 'gemini_api_key', 'gemini_default_model'])
            ->update(['value' => '']);
        DB::table('admin_settings')
            ->where('key', 'ai_provider')
            ->update(['value' => 'openrouter']);
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_credit_transactions');
        Schema::dropIfExists('ai_usage_records');
        Schema::dropIfExists('ai_credit_accounts');
        Schema::dropIfExists('ai_task_routes');
        Schema::dropIfExists('ai_models');
        Schema::dropIfExists('ai_credentials');
        Schema::dropIfExists('ai_providers');
    }
};
