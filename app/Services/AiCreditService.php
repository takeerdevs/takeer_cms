<?php

namespace App\Services;

use App\Models\AiCreditAccount;
use App\Models\AiCreditAllocation;
use App\Models\AiCreditGrant;
use App\Models\AiCreditTransaction;
use App\Models\AiPlan;
use App\Models\AiSubscription;
use App\Models\AiTaskRoute;
use App\Models\AiUsageRecord;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Carbon\CarbonInterface;

class AiCreditService
{
    public function accountFor(User $user): AiCreditAccount
    {
        return $this->accountForScope('user', $user->id);
    }

    public function accountForMerchant(Merchant $merchant): AiCreditAccount
    {
        return $this->accountForScope('merchant', $merchant->id);
    }

    /**
     * Add credits to a personal user wallet. The idempotency key is also the
     * audit trail for grants made by subscriptions, payments, or admins.
     */
    public function credit(User $user, float $amount, string $idempotencyKey, array $metadata = []): AiCreditTransaction
    {
        return $this->creditScope('user', $user->id, $amount, $idempotencyKey, $metadata, $user->id);
    }

    public function creditMerchant(Merchant $merchant, float $amount, string $idempotencyKey, array $metadata = [], ?int $actorUserId = null): AiCreditTransaction
    {
        return $this->creditScope('merchant', $merchant->id, $amount, $idempotencyKey, $metadata, $actorUserId);
    }

    public function reserve(User $user, float $amount, string $idempotencyKey, ?string $taskKey = null): AiCreditTransaction
    {
        return $this->reserveScope('user', $user->id, $amount, $idempotencyKey, $taskKey, $user->id);
    }

    public function reserveForMerchant(Merchant $merchant, float $amount, string $idempotencyKey, ?string $taskKey = null, ?int $actorUserId = null): AiCreditTransaction
    {
        return $this->reserveScope('merchant', $merchant->id, $amount, $idempotencyKey, $taskKey, $actorUserId);
    }

