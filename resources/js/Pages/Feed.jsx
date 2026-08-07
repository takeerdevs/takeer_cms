import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import { BadgeCheck, ChevronRight, DownloadCloud, Image, Loader2, Music, PenLine, Play, ShieldCheck, ShoppingBag, Sparkles, Store } from 'lucide-react';
import PostCard from '@/Components/PostCard';
import { DiscoveryRailSection, useDiscoveryRails } from '@/Components/DiscoveryRails';
import { productCardPriceLabel } from '@/lib/productUnits';
import { useLocale } from '@/lib/i18n';

const fetcher = async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Feed request failed');

    const payload = await res.json();
    if (!Array.isArray(payload?.data)) throw new Error('Feed response is invalid');

    return payload;
};

export default function Feed({ initialPosts = [], initialFeed = null }) {
    const { t } = useLocale();
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
            <Head title={`${t('feed.title')} | Takeer`} />

            <div className="mx-auto grid w-full max-w-[1380px] grid-cols-1 xl:grid-cols-[260px_minmax(0,680px)_300px] xl:gap-8 xl:px-6">
                <FeedLeftRail rails={rails} profile={defaultProfile} isAuthenticated={Boolean(auth?.user)} />

                <div className="mx-auto w-full max-w-[680px] divide-y divide-border/60 bg-background/88 xl:bg-background/72 xl:backdrop-blur-[1px]">
                    {railsLoaded && rails.length > 0 && (
                        <div className="border-b border-border/60 bg-white/65 px-4 py-5 sm:px-5">
                            <div>
                                <DiscoveryRailSection rail={heroRail} featured />
                            </div>
                        </div>
                    )}
                    {posts.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground px-4">
                            <p className="font-semibold">{t('feed.empty')}</p>
                            <p className="text-sm mt-1">{t('feed.emptyDescription')}</p>
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
                            {t('feed.loadFailed')}
                        </div>
                    )}
                    {!isReachingEnd && posts.length > 0 && (
                        <div ref={sentinelRef} className="flex min-h-24 items-center justify-center py-6">
                            {isLoadingMore ? (
                                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                            ) : (
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('feed.loadingMore')}</span>
                            )}
                        </div>
                    )}
                </div>

                <FeedRightRail rails={rails} posts={posts} profile={defaultProfile} isAuthenticated={Boolean(auth?.user)} />
            </div>
        </AppLayout>
    );
}

function FeedLeftRail({ rails = [], profile = null, isAuthenticated = false }) {
    const { t } = useLocale();
    const digitalRails = rails.filter((rail) => ['premium_media', 'downloads'].includes(rail.key));
    const digitalItems = digitalRails
        .flatMap((rail) => (rail.items || []).map((item) => ({ ...item, railKey: rail.key })))
        .filter((item) => item.type === 'digital')
        .slice(0, 4);
    const featuredItem = digitalItems[0] || null;
    const uploadHref = isAuthenticated && profile?.username
        ? `/merchant/${profile.username}/upload?type=digital`
        : '/merchant/register';

    return (
        <aside className="hidden xl:sticky xl:top-4 xl:block xl:h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:pr-1 xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden" aria-label={t('feed.digitalProducts')}>
            <div className="space-y-4 py-1">
                <div className="rounded-2xl bg-white/78 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="mt-0.5 text-sm font-bold text-slate-950">{t('feed.buyOpenInstantly')}</p>
                        </div>
                    </div>

                    {featuredItem ? (
                        <DigitalFeaturedCard item={featuredItem} />
                    ) : (
                        <DigitalUploadPrompt href={uploadHref} isAuthenticated={isAuthenticated} />
                    )}
                </div>

                {digitalItems.length > 1 && (
                    <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-slate-200/60 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('feed.premiumDrops')}</p>
                            <Link href="/search?q=premium&type=digital&surface=products" className="text-[11px] font-black text-brand-600">{t('feed.seeAll')}</Link>
                        </div>
                        <div className="mt-3 space-y-3">
                            {digitalItems.slice(1).map((item) => (
                                <DigitalShelfRow key={`digital-${item.id}`} item={item} />
                            ))}
                        </div>
                    </div>
                )}

                <Link href={uploadHref} className="group block rounded-2xl border border-dashed border-brand-200 bg-brand-50/70 p-4 transition-colors hover:bg-brand-50">
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-brand-100">
                            <DownloadCloud className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-slate-950">{t('feed.sellDigitalProduct')}</p>
                            <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-600">{t('feed.uploadDigital')}</p>
                            <p className="text-xs mt-2 font-semibold leading-5 text-slate-600">{t('feed.termsApply')}</p>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center text-xs font-black text-brand-700">
                        {isAuthenticated ? t('feed.startSelling') : t('feed.openAccountToSell')}
                        <ChevronRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                </Link>
            </div>
        </aside>
    );
}

