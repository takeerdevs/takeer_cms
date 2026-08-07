<?php

namespace App\Jobs;

use App\Models\SearchIndexOutbox;
use App\Search\SearchIndexWriter;
use App\Search\SearchIndexFanoutService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessSearchIndexOutbox implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public array $backoff = [5, 30, 120, 600];
    public int $uniqueFor = 60;

    public function __construct(public int $outboxId)
    {
    }

    public function uniqueId(): string
    {
        return (string) $this->outboxId;
    }

    public function handle(SearchIndexWriter $writer, SearchIndexFanoutService $fanout): void
    {
        $outbox = SearchIndexOutbox::query()->find($this->outboxId);
        if (! $outbox || $outbox->processed_at) {
            return;
        }

        try {
            $outbox->increment('attempts');
            if ($outbox->action === 'hide') {
                $writer->hide($outbox->aggregate_type, (int) $outbox->aggregate_id);
            } elseif ($outbox->action === 'fanout' && $outbox->aggregate_type === 'merchant') {
                $fanout->rebuildMerchant((int) $outbox->aggregate_id, (int) $outbox->id);
            } else {
                $writer->rebuild($outbox->aggregate_type, (int) $outbox->aggregate_id, (int) $outbox->id);
            }
            $outbox->forceFill(['processed_at' => now(), 'last_error' => null])->save();
        } catch (Throwable $error) {
            $outbox->forceFill(['last_error' => mb_substr($error->getMessage(), 0, 2000)])->save();
            throw $error;
        }
    }
}
