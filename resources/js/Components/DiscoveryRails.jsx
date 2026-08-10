import React, { useEffect, useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import { CalendarClock, ChevronRight, Crown, DownloadCloud, Image, Music, PenLine, Play, ShoppingBag, Sparkles, Store } from 'lucide-react';
import axios from 'axios';
import { trackPlatformEvent } from '@/lib/attribution';
import { productRailPriceLabel, productUnitLabel } from '@/lib/productUnits';
import { useLocale } from '@/lib/i18n';

export function useDiscoveryRails() {
    const [rails, setRails] = useState([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        axios.get('/api/discovery/rails')
            .then((res) => {
                if (cancelled) return;
                // The API remains backward-compatible, but service rails are hidden
                // from the launch frontend until service providers are supported.
                setRails((res.data?.rails || []).filter((rail) => rail.key !== 'services' && (rail.items || []).length > 0));
            })
            .catch(() => {
                if (!cancelled) setRails([]);
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });

        return () => { cancelled = true; };
    }, []);

    return { rails, loaded };
}

export default function DiscoveryRails() {
    const { rails, loaded } = useDiscoveryRails();

    if (!loaded || rails.length === 0) return null;

    return (
        <div className="bg-slate-50 border-b border-border">
            <div className="px-3 py-4 space-y-5">
                {rails.slice(0, 4).map((rail) => (
                    <DiscoveryRailSection key={rail.key} rail={rail} />
                ))}
            </div>
        </div>
    );
}

export function DiscoveryRailSection({ rail, compact = false, featured = false }) {
    const { copy } = useLocale();
    if (!rail || (rail.items || []).length === 0) return null;

    return (
        <section className={compact ? 'bg-white/80 border-y border-border/70 px-4 py-4 space-y-3' : featured ? 'space-y-3' : 'space-y-2'}>
            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    {/*<h2 className={'text-sm font-bold text-foreground truncate'}>{localizedRailTitle(rail)}</h2>*/}
                    <p className="text-xs font-semibold text-muted-foreground line-clamp-1">{localizedRailSubtitle(rail, copy)}</p>
                </div>
                <Link href={railSearchHref(rail)} className="text-[11px] font-bold text-brand-600 shrink-0">
                    {copy('See more', 'Ona zaidi')}
                </Link>
            </div>
            <div className={`${featured ? 'gap-3.5' : 'gap-3'} flex overflow-x-auto pb-1 -mx-3`}>
                {(rail.items || []).slice(0, compact ? 6 : featured ? 5 : 8).map((item) => (
                    rail.type === 'subscriptions'
                        ? <SubscriptionRailCard key={`plan-${item.id}`} plan={item} compact={compact} featured={featured} />
                        : <ProductRailCard key={`product-${item.id}`} product={item} compact={compact} featured={featured} />
                ))}
            </div>
        </section>
    );
}

function ProductRailCard({ product, compact = false, featured = false }) {
    const { copy } = useLocale();
    const Icon = productIcon(product);
    const label = productLabel(product, copy);
    const isPhysicalProduct = product.type === 'physical';
    const unitLabel = isPhysicalProduct ? productUnitLabel(product) : '';
    const price = Number(product.checkout_price ?? product.discounted_price ?? product.price ?? 0);
    const comparePrice = Number(product.compare_at_price ?? product.price ?? 0);
    const hasDiscount = isPhysicalProduct && comparePrice > price && price > 0;
    const discountPercent = hasDiscount ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
    const physicalImageUrl = useMemo(() => {
        const galleryImages = Array.isArray(product.images)
            ? product.images
                .map((image) => image?.thumbnail_url || image?.image_url || image?.url)
                .filter(Boolean)
            : [];
        const options = galleryImages.length > 0 ? galleryImages : [product.image_url].filter(Boolean);
        if (options.length === 0) return '';

        return options[Math.floor(Math.random() * options.length)];
    }, [product.id, product.image_url, product.images]);

    if (isPhysicalProduct) {
        return (
            <Link
                href={`/product/${product.slug || product.id}`}
                onClick={() => trackPlatformEvent('product_click', {
                    entity_type: 'product',
                    entity_id: product.id,
                    merchant_id: product.merchant_id || product.merchant?.id || null,
                    metadata: {
                        source: 'discovery_rail',
                        product_type: product.type,
                    },
                })}
                className={`${featured ? 'w-44' : 'w-40'} shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200/80 transition-all hover:-translate-y-0.5 hover:shadow-md`}
            >
                <div className="relative aspect-square bg-white">
                    {discountPercent > 0 && (
                        <div className="absolute left-2 top-0 z-10 rounded-b-md bg-blue-600 px-1.5 py-1 text-center text-[9px] font-black uppercase leading-none text-white">
                            {discountPercent}%<br />OFF
                        </div>
                    )}
                    {physicalImageUrl ? (
                        <img src={physicalImageUrl} alt={product.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ShoppingBag className="h-7 w-7" />
                        </div>
                    )}
                </div>
                <div className="space-y-1 px-3 py-2.5">
                    <p className="min-h-[36px] text-[12px] font-bold leading-tight text-foreground line-clamp-2 mb-0">
                        {product.title}
                    </p>
                    {unitLabel && (
                        <p className="truncate text-[12px] font-semibold text-slate-500">
                            {unitLabel}
                        </p>
                    )}
                    <p className="text-sm font-bold leading-none text-slate-950">
                        {productRailPriceLabel(product, price, compact)}
                    </p>
                    {hasDiscount && (
                        <p className="text-[11px] font-bold leading-none text-slate-400 line-through">
                            {productRailPriceLabel(product, comparePrice, compact)}
                        </p>
                    )}
                </div>
            </Link>
        );
    }

    return (
        <Link
            href={`/product/${product.slug || product.id}`}
            onClick={() => trackPlatformEvent('product_click', {
                entity_type: 'product',
                entity_id: product.id,
                merchant_id: product.merchant_id || product.merchant?.id || null,
                metadata: {
                    source: 'discovery_rail',
                    product_type: product.type,
                },
            })}
            className={`${compact ? 'w-36' : featured ? 'w-44' : 'w-40'} shrink-0 rounded-lg bg-white overflow-hidden shadow-sm ring-1 ring-border/80 hover:-translate-y-0.5 hover:shadow-md transition-all`}
        >
            <div className="aspect-[4/3] bg-muted">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                        <Icon className="h-7 w-7" />
                    </div>
                )}
            </div>
            <div className="p-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[9px] font-black uppercase">
                    <Icon className="h-3 w-3" />
                    {label}
                </span>
                <p className={`${compact ? 'mt-1 text-[12px] min-h-[32px]' : 'mt-1.5 text-sm min-h-[34px]'} font-bold leading-tight text-foreground line-clamp-2`}>{product.title}</p>
                <p className="mt-2 text-sm font-bold text-brand-600">{productRailPriceLabel(product, null, compact)}</p>
            </div>
        </Link>
    );
}

