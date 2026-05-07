import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ArrowLeft, Save, ShieldCheck, WalletCards } from 'lucide-react';
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

export default function PayoutSettings() {
    const [settings, setSettings] = useState({});
    const [payoutPolicy, setPayoutPolicy] = useState({ buckets: PAYOUT_BUCKETS, modes: PAYOUT_MODES });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
    }, []);

    const set = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const buckets = payoutPolicy.buckets || PAYOUT_BUCKETS;
            const res = await fetch('/admin/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify(Object.fromEntries(
                    Object.keys(buckets).map((bucket) => [`payout_policy_${bucket}`, settings[`payout_policy_${bucket}`]])
                )),
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
                    <CardContent className="space-y-4 p-6">
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
                    {saving ? 'Saving...' : 'Save Payout Settings'}
                </Button>
            </div>
        </AdminLayout>
    );
}
