import React, { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarClock, ClipboardCheck, Copy, ExternalLink, Loader2, MapPin, Package, Phone, Route, Ship } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import AppLayout from '@/Layouts/AppLayout';
import { enabledFreightModes, freightEstimateLabel, freightModeLabel, freightPriceLabel } from '@/Components/FreightRouteCard';

const templateFields = (template = '', fallbackFields = []) => {
    const matches = [...String(template || '').matchAll(/\{\{\s*([a-zA-Z0-9_ -]+)\s*:\s*([^}]+)\s*\}\}/g)];
    if (matches.length > 0) {
        return matches.map((match) => ({
            key: String(match[1] || '').trim().replace(/\s+/g, '_').toLowerCase(),
            label: String(match[2] || match[1] || '').trim(),
        })).filter((field) => field.key && field.key !== 'warehouse_address');
    }

    const fields = Array.isArray(fallbackFields) ? fallbackFields : [];
    return fields.map((field) => ({
        key: String(field || '').trim().replace(/\s+/g, '_').toLowerCase(),
        label: String(field || '').replace(/_/g, ' '),
    })).filter((field) => field.key);
};

const locationAddress = (location = {}) => (
    String(location?.address_line || '').trim()
    || [location?.city, location?.state, location?.country].filter(Boolean).join(', ')
);

const mapsHref = (location = {}) => {
    if (location?.latitude && location?.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
    }
    const address = locationAddress(location);
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
};

const routePlace = (locations = [], fallback = '') => {
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

const fillTemplate = (template, inputs = {}, originAddress = '') => {
    const base = String(template || originAddress || '');

    return base.replace(
        /\{\{\s*([a-zA-Z0-9_ -]+)\s*:\s*([^}]+)\s*\}\}/g,
        (_, rawKey, label) => {
            const key = String(rawKey || '').trim().replace(/\s+/g, '_').toLowerCase();
            const value = String(inputs[key] || '').trim();
            return value || `[${String(label || rawKey || '').trim()}]`;
        },
    ).replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+and[ \t]*$/i, '').trim();
};

const paymentTermLabel = (term) => ({
    pay_on_pickup: 'Pay on pickup',
    pay_before_shipping: 'Pay before shipping',
    deposit_balance: 'Deposit + balance',
    quote_after_receiving: 'Quote after receiving',
    included_or_seller_paid: 'Included / seller paid',
}[term] || '');

const paymentTermText = (detail = {}) => {
    const label = paymentTermLabel(detail.payment_term);
    if (!label) return '';
    if (detail.payment_term === 'deposit_balance' && detail.deposit_value) {
        const deposit = detail.deposit_type === 'fixed' ? detail.deposit_value : `${detail.deposit_value}%`;
        return `${label}: ${deposit}${detail.balance_due ? `, balance ${detail.balance_due}` : ''}`;
    }
    return [label, detail.payment_notes].filter(Boolean).join(' · ');
};

