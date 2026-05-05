import React, { useMemo } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import useSWRInfinite from 'swr/infinite';
import { ArrowLeft, Store, BookOpenText, Boxes, Crown, Lock } from 'lucide-react';
import { productPriceLabel } from '@/lib/productUnits';

const fetcher = (url) => fetch(url).then(res => res.json());

export default function MiniStoreSection({ merchantSlug, sectionType, initialData }) {
    const buildCheckoutItem = (key, item, merchantInfo) => {
        if (key === 'content') {
            return {
                id: item.id,
                title: item.title || 'Locked content',
                price: item.price || 0,
                checkoutType: 'content_item',
                merchant: merchantInfo || null,
            };
        }
        if (key === 'bundles' || key === 'courses') {
            return {
                ...item,
                title: item.title || (key === 'courses' ? 'Course' : 'Bundle'),
                checkoutType: 'bundle',
                merchant: merchantInfo || null,
            };
        }
        if (key === 'memberships') {
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
        if (['content', 'bundles', 'courses', 'memberships'].includes(sectionType)) {
            return pageIndex === 0 ? `/api/merchant/${merchantSlug}?page=1` : null;
        }
        if (previousPageData && !previousPageData.posts.links.next) return null;
        return `/api/merchant/${merchantSlug}?page=${pageIndex + 1}`;
    };

    const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, fetcher, {
        fallbackData: initialData ? [initialData] : undefined,
        revalidateOnFocus: false,
    });

    const merchant = data?.[0]?.merchant || null;
    const posts = data ? data.flatMap(page => page.posts.data) : [];
    const contentItems = data?.[0]?.content_items || [];
    const bundles = data?.[0]?.bundles || [];
    const subscriptionPlans = data?.[0]?.subscription_plans || [];
    const allProducts = data?.[0]?.products || [];

    const products = useMemo(() => {
        if (sectionType === 'products') return allProducts.filter((product) => product.type === 'physical');
        if (sectionType === 'downloads') return allProducts.filter((product) => product.type === 'digital');
        if (sectionType === 'services') return allProducts.filter((product) => product.type === 'service');
        return [];
    }, [allProducts, sectionType]);

    const extraItems = useMemo(() => {
        if (sectionType === 'content') return contentItems;
        if (sectionType === 'bundles') return bundles.filter((item) => !item.is_course);
        if (sectionType === 'courses') return bundles.filter((item) => item.is_course);
        if (sectionType === 'memberships') return subscriptionPlans;
        return [];
    }, [sectionType, contentItems, bundles, subscriptionPlans]);

    const isLoadingMore = isValidating && size > 0;
    const isReachingEnd = ['content', 'bundles', 'courses', 'memberships'].includes(sectionType)
        ? true
        : data && data[data.length - 1]?.posts.links.next === null;

    const titleMap = {
        products: 'Products',
        downloads: 'Downloads',
        services: 'Services',
        content: 'Knowledge',
        courses: 'Courses',
        bundles: 'Bundles',
        memberships: 'Memberships',
    };

    if (error) {
        return (
            <AppLayout>
                <div className="h-full flex items-center justify-center p-6 text-center">
                    <p className="text-destructive mt-10">Biashara haipatikani au mtandao unasumbua.</p>
                </div>
            </AppLayout>
        );
    }

    if (!data && !error) {
        return (
            <AppLayout>
                <div className="h-full flex items-center justify-center pt-20">
                    <span className="text-muted-foreground">Inapakia...</span>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${merchant?.name || 'Biashara'} | ${sectionType}`} />

            <div className="max-w-3xl mx-auto px-5 py-8">
                <div className="flex items-center gap-3 mb-8">
                    <Link href={`/m/${merchantSlug}`} className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-accent transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Biashara</p>
                        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                            <Store className="h-5 w-5 text-brand-600" />
                            {merchant?.name || 'Biashara'}
                        </h1>
                    </div>
                </div>

                {['content', 'bundles', 'courses', 'memberships'].includes(sectionType) ? (
                    extraItems.length === 0 ? (
                        <div className="text-center text-muted-foreground py-16">
                            Hakuna items kwa sasa.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {extraItems.map((item, idx) => {
                                const href = sectionType === 'content'
                                    ? route('content.show', item.slug || item.id)
                                    : sectionType === 'bundles' || sectionType === 'courses'
                                        ? route('bundle.show', item.slug || item.id)
                                        : route('subscription-plan.show', item.slug || item.id);
                                return (
                                    <Link
                                        key={`${sectionType}-${item.id}-${idx}`}
                                        href={href}
                                        className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
                                    >
                                        <div className="h-14 w-14 bg-muted flex items-center justify-center shrink-0">
                                            {sectionType === 'content' && <BookOpenText className="h-6 w-6 text-brand-600" />}
                                            {sectionType === 'bundles' && <Boxes className="h-6 w-6 text-sky-600" />}
                                            {sectionType === 'courses' && <BookOpenText className="h-6 w-6 text-indigo-600" />}
                                            {sectionType === 'memberships' && <Crown className="h-6 w-6 text-emerald-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-foreground truncate">{item.title || item.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {sectionType === 'content' && (item.price === null ? 'Free article' : item.price == 0 ? 'Unlock TZS 0' : `TZS ${Number(item.price).toLocaleString()} article`)}
                                                {sectionType === 'bundles' && `${item.items?.length || 0} items inside`}
                                                {sectionType === 'courses' && `${item.items?.length || 0} lessons/resources`}
                                                {sectionType === 'memberships' && `${item.billing_interval} access`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-black text-brand-600">
                                                TZS {Number(item.price || 0).toLocaleString()}
                                            </div>
                                            {((sectionType === 'content' && item.price !== null) || (sectionType !== 'content' && Number(item.price || 0) > 0)) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const checkoutItem = buildCheckoutItem(sectionType, item, merchant);
                                                        if (checkoutItem) window.__openCheckout?.(checkoutItem);
                                                    }}
                                                    className="h-8 px-3 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors inline-flex items-center gap-1.5"
                                                >
                                                    <Lock className="h-3.5 w-3.5" />
                                                    {sectionType === 'memberships' ? 'Subscribe' : 'Unlock'}
                                                </button>
                                            )}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )
                ) : products.length === 0 ? (
                    <div className="text-center text-muted-foreground py-16">
                        Hakuna bidhaa kwa sasa.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {products.map((product, idx) => (
                            <Link
                                key={`${product.id}-${idx}`}
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
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {productLabel(product)}
                                    </p>
                                </div>
                                <div className="text-sm font-black text-brand-600">
                                    {productPriceLabel(product)}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {isLoadingMore && (
                    <div className="py-8 flex justify-center items-center">
                        <span className="text-muted-foreground text-sm">Inapakia...</span>
                    </div>
                )}

                {!isReachingEnd && products.length > 0 && (
                    <div className="py-6 flex justify-center">
                        <button
                            onClick={() => setSize(size + 1)}
                            className="h-11 px-6 rounded-full border border-border text-sm font-bold hover:bg-accent transition-colors"
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
