import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    Bath,
    BedDouble,
    CalendarClock,
    ChevronRight,
    Clock3,
    DoorOpen,
    Home,
    MapPin,
    Minus,
    Plus,
    ShieldCheck,
    Store,
    Users,
    Wifi,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { cn } from '@/lib/utils';
import ServiceRequestModal from './ServiceRequestModal';

const amenityLabels = {
    wifi: 'Wi-Fi',
    breakfast: 'Breakfast',
    air_conditioning: 'Air conditioning',
    parking: 'Parking',
    pool: 'Pool',
    tv: 'TV',
    kitchen: 'Kitchen',
    laundry: 'Laundry',
    workspace: 'Workspace',
    hot_water: 'Hot water',
    security: 'Security',
    balcony: 'Balcony',
};

export default function RoomProductTemplate({ product }) {
    const [nights, setNights] = useState(1);
    const [requestOpen, setRequestOpen] = useState(false);
    const details = product?.module_details || {};
    const serviceOptions = Array.isArray(product?.service_options) ? product.service_options : [];
    const [selectedOptionId, setSelectedOptionId] = useState('');
    const selectedOption = serviceOptions.find((option) => String(option.id) === String(selectedOptionId)) || serviceOptions[0] || null;
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const images = product?.images || [];
    const heroImage = images[0]?.image_url || images[0]?.thumbnail_url || product?.image_url;
    const gallery = images.slice(1, 5).map((item) => item.image_url || item.thumbnail_url).filter(Boolean);
    const baseNightlyPrice = selectedOption?.price !== null && selectedOption?.price !== undefined && selectedOption?.price !== ''
        ? Number(selectedOption.price || 0)
        : Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const total = baseNightlyPrice * nights;
    const available = !(details.availability || []).includes('occupied') && !(details.availability || []).includes('maintenance');
    const amenities = Array.isArray(details.amenities) ? details.amenities : [];
    const location = product?.service_provider_location || {};

    const openBooking = () => {
        if (!available) return;
        setRequestOpen(true);
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-slate-50 pb-28 text-slate-950">
                <section className="relative bg-slate-950 text-white">
                    <div className="grid min-h-[420px] md:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="relative min-h-[420px] overflow-hidden">
                            {heroImage ? (
                                <img src={heroImage} alt={product.title} className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#38bdf8,#0f172a_55%)]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/20" />
                            <button
                                type="button"
                                onClick={() => window.history.back()}
                                className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50"
                                aria-label="Go back"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-8">
                                <div className="mb-3 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                        <BedDouble className="h-3.5 w-3.5" />
                                        {details.room_type || 'Room'}
                                    </span>
                                    {available ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-black uppercase tracking-wide">
                                            <BadgeCheck className="h-3.5 w-3.5" />
                                            Available
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-amber-500/90 px-3 py-1 text-xs font-black uppercase tracking-wide">
                                            Not available
                                        </span>
                                    )}
                                </div>
                                <h1 className="max-w-3xl text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                                <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-white/90">
                                    <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />Up to {details.max_guests || 2} guests</span>
                                    <span className="inline-flex items-center gap-1.5"><BedDouble className="h-4 w-4" />{details.bed_type || 'Bed'}</span>
                                    {details.bathrooms !== null && details.bathrooms !== undefined && <span className="inline-flex items-center gap-1.5"><Bath className="h-4 w-4" />{details.bathrooms} bath</span>}
                                </div>
                            </div>
                        </div>
                        <div className="hidden grid-rows-2 gap-2 bg-slate-900 p-2 md:grid">
                            {(gallery.length ? gallery : [heroImage, heroImage, heroImage, heroImage]).slice(0, 4).map((src, index) => (
                                <div key={`${src}-${index}`} className="overflow-hidden rounded-xl bg-slate-800">
                                    {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Home className="mx-auto mt-20 h-8 w-8 text-slate-600" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <main className="mx-auto grid max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_380px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">About this stay</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'Comfortable stay managed by the merchant.'}</p>
                            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                <Stat icon={Users} label="Guests" value={details.max_guests || 2} />
                                <Stat icon={DoorOpen} label="Rooms" value={details.room_count || 1} />
                                <Stat icon={Bath} label="Bathrooms" value={details.bathrooms ?? 'N/A'} />
                            </div>
                        </section>

                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <h2 className="text-lg font-black">Check-in details</h2>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl bg-slate-50 p-4">
                                    <Clock3 className="h-5 w-5 text-slate-500" />
                                    <p className="mt-2 text-xs font-bold uppercase text-slate-500">Check-in</p>
                                    <p className="text-xl font-black">{details.checkin_time || '14:00'}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-4">
                                    <Clock3 className="h-5 w-5 text-slate-500" />
                                    <p className="mt-2 text-xs font-bold uppercase text-slate-500">Check-out</p>
                                    <p className="text-xl font-black">{details.checkout_time || '10:00'}</p>
                                </div>
                            </div>
                        </section>

                        {amenities.length > 0 && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Amenities</h2>
                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    {amenities.map((amenity) => (
                                        <div key={amenity} className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-900">
                                            <Wifi className="h-4 w-4" />
                                            {amenityLabels[amenity] || String(amenity).replace(/_/g, ' ')}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {(location.address || merchantSlug) && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-lg font-black">Hosted by</h2>
                                <Link href={merchantSlug ? `/m/${merchantSlug}` : '#'} className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 transition hover:bg-brand-50">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                                            <Store className="h-5 w-5 text-slate-600" />
                                        </div>
                                        <div>
                                            <p className="font-black">{merchant?.display_name || 'Host'}</p>
                                            {location.address && <p className="text-sm text-slate-500">{location.address}</p>}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-400" />
                                </Link>
                            </section>
                        )}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Nightly rate</p>
                            <p className="mt-1 text-3xl font-black text-brand-700">TZS {Number(baseNightlyPrice || 0).toLocaleString()}</p>
                            {serviceOptions.length > 0 && (
                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Room option</p>
                                    {serviceOptions.map((option) => {
                                        const selected = String(selectedOption?.id || '') === String(option.id);
                                        return (
                                            <button
                                                key={option.id || option.name}
                                                type="button"
                                                onClick={() => setSelectedOptionId(String(option.id || ''))}
                                                className={cn(
                                                    'w-full rounded-xl border px-3 py-2 text-left transition',
                                                    selected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-black">{option.name || 'Room option'}</p>
                                                        {option.max_guests && <p className="text-xs text-slate-500">Up to {option.max_guests} guests</p>}
                                                    </div>
                                                    <p className="font-black text-brand-700">TZS {Number(option.price || 0).toLocaleString()}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                                <button type="button" onClick={() => setNights((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Minus className="h-4 w-4" />
                                </button>
                                <div className="text-center">
                                    <p className="text-lg font-black">{nights}</p>
                                    <p className="text-[11px] font-bold uppercase text-slate-500">{nights === 1 ? 'night' : 'nights'}</p>
                                </div>
                                <button type="button" onClick={() => setNights((value) => Math.min(60, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold text-white/70">Estimated total</span>
                                    <span className="text-xl font-black">TZS {Number(total || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <Button className="mt-4 h-12 w-full rounded-xl text-base font-black" disabled={!available} onClick={openBooking}>
                                <Zap className="mr-2 h-5 w-5" />
                                {available ? 'Request booking' : 'Not available'}
                            </Button>
                        </section>

                        <section className="rounded-2xl bg-sky-50 p-4 text-sky-950 ring-1 ring-sky-100">
                            <div className="flex gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">Booking protected</p>
                                    <p className="mt-1 text-sm text-sky-900/75">Confirm dates, room availability, and arrival details with the host before payment or check-in.</p>
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
                        <Button className="h-12 rounded-xl font-black" disabled={!available} onClick={openBooking}>
                            <CalendarClock className="mr-2 h-4 w-4" />
                            Book
                        </Button>
                    </div>
                </div>
                <ServiceRequestModal
                    product={product}
                    open={requestOpen}
                    onOpenChange={setRequestOpen}
                    requestType="room_booking_request"
                    title="Request stay"
                    submitLabel="Send booking request"
                    modulePayload={{
                        stay_nights: nights,
                        selected_service_option_id: selectedOption?.id || null,
                    }}
                    messagePlaceholder="Add check-in date, guest names, arrival time, or room preferences..."
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
            <p className="text-xl font-black">{value}</p>
        </div>
    );
}
