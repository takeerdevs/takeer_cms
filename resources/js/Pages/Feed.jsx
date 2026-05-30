import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import { BadgeCheck, BookOpen, ChevronRight, FileText, HelpCircle, Home, ImagePlus, Loader2, MapPin, Plus, Search, ShieldCheck, ShoppingBag, Store, Truck } from 'lucide-react';
import PostCard from '@/Components/PostCard';
import { DiscoveryRailSection, useDiscoveryRails } from '@/Components/DiscoveryRails';

const fetcher = async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Feed request failed');

    const payload = await res.json();
    if (!Array.isArray(payload?.data)) throw new Error('Feed response is invalid');

    return payload;
};

export default function Feed({ initialPosts = [], initialFeed = null }) {
    const { auth } = usePage().props;
    const defaultProfile = auth?.user?.merchant_profiles?.find(p => p.is_default) || auth?.user?.merchant_profiles?.[0] || null;
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

            <div className="mx-auto grid w-full max-w-[1380px] grid-cols-1 xl:grid-cols-[260px_minmax(0,680px)_300px] xl:gap-8 xl:px-6">
                <FeedLeftRail rails={rails} profile={defaultProfile} isAuthenticated={Boolean(auth?.user)} />

                <div className="mx-auto w-full max-w-[680px] divide-y divide-border/60 bg-background/88 xl:bg-background/72 xl:backdrop-blur-[1px]">
                    <FeedComposerPrompt profile={defaultProfile} isAuthenticated={Boolean(auth?.user)} />

                    {railsLoaded && rails.length > 0 && (
                        <div className="border-b border-border/60 bg-white/65 px-4 py-5 sm:px-5">
                            <div>
                                <DiscoveryRailSection rail={heroRail} featured />
                            </div>
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

                <FeedRightRail rails={rails} posts={posts} profile={defaultProfile} isAuthenticated={Boolean(auth?.user)} />
            </div>
        </AppLayout>
    );
}

function FeedComposerPrompt({ profile = null, isAuthenticated = false }) {
    const mediaInputRef = useRef(null);
    const openComposer = (options = {}) => {
        if (typeof window === 'undefined') return;
        if (window.__openComposerForCurrentUser) {
            window.__openComposerForCurrentUser(options);
            return;
        }
        window.__openComposer?.({ mode: 'short', ...options });
    };
    const handleMediaPicked = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length > 0) {
            openComposer({ mode: 'short', mediaFiles: files });
        }
        event.target.value = '';
    };

    if (!isAuthenticated) {
        return (
            <div className="border-b border-border/60 bg-white/70 px-4 py-4 sm:px-5">
                <Link href="/merchant/register" className="group flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200/80 transition-all hover:ring-brand-200">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Plus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-950">Jiunge Takeer kuuza, kuchapisha na kununua kwa usalama</p>
                        <p className="truncate text-xs font-semibold text-slate-500">Fungua akaunti au endelea kuvinjari sokoni.</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-500" />
                </Link>
            </div>
        );
    }

    return (
        <div className="border-b border-border/60 bg-white/70 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-300 to-brand-600 text-sm font-black text-white ring-2 ring-white">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : merchantInitial(profile)}
                </div>
                <button
                    type="button"
                    onClick={() => openComposer({ mode: 'short' })}
                    className="flex h-11 flex-1 items-center rounded-full bg-slate-100 px-4 text-left text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-200/70"
                >
                    Unauza au kushare nini leo?
                </button>
                <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-600 sm:flex"
                    aria-label="Ongeza picha au video"
                >
                    <ImagePlus className="h-5 w-5" />
                </button>
                <input
                    ref={mediaInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleMediaPicked}
                />
            </div>
        </div>
    );
}

function FeedLeftRail({ rails = [], profile = null, isAuthenticated = false }) {
    return (
        <aside className="hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:pr-1 xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden" aria-label="Njia za haraka za feed">
            <nav className="space-y-5 py-1">
                <RailSection>
                    <SideRailLink href="/" icon={Home} label="Nyumbani" active />
                    <SideRailLink href="/search?surface=products" icon={Search} label="Tafuta sokoni" />
                    <SideRailLink href="/search?q=nearby&type=physical&surface=products" icon={MapPin} label="Vilivyo karibu" />
                    <SideRailLink href={isAuthenticated ? '/orders' : '/login'} icon={ShoppingBag} label="Oda" />
                </RailSection>

                <RailSection title="Msaada">
                    <SideRailLink href="/search?q=safepay" icon={ShieldCheck} label="SafePay" />
                    <SideRailLink href="/search?q=delivery" icon={Truck} label="Huduma za delivery" />
                    <SideRailLink href="/terms" icon={FileText} label="Masharti" />
                    <SideRailLink href="/privacy" icon={BookOpen} label="Faragha" />
                    <SideRailLink href="/search?q=help" icon={HelpCircle} label="Usaidizi" />
                </RailSection>
            </nav>
        </aside>
    );
}

