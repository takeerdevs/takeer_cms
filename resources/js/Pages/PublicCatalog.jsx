import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import {
    ArrowLeft,
    BadgeCheck,
    BookOpenText,
    CalendarClock,
    DownloadCloud,
    ExternalLink,
    Image as ImageIcon,
    Loader2,
    Search,
    ShoppingBag,
    Sparkles,
} from 'lucide-react';
import { productPriceLabel } from '@/lib/productUnits';
import { useLocale } from '@/lib/i18n';

const fetcher = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    return response.json();
};

const CATALOG_FILTERS = [
    { key: 'all', label: 'All', statKey: 'catalog_total' },
    { key: 'physical', label: 'Products', statKey: 'physical' },
    { key: 'digital', label: 'Digital', statKey: 'digital' },
];

export default function PublicCatalog({ merchantSlug, initialData }) {
    const { t, copy } = useLocale();
    const localizedFilters = [
        { key: 'all', label: t('catalog.all'), statKey: 'catalog_total' },
        { key: 'physical', label: t('catalog.products'), statKey: 'physical' },
        { key: 'digital', label: t('catalog.digital'), statKey: 'digital' },
    ];
    const sentinelRef = useRef(null);
    const getKey = (pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData.products?.links?.next) return null;
        return `/api/merchant/${merchantSlug}/catalog?page=${pageIndex + 1}`;
    };

    const { data, size, setSize, error, isValidating } = useSWRInfinite(getKey, fetcher, {
        fallbackData: initialData ? [initialData] : undefined,
        revalidateOnFocus: false,
    });
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');

    const merchant = data?.[0]?.merchant || null;
    const catalogStats = data?.[0]?.catalog_stats ?? null;
    const slug = merchant?.slug || merchantSlug;
    const isHeaderLoading = !data && !error;
    const products = data ? data.flatMap((page) => page.products?.data || []) : [];
    const productDiscovery = data ? data.reduce((acc, page) => ({ ...acc, ...(page.product_discovery || {}) }), {}) : {};
    const isReachingEnd = data && data[data.length - 1]?.products?.links?.next === null;
    const isLoadingMore = isValidating && size > 0;

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || isReachingEnd) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting || isValidating) return;
            setSize((current) => current + 1);
        }, { rootMargin: '700px 0px 900px' });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [isReachingEnd, isValidating, setSize]);

    const visibleProducts = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return products
            .filter((product) => ['physical', 'digital'].includes(product.type))
            .filter((product) => filter === 'all' || product.type === filter)
            .filter((product) => {
                if (!needle) return true;
                return `${product.title} ${productLabel(product, copy)} ${product.description || ''}`.toLowerCase().includes(needle);
            })
            .sort((a, b) => discoveryScore(b, productDiscovery) - discoveryScore(a, productDiscovery));
    }, [products, filter, query, productDiscovery]);

    if (error) {
        return (
            <AppLayout>
                <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
                    <p className="text-destructive">{t('catalog.loadFailed')}</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${merchant?.name || t('catalog.title')} | ${t('catalog.title')}`} />

            <main className="mx-auto max-w-5xl pb-24">
                <header className="border-b border-neutral-200/80 bg-background">
                    {isHeaderLoading ? (
                        <CatalogHeaderSkeleton />
                    ) : (
                        <>
                            <div className="flex items-center gap-2.5 px-4 py-3">
                                <Link
                                    href={`/u/${slug}`}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-neutral-100"
                                    aria-label={t('common.backToProfile')}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                                <Link href={`/u/${slug}`} className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <CatalogAvatar name={merchant?.name} avatarUrl={merchant?.avatar_url} />
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-1">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {merchant?.name || 'Biashara'}
                                            </p>
                                            {merchant?.is_verified && (
                                                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" aria-hidden />
                                            )}
                                        </div>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {t('catalog.title')} · @{slug}
                                        </p>
                                    </div>
                                </Link>
                                <Link
                                    href={`/u/${slug}/shop/all`}
                                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
                                >
                                    {t('catalog.shop')}
                                </Link>
                            </div>

                            {catalogStats && (
                                <div className="grid grid-cols-2 gap-1 border-t border-neutral-100 px-4 py-2.5">
                                    <CatalogStatPill label={t('catalog.products')} value={catalogStats.physical} />
                                    <CatalogStatPill label={t('catalog.digital')} value={catalogStats.digital} />
                                </div>
                            )}

                            <p className="border-t border-neutral-100 px-4 py-2 text-xs text-muted-foreground">
                                {t('catalog.taggedProducts')}{' '}
                                <Link href={`/u/${slug}/shop/all`} className="font-semibold text-brand-700">
                                    {t('catalog.shop')}
                                </Link>
                                .
                            </p>

                            <div className="space-y-2.5 border-t border-neutral-100 px-4 py-3">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        className="h-9 w-full rounded-lg bg-neutral-100 pl-9 pr-3 text-sm text-foreground outline-none ring-brand-500/30 transition placeholder:text-muted-foreground focus:bg-white focus:ring-2"
                                        placeholder={t('catalog.searchPlaceholder')}
                                    />
                                </div>
                                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                                    {localizedFilters.map((item) => {
                                        const count = catalogStats?.[item.statKey];
                                        const isActive = filter === item.key;

                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => setFilter(item.key)}
                                                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors ${isActive
                                                    ? 'bg-foreground text-background'
                                                    : 'bg-neutral-100 text-foreground hover:bg-neutral-200'
                                                }`}
                                            >
                                                {item.label}
                                                {count !== null && count !== undefined && (
                                                    <span className={isActive ? 'text-background/80' : 'text-muted-foreground'}>
                                                        {formatCatalogCount(count)}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </header>

                <div className="px-4 pt-4 sm:px-6 lg:px-8">
                {!data && !error ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
                    </div>
                ) : visibleProducts.length === 0 ? (
                    <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                            <ShoppingBag className="h-7 w-7" />
                        </div>
                        <p className="mt-4 text-base font-black text-slate-950">{t('catalog.empty')}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{t('catalog.emptyDescription')}</p>
                    </div>
                ) : (
                    <>
                        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleProducts.map((product) => (
                                <CatalogCard
                                    key={product.id}
                                    product={product}
                                    badges={discoveryBadges(product, productDiscovery)}
                                />
                            ))}
                        </section>
                        {!isReachingEnd && (
                            <div ref={sentinelRef} className="flex min-h-24 items-center justify-center py-8">
                                {isLoadingMore ? (
                                    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                                ) : (
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">{t('common.loadingMore')}</span>
                                )}
                            </div>
                        )}
                    </>
                )}
                </div>
            </main>
        </AppLayout>
    );
}

