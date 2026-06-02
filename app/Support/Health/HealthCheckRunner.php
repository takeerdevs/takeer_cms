<?php

namespace App\Support\Health;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Storage;
use Laravel\Horizon\Contracts\MasterSupervisorRepository;
use Throwable;

class HealthCheckRunner
{
    public function run(): array
    {
        $startedAt = microtime(true);

        $checks = [
            'database' => $this->checkDatabase(),
            'redis' => $this->checkRedis(),
            'cache' => $this->checkCache(),
            'storage' => $this->checkStorage(),
            'horizon' => $this->checkHorizon(),
        ];

        $healthy = collect($checks)->every(fn (array $check): bool => $check['ok']);

        return [
            'status' => $healthy ? 'ok' : 'degraded',
            'service' => config('app.name'),
            'environment' => app()->environment(),
            'duration_ms' => round((microtime(true) - $startedAt) * 1000, 2),
            'checks' => $checks,
            'timestamp' => now()->toIso8601String(),
        ];
    }

    private function checkDatabase(): array
    {
        return $this->measure(function (): array {
            DB::select('select 1');

            return ['ok' => true, 'connection' => config('database.default')];
        });
    }

    private function checkRedis(): array
    {
        return $this->measure(function (): array {
            $pong = Redis::connection()->ping();

            return ['ok' => in_array($pong, [true, 'PONG', '+PONG'], true)];
        });
    }

    private function checkCache(): array
    {
        return $this->measure(function (): array {
            $key = 'health:cache';
            Cache::put($key, 'ok', 30);

            return ['ok' => Cache::get($key) === 'ok', 'store' => config('cache.default')];
        });
    }

    private function checkStorage(): array
    {
        return $this->measure(function (): array {
            $disk = Storage::disk(config('filesystems.default'));
            $path = 'healthchecks/readiness.txt';

            $disk->put($path, 'ok');

            return [
                'ok' => $disk->exists($path),
                'disk' => config('filesystems.default'),
                'public_disk' => config('filesystems.disks.public.driver'),
            ];
        });
    }

    private function checkHorizon(): array
    {
        return $this->measure(function (): array {
            if (! interface_exists(MasterSupervisorRepository::class)) {
                return ['ok' => false, 'message' => 'Horizon is not installed'];
            }

            $masters = app(MasterSupervisorRepository::class)->all();

            return [
                'ok' => count($masters) > 0,
                'masters' => count($masters),
            ];
        });
    }

    private function measure(callable $check): array
    {
        $startedAt = microtime(true);

        try {
            return array_merge($check(), [
                'duration_ms' => round((microtime(true) - $startedAt) * 1000, 2),
            ]);
        } catch (Throwable $exception) {
            return [
                'ok' => false,
                'message' => $exception->getMessage(),
                'duration_ms' => round((microtime(true) - $startedAt) * 1000, 2),
            ];
        }
    }
}
