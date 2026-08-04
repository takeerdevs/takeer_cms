<?php

namespace App\Console\Commands;

use App\Models\TryOnSession;
use App\Services\TryOnStorageService;
use Illuminate\Console\Command;

class PruneTryOnSessions extends Command
{
    protected $signature = 'try-on:prune';

    protected $description = 'Delete expired virtual try-on portraits and generated results.';

    public function handle(TryOnStorageService $storage): int
    {
        $count = 0;

        TryOnSession::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->whereIn('status', ['pending', 'processing', 'completed', 'failed'])
            ->orderBy('id')
            ->chunkById(100, function ($sessions) use ($storage, &$count): void {
                foreach ($sessions as $session) {
                    $storage->delete($session->portrait_disk, $session->portrait_path);
                    $storage->delete($session->result_disk, $session->result_path);
                    $session->update([
                        'status' => 'expired',
                        'portrait_path' => 'expired',
                        'result_disk' => null,
                        'result_path' => null,
                        'result_mime' => null,
                    ]);
                    $count++;
                }
            });

        $this->info("Pruned {$count} expired try-on session(s).");

        return self::SUCCESS;
    }
}
