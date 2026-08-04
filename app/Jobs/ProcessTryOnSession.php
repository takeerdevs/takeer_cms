<?php

namespace App\Jobs;

use App\Contracts\VirtualTryOnProvider;
use App\Models\ProductTryOnAsset;
use App\Models\TryOnSession;
use App\Services\AiCreditService;
use App\Services\AiTaskRouter;
use App\Services\TryOnStorageService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessTryOnSession implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300;

    public function __construct(public int $tryOnSessionId)
    {
        $this->onQueue('media');
    }

    public function handle(VirtualTryOnProvider $provider, TryOnStorageService $storage, AiCreditService $credits, AiTaskRouter $router): void
    {
        $session = TryOnSession::query()
            ->with(['product', 'variant'])
            ->find($this->tryOnSessionId);

        if (! $session) {
            return;
        }
        if ($session->status === 'completed') {
            return;
        }
        if ($session->isExpired()) {
            $this->releaseReservation($session, $credits, $router, new \RuntimeException('Try-on session expired before processing.'));
            return;
        }

        $asset = $this->resolveAsset($session);
        if (! $asset) {
            throw new \RuntimeException('No active garment asset is available for this try-on session.');
        }

        $session->update([
            'status' => 'processing',
            'provider' => (string) config('services.try_on.driver', 'fake'),
            'started_at' => now(),
            'error_message' => null,
        ]);

        try {
            $result = $provider->generate($session, $asset);
            $stored = $storage->storeResult($session, $result);

            $session->update([
                'status' => 'completed',
                'result_disk' => $stored['disk'],
                'result_path' => $stored['path'],
                'result_mime' => $stored['mime'],
                'metadata' => array_merge($session->metadata ?: [], $stored['metadata'] ?: []),
                'completed_at' => now(),
                'error_message' => null,
            ]);

            $this->settleReservation($session->fresh(), $credits, $router);

            $storage->delete($session->portrait_disk, $session->portrait_path);
        } catch (Throwable $exception) {
            $session->update([
                'status' => 'failed',
                'error_message' => mb_substr($exception->getMessage(), 0, 1000),
            ]);

            throw $exception;
        }
    }

    public function failed(?Throwable $exception): void
    {
        $session = TryOnSession::find($this->tryOnSessionId);
        if (! $session) {
            return;
        }

        app(TryOnStorageService::class)->delete($session->portrait_disk, $session->portrait_path);
        $this->releaseReservation($session, app(AiCreditService::class), app(AiTaskRouter::class), $exception);
        $session->update([
            'status' => 'failed',
            'error_message' => mb_substr($exception?->getMessage() ?: 'Try-on processing failed.', 0, 1000),
        ]);
    }

    private function resolveAsset(TryOnSession $session): ?ProductTryOnAsset
    {
        $query = ProductTryOnAsset::query()
            ->where('product_id', $session->product_id)
            ->where('is_active', true);

        if ($session->product_variant_id) {
            $variantAsset = (clone $query)
                ->where('product_variant_id', $session->product_variant_id)
                ->latest('id')
                ->first();

            if ($variantAsset) {
                return $variantAsset;
            }
        }

        return $query
            ->whereNull('product_variant_id')
            ->latest('id')
            ->first();
    }

    private function settleReservation(TryOnSession $session, AiCreditService $credits, AiTaskRouter $router): void
    {
        $reservationId = data_get($session->metadata ?: [], 'ai_credit_reservation_id');
        if (! $reservationId) {
            return;
        }

        $reservation = \App\Models\AiCreditTransaction::query()->find($reservationId);
        if (! $reservation) {
            return;
        }

        $usage = $router->recordExternalUsage('virtual_try_on', [
            'user_id' => $session->user_id,
            'actor_user_id' => $session->user_id,
            'scope_type' => 'user',
            'provider_key' => $session->provider ?: (string) config('services.try_on.driver', 'fake'),
            'model_key' => data_get($session->metadata ?: [], 'model'),
            'billable_units' => 1,
            'unit_type' => 'image',
            'charged_credits' => $reservation->amount,
            'started_at' => $session->started_at ?: $session->created_at,
            'completed_at' => $session->completed_at ?: now(),
            'metadata' => ['try_on_session_id' => $session->id],
        ]);

        $credits->settle($reservation, $usage);
    }

    private function releaseReservation(TryOnSession $session, AiCreditService $credits, AiTaskRouter $router, ?Throwable $exception): void
    {
        $reservationId = data_get($session->metadata ?: [], 'ai_credit_reservation_id');
        if (! $reservationId) {
            return;
        }

        $reservation = \App\Models\AiCreditTransaction::query()->find($reservationId);
        if (! $reservation) {
            return;
        }

        $router->recordExternalUsage('virtual_try_on', [
            'user_id' => $session->user_id,
            'actor_user_id' => $session->user_id,
            'scope_type' => 'user',
            'provider_key' => $session->provider ?: (string) config('services.try_on.driver', 'fake'),
            'model_key' => data_get($session->metadata ?: [], 'model'),
            'status' => 'failed',
            'billable_units' => 0,
            'unit_type' => 'image',
            'started_at' => $session->started_at ?: $session->created_at,
            'completed_at' => now(),
            'error_code' => 'try_on_failed',
            'error_message' => $exception?->getMessage() ?: 'Try-on processing failed.',
            'metadata' => ['try_on_session_id' => $session->id],
        ]);

        $credits->release($reservation, ['reason' => 'try_on_failed']);
    }
}
