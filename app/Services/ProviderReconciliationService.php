<?php

namespace App\Services;

use App\Models\PaymentAttempt;
use App\Models\PaymentProvider;
use App\Models\ProviderEvent;
use App\Models\ProviderPayout;
use App\Models\ProviderRefund;
use App\Models\ProviderReconciliationBreak;
use App\Models\ProviderReconciliationRun;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Reconciles provider evidence against order-specific Takeer records.
 * This service never computes or stores a safeguarding balance.
 */
class ProviderReconciliationService
{
    public function reconcile(
        PaymentProvider $provider,
        Carbon $businessDate,
        array $providerRecords = [],
        string $sourceType = 'provider_export',
        ?string $sourceReference = null,
        ?string $sourceHash = null,
    ): ProviderReconciliationRun {
        $expected = $this->expectedRecords($provider, $businessDate, $sourceType);
        $actual = collect($providerRecords)
            ->filter('is_array')
            ->map(fn (array $record): array => $this->normalise($record))
            ->filter(fn (array $record): bool => $record['reference'] !== '')
            ->values();

        if ($actual->isEmpty() && $sourceType === 'provider_event_journal') {
            $actual = $this->providerJournalRecords($provider, $businessDate);
        }

        return DB::transaction(function () use ($provider, $businessDate, $sourceType, $sourceReference, $sourceHash, $expected, $actual): ProviderReconciliationRun {
            $run = ProviderReconciliationRun::query()->updateOrCreate(
                [
                    'payment_provider_id' => $provider->id,
                    'business_date' => $businessDate->toDateString(),
                    'source_type' => $sourceType,
                ],
                [
                    'source_reference' => $sourceReference,
                    'source_hash' => $sourceHash,
                    'expected_count' => $expected->count(),
                    'actual_count' => $actual->count(),
                    'expected_amount_minor' => (int) $expected->sum('amount_minor'),
                    'actual_amount_minor' => (int) $actual->sum('amount_minor'),
                    'currency' => (string) ($expected->first()['currency'] ?? $actual->first()['currency'] ?? 'TZS'),
                    'difference_amount_minor' => (int) $actual->sum('amount_minor') - (int) $expected->sum('amount_minor'),
                    'status' => 'started',
                    'started_at' => now(),
                    'completed_at' => null,
                ],
            );

            $run->breaks()->delete();
            $expectedByReference = $expected->keyBy('reference');
            $actualByReference = $actual->keyBy('reference');

            foreach ($expectedByReference as $reference => $record) {
                $providerRecord = $actualByReference->get($reference);
                if (! $providerRecord) {
                    $this->createBreak($run, 'missing_provider_record', $record, 'high');
                    continue;
                }
                if ((int) $providerRecord['amount_minor'] !== (int) $record['amount_minor']) {
                    $this->createBreak($run, 'amount_mismatch', $record + ['provider_amount_minor' => $providerRecord['amount_minor']], 'critical');
                }
                if (strtoupper((string) $providerRecord['currency']) !== strtoupper((string) $record['currency'])) {
                    $this->createBreak($run, 'currency_mismatch', $record + ['provider_currency' => $providerRecord['currency']], 'critical');
                }
            }

            foreach ($actualByReference as $reference => $record) {
                if (! $expectedByReference->has($reference)) {
                    $this->createBreak($run, 'unmatched_provider_record', $record, 'high');
                }
            }

            $run->update([
                'status' => $run->breaks()->exists() ? 'breaks_found' : 'matched',
                'completed_at' => now(),
            ]);

            return $run->fresh('breaks');
        });
    }

