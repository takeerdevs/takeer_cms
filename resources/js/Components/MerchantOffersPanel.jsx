import React, { useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    BookOpenText,
    Crown,
    DownloadCloud,
    Layers,
    ShoppingBag,
} from 'lucide-react';
import { productPriceLabel } from '@/lib/productUnits';
import { useLocale } from '@/lib/i18n';

const OFFER_FILTERS = [
    { key: 'all', label: 'All', countKey: 'shop_total' },
    { key: 'physical', label: 'Products', countKey: 'physical' },
    { key: 'digital', label: 'Digital', countKey: 'digital' },
    { key: 'content', label: 'Content', countKey: 'content' },
    { key: 'bundle', label: 'Bundles', countKey: 'bundles' },
    { key: 'membership', label: 'Memberships', countKey: 'memberships' },
];

export default function MerchantOffersPanel({
    merchantSlug,
    offerCounts = null,
    products = [],
    contentItems = [],
    bundles = [],
    subscriptionPlans = [],
    filter = 'all',
    onFilterChange = null,
    compact = false,
    showFilters = true,
    shopHref = null,
}) {
    const { copy } = useLocale();
    const slug = merchantSlug;
    const allProductsHref = shopHref || `/u/${slug}/shop/all`;

    const visible = useMemo(() => {
        const productList = filter === 'all' || ['physical', 'digital'].includes(filter)
            ? products.filter((product) => ['physical', 'digital'].includes(product.type) && (filter === 'all' || product.type === filter))
            : [];

        return {
            products: productList,
            contentItems: filter === 'all' || filter === 'content' ? contentItems : [],
            bundles: filter === 'all' || filter === 'bundle' ? bundles : [],
            subscriptionPlans: filter === 'all' || filter === 'membership' ? subscriptionPlans : [],
        };
    }, [bundles, contentItems, filter, products, subscriptionPlans]);

    const isEmpty = !visible.products.length
        && !visible.contentItems.length
        && !visible.bundles.length
        && !visible.subscriptionPlans.length;

    const limit = compact ? 3 : null;

    return (
        <div className="space-y-4">
            {showFilters && onFilterChange && (
                <div className="flex gap-1.5 overflow-x-auto px-4 pb-1">
                    {OFFER_FILTERS.map((item) => {
                        const count = offerCounts?.[item.countKey];
                        const isActive = filter === item.key;

                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => onFilterChange(item.key)}
                                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors ${isActive
                                    ? 'bg-foreground text-background'
                                    : 'bg-neutral-100 text-foreground hover:bg-neutral-200'
                                }`}
                            >
                                {copy(item.label, { All: 'Vyote', Products: 'Bidhaa', Digital: 'Kidijitali', Content: 'Maudhui', Bundles: 'Vifurushi', Memberships: 'Uanachama' }[item.label] || item.label)}
                                {count !== null && count !== undefined && (
                                    <span className={isActive ? 'text-background/80' : 'text-muted-foreground'}>
                                        {formatOfferCount(count)}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {isEmpty ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {copy('No offers to show right now.', 'Hakuna ofa za kuonyesha kwa sasa.')}
                </div>
            ) : (
                <div className={compact ? 'space-y-5 px-4' : 'space-y-6 px-4 sm:px-6'}>
                    <OfferSection
                        title={copy('Paid content', 'Maudhui ya kulipia')}
                        items={sliceItems(visible.contentItems, limit)}
                        compact={compact}
                        renderItem={(item) => (
                            <OfferCard
                                key={`content-${item.id}`}
                                href={route('content.show', item.slug || item.id)}
                                title={item.title}
                                subtitle={item.format === 'plain_text' ? copy('Short post', 'Chapisho fupi') : copy('Premium content', 'Maudhui premium')}
                                price={item.price}
                                icon={BookOpenText}
                                compact={compact}
                            />
                        )}
                    />

                    <OfferSection
                        title={copy('Bundles', 'Vifurushi')}
                        items={sliceItems(visible.bundles, limit)}
                        compact={compact}
                        renderItem={(item) => (
                            <OfferCard
                                key={`bundle-${item.id}`}
                                href={route('bundle.show', item.slug || item.id)}
                                title={item.title}
                                subtitle={item.is_course ? copy('Course bundle', 'Kifurushi cha kozi') : copy('Bundle', 'Kifurushi')}
                                price={item.price}
                                icon={Layers}
                                compact={compact}
                            />
                        )}
                    />

                    <OfferSection
                        title={copy('Memberships', 'Uanachama')}
                        items={sliceItems(visible.subscriptionPlans, limit)}
                        compact={compact}
                        renderItem={(item) => (
                            <OfferCard
                                key={`plan-${item.id}`}
                                href={route('subscription-plan.show', item.slug || item.id)}
                                title={item.name}
                                subtitle={formatBillingInterval(item.billing_interval, item.interval_count, copy)}
                                price={item.price}
                                icon={Crown}
                                compact={compact}
                            />
                        )}
                    />

                    <OfferSection
                        title={copy('Products & digital offers', 'Bidhaa na ofa za kidijitali')}
                        items={sliceItems(visible.products, limit)}
                        compact={compact}
                        renderItem={(item) => (
                            <OfferCard
                                key={`product-${item.id}`}
                                href={route('product.show', item.slug || item.id)}
                                title={item.title}
                                subtitle={productTypeLabel(item, copy)}
                                price={item.checkout_price ?? item.price}
                                priceLabel={productPriceLabel(item)}
                                imageUrl={item.image_url}
                                icon={productTypeIcon(item)}
                                compact={compact}
                            />
                        )}
                    />
                </div>
            )}

            {compact && !isEmpty && (
                <div className="border-t border-neutral-100 px-4 py-3">
                    <Link
                        href={allProductsHref}
                        className="flex h-9 items-center justify-center rounded-lg bg-neutral-100 text-[13px] font-semibold text-foreground transition-colors hover:bg-neutral-200"
                    >
                        {copy('See all offers', 'Angalia ofa zote')}
                    </Link>
                </div>
            )}
        </div>
    );
}

function OfferSection({ title, items, renderItem, compact }) {
    if (!items.length) return null;

    return (
        <section>
            <h2 className={`font-semibold text-foreground ${compact ? 'text-xs uppercase tracking-wide text-muted-foreground' : 'text-sm'}`}>
                {title}
            </h2>
            <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
                {items.map((item) => renderItem(item))}
            </div>
        </section>
    );
}

function OfferCard({ href, title, subtitle, price, priceLabel, imageUrl, icon: Icon, compact }) {
    const { copy } = useLocale();
    const displayPrice = priceLabel || formatOfferPrice(price, copy);

    return (
        <Link
            href={href}
            className={`flex min-w-0 items-center gap-3 rounded-xl border border-neutral-200/90 bg-background transition-colors hover:border-neutral-300 hover:bg-neutral-50 ${compact ? 'p-2.5' : 'p-3'}`}
        >
            <div className={`shrink-0 overflow-hidden rounded-lg bg-neutral-100 ${compact ? 'h-11 w-11' : 'h-14 w-14'}`}>
                {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-500">
                        <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold text-foreground ${compact ? 'text-sm' : 'text-[15px]'}`}>{title}</p>
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
            {displayPrice && (
                <p className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">{displayPrice}</p>
            )}
        </Link>
    );
}

function sliceItems(items, limit) {
    if (!limit) return items;
    return items.slice(0, limit);
}

function formatOfferCount(value) {
    if (value === null || value === undefined) return '0';
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
}

function formatOfferPrice(price, copy = (english) => english) {
    if (price === null || price === undefined) return copy('Free', 'Bure');
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return copy('Free', 'Bure');
    return `TZS ${n.toLocaleString()}`;
}

function formatBillingInterval(interval, count = 1, copy = (english) => english) {
    const n = Number(count) || 1;
    const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[interval] || interval || 'period';
    return n === 1 ? copy(`Per ${unit}`, `Kwa ${unit === 'day' ? 'siku' : unit === 'week' ? 'wiki' : unit === 'month' ? 'mwezi' : unit === 'year' ? 'mwaka' : 'kipindi'}`) : copy(`Every ${n} ${unit}s`, `Kila ${n} ${unit === 'day' ? 'siku' : unit === 'week' ? 'wiki' : unit === 'month' ? 'miezi' : unit === 'year' ? 'miaka' : 'vipindi'}`);
}

function productTypeLabel(product, copy = (english) => english) {
    if (product?.type === 'service') return copy('Service', 'Huduma');
    if (product?.type !== 'digital') return copy('Product', 'Bidhaa');
    if (product.digital_delivery_type === 'video_stream') return copy('Premium video', 'Video premium');
    if (product.digital_delivery_type === 'audio_stream') return copy('Premium audio', 'Audio premium');
    return copy('Digital', 'Kidijitali');
}

function productTypeIcon(product) {
    if (product?.type === 'service') return Wrench;
    if (product?.type !== 'digital') return ShoppingBag;
    return DownloadCloud;
}

export { OFFER_FILTERS, formatOfferCount };
