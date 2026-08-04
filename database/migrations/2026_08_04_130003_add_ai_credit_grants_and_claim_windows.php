<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_subscriptions', function (Blueprint $table) {
            $table->string('claim_key')->nullable()->unique()->after('source_id');
        });

        Schema::create('ai_credit_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_credit_account_id')->constrained('ai_credit_accounts')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->string('scope_type')->default('user');
            $table->string('grant_key')->unique();
            $table->string('source_type')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->decimal('amount', 16, 4);
            $table->decimal('remaining_amount', 16, 4);
            $table->decimal('reserved_amount', 16, 4)->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->string('status')->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['scope_type', 'user_id', 'status', 'expires_at']);
            $table->index(['scope_type', 'merchant_id', 'status', 'expires_at']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('ai_credit_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_credit_transaction_id')->constrained('ai_credit_transactions')->cascadeOnDelete();
            $table->foreignId('ai_credit_grant_id')->constrained('ai_credit_grants')->cascadeOnDelete();
            $table->decimal('amount', 16, 4);
            $table->timestamps();

            $table->unique(['ai_credit_transaction_id', 'ai_credit_grant_id']);
            $table->index('ai_credit_grant_id');
        });

        Schema::table('ai_credit_transactions', function (Blueprint $table) {
            $table->foreignId('ai_credit_grant_id')->nullable()->after('ai_credit_account_id')->constrained('ai_credit_grants')->nullOnDelete();
            $table->timestamp('expires_at')->nullable()->after('idempotency_key');
            $table->index(['transaction_type', 'expires_at']);
        });

        // Preserve balances created before grant-level accounting was introduced.
        // These permanent grants are only a compatibility bridge; all new credits
        // are created as their own auditable grant.
        foreach (DB::table('ai_credit_accounts')->where('balance', '>', 0)->get() as $account) {
            DB::table('ai_credit_grants')->insert([
                'ai_credit_account_id' => $account->id,
                'user_id' => $account->user_id,
                'merchant_id' => $account->merchant_id,
                'scope_type' => $account->scope_type,
                'grant_key' => 'legacy-account:'.$account->id,
                'source_type' => 'legacy_balance',
                'amount' => $account->balance,
                'remaining_amount' => $account->balance,
                'reserved_amount' => 0,
                'expires_at' => null,
                'status' => 'active',
                'metadata' => json_encode(['migrated_from_account' => $account->id]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // The seeded free plan already promises 100 AI-search units at one
        // credit per unit. Make the credit wallet match that allowance so the
        // new self-service claim works immediately on existing installations.
        $freePlanId = DB::table('ai_plans')
            ->where('key', 'free')
            ->where('scope_type', 'user')
            ->where('included_credits', 0)
            ->value('id');
        if ($freePlanId) {
            $searchLimit = DB::table('ai_plan_limits')
                ->where('ai_plan_id', $freePlanId)
                ->where('task_key', 'ai_search')
                ->first();
            $creditAmount = $searchLimit && $searchLimit->included_units !== null
                ? (float) $searchLimit->included_units * (float) ($searchLimit->credit_cost_override ?? 1)
                : 0;
            if ($creditAmount > 0) {
                DB::table('ai_plans')->where('id', $freePlanId)->update([
                    'included_credits' => $creditAmount,
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('ai_credit_transactions', function (Blueprint $table) {
            $table->dropIndex(['transaction_type', 'expires_at']);
            $table->dropForeign(['ai_credit_grant_id']);
            $table->dropColumn(['ai_credit_grant_id', 'expires_at']);
        });

        Schema::dropIfExists('ai_credit_allocations');
        Schema::dropIfExists('ai_credit_grants');

        Schema::table('ai_subscriptions', function (Blueprint $table) {
            $table->dropUnique(['claim_key']);
            $table->dropColumn('claim_key');
        });
    }
};
