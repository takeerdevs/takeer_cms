import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

export default function MerchantSettings({ merchantId }) {
    const { t, copy } = useLocale();
    const [merchant, setMerchant] = useState(null);
    const [disabled, setDisabled] = useState(false);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/admin/api/merchants/${merchantId}`, { headers: { Accept: 'application/json' } });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || t('adminUi.merchantSettings'));
            setMerchant(data.merchant);
            setDisabled(Boolean(data.summary?.retail_settings?.disable_pos_payment_links));
        } catch (error) { toast.error(error.message); } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [merchantId]);

    const save = async (nextDisabled) => {
        setSaving(true);
        try {
            const response = await fetch(`/admin/api/merchants/${merchantId}/settings`, {
                method: 'PUT',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ disable_pos_payment_links: nextDisabled, reason_notes: notes }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || t('adminUi.generalSettings'));
            setDisabled(nextDisabled); setNotes(''); toast.success(data.message || copy('Settings updated.', 'Mipangilio imesasishwa.'));
        } catch (error) { toast.error(error.message); } finally { setSaving(false); }
    };

    return (
        <AdminLayout title={t('adminUi.merchantSettings')}>
            <Head title={`${t('adminUi.merchantSettings')} | Takeer`} />
            <div className="max-w-3xl space-y-6">
                <Link href={`/admin/merchants/${merchantId}`} className="inline-flex items-center text-sm text-slate-600"><ArrowLeft className="mr-1 h-4 w-4" /> {t('adminUi.backToMerchant')}</Link>
                <div className="flex items-center gap-3"><Store className="h-6 w-6 text-slate-700" /><div><h1 className="text-2xl font-black text-slate-900">{merchant?.display_name || t('adminUi.merchantSettings')}</h1><p className="text-sm text-slate-600">@{merchant?.username || '...'}</p></div></div>
                {loading ? <p className="text-sm text-slate-500">{t('adminUi.loading')}</p> : <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black text-slate-900">{copy('POS payment-link access', 'Upatikanaji wa payment link za POS')}</h2><p className="mt-1 text-sm text-slate-600">{copy('Payment release and beneficiary verification are controlled by the licensed PSP and order settlement state.', 'Release ya malipo na uhakiki wa beneficiary hudhibitiwa na PSP mwenye leseni na hali ya settlement ya oda.')}</p><label className="mt-5 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={!disabled} onChange={(event) => save(!event.target.checked)} disabled={saving} /> {copy('Allow POS payment links', 'Ruhusu payment links za POS')}</label><textarea className="mt-5 w-full rounded-xl border border-slate-200 p-3 text-sm" rows="3" placeholder={copy('Optional admin reason', 'Sababu ya admin (si lazima)')} value={notes} onChange={(event) => setNotes(event.target.value)} /></section>}
            </div>
        </AdminLayout>
    );
}
