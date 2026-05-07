import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import PostCard from '@/Components/PostCard';
import { ArrowUpRight, Loader2, ShoppingBag, Store } from 'lucide-react';

const fetcher = (url) => fetch(url, { headers: { Accept: 'application/json' } }).then(res => res.json());

export default function PublicMerchantProfile({ merchantSlug, initialData }) {
    const sentinelRef = useRef(null);
    const getKey = (pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData.posts.links.next) return null;
        return `/api/merchant/${merchantSlug}?page=${pageIndex + 1}`;
    };

    const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, fetcher, {
        fallbackData: initialData ? [initialData] : undefined,
        revalidateOnFocus: false,
    });

    const merchant = data?.[0]?.merchant || null;
    const products = data?.[0]?.products || [];
    const posts = data ? data.flatMap(page => page.posts.data) : [];
    const isReachingEnd = data && data[data.length - 1]?.posts.links.next === null;
    const isLoadingMore = isValidating && size > 0;

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || isReachingEnd) return undefined;

        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting || isValidating) return;
            setSize((current) => current + 1);
        }, { rootMargin: '900px 0px 1200px' });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [isReachingEnd, isValidating, setSize]);

    if (error) {
        return (
            <AppLayout>
                <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
                    <p className="text-destructive">Biashara haipatikani au mtandao unasumbua.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${merchant?.name || 'Biashara'} | Profile`} />

            <div className="mx-auto max-w-[640px]">
                <header className="border-b border-border bg-card px-5 py-6">
                    <div className="flex items-start gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-brand-100 text-brand-700">
                            {merchant?.avatar_url ? (
                                <img src={merchant.avatar_url} alt={merchant.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-2xl font-black">
                                    {(merchant?.name || 'T').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-2xl font-black leading-tight text-foreground">{merchant?.name || 'Biashara'}</h1>
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">@{merchant?.slug || merchantSlug}</p>
                            {merchant?.bio && (
                                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground">{merchant.bio}</p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                    href={`/m/${merchant?.slug || merchantSlug}`}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-black text-white hover:bg-brand-700"
                                >
                                    <ShoppingBag className="h-4 w-4" />
                                    Mini-store
                                </Link>
                                <Link
                                    href={`/m/${merchant?.slug || merchantSlug}/products`}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-black text-foreground hover:bg-accent"
                                >
                                    <Store className="h-4 w-4" />
                                    Catalog
                                </Link>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                        <ProfileStat label="Posts" value={posts.length} />
                        <ProfileStat label="Offers" value={products.length} />
                        <ProfileStat label="Store" value={<ArrowUpRight className="mx-auto h-5 w-5" />} />
                    </div>
                </header>

                <section className="divide-y divide-border">
                    {posts.length === 0 ? (
                        <div className="px-5 py-16 text-center text-muted-foreground">
                            Hakuna machapisho bado.
                        </div>
                    ) : (
                        posts.map((post, index) => (
                            <LazyPostCard key={post.id} post={post} eager={index < 3} />
                        ))
                    )}
                </section>

                {!isReachingEnd && posts.length > 0 && (
                    <div ref={sentinelRef} className="flex min-h-24 items-center justify-center py-6">
                        {isLoadingMore ? (
                            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                        ) : (
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Inapakia zaidi...</span>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function ProfileStat({ label, value }) {
    return (
        <div className="rounded-xl border border-border bg-background px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <div className="mt-1 text-base font-black text-foreground">{value}</div>
        </div>
    );
}

function LazyPostCard({ post, eager = false }) {
    const ref = useRef(null);
    const [shouldRender, setShouldRender] = useState(eager);

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
