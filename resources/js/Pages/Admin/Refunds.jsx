import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, RefreshCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const statuses = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
];

function formatMoney(amount, currency = 'TZS') {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
            maximumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
        }).format(Number(amount || 0));
    } catch {
        return `${currency} ${Number(amount || 0).toLocaleString()}`;
    }
}

function statusClass(status) {
    const map = {
        pending: 'bg-amber-50 text-amber-700 border-amber-200',
        approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rejected: 'bg-red-50 text-red-700 border-red-200',
    };

    return map[status] || 'bg-slate-100 text-slate-600 border-slate-200';
}

function formatDate(value) {
    if (!value) return 'Not set';
    return new Date(value).toLocaleString('sw-TZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

export default function AdminRefunds() {
    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [activeStatus, setActiveStatus] = useState('pending');
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });

    const fetchRefunds = (status = activeStatus, page = 1) => {
        setLoading(true);
        const params = new URLSearchParams({
            status,
            page: String(page),
            per_page: String(pagination.per_page || 20),
        });

        fetch(`/admin/api/refunds?${params.toString()}`, { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Failed to load refunds.');
                return data;
            })
            .then((data) => {
                setRefunds(data.refunds ?? []);
                setPagination(data.pagination ?? { current_page: page, last_page: 1, per_page: 20, total: data.refunds?.length ?? 0 });
                setLoading(false);
            })
            .catch((error) => {
                toast.error(error.message);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchRefunds(activeStatus);
    }, []);

    const decide = async (refund, decision) => {
        const isReject = decision === 'reject';
        const promptMessage = isReject
            ? 'Why are we rejecting this refund? This note will be kept for audit.'
            : 'Optional approval note for audit:';
        const adminNotes = window.prompt(promptMessage, '');

        if (adminNotes === null) return;
        if (isReject && !adminNotes.trim()) {
            toast.error('A rejection note is required.');
            return;
        }

        setSubmitting(`${decision}-${refund.id}`);
        try {
            const response = await fetch(`/admin/api/refunds/${refund.id}/${decision}`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({ admin_notes: adminNotes.trim() || null }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to update refund.');
            toast.success(data.message);
            fetchRefunds(activeStatus, pagination.current_page);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <AdminLayout title="Refunds">
            <Head title="Admin Refunds | Takeer" />
            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                            <RefreshCcw className="h-6 w-6 text-sky-700" /> Refund Operations
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">Authorize buyer refunds and keep the order chat audit trail in sync.</p>
                    </div>
                    <Button variant="outline" onClick={() => fetchRefunds(activeStatus)} disabled={loading}>
                        Refresh
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {statuses.map((status) => (
                        <button
                            key={status.key}
                            type="button"
                            onClick={() => {
                                setActiveStatus(status.key);
                                fetchRefunds(status.key, 1);
                            }}
                            className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                                activeStatus === status.key
                                    ? 'border-sky-300 bg-sky-50 text-sky-800'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="py-16 text-center text-slate-500">Loading...</div>
                ) : refunds.length === 0 ? (
                    <Card className="border-slate-200 bg-white">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-600 opacity-70" />
                            <p className="font-semibold">No {activeStatus === 'all' ? '' : activeStatus} refunds</p>
                            <p className="mt-1 text-xs">Nothing to authorize for this status.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {refunds.map((refund) => {
                            const currency = refund.currency_code || refund.merchant?.currency_code || 'TZS';
                            const orderHref = refund.order?.id ? `/chat/${refund.order.id}` : null;
                            return (
                                <Card key={refund.id} className="border-slate-200 bg-white shadow-sm">
                                    <CardContent className="space-y-4 p-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex gap-4">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50">
                                                    <RefreshCcw className="h-5 w-5 text-sky-700" />
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-lg font-black text-slate-900">
                                                            {formatMoney(refund.amount, currency)} refund
                                                        </p>
                                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${statusClass(refund.status)}`}>
                                                            {refund.status}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-slate-600">
                                                        Buyer: <span className="font-bold text-slate-800">{refund.buyer?.name || 'Unknown buyer'}</span>
                                                        {refund.buyer?.phone_number ? ` (${refund.buyer.phone_number})` : ''}
                                                    </p>
                                                    <p className="text-sm text-slate-600">
                                                        Merchant: <span className="font-bold text-slate-800">{refund.merchant?.display_name || refund.merchant?.username || 'Unknown merchant'}</span>
                                                    </p>
                                                    <p className="text-xs font-semibold text-slate-500">
                                                        Refund #{refund.id} • {refund.source?.replaceAll('_', ' ') || 'manual'} • Created {formatDate(refund.created_at)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 sm:flex-row lg:items-center">
                                                {orderHref && (
                                                    <Link href={orderHref}>
                                                        <Button variant="outline" className="w-full sm:w-auto">
                                                            <ExternalLink className="mr-2 h-4 w-4" />
                                                            Order Chat
                                                        </Button>
                                                    </Link>
                                                )}
                                                {refund.status === 'pending' ? (
                                                    <>
                                                        <Button
                                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                                            onClick={() => decide(refund, 'approve')}
                                                            disabled={submitting !== null}
                                                        >
                                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                                            {submitting === `approve-${refund.id}` ? 'Approving...' : 'Approve'}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="border-red-200 text-red-700 hover:bg-red-50"
                                                            onClick={() => decide(refund, 'reject')}
                                                            disabled={submitting !== null}
                                                        >
                                                            <XCircle className="mr-2 h-4 w-4" />
                                                            {submitting === `reject-${refund.id}` ? 'Rejecting...' : 'Reject'}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button variant="outline" disabled>
                                                        Handled
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Order</p>
                                                <p className="mt-1 font-black text-slate-900">{refund.order?.public_id || `#${refund.order?.id || 'unknown'}`}</p>
                                                <p className="text-xs text-slate-600">{refund.order?.payment_status?.replaceAll('_', ' ') || 'No payment status'}</p>
                                            </div>
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">Merchant Penalty</p>
                                                <p className="mt-1 font-black text-amber-900">{formatMoney(refund.merchant_penalty_amount, currency)}</p>
                                                <p className="text-xs text-amber-800">{Number(refund.merchant_penalty_percent || 0).toLocaleString()}% of paid amount</p>
                                            </div>
                                            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-sky-700">Pickup Window</p>
                                                <p className="mt-1 text-xs font-bold text-sky-950">Deadline: {formatDate(refund.order?.pickup_deadline_at)}</p>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 p-3">
                                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Reason</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-800">{refund.reason || 'No reason recorded.'}</p>
                                            {refund.admin_notes && (
                                                <p className="mt-2 text-sm text-slate-600">Admin note: {refund.admin_notes}</p>
                                            )}
                                            {refund.approver && (
                                                <p className="mt-2 text-xs text-slate-500">
                                                    Handled by {refund.approver.name} at {formatDate(refund.approved_at || refund.rejected_at)}
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {pagination.last_page > 1 && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-sm font-semibold text-slate-600">
                            Page {pagination.current_page} of {pagination.last_page} • {pagination.total} refunds
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={pagination.current_page <= 1 || loading}
                                onClick={() => fetchRefunds(activeStatus, pagination.current_page - 1)}
                            >
                                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                disabled={pagination.current_page >= pagination.last_page || loading}
                                onClick={() => fetchRefunds(activeStatus, pagination.current_page + 1)}
                            >
                                Next <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
