import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    Clock,
    Crown,
    DownloadCloud,
    KeyRound,
    Library,
    Loader2,
    MessageCircle,
    ReceiptText,
    RefreshCcw,
    ShieldCheck,
    Smile,
    ShoppingBag,
    Sparkles,
    Star,
    Truck,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function MerchantPulse({ merchant }) {
    const [events, setEvents] = useState([]);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [perPage, setPerPage] = useState(12);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPulse();
    }, [page, perPage]);

    async function loadPulse() {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchant.username}/pulse/api`, {
                params: { page, per_page: perPage },
            });
            setEvents(res.data?.events || []);
            setMeta(res.data?.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            toast.error('Imeshindwa kupakia merchant Pulse.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <AppLayout>
            <Head title={`Pulse | ${merchant.display_name || merchant.username}`} />
            <div className="mx-auto max-w-5xl p-4 pb-24 md:p-8">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-700">
                                <Clock className="h-4 w-4" />
                                Merchant Pulse
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                                Everything happening across {merchant.display_name || merchant.username}.
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                                Order starts, quote changes, payment updates, delivery movement, customer reviews, and other status changes appear here as a business activity stream.
                            </p>
                        </div>
                        <select
                            value={perPage}
                            onChange={(event) => {
                                setPerPage(Number(event.target.value));
                                setPage(1);
                            }}
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
                        >
                            <option value={8}>8 / page</option>
                            <option value={12}>12 / page</option>
                            <option value={24}>24 / page</option>
                        </select>
                    </div>
                </section>

                <section className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    {loading ? (
                        <div className="flex items-center justify-center gap-3 p-10 text-sm font-bold text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                            Loading Pulse...
                        </div>
                    ) : events.length === 0 ? (
                        <div className="p-10 text-center">
                            <Library className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-3 text-lg font-black text-slate-900">No business pulse yet</p>
                            <p className="mt-1 text-sm font-semibold text-slate-500">Important merchant activity will appear here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {events.map((event) => (
                                <PulseRow key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </section>

                {(meta.total || 0) > 0 && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-500">
                            Showing {events.length} of {meta.total || 0} updates · Page {meta.current_page || 1} / {meta.last_page || 1}
                        </p>
                        {(meta.last_page || 1) > 1 && (
                            <div className="flex gap-2">
                                <Button variant="outline" className="rounded-xl" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                                <Button variant="outline" className="rounded-xl" disabled={page >= (meta.last_page || 1) || loading} onClick={() => setPage((p) => Math.min(meta.last_page || 1, p + 1))}>Next</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function PulseRow({ event }) {
    const iconMap = {
        alert: AlertTriangle,
        calendar: CalendarClock,
        check: CheckCircle2,
        crown: Crown,
        download: DownloadCloud,
        key: KeyRound,
        library: Library,
        message_circle: MessageCircle,
        receipt: ReceiptText,
        refresh: RefreshCcw,
        shield_check: ShieldCheck,
        smile: Smile,
        shopping_bag: ShoppingBag,
        sparkles: Sparkles,
        star: Star,
        truck: Truck,
    };
    const Icon = iconMap[event.icon] || Clock;
    const tone = {
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
        sky: 'bg-sky-50 text-sky-700 border-sky-100',
        violet: 'bg-violet-50 text-violet-700 border-violet-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
    }[event.tone] || 'bg-slate-50 text-slate-600 border-slate-100';

    const isReview = event.event_type === 'merchant_review_created';
    const rating = Number(event.payload?.rating || 0);
    const earned = event.payload?.earned ? formatMoney(event.payload.earned, event.payload.currency || 'TZS') : null;

    return (
        <div
            className={`grid gap-3 p-4 md:grid-cols-[auto_1fr_auto] md:items-start md:p-5 ${event.href ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            onClick={() => event.href && router.visit(event.href)}
        >
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tone}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">{event.eyebrow}</p>
                    {event.status && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {String(event.status).replaceAll('_', ' ')}
                        </span>
                    )}
                </div>
                <h2 className="mt-1 text-base font-black leading-snug text-slate-950">{event.title}</h2>
                {isReview && rating > 0 && (
                    <div className="mt-2 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <Star key={index} className={`h-4 w-4 ${index < rating ? 'fill-amber-500 text-amber-500' : 'text-amber-100'}`} />
                        ))}
                    </div>
                )}
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{event.body}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">
                    {[event.meta, formatDate(event.date)].filter(Boolean).join(' · ')}
                </p>
            </div>
            {earned && (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-left md:text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Earned</p>
                    <p className="mt-1 whitespace-nowrap text-lg font-black text-slate-950">{earned}</p>
                </div>
            )}
        </div>
    );
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatMoney(value, currency) {
    const amount = Number(value || 0);
    return `${currency} ${amount.toLocaleString()}`;
}
