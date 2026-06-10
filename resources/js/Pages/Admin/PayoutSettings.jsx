import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { AlertTriangle, ArrowLeft, Save, ShieldCheck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

const PAYOUT_BUCKETS = {
    digital_downloads: 'Downloads/assets',
    premium_media: 'Premium media',
    live_events: 'Live events',
    custom_work: 'Custom work',
    paid_writing: 'Paid writing',
    courses_bundles: 'Courses/bundles',
    creator_club: 'Creator Club',
    services: 'Services',
    physical: 'Physical',
};

const PAYOUT_MODES = {
    automatic: 'Automatic',
    manual_withdrawal: 'Manual withdrawal',
    escrow_hold: 'Escrow held',
    payout_paused: 'Payout paused',
};

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const formatBps = (value) => `${(Number(value || 0) / 100).toFixed(2)}%`;
const formatPlain = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const numberOrNull = (value) => value === '' || value === null || value === undefined ? null : Number(value);
const integerOrZero = (value) => Number.parseInt(value || 0, 10) || 0;
const channelTreasuryAccounts = (channel) => {
    const currencies = Array.isArray(channel.currencies) && channel.currencies.length > 0
        ? channel.currencies
        : [channel.currency_code].filter(Boolean);
    const existing = channel.treasury_accounts || [];

    return currencies.map((currencyCode) => existing.find((account) => account.currency_code === currencyCode) || {
        currency_code: currencyCode,
        balance_amount: 0,
        reserved_amount: 0,
        minimum_available_amount: 0,
        status: 'active',
        is_unsaved: true,
    });
};

export default function PayoutSettings() {
    const [settings, setSettings] = useState({});
    const [payoutPolicy, setPayoutPolicy] = useState({ buckets: PAYOUT_BUCKETS, modes: PAYOUT_MODES });
    const [paymentOps, setPaymentOps] = useState({ providers: [], incidents: [] });
    const [opsLoading, setOpsLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingProviderIds, setSavingProviderIds] = useState([]);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load payout settings.');
                return data;
            })
            .then((data) => {
                setSettings(data.settings || {});
                if (data.payout_policy) setPayoutPolicy(data.payout_policy);
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });

        fetchPaymentOps();
    }, []);

    const set = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

    const fetchPaymentOps = async () => {
        setOpsLoading(true);
        try {
            const res = await fetch('/admin/api/payment-operations', { headers: { Accept: 'application/json' } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load payment operations.');
            setPaymentOps({ providers: data.providers || [], incidents: data.incidents || [] });
        } catch (err) {
            toast.error(err.message);
        } finally {
            setOpsLoading(false);
        }
    };

    const patchOpsProviderState = (providerId, updates) => {
        setPaymentOps((prev) => ({
            ...prev,
            providers: prev.providers.map((provider) => provider.id === providerId ? { ...provider, ...updates } : provider),
        }));
    };

    const patchOpsChannelState = (providerId, channelId, updates) => {
        setPaymentOps((prev) => ({
            ...prev,
            providers: prev.providers.map((provider) => provider.id === providerId ? {
                ...provider,
                channels: provider.channels.map((channel) => channel.id === channelId ? { ...channel, ...updates } : channel),
            } : provider),
        }));
    };

    const patchOpsChannelLimitState = (provider, channel, key, value) => {
        patchOpsChannelState(provider.id, channel.id, {
            limits: { ...(channel.limits || {}), [key]: value },
        });
    };

    const patchOpsTreasuryState = (provider, channel, currencyCode, updates) => {
        const existing = channel.treasury_accounts || [];
        const account = existing.find((item) => item.currency_code === currencyCode) || { currency_code: currencyCode, status: 'active' };
        const next = [
            ...existing.filter((item) => item.currency_code !== currencyCode),
            { ...account, ...updates, currency_code: currencyCode },
        ];

        patchOpsChannelState(provider.id, channel.id, { treasury_accounts: next });
    };

    const channelSavePayload = (channel) => {
        const payload = {
            status: channel.status || 'enabled',
            priority: integerOrZero(channel.priority) || 100,
            fee_type: channel.fee_type || 'fixed_plus_percent',
            fee_fixed: numberOrNull(channel.fee_fixed) ?? 0,
            fee_percent_bps: integerOrZero(channel.fee_percent_bps),
            fee_min: numberOrNull(channel.fee_min) ?? 0,
            fee_max: numberOrNull(channel.fee_max),
            fx_margin_bps: integerOrZero(channel.fx_margin_bps),
        };

        if (channel.direction === 'payout') {
            payload.limits = {
                min_withdrawal_amount: numberOrNull(channel.limits?.min_withdrawal_amount),
                max_withdrawal_amount: numberOrNull(channel.limits?.max_withdrawal_amount),
            };
            payload.treasury_accounts = channelTreasuryAccounts(channel).map((account) => ({
                currency_code: account.currency_code,
                balance_amount: numberOrNull(account.balance_amount) ?? 0,
                minimum_available_amount: numberOrNull(account.minimum_available_amount) ?? 0,
                status: account.status || 'active',
            }));
        }

        return payload;
    };

    const saveProviderOperations = async (provider) => {
        setSavingProviderIds((prev) => [...new Set([...prev, provider.id])]);
        try {
            const providerRes = await fetch(`/admin/api/payment-operations/providers/${provider.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ status: provider.status || 'enabled' }),
            });
            const providerData = await providerRes.json();
            if (!providerRes.ok) throw new Error(providerData.message || 'Failed to update provider.');

            const savedChannels = await Promise.all((provider.channels || []).map(async (channel) => {
                const channelRes = await fetch(`/admin/api/payment-operations/channels/${channel.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
                    body: JSON.stringify(channelSavePayload(channel)),
                });
                const channelData = await channelRes.json();
                if (!channelRes.ok) throw new Error(channelData.message || `Failed to update ${channel.name}.`);
                return channelData.channel;
            }));

            setPaymentOps((prev) => ({
                ...prev,
                providers: prev.providers.map((item) => item.id === provider.id ? {
                    ...item,
                    ...(providerData.provider || {}),
                    channels: item.channels.map((channel) => savedChannels.find((saved) => saved?.id === channel.id) || channel),
                } : item),
            }));
            toast.success(`${provider.name} settings saved.`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSavingProviderIds((prev) => prev.filter((id) => id !== provider.id));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const buckets = payoutPolicy.buckets || PAYOUT_BUCKETS;
            const res = await fetch('/admin/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({
                    ...Object.fromEntries(Object.keys(buckets).map((bucket) => [`payout_policy_${bucket}`, settings[`payout_policy_${bucket}`]])),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save payout settings.');
            toast.success(data.message || 'Payout settings saved');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Payout Settings">
                <div className="flex h-64 items-center justify-center text-slate-500">Loading payout settings...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Payout Settings">
            <Head title="Payout Settings | Takeer" />

            <div className="max-w-4xl space-y-6">
                <div>
                    <Link href="/admin/withdrawals" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back to withdrawals
                    </Link>
                    <div className="mt-2 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50">
                            <WalletCards className="h-5 w-5 text-emerald-700" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Payout Settings</h1>
                            <p className="text-sm text-slate-600">Default release behavior for creator monetization payments.</p>
                        </div>
                    </div>
                </div>

                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="flex gap-3 p-4 text-sm text-amber-900">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="font-black">Merchant overrides still win.</p>
                            <p className="mt-1 font-semibold">Use platform defaults for normal operations, then use individual Merchant Settings for copyright, fraud, or abuse interventions.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-5 p-6">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h2 className="font-bold text-slate-900">Payment Providers</h2>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                    Providers are integrations we can route through, such as AzamPay, Selcom, DPO, or Flutterwave. Channels are the specific rails inside that provider, for example checkout mobile money, payout mobile money, or bank transfer.
                                </p>
                            </div>
                            <Button type="button" variant="outline" className="h-10 rounded-xl font-bold" onClick={fetchPaymentOps} disabled={opsLoading}>
                                {opsLoading ? 'Refreshing...' : 'Refresh'}
                            </Button>
                        </div>

                        {opsLoading ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">Loading provider operations...</div>
                        ) : (
                            <div className="space-y-4">
                                {paymentOps.providers.map((provider) => (
                                    <div key={provider.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black text-slate-950">{provider.name}</p>
                                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        {provider.driver || provider.key}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                                    {(provider.countries || []).map((country) => `${country.country_code}${country.enabled ? '' : ' off'}`).join(' · ') || 'No countries configured'}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <select
                                                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
                                                    value={provider.status || 'enabled'}
                                                    onChange={(e) => patchOpsProviderState(provider.id, { status: e.target.value })}
                                                >
                                                    <option value="enabled">Enabled</option>
                                                    <option value="degraded">Degraded</option>
                                                    <option value="disabled">Disabled</option>
                                                </select>
                                                <Button
                                                    type="button"
                                                    className="h-10 rounded-xl font-bold"
                                                    onClick={() => saveProviderOperations(provider)}
                                                    disabled={savingProviderIds.includes(provider.id)}
                                                >
                                                    <Save className="mr-2 h-4 w-4" />
                                                    {savingProviderIds.includes(provider.id) ? 'Saving...' : 'Save Provider'}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            {(provider.channels || []).map((channel) => (
                                                <div key={channel.id} className="rounded-xl border border-slate-200 bg-white p-4">
                                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-slate-900">{channel.name}</p>
                                                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                                {channel.country_code} · {channel.direction} · {String(channel.method).replaceAll('_', ' ')} · {(channel.currencies || []).join(', ')}
                                                            </p>
                                                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                                                Routed through {provider.name}
                                                            </p>
                                                        </div>

                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                                                                <select
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.status || 'enabled'}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { status: e.target.value })}
                                                                >
                                                                    <option value="enabled">Enabled</option>
                                                                    <option value="degraded">Degraded</option>
                                                                    <option value="disabled">Disabled</option>
                                                                </select>
                                                            </label>
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Route priority</span>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    title="Lower number is tried first when multiple channels match the same country, direction, method, and currency."
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.priority ?? 100}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { priority: e.target.value })}
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                                        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Provider cost rule</p>
                                                            <p className="text-[10px] font-bold text-slate-500">
                                                                {(channel.currencies || []).join(', ') || 'Channel currency'}
                                                            </p>
                                                        </div>
                                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">FX spread bps</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="5000"
                                                                    title="Basis points included in the displayed exchange rate. 350 bps means 3.50%."
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.fx_margin_bps ?? 0}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { fx_margin_bps: e.target.value })}
                                                                />
                                                                <span className="block text-[10px] font-bold text-slate-500">{formatBps(channel.fx_margin_bps)}</span>
                                                            </label>
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cost type</span>
                                                                <select
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.fee_type || 'fixed_plus_percent'}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { fee_type: e.target.value })}
                                                                >
                                                                    <option value="none">None</option>
                                                                    <option value="fixed">Fixed</option>
                                                                    <option value="percent">Percent</option>
                                                                    <option value="fixed_plus_percent">Fixed + percent</option>
                                                                </select>
                                                            </label>
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fixed</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    title="Fixed provider rail cost in the payout/channel currency."
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.fee_fixed ?? 0}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { fee_fixed: e.target.value })}
                                                                />
                                                            </label>
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">% bps</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="10000"
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.fee_percent_bps ?? 0}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { fee_percent_bps: e.target.value })}
                                                                />
                                                            </label>
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    title="Minimum provider rail cost in the payout/channel currency."
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.fee_min ?? 0}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { fee_min: e.target.value })}
                                                                />
                                                            </label>
                                                            <label className="space-y-1.5">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    title="Maximum provider rail cost in the payout/channel currency."
                                                                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                    value={channel.fee_max ?? ''}
                                                                    onChange={(e) => patchOpsChannelState(provider.id, channel.id, { fee_max: e.target.value })}
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {channel.direction === 'payout' && (
                                                        <div className="mt-3 space-y-3">
                                                            <div className="rounded-xl border border-slate-100 bg-white p-3">
                                                                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Withdrawal limits</p>
                                                                    <p className="text-[10px] font-bold text-slate-500">Payout/channel currency</p>
                                                                </div>
                                                                <div className="grid gap-3 sm:grid-cols-2">
                                                                    <label className="space-y-1.5">
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min withdrawal</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            title="Minimum provider payout amount through this channel, in the payout/channel currency."
                                                                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                            value={channel.limits?.min_withdrawal_amount ?? ''}
                                                                            onChange={(e) => patchOpsChannelLimitState(provider, channel, 'min_withdrawal_amount', e.target.value)}
                                                                        />
                                                                    </label>
                                                                    <label className="space-y-1.5">
                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max withdrawal</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            title="Optional maximum provider payout amount through this channel, in the payout/channel currency."
                                                                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                            value={channel.limits?.max_withdrawal_amount ?? ''}
                                                                            onChange={(e) => patchOpsChannelLimitState(provider, channel, 'max_withdrawal_amount', e.target.value)}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                                                                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Provider liquidity</p>
                                                                    <p className="text-[10px] font-bold text-slate-500">Available = balance - reserved - buffer</p>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {channelTreasuryAccounts(channel).map((account) => {
                                                                        const available = Math.max(0, Number(account.balance_amount || 0) - Number(account.reserved_amount || 0) - Number(account.minimum_available_amount || 0));

                                                                        return (
                                                                            <div key={account.currency_code} className="rounded-xl border border-sky-100 bg-white p-3">
                                                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                                                    <p className="text-sm font-black text-slate-900">{account.currency_code}</p>
                                                                                    <div className="text-right">
                                                                                        <p className="text-[11px] font-black text-sky-700">Available {formatPlain(available)}</p>
                                                                                        {account.is_unsaved && (
                                                                                            <p className="text-[10px] font-bold text-amber-700">Save provider to activate</p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="grid gap-3 sm:grid-cols-4">
                                                                                    <label className="space-y-1.5">
                                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Balance</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            step="0.01"
                                                                                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                                            value={account.balance_amount ?? 0}
                                                                                            onChange={(e) => patchOpsTreasuryState(provider, channel, account.currency_code, { balance_amount: e.target.value })}
                                                                                        />
                                                                                    </label>
                                                                                    <label className="space-y-1.5">
                                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reserved</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-500"
                                                                                            value={account.reserved_amount ?? 0}
                                                                                            disabled
                                                                                        />
                                                                                    </label>
                                                                                    <label className="space-y-1.5">
                                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buffer</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            step="0.01"
                                                                                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                                            value={account.minimum_available_amount ?? 0}
                                                                                            onChange={(e) => patchOpsTreasuryState(provider, channel, account.currency_code, { minimum_available_amount: e.target.value })}
                                                                                        />
                                                                                    </label>
                                                                                    <label className="space-y-1.5">
                                                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Treasury</span>
                                                                                        <select
                                                                                            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900"
                                                                                            value={account.status || 'active'}
                                                                                            onChange={(e) => patchOpsTreasuryState(provider, channel, account.currency_code, { status: e.target.value })}
                                                                                        >
                                                                                            <option value="active">Active</option>
                                                                                            <option value="paused">Paused</option>
                                                                                        </select>
                                                                                    </label>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {paymentOps.incidents.length > 0 && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                        <div className="flex items-center gap-2 text-amber-900">
                                            <AlertTriangle className="h-4 w-4" />
                                            <p className="text-sm font-black">Recent Channel Incidents</p>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            {paymentOps.incidents.slice(0, 5).map((incident) => (
                                                <p key={incident.id} className="text-xs font-semibold text-amber-900">
                                                    {incident.status?.toUpperCase()} · {incident.title}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <div>
                            <h2 className="font-bold text-slate-900">Release Policy Defaults</h2>
                            <p className="mt-1 text-xs text-slate-600">Controls whether different revenue buckets auto-release, require manual withdrawal, stay in escrow, or pause.</p>
                        </div>
                        <div className="grid gap-3">
                            {Object.entries(payoutPolicy.buckets || PAYOUT_BUCKETS).map(([bucket, label]) => (
                                <div key={bucket} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_240px] md:items-center">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{label}</p>
                                        <p className="text-xs text-slate-500">{bucket}</p>
                                    </div>
                                    <select
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        value={settings[`payout_policy_${bucket}`] || 'automatic'}
                                        onChange={(e) => set(`payout_policy_${bucket}`, e.target.value)}
                                    >
                                        {Object.entries(payoutPolicy.modes || PAYOUT_MODES).map(([mode, modeLabel]) => (
                                            <option key={mode} value={mode}>{modeLabel}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Button className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700" onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Release Policy Defaults'}
                </Button>
            </div>
        </AdminLayout>
    );
}
