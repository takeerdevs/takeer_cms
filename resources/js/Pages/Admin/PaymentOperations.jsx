import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

export default function PaymentOperations() {
    const { t, copy } = useLocale();
    const [data, setData] = useState({ payouts: [], reconciliation_breaks: [], recent_provider_events: [] });
    const [loading, setLoading] = useState(true);

    const load = () => {
        setLoading(true);
        fetch('/admin/api/payment-operations', { headers: { Accept: 'application/json' } })
            .then((response) => response.json().then((payload) => ({ response, payload })))
            .then(({ response, payload }) => {
                if (!response.ok) throw new Error(payload.message || t('adminUi.paymentOperations'));
                setData(payload);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    return (
        <AdminLayout title={t('adminUi.paymentOperations')}>
            <Head title={`${t('adminUi.paymentOperations')} | Takeer`} />
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900"><Activity className="h-6 w-6 text-brand-600" /> {t('adminUi.paymentOperations')}</h1>
                        <p className="mt-1 text-sm text-slate-600">{t('adminUi.paymentOperationsDescription')}</p>
                    </div>
                    <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"><RefreshCw className="h-4 w-4" /> {t('adminUi.refresh')}</button>
                </div>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 font-black text-slate-900">{t('adminUi.providerPayouts')}</h2>
                    {loading ? <p className="text-sm text-slate-500">{t('adminUi.loading')}</p> : data.payouts.length === 0 ? <p className="text-sm text-slate-500">{t('adminUi.noExceptions')}</p> : <div className="space-y-2">{data.payouts.map((payout) => <div key={payout.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{payout.merchant?.display_name || copy('Merchant', 'Muuzaji')} · {payout.provider?.name || copy('Provider', 'Mtoa huduma')}</span><span className="font-black">{payout.currency} {(Number(payout.amount_minor || 0) / 100).toLocaleString()} · {payout.state}</span></div>)}</div>}
                </section>
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <h2 className="mb-4 flex items-center gap-2 font-black text-amber-900"><AlertTriangle className="h-4 w-4" /> {t('adminUi.reconciliation')}</h2>
                    {data.reconciliation_breaks.length === 0 ? <p className="text-sm text-amber-800">{t('adminUi.noBreaks')}</p> : <div className="space-y-2">{data.reconciliation_breaks.map((item) => <div key={item.id} className="rounded-lg bg-white/70 p-3 text-sm text-amber-950">{item.break_type} · {item.status} · {item.order?.public_id || copy('Provider reference pending', 'Rejea ya provider inasubiri')}</div>)}</div>}
                </section>
            </div>
        </AdminLayout>
    );
}
