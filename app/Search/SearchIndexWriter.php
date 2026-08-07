<?php

namespace App\Search;

use App\Jobs\GenerateSearchIndexEmbeddings;
use App\Models\SearchIndexEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SearchIndexWriter
{
    public function __construct(private SearchDocumentFactory $factory)
    {
    }

    public function rebuild(string $type, int $id, ?int $outboxId = null): ?SearchIndexEntry
    {
        $generation = (int) config('search.generation', 1);
        $document = $this->factory->build($type, $id);

        if (! $document) {
            SearchIndexEntry::query()
                ->where('generation', $generation)
                ->where('source_type', $type)
                ->where('source_id', $id)
                ->delete();
            return null;
        }

        return DB::transaction(function () use ($document, $generation, $outboxId): SearchIndexEntry {
            $chunks = $document['chunks'] ?? [];
            unset($document['chunks']);

            $normalizedTitle = $this->normalize((string) ($document['title'] ?? ''));
            $hashPayload = $document;
            ksort($hashPayload);
            $contentHash = hash('sha256', json_encode($hashPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

            $entry = SearchIndexEntry::query()->firstOrNew([
                'generation' => $generation,
                'source_type' => $document['source_type'],
                'source_id' => $document['source_id'],
            ]);

            if ($outboxId && $entry->exists && (int) $entry->last_outbox_id >= $outboxId) {
                return $entry;
            }

            $entry->fill(array_merge($document, [
                'normalized_title' => $normalizedTitle,
                'content_hash' => $contentHash,
                'indexed_at' => now(),
                'last_outbox_id' => $outboxId,
                'index_version' => (int) config('search.index_version', 1),
                'generation' => $generation,
            ]));
            $entry->save();

            $expectedKeys = [];
            foreach (array_values($chunks) as $position => $chunk) {
                $content = trim((string) ($chunk['content'] ?? ''));
                if ($content === '') {
                    continue;
                }
                $key = (string) ($chunk['chunk_key'] ?? 'chunk:'.$position);
                $expectedKeys[] = $key;
                $chunkHash = hash('sha256', $this->normalize($content));
                $embeddingHash = hash('sha256', implode('|', [
                    $chunkHash,
                    (string) config('search.embedding.model'),
                    (string) config('search.embedding.dimensions', 512),
                    (string) config('search.index_version', 1),
                ]));
                $existing = $entry->chunks()->where('chunk_key', $key)->first();
                $embeddingChanged = ! $existing || $existing->embedding_hash !== $embeddingHash;

                $indexedChunk = $entry->chunks()->updateOrCreate(['chunk_key' => $key], [
                    'chunk_type' => $chunk['chunk_type'] ?? 'summary',
                    'position' => $position,
                    'content' => $content,
                    'facets' => $chunk['facets'] ?? [],
                    'price_min' => $chunk['price_min'] ?? null,
                    'price_max' => $chunk['price_max'] ?? null,
                    'in_stock' => $chunk['in_stock'] ?? null,
                    'content_hash' => $chunkHash,
                    'embedding_hash' => $embeddingHash,
                    'embedding_model' => config('search.embedding.model'),
                    'embedding_status' => $embeddingChanged ? 'pending' : ($existing?->embedding_status ?? 'pending'),
                ]);
                if ($embeddingChanged && $existing) {
                    $indexedChunk->forceFill(['embedding' => null])->save();
                }
            }
            $entry->chunks()->when($expectedKeys !== [], fn ($query) => $query->whereNotIn('chunk_key', $expectedKeys))->delete();
            if ($expectedKeys === []) {
                $entry->chunks()->delete();
            }

            $this->refreshLexicalVectors($entry);

            if (config('search.hybrid_enabled') && config('search.embedding.model') && config('search.embedding.api_key')) {
                GenerateSearchIndexEmbeddings::dispatch($entry->id)->afterCommit()->onQueue((string) config('search.queue', 'default'));
            } else {
                $entry->chunks()->where('embedding_status', 'pending')->update(['embedding_status' => 'skipped']);
                $entry->forceFill(['embedding_status' => 'skipped'])->save();
            }

            return $entry->fresh('chunks');
        });
    }

    public function hide(string $type, int $id): void
    {
        SearchIndexEntry::query()
            ->where('generation', (int) config('search.generation', 1))
            ->where('source_type', $type)
            ->where('source_id', $id)
            ->update(['is_searchable' => false, 'updated_at' => now()]);
    }

    private function refreshLexicalVectors(SearchIndexEntry $entry): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $entry->forceFill(['search_vector' => $this->normalize($entry->title.' '.$entry->subtitle.' '.$entry->summary.' '.$entry->keywords)])->save();
            $entry->chunks()->each(fn ($chunk) => $chunk->forceFill(['search_vector' => $this->normalize($chunk->content)])->save());
            return;
        }

        DB::statement(<<<'SQL'
            UPDATE search_index
            SET search_vector =
                setweight(to_tsvector('simple', unaccent(coalesce(title, ''))), 'A') ||
                setweight(to_tsvector('simple', unaccent(coalesce(subtitle, ''))), 'B') ||
                setweight(to_tsvector('simple', unaccent(coalesce(summary, ''))), 'C') ||
                setweight(to_tsvector('simple', unaccent(coalesce(keywords, ''))), 'B')
            WHERE id = ?
        SQL, [$entry->id]);
        DB::statement("UPDATE search_index_chunks SET search_vector = to_tsvector('simple', unaccent(coalesce(content, ''))) WHERE search_index_id = ?", [$entry->id]);
    }

    private function normalize(string $value): string
    {
        return Str::of($value)->lower()->ascii()->replaceMatches('/[^a-z0-9]+/u', ' ')->squish()->toString();
    }
}
