import React, { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { CalendarClock, ChevronRight, Crown, DownloadCloud, Image, MapPin, Music, PenLine, Play, ShoppingBag, Sparkles, Store } from 'lucide-react';
import axios from 'axios';
import { trackPlatformEvent } from '@/lib/attribution';

export function useDiscoveryRails() {
    const [rails, setRails] = useState([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        axios.get('/api/discovery/rails')
            .then((res) => {
                if (cancelled) return;
                setRails((res.data?.rails || []).filter((rail) => (rail.items || []).length > 0));
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
                <DiscoveryHeader />

                {rails.slice(0, 4).map((rail) => (
                    <DiscoveryRailSection key={rail.key} rail={rail} />
                ))}
            </div>
        </div>
    );
}

export function DiscoveryHeader() {
    return (
        <div className="flex items-center justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-600" />
                    <p className="text-sm font-black uppercase tracking-widest text-foreground">Discover</p>
                </div>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">Trending offers, nearby finds, and creator drops</p>
            </div>
            <Link href="/search?q=creator&type=creator" className="text-xs font-black text-brand-600 inline-flex items-center gap-1">
                Explore
                <ChevronRight className="h-3.5 w-3.5" />
            </Link>
        </div>
    );
}

export function DiscoveryRailSection({ rail, compact = false }) {
    if (!rail || (rail.items || []).length === 0) return null;

    return (
        <section className={compact ? 'bg-slate-50 border-y border-border px-3 py-4 space-y-2' : 'space-y-2'}>
            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-black text-foreground truncate">{rail.title}</h2>
                    <p className="text-xs text-muted-foreground line-clamp-1">{rail.subtitle}</p>
                </div>
                <Link href={railSearchHref(rail)} className="text-[11px] font-black text-brand-600 shrink-0">
                    See all
                </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3">
                {(rail.items || []).slice(0, compact ? 6 : 8).map((item) => (
                    rail.type === 'subscriptions'
                        ? <SubscriptionRailCard key={`plan-${item.id}`} plan={item} compact={compact} />
                        : <ProductRailCard key={`product-${item.id}`} product={item} compact={compact} />
                ))}
            </div>
        </section>
    );
}

function ProductRailCard({ product, compact = false }) {
    const Icon = productIcon(product);
    const label = productLabel(product);
    const location = product.discovery_location;

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
            className={`${compact ? 'w-36' : 'w-40'} shrink-0 rounded-2xl border border-border bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
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
                <p className={`${compact ? 'mt-1 text-[13px] min-h-[32px]' : 'mt-1.5 text-sm min-h-[34px]'} font-black leading-tight text-foreground line-clamp-2`}>{product.title}</p>
                {location && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground truncate">
                        <MapPin className="h-3 w-3 text-brand-600 shrink-0" />
                        {[location.city, location.region].filter(Boolean).join(', ') || location.name || 'Nearby'}
                        {location.distance_km !== null && location.distance_km !== undefined ? ` • ${location.distance_km} km` : ''}
                    </p>
                )}
                <p className="mt-2 text-sm font-black text-brand-600">TZS {Number(product.checkout_price ?? product.price ?? 0).toLocaleString()}</p>
            </div>
        </Link>
    );
}

function SubscriptionRailCard({ plan, compact = false }) {
    return (
        <Link
            href={`/plan/${plan.slug || plan.id}`}
            className={`${compact ? 'w-36' : 'w-40'} shrink-0 rounded-2xl border border-border bg-white p-3 shadow-sm hover:shadow-md transition-shadow`}
        >
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Crown className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-black leading-tight text-foreground line-clamp-2 min-h-[34px]">{plan.name}</p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{plan.description || plan.merchant?.name || 'Creator membership'}</p>
            <p className="mt-3 text-sm font-black text-brand-600">TZS {Number(plan.price || 0).toLocaleString()}</p>
        </Link>
    );
}

function railSearchHref(rail) {
    const map = {
        nearby: '/search?q=nearby&type=physical',
        premium_media: '/search?q=premium&type=digital',
        downloads: '/search?q=templates&type=digital',
        events: '/search?q=event&type=digital',
        services: '/search?q=service&type=service',
        memberships: '/search?q=club&type=creator',
    };

    return map[rail.key] || '/search';
}

function productLabel(product) {
    if (product.type === 'service') return 'Service';
    if (product.type !== 'digital') return 'Product';

    return {
        video_stream: 'Video',
        audio_stream: 'Audio',
        gallery_pack: 'Gallery',
        live_event: 'Event',
        custom_delivery: 'Custom',
        external_link: 'Access',
        file: product.digital_content_type === 'software'
            ? 'Software'
            : product.digital_content_type === 'document'
                ? 'Document'
                : product.digital_content_type === 'ebook'
                    ? 'E-book'
                    : 'Download',
    }[product.digital_delivery_type] || 'Download';
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
