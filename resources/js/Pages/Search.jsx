import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { DownloadCloud, Filter, LocateFixed, Search as SearchIcon, Loader2, PenLine, ShoppingBag, Sparkles, Store } from 'lucide-react';
import axios from 'axios';
import PostCard from '@/Components/PostCard';
import MerchantSearchCard from '@/Components/MerchantSearchCard';
import ProductSearchCard from '@/Components/ProductSearchCard';
import { trackPlatformEvent } from '@/lib/attribution';

export default function SearchPage() {
    const { initialQuery = '', initialPage = 1, initialFilters = {}, countries = [], productCategories = [], serviceCategories = [] } = usePage().props;
    const sentinelRef = useRef(null);
    const autoSearchReadyRef = useRef(false);
    const [query, setQuery] = useState(initialQuery || '');
    const [filters, setFilters] = useState({
        type: initialFilters.type || 'all',
        surface: initialFilters.surface || 'all',
        category_id: initialFilters.category_id || '',
        sub_category_id: initialFilters.sub_category_id || '',
        service_category_id: initialFilters.service_category_id || '',
        service_subcategory_id: initialFilters.service_subcategory_id || '',
        service_category: initialFilters.service_category || '',
        service_subcategory: initialFilters.service_subcategory || '',
        country_id: initialFilters.country_id || '',
        location: initialFilters.location || '',
        lat: initialFilters.lat || '',
        lng: initialFilters.lng || '',
        radius_km: initialFilters.radius_km || 25,
    });
    const [results, setResults] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState('');

    useEffect(() => {
        setQuery(initialQuery || '');
        setFilters({
            type: initialFilters.type || 'all',
            surface: initialFilters.surface || 'all',
            category_id: initialFilters.category_id || '',
            sub_category_id: initialFilters.sub_category_id || '',
            service_category_id: initialFilters.service_category_id || '',
            service_subcategory_id: initialFilters.service_subcategory_id || '',
            service_category: initialFilters.service_category || '',
            service_subcategory: initialFilters.service_subcategory || '',
            country_id: initialFilters.country_id || '',
            location: initialFilters.location || '',
            lat: initialFilters.lat || '',
            lng: initialFilters.lng || '',
            radius_km: initialFilters.radius_km || 25,
        });
        autoSearchReadyRef.current = false;
    }, [initialQuery, JSON.stringify(initialFilters)]);

    useEffect(() => {
        if (!autoSearchReadyRef.current) {
            autoSearchReadyRef.current = true;
            return undefined;
        }

        const q = query.trim();
        const nextFilters = compactFilters(filters);
        if (q.length > 0 && q.length < 2) {
            return undefined;
        }

        const currentFilters = compactFilters(initialFilters);
        const sameQuery = q === (initialQuery || '').trim();
        const sameFilters = JSON.stringify(nextFilters) === JSON.stringify(currentFilters);

        if (sameQuery && sameFilters) {
            return undefined;
        }

        const timeout = window.setTimeout(() => {
            router.get('/search', { ...(q ? { q } : {}), page: 1, ...nextFilters }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 450);

        return () => window.clearTimeout(timeout);
    }, [query, JSON.stringify(filters)]);

    useEffect(() => {
        const q = (initialQuery || '').trim();
        const page = Number(initialPage || 1);
        const requestFilters = compactFilters(initialFilters);
        const physicalProductSurface = requestFilters.surface === 'products' && requestFilters.type === 'physical';
        if (!hasSearchIntent(q, requestFilters)) {
            setResults([]);
            setMeta(null);
            return;
        }

        let cancelled = false;
        setLoading(true);

        axios.get('/api/search/unified/posts', {
            params: {
                q,
                page,
                per_page: physicalProductSurface ? 12 : 10,
                ...requestFilters,
            },
        })
            .then((res) => {
                if (cancelled) return;
                const data = res.data?.data || [];
                const nextMeta = res.data?.meta || null;
                setResults(data);
                setMeta(nextMeta);
                setLoadingMore(false);
                trackPlatformEvent('search_performed', {
                    source: 'search',
                    metadata: {
                        query: q,
                        page,
                        result_count: nextMeta?.total ?? data.length,
                        filters: requestFilters,
                    },
                });
            })
            .catch(() => {
                if (cancelled) return;
                setResults([]);
                setMeta(null);
                setLoadingMore(false);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [initialQuery, initialPage, JSON.stringify(initialFilters)]);

    const hasMore = Boolean(meta && meta.current_page < meta.last_page);
    const activeResultFilters = meta?.filters || compactFilters(initialFilters);
    const productResultsLayout = results.length > 0
        && results.every((item) => item.type === 'product')
        && activeResultFilters.surface === 'products'
        && activeResultFilters.type === 'physical';

    const loadMore = useCallback(() => {
        if (!hasMore || loading || loadingMore) return;

        const nextPage = Number(meta.current_page || 1) + 1;
        setLoadingMore(true);

        axios.get('/api/search/unified/posts', {
            params: {
                q: meta.query || '',
                page: nextPage,
                per_page: meta.per_page || 10,
                ...compactFilters(filters),
            },
        })
            .then((res) => {
                const data = res.data?.data || [];
                const nextMeta = res.data?.meta || null;
                setResults((current) => {
                    const seen = new Set(current.map((item) => `${item.type}-${item.id}`));
                    const fresh = data.filter((item) => !seen.has(`${item.type}-${item.id}`));
                    return [...current, ...fresh];
                });
                setMeta(nextMeta);
            })
            .finally(() => setLoadingMore(false));
    }, [filters, hasMore, loading, loadingMore, meta]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasMore) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            loadMore();
        }, { rootMargin: '900px 0px 1200px' });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);

    const submit = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (q.length > 0 && q.length < 2) return;

        router.get('/search', { ...(q ? { q } : {}), page: 1, ...compactFilters(filters) }, {
            preserveState: true,
            replace: false,
        });
    };

    const goToPage = (page) => {
        if (!meta) return;
        router.get('/search', { ...(meta.query ? { q: meta.query } : {}), page, ...compactFilters(filters) }, {
            preserveState: true,
            replace: false,
        });
    };

    const browseMode = (next) => {
        const nextFilters = {
            ...filters,
            ...next,
            ...(next.type !== 'physical' ? { category_id: '', sub_category_id: '' } : {}),
            ...(next.type !== 'service' ? { service_category_id: '', service_subcategory_id: '', service_category: '', service_subcategory: '' } : {}),
        };
        setQuery('');
        setFilters(nextFilters);
        router.get('/search', { page: 1, ...compactFilters(nextFilters) }, {
            preserveState: true,
            replace: false,
        });
    };

    const selectedProductCategory = productCategories.find((category) => String(category.id) === String(filters.category_id));
    const selectedServiceCategory = serviceCategories.find((category) => (
        String(category.id) === String(filters.service_category_id)
        || (!filters.service_category_id && category.name === filters.service_category)
    ));

    const useBrowserLocation = () => {
        setLocationError('');

        if (!navigator.geolocation) {
            setLocationError('Your browser does not support precise location. Enter your area manually.');
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition((position) => {
            const nextFilters = {
                ...filters,
                lat: String(position.coords.latitude),
                lng: String(position.coords.longitude),
                radius_km: filters.radius_km || 25,
            };

            setFilters(nextFilters);
            setLocating(false);

            const q = query.trim();
            router.get('/search', { ...(q ? { q } : {}), page: 1, ...compactFilters(nextFilters) }, {
                preserveState: true,
                replace: false,
            });
        }, () => {
            setLocating(false);
            setLocationError('Location was not enabled. You can still enter a city or area manually.');
        }, {
            maximumAge: 1000 * 60 * 15,
            timeout: 10000,
        });
    };

    return (
        <AppLayout>
            <Head title="Search" />

            <div className="max-w-2xl mx-auto px-4 pt-5 pb-24">
                <form onSubmit={submit} className="sticky top-0 z-20 bg-background/95 backdrop-blur py-2 space-y-2">
                    <div className="relative">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Tafuta bidhaa, specs, huduma, courses..."
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-border bg-background"
                        />
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background p-2 space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">
                            <Filter className="h-3.5 w-3.5" />
                            Discovery filters
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={filters.type}
                                onChange={(e) => {
                                    const type = e.target.value;
                                    setFilters(prev => ({
                                        ...prev,
                                        type,
                                        category_id: type === 'physical' ? prev.category_id : '',
                                        sub_category_id: type === 'physical' ? prev.sub_category_id : '',
                                        service_category: type === 'service' ? prev.service_category : '',
                                        service_subcategory: type === 'service' ? prev.service_subcategory : '',
                                        service_category_id: type === 'service' ? prev.service_category_id : '',
                                        service_subcategory_id: type === 'service' ? prev.service_subcategory_id : '',
                                    }));
                                }}
                                className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                            >
                                <option value="all">All offers</option>
                                <option value="physical">Physical products</option>
                                <option value="digital">Digital content</option>
                                <option value="service">Services</option>
                                <option value="custom">Custom work</option>
                                <option value="creator">Creator offers</option>
                            </select>
                            <select
                                value={filters.country_id}
                                onChange={(e) => setFilters(prev => ({ ...prev, country_id: e.target.value }))}
                                className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                            >
                                <option value="">Any country</option>
                                {countries.map((country) => (
                                    <option key={country.id} value={country.id}>
                                        {country.flag ? `${country.flag} ` : ''}{country.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {filters.type === 'physical' && (
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={filters.category_id}
                                    onChange={(e) => setFilters(prev => ({ ...prev, category_id: e.target.value, sub_category_id: '' }))}
                                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                                >
                                    <option value="">Any product category</option>
                                    {productCategories.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={filters.sub_category_id}
                                    onChange={(e) => setFilters(prev => ({ ...prev, sub_category_id: e.target.value }))}
                                    disabled={!selectedProductCategory}
                                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold disabled:opacity-50"
                                >
                                    <option value="">Any subcategory</option>
                                    {(selectedProductCategory?.children || []).map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {filters.type === 'service' && (
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={filters.service_category_id}
                                    onChange={(e) => {
                                        const category = serviceCategories.find((item) => String(item.id) === e.target.value);
                                        setFilters(prev => ({
                                            ...prev,
                                            service_category_id: e.target.value,
                                            service_subcategory_id: '',
                                            service_category: category?.name || '',
                                            service_subcategory: '',
                                        }));
                                    }}
                                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                                >
                                    <option value="">Any service category</option>
                                    {serviceCategories.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={filters.service_subcategory_id}
                                    onChange={(e) => {
                                        const subcategory = (selectedServiceCategory?.children || []).find((item) => String(item.id) === e.target.value);
                                        setFilters(prev => ({
                                            ...prev,
                                            service_subcategory_id: e.target.value,
                                            service_subcategory: subcategory?.name || '',
                                        }));
                                    }}
                                    disabled={!selectedServiceCategory}
                                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold disabled:opacity-50"
                                >
                                    <option value="">Any specialty</option>
                                    {(selectedServiceCategory?.children || []).map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                            <input
                                value={filters.location}
                                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                                placeholder="Area, city, or region e.g. Mikocheni"
                                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                            />
                            <button
                                type="button"
                                onClick={useBrowserLocation}
                                disabled={locating}
                                className="h-10 px-3 rounded-xl border border-border text-sm font-black inline-flex items-center gap-1.5"
                                title="Use your location to show listings closest to you"
                            >
                                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                                {locating ? 'Locating' : 'Near me'}
                            </button>
                        </div>
                        {locationError && (
                            <p className="px-1 text-xs font-semibold text-red-600">{locationError}</p>
                        )}
                        {filters.lat && filters.lng && (
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-muted-foreground shrink-0">Radius</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={filters.radius_km}
                                    onChange={(e) => setFilters(prev => ({ ...prev, radius_km: e.target.value }))}
                                    className="w-full"
                                />
                                <span className="w-14 text-right text-xs font-black text-foreground">{filters.radius_km} km</span>
                            </div>
                        )}
                    </div>
                </form>

                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <BrowseButton icon={ShoppingBag} label="Products" active={filters.type === 'physical'} onClick={() => browseMode({ type: 'physical', surface: 'products' })} />
                    <BrowseButton icon={DownloadCloud} label="Downloads" active={filters.type === 'digital'} onClick={() => browseMode({ type: 'digital', surface: 'products' })} />
                    <BrowseButton icon={Store} label="Services" active={filters.type === 'service'} onClick={() => browseMode({ type: 'service', surface: 'products' })} />
                    <BrowseButton icon={PenLine} label="Custom work" active={filters.type === 'custom'} onClick={() => browseMode({ type: 'custom', surface: 'products' })} />
                </div>

                {!hasSearchIntent(initialQuery, compactFilters(initialFilters)) && (
                    <div className="py-16 text-center text-muted-foreground">
                        <Sparkles className="mx-auto mb-3 h-7 w-7 text-brand-500" />
                        <p className="font-bold text-foreground">Search, or browse what people are selling.</p>
                        <p className="mt-1 text-sm">Pick Products, Downloads, Services, or Custom work to explore without typing.</p>
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Inatafuta...
                    </div>
                )}

                {!loading && hasSearchIntent(initialQuery, compactFilters(initialFilters)) && results.length === 0 && (
                    <div className="py-14 text-center text-muted-foreground">
                        {initialQuery ? `Hakuna matokeo ya "${initialQuery}".` : 'Hakuna matokeo kwa filters ulizochagua.'}
                    </div>
                )}

                {!loading && productResultsLayout && (
                    <div className="grid grid-cols-3 gap-3">
                        {results.map((item) => (
                            <ProductSearchCard key={`product-${item.id}`} product={item.payload} variant="grid" />
                        ))}
                    </div>
                )}

                {!loading && results.length > 0 && !productResultsLayout && (
                    <div className="divide-y divide-border rounded-2xl border border-border/60 bg-background/80 overflow-hidden">
                        {results.map((item) => {
                            if (item.type === 'post') {
                                return <LazyPostCard key={`post-${item.id}`} post={item.payload} />;
                            }
                            if (item.type === 'merchant') {
                                return <MerchantSearchCard key={`merchant-${item.id}`} merchant={item.payload} />;
                            }
                            if (item.type === 'product') {
                                return <ProductSearchCard key={`product-${item.id}`} product={item.payload} />;
                            }
                            return null;
                        })}
                    </div>
                )}

                {!loading && meta?.total > 0 && (
                    <div className="mt-4 text-sm text-muted-foreground">
                        {hasMore && (
                            <div ref={sentinelRef} className="flex min-h-24 items-center justify-center py-6">
                                {loadingMore ? (
                                    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                                ) : (
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Inapakia zaidi...</span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function LazyPostCard({ post }) {
    const ref = useRef(null);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (shouldRender) return undefined;
        const node = ref.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setShouldRender(true);
            return undefined;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            setShouldRender(true);
            observer.disconnect();
        }, { rootMargin: '900px 0px' });

        observer.observe(node);
        return () => observer.disconnect();
    }, [shouldRender]);

    return (
        <div ref={ref} style={{ contentVisibility: 'auto', containIntrinsicSize: '720px' }}>
            {shouldRender ? (
                <PostCard post={post} />
            ) : (
                <div className="min-h-[520px] bg-background" aria-hidden="true" />
            )}
        </div>
    );
}

function BrowseButton({ icon: Icon, label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`h-11 rounded-xl border px-3 text-sm font-black inline-flex items-center justify-center gap-2 transition-colors ${active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-border bg-background text-foreground hover:bg-accent/50'}`}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}

function compactFilters(filters = {}) {
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== 'all')
    );
}

function hasSearchIntent(query = '', filters = {}) {
    return Boolean(
        String(query || '').trim()
        || Object.keys(compactFilters(filters)).length > 0
    );
}
