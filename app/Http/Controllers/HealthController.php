<?php

namespace App\Http\Controllers;

use App\Models\HealthCheckSnapshot;
use App\Support\Health\HealthCheckRunner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\View\View;
use Throwable;

class HealthController extends Controller
{
    public function live(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => config('app.name'),
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function status(Request $request): View
    {
        return view('health.status', array_merge(
            app(HealthCheckRunner::class)->run(),
            $this->snapshotHistory($request)
        ));
    }

    public function ready(): JsonResponse
    {
        $payload = app(HealthCheckRunner::class)->run();

        return response()->json($payload, $payload['status'] === 'ok' ? 200 : 503);
    }

    private function snapshotHistory(Request $request): array
    {
        $ranges = [
            '1h' => ['label' => '1h', 'minutes' => 60, 'limit' => 24],
            '6h' => ['label' => '6h', 'minutes' => 360, 'limit' => 72],
            '24h' => ['label' => '24h', 'minutes' => 1440, 'limit' => 144],
            '7d' => ['label' => '7d', 'minutes' => 10080, 'limit' => 168],
        ];
        $selectedRange = array_key_exists($request->query('range', '1h'), $ranges)
            ? $request->query('range', '1h')
            : '1h';
        $range = $ranges[$selectedRange];

        try {
            $snapshots = HealthCheckSnapshot::query()
                ->where('checked_at', '>=', now()->subMinutes($range['minutes']))
                ->oldest('checked_at')
                ->get();

            return [
                'snapshots' => $this->downsampleSnapshots($snapshots, $range['limit'])->reverse()->values(),
                'history_available' => true,
                'history_ranges' => $ranges,
                'selected_history_range' => $selectedRange,
                'selected_history_range_label' => $range['label'],
            ];
        } catch (Throwable) {
            return [
                'snapshots' => collect(),
                'history_available' => false,
                'history_ranges' => $ranges,
                'selected_history_range' => $selectedRange,
                'selected_history_range_label' => $range['label'],
            ];
        }
    }

    private function downsampleSnapshots(Collection $snapshots, int $limit): Collection
    {
        if ($snapshots->count() <= $limit) {
            return $snapshots;
        }

        $step = (int) ceil($snapshots->count() / $limit);

        return $snapshots
            ->values()
            ->filter(fn ($snapshot, int $index): bool => $index % $step === 0 || $index === $snapshots->count() - 1)
            ->take($limit);
    }
}