function CatalogAvatar({ name, avatarUrl }) {
    const initial = (name || 'B').charAt(0).toUpperCase();

    return (
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-neutral-200/90 bg-neutral-100">
            {avatarUrl ? (
                <img src={avatarUrl} alt={name || 'Profile'} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-normal text-neutral-500">
                    {initial}
                </div>
            )}
        </div>
    );
}

function CatalogHeaderSkeleton() {
    return (
        <>
            <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-neutral-100" />
                <div className="flex flex-1 items-center gap-2.5">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-100" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-100" />
                        <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
                    </div>
                </div>
                <div className="h-8 w-20 animate-pulse rounded-lg bg-neutral-100" />
            </div>
            <div className="space-y-2.5 border-t border-neutral-100 px-4 py-3">
                <div className="h-9 animate-pulse rounded-lg bg-neutral-100" />
                <div className="flex gap-1.5">
                    <div className="h-7 w-16 animate-pulse rounded-md bg-neutral-100" />
                    <div className="h-7 w-20 animate-pulse rounded-md bg-neutral-100" />
                    <div className="h-7 w-16 animate-pulse rounded-md bg-neutral-100" />
                </div>
            </div>
        </>
    );
}

function CatalogStatPill({ label, value }) {
    return (
        <div className="text-center">
            <p className="text-sm font-semibold tabular-nums text-foreground">{formatCatalogCount(value)}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
        </div>
    );
}

