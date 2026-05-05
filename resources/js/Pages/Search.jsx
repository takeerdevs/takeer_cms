import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { Filter, LocateFixed, Search as SearchIcon, Loader2 } from 'lucide-react';
import axios from 'axios';
import PostCard from '@/Components/PostCard';
import MerchantSearchCard from '@/Components/MerchantSearchCard';
import ProductSearchCard from '@/Components/ProductSearchCard';
import { trackPlatformEvent } from '@/lib/attribution';

export default function SearchPage() {
    const { initialQuery = '', initialPage = 1, initialFilters = {}, countries = [] } = usePage().props;
    const [query, setQuery] = useState(initialQuery || '');
    const [filters, setFilters] = useState({
        type: initialFilters.type || 'all',
        country_id: initialFilters.country_id || '',
        location: initialFilters.location || '',
        lat: initialFilters.lat || '',
        lng: initialFilters.lng || '',
        radius_km: initialFilters.radius_km || 25,
    });
    const [results, setResults] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState('');

    useEffect(() => {
        setQuery(initialQuery || '');
        setFilters({
            type: initialFilters.type || 'all',
            country_id: initialFilters.country_id || '',
            location: initialFilters.location || '',
            lat: initialFilters.lat || '',
            lng: initialFilters.lng || '',
            radius_km: initialFilters.radius_km || 25,
        });
    }, [initialQuery, JSON.stringify(initialFilters)]);

    useEffect(() => {
        const q = (initialQuery || '').trim();
        const page = Number(initialPage || 1);
        if (!q) {
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
                per_page: 10,
                ...compactFilters(initialFilters),
            },
        })
            .then((res) => {
                if (cancelled) return;
                const data = res.data?.data || [];
                const nextMeta = res.data?.meta || null;
                setResults(data);
                setMeta(nextMeta);
                trackPlatformEvent('search_performed', {
                    source: 'search',
                    metadata: {
                        query: q,
                        page,
                        result_count: nextMeta?.total ?? data.length,
                        filters: compactFilters(initialFilters),
                    },
                });
            })
            .catch(() => {
                if (cancelled) return;
                setResults([]);
                setMeta(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [initialQuery, initialPage, JSON.stringify(initialFilters)]);

    const submit = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;

        router.get('/search', { q, page: 1, ...compactFilters(filters) }, {
            preserveState: true,
            replace: false,
        });
    };

    const goToPage = (page) => {
        if (!meta?.query) return;
        router.get('/search', { q: meta.query, page, ...compactFilters(filters) }, {
            preserveState: true,
            replace: false,
        });
    };

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
            if (q) {
                router.get('/search', { q, page: 1, ...compactFilters(nextFilters) }, {
                    preserveState: true,
                    replace: false,
                });
            }
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
                                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                                className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold"
                            >
                                <option value="all">All offers</option>
                                <option value="physical">Physical products</option>
                                <option value="digital">Digital content</option>
                                <option value="service">Services</option>
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

                {!initialQuery && (
                    <div className="py-16 text-center text-muted-foreground">
                        Andika neno la kutafuta ili kuona matokeo.
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center py-10 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Inatafuta...
                    </div>
                )}

                {!loading && initialQuery && results.length === 0 && (
                    <div className="py-14 text-center text-muted-foreground">
                        Hakuna matokeo ya "{initialQuery}".
                    </div>
                )}

                {!loading && results.length > 0 && (
                    <div className="divide-y divide-border rounded-2xl border border-border/60 bg-background/80 overflow-hidden">
                        {results.map((item) => {
                            if (item.type === 'post') {
                                return <PostCard key={`post-${item.id}`} post={item.payload} />;
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
                    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                        <span>{meta.total} matokeo</span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={meta.current_page <= 1}
                                onClick={() => goToPage(meta.current_page - 1)}
                                className="px-3 py-1 rounded-lg border border-border disabled:opacity-40"
                            >
                                Prev
                            </button>
                            <button
                                type="button"
                                disabled={meta.current_page >= meta.last_page}
                                onClick={() => goToPage(meta.current_page + 1)}
                                className="px-3 py-1 rounded-lg border border-border disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function compactFilters(filters = {}) {
    return Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== 'all')
    );
}
