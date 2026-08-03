import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent } from '@/Components/ui/Card';
import { ArrowLeft, CheckCircle2, Cloud, CreditCard, HardDrive, History, Loader2, ShieldCheck, Smartphone, Store, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function PlatformSubscription({ merchantUsername, merchantName, featureKey }) {
    const { copy } = useLocale();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState(null);
    const [methodByFeature, setMethodByFeature] = useState({
        retail_ops: 'simulated_mobile_money',
        storage: 'simulated_mobile_money',
    });
    const [selectedStoragePlanId, setSelectedStoragePlanId] = useState(null);

    const features = useMemo(() => {
        if (!data?.features) return [];
        return data.features[featureKey] ? [data.features[featureKey]] : [];
    }, [data, featureKey]);

    const visiblePayments = useMemo(() => {
        const payments = data?.payments || [];
        return payments.filter((payment) => payment.feature === featureKey);
    }, [data, featureKey]);

    const config = pageConfig(featureKey, copy);

    const loadPlans = async () => {
        setLoading(true);
        try {
            const response = await window.axios.get(`/merchant/${merchantUsername}/platform-subscriptions/api`);
            setData(response.data);
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load Takeer plans.', 'Imeshindikana kupakia mipango ya Takeer.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, [merchantUsername]);

    const startTrial = async (feature, feePolicyId = null) => {
        setBusyKey(`${feature}:trial`);
        try {
            const response = await window.axios.post(`/merchant/${merchantUsername}/platform-subscriptions/trial`, {
                feature,
                fee_policy_id: feePolicyId,
            });
            toast.success(response.data.message || copy('Trial started.', 'Majaribio yameanza.'));
            await loadPlans();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not start trial.', 'Imeshindikana kuanza majaribio.'));
        } finally {
            setBusyKey(null);
        }
    };

    const simulatePayment = async (feature, feePolicyId = null) => {
        setBusyKey(`${feature}:pay`);
        try {
            const response = await window.axios.post(`/merchant/${merchantUsername}/platform-subscriptions/simulate-payment`, {
                feature,
                fee_policy_id: feePolicyId,
                payment_method: methodByFeature[feature] || 'simulated',
            });
            toast.success(response.data.message || copy('Payment simulated.', 'Malipo yameigwa kwa majaribio.'));
            await loadPlans();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not simulate payment.', 'Imeshindikana kuiga malipo kwa majaribio.'));
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <AppLayout hideTabBar>
            <Head title={config.headTitle} />

            <div className="min-h-screen bg-slate-50 text-slate-900">
                <div className="border-b border-slate-200 bg-white">
                    <div className="mx-auto max-w-5xl px-5 py-6">
                        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
                            <ArrowLeft className="h-4 w-4" /> {copy('Back to profile', 'Rudi kwenye wasifu')}
                        </Link>
                        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{copy('Platform subscription', 'Usajili wa jukwaa')}</p>
                                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{config.title}</h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                                    {config.description}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{copy('Merchant account', 'Akaunti ya mfanyabiashara')}</p>
                                <p className="mt-1 text-sm font-bold text-slate-900">{merchantName || merchantUsername}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <main className="mx-auto max-w-5xl px-5 py-6 space-y-6">
                    {loading ? (
                        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-5">
                                {features.map((feature) => (
                                    <FeatureCard
                                        key={feature.key}
                                        feature={feature}
                                        merchant={data?.merchant}
                                        method={methodByFeature[feature.key] || 'simulated_mobile_money'}
                                        setMethod={(value) => setMethodByFeature((current) => ({ ...current, [feature.key]: value }))}
                                        selectedStoragePlanId={selectedStoragePlanId}
                                        setSelectedStoragePlanId={setSelectedStoragePlanId}
                                        busyKey={busyKey}
                                        onTrial={(policyId) => startTrial(feature.key, policyId)}
                                        onPay={(policyId) => simulatePayment(feature.key, policyId)}
                                    />
                                ))}
                            </div>

                            <PaymentsTable payments={visiblePayments} featureKey={featureKey} />
                        </>
                    )}
                </main>
            </div>
        </AppLayout>
    );
}

function FeatureCard({ feature, merchant, method, setMethod, selectedStoragePlanId, setSelectedStoragePlanId, busyKey, onTrial, onPay }) {
    const { copy } = useLocale();
    const isRetail = feature.key === 'retail_ops';
    const Icon = isRetail ? Store : HardDrive;
    const storagePlans = Array.isArray(feature.plans) ? feature.plans : [];
    const selectedStoragePlan = storagePlans.find((plan) => plan.policy_id === selectedStoragePlanId)
        || storagePlans.find((plan) => !plan.disabled)
        || storagePlans[0]
        || null;
    const price = isRetail ? (feature.price || {}) : (selectedStoragePlan || feature.price || {});
    const subscription = feature.subscription;
    const isFreeMode = feature.mode === 'free';
    const canTrial = feature.mode === 'trial_then_paid' && Number(feature.trial_days || 0) > 0 && !subscription;
    const payLabel = isRetail
        ? (isFreeMode || Number(price.amount || 0) <= 0 ? copy('Activate Retail Ops', 'Washa Retail Ops') : copy('Simulate Payment', 'Iga malipo'))
        : (isFreeMode || Number(price.amount || 0) <= 0 ? copy('Activate Storage', 'Washa hifadhi') : copy('Upgrade Storage', 'Boresha hifadhi'));
    const actionBusy = busyKey === `${feature.key}:pay`;
    const trialBusy = busyKey === `${feature.key}:trial`;
    const selectedPolicyId = isRetail ? null : selectedStoragePlan?.policy_id;
    const storageActionDisabled = !isRetail && selectedStoragePlan?.disabled;
    const benefits = isRetail
        ? [copy('Point of sale terminal', 'Kituo cha mauzo'), copy('Inventory and stock transfers', 'Orodha ya bidhaa na uhamishaji wa stoo'), copy('Staff roles and access control', 'Majukumu na udhibiti wa wafanyakazi'), copy('Customer credit and outstanding balances', 'Mikopo ya wateja na salio linalodaiwa'), copy('Retail dashboard and shop reports', 'Dashibodi ya rejareja na ripoti za duka')]
        : [copy('Expanded upload capacity', 'Nafasi kubwa ya kupakia'), copy('Storage usage tracking', 'Ufuatiliaji wa matumizi ya hifadhi'), copy('Plan tiers based on active storage policies', 'Ngazi za mpango kulingana na sera hai za hifadhi'), copy('Disabled downgrade options when current usage is higher', 'Chaguo za kushusha mpango huzimwa matumizi ya sasa yanapozidi')];

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
                <CardContent className="p-0">
                    <div className="border-b border-slate-100 p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${isRetail ? 'bg-brand-50 text-brand-700' : 'bg-sky-50 text-sky-700'}`}>
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{copy('Selected plan', 'Mpango uliochaguliwa')}</p>
                                        <h2 className="mt-1 text-2xl font-black text-slate-950">{planName(feature, selectedStoragePlan)}</h2>
                                    </div>
                                </div>
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{featureDescription(feature, copy)}</p>
                            </div>
                            <StatusBadge feature={feature} />
                        </div>

                        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{copy('Price', 'Bei')}</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-4xl font-black tracking-tight text-slate-950">{formatMoney(price.amount || 0, price.currency_code)}</span>
                                    <span className="text-sm font-semibold text-slate-500">/ {intervalLabel(price.billing_interval, copy).toLowerCase()}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:w-72">
                                <Metric label={copy('Mode', 'Aina')} value={modeLabel(feature.mode, copy)} />
                                <Metric label={copy('Source', 'Chanzo')} value={price.policy_name || copy('Default', 'Chaguo-msingi')} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
                        <section>
                            <p className="text-sm font-black text-slate-950">{copy('Included', 'Vilivyojumuishwa')}</p>
                            <div className="mt-4 space-y-3">
                                {benefits.map((benefit) => (
                                    <div key={benefit} className="flex items-start gap-3 text-sm text-slate-700">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                        <span>{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section>
                            {isRetail ? (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                                    <div className="flex items-start gap-3 text-emerald-900">
                                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-black">{copy('Retail Operations access', 'Ufikiaji wa Retail Operations')}</p>
                                            <p className="mt-2 text-sm leading-6 text-emerald-800">{copy('Use this subscription to control access to the merchant’s operational workspace.', 'Tumia usajili huu kudhibiti ufikiaji wa eneo la kazi la mfanyabiashara.')}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <StorageSummary merchant={merchant} feature={feature} selectedPlan={selectedStoragePlan} />
                            )}
                        </section>
                    </div>

                    {!isRetail && (
                        <div className="border-t border-slate-100 p-6">
                            <StoragePlans
                                plans={storagePlans}
                                selectedPlan={selectedStoragePlan}
                                onSelect={(plan) => setSelectedStoragePlanId(plan.policy_id)}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <aside className="space-y-4">
                <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{copy('Checkout', 'Malipo')}</p>
                                <p className="mt-1 text-lg font-black text-slate-950">{formatMoney(price.amount || 0, price.currency_code)}</p>
                            </div>
                            <Icon className={`h-6 w-6 ${isRetail ? 'text-brand-700' : 'text-sky-700'}`} />
                        </div>

                        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{copy('Current access', 'Ufikiaji wa sasa')}</p>
                            <p className="mt-2 text-sm font-black text-slate-900">
                                {subscription
                                    ? `${statusLabel(subscription.status, copy)}${subscription.current_period_end ? ` ${copy('until', 'hadi')} ${formatDate(subscription.current_period_end)}` : ''}`
                                    : feature.is_accessible ? copy('Available', 'Inapatikana') : copy('No active plan', 'Hakuna mpango hai')}
                            </p>
                            {subscription?.last_paid_at && (
                                <p className="mt-1 text-xs text-slate-500">{copy('Last paid', 'Malipo ya mwisho')} {formatDate(subscription.last_paid_at)}</p>
                            )}
                        </div>

                        <div className="mt-5 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{copy('Payment method', 'Njia ya malipo')}</p>
                            <div className="grid grid-cols-2 gap-2">
                                <PaymentMethodButton active={method === 'simulated_mobile_money'} onClick={() => setMethod('simulated_mobile_money')} icon={Smartphone} label={copy('Mobile Money', 'Pesa ya simu')} />
                                <PaymentMethodButton active={method === 'simulated_card'} onClick={() => setMethod('simulated_card')} icon={CreditCard} label={copy('Card', 'Kadi')} />
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-2">
                            {canTrial && (
                                <Button type="button" variant="outline" onClick={() => onTrial(selectedPolicyId)} disabled={trialBusy || Boolean(busyKey) || storageActionDisabled} className="h-11 rounded-lg">
                                    {trialBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                    {copy('Start Trial', 'Anza majaribio')}
                                </Button>
                            )}
                            <Button type="button" onClick={() => onPay(selectedPolicyId)} disabled={actionBusy || Boolean(busyKey) || storageActionDisabled} className="h-11 rounded-lg">
                                {actionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                                {payLabel}
                            </Button>
                        </div>

                        <div className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
                            {price.policy_name || 'No active paid policy yet. Amount will stay zero until Pricing & Fees has a fixed policy for this feature.'}
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
                    Simulated payments create the same subscription and payment records that live callbacks can update later.
                </div>
            </aside>
        </div>
    );
}

function StorageSummary({ merchant, feature, selectedPlan }) {
    const { copy } = useLocale();
    const used = Number(merchant?.storage_used_mb || 0);
    const limit = Number(merchant?.storage_limit_mb || 0);
    const selectedLimit = Number(selectedPlan?.storage_mb || feature?.price?.storage_mb || 0);
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    return (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sky-800">
                    <Cloud className="h-4 w-4" />
                    <p className="text-sm font-black">{copy('Storage allowance', 'Kiwango cha hifadhi')}</p>
                </div>
                <p className="text-xs font-black text-sky-900">{formatMb(used)} / {formatMb(limit)}</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-4 text-xs leading-5 text-sky-900">
                {copy('Selected plan sets your total storage limit to', 'Mpango uliochaguliwa unaweka kikomo chako cha hifadhi kuwa')} {formatMb(selectedLimit)}. {copy('Plans below current usage stay disabled.', 'Mipango iliyo chini ya matumizi ya sasa hubaki imezimwa.')}
            </p>
        </div>
    );
}

function StoragePlans({ plans, selectedPlan, onSelect }) {
    const { copy } = useLocale();
    if (!plans.length) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-xs text-amber-900">
                <p className="font-black uppercase tracking-widest">{copy('No storage tiers yet', 'Hakuna ngazi za hifadhi bado')}</p>
                <p className="mt-2 leading-5">{copy("Create active Storage policies in Pricing & Fees. Each policy's Unit GB becomes one merchant storage plan.", 'Tengeneza sera hai za hifadhi kwenye Bei na Ada. Kila Unit GB ya sera inakuwa mpango mmoja wa hifadhi.')}</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-black text-slate-950">{copy('Storage tiers', 'Ngazi za hifadhi')}</p>
                    <p className="mt-1 text-sm text-slate-500">{copy('Choose the capacity that matches your current upload needs.', 'Chagua uwezo unaolingana na mahitaji yako ya sasa ya kupakia.')}</p>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => {
                    const active = selectedPlan?.policy_id === plan.policy_id;
                    return (
                        <button
                            key={plan.policy_id}
                            type="button"
                            disabled={plan.disabled}
                            onClick={() => onSelect(plan)}
                            className={`rounded-lg border p-4 text-left transition ${active
                                    ? 'border-sky-500 bg-sky-50 text-sky-950 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                } ${plan.disabled ? 'cursor-not-allowed opacity-50 hover:bg-white' : ''}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-black">{plan.name}</p>
                                {active && <CheckCircle2 className="h-4 w-4 text-sky-700" />}
                            </div>
                            <p className="mt-4 text-2xl font-black tracking-tight">{formatMoney(plan.amount, plan.currency_code)}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{intervalLabel(plan.billing_interval, copy)}</p>
                            <p className="mt-4 text-sm font-semibold text-slate-700">{formatMb(plan.storage_mb)} {copy('total storage', 'hifadhi jumla')}</p>
                            {plan.disabled_reason && <p className="mt-3 text-xs font-bold text-amber-700">{plan.disabled_reason}</p>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function PaymentsTable({ payments, featureKey = null }) {
    const { copy } = useLocale();
    const title = featureKey === 'retail_ops'
        ? copy('Retail Operations Payments', 'Malipo ya Retail Operations')
        : featureKey === 'storage'
            ? copy('Storage Payments', 'Malipo ya hifadhi')
            : copy('Subscription Payments', 'Malipo ya usajili');

    return (
        <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-slate-100 p-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{copy('Billing activity', 'Shughuli za malipo')}</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
                    </div>
                    <History className="h-5 w-5 text-slate-400" />
                </div>

                {payments.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="text-sm font-bold text-slate-500">{copy('No payments yet', 'Hakuna malipo bado')}</p>
                        <p className="mt-1 text-sm text-slate-400">{copy('Payment records will appear here after a trial or simulated payment is created.', 'Rekodi za malipo zitaonekana hapa baada ya majaribio au malipo ya majaribio kuundwa.')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[720px]">
                            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <p>{copy('Subscription', 'Usajili')}</p>
                                <p>{copy('Amount', 'Kiasi')}</p>
                                <p>{copy('Status', 'Hali')}</p>
                                <p className="text-right">{copy('Paid', 'Imelipwa')}</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {payments.map((payment) => (
                                    <div key={payment.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 px-6 py-4">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{payment.feature === 'retail_ops' ? copy('Retail Operations', 'Retail Operations') : copy('Storage', 'Hifadhi')}</p>
                                            <p className="mt-1 text-xs text-slate-500">{payment.provider_reference}</p>
                                        </div>
                                        <p className="text-sm font-black text-slate-900">{formatMoney(payment.amount, payment.currency_code)}</p>
                                        <p><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-emerald-700">{payment.status.replace('_', ' ')}</span></p>
                                        <p className="text-right text-sm text-slate-500">{formatDate(payment.paid_at)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function PaymentMethodButton({ active, onClick, icon: Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-bold transition ${active ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}

function Metric({ label, value }) {
    return (
        <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
        </div>
    );
}

function StatusBadge({ feature }) {
    const { copy } = useLocale();
    const accessible = feature.is_accessible;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${accessible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {accessible && <CheckCircle2 className="h-3 w-3" />}
            {accessible ? copy('Accessible', 'Inapatikana') : copy('Needs plan', 'Inahitaji mpango')}
        </span>
    );
}

function featureDescription(feature, copy = (english) => english) {
    if (feature.key === 'retail_ops') {
        return copy('Access control for your POS and shop operations tools.', 'Udhibiti wa ufikiaji wa POS na zana za uendeshaji wa duka.');
    }
    return copy('Increase upload/storage allowance for your merchant workspace.', 'Ongeza nafasi ya kupakia/hifadhi kwa eneo la kazi la mfanyabiashara.');
}

function planName(feature, selectedStoragePlan) {
    if (feature.key === 'retail_ops') {
        return 'Retail Operations';
    }

    return selectedStoragePlan?.name || feature.label || 'Storage';
}

function pageConfig(featureKey, copy = (english) => english) {
    if (featureKey === 'retail_ops') {
        return {
            headTitle: copy('Retail Operations Subscription', 'Usajili wa Retail Operations'),
            title: copy('Retail Operations Subscription', 'Usajili wa Retail Operations'),
            description: copy('Manage the subscription that unlocks POS, inventory, staff, customers, transfers, and the retail dashboard.', 'Dhibiti usajili unaofungua POS, stoo, wafanyakazi, wateja, uhamishaji na dashibodi ya rejareja.'),
        };
    }

    if (featureKey === 'storage') {
        return {
            headTitle: copy('Storage Subscription', 'Usajili wa hifadhi'),
            title: copy('Storage Subscription', 'Usajili wa hifadhi'),
            description: copy('Manage storage plans separately from Retail Operations, including quota upgrades and simulated payment records.', 'Dhibiti mipango ya hifadhi kando na Retail Operations, pamoja na maboresho ya nafasi na rekodi za malipo ya majaribio.'),
        };
    }

    return {
        headTitle: copy('Platform Subscription', 'Usajili wa jukwaa'),
        title: copy('Platform Subscription', 'Usajili wa jukwaa'),
        description: copy('Manage this Takeer platform subscription.', 'Dhibiti usajili huu wa jukwaa la Takeer.'),
    };
}

function modeLabel(mode, copy = (english) => english) {
    return {
        free: copy('Free', 'Bure'),
        trial_then_paid: copy('Trial', 'Majaribio'),
        paid: copy('Paid', 'Imelipiwa'),
    }[mode] || mode;
}

function statusLabel(status, copy = (english) => english) {
    return {
        free: copy('Free access', 'Ufikiaji wa bure'),
        trialing: copy('Trial active', 'Majaribio yanaendelea'),
        active: copy('Paid active', 'Usajili wa malipo unaendelea'),
        past_due: copy('Past due', 'Malipo yamechelewa'),
        cancelled: copy('Cancelled', 'Umeghairiwa'),
        expired: copy('Expired', 'Umeisha'),
    }[status] || status;
}

function intervalLabel(interval, copy = (english) => english) {
    return {
        one_time: copy('One-time', 'Mara moja'),
        monthly: copy('Monthly', 'Kila mwezi'),
        yearly: copy('Yearly', 'Kila mwaka'),
    }[interval] || copy('Monthly', 'Kila mwezi');
}

function formatMoney(amount, currency = 'TZS') {
    return new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'USD' ? 2 : 0,
    }).format(Number(amount || 0));
}

function formatDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-TZ', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}

function formatMb(value) {
    const mb = Number(value || 0);
    if (mb >= 1024) return `${(mb / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB`;
    return `${mb.toLocaleString(undefined, { maximumFractionDigits: 0 })} MB`;
}
