<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiModel;
use App\Models\AiTaskRoute;
use App\Models\AiUsageRecord;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminAiAnalyticsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'group_by' => ['nullable', 'in:day,month'],
            'task_key' => ['nullable', 'string', 'max:120'],
            'model_key' => ['nullable', 'string', 'max:255'],
            'provider_key' => ['nullable', 'string', 'max:120'],
            'scope_type' => ['nullable', 'in:user,merchant'],
            'status' => ['nullable', 'in:completed,failed'],
        ]);

        $from = isset($validated['from'])
            ? CarbonImmutable::createFromFormat('Y-m-d', $validated['from'])->startOfDay()
            : now()->subDays(29)->startOfDay();
        $to = isset($validated['to'])
            ? CarbonImmutable::createFromFormat('Y-m-d', $validated['to'])->endOfDay()
            : now()->endOfDay();

        abort_if($from->greaterThan($to), 422, 'The AI usage start date must be before the end date.');

        $records = AiUsageRecord::query()
            ->with(['provider:id,key,name', 'model:id,model_key,label'])
            ->whereBetween('created_at', [$from, $to])
            ->when($validated['task_key'] ?? null, fn ($query, $value) => $query->where('task_key', $value))
            ->when($validated['model_key'] ?? null, fn ($query, $value) => $query->where('model_key', $value))
            ->when($validated['provider_key'] ?? null, fn ($query, $value) => $query->where('provider_key', $value))
            ->when($validated['scope_type'] ?? null, fn ($query, $value) => $query->where('scope_type', $value))
            ->when($validated['status'] ?? null, fn ($query, $value) => $query->where('status', $value))
            ->latest('created_at')
            ->limit(100000)
            ->get();

        $groupBy = $validated['group_by'] ?? 'day';

        return response()->json([
            'range' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'group_by' => $groupBy,
            ],
            'summary' => $this->summary($records),
            'series' => $this->aggregate($records, fn (AiUsageRecord $record) => $this->bucket($record, $groupBy), false),
            'by_task' => $this->aggregate($records, fn (AiUsageRecord $record) => $record->task_key),
            'by_model' => $this->aggregate($records, fn (AiUsageRecord $record) => $record->model_key ?: $record->model?->model_key ?: 'unresolved'),
            'recent' => $records->take(100)->map(fn (AiUsageRecord $record) => $this->recordPayload($record))->values(),
            'options' => [
                'tasks' => AiTaskRoute::query()->orderBy('label')->get(['task_key', 'label']),
                'models' => AiModel::query()->orderBy('model_key')->get(['model_key', 'label']),
            ],
        ]);
    }

    private function summary($records): array
    {
        $successful = $records->where('status', 'completed');

        return [
            'requests' => $records->count(),
            'successful_requests' => $successful->count(),
            'failed_requests' => $records->where('status', 'failed')->count(),
            'input_units' => $this->number($records->sum(fn (AiUsageRecord $record) => (float) $record->input_units)),
            'output_units' => $this->number($records->sum(fn (AiUsageRecord $record) => (float) $record->output_units)),
            'billable_units' => $this->number($successful->sum(fn (AiUsageRecord $record) => (float) $record->billable_units)),
            'provider_cost' => $this->number($records->sum(fn (AiUsageRecord $record) => (float) $record->provider_cost), 8),
            'charged_credits' => $this->number($successful->sum(fn (AiUsageRecord $record) => (float) $record->charged_credits)),
            'average_latency_ms' => $successful->count() > 0
                ? round($successful->avg(fn (AiUsageRecord $record) => (int) $record->latency_ms))
                : 0,
        ];
    }

    private function aggregate($records, callable $keyResolver, bool $sortByCost = true): array
    {
        return $records
            ->groupBy($keyResolver)
            ->map(function ($items, $key) {
                $successful = $items->where('status', 'completed');

                return [
                    'key' => (string) $key,
                    'requests' => $items->count(),
                    'successful_requests' => $successful->count(),
                    'failed_requests' => $items->where('status', 'failed')->count(),
                    'input_units' => $this->number($items->sum(fn (AiUsageRecord $record) => (float) $record->input_units)),
                    'output_units' => $this->number($items->sum(fn (AiUsageRecord $record) => (float) $record->output_units)),
                    'provider_cost' => $this->number($items->sum(fn (AiUsageRecord $record) => (float) $record->provider_cost), 8),
                    'charged_credits' => $this->number($successful->sum(fn (AiUsageRecord $record) => (float) $record->charged_credits)),
                    'average_latency_ms' => $successful->count() > 0
                        ? round($successful->avg(fn (AiUsageRecord $record) => (int) $record->latency_ms))
                        : 0,
                ];
            })
            ->when($sortByCost, fn ($items) => $items->sortByDesc('provider_cost'), fn ($items) => $items->sortBy('key'))
            ->values()
            ->all();
    }

    private function bucket(AiUsageRecord $record, string $groupBy): string
    {
        $date = $record->created_at ?: now();

        return $groupBy === 'month'
            ? $date->format('Y-m')
            : $date->format('Y-m-d');
    }

    private function recordPayload(AiUsageRecord $record): array
    {
        return [
            'id' => $record->id,
            'created_at' => $record->created_at?->toISOString(),
            'task_key' => $record->task_key,
            'scope_type' => $record->scope_type,
            'user_id' => $record->user_id,
            'merchant_id' => $record->merchant_id,
            'status' => $record->status,
            'provider_key' => $record->provider_key ?: $record->provider?->key,
            'model_key' => $record->model_key ?: $record->model?->model_key,
            'credential_hint' => $record->credential_hint,
            'attempt_number' => $record->attempt_number,
            'fallback_reason' => $record->fallback_reason,
            'input_units' => (float) $record->input_units,
            'output_units' => (float) $record->output_units,
            'billable_units' => (float) $record->billable_units,
            'provider_cost' => (float) $record->provider_cost,
            'provider_cost_currency' => $record->provider_cost_currency,
            'charged_credits' => (float) $record->charged_credits,
            'latency_ms' => $record->latency_ms,
            'error_message' => $record->error_message,
        ];
    }

    private function number(float $value, int $precision = 4): float
    {
        return round($value, $precision);
    }
}
