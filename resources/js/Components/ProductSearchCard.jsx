import React, { useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { BadgeCheck, CalendarClock, DownloadCloud, Image, Lock, Music, PenLine, Play, ShoppingBag, Store } from 'lucide-react';
import { productCardPriceLabel, productUnitLabel } from '@/lib/productUnits';

export default function ProductSearchCard({ product, variant = 'list' }) {
    if (!product) return null;

    const href = `/product/${product.slug || product.id}`;
    const label = productLabel(product);
    const Icon = productIcon(product);
    const merchant = product.merchant || {};
    const unitLabel = product.type === 'physical' ? productUnitLabel(product) : '';
    const price = Number(product.checkout_price ?? product.discounted_price ?? product.price ?? 0);
    const comparePrice = Number(product.compare_at_price ?? product.price ?? 0);
    const hasDiscount = product.type === 'physical' && comparePrice > price && price > 0;
    const discountPercent = hasDiscount ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
    const imageUrl = useMemo(() => {
        const galleryImages = Array.isArray(product.images)
            ? product.images
                .map((image) => image?.thumbnail_url || image?.image_url || image?.url)
                .filter(Boolean)
            : [];
        const options = galleryImages.length > 0 ? galleryImages : [product.image_url].filter(Boolean);
        if (options.length === 0) return '';

        return options[Math.floor(Math.random() * options.length)];
    }, [product.id, product.image_url, product.images]);

    if (variant === 'grid') {
        return (
            <Link
                href={href}
                className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md"
            >
                <div className="relative aspect-square bg-slate-50">
                    {discountPercent > 0 && (
                        <div className="absolute left-2 top-0 z-10 rounded-b-md bg-blue-600 px-1.5 py-1 text-center text-[9px] font-black uppercase leading-none text-white">
                            {discountPercent}%<br />OFF
                        </div>
                    )}
                    {imageUrl ? (
                        <img src={imageUrl} alt={product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <Icon className="h-8 w-8" />
                        </div>
                    )}
                </div>

                <div className="flex flex-1 flex-col space-y-1.5 p-2.5">
                    <p className="min-h-[36px] text-[13px] font-black leading-tight text-foreground line-clamp-2 mb-0">{product.title}</p>
                    {unitLabel && (
                        <p className="truncate text-[12px] font-semibold text-slate-500">{unitLabel}</p>
                    )}
                    <div className="mt-auto pt-1">
                        <p className="text-[13px] font-black leading-none text-slate-950">{productCardPriceLabel(product)}</p>
                        {hasDiscount && (
                            <p className="mt-1 text-[11px] font-bold leading-none text-slate-400 line-through">
                                TZS {comparePrice.toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
            </Link>
        );
    }

    return (
        <Link href={href} className="block p-4 bg-background hover:bg-accent/40 transition-colors">
            <div className="flex items-start gap-3">
                <div className="h-20 w-16 rounded-xs bg-muted overflow-hidden shrink-0">
                    {imageUrl ? (
                        <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
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
                    {unitLabel && (
                        <p className="mt-1 text-xs font-bold text-slate-500 truncate">{unitLabel}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        By {merchant.display_name || merchant.name || 'Creator'}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-black text-brand-600">
                            {productCardPriceLabel(product)}
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
