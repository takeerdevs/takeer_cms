import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { BookOpenText, CalendarClock, ChevronRight, Loader2, RefreshCw, Search, Star, UserRound, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const SEGMENTS = [
    { value: 'all', label: 'All customers' },
    { value: 'vip', label: 'VIP' },
    { value: 'repeat', label: 'Repeat' },
    { value: 'services', label: 'Services' },
    { value: 'students', label: 'Students' },
    { value: 'members', label: 'Members' },
];

export default function Customers({ merchantUsername }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ summary: {}, customers: [] });
    const [filters, setFilters] = useState({ q: '', segment: 'all' });

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.q.trim()) params.set('q', filters.q.trim());
            if (filters.segment !== 'all') params.set('segment', filters.segment);
            const response = await axios.get(`/merchant/${merchantUsername}/customers/api?${params.toString()}`);
            setData(response.data || { summary: {}, customers: [] });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load customers.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(loadCustomers, 250);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.q, filters.segment, merchantUsername]);

    const customers = useMemo(() => data.customers || [], [data.customers]);

    return (
        <AppLayout>
            <Head title="Customers | Takeer" />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">CRM</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Customers</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            A unified view of buyers, booking customers, students, and members for this business.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={loadCustomers} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                        <Button asChild>
                            <Link href={`/merchant/${merchantUsername}/marketing`}>
                                Marketing
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-6">
                    <MetricCard icon={Users} label="Total" value={data.summary?.total ?? 0} />
                    <MetricCard icon={Star} label="VIP" value={data.summary?.vip ?? 0} />
                    <MetricCard icon={RefreshCw} label="Repeat" value={data.summary?.repeat ?? 0} />
                    <MetricCard icon={CalendarClock} label="Services" value={data.summary?.service_customers ?? 0} />
                    <MetricCard icon={BookOpenText} label="Students" value={data.summary?.students ?? 0} />
                    <MetricCard icon={UserRound} label="Members" value={data.summary?.members ?? 0} />
                </div>

                <Card>
                    <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Search name, phone, or email..." value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} />
                        </div>
                        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.segment} onChange={(event) => setFilters((prev) => ({ ...prev, segment: event.target.value }))}>
                            {SEGMENTS.map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
                        </select>
                    </CardContent>
                </Card>

                {loading ? (
                    <Card>
                        <CardContent className="flex min-h-64 flex-col items-center justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                            <p className="mt-3 text-sm text-muted-foreground">Loading customers...</p>
                        </CardContent>
                    </Card>
                ) : customers.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                            <h3 className="mt-3 text-lg font-black">No customers yet</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Customers will appear after orders, bookings, enrollments, or subscriptions.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {customers.map((customer) => <CustomerCard key={customer.key} customer={customer} />)}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function MetricCard({ icon: Icon, label, value }) {
    return (
        <Card>
            <CardContent className="p-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-2xl font-black">{value}</p>
            </CardContent>
        </Card>
    );
}

function CustomerCard({ customer }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <UserRound className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate text-base font-black">{customer.name || customer.phone || customer.email || 'Customer'}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact saved'}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {(customer.segments || []).map((segment) => (
                                    <span key={segment} className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase text-muted-foreground">{segment}</span>
                                ))}
                                {(customer.sources || []).map((source) => (
                                    <span key={source} className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold uppercase text-brand-700">{sourceLabel(source)}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-left lg:min-w-72">
                        <MiniStat label="Activity" value={customer.activity_count} />
                        <MiniStat label="Spent" value={`TZS ${Number(customer.total_spent || 0).toLocaleString()}`} />
                        <MiniStat label="Last seen" value={formatDate(customer.last_activity_at)} />
                    </div>
                </div>

                {customer.recent_activity?.length > 0 && (
                    <div className="mt-4 border-t border-border pt-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Recent activity</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {customer.recent_activity.slice(0, 4).map((activity, index) => (
                                <div key={`${activity.source}-${index}`} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                                    <p className="font-semibold">{activity.label || sourceLabel(activity.source)}</p>
                                    <p className="text-xs text-muted-foreground">{sourceLabel(activity.source)} · {formatDate(activity.activity_at)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function MiniStat({ label, value }) {
    return (
        <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-sm font-black">{value}</p>
        </div>
    );
}

function sourceLabel(source) {
    return {
        orders: 'Orders',
        service_requests: 'Services',
        subscriptions: 'Members',
        enrollments: 'Enrollments',
    }[source] || source;
}

function formatDate(value) {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
