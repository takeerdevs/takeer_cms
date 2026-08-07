<?php

namespace App\Jobs;

use App\Models\SearchIndexEntry;
use App\Search\SearchEmbeddingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

class GenerateSearchIndexEmbeddings implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 4;
    public array $backoff = [30, 180, 900];
    public int $uniqueFor = 300;

    public function __construct(public int $entryId)
    {
    }

    public function uniqueId(): string
    {
        return (string) $this->entryId;
    }

    public function handle(SearchEmbeddingService $embeddings): void
    {
        $entry = SearchIndexEntry::query()->with('chunks')->find($this->entryId);
        if (! $entry || ! $entry->is_searchable || ! $embeddings->configured() || DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        try {
            foreach ($entry->chunks->whereIn('embedding_status', ['pending', 'failed']) as $chunk) {
                $vector = $embeddings->embed($chunk->content);
                $literal = '['.implode(',', $vector).']';
                DB::statement('UPDATE search_index_chunks SET embedding = CAST(? AS vector), embedding_status = ?, embedding_updated_at = ?, updated_at = ? WHERE id = ?', [
                    $literal, 'ready', now(), now(), $chunk->id,
                ]);
            }
            $remaining = $entry->chunks()->whereNotIn('embedding_status', ['ready', 'skipped'])->exists();
            $entry->forceFill([
                'embedding_status' => $remaining ? 'pending' : 'ready',
                'embedding_model' => config('search.embedding.model'),
                'embedding_updated_at' => now(),
            ])->save();
        } catch (Throwable $error) {
            $entry->chunks()->where('embedding_status', 'pending')->update(['embedding_status' => 'failed']);
            $entry->forceFill(['embedding_status' => 'failed'])->save();
            throw $error;
        }
    }
}
