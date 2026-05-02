<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ServiceAvailabilityRule;
use App\Models\ServiceRequest;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class ServiceAppointmentSlotService
{
    public function slotsForProduct(Product $product, string $date, ?string $timezone = null, ?array $serviceOption = null): array
    {
        $timezone = $timezone ?: ($product->merchant?->defaultTimezone() ?: 'Africa/Dar_es_Salaam');
        $day = CarbonImmutable::parse($date, $timezone)->startOfDay();
        $weekday = (int) $day->dayOfWeekIso;
        $duration = max(15, (int) (($serviceOption['duration_minutes'] ?? null) ?: $product->service_duration_minutes ?: 60));

        $rules = ServiceAvailabilityRule::query()
            ->where('merchant_id', $product->merchant_id)
            ->where('weekday', $weekday)
            ->where('is_active', true)
            ->where(function ($query) use ($product) {
                $query->where('product_id', $product->id)->orWhereNull('product_id');
            })
            ->orderByRaw('product_id is null')
            ->orderBy('start_time')
            ->get();

        if ($rules->isEmpty()) {
            $rules = $this->defaultRules($product, $weekday, $timezone);
        }

        $booked = ServiceRequest::query()
            ->where('merchant_id', $product->merchant_id)
            ->where('product_id', $product->id)
            ->whereIn('status', ['pending', 'contacted', 'quoted', 'confirmed'])
            ->whereBetween('scheduled_at', [$day->utc(), $day->endOfDay()->utc()])
            ->get(['scheduled_at', 'scheduled_ends_at', 'duration_minutes']);

        return $rules
            ->flatMap(fn (ServiceAvailabilityRule $rule) => $this->slotsForRule($rule, $day, $duration, $booked, $serviceOption))
            ->sortBy('starts_at')
            ->values()
            ->all();
    }

    private function defaultRules(Product $product, int $weekday, string $timezone): Collection
    {
        if ($weekday > 5) {
            return collect();
        }

        return collect([
            new ServiceAvailabilityRule([
                'merchant_id' => $product->merchant_id,
                'product_id' => $product->id,
                'timezone' => $timezone,
                'weekday' => $weekday,
                'start_time' => '09:00',
                'end_time' => '17:00',
                'slot_interval_minutes' => 60,
                'buffer_minutes' => 0,
                'capacity' => 1,
                'is_active' => true,
            ]),
        ]);
    }

    private function slotsForRule(ServiceAvailabilityRule $rule, CarbonImmutable $day, int $duration, Collection $booked, ?array $serviceOption = null): array
    {
        $timezone = $rule->timezone ?: $day->timezoneName;
        $start = CarbonImmutable::parse($day->toDateString().' '.$rule->start_time, $timezone);
        $end = CarbonImmutable::parse($day->toDateString().' '.$rule->end_time, $timezone);
        $step = max(5, (int) $rule->slot_interval_minutes);
        $buffer = max(0, (int) $rule->buffer_minutes);
        $capacityType = $rule->metadata['capacity_type'] ?? 'limited';
        $capacity = max(1, (int) $rule->capacity);
        if (($serviceOption['capacity_type'] ?? null) === 'unlimited') {
            $capacityType = 'unlimited';
        } elseif (! empty($serviceOption['capacity'])) {
            $capacity = min($capacity, max(1, (int) $serviceOption['capacity']));
        }
        $isUnlimited = $capacityType === 'unlimited';
        $slots = [];

        for ($cursor = $start; $cursor->addMinutes($duration)->lessThanOrEqualTo($end); $cursor = $cursor->addMinutes($step)) {
            $slotEnd = $cursor->addMinutes($duration + $buffer);
            $conflicts = $booked->filter(function (ServiceRequest $request) use ($cursor, $slotEnd, $duration, $timezone) {
                $requestStart = CarbonImmutable::parse($request->scheduled_at)->setTimezone($timezone);
                $requestEnd = $request->scheduled_ends_at
                    ? CarbonImmutable::parse($request->scheduled_ends_at)->setTimezone($timezone)
                    : $requestStart->addMinutes((int) ($request->duration_minutes ?: $duration));

                return $requestStart->lessThan($slotEnd) && $requestEnd->greaterThan($cursor);
            })->count();

            $slots[] = [
                'starts_at' => $cursor->toIso8601String(),
                'ends_at' => $cursor->addMinutes($duration)->toIso8601String(),
                'timezone' => $timezone,
                'available' => $isUnlimited || $conflicts < $capacity,
                'capacity_type' => $capacityType,
                'capacity' => $isUnlimited ? null : $capacity,
                'booked_count' => $conflicts,
                'remaining' => $isUnlimited ? null : max(0, $capacity - $conflicts),
            ];
        }

        return $slots;
    }
}