    /**
     * Return the decision the UI needs before it starts a billable AI task.
     * This method never throws for a missing subscription or balance.
     */
    public function accessFor(?User $user, string $taskKey, ?Merchant $merchant = null): array
    {
        $scopeType = $merchant ? 'merchant' : 'user';
        $ownerId = $merchant?->id ?? $user?->id;
        $actorUserId = $user?->id;

        if (! $ownerId) {
            return $this->denied($taskKey, 'authentication_required', $scopeType, null);
        }

        $route = AiTaskRoute::query()->where('task_key', $taskKey)->first();
        if (! $route || ! $route->is_active) {
            return $this->denied($taskKey, 'feature_unavailable', $scopeType, $ownerId);
        }

        $subscription = $this->currentSubscription($scopeType, $ownerId);
        if (! $subscription) {
            return $this->denied($taskKey, 'subscription_required', $scopeType, $ownerId, [
                'subscribe_url' => '/ai/plans?task='.$taskKey,
                'free_claim' => $scopeType === 'user' ? $this->freeClaimSummary($user, $taskKey) : null,
            ]);
        }

        $this->ensureSubscriptionCredits($subscription, $scopeType, $ownerId, $actorUserId);
        $subscription->loadMissing('plan');
        $plan = $subscription->plan;
        $limit = $plan?->limits()->where('task_key', $taskKey)->first();

        // Once a plan has explicit task limits, an omitted task is excluded.
        // A plan with no limits remains an intentionally broad credit wallet.
        if (! $limit && $plan?->limits()->exists()) {
            return $this->denied($taskKey, 'feature_not_in_plan', $scopeType, $ownerId, [
                'plan' => $this->planSummary($plan),
            ]);
        }

        if ($limit && ! $limit->is_enabled) {
            return $this->denied($taskKey, 'feature_not_in_plan', $scopeType, $ownerId, [
                'plan' => $this->planSummary($plan),
            ]);
        }

        [$periodStart, $periodEnd] = match ($limit?->period) {
            'daily' => [now()->startOfDay(), now()->endOfDay()],
            'monthly' => [now()->startOfMonth(), now()->endOfMonth()],
            default => [
                $subscription->current_period_start ?: now()->startOfMonth(),
                $subscription->current_period_end ?: now()->endOfMonth(),
            ],
        };
        $usedUnits = (float) AiUsageRecord::query()
            ->where('scope_type', $scopeType)
            ->when($scopeType === 'user', fn ($query) => $query->where('user_id', $ownerId))
            ->when($scopeType === 'merchant', fn ($query) => $query->where('merchant_id', $ownerId))
            ->where('task_key', $taskKey)
            ->where('status', 'completed')
            ->whereBetween('created_at', [$periodStart, $periodEnd])
            ->sum('billable_units');

        $includedUnits = $limit?->included_units;
        if ($includedUnits !== null && $usedUnits >= (float) $includedUnits && ! $plan->overage_allowed) {
            return $this->denied($taskKey, 'allowance_exhausted', $scopeType, $ownerId, [
                'plan' => $this->planSummary($plan),
                'included_units' => (float) $includedUnits,
                'used_units' => $usedUnits,
                'reset_at' => $subscription->current_period_end?->toISOString(),
                'free_claim' => $scopeType === 'user' ? $this->freeClaimSummary($user, $taskKey) : null,
            ]);
        }

        $cost = $limit?->credit_cost_override !== null
            ? (float) $limit->credit_cost_override
            : (float) $route->credit_cost;
        $account = $scopeType === 'merchant'
            ? $this->accountForScope('merchant', $ownerId)
            : $this->accountForScope('user', $ownerId);
        $this->expireCredits($account);
        $account->refresh();

        if ((float) $account->balance < $cost) {
            return $this->denied($taskKey, 'credits_required', $scopeType, $ownerId, [
                'plan' => $this->planSummary($plan),
                'available_credits' => (float) $account->balance,
                'required_credits' => $cost,
                'top_up_url' => '/ai/credits?task='.$taskKey,
                'reset_at' => $subscription->current_period_end?->toISOString(),
                'free_claim' => $scopeType === 'user' ? $this->freeClaimSummary($user, $taskKey) : null,
            ]);
        }

        return [
            'allowed' => true,
            'reason' => null,
            'task_key' => $taskKey,
            'scope_type' => $scopeType,
            'scope_id' => $ownerId,
            'actor_user_id' => $actorUserId,
            'plan' => $this->planSummary($plan),
            'available_credits' => (float) $account->balance,
            'required_credits' => $cost,
            'used_units' => $usedUnits,
            'included_units' => $includedUnits !== null ? (float) $includedUnits : null,
            'unit_type' => $this->unitType($taskKey),
            'expires_at' => $subscription->current_period_end?->toISOString(),
        ];
    }

    /**
     * Claim the active user free plan for the current calendar window.
     *
     * The claim key is unique and the plan row is locked for the duration of
     * the transaction, so repeated or concurrent requests can never create a
     * second subscription or credit grant for the same window.
     */
    public function claimFreePlan(User $user, string $taskKey = 'ai_search'): array
    {
        $result = DB::transaction(function () use ($user, $taskKey): array {
            $plan = AiPlan::query()
                ->where('key', 'free')
                ->where('scope_type', 'user')
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if (! $plan) {
                return ['status' => 'unavailable', 'reason' => 'free_plan_unavailable'];
            }

            $limit = $plan->limits()->where('task_key', $taskKey)->first();
            $creditAmount = (float) $plan->included_credits;
            if ($creditAmount <= 0 || ($plan->limits()->exists() && (! $limit || ! $limit->is_enabled))) {
                return ['status' => 'unavailable', 'reason' => 'free_plan_not_configured'];
            }

            $currentSubscription = $this->currentSubscription('user', $user->id);
            if ($currentSubscription) {
                return [
                    'status' => $currentSubscription->plan?->key === 'free' ? 'already_claimed' : 'active_subscription',
                    'subscription' => $currentSubscription,
                ];
            }

            [$periodStart, $periodEnd] = $this->planWindow($plan);
            $claimKey = $this->freeClaimKey($user->id, $plan->id, $periodStart, $plan->claim_frequency);
            $existing = AiSubscription::query()
                ->with('plan')
                ->where('claim_key', $claimKey)
                ->lockForUpdate()
                ->first();
            if ($existing) {
                return ['status' => 'already_claimed', 'subscription' => $existing];
            }

            $subscription = AiSubscription::create([
                'ai_plan_id' => $plan->id,
                'scope_type' => 'user',
                'user_id' => $user->id,
                'status' => 'active',
                'current_period_start' => $periodStart,
                'current_period_end' => $periodEnd,
                'source_type' => 'free_claim',
                'claim_key' => $claimKey,
                'metadata' => [
                    'claim_window' => $plan->claim_frequency,
                    'task_key' => $taskKey,
                    'claimed_at' => now()->toISOString(),
                ],
            ]);

            $credit = $this->ensureSubscriptionCredits(
                $subscription->load('plan'),
                'user',
                $user->id,
                $user->id,
            );

            return [
                'status' => 'claimed',
                'subscription' => $subscription->fresh('plan'),
                'credit' => $credit,
            ];
        });

        $access = $this->accessFor($user, $taskKey);

        return [
            'status' => $result['status'],
            'reason' => $result['reason'] ?? null,
            'claimed' => $result['status'] === 'claimed',
            'already_claimed' => $result['status'] === 'already_claimed',
            'credits_granted' => (float) (($result['credit'] ?? null)?->amount ?? 0),
            'expires_at' => (($result['subscription'] ?? null)?->current_period_end?->toISOString()),
            'access' => $access,
        ];
    }

