<?php

namespace App\Services;

final class TryOnProviderResult
{
    public function __construct(
        public readonly string $contents,
        public readonly string $mimeType = 'image/jpeg',
        public readonly array $metadata = [],
    ) {
    }
}
