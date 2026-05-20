import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarClock,
    ChevronRight,
    Clock3,
    ConciergeBell,
    Minus,
    Plus,
    ShieldCheck,
    Sofa,
    Store,
    Users,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import ServiceRequestModal from './ServiceRequestModal';

export default function ReservationProductTemplate({ product }) {
    const [partySize, setPartySize] = useState(1);
    const [requestOpen, setRequestOpen] = useState(false);
    const details = product?.module_details || {};
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const image = product?.images?.[0]?.image_url || product?.images?.[0]?.thumbnail_url || product?.image_url;
    const price = Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const partyLimit = Number(details.party_size_limit || 0);
    const canReserve = partyLimit <= 0 || partySize <= partyLimit;
    const total = price > 0 ? price * partySize : 0;
    const reservationType = String(details.reservation_type || 'table').replace(/_/g, ' ');
    const policy = String(details.reservation_policy || 'manual_confirm').replace(/_/g, ' ');
    const depositAmount = Number(details.deposit_amount || 0);

    const openBooking = () => {
        if (!canReserve) return;
        setRequestOpen(true);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-[#fbfaf7] pb-28 text-slate-950">
                <section className="relative min-h-[420px] overflow-hidden bg-slate-950 text-white">
                    {image ? (
                        <img src={image} alt={product.title} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#f97316,#111827_58%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
                    <div className="relative z-10 mx-auto flex min-h-[420px] max-w-5xl flex-col justify-between p-4 md:p-8">
                        <button type="button" onClick={() => window.history.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50" aria-label="Go back">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="max-w-4xl">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                    <ConciergeBell className="h-3.5 w-3.5" />
                                    Reservation
                                </span>
                                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">{policy}</span>
                            </div>
                            <h1 className="text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                <span className="inline-flex items-center gap-1.5 capitalize"><Sofa className="h-4 w-4" />{reservationType}</span>
                                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{details.reservation_duration_minutes || 90} min</span>
                                {partyLimit > 0 && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />up to {partyLimit}</span>}
                            </div>
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">Reservation details</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'Reserve a spot and confirm timing with the business.'}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Stat icon={Sofa} label="Type" value={reservationType} />
                                <Stat icon={Users} label="Party size" value={partyLimit > 0 ? `Up to ${partyLimit}` : 'Open'} />
                                <Stat icon={Clock3} label="Duration" value={`${details.reservation_duration_minutes || 90} min`} />
                            </div>
                        </section>

                        {(depositAmount > 0 || details.deposit_note || details.reservation_notes) && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Policy notes</h2>
                                {depositAmount > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">Reservation deposit: TZS {depositAmount.toLocaleString()}</p>}
                                {!depositAmount && details.deposit_note && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">{details.deposit_note}</p>}
                                {details.reservation_notes && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{details.reservation_notes}</p>}
                            </section>
                        )}

                        {merchantSlug && <MerchantLink merchant={merchant} merchantSlug={merchantSlug} />}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">{price > 0 ? 'Per guest / deposit' : 'Reservation'}</p>
                            <p className="mt-1 text-3xl font-black text-brand-700">{price > 0 ? `TZS ${Number(price).toLocaleString()}` : 'Confirm request'}</p>
                            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                                <button type="button" onClick={() => setPartySize((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><Minus className="h-4 w-4" /></button>
                                <div className="text-center">
                                    <p className="text-lg font-black">{partySize}</p>
                                    <p className="text-[11px] font-bold uppercase text-slate-500">guests</p>
                                </div>
                                <button type="button" onClick={() => setPartySize((value) => Math.min(partyLimit || 100, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><Plus className="h-4 w-4" /></button>
                            </div>
                            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold text-white/70">Estimated total</span>
                                    <span className="text-xl font-black">{total > 0 ? `TZS ${Number(total).toLocaleString()}` : 'TBC'}</span>
                                </div>
                            </div>
                            <Button className="mt-4 h-12 w-full rounded-xl text-base font-black" disabled={!canReserve} onClick={openBooking}>
                                <Zap className="mr-2 h-5 w-5" />
                                {canReserve ? 'Request reservation' : 'Party too large'}
                            </Button>
                        </section>
                        <TrustNote />
                    </aside>
                </main>
                <MobileBar total={total} disabled={!canReserve} onSubmit={openBooking} />
                <ServiceRequestModal
                    product={product}
                    open={requestOpen}
                    onOpenChange={setRequestOpen}
                    requestType="reservation_request"
                    title="Request reservation"
                    submitLabel="Send reservation request"
                    modulePayload={{ reservation_party_size: partySize }}
                    messagePlaceholder="Add preferred date/time, guest count notes, seating needs, or occasion details..."
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

function MerchantLink({ merchant, merchantSlug }) {
    return (
        <Link href={`/m/${merchantSlug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100"><Store className="h-5 w-5 text-slate-600" /></div>
                <div>
                    <p className="font-black">{merchant?.display_name || 'Business'}</p>
                    <p className="text-sm text-slate-500">View more reservations</p>
                </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
        </Link>
    );
}

function TrustNote() {
    return (
        <section className="rounded-2xl bg-orange-50 p-4 text-orange-950 ring-1 ring-orange-100">
            <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                    <p className="font-black">Reservation protected</p>
                    <p className="mt-1 text-sm text-orange-900/75">Confirm date, arrival time, deposit, and cancellation rules with the business.</p>
                </div>
            </div>
        </section>
    );
}

function MobileBar({ total, disabled, onSubmit }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-5xl items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-slate-500">Estimated total</p>
                    <p className="truncate text-lg font-black text-brand-700">{total > 0 ? `TZS ${Number(total).toLocaleString()}` : 'TBC'}</p>
                </div>
                <Button className="h-12 rounded-xl font-black" disabled={disabled} onClick={onSubmit}>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Reserve
                </Button>
            </div>
        </div>
    );
}
