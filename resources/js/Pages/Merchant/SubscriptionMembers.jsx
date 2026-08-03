import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { ArrowLeft, Crown, Loader2, Search, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

export default function SubscriptionMembers({
    merchantUsername = '',
    merchantName = '',
    subscriptionPlanId = null,
    subscriptionPlanName = '',
}) {
    const { copy } = useLocale();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [stats, setStats] = useState(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const isPlanScoped = Boolean(subscriptionPlanId);

    useEffect(() => {
        loadMembers();
    }, [merchantUsername, subscriptionPlanId]);

    const filteredMembers = useMemo(() => {
        const term = search.trim().toLowerCase();

        return members.filter((member) => {
            const matchesStatus = status === 'all' || member.status === status;
            if (!matchesStatus) return false;
            if (!term) return true;

            const haystack = [
                member.user?.name,
                member.user?.phone_number,
                member.user?.email,
                !isPlanScoped ? member.plan?.name : null,
                member.status,
            ].filter(Boolean).join(' ').toLowerCase();

            return haystack.includes(term);
        });
    }, [isPlanScoped, members, search, status]);

    async function loadMembers() {
        if (!merchantUsername) return;
        setLoading(true);
        try {
            const endpoint = isPlanScoped
                ? `/merchant/${merchantUsername}/subscription-plans/${subscriptionPlanId}/members/api`
                : `/merchant/${merchantUsername}/subscription-members/api`;
            const res = await axios.get(endpoint);
            setMembers(res.data?.members || []);
            setStats(res.data?.stats || null);
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load subscribers.', 'Imeshindikana kupakia waliojisajili.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <AppLayout>
            <Head title={`${copy('Subscription members', 'Wanachama wa usajili')} | Takeer`} />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Button
                            variant="ghost"
                            className="mb-2 rounded-xl px-0 text-slate-500 hover:bg-transparent"
                            onClick={() => router.visit(isPlanScoped ? `/merchant/${merchantUsername}/subscriptions` : '/profile')}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {isPlanScoped ? copy('Back to subscriptions', 'Rudi kwenye usajili') : copy('Back to profile', 'Rudi kwenye wasifu')}
                        </Button>
                        <h1 className="text-2xl font-black text-slate-950">{isPlanScoped ? copy('Tier members', 'Wanachama wa daraja') : copy('Subscription members', 'Wanachama wa usajili')}</h1>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                            {isPlanScoped ? subscriptionPlanName : (merchantName || merchantUsername)}
                        </p>
                    </div>
                    <Button className="rounded-xl bg-brand-600 text-white hover:bg-brand-700" onClick={() => router.visit(`/merchant/${merchantUsername}/subscriptions`)}>
                        <Crown className="mr-2 h-4 w-4" />
                        {copy('Manage tiers', 'Simamia madaraja')}
                    </Button>
                </div>

                <Card className="rounded-[24px] border-sky-100">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-black">
                            <Users className="h-5 w-5 text-sky-600" />
                            {copy('Subscribers', 'Waliojisajili')}
                        </CardTitle>
                        <CardDescription>
                            {isPlanScoped
                                ? copy('Creators can view subscriber access for this membership tier.', 'Watayarishi wanaweza kuona ufikiaji wa waliojisajili kwenye daraja hili.')
                                : copy('Creators can view subscriber access across all membership tiers.', 'Watayarishi wanaweza kuona ufikiaji wa waliojisajili kwenye madaraja yote.')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {[
                                { label: copy('Total', 'Jumla'), value: stats?.total ?? members.length },
                                { label: copy('Active', 'Hai'), value: stats?.active ?? 0 },
                                { label: copy('Paused', 'Imesitishwa'), value: stats?.paused ?? 0 },
                                { label: copy('Expired / cancelled', 'Imeisha / imeghairiwa'), value: stats?.cancelled ?? 0 },
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{item.label}</p>
                                    <p className="mt-2 text-xl font-black text-slate-950">{Number(item.value || 0).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 md:flex-row">
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    className="pl-9"
                                    placeholder={isPlanScoped ? copy('Search name or contact', 'Tafuta jina au mawasiliano') : copy('Search name, contact, or plan', 'Tafuta jina, mawasiliano au mpango')}
                                />
                            </div>
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold text-slate-700"
                            >
                                <option value="all">{copy('All statuses', 'Hali zote')}</option>
                                <option value="active">{copy('Active', 'Hai')}</option>
                                <option value="paused">{copy('Paused', 'Imesitishwa')}</option>
                                <option value="cancelled">{copy('Cancelled', 'Imeghairiwa')}</option>
                                <option value="expired">{copy('Expired', 'Imeisha')}</option>
                            </select>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {copy('Loading subscribers...', 'Inapakia waliojisajili...')}
                            </div>
                        ) : filteredMembers.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
                                <Users className="mx-auto h-9 w-9 text-slate-300" />
                                <p className="mt-3 text-sm font-black text-slate-900">{copy('No subscribers found', 'Hakuna waliojisajili waliopatikana')}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">{copy('Members will appear here after customers subscribe.', 'Wanachama wataonekana hapa baada ya wateja kujisajili.')}</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-slate-200">
                                <div className={cn(
                                    'hidden gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 lg:grid',
                                    isPlanScoped
                                        ? 'grid-cols-[minmax(0,1.4fr)_140px_150px]'
                                        : 'grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px_150px]'
                                )}>
                                    <span>{copy('Subscriber', 'Aliyejisajili')}</span>
                                    {!isPlanScoped && <span>{copy('Plan', 'Mpango')}</span>}
                                    <span>{copy('Status', 'Hali')}</span>
                                    <span>{copy('Period ends', 'Kipindi kinaisha')}</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {filteredMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            className={cn(
                                                'grid gap-3 px-4 py-4 lg:items-center',
                                                isPlanScoped
                                                    ? 'lg:grid-cols-[minmax(0,1.4fr)_140px_150px]'
                                                    : 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px_150px]'
                                            )}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-slate-950">{member.user?.name || copy('Member', 'Mwanachama')}</p>
                                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">{member.user?.phone_number || member.user?.email || copy('No contact', 'Hakuna mawasiliano')}</p>
                                            </div>
                                            {!isPlanScoped && (
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-slate-900">{member.plan?.name || copy('Membership plan', 'Mpango wa uanachama')}</p>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{formatMoney(member.plan?.price || 0)} · {planCadenceLabel(member.plan, copy)}</p>
                                                </div>
                                            )}
                                            <div>
                                                <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider', statusClasses(member.status))}>
                                                    {statusLabel(member.status, copy)}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-600">{formatDate(member.current_period_end, copy)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function formatMoney(amount) {
    return new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency: 'TZS',
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(date, copy) {
    if (!date) return copy('Not set', 'Haijawekwa');
    return new Date(date).toLocaleDateString('en-TZ', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function statusClasses(status) {
    if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'paused') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'cancelled' || status === 'expired') return 'border-red-200 bg-red-50 text-red-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
}

function planCadenceLabel(plan, copy) {
    if (!plan) return copy('Membership', 'Uanachama');

    const interval = plan.billing_interval || 'monthly';
    const count = Number(plan.interval_count || 1);
    const intervalLabels = {
        hourly: ['Hour', 'Saa', 'Masaa'],
        daily: ['Day', 'Siku', 'Siku'],
        weekly: ['Week', 'Wiki', 'Wiki'],
        monthly: ['Month', 'Mwezi', 'Miezi'],
    };
    const [single, singleSw, pluralSw] = intervalLabels[interval] || [interval, interval, `${interval}s`];

    return count <= 1 ? copy(single, singleSw) : copy(`Every ${count} ${single}s`, `Kila ${count} ${pluralSw}`);
}

function statusLabel(status, copy) {
    const labels = {
        active: ['Active', 'Hai'],
        paused: ['Paused', 'Imesitishwa'],
        cancelled: ['Cancelled', 'Imeghairiwa'],
        expired: ['Expired', 'Imeisha'],
    };
    const pair = labels[status];
    return pair ? copy(pair[0], pair[1]) : (status || copy('Unknown', 'Haijulikani'));
}
