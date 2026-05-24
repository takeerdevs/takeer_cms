import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent } from '@/Components/ui/Card';
import { ArrowLeft, CheckCircle2, Cloud, CreditCard, HardDrive, History, Loader2, ShieldCheck, Smartphone, Store, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function PlatformSubscription({ merchantUsername, merchantName, featureKey }) {
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

    const config = pageConfig(featureKey);

    const loadPlans = async () => {
        setLoading(true);
        try {
            const response = await window.axios.get(`/merchant/${merchantUsername}/platform-subscriptions/api`);
            setData(response.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load Takeer plans.');
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
            toast.success(response.data.message || 'Trial started.');
            await loadPlans();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not start trial.');
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
            toast.success(response.data.message || 'Payment simulated.');
            await loadPlans();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not simulate payment.');
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
                            <ArrowLeft className="h-4 w-4" /> Back to profile
                        </Link>
                        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Platform subscription</p>
                                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{config.title}</h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                                    {config.description}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Merchant account</p>
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
        ? (isFreeMode || Number(price.amount || 0) <= 0 ? 'Activate Retail Ops' : 'Simulate Payment')
        : (isFreeMode || Number(price.amount || 0) <= 0 ? 'Activate Storage' : 'Upgrade Storage');
    const actionBusy = busyKey === `${feature.key}:pay`;
    const trialBusy = busyKey === `${feature.key}:trial`;
    const selectedPolicyId = isRetail ? null : selectedStoragePlan?.policy_id;
    const storageActionDisabled = !isRetail && selectedStoragePlan?.disabled;
    const benefits = isRetail
        ? ['Point of sale terminal', 'Inventory and stock transfers', 'Staff roles and access control', 'Customer credit and outstanding balances', 'Retail dashboard and shop reports']
        : ['Expanded upload capacity', 'Storage usage tracking', 'Plan tiers based on active storage policies', 'Disabled downgrade options when current usage is higher'];

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
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Selected plan</p>
                                        <h2 className="mt-1 text-2xl font-black text-slate-950">{planName(feature, selectedStoragePlan)}</h2>
                                    </div>
                                </div>
                                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">{featureDescription(feature)}</p>
                            </div>
                            <StatusBadge feature={feature} />
                        </div>

                        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Price</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-4xl font-black tracking-tight text-slate-950">{formatMoney(price.amount || 0, price.currency_code)}</span>
                                    <span className="text-sm font-semibold text-slate-500">/ {intervalLabel(price.billing_interval).toLowerCase()}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:w-72">
                                <Metric label="Mode" value={modeLabel(feature.mode)} />
                                <Metric label="Source" value={price.policy_name || 'Default'} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
                        <section>
                            <p className="text-sm font-black text-slate-950">Included</p>
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
                                            <p className="text-sm font-black">Retail Operations access</p>
                                            <p className="mt-2 text-sm leading-6 text-emerald-800">Use this subscription to control access to the merchant’s operational workspace.</p>
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
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Checkout</p>
                                <p className="mt-1 text-lg font-black text-slate-950">{formatMoney(price.amount || 0, price.currency_code)}</p>
                            </div>
                            <Icon className={`h-6 w-6 ${isRetail ? 'text-brand-700' : 'text-sky-700'}`} />
                        </div>

                        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Current access</p>
                            <p className="mt-2 text-sm font-black text-slate-900">
                                {subscription
                                    ? `${statusLabel(subscription.status)}${subscription.current_period_end ? ` until ${formatDate(subscription.current_period_end)}` : ''}`
                                    : feature.is_accessible ? 'Available' : 'No active plan'}
                            </p>
                            {subscription?.last_paid_at && (
                                <p className="mt-1 text-xs text-slate-500">Last paid {formatDate(subscription.last_paid_at)}</p>
                            )}
                        </div>

                        <div className="mt-5 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Payment method</p>
                            <div className="grid grid-cols-2 gap-2">
                                <PaymentMethodButton active={method === 'simulated_mobile_money'} onClick={() => setMethod('simulated_mobile_money')} icon={Smartphone} label="Mobile Money" />
                                <PaymentMethodButton active={method === 'simulated_card'} onClick={() => setMethod('simulated_card')} icon={CreditCard} label="Card" />
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-2">
                            {canTrial && (
                                <Button type="button" variant="outline" onClick={() => onTrial(selectedPolicyId)} disabled={trialBusy || Boolean(busyKey) || storageActionDisabled} className="h-11 rounded-lg">
                                    {trialBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                                    Start Trial
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
    const used = Number(merchant?.storage_used_mb || 0);
    const limit = Number(merchant?.storage_limit_mb || 0);
    const selectedLimit = Number(selectedPlan?.storage_mb || feature?.price?.storage_mb || 0);
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    return (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sky-800">
                    <Cloud className="h-4 w-4" />
                    <p className="text-sm font-black">Storage allowance</p>
                </div>
                <p className="text-xs font-black text-sky-900">{formatMb(used)} / {formatMb(limit)}</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-sky-600" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-4 text-xs leading-5 text-sky-900">
                Selected plan sets your total storage limit to {formatMb(selectedLimit)}. Plans below current usage stay disabled.
            </p>
        </div>
    );
}

function StoragePlans({ plans, selectedPlan, onSelect }) {
    if (!plans.length) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-xs text-amber-900">
                <p className="font-black uppercase tracking-widest">No storage tiers yet</p>
                <p className="mt-2 leading-5">Create active Storage policies in Pricing & Fees. Each policy's Unit GB becomes one merchant storage plan.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-sm font-black text-slate-950">Storage tiers</p>
                    <p className="mt-1 text-sm text-slate-500">Choose the capacity that matches your current upload needs.</p>
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
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{intervalLabel(plan.billing_interval)}</p>
                            <p className="mt-4 text-sm font-semibold text-slate-700">{formatMb(plan.storage_mb)} total storage</p>
                            {plan.disabled_reason && <p className="mt-3 text-xs font-bold text-amber-700">{plan.disabled_reason}</p>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function PaymentsTable({ payments, featureKey = null }) {
    const title = featureKey === 'retail_ops'
        ? 'Retail Operations Payments'
        : featureKey === 'storage'
            ? 'Storage Payments'
            : 'Subscription Payments';

    return (
        <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
            <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-slate-100 p-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Billing activity</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
                    </div>
                    <History className="h-5 w-5 text-slate-400" />
                </div>

                {payments.length === 0 ? (
                    <div className="p-10 text-center">
                        <p className="text-sm font-bold text-slate-500">No payments yet</p>
                        <p className="mt-1 text-sm text-slate-400">Payment records will appear here after a trial or simulated payment is created.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="min-w-[720px]">
                            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                                <p>Subscription</p>
                                <p>Amount</p>
                                <p>Status</p>
                                <p className="text-right">Paid</p>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {payments.map((payment) => (
                                    <div key={payment.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-4 px-6 py-4">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{payment.feature === 'retail_ops' ? 'Retail Operations' : 'Storage'}</p>
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
    const accessible = feature.is_accessible;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${accessible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {accessible && <CheckCircle2 className="h-3 w-3" />}
            {accessible ? 'Accessible' : 'Needs plan'}
        </span>
    );
}

function featureDescription(feature) {
    if (feature.key === 'retail_ops') {
        return 'Access control for your POS and shop operations tools.';
    }
    return 'Increase upload/storage allowance for your merchant workspace.';
}

function planName(feature, selectedStoragePlan) {
    if (feature.key === 'retail_ops') {
        return 'Retail Operations';
    }

    return selectedStoragePlan?.name || feature.label || 'Storage';
}

function pageConfig(featureKey) {
    if (featureKey === 'retail_ops') {
        return {
            headTitle: 'Retail Operations Subscription',
            title: 'Retail Operations Subscription',
            description: 'Manage the subscription that unlocks POS, inventory, staff, customers, transfers, and the retail dashboard.',
        };
    }

    if (featureKey === 'storage') {
        return {
            headTitle: 'Storage Subscription',
            title: 'Storage Subscription',
            description: 'Manage storage plans separately from Retail Operations, including quota upgrades and simulated payment records.',
        };
    }

    return {
        headTitle: 'Platform Subscription',
        title: 'Platform Subscription',
        description: 'Manage this Takeer platform subscription.',
    };
}

function modeLabel(mode) {
    return {
        free: 'Free',
        trial_then_paid: 'Trial',
        paid: 'Paid',
    }[mode] || mode;
}

function statusLabel(status) {
    return {
        free: 'Free access',
        trialing: 'Trial active',
        active: 'Paid active',
        past_due: 'Past due',
        cancelled: 'Cancelled',
        expired: 'Expired',
    }[status] || status;
}

function intervalLabel(interval) {
    return {
        one_time: 'One-time',
        monthly: 'Monthly',
        yearly: 'Yearly',
    }[interval] || 'Monthly';
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
