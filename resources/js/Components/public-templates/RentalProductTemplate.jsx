import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Minus,
    PackageCheck,
    Plus,
    ShieldCheck,
    Store,
    Truck,
    Users,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import ServiceRequestModal from './ServiceRequestModal';

const durationLabel = (minutes) => {
    const value = Number(minutes || 0);
    if (value >= 1440 && value % 1440 === 0) return `${value / 1440} day${value / 1440 === 1 ? '' : 's'}`;
    if (value >= 60 && value % 60 === 0) return `${value / 60} hour${value / 60 === 1 ? '' : 's'}`;
    return `${value || 0} min`;
};

export default function RentalProductTemplate({ product }) {
    const [units, setUnits] = useState(1);
    const [requestOpen, setRequestOpen] = useState(false);
    const details = product?.module_details || {};
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const image = product?.images?.[0]?.image_url || product?.images?.[0]?.thumbnail_url || product?.image_url;
    const pricePerUnit = Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const total = pricePerUnit * units;
    const availableUnits = Number(details.available_units || 1);
    const canRent = units <= availableUnits;
    const includedItems = Array.isArray(details.included_items) ? details.included_items : [];
    const rentalType = String(details.rental_type || 'equipment').replace(/_/g, ' ');
    const rentalUnit = String(details.rental_unit || 'day').replace(/_/g, ' ');

    const openBooking = () => {
        if (!canRent) return;
        setRequestOpen(true);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-slate-50 pb-28 text-slate-950">
                <section className="relative min-h-[440px] overflow-hidden bg-slate-950 text-white">
                    {image ? (
                        <img src={image} alt={product.title} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#14b8a6,#111827_58%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
                    <div className="relative z-10 mx-auto flex min-h-[440px] max-w-5xl flex-col justify-between p-4 md:p-8">
                        <button type="button" onClick={() => window.history.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50" aria-label="Go back">
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="max-w-4xl">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                    <Truck className="h-3.5 w-3.5" />
                                    Rental
                                </span>
                                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur capitalize">{rentalType}</span>
                            </div>
                            <h1 className="text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                <span className="inline-flex items-center gap-1.5 capitalize"><CalendarClock className="h-4 w-4" />per {rentalUnit}</span>
                                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{durationLabel(details.rental_duration_minutes || 1440)}</span>
                                <span className="inline-flex items-center gap-1.5"><PackageCheck className="h-4 w-4" />{availableUnits} available</span>
                            </div>
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">Rental details</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'Rent this item and confirm pickup, return, and usage terms with the business.'}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Stat icon={Truck} label="Type" value={rentalType} />
                                <Stat icon={CalendarClock} label="Unit" value={rentalUnit} />
                                <Stat icon={PackageCheck} label="Available" value={availableUnits} />
                            </div>
                        </section>

                        {(includedItems.length > 0 || details.rental_requirements) && (
                            <section className="grid gap-4 md:grid-cols-2">
                                {includedItems.length > 0 && (
                                    <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-950 shadow-sm ring-1 ring-emerald-100">
                                        <h2 className="text-lg font-black">Included</h2>
                                        <div className="mt-4 space-y-2">
                                            {includedItems.map((item, index) => (
                                                <div key={`${item}-${index}`} className="flex gap-2 text-sm font-semibold">
                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {details.rental_requirements && (
                                    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                        <h2 className="text-lg font-black">Requirements</h2>
                                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{details.rental_requirements}</p>
                                    </div>
                                )}
                            </section>
                        )}

                        {(details.security_deposit || details.pickup_return_notes) && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Pickup and return</h2>
                                {details.security_deposit && (
                                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-950">
                                        Security deposit: TZS {Number(details.security_deposit || 0).toLocaleString()}
                                    </p>
                                )}
                                {details.pickup_return_notes && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{details.pickup_return_notes}</p>}
                            </section>
                        )}

                        {merchantSlug && (
                            <Link href={`/m/${merchantSlug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100"><Store className="h-5 w-5 text-slate-600" /></div>
                                    <div>
                                        <p className="font-black">{merchant?.display_name || 'Rental provider'}</p>
                                        <p className="text-sm text-slate-500">View more rentals</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </Link>
                        )}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Per {rentalUnit}</p>
                            <p className="mt-1 text-3xl font-black text-brand-700">TZS {Number(pricePerUnit || 0).toLocaleString()}</p>
                            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                                <button type="button" onClick={() => setUnits((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><Minus className="h-4 w-4" /></button>
                                <div className="text-center">
                                    <p className="text-lg font-black">{units}</p>
                                    <p className="text-[11px] font-bold uppercase text-slate-500">units</p>
                                </div>
                                <button type="button" onClick={() => setUnits((value) => Math.min(availableUnits || 100, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm"><Plus className="h-4 w-4" /></button>
                            </div>
                            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold text-white/70">Estimated total</span>
                                    <span className="text-xl font-black">TZS {Number(total || 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <Button className="mt-4 h-12 w-full rounded-xl text-base font-black" disabled={!canRent} onClick={openBooking}>
                                <Zap className="mr-2 h-5 w-5" />
                                {canRent ? 'Request rental' : 'Not enough units'}
                            </Button>
                        </section>
                        <section className="rounded-2xl bg-teal-50 p-4 text-teal-950 ring-1 ring-teal-100">
                            <div className="flex gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">Rental protected</p>
                                    <p className="mt-1 text-sm text-teal-900/75">Confirm availability, deposit, inspection, pickup and return rules before payment.</p>
                                </div>
                            </div>
                        </section>
                    </aside>
                </main>

                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
                    <div className="mx-auto flex max-w-5xl items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase text-slate-500">Estimated total</p>
                            <p className="truncate text-lg font-black text-brand-700">TZS {Number(total || 0).toLocaleString()}</p>
                        </div>
                        <Button className="h-12 rounded-xl font-black" disabled={!canRent} onClick={openBooking}>
                            <CalendarClock className="mr-2 h-4 w-4" />
                            Rent
                        </Button>
                    </div>
                </div>
                <ServiceRequestModal
                    product={product}
                    open={requestOpen}
                    onOpenChange={setRequestOpen}
                    requestType="rental_request"
                    title="Request rental"
                    submitLabel="Send rental request"
                    modulePayload={{ rental_units: units }}
                    messagePlaceholder="Add rental dates, pickup/return needs, intended use, or deposit questions..."
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