function formatCatalogCount(value) {
    if (value === null || value === undefined) return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
}

function CatalogCard({ product, badges = [] }) {
    const Icon = productIcon(product);
    const description = product.description || product.attributes?.suggested_description || product.service_client_requirements || '';

    return (
        <Link
            href={route('product.show', product.slug || product.id)}
            className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <ImageIcon className="h-10 w-10" />
                    </div>
                )}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-2xl bg-white/95 px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm">
                    <Icon className="h-3.5 w-3.5 text-brand-600" />
                    {productLabel(product, copy)}
                </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
                <div className="flex flex-wrap gap-1.5">
                    {badges.slice(0, 2).map((badge, index) => (
                        <span key={`${badge.label}-${index}`} className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${badgeToneClass(badge.tone)}`}>
                            {badge.label}
                        </span>
                    ))}
                </div>
                <h2 className="mt-2 line-clamp-2 text-base font-black leading-tight text-slate-950">{product.title}</h2>
                {description && (
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-slate-500">{description}</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <p className="min-w-0 truncate text-base font-black text-brand-600">{productPriceLabel(product)}</p>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white transition group-hover:bg-brand-600">
                        <ExternalLink className="h-4 w-4" />
                    </span>
                </div>
            </div>
        </Link>
    );
}

function productIcon(product) {
    if (product?.type === 'service') return Wrench;
    if (product?.type !== 'digital') return ShoppingBag;
    if (product.digital_delivery_type === 'live_event') return CalendarClock;
    if (['video_stream', 'audio_stream', 'gallery_pack'].includes(product.digital_delivery_type)) return Sparkles;
    if (product.digital_delivery_type === 'custom_delivery') return Wrench;
    if (product.digital_content_type === 'ebook' || product.digital_content_type === 'document') return BookOpenText;
    return DownloadCloud;
}

function productLabel(product, translate = (english) => english) {
    if (product?.type === 'service') return translate('Service', 'Huduma');
    if (product?.type !== 'digital') return translate('Product', 'Bidhaa');

    const map = {
        video_stream: translate('Premium video', 'Video ya premium'),
        audio_stream: translate('Premium audio', 'Audio ya premium'),
        gallery_pack: translate('Gallery pack', 'Kifurushi cha picha'),
        live_event: translate('Live event', 'Tukio la moja kwa moja'),
        custom_delivery: translate('Custom work', 'Kazi maalum'),
        external_link: translate('External access', 'Ufikiaji wa nje'),
        file: product.digital_content_type === 'software'
            ? translate('Software', 'Programu')
            : product.digital_content_type === 'document'
                ? translate('Document', 'Hati')
                : product.digital_content_type === 'ebook'
                    ? translate('E-book', 'Kitabu pepe')
                    : translate('Digital download', 'Upakuaji wa kidijitali'),
    };

    return map[product.digital_delivery_type] || translate('Digital download', 'Upakuaji wa kidijitali');
}

function discoveryScore(product, productDiscovery = {}) {
    return Number(productDiscovery?.[product?.id]?.score || 0);
}

function discoveryBadges(product, productDiscovery = {}) {
    return productDiscovery?.[product?.id]?.badges || [];
}

function badgeToneClass(tone) {
    const map = {
        amber: 'bg-amber-50 text-amber-700 border border-amber-100',
        sky: 'bg-sky-50 text-sky-700 border border-sky-100',
        violet: 'bg-violet-50 text-violet-700 border border-violet-100',
        rose: 'bg-rose-50 text-rose-700 border border-rose-100',
        emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    };

    return map[tone] || 'bg-slate-50 text-slate-600 border border-slate-100';
}
