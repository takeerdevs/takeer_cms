<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Http\Resources\SubscriptionPlanResource;
use App\Models\Country;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Services\DiscoveryRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DiscoveryController extends Controller
{
    public function rails(Request $request, DiscoveryRankingService $ranking): JsonResponse
    {
        $validated = $request->validate([
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            'country_id' => 'nullable|integer|exists:countries,id',
            'location' => 'nullable|string|max:120',
            'radius_km' => 'nullable|numeric|min:1|max:300',
        ]);

        $detectedCountryId = $this->detectedCountryId($request);

        $filters = [
            'lat' => $validated['lat'] ?? null,
            'lng' => $validated['lng'] ?? null,
            'country_id' => $validated['country_id'] ?? $detectedCountryId,
            'location' => trim((string) ($validated['location'] ?? '')),
            'radius_km' => $validated['radius_km'] ?? 25,
        ];

        return response()->json([
            'rails' => array_values(array_filter([
                $this->productRail(
                    key: 'nearby',
                    title: 'Nearby Picks',
                    subtitle: 'Physical products from shops in your country',
                    products: $this->physicalProducts($filters),
                    filters: $filters,
                    ranking: $ranking,
                ),
                $this->productRail(
                    key: 'premium_media',
                    title: 'Premium Media',
                    subtitle: 'Videos, audio, and gallery packs creators are selling',
                    products: $this->premiumMediaProducts($filters),
                    filters: $filters,
                    ranking: $ranking,
                ),
                $this->productRail(
                    key: 'downloads',
                    title: 'Downloads & Assets',
                    subtitle: 'Templates, documents, software, and digital files',
                    products: $this->downloadProducts($filters),
                    filters: $filters,
                    ranking: $ranking,
                ),
                $this->productRail(
                    key: 'events',
                    title: 'Upcoming Live Events',
                    subtitle: 'Paid webinars, workshops, and creator sessions',
                    products: $this->liveEventProducts($filters),
                    filters: $filters,
                    ranking: $ranking,
                ),
                $this->productRail(
                    key: 'services',
                    title: 'Popular Services',
                    subtitle: 'Bookable services from active providers',
                    products: $this->serviceProducts($filters),
                    filters: $filters,
                    ranking: $ranking,
                ),
                $this->subscriptionRail($filters),
            ])),
        ]);
    }

    private function productRail(string $key, string $title, string $subtitle, $products, array $filters, DiscoveryRankingService $ranking): ?array
    {
        if ($products->isEmpty()) {
            return null;
        }

        $products = $products
            ->sortByDesc(fn (Product $product) => $ranking->productSearchBoost($product) + $ranking->locationBoost($product, $filters))
            ->take(10)
            ->values();

        $items = ProductResource::collection($products)->resolve(request());

        return [
            'key' => $key,
            'title' => $title,
            'subtitle' => $subtitle,
            'type' => 'products',
            'items' => collect($items)->map(function (array $item) use ($products, $filters, $ranking) {
                $product = $products->firstWhere('id', (int) ($item['id'] ?? 0));

                return array_merge($item, [
                    'discovery_location' => $product ? $ranking->discoveryLocation($product, $filters) : null,
                ]);
            })->values(),
        ];
    }

    private function subscriptionRail(array $filters): ?array
    {
        $plans = SubscriptionPlan::query()
            ->where('status', 'active')
            ->whereHas('merchant', function ($merchant) use ($filters): void {
                $merchant->where('is_active', true)
                    ->where('is_suspended', false)
                    ->when($filters['country_id'] ?? null, fn ($query, $countryId) => $query->where('country_id', $countryId));
            })
            ->with(['merchant:id,display_name,username', 'items'])
            ->withCount('subscriptions')
            ->latest()
            ->limit(20)
            ->get()
            ->sortByDesc(fn (SubscriptionPlan $plan) => ((int) ($plan->subscriptions_count ?? 0) * 10) + (int) $plan->tier)
            ->take(10)
            ->values();

        if ($plans->isEmpty()) {
            return null;
        }

        return [
            'key' => 'memberships',
            'title' => 'Creator Clubs',
            'subtitle' => 'Memberships with exclusive content and recurring access',
            'type' => 'subscriptions',
            'items' => SubscriptionPlanResource::collection($plans)->resolve(request()),
        ];
    }

    private function baseProductQuery(array $filters)
    {
        return Product::query()
            ->whereHas('merchant', function ($merchant) use ($filters): void {
                $merchant->where('is_active', true)
                    ->where('is_suspended', false)
                    ->when($filters['country_id'] ?? null, fn ($query, $countryId) => $query->where('country_id', $countryId));
            })
            ->with([
                'merchant:id,display_name,username,avatar_url,is_verified,kyc_status,successful_sales,unsuccessful_sales,user_id,country_id',
                'merchant.locations:id,merchant_id,name,address,city,region,latitude,longitude,is_primary,allow_self_pickup',
                'attributes',
                'images',
                'variants',
                'categoryAttributeValues.categoryAttribute',
            ])
            ->latest();
    }

    private function physicalProducts(array $filters)
    {
        $query = $this->baseProductQuery($filters)
            ->where('type', 'physical');

        if (($filters['location'] ?? '') !== '') {
            $location = '%' . $filters['location'] . '%';
            $operator = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->whereHas('merchant.locations', function ($loc) use ($location, $operator): void {
                $loc->where('name', $operator, $location)
                    ->orWhere('address', $operator, $location)
                    ->orWhere('city', $operator, $location)
                    ->orWhere('region', $operator, $location);
            });
        }

        return $query->limit(40)->get();
    }

    private function premiumMediaProducts(array $filters)
    {
        return $this->baseProductQuery($filters)
            ->where('type', 'digital')
            ->whereIn('digital_delivery_type', ['video_stream', 'audio_stream', 'gallery_pack'])
            ->limit(30)
            ->get();
    }

    private function downloadProducts(array $filters)
    {
        return $this->baseProductQuery($filters)
            ->where('type', 'digital')
            ->where(function ($query): void {
                $query->whereNull('digital_delivery_type')
                    ->orWhereIn('digital_delivery_type', ['file', 'external_link']);
            })
            ->limit(30)
            ->get();
    }

    private function liveEventProducts(array $filters)
    {
        return $this->baseProductQuery($filters)
            ->where('type', 'digital')
            ->where('digital_delivery_type', 'live_event')
            ->where(function ($query): void {
                $query->whereNull('live_event_starts_at')
                    ->orWhere('live_event_starts_at', '>=', now()->subHours(2));
            })
            ->orderByRaw('live_event_starts_at IS NULL, live_event_starts_at ASC')
            ->limit(30)
            ->get();
    }

    private function serviceProducts(array $filters)
    {
        return $this->baseProductQuery($filters)
            ->where('type', 'service')
            ->limit(30)
            ->get();
    }

    private function detectedCountryId(Request $request): ?int
    {
        $isoAlpha2 = $request->session()->get('user_session_country.iso_alpha2');

        if (! $isoAlpha2) {
            return null;
        }

        return Country::query()
            ->where('iso_alpha2', strtoupper((string) $isoAlpha2))
            ->value('id');
    }
}
