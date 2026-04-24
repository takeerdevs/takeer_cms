import React from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import PostCard from '@/Components/PostCard';
import { ArrowLeft, Store } from 'lucide-react';

const fetcher = (url) => fetch(url).then(res => res.json());

export default function MiniStoreFeed({ merchantSlug, initialData }) {
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
                        {posts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                )}

                {!isReachingEnd && posts.length > 0 && (
                    <div className="py-6 flex justify-center">
                        <button
                            onClick={() => setSize(size + 1)}
                            className="h-10 px-5 rounded-full border border-border text-sm font-bold hover:bg-accent transition-colors"
                            disabled={isValidating}
                        >
                            {isValidating ? 'Inapakia...' : 'Ongeza Zaidi'}
                        </button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