function SubscriptionRailCard({ plan, compact = false, featured = false }) {
    const { copy } = useLocale();
    return (
        <Link
            href={`/plan/${plan.slug || plan.id}`}
            className={`${compact ? 'w-36' : featured ? 'w-44' : 'w-40'} shrink-0 rounded-lg bg-white p-3 shadow-sm ring-1 ring-border/80 hover:-translate-y-0.5 hover:shadow-md transition-all`}
        >
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Crown className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-black leading-tight text-foreground line-clamp-2 min-h-[34px]">{plan.name}</p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{plan.description || plan.merchant?.name || copy('Creator membership', 'Uanachama wa creator')}</p>
            <p className="mt-3 text-sm font-black text-brand-600">TZS {Number(plan.price || 0).toLocaleString()}</p>
        </Link>
    );
}

function railSearchHref(rail) {
    const map = {
        nearby: '/search?q=nearby&type=physical&surface=products',
        premium_media: '/search?q=premium&type=digital&surface=products',
        downloads: '/search?q=downloads&type=digital&surface=products',
        events: '/search?q=event&type=digital&surface=products',
        memberships: '/search?q=club&type=creator',
    };

    return map[rail.key] || '/search';
}

function localizedRailTitle(rail = {}, copy = (english) => english) {
    const map = {
        nearby: copy('Nearby', 'Vilivyo karibu'),
        premium_media: copy('Premium content', 'Maudhui premium'),
        downloads: copy('Downloads', 'Downloads'),
        events: copy('Events', 'Matukio'),
        memberships: copy('Memberships', 'Uanachama'),
    };

    return map[rail.key] || rail.title || 'Gundua';
}

function localizedRailSubtitle(rail = {}, copy = (english) => english) {
    const map = {
        nearby: copy('Physical products from sellers near you', 'Bidhaa halisi kutoka kwa wauzaji walio karibu nawe'),
        premium_media: copy('Videos, photos, and paid content', 'Video, picha na maudhui ya kulipia'),
        downloads: copy('Files and digital products you can download', 'Faili na bidhaa za kidijitali unazoweza kupakua'),
        events: copy('Events and places to attend', 'Matukio na nafasi za kuhudhuria'),
        memberships: copy('Plans to join creators', 'Mipango ya kujiunga na creators'),
    };

    return map[rail.key] || rail.subtitle || '';
}

function productLabel(product, copy = (english) => english) {
    if (product.type === 'service') return copy('Service', 'Huduma');
    if (product.type !== 'digital') return copy('Product', 'Bidhaa');

    return {
        video_stream: copy('Video', 'Video'),
        audio_stream: copy('Audio', 'Audio'),
        gallery_pack: copy('Photos', 'Picha'),
        live_event: copy('Event', 'Tukio'),
        custom_delivery: copy('Custom', 'Maalum'),
        external_link: copy('Access', 'Ufikiaji'),
        file: product.digital_content_type === 'software'
            ? copy('Software', 'Software')
            : product.digital_content_type === 'document'
                ? copy('Document', 'Documenti')
                : product.digital_content_type === 'ebook'
                    ? copy('E-book', 'E-book')
                    : copy('Download', 'Download'),
    }[product.digital_delivery_type] || copy('Download', 'Download');
}

function productIcon(product) {
    if (product.type === 'service') return Store;
    if (product.type !== 'digital') return ShoppingBag;

    return {
        video_stream: Play,
        audio_stream: Music,
        gallery_pack: Image,
        live_event: CalendarClock,
        custom_delivery: PenLine,
        file: DownloadCloud,
    }[product.digital_delivery_type] || DownloadCloud;
}
