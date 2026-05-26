import React from 'react';
import { router } from '@inertiajs/react';
import { MapPin, Package, Route, Ship, Truck } from 'lucide-react';

export const freightModeLabels = {
    sea_cargo: 'Sea cargo',
    air_cargo: 'Air cargo',
    // Re-enable later when supported in production.
    // road_cargo: 'Road cargo',
    // bus_parcel: 'Bus parcel',
    // customs_clearing: 'Customs',
    // warehousing: 'Warehousing',
    // last_mile_delivery: 'Last-mile',
    // import_forwarding: 'Forwarding',
};
export const enabledFreightModes = new Set(['sea_cargo', 'air_cargo']);

export const freightPricingSuffix = {
    per_kg: '/kg',
    per_cbm: '/CBM',
    per_day: '/day',
    per_week: '/week',
    per_cbm_day: '/CBM/day',
    per_pallet: '/pallet',
    per_km: '/km',
    per_zone: '/zone',
    percent_declared_value: '% value',
    percent_duty_tax: '% duty/tax',
    fee_plus_government: '+ govt',
    retainer: 'retainer',
    fixed: 'fixed',
};

export const freightModeLabel = (mode) => freightModeLabels[mode] || String(mode || '').replace(/_/g, ' ');

export const freightPriceLabel = (detail = {}) => {
    if (!detail?.price_amount) return detail?.pricing_model === 'quote' ? 'Quote' : '';
    const suffix = detail.pricing_model && detail.pricing_model !== 'quote'
        ? ` ${freightPricingSuffix[detail.pricing_model] || detail.pricing_model}`
        : '';
    return `${detail.currency || ''} ${detail.price_amount}${suffix}`.trim();
};

export const freightEstimateLabel = (estimate) => {
    const value = String(estimate || '').trim();
    if (!value) return '';
    if (/[a-zA-Z]/.test(value)) return value;
    if (/^\d+(\.\d+)?(\s*-\s*\d+(\.\d+)?)?$/.test(value)) {
        return `${value} ${value === '1' ? 'day' : 'days'}`;
    }
    return value;
};

export const compactFreightPlace = (locations = [], fallback = '') => {
    const list = Array.isArray(locations) ? locations : [];
    const countries = [...new Set(list.map((location) => location?.country).filter(Boolean))];
    if (countries.length === 1) return countries[0];
    if (countries.length > 1) return countries.join(', ');

    const states = [...new Set(list.map((location) => location?.state).filter(Boolean))];
    if (states.length === 1) return states[0];
    if (states.length > 1) return states.join(', ');

    const cities = [...new Set(list.map((location) => location?.city).filter(Boolean))];
    if (cities.length === 1) return cities[0];
    if (cities.length > 1) return cities.join(', ');

    return fallback;
};

export default function FreightRouteCard({ snapshot = {}, onOpen, routeHref = null, className = '' }) {
    const transportModes = Array.isArray(snapshot.transport_modes)
        ? snapshot.transport_modes.filter((mode) => enabledFreightModes.has(mode))
        : [];
    const transportDetails = snapshot.transport_details || {};
    const originLocations = Array.isArray(snapshot.origin_locations) ? snapshot.origin_locations : [];
    const destinationLocations = Array.isArray(snapshot.destination_locations) ? snapshot.destination_locations : [];
    const [originFallback = 'Origin', destinationFallback = 'Destination'] = String(snapshot.label || '').split(' to ');
    const origin = compactFreightPlace(originLocations, originFallback || 'Origin');
    const destination = compactFreightPlace(destinationLocations, destinationFallback || 'Destination');
    const primaryModes = transportModes
        .map((mode) => ({ mode, detail: transportDetails?.[mode] || {} }))
        .filter(({ detail }) => detail?.estimate || detail?.price_amount || detail?.pricing_model === 'quote')
        .slice(0, 4);
    const originNames = originLocations.map((location) => location?.name).filter(Boolean).slice(0, 3);
    const destinationNames = destinationLocations.map((location) => location?.name).filter(Boolean).slice(0, 3);
    const instruction = String(snapshot.customer_instructions || '').trim();

    const openRoute = (event) => {
        event?.stopPropagation?.();
        if (routeHref) {
            router.visit(routeHref);
        } else {
            onOpen?.();
        }
    };

    return (
        <div
            className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}
            onClick={(event) => {
                event.stopPropagation();
                onOpen?.();
            }}
        >
            <div className="relative overflow-hidden bg-slate-950 px-5 py-5 text-white">
                <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.42),transparent_58%)]" />
                <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-100">
                            <Ship className="h-3.5 w-3.5" />
                            Freight route
                        </div>
                        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/45">From</p>
                                <p className="mt-1 truncate text-2xl font-black leading-none">{origin}</p>
                            </div>
                            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10">
                                <Route className="h-5 w-5 text-sky-200" />
                            </div>
                            <div className="min-w-0 text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/45">To</p>
                                <p className="mt-1 truncate text-2xl font-black leading-none">{destination}</p>
                            </div>
                        </div>
                    </div>
                    <div className="hidden shrink-0 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right sm:block">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Offices</p>
                        <p className="text-lg font-black">{originLocations.length} &rarr; {destinationLocations.length}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-5">
                <div className="grid gap-2 sm:grid-cols-2">
                    {primaryModes.length > 0 ? primaryModes.map(({ mode, detail }) => {
                        const price = freightPriceLabel(detail);
                        return (
                            <div key={mode} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-black text-slate-950">{freightModeLabel(mode)}</p>
                                        {detail.estimate && <p className="mt-1 text-xs font-bold text-slate-500">{freightEstimateLabel(detail.estimate)}</p>}
                                    </div>
                                    {price && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-800 ring-1 ring-slate-200">{price}</span>}
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500 sm:col-span-2">
                            Open route for freight details.
                        </div>
                    )}
                </div>

                {(originNames.length > 0 || destinationNames.length > 0) && (
                    <div className="grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
                            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700"><MapPin className="h-3.5 w-3.5" /> Drop-off</p>
                            <p className="line-clamp-2">{originNames.join(', ') || 'Origin locations'}</p>
                        </div>
                        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sky-900">
                            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-sky-700"><Package className="h-3.5 w-3.5" /> Pickup</p>
                            <p className="line-clamp-2">{destinationNames.join(', ') || 'Collection offices'}</p>
                        </div>
                    </div>
                )}

                {instruction && (
                    <p className="line-clamp-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
                        {instruction}
                    </p>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="flex flex-wrap gap-1.5">
                        {transportModes.slice(0, 5).map((mode) => (
                            <span key={mode} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                {freightModeLabel(mode)}
                            </span>
                        ))}
                    </div>
                    {(routeHref || onOpen) ? (
                        <button
                            type="button"
                            onClick={openRoute}
                            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-black text-white"
                        >
                            View route
                            <Truck className="h-4 w-4" />
                        </button>
                    ) : (
                        <span className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-100 px-4 text-sm font-black text-slate-700">
                            Route details
                            <Truck className="h-4 w-4" />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