export default function RouteDetail({ routeData }) {
    const { auth } = usePage().props;
    const [selectedOriginId, setSelectedOriginId] = useState('');
    const [selectedMode, setSelectedMode] = useState('');
    const [inputs, setInputs] = useState({});
    const [saving, setSaving] = useState(false);
    const origins = Array.isArray(routeData.origin_locations) ? routeData.origin_locations : [];
    const destinations = Array.isArray(routeData.destination_locations) ? routeData.destination_locations : [];
    const modes = Array.isArray(routeData.transport_modes)
        ? routeData.transport_modes.filter((mode) => enabledFreightModes.has(mode))
        : [];
    const details = routeData.transport_details || {};
    const selectedOrigin = origins.find((location) => String(location.id) === String(selectedOriginId)) || origins[0] || null;
    const selectedDestination = destinations[0] || null;
    const selectedOriginAddress = locationAddress(selectedOrigin);
    const selectedOriginTemplate = selectedOrigin?.address_template || selectedOriginAddress;
    const fields = templateFields(selectedOriginTemplate, []);
    const filledAddress = fillTemplate(selectedOriginTemplate, inputs, selectedOriginAddress) || selectedOriginAddress;
    const canImport = Boolean(selectedOrigin && filledAddress) && fields.every((field) => String(inputs[field.key] || '').trim());
    const [originFallback = 'Origin', destinationFallback = 'Destination'] = String(routeData.label || '').split(' to ');
    const originName = routePlace(origins, originFallback || 'Origin');
    const destinationName = routePlace(destinations, destinationFallback || 'Destination');

    useEffect(() => {
        if (!selectedOriginId && origins[0]?.id) {
            setSelectedOriginId(origins[0].id);
        }
    }, [origins, selectedOriginId]);

    useEffect(() => {
        if (!selectedMode && modes[0]) {
            setSelectedMode(modes[0]);
        }
    }, [modes, selectedMode]);

    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(filledAddress);
            toast.success('Address copied.');
        } catch {
            toast.error('Could not copy address.');
        }
    };

    const importAddress = async () => {
        if (!auth?.user) {
            toast.error('Log in first to import this forwarding address.');
            return;
        }
        if (!canImport) {
            toast.error('Fill all required fields first.');
            return;
        }

        setSaving(true);
        try {
            await axios.post('/api/me/addresses', {
                type: 'forwarder',
                forwarder_id: routeData.forwarder?.id || undefined,
                forwarder_route_id: routeData.forwarder_route_id || undefined,
                forwarder_location_id: selectedOrigin?.id || undefined,
                forwarder_transport_mode: selectedMode || undefined,
                name: `${routeData.forwarder?.name || 'Forwarder'} · ${routeData.label}`,
                address_line: filledAddress,
                extra_details: [
                    selectedOrigin?.name ? `ORIGIN: ${selectedOrigin.name}` : null,
                    selectedDestination?.name ? `DESTINATION: ${selectedDestination.name}` : null,
                    selectedOrigin?.contact_phone ? `PHONE: ${selectedOrigin.contact_phone}` : null,
                ].filter(Boolean).join(' | '),
                forwarder_customer_id: inputs.customer_id || inputs.customer_code || '',
                latitude: selectedOrigin?.latitude || undefined,
                longitude: selectedOrigin?.longitude || undefined,
                country_id: selectedOrigin?.country_id || undefined,
                state_id: selectedOrigin?.state_id || undefined,
                city_id: selectedOrigin?.city_id || undefined,
            });
            toast.success('Forwarder address imported.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not import this address.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${routeData.label} | Freight Route`} />
            <main className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => window.history.length > 1 ? window.history.back() : router.visit('/feed')}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    {routeData.forwarder?.merchant?.username && (
                        <Link href={`/u/${routeData.forwarder.merchant.username}`} className="text-sm font-black text-slate-600 hover:text-brand-600">
                            @{routeData.forwarder.merchant.username}
                        </Link>
                    )}
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                    <section className="space-y-6">
                        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 px-5 py-5 text-white shadow-sm">
                            <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.42),transparent_58%)]" />
                            <div className="relative flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-100">
                                        <Ship className="h-3.5 w-3.5" />
                                        Freight route
                                    </p>
                                    <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/45">From</p>
                                            <h1 className="mt-2 truncate text-3xl font-black leading-none sm:text-4xl">{originName}</h1>
                                        </div>
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 sm:h-14 sm:w-14">
                                            <Route className="h-6 w-6 text-sky-200" />
                                        </div>
                                        <div className="min-w-0 text-right">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/45">To</p>
                                            <h1 className="mt-2 truncate text-3xl font-black leading-none sm:text-4xl">{destinationName}</h1>
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden shrink-0 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right sm:block">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/45">Offices</p>
                                    <p className="text-2xl font-black">{origins.length} &rarr; {destinations.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-xl font-black text-slate-950">Route services</h2>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {modes.map((mode) => {
                                    const detail = details?.[mode] || {};
                                    const price = freightPriceLabel(detail);
                                    return (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setSelectedMode(mode)}
                                            className={`rounded-2xl border p-4 text-left transition ${selectedMode === mode ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-100 bg-slate-50 hover:border-brand-200'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-base font-black text-slate-950">{freightModeLabel(mode)}</p>
                                                    {detail.estimate && <p className="mt-1 text-sm font-bold text-slate-500">{freightEstimateLabel(detail.estimate)}</p>}
                                                </div>
                                                {price && <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-900 ring-1 ring-slate-200">{price}</span>}
                                            </div>
                                            {paymentTermText(detail) && (
                                                <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                                                    {paymentTermText(detail)}
                                                </p>
                                            )}
                                            {(detail.allowed_items || detail.disallowed_items || detail.notes) && (
                                                <div className="mt-4 space-y-2 text-sm font-semibold leading-6 text-slate-600">
                                                    {detail.allowed_items && <p><span className="font-black text-emerald-700">Allowed:</span> {detail.allowed_items}</p>}
                                                    {detail.disallowed_items && <p><span className="font-black text-rose-700">Not allowed:</span> {detail.disallowed_items}</p>}
                                                    {detail.notes && <p>{detail.notes}</p>}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="h-5 w-5 text-brand-600" />
                                <h2 className="text-xl font-black text-slate-950">Schedules</h2>
                            </div>
                            <div className="mt-4 grid gap-3">
                                {(routeData.schedules || []).length > 0 ? routeData.schedules.map((schedule) => (
                                    <div key={schedule.id || schedule.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-black text-slate-950">{schedule.title || freightModeLabel(schedule.transport_mode)}</p>
                                                <p className="mt-1 text-sm font-bold text-slate-500">{schedule.eta_text || schedule.notes || 'ETA not set'}</p>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700 ring-1 ring-slate-200">
                                                {schedule.status || 'open'}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs font-bold text-slate-500">
                                            {schedule.departure_date ? `Departure: ${schedule.departure_date}` : ''}
                                            {schedule.cutoff_date ? ` · Cutoff: ${schedule.cutoff_date}` : ''}
                                        </p>
                                    </div>
                                )) : (
                                    <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm font-bold text-slate-500">No schedules posted for this route yet.</p>
                                )}
                            </div>
                        </div>
                    </section>

                    <aside className="space-y-6">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                                    {routeData.forwarder?.logo_url ? <img src={routeData.forwarder.logo_url} alt="" className="h-full w-full object-contain p-2" /> : <Ship className="h-7 w-7" />}
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-950">{routeData.forwarder?.name || 'Forwarder'}</p>
                                    <p className="text-sm font-bold text-slate-500">Verified freight provider</p>
                                </div>
                            </div>
                            {routeData.forwarder?.description && (
                                <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{routeData.forwarder.description}</p>
                            )}
                            {(routeData.forwarder?.contact_phone || routeData.forwarder?.whatsapp_phone) && (
                                <p className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900">
                                    <Phone className="h-4 w-4" />
                                    {routeData.forwarder.whatsapp_phone || routeData.forwarder.contact_phone}
                                </p>
                            )}
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-xl font-black text-slate-950">Import shipping address</h2>
                            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Choose the origin warehouse and fill the fields required by this forwarder.</p>

                            <div className="mt-4 space-y-2">
                                {origins.map((origin) => (
                                    <div
                                        key={origin.id}
                                        className={`rounded-2xl px-4 py-3 transition ${String(selectedOrigin?.id) === String(origin.id) ? 'bg-emerald-50 ring-2 ring-emerald-200' : 'bg-slate-50 hover:bg-slate-100'}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setSelectedOriginId(origin.id)}
                                            className="block w-full text-left"
                                        >
                                            <p className="flex items-center gap-2 font-black text-slate-950"><MapPin className="h-4 w-4 text-emerald-700" /> {origin.name}</p>
                                            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{locationAddress(origin)}</p>
                                        </button>
                                        {mapsHref(origin) && (
                                            <a
                                                href={mapsHref(origin)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-700"
                                            >
                                                Open map <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 whitespace-pre-line rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-800">
                                {filledAddress || 'No address template available.'}
                            </div>

                            <div className="mt-4 grid gap-3">
                                {fields.map((field) => (
                                    <label key={field.key} className="space-y-1.5">
                                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">{field.label}</span>
                                        <input
                                            type="text"
                                            value={inputs[field.key] || ''}
                                            onChange={(event) => setInputs((current) => ({ ...current, [field.key]: event.target.value }))}
                                            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                                            placeholder={field.label}
                                        />
                                    </label>
                                ))}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <button type="button" onClick={copyAddress} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-700">
                                    <Copy className="h-4 w-4" /> Copy
                                </button>
                                <button type="button" onClick={importAddress} disabled={saving || !selectedOrigin} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-xs font-black uppercase tracking-widest text-white disabled:bg-slate-300">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                                    Import
                                </button>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-xl font-black text-slate-950">Pickup offices</h2>
                            <div className="mt-4 space-y-2">
                                {destinations.map((destination) => (
                                    <div key={destination.id} className="rounded-2xl bg-sky-50 px-4 py-3 text-sky-950">
                                        <p className="flex items-center gap-2 font-black"><Package className="h-4 w-4" /> {destination.name}</p>
                                        <p className="mt-1 text-xs font-bold leading-5 text-sky-800/70">{locationAddress(destination)}</p>
                                        {destination.contact_phone && (
                                            <p className="mt-2 flex items-center gap-1.5 text-xs font-black text-sky-950">
                                                <Phone className="h-3.5 w-3.5" />
                                                {destination.contact_phone}
                                            </p>
                                        )}
                                        {mapsHref(destination) && (
                                            <a
                                                href={mapsHref(destination)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-sky-700"
                                            >
                                                Open map <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div>
            </main>
        </AppLayout>
    );
}