    /**
     * Describe whether the user can claim the free plan now. This is returned
     * with denied access so the UI can offer a claim without guessing plan
     * state from the admin screen.
     */
    public function freeClaimSummary(?User $user, string $taskKey = 'ai_search'): ?array
    {
        if (! $user) {
            return null;
        }

        $plan = AiPlan::query()
            ->with('limits')
            ->where('key', 'free')
            ->where('scope_type', 'user')
            ->where('is_active', true)
            ->first();
        if (! $plan) {
            return null;
        }

        [$periodStart, $periodEnd] = $this->planWindow($plan);
        $claimKey = $this->freeClaimKey($user->id, $plan->id, $periodStart, $plan->claim_frequency);
        $claim = AiSubscription::query()->where('claim_key', $claimKey)->first();
        $current = $this->currentSubscription('user', $user->id);
        $limit = $plan->limits->firstWhere('task_key', $taskKey);

        $reason = null;
        if ((float) $plan->included_credits <= 0 || ($plan->limits->isNotEmpty() && (! $limit || ! $limit->is_enabled))) {
            $reason = 'free_plan_not_configured';
        } elseif ($claim || $current) {
            $reason = $current?->plan?->key === 'free' || $claim ? 'already_claimed' : 'active_subscription';
        }

        return [
            'available' => $reason !== 'free_plan_not_configured',
            'can_claim' => $reason === null,
            'reason' => $reason,
            'plan' => $this->planSummary($plan),
            'credits' => (float) $plan->included_credits,
            'window_start' => $periodStart?->toISOString(),
            'window_end' => $periodEnd?->toISOString(),
            'next_reset_at' => $periodEnd?->copy()->addSecond()->toISOString(),
            'frequency' => $plan->claim_frequency ?: 'monthly',
            'claim_url' => '/api/ai/claim-free',
        ];
    }

    public function reserveTask(User $user, string $taskKey, string $idempotencyKey, ?Merchant $merchant = null): AiCreditTransaction
    {
        $access = $this->accessFor($user, $taskKey, $merchant);
        if (! $access['allowed']) {
            throw new \RuntimeException($this->accessMessage($access));
        }

        return $merchant
            ? $this->reserveForMerchant($merchant, (float) $access['required_credits'], $idempotencyKey, $taskKey, $user->id)
            : $this->reserve($user, (float) $access['required_credits'], $idempotencyKey, $taskKey);
    }

