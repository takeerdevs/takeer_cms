import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import axios from 'axios';
import PostCard from '@/Components/PostCard';
import MerchantSearchCard from '@/Components/MerchantSearchCard';

export default function SearchPage() {
    const { initialQuery = '', initialPage = 1 } = usePage().props;
    const [query, setQuery] = useState(initialQuery || '');
    const [results, setResults] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setQuery(initialQuery || '');
    }, [initialQuery]);

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
            params: { q, page, per_page: 10 },
        })
            .then((res) => {
                if (cancelled) return;
                setResults(res.data?.data || []);
                setMeta(res.data?.meta || null);
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
    }, [initialQuery, initialPage]);

    const submit = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;

        router.get('/search', { q, page: 1 }, {
            preserveState: true,
            replace: false,
        });
    };

    const goToPage = (page) => {
        if (!meta?.query) return;
        router.get('/search', { q: meta.query, page }, {
            preserveState: true,
            replace: false,
        });
    };

    return (
        <AppLayout>
            <Head title="Search" />

            <div className="max-w-2xl mx-auto px-4 pt-5 pb-24">
                <form onSubmit={submit} className="sticky top-0 z-20 bg-background/95 backdrop-blur py-2">
                    <div className="relative">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Tafuta bidhaa, specs, huduma, courses..."
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-border bg-background"
                        />
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
