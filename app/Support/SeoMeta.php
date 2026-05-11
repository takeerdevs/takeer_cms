<?php

namespace App\Support;

use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\MerchantGroupSaleCampaign;
use App\Models\PaymentPage;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Support\Str;

class SeoMeta
{
    public const DEFAULT_DESCRIPTION = 'Create a business profile, offer services, sell physical or digital products, accept bookings, and manage customer interactions from one place.';

    public static function make(array $meta = []): array
    {
        $title = self::clean($meta['title'] ?? 'Takeer | Sell Services, Physical Products and Digital Products Online');
        $description = self::description($meta['description'] ?? self::DEFAULT_DESCRIPTION);
        $canonical = $meta['canonical'] ?? url()->current();
        $image = self::absoluteUrl($meta['image'] ?? null);
        $siteName = $meta['site_name'] ?? 'Takeer';

        return array_filter([
            'title' => $title,
            'description' => $description,
            'canonical' => $canonical,
            'image' => $image,
            'type' => $meta['type'] ?? 'website',
            'site_name' => $siteName,
            'robots' => $meta['robots'] ?? 'index,follow',
            'twitter_card' => $image ? 'summary_large_image' : 'summary',
            'structured_data' => $meta['structured_data'] ?? [],
        ], fn($value) => $value !== null && $value !== '' && $value !== []);
    }

    public static function home(): array
    {
        return self::make([
            'title' => 'Takeer | Sell Services, Physical Products and Digital Products Online',
            'description' => self::DEFAULT_DESCRIPTION,
            'structured_data' => [
                self::organizationSchema(),
                self::websiteSchema(),
            ],
        ]);
    }

    public static function feed(): array
    {
        return self::make([
            'title' => 'Discover Products, Services and Digital Downloads | Takeer',
            'description' => 'Discover services, physical products, digital products, creator content, and business offers from sellers on Takeer.',
            'canonical' => url('/feed'),
            'structured_data' => [
                self::organizationSchema(),
                self::websiteSchema(),
            ],
        ]);
    }

    public static function search(?string $query = null): array
    {
        $query = trim((string) $query);

        return self::make([
            'title' => $query !== '' ? "Search results for {$query} | Takeer" : 'Search Products and Services | Takeer',
            'description' => $query !== ''
                ? "Search Takeer for {$query}, including services, physical products, digital products, and creator offers."
                : 'Search Takeer for services, physical products, digital products, and creator offers.',
            'canonical' => url('/search'),
            'structured_data' => [self::websiteSchema()],
        ]);
    }

    public static function merchant(Merchant $merchant, string $surface = 'storefront'): array
    {
        $name = self::merchantName($merchant);
        $surfaceTitle = match ($surface) {
            'profile' => 'Profile',
            'catalog' => 'Catalog',
            'feed' => 'Feed',
            'products' => 'Products',
            'downloads' => 'Digital Downloads',
            'services' => 'Services',
            'content' => 'Content',
            'bundles' => 'Bundles',
            'courses' => 'Courses',
            'memberships' => 'Memberships',
            default => 'Storefront',
        };
        $path = match ($surface) {
            'profile' => "/u/{$merchant->username}",
            'catalog' => "/u/{$merchant->username}/catalog",
            'feed' => "/m/{$merchant->username}/feed",
            'products', 'downloads', 'services', 'content', 'bundles', 'courses', 'memberships' => "/m/{$merchant->username}/{$surface}",
            default => "/m/{$merchant->username}",
        };
        $description = $merchant->bio ?: "{$name} sells services, physical products, digital products, and creator offers on Takeer.";

        return self::make([
            'title' => "{$name} {$surfaceTitle} | Takeer",
            'description' => $description,
            'canonical' => url($path),
            'image' => $merchant->avatar_url,
            'structured_data' => [
                self::localBusinessSchema($merchant),
                self::breadcrumbSchema([
                    ['name' => 'Takeer', 'url' => url('/')],
                    ['name' => $name, 'url' => url($path)],
                ]),
            ],
        ]);
    }

