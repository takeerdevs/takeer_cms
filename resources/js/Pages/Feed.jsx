import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, usePage } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import { Loader2 } from 'lucide-react';
import PostCard from '@/Components/PostCard';
import { DiscoveryHeader, DiscoveryRailSection, useDiscoveryRails } from '@/Components/DiscoveryRails';

const fetcher = async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Feed request failed');

    const payload = await res.json();
    if (!Array.isArray(payload?.data)) throw new Error('Feed response is invalid');

    return payload;
};

export default function Feed({ initialPosts = [], initialFeed = null }) {
    const { auth } = usePage().props;
    const defaultProfile = auth.user?.merchant_profiles?.find(p => p.is_default) || auth.user?.merchant_profiles?.[0];
    const { rails, loaded: railsLoaded } = useDiscoveryRails();
    const heroRail = rails[0] || null;
    const inlineRails = rails.slice(0, 5);
    const sentinelRef = useRef(null);
    const fallbackPage = useMemo(() => initialFeed || ({
        data: initialPosts,
        links: { next: initialPosts.length >= 10 ? '/api/feed?page=2' : null },
    }), [initialFeed, initialPosts]);
    const getKey = (pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData.links?.next) return null;
        return `/api/feed?page=${pageIndex + 1}`;
    };
    const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, fetcher, {
        fallbackData: [fallbackPage],
        revalidateFirstPage: false,
        revalidateOnFocus: false,
    });
    const posts = data ? data.flatMap(page => page.data || []) : initialPosts;
    const lastPage = data?.[data.length - 1];
    const isReachingEnd = Boolean(lastPage && !lastPage.links?.next);
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

    return (
        <AppLayout>
            <Head title="Nyumbani | Takeer" />

            <div className="max-w-[600px] mx-auto divide-y divide-border">
                {railsLoaded && rails.length > 0 && (
                    <div className="bg-slate-50 border-b border-border px-3 py-4 space-y-4">
                        <DiscoveryHeader />
                        <DiscoveryRailSection rail={heroRail} />
                    </div>
                )}
                {posts.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground px-4">
                        <p className="font-semibold">Hakuna machapisho bado.</p>
                        <p className="text-sm mt-1">Kuwa wa kwanza kuchapisha bidhaa yako!</p>
                    </div>
                ) : (
                    posts.map((post, index) => (
                        <React.Fragment key={post.id}>
                            <LazyPostCard post={post} eager={index < 3} />
                            {inlineRails.length > 0 && shouldInsertRail(index, posts.length) && (
                                <DiscoveryRailSection
                                    rail={inlineRails[railIndexForPost(index, inlineRails.length)]}
                                    compact
                                />
                            )}
                        </React.Fragment>
                    ))
                )}
                {error && (
                    <div className="py-6 text-center text-sm font-semibold text-destructive">
                        Feed imeshindwa kupakia. Jaribu tena baadae.
                    </div>
                )}
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

function shouldInsertRail(index, totalPosts) {
    if (totalPosts < 3) return index === totalPosts - 1;
    return index === 2 || index === 6 || index === 10 || index === 15;
}

function railIndexForPost(index, railCount) {
    const insertOrder = [2, 6, 10, 15];
    const position = Math.max(0, insertOrder.indexOf(index));
    return position % railCount;
}
