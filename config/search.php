<?php

return [
    'write_enabled' => (bool) env('SEARCH_INDEX_WRITE', true),
    'read_enabled' => (bool) env('SEARCH_INDEX_READ', true),
    'hybrid_enabled' => (bool) env('SEARCH_HYBRID', true),
    'generation' => (int) env('SEARCH_INDEX_GENERATION', 1),
    'index_version' => 1,
    'queue' => env('SEARCH_INDEX_QUEUE', 'default'),
    'per_page' => 20,
    'max_per_page' => 50,
    'candidate_limit' => 250,
    'embedding' => [
        'endpoint' => env('SEARCH_EMBEDDING_API_URL', 'https://openrouter.ai/api/v1/embeddings'),
        'api_key' => env('SEARCH_EMBEDDING_API_KEY', env('OPENROUTER_API_KEY')),
        'model' => env('SEARCH_EMBEDDING_MODEL'),
        'dimensions' => 512,
        'timeout' => (int) env('SEARCH_EMBEDDING_TIMEOUT', 30),
        'query_cache_seconds' => (int) env('SEARCH_QUERY_EMBEDDING_CACHE_SECONDS', 3600),
    ],
];
