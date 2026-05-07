import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import PostCard from '@/Components/PostCard';
import { ExternalLink, Globe2, Instagram, Loader2, Mail, MessageCircle, Music2, Send, ShoppingBag, Store, Youtube } from 'lucide-react';

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
    const storefrontSettings = data?.[0]?.storefront_settings || null;
    const socialLinks = (storefrontSettings?.links || []).filter((link) => Boolean(socialLinkMeta(link?.url)));
    const posts = data ? data.flatMap(page => page.posts.data) : [];
    const isReachingEnd = data && data[data.length - 1]?.posts.links.next === null;
    const isLoadingMore = isValidating && size > 0;
    const isInitialLoading = !data && !error;

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
                            <ProfileSocialLinks links={socialLinks} />
                            {merchant?.bio && (
                                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground">{merchant.bio}</p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                    href={`/m/${merchant?.slug || merchantSlug}`}
                                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md"
                                >
                                    <ShoppingBag className="h-4 w-4" />
                                    Mini-store
                                </Link>
                                <Link
                                    href={`/u/${merchant?.slug || merchantSlug}/catalog`}
                                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-brand-200 px-4 text-sm font-black text-brand-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:shadow-md"
                                >
                                    <Store className="h-4 w-4" />
                                    Catalog
                                </Link>
                            </div>
                        </div>
                    </div>
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

function ProfileSocialLinks({ links }) {
    if (!Array.isArray(links) || links.length === 0) return null;

    return (
        <div className="mt-3 flex flex-wrap gap-2">
            {links.slice(0, 4).map((link, index) => {
                const meta = socialLinkMeta(link.url);
                const Icon = meta?.icon || Globe2;
                const title = link.title || meta?.label || linkDomain(link.url) || 'Link';

                return (
                    <a
                        key={`${link.url}-${index}`}
                        href={normalizeLinkUrl(link.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-800 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                    >
                        {meta?.text ? <span className="text-xs font-black">{meta.text}</span> : <Icon className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                    </a>
                );
            })}
        </div>
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
