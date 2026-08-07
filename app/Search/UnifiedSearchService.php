<?php

namespace App\Search;

use App\Http\Resources\PostResource;
use App\Http\Resources\ProductResource;
use App\Models\Post;
use App\Models\Product;
use App\Models\SearchIndexEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UnifiedSearchService
{
    public function __construct(private SearchEmbeddingService $embeddings)
    {
    }

    public function search(array $input, ?Request $request = null): array
    {
        $request ??= request();
        $queryText = trim((string) ($input['q'] ?? $input['query'] ?? ''));
        $parsed = $this->parseNaturalConstraints($queryText);
        $searchText = (string) ($parsed['_search_query'] ?? $queryText);
        unset($parsed['_search_query']);
        $filters = array_merge($parsed, array_filter($input, fn ($value) => $value !== null && $value !== '' && $value !== []));
        $page = max(1, (int) ($input['page'] ?? 1));
        $perPage = min((int) config('search.max_per_page', 50), max(1, (int) ($input['per_page'] ?? config('search.per_page', 20))));
        $tokens = $this->tokens($searchText);
        $driver = DB::connection()->getDriverName();

        $filtered = SearchIndexEntry::query()
            ->where('generation', (int) config('search.generation', 1))
            ->where('is_searchable', true)
            ->where('visibility', 'public');
        $this->applyFilters($filtered, $filters, $tokens, $driver);
        $base = clone $filtered;

        if ($searchText !== '') {
            if ($driver === 'pgsql') {
                $base->where(function ($where) use ($searchText): void {
                    $where->whereRaw("search_vector @@ websearch_to_tsquery('simple', unaccent(?))", [$searchText])
                        ->orWhereRaw('similarity(normalized_title, unaccent(lower(?))) > 0.15', [$searchText])
                        ->orWhereExists(function ($chunk) use ($searchText): void {
                            $chunk->selectRaw('1')->from('search_index_chunks')
                                ->whereColumn('search_index_chunks.search_index_id', 'search_index.id')
                                ->whereRaw("search_index_chunks.search_vector @@ websearch_to_tsquery('simple', unaccent(?))", [$searchText]);
                        });
                })->select('search_index.*')->selectRaw(
                    "(GREATEST(ts_rank_cd(search_vector, websearch_to_tsquery('simple', unaccent(?))), similarity(normalized_title, unaccent(lower(?)))) + popularity_score * 0.01 + quality_score * 0.01) AS search_score",
                    [$searchText, $searchText]
                )->orderByDesc('search_score');
            } else {
                $base->where(function ($where) use ($tokens): void {
                    foreach ($tokens as $token) {
                        $like = '%'.$token.'%';
                        $where->orWhereRaw('LOWER(title) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(COALESCE(summary, ?)) LIKE ?', ['', $like])
                            ->orWhereRaw('LOWER(COALESCE(keywords, ?)) LIKE ?', ['', $like])
                            ->orWhereExists(function ($chunk) use ($like): void {
                                $chunk->selectRaw('1')->from('search_index_chunks')
                                    ->whereColumn('search_index_chunks.search_index_id', 'search_index.id')
                                    ->whereRaw('LOWER(search_index_chunks.content) LIKE ?', [$like]);
                            });
                    }
                })->orderByDesc('quality_score')->orderByDesc('popularity_score');
            }
        } else {
            $base->orderByDesc('quality_score')->orderByDesc('popularity_score')->orderByDesc('published_at');
        }

        $mode = (string) ($input['mode'] ?? 'lexical');
        if ($mode === 'hybrid' && config('search.hybrid_enabled') && $driver === 'pgsql' && $searchText !== '') {
            $entries = $this->hybridCandidates($base, $filtered, $searchText, $page, $perPage);
            $total = $entries->count();
            $pageEntries = $entries->slice(($page - 1) * $perPage, $perPage)->values();
        } else {
            $paginator = $base->paginate($perPage, ['*'], 'page', $page);
            $pageEntries = collect($paginator->items());
            $total = $paginator->total();
        }

        $data = $this->hydrate($pageEntries, $request, $queryText, $filters);
        $lastPage = max(1, (int) ceil($total / $perPage));

        return [
            'data' => $data->values()->all(),
            'meta' => [
                'query' => $queryText,
                'mode' => $mode,
                'filters' => $this->publicFilters($filters),
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => min($page, $lastPage),
                'last_page' => $lastPage,
            ],
        ];
    }

    private function applyFilters($query, array $filters, array $tokens, string $driver): void
    {
        $entityTypes = collect($filters['entity_types'] ?? [])->filter()->values();
        if ($entityTypes->isNotEmpty()) {
            $query->whereIn('entity_type', $entityTypes);
        }
        $contentTypes = collect($filters['content_types'] ?? [])->filter()->values();
        if ($contentTypes->isNotEmpty()) {
            $query->whereIn('content_type', $contentTypes);
        }

        $legacyType = (string) ($filters['type'] ?? 'all');
        match ($legacyType) {
            'physical' => $query->where('content_type', 'physical_product'),
            'service' => $query->where('entity_type', 'service'),
            'digital' => $query->whereIn('content_type', ['digital_download', 'premium_video', 'premium_audio', 'gallery_pack', 'software', 'live_event', 'custom_delivery', 'paid_content']),
            'creator' => $query->whereIn('entity_type', ['content_item', 'bundle', 'subscription_plan', 'post']),
            'custom' => $query->where('content_type', 'custom_delivery'),
            default => null,
        };
        if (($filters['surface'] ?? null) === 'products') {
            $query->whereIn('entity_type', ['product', 'service']);
        }
        if (! empty($filters['country_id'])) {
            $query->where('country_id', (int) $filters['country_id']);
        }
        if (! empty($filters['merchant_id'])) {
            $query->where('merchant_id', (int) $filters['merchant_id']);
        }
        if (isset($filters['min_price'])) {
            $query->where(function ($price) use ($filters): void {
                $price->whereNull('price_max_base')->orWhere('price_max_base', '>=', (float) $filters['min_price']);
            });
        }
        if (isset($filters['max_price'])) {
            $query->where(function ($price) use ($filters): void {
                $price->whereNull('price_min_base')->orWhere('price_min_base', '<=', (float) $filters['max_price']);
            });
        }
        if (($filters['available_only'] ?? false) || ($filters['in_stock'] ?? false)) {
            $query->where('is_available', true);
        }

        foreach (['category_id', 'sub_category_id', 'service_category_id', 'service_subcategory_id'] as $facet) {
            if (! empty($filters[$facet])) {
                $query->where("facets->{$facet}", (int) $filters[$facet]);
            }
        }
        if (! empty($filters['service_category'])) {
            $query->where('facets->service_category', $filters['service_category']);
        }
        if (! empty($filters['service_subcategory'])) {
            $query->where('facets->service_subcategory', $filters['service_subcategory']);
        }
        if (! empty($filters['location'])) {
            $location = '%'.mb_strtolower(trim((string) $filters['location'])).'%';
            $query->where(fn ($where) => $where->whereRaw('LOWER(COALESCE(city, ?)) LIKE ?', ['', $location])->orWhereRaw('LOWER(COALESCE(region, ?)) LIKE ?', ['', $location]));
        }
        if (isset($filters['lat'], $filters['lng'])) {
            $lat = (float) $filters['lat'];
            $lng = (float) $filters['lng'];
            $radius = max(1, min(300, (float) ($filters['radius_km'] ?? 25)));
            $latDelta = $radius / 111.32;
            $lngDelta = $radius / max(1, 111.32 * cos(deg2rad($lat)));
            $query->whereBetween('latitude', [$lat - $latDelta, $lat + $latDelta])
                ->whereBetween('longitude', [$lng - $lngDelta, $lng + $lngDelta]);
            if ($driver === 'pgsql') {
                $query->whereRaw(
                    '(6371 * acos(LEAST(1, cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))) <= ?',
                    [$lat, $lng, $lat, $radius]
                );
            }
        }

        $attributes = is_array($filters['attributes'] ?? null) ? $filters['attributes'] : [];
        if ($attributes !== []) {
            $query->whereExists(function ($chunk) use ($attributes, $filters, $tokens): void {
                $chunk->selectRaw('1')->from('search_index_chunks')
                    ->whereColumn('search_index_chunks.search_index_id', 'search_index.id')
                    ->where('search_index_chunks.chunk_type', 'variant');
                foreach ($attributes as $values) {
                    foreach ((array) $values as $value) {
                        $chunk->whereRaw('LOWER(search_index_chunks.content) LIKE ?', ['%'.mb_strtolower((string) $value).'%']);
                    }
                }
                if (isset($filters['min_price'])) {
                    $chunk->where('search_index_chunks.price_max', '>=', (float) $filters['min_price']);
                }
                if (isset($filters['max_price'])) {
                    $chunk->where('search_index_chunks.price_min', '<=', (float) $filters['max_price']);
                }
                if (($filters['available_only'] ?? false) || ($filters['in_stock'] ?? false)) {
                    $chunk->where('search_index_chunks.in_stock', true);
                }
            });
        }
    }

    private function hybridCandidates($lexicalQuery, $filteredQuery, string $queryText, int $page, int $perPage): Collection
    {
        $limit = min((int) config('search.candidate_limit', 250), max(50, $page * $perPage * 4));
        $lexical = (clone $lexicalQuery)->limit($limit)->get();
        $scores = [];
        foreach ($lexical->values() as $rank => $entry) {
            $scores[$entry->id] = ($scores[$entry->id] ?? 0) + 1 / (60 + $rank + 1);
        }

        try {
            $vector = $this->embeddings->queryEmbedding($queryText);
            if ($vector) {
                $literal = '['.implode(',', $vector).']';
                $semantic = DB::select(<<<'SQL'
                    SELECT si.id, MIN(sic.embedding <=> CAST(? AS vector)) AS distance
                    FROM search_index_chunks sic
                    JOIN search_index si ON si.id = sic.search_index_id
                    WHERE si.generation = ? AND si.is_searchable = true AND sic.embedding IS NOT NULL
                    GROUP BY si.id
                    ORDER BY distance ASC
                    LIMIT ?
                SQL, [$literal, (int) config('search.generation', 1), $limit]);
                $semanticIds = collect($semantic)->pluck('id')->map(fn ($id) => (int) $id)->all();
                $eligibleIds = (clone $filteredQuery)->whereIn('id', $semanticIds)->pluck('id')->map(fn ($id) => (int) $id)->flip();
                $semanticRank = 0;
                foreach ($semantic as $row) {
                    $id = (int) $row->id;
                    if (! $eligibleIds->has($id)) {
                        continue;
                    }
                    $scores[$id] = ($scores[$id] ?? 0) + 1 / (60 + $semanticRank + 1);
                    $semanticRank++;
                }
            }
        } catch (\Throwable) {
            // Lexical results remain the guaranteed fallback.
        }

        arsort($scores);
        $ids = array_keys($scores);
        $entries = SearchIndexEntry::query()->whereIn('id', $ids)->get()->keyBy('id');
        return collect($ids)->map(fn ($id) => $entries->get($id))->filter()->values();
    }

    private function hydrate(Collection $entries, Request $request, string $queryText, array $filters): Collection
    {
        $productIds = $entries->whereIn('entity_type', ['product', 'service'])->pluck('source_id');
        $postIds = $entries->where('entity_type', 'post')->pluck('source_id');
        $products = Product::query()->whereIn('id', $productIds)->with(['merchant', 'images', 'attributes', 'variants', 'postTags.post'])->get()->keyBy('id');
        $posts = Post::query()->whereIn('id', $postIds)->with([
            'merchant.storefrontSetting', 'linkedContentItem', 'media.productImage', 'productTags.product.attributes',
            'productTags.product.images', 'reactions', 'promotableProducts', 'promotableBundles', 'promotableSubscriptions', 'promotableOfferingGroups',
        ])->get()->keyBy('id');

        return $entries->map(function (SearchIndexEntry $entry, int $position) use ($products, $posts, $request, $queryText, $filters) {
            $payload = $entry->display_data ?: [];
            $legacyType = $entry->entity_type;
            if (in_array($entry->entity_type, ['product', 'service'], true)) {
                $product = $products->get($entry->source_id);
                if (! $product) {
                    return null;
                }
                $payload = (new ProductResource($product))->resolve($request);
                $legacyType = 'product';
            } elseif ($entry->entity_type === 'post') {
                $post = $posts->get($entry->source_id);
                if (! $post) {
                    return null;
                }
                $payload = (new PostResource($post))->resolve($request);
                $legacyType = 'post';
            } elseif ($entry->entity_type === 'merchant') {
                $legacyType = 'merchant';
            }

            $matchedVariant = $this->matchedVariant($entry, $queryText, $filters);
            return [
                'id' => (int) $entry->id,
                'type' => $legacyType,
                'entity_type' => $entry->entity_type,
                'entity_id' => (int) $entry->entity_id,
                'content_type' => $entry->content_type,
                'card_type' => $entry->card_type,
                'canonical_group_key' => $entry->canonical_group_key,
                'matched_variant' => $matchedVariant,
                'payload' => $payload,
                'tracking' => ['position' => $position + 1, 'index_version' => (int) $entry->index_version],
            ];
        })->filter()->unique('canonical_group_key')->values();
    }

    private function matchedVariant(SearchIndexEntry $entry, string $queryText, array $filters): ?array
    {
        if (! in_array($entry->entity_type, ['product', 'service'], true)) {
            return null;
        }
        $query = $entry->chunks()->where('chunk_type', 'variant');
        $tokens = $this->tokens($queryText);
        $attributeValues = collect($filters['attributes'] ?? [])->flatten()->map(fn ($value) => mb_strtolower((string) $value));
        $matchTerms = collect($tokens)->merge($attributeValues)->filter()->unique()->values();
        if ($matchTerms->isNotEmpty()) {
            $query->where(function ($where) use ($matchTerms): void {
                foreach ($matchTerms as $term) {
                    $where->orWhereRaw('LOWER(content) LIKE ?', ['%'.$term.'%']);
                }
            });
        }
        if (isset($filters['max_price'])) {
            $query->where('price_min', '<=', (float) $filters['max_price']);
        }
        if (($filters['available_only'] ?? false) || ($filters['in_stock'] ?? false)) {
            $query->where('in_stock', true);
        }
        $chunks = $query->limit(30)->get();
        $chunk = $chunks->sortByDesc(function ($candidate) use ($matchTerms): int {
            $content = mb_strtolower((string) $candidate->content);
            return $matchTerms->sum(fn ($term) => str_contains($content, $term) ? 1 : 0)
                + ($candidate->in_stock ? 2 : 0);
        })->first();
        if (! $chunk) {
            return null;
        }
        return array_merge($chunk->facets ?: [], [
            'price' => $chunk->price_min !== null ? (float) $chunk->price_min : null,
            'currency' => $entry->currency_code,
            'in_stock' => $chunk->in_stock,
        ]);
    }

    private function parseNaturalConstraints(string $query): array
    {
        $result = [];
        $budgetPattern = '/(?:under|below|less than|up to|hadi|chini ya)\s*(?:tzs|tsh|\$)?\s*([0-9][0-9,.]*)/iu';
        $minimumPattern = '/(?:over|above|more than|at least|zaidi ya)\s*(?:tzs|tsh|\$)?\s*([0-9][0-9,.]*)/iu';
        if (preg_match($budgetPattern, $query, $match)) {
            $result['max_price'] = (float) str_replace([',', ' '], '', $match[1]);
        }
        if (preg_match($minimumPattern, $query, $match)) {
            $result['min_price'] = (float) str_replace([',', ' '], '', $match[1]);
        }
        $result['_search_query'] = trim(preg_replace('/\s+/', ' ', preg_replace([$budgetPattern, $minimumPattern], '', $query)) ?? $query);
        return $result;
    }

    private function tokens(string $query): array
    {
        return collect(preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($query)) ?: [])
            ->filter(fn ($token) => mb_strlen($token) >= 2)
            ->reject(fn ($token) => in_array($token, ['under', 'below', 'less', 'than', 'hadi', 'chini', 'above', 'over', 'zaidi', 'the', 'and', 'kwa', 'ya', 'na'], true))
            ->unique()->take(12)->values()->all();
    }

    private function publicFilters(array $filters): array
    {
        return collect($filters)->only([
            'type', 'surface', 'entity_types', 'content_types', 'min_price', 'max_price', 'currency', 'attributes',
            'country_id', 'merchant_id', 'category_id', 'sub_category_id', 'service_category_id', 'service_subcategory_id',
            'service_category', 'service_subcategory', 'location', 'lat', 'lng', 'radius_km', 'available_only', 'in_stock',
        ])->all();
    }
}
