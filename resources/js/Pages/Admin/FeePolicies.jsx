import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Calculator, CalendarClock, Layers3, Percent, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const categories = [
    { value: 'sale', label: 'Transactions' },
    { value: 'subscription', label: 'Subscriptions' },
    { value: 'storage', label: 'Storage' },
];

const sellableTypes = [
    { value: 'physical', label: 'Physical products' },
    { value: 'digital', label: 'Digital downloads' },
    { value: 'service', label: 'Services' },
];

const blankForm = {
    name: '',
    category: 'sale',
    scope: 'global',
    country_code: '',
    currency_code: '',
    merchant_id: '',
    payment_channel: '',
    sellable_type: '',
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
    const { copy } = useLocale();
    const { currencies = [], paymentChannels: initialPaymentChannels = [] } = usePage().props;
    const [policies, setPolicies] = useState([]);
    const [activeCategory, setActiveCategory] = useState('sale');
    const [form, setForm] = useState(blankForm);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewAmount, setPreviewAmount] = useState('10000');
    const [paymentChannels, setPaymentChannels] = useState(initialPaymentChannels);

    const visiblePolicies = useMemo(
        () => policies.filter((policy) => policy.category === activeCategory),
        [policies, activeCategory]
    );
    const preview = useMemo(() => calculatePreview(form, previewAmount, copy), [form, previewAmount, copy]);
    const categoryMeta = categories.find((category) => category.value === form.category) || categories[0];
    const currencyOptions = useMemo(() => {
        const activeCurrencies = Array.isArray(currencies) ? currencies : [];
        return activeCurrencies.length > 0
            ? activeCurrencies
            : [{ code: 'USD', name: 'US Dollar', symbol: '$', is_base_currency: true }];
    }, [currencies]);
    const paymentChannelOptions = useMemo(
        () => paymentChannels.filter((channel) => channel.direction === categoryDirection(form.category)),
        [paymentChannels, form.category]
    );
    const paymentChannelByKey = useMemo(
        () => Object.fromEntries(paymentChannels.map((channel) => [channel.key, channel])),
        [paymentChannels]
    );

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
                if (!response.ok) throw new Error(payload.message || copy('Failed to load fee policies.', 'Imeshindikana kupakia sera za ada.'));
                return payload;
            })
            .then((payload) => {
                setPolicies(payload.policies || []);
                setPaymentChannels(payload.payment_channels || []);
            })
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
            sellable_type: policy.sellable_type || '',
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
            payment_channel: form.scope === 'payment_channel' ? form.payment_channel || null : null,
            sellable_type: form.scope === 'sellable_type' ? form.sellable_type || null : null,
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
            toast.success(data.message || copy('Fee policy saved.', 'Sera ya ada imehifadhiwa.'));
            resetForm(payload.category);
            loadPolicies();
        } catch (error) {
            toast.error(error.message || copy('Failed to save fee policy.', 'Imeshindikana kuhifadhi sera ya ada.'));
        } finally {
            setSaving(false);
        }
    };

    const deactivatePolicy = async (policy) => {
        if (!window.confirm(`${copy('Deactivate', 'Zima')} ${policy.name}?`)) return;

        const response = await fetch(`/admin/api/fee-policies/${policy.id}`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content,
            },
        });
        const data = await response.json();
        if (!response.ok) {
            toast.error(data.message || copy('Could not deactivate policy.', 'Imeshindikana kuzima sera.'));
            return;
        }
        toast.success(data.message || copy('Policy deactivated.', 'Sera imezimwa.'));
        loadPolicies();
    };

    return (
        <AdminLayout title={copy('Pricing & fees', 'Bei na ada')}>
            <Head title={`${copy('Pricing & fees', 'Bei na ada')} | Takeer Admin`} />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Percent className="h-6 w-6 text-brand-700" /> {copy('Pricing & fees', 'Bei na ada')}
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        {copy('Manage merchant-facing Takeer fees with scopes, caps, and effective dates. Provider rail costs and hard limits live in Payment Providers.', 'Simamia ada za Takeer zinazoonekana kwa wafanyabiashara pamoja na maeneo, viwango vya juu na tarehe za kuanza. Gharama na viwango vya juu vya mtoa huduma viko kwenye Watoa huduma wa malipo.')}
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
                            <p className="text-sm font-black">{copy(category.label, category.value === 'sale' ? 'Miamala' : category.value === 'subscription' ? 'Usajili' : 'Hifadhi')}</p>
                            <p className="text-[11px] mt-1 uppercase tracking-widest font-bold">{category.value}</p>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5 items-start">
                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-5 border-b border-slate-200">
                                <h2 className="font-black text-slate-900">{copy(categories.find((c) => c.value === activeCategory)?.label || 'Policies', activeCategory === 'sale' ? 'Sera za miamala' : activeCategory === 'subscription' ? 'Sera za usajili' : 'Sera za hifadhi')}</h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    {copy('Most specific active policy wins. Marketplace fee policies are Takeer markup; provider payout cost is added from Payment Providers.', 'Sera hai iliyo maalum zaidi ndiyo hutumika. Sera za ada za soko ni ongezeko la Takeer; gharama ya malipo kwa mtoa huduma huongezwa kutoka kwa Watoa huduma wa malipo.')}
                                </p>
                            </div>

                            {loading ? (
                                <div className="p-10 text-center text-slate-500 font-bold">{copy('Loading policies...', 'Inapakia sera...')}</div>
                            ) : visiblePolicies.length === 0 ? (
                                <div className="p-10 text-center text-slate-500">
                                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                    <p className="font-bold">{copy('No custom policy yet.', 'Hakuna sera maalum bado.')}</p>
                                    <p className="text-xs mt-1">{copy('The app will use safe defaults until you add one.', 'Programu itatumia mipangilio salama ya awali hadi uongeze sera.')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {visiblePolicies.map((policy) => (
                                        <div key={policy.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-black text-slate-900">{policy.name}</p>
                                                    <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full ${policy.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {policy.is_active ? copy('Active', 'Hai') : copy('Inactive', 'Si hai')}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                                                        {policyScopeBadge(policy, copy)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {describePolicy(policy, copy)}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {policyScopeLabel(policy, paymentChannelByKey, copy)} · {copy('Effective', 'Inaanza')} {formatDate(policy.effective_from) || copy('now', 'sasa')}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                    <Button variant="outline" onClick={() => editPolicy(policy)}>{copy('Edit', 'Hariri')}</Button>
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
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">{copy('Policy Builder', 'Mjenzi wa sera')}</p>
                                        <h2 className="font-black text-xl mt-1">{editingId ? copy('Edit Policy', 'Hariri sera') : copy('New Policy', 'Sera mpya')}</h2>
                                        <p className="text-xs text-slate-300 mt-1">{copy(categoryMeta.label, categoryMeta.value === 'sale' ? 'Miamala' : categoryMeta.value === 'subscription' ? 'Usajili' : 'Hifadhi')} · {feeTypeSummary(form, copy)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => set('is_active', !form.is_active)}
                                        className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${form.is_active ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-700 text-slate-300'}`}
                                    >
                                        {form.is_active ? copy('Active', 'Hai') : copy('Inactive', 'Si hai')}
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={savePolicy} className="p-5 space-y-5">
                                <BuilderSection icon={Layers3} title={copy('Where this applies', 'Inapotumika')}>
                                    <Field label={copy('Policy Name', 'Jina la sera')}>
                                        <Input className="h-11 rounded-xl" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder={copy('Example: Tanzania online sales fee', 'Mfano: ada ya mauzo ya mtandaoni Tanzania')} />
                                    </Field>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label={copy('Category', 'Kategoria')}>
                                            <Select value={form.category} onChange={(e) => {
                                                const category = e.target.value;
                                                setForm((current) => ({
                                                    ...current,
                                                    category,
                                                    scope: category !== 'sale' && current.scope === 'sellable_type' ? 'global' : current.scope,
                                                    payment_channel: '',
                                                    sellable_type: category === 'sale' ? current.sellable_type : '',
                                                }));
                                            }}>
                                                {categories.map((category) => <option key={category.value} value={category.value}>{copy(category.label, category.value === 'sale' ? 'Miamala' : category.value === 'subscription' ? 'Usajili' : 'Hifadhi')}</option>)}
                                            </Select>
                                        </Field>
                                        <Field label={copy('Scope', 'Wigo')}>
                                            <Select value={form.scope} onChange={(e) => setForm((current) => ({ ...current, scope: e.target.value, payment_channel: '', sellable_type: '' }))}>
                                                <option value="global">{copy('Global', 'Jumla')}</option>
                                                {form.category === 'sale' && <option value="sellable_type">{copy('Sellable Type', 'Aina ya bidhaa')}</option>}
                                                <option value="country">{copy('Country', 'Nchi')}</option>
                                                <option value="currency">{copy('Currency', 'Sarafu')}</option>
                                                <option value="merchant">{copy('Merchant', 'Muuzaji')}</option>
                                                <option value="payment_channel">{copy('Payment Channel', 'Njia ya malipo')}</option>
                                            </Select>
                                        </Field>
                                    </div>

                                    {form.scope === 'country' && <Field label={copy('Country Code', 'Msimbo wa nchi')}><Input className="h-11 rounded-xl uppercase" maxLength={2} value={form.country_code} onChange={(e) => set('country_code', e.target.value.toUpperCase())} placeholder="TZ" /></Field>}
                                    {form.scope === 'sellable_type' && (
                                        <Field label={copy('Sellable Type', 'Aina ya bidhaa')}>
                                            <Select value={form.sellable_type} onChange={(e) => set('sellable_type', e.target.value)}>
                                                <option value="">{copy('Choose sellable type', 'Chagua aina ya bidhaa')}</option>
                                                {sellableTypes.map((type) => (
                                                    <option key={type.value} value={type.value}>{copy(type.label, type.value === 'physical' ? 'Bidhaa halisi' : type.value === 'digital' ? 'Upakuaji wa kidijitali' : 'Huduma')}</option>
                                                ))}
                                            </Select>
                                            <p className="mt-2 text-xs font-semibold text-slate-500">
                                                {copy('Use this to set different sale fees for digital downloads, physical products, and services.', 'Tumia kuweka ada tofauti za mauzo kwa upakuaji wa kidijitali, bidhaa halisi na huduma.')}
                                            </p>
                                        </Field>
                                    )}
                                    {form.scope === 'currency' && (
                                        <Field label={copy('Currency', 'Sarafu')}>
                                            <Select value={form.currency_code} onChange={(e) => set('currency_code', e.target.value)}>
                                                <option value="">{copy('Choose currency', 'Chagua sarafu')}</option>
                                                {currencyOptions.map((currency) => (
                                                    <option key={currency.code} value={currency.code}>
                                                        {currencyLabel(currency)}
                                                    </option>
                                                ))}
                                            </Select>
                                        </Field>
                                    )}
                                    {form.scope === 'merchant' && <Field label="Merchant ID"><Input className="h-11 rounded-xl" type="number" value={form.merchant_id} onChange={(e) => set('merchant_id', e.target.value)} placeholder={copy('Merchant database ID', 'Namba ya mfanyabiashara kwenye hifadhidata')} /></Field>}
                                    {form.scope === 'payment_channel' && (
                                        <Field label={copy('Payment Channel', 'Njia ya malipo')}>
                                            <Select value={form.payment_channel} onChange={(e) => set('payment_channel', e.target.value)}>
                                                <option value="">{copy('Choose channel', 'Chagua njia')}</option>
                                                {paymentChannelOptions.map((channel) => (
                                                    <option key={channel.key} value={channel.key}>
                                                        {paymentChannelLabel(channel)}
                                                    </option>
                                                ))}
                                            </Select>
                                            {paymentChannelOptions.length === 0 && (
                                                <p className="mt-2 text-xs font-semibold text-amber-700">
                                                    {paymentChannels.length === 0
                                                        ? copy('Provider channels are still loading. If this stays empty, check Payment Providers.', 'Njia za mtoa huduma bado zinapakiwa. Ikiendelea kuwa tupu, angalia Watoa Huduma za Malipo.')
                                                        : copy('No provider channels are configured for this category.', 'Hakuna njia za mtoa huduma zilizowekwa kwa kategoria hii.')}
                                                </p>
                                            )}
                                        </Field>
                                    )}
                                </BuilderSection>

                                <BuilderSection icon={Calculator} title={copy('Fee Formula', 'Mfumo wa ada')}>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            ['percentage', copy('Percent', 'Asilimia'), copy('Amount × %', 'Kiasi × %')],
                                            ['fixed', copy('Fixed', 'Iliyowekwa'), copy('Flat charge', 'Ada tambarare')],
                                            ['hybrid', copy('Hybrid', 'Mchanganyiko'), copy('% + fixed', '% + ada iliyowekwa')],
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
                                        {feeTypeExplanation(form.fee_type, copy)}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label={copy('Percent Rate', 'Kiwango cha asilimia')}>
                                            <Input className="h-11 rounded-xl" type="number" step="0.0001" min="0" value={form.percentage_rate} onChange={(e) => set('percentage_rate', e.target.value)} disabled={form.fee_type === 'fixed'} />
                                        </Field>
                                        <Field label={copy('Fixed Amount', 'Kiasi kilichowekwa')}>
                                            <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.fixed_amount} onChange={(e) => set('fixed_amount', e.target.value)} disabled={form.fee_type === 'percentage'} />
                                        </Field>
                                    </div>

                                    {form.fee_type !== 'percentage' && (
                                        <Field label={copy('Fixed Fee Currency', 'Sarafu ya ada iliyowekwa')}>
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
                                            <p className="font-black uppercase tracking-widest text-[10px]">{copy('Fixed fee currency', 'Sarafu ya ada iliyowekwa')}</p>
                                            <p className="mt-1">
                                                {copy('The fixed part is stored in this currency. When a transaction uses another currency, Takeer converts the fixed amount into the transaction currency using the latest FX rate before charging.', 'Sehemu iliyowekwa huhifadhiwa kwa sarafu hii. Muamala ukitumia sarafu nyingine, Takeer hubadilisha kiasi hicho kwenda sarafu ya muamala kwa kutumia kiwango cha karibuni cha FX kabla ya kutoza.')}
                                            </p>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                        <p className="font-black uppercase tracking-widest text-[10px]">{copy('Min / Max Caps', 'Vikomo vya chini / juu')}</p>
                                        <p className="mt-1">
                                            {copy('First calculate the normal fee, then apply these caps. Min fee raises very small fees to a floor; max fee limits very large fees to a ceiling. Leave blank for no cap.', 'Kwanza hesabu ada ya kawaida, kisha tumia vikomo hivi. Ada ya chini huinua ada ndogo sana; ada ya juu hupunguza ada kubwa sana. Acha wazi bila kikomo.')}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label={copy('Min Fee', 'Ada ya chini')}>
                                            <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.min_fee} onChange={(e) => set('min_fee', e.target.value)} placeholder="Optional" />
                                        </Field>
                                        <Field label={copy('Max Fee', 'Ada ya juu')}>
                                            <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.max_fee} onChange={(e) => set('max_fee', e.target.value)} placeholder="Optional" />
                                        </Field>
                                    </div>

                                    {form.category === 'storage' && (
                                        <>
                                            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                                                <p className="font-black uppercase tracking-widest text-[10px]">{copy('Storage plans', 'Mipango ya hifadhi')}</p>
                                                <p className="mt-1">
                                                    {copy('For Storage policies, Unit GB is the total plan allowance shown to merchants. Create one policy per tier, such as 50GB, 200GB, or 1TB.', 'Kwa sera za hifadhi, Unit GB ni jumla ya nafasi ya mpango inayoonyeshwa kwa wafanyabiashara. Tengeneza sera moja kwa kila ngazi, kama 50GB, 200GB au 1TB.')}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Field label={copy('Plan Size GB', 'Ukubwa wa mpango kwa GB')}>
                                                    <Input className="h-11 rounded-xl" type="number" step="0.01" min="0" value={form.unit_size_gb} onChange={(e) => set('unit_size_gb', e.target.value)} />
                                                </Field>
                                                <Field label={copy('Interval', 'Muda wa kurudia')}>
                                                    <Select value={form.billing_interval} onChange={(e) => set('billing_interval', e.target.value)}>
                                                        <option value="">{copy('None', 'Hakuna')}</option>
                                                        <option value="one_time">{copy('One-time', 'Mara moja')}</option>
                                                        <option value="monthly">{copy('Monthly', 'Kila mwezi')}</option>
                                                        <option value="yearly">{copy('Yearly', 'Kila mwaka')}</option>
                                                    </Select>
                                                </Field>
                                            </div>
                                        </>
                                    )}
                                </BuilderSection>

                                <BuilderSection icon={CalendarClock} title={copy('Timing & Notes', 'Muda na maelezo')}>
                                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                                        <p className="font-black uppercase tracking-widest text-[10px]">{copy('Open-ended policies', 'Sera zisizo na mwisho')}</p>
                                        <p className="mt-1">
                                            {copy('If Effective Until is blank, the policy stays active indefinitely. If another overlapping policy is added, Takeer picks the most specific match first, then the newest effective policy. Set an end date when you want a clean handoff.', 'Effective Until ikiwa wazi, sera itaendelea kuwa hai bila mwisho. Sera nyingine inayopishana ikiongezwa, Takeer huchagua inayolingana zaidi kwanza, kisha sera mpya zaidi. Weka tarehe ya mwisho unapotaka makabidhiano safi.')}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label={copy('Effective From', 'Inaanza kutumika')}>
                                            <Input className="h-11 rounded-xl text-sm" type="datetime-local" value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} />
                                        </Field>
                                        <Field label={copy('Effective Until', 'Inaisha kutumika')}>
                                            <Input className="h-11 rounded-xl text-sm" type="datetime-local" value={form.effective_until} onChange={(e) => set('effective_until', e.target.value)} />
                                        </Field>
                                    </div>

                                    <Field label={copy('Notes', 'Maelezo')}>
                                        <textarea className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={copy('Why this policy exists, investor/accounting context, or rollout notes.', 'Kwa nini sera hii ipo, muktadha wa mwekezaji/uhasibu, au maelezo ya uzinduzi.')} />
                                    </Field>
                                </BuilderSection>

                                <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest font-black text-brand-700">{copy('Live Preview', 'Mwonekano wa moja kwa moja')}</p>
                                            <p className="text-xs text-slate-600 mt-1">{preview.formula}</p>
                                        </div>
                                        <div className="w-32">
                                            <Input className="h-10 rounded-xl bg-white" type="number" min="0" step="0.01" value={previewAmount} onChange={(e) => setPreviewAmount(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-3">
                                        <PreviewMetric label={copy('Gross', 'Jumla kabla ya ada')} value={preview.gross} />
                                        <PreviewMetric label={copy('Fee', 'Ada')} value={preview.fee} tone="text-red-600" />
                                        <PreviewMetric label={copy('Net', 'Jumla baada ya ada')} value={preview.net} tone="text-emerald-700" />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button type="submit" disabled={saving}>
                                        <Save className="h-4 w-4 mr-2" /> {saving ? copy('Saving...', 'Inahifadhi...') : copy('Save Policy', 'Hifadhi sera')}
                                    </Button>
                                    {editingId && <Button type="button" variant="outline" onClick={() => resetForm()}>{copy('Cancel', 'Ghairi')}</Button>}
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

function describePolicy(policy, copy = (english) => english) {
    const percent = Number(policy.percentage_rate || 0);
    const fixed = Number(policy.fixed_amount || 0);
    const fixedCurrency = policy.fixed_fee_currency_code || 'USD';
    if (policy.fee_type === 'fixed') return `${fixedCurrency} ${formatPlain(fixed)} ${copy('fixed fee', 'ada iliyowekwa')}`;
    if (policy.fee_type === 'hybrid') return `${percent}% + ${fixedCurrency} ${formatPlain(fixed)} ${copy('fixed', 'iliyowekwa')}`;
    return `${percent}% ${copy('fee', 'ada')}`;
}

function feeTypeSummary(form, copy = (english) => english) {
    const fixedCurrency = form.fixed_fee_currency_code || 'USD';
    if (form.fee_type === 'fixed') return `${fixedCurrency} ${formatPlain(form.fixed_amount)} ${copy('fixed', 'iliyowekwa')}`;
    if (form.fee_type === 'hybrid') return `${Number(form.percentage_rate || 0)}% + ${fixedCurrency} ${formatPlain(form.fixed_amount)}`;
    return `${Number(form.percentage_rate || 0)}%`;
}

function feeTypeExplanation(type, copy = (english) => english) {
    if (type === 'hybrid') {
        return copy('Hybrid charges a percentage of the transaction plus a fixed amount. If fixed currency differs from the transaction currency, the fixed part is converted first.', 'Mchanganyiko hutoza asilimia ya muamala pamoja na kiasi kilichowekwa. Sarafu ya ada ikitofautiana na sarafu ya muamala, sehemu iliyowekwa hubadilishwa kwanza.');
    }
    if (type === 'fixed') {
        return copy('Fixed charges the same amount regardless of transaction size. Useful for payout rails or storage bundles.', 'Ada iliyowekwa hutoza kiasi kilekile bila kujali ukubwa wa muamala. Inafaa kwa njia za malipo au vifurushi vya hifadhi.');
    }
    return copy('Percent charges a share of the transaction amount. This is the current default for Takeer sales fees.', 'Asilimia hutoza sehemu ya kiasi cha muamala. Hii ndiyo chaguo-msingi la sasa kwa ada za mauzo za Takeer.');
}

function currencyLabel(currency) {
    const name = currency.name ? ` - ${currency.name}` : '';
    const base = currency.is_base_currency ? ' (base)' : '';
    return `${currency.code}${name}${base}`;
}

function categoryDirection(category) {
    if (category === 'sale') return 'payin';
    return '';
}

function paymentChannelLabel(channel) {
    const provider = channel.provider_name || channel.provider_key || 'Provider';
    const country = channel.country_code || '*';
    const direction = channel.direction || 'channel';
    const currencies = Array.isArray(channel.currencies) && channel.currencies.length > 0
        ? channel.currencies.join(', ')
        : '';
    const status = channel.status && channel.status !== 'enabled' ? ` · ${channel.status}` : '';
    const currencySuffix = currencies ? ` · ${currencies}` : '';

    return `${channel.name || channel.key} · ${provider} · ${country} · ${direction}${currencySuffix}${status}`;
}

function policyScopeLabel(policy, paymentChannelByKey, copy = (english) => english) {
    if (policy.sellable_type) {
        const type = sellableTypes.find((item) => item.value === policy.sellable_type);
        return type ? copy(type.label, type.value === 'physical' ? 'Bidhaa halisi' : type.value === 'digital' ? 'Upakuaji wa kidijitali' : 'Huduma') : policy.sellable_type;
    }

    if (policy.payment_channel) {
        const channel = paymentChannelByKey[policy.payment_channel];
        return channel ? paymentChannelLabel(channel) : policy.payment_channel;
    }

    return policy.country_code || policy.currency_code || policy.merchant?.display_name || copy('Global', 'Jumla');
}

function policyScopeBadge(policy, copy = (english) => english) {
    if (policy.sellable_type) {
        const type = sellableTypes.find((item) => item.value === policy.sellable_type);
        return type ? copy(type.label, type.value === 'physical' ? 'Bidhaa halisi' : type.value === 'digital' ? 'Upakuaji wa kidijitali' : 'Huduma') : policy.sellable_type;
    }

    const labels = {
        global: ['Global', 'Jumla'],
        country: ['Country', 'Nchi'],
        currency: ['Currency', 'Sarafu'],
        merchant: ['Merchant', 'Muuzaji'],
        payment_channel: ['Payment Channel', 'Njia ya malipo'],
        sellable_type: ['Sellable Type', 'Aina ya bidhaa'],
    };
    const pair = labels[policy.scope];
    return pair ? copy(pair[0], pair[1]) : String(policy.scope || 'global').replace(/_/g, ' ');
}

function calculatePreview(form, rawAmount, copy = (english) => english) {
    const gross = Math.max(0, Number(rawAmount || 0));
    const percent = Math.max(0, Number(form.percentage_rate || 0));
    const fixed = Math.max(0, Number(form.fixed_amount || 0));
    const minFee = form.min_fee === '' ? null : Math.max(0, Number(form.min_fee || 0));
    const maxFee = form.max_fee === '' ? null : Math.max(0, Number(form.max_fee || 0));

    let fee = 0;
    let formula = '';

    if (form.fee_type === 'fixed') {
        fee = fixed;
        formula = `${form.fixed_fee_currency_code || 'USD'} ${formatPlain(fixed)} ${copy('fixed fee', 'ada iliyowekwa')}`;
    } else if (form.fee_type === 'hybrid') {
        const percentFee = gross * (percent / 100);
        fee = percentFee + fixed;
        formula = `${percent}% ${copy('of', 'ya')} ${formatPlain(gross)} (${formatPlain(percentFee)}) + ${form.fixed_fee_currency_code || 'USD'} ${formatPlain(fixed)}`;
    } else {
        fee = gross * (percent / 100);
        formula = `${percent}% ${copy('of', 'ya')} ${formatPlain(gross)}`;
    }

    if (minFee !== null) {
        fee = Math.max(fee, minFee);
        formula += ` · ${copy('min', 'chini')} ${formatPlain(minFee)}`;
    }
    if (maxFee !== null) {
        fee = Math.min(fee, maxFee);
        formula += ` · ${copy('max', 'juu')} ${formatPlain(maxFee)}`;
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