    public static function product(Product $product): array
    {
        $product->loadMissing(['merchant', 'images']);
        $title = self::clean($product->title);
        $merchant = $product->merchant;
        $description = $product->description ?: "{$title} by " . self::merchantName($merchant) . '. Buy or book this offer securely on Takeer.';
        $productUrl = self::productUrl($product);

        return self::make([
            'title' => "{$title} | Takeer",
            'description' => $description,
            'canonical' => $productUrl,
            'image' => $product->image_url,
            'type' => 'product',
            'structured_data' => [
                self::productSchema($product),
                self::breadcrumbSchema([
                    ['name' => 'Takeer', 'url' => url('/')],
                    ['name' => self::merchantName($merchant), 'url' => url('/m/' . $merchant?->username)],
                    ['name' => $title, 'url' => $productUrl],
                ]),
            ],
        ]);
    }

    public static function content(ContentItem $contentItem): array
    {
        $contentItem->loadMissing('merchant');
        $title = trim((string) $contentItem->title) === '__short_locked__'
            ? 'Premium content'
            : self::clean($contentItem->title ?: 'Premium content');
        $description = self::contentDescription($contentItem, $title);

        return self::make([
            'title' => "{$title} | Takeer",
            'description' => $description,
            'canonical' => route('content.show', $contentItem),
            'type' => 'article',
            'structured_data' => [
                self::creativeWorkSchema($title, $description, route('content.show', $contentItem), $contentItem->merchant),
            ],
        ]);
    }

    public static function bundle(Bundle $bundle): array
    {
        $bundle->loadMissing('merchant');
        $title = self::clean($bundle->title);
        $description = $bundle->description ?: "{$title} by " . self::merchantName($bundle->merchant) . '. Buy this bundle securely on Takeer.';

        return self::make([
            'title' => "{$title} | Takeer",
            'description' => $description,
            'canonical' => route('bundle.show', $bundle),
            'structured_data' => [
                self::offerSchema($title, $description, route('bundle.show', $bundle), $bundle->price ?? null, $bundle->merchant),
            ],
        ]);
    }

    public static function subscriptionPlan(SubscriptionPlan $plan): array
    {
        $plan->loadMissing('merchant');
        $title = self::clean($plan->name);
        $description = $plan->description ?: "Join {$title} by " . self::merchantName($plan->merchant) . ' on Takeer.';

        return self::make([
            'title' => "{$title} | Takeer",
            'description' => $description,
            'canonical' => route('subscription-plan.show', $plan),
            'structured_data' => [
                self::offerSchema($title, $description, route('subscription-plan.show', $plan), $plan->price ?? null, $plan->merchant),
            ],
        ]);
    }

    public static function post(Post $post): array
    {
        $post->loadMissing([
            'merchant',
            'media.productImage',
            'linkedContentItem',
            'linkedProduct.images',
            'product.images',
            'promotableProducts',
            'promotableBundles',
            'promotableSubscriptions',
        ]);
        $title = self::clean($post->title ?: self::merchantName($post->merchant) . ' post');
        $description = self::postDescription($post, $title);
        $image = $post->media->first()?->productImage?->thumbnail_url
            ?? $post->media->first()?->productImage?->image_url
            ?? $post->linkedProduct?->image_url
            ?? $post->product?->image_url
            ?? $post->merchant?->avatar_url;

        return self::make([
            'title' => "{$title} | Takeer",
            'description' => $description ?: 'View this public post on Takeer.',
            'canonical' => route('post.show', $post->public_id ?: $post->id),
            'image' => $image,
            'type' => 'article',
        ]);
    }

