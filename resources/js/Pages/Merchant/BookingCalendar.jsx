import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { CalendarClock, ChevronRight, Clock, Loader2, MapPin, RefreshCw, Search, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { businessToolLabel } from '@/lib/businessToolCopy';

const MODULE_OPTIONS = [
    { value: 'all', label: 'Aina zote za huduma' },
    { value: 'rooms', label: businessToolLabel('rooms') },
    { value: 'appointments', label: businessToolLabel('appointments') },
    { value: 'reservations', label: businessToolLabel('reservations') },
    { value: 'rentals', label: businessToolLabel('rentals') },
    { value: 'workshops', label: businessToolLabel('workshops') },
    { value: 'tour_departures', label: businessToolLabel('tour_departures') },
    { value: 'custom_orders', label: businessToolLabel('custom_orders') },
    { value: 'services', label: businessToolLabel('services') },
];

const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'quoted', label: 'Quoted' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const todayInput = () => new Date().toISOString().slice(0, 10);
const futureInput = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
};

export default function BookingCalendar({ merchantUsername }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ summary: {}, events: [], unscheduled: [] });
    const [filters, setFilters] = useState({
        from: todayInput(),
        to: futureInput(30),
        status: 'all',
        module: 'all',
        q: '',
    });

    const loadCalendar = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            ['from', 'to', 'status', 'module'].forEach((key) => {
                if (filters[key]) params.set(key, filters[key]);
            });
            const response = await axios.get(`/merchant/${merchantUsername}/booking-calendar/api?${params.toString()}`);
            setData(response.data || { summary: {}, events: [], unscheduled: [] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load booking calendar.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCalendar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.from, filters.to, filters.status, filters.module]);

    const query = filters.q.trim().toLowerCase();
    const filteredEvents = useMemo(() => {
        const events = data.events || [];
        if (!query) return events;

        return events.filter((event) => [
            event.title,
            event.module_label,
            event.customer?.name,
            event.customer?.phone,
            event.product?.title,
            event.location_text,
        ].filter(Boolean).join(' ').toLowerCase().includes(query));
    }, [data.events, query]);

    const groupedEvents = useMemo(() => {
        return filteredEvents.reduce((groups, event) => {
            const key = event.starts_at ? event.starts_at.slice(0, 10) : 'unscheduled';
            groups[key] = groups[key] || [];
            groups[key].push(event);
            return groups;
        }, {});
    }, [filteredEvents]);

    const days = Object.keys(groupedEvents).sort();
    const unscheduled = (data.unscheduled || []).filter((event) => {
        if (!query) return true;
        return [event.title, event.customer?.name, event.customer?.phone, event.product?.title]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query);
    });

    return (
        <AppLayout>
            <Head title="Booking Calendar | Takeer" />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Operations</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Booking Calendar</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Maombi yaliyopangwa, sessions za tarehe maalum, capacity, na maombi ya wateja kwenye aina zako za huduma.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={loadCalendar} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                        <Button asChild>
                            <Link href={`/merchant/${merchantUsername}/services`}>
                                Service Requests
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                    <MetricCard icon={CalendarClock} label="Calendar events" value={data.summary?.events ?? 0} />
                    <MetricCard icon={Users} label="Requests" value={data.summary?.service_requests ?? 0} />
                    <MetricCard icon={Clock} label="Fixed sessions" value={data.summary?.sessions ?? 0} />
                    <MetricCard icon={Search} label="Unscheduled" value={data.summary?.unscheduled ?? 0} />
                </div>

                <Card>
                    <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_1fr_1.5fr]">
                        <Input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
                        <Input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
                        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.module} onChange={(e) => setFilters((prev) => ({ ...prev, module: e.target.value }))}>
                            {MODULE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Search customer, service, location..." value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} />
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <Card>
                        <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
                            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                            <p className="mt-3 text-sm text-muted-foreground">Loading booking calendar...</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                        <div className="space-y-4">
                            {days.length === 0 ? (
                                <Card>
                                    <CardContent className="p-8 text-center">
                                        <CalendarClock className="mx-auto h-9 w-9 text-muted-foreground" />
                                        <h3 className="mt-3 text-lg font-black">No scheduled bookings</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">Try another date range or create scheduled services with available sessions.</p>
                                    </CardContent>
                                </Card>
                            ) : days.map((day) => (
                                <Card key={day}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">{formatDay(day)}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {groupedEvents[day].map((event) => <CalendarEvent key={`${event.type}-${event.id}`} event={event} />)}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card className="h-fit">
                            <CardHeader>
                                <CardTitle className="text-base">Needs scheduling</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {unscheduled.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No unscheduled requests in this range.</p>
                                ) : unscheduled.map((event) => (
                                    <div key={`unscheduled-${event.id}`} className="rounded-lg border border-border p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold">{event.customer?.name || 'Customer'}</p>
                                                <p className="text-xs text-muted-foreground">{event.title}</p>
                                            </div>
                                            <StatusBadge status={event.status} />
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Preferred {event.preferred_date || 'date not set'}{event.preferred_time ? `, ${event.preferred_time}` : ''}
                                        </p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function MetricCard({ icon: Icon, label, value }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-2xl font-black">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function CalendarEvent({ event }) {
    return (
        <div className="rounded-lg border border-border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase text-muted-foreground">{event.module_label}</span>
                        <StatusBadge status={event.status} />
                    </div>
                    <h3 className="mt-2 text-base font-black">{event.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {event.type === 'service_session' ? 'Fixed session' : event.customer?.name || 'Customer request'}
                    </p>
                </div>
                <div className="text-left md:text-right">
                    <p className="text-sm font-bold">{formatTimeRange(event)}</p>
                    {event.capacity !== undefined && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {event.booked_count ?? 0}{event.capacity ? ` / ${event.capacity}` : ''} booked
                        </p>
                    )}
                </div>
            </div>

            {(event.location_text || event.customer?.phone || event.amount !== null) && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {event.location_text && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location_text}</span>}
                    {event.customer?.phone && <span>{event.customer.phone}</span>}
                    {event.amount !== null && <span>TZS {Number(event.amount).toLocaleString()}</span>}
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        pending: 'bg-amber-100 text-amber-700',
        contacted: 'bg-sky-100 text-sky-700',
        quoted: 'bg-violet-100 text-violet-700',
        confirmed: 'bg-emerald-100 text-emerald-700',
        completed: 'bg-slate-100 text-slate-700',
        cancelled: 'bg-red-100 text-red-700',
        open: 'bg-emerald-100 text-emerald-700',
        full: 'bg-amber-100 text-amber-700',
        closed: 'bg-slate-100 text-slate-700',
    };
    return <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${map[status] || 'bg-muted text-muted-foreground'}`}>{status || 'scheduled'}</span>;
}

function formatDay(day) {
    return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatTimeRange(event) {
    if (!event.starts_at) return 'Unscheduled';
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : null;
    const startText = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endText = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    return endText ? `${startText} - ${endText}` : startText;
}