    public function settle(AiCreditTransaction $reservation, ?AiUsageRecord $usage = null): AiCreditTransaction
    {
        return DB::transaction(function () use ($reservation, $usage) {
            $reservation = AiCreditTransaction::query()->lockForUpdate()->findOrFail($reservation->id);
            $existing = AiCreditTransaction::query()->where('idempotency_key', 'settle:'.$reservation->id)->first();
            if ($existing) {
                return $existing;
            }
            if (AiCreditTransaction::query()->where('idempotency_key', 'release:'.$reservation->id)->exists()) {
                throw new \RuntimeException('This AI credit reservation has already been released.');
            }

            $account = AiCreditAccount::query()->lockForUpdate()->findOrFail($reservation->ai_credit_account_id);
            $amount = (float) $reservation->amount;
            $account->reserved_balance = max(0, (float) $account->reserved_balance - $amount);
            $account->save();

            foreach (AiCreditAllocation::query()->where('ai_credit_transaction_id', $reservation->id)->get() as $allocation) {
                $grant = AiCreditGrant::query()->lockForUpdate()->find($allocation->ai_credit_grant_id);
                if (! $grant) {
                    continue;
                }
                $grant->reserved_amount = max(0, (float) $grant->reserved_amount - (float) $allocation->amount);
                $grant->save();
            }

            $transaction = AiCreditTransaction::create([
                'user_id' => $reservation->user_id,
                'scope_type' => $reservation->scope_type,
                'merchant_id' => $reservation->merchant_id,
                'actor_user_id' => $reservation->actor_user_id,
                'ai_credit_account_id' => $account->id,
                'ai_usage_record_id' => $usage?->id,
                'transaction_type' => 'debit',
                'amount' => $amount,
                'balance_after' => $account->balance,
                'task_key' => $reservation->task_key,
                'idempotency_key' => 'settle:'.$reservation->id,
            ]);

            if ($usage) {
                $usage->forceFill(['charged_credits' => $amount])->save();
            }

            return $transaction;
        });
    }

    public function release(AiCreditTransaction $reservation, array $metadata = []): AiCreditTransaction
    {
        return DB::transaction(function () use ($reservation, $metadata) {
            $reservation = AiCreditTransaction::query()->lockForUpdate()->findOrFail($reservation->id);
            $existing = AiCreditTransaction::query()->where('idempotency_key', 'release:'.$reservation->id)->first();
            if ($existing) {
                return $existing;
            }
            $settled = AiCreditTransaction::query()->where('idempotency_key', 'settle:'.$reservation->id)->first();
            if ($settled) {
                return $settled;
            }

            $account = AiCreditAccount::query()->lockForUpdate()->findOrFail($reservation->ai_credit_account_id);
            $amount = (float) $reservation->amount;
            $account->reserved_balance = max(0, (float) $account->reserved_balance - $amount);

            $restoredAmount = 0.0;
            foreach (AiCreditAllocation::query()->where('ai_credit_transaction_id', $reservation->id)->get() as $allocation) {
                $grant = AiCreditGrant::query()->lockForUpdate()->find($allocation->ai_credit_grant_id);
                if (! $grant) {
                    continue;
                }
                $allocatedAmount = (float) $allocation->amount;
                $grant->reserved_amount = max(0, (float) $grant->reserved_amount - $allocatedAmount);
                if (! $grant->expires_at || $grant->expires_at->isFuture()) {
                    $grant->remaining_amount = (float) $grant->remaining_amount + $allocatedAmount;
                    $restoredAmount += $allocatedAmount;
                } elseif ((float) $grant->reserved_amount <= 0) {
                    $grant->status = 'expired';
                }
                $grant->save();
            }

            $account->balance = (float) $account->balance + $restoredAmount;
            $account->save();

            return AiCreditTransaction::create([
                'user_id' => $reservation->user_id,
                'scope_type' => $reservation->scope_type,
                'merchant_id' => $reservation->merchant_id,
                'actor_user_id' => $reservation->actor_user_id,
                'ai_credit_account_id' => $account->id,
                'transaction_type' => 'release',
                'amount' => $amount,
                'balance_after' => $account->balance,
                'task_key' => $reservation->task_key,
                'idempotency_key' => 'release:'.$reservation->id,
                'metadata' => $metadata,
            ]);
        });
    }

