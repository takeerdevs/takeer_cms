<?php

namespace App\Console\Commands;

use App\Jobs\ProcessSearchIndexOutbox;
use App\Models\SearchIndexOutbox;
use Illuminate\Console\Command;

class DrainSearchIndexOutbox extends Command
{
    protected $signature = 'search:index-drain-outbox {--limit=500}';
    protected $description = 'Dispatch pending unified search-index mutations';

    public function handle(): int
    {
        $ids = SearchIndexOutbox::query()
            ->whereNull('processed_at')
            ->where(fn ($query) => $query->whereNull('available_at')->orWhere('available_at', '<=', now()))
            ->orderBy('id')
            ->limit(max(1, (int) $this->option('limit')))
            ->pluck('id');

        $ids->each(fn ($id) => ProcessSearchIndexOutbox::dispatch((int) $id)->onQueue((string) config('search.queue', 'default')));
        $this->info("Dispatched {$ids->count()} search-index mutations.");
        return self::SUCCESS;
    }
}