    private function expectedRecords(PaymentProvider $provider, Carbon $date, string $sourceType): Collection
    {
        $start = $date->copy()->startOfDay();
        $end = $date->copy()->endOfDay();

        if ($sourceType === 'payouts') {
            return ProviderPayout::query()
                ->with('allocations.settlement.order')
                ->where('payment_provider_id', $provider->id)
                ->whereBetween('submitted_at', [$start, $end])
                ->get()
                ->map(fn (ProviderPayout $payout): array => [
                    'reference' => (string) ($payout->provider_payout_reference ?: $payout->provider_idempotency_key),
                    'amount_minor' => (int) $payout->amount_minor,
                    'currency' => strtoupper((string) $payout->currency),
                    'provider_payout_id' => $payout->id,
                    'order_id' => $payout->allocations->first()?->settlement?->order_id,
                ]);
        }

        if ($sourceType === 'refunds') {
            return ProviderRefund::query()
                ->with('settlement.order')
                ->where('payment_provider_id', $provider->id)
                ->whereBetween('requested_at', [$start, $end])
                ->get()
                ->map(fn (ProviderRefund $refund): array => [
                    'reference' => (string) ($refund->provider_refund_reference ?: $refund->provider_idempotency_key),
                    'amount_minor' => (int) $refund->amount_minor,
                    'currency' => strtoupper((string) $refund->currency),
                    'order_id' => $refund->settlement?->order_id,
                ]);
        }

        return PaymentAttempt::query()
            ->with('order')
            ->where('payment_provider_id', $provider->id)
            ->where('state', 'confirmed')
            ->whereBetween('confirmed_at', [$start, $end])
            ->get()
            ->map(fn (PaymentAttempt $attempt): array => [
                'reference' => (string) $attempt->provider_transaction_reference,
                'amount_minor' => (int) $attempt->expected_amount_minor,
                'currency' => strtoupper((string) $attempt->expected_currency),
                'payment_attempt_id' => $attempt->id,
                'order_id' => $attempt->order_id,
            ])
            ->filter(fn (array $record): bool => $record['reference'] !== '');
    }

    private function providerJournalRecords(PaymentProvider $provider, Carbon $date): Collection
    {
        return ProviderEvent::query()
            ->where('payment_provider_id', $provider->id)
            ->where('validation_state', 'processed')
            ->whereBetween('received_at', [$date->copy()->startOfDay(), $date->copy()->endOfDay()])
            ->get()
            ->map(fn (ProviderEvent $event): array => [
                'reference' => (string) ($event->provider_transaction_reference ?: $event->takeer_reference),
                'amount_minor' => (int) ($event->amount_minor ?: 0),
                'currency' => strtoupper((string) ($event->currency ?: 'TZS')),
            ])
            ->filter(fn (array $record): bool => $record['reference'] !== '');
    }

    private function normalise(array $record): array
    {
        $amountMinor = $record['amount_minor'] ?? null;
        if ($amountMinor === null && isset($record['amount'])) {
            $amountMinor = (int) round((float) $record['amount'] * 100);
        }

        return [
            'reference' => trim((string) ($record['reference'] ?? $record['provider_reference'] ?? $record['transaction_reference'] ?? '')),
            'amount_minor' => (int) ($amountMinor ?? 0),
            'currency' => strtoupper((string) ($record['currency'] ?? 'TZS')),
            'order_id' => isset($record['order_id']) ? (int) $record['order_id'] : null,
        ];
    }

    private function createBreak(ProviderReconciliationRun $run, string $type, array $record, string $severity): void
    {
        ProviderReconciliationBreak::query()->create([
            'reconciliation_run_id' => $run->id,
            'break_type' => $type,
            'order_id' => $record['order_id'] ?? null,
            'payment_attempt_id' => $record['payment_attempt_id'] ?? null,
            'provider_payout_id' => $record['provider_payout_id'] ?? null,
            'provider_reference' => $record['reference'] ?? null,
            'amount_minor' => (int) ($record['amount_minor'] ?? 0),
            'currency' => strtoupper((string) ($record['currency'] ?? 'TZS')),
            'severity' => $severity,
            'status' => 'open',
            'first_seen_at' => now(),
        ]);
    }
}