    public static function paymentPage(PaymentPage $page): array
    {
        $page->loadMissing('merchant');
        $title = self::clean($page->title);

        return self::make([
            'title' => "{$title} | Secured by Takeer",
            'description' => $page->description ?: 'Complete a secure checkout on Takeer.',
            'canonical' => route('payment-page.show', $page->slug),
            'image' => $page->cover_image ?: $page->merchant?->avatar_url,
            'structured_data' => [
                self::offerSchema($title, $page->description ?: 'Secure checkout on Takeer.', route('payment-page.show', $page->slug), $page->amount, $page->merchant),
            ],
        ]);
    }

    public static function groupSale(MerchantGroupSaleCampaign $campaign): array
    {
        $campaign->loadMissing(['merchant', 'product.images']);
        $title = self::clean($campaign->title);
        $description = $campaign->description ?: 'Join this group-sale offer on Takeer.';

        return self::make([
            'title' => "{$title} | Takeer Group Sale",
            'description' => $description,
            'canonical' => route('group-sale.show', $campaign->slug),
            'image' => $campaign->product?->image_url ?: $campaign->merchant?->avatar_url,
            'type' => 'product',
        ]);
    }

    public static function campaign(Merchant $merchant, string $title, ?string $description, string $code): array
    {
        return self::make([
            'title' => self::clean($title) . ' | ' . self::merchantName($merchant) . ' | Takeer',
            'description' => $description ?: 'A special campaign from this seller on Takeer.',
            'canonical' => route('campaign.show', [$merchant, $code]),
            'image' => $merchant->avatar_url,
        ]);
    }

    public static function staticPage(string $title, string $description, string $path): array
    {
        return self::make([
            'title' => "{$title} | Takeer",
            'description' => $description,
            'canonical' => url($path),
        ]);
    }

    public static function absoluteUrl(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }
        if (Str::startsWith($url, ['http://', 'https://'])) {
            return $url;
        }

