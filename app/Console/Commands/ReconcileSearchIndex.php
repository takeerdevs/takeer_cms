<?php

namespace App\Console\Commands;

use App\Models\SearchIndexEntry;
use App\Search\SearchDocumentFactory;
use App\Search\SearchIndexWriter;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\SoftDeletes;

class ReconcileSearchIndex extends Command
{
    protected $signature = 'search:index-reconcile {--limit=1000}';
    protected $description = 'Repair missing, stale, or orphaned unified search-index entries';

    public function handle(SearchDocumentFactory $factory, SearchIndexWriter $writer): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $processed = 0;
        foreach (SearchDocumentFactory::TYPES as $type => $model) {
            if ($processed >= $limit) {
                break;
            }
            $query = in_array(SoftDeletes::class, class_uses_recursive($model), true) ? $model::withTrashed() : $model::query();
            $query->select(['id', 'updated_at'])->orderBy('id')->limit($limit - $processed)->get()->each(function ($source) use ($type, $writer, &$processed): void {
                $entry = SearchIndexEntry::query()
                    ->where('generation', (int) config('search.generation', 1))
                    ->where('source_type', $type)
                    ->where('source_id', $source->id)
                    ->first();
                if (! $entry || ! $entry->source_updated_at || ($source->updated_at && $entry->source_updated_at->lt($source->updated_at))) {
                    $writer->rebuild($type, (int) $source->id);
                }
                $processed++;
            });
        }

        SearchIndexEntry::query()->where('generation', (int) config('search.generation', 1))->get()
            ->each(function (SearchIndexEntry $entry) use ($factory, $writer): void {
                $model = $factory->sourceModel($entry->source_type);
                $sourceQuery = $model && in_array(SoftDeletes::class, class_uses_recursive($model), true) ? $model::withTrashed() : ($model ? $model::query() : null);
                if (! $sourceQuery || ! $sourceQuery->whereKey($entry->source_id)->exists()) {
                    $writer->hide($entry->source_type, (int) $entry->source_id);
                }
            });
        $this->info("Reconciled {$processed} source records.");
        return self::SUCCESS;
    }
}
