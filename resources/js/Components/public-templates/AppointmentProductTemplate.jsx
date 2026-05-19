import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    ChevronRight,
    Clock3,
    MapPin,
    Minus,
    Plus,
    ShieldCheck,
    Sparkles,
    Store,
    Users,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import ServiceRequestModal from './ServiceRequestModal';

export default function AppointmentProductTemplate({ product }) {
    const [spots, setSpots] = useState(1);
    const [requestOpen, setRequestOpen] = useState(false);
    const details = product?.module_details || {};
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const image = product?.images?.[0]?.image_url || product?.images?.[0]?.thumbnail_url || product?.image_url;
    const pricePerSpot = Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const total = pricePerSpot * spots;
    const capacity = Number(details.capacity || 1);
    const canBook = spots <= capacity;
    const locationMode = String(details.appointment_location_mode || product?.service_location_type || 'provider_location').replace(/_/g, ' ');
    const bookingPolicy = String(details.booking_policy || 'manual_confirm').replace(/_/g, ' ');

    const openBooking = () => {
        if (!canBook) return;
        setRequestOpen(true);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-slate-50 pb-28 text-slate-950">
                <section className="relative min-h-[420px] overflow-hidden bg-slate-950 text-white">
                    {image ? (
                        <img src={image} alt={product.title} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#38bdf8,#111827_58%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
                    <div className="relative z-10 mx-auto flex min-h-[420px] max-w-6xl flex-col justify-between p-4 md:p-8">
                        <button type="button" onClick={() => window.history.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50" aria-label="Go back">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="max-w-4xl">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Appointment
                                </span>
                                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">{bookingPolicy}</span>
                            </div>
                            <h1 className="text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{details.appointment_duration_minutes || 60} min</span>
                                <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{capacity} capacity</span>
                                <span className="inline-flex items-center gap-1.5 capitalize"><MapPin className="h-4 w-4" />{locationMode}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-6xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">About this appointment</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'A bookable appointment managed by the provider.'}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Stat icon={Clock3} label="Duration" value={`${details.appointment_duration_minutes || 60} min`} />
                                <Stat icon={Sparkles} label="Buffer" value={`${details.buffer_minutes ?? 15} min`} />
                                <Stat icon={Users} label="Capacity" value={capacity} />
                            </div>
                        </section>

                        {details.preparation_notes && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Before you arrive</h2>
                                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{details.preparation_notes}</p>
                            </section>
                        )}

                        {merchantSlug && <MerchantLink merchant={merchant} merchantSlug={merchantSlug} label="View provider" />}
                    </div>

                    <CheckoutPanel
                        price={pricePerSpot}
                        total={total}
                        count={spots}
                        countLabel={spots === 1 ? 'spot' : 'spots'}
                        max={capacity}
                        canSubmit={canBook}
                        submitLabel={canBook ? 'Request appointment' : 'Full'}
                        onMinus={() => setSpots((value) => Math.max(1, value - 1))}
                        onPlus={() => setSpots((value) => Math.min(capacity || 100, value + 1))}
                        onSubmit={openBooking}
                    />
                </main>
                <MobileBar total={total} label="Book" disabled={!canBook} onSubmit={openBooking} />
                <ServiceRequestModal
                    product={product}
                    open={requestOpen}
                    onOpenChange={setRequestOpen}
                    requestType="appointment_request"
                    title="Request appointment"
                    submitLabel="Send appointment request"
                    modulePayload={{ appointment_spots: spots }}
                    messagePlaceholder="Add preferred slot, reason for appointment, preparation notes, or location details..."
                />
            </div>
        </AppLayout>
    );
}

function Stat({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-4">
            <Icon className="h-5 w-5 text-slate-500" />
            <p className="mt-2 text-xs font-bold uppercase text-slate-500">{label}</p>
            <p className="text-base font-black capitalize">{value}</p>
        </div>
    );
}

function MerchantLink({ merchant, merchantSlug, label }) {
    return (
        <Link href={`/m/${merchantSlug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                    <Store className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                    <p className="font-black">{merchant?.display_name || label}</p>
                    <p className="text-sm text-slate-500">{label}</p>
                </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
        </Link>
    );
}

function CheckoutPanel({ price, total, count, countLabel, max, canSubmit, submitLabel, onMinus, onPlus, onSubmit }) {
    return (
        <aside className="space-y-4 md:sticky md:top-5 md:self-start">
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Price</p>
                <p className="mt-1 text-3xl font-black text-brand-700">TZS {Number(price || 0).toLocaleString()}</p>
                <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                    <button type="button" onClick={onMinus} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><Minus className="h-4 w-4" /></button>
                    <div className="text-center">
                        <p className="text-lg font-black">{count}</p>
                        <p className="text-[11px] font-bold uppercase text-slate-500">{countLabel}</p>
                    </div>
                    <button type="button" onClick={onPlus} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><Plus className="h-4 w-4" /></button>
                </div>
                {max > 0 && <p className="mt-2 text-xs font-semibold text-slate-500">Maximum {max} per booking.</p>}
                <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-white/70">Estimated total</span>
                        <span className="text-xl font-black">TZS {Number(total || 0).toLocaleString()}</span>
                    </div>
                </div>
                <Button className="mt-4 h-12 w-full rounded-xl text-base font-black" disabled={!canSubmit} onClick={onSubmit}>
                    <Zap className="mr-2 h-5 w-5" />
                    {submitLabel}
                </Button>
            </section>
            <section className="rounded-2xl bg-sky-50 p-4 text-sky-950 ring-1 ring-sky-100">
                <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-black">Booking protected</p>
                        <p className="mt-1 text-sm text-sky-900/75">Confirm slot, location, and provider instructions before the appointment.</p>
                    </div>
                </div>
            </section>
        </aside>
    );
}

function MobileBar({ total, label, disabled, onSubmit }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-5xl items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-slate-500">Estimated total</p>
                    <p className="truncate text-lg font-black text-brand-700">TZS {Number(total || 0).toLocaleString()}</p>
                </div>
                <Button className="h-12 rounded-xl font-black" disabled={disabled} onClick={onSubmit}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    {label}
                </Button>
            </div>
        </div>
    );
}
