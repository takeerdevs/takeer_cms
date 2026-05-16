import React, { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, useForm, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Card, CardContent } from '@/Components/ui/Card';
import { 
    ArrowLeft, 
    ShieldCheck, 
    CreditCard, 
    Globe, 
    Plus, 
    Trash2, 
    Save, 
    LayoutGrid,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CountrySettings({ country }) {
    const [activeTab, setActiveTab] = useState('general');
    
    const { data, setData, patch, processing, errors } = useForm({
        tax_label: country.tax_label || 'VAT',
        default_tax_rate: country.default_tax_rate || 0,
        is_active: country.is_active,
        settings: country.settings || {
            kyc: {
                personal: [],
                sole_proprietor: [],
                business: [],
                ngo: []
            },
            gateways: []
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        patch(`/admin/countries/${country.id}`, {
            onSuccess: () => toast.success('Settings saved successfully'),
        });
    };

    const addKycDoc = (type) => {
        const newDoc = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            fields: ['number', 'file'],
            is_required: true
        };
        
        const newKyc = { ...data.settings.kyc };
        newKyc[type] = [...(newKyc[type] || []), newDoc];
        setData('settings', { ...data.settings, kyc: newKyc });
    };

    const removeKycDoc = (type, id) => {
        const newKyc = { ...data.settings.kyc };
        newKyc[type] = newKyc[type].filter(doc => doc.id !== id);
        setData('settings', { ...data.settings, kyc: newKyc });
    };

    const updateKycDoc = (type, id, updates) => {
        const newKyc = { ...data.settings.kyc };
        newKyc[type] = newKyc[type].map(doc => doc.id === id ? { ...doc, ...updates } : doc);
        setData('settings', { ...data.settings, kyc: newKyc });
    };

    const taxDefaults = data.settings.tax_calendar_defaults || [];

    const addTaxDefault = () => {
        setData('settings', {
            ...data.settings,
            tax_calendar_defaults: [
                ...taxDefaults,
                {
                    key: Math.random().toString(36).slice(2, 9),
                    title: '',
                    type: 'custom',
                    authority: '',
                    remind_days_before: 30,
                    suggested_frequency: '',
                    description: '',
                }
            ]
        });
    };

    const updateTaxDefault = (index, updates) => {
        const next = taxDefaults.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item);
        setData('settings', { ...data.settings, tax_calendar_defaults: next });
    };

    const removeTaxDefault = (index) => {
        setData('settings', { ...data.settings, tax_calendar_defaults: taxDefaults.filter((_, itemIndex) => itemIndex !== index) });
    };

    return (
        <AdminLayout title={`${country.name} Settings`}>
            <Head title={`${country.name} Settings | Takeer Admin`} />

            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/countries" className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <span className="text-3xl">{country.flag}</span> {country.name} Settings
                            </h1>
                            <p className="text-slate-500 text-sm font-medium">Configure regional rules, KYC and payments.</p>
                        </div>
                    </div>
                    <Button onClick={handleSubmit} disabled={processing} className="h-12 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold gap-2 shadow-lg shadow-brand-600/20">
                        <Save className="h-4 w-4" /> {processing ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
                    <TabButton 
                        active={activeTab === 'general'} 
                        onClick={() => setActiveTab('general')} 
                        icon={LayoutGrid} 
                        label="General" 
                    />
                    <TabButton 
                        active={activeTab === 'kyc'} 
                        onClick={() => setActiveTab('kyc')} 
                        icon={ShieldCheck} 
                        label="KYC Rules" 
                    />
                    <TabButton 
                        active={activeTab === 'gateways'} 
                        onClick={() => setActiveTab('gateways')} 
                        icon={CreditCard} 
                        label="Gateways" 
                    />
                    <TabButton
                        active={activeTab === 'tax_calendar'}
                        onClick={() => setActiveTab('tax_calendar')}
                        icon={Globe}
                        label="Tax Calendar"
                    />
                    <TabButton 
                        active={activeTab === 'payouts'} 
                        onClick={() => setActiveTab('payouts')} 
                        icon={ArrowLeft} 
                        label="Payout Methods" 
                    />
                </div>

                {activeTab === 'general' && (
                    <Card className="rounded-3xl border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <CardContent className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Availability</h3>
                                    <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Enable Merchant Verification</p>
                                            <p className="text-xs text-slate-500">Allow users from this country to verify as sellers.</p>
                                        </div>
                                        <button 
                                            onClick={() => setData('is_active', !data.is_active)}
                                            className={cn(
                                                "w-12 h-6 rounded-full transition-colors relative",
                                                data.is_active ? "bg-emerald-500" : "bg-slate-300"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                                                data.is_active ? "right-1" : "left-1"
                                            )} />
                                        </button>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                                        <AlertCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-slate-500 leading-normal">
                                            If disabled, users can still browse and buy, but cannot complete identity verification to start selling.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Tax Configuration</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 ml-1">Tax Label</label>
                                            <Input 
                                                value={data.tax_label} 
                                                onChange={e => setData('tax_label', e.target.value)}
                                                className="h-11 rounded-xl border-slate-200"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-500 ml-1">Tax Rate (%)</label>
                                            <Input 
                                                type="number"
                                                step="0.01"
                                                value={data.default_tax_rate} 
                                                onChange={e => setData('default_tax_rate', e.target.value)}
                                                className="h-11 rounded-xl border-slate-200"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'kyc' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {['personal', 'sole_proprietor', 'business', 'ngo'].map(type => (
                            <Card key={type} className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-900 capitalize">{type.replace('_', ' ')} KYC Documents</h3>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => addKycDoc(type)}
                                        className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 gap-2 hover:bg-white"
                                    >
                                        <Plus className="h-4 w-4" /> Add Document
                                    </Button>
                                </div>
                                <CardContent className="p-6">
                                    {(!data.settings.kyc[type] || data.settings.kyc[type].length === 0) ? (
                                        <div className="text-center py-10 text-slate-400">
                                            <ShieldCheck className="h-10 w-10 mx-auto opacity-20 mb-3" />
                                            <p className="text-sm font-medium">No documents defined for this type.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {data.settings.kyc[type].map((doc) => (
                                                <div key={doc.id} className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                                                    <div className="flex-1 space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Document Name</label>
                                                                <Input 
                                                                    placeholder="e.g. NIDA, National ID, TIN"
                                                                    value={doc.name}
                                                                    onChange={e => updateKycDoc(type, doc.id, { name: e.target.value })}
                                                                    className="h-11 rounded-xl border-slate-200"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Required Fields</label>
                                                                <div className="flex flex-wrap gap-2 pt-1">
                                                                    {['number', 'front', 'back', 'file'].map(field => (
                                                                        <button
                                                                            key={field}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newFields = doc.fields.includes(field)
                                                                                    ? doc.fields.filter(f => f !== field)
                                                                                    : [...doc.fields, field];
                                                                                updateKycDoc(type, doc.id, { fields: newFields });
                                                                            }}
                                                                            className={cn(
                                                                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                                                doc.fields.includes(field)
                                                                                    ? "bg-brand-50 text-brand-600 border border-brand-100"
                                                                                    : "bg-slate-50 text-slate-400 border border-transparent hover:border-slate-200"
                                                                            )}
                                                                        >
                                                                            {field.charAt(0).toUpperCase() + field.slice(1)}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2 shrink-0">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            onClick={() => removeKycDoc(type, doc.id)}
                                                            className="rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateKycDoc(type, doc.id, { is_required: !doc.is_required })}
                                                            className={cn(
                                                                "h-10 w-10 rounded-xl border flex items-center justify-center transition-colors",
                                                                doc.is_required ? "border-amber-100 bg-amber-50 text-amber-600" : "border-slate-100 bg-slate-50 text-slate-400"
                                                            )}
                                                            title={doc.is_required ? "Required" : "Optional"}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {activeTab === 'tax_calendar' && (
                    <Card className="rounded-3xl border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900">Default Business Setup Reminders</h3>
                                <p className="text-xs text-slate-500 mt-1">These appear in Retail Ops as country-specific setup suggestions for new businesses.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={addTaxDefault} className="h-9 px-4 rounded-xl border-slate-200 text-slate-600 gap-2 hover:bg-white">
                                <Plus className="h-4 w-4" /> Add Default
                            </Button>
                        </div>
                        <CardContent className="p-6 space-y-4">
                            {taxDefaults.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Globe className="h-10 w-10 mx-auto opacity-20 mb-3" />
                                    <p className="text-sm font-medium">No country reminder defaults set.</p>
                                </div>
                            ) : taxDefaults.map((item, index) => (
                                <div key={item.key || index} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input value={item.title || ''} onChange={(e) => updateTaxDefault(index, { title: e.target.value })} placeholder="Title e.g. Annual return estimate" className="h-11 rounded-xl border-slate-200" />
                                        <Input value={item.authority || ''} onChange={(e) => updateTaxDefault(index, { authority: e.target.value })} placeholder="Authority e.g. TRA, PDPC, TCRA" className="h-11 rounded-xl border-slate-200" />
                                        <select value={item.type || 'custom'} onChange={(e) => updateTaxDefault(index, { type: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold bg-white">
                                            <option value="annual_return">Annual Return</option>
                                            <option value="tax_filing">Tax Filing</option>
                                            <option value="license_renewal">License Renewal</option>
                                            <option value="payroll_tax">Payroll Tax</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                        <Input type="number" min="0" max="365" value={item.remind_days_before ?? 30} onChange={(e) => updateTaxDefault(index, { remind_days_before: e.target.value })} placeholder="Remind days before" className="h-11 rounded-xl border-slate-200" />
                                        <Input value={item.suggested_frequency || ''} onChange={(e) => updateTaxDefault(index, { suggested_frequency: e.target.value })} placeholder="Suggested frequency" className="h-11 rounded-xl border-slate-200" />
                                        <Input value={item.description || ''} onChange={(e) => updateTaxDefault(index, { description: e.target.value })} placeholder="Short guidance" className="h-11 rounded-xl border-slate-200" />
                                    </div>
                                    <div className="flex justify-end mt-3">
                                        <Button type="button" variant="outline" size="sm" onClick={() => removeTaxDefault(index)} className="rounded-xl text-red-600 border-red-100">
                                            <Trash2 className="h-4 w-4 mr-1" /> Remove
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'gateways' && (
                    <Card className="rounded-3xl border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <CardContent className="p-12 text-center">
                            <div className="h-20 w-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-6">
                                <CreditCard className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Payment Gateways</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2 font-medium">Coming soon: Route card payments via Global Drivers (Stripe/DPO) and Mobile Money via Local Drivers (Selcom).</p>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'payouts' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900">Supported Payout Methods</h3>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => {
                                            const newPayouts = { ...(data.settings.payouts || {}) };
                                            newPayouts.mobile_money = { enabled: true, carriers: [] };
                                            setData('settings', { ...data.settings, payouts: newPayouts });
                                        }}
                                        className="rounded-xl"
                                    >+ Mobile Money</Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => {
                                            const newPayouts = { ...(data.settings.payouts || {}) };
                                            newPayouts.bank = { enabled: true, banks: [] };
                                            setData('settings', { ...data.settings, payouts: newPayouts });
                                        }}
                                        className="rounded-xl"
                                    >+ Bank Account</Button>
                                </div>
                            </div>
                            <CardContent className="p-8 space-y-8">
                                {data.settings.payouts?.mobile_money?.enabled && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-slate-900">Mobile Money Carriers</h4>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                const newPayouts = { ...data.settings.payouts };
                                                delete newPayouts.mobile_money;
                                                setData('settings', { ...data.settings, payouts: newPayouts });
                                            }} className="text-red-500 h-8 px-2">Remove</Button>
                                        </div>
                                        <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
                                            <div className="flex flex-wrap gap-2">
                                                {(data.settings.payouts.mobile_money.carriers || []).map((carrier, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                                                        {carrier}
                                                        <button onClick={() => {
                                                            const newCarriers = data.settings.payouts.mobile_money.carriers.filter((_, i) => i !== idx);
                                                            const newPayouts = { ...data.settings.payouts };
                                                            newPayouts.mobile_money.carriers = newCarriers;
                                                            setData('settings', { ...data.settings, payouts: newPayouts });
                                                        }}><Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <Input 
                                                    id="new-carrier" 
                                                    placeholder="Add carrier (e.g. M-Pesa)" 
                                                    className="h-10 rounded-xl"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = e.target.value.trim();
                                                            if (!val) return;
                                                            const newCarriers = [...(data.settings.payouts.mobile_money.carriers || []), val];
                                                            const newPayouts = { ...data.settings.payouts };
                                                            newPayouts.mobile_money.carriers = newCarriers;
                                                            setData('settings', { ...data.settings, payouts: newPayouts });
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {data.settings.payouts?.bank?.enabled && (
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-slate-900">Supported Banks</h4>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                const newPayouts = { ...data.settings.payouts };
                                                delete newPayouts.bank;
                                                setData('settings', { ...data.settings, payouts: newPayouts });
                                            }} className="text-red-500 h-8 px-2">Remove</Button>
                                        </div>
                                        <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
                                            <div className="flex flex-wrap gap-2">
                                                {(data.settings.payouts.bank.banks || []).map((bank, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                                                        {bank}
                                                        <button onClick={() => {
                                                            const newBanks = data.settings.payouts.bank.banks.filter((_, i) => i !== idx);
                                                            const newPayouts = { ...data.settings.payouts };
                                                            newPayouts.bank.banks = newBanks;
                                                            setData('settings', { ...data.settings, payouts: newPayouts });
                                                        }}><Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <Input 
                                                id="new-bank" 
                                                placeholder="Add bank (e.g. CRDB Bank)" 
                                                className="h-10 rounded-xl"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const val = e.target.value.trim();
                                                        if (!val) return;
                                                        const newBanks = [...(data.settings.payouts.bank.banks || []), val];
                                                        const newPayouts = { ...data.settings.payouts };
                                                        newPayouts.bank.banks = newBanks;
                                                        setData('settings', { ...data.settings, payouts: newPayouts });
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function TabButton({ active, onClick, icon: Icon, label }) {
    return (
        <button 
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                active 
                    ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}
