import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import { 
    Settings, 
    Shield, 
    Percent, 
    CreditCard, 
    Smartphone, 
    Save,
    ChevronLeft,
    Clock,
    ReceiptText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Switch } from '@/Components/ui/Switch';
import { Label } from '@/Components/ui/Label';
import { toast } from 'sonner';

export default function RetailSettings({ merchant }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        max_no_pin_discount_percent: 5,
        require_pin_for_partial_payment: true,
        allow_remote_approval: true,
        allow_online_reservation: false,
        reservation_max_hours: 24
    });
    const [fiscalData, setFiscalData] = useState({ regimes: [], integrations: [], country: null });
    const [fiscalForm, setFiscalForm] = useState({
        fiscal_regime_id: '',
        fiscal_provider_id: '',
        status: 'draft',
        mode: 'test',
        tin: '',
        vrn: '',
        branch_code: '',
        device_serial: '',
        provider_access_expires_at: '',
        credentials: {
            api_key: '',
            username: '',
            password: '',
        },
    });
    const [savingFiscal, setSavingFiscal] = useState(false);
    const receiptSummary = fiscalData.receipt_summary || {};
    const recentReceipts = fiscalData.receipts || [];

    const fetchSettings = async () => {
        try {
            const res = await window.axios.get('/api/retail/settings');
            const fiscalRes = await window.axios.get('/api/retail/fiscal-integrations');
            if (res.data.data) {
                setSettings(res.data.data);
            }
            setFiscalData(fiscalRes.data);
            const existing = fiscalRes.data.integrations?.[0];
            const firstRegime = fiscalRes.data.regimes?.[0];
            const firstProvider = firstRegime?.providers?.[0];
            setFiscalForm((prev) => ({
                ...prev,
                fiscal_regime_id: existing?.fiscal_regime_id || firstRegime?.id || '',
                fiscal_provider_id: existing?.fiscal_provider_id || firstProvider?.id || '',
                status: existing?.status || 'draft',
                mode: existing?.mode || 'test',
                tin: existing?.tin || '',
                vrn: existing?.vrn || '',
                branch_code: existing?.branch_code || '',
                device_serial: existing?.device_serial || '',
                provider_access_expires_at: existing?.provider_access_expires_at?.slice(0, 10) || '',
            }));
        } catch (err) {
            console.error('Failed to load settings', err);
        } finally {
            setLoading(false);
        }
    };

    const selectedRegime = fiscalData.regimes?.find((regime) => Number(regime.id) === Number(fiscalForm.fiscal_regime_id));
    const providers = selectedRegime?.providers || [];

    const handleSaveFiscal = async () => {
        setSavingFiscal(true);
        try {
            await window.axios.post('/api/retail/fiscal-integrations', fiscalForm);
            toast.success('Fiscal receipt integration saved.');
            fetchSettings();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save fiscal receipt integration.');
        } finally {
            setSavingFiscal(false);
        }
    };

    const handleRetryReceipt = async (receipt) => {
        try {
            await window.axios.post(`/api/retail/fiscal-receipts/${receipt.id}/retry`);
            toast.success('Fiscal receipt retry attempted.');
            fetchSettings();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Retry failed.');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await window.axios.patch('/api/retail/settings', settings);
            toast.success('Mipangilio imehifadhiwa kikamilifu!');
        } catch (err) {
            toast.error('Imeshindwa kuhifadhi mipangilio.');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    if (loading) return null;

    return (
        <AppLayout>
            <Head title="Retail Settings | Takeer" />
            
            <div className="max-w-4xl mx-auto py-8 px-4 md:px-6">
                <div className="flex items-center gap-4 mb-8">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-xl"
                        onClick={() => window.history.back()}
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-brand-900">Retail Settings</h1>
                        <p className="text-muted-foreground font-medium">Configure POS operational limits and approvals.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Discount Thresholds */}
                    <Card className="border-none shadow-xl shadow-brand-500/5 rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-brand-50 to-white pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                                <Percent className="h-6 w-6 text-brand-600" />
                            </div>
                            <CardTitle className="text-xl font-black">Discount Thresholds</CardTitle>
                            <CardDescription className="font-medium">
                                Control how much discount staff can give without manager PIN.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Max No-PIN Discount (%)</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Staff can bargain up to this percentage without needing approval.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input 
                                        type="number"
                                        className="w-24 h-12 rounded-xl text-center font-black text-brand-600 border-brand-100"
                                        value={settings.max_no_pin_discount_percent}
                                        onChange={(e) => setSettings({...settings, max_no_pin_discount_percent: parseInt(e.target.value)})}
                                    />
                                    <span className="font-black text-brand-900">%</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Operational Security */}
                    <Card className="border-none shadow-xl shadow-brand-500/5 rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-brand-50 to-white pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                                <Shield className="h-6 w-6 text-brand-600" />
                            </div>
                            <CardTitle className="text-xl font-black">Operational Security</CardTitle>
                            <CardDescription className="font-medium">
                                Manage PIN requirements and remote overrides.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">PIN for Partial Payments</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Require an approval PIN whenever an order is not fully paid (Credit/Deni).</p>
                                </div>
                                <Switch 
                                    checked={settings.require_pin_for_partial_payment}
                                    onCheckedChange={(val) => setSettings({...settings, require_pin_for_partial_payment: val})}
                                />
                            </div>

                            <div className="h-px bg-brand-50"></div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Allow Remote Approval</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Allow staff to request approval via notification when manager is away.</p>
                                </div>
                                <Switch 
                                    checked={settings.allow_remote_approval}
                                    onCheckedChange={(val) => setSettings({...settings, allow_remote_approval: val})}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Online Reservation & Fulfillment */}
                    <Card className="border-none shadow-xl shadow-brand-500/5 rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-brand-50 to-white pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                                <Clock className="h-6 w-6 text-brand-600" />
                            </div>
                            <CardTitle className="text-xl font-black">Online Reservation</CardTitle>
                            <CardDescription className="font-medium">
                                Enable customers to reserve items online via partial payments.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Allow Online Reservations</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Enable 'Pay Later' / Partial payment for online orders (Reservations).</p>
                                </div>
                                <Switch 
                                    checked={settings.allow_online_reservation}
                                    onCheckedChange={(val) => setSettings({...settings, allow_online_reservation: val})}
                                />
                            </div>

                            <div className="h-px bg-brand-50"></div>

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black uppercase tracking-wider text-brand-900">Reservation Limit (Hours)</Label>
                                    <p className="text-xs text-muted-foreground font-medium">Maximum time allowed to complete payment before order expires.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input 
                                        type="number"
                                        className="w-24 h-12 rounded-xl text-center font-black text-brand-600 border-brand-100"
                                        value={settings.reservation_max_hours}
                                        onChange={(e) => setSettings({...settings, reservation_max_hours: parseInt(e.target.value)})}
                                    />
                                    <span className="font-black text-brand-900 text-sm">Hours</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-brand-500/5 rounded-[32px] overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-brand-50 to-white pb-6">
                            <div className="h-12 w-12 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                                <ReceiptText className="h-6 w-6 text-brand-600" />
                            </div>
                            <CardTitle className="text-xl font-black">Fiscal Receipts</CardTitle>
                            <CardDescription className="font-medium">
                                Connect a country-specific fiscal receipt provider. Receipts are issued under this merchant's tax identity.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            {!fiscalData.country ? (
                                <p className="text-sm font-bold text-amber-700">Set the merchant country before configuring fiscal receipts.</p>
                            ) : fiscalData.regimes?.length === 0 ? (
                                <p className="text-sm font-bold text-slate-600">No fiscal receipt regime is configured for {fiscalData.country.name} yet.</p>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Field label="Country">
                                            <Input value={`${fiscalData.country.name} (${fiscalData.country.iso_alpha2})`} disabled className="rounded-xl" />
                                        </Field>
                                        <Field label="Fiscal Regime">
                                            <select
                                                value={fiscalForm.fiscal_regime_id}
                                                onChange={(e) => {
                                                    const regime = fiscalData.regimes.find((item) => Number(item.id) === Number(e.target.value));
                                                    setFiscalForm({
                                                        ...fiscalForm,
                                                        fiscal_regime_id: e.target.value,
                                                        fiscal_provider_id: regime?.providers?.[0]?.id || '',
                                                    });
                                                }}
                                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full"
                                            >
                                                {fiscalData.regimes.map((regime) => (
                                                    <option key={regime.id} value={regime.id}>{regime.name}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Provider">
                                            <select
                                                value={fiscalForm.fiscal_provider_id}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, fiscal_provider_id: e.target.value })}
                                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full"
                                            >
                                                {providers.map((provider) => (
                                                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Mode">
                                            <select
                                                value={fiscalForm.mode}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, mode: e.target.value })}
                                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full"
                                            >
                                                <option value="test">Test</option>
                                                <option value="live">Live</option>
                                            </select>
                                        </Field>
                                        <Field label="TIN">
                                            <Input value={fiscalForm.tin} onChange={(e) => setFiscalForm({ ...fiscalForm, tin: e.target.value })} className="rounded-xl" />
                                        </Field>
                                        <Field label="VRN">
                                            <Input value={fiscalForm.vrn} onChange={(e) => setFiscalForm({ ...fiscalForm, vrn: e.target.value })} className="rounded-xl" />
                                        </Field>
                                        <Field label="Branch Code">
                                            <Input value={fiscalForm.branch_code} onChange={(e) => setFiscalForm({ ...fiscalForm, branch_code: e.target.value })} className="rounded-xl" />
                                        </Field>
                                        <Field label="Device Serial">
                                            <Input value={fiscalForm.device_serial} onChange={(e) => setFiscalForm({ ...fiscalForm, device_serial: e.target.value })} className="rounded-xl" />
                                        </Field>
                                        <Field label="Provider Access Expires">
                                            <Input type="date" value={fiscalForm.provider_access_expires_at} onChange={(e) => setFiscalForm({ ...fiscalForm, provider_access_expires_at: e.target.value })} className="rounded-xl" />
                                        </Field>
                                        <Field label="API Key">
                                            <Input type="password" value={fiscalForm.credentials.api_key} onChange={(e) => setFiscalForm({ ...fiscalForm, credentials: { ...fiscalForm.credentials, api_key: e.target.value } })} className="rounded-xl" />
                                        </Field>
                                        <Field label="Username">
                                            <Input value={fiscalForm.credentials.username} onChange={(e) => setFiscalForm({ ...fiscalForm, credentials: { ...fiscalForm.credentials, username: e.target.value } })} className="rounded-xl" />
                                        </Field>
                                        <Field label="Password">
                                            <Input type="password" value={fiscalForm.credentials.password} onChange={(e) => setFiscalForm({ ...fiscalForm, credentials: { ...fiscalForm.credentials, password: e.target.value } })} className="rounded-xl" />
                                        </Field>
                                        <Field label="Status">
                                            <select
                                                value={fiscalForm.status}
                                                onChange={(e) => setFiscalForm({ ...fiscalForm, status: e.target.value })}
                                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white w-full"
                                            >
                                                <option value="draft">Draft</option>
                                                <option value="active">Active</option>
                                                <option value="paused">Paused</option>
                                            </select>
                                        </Field>
                                    </div>

                                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                                        <p className="text-xs font-bold text-amber-800">
                                            Provider adapters are staged until official API documentation and credentials are configured. Sales will create fiscal receipt records without blocking checkout.
                                        </p>
                                    </div>

                                    {fiscalData.manual_fallback?.enabled && (
                                        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                                            <p className="text-sm font-black text-slate-900">Manual receipt fallback is active</p>
                                            <p className="text-xs font-bold text-slate-600 mt-1">
                                                {fiscalData.manual_fallback.message}
                                            </p>
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt monitor</p>
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
                                            {[
                                                ['Issued', receiptSummary.issued || 0],
                                                ['Queued', receiptSummary.queued || 0],
                                                ['Pending', receiptSummary.pending || 0],
                                                ['Provider pending', receiptSummary.provider_pending || 0],
                                                ['Manual fallback', receiptSummary.manual_fallback || 0],
                                                ['Failed', receiptSummary.failed || 0],
                                                ['Voided', receiptSummary.voided || 0],
                                            ].map(([label, value]) => (
                                                <div key={label} className="rounded-xl bg-white border border-slate-100 p-3">
                                                    <p className="text-lg font-black text-slate-950">{value}</p>
                                                    <p className="text-[9px] font-bold text-slate-500 mt-1">{label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 divide-y divide-slate-200 rounded-2xl overflow-hidden border border-slate-200 bg-white">
                                            {recentReceipts.length === 0 ? (
                                                <p className="p-4 text-xs font-bold text-slate-500">No fiscal receipt records yet.</p>
                                            ) : recentReceipts.map((receipt) => (
                                                <div key={receipt.id} className="p-3 flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-slate-900 truncate">
                                                            {receipt.order?.public_id ? `Order ${receipt.order.public_id}` : `Receipt #${receipt.id}`}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-slate-500 truncate">
                                                            {receipt.provider?.name || 'Provider'} • {receipt.status}
                                                        </p>
                                                    </div>
                                                    {['failed', 'provider_pending', 'pending', 'queued'].includes(receipt.status) && (
                                                        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => handleRetryReceipt(receipt)}>
                                                            Retry
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button variant="outline" className="rounded-xl" onClick={handleSaveFiscal} disabled={savingFiscal || !fiscalForm.fiscal_provider_id}>
                                            {savingFiscal ? 'Saving...' : 'Save Fiscal Integration'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button 
                            className="h-14 px-10 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-lg shadow-xl shadow-brand-600/20"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Inahifadhi...' : (
                                <>Hifadhi Mabadiliko <Save className="ml-2 h-5 w-5" /></>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function Field({ label, children }) {
    return (
        <label className="space-y-1.5 block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
            {children}
        </label>
    );
}
