import React from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, usePage } from '@inertiajs/react';
import PostCard from '@/Components/PostCard';
import { DiscoveryHeader, DiscoveryRailSection, useDiscoveryRails } from '@/Components/DiscoveryRails';

export default function Feed({ initialPosts = [] }) {
    const { auth } = usePage().props;
    const defaultProfile = auth.user?.merchant_profiles?.find(p => p.is_default) || auth.user?.merchant_profiles?.[0];
    const { rails, loaded: railsLoaded } = useDiscoveryRails();
    const heroRail = rails[0] || null;
    const inlineRails = rails.slice(1, 5);

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
                {initialPosts.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground px-4">
                        <p className="font-semibold">Hakuna machapisho bado.</p>
                        <p className="text-sm mt-1">Kuwa wa kwanza kuchapisha bidhaa yako!</p>
                    </div>
                ) : (
                    initialPosts.map((post, index) => (
                        <React.Fragment key={post.id}>
                            <PostCard post={post} />
                            {inlineRails.length > 0 && shouldInsertRail(index, initialPosts.length) && (
                                <DiscoveryRailSection
                                    rail={inlineRails[railIndexForPost(index, inlineRails.length)]}
                                    compact
                                />
                            )}
                        </React.Fragment>
                    ))
                )}
            </div>
        </AppLayout>
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
