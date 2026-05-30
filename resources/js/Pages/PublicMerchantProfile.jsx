import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import PostCard from '@/Components/PostCard';
import FollowStoreButton from '@/Components/FollowStoreButton';
import { BadgeCheck, Globe2, Instagram, Link2, Loader2, Mail, MessageCircle, Music2, Send, Youtube } from 'lucide-react';

const fetcher = (url) => fetch(url, { headers: { Accept: 'application/json' } }).then(res => res.json());

export default function PublicMerchantProfile({ merchantSlug, initialData }) {
    const sentinelRef = useRef(null);
    const getKey = (pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData.posts.links.next) return null;
        return `/api/merchant/${merchantSlug}?page=${pageIndex + 1}&profile=1`;
    };

    const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, fetcher, {
        fallbackData: initialData ? [initialData] : undefined,
        revalidateOnFocus: false,
    });

    const merchant = data?.[0]?.merchant || null;
    const storefrontSettings = data?.[0]?.storefront_settings || null;
    const socialLinks = (storefrontSettings?.links || []).filter((link) => Boolean(socialLinkMeta(link?.url)));
    const posts = data ? data.flatMap(page => page.posts.data) : [];
    const isReachingEnd = data && data[data.length - 1]?.posts.links.next === null;
    const isLoadingMore = isValidating && size > 0;
    const isInitialLoading = !data && !error;
    const slug = merchant?.slug || merchantSlug;

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
                <header className="border-b border-neutral-200/80 bg-background px-5 pb-5 pt-6">
                    {isInitialLoading ? (
                        <ProfileHeaderSkeleton />
                    ) : (
                        <div className="mx-auto max-w-[560px] text-center">
                            <ProfileAvatar
                                name={merchant?.name}
                                avatarUrl={merchant?.avatar_url}
                            />

                            <div className="mt-3 flex min-w-0 items-center justify-center gap-1.5">
                                <p className="truncate text-xl font-bold leading-tight text-foreground">
                                    {merchant?.name || 'Biashara'}
                                </p>
                                {merchant?.is_verified && (
                                    <BadgeCheck
                                        className="h-5 w-5 shrink-0 text-sky-500"
                                        aria-label="Verified profile"
                                    />
                                )}
                            </div>
                            <p className="mt-0.5 text-sm font-medium text-muted-foreground">@{slug}</p>

                            {(merchant?.business_category || merchant?.bio) && (
                                <div className="mt-3 space-y-1">
                                    {merchant?.business_category && (
                                        <p className="text-sm font-medium text-muted-foreground">
                                            {merchant.business_category}
                                        </p>
                                    )}
                                    {merchant?.bio && (
                                        <p className="mx-auto max-w-[460px] whitespace-pre-line text-sm leading-5 text-foreground">
                                            {merchant.bio}
                                        </p>
                                    )}
                                </div>
                            )}

                            <ProfileLinkRow links={socialLinks} />

                            <div className="mt-5">
                                <Link
                                    href={`/u/${slug}/shop/all`}
                                    className="inline-flex h-9 w-full items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                                >
                                    Shop
                                </Link>
                            </div>
                            <div className="mt-2">
                                <FollowStoreButton
                                    merchantSlug={slug}
                                    initialFollowing={merchant?.is_following}
                                    initialCount={merchant?.followers_count}
                                    isOwner={merchant?.is_owner}
                                />
                            </div>
                            <Link
                                href={`/m/${slug}`}
                                className="mt-2.5 flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-brand-700"
                            >
                                <Link2 className="h-3 w-3" />
                                Link page · share on social
                            </Link>
                        </div>
                    )}
                </header>

                <section className="divide-y divide-border">
                    {isInitialLoading ? (
                        <div className="flex min-h-[280px] items-center justify-center px-5 py-16">
                            <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
                        </div>
                    ) : posts.length === 0 ? (
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

function ProfileAvatar({ name, avatarUrl }) {
    const initial = (name || 'T').charAt(0).toUpperCase();

    return (
        <div className="mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-full border border-neutral-200/90 bg-neutral-100 shadow-sm">
            {avatarUrl ? (
                <img src={avatarUrl} alt={name || 'Profile'} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-[34px] font-normal text-neutral-500">
                    {initial}
                </div>
            )}
        </div>
    );
}

function ProfileHeaderSkeleton() {
    return (
        <>
            <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-neutral-100" />
            <div className="mt-4 flex flex-col items-center space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-neutral-100" />
                <div className="h-3.5 w-24 animate-pulse rounded bg-neutral-100" />
                <div className="h-3 w-52 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="mt-5">
                <div className="h-9 w-full animate-pulse rounded-full bg-neutral-100" />
            </div>
        </>
    );
}

function ProfileLinkRow({ links }) {
    if (!Array.isArray(links) || links.length === 0) return null;

    const available = links.filter((link) => !link.link_unavailable && link.tracked_link_status !== 'disabled');
    if (available.length === 0) return null;

    const primary = available[0];
    const primaryLabel = linkDomain(primary.url) || primary.title || 'Link';
    const moreCount = available.length - 1;

    const openLink = (link) => {
        const href = link.tracked_url || normalizeLinkUrl(link.url);
        window.open(href, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="pt-3">
            <button
                type="button"
                onClick={() => openLink(primary)}
                className="inline-flex max-w-full items-center justify-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                    {primaryLabel}
                    {moreCount > 0 && ` na ${moreCount} zaidi`}
                </span>
            </button>
            {moreCount > 0 && (
                <div className="mt-1.5 flex flex-col items-center gap-1">
                    {available.slice(1, 4).map((link, index) => {
                        const meta = socialLinkMeta(link.url);
                        const Icon = meta?.icon || Globe2;
                        const label = link.title || meta?.label || linkDomain(link.url);

                        return (
                            <button
                                type="button"
                                key={`${link.url}-${index}`}
                                onClick={() => openLink(link)}
                                className="inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-foreground transition-colors hover:text-brand-700"
                            >
                                {meta?.text ? (
                                    <span className="text-xs font-semibold">{meta.text}</span>
                                ) : (
                                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="truncate">{label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function normalizeLinkUrl(url = '') {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function socialLinkMeta(url = '') {
    const normalized = normalizeLinkUrl(url);
    let host = '';
    try {
        host = new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        host = linkDomain(normalized).toLowerCase();
    }

    if (hostMatches(host, 'instagram.com')) return { label: 'Instagram', icon: Instagram };
    if (hostMatches(host, 'youtube.com') || hostMatches(host, 'youtu.be')) return { label: 'YouTube', icon: Youtube };
    if (hostMatches(host, 'tiktok.com')) return { label: 'TikTok', icon: Music2 };
    if (hostMatches(host, 'x.com') || hostMatches(host, 'twitter.com')) return { label: 'X', text: 'X' };
    if (hostMatches(host, 'facebook.com')) return { label: 'Facebook', text: 'f' };
    if (hostMatches(host, 'threads.net')) return { label: 'Threads', text: '@' };
    if (hostMatches(host, 'wa.me') || hostMatches(host, 'whatsapp.com')) return { label: 'WhatsApp', icon: MessageCircle };
    if (hostMatches(host, 't.me') || hostMatches(host, 'telegram.me')) return { label: 'Telegram', icon: Send };
    if (hostMatches(host, 'spotify.com') || hostMatches(host, 'podcasts.apple.com') || hostMatches(host, 'soundcloud.com')) return { label: 'Audio', icon: Music2 };
    if (normalized.startsWith('mailto:')) return { label: 'Email', icon: Mail };

    return null;
}

function hostMatches(host, root) {
    return host === root || host.endsWith(`.${root}`);
}

function linkDomain(url = '') {
    try {
        const parsed = new URL(normalizeLinkUrl(url));
        return parsed.hostname.replace(/^www\./i, '');
    } catch {
        return String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    }
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