        return url($url);
    }

    private static function clean(?string $value): string
    {
        return trim(preg_replace('/\s+/', ' ', strip_tags((string) $value))) ?: 'Takeer';
    }

    private static function description(?string $value): string
    {
        $value = self::clean($value);

        return Str::limit($value, 180, '');
    }

    private static function merchantName(?Merchant $merchant): string
    {
        return self::clean($merchant?->display_name ?: $merchant?->username ?: 'Seller');
    }

    private static function contentDescription(ContentItem $contentItem, string $title): string
    {
        $merchantName = self::merchantName($contentItem->merchant);
        $isPaid = $contentItem->price !== null;
        $isShortLocked = $contentItem->format === 'plain_text'
            || trim((string) $contentItem->title) === '__short_locked__';

        if ($isPaid && $isShortLocked) {
            return "Unlock {$title} by {$merchantName} on Takeer to access this premium content.";
        }

        if ($isPaid) {
            $excerpt = self::publicTeaser($contentItem->excerpt);

            return $excerpt ?: "Unlock {$title} by {$merchantName} on Takeer to access the full premium content.";
        }

        return self::publicTeaser($contentItem->excerpt)
            ?: "Read {$title} by {$merchantName} on Takeer.";
    }

    private static function postDescription(Post $post, string $title): string
    {
        $isRestricted = self::postIsRestricted($post);
        $merchantName = self::merchantName($post->merchant);

        if ($isRestricted) {
            return "Unlock {$title} by {$merchantName} on Takeer";
        }

        return self::publicTeaser($post->excerpt)
            ?: self::publicTeaser($post->caption)
            ?: 'View this public post on Takeer';
    }

    private static function postIsRestricted(Post $post): bool
    {
        $hasPromotableGate = collect()
            ->concat($post->relationLoaded('promotableProducts') ? $post->promotableProducts : [])
            ->concat($post->relationLoaded('promotableBundles') ? $post->promotableBundles : [])
            ->concat($post->relationLoaded('promotableSubscriptions') ? $post->promotableSubscriptions : [])
            ->isNotEmpty();

        $hasPaidLinkedContent = $post->relationLoaded('linkedContentItem')
            && $post->linkedContentItem
            && $post->linkedContentItem->price !== null;

        return (bool) ($post->is_restricted ?? false)
            || $hasPromotableGate
            || $post->restricted_price !== null
            || $hasPaidLinkedContent;
    }

    private static function publicTeaser(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        $value = preg_replace('/\s*Tap unlock to continue\.\s*$/i', '', $value);
        $value = self::clean($value);

        return $value !== '' ? Str::limit($value, 155, '') : null;
    }

    private static function organizationSchema(): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'Organization',
            'name' => 'Takeer',
            'url' => url('/'),
        ];
    }

    private static function websiteSchema(): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'WebSite',
            'name' => 'Takeer',
            'url' => url('/'),
            'potentialAction' => [
                '@type' => 'SearchAction',
                'target' => url('/search') . '?q={search_term_string}',
                'query-input' => 'required name=search_term_string',
            ],
        ];
    }

    private static function localBusinessSchema(Merchant $merchant): array
    {
        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'LocalBusiness',
            'name' => self::merchantName($merchant),
            'url' => url('/m/' . $merchant->username),
            'image' => self::absoluteUrl($merchant->avatar_url),
            'description' => self::description($merchant->bio ?: self::merchantName($merchant) . ' on Takeer.'),
        ]);
    }

    private static function productSchema(Product $product): array
    {
        $price = $product->discounted_price ?? $product->price;
        $rating = self::productRatingSummary($product);

        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'Product',
            'name' => self::clean($product->title),
            'description' => self::description($product->description ?: $product->title),
            'image' => self::absoluteUrl($product->image_url),
            'brand' => [
                '@type' => 'Brand',
                'name' => self::merchantName($product->merchant),
            ],
            'offers' => $price !== null ? [
                '@type' => 'Offer',
                'url' => self::productUrl($product),
                'priceCurrency' => $product->merchant?->currency?->code ?? 'TZS',
                'price' => (float) $price,
                'availability' => 'https://schema.org/InStock',
            ] : null,
            'aggregateRating' => $rating['count'] > 0 ? [
                '@type' => 'AggregateRating',
                'ratingValue' => $rating['average'],
                'reviewCount' => $rating['count'],
                'ratingCount' => $rating['count'],
                'bestRating' => 5,
                'worstRating' => 1,
            ] : null,
        ]);
    }

    private static function productUrl(Product $product): string
    {
        return route('product.show', $product->slug ?: $product->id);
    }

    private static function productRatingSummary(Product $product): array
    {
        $query = \App\Models\ProductReview::query()
            ->where('product_id', $product->id);

        $count = (clone $query)->count();

        return [
            'average' => $count > 0 ? round((float) (clone $query)->avg('rating'), 1) : null,
            'count' => $count,
        ];
    }

    private static function offerSchema(string $title, string $description, string $url, mixed $price, ?Merchant $merchant): array
    {
        return array_filter([
            '@context' => 'https://schema.org',
            '@type' => 'Offer',
            'name' => self::clean($title),
            'description' => self::description($description),
            'url' => $url,
            'priceCurrency' => $merchant?->currency?->code ?? 'TZS',
            'price' => $price !== null ? (float) $price : null,
            'seller' => [
                '@type' => 'Organization',
                'name' => self::merchantName($merchant),
            ],
        ]);
    }

    private static function creativeWorkSchema(string $title, string $description, string $url, ?Merchant $merchant): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'CreativeWork',
            'name' => self::clean($title),
            'description' => self::description($description),
            'url' => $url,
            'author' => [
                '@type' => 'Organization',
                'name' => self::merchantName($merchant),
            ],
        ];
    }

    private static function breadcrumbSchema(array $items): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => collect($items)->values()->map(fn($item, $index) => [
                '@type' => 'ListItem',
                'position' => $index + 1,
                'name' => $item['name'],
                'item' => $item['url'],
            ])->all(),
        ];
    }
}
