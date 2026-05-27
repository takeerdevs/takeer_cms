import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, CreditCard, Flag, RefreshCw, ShieldAlert, Truck, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { cn } from '@/lib/utils';

const filters = [
    { key: 'all', label: 'All', icon: Bell },
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'trust', label: 'Trust', icon: ShieldAlert },
    { key: 'content', label: 'Content', icon: Flag },
    { key: 'services', label: 'Services', icon: Wrench },
    { key: 'logistics', label: 'Logistics', icon: Truck },
    { key: 'system', label: 'System', icon: AlertTriangle },
];

export default function AdminAttention() {
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState({ total: 0, categories: {} });
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const load = async (nextFilter = filter) => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/api/attention', {
                params: { category: nextFilter },
            });
            setItems(res.data?.items || []);
            setSummary(res.data?.summary || { total: 0, categories: {} });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load admin attention items.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(filter);
    }, [filter]);

    const groupedItems = useMemo(() => {
        return items.reduce((groups, item) => {
            const key = item.severity || 'low';
            groups[key] = groups[key] || [];
            groups[key].push(item);
            return groups;
        }, {});
    }, [items]);

    return (
        <AdminLayout title="Attention Center">
            <Head title="Attention Center | Takeer Admin" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-red-50 p-3 text-red-700">
                            <Bell className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Attention Center</h1>
                            <p className="mt-1 text-sm text-slate-600">One place for admin work that needs review, approval, or follow-up.</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => load(filter)} disabled={loading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <Metric label="Total" value={summary.total || 0} tone="text-slate-900" />
                    <Metric label="Critical" value={summary.critical || 0} tone="text-red-700" />
                    <Metric label="High" value={summary.high || 0} tone="text-orange-700" />
                    <Metric label="Medium" value={summary.medium || 0} tone="text-amber-700" />
                    <Metric label="Low" value={summary.low || 0} tone="text-slate-600" />
                </div>

                <Card className="border-slate-200 bg-white">
                    <CardContent className="p-3">
                        <div className="flex flex-wrap gap-2">
                            {filters.map(({ key, label, icon: Icon }) => {
                                const count = key === 'all' ? summary.total : summary.categories?.[key] || 0;
                                const active = filter === key;

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setFilter(key)}
                                        className={cn(
                                            'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors',
                                            active
                                                ? 'border-brand-200 bg-brand-50 text-brand-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                        <span className={cn(
                                            'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-black leading-none',
                                            active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600',
                                        )}>
                                            {count || 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <Card className="border-slate-200 bg-white">
                        <CardContent className="py-16 text-center text-sm font-semibold text-slate-500">Loading attention items...</CardContent>
                    </Card>
                ) : items.length === 0 ? (
                    <Card className="border-slate-200 bg-white">
                        <CardContent className="py-16 text-center">
                            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                            <p className="mt-3 font-black text-slate-900">Nothing needs attention here.</p>
                            <p className="mt-1 text-sm text-slate-500">This view will light up again when admin work appears.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-5">
                        {['critical', 'high', 'medium', 'low'].map((severity) => (
                            groupedItems[severity]?.length > 0 && (
                                <section key={severity} className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className={cn('h-2.5 w-2.5 rounded-full', severityDotClass(severity))} />
                                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">{severity}</h2>
                                    </div>
                                    <div className="space-y-3">
                                        {groupedItems[severity].map((item) => (
                                            <AttentionItem key={item.id} item={item} />
                                        ))}
                                    </div>
                                </section>
                            )
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function Metric({ label, value, tone }) {
    return (
        <Card className="border-slate-200 bg-white">
            <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

function AttentionItem({ item }) {
    return (
        <Card className={cn('border bg-white shadow-sm', severityBorderClass(item.severity))}>
            <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', severityBadgeClass(item.severity))}>
                                {item.severity}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                {item.source}
                            </span>
                            <span className="text-xs font-bold text-slate-400">{formatDate(item.occurred_at)}</span>
                        </div>
                        <p className="mt-3 text-base font-black text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-600">{item.body}</p>
                    </div>
                    <Link href={item.href} className="shrink-0">
                        <Button className="bg-slate-900 text-white hover:bg-slate-800">
                            {item.action || 'Open'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

function formatDate(value) {
    if (!value) return 'No date';

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function severityDotClass(severity) {
    if (severity === 'critical') return 'bg-red-600';
    if (severity === 'high') return 'bg-orange-500';
    if (severity === 'medium') return 'bg-amber-500';
    return 'bg-slate-400';
}

function severityBadgeClass(severity) {
    if (severity === 'critical') return 'bg-red-50 text-red-700';
    if (severity === 'high') return 'bg-orange-50 text-orange-700';
    if (severity === 'medium') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-600';
}

function severityBorderClass(severity) {
    if (severity === 'critical') return 'border-red-200';
    if (severity === 'high') return 'border-orange-200';
    if (severity === 'medium') return 'border-amber-200';
    return 'border-slate-200';
}
