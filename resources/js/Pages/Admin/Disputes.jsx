import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Ban, MailWarning, Scale, ShieldAlert, CheckCircle2, RefreshCw, ShieldOff, Siren } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

export default function Disputes() {
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
            toast.error('Failed to load disputes.');
        } finally {
            setLoading(false);
        }
    };

    const resolveDispute = async (disputeId, verdict) => {
        const note = (resolutionNotes[disputeId] || '').trim();
        if (!note) {
            toast.error('Please add resolution notes before resolving.');
            return;
        }

        setIsResolving(disputeId);
        try {
            await axios.post(`/admin/api/disputes/${disputeId}/resolve`, {
                verdict,
                reason_notes: note,
            });
            toast.success('Dispute resolved.');
            await loadDisputes();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resolve dispute.');
        } finally {
            setIsResolving(null);
        }
    };

    const handleTrustSafety = async (disputeId, action) => {
        const note = (resolutionNotes[disputeId] || '').trim();
        if (!note) {
            toast.error('Please add Trust & Safety notes before taking action.');
            return;
        }

        setIsResolving(disputeId);
        try {
            await axios.post(`/admin/api/disputes/${disputeId}/trust-safety`, {
                action,
                reason_notes: note,
            });
            toast.success('Trust & Safety action recorded.');
            await loadDisputes();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to record Trust & Safety action.');
        } finally {
            setIsResolving(null);
        }
    };

    return (
        <AdminLayout title="Disputes">
            <Head title="Admin Disputes | Takeer" />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 text-red-700 rounded-xl">
                            <Scale className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Platform Disputes</h1>
                            <p className="text-sm text-slate-600">Real dispute records from live platform orders.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                            <option value="all">All statuses</option>
                            <option value="open">Open</option>
                            <option value="ruled_for_buyer">Ruled for buyer</option>
                            <option value="ruled_for_merchant">Ruled for merchant</option>
                        </select>
                        <Button variant="outline" onClick={loadDisputes}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">Loading disputes...</CardContent>
                    </Card>
                ) : disputes.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">No disputes for the selected filter.</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {disputes.map((dispute) => {
                            const order = dispute.order || {};
                            const product = order.product || {};
                            const buyer = order.buyer || {};
                            const merchant = order.merchant || {};
                            const delivery = order.delivery || {};
                            const refundPolicy = order.refund_policy || dispute.refund_policy_snapshot || null;
                            const isOpen = dispute.status === 'open';
                            const isPosCreditReport = dispute.buyer_unboxing_video_url === 'pos-credit-link-report';
                            const canSettleEscrow = order.payment_mode === 'online_escrow' && Number(order.total_paid || 0) > 0;

                            return (
                                <Card key={dispute.id} className="bg-white border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className="h-4 w-4 text-red-700" />
                                                <p className="font-black text-slate-900">Dispute #{dispute.id}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpen ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {dispute.status}
                                                </span>
                                                {isPosCreditReport && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                                        POS link report
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {order.public_id ? `POS #${order.public_id}` : `Order #${order.id}`} · {product.title || (isPosCreditReport ? 'POS credit payment request' : 'Product not found')}
                                            </p>
                                        </div>
                                        <p className="text-xl font-black text-slate-900">TZS {Number(order.total_paid || 0).toLocaleString()}</p>
                                    </div>

                                    <CardContent className="p-4 space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                                                <p className="font-bold text-slate-900">Buyer</p>
                                                <p className="text-slate-700 mt-1">{buyer.name || order.customer_name || '—'}</p>
                                                <p className="text-slate-600 text-xs">{buyer.phone_number || order.customer_phone || 'No phone'}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                                                <p className="font-bold text-slate-900">Merchant</p>
                                                <p className="text-slate-700 mt-1">{merchant.display_name || '—'}</p>
                                                <p className="text-slate-600 text-xs">@{merchant.username || '-'}</p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                                            <div className="rounded-xl border border-slate-200 p-3">
                                                <p className="font-bold text-slate-900 mb-1">Evidence (Merchant)</p>
                                                <p className="text-slate-600 text-xs">Dispatch video: {order.merchant_dispatch_video_url ? 'Available' : 'N/A'}</p>
                                                <p className="text-slate-600 text-xs">Waybill photo: {delivery.waybill_photo_url ? 'Available' : 'N/A'}</p>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 p-3">
                                                <p className="font-bold text-slate-900 mb-1">Evidence (Buyer)</p>
                                                <p className="text-slate-600 text-xs">
                                                    {isPosCreditReport ? 'Customer clicked: Sijapokea bidhaa hizi' : `Unboxing video: ${dispute.buyer_unboxing_video_url ? 'Available' : 'N/A'}`}
                                                </p>
                                                <p className="text-slate-700 mt-1">{dispute.dispute_reason || 'No reason provided.'}</p>
                                            </div>
                                        </div>

                                        {refundPolicy && (
                                            <div className={`rounded-xl border p-3 text-sm ${refundPolicy.status === 'eligible' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                                                <p className="font-black uppercase tracking-wider text-xs">
                                                    Refund policy context: {refundPolicy.status === 'eligible' ? 'Eligible for review' : 'Not eligible by policy'}
                                                </p>
                                                <p className="mt-1">{refundPolicy.reason || dispute.refund_eligibility_reason || 'No policy reason recorded.'}</p>
                                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
                                                    <span>Policy: {refundPolicy.policy || 'standard'}</span>
                                                    {refundPolicy.window_days !== null && refundPolicy.window_days !== undefined && <span>Window: {refundPolicy.window_days} days</span>}
                                                    <span>Access count: {refundPolicy.download_count || 0}</span>
                                                    {refundPolicy.refund_locked_at && <span>Locked: {new Date(refundPolicy.refund_locked_at).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                        )}

                                        {isOpen ? (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
                                                <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">
                                                    {isPosCreditReport ? 'Trust & Safety notes' : 'Admin resolution notes'}
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={resolutionNotes[dispute.id] || ''}
                                                    onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [dispute.id]: e.target.value }))}
                                                    placeholder={isPosCreditReport ? 'Record what was checked and why this action is fair...' : 'Write clear reason for your verdict...'}
                                                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                                                />
                                                {isPosCreditReport ? (
                                                    <>
                                                        <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
                                                            POS link reports do not automatically mean a refund. They are handled as scam-prevention cases:
                                                            verify the POS sale, warn or restrict the merchant, and only use escrow settlement for real platform-held payments.
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                variant="outline"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'dismiss')}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                Dismiss Report
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'warn_merchant')}
                                                            >
                                                                <MailWarning className="h-4 w-4 mr-2" />
                                                                Warn Merchant
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="border-orange-300 text-orange-800 hover:bg-orange-100"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'add_strike')}
                                                            >
                                                                <Siren className="h-4 w-4 mr-2" />
                                                                Add Strike
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'disable_pos_links')}
                                                            >
                                                                <ShieldOff className="h-4 w-4 mr-2" />
                                                                Disable POS Links
                                                            </Button>
                                                            <Button
                                                                className="bg-red-700 hover:bg-red-800 text-white"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => handleTrustSafety(dispute.id, 'suspend_merchant')}
                                                            >
                                                                <Ban className="h-4 w-4 mr-2" />
                                                                Suspend Merchant
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {!canSettleEscrow && (
                                                            <div className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700">
                                                                This order does not show a platform-held escrow payment. Refund/release may be blocked by the backend.
                                                            </div>
                                                        )}
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button
                                                                variant="outline"
                                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => resolveDispute(dispute.id, 'refund_buyer')}
                                                            >
                                                                Refund Buyer
                                                            </Button>
                                                            <Button
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                disabled={isResolving === dispute.id}
                                                                onClick={() => resolveDispute(dispute.id, 'pay_merchant')}
                                                            >
                                                                Pay Merchant
                                                            </Button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                                <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Resolved</p>
                                                <p className="mt-1">{dispute.resolution?.reason_notes || dispute.admin_resolution_notes || 'No note recorded.'}</p>
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