function FeedRightRail({ rails = [], posts = [], profile = null, isAuthenticated = false }) {
    const featuredItems = rails.flatMap((rail) => rail.items || []).slice(0, 3);
    const activeMerchants = uniqueMerchants(posts
        .map((post) => post.merchant_profile || post.merchant)
        .filter(Boolean))
        .slice(0, 3);
    const storeEntries = activeMerchants.length > 0 ? activeMerchants : [profile].filter(Boolean);

    return (
        <aside className="hidden xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100vh-6rem)] xl:self-start xl:flex-col xl:overflow-y-auto xl:pr-1 xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden" aria-label="Taarifa za biashara">
            <div className="space-y-4">
                <div className="rounded-2xl bg-white/78 p-4 ring-1 ring-slate-200/70 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Zinazotazamwa</p>
                            <p className="mt-0.5 text-sm font-bold text-slate-950">Ofa zinazofunguliwa sana</p>
                        </div>
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    </div>

                    {featuredItems.length > 0 && (
                        <div className="mt-3 space-y-3">
                            {featuredItems.map((item) => (
                                <Link key={`${item.type || 'item'}-${item.id}`} href={`/product/${item.slug || item.id}`} className="group flex items-center gap-3">
                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/80">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                                                <ShoppingBag className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-950 group-hover:text-brand-700">{item.title || item.name}</p>
                                        <p className="truncate text-xs font-semibold text-brand-600">{item.checkout_price || item.price ? `TZS ${Number(item.checkout_price || item.price).toLocaleString()}` : 'Tazama ofa'}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    <Link href={isAuthenticated ? '/orders' : '/login'} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white transition-colors hover:bg-slate-800">
                        <ShoppingBag className="h-4 w-4" />
                        {isAuthenticated ? 'Tazama oda' : 'Ingia'}
                    </Link>
                </div>

                <div className="rounded-2xl bg-white/60 px-4 py-4 ring-1 ring-slate-200/60 backdrop-blur-md">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Maduka</p>
                    <div className="mt-3 space-y-3">
                        {storeEntries.length > 0 ? storeEntries.map((merchant, index) => (
                            <Link key={`${merchant?.username || merchant?.id || index}`} href={merchantHref(merchant)} className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-300 to-brand-600 text-sm font-black text-white ring-2 ring-white">
                                    {merchant?.avatar_url ? <img src={merchant.avatar_url} alt="" className="h-full w-full object-cover" /> : merchantInitial(merchant)}
                                </div>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1 truncate text-sm font-bold text-slate-950">
                                        {merchantName(merchant)}
                                        {merchant?.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
                                    </p>
                                    <p className="truncate text-xs font-semibold text-slate-500">@{merchantHandle(merchant)}</p>
                                </div>
                            </Link>
                        )) : (
                            <Link href={isAuthenticated ? '/merchant/register' : '/login'} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-slate-200">
                                    <Store className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-950">Vinjari maduka</p>
                                    <p className="truncate text-xs font-semibold text-slate-500">Tazama ofa mpya zinavyoonekana</p>
                                </div>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-auto px-2 pt-10 text-xs font-semibold leading-6 text-slate-500">
                <div className="flex flex-wrap gap-x-3">
                    <Link href="/terms" className="hover:text-slate-900">Masharti</Link>
                    <Link href="/privacy" className="hover:text-slate-900">Faragha</Link>
                    <Link href="/search?q=help" className="hover:text-slate-900">Usaidizi</Link>
                </div>
                <p className="mt-2">Takeer © 2026</p>
            </div>
        </aside>
    );
}

function SideRailLink({ href, icon: Icon, label, active = false }) {
    return (
        <Link
            href={href}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${active
                    ? 'bg-white/80 text-slate-950 ring-1 ring-slate-200/70'
                    : 'text-slate-700 hover:bg-white/70 hover:text-brand-700'
                }`}
        >
            <span className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                {label}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        </Link>
    );
}

function RailSection({ title = null, children }) {
    return (
        <div className="space-y-1">
            {title && (
                <p className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    {title}
                </p>
            )}
            {children}
        </div>
    );
}

function MiniStat({ value, label }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-lg font-black leading-none text-slate-950">{value}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        </div>
    );
}

function merchantName(merchant = {}) {
    return merchant?.display_name || merchant?.name || merchant?.username || 'Takeer store';
}

function merchantHandle(merchant = {}) {
    return merchant?.username || merchant?.name?.toLowerCase().replace(/\s/g, '_') || 'store';
}

function merchantInitial(merchant = {}) {
    return merchantName(merchant).charAt(0).toUpperCase();
}

function merchantHref(merchant = {}) {
    const handle = merchantHandle(merchant);
    return `/u/${handle}`;
}

function uniqueMerchants(merchants = []) {
    const seen = new Set();
    return merchants.filter((merchant) => {
        const key = merchant?.username || merchant?.id || merchant?.name;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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

function railSearchHref(rail) {
    const map = {
        nearby: '/search?q=nearby&type=physical&surface=products',
        premium_media: '/search?q=premium&type=digital&surface=products',
        creator_tools: '/search?q=creator&type=digital&surface=products',
        subscriptions: '/search?q=membership&type=creator',
    };

    return map[rail?.key] || '/search?surface=products';
}
