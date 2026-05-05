import React, { useMemo, useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import { Link, usePage } from '@inertiajs/react';
import { Loader2, Store, Share2, ArrowRight, GripVertical, Star, BookOpenText, Boxes, Crown, Lock, CalendarClock, FileText, Images, Music, PenLine, Video, Code2, DownloadCloud } from 'lucide-react';
import { trackAttributionEvent } from '@/lib/attribution';
import { productPriceLabel } from '@/lib/productUnits';

const fetcher = (url) => fetch(url).then(res => res.json());

export default function MiniStore({ merchantSlug, initialData }) {
    const buildCheckoutItem = (sectionKey, item, merchantInfo) => {
        if (sectionKey === 'content') {
            return {
                id: item.id,
                title: item.title || 'Locked content',
                price: item.price || 0,
                checkoutType: 'content_item',
                merchant: merchantInfo || null,
            };
        }
        if (sectionKey === 'bundles' || sectionKey === 'courses') {
            return {
                ...item,
                title: item.title || (sectionKey === 'courses' ? 'Course' : 'Bundle'),
                checkoutType: 'bundle',
                merchant: merchantInfo || null,
            };
        }
        if (sectionKey === 'memberships') {
            return {
                ...item,
                title: item.name || item.title || 'Membership',
                checkoutType: 'subscription_plan',
                merchant: merchantInfo || null,
            };
        }
        return null;
    };

    const getKey = (pageIndex, previousPageData) => {
        if (previousPageData && !previousPageData.posts.links.next) return null; // reached the end
        return `/api/merchant/${merchantSlug}?page=${pageIndex + 1}`;
    };

    const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, fetcher, {
        fallbackData: initialData ? [initialData] : undefined,
        revalidateOnFocus: false,
    });

    const { auth } = usePage().props;

    // Handle extraction from the custom backend JSON wrapper
    const merchant = data?.[0]?.merchant || null;
    const posts = data ? data.flatMap(page => page.posts.data) : [];
    const storefrontSettings = data?.[0]?.storefront_settings || null;
    const contentItems = data?.[0]?.content_items || [];
    const bundles = data?.[0]?.bundles || [];
    const subscriptionPlans = data?.[0]?.subscription_plans || [];
    const allProducts = data?.[0]?.products || [];
    const productDiscovery = data?.[0]?.product_discovery || {};
    const monetizationSummary = data?.[0]?.monetization_summary || null;

    const isLoadingMore = isValidating && size > 0;
    const isReachingEnd = data && data[data.length - 1]?.posts.links.next === null;
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [sectionOrder, setSectionOrder] = useState(['featured', 'memberships', 'events', 'premium_media', 'commissions', 'downloads', 'content', 'courses', 'bundles', 'services', 'products', 'links', 'updates']);
    const [dragKey, setDragKey] = useState(null);
    const [links, setLinks] = useState([]);
    const [customSections, setCustomSections] = useState([]);
    const [hiddenSections, setHiddenSections] = useState([]);
    const [newLinkTitle, setNewLinkTitle] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [newLinkIcon, setNewLinkIcon] = useState('🔗');
    const [featuredId, setFeaturedId] = useState(null);
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const serviceHours = Array.isArray(storefrontSettings?.service_hours) ? storefrontSettings.service_hours : [];
    const serviceOpenDaysCount = serviceHours.filter((row) => row?.is_open).length;
    const serviceLocations = Array.isArray(storefrontSettings?.service_locations) ? storefrontSettings.service_locations : [];
    const serviceAreaType = storefrontSettings?.service_area_type || null;

    const handleLoadMore = async () => {
        if (isReachingEnd || isValidating) return;
        setIsLoadingNext(true);
        await setSize(size + 1);
        setIsLoadingNext(false);
    };

    const getAttachedProduct = (post) => {
        if (post?.product && Number(post.product.price) > 0) return post.product;
        return post?.product_tags?.[0]?.product || post.product || null;
    };

    useEffect(() => {
        if (!storefrontSettings) return;
        if (storefrontSettings.section_order?.length) setSectionOrder(storefrontSettings.section_order);
        if (storefrontSettings.links?.length) setLinks(storefrontSettings.links);
        if (storefrontSettings.custom_sections?.length) setCustomSections(storefrontSettings.custom_sections);
        if (storefrontSettings.hidden_sections?.length) setHiddenSections(storefrontSettings.hidden_sections);
        if (storefrontSettings.featured_product_id) setFeaturedId(storefrontSettings.featured_product_id);
    }, [storefrontSettings]);

    useEffect(() => {
        if (!merchant?.id && !merchantSlug) return;

        trackAttributionEvent('storefront_view', {
            entity_type: merchant?.id ? 'merchant' : undefined,
            entity_id: merchant?.id || undefined,
            merchant_id: merchant?.id || undefined,
            merchant_username: merchant?.slug || merchantSlug,
            metadata: {
                storefront_slug: merchant?.slug || merchantSlug,
            },
        });
    }, [merchant?.id, merchant?.slug, merchantSlug]);

    const isOwner = !!auth?.user && !!merchant?.slug && auth.user.merchant_profiles?.some(p => p.username === merchant.slug);

    useEffect(() => {
        if (!isOwner) return;

        const payload = {
            section_order: sectionOrder,
            links,
            custom_sections: customSections,
            hidden_sections: hiddenSections,
            featured_product_id: featuredId || null,
        };

        const timeout = setTimeout(() => {
            fetch(`/api/merchant/${merchant.slug}/storefront`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            }).catch(() => { });
        }, 600);

        return () => clearTimeout(timeout);
    }, [sectionOrder, links, featuredId, merchant, auth, customSections, hiddenSections, isOwner]);

    const sections = useMemo(() => {
        const rankProducts = (items) => [...items].sort((a, b) => discoveryScore(b, productDiscovery) - discoveryScore(a, productDiscovery));
        const products = rankProducts(allProducts.filter((product) => product.type === 'physical'));
        const downloads = rankProducts(allProducts.filter((product) => product.type === 'digital' && !['video_stream', 'audio_stream', 'gallery_pack', 'live_event', 'custom_delivery'].includes(product.digital_delivery_type)));
        const services = rankProducts(allProducts.filter((product) => product.type === 'service'));
        const events = rankProducts(allProducts.filter((product) => product.type === 'digital' && product.digital_delivery_type === 'live_event'));
        const premiumMedia = rankProducts(allProducts.filter((product) => product.type === 'digital' && ['video_stream', 'audio_stream', 'gallery_pack'].includes(product.digital_delivery_type)));
        const commissions = rankProducts(allProducts.filter((product) => product.type === 'digital' && product.digital_delivery_type === 'custom_delivery'));

        const courseBundles = bundles.filter((item) => item.is_course);
        const regularBundles = bundles.filter((item) => !item.is_course);

        return [
            { key: 'featured', title: 'Featured', items: [], href: null },
            { key: 'memberships', title: 'Creator Club', items: subscriptionPlans, href: `/m/${merchantSlug}/memberships` },
            { key: 'events', title: 'Live Events', items: events, href: `/m/${merchantSlug}/downloads` },
            { key: 'premium_media', title: 'Premium Media', items: premiumMedia, href: `/m/${merchantSlug}/downloads` },
            { key: 'commissions', title: 'Custom Work', items: commissions, href: `/m/${merchantSlug}/downloads` },
            { key: 'products', title: 'Bidhaa', items: products, href: `/m/${merchantSlug}/products` },
            { key: 'downloads', title: 'Downloads', items: downloads, href: `/m/${merchantSlug}/downloads` },
            { key: 'services', title: 'Huduma', items: services, href: `/m/${merchantSlug}/services` },
            { key: 'content', title: 'Knowledge', items: contentItems, href: `/m/${merchantSlug}/content` },
            { key: 'courses', title: 'Courses', items: courseBundles, href: `/m/${merchantSlug}/courses` },
            { key: 'bundles', title: 'Bundles', items: regularBundles, href: `/m/${merchantSlug}/bundles` },
            { key: 'links', title: 'Links', items: links, href: null, emptyText: 'Ongeza link zako.' },
            { key: 'updates', title: 'Updates', items: [], href: `/m/${merchantSlug}/feed`, emptyText: 'View latest posts from this shop.' },
            ...customSections.map((section) => ({
                key: section.key,
                title: section.title,
                items: section.links || [],
                href: null,
                custom: true,
                emptyText: 'Ongeza link kwa section hili.',
            })),
        ];
    }, [allProducts, merchantSlug, links, customSections, contentItems, bundles, subscriptionPlans, productDiscovery]);

    const orderedSections = useMemo(() => {
        const map = new Map(sections.map(s => [s.key, s]));
        const ordered = sectionOrder.map(key => map.get(key)).filter(Boolean);
        const orderedKeys = new Set(ordered.map((section) => section.key));
        const missing = sections.filter((section) => !orderedKeys.has(section.key));
        return [...ordered, ...missing];
    }, [sections, sectionOrder]);
    const quickSections = orderedSections
        .filter((section) => !['featured', 'links', 'updates'].includes(section.key) && section.items.length > 0)
        .slice(0, 6);

    const featuredProduct = useMemo(() => {
        const allProducts = sections.find(s => s.key === 'products')?.items || [];
        const allDownloads = sections.find(s => s.key === 'downloads')?.items || [];
        const allServices = sections.find(s => s.key === 'services')?.items || [];
        const allEvents = sections.find(s => s.key === 'events')?.items || [];
        const allMedia = sections.find(s => s.key === 'premium_media')?.items || [];
        const allCommissions = sections.find(s => s.key === 'commissions')?.items || [];
        const pool = [...allEvents, ...allMedia, ...allCommissions, ...allDownloads, ...allServices, ...allProducts]
            .sort((a, b) => discoveryScore(b, productDiscovery) - discoveryScore(a, productDiscovery));
        if (featuredId) return pool.find(p => String(p.id) === String(featuredId)) || pool[0] || null;
        return pool[0] || null;
    }, [sections, featuredId, productDiscovery]);
    const hasStoreItems = Boolean(featuredProduct)
        || orderedSections.some((section) => !['featured', 'links', 'updates'].includes(section.key) && section.items.length > 0)
        || links.length > 0;

    const handleDragStart = (key) => {
        setDragKey(key);
    };

    const handleDrop = (key) => {
        if (!dragKey || dragKey === key) return;
        const next = sectionOrder.filter(k => k !== dragKey);
        const idx = next.indexOf(key);
        next.splice(idx, 0, dragKey);
        setSectionOrder(next);
        setDragKey(null);
    };

    const addLink = () => {
        if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
        setLinks(prev => [
            ...prev,
            { title: newLinkTitle.trim(), url: newLinkUrl.trim(), icon: newLinkIcon.trim() || '🔗' }
        ]);
        setNewLinkTitle('');
        setNewLinkUrl('');
        setNewLinkIcon('🔗');
    };

    const addCustomSection = () => {
        if (!newSectionTitle.trim()) return;
        const key = `custom-${Date.now()}`;
        const next = { key, title: newSectionTitle.trim(), links: [] };
        setCustomSections(prev => [...prev, next]);
        setSectionOrder(prev => [...prev, key]);
        setNewSectionTitle('');
    };

    const addCustomSectionLink = (sectionKey, link) => {
        if (!link.title || !link.url) return;
        setCustomSections(prev => prev.map(s => s.key === sectionKey
            ? { ...s, links: [...(s.links || []), link] }
            : s
        ));
        setNewLinkTitle('');
        setNewLinkUrl('');
        setNewLinkIcon('🔗');
    };

    if (error) {
        return (
            <AppLayout hideTabBar>
                <div className="h-full flex items-center justify-center p-6 text-center">
                    <p className="text-destructive mt-10">Biashara haipatikani au mtandao unasumbua.</p>
                </div>
            </AppLayout>
        );
    }

    if (!data && !error) {
        return (
            <AppLayout hideTabBar>
                <div className="h-full flex items-center justify-center pt-20">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout hideTabBar>
            <Head title={`${merchant?.name || 'Biashara'} | Takeer Minisite`} />

            {/* Storefront Hero (Stan-style simplicity) */}
            <div className="bg-slate-50 border-b">
                <div className="max-w-3xl mx-auto px-4 py-5">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="h-16 w-16 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-700 shadow-sm overflow-hidden shrink-0">
                                {merchant?.avatar_url ? (
                                    <img src={merchant.avatar_url} alt={merchant.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Store className="h-7 w-7" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl font-black leading-tight text-foreground truncate">{merchant?.name || 'Biashara'}</h1>
                                <p className="text-sm text-muted-foreground mt-0.5">@{merchant?.slug || merchantSlug}</p>
                            </div>
                            <button
                                className="h-10 w-10 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors shrink-0"
                                onClick={() => navigator.share?.({ title: merchant?.name, url: window.location.href })}
                                title="Share"
                            >
                                <Share2 className="h-4 w-4" />
                            </button>
                        </div>
                        {monetizationSummary && (
                            <div className="mt-4 grid grid-cols-3 gap-2 text-left">
                                <StorefrontStat label="Offers" value={monetizationSummary.paid_offers} />
                                <StorefrontStat label="Members" value={monetizationSummary.active_members} />
                                <StorefrontStat label="Events" value={monetizationSummary.live_events} />
                            </div>
                        )}
                        {quickSections.length > 0 && (
                            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                                {quickSections.map((section) => {
                                    const meta = sectionMeta(section.key);
                                    const Icon = meta.icon;
                                    return (
                                        <a
                                            key={`quick-${section.key}`}
                                            href={`#${section.key}`}
                                            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700"
                                        >
                                            <Icon className="h-3.5 w-3.5 text-brand-600" />
                                            {section.title}
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                        {isOwner && (
                            <button
                                className={`mt-3 h-8 px-4 rounded-full border text-xs font-bold ${editMode ? 'bg-accent border-border' : 'border-border'} hover:bg-accent transition-colors`}
                                onClick={() => setEditMode(v => !v)}
                            >
                                {editMode ? 'Maliza Mpangilio' : 'Panga Sections'}
                            </button>
                        )}
                    </div>
                    {editMode && isOwner && (
                        <div className="mt-4 bg-card border border-border rounded-2xl p-3 text-left">
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Add Section</p>
                            <div className="flex gap-2">
                                <input
                                    value={newSectionTitle}
                                    onChange={(e) => setNewSectionTitle(e.target.value)}
                                    className="flex-1 h-9 rounded-xl border border-border px-3 text-sm"
                                    placeholder="Section title"
                                />
                                <button
                                    onClick={addCustomSection}
                                    className="h-9 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Store Sections */}
            <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">
                {!hasStoreItems ? (
                    <div className="text-center text-muted-foreground py-16">
                        Muuzaji bado hajaweka bidhaa zozote.
                    </div>
                ) : (
                    orderedSections
                        .filter(section => editMode || !hiddenSections.includes(section.key))
                        .map((section) => {
                            const visible = section.items.slice(0, 4);
                            if (section.key !== 'featured' && !section.emptyText && section.items.length === 0) return null;

                            return (
                                <section
                                    id={section.key}
                                    key={section.key}
                                    className="space-y-2.5 scroll-mt-4"
                                    draggable={editMode}
                                    onDragStart={() => handleDragStart(section.key)}
                                    onDragOver={(e) => editMode && e.preventDefault()}
                                    onDrop={() => handleDrop(section.key)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {editMode && <GripVertical className="h-4 w-4 text-muted-foreground" />}
                                            {React.createElement(sectionMeta(section.key).icon, { className: 'h-4 w-4 text-brand-600 shrink-0' })}
                                            <div className="min-w-0">
                                                <h2 className="text-sm font-black uppercase tracking-widest text-foreground truncate">{section.title}</h2>
                                                <p className="text-[11px] font-semibold text-muted-foreground">{sectionMeta(section.key).subtitle}</p>
                                            </div>
                                        </div>
                                        {editMode && isOwner && (
                                            <button
                                                onClick={() => {
                                                    setHiddenSections(prev => prev.includes(section.key)
                                                        ? prev.filter(k => k !== section.key)
                                                        : [...prev, section.key]
                                                    );
                                                }}
                                                className="text-xs font-bold text-muted-foreground hover:text-foreground"
                                            >
                                                {hiddenSections.includes(section.key) ? 'Show' : 'Hide'}
                                            </button>
                                        )}
                                        {section.href && section.items.length > 4 && (
                                            <Link
                                                href={section.href}
                                                className="text-xs font-bold text-brand-600 flex items-center gap-1"
                                            >
                                                All {section.title}
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Link>
                                        )}
                                    </div>
                                    {section.key === 'services' && (serviceAreaType || serviceOpenDaysCount > 0 || serviceLocations.length > 0) && (
                                        <p className="text-xs text-muted-foreground">
                                            {serviceAreaType ? `${serviceAreaType} service` : 'Service'}{serviceOpenDaysCount > 0 ? ` • Open ${serviceOpenDaysCount} days/week` : ''}{serviceLocations.length > 0 ? ` • ${serviceLocations.slice(0, 2).join(', ')}` : ''}
                                        </p>
                                    )}

                                    {section.key === 'featured' ? (
                                        featuredProduct ? (
                                            <Link
                                                href={route('product.show', featuredProduct.slug || featuredProduct.id)}
                                                className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
                                            >
                                                <div className="h-16 w-16 rounded-2xl bg-muted overflow-hidden shrink-0">
                                                    {featuredProduct.image_url ? (
                                                        <img src={featuredProduct.image_url} alt={featuredProduct.title} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                            <Store className="h-7 w-7" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                                        <Star className="h-4 w-4 text-amber-500" />
                                                        {featuredId ? 'Featured' : 'Best offer'}
                                                    </div>
                                                    <DiscoveryBadges badges={discoveryBadges(featuredProduct, productDiscovery)} />
                                                    <p className="text-base font-black text-foreground truncate">{featuredProduct.title}</p>
                                                    <p className="text-sm text-muted-foreground mt-0.5">
                                                        {productLabel(featuredProduct)}
                                                    </p>
                                                </div>
                                                <div className="text-sm font-black text-brand-600">
                                                    {productPriceLabel(featuredProduct)}
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
                                                Hakuna bidhaa ya kuonyesha.
                                            </div>
                                        )
                                    ) : section.key === 'links' ? (
                                        <div className="space-y-3">
                                            {section.items.map((item, idx) => (
                                                <a
                                                    key={`link-${idx}`}
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
                                                >
                                                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-lg">
                                                        {item.icon || '🔗'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                                                    </div>
                                                </a>
                                            ))}
                                            {editMode && isOwner && (
                                                <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={newLinkIcon}
                                                            onChange={(e) => setNewLinkIcon(e.target.value)}
                                                            className="w-14 h-9 rounded-xl border border-border text-center text-lg"
                                                        />
                                                        <input
                                                            value={newLinkTitle}
                                                            onChange={(e) => setNewLinkTitle(e.target.value)}
                                                            className="flex-1 h-9 rounded-xl border border-border px-3 text-sm"
                                                            placeholder="Title"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={newLinkUrl}
                                                            onChange={(e) => setNewLinkUrl(e.target.value)}
                                                            className="flex-1 h-9 rounded-xl border border-border px-3 text-sm"
                                                            placeholder="https://..."
                                                        />
                                                        <button
                                                            onClick={addLink}
                                                            className="h-9 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {!editMode && section.items.length === 0 && (
                                                <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
                                                    {section.emptyText}
                                                    {section.href && (
                                                        <div className="mt-2">
                                                            <Link href={section.href} className="text-xs font-bold text-brand-600">
                                                                Open
                                                            </Link>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : section.custom ? (
                                        <div className="space-y-3">
                                            {(section.items || []).map((item, idx) => (
                                                <a
                                                    key={`${section.key}-link-${idx}`}
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
                                                >
                                                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-lg">
                                                        {item.icon || '🔗'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                                                    </div>
                                                </a>
                                            ))}
                                            {editMode && isOwner && (
                                                <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={newLinkIcon}
                                                            onChange={(e) => setNewLinkIcon(e.target.value)}
                                                            className="w-14 h-9 rounded-xl border border-border text-center text-lg"
                                                        />
                                                        <input
                                                            value={newLinkTitle}
                                                            onChange={(e) => setNewLinkTitle(e.target.value)}
                                                            className="flex-1 h-9 rounded-xl border border-border px-3 text-sm"
                                                            placeholder="Title"
                                                        />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={newLinkUrl}
                                                            onChange={(e) => setNewLinkUrl(e.target.value)}
                                                            className="flex-1 h-9 rounded-xl border border-border px-3 text-sm"
                                                            placeholder="https://..."
                                                        />
                                                        <button
                                                            onClick={() => addCustomSectionLink(section.key, {
                                                                title: newLinkTitle.trim(),
                                                                url: newLinkUrl.trim(),
                                                                icon: newLinkIcon.trim() || '🔗',
                                                            })}
                                                            className="h-9 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {!editMode && (section.items || []).length === 0 && (
                                                <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
                                                    {section.emptyText}
                                                    {section.href && (
                                                        <div className="mt-2">
                                                            <Link href={section.href} className="text-xs font-bold text-brand-600">
                                                                Open
                                                            </Link>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : section.items.length === 0 ? (
                                        <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
                                            {section.emptyText}
                                            {section.href && (
                                                <div className="mt-2">
                                                    <Link href={section.href} className="text-xs font-bold text-brand-600">
                                                        Open
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    ) : section.key === 'content' || section.key === 'bundles' || section.key === 'courses' || section.key === 'memberships' ? (
                                        <div className="space-y-3">
                                            {visible.map((item, idx) => {
                                                const href = section.key === 'content'
                                                    ? route('content.show', item.slug || item.id)
                                                    : section.key === 'bundles' || section.key === 'courses'
                                                        ? route('bundle.show', item.slug || item.id)
                                                        : route('subscription-plan.show', item.slug || item.id);
                                                return (
                                                    <Link
                                                        key={`${section.key}-${idx}`}
                                                        href={href}
                                                        className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow"
                                                    >
                                                        <div className="h-14 w-14 bg-muted flex items-center justify-center shrink-0">
                                                            {section.key === 'content' && <BookOpenText className="h-6 w-6 text-brand-600" />}
                                                            {section.key === 'bundles' && <Boxes className="h-6 w-6 text-sky-600" />}
                                                            {section.key === 'courses' && <BookOpenText className="h-6 w-6 text-indigo-600" />}
                                                            {section.key === 'memberships' && <Crown className="h-6 w-6 text-emerald-600" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-foreground truncate">{item.title || item.name}</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {section.key === 'content' && (item.price === null ? 'Free article' : item.price == 0 ? 'Unlock TZS 0' : `TZS ${Number(item.price).toLocaleString()} article`)}
                                                                {section.key === 'bundles' && `${item.items?.length || 0} items inside`}
                                                                {section.key === 'courses' && `${item.items?.length || 0} lessons/resources`}
                                                                {section.key === 'memberships' && `${item.billing_interval} access`}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-sm font-black text-brand-600">
                                                                TZS {Number(item.price || 0).toLocaleString()}
                                                            </div>
                                                            {((section.key === 'content' && item.price !== null) || (section.key !== 'content' && Number(item.price || 0) > 0)) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const checkoutItem = buildCheckoutItem(section.key, item, merchant);
                                                                        if (checkoutItem) window.__openCheckout?.(checkoutItem);
                                                                    }}
                                                                    className="h-8 px-3 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors inline-flex items-center gap-1.5"
                                                                >
                                                                    <Lock className="h-3.5 w-3.5" />
                                                                    {section.key === 'memberships' ? 'Subscribe' : 'Unlock'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {visible.map((product, idx) => (
                                                <Link
                                                    key={`${section.key}-${idx}`}
                                                    href={route('product.show', product.slug || product.id)}
                                                    className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
                                                >
                                                    <div className="h-14 w-14 bg-muted overflow-hidden shrink-0">
                                                        {product.image_url ? (
                                                            <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                                <Store className="h-6 w-6" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-foreground truncate">{product.title}</p>
                                                        <DiscoveryBadges badges={discoveryBadges(product, productDiscovery)} compact />
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {productLabel(product)}
                                                        </p>
                                                        {section.key === 'services' && serviceLocations.length > 0 && (
                                                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                                {serviceLocations.slice(0, 2).join(' • ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-sm font-black text-brand-600">
                                                        {productPriceLabel(product)}
                                                    </div>
                                                    {editMode && isOwner && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setFeaturedId(product.id);
                                                            }}
                                                            className="ml-2 h-8 w-8 rounded-full border border-border flex items-center justify-center text-amber-500 hover:bg-accent"
                                                        >
                                                            <Star className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            );
                        })
                )}

                {isLoadingMore && (
                    <div className="py-8 flex justify-center items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                    </div>
                )}
                {!isReachingEnd && posts.length > 0 && (
                    <div className="py-6 flex justify-center">
                        <button
                            onClick={handleLoadMore}
                            className="h-11 px-6 rounded-full border border-border text-sm font-bold hover:bg-accent transition-colors"
                            disabled={isLoadingNext}
                        >
                            {isLoadingNext ? 'Inapakia...' : 'Ongeza Zaidi'}
                        </button>
                    </div>
                )}
            </div>

        </AppLayout>
    );
}

function StorefrontStat({ label, value }) {
    return (
        <div className="rounded-2xl border border-border bg-card px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-base font-black text-foreground">{Number(value || 0).toLocaleString()}</p>
        </div>
    );
}

function DiscoveryBadges({ badges = [], compact = false }) {
    if (!Array.isArray(badges) || badges.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-1 ${compact ? 'mt-1' : 'mb-1.5'}`}>
            {badges.slice(0, compact ? 2 : 3).map((badge, index) => (
                <span
                    key={`${badge.label}-${index}`}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${badgeToneClass(badge.tone)}`}
                >
                    {badge.label}
                </span>
            ))}
        </div>
    );
}

function badgeToneClass(tone) {
    const map = {
        amber: 'bg-amber-50 text-amber-700 border border-amber-100',
        sky: 'bg-sky-50 text-sky-700 border border-sky-100',
        violet: 'bg-violet-50 text-violet-700 border border-violet-100',
        rose: 'bg-rose-50 text-rose-700 border border-rose-100',
        emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    };

    return map[tone] || 'bg-slate-50 text-slate-600 border border-slate-100';
}

function discoveryScore(product, productDiscovery = {}) {
    return Number(productDiscovery?.[product?.id]?.score || 0);
}

function discoveryBadges(product, productDiscovery = {}) {
    return productDiscovery?.[product?.id]?.badges || [];
}

function sectionMeta(key) {
    const map = {
        featured: { icon: Star, subtitle: 'Best place to start' },
        memberships: { icon: Crown, subtitle: 'Recurring access and perks' },
        events: { icon: CalendarClock, subtitle: 'Paid workshops and webinars' },
        premium_media: { icon: Video, subtitle: 'Videos, audio, and galleries' },
        commissions: { icon: PenLine, subtitle: 'Order custom digital work' },
        downloads: { icon: DownloadCloud, subtitle: 'Files, templates, docs, software' },
        content: { icon: BookOpenText, subtitle: 'Articles, guides, newsletters' },
        courses: { icon: BookOpenText, subtitle: 'Courses and learning bundles' },
        bundles: { icon: Boxes, subtitle: 'Grouped offers and packs' },
        services: { icon: Store, subtitle: 'Book or request services' },
        products: { icon: Store, subtitle: 'Physical products' },
        links: { icon: Share2, subtitle: 'Creator links' },
        updates: { icon: ArrowRight, subtitle: 'Latest posts' },
    };

    return map[key] || { icon: Store, subtitle: 'Creator offer' };
}

function productLabel(product) {
    if (product?.type === 'service') return 'Service';
    if (product?.type !== 'digital') return 'Product';

    const map = {
        video_stream: 'Premium video',
        audio_stream: 'Premium audio',
        gallery_pack: 'Gallery pack',
        live_event: 'Live event',
        custom_delivery: 'Custom work',
        external_link: 'External digital access',
        file: product.digital_content_type === 'software'
            ? 'Software'
            : product.digital_content_type === 'document'
                ? 'Document'
                : product.digital_content_type === 'ebook'
                    ? 'E-book'
                    : 'Digital download',
    };

    return map[product.digital_delivery_type] || 'Digital download';
}
