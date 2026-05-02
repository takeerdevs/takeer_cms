import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Calculator, CalendarClock, Layers3, Percent, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const categories = [
    { value: 'sale', label: 'Transactions' },
    { value: 'withdrawal', label: 'Withdrawals' },
    { value: 'subscription', label: 'Subscriptions' },
    { value: 'storage', label: 'Storage' },
];

const blankForm = {
    name: '',
    category: 'sale',
    scope: 'global',
    country_code: '',
    currency_code: '',
    merchant_id: '',
    payment_channel: '',
    fee_type: 'percentage',
    percentage_rate: '5',
    fixed_amount: '0',
    fixed_fee_currency_code: 'USD',
    min_fee: '',
    max_fee: '',
    unit_size_gb: '',
    billing_interval: '',
    effective_from: '',
    effective_until: '',
    is_active: true,
    notes: '',
};

export default function FeePolicies() {
    const { currencies = [] } = usePage().props;
    const [policies, setPolicies] = useState([]);
    const [activeCategory, setActiveCategory] = useState('sale');
    const [form, setForm] = useState(blankForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewAmount, setPreviewAmount] = useState('10000');

    const visiblePolicies = useMemo(
        () => policies.filter((policy) => policy.category === activeCategory),
        [policies, activeCategory]
    );
    const preview = useMemo(() => calculatePreview(form, previewAmount), [form, previewAmount]);
    const categoryMeta = categories.find((category) => category.value === form.category) || categories[0];
    const currencyOptions = useMemo(() => {
        const activeCurrencies = Array.isArray(currencies) ? currencies : [];
        return activeCurrencies.length > 0
            ? activeCurrencies
            : [{ code: 'USD', name: 'US Dollar', symbol: '$', is_base_currency: true }];
    }, [currencies]);

    const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    useEffect(() => {
        if (!currencyOptions.some((currency) => currency.code === form.fixed_fee_currency_code)) {
            set('fixed_fee_currency_code', currencyOptions[0]?.code || 'USD');
        }
    }, [currencyOptions, form.fixed_fee_currency_code]);

    const loadPolicies = () => {
        setLoading(true);
        fetch('/admin/api/fee-policies', { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(payload.message || 'Failed to load fee policies.');
                return payload;
            })
            .then((payload) => setPolicies(payload.policies || []))
            .catch((error) => toast.error(error.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadPolicies();
    }, []);

    const resetForm = (category = activeCategory) => {
        setEditingId(null);
        setForm({
            ...blankForm,
            category,
            name: category === 'sale' ? 'Standard Takeer sale fee' : '',
            percentage_rate: category === 'sale' ? '5' : '0',
        });
    };

    const editPolicy = (policy) => {
        setEditingId(policy.id);
        setActiveCategory(policy.category);
        setForm({
            name: policy.name || '',
            category: policy.category || 'sale',
            scope: policy.scope || 'global',
            country_code: policy.country_code || '',
            currency_code: policy.currency_code || '',
            merchant_id: policy.merchant_id ? String(policy.merchant_id) : '',
            payment_channel: policy.payment_channel || '',
            fee_type: policy.fee_type || 'percentage',
            percentage_rate: String(policy.percentage_rate ?? 0),
            fixed_amount: String(policy.fixed_amount ?? 0),
            fixed_fee_currency_code: policy.fixed_fee_currency_code || 'USD',
            min_fee: policy.min_fee ?? '',
            max_fee: policy.max_fee ?? '',
            unit_size_gb: policy.unit_size_gb ?? '',
            billing_interval: policy.billing_interval || '',
            effective_from: policy.effective_from ? policy.effective_from.slice(0, 16) : '',
            effective_until: policy.effective_until ? policy.effective_until.slice(0, 16) : '',
            is_active: Boolean(policy.is_active),
            notes: policy.notes || '',
        });
    };

    const savePolicy = async (event) => {
        event.preventDefault();
        setSaving(true);

        const payload = {
            ...form,
            country_code: form.country_code || null,
            currency_code: form.currency_code || null,
            merchant_id: form.merchant_id || null,
            payment_channel: form.payment_channel || null,
            fixed_fee_currency_code: form.fixed_fee_currency_code || 'USD',
            min_fee: form.min_fee === '' ? null : form.min_fee,
            max_fee: form.max_fee === '' ? null : form.max_fee,
            unit_size_gb: form.unit_size_gb === '' ? null : form.unit_size_gb,
            billing_interval: form.billing_interval || null,
            effective_from: form.effective_from || null,
            effective_until: form.effective_until || null,
        };

        try {
            const response = await fetch(editingId ? `/admin/api/fee-policies/${editingId}` : '/admin/api/fee-policies', {
                method: editingId ? 'PUT' : 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Could not save fee policy.');
            toast.success(data.message || 'Fee policy saved.');
            resetForm(payload.category);
            loadPolicies();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const deactivatePolicy = async (policy) => {
        if (!window.confirm(`Deactivate ${policy.name}?`)) return;

        const response = await fetch(`/admin/api/fee-policies/${policy.id}`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
            },
        });
        const data = await response.json();
        if (!response.ok) {
            toast.error(data.message || 'Could not deactivate policy.');
            return;
        }
        toast.success(data.message || 'Policy deactivated.');
        loadPolicies();
    };

    return (
        <AdminLayout title="Pricing & Fees">
            <Head title="Pricing & Fees | Takeer Admin" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Percent className="h-6 w-6 text-brand-700" /> Pricing & Fees
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Manage Takeer charging rules with scopes, caps, and effective dates.
                    </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {categories.map((category) => (
                        <button
                            key={category.value}
                            type="button"
                            onClick={() => {
                                setActiveCategory(category.value);
                                resetForm(category.value);
                            }}
                            className={`rounded-xl border px-4 py-3 text-left transition ${
                                activeCategory === category.value
                                    ? 'border-brand-300 bg-brand-50 text-brand-800'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <p className="text-sm font-black">{category.label}</p>
                            <p className="text-[11px] mt-1 uppercase tracking-widest font-bold">{category.value}</p>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-5 border-b border-slate-200">
                                <h2 className="font-black text-slate-900">{categories.find((c) => c.value === activeCategory)?.label} Policies</h2>
                                <p className="text-xs text-slate-500 mt-1">Most specific active policy wins: merchant, payment channel, country, currency, then global.</p>
                            </div>

                            {loading ? (
                                <div className="p-10 text-center text-slate-500 font-bold">Loading policies...</div>
                            ) : visiblePolicies.length === 0 ? (
                                <div className="p-10 text-center text-slate-500">
                                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                    <p className="font-bold">No custom policy yet.</p>
                                    <p className="text-xs mt-1">The app will use safe defaults until you add one.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {visiblePolicies.map((policy) => (
                                        <div key={policy.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-black text-slate-900">{policy.name}</p>
                                                    <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full ${policy.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {policy.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                                        {policy.scope}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {describePolicy(policy)}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {policy.payment_channel || policy.country_code || policy.currency_code || policy.merchant?.display_name || 'Global'} · Effective {formatDate(policy.effective_from) || 'now'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" onClick={() => editPolicy(policy)}>Edit</Button>
                                                <Button variant="outline" onClick={() => deactivatePolicy(policy)} disabled={!policy.is_active}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="bg-slate-900 text-white p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Policy Builder</p>
                                        <h2 className="font-black text-xl mt-1">{editingId ? 'Edit Policy' : 'New Policy'}</h2>
                                        <p className="text-xs text-slate-300 mt-1">{categoryMeta.label} · {feeTypeSummary(form)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => set('is_active', !form.is_active)}
                                        className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${form.is_active ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-700 text-slate-300'}`}
                                    >
                                        {form.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={savePolicy} className="p-5 space-y-5">
                                <BuilderSection icon={Layers3} title="Where This Applies">
                                    <Field label="Policy Name">
                                        <Input className="h-11 rounded-xl" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Example: Tanzania online sales fee" />
                                    </Field>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Category">
                                            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
                                                {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                                            </Select>
                                        </Field>
                                        <Field label="Scope">
                                            <Select value={form.scope} onChange={(e) => set('scope', e.target.value)}>
                                                <option value="global">Global</option>
                                                <option value="country">Country</option>
                                                <option value="currency">Currency</option>
                                                <option value="merchant">Merchant</option>
                                                <option value="payment_channel">Payment Channel</option>
                                            </Select>
                                        </Field>
                                    </div>

                                    {form.scope === 'country' && <Field label="Country Code"><Input className="h-11 rounded-xl uppercase" maxLength={2} value={form.country_code} onChange={(e) => set('country_code', e.target.value.toUpperCase())} placeholder="TZ" /></Field>}
                                    {form.scope === 'currency' && (
                                        <Field label="Currency">
                                            <Select value={form.currency_code} onChange={(e) => set('currency_code', e.target.value)}>
                                                <option value="">Choose currency</option>
                                                {currencyOptions.map((currency) => (
                                                    <option key={currency.code} value={currency.code}>
                                                        {currencyLabel(currency)}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>
                                    )}
                                    {form.scope === 'merchant' && <Field label="Merchant ID"><Input className="h-11 rounded-xl" type="number" value={form.merchant_id} onChange={(e) => set('merchant_id', e.target.value)} placeholder="Merchant database ID" /></Field>}
                                    {form.scope === 'payment_channel' && (
                                        <Field label="Payment Channel">
                                            <Select value={form.payment_channel} onChange={(e) => set('payment_channel', e.target.value)}>
                                                <option value="">Choose channel</option>
                                                <option value="azampay">AzamPay</option>
                                                <option value="flutterwave">Flutterwave</option>
                                                <option value="mpesa_ke">M-Pesa Kenya</option>
                                                <option value="card">Card</option>
                                                <option value="mobile_money">Mobile Money</option>
                                                <option value="cash">POS Cash</option>
                                                <option value="merchant_mobile_money">POS Merchant Mobile Money</option>
                                                <option value="online_escrow">POS Online Escrow</option>
                                                <option value="store_credit">Store Credit</option>
                                                <option value="mobile_money_payout">Mobile Money Payout</option>
                                                <option value="bank_payout">Bank Payout</option>
                                            </Select>
                                        </Field>
                                    )}
                                </BuilderSection>

                                <BuilderSection icon={Calculator} title="Fee Formula">
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            ['percentage', 'Percent', 'Amount × %'],
                                            ['fixed', 'Fixed', 'Flat charge'],
                                            ['hybrid', 'Hybrid', '% + fixed'],
                                        ].map(([value, label, help]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => set('fee_type', value)}
                                                className={`rounded-xl border p-3 text-left transition ${form.fee_type === value ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                <p className="text-sm font-black">{label}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-widest mt-1">{help}</p>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                        {feeTypeExplanation(form.fee_type)}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Percent Rate">
                                            <Input className="h-11 rounded-xl" type="number" step="0.0001" min="0" value={form.percentage_rate} onChange={(e) => set('percentage_rate', e.target.value)} disabled={form.fee_type === 'fixed'} />
                                        </Field>
                                        <Field label="Fixed Amount">
                                            <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.fixed_amount} onChange={(e) => set('fixed_amount', e.target.value)} disabled={form.fee_type === 'percentage'} />
                                        </Field>
                                    </div>

                                    {form.fee_type !== 'percentage' && (
                                        <Field label="Fixed Fee Currency">
                                            <Select value={form.fixed_fee_currency_code} onChange={(e) => set('fixed_fee_currency_code', e.target.value)}>
                                                {currencyOptions.map((currency) => (
                                                    <option key={currency.code} value={currency.code}>
                                                        {currencyLabel(currency)}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>
                                    )}

                                    {form.fee_type !== 'percentage' && (
                                        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                                            <p className="font-black uppercase tracking-widest text-[10px]">Fixed fee currency</p>
                                            <p className="mt-1">
                                                The fixed part is stored in this currency. When a transaction uses another currency, Takeer converts the fixed amount into the transaction currency using the latest FX rate before charging.
                                            </p>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                        <p className="font-black uppercase tracking-widest text-[10px]">Min / Max Caps</p>
                                        <p className="mt-1">
                                            First calculate the normal fee, then apply these caps. Min fee raises very small fees to a floor; max fee limits very large fees to a ceiling. Leave blank for no cap.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Min Fee">
                                            <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.min_fee} onChange={(e) => set('min_fee', e.target.value)} placeholder="Optional" />
                                        </Field>
                                        <Field label="Max Fee">
                                            <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.max_fee} onChange={(e) => set('max_fee', e.target.value)} placeholder="Optional" />
                                        </Field>
                                    </div>

                                    {form.category === 'storage' && (
                                        <>
                                            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                                                <p className="font-black uppercase tracking-widest text-[10px]">Storage plans</p>
                                                <p className="mt-1">
                                                    For Storage policies, Unit GB is the total plan allowance shown to merchants. Create one policy per tier, such as 50GB, 200GB, or 1TB.
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label="Plan Size GB">
                                                    <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.unit_size_gb} onChange={(e) => set('unit_size_gb', e.target.value)} />
                                                </Field>
                                                <Field label="Interval">
                                                    <Select value={form.billing_interval} onChange={(e) => set('billing_interval', e.target.value)}>
                                                        <option value="">None</option>
                                                        <option value="one_time">One-time</option>
                                                        <option value="monthly">Monthly</option>
                                                        <option value="yearly">Yearly</option>
                                                    </Select>
                                                </Field>
                                            </div>
                                        </>
                                    )}
                                </BuilderSection>

                                <BuilderSection icon={CalendarClock} title="Timing & Notes">
                                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                                        <p className="font-black uppercase tracking-widest text-[10px]">Open-ended policies</p>
                                        <p className="mt-1">
                                            If Effective Until is blank, the policy stays active indefinitely. If another overlapping policy is added, Takeer picks the most specific match first, then the newest effective policy. Set an end date when you want a clean handoff.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Effective From">
                                            <Input className="h-11 rounded-xl text-sm" type="datetime-local" value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} />
                                        </Field>
                                        <Field label="Effective Until">
                                            <Input className="h-11 rounded-xl text-sm" type="datetime-local" value={form.effective_until} onChange={(e) => set('effective_until', e.target.value)} />
                                        </Field>
                                    </div>

                                    <Field label="Notes">
                                        <textarea className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Why this policy exists, investor/accounting context, or rollout notes." />
                                    </Field>
                                </BuilderSection>

                                <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest font-black text-brand-700">Live Preview</p>
                                            <p className="text-xs text-slate-600 mt-1">{preview.formula}</p>
                                        </div>
                                        <div className="w-32">
                                            <Input className="h-10 rounded-xl bg-white" type="number" min="0" step="0.01" value={previewAmount} onChange={(e) => setPreviewAmount(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-3">
                                        <PreviewMetric label="Gross" value={preview.gross} />
                                        <PreviewMetric label="Fee" value={preview.fee} tone="text-red-600" />
                                        <PreviewMetric label="Net" value={preview.net} tone="text-emerald-700" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button type="submit" disabled={saving}>
                                        <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Policy'}
                                    </Button>
                                    {editingId && <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>}
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
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

function Select({ className = '', ...props }) {
    return (
        <select
            className={`h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${className}`}
            {...props}
        />
    );
}

function BuilderSection({ icon: Icon, title, children }) {
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-black text-slate-900">{title}</h3>
            </div>
            <div className="space-y-3">
                {children}
            </div>
        </section>
    );
}

function PreviewMetric({ label, value, tone = 'text-slate-900' }) {
    return (
        <div className="rounded-xl bg-white p-3 border border-brand-100">
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">{label}</p>
            <p className={`text-sm font-black mt-1 ${tone}`}>{formatPlain(value)}</p>
        </div>
    );
}

function describePolicy(policy) {
    const percent = Number(policy.percentage_rate || 0);
    const fixed = Number(policy.fixed_amount || 0);
    const fixedCurrency = policy.fixed_fee_currency_code || 'USD';
    if (policy.fee_type === 'fixed') return `${fixedCurrency} ${formatPlain(fixed)} fixed fee`;
    if (policy.fee_type === 'hybrid') return `${percent}% + ${fixedCurrency} ${formatPlain(fixed)} fixed`;
    return `${percent}% fee`;
}

function feeTypeSummary(form) {
    const fixedCurrency = form.fixed_fee_currency_code || 'USD';
    if (form.fee_type === 'fixed') return `${fixedCurrency} ${formatPlain(form.fixed_amount)} fixed`;
    if (form.fee_type === 'hybrid') return `${Number(form.percentage_rate || 0)}% + ${fixedCurrency} ${formatPlain(form.fixed_amount)}`;
    return `${Number(form.percentage_rate || 0)}%`;
}

function feeTypeExplanation(type) {
    if (type === 'hybrid') {
        return 'Hybrid charges a percentage of the transaction plus a fixed amount. If fixed currency differs from the transaction currency, the fixed part is converted first.';
    }
    if (type === 'fixed') {
        return 'Fixed charges the same amount regardless of transaction size. Useful for payout rails or storage bundles.';
    }
    return 'Percent charges a share of the transaction amount. This is the current default for Takeer sales fees.';
}

function currencyLabel(currency) {
    const name = currency.name ? ` - ${currency.name}` : '';
    const base = currency.is_base_currency ? ' (base)' : '';
    return `${currency.code}${name}${base}`;
}

function calculatePreview(form, rawAmount) {
    const gross = Math.max(0, Number(rawAmount || 0));
    const percent = Math.max(0, Number(form.percentage_rate || 0));
    const fixed = Math.max(0, Number(form.fixed_amount || 0));
    const minFee = form.min_fee === '' ? null : Math.max(0, Number(form.min_fee || 0));
    const maxFee = form.max_fee === '' ? null : Math.max(0, Number(form.max_fee || 0));

    let fee = 0;
    let formula = '';

    if (form.fee_type === 'fixed') {
        fee = fixed;
        formula = `${form.fixed_fee_currency_code || 'USD'} ${formatPlain(fixed)} fixed fee`;
    } else if (form.fee_type === 'hybrid') {
        const percentFee = gross * (percent / 100);
        fee = percentFee + fixed;
        formula = `${percent}% of ${formatPlain(gross)} (${formatPlain(percentFee)}) + ${form.fixed_fee_currency_code || 'USD'} ${formatPlain(fixed)}`;
    } else {
        fee = gross * (percent / 100);
        formula = `${percent}% of ${formatPlain(gross)}`;
    }

    if (minFee !== null) {
        fee = Math.max(fee, minFee);
        formula += ` · min ${formatPlain(minFee)}`;
    }
    if (maxFee !== null) {
        fee = Math.min(fee, maxFee);
        formula += ` · max ${formatPlain(maxFee)}`;
    }

    fee = Math.round(Math.min(fee, gross) * 100) / 100;

    return {
        gross,
        fee,
        net: Math.round((gross - fee) * 100) / 100,
        formula,
    };
}

function formatPlain(value) {
    return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(value) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-TZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
