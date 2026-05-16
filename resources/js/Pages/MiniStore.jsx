import React, { useMemo, useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import { Link, usePage } from '@inertiajs/react';
import { Loader2, Store, Share2, GripVertical, Star, BookOpenText, Boxes, Crown, Lock, Pencil, Instagram, Youtube, Mail, Music2, MessageCircle, Send, Globe2, UserRound, Plus, Search, X, Flag } from 'lucide-react';
import { trackAttributionEvent } from '@/lib/attribution';
import { productPriceLabel } from '@/lib/productUnits';
import { toast } from 'sonner';

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

    const isLoadingMore = isValidating && size > 0;
    const isReachingEnd = data && data[data.length - 1]?.posts.links.next === null;
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [sectionOrder, setSectionOrder] = useState(['featured', 'memberships', 'events', 'premium_media', 'commissions', 'downloads', 'content', 'courses', 'bundles', 'services', 'products', 'links']);
    const [dragKey, setDragKey] = useState(null);
    const [links, setLinks] = useState([]);
    const [customSections, setCustomSections] = useState([]);
    const [hiddenSections, setHiddenSections] = useState([]);
    const [itemLayouts, setItemLayouts] = useState({});
    const [sectionItems, setSectionItems] = useState({});
    const [hiddenItemKeys, setHiddenItemKeys] = useState({});
    const [newLinkTitle, setNewLinkTitle] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [pickerLinkTitle, setPickerLinkTitle] = useState('');
    const [pickerLinkUrl, setPickerLinkUrl] = useState('');
    const [itemPicker, setItemPicker] = useState({ open: false, sectionKey: null, filter: 'all', query: '' });
    const [featuredId, setFeaturedId] = useState(null);
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const serviceHours = Array.isArray(storefrontSettings?.service_hours) ? storefrontSettings.service_hours : [];
    const serviceOpenDaysCount = serviceHours.filter((row) => row?.is_open).length;
    const serviceLocations = Array.isArray(storefrontSettings?.service_locations) ? storefrontSettings.service_locations : [];
    const serviceAreaType = storefrontSettings?.service_area_type || null;
    const socialLinks = useMemo(() => links.filter((link) => Boolean(socialLinkMeta(link?.url))), [links]);
    const regularLinks = useMemo(() => links.filter((link) => !socialLinkMeta(link?.url)), [links]);

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
        if (storefrontSettings.custom_sections?.length) {
            setCustomSections(storefrontSettings.custom_sections.map((section) => ({
                ...section,
                items: normalizeCustomSectionItems(section),
            })));
        }
        if (storefrontSettings.hidden_sections?.length) setHiddenSections(storefrontSettings.hidden_sections);
        if (storefrontSettings.featured_product_id) setFeaturedId(storefrontSettings.featured_product_id);
        if (storefrontSettings.item_layouts) setItemLayouts(storefrontSettings.item_layouts);
        if (storefrontSettings.section_items) setSectionItems(storefrontSettings.section_items);
        if (storefrontSettings.hidden_item_keys) setHiddenItemKeys(storefrontSettings.hidden_item_keys);
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

    const isOwner = Boolean(merchant?.is_owner)
        || (!!auth?.user && !!merchant?.slug && auth.user.merchant_profiles?.some(p => p.username === merchant.slug));

    useEffect(() => {
        if (isOwner) setEditMode(true);
    }, [isOwner]);

    useEffect(() => {
        if (!isOwner) return;

        const payload = {
            section_order: sectionOrder,
            links: links.map(stripLinkMetadata),
            custom_sections: customSections.map((section) => ({
                key: section.key,
                title: section.title,
                items: normalizeCustomSectionItems(section).map(stripStorefrontItemMetadata),
            })),
            hidden_sections: hiddenSections,
            featured_product_id: featuredId || null,
            item_layouts: itemLayouts,
            section_items: sectionItems,
            hidden_item_keys: hiddenItemKeys,
        };

        const timeout = setTimeout(() => {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const bearerToken = localStorage.getItem('takeer_token');

            fetch(`/api/merchant/${merchant.slug}/storefront`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    ...(bearerToken ? { 'Authorization': `Bearer ${bearerToken}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            }).then(async (response) => {
                if (!response.ok) {
                    const message = await response.text();
                    throw new Error(message || `Storefront save failed (${response.status})`);
                }
            }).catch((error) => {
                console.error('Storefront settings save failed', error);
            });
        }, 600);

        return () => clearTimeout(timeout);
    }, [sectionOrder, links, featuredId, merchant, auth, customSections, hiddenSections, itemLayouts, sectionItems, hiddenItemKeys, isOwner]);

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
        const pools = { products: allProducts, contentItems, bundles, subscriptionPlans };
        const sectionItemList = (sectionKey, baseItems = []) => {
            const hidden = new Set(hiddenItemKeys?.[sectionKey] || []);
            const base = baseItems.filter((item) => {
                const key = sectionItemKey(sectionKey, item);
                return !key || !hidden.has(key);
            });
            const additions = (sectionItems?.[sectionKey] || [])
                .map((item) => resolveStorefrontItem(item, pools))
                .filter(Boolean);
            const seen = new Set(base.map((item) => sectionItemKey(sectionKey, item)).filter(Boolean));
            return [
                ...base,
                ...additions.filter((item) => {
                    const key = sectionItemKey(sectionKey, item);
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                }),
            ];
        };

        return [
            { key: 'featured', title: 'Featured', items: [], href: null },
            { key: 'memberships', title: 'Creator Club', items: sectionItemList('memberships', subscriptionPlans), href: `/m/${merchantSlug}/memberships` },
            { key: 'events', title: 'Live Events', items: sectionItemList('events', events), href: `/m/${merchantSlug}/downloads` },
            { key: 'premium_media', title: 'Premium Media', items: sectionItemList('premium_media', premiumMedia), href: `/m/${merchantSlug}/downloads` },
            { key: 'commissions', title: 'Custom Work', items: sectionItemList('commissions', commissions), href: `/m/${merchantSlug}/downloads` },
            { key: 'products', title: 'Bidhaa', items: sectionItemList('products', products), href: `/m/${merchantSlug}/products` },
            { key: 'downloads', title: 'Downloads', items: sectionItemList('downloads', downloads), href: `/m/${merchantSlug}/downloads` },
            { key: 'services', title: 'Huduma', items: sectionItemList('services', services), href: `/m/${merchantSlug}/services` },
            { key: 'content', title: 'Knowledge', items: sectionItemList('content', contentItems), href: `/m/${merchantSlug}/content` },
            { key: 'courses', title: 'Courses', items: sectionItemList('courses', courseBundles), href: `/m/${merchantSlug}/courses` },
            { key: 'bundles', title: 'Bundles', items: sectionItemList('bundles', regularBundles), href: `/m/${merchantSlug}/bundles` },
            { key: 'links', title: 'Links', items: regularLinks, href: null, emptyText: 'Ongeza link zako.' },
            ...customSections.map((section) => ({
                key: section.key,
                title: section.title,
                items: normalizeCustomSectionItems(section).map((item) => resolveStorefrontItem(item, {
                    products: allProducts,
                    contentItems,
                    bundles,
                    subscriptionPlans,
                })),
                href: null,
                custom: true,
                emptyText: 'Ongeza item kwa section hili.',
            })),
        ];
    }, [allProducts, merchantSlug, regularLinks, customSections, contentItems, bundles, subscriptionPlans, productDiscovery, sectionItems, hiddenItemKeys]);

    const orderedSections = useMemo(() => {
        const map = new Map(sections.map(s => [s.key, s]));
        const ordered = sectionOrder.map(key => map.get(key)).filter(Boolean);
        const orderedKeys = new Set(ordered.map((section) => section.key));
        const missing = sections.filter((section) => !orderedKeys.has(section.key));
        return [...ordered, ...missing];
    }, [sections, sectionOrder]);
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
            { title: newLinkTitle.trim(), url: normalizeLinkUrl(newLinkUrl.trim()) }
        ]);
        setNewLinkTitle('');
        setNewLinkUrl('');
    };

    const addCustomSection = () => {
        if (!newSectionTitle.trim()) return;
        const key = `custom-${Date.now()}`;
        const next = { key, title: newSectionTitle.trim(), items: [] };
        setCustomSections(prev => [...prev, next]);
        setSectionOrder(prev => [...prev, key]);
        setNewSectionTitle('');
    };

    const addCustomSectionItem = (sectionKey, item) => {
        if (!sectionKey || !item) return;
        if (sectionKey === 'links' && item.kind === 'link') {
            setLinks(prev => [...prev, stripLinkMetadata(item)]);
            return;
        }
        if (!customSections.some((section) => section.key === sectionKey)) {
            setSectionItems(prev => {
                const current = Array.isArray(prev[sectionKey]) ? prev[sectionKey] : [];
                const clean = stripStorefrontItemMetadata(item);
                const key = sectionItemKey(sectionKey, clean);
                if (key && current.some((entry) => sectionItemKey(sectionKey, entry) === key)) return prev;
                return { ...prev, [sectionKey]: [...current, clean] };
            });
            setHiddenItemKeys(prev => {
                const key = sectionItemKey(sectionKey, item);
                if (!key || !Array.isArray(prev[sectionKey])) return prev;
                return { ...prev, [sectionKey]: prev[sectionKey].filter((entry) => entry !== key) };
            });
            return;
        }
        setCustomSections(prev => prev.map(s => s.key === sectionKey
            ? { ...s, items: [...normalizeCustomSectionItems(s), stripStorefrontItemMetadata(item)] }
            : s
        ));
    };

    const removeCustomSectionItem = (sectionKey, index) => {
        setCustomSections(prev => prev.map(s => s.key === sectionKey
            ? { ...s, items: normalizeCustomSectionItems(s).filter((_, itemIndex) => itemIndex !== index) }
            : s
        ));
    };

    const removeSectionItem = (sectionKey, item, index = null) => {
        if (sectionKey === 'links') {
            setLinks(prev => prev.filter((_, itemIndex) => itemIndex !== index));
            return;
        }
        if (customSections.some((section) => section.key === sectionKey)) {
            removeCustomSectionItem(sectionKey, index);
            return;
        }
        const key = sectionItemKey(sectionKey, item);
        if (!key) return;
        const additions = Array.isArray(sectionItems[sectionKey]) ? sectionItems[sectionKey] : [];
        if (additions.some((entry) => sectionItemKey(sectionKey, entry) === key)) {
            setSectionItems(prev => ({
                ...prev,
                [sectionKey]: (prev[sectionKey] || []).filter((entry) => sectionItemKey(sectionKey, entry) !== key),
            }));
            return;
        }
        setHiddenItemKeys(prev => ({
            ...prev,
            [sectionKey]: [...new Set([...(prev[sectionKey] || []), key])],
        }));
    };

    const openItemPicker = (sectionKey, filter = 'all') => {
        setItemPicker({ open: true, sectionKey, filter, query: '' });
        setPickerLinkTitle('');
        setPickerLinkUrl('');
    };

    const closeItemPicker = () => {
        setItemPicker({ open: false, sectionKey: null, filter: 'all', query: '' });
        setPickerLinkTitle('');
        setPickerLinkUrl('');
    };

    const addPickerLink = () => {
        if (!pickerLinkTitle.trim() || !pickerLinkUrl.trim()) return;
        addCustomSectionItem(itemPicker.sectionKey, {
            kind: 'link',
            title: pickerLinkTitle.trim(),
            url: normalizeLinkUrl(pickerLinkUrl.trim()),
        });
        closeItemPicker();
    };

    const pickerItems = useMemo(() => {
        const query = itemPicker.query.trim().toLowerCase();
        const pool = storefrontPickerItems({
            products: allProducts,
            contentItems,
            bundles,
            subscriptionPlans,
        }).filter((item) => itemPicker.filter === 'all' || item.filter === itemPicker.filter);

        if (!query) return pool;
        return pool.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query));
    }, [allProducts, contentItems, bundles, subscriptionPlans, itemPicker.filter, itemPicker.query]);

    const handlePickerAdd = (item) => {
        addCustomSectionItem(itemPicker.sectionKey, item);
        closeItemPicker();
        setNewLinkTitle('');
        setNewLinkUrl('');
    };

    const setItemLayout = (item, layout) => {
        const key = storefrontItemKey(item);
        if (!key) return;
        setItemLayouts(prev => ({ ...prev, [key]: layout }));
    };

    const getItemLayout = (item) => itemLayouts[storefrontItemKey(item)] || item.layout || 'horizontal';

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

            {/* Storefront Hero */}
            <div className="bg-slate-50 border-b">
                <div className="max-w-3xl mx-auto px-4 py-5">
                    <div>
                        <div className="relative">
                            <div className="absolute right-0 top-0 flex items-center gap-2">
                                {isOwner && (
                                    <button
                                        className={`h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${editMode ? 'bg-accent border-border text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                                        onClick={() => setEditMode(v => !v)}
                                        title={editMode ? 'Finish editing sections' : 'Edit sections'}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        {editMode ? 'Done' : 'Edit'}
                                    </button>
                                )}
                                <button
                                    className="h-10 w-10 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors"
                                    onClick={() => navigator.share?.({ title: merchant?.name, url: window.location.href })}
                                    title="Share"
                                >
                                    <Share2 className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mx-auto h-24 w-24 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 shadow-sm overflow-hidden">
                                {merchant?.avatar_url ? (
                                    <img src={merchant.avatar_url} alt={merchant.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Store className="h-10 w-10" />
                                )}
                            </div>
                            <div className="mt-3 text-center">
                                <h1 className="text-2xl font-black leading-tight text-foreground whitespace-normal break-words">
                                    {merchant?.name || 'Biashara'}
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">@{merchant?.slug || merchantSlug}</p>
                                <SocialIconBar links={socialLinks} merchantSlug={merchant?.slug || merchantSlug} />
                                {merchant?.bio && (
                                    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-foreground whitespace-pre-line break-words">
                                        {merchant.bio}
                                    </p>
                                )}
                            </div>
                        </div>
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
                            const visible = editMode ? section.items : section.items.slice(0, 4);
                            if (section.key === 'links' && !editMode && section.items.length === 0) return null;
                            if (section.key !== 'featured' && !section.emptyText && section.items.length === 0) return null;

                            return (
                                <section
                                    id={section.key}
                                    key={section.key}
                                    className="space-y-2.5 scroll-mt-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0"
                                    draggable={editMode}
                                    onDragStart={() => handleDragStart(section.key)}
                                    onDragOver={(e) => editMode && e.preventDefault()}
                                    onDrop={() => handleDrop(section.key)}
                                >
                                    {editMode && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground truncate">{section.title}</p>
                                                {hiddenSections.includes(section.key) && (
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                                        Hidden
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                {section.key !== 'featured' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openItemPicker(section.key, section.key === 'links' ? 'link' : 'all')}
                                                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-xs font-black text-brand-700 hover:bg-brand-100"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        Add
                                                    </button>
                                                )}
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
                                            </div>
                                        </div>
                                    )}
                                    {editMode && section.key === 'services' && (serviceAreaType || serviceOpenDaysCount > 0 || serviceLocations.length > 0) && (
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
                                                    <p className="text-base font-black text-foreground leading-tight whitespace-normal break-words">{featuredProduct.title}</p>
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
                                        <div className="space-y-2.5">
                                            {section.items.map((item, idx) => (
                                                <div key={`link-${idx}`} className="relative">
                                                    <BioLinkButton item={item} />
                                                    {editMode && isOwner && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSectionItem(section.key, item, idx)}
                                                            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm hover:text-destructive"
                                                            title="Remove"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {editMode && isOwner && (
                                                <div className="bg-card border border-border rounded-2xl p-3 space-y-2">
                                                    <input
                                                        value={newLinkTitle}
                                                        onChange={(e) => setNewLinkTitle(e.target.value)}
                                                        className="w-full h-9 rounded-xl border border-border px-3 text-sm"
                                                        placeholder="Title"
                                                    />
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
                                            {visible.map((item, idx) => (
                                                <div key={`${section.key}-item-${idx}`} className="relative">
                                                    <StorefrontMixedItem
                                                        item={item}
                                                        merchant={merchant}
                                                        layout={getItemLayout(item)}
                                                        editMode={editMode}
                                                        isOwner={isOwner}
                                                        onLayoutChange={(layout) => setItemLayout(item, layout)}
                                                    />
                                                    {editMode && isOwner && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSectionItem(section.key, item, idx)}
                                                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm hover:text-destructive"
                                                            title="Remove"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {editMode && isOwner && (
                                                <button
                                                    type="button"
                                                    onClick={() => openItemPicker(section.key)}
                                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 text-sm font-black text-brand-700 hover:bg-brand-100"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Add item
                                                </button>
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
                                                    <div key={`${section.key}-${idx}`} className="relative">
                                                        <Link
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
                                                        {editMode && isOwner && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSectionItem(section.key, item, idx)}
                                                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm hover:text-destructive"
                                                                title="Remove"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {visible.map((product, idx) => (
                                                <ProductOfferCard
                                                    key={`${section.key}-${idx}`}
                                                    product={product}
                                                    layout={getItemLayout(product)}
                                                    editMode={editMode}
                                                    isOwner={isOwner}
                                                    productDiscovery={productDiscovery}
                                                    serviceLocations={section.key === 'services' ? serviceLocations : []}
                                                    onLayoutChange={(layout) => setItemLayout(product, layout)}
                                                    onFeature={() => setFeaturedId(product.id)}
                                                    onRemove={() => removeSectionItem(section.key, product, idx)}
                                                />
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

            {itemPicker.open && (
                <StorefrontItemPicker
                    items={pickerItems}
                    filter={itemPicker.filter}
                    query={itemPicker.query}
                    linkTitle={pickerLinkTitle}
                    linkUrl={pickerLinkUrl}
                    onFilterChange={(filter) => setItemPicker(prev => ({ ...prev, filter }))}
                    onQueryChange={(query) => setItemPicker(prev => ({ ...prev, query }))}
                    onLinkTitleChange={setPickerLinkTitle}
                    onLinkUrlChange={setPickerLinkUrl}
                    onAdd={handlePickerAdd}
                    onAddLink={addPickerLink}
                    onClose={closeItemPicker}
                />
            )}

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

function StorefrontMixedItem({ item, merchant, layout = 'horizontal', editMode = false, isOwner = false, onLayoutChange }) {
    if (!item) return null;
    if (item.kind === 'link') return <BioLinkButton item={item} />;
    if (item.kind === 'product') {
        return (
            <ProductOfferCard
                product={item}
                layout={layout}
                editMode={editMode}
                isOwner={isOwner}
                onLayoutChange={onLayoutChange}
            />
        );
    }

    const href = storefrontItemHref(item);
    const isPaid = Number(item.price || 0) > 0;

    return (
        <Link
            href={href}
            className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow"
        >
            <div className="h-14 w-14 bg-muted overflow-hidden shrink-0">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.title || item.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {item.kind === 'content' && <BookOpenText className="h-6 w-6 text-brand-600" />}
                        {(item.kind === 'bundle' || item.kind === 'course') && <Boxes className="h-6 w-6 text-sky-600" />}
                        {item.kind === 'membership' && <Crown className="h-6 w-6 text-emerald-600" />}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight whitespace-normal break-words">{item.title || item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{storefrontItemLabel(item)}</p>
            </div>
            <div className="text-sm font-black text-brand-600">TZS {Number(item.price || 0).toLocaleString()}</div>
            {isPaid && ['content', 'bundle', 'course', 'membership'].includes(item.kind) && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const checkoutType = item.kind === 'membership'
                            ? 'subscription_plan'
                            : item.kind === 'content'
                                ? 'content_item'
                                : 'bundle';
                        window.__openCheckout?.({ ...item, checkoutType, merchant: merchant || null });
                    }}
                    className="h-8 px-3 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors inline-flex items-center gap-1.5"
                >
                    <Lock className="h-3.5 w-3.5" />
                    {item.kind === 'membership' ? 'Subscribe' : 'Unlock'}
                </button>
            )}
        </Link>
    );
}

function ProductOfferCard({
    product,
    layout = 'horizontal',
    editMode = false,
    isOwner = false,
    productDiscovery = {},
    serviceLocations = [],
    onLayoutChange,
    onFeature,
    onRemove,
}) {
    const isVertical = layout === 'vertical';
    const description = product?.description || product?.attributes?.suggested_description || product?.service_client_requirements || null;

    return (
        <div className="relative">
            <Link
                href={route('product.show', product.slug || product.id)}
                className={isVertical
                    ? 'block overflow-hidden rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition-shadow'
                    : 'bg-card border border-border rounded-2xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow'
                }
            >
                {isVertical ? (
                    <>
                        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                    <Store className="h-8 w-8" />
                                </div>
                            )}
                        </div>
                        <div className="mt-3">
                            <p className="text-lg font-black leading-tight text-foreground">{product.title}</p>
                            <DiscoveryBadges badges={discoveryBadges(product, productDiscovery)} compact />
                            <p className="mt-1 text-sm font-semibold text-muted-foreground">{productLabel(product)}</p>
                            {description && (
                                <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{description}</p>
                            )}
                            <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="text-base font-black text-brand-600">{productPriceLabel(product)}</div>
                                <span className="inline-flex h-9 items-center justify-center rounded-xl bg-brand-600 px-4 text-xs font-black text-white">
                                    Open
                                </span>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
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
                            <p className="text-sm font-bold text-foreground leading-tight whitespace-normal break-words">{product.title}</p>
                            <DiscoveryBadges badges={discoveryBadges(product, productDiscovery)} compact />
                            <p className="text-xs text-muted-foreground mt-0.5">{productLabel(product)}</p>
                            {serviceLocations.length > 0 && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                    {serviceLocations.slice(0, 2).join(' • ')}
                                </p>
                            )}
                        </div>
                        <div className="text-sm font-black text-brand-600">{productPriceLabel(product)}</div>
                    </>
                )}
            </Link>
            {editMode && isOwner && (
                <div className={`absolute ${isVertical ? 'right-3 top-3' : 'right-3 top-2'} flex items-center gap-1 rounded-full border border-border bg-white/95 p-1 shadow-sm`}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onLayoutChange?.('horizontal');
                        }}
                        className={`h-7 w-8 rounded-full border ${!isVertical ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-transparent text-muted-foreground hover:bg-accent'}`}
                        title="Horizontal card"
                    >
                        <span className="mx-auto block h-2 w-4 rounded-sm border-2 border-current" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onLayoutChange?.('vertical');
                        }}
                        className={`h-7 w-8 rounded-full border ${isVertical ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-transparent text-muted-foreground hover:bg-accent'}`}
                        title="Large card"
                    >
                        <span className="mx-auto block h-4 w-3 rounded-sm border-2 border-current" />
                    </button>
                    {onFeature && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onFeature();
                            }}
                            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-border text-amber-500 hover:bg-accent"
                            title="Feature"
                        >
                            <Star className="h-4 w-4" />
                        </button>
                    )}
                    {onRemove && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onRemove();
                            }}
                            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-destructive"
                            title="Remove"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function StorefrontItemPicker({
    items,
    filter,
    query,
    linkTitle,
    linkUrl,
    onFilterChange,
    onQueryChange,
    onLinkTitleChange,
    onLinkUrlChange,
    onAdd,
    onAddLink,
    onClose,
}) {
    const filters = [
        { key: 'all', label: 'All' },
        { key: 'physical', label: 'Products' },
        { key: 'digital', label: 'Downloads' },
        { key: 'service', label: 'Services' },
        { key: 'content', label: 'Content' },
        { key: 'bundle', label: 'Bundles' },
        { key: 'membership', label: 'Memberships' },
        { key: 'link', label: 'Link' },
    ];

    return (
        <div className="fixed inset-0 z-50 bg-black/45 px-4 py-6 flex items-end sm:items-center justify-center">
            <div className="w-full max-w-xl max-h-[86vh] overflow-hidden rounded-2xl bg-card shadow-2xl border border-border">
                <div className="flex items-center justify-between border-b border-border p-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Add item</p>
                        <h3 className="text-lg font-black text-foreground">Choose what appears here</h3>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-accent flex items-center justify-center">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 border-b border-border space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-sm"
                            placeholder="Search products, downloads, services..."
                            disabled={filter === 'link'}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {filters.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => onFilterChange(item.key)}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${filter === item.key ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-border text-muted-foreground hover:bg-accent'}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {filter === 'link' ? (
                    <div className="p-4 space-y-3">
                        <input
                            value={linkTitle}
                            onChange={(e) => onLinkTitleChange(e.target.value)}
                            className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                            placeholder="Title"
                        />
                        <input
                            value={linkUrl}
                            onChange={(e) => onLinkUrlChange(e.target.value)}
                            className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                            placeholder="https://..."
                        />
                        <button
                            onClick={onAddLink}
                            className="h-10 w-full rounded-xl bg-brand-600 text-sm font-black text-white hover:bg-brand-700"
                        >
                            Add link
                        </button>
                    </div>
                ) : (
                    <div className="max-h-[48vh] overflow-y-auto p-3 space-y-2">
                        {items.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">No matching items.</div>
                        ) : items.map((item) => (
                            <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                            <Store className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black text-foreground">{item.title}</p>
                                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                                </div>
                                <button
                                    onClick={() => onAdd(item)}
                                    className="h-9 rounded-xl bg-brand-600 px-3 text-xs font-black text-white hover:bg-brand-700"
                                >
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function BioLinkButton({ item }) {
    const href = normalizeLinkUrl(item?.url || '');
    const outboundHref = item?.tracked_url || href;
    const preview = item?.preview || {};
    const imageUrl = preview.image_url || null;
    const title = item?.title || preview.title || linkDomain(href) || 'Open link';
    const [reporting, setReporting] = useState(false);
    const unavailable = Boolean(item?.link_unavailable || item?.tracked_link_status === 'disabled');

    const openLink = () => {
        if (unavailable) return;
        window.open(outboundHref, '_blank', 'noopener,noreferrer');
    };

    const reportLink = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const code = trackedCode(outboundHref);
        if (!code || reporting) return;

        setReporting(true);
        try {
            const response = await fetch(`/go/${code}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({
                    reason: 'misleading',
                    reason_code: 'harmful_or_misleading_link',
                    notes: `Reported from storefront link: ${title}`,
                }),
            });
            if (!response.ok) throw new Error('Report failed');
            toast.success('Thanks. Takeer safety will review this link.');
        } catch {
            toast.error('Could not report this link.');
        } finally {
            setReporting(false);
        }
    };

    return (
        <div
            role="link"
            tabIndex={0}
            onClick={openLink}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') openLink();
            }}
            className={`group flex min-h-[58px] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition ${unavailable ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md'}`}
        >
            {imageUrl && (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-foreground">{title}</p>
                {unavailable && (
                    <p className="mt-1 text-xs font-bold text-amber-700">Link unavailable while Takeer reviews a safety issue.</p>
                )}
            </div>
            {unavailable ? (
                <Flag className="h-4 w-4 shrink-0 text-amber-700" />
            ) : item?.tracked_url && (
                <button
                    type="button"
                    onClick={reportLink}
                    disabled={reporting}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    aria-label="Report link"
                    title="Report link"
                >
                    <Flag className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

function SocialIconBar({ links, merchantSlug }) {
    const hasProfileLink = Boolean(merchantSlug);
    if (!hasProfileLink && (!Array.isArray(links) || links.length === 0)) return null;

    return (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {hasProfileLink && (
                <Link
                    href={`/u/${merchantSlug}`}
                    aria-label="Takeer profile"
                    title="Takeer profile"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700"
                >
                    <UserRound className="h-5 w-5" />
                </Link>
            )}
            {links.map((link, index) => {
                const meta = socialLinkMeta(link.url);
                const Icon = meta?.icon || Globe2;
                const href = link.tracked_url || normalizeLinkUrl(link.url);

                return (
                    <a
                        key={`${link.url}-${index}`}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={meta?.label || link.title || 'Social link'}
                        title={meta?.label || link.title || 'Social link'}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700"
                    >
                        {meta?.text ? <span className="text-sm font-black">{meta.text}</span> : <Icon className="h-5 w-5" />}
                    </a>
                );
            })}
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

function normalizeCustomSectionItems(section = {}) {
    if (Array.isArray(section.items)) {
        return section.items.map((item) => item?.kind ? item : { ...item, kind: 'link' }).filter(Boolean);
    }
    if (Array.isArray(section.links)) {
        return section.links.map((link) => ({ ...link, kind: 'link' }));
    }
    return [];
}

function stripStorefrontItemMetadata(item = {}) {
    const { preview, subtitle, filter, ...clean } = item || {};
    return clean;
}

function storefrontItemKey(item = {}) {
    const kind = item.kind || (item.type ? 'product' : null);
    if (!kind || item.id === undefined || item.id === null) return null;
    return `${kind}:${item.id}`;
}

function sectionItemKey(sectionKey, item = {}) {
    if (!item) return null;
    if (item.kind === 'link' || sectionKey === 'links') return item.url ? `link:${normalizeLinkUrl(item.url)}` : null;
    const explicit = storefrontItemKey(item);
    if (explicit) return explicit;
    if (item.id === undefined || item.id === null) return null;
    if (sectionKey === 'content') return `content:${item.id}`;
    if (sectionKey === 'memberships') return `membership:${item.id}`;
    if (sectionKey === 'bundles') return `bundle:${item.id}`;
    if (sectionKey === 'courses') return `course:${item.id}`;
    return `product:${item.id}`;
}

function stripLinkMetadata(link = {}) {
    const { preview, icon, tracked_url, ...clean } = link || {};
    return clean;
}

function storefrontPickerItems({ products = [], contentItems = [], bundles = [], subscriptionPlans = [] }) {
    const productItems = products.map((product) => ({
        kind: 'product',
        filter: product.type === 'service' ? 'service' : product.type === 'digital' ? 'digital' : 'physical',
        id: product.id,
        title: product.title,
        slug: product.slug,
        type: product.type,
        digital_delivery_type: product.digital_delivery_type,
        digital_content_type: product.digital_content_type,
        price: product.price,
        checkout_price: product.checkout_price,
        discounted_price: product.discounted_price,
        image_url: product.image_url,
        subtitle: productLabel(product),
    }));

    const content = contentItems.map((item) => ({
        kind: 'content',
        filter: 'content',
        id: item.id,
        title: item.title,
        slug: item.slug,
        price: item.price,
        image_url: item.image_url || null,
        subtitle: item.price === null ? 'Free article' : item.price == 0 ? 'Unlock TZS 0' : `TZS ${Number(item.price).toLocaleString()} article`,
    }));

    const bundleItems = bundles.map((item) => ({
        kind: item.is_course ? 'course' : 'bundle',
        filter: 'bundle',
        id: item.id,
        title: item.title,
        slug: item.slug,
        price: item.price,
        is_course: item.is_course,
        image_url: item.image_url || null,
        items_count: item.items?.length || 0,
        subtitle: item.is_course ? `${item.items?.length || 0} lessons/resources` : `${item.items?.length || 0} items inside`,
    }));

    const memberships = subscriptionPlans.map((item) => ({
        kind: 'membership',
        filter: 'membership',
        id: item.id,
        title: item.name || item.title,
        slug: item.slug,
        price: item.price,
        billing_interval: item.billing_interval,
        image_url: item.image_url || null,
        subtitle: `${item.billing_interval} access`,
    }));

    return [...productItems, ...content, ...bundleItems, ...memberships];
}

function resolveStorefrontItem(item = {}, pools = {}) {
    if (item.kind === 'link') return item;
    const id = String(item.id);
    if (item.kind === 'product') {
        const product = (pools.products || []).find((entry) => String(entry.id) === id);
        return product ? { ...item, ...product, kind: 'product' } : item;
    }
    if (item.kind === 'content') {
        const content = (pools.contentItems || []).find((entry) => String(entry.id) === id);
        return content ? { ...item, ...content, kind: 'content' } : item;
    }
    if (item.kind === 'bundle' || item.kind === 'course') {
        const bundle = (pools.bundles || []).find((entry) => String(entry.id) === id);
        return bundle ? { ...item, ...bundle, kind: bundle.is_course ? 'course' : 'bundle' } : item;
    }
    if (item.kind === 'membership') {
        const plan = (pools.subscriptionPlans || []).find((entry) => String(entry.id) === id);
        return plan ? { ...item, ...plan, title: plan.name || plan.title, kind: 'membership' } : item;
    }
    return item;
}

function storefrontItemHref(item = {}) {
    if (item.kind === 'product') return route('product.show', item.slug || item.id);
    if (item.kind === 'content') return route('content.show', item.slug || item.id);
    if (item.kind === 'bundle' || item.kind === 'course') return route('bundle.show', item.slug || item.id);
    if (item.kind === 'membership') return route('subscription-plan.show', item.slug || item.id);
    return '#';
}

function storefrontItemLabel(item = {}) {
    if (item.kind === 'product') return productLabel(item);
    if (item.kind === 'content') return item.price === null ? 'Free article' : item.price == 0 ? 'Unlock TZS 0' : `TZS ${Number(item.price).toLocaleString()} article`;
    if (item.kind === 'course') return `${item.items?.length || item.items_count || 0} lessons/resources`;
    if (item.kind === 'bundle') return `${item.items?.length || item.items_count || 0} items inside`;
    if (item.kind === 'membership') return `${item.billing_interval || 'monthly'} access`;
    return 'Link';
}

function normalizeLinkUrl(url = '') {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function trackedCode(url = '') {
    try {
        const parsed = new URL(url, window.location.origin);
        const match = parsed.pathname.match(/^\/go\/([^/]+)/);
        return match?.[1] || '';
    } catch {
        return '';
    }
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
