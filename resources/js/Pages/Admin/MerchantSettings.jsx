import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ArrowLeft, Link as LinkIcon, ShieldAlert, Store } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';
const toBool = (value) => value === true || value === 1 || value === '1' || value === 'true';
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
    platform_default: 'Platform default',
    automatic: 'Automatic',
    manual_withdrawal: 'Manual withdrawal',
    escrow_hold: 'Escrow held',
    payout_paused: 'Payout paused',
};

export default function MerchantSettings({ merchantId }) {
    const [merchant, setMerchant] = useState(null);
    const [summary, setSummary] = useState(null);
    const [disabled, setDisabled] = useState(false);
    const [payoutOverrides, setPayoutOverrides] = useState({});
    const [platformDefaults, setPlatformDefaults] = useState({});
    const [payoutMeta, setPayoutMeta] = useState({ buckets: PAYOUT_BUCKETS, modes: PAYOUT_MODES });
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const title = useMemo(() => merchant?.display_name ? `${merchant.display_name} Settings` : 'Merchant Settings', [merchant]);

    const loadMerchant = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/admin/api/merchants/${merchantId}`, { headers: { Accept: 'application/json' } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load merchant settings.');
            setMerchant(data.merchant);
            setSummary(data.summary || {});
            setDisabled(toBool(data.summary?.retail_settings?.disable_pos_payment_links));
            setPayoutOverrides(data.summary?.retail_settings?.payout_controls?.overrides || {});
            setPlatformDefaults(data.summary?.payout_policy?.platform_defaults || {});
            setPayoutMeta({
                buckets: data.summary?.payout_policy?.buckets || PAYOUT_BUCKETS,
                modes: data.summary?.payout_policy?.modes || PAYOUT_MODES,
            });
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMerchant();
    }, [merchantId]);

    const saveSettings = async (payload) => {
        setSaving(true);
        try {
            const res = await fetch(`/admin/api/merchants/${merchantId}/settings`, {
                method: 'PUT',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update settings.');
            toast.success(data.message || 'Settings updated.');
            setNotes('');
            await loadMerchant();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const savePosLinks = async (nextDisabled) => {
        await saveSettings({
            disable_pos_payment_links: nextDisabled,
            reason_notes: notes,
        });
        setDisabled(nextDisabled);
    };

    const savePayoutControls = async () => {
        await saveSettings({
            payout_controls: { overrides: payoutOverrides },
            reason_notes: notes,
        });
    };

    const setPayoutOverride = (bucket, mode) => {
        setPayoutOverrides((current) => ({ ...current, [bucket]: mode }));
    };

    return (
        <AdminLayout title={title}>
            <Head title={title} />

            <div className="space-y-6">
                <div>
                    <Link href={`/admin/merchants/${merchantId}`} className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to merchant
                    </Link>
                    <div className="flex items-center gap-3 mt-2">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <Store className="h-5 w-5 text-slate-700" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{merchant?.display_name || 'Merchant Settings'}</h1>
                            <p className="text-sm text-slate-600">@{merchant?.username || '...'}</p>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                    <Metric label="Open disputes" value={summary ? `${summary.open_disputes || 0} / ${summary.total_disputes || 0}` : '...'} />
                    <Metric label="POS reports" value={summary ? `${summary.open_pos_link_reports || 0} / ${summary.pos_link_reports || 0}` : '...'} />
                    <Metric label="Merchant strikes" value={summary?.merchant_strikes ?? '...'} />
                </div>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-5 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <LinkIcon className="h-5 w-5 text-amber-700" />
                                    POS Payment Links
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    Control whether this merchant can send online payment links for POS outstanding balances.
                                </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase ${disabled ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                {disabled ? 'Disabled' : 'Enabled'}
                            </span>
                        </div>

                        {disabled && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3 text-sm text-red-800">
                                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-black">Customers cannot pay through existing POS links.</p>
                                    <p className="font-bold mt-1">The public link page shows a safety warning, and the payment API rejects payment attempts.</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin notes</label>
                            <textarea
                                rows={4}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Why are you changing this override?"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={loading || saving || !disabled}
                                onClick={() => savePosLinks(false)}
                            >
                                Enable POS Links
                            </Button>
                            <Button
                                variant="outline"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                                disabled={loading || saving || disabled}
                                onClick={() => savePosLinks(true)}
                            >
                                Disable POS Links
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-5 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5 text-amber-700" />
                                    Payout Controls
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    Override payout behavior for this merchant when abuse, copyright, or refund risk needs immediate control.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3">
                            {Object.entries(payoutMeta.buckets || PAYOUT_BUCKETS).map(([bucket, label]) => {
                                const active = payoutOverrides[bucket] || 'platform_default';
                                const platformMode = platformDefaults[bucket] || 'automatic';
                                return (
                                    <div key={bucket} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_240px] md:items-center">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{label}</p>
                                            <p className="text-xs text-slate-500">
                                                Platform default: {(payoutMeta.modes || PAYOUT_MODES)[platformMode] || platformMode}
                                            </p>
                                        </div>
                                        <select
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                            value={active}
                                            onChange={(e) => setPayoutOverride(bucket, e.target.value)}
                                        >
                                            {Object.entries(payoutMeta.modes || PAYOUT_MODES).map(([mode, modeLabel]) => (
                                                <option key={mode} value={mode}>{modeLabel}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin notes for creator notification</label>
                            <textarea
                                rows={4}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Example: Copyright report under review. Digital download payouts are held while Trust & Safety investigates."
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <Button
                            className="bg-brand-600 hover:bg-brand-700 text-white"
                            disabled={loading || saving}
                            onClick={savePayoutControls}
                        >
                            Save Payout Controls
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}

function Metric({ label, value }) {
    return (
        <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="text-xl font-black text-slate-900">{value}</p>
            </CardContent>
        </Card>
    );
}
