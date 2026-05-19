import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Flag,
    MapPin,
    Minus,
    Navigation,
    Plus,
    Route,
    ShieldCheck,
    Store,
    Users,
    XCircle,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import ServiceRequestModal from './ServiceRequestModal';

export default function TourProductTemplate({ product }) {
    const [guests, setGuests] = useState(1);
    const [requestOpen, setRequestOpen] = useState(false);
    const details = product?.module_details || {};
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const images = product?.images || [];
    const heroImage = images[0]?.image_url || images[0]?.thumbnail_url || product?.image_url;
    const gallery = images.slice(1, 5).map((item) => item.image_url || item.thumbnail_url).filter(Boolean);
    const pricePerGuest = Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const total = pricePerGuest * guests;
    const itinerary = Array.isArray(details.itinerary) ? details.itinerary : [];
    const included = Array.isArray(details.included) ? details.included : [];
    const excluded = Array.isArray(details.excluded) ? details.excluded : [];
    const seats = Number(details.group_size || 0);
    const canBook = seats <= 0 || guests <= seats;

    const openBooking = () => {
        if (!canBook) return;
        setRequestOpen(true);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-[#f8fafc] pb-28 text-slate-950">
                <section className="relative min-h-[480px] overflow-hidden bg-slate-950 text-white">
                    {heroImage ? (
                        <img src={heroImage} alt={product.title} className="absolute inset-0 h-full w-full object-cover opacity-90" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#14b8a6,#0f172a_58%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
                    <div className="relative z-10 mx-auto flex min-h-[480px] max-w-6xl flex-col justify-between p-4 md:p-8">
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:items-end">
                            <div>
                                <div className="mb-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                        <Route className="h-3.5 w-3.5" />
                                        Tour
                                    </span>
                                    {details.departure_type && (
                                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                            {String(details.departure_type).replace(/_/g, ' ')}
                                        </span>
                                    )}
                                </div>
                                <h1 className="max-w-4xl text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                                <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                    {details.destination && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{details.destination}</span>}
                                    {details.duration_label && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{details.duration_label}</span>}
                                    {details.group_size && <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{details.group_size} seats</span>}
                                </div>
                            </div>

                            {gallery.length > 0 && (
                                <div className="hidden grid-cols-2 gap-2 md:grid">
                                    {gallery.slice(0, 4).map((src, index) => (
                                        <div key={`${src}-${index}`} className="h-28 overflow-hidden rounded-xl bg-white/10">
                                            <img src={src} alt="" className="h-full w-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-6xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">About this tour</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'A guided travel experience managed by the merchant.'}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Stat icon={MapPin} label="Destination" value={details.destination || 'TBA'} />
                                <Stat icon={Clock3} label="Duration" value={details.duration_label || 'Flexible'} />
                                <Stat icon={Users} label="Group" value={details.group_size ? `${details.group_size} seats` : 'Open'} />
                            </div>
                        </section>

                        {(details.pickup_point || details.dropoff_point) && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Route points</h2>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    {details.pickup_point && <Point icon={Navigation} label="Pickup" value={details.pickup_point} />}
                                    {details.dropoff_point && <Point icon={Flag} label="Drop-off" value={details.dropoff_point} />}
                                </div>
                            </section>
                        )}

                        {itinerary.length > 0 && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Itinerary</h2>
                                <div className="mt-5 space-y-4">
                                    {itinerary.map((day, index) => (
                                        <div key={`${day.day}-${index}`} className="relative pl-10">
                                            <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">
                                                {day.day || index + 1}
                                            </div>
                                            {index < itinerary.length - 1 && <div className="absolute bottom-[-18px] left-4 top-8 w-px bg-slate-200" />}
                                            <p className="font-black">{day.title || `Day ${day.day || index + 1}`}</p>
                                            {day.description && <p className="mt-1 text-sm leading-6 text-slate-600">{day.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {(included.length > 0 || excluded.length > 0) && (
                            <section className="grid gap-4 md:grid-cols-2">
                                {included.length > 0 && (
                                    <ListBlock icon={CheckCircle2} title="Included" items={included} tone="emerald" />
                                )}
                                {excluded.length > 0 && (
                                    <ListBlock icon={XCircle} title="Not included" items={excluded} tone="slate" />
                                )}
                            </section>
                        )}

                        {details.requirements && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Requirements</h2>
                                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{details.requirements}</p>
                            </section>
                        )}

                        {merchantSlug && (
                            <Link href={`/m/${merchantSlug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                                        <Store className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="font-black">{merchant?.display_name || 'Tour operator'}</p>
                                        <p className="text-sm text-slate-500">View more trips from this business</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </Link>
                        )}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Per guest</p>
                            <p className="mt-1 text-3xl font-black text-brand-700">TZS {Number(pricePerGuest || 0).toLocaleString()}</p>

                            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                                <button type="button" onClick={() => setGuests((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Minus className="h-4 w-4" />
                                </button>
                                <div className="text-center">
                                    <p className="text-lg font-black">{guests}</p>
                                    <p className="text-[11px] font-bold uppercase text-slate-500">{guests === 1 ? 'guest' : 'guests'}</p>
                                </div>
                                <button type="button" onClick={() => setGuests((value) => Math.min(seats || 100, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
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
                                {canBook ? 'Request booking' : 'Group full'}
                            </Button>
                        </section>

                        <section className="rounded-2xl bg-teal-50 p-4 text-teal-950 ring-1 ring-teal-100">
                            <div className="flex gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">Trip details verified at booking</p>
                                    <p className="mt-1 text-sm text-teal-900/75">Confirm dates, pickup point, group size, and payment terms with the operator before departure.</p>
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
                            Book
                        </Button>
                    </div>
                </div>
                <ServiceRequestModal
                    product={product}
                    open={requestOpen}
                    onOpenChange={setRequestOpen}
                    requestType="tour_booking_request"
                    title="Request tour"
                    submitLabel="Send tour request"
                    modulePayload={{ tour_guests: guests }}
                    messagePlaceholder="Add travel dates, pickup needs, traveler notes, or package questions..."
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
            <p className="text-base font-black">{value}</p>
        </div>
    );
}

function Point({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl bg-slate-50 p-4">
            <Icon className="h-5 w-5 text-slate-500" />
            <p className="mt-2 text-xs font-bold uppercase text-slate-500">{label}</p>
            <p className="font-black">{value}</p>
        </div>
    );
}

function ListBlock({ icon: Icon, title, items, tone }) {
    const toneClass = tone === 'emerald' ? 'bg-emerald-50 text-emerald-950 ring-emerald-100' : 'bg-white text-slate-950 ring-black/5';
    const iconClass = tone === 'emerald' ? 'text-emerald-700' : 'text-slate-500';

    return (
        <section className={`rounded-2xl p-5 shadow-sm ring-1 ${toneClass}`}>
            <h2 className="text-lg font-black">{title}</h2>
            <div className="mt-4 space-y-2">
                {items.map((item) => (
                    <div key={item} className="flex gap-2 text-sm font-semibold">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                        <span>{item}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