    private function creditScope(string $scopeType, int $ownerId, float $amount, string $idempotencyKey, array $metadata = [], ?int $actorUserId = null, ?CarbonInterface $expiresAt = null): AiCreditTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Credit amount must be greater than zero.');
        }

        return DB::transaction(function () use ($scopeType, $ownerId, $amount, $idempotencyKey, $metadata, $actorUserId, $expiresAt) {
            $existing = AiCreditTransaction::query()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }

            $account = $this->accountForScope($scopeType, $ownerId, true);
            $this->expireExpiredGrants($account);

            $grant = AiCreditGrant::query()->where('grant_key', $idempotencyKey)->lockForUpdate()->first();
            if ($grant) {
                return AiCreditTransaction::query()->where('idempotency_key', $idempotencyKey)->firstOrFail();
            }

            $grant = AiCreditGrant::create([
                'ai_credit_account_id' => $account->id,
                'user_id' => $scopeType === 'user' ? $ownerId : null,
                'merchant_id' => $scopeType === 'merchant' ? $ownerId : null,
                'scope_type' => $scopeType,
                'grant_key' => $idempotencyKey,
                'source_type' => $metadata['source'] ?? 'manual',
                'source_id' => $metadata['subscription_id'] ?? $metadata['source_id'] ?? null,
                'amount' => $amount,
                'remaining_amount' => $amount,
                'reserved_amount' => 0,
                'expires_at' => $expiresAt,
                'status' => 'active',
                'metadata' => $metadata,
            ]);

            $account->balance = (float) $account->balance + $amount;
            $account->save();

            return AiCreditTransaction::create([
                'user_id' => $scopeType === 'user' ? $ownerId : null,
                'scope_type' => $scopeType,
                'merchant_id' => $scopeType === 'merchant' ? $ownerId : null,
                'actor_user_id' => $actorUserId,
                'ai_credit_account_id' => $account->id,
                'ai_credit_grant_id' => $grant->id,
                'transaction_type' => 'credit',
                'amount' => $amount,
                'balance_after' => $account->balance,
                'idempotency_key' => $idempotencyKey,
                'expires_at' => $expiresAt,
                'metadata' => $metadata,
            ]);
        });
    }

    private function reserveScope(string $scopeType, int $ownerId, float $amount, string $idempotencyKey, ?string $taskKey = null, ?int $actorUserId = null): AiCreditTransaction
    {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Reserved credit amount must be greater than zero.');
        }

        return DB::transaction(function () use ($scopeType, $ownerId, $amount, $idempotencyKey, $taskKey, $actorUserId) {
            $existing = AiCreditTransaction::query()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }

            $account = $this->accountForScope($scopeType, $ownerId, true);
            $this->expireExpiredGrants($account);
            $this->ensureLegacyGrantBalance($account);
            if ((float) $account->balance < $amount) {
                throw new \RuntimeException('Insufficient AI credits.');
            }

            $grants = AiCreditGrant::query()
                ->where('ai_credit_account_id', $account->id)
                ->where('status', 'active')
                ->where('remaining_amount', '>', 0)
                ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                ->orderByRaw('expires_at IS NULL ASC')
                ->orderBy('expires_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            if ($grants->sum(fn (AiCreditGrant $grant) => (float) $grant->remaining_amount) < $amount) {
                throw new \RuntimeException('AI credit grants are out of sync with the wallet.');
            }

            $account->balance = (float) $account->balance - $amount;
            $account->reserved_balance = (float) $account->reserved_balance + $amount;
            $account->save();

            $reservation = AiCreditTransaction::create([
                'user_id' => $scopeType === 'user' ? $ownerId : null,
                'scope_type' => $scopeType,
                'merchant_id' => $scopeType === 'merchant' ? $ownerId : null,
                'actor_user_id' => $actorUserId,
                'ai_credit_account_id' => $account->id,
                'transaction_type' => 'reserve',
                'amount' => $amount,
                'balance_after' => $account->balance,
                'task_key' => $taskKey,
                'idempotency_key' => $idempotencyKey,
            ]);

            $remaining = $amount;
            foreach ($grants as $grant) {
                if ($remaining <= 0) {
                    break;
                }
                $allocatedAmount = min($remaining, (float) $grant->remaining_amount);
                $grant->remaining_amount = (float) $grant->remaining_amount - $allocatedAmount;
                $grant->reserved_amount = (float) $grant->reserved_amount + $allocatedAmount;
                $grant->save();
                AiCreditAllocation::create([
                    'ai_credit_transaction_id' => $reservation->id,
                    'ai_credit_grant_id' => $grant->id,
                    'amount' => $allocatedAmount,
                ]);
                $remaining -= $allocatedAmount;
            }

            return $reservation;
        });
    }

    private function accountForScope(string $scopeType, int $ownerId, bool $lock = false): AiCreditAccount
    {
        $query = AiCreditAccount::query();
        if ($scopeType === 'merchant') {
            $query->where('merchant_id', $ownerId);
        } else {
            $query->where('user_id', $ownerId);
        }

        $account = $lock ? $query->lockForUpdate()->first() : $query->first();
        if ($account) {
            return $account;
        }

        return AiCreditAccount::create([
            'user_id' => $scopeType === 'user' ? $ownerId : null,
            'merchant_id' => $scopeType === 'merchant' ? $ownerId : null,
            'scope_type' => $scopeType,
            'balance' => 0,
            'reserved_balance' => 0,
        ]);
    }

    private function currentSubscription(string $scopeType, int $ownerId): ?AiSubscription
    {
        $subscription = AiSubscription::query()
            ->with('plan.limits')
            ->where('scope_type', $scopeType)
            ->where('status', 'active')
            ->when($scopeType === 'user', fn ($query) => $query->where('user_id', $ownerId))
            ->when($scopeType === 'merchant', fn ($query) => $query->where('merchant_id', $ownerId))
            ->latest('id')
            ->get()
            ->first(fn (AiSubscription $item) => $item->isCurrent() && $item->plan?->is_active);

        if ($subscription || $scopeType !== 'user') {
            return $subscription;
        }

        // Keep installations that created the original user-only table usable
        // until their subscriptions are migrated into the scoped table.
        $legacy = \App\Models\UserAiSubscription::query()
            ->with('plan.limits')
            ->where('user_id', $ownerId)
            ->where('status', 'active')
            ->latest('id')
            ->get()
            ->first(fn ($item) => (! $item->current_period_start || $item->current_period_start->isPast())
                && (! $item->current_period_end || $item->current_period_end->isFuture())
                && $item->plan?->is_active);

        if (! $legacy) {
            return null;
        }

        return AiSubscription::make([
            'id' => $legacy->id,
            'ai_plan_id' => $legacy->ai_plan_id,
            'scope_type' => 'user',
            'user_id' => $legacy->user_id,
            'status' => $legacy->status,
            'current_period_start' => $legacy->current_period_start,
            'current_period_end' => $legacy->current_period_end,
        ])->setRelation('plan', $legacy->plan);
    }

    private function ensureSubscriptionCredits(AiSubscription $subscription, string $scopeType, int $ownerId, ?int $actorUserId): ?AiCreditTransaction
    {
        $amount = (float) ($subscription->plan?->included_credits ?? 0);
        if ($amount <= 0) {
            return null;
        }

        $period = $subscription->current_period_start?->format('Y-m-d') ?: 'lifetime';
        $key = 'subscription:'.$scopeType.':'.$subscription->id.':'.$period;
        $metadata = [
            'source' => 'ai_subscription',
            'subscription_id' => $subscription->id,
            'plan_id' => $subscription->ai_plan_id,
            'period_start' => $subscription->current_period_start?->toISOString(),
            'period_end' => $subscription->current_period_end?->toISOString(),
        ];

        return $this->creditScope($scopeType, $ownerId, $amount, $key, $metadata, $actorUserId, $subscription->current_period_end);
    }

    /**
     * Remove unreserved credit lots whose entitlement window has ended.
     * Reserved work is allowed to finish; a failed request can then release
     * into an already-expired lot without bringing the credits back.
     */
    private function expireCredits(AiCreditAccount $account): void
    {
        DB::transaction(function () use ($account): void {
            $locked = AiCreditAccount::query()->lockForUpdate()->find($account->id);
            if ($locked) {
                $this->expireExpiredGrants($locked);
            }
        });
    }

    private function expireExpiredGrants(AiCreditAccount $account): void
    {
        $grants = AiCreditGrant::query()
            ->where('ai_credit_account_id', $account->id)
            ->where('status', 'active')
            ->where('remaining_amount', '>', 0)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->where('reserved_amount', 0)
            ->lockForUpdate()
            ->get();

        foreach ($grants as $grant) {
            $amount = (float) $grant->remaining_amount;
            if ($amount <= 0) {
                continue;
            }

            $account->balance = max(0, (float) $account->balance - $amount);
            $grant->forceFill([
                'remaining_amount' => 0,
                'status' => 'expired',
            ])->save();

            AiCreditTransaction::firstOrCreate(
                ['idempotency_key' => 'expire:grant:'.$grant->id],
                [
                    'user_id' => $grant->user_id,
                    'scope_type' => $grant->scope_type,
                    'merchant_id' => $grant->merchant_id,
                    'ai_credit_account_id' => $account->id,
                    'ai_credit_grant_id' => $grant->id,
                    'transaction_type' => 'expire',
                    'amount' => $amount,
                    'balance_after' => max(0, (float) $account->balance),
                    'expires_at' => $grant->expires_at,
                    'idempotency_key' => 'expire:grant:'.$grant->id,
                    'metadata' => ['reason' => 'grant_expired'],
                ],
            );
        }

        $account->save();
    }

    /**
     * Accounts created before grant-level accounting can still contain a
     * balance with no matching lot. Fold that difference into a permanent
     * compatibility grant before allocating a reservation.
     */
    private function ensureLegacyGrantBalance(AiCreditAccount $account): void
    {
        $tracked = (float) AiCreditGrant::query()
            ->where('ai_credit_account_id', $account->id)
            ->where('status', 'active')
            ->sum('remaining_amount');
        $gap = (float) $account->balance - $tracked;
        if ($gap <= 0) {
            return;
        }

        $grant = AiCreditGrant::query()
            ->where('ai_credit_account_id', $account->id)
            ->where('grant_key', 'legacy-account:'.$account->id)
            ->lockForUpdate()
            ->first();
        if ($grant) {
            $grant->amount = (float) $grant->amount + $gap;
            $grant->remaining_amount = (float) $grant->remaining_amount + $gap;
            $grant->save();
            return;
        }

        AiCreditGrant::create([
            'ai_credit_account_id' => $account->id,
            'user_id' => $account->user_id,
            'merchant_id' => $account->merchant_id,
            'scope_type' => $account->scope_type,
            'grant_key' => 'legacy-account:'.$account->id,
            'source_type' => 'legacy_balance',
            'amount' => $gap,
            'remaining_amount' => $gap,
            'reserved_amount' => 0,
            'status' => 'active',
            'metadata' => ['reason' => 'balance_reconciliation'],
        ]);
    }

    private function planWindow(AiPlan $plan): array
    {
        return match ($plan->claim_frequency ?: 'monthly') {
            'once' => [now(), null],
            'daily' => [now()->startOfDay(), now()->endOfDay()],
            'weekly' => [now()->startOfWeek(), now()->endOfWeek()],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };
    }

    private function freeClaimKey(int $userId, int $planId, ?CarbonInterface $periodStart, ?string $frequency = null): string
    {
        $window = $frequency === 'once'
            ? 'lifetime'
            : ($periodStart?->format('Y-m-d') ?: 'lifetime');

        return 'free:user:'.$userId.':plan:'.$planId.':window:'.$window;
    }

    private function denied(string $taskKey, string $reason, string $scopeType, ?int $ownerId, array $extra = []): array
    {
        return array_merge([
            'allowed' => false,
            'reason' => $reason,
            'task_key' => $taskKey,
            'scope_type' => $scopeType,
            'scope_id' => $ownerId,
            'available_credits' => 0,
            'required_credits' => null,
            'unit_type' => $this->unitType($taskKey),
        ], $extra);
    }

    private function planSummary(?AiPlan $plan): ?array
    {
        return $plan ? [
            'id' => $plan->id,
            'key' => $plan->key,
            'name' => $plan->name,
            'scope_type' => $plan->scope_type,
            'feature_group' => $plan->feature_group,
            'claim_frequency' => $plan->claim_frequency,
        ] : null;
    }

    private function unitType(string $taskKey): string
    {
        return match ($taskKey) {
            'product_information_extraction', 'waybill_ocr' => 'document',
            'product_photo_editing', 'virtual_try_on' => 'image',
            'ai_search' => 'query',
            default => 'request',
        };
    }

    private function accessMessage(array $access): string
    {
        return match ($access['reason'] ?? null) {
            'authentication_required' => 'Sign in to use this AI feature.',
            'subscription_required' => 'An AI subscription is required for this feature.',
            'feature_not_in_plan' => 'Your AI plan does not include this feature.',
            'allowance_exhausted' => 'Your allowance for this AI feature has been used.',
            'credits_required' => 'More AI credits are required for this feature.',
            default => 'This AI feature is not available right now.',
        };
    }
}
