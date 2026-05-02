import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Cloud, Crown, Save, Store } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const defaults = {
    storage_access_mode: 'free',
    storage_free_mb: '500',
    storage_trial_days: '0',
    retail_access_mode: 'free',
    retail_trial_days: '0',
};

export default function AdminSubscriptions() {
    const [settings, setSettings] = useState(defaults);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Failed to load subscription settings.');
                return payload;
            })
            .then((payload) => setSettings((current) => ({ ...current, ...(payload.settings || {}) })))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    }, []);

    const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

    const save = async () => {
        setSaving(true);
        try {
            const response = await fetch('/admin/api/settings', {
                method: 'PUT',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({
                    storage_access_mode: settings.storage_access_mode,
                    storage_free_mb: settings.storage_free_mb,
                    storage_trial_days: settings.storage_trial_days,
                    retail_access_mode: settings.retail_access_mode,
                    retail_trial_days: settings.retail_trial_days,
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || 'Failed to save subscription settings.');
            toast.success(payload.message || 'Subscription settings saved.');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="Subscriptions">
                <div className="h-64 flex items-center justify-center text-slate-500 font-bold">Loading subscription controls...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Subscriptions">
            <Head title="Subscriptions | Takeer Admin" />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Crown className="h-6 w-6 text-brand-700" /> Subscriptions
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            Decide when storage and Retail Operations are free, trial-based, or paid.
                        </p>
                    </div>
                    <Link href="/admin/fee-policies">
                        <Button variant="outline" className="rounded-xl">
                            Pricing & Fees
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <SubscriptionCard
                        icon={Cloud}
                        title="Storage Access"
                        description="Control free storage allowance and whether larger storage should require a subscription."
                        mode={settings.storage_access_mode}
                        onModeChange={(value) => set('storage_access_mode', value)}
                    >
                        <Field label="Free Storage MB">
                            <Input type="number" min="0" value={settings.storage_free_mb} onChange={(e) => set('storage_free_mb', e.target.value)} />
                        </Field>
                        <Field label="Trial Days">
                            <Input type="number" min="0" max="365" value={settings.storage_trial_days} onChange={(e) => set('storage_trial_days', e.target.value)} />
                        </Field>
                    </SubscriptionCard>

                    <SubscriptionCard
                        icon={Store}
                        title="Retail Operations Access"
                        description="Control whether POS, inventory, staff, and store operations are open, trial-based, or subscription gated."
                        mode={settings.retail_access_mode}
                        onModeChange={(value) => set('retail_access_mode', value)}
                    >
                        <Field label="Trial Days">
                            <Input type="number" min="0" max="365" value={settings.retail_trial_days} onChange={(e) => set('retail_trial_days', e.target.value)} />
                        </Field>
                    </SubscriptionCard>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">How this should work</p>
                        <p className="text-sm text-slate-600 mt-2">
                            Free keeps access open. Trial then paid gives merchants temporary access before billing is required. Paid means the feature should require an active plan once enforcement is wired. Storage already has quota tracking; Retail Operations currently has module access only. The subscription price itself lives in Pricing & Fees under the Subscription category.
                        </p>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={save} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Subscription Settings'}
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
}

function SubscriptionCard({ icon: Icon, title, description, mode, onModeChange, children }) {
    return (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-0">
                <div className="p-5 border-b border-slate-200">
                    <div className="flex items-start gap-3">
                        <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                            <Icon className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="font-black text-slate-900">{title}</h2>
                            <p className="text-xs text-slate-500 mt-1">{description}</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            ['free', 'Free', 'Open access'],
                            ['trial_then_paid', 'Trial', 'Free first'],
                            ['paid', 'Paid', 'Require plan'],
                        ].map(([value, label, hint]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onModeChange(value)}
                                className={`rounded-xl border p-3 text-left transition ${mode === value ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                <p className="text-sm font-black">{label}</p>
                                <p className="text-[10px] uppercase tracking-widest font-bold mt-1">{hint}</p>
                            </button>
                        ))}
                    </div>
                    <div className="space-y-3">{children}</div>
                </div>
            </CardContent>
        </Card>
    );
}

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
            <div className="mt-1">{children}</div>
        </label>
    );
}
