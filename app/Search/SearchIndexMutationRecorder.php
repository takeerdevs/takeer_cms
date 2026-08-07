<?php

namespace App\Search;

use App\Jobs\ProcessSearchIndexOutbox;
use App\Models\SearchIndexOutbox;

class SearchIndexMutationRecorder
{
    public function record(string $type, int $id, string $action = 'upsert', ?string $reason = null, ?string $event = null): ?SearchIndexOutbox
    {
        if (! config('search.write_enabled') || $id < 1) {
            return null;
        }

        $outbox = SearchIndexOutbox::query()->create([
            'aggregate_type' => $type,
            'aggregate_id' => $id,
            'action' => $action,
            'reason' => $reason,
            'source_event' => $event,
            'available_at' => now(),
        ]);

        ProcessSearchIndexOutbox::dispatch($outbox->id)
            ->afterCommit()
            ->onQueue((string) config('search.queue', 'default'));

        return $outbox;
    }
}
