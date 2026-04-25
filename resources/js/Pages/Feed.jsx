import React, { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, usePage } from '@inertiajs/react';
import PostCard from '@/Components/PostCard';

export default function Feed({ initialPosts = [] }) {
    const { auth } = usePage().props;
    const defaultProfile = auth.user?.merchant_profiles?.find(p => p.is_default) || auth.user?.merchant_profiles?.[0];

    return (
        <AppLayout>
            <Head title="Nyumbani | Takeer" />

            <div className="max-w-2xl mx-auto divide-y divide-border">
                {initialPosts.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground px-4">
                        <p className="font-semibold">Hakuna machapisho bado.</p>
                        <p className="text-sm mt-1">Kuwa wa kwanza kuchapisha bidhaa yako!</p>
                    </div>
                ) : (
                    initialPosts.map(post => (
                        <PostCard key={post.id} post={post} />
                    ))
                )}
            </div>
        </AppLayout>
    );
}
