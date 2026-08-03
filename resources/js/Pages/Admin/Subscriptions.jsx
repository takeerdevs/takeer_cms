import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Cloud, Crown, Save, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const defaults = {
    storage_access_mode: 'free',
    storage_free_mb: '500',
    storage_trial_days: '0',
    retail_access_mode: 'free',
    retail_trial_days: '0',
};

export default function AdminSubscriptions() {
    const { copy } = useLocale();
    const [settings, setSettings] = useState(defaults);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || copy('Failed to load subscription settings.', 'Imeshindikana kupakia mipangilio ya usajili.'));
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
            if (!response.ok) throw new Error(payload.message || copy('Failed to save subscription settings.', 'Imeshindikana kuhifadhi mipangilio ya usajili.'));
            toast.success(payload.message || copy('Subscription settings saved.', 'Mipangilio ya usajili imehifadhiwa.'));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title={copy('Subscriptions', 'Usajili')}>
                <div className="h-64 flex items-center justify-center text-slate-500 font-bold">{copy('Loading subscription controls...', 'Inapakia udhibiti wa usajili...')}</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={copy('Subscriptions', 'Usajili')}>
            <Head title={`${copy('Subscriptions', 'Usajili')} | Takeer Admin`} />

            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Crown className="h-6 w-6 text-brand-700" /> {copy('Subscriptions', 'Usajili')}
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            {copy('Decide when storage and Retail Operations are free, trial-based, or paid.', 'Amua lini hifadhi na shughuli za rejareja ziwe bure, za majaribio au za kulipia.')}
                        </p>
                    </div>
                    <Link href="/admin/fee-policies">
                        <Button variant="outline" className="rounded-xl">
                            {copy('Pricing & fees', 'Bei na ada')}
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <SubscriptionCard
                        icon={Cloud}
                        title={copy('Storage access', 'Ufikiaji wa hifadhi')}
                        description={copy('Control free storage allowance and whether larger storage should require a subscription.', 'Dhibiti kiasi cha hifadhi ya bure na kama hifadhi kubwa ihitaji usajili.')}
                        mode={settings.storage_access_mode}
                        onModeChange={(value) => set('storage_access_mode', value)}
                    >
                        <Field label={copy('Free storage MB', 'Hifadhi ya bure MB')}>
                            <Input type="number" min="0" value={settings.storage_free_mb} onChange={(e) => set('storage_free_mb', e.target.value)} />
                        </Field>
                        <Field label={copy('Trial days', 'Siku za majaribio')}>
                            <Input type="number" min="0" max="365" value={settings.storage_trial_days} onChange={(e) => set('storage_trial_days', e.target.value)} />
                        </Field>
                    </SubscriptionCard>

                    <SubscriptionCard
                        icon={Store}
                        title={copy('Retail operations access', 'Ufikiaji wa shughuli za rejareja')}
                        description={copy('Control whether POS, inventory, staff, and store operations are open, trial-based, or subscription gated.', 'Dhibiti kama POS, hesabu, wahudumu na shughuli za duka ziwe wazi, za majaribio au za usajili.')}
                        mode={settings.retail_access_mode}
                        onModeChange={(value) => set('retail_access_mode', value)}
                    >
                        <Field label={copy('Trial days', 'Siku za majaribio')}>
                            <Input type="number" min="0" max="365" value={settings.retail_trial_days} onChange={(e) => set('retail_trial_days', e.target.value)} />
                        </Field>
                    </SubscriptionCard>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{copy('How this should work', 'Jinsi hii inavyopaswa kufanya kazi')}</p>
                        <p className="text-sm text-slate-600 mt-2">
                            {copy('Free keeps access open. Trial then paid gives merchants temporary access before billing is required. Paid means the feature should require an active plan once enforcement is wired. Storage already has quota tracking; Retail Operations currently has module access only. The subscription price itself lives in Pricing & Fees under the Subscription category.', 'Bure huacha ufikiaji wazi. Majaribio kisha kulipia huwapa wafanyabiashara ufikiaji wa muda kabla ya malipo kuhitajika. Kulipia kunamaanisha kipengele kihitaji mpango hai baada ya utekelezaji wa udhibiti. Hifadhi tayari inafuatilia kiwango; shughuli za rejareja kwa sasa zina ufikiaji wa moduli pekee. Bei ya usajili iko kwenye Bei na ada chini ya kategoria ya Usajili.')}
                        </p>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={save} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" /> {saving ? copy('Saving...', 'Inahifadhi...') : copy('Save subscription settings', 'Hifadhi mipangilio ya usajili')}
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
}

function SubscriptionCard({ icon: Icon, title, description, mode, onModeChange, children }) {
    const { copy } = useLocale();
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
                            ['free', copy('Free', 'Bure'), copy('Open access', 'Ufikiaji wazi')],
                            ['trial_then_paid', copy('Trial', 'Majaribio'), copy('Free first', 'Bure kwanza')],
                            ['paid', copy('Paid', 'Kulipia'), copy('Require plan', 'Inahitaji mpango')],
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
