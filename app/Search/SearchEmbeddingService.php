<?php

namespace App\Search;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SearchEmbeddingService
{
    public function configured(): bool
    {
        return filled(config('search.embedding.model')) && filled(config('search.embedding.api_key'));
    }

    public function embed(string $text): array
    {
        if (! $this->configured()) {
            throw new RuntimeException('Search embedding provider is not configured.');
        }

        $response = Http::withToken((string) config('search.embedding.api_key'))
            ->acceptJson()
            ->timeout((int) config('search.embedding.timeout', 30))
            ->post((string) config('search.embedding.endpoint'), [
                'model' => config('search.embedding.model'),
                'input' => $text,
                'dimensions' => (int) config('search.embedding.dimensions', 512),
            ])
            ->throw()
            ->json();

        $vector = $response['data'][0]['embedding'] ?? null;
        if (! is_array($vector) || count($vector) !== (int) config('search.embedding.dimensions', 512)) {
            throw new RuntimeException('Embedding provider returned an invalid vector dimension.');
        }
        return array_map('floatval', $vector);
    }

    public function queryEmbedding(string $query): ?array
    {
        if (! $this->configured()) {
            return null;
        }
        $key = 'search:embedding:'.hash('sha256', config('search.embedding.model').'|'.mb_strtolower(trim($query)));
        return Cache::remember($key, (int) config('search.embedding.query_cache_seconds', 3600), fn () => $this->embed($query));
    }
}
