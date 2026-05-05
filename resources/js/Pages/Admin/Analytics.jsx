import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { BarChart3, Search, ShoppingCart, TrendingUp, Users, MousePointerClick, Route, Filter } from 'lucide-react';
import { toast } from 'sonner';

const money = (value) => `TSh ${Number(value || 0).toLocaleString()}`;

export default function AdminAnalytics() {
    const [data, setData] = useState(null);
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [eventFilters, setEventFilters] = useState({ event_type: '', q: '' });
    const [events, setEvents] = useState(null);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [journey, setJourney] = useState(null);
    const [journeyLoading, setJourneyLoading] = useState(false);
    const [cohorts, setCohorts] = useState(null);
    const [cohortsLoading, setCohortsLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/admin/api/analytics?days=${days}`, { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Failed to load analytics.');
                return payload;
            })
            .then(setData)
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, [days]);

    useEffect(() => {
        setCohortsLoading(true);
        fetch(`/admin/api/analytics/cohorts?days=${Math.max(days, 90)}`, { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Failed to load cohort analytics.');
                return payload;
            })
            .then(setCohorts)
            .catch((error) => toast.error(error.message))
            .finally(() => setCohortsLoading(false));
    }, [days]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setEventsLoading(true);
            const params = new URLSearchParams({
                per_page: '25',
                ...(eventFilters.event_type ? { event_type: eventFilters.event_type } : {}),
                ...(eventFilters.q ? { q: eventFilters.q } : {}),
            });

            fetch(`/admin/api/analytics/events?${params.toString()}`, { headers: { Accept: 'application/json' } })
                .then(async (response) => {
                    const payload = await response.json();
                    if (!response.ok) throw new Error(payload.message || 'Failed to load events.');
                    return payload;
                })
                .then(setEvents)
                .catch((error) => toast.error(error.message))
                .finally(() => setEventsLoading(false));
        }, 250);

        return () => clearTimeout(timeout);
    }, [eventFilters.event_type, eventFilters.q]);

    const inspectJourney = (event) => {
        setJourneyLoading(true);
        const params = new URLSearchParams({
            event_id: String(event.id),
            days: String(days),
        });
        fetch(`/admin/api/analytics/journey?${params.toString()}`, { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Failed to load journey.');
                return payload;
            })
            .then(setJourney)
            .catch((error) => toast.error(error.message))
            .finally(() => setJourneyLoading(false));
    };

    const summary = data?.summary || {};
    const exportUrl = (report, extra = {}) => {
        const params = new URLSearchParams({
            days: String(report === 'cohorts' ? Math.max(days, 90) : days),
            ...extra,
        });
        return `/admin/api/analytics/export/${report}.csv?${params.toString()}`;
    };

    return (
        <AdminLayout title="Platform Analytics">
            <Head title="Platform Analytics | Takeer" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">User behavior analytics</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Understand what users view, search, click, and buy across Takeer.
                        </p>
                    </div>
                    <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                        {[7, 30, 90].map((option) => (
                            <Button
                                key={option}
                                type="button"
                                size="sm"
                                variant={days === option ? 'default' : 'ghost'}
                                onClick={() => setDays(option)}
                                className="rounded-lg"
                            >
                                {option}d
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                    <Metric icon={BarChart3} label="Events" value={summary.events} loading={loading} />
                    <Metric icon={Users} label="Known users" value={summary.known_users} loading={loading} />
                    <Metric icon={MousePointerClick} label="Anonymous sessions" value={summary.anonymous_sessions} loading={loading} />
                    <Metric icon={Search} label="Searches" value={summary.searches} loading={loading} />
                    <Metric icon={ShoppingCart} label="Paid orders" value={summary.paid_orders} loading={loading} />
                    <Metric icon={TrendingUp} label="GMV" value={money(summary.gmv)} loading={loading} />
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <SectionTitle title="CSV exports" subtitle="Download analytics reports for spreadsheets, board reporting, or deeper investigation." />
                            <div className="flex flex-wrap gap-2">
                                {[
                                    ['event-breakdown', 'Events'],
                                    ['sources', 'Sources'],
                                    ['searches', 'Searches'],
                                    ['products', 'Products'],
                                    ['merchants', 'Merchants'],
                                    ['cohorts', 'Cohorts'],
                                ].map(([report, label]) => (
                                    <a
                                        key={report}
                                        href={exportUrl(report)}
                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-white"
                                    >
                                        {label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-5">
                            <SectionTitle title="Conversion funnel" subtitle="How product interest becomes checkout activity." />
                            <div className="mt-4 space-y-3">
                                {(data?.funnels || []).map((funnel) => (
                                    <div key={funnel.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-slate-900">{funnel.label}</p>
                                            <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-black text-brand-700">
                                                {Number(funnel.rate || 0).toLocaleString()}%
                                            </span>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                                            <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(Number(funnel.rate || 0), 100)}%` }} />
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">
                                            {Number(funnel.from || 0).toLocaleString()} started · {Number(funnel.to || 0).toLocaleString()} completed
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-5">
                            <SectionTitle title="Traffic and sales sources" subtitle="Which entry points are driving checkouts." />
                            <Table
                                columns={['Source', 'Starts', 'Sales', 'Rate', 'Revenue']}
                                rows={(data?.top_sources || []).map((row) => [
                                    row.source || 'direct',
                                    row.starts,
                                    row.conversions,
                                    `${row.conversion_rate}%`,
                                    money(row.revenue),
                                ])}
                                empty="No source data yet."
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-5">
                            <SectionTitle title="Top searches" subtitle="What buyers are trying to find." />
                            <List rows={(data?.search_terms || []).map((row) => [`"${row.query}"`, `${row.count} searches`])} empty="No searches tracked yet." />
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-5">
                            <SectionTitle title="Top products" subtitle="Most viewed products and their sales." />
                            <List rows={(data?.top_products || []).map((row) => [row.title, `${row.views} views · ${row.orders} orders · ${money(row.revenue)}`])} empty="No product views yet." />
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-5">
                            <SectionTitle title="Top merchants" subtitle="Merchant profiles with the most activity." />
                            <List rows={(data?.top_merchants || []).map((row) => [row.name, `${row.events} events · ${row.orders} orders · ${money(row.revenue)}`])} empty="No merchant activity yet." />
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <SectionTitle title="Retention and activation" subtitle="Understand whether new users return, buyers repeat, and creators reach monetization." />
                            {cohorts?.settings && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                    Retention: <span className="font-black">{cohorts.settings.retention_days} days</span>
                                    <span className="mx-2">·</span>
                                    Admins: <span className="font-black">{cohorts.settings.exclude_admins ? 'excluded' : 'included'}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <MiniStat label="Repeat buyer rate" value={cohortsLoading ? '-' : `${cohorts?.buyer_retention?.repeat_rate || 0}%`} />
                            <MiniStat label="Buyer revenue" value={cohortsLoading ? '-' : money(cohorts?.buyer_retention?.revenue)} />
                            <MiniStat label="Creator sales activation" value={cohortsLoading ? '-' : `${cohorts?.creator_activation?.sales_activation_rate || 0}%`} />
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2 font-black">Cohort</th>
                                            <th className="px-3 py-2 font-black">Users</th>
                                            <th className="px-3 py-2 font-black">Day 1</th>
                                            <th className="px-3 py-2 font-black">Day 7</th>
                                            <th className="px-3 py-2 font-black">Day 30</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {cohortsLoading ? (
                                            <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Loading cohorts...</td></tr>
                                        ) : (cohorts?.cohorts || []).length === 0 ? (
                                            <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No cohort data yet.</td></tr>
                                        ) : (cohorts?.cohorts || []).map((row) => (
                                            <tr key={row.week_start}>
                                                <td className="px-3 py-3 font-bold text-slate-900">{row.label}</td>
                                                <td className="px-3 py-3 text-slate-700">{row.users}</td>
                                                <td className="px-3 py-3 text-slate-700">{row.day_1_rate}% <span className="text-xs text-slate-400">({row.day_1})</span></td>
                                                <td className="px-3 py-3 text-slate-700">{row.day_7_rate}% <span className="text-xs text-slate-400">({row.day_7})</span></td>
                                                <td className="px-3 py-3 text-slate-700">{row.day_30_rate}% <span className="text-xs text-slate-400">({row.day_30})</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-black text-slate-900">Buyer retention</p>
                                    <p className="mt-2 text-xs leading-5 text-slate-600">
                                        {cohorts?.buyer_retention?.repeat_buyers || 0} repeat buyers from {cohorts?.buyer_retention?.buyers || 0} buyers.
                                    </p>
                                    <p className="mt-2 text-xs text-slate-500">{cohorts?.buyer_retention?.orders || 0} paid orders in this window.</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm font-black text-slate-900">Creator activation</p>
                                    <p className="mt-2 text-xs leading-5 text-slate-600">
                                        {cohorts?.creator_activation?.with_products || 0} uploaded products, {cohorts?.creator_activation?.with_posts || 0} posted, {cohorts?.creator_activation?.with_sales || 0} sold.
                                    </p>
                                    <p className="mt-2 text-xs text-slate-500">{cohorts?.creator_activation?.new_creators || 0} new creators in this window.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <SectionTitle title="Event breakdown" subtitle="Raw behavior signals collected by the first-party event layer." />
                        <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                            {(data?.event_totals || []).map((event) => (
                                <div key={event.event_type} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">{event.label}</p>
                                    <p className="mt-1 text-xl font-black text-slate-900">{Number(event.total || 0).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <SectionTitle title="Event explorer" subtitle="Search raw behavior events by type, user, session, merchant, URL, coupon, or referral." />
                            <div className="grid gap-2 md:grid-cols-[180px_260px]">
                                <select
                                    value={eventFilters.event_type}
                                    onChange={(e) => setEventFilters((prev) => ({ ...prev, event_type: e.target.value }))}
                                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"
                                >
                                    <option value="">All event types</option>
                                    {(data?.event_totals || []).map((event) => (
                                        <option key={event.event_type} value={event.event_type}>{event.label}</option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        value={eventFilters.q}
                                        onChange={(e) => setEventFilters((prev) => ({ ...prev, q: e.target.value }))}
                                        placeholder="Search user, session, URL..."
                                        className="h-10 rounded-xl border-slate-300 bg-white pl-9 text-sm"
                                    />
                                </div>
                                <a
                                    href={exportUrl('events', {
                                        ...(eventFilters.event_type ? { event_type: eventFilters.event_type } : {}),
                                        ...(eventFilters.q ? { q: eventFilters.q } : {}),
                                    })}
                                    className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-black text-slate-700 hover:bg-white"
                                >
                                    Export current event view
                                </a>
                            </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-3 py-2 font-black">Time</th>
                                        <th className="px-3 py-2 font-black">Event</th>
                                        <th className="px-3 py-2 font-black">Actor</th>
                                        <th className="px-3 py-2 font-black">Target</th>
                                        <th className="px-3 py-2 font-black">Source</th>
                                        <th className="px-3 py-2 font-black">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {eventsLoading ? (
                                        <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading events...</td></tr>
                                    ) : (events?.data || []).length === 0 ? (
                                        <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No events match these filters.</td></tr>
                                    ) : (events?.data || []).map((event) => (
                                        <tr key={event.id} className="align-top">
                                            <td className="px-3 py-3 text-xs text-slate-500">{formatDate(event.created_at)}</td>
                                            <td className="px-3 py-3">
                                                <p className="font-bold text-slate-900">{event.event_label}</p>
                                                <p className="mt-1 max-w-[220px] truncate text-xs text-slate-500" title={event.session_id}>{event.session_id}</p>
                                            </td>
                                            <td className="px-3 py-3 text-slate-700">
                                                {event.user ? (
                                                    <div>
                                                        <p className="font-semibold">{event.user.name || 'User'}</p>
                                                        <p className="text-xs text-slate-500">User #{event.user.id}</p>
                                                    </div>
                                                ) : <span className="text-slate-500">Anonymous</span>}
                                            </td>
                                            <td className="px-3 py-3 text-slate-700">
                                                <p>{event.entity_type || '-'}</p>
                                                <p className="text-xs text-slate-500">{event.entity_id ? `#${event.entity_id}` : event.merchant?.name || ''}</p>
                                            </td>
                                            <td className="px-3 py-3 text-slate-700">
                                                <p>{event.source || 'direct'}</p>
                                                <p className="max-w-[220px] truncate text-xs text-slate-500" title={event.landing_url}>{event.landing_url || ''}</p>
                                            </td>
                                            <td className="px-3 py-3">
                                                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => inspectJourney(event)}>
                                                    Journey
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                            <SectionTitle title="User/session journey" subtitle="Inspect the timeline that led to searches, checkouts, purchases, or drop-off." />
                            <Route className="h-5 w-5 text-brand-700" />
                        </div>

                        {journeyLoading ? (
                            <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Loading journey...</p>
                        ) : !journey ? (
                            <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                                Select “Journey” from an event above to inspect that user/session path.
                            </p>
                        ) : (
                            <div className="mt-4 space-y-4">
                                <div className="grid gap-3 md:grid-cols-4">
                                    <MiniStat label="Events" value={journey.summary?.events} />
                                    <MiniStat label="Searches" value={journey.summary?.searches} />
                                    <MiniStat label="Checkouts" value={journey.summary?.checkout_starts} />
                                    <MiniStat label="Revenue" value={money(journey.summary?.revenue)} />
                                </div>
                                <div className="space-y-2">
                                    {(journey.events || []).map((event, index) => (
                                        <div key={event.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[90px_1fr]">
                                            <div>
                                                <p className="text-xs font-black text-slate-500">STEP {index + 1}</p>
                                                <p className="mt-1 text-xs text-slate-500">{formatTime(event.created_at)}</p>
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-bold text-slate-900">{event.event_label}</p>
                                                    {event.value !== null && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{money(event.value)}</span>}
                                                    {event.source && <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-black text-brand-700">{event.source}</span>}
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {event.entity_type ? `${event.entity_type} #${event.entity_id || '-'}` : 'Platform event'}
                                                    {event.merchant?.name ? ` · ${event.merchant.name}` : ''}
                                                </p>
                                                {event.landing_url && (
                                                    <p className="mt-1 truncate text-xs text-slate-500" title={event.landing_url}>{event.landing_url}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}

function Metric({ icon: Icon, label, value, loading }) {
    return (
        <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                    <Icon className="h-4 w-4 text-brand-700" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">{loading ? '-' : value ?? 0}</p>
            </CardContent>
        </Card>
    );
}

function SectionTitle({ title, subtitle }) {
    return (
        <div>
            <p className="text-sm font-black uppercase tracking-wider text-slate-900">{title}</p>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
    );
}

function List({ rows, empty }) {
    if (!rows.length) {
        return <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{empty}</p>;
    }

    return (
        <div className="mt-4 space-y-2">
            {rows.map(([title, subtitle], index) => (
                <div key={`${title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-bold text-slate-900">{title}</p>
                    <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
                </div>
            ))}
        </div>
    );
}

function Table({ columns, rows, empty }) {
    if (!rows.length) {
        return <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">{empty}</p>;
    }

    return (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                        {columns.map((column) => (
                            <th key={column} className="px-3 py-2 font-black">{column}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2 text-slate-700">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-black text-slate-900">{value ?? 0}</p>
        </div>
    );
}

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
}

function formatTime(value) {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
