<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use App\Models\FeePolicy;
use App\Models\Merchant;
use App\Models\MerchantPlatformSubscription;
use App\Models\MerchantPlatformSubscriptionPayment;
use App\Models\Transaction;
use App\Services\FeePolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class MerchantPlatformSubscriptionController extends Controller
{
    public function __construct(private readonly FeePolicyService $feePolicyService)
    {
    }

    public function index(Merchant $merchant): JsonResponse
    {
        $merchant->loadMissing(['currency', 'country']);

        return response()->json([
            'merchant' => [
                'id' => $merchant->id,
                'username' => $merchant->username,
                'display_name' => $merchant->display_name,
                'currency_code' => $this->currencyCode($merchant),
                'storage_limit_mb' => (int) $merchant->storage_limit_mb,
                'storage_used_mb' => (float) $merchant->storage_used_mb,
                'active_modules' => $merchant->active_modules ?? [],
            ],
            'features' => [
                'retail_ops' => $this->featurePayload($merchant, 'retail_ops'),
                'storage' => $this->featurePayload($merchant, 'storage'),
            ],
            'payments' => MerchantPlatformSubscriptionPayment::query()
                ->where('merchant_id', $merchant->id)
                ->latest('paid_at')
                ->latest()
                ->limit(12)
                ->get()
                ->map(fn (MerchantPlatformSubscriptionPayment $payment) => $this->paymentPayload($payment))
                ->values(),
        ]);
    }

    public function startTrial(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $request->validate([
            'feature' => ['required', Rule::in(['retail_ops', 'storage'])],
            'fee_policy_id' => ['nullable', 'integer', 'exists:fee_policies,id'],
        ]);

        $feature = $data['feature'];
        if ($feature === 'retail_ops' && ! $merchant->isRetailEligible()) {
            return response()->json([
                'message' => 'Retail Operations subscriptions are only available for verified business accounts with completed business KYC.',
            ], 403);
        }

        $mode = $this->accessMode($feature);
        $trialDays = $this->trialDays($feature);

        if ($mode !== 'trial_then_paid' || $trialDays <= 0) {
            return response()->json(['message' => 'Trial access is not enabled for this feature.'], 422);
        }

        $subscription = DB::transaction(function () use ($merchant, $feature, $trialDays, $data) {
            $price = $this->priceFor($merchant, $feature, $data['fee_policy_id'] ?? null);
            if ($feature === 'storage' && $price['storage_mb'] <= (int) ceil((float) $merchant->storage_used_mb)) {
                throw ValidationException::withMessages([
                    'fee_policy_id' => 'Choose a storage plan larger than your current usage.',
                ]);
            }
            $now = now();
            $trialEndsAt = $now->copy()->addDays($trialDays);

            $subscription = MerchantPlatformSubscription::query()->create([
                'merchant_id' => $merchant->id,
                'feature' => $feature,
                'status' => 'trialing',
                'currency_code' => $price['currency_code'],
                'amount' => 0,
                'billing_interval' => $price['billing_interval'],
                'storage_mb' => $feature === 'storage' ? $price['storage_mb'] : null,
                'started_at' => $now,
                'trial_ends_at' => $trialEndsAt,
                'current_period_start' => $now,
                'current_period_end' => $trialEndsAt,
                'next_billing_at' => $trialEndsAt,
                'metadata' => [
                    'source' => 'trial',
                    'policy_snapshot' => $price['policy_snapshot'],
                ],
            ]);

            $this->applyAccess($merchant, $feature, $price['storage_mb']);

            return $subscription;
        });

        return response()->json([
            'message' => 'Trial access started.',
            'subscription' => $this->subscriptionPayload($subscription->fresh()),
            'features' => [
                'retail_ops' => $this->featurePayload($merchant->fresh(['currency', 'country']), 'retail_ops'),
                'storage' => $this->featurePayload($merchant->fresh(['currency', 'country']), 'storage'),
            ],
        ], 201);
    }

    public function simulatePayment(Request $request, Merchant $merchant): JsonResponse
    {
        $data = $request->validate([
            'feature' => ['required', Rule::in(['retail_ops', 'storage'])],
            'fee_policy_id' => ['nullable', 'integer', 'exists:fee_policies,id'],
            'payment_method' => ['nullable', 'string', 'max:80'],
        ]);

        $feature = $data['feature'];
        if ($feature === 'retail_ops' && ! $merchant->isRetailEligible()) {
            return response()->json([
                'message' => 'Retail Operations subscriptions are only available for verified business accounts with completed business KYC.',
            ], 403);
        }

        $paymentMethod = strtolower((string) ($data['payment_method'] ?? 'simulated'));

        $payment = DB::transaction(function () use ($merchant, $feature, $paymentMethod, $data) {
            $price = $this->priceFor($merchant, $feature, $data['fee_policy_id'] ?? null);
            if ($feature === 'storage' && $price['storage_mb'] <= (int) ceil((float) $merchant->storage_used_mb)) {
                throw ValidationException::withMessages([
                    'fee_policy_id' => 'Choose a storage plan larger than your current usage.',
                ]);
            }
            $now = now();
            $periodEnd = $this->periodEnd($now, $price['billing_interval']);

            MerchantPlatformSubscription::query()
                ->where('merchant_id', $merchant->id)
                ->where('feature', $feature)
                ->whereIn('status', ['trialing', 'active', 'free', 'past_due'])
                ->update([
                    'status' => 'cancelled',
                    'cancelled_at' => $now,
                ]);

            $subscription = MerchantPlatformSubscription::query()->create([
                'merchant_id' => $merchant->id,
                'feature' => $feature,
                'status' => 'active',
                'currency_code' => $price['currency_code'],
                'amount' => $price['amount'],
                'billing_interval' => $price['billing_interval'],
                'storage_mb' => $feature === 'storage' ? $price['storage_mb'] : null,
                'started_at' => $now,
                'current_period_start' => $now,
                'current_period_end' => $periodEnd,
                'next_billing_at' => $periodEnd,
                'last_paid_at' => $now,
                'metadata' => [
                    'source' => 'simulated_payment',
                    'policy_snapshot' => $price['policy_snapshot'],
                ],
            ]);

            $reference = 'SIM-SUB-' . strtoupper($feature) . '-' . $merchant->id . '-' . $now->format('YmdHis');

            $payment = MerchantPlatformSubscriptionPayment::query()->create([
                'merchant_platform_subscription_id' => $subscription->id,
                'merchant_id' => $merchant->id,
                'feature' => $feature,
                'amount' => $price['amount'],
                'currency_code' => $price['currency_code'],
                'payment_method' => $paymentMethod ?: 'simulated',
                'status' => 'simulated_paid',
                'provider_reference' => $reference,
                'paid_at' => $now,
                'policy_snapshot' => $price['policy_snapshot'],
                'metadata' => [
                    'billing_interval' => $price['billing_interval'],
                    'storage_mb' => $feature === 'storage' ? $price['storage_mb'] : null,
                ],
            ]);

            if ($price['amount'] > 0) {
                Transaction::query()->create([
                    'user_id' => $merchant->user_id,
                    'type' => 'platform_fee',
                    'currency_code' => $price['currency_code'],
                    'gross_amount' => $price['amount'],
                    'fee_amount' => $price['amount'],
                    'net_amount' => 0,
                    'tax_amount' => round($price['amount'] * 0.18, 2),
                    'reference' => $reference,
                ]);
            }

            $this->applyAccess($merchant, $feature, $price['storage_mb']);

            return $payment;
        });

        return response()->json([
            'message' => 'Simulated payment completed.',
            'payment' => $this->paymentPayload($payment->fresh()),
            'features' => [
                'retail_ops' => $this->featurePayload($merchant->fresh(['currency', 'country']), 'retail_ops'),
                'storage' => $this->featurePayload($merchant->fresh(['currency', 'country']), 'storage'),
            ],
        ], 201);
    }

    private function featurePayload(Merchant $merchant, string $feature): array
    {
        $price = $this->priceFor($merchant, $feature);
        $subscription = MerchantPlatformSubscription::query()
            ->where('merchant_id', $merchant->id)
            ->where('feature', $feature)
            ->whereIn('status', ['free', 'trialing', 'active', 'past_due'])
            ->latest('id')
            ->first();

        return [
            'key' => $feature,
            'label' => $feature === 'retail_ops' ? 'Retail Operations' : 'Storage',
            'mode' => $this->accessMode($feature),
            'trial_days' => $this->trialDays($feature),
            'free_storage_mb' => (int) AdminSetting::get('storage_free_mb', 500),
            'price' => $price,
            'plans' => $feature === 'storage' ? $this->storagePlans($merchant) : [],
            'subscription' => $subscription ? $this->subscriptionPayload($subscription) : null,
            'is_accessible' => $this->isAccessible($merchant, $feature, $subscription),
        ];
    }

    private function priceFor(Merchant $merchant, string $feature, ?int $feePolicyId = null): array
    {
        $merchant->loadMissing(['currency', 'country']);

        $category = $feature === 'storage' ? 'storage' : 'subscription';
        $currencyCode = $this->currencyCode($merchant);
        $countryCode = $merchant->country?->iso_alpha2;
        $selectedPolicy = $feature === 'storage' && $feePolicyId
            ? $this->applicableStoragePolicies($merchant)->firstWhere('id', $feePolicyId)
            : null;
        $calculation = $selectedPolicy
            ? $this->feePolicyService->calculateWithPolicy($selectedPolicy, 0, $currencyCode, 'simulated_subscription')
            : $this->feePolicyService->calculate(
                $category,
                0,
                $merchant,
                $countryCode,
                $currencyCode,
                'simulated_subscription'
            );
        $policy = $calculation['policy'];
        $unitSizeGb = (float) ($policy?->unit_size_gb ?: 1);

        return [
            'amount' => (float) $calculation['fee_amount'],
            'currency_code' => $currencyCode,
            'billing_interval' => $policy?->billing_interval ?: 'monthly',
            'storage_mb' => $feature === 'storage' ? max(1, (int) round($unitSizeGb * 1024)) : null,
            'policy_id' => $policy?->id,
            'policy_name' => $policy?->name,
            'policy_snapshot' => array_merge($calculation['snapshot'], [
                'billing_interval' => $policy?->billing_interval ?: 'monthly',
                'unit_size_gb' => $policy?->unit_size_gb,
                'category' => $category,
            ]),
        ];
    }

    private function storagePlans(Merchant $merchant): array
    {
        $currencyCode = $this->currencyCode($merchant);
        $usedMb = (int) ceil((float) $merchant->storage_used_mb);

        return $this->applicableStoragePolicies($merchant)
            ->map(function (FeePolicy $policy) use ($currencyCode, $usedMb) {
                $calculation = $this->feePolicyService->calculateWithPolicy(
                    $policy,
                    0,
                    $currencyCode,
                    'simulated_subscription'
                );
                $storageMb = max(1, (int) round(((float) ($policy->unit_size_gb ?: 1)) * 1024));

                return [
                    'policy_id' => $policy->id,
                    'name' => $policy->name,
                    'amount' => (float) $calculation['fee_amount'],
                    'currency_code' => $currencyCode,
                    'billing_interval' => $policy->billing_interval ?: 'monthly',
                    'storage_mb' => $storageMb,
                    'unit_size_gb' => (float) ($policy->unit_size_gb ?: 1),
                    'disabled' => $storageMb <= $usedMb,
                    'disabled_reason' => $storageMb <= $usedMb ? 'Current usage exceeds this plan.' : null,
                ];
            })
            ->sortBy('storage_mb')
            ->values()
            ->all();
    }

    private function applicableStoragePolicies(Merchant $merchant)
    {
        $merchant->loadMissing(['currency', 'country']);
        $now = now();
        $countryCode = $merchant->country?->iso_alpha2;
        $currencyCode = $this->currencyCode($merchant);

        return FeePolicy::query()
            ->where('category', 'storage')
            ->where('is_active', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_until')->orWhere('effective_until', '>', $now);
            })
            ->where(function ($q) use ($merchant, $countryCode, $currencyCode) {
                $q->where('scope', 'global')
                    ->orWhere(fn ($sub) => $sub->where('scope', 'merchant')->where('merchant_id', $merchant->id))
                    ->orWhere(fn ($sub) => $sub->where('scope', 'currency')->where('currency_code', $currencyCode));

                if ($countryCode) {
                    $q->orWhere(fn ($sub) => $sub->where('scope', 'country')->where('country_code', $countryCode));
                }
            })
            ->get();
    }

    private function applyAccess(Merchant $merchant, string $feature, ?int $storageMb = null): void
    {
        if ($feature === 'retail_ops') {
            $modules = $merchant->active_modules ?? [];
            if (! in_array('retail_ops', $modules, true)) {
                $modules[] = 'retail_ops';
            }
            $merchant->forceFill(['active_modules' => array_values(array_unique($modules))])->save();
            return;
        }

        $freeStorageMb = (int) AdminSetting::get('storage_free_mb', 500);
        $targetLimit = max($freeStorageMb, max(0, (int) $storageMb));
        if ((int) $merchant->storage_limit_mb < $targetLimit) {
            $merchant->forceFill(['storage_limit_mb' => $targetLimit])->save();
        }
    }

    private function isAccessible(Merchant $merchant, string $feature, ?MerchantPlatformSubscription $subscription): bool
    {
        $mode = $this->accessMode($feature);
        if ($mode === 'free') {
            return true;
        }

        if ($feature === 'retail_ops' && $merchant->hasModule('retail_ops')) {
            return true;
        }

        if (! $subscription) {
            return false;
        }

        return in_array($subscription->status, ['free', 'trialing', 'active'], true)
            && (! $subscription->current_period_end || $subscription->current_period_end->isFuture());
    }

    private function accessMode(string $feature): string
    {
        $key = $feature === 'storage' ? 'storage_access_mode' : 'retail_access_mode';
        return (string) AdminSetting::get($key, 'free');
    }

    private function trialDays(string $feature): int
    {
        $key = $feature === 'storage' ? 'storage_trial_days' : 'retail_trial_days';
        return max(0, (int) AdminSetting::get($key, 0));
    }

    private function currencyCode(Merchant $merchant): string
    {
        return $merchant->currency?->code ?: 'TZS';
    }

    private function periodEnd($start, string $billingInterval)
    {
        return match ($billingInterval) {
            'one_time' => null,
            'yearly' => $start->copy()->addYear(),
            default => $start->copy()->addMonth(),
        };
    }

    private function subscriptionPayload(MerchantPlatformSubscription $subscription): array
    {
        return [
            'id' => $subscription->id,
            'feature' => $subscription->feature,
            'status' => $subscription->status,
            'amount' => (float) $subscription->amount,
            'currency_code' => $subscription->currency_code,
            'billing_interval' => $subscription->billing_interval,
            'storage_mb' => $subscription->storage_mb,
            'started_at' => $subscription->started_at?->toIso8601String(),
            'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
            'current_period_end' => $subscription->current_period_end?->toIso8601String(),
            'next_billing_at' => $subscription->next_billing_at?->toIso8601String(),
            'last_paid_at' => $subscription->last_paid_at?->toIso8601String(),
        ];
    }

    private function paymentPayload(MerchantPlatformSubscriptionPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'feature' => $payment->feature,
            'amount' => (float) $payment->amount,
            'currency_code' => $payment->currency_code,
            'payment_method' => $payment->payment_method,
            'status' => $payment->status,
            'provider_reference' => $payment->provider_reference,
            'paid_at' => $payment->paid_at?->toIso8601String(),
        ];
    }
}
