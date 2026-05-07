import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import PostCard from '@/Components/PostCard';
import { ArrowLeft, Loader2, Store } from 'lucide-react';

const fetcher = (url) => fetch(url).then(res => res.json());

export default function MiniStoreFeed({ merchantSlug, initialData }) {
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
            <AppLayout hideTabBar>
                <div className="h-full flex items-center justify-center p-6 text-center">
                    <p className="text-destructive mt-10">Biashara haipatikani au mtandao unasumbua.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout hideTabBar>
            <Head title={`${merchant?.name || 'Biashara'} | Feed`} />

            <div className="max-w-lg mx-auto px-4 py-6">
                <div className="flex items-center gap-3 mb-4">
                    <Link href={`/m/${merchantSlug}`} className="h-9 w-9 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Feed</p>
                        <h1 className="text-lg font-black text-foreground flex items-center gap-2">
                            <Store className="h-4 w-4 text-brand-600" />
                            {merchant?.name || 'Biashara'}
                        </h1>
                    </div>
                </div>

                {posts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-16">
                        Hakuna machapisho bado.
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {posts.map((post, index) => (
                            <LazyPostCard key={post.id} post={post} eager={index < 3} />
                        ))}
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
