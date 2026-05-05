import React from 'react';
import { Link } from '@inertiajs/react';
import { BadgeCheck, CalendarClock, DownloadCloud, Image, Lock, MapPin, Music, PenLine, Play, ShoppingBag, Store } from 'lucide-react';
import { productPriceLabel } from '@/lib/productUnits';

export default function ProductSearchCard({ product }) {
    if (!product) return null;

    const href = `/product/${product.slug || product.id}`;
    const label = productLabel(product);
    const Icon = productIcon(product);
    const merchant = product.merchant || {};
    const discoveryLocation = product.discovery_location;

    return (
        <Link href={href} className="block p-4 bg-background hover:bg-accent/40 transition-colors">
            <div className="flex items-start gap-3">
                <div className="h-16 w-16 rounded-2xl bg-muted overflow-hidden shrink-0 border border-border/60">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <Icon className="h-6 w-6" />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
                            <Icon className="h-3 w-3" />
                            {label}
                        </span>
                        {merchant.is_verified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                                <BadgeCheck className="h-3 w-3" />
                                Verified
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm font-black text-foreground line-clamp-2">{product.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {merchant.display_name || merchant.name || 'Creator'}
                        {merchant.username ? ` @${merchant.username}` : ''}
                    </p>
                    {discoveryLocation && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-600" />
                            <span className="line-clamp-1">
                                {[
                                    discoveryLocation.name,
                                    discoveryLocation.city,
                                    discoveryLocation.region,
                                ].filter(Boolean).join(', ')}
                                {discoveryLocation.distance_km !== null && discoveryLocation.distance_km !== undefined
                                    ? ` • ${discoveryLocation.distance_km} km`
                                    : ''}
                                {discoveryLocation.allow_self_pickup ? ' • Pickup' : ''}
                            </span>
                        </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-black text-brand-600">
                            {productPriceLabel(product)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3 py-1.5 text-xs font-black">
                            <ShoppingBag className="h-3.5 w-3.5" />
                            View
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

function productLabel(product) {
    if (product.type === 'service') return 'Service';
    if (product.type !== 'digital') return 'Product';

    const map = {
        video_stream: 'Premium video',
        audio_stream: 'Premium audio',
        gallery_pack: 'Gallery pack',
        live_event: 'Live event',
        custom_delivery: 'Custom work',
        external_link: 'External access',
        file: product.digital_content_type === 'software'
            ? 'Software'
            : product.digital_content_type === 'document'
                ? 'Document'
                : product.digital_content_type === 'ebook'
                    ? 'E-book'
                    : 'Download',
    };

    return map[product.digital_delivery_type] || 'Download';
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
        external_link: Lock,
        file: DownloadCloud,
    }[product.digital_delivery_type] || DownloadCloud;
}
