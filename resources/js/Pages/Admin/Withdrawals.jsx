import React, { useState, useEffect } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ArrowDownToLine, CheckCircle2, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';
const statuses = [
    { key: 'pending', label: 'Pending' },
    { key: 'processing', label: 'Processing' },
    { key: 'approved', label: 'Approved' },
    { key: 'failed', label: 'Failed' },
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

export default function AdminWithdrawals() {
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(null);
    const [activeStatus, setActiveStatus] = useState('pending');
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });

    const fetchWithdrawals = (status = activeStatus, page = 1) => {
        setLoading(true);
        const params = new URLSearchParams({
            status,
            page: String(page),
            per_page: String(pagination.per_page || 20),
        });

        fetch(`/admin/api/withdrawals?${params.toString()}`, { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load withdrawals.');
                return data;
            })
            .then(data => {
                setWithdrawals(data.withdrawals ?? []);
                setPagination(data.pagination ?? { current_page: page, last_page: 1, per_page: 20, total: data.withdrawals?.length ?? 0 });
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchWithdrawals(activeStatus);
    }, []);

    const approve = async (id) => {
        setApproving(id);
        try {
            const res = await fetch(`/admin/api/withdrawals/${id}/approve`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(data.message);
            fetchWithdrawals(activeStatus, pagination.current_page);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setApproving(null);
        }
    };

    return (
        <AdminLayout title="Withdrawals">
            <Head title="Admin Withdrawals | Takeer" />
            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <ArrowDownToLine className="h-6 w-6 text-emerald-700" /> Withdrawal Operations
                        </h1>
                        <p className="text-slate-600 mt-1 text-sm">Approve, monitor, and reconcile provider payout requests.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={() => fetchWithdrawals(activeStatus)} disabled={loading}>
                            Refresh
                        </Button>
                        <Link href="/admin/payout-settings">
                            <Button variant="outline">
                                <Settings2 className="mr-2 h-4 w-4" />
                                Payout Settings
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {statuses.map((status) => (
                        <button
                            key={status.key}
                            type="button"
                            onClick={() => {
                                setActiveStatus(status.key);
                                fetchWithdrawals(status.key, 1);
                            }}
                            className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                                activeStatus === status.key
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center py-16 text-slate-500">Loading...</div>
                ) : withdrawals.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-600 opacity-70" />
                            <p className="font-semibold">No {activeStatus === 'all' ? '' : activeStatus} withdrawals</p>
                            <p className="text-xs mt-1">Nothing to show for this status.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            {withdrawals.map(w => (
                                <Card key={w.id} className="bg-white border-slate-200 shadow-sm">
                                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                                                <ArrowDownToLine className="h-5 w-5 text-emerald-700" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{w.user?.name ?? 'User'}</p>
                                                <p className="text-slate-500 text-xs">{w.user?.phone_number || 'No phone'}</p>
                                                {w.merchant && (
                                                    <p className="text-slate-500 text-xs">{w.merchant.display_name || w.merchant.username}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${statusClass(w.status)}`}>
                                                    {w.status}
                                                </p>
                                                <p className="text-2xl font-black text-slate-900">{formatMoney(w.merchant_amount ?? w.amount, w.merchant_currency_code)}</p>
                                                <p className="text-xs font-bold text-emerald-700">
                                                    Payout {formatMoney(w.payout_amount ?? w.amount, w.payout_currency_code)}
                                                </p>
                                                {Number(w.wallet_debit_amount || 0) > Number(w.merchant_amount || w.amount || 0) && (
                                                    <p className="text-[11px] font-semibold text-slate-600">
                                                        Wallet debit {formatMoney(w.wallet_debit_amount, w.merchant_currency_code)}
                                                    </p>
                                                )}
                                                {(Number(w.payout_snapshot?.fx_margin_amount || 0) > 0 || Number(w.withdrawal_fee_amount || 0) > 0 || Number(w.provider_cost_amount || 0) > 0) && (
                                                    <p className="text-[11px] font-semibold text-amber-700">
                                                        Buffer {formatMoney(w.payout_snapshot?.fx_margin_amount || 0, w.payout_currency_code)}
                                                        {' '}• Merchant fee {formatMoney(w.withdrawal_fee_amount || 0, w.withdrawal_fee_currency_code || w.merchant_currency_code)}
                                                        {' '}• Provider cost {formatMoney(w.provider_cost_amount || 0, w.provider_cost_currency_code || w.payout_currency_code)}
                                                    </p>
                                                )}
                                                {w.fx_rate_merchant_to_payout && (
                                                    <p className="text-[11px] text-slate-500">
                                                        1 {w.merchant_currency_code} ≈ {Number(w.fx_rate_merchant_to_payout).toLocaleString(undefined, { maximumFractionDigits: 6 })} {w.payout_currency_code}
                                                    </p>
                                                )}
                                                {(w.provider || w.provider_reference || w.provider_status) && (
                                                    <p className="text-[11px] text-slate-500">
                                                        Provider {w.provider || 'route'}{w.provider_status ? ` • ${w.provider_status}` : ''}{w.provider_reference ? ` • ${w.provider_reference}` : ''}
                                                    </p>
                                                )}
                                                {Number(w.treasury_reserved_amount || 0) > 0 && (
                                                    <p className="text-[11px] text-sky-700 font-semibold">
                                                        Treasury reserved {formatMoney(w.treasury_reserved_amount, w.treasury_reserved_currency_code || w.payout_currency_code)}
                                                    </p>
                                                )}
                                                {Number(w.wallet_refund_amount || 0) > 0 && (
                                                    <p className="text-[11px] text-red-600 font-semibold">
                                                        Refunded {formatMoney(w.wallet_refund_amount, w.merchant_currency_code)}
                                                    </p>
                                                )}
                                                <p className="text-xs text-slate-500">
                                                    #{w.id} • {new Date(w.created_at).toLocaleDateString('sw-TZ')}
                                                    {w.fx_rate_date ? ` • FX ${w.fx_rate_date}` : ''}
                                                </p>
                                            </div>
                                            {w.status === 'pending' ? (
                                                <Button
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                                    onClick={() => approve(w.id)}
                                                    disabled={approving === w.id}
                                                >
                                                    {approving === w.id ? 'Submitting...' : 'Approve'}
                                                </Button>
                                            ) : (
                                                <Button variant="outline" className="shrink-0" disabled>
                                                    {w.status === 'processing' ? 'Awaiting provider' : 'Handled'}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {pagination.last_page > 1 && (
                            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                                <p className="font-semibold">
                                    Page {pagination.current_page} of {pagination.last_page} • {Number(pagination.total || 0).toLocaleString()} withdrawals
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => fetchWithdrawals(activeStatus, Math.max(1, pagination.current_page - 1))}
                                        disabled={loading || pagination.current_page <= 1}
                                    >
                                        <ChevronLeft className="mr-1 h-4 w-4" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => fetchWithdrawals(activeStatus, Math.min(pagination.last_page, pagination.current_page + 1))}
                                        disabled={loading || pagination.current_page >= pagination.last_page}
                                    >
                                        Next
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function statusClass(status) {
    if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    if (status === 'processing') return 'bg-sky-50 text-sky-700 border border-sky-100';
    if (status === 'failed') return 'bg-red-50 text-red-700 border border-red-100';
    return 'bg-amber-50 text-amber-700 border border-amber-100';
}
