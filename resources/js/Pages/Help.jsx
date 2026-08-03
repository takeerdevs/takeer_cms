import React, { useMemo, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CreditCard, DownloadCloud, LifeBuoy, MessageCircle, PackageCheck, ShieldAlert, Store, Truck } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';

const categoryIcons = {
    order: PackageCheck,
    payment: CreditCard,
    delivery: Truck,
    digital_access: DownloadCloud,
    merchant_account: Store,
    safety: ShieldAlert,
    other: LifeBuoy,
};

const categoryHints = {
    order: 'Order status, wrong item, refunds, or receipt issues.',
    payment: 'PSP payment, failed payment, duplicate charge, or provider payout concern.',
    delivery: 'Rider, pickup, shipping, waybill, or delayed delivery.',
    digital_access: 'Download, video, audio, gallery, license, or entitlement access.',
    merchant_account: 'KYC, upload, storefront, modules, or selling tools.',
    safety: 'Fraud, suspicious seller, unsafe content, or urgent platform report.',
    other: 'Anything else you need Takeer support to review.',
};

export default function Help({ categories = [] }) {
    const { auth } = usePage().props;
    const { t, copy } = useLocale();
    const user = auth?.user || null;
    const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const requestedCategory = query.get('category') || '';
    const defaultCategory = categories.some((category) => category.key === requestedCategory)
        ? requestedCategory
        : (categories[0]?.key || 'order');
    const [submittedReference, setSubmittedReference] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        category: defaultCategory,
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone_number || '',
        order_reference: query.get('reference') || '',
        subject: query.get('subject') || '',
        message: query.get('message') || '',
    });

    const selectedCategory = useMemo(() => (
        categories.find((category) => category.key === form.category) || categories[0] || { key: 'other', label: t('help.other') }
    ), [categories, form.category, t]);

    const submit = async (event) => {
        event.preventDefault();
        setSubmitting(true);

        try {
            const res = await axios.post('/help', form);
            setSubmittedReference(res.data?.reference || '');
            toast.success(res.data?.message || t('help.sendRequest'));
            setForm((current) => ({
                ...current,
                order_reference: '',
                subject: '',
                message: '',
            }));
        } catch (error) {
            const message = error.response?.data?.message || t('help.sendRequest');
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppLayout>
            <Head title={t('help.pageTitle')} />

            <div className="mx-auto max-w-5xl px-4 py-8 pb-20">
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <section className="space-y-6">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-brand-700">
                                <LifeBuoy className="h-4 w-4" />
                                {t('help.badge')}
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('help.heading')}</h1>
                                <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                                    {t('help.intro')}
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {categories.map((category) => {
                                const Icon = categoryIcons[category.key] || LifeBuoy;
                                const active = form.category === category.key;

                                return (
                                    <button
                                        key={category.key}
                                        type="button"
                                        onClick={() => setForm((current) => ({ ...current, category: category.key }))}
                                        className={`rounded-xl border p-4 text-left transition-colors ${active ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-100 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <span>
                                                <span className="block text-sm font-black text-slate-950">{t(`help.category.${category.key}.label`, {}, category.label)}</span>
                                                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{t(`help.hints.${category.key}`, {}, categoryHints[category.key])}</span>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {submittedReference && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                    <div>
                                <p className="font-black">{t('help.received')}</p>
                                <p className="mt-1">{t('help.reference')} <span className="font-black">{submittedReference}</span>.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4">
                            <p className="text-xs font-black uppercase tracking-widest text-brand-600">{selectedCategory.label}</p>
                            <h2 className="mt-1 text-xl font-black text-slate-950">{t('help.sendTitle')}</h2>
                        </div>

                        <form onSubmit={submit} className="space-y-3">
                            <Field label={t('help.name')}>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-brand-300"
                                    placeholder={t('help.namePlaceholder')}
                                />
                            </Field>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                <Field label={t('help.email')}>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-brand-300"
                                        placeholder="you@example.com"
                                    />
                                </Field>
                                <Field label={t('help.phone')}>
                                    <input
                                        value={form.phone}
                                        onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-brand-300"
                                        placeholder="+255..."
                                    />
                                </Field>
                            </div>
                            <Field label={t('help.orderReference')}>
                                <input
                                    value={form.order_reference}
                                    onChange={(e) => setForm((current) => ({ ...current, order_reference: e.target.value }))}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-brand-300"
                                    placeholder={t('help.optional')}
                                />
                            </Field>
                            <Field label={t('help.subject')}>
                                <input
                                    value={form.subject}
                                    onChange={(e) => setForm((current) => ({ ...current, subject: e.target.value }))}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-brand-300"
                                    placeholder={t('help.subjectPlaceholder')}
                                />
                            </Field>
                            <Field label={t('help.message')}>
                                <textarea
                                    required
                                    minLength={10}
                                    value={form.message}
                                    onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
                                    className="min-h-36 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 outline-none focus:border-brand-300"
                                    placeholder={t('help.messagePlaceholder')}
                                />
                            </Field>

                            <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                                <MessageCircle className="mr-2 h-4 w-4" />
                                {submitting ? t('help.sending') : t('help.sendRequest')}
                            </Button>
                        </form>

                        <div className="mt-5 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">
                            <div className="flex gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>{t('help.safetyNotice')}</p>
                            </div>
                        </div>

                        <div className="mt-4 text-xs font-semibold text-slate-500">
                            <Link href="/legal" className="hover:text-slate-900">{copy('Legal Center', 'Kituo cha sheria')}</Link>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-widest text-slate-500">{label}</span>
            {children}
        </label>
    );
}
