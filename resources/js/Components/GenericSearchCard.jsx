import React from 'react';
import { Link } from '@inertiajs/react';
import { BookOpen, Boxes, CalendarClock, MapPin, Package, Route, Store, Wrench } from 'lucide-react';

const icons = {
    bundle: Boxes,
    course: BookOpen,
    subscription: CalendarClock,
    offering_group: Package,
    forwarder_route: Route,
    long_content: BookOpen,
    service: Wrench,
    merchant: Store,
};

export default function GenericSearchCard({ item, compact = false }) {
    const payload = item?.payload || {};
    const Icon = icons[item?.card_type] || Package;
    const title = payload.title || payload.name || 'Takeer result';
    const summary = payload.excerpt || payload.summary || payload.description || '';
    const url = payload.url || payload.store_url || '#';
    const image = payload.image_url || payload.cover_image_url || payload.avatar_url;
    const price = payload.price ?? payload.base_price ?? item?.matched_variant?.price;
    const currency = item?.matched_variant?.currency || payload.currency_code || 'TZS';
    const kind = String(item?.content_type || item?.entity_type || 'result').replaceAll('_', ' ');

    return (
        <Link href={url} className={`flex gap-4 bg-background transition hover:bg-accent/50 ${compact ? 'rounded-2xl border border-border p-3' : 'p-4 sm:p-5'}`}>
            <div className={`${compact ? 'h-16 w-16' : 'h-20 w-20 sm:h-24 sm:w-24'} shrink-0 overflow-hidden rounded-2xl bg-accent`}>
                {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center text-brand-600"><Icon className="h-7 w-7" /></div>}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-600">{kind}</p>
                        <h3 className="mt-1 line-clamp-2 font-black text-foreground">{title}</h3>
                    </div>
                    {price !== null && price !== undefined && <span className="shrink-0 text-sm font-black text-foreground">{currency} {Number(price).toLocaleString()}</span>}
                </div>
                {payload.subtitle && <p className="mt-1 text-xs font-bold text-muted-foreground">{payload.subtitle}</p>}
                {summary && <p className={`mt-1 text-sm leading-5 text-muted-foreground ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>{summary}</p>}
                {(payload.origin || payload.destination) && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {payload.origin} → {payload.destination}</p>}
                {item?.matched_variant && <p className="mt-2 text-xs font-bold text-brand-700">Best match: {item.matched_variant.variant_name || item.matched_variant.sku || 'available option'}</p>}
            </div>
        </Link>
    );
}
