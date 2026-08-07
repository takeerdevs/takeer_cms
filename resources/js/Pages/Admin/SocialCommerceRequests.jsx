import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { AlertTriangle, Ban, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';

const claimableStatuses = ['claimed', 'onboarding', 'product_setup', 'offer_ready'];

export default function SocialCommerceRequests() {
    const { copy } = useLocale();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    async function loadRequests() {
        setLoading(true);
        setError('');
        try {
            const { data } = await axios.get('/api/admin/social-commerce/requests');
            setItems(data.data || []);
        } catch (exception) {
            setError(exception.response?.data?.message || copy('Unable to load social-commerce requests.', 'Imeshindikana kupakia maombi ya social commerce.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadRequests();
    }, []);

    async function closeRequest(item, action) {
        const reason = window.prompt(action === 'block' ? copy('Reason for blocking', 'Sababu ya kuzuia') : copy('Reason for revoking claim', 'Sababu ya kuondoa claim'));
        if (!reason) return;
        setBusyId(`${item.public_id}:${action}`);
        setError('');
        try {
            await axios.post(`/api/admin/social-commerce/requests/${item.public_id}/${action === 'block' ? 'block' : 'revoke-claim'}`, { reason });
            setItems((current) => current.map((candidate) => candidate.public_id === item.public_id ? { ...candidate, status: 'blocked' } : candidate));
        } catch (exception) {
            setError(exception.response?.data?.message || copy('Admin action failed.', 'Hatua ya admin imeshindikana.'));
        } finally {
            setBusyId(null);
        }
    }

    return (
        <AdminLayout title={copy('Social-commerce requests', 'Maombi ya social commerce')}>
            <Head title={`${copy('Social-commerce trust console', 'Console ya usalama wa social commerce')} | Takeer Admin`} />
            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-wide text-brand-700">{copy('Trust & safety', 'Usalama na uaminifu')}</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900"><ShieldCheck className="h-6 w-6 text-brand-700" />{copy('Social-commerce trust console', 'Console ya usalama wa social commerce')}</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">{copy('Inspect requests, claims, offers and linked orders. Payment and payout actions remain outside this console.', 'Kagua maombi, claims, offer na oda zilizounganishwa. Hatua za malipo na payout hazifanyiki kwenye console hii.')}</p></div>
                    <Button variant="outline" onClick={loadRequests} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{copy('Refresh', 'Refresh')}</Button>
                </div>
                {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                {loading ? <Card className="border-slate-200 bg-white"><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-700" /></CardContent></Card> : items.length === 0 ? <Card className="border-slate-200 bg-white"><CardContent className="flex flex-col items-center justify-center p-12 text-center text-slate-600"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><p className="mt-4 font-bold">{copy('No social-commerce requests found.', 'Hakuna maombi ya social commerce yaliyopatikana.')}</p></CardContent></Card> : <Card className="overflow-hidden border-slate-200 bg-white"><CardHeader className="border-b border-slate-200 pb-4"><CardTitle className="text-base text-slate-900">{copy('Request queue', 'Foleni ya maombi')}</CardTitle><CardDescription>{items.length} {copy('request(s) currently visible.', 'ombi yanaonekana sasa.')}</CardDescription></CardHeader><CardContent className="p-0"><div className="divide-y divide-slate-100">{items.map((item) => <div key={item.public_id} className="p-4 transition hover:bg-slate-50"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label={copy('Request', 'Ombi')} value={item.public_id} mono /><Detail label={copy('Platform', 'Platform')} value={item.platform} /><Detail label={copy('Status', 'Hali')} value={<StatusBadge status={item.status} />} /><Detail label={copy('Order', 'Oda')} value={item.order?.public_id || copy('No order', 'Hakuna oda')} /></div><div className="flex flex-wrap gap-2 lg:justify-end">{!item.order && item.status !== 'blocked' && <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={busyId === `${item.public_id}:block`} onClick={() => closeRequest(item, 'block')}>{busyId === `${item.public_id}:block` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Ban className="mr-1.5 h-3.5 w-3.5" />}{copy('Block', 'Zuia')}</Button>}{!item.order && claimableStatuses.includes(item.status) && <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" disabled={busyId === `${item.public_id}:revoke`} onClick={() => closeRequest(item, 'revoke')}>{busyId === `${item.public_id}:revoke` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />}{copy('Revoke claim', 'Ondoa claim')}</Button>}</div></div><p className="mt-3 text-xs text-slate-500">{item.buyer_notes?.product || item.preview?.snapshot?.title || copy('Product request', 'Ombi la bidhaa')} · {item.destination?.summary || copy('Destination pending', 'Destination inasubiri')}</p></div>)}</div></CardContent></Card>}
            </div>
        </AdminLayout>
    );
}

function Detail({ label, value, mono = false }) {
    return <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><div className={`mt-1 truncate text-sm font-bold text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div></div>;
}

function StatusBadge({ status }) {
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${status === 'blocked' || status === 'cancelled' ? 'bg-red-50 text-red-700' : status === 'converted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{String(status || '').replaceAll('_', ' ')}</span>;
}
