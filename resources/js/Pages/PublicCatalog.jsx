import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import {
    ArrowLeft,
    BookOpenText,
    CalendarClock,
    DownloadCloud,
    ExternalLink,
    Filter,
    Image as ImageIcon,
    Loader2,
    Search,
    ShoppingBag,
    Sparkles,
    Store,
    Wrench,
} from 'lucide-react';
import { productPriceLabel } from '@/lib/productUnits';

const fetcher = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
    return response.json();
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'physical', label: 'Products' },
    { key: 'digital', label: 'Digital' },
    { key: 'service', label: 'Services' },
];

export default function PublicCatalog({ merchantSlug, initialData }) {
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
            .filter((product) => filter === 'all' || product.type === filter)
            .filter((product) => {
                if (!needle) return true;
                return `${product.title} ${productLabel(product)} ${product.description || ''}`.toLowerCase().includes(needle);
            })
            .sort((a, b) => discoveryScore(b, productDiscovery) - discoveryScore(a, productDiscovery));
    }, [products, filter, query, productDiscovery]);

    if (error) {
        return (
            <AppLayout>
                <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
                    <p className="text-destructive">Catalog haipatikani au mtandao unasumbua.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${merchant?.name || 'Catalog'} | Catalog`} />

            <main className="mx-auto max-w-5xl px-4 py-5 pb-24 sm:px-6 lg:px-8">
                <header className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-start gap-3">
                        <Link
                            href={`/u/${merchant?.slug || merchantSlug}`}
                            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                            aria-label="Back to profile"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase tracking-widest text-brand-600">Catalog</p>
                            <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                                {merchant?.name || 'Biashara'}
                            </h1>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                                Sellable and bookable offers from @{merchant?.slug || merchantSlug}
                            </p>
                        </div>
                        <Link
                            href={`/m/${merchant?.slug || merchantSlug}`}
                            className="hidden h-10 items-center gap-2 rounded-2xl bg-brand-600 px-4 text-sm font-black text-white transition hover:bg-brand-700 sm:inline-flex"
                        >
                            <Store className="h-4 w-4" />
                            Mini-store
                        </Link>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-brand-300 focus:bg-white"
                                placeholder="Search offers..."
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {FILTERS.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setFilter(item.key)}
                                    className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition ${filter === item.key
                                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <Filter className="h-3.5 w-3.5" />
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {!data && !error ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
                    </div>
                ) : visibleProducts.length === 0 ? (
                    <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                            <ShoppingBag className="h-7 w-7" />
                        </div>
                        <p className="mt-4 text-base font-black text-slate-950">Hakuna bidhaa kwa sasa.</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">Try another filter or check the mini-store.</p>
                    </div>
                ) : (
                    <>
                        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Loading more...</span>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </AppLayout>
    );
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
                    {productLabel(product)}
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

function productLabel(product) {
    if (product?.type === 'service') return 'Service';
    if (product?.type !== 'digital') return 'Product';

    const map = {
        video_stream: 'Premium video',
        audio_stream: 'Premium audio',
        gallery_pack: 'Gallery pack',
        live_event: 'Live event',
        custom_delivery: 'Custom work',
        external_link: 'External access',
        file: product.digital_content_type === 'software'
            ? 'Software'
            : product.digital_content_type === 'document'
                ? 'Document'
                : product.digital_content_type === 'ebook'
                    ? 'E-book'
                    : 'Digital download',
    };

    return map[product.digital_delivery_type] || 'Digital download';
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
