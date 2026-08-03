import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Save, Settings2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

export default function GeneralSettings() {
    const { copy } = useLocale();
    const [settings, setSettings] = useState({
        kyc_enforcement_mode: 'off',
        kyc_trigger_gmv_tzs: '0',
        kyc_trigger_order_count: '0',
        catalog_item_picker_default_limit: '5',
        upload_allowed_extensions: 'jpg,jpeg,png,webp,gif,mp4,mov,webm,pdf,zip,doc,docx,xls,xlsx,ppt,pptx,csv,txt',
        upload_allowed_mime_types: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain',
        upload_max_file_mb: '500',
        analytics_retention_days: '365',
        analytics_exclude_admins: '1',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || copy('Failed to load settings.', 'Imeshindikana kupakia mipangilio.'));
                return data;
            })
            .then((data) => {
                setSettings((prev) => ({ ...prev, ...data.settings }));
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
            const res = await fetch('/admin/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({
                    kyc_enforcement_mode: settings.kyc_enforcement_mode,
                    kyc_trigger_gmv_tzs: settings.kyc_trigger_gmv_tzs,
                    kyc_trigger_order_count: settings.kyc_trigger_order_count,
                    catalog_item_picker_default_limit: settings.catalog_item_picker_default_limit,
                    upload_allowed_extensions: settings.upload_allowed_extensions,
                    upload_allowed_mime_types: settings.upload_allowed_mime_types,
                    upload_max_file_mb: settings.upload_max_file_mb,
                    analytics_retention_days: settings.analytics_retention_days,
                    analytics_exclude_admins: settings.analytics_exclude_admins,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || copy('Failed to save settings.', 'Imeshindikana kuhifadhi mipangilio.'));
            toast.success(data.message || copy('Settings saved', 'Mipangilio imehifadhiwa'));
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title={copy('General Settings', 'Mipangilio ya Jumla')}>
                <div className="flex h-64 items-center justify-center text-slate-500">{copy('Loading settings...', 'Inapakia mipangilio...')}</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={copy('General Settings', 'Mipangilio ya Jumla')}>
            <Head title={`${copy('General Settings', 'Mipangilio ya Jumla')} | Takeer`} />

            <div className="max-w-3xl space-y-8">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                        <Settings2 className="h-6 w-6 text-brand-600" /> {copy('General Settings', 'Mipangilio ya Jumla')}
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">{copy('Platform-wide controls that are not tied to AI or payout scheduling.', 'Udhibiti wa jukwaa zima usiohusiana na AI au ratiba ya malipo.')}</p>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <h2 className="font-bold text-slate-900">{copy('Commerce Defaults', 'Chaguo-msingi za Biashara')}</h2>
                        <p className="text-xs text-slate-600">{copy('Control default list size in bundle/subscription item pickers for merchants.', 'Dhibiti ukubwa wa orodha chaguo-msingi kwenye wachaguaji wa vifurushi/uanachama kwa wauzaji.')}</p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('Item Picker Default Limit', 'Kikomo cha Chaguo-msingi cha Vipengee')}</label>
                            <Input
                                type="number"
                                min="1"
                                max="20"
                                value={settings.catalog_item_picker_default_limit}
                                onChange={(e) => set('catalog_item_picker_default_limit', e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <h2 className="flex items-center gap-2 font-bold text-slate-900">
                            <ShieldCheck className="h-4 w-4 text-brand-600" /> {copy('Analytics Privacy', 'Faragha ya Takwimu')}
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('Retention Period (days)', 'Muda wa Kuhifadhi (siku)')}</label>
                                <Input
                                    type="number"
                                    min="30"
                                    max="1095"
                                    value={settings.analytics_retention_days}
                                    onChange={(e) => set('analytics_retention_days', e.target.value)}
                                />
                            </div>
                            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <input
                                    type="checkbox"
                                    checked={String(settings.analytics_exclude_admins) === '1'}
                                    onChange={(e) => set('analytics_exclude_admins', e.target.checked ? '1' : '0')}
                                    className="mt-1 h-4 w-4 rounded border-slate-300"
                                />
                                <span>
                                    <span className="block text-sm font-bold text-slate-900">{copy('Exclude admins from analytics', 'Ondoa wasimamizi kwenye takwimu')}</span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-600">{copy('Admin activity will not pollute buyer and creator reports.', 'Shughuli za wasimamizi hazitaathiri ripoti za wanunuzi na wabunifu.')}</span>
                                </span>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <h2 className="flex items-center gap-2 font-bold text-slate-900">
                            <ShieldCheck className="h-4 w-4 text-brand-600" /> {copy('Upload Policy', 'Sera ya Upakiaji')}
                        </h2>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('Max File Size (MB)', 'Ukubwa wa Juu wa Faili (MB)')}</label>
                            <Input
                                type="number"
                                min="1"
                                max="500"
                                value={settings.upload_max_file_mb}
                                onChange={(e) => set('upload_max_file_mb', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('Allowed Extensions', 'Viendelezi Vinavyoruhusiwa')}</label>
                            <textarea
                                className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                                value={settings.upload_allowed_extensions}
                                onChange={(e) => set('upload_allowed_extensions', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('Allowed MIME Types', 'Aina za MIME Zinazoruhusiwa')}</label>
                            <textarea
                                className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                                value={settings.upload_allowed_mime_types}
                                onChange={(e) => set('upload_allowed_mime_types', e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <h2 className="font-bold text-slate-900">{copy('KYC Threshold Controls', 'Udhibiti wa Viwango vya KYC')}</h2>
                        <p className="text-xs text-slate-600">{copy('Allow new merchants to sell first, then enforce KYC once thresholds are crossed.', 'Ruhusu wauzaji wapya kuuza kwanza, kisha tekeleza KYC viwango vinapovukwa.')}</p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('Enforcement Mode', 'Njia ya Utekelezaji')}</label>
                            <select
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                value={settings.kyc_enforcement_mode}
                                onChange={(e) => set('kyc_enforcement_mode', e.target.value)}
                            >
                                <option value="off">{copy('Off', 'Zima')}</option>
                                <option value="listings_and_provider_payouts">{copy('Listings + Provider Payouts', 'Matangazo + Malipo ya PSP')}</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('GMV Threshold (TZS)', 'Kiwango cha GMV (TZS)')}</label>
                                <Input type="number" min="0" value={settings.kyc_trigger_gmv_tzs} onChange={(e) => set('kyc_trigger_gmv_tzs', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{copy('Order Count Threshold', 'Kiwango cha Idadi ya Oda')}</label>
                                <Input type="number" min="0" value={settings.kyc_trigger_order_count} onChange={(e) => set('kyc_trigger_order_count', e.target.value)} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Button className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700" onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? copy('Saving...', 'Inahifadhi...') : copy('Save General Settings', 'Hifadhi Mipangilio ya Jumla')}
                </Button>
            </div>
        </AdminLayout>
    );
}
