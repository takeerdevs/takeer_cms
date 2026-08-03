import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Ban, Download, MailWarning, Scale, ShieldAlert, CheckCircle2, RefreshCw, ShieldOff, Siren } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useLocale } from '@/lib/i18n';

export default function Disputes() {
    const { copy } = useLocale();
    const [disputes, setDisputes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [isResolving, setIsResolving] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState({});

    useEffect(() => {
        loadDisputes();
    }, [statusFilter]);

    const loadDisputes = async () => {
        setLoading(true);
        try {
            const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
            const res = await axios.get(`/admin/api/disputes${query}`);
            setDisputes(res.data?.data || []);
        } catch (error) {
            toast.error(copy('Failed to load disputes.', 'Imeshindikana kupakia migogoro.'));
        } finally {
            setLoading(false);
        }
    };

    const resolveDispute = async (disputeId, verdict) => {
        const note = (resolutionNotes[disputeId] || '').trim();
        if (!note) {
            toast.error(copy('Please add resolution notes before resolving.', 'Tafadhali ongeza maelezo ya utatuzi kabla ya kutatua.'));
            return;
        }

        setIsResolving(disputeId);
        try {
            await axios.post(`/admin/api/disputes/${disputeId}/resolve`, {
                verdict,
                reason_notes: note,
            });
            toast.success(copy('Dispute resolved.', 'Mgogoro umetatuliwa.'));
            await loadDisputes();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to resolve dispute.', 'Imeshindikana kutatua mgogoro.'));
        } finally {
            setIsResolving(null);
        }
    };

    const handleTrustSafety = async (disputeId, action) => {
        const note = (resolutionNotes[disputeId] || '').trim();
        if (!note) {
            toast.error(copy('Please add Trust & Safety notes before taking action.', 'Tafadhali ongeza maelezo ya Uaminifu na Usalama kabla ya kuchukua hatua.'));
            return;
        }

        setIsResolving(disputeId);
        try {
            await axios.post(`/admin/api/disputes/${disputeId}/trust-safety`, {
                action,
                reason_notes: note,
            });
            toast.success(copy('Trust & Safety action recorded.', 'Hatua ya Uaminifu na Usalama imehifadhiwa.'));
            await loadDisputes();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to record Trust & Safety action.', 'Imeshindikana kuhifadhi hatua ya Uaminifu na Usalama.'));
        } finally {
            setIsResolving(null);
        }
    };

    return (
        <AdminLayout title={copy('Disputes', 'Migogoro')}>
            <Head title={`${copy('Admin Disputes', 'Migogoro ya Msimamizi')} | Takeer`} />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 text-red-700 rounded-xl">
                            <Scale className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{copy('Platform Disputes', 'Migogoro ya Jukwaa')}</h1>
                            <p className="text-sm text-slate-600">{copy('Real dispute records from live platform orders.', 'Kumbukumbu halisi za migogoro kutoka oda za jukwaa.')}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                            <option value="all">{copy('All statuses', 'Hali zote')}</option>
                            <option value="open">{copy('Open', 'Wazi')}</option>
                            <option value="ruled_for_buyer">{copy('Ruled for buyer', 'Imeamuliwa kwa mnunuzi')}</option>
                            <option value="ruled_for_merchant">{copy('Ruled for merchant', 'Imeamuliwa kwa muuzaji')}</option>
                        </select>
                        <Button variant="outline" onClick={loadDisputes}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {copy('Refresh', 'Onyesha upya')}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">{copy('Loading disputes...', 'Inapakia migogoro...')}</CardContent>
                    </Card>
                ) : disputes.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">{copy('No disputes for the selected filter.', 'Hakuna migogoro kwa kichujio hiki.')}</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {disputes.map((dispute) => {
                            const order = dispute.order || {};
                            const product = order.product || {};
                            const buyer = order.buyer || {};
                            const merchant = order.merchant || {};
                            const delivery = order.delivery || {};
                            const customEvents = order.custom_delivery_events || [];
                            const refundPolicy = order.refund_policy || dispute.refund_policy_snapshot || null;
                            const isOpen = dispute.status === 'open';
                            const isPosCreditReport = dispute.buyer_unboxing_video_url === 'pos-credit-link-report';
                            const canRequestProviderRefund = order.payment_mode === 'online_psp' && Number(order.total_paid || 0) > 0;

                            return (
                                <Card key={dispute.id} className="bg-white border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className="h-4 w-4 text-red-700" />
                                                <p className="font-black text-slate-900">{copy('Dispute', 'Mgogoro')} #{dispute.id}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpen ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {dispute.status}
                                                </span>
                                                {isPosCreditReport && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                        {copy('POS link report', 'Ripoti ya kiungo cha POS')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {order.public_id ? `POS #${order.public_id}` : `${copy('Order', 'Oda')} #${order.id}`} · {product.title || (isPosCreditReport ? copy('POS credit payment request', 'Ombi la malipo ya mkopo wa POS') : copy('Product not found', 'Bidhaa haikupatikana'))}
                                            </p>
                                        </div>
                                        <p className="text-xl font-black text-slate-900">TZS {Number(order.total_paid || 0).toLocaleString()}</p>
                                    </div>

                                    <CardContent className="p-4 space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                                                <p className="font-bold text-slate-900">{copy('Buyer', 'Mnunuzi')}</p>
                                                <p className="text-slate-700 mt-1">{buyer.name || order.customer_name || '—'}</p>
                                                <p className="text-slate-600 text-xs">{buyer.phone_number || order.customer_phone || copy('No phone', 'Hakuna simu')}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                                                <p className="font-bold text-slate-900">{copy('Merchant', 'Muuzaji')}</p>
                                                <p className="text-slate-700 mt-1">{merchant.display_name || '—'}</p>
                                                <p className="text-slate-600 text-xs">@{merchant.username || '-'}</p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div className="rounded-xl border border-slate-200 p-3">
                                                <p className="font-bold text-slate-900 mb-1">{copy('Evidence (merchant)', 'Ushahidi (muuzaji)')}</p>
                                                <p className="text-slate-600 text-xs">{copy('Dispatch video:', 'Video ya kutuma:')} {order.merchant_dispatch_video_url ? copy('Available', 'Ipo') : copy('N/A', 'Haipo')}</p>
                                                <p className="text-slate-600 text-xs">{copy('Waybill photo:', 'Picha ya waybill:')} {delivery.waybill_photo_url ? copy('Available', 'Ipo') : copy('N/A', 'Haipo')}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 p-3">
                                                <p className="font-bold text-slate-900 mb-1">{copy('Evidence (buyer)', 'Ushahidi (mnunuzi)')}</p>
                                                <p className="text-slate-600 text-xs">
                                                    {isPosCreditReport ? copy('Customer clicked: Sijapokea bidhaa hizi', 'Mteja alibonyeza: Sijapokea bidhaa hizi') : `${copy('Unboxing video:', 'Video ya kufungua:')} ${dispute.buyer_unboxing_video_url ? copy('Available', 'Ipo') : copy('N/A', 'Haipo')}`}
                                                </p>
                                                <p className="text-slate-700 mt-1">{dispute.dispute_reason || copy('No reason provided.', 'Hakuna sababu iliyotolewa.')}</p>
                                            </div>
                                        </div>

                                        {refundPolicy && (
                                            <div className={`rounded-xl border p-3 text-sm ${refundPolicy.status === 'eligible' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                                                <p className="font-black uppercase tracking-wider text-xs">
                                                    {copy('Refund policy context:', 'Muktadha wa sera ya marejesho:')} {refundPolicy.status === 'eligible' ? copy('Eligible for review', 'Inastahili kukaguliwa') : copy('Not eligible by policy', 'Haitimizi sera')}
                                                </p>
                                                <p className="mt-1">{refundPolicy.reason || dispute.refund_eligibility_reason || 'No policy reason recorded.'}</p>
                                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                                                    <span>{copy('Policy:', 'Sera:')} {refundPolicy.policy || copy('standard', 'kawaida')}</span>
                                                    {refundPolicy.window_days !== null && refundPolicy.window_days !== undefined && <span>{copy('Window:', 'Dirisha:')} {refundPolicy.window_days} {copy('days', 'siku')}</span>}
                                                    <span>{copy('Access count:', 'Idadi ya ufikiaji:')} {refundPolicy.download_count || 0}</span>
                                                    {refundPolicy.refund_locked_at && <span>{copy('Locked:', 'Imefungwa:')} {new Date(refundPolicy.refund_locked_at).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                        )}

                                        {customEvents.length > 0 && (
                                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
                                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="font-black uppercase tracking-wider text-xs text-indigo-800">{copy('Custom work history', 'Historia ya kazi maalum')}</p>
                                                        <p className="text-xs text-indigo-700/80">
                                                            {order.custom_delivery_due_at ? `${copy('Due', 'Mwisho')} ${new Date(order.custom_delivery_due_at).toLocaleString()}` : copy('No deadline recorded', 'Hakuna mwisho uliorekodiwa')} · {order.custom_delivery_revision_count || 0} {copy('revision requests', 'maombi ya marekebisho')}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{order.custom_delivery_status || 'custom work'}</span>
                                                </div>
                                                <div className="mt-3 space-y-2">
                                                    {customEvents.map((event) => (
                                                        <div key={event.id} className="rounded-lg border border-indigo-100 bg-white px-3 py-2">
                                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                <div>
                                                                    <p className="font-bold text-slate-900">
                                                                        {String(event.event_type || '').replaceAll('_', ' ')}
                                                                        {event.revision_number ? ` #${event.revision_number}` : ''}
                                                                    </p>
                                                                    <p className="text-[11px] font-semibold text-slate-500">
                                                                        {event.actor_type || 'system'} · {event.created_at ? new Date(event.created_at).toLocaleString() : ''}
                                                                    </p>
                                                                </div>
                                                                {event.download_url && (
                                                                    <a href={event.download_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                                                                        <Download className="mr-1.5 h-3.5 w-3.5" />
                                                                        Evidence
                                                                    </a>
                                                                )}
                                                            </div>
                                                            {event.file_name && (
                                                                <p className="mt-2 truncate text-xs font-bold text-slate-700" title={event.file_name}>
                                                                    {event.file_name}
                                                                </p>
                                                            )}
                                                            {event.message && (
                                                                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-700">{event.message}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {isOpen ? (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
                                                <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">
                                                    {isPosCreditReport ? copy('Trust & Safety notes', 'Maelezo ya uaminifu na usalama') : copy('Admin resolution notes', 'Maelezo ya uamuzi wa msimamizi')}
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={resolutionNotes[dispute.id] || ''}
                                                    onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [dispute.id]: e.target.value }))}
                                                    placeholder={isPosCreditReport ? copy('Record what was checked and why this action is fair...', 'Rekodi kilichokaguliwa na kwa nini hatua hii ni ya haki...') : copy('Write a clear reason for your verdict...', 'Andika sababu iliyo wazi ya uamuzi wako...')}
                                                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                                                />
                                                {isPosCreditReport ? (
                                                    <>
                                                        <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
                                                            {copy('POS link reports do not automatically mean a refund. They are handled as scam-prevention cases: verify the POS sale, warn or restrict the merchant, and request a PSP refund only where provider payment evidence exists.', 'Ripoti za viungo vya POS hazimaanishi marejesho moja kwa moja. Zinashughulikiwa kama kesi za kuzuia utapeli: hakiki mauzo ya POS, mwonye au mzuie muuzaji, na omba marejesho ya PSP pale tu ushahidi wa malipo ya mtoa huduma unapopatikana.')}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                variant="outline"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'dismiss')}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                {copy('Dismiss report', 'Puuza ripoti')}
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'warn_merchant')}
                                                            >
                                                                <MailWarning className="h-4 w-4 mr-2" />
                                                                {copy('Warn merchant', 'Mwonye muuzaji')}
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="border-orange-300 text-orange-800 hover:bg-orange-100"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'add_strike')}
                                                            >
                                                                <Siren className="h-4 w-4 mr-2" />
                                                                {copy('Add strike', 'Ongeza adhabu')}
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'disable_pos_links')}
                                                            >
                                                                <ShieldOff className="h-4 w-4 mr-2" />
                                                                {copy('Disable POS links', 'Zima viungo vya POS')}
                                                            </Button>
                                                            <Button
                                                                className="bg-red-700 hover:bg-red-800 text-white"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'suspend_merchant')}
                                                            >
                                                                <Ban className="h-4 w-4 mr-2" />
                                                                {copy('Suspend merchant', 'Simamisha muuzaji')}
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {!canRequestProviderRefund && (
                                                            <div className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700">
                                                                {copy('This order does not show a provider payment. A PSP refund may be blocked by the backend.', 'Oda hii haina malipo ya mtoa huduma. Marejesho ya PSP yanaweza kuzuiwa na mfumo wa nyuma.')}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                variant="outline"
                                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => resolveDispute(dispute.id, 'refund_buyer')}
                                                            >
                                                                {copy('Refund buyer', 'Mrejeshee mnunuzi')}
                                                            </Button>
                                                            <Button
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => resolveDispute(dispute.id, 'pay_merchant')}
                                                            >
                                                                {copy('Pay merchant', 'Mlipa muuzaji')}
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                                <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{copy('Resolved', 'Imetatuliwa')}</p>
                                                <p className="mt-1">{dispute.resolution?.reason_notes || dispute.admin_resolution_notes || copy('No note recorded.', 'Hakuna maelezo yaliyorekodiwa.')}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
