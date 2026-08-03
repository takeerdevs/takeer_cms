import React, { useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import useSWR from 'swr';
import {
    ArrowLeft,
    BadgeCheck,
    BookOpenText,
    CalendarClock,
    Crown,
    DownloadCloud,
    ExternalLink,
    Layers,
    Link2,
    Loader2,
    Search,
    ShoppingBag,
    Sparkles,
    Truck,
    Wrench,
} from 'lucide-react';
import { productPriceLabel } from '@/lib/productUnits';
import { formatOfferCount } from '@/Components/MerchantOffersPanel';
import FeedFreightRouteCard from '@/Components/FreightRouteCard';
import FollowStoreButton from '@/Components/FollowStoreButton';
import { useLocale } from '@/lib/i18n';

const fetcher = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Offers request failed (${response.status})`);
    return response.json();
};

const SHOP_SECTIONS = [
    { key: 'all', label: 'All', countKey: 'shop_total', apiType: 'all', icon: Sparkles, hint: 'Full shop', tone: 'slate' },
    { key: 'products', label: 'Products', countKey: 'physical', apiType: 'physical', icon: ShoppingBag, hint: 'Physical goods', tone: 'blue' },
    { key: 'services', label: 'Services', countKey: 'services', apiType: 'service', icon: Wrench, hint: 'Bookable work', tone: 'emerald' },
    { key: 'digital', label: 'Digital', countKey: 'digital', apiType: 'digital', icon: DownloadCloud, hint: 'Files & online', tone: 'sky' },
    { key: 'content', label: 'Content', countKey: 'content', apiType: 'content', icon: BookOpenText, hint: 'Premium posts', tone: 'violet' },
    { key: 'offerings', label: 'Offerings', countKey: 'offerings', apiType: 'offering_group', icon: Layers, hint: 'Menus & packages', tone: 'teal' },
    { key: 'freight', label: 'Freight', countKey: 'freight_routes', apiType: 'freight_route', icon: Truck, hint: 'Shipping routes', tone: 'indigo' },
    { key: 'bundles', label: 'Bundles', countKey: 'bundles', apiType: 'bundle', icon: Layers, hint: 'Packages', tone: 'amber' },
    { key: 'memberships', label: 'Memberships', countKey: 'memberships', apiType: 'membership', icon: Crown, hint: 'Recurring access', tone: 'rose' },
];

const SECTION_COPY = {
    all: {
        eyebrow: 'Shop',
        title: 'Discover our offerings',
        body: 'Explore products, services, downloads, bundles, memberships, and premium content from this merchant.',
    },
    products: {
        eyebrow: 'Products',
        title: 'Browse physical products',
        body: 'Shop stocked items with clear pricing, product photos, and checkout-ready detail pages.',
    },
    services: {
        eyebrow: 'Services',
        title: 'Book or request services',
        body: 'Find services, custom work, appointments, sessions, and other merchant-provided offers.',
    },
    digital: {
        eyebrow: 'Digital',
        title: 'Downloadable and online goods',
        body: 'Digital files, streams, galleries, software, documents, and remote delivery offers.',
    },
    content: {
        eyebrow: 'Content',
        title: 'Premium creator content',
        body: 'Paid posts, guides, lessons, media, and other creator-only material.',
    },
    offerings: {
        eyebrow: 'Offerings',
        title: 'Menus, packages, and itineraries',
        body: 'Discover grouped offers such as menus, service packages, tours, and multi-item experiences.',
    },
    freight: {
        eyebrow: 'Freight',
        title: 'Freight routes and shipping lanes',
        body: 'Browse active routes, transport modes, rates, and delivery instructions from this forwarder.',
    },
    bundles: {
        eyebrow: 'Bundles',
        title: 'Packages and collections',
        body: 'Grouped offers, courses, kits, and curated packages sold together.',
    },
    memberships: {
        eyebrow: 'Memberships',
        title: 'Plans and recurring access',
        body: 'Subscribe for ongoing benefits, member-only content, services, or access.',
    },
};

export default function PublicShop({ merchantSlug, shopSection = 'all' }) {
    const { t } = useLocale();
    const section = SHOP_SECTIONS.some((item) => item.key === shopSection) ? shopSection : 'all';
    const sectionConfig = SHOP_SECTIONS.find((item) => item.key === section) || SHOP_SECTIONS[0];
    const [query, setQuery] = useState('');
    const [bioExpanded, setBioExpanded] = useState(false);

    const { data, error, isLoading } = useSWR(
        `/api/merchant/${merchantSlug}/offers?type=${sectionConfig.apiType}`,
        fetcher,
        { revalidateOnFocus: false },
    );

    const merchant = data?.merchant || null;
    const offerCounts = data?.offer_counts ?? null;
    const slug = merchant?.slug || merchantSlug;
    const copy = {
        eyebrow: t(`shop.sections.${section}.eyebrow`),
        title: t(`shop.sections.${section}.title`),
        body: t(`shop.sections.${section}.body`),
    };
    const visibleSections = useMemo(() => visibleShopSections(offerCounts).map((item) => ({
        ...item,
        label: t(`shop.sections.${item.key}.label`),
        hint: t(`shop.sections.${item.key}.hint`),
    })), [offerCounts, t]);
    const bio = String(merchant?.bio || '').trim();
    const hasLongBio = bio.length > 140;

    const products = useMemo(() => normalizeOfferList(data?.products), [data]);
    const contentItems = useMemo(() => normalizeOfferList(data?.content_items), [data]);
    const bundles = useMemo(() => normalizeOfferList(data?.bundles), [data]);
    const subscriptionPlans = useMemo(() => normalizeOfferList(data?.subscription_plans), [data]);
    const offeringGroups = useMemo(() => normalizeOfferList(data?.offering_groups), [data]);
    const freightRoutes = useMemo(() => normalizeOfferList(data?.freight_routes), [data]);

    const searchableProducts = useMemo(() => filterByQuery(products, query, productSearchText), [products, query]);
    const searchableContent = useMemo(() => filterByQuery(contentItems, query, (item) => `${item.title} ${item.description || ''}`), [contentItems, query]);
    const searchableBundles = useMemo(() => filterByQuery(bundles, query, (item) => `${item.title} ${item.description || ''}`), [bundles, query]);
    const searchablePlans = useMemo(() => filterByQuery(subscriptionPlans, query, (item) => `${item.name} ${item.description || ''}`), [subscriptionPlans, query]);
    const searchableOfferingGroups = useMemo(() => filterByQuery(offeringGroups, query, (item) => `${item.title} ${item.description || ''} ${item.template_key || ''} ${item.group_type || ''}`), [offeringGroups, query]);
    const searchableFreightRoutes = useMemo(() => filterByQuery(freightRoutes, query, (item) => `${item.title} ${item.origin || ''} ${item.destination || ''} ${item.estimate || ''} ${item.rates_info || ''}`), [freightRoutes, query]);
    const showSearch = ['all', 'products', 'services', 'digital', 'content', 'offerings', 'freight', 'bundles', 'memberships'].includes(section);

    if (error) {
        return (
            <AppLayout>
                <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
                    <p className="text-destructive">{t('shop.loadFailed')}</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${merchant?.name || copy.eyebrow} | ${copy.eyebrow}`} />

            <main className="mx-auto max-w-5xl pb-24">
                <header className="border-b border-neutral-200/80 bg-background">
                    {isLoading ? (
                        <ShopHeaderSkeleton />
                    ) : (
                        <>
                            <div className="relative px-4 py-6 text-center">
                                <Link
                                    href={`/u/${slug}`}
                                    className="absolute left-4 top-5 flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-neutral-100"
                                    aria-label={t('common.backToProfile')}
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                                <Link href={`/u/${slug}`} className="mx-auto flex max-w-md flex-col items-center">
                                    <ShopAvatar name={merchant?.name} avatarUrl={merchant?.avatar_url} />
                                    <div className="mt-3 flex min-w-0 items-center justify-center gap-1.5">
                                        <p className="truncate text-base font-black text-foreground">{merchant?.name || 'Biashara'}</p>
                                        {merchant?.is_verified && (
                                            <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
                                        )}
                                    </div>
                                    <p className="mt-0.5 truncate text-sm text-muted-foreground">@{slug}</p>
                                </Link>
                                {bio && (
                                    <div className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
                                        <p className={bioExpanded ? 'whitespace-pre-line' : 'line-clamp-2 whitespace-pre-line'}>
                                            {bio}
                                        </p>
                                        {hasLongBio && (
                                            <button
                                                type="button"
                                                onClick={() => setBioExpanded((current) => !current)}
                                                className="mt-0.5 font-semibold text-slate-950 hover:text-brand-700"
                                            >
                                                {bioExpanded ? t('shop.less') : t('shop.more')}
                                            </button>
                                        )}
                                    </div>
                                )}
                                <div className="mx-auto mt-4 max-w-sm">
                                    <FollowStoreButton
                                        merchantSlug={slug}
                                        initialFollowing={merchant?.is_following}
                                        initialCount={merchant?.followers_count}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-neutral-100 px-4 py-6 text-center sm:px-6">
                                <p className="text-[11px] font-black uppercase tracking-widest text-brand-700">{copy.eyebrow}</p>
                                <h1 className="mx-auto mt-1 max-w-3xl text-2xl font-black leading-tight text-slate-950 sm:text-4xl">{copy.title}</h1>
                                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{copy.body}</p>
                            </div>

                            <div className="flex flex-wrap justify-center gap-2 border-t border-neutral-100 px-4 py-4 sm:px-6">
                                {visibleSections.map((item) => (
                                    <ShopSectionLink
                                        key={item.key}
                                        section={item}
                                        active={section === item.key}
                                        count={offerCounts?.[item.countKey]}
                                        href={`/u/${slug}/shop/${item.key}`}
                                    />
                                ))}
                            </div>

                            {showSearch && (
                                <div className="border-t border-neutral-100 px-4 py-4 sm:px-6">
                                    <div className="relative mx-auto max-w-2xl">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            className="h-12 w-full rounded-full border border-neutral-200 bg-neutral-50 pl-10 pr-4 text-sm font-medium text-foreground outline-none ring-brand-500/30 transition placeholder:text-muted-foreground focus:border-brand-200 focus:bg-white focus:ring-2"
                                            placeholder={t('shop.searchPlaceholder', { section: copy.eyebrow.toLowerCase() })}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </header>

                {isLoading ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
                    </div>
                ) : (
                    <ShopSectionBody
                        section={section}
                        slug={slug}
                        products={searchableProducts}
                        contentItems={searchableContent}
                        bundles={searchableBundles}
                        subscriptionPlans={searchablePlans}
                        offeringGroups={searchableOfferingGroups}
                        freightRoutes={searchableFreightRoutes}
                    />
                )}

                {!isLoading && (
                    <div className="mx-4 mt-8 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-3 text-center">
                        <p className="text-xs text-muted-foreground">
                            Share off-platform? This creator&apos;s customizable link page lives at{' '}
                            <Link href={`/m/${slug}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">
                                <Link2 className="h-3 w-3" />
                                /m/{slug}
                            </Link>
                        </p>
                    </div>
                )}
            </main>
        </AppLayout>
    );
}

function ShopSectionBody({ section, slug, products, contentItems, bundles, subscriptionPlans, offeringGroups, freightRoutes }) {
    const hasAny = products.length || contentItems.length || bundles.length || subscriptionPlans.length || offeringGroups.length || freightRoutes.length;

    if (!hasAny) {
        return <EmptyShopState section={section} />;
    }

    if (section === 'all') {
        return (
            <div className="space-y-8 px-4 pt-5 sm:px-6 lg:px-8">
                <OfferRail title="Products" href={`/u/${slug}/shop/products`} items={products.filter((item) => item.type === 'physical').slice(0, 8)} renderItem={(item) => <ProductCard key={item.id} product={item} />} />
                <OfferRail title="Services" href={`/u/${slug}/shop/services`} items={products.filter((item) => item.type === 'service').slice(0, 4)} renderItem={(item) => <ServiceCard key={item.id} product={item} />} />
                <OfferRail title="Digital" href={`/u/${slug}/shop/digital`} items={products.filter((item) => item.type === 'digital').slice(0, 4)} renderItem={(item) => <DigitalProductRow key={item.id} product={item} />} layout="list" />
                <OfferRail title="Content" href={`/u/${slug}/shop/content`} items={contentItems.slice(0, 4)} renderItem={(item) => <ContentRow key={item.id} item={item} />} layout="list" />
                <OfferRail title="Offerings" href={`/u/${slug}/shop/offerings`} items={offeringGroups.slice(0, 4)} renderItem={(item) => <OfferingGroupCard key={item.id} group={item} />} />
                <OfferRail title="Freight routes" href={`/u/${slug}/shop/freight`} items={freightRoutes.slice(0, 4)} renderItem={(item) => <FreightRouteCard key={item.id} route={item} />} layout="list" />
                <OfferRail title="Bundles" href={`/u/${slug}/shop/bundles`} items={bundles.slice(0, 3)} renderItem={(item) => <BundleCard key={item.id} bundle={item} />} />
                <OfferRail title="Memberships" href={`/u/${slug}/shop/memberships`} items={subscriptionPlans.slice(0, 3)} renderItem={(item) => <MembershipCard key={item.id} plan={item} />} />
            </div>
        );
    }

    if (section === 'products') {
        return <GridWrap>{products.map((item) => <ProductCard key={item.id} product={item} />)}</GridWrap>;
    }

    if (section === 'services') {
        return <ListWrap>{products.map((item) => <ServiceCard key={item.id} product={item} />)}</ListWrap>;
    }

    if (section === 'digital') {
        return <ListWrap>{products.map((item) => <DigitalProductRow key={item.id} product={item} />)}</ListWrap>;
    }

    if (section === 'content') {
        return <ListWrap>{contentItems.map((item) => <ContentRow key={item.id} item={item} />)}</ListWrap>;
    }

    if (section === 'offerings') {
        return <GridWrap>{offeringGroups.map((item) => <OfferingGroupCard key={item.id} group={item} />)}</GridWrap>;
    }

    if (section === 'freight') {
        return <ListWrap>{freightRoutes.map((item) => <FreightRouteCard key={item.id} route={item} />)}</ListWrap>;
    }

    if (section === 'bundles') {
        return <GridWrap>{bundles.map((item) => <BundleCard key={item.id} bundle={item} />)}</GridWrap>;
    }

    if (section === 'memberships') {
        return <GridWrap>{subscriptionPlans.map((item) => <MembershipCard key={item.id} plan={item} />)}</GridWrap>;
    }

    return null;
}

function ShopSectionLink({ section, active, count, href }) {
    const Icon = section.icon;
    const countLabel = count !== null && count !== undefined ? formatOfferCount(count) : '0';

    return (
        <Link
            href={href}
            className={`group flex min-h-[72px] w-[calc(50%-0.25rem)] min-w-0 flex-col justify-between rounded-lg border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm sm:min-h-[86px] sm:w-52 sm:p-3 ${active
                ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
                : 'border-neutral-200 bg-white text-slate-950 hover:border-brand-200'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${active ? 'bg-white/10 text-white' : sectionToneClass(section.tone)}`}>
                    <Icon className="h-4 w-4" />
                </span>
                <span className={`text-sm font-black tabular-nums ${active ? 'text-white' : 'text-slate-700'}`}>{countLabel}</span>
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-black">{section.label}</p>
                <p className={`mt-0.5 hidden truncate text-xs sm:block ${active ? 'text-white/70' : 'text-slate-500'}`}>{section.hint}</p>
            </div>
        </Link>
    );
}

function sectionToneClass(tone) {
    const tones = {
        slate: 'bg-slate-100 text-slate-700',
        blue: 'bg-blue-50 text-blue-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        sky: 'bg-sky-50 text-sky-700',
        violet: 'bg-violet-50 text-violet-700',
        teal: 'bg-teal-50 text-teal-700',
        indigo: 'bg-indigo-50 text-indigo-700',
        amber: 'bg-amber-50 text-amber-700',
        rose: 'bg-rose-50 text-rose-700',
    };

    return tones[tone] || tones.slate;
}

function visibleShopSections(offerCounts) {
    return SHOP_SECTIONS.filter((section) => {
        if (section.key === 'all') {
            return Number(offerCounts?.shop_total || 0) > 0;
        }

        return Number(offerCounts?.[section.countKey] || 0) > 0;
    });
}

function OfferRail({ title, href, items, renderItem, layout = 'grid' }) {
    const { copy } = useLocale();
    if (!items.length) return null;

    const titleTranslations = {
        Products: 'Bidhaa',
        Services: 'Huduma',
        Digital: 'Kidijitali',
        Content: 'Maudhui',
        Offerings: 'Matoleo',
        'Freight routes': 'Njia za freight',
        Bundles: 'Vifurushi',
        Memberships: 'Uanachama',
    };

    return (
        <section>
            <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="text-base font-black text-slate-950">{copy(title, titleTranslations[title] || title)}</h2>
                <Link href={href} className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-brand-700 hover:text-brand-800">
                    {copy('View all', 'Tazama zote')}
                    <ExternalLink className="h-3 w-3" />
                </Link>
            </div>
            <div className={layout === 'list' ? 'grid gap-2' : 'grid grid-cols-2 gap-3 lg:grid-cols-4'}>
                {items.map((item) => renderItem(item))}
            </div>
        </section>
    );
}

function GridWrap({ children }) {
    return <div className="grid grid-cols-2 gap-3 px-4 pt-5 sm:px-6 lg:grid-cols-4 lg:px-8">{children}</div>;
}

function ListWrap({ children }) {
    return <div className="grid gap-3 px-4 pt-5 sm:px-6 lg:px-8">{children}</div>;
}

function ProductCard({ product }) {
    const { t } = useLocale();
    return (
        <Link href={route('product.show', product.slug || product.id)} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-brand-200 hover:shadow-sm">
            <OfferImage imageUrl={product.image_url} title={product.title} icon={ShoppingBag} />
            <div className="flex flex-1 flex-col p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-brand-700">{t('common.product')}</p>
                <h2 className="mt-1 line-clamp-2 text-sm font-black leading-tight text-slate-950 sm:text-base">{product.title}</h2>
                <OfferFooter price={productPriceLabel(product)} />
            </div>
        </Link>
    );
}

function ServiceCard({ product }) {
    const { t, copy } = useLocale();
    const detail = product.service_location_type || product.service_duration_minutes
        ? [formatServiceLocation(product.service_location_type), formatServiceDuration(product.service_duration_minutes)].filter(Boolean).join(' · ')
        : copy('Service', 'Huduma');

    return (
        <Link href={route('product.show', product.slug || product.id)} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-200 hover:shadow-sm sm:grid-cols-[8rem_1fr_auto]">
            <OfferThumb imageUrl={product.image_url} title={product.title} icon={Wrench} />
            <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">{detail}</p>
                <h2 className="mt-1 line-clamp-2 text-base font-black leading-tight text-slate-950">{product.title}</h2>
                {(product.description || product.service_client_requirements) && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">{product.description || product.service_client_requirements}</p>
                )}
            </div>
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <p className="text-sm font-black text-brand-700">{productPriceLabel(product)}</p>
                <span className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-3 text-xs font-black text-white">{t('common.open')}</span>
            </div>
        </Link>
    );
}

function DigitalProductRow({ product }) {
    const Icon = digitalIcon(product);

    return (
        <Link href={route('product.show', product.slug || product.id)} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-200 hover:bg-slate-50">
            <OfferThumb imageUrl={product.image_url} title={product.title} icon={Icon} compact />
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-wide text-sky-700">{digitalLabel(product)}</p>
                <h2 className="truncate text-base font-black text-slate-950">{product.title}</h2>
                {product.description && <p className="mt-1 line-clamp-1 text-sm text-slate-500">{product.description}</p>}
            </div>
            <p className="shrink-0 text-sm font-black text-brand-700">{productPriceLabel(product)}</p>
        </Link>
    );
}

function ContentRow({ item }) {
    return (
        <Link href={route('content.show', item.slug || item.id)} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-200 hover:bg-slate-50">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                <BookOpenText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-wide text-violet-700">{item.format === 'plain_text' ? 'Post' : 'Premium content'}</p>
                <h2 className="truncate text-base font-black text-slate-950">{item.title}</h2>
                {item.description && <p className="mt-1 line-clamp-1 text-sm text-slate-500">{item.description}</p>}
            </div>
            <p className="shrink-0 text-sm font-black text-brand-700">{formatPrice(item.price)}</p>
        </Link>
    );
}

function OfferingGroupCard({ group }) {
    const label = offeringGroupLabel(group);
    const href = localAppHref(group.href) || `/offerings/${group.id}`;

    return (
        <Link href={href} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-brand-200 hover:shadow-sm">
            <OfferImage imageUrl={group.cover_image_url} title={group.title} icon={Layers} />
            <div className="flex flex-1 flex-col p-3">
                <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">{label}</p>
                <h2 className="mt-1 line-clamp-2 text-base font-black leading-tight text-slate-950">{group.title}</h2>
                {group.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{group.description}</p>}
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <p className="min-w-0 truncate text-sm font-black text-slate-500">{formatOfferingPrice(group.base_price, group.items_count)}</p>
                    <span className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition group-hover:bg-brand-600">
                        Open
                    </span>
                </div>
            </div>
        </Link>
    );
}

function localAppHref(href) {
    if (!href) return null;
    const value = String(href);
    if (value.startsWith('/')) return value;

    try {
        const url = new URL(value);
        if (url.hostname === window.location.hostname) {
            return `${url.pathname}${url.search}${url.hash}`;
        }
    } catch {
        return value;
    }

    return value;
}

function FreightRouteCard({ route }) {
    const href = route.href || `/freight/routes/${route.route_uid || route.id}`;

    return (
        <FeedFreightRouteCard
            snapshot={route}
            routeHref={href}
            onOpen={() => router.visit(href)}
            className="shadow-sm"
        />
    );
}

function BundleCard({ bundle }) {
    return (
        <Link href={route('bundle.show', bundle.slug || bundle.id)} className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <Layers className="h-5 w-5" />
                </div>
                <p className="text-sm font-black text-brand-700">{formatPrice(bundle.price)}</p>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wide text-amber-700">{bundle.is_course ? 'Course bundle' : 'Bundle'}</p>
            <h2 className="mt-1 line-clamp-2 text-base font-black leading-tight text-slate-950">{bundle.title}</h2>
            {bundle.description && <p className="mt-2 line-clamp-3 text-sm text-slate-500">{bundle.description}</p>}
        </Link>
    );
}

function MembershipCard({ plan }) {
    return (
        <Link href={route('subscription-plan.show', plan.slug || plan.id)} className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                    <Crown className="h-5 w-5" />
                </div>
                <p className="text-right text-sm font-black text-brand-700">{formatPrice(plan.price)}</p>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wide text-rose-700">{formatBillingInterval(plan.billing_interval, plan.interval_count)}</p>
            <h2 className="mt-1 line-clamp-2 text-base font-black leading-tight text-slate-950">{plan.name}</h2>
            {plan.description && <p className="mt-2 line-clamp-3 text-sm text-slate-500">{plan.description}</p>}
        </Link>
    );
}

function OfferImage({ imageUrl, title, icon: Icon }) {
    return (
        <div className="aspect-[4/3] overflow-hidden bg-slate-100">
            {imageUrl ? (
                <img src={imageUrl} alt={title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Icon className="h-10 w-10" />
                </div>
            )}
        </div>
    );
}

function OfferThumb({ imageUrl, title, icon: Icon, compact = false }) {
    return (
        <div className={`shrink-0 overflow-hidden rounded-lg bg-slate-100 ${compact ? 'h-14 w-14' : 'h-28 sm:h-24'}`}>
            {imageUrl ? (
                <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <Icon className="h-6 w-6" />
                </div>
            )}
        </div>
    );
}

function OfferFooter({ price }) {
    return (
        <div className="mt-auto pt-3">
            <p className="min-w-0 truncate text-sm font-black text-brand-700 sm:text-base">{price}</p>
        </div>
    );
}

function EmptyShopState({ section }) {
    const { t } = useLocale();
    const eyebrow = t(`shop.sections.${section}.eyebrow`);

    return (
        <div className="px-4 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="mt-4 text-base font-black text-slate-950">{t('shop.empty')}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{t('shop.emptyDescription', { section: eyebrow })}</p>
        </div>
    );
}

function ShopAvatar({ name, avatarUrl }) {
    const initial = (name || 'B').charAt(0).toUpperCase();

    return (
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-neutral-200/90 bg-neutral-100 shadow-sm">
            {avatarUrl ? (
                <img src={avatarUrl} alt={name || 'Profile'} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-500">{initial}</div>
            )}
        </div>
    );
}

function ShopHeaderSkeleton() {
    return (
        <>
            <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-100" />
                <div className="flex flex-1 items-center gap-2.5">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-neutral-100" />
                    <div className="space-y-1.5">
                        <div className="h-3.5 w-28 animate-pulse rounded bg-neutral-100" />
                        <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
                    </div>
                </div>
            </div>
            <div className="space-y-3 border-t border-neutral-100 px-4 py-4">
                <div className="h-3 w-16 animate-pulse rounded bg-neutral-100" />
                <div className="h-8 w-64 max-w-full animate-pulse rounded bg-neutral-100" />
                <div className="h-4 w-96 max-w-full animate-pulse rounded bg-neutral-100" />
            </div>
        </>
    );
}

function normalizeOfferList(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
}

function filterByQuery(items, query, textForItem) {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => textForItem(item).toLowerCase().includes(needle));
}

function productSearchText(product) {
    return `${product.title} ${product.description || ''} ${product.service_client_requirements || ''} ${digitalLabel(product)}`;
}

function formatPrice(price) {
    if (price === null || price === undefined) return 'Free';
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return 'Free';
    return `TZS ${n.toLocaleString()}`;
}

function formatBillingInterval(interval, count = 1) {
    const n = Number(count) || 1;
    const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[interval] || interval || 'period';
    return n === 1 ? `Per ${unit}` : `Every ${n} ${unit}s`;
}

function offeringGroupLabel(group) {
    const map = {
        menu_board: 'Menu board',
        service_package: 'Service package',
        itinerary: 'Itinerary',
    };

    return map[group?.template_key] || String(group?.group_type || 'Offering').replaceAll('_', ' ');
}

function formatOfferingPrice(price, itemsCount = 0) {
    const priceLabel = formatPrice(price);
    if (priceLabel !== 'Free') return priceLabel;
    const n = Number(itemsCount);
    return Number.isFinite(n) && n > 0 ? `${n} item${n === 1 ? '' : 's'}` : 'Open offering';
}

function formatFreightRate(mode) {
    const amount = Number(mode?.price_amount);
    if (Number.isFinite(amount) && amount > 0) {
        const currency = mode?.currency || 'USD';
        const unit = mode?.pricing_model ? ` / ${String(mode.pricing_model).replaceAll('_', ' ')}` : '';
        return `${currency} ${amount.toLocaleString()}${unit}`;
    }

    return mode?.estimate || null;
}

function formatServiceLocation(value) {
    const map = {
        provider_location: 'At provider',
        customer_location: 'At customer',
        remote: 'Remote',
        hybrid: 'Hybrid',
    };

    return map[value] || null;
}

function formatServiceDuration(minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (n < 60) return `${n} min`;
    const hours = n / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

function digitalIcon(product) {
    if (product.digital_delivery_type === 'live_event') return CalendarClock;
    if (['video_stream', 'audio_stream', 'gallery_pack'].includes(product.digital_delivery_type)) return Sparkles;
    return DownloadCloud;
}

function digitalLabel(product) {
    const map = {
        video_stream: 'Premium video',
        audio_stream: 'Premium audio',
        gallery_pack: 'Gallery pack',
        live_event: 'Live event',
        custom_delivery: 'Custom delivery',
        external_link: 'External access',
        file: product.digital_content_type === 'software'
            ? 'Software'
            : product.digital_content_type === 'document'
                ? 'Document'
                : product.digital_content_type === 'ebook'
                    ? 'E-book'
                    : 'Digital download',
    };

    return map[product.digital_delivery_type] || 'Digital';
}
