import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    BookOpenCheck,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    Clock3,
    MapPin,
    Minus,
    Plus,
    Presentation,
    ShieldCheck,
    Store,
    Users,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import ServiceRequestModal from './ServiceRequestModal';

export default function WorkshopProductTemplate({ product }) {
    const [seats, setSeats] = useState(1);
    const [requestOpen, setRequestOpen] = useState(false);
    const details = product?.module_details || product?.service_details || {};
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const images = product?.images || [];
    const heroImage = images[0]?.image_url || images[0]?.thumbnail_url || product?.image_url;
    const pricePerSeat = Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const total = pricePerSeat * seats;
    const capacity = Number(details.workshop_capacity || 0);
    const canBook = capacity <= 0 || seats <= capacity;
    const outcomes = Array.isArray(details.learning_outcomes) ? details.learning_outcomes : [];
    const requirements = Array.isArray(details.workshop_requirements) ? details.workshop_requirements : [];
    const materials = Array.isArray(details.materials_included) ? details.materials_included : [];
    const formatLabel = String(details.workshop_format || 'live_session').replace(/_/g, ' ');
    const locationLabel = String(details.workshop_location_mode || product?.service_location_type || 'provider_location').replace(/_/g, ' ');

    const openBooking = () => {
        if (!canBook) return;
        setRequestOpen(true);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-[#f8fafc] pb-28 text-slate-950">
                <section className="relative min-h-[440px] overflow-hidden bg-slate-950 text-white">
                    {heroImage ? (
                        <img src={heroImage} alt={product.title} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#f59e0b,#111827_58%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
                    <div className="relative z-10 mx-auto flex min-h-[440px] max-w-5xl flex-col justify-between p-4 md:p-8">
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="max-w-4xl">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                    <Presentation className="h-3.5 w-3.5" />
                                    Workshop
                                </span>
                                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">{formatLabel}</span>
                            </div>
                            <h1 className="text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                {details.workshop_duration_minutes && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{details.workshop_duration_minutes} min</span>}
                                {details.session_count && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />{details.session_count} session{Number(details.session_count) === 1 ? '' : 's'}</span>}
                                {capacity > 0 && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{capacity} seats</span>}
                                <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{locationLabel}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">About this workshop</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'A practical training session managed by the merchant.'}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Stat icon={Presentation} label="Format" value={formatLabel} />
                                <Stat icon={BookOpenCheck} label="Level" value={details.workshop_level || 'All levels'} />
                                <Stat icon={Users} label="Capacity" value={capacity > 0 ? `${capacity} seats` : 'Open'} />
                            </div>
                        </section>

                        {(outcomes.length > 0 || materials.length > 0) && (
                            <section className="grid gap-4 md:grid-cols-2">
                                {outcomes.length > 0 && <ListBlock title="What you will learn" items={outcomes} tone="emerald" />}
                                {materials.length > 0 && <ListBlock title="Materials included" items={materials} tone="amber" />}
                            </section>
                        )}

                        {(details.workshop_start_note || requirements.length > 0) && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Enrollment details</h2>
                                {details.workshop_start_note && (
                                    <div className="mt-4 rounded-xl bg-indigo-50 p-4 text-indigo-950">
                                        <p className="text-xs font-black uppercase tracking-wide text-indigo-700">Starts</p>
                                        <p className="mt-1 font-black">{details.workshop_start_note}</p>
                                    </div>
                                )}
                                {requirements.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {requirements.map((requirement, index) => (
                                            <div key={`${requirement}-${index}`} className="flex gap-2 text-sm font-semibold text-slate-700">
                                                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                                <span>{requirement}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {merchantSlug && (
                            <Link href={`/m/${merchantSlug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                                        <Store className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="font-black">{merchant?.display_name || 'Training provider'}</p>
                                        <p className="text-sm text-slate-500">View more sessions from this business</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </Link>
                        )}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Per seat</p>
                            <p className="mt-1 text-3xl font-black text-brand-700">TZS {Number(pricePerSeat || 0).toLocaleString()}</p>
                            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                                <button type="button" onClick={() => setSeats((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Minus className="h-4 w-4" />
                                </button>
                                <div className="text-center">
                                    <p className="text-lg font-black">{seats}</p>
                                    <p className="text-[11px] font-bold uppercase text-slate-500">{seats === 1 ? 'seat' : 'seats'}</p>
                                </div>
                                <button type="button" onClick={() => setSeats((value) => Math.min(capacity || 100, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold text-white/70">Estimated total</span>
                                    <span className="text-xl font-black">TZS {Number(total || 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <Button className="mt-4 h-12 w-full rounded-xl text-base font-black" disabled={!canBook} onClick={openBooking}>
                                <Zap className="mr-2 h-5 w-5" />
                                {canBook ? 'Request enrollment' : 'Class full'}
                            </Button>
                        </section>

                        <section className="rounded-2xl bg-amber-50 p-4 text-amber-950 ring-1 ring-amber-100">
                            <div className="flex gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">Enrollment protected</p>
                                    <p className="mt-1 text-sm text-amber-900/75">Confirm dates, venue, materials, and attendance requirements before the session starts.</p>
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
                        <Button className="h-12 rounded-xl font-black" disabled={!canBook} onClick={openBooking}>
                            <CalendarClock className="mr-2 h-4 w-4" />
                            Enroll
                        </Button>
                    </div>
                </div>
                <ServiceRequestModal
                    product={product}
                    open={requestOpen}
                    onOpenChange={setRequestOpen}
                    requestType="workshop_enrollment_request"
                    title="Request enrollment"
                    submitLabel="Send enrollment request"
                    modulePayload={{ workshop_seats: seats }}
                    messagePlaceholder="Add attendee names, preferred cohort, learning goals, or access needs..."
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

function ListBlock({ title, items, tone }) {
    const className = tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-950 ring-emerald-100'
        : 'bg-amber-50 text-amber-950 ring-amber-100';

    return (
        <section className={`rounded-2xl p-5 shadow-sm ring-1 ${className}`}>
            <h2 className="text-lg font-black">{title}</h2>
            <div className="mt-4 space-y-2">
                {items.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex gap-2 text-sm font-semibold">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