function FeedRightRail({ rails = [], posts = [], profile = null, isAuthenticated = false }) {
    const { t } = useLocale();
    const featuredItems = rails.flatMap((rail) => rail.items || []).slice(0, 3);
    const activeMerchants = uniqueMerchants(posts
        .map((post) => post.merchant_profile || post.merchant)
        .filter(Boolean))
        .slice(0, 3);
    const storeEntries = activeMerchants.length > 0 ? activeMerchants : [profile].filter(Boolean);

    return (
        <aside className="hidden xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-2rem)] xl:self-start xl:flex-col xl:overflow-y-auto xl:pr-1 xl:[scrollbar-width:none] xl:[&::-webkit-scrollbar]:hidden" aria-label={t('feed.businessInfo')}>
            <div className="space-y-4">
                <div className="rounded-2xl bg-white/78 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{t('feed.mostViewed')}</p>
                            <p className="mt-0.5 text-sm font-bold text-slate-950">{t('feed.mostOpenedOffers')}</p>
                        </div>
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    </div>

                    {featuredItems.length > 0 && (
                        <div className="mt-3 space-y-3">
                            {featuredItems.map((item) => (
                                <Link key={`${item.type || 'item'}-${item.id}`} href={`/product/${item.slug || item.id}`} className="group flex items-center gap-3">
                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xs bg-slate-100 ring-1 ring-slate-200/80">
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
                                        <p className="truncate text-xs font-semibold text-brand-600">{item.checkout_price || item.price ? productCardPriceLabel(item) : t('feed.viewOffer')}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto px-2 pt-10 text-xs font-semibold leading-6 text-slate-500">
                <div className="flex flex-wrap gap-x-3">
                    <Link href="/legal" className="hover:text-slate-900">{t('common.legalCenter')}</Link>
                    <Link href="/help" className="hover:text-slate-900">{t('feed.help')}</Link>
                </div>
                <p className="mt-2">Takeer © 2026</p>
            </div>
        </aside>
    );
}

function DigitalFeaturedCard({ item }) {
    const { t } = useLocale();
    const Icon = digitalProductIcon(item);

    return (
        <Link href={`/product/${item.slug || item.id}`} className="mt-4 block overflow-hidden rounded-xl bg-slate-950 text-white shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="relative aspect-[4/3] bg-slate-900">
                {item.image_url ? (
                    <img src={item.image_url} alt="" className="h-full w-full object-cover opacity-85" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-brand-900 to-slate-800">
                        <Icon className="h-10 w-10 text-brand-100" />
                    </div>
                )}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black uppercase text-slate-950">
                    <Icon className="h-3 w-3" />
                    {digitalProductLabel(item, t)}
                </span>
            </div>
            <div className="p-3">
                <p className="line-clamp-2 text-sm font-black leading-tight">{item.title || item.name}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-brand-200">{priceLabel(item, t)}</p>
                    <span className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-xs font-black text-slate-950">{t('feed.open')}</span>
                </div>
            </div>
        </Link>
    );
}

function DigitalShelfRow({ item }) {
    const { t } = useLocale();
    const Icon = digitalProductIcon(item);

    return (
        <Link href={`/product/${item.slug || item.id}`} className="group flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                {item.image_url ? (
                    <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                    <Icon className="h-5 w-5" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950 group-hover:text-brand-700">{item.title || item.name}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{digitalProductLabel(item, t)} · {priceLabel(item, t)}</p>
            </div>
        </Link>
    );
}

function DigitalUploadPrompt({ href, isAuthenticated = false }) {
    const { t } = useLocale();
    return (
        <Link href={href} className="mt-4 block">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-slate-200">
                <DownloadCloud className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-black leading-tight text-slate-950">
                {t('feed.noDigitalOffers')}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                {t('feed.digitalPrompt')}
            </p>
            <p className="mt-3 inline-flex items-center text-xs font-black text-brand-700">
                {isAuthenticated ? t('feed.uploadToSell') : t('feed.joinToSell')}
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </p>
        </Link>
    );
}

function digitalProductLabel(product = {}, t = null) {
    const label = (key, fallback) => t ? t(`feed.digitalTypes.${key}`) : fallback;
    return {
        video_stream: label('video', 'Premium video'),
        audio_stream: label('audio', 'Premium audio'),
        gallery_pack: label('gallery', 'Paid gallery'),
        live_event: label('event', 'Event access'),
        custom_delivery: label('custom', 'Custom digital'),
        file: product.digital_content_type === 'ebook'
            ? label('ebook', 'E-book')
            : product.digital_content_type === 'software'
                ? label('software', 'Software')
                : product.digital_content_type === 'document'
                    ? label('document', 'Document')
                    : label('download', 'Download'),
    }[product.digital_delivery_type] || label('digital', 'Digital');
}

function digitalProductIcon(product = {}) {
    return {
        video_stream: Play,
        audio_stream: Music,
        gallery_pack: Image,
        live_event: Sparkles,
        custom_delivery: PenLine,
        file: DownloadCloud,
    }[product.digital_delivery_type] || DownloadCloud;
}

function priceLabel(item = {}, t = null) {
    const price = Number(item.checkout_price ?? item.discounted_price ?? item.price ?? 0);
    return price > 0 ? productCardPriceLabel(item) : (t ? t('feed.viewPrice') : 'Tazama bei');
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
