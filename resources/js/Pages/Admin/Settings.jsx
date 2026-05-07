import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Save, Settings2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

export default function GeneralSettings() {
    const [settings, setSettings] = useState({
        kyc_enforcement_mode: 'off',
        kyc_trigger_gmv_tzs: '0',
        kyc_trigger_order_count: '0',
        kyc_trigger_withdrawal_tzs: '0',
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
                if (!r.ok) throw new Error(data.message || 'Failed to load settings.');
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
                    kyc_trigger_withdrawal_tzs: settings.kyc_trigger_withdrawal_tzs,
                    catalog_item_picker_default_limit: settings.catalog_item_picker_default_limit,
                    upload_allowed_extensions: settings.upload_allowed_extensions,
                    upload_allowed_mime_types: settings.upload_allowed_mime_types,
                    upload_max_file_mb: settings.upload_max_file_mb,
                    analytics_retention_days: settings.analytics_retention_days,
                    analytics_exclude_admins: settings.analytics_exclude_admins,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save settings.');
            toast.success(data.message || 'Settings saved');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="General Settings">
                <div className="flex h-64 items-center justify-center text-slate-500">Loading settings...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="General Settings">
            <Head title="General Settings | Takeer" />

            <div className="max-w-3xl space-y-8">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                        <Settings2 className="h-6 w-6 text-brand-600" /> General Settings
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">Platform-wide controls that are not tied to AI or payout scheduling.</p>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <h2 className="font-bold text-slate-900">Commerce Defaults</h2>
                        <p className="text-xs text-slate-600">Control default list size in bundle/subscription item pickers for merchants.</p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Item Picker Default Limit</label>
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
                            <ShieldCheck className="h-4 w-4 text-brand-600" /> Analytics Privacy
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Retention Period (days)</label>
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
                                    <span className="block text-sm font-bold text-slate-900">Exclude admins from analytics</span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-600">Admin activity will not pollute buyer and creator reports.</span>
                                </span>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <h2 className="flex items-center gap-2 font-bold text-slate-900">
                            <ShieldCheck className="h-4 w-4 text-brand-600" /> Upload Policy
                        </h2>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Max File Size (MB)</label>
                            <Input
                                type="number"
                                min="1"
                                max="500"
                                value={settings.upload_max_file_mb}
                                onChange={(e) => set('upload_max_file_mb', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Allowed Extensions</label>
                            <textarea
                                className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                                value={settings.upload_allowed_extensions}
                                onChange={(e) => set('upload_allowed_extensions', e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Allowed MIME Types</label>
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
                        <h2 className="font-bold text-slate-900">KYC Threshold Controls</h2>
                        <p className="text-xs text-slate-600">Allow new merchants to sell first, then enforce KYC once thresholds are crossed.</p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Enforcement Mode</label>
                            <select
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                value={settings.kyc_enforcement_mode}
                                onChange={(e) => set('kyc_enforcement_mode', e.target.value)}
                            >
                                <option value="off">Off</option>
                                <option value="withdrawals_only">Withdrawals Only</option>
                                <option value="listings_and_withdrawals">Listings + Withdrawals</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">GMV Threshold (TZS)</label>
                                <Input type="number" min="0" value={settings.kyc_trigger_gmv_tzs} onChange={(e) => set('kyc_trigger_gmv_tzs', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Order Count Threshold</label>
                                <Input type="number" min="0" value={settings.kyc_trigger_order_count} onChange={(e) => set('kyc_trigger_order_count', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Withdrawal Threshold (TZS)</label>
                                <Input type="number" min="0" value={settings.kyc_trigger_withdrawal_tzs} onChange={(e) => set('kyc_trigger_withdrawal_tzs', e.target.value)} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Button className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700" onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save General Settings'}
                </Button>
            </div>
        </AdminLayout>
    );
}
