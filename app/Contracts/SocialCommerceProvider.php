<?php

namespace App\Contracts;

interface SocialCommerceProvider
{
    public function key(): string;

    public function supports(string $url): bool;

    /** @return array{platform:string,normalized_url:string,url_hash:string,external_post_id:?string} */
    public function normalize(string $url): array;

    /** @return array<string,mixed> */
    public function preview(array $link, array $context = []): array;

    /** @return array<string,mixed>|null */
    public function matchConnectedMerchant(array $link, array $context = []): ?array;

    /** @return array<string,mixed> */
    public function sellerContactOptions(array $link, array $context = []): array;
}
