<?php

namespace App\Services;

use App\Models\Post;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class DiscoveryRankingService
{
    /**
     * Rank public feed posts with a commerce-aware score.
     */
    public function rankPostQuery(Builder $query): Builder
    {
        return $query
            ->whereHas('merchant', function (Builder $merchant): void {
                $merchant->where('is_active', true)
                    ->where('is_suspended', false);
            })
            ->orderByRaw($this->postScoreSql() . ' DESC', [
                now()->subDays(2),
                now()->subDays(7),
                now()->subDays(30),
            ])
            ->latest('posts.created_at');
    }

    public function postSearchBoost(Post $post): int
    {
        $ageHours = max(1, now()->diffInHours($post->created_at));
        $recency = match (true) {
            $ageHours <= 48 => 18,
            $ageHours <= 168 => 10,
            $ageHours <= 720 => 4,
            default => 0,
        };

        $merchantBoost = $post->merchant?->is_verified ? 12 : 0;
        $commerceBoost = ($post->content_item_id || $post->productTags->isNotEmpty() || $post->promotables->isNotEmpty()) ? 18 : 0;

        return (int) round(
            $recency
            + $merchantBoost
            + $commerceBoost
            + ((int) $post->views_count * 0.05)
            + ((int) $post->click_count * 0.7)
            + ((int) $post->likes_count * 2)
            + ((int) $post->comment_count * 3)
            + ((int) $post->share_count * 4)
        );
    }

    public function productSearchBoost(Product $product): int
    {
        $merchant = $product->merchant;
        $trustBoost = $merchant?->is_verified ? 18 : 0;
        $salesBoost = min(35, (int) ($merchant?->successful_sales ?? 0) * 2);
        $mediaBoost = $product->images->isNotEmpty() ? 10 : 0;
        $digitalBoost = $product->type === 'digital' ? 10 : 0;
        $creatorOfferBoost = in_array($product->digital_delivery_type, [
            'video_stream',
            'audio_stream',
            'gallery_pack',
            'live_event',
            'custom_delivery',
        ], true) ? 18 : 0;

        return (int) round(
            $trustBoost
            + $salesBoost
            + $mediaBoost
            + $digitalBoost
            + $creatorOfferBoost
            + min(30, (int) $product->views_count * 0.05)
        );
    }

    public function locationBoost(Product $product, array $filters): int
    {
        if (! in_array($product->type, ['physical', 'service'], true)) {
            return 0;
        }

        $area = mb_strtolower(trim((string) ($filters['location'] ?? '')));
        $lat = isset($filters['lat']) ? (float) $filters['lat'] : null;
        $lng = isset($filters['lng']) ? (float) $filters['lng'] : null;
        $radiusKm = max(1, min(300, (float) ($filters['radius_km'] ?? 25)));
        $locations = $this->searchableLocations($product);

        if ($locations->isEmpty()) {
            return 0;
        }

        $boost = 0;

        if ($area !== '') {
            $matchesArea = $locations->contains(function ($location) use ($area): bool {
                $blob = mb_strtolower(implode(' ', array_filter([
                    $location->name,
                    $location->address,
                    $location->city,
                    $location->region,
                ])));

                return str_contains($blob, $area);
            });

            if ($matchesArea) {
                $boost += 70;
            }
        }

        if ($lat !== null && $lng !== null) {
            $nearest = $this->nearestLocation($locations, $lat, $lng);
            if ($nearest && $nearest['distance_km'] <= $radiusKm) {
                $boost += (int) round(90 - min(80, $nearest['distance_km'] * 2));
            }
        }

        return max(0, $boost);
    }

    public function discoveryLocation(Product $product, array $filters): ?array
    {
        $locations = $this->searchableLocations($product);
        if ($locations->isEmpty()) {
            return null;
        }

        $lat = isset($filters['lat']) ? (float) $filters['lat'] : null;
        $lng = isset($filters['lng']) ? (float) $filters['lng'] : null;
        $location = null;
        $distanceKm = null;

        if ($lat !== null && $lng !== null) {
            $nearest = $this->nearestLocation($locations, $lat, $lng);
            $location = $nearest['location'] ?? null;
            $distanceKm = $nearest['distance_km'] ?? null;
        }

        $location ??= $locations->firstWhere('is_primary', true) ?: $locations->first();

        return $location ? [
            'name' => $location->name,
            'address' => $location->address,
            'city' => $location->city,
            'region' => $location->region,
            'allow_self_pickup' => (bool) $location->allow_self_pickup,
            'distance_km' => $distanceKm !== null ? round($distanceKm, 1) : null,
        ] : null;
    }

    public function isInsideSearchRadius(Product $product, array $filters): bool
    {
        $lat = isset($filters['lat']) ? (float) $filters['lat'] : null;
        $lng = isset($filters['lng']) ? (float) $filters['lng'] : null;

        if ($lat === null || $lng === null) {
            return true;
        }

        if (! in_array($product->type, ['physical', 'service'], true)) {
            return false;
        }

        $nearest = $this->nearestLocation($this->searchableLocations($product), $lat, $lng);
        if (! $nearest) {
            return false;
        }

        $radiusKm = max(1, min(300, (float) ($filters['radius_km'] ?? 25)));

        return $nearest['distance_km'] <= $radiusKm;
    }

    private function searchableLocations(Product $product): Collection
    {
        if ($product->type === 'service') {
            $provider = $this->serviceProviderLocation($product);
            if ($provider) {
                return collect([$provider]);
            }
        }

        return $product->merchant?->locations ?: collect();
    }

    private function serviceProviderLocation(Product $product): ?object
    {
        $location = $product->service_provider_location ?: [];
        $lat = $location['lat'] ?? $location['latitude'] ?? null;
        $lng = $location['lng'] ?? $location['longitude'] ?? null;

        if ($lat === null || $lng === null) {
            return null;
        }

        return (object) [
            'name' => $location['name'] ?? 'Service location',
            'address' => $location['address'] ?? null,
            'city' => $location['city'] ?? null,
            'region' => $location['region'] ?? null,
            'latitude' => $lat,
            'longitude' => $lng,
            'is_primary' => true,
            'allow_self_pickup' => false,
        ];
    }

    private function nearestLocation(Collection $locations, float $lat, float $lng): ?array
    {
        return $locations
            ->filter(fn ($location) => $location->latitude !== null && $location->longitude !== null)
            ->map(fn ($location) => [
                'location' => $location,
                'distance_km' => $this->distanceKm($lat, $lng, (float) $location->latitude, (float) $location->longitude),
            ])
            ->sortBy('distance_km')
            ->first();
    }

    private function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusKm = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadiusKm * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function postScoreSql(): string
    {
        return "(
            (COALESCE(posts.views_count, 0) * 0.05)
            + (COALESCE(posts.click_count, 0) * 0.7)
            + (COALESCE(posts.likes_count, 0) * 2)
            + (COALESCE(posts.comment_count, 0) * 3)
            + (COALESCE(posts.share_count, 0) * 4)
            + CASE
                WHEN posts.created_at >= ? THEN 18
                WHEN posts.created_at >= ? THEN 10
                WHEN posts.created_at >= ? THEN 4
                ELSE 0
              END
            + CASE
                WHEN posts.content_item_id IS NOT NULL
                    OR EXISTS (
                        SELECT 1 FROM post_product_tags
                        WHERE post_product_tags.post_id = posts.id
                    )
                    OR EXISTS (
                        SELECT 1 FROM post_promotables
                        WHERE post_promotables.post_id = posts.id
                    )
                THEN 18
                ELSE 0
              END
        )";
    }
}
