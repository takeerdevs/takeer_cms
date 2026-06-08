import React, { useState, useEffect } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ArrowDownToLine, CheckCircle2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

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

    useEffect(() => {
        fetch('/admin/api/withdrawals', { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load withdrawals.');
                return data;
            })
            .then(data => { setWithdrawals(data.withdrawals ?? []); setLoading(false); })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });
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
            setWithdrawals(prev => prev.filter(w => w.id !== id));
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
                            <ArrowDownToLine className="h-6 w-6 text-emerald-700" /> Pending Withdrawals
                        </h1>
                        <p className="text-slate-600 mt-1 text-sm">Approve user payout requests.</p>
                    </div>
                    <Link href="/admin/payout-settings">
                        <Button variant="outline">
                            <Settings2 className="mr-2 h-4 w-4" />
                            Payout Settings
                        </Button>
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-16 text-slate-500">Loading...</div>
                ) : withdrawals.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-600 opacity-70" />
                            <p className="font-semibold">No pending withdrawals</p>
                            <p className="text-xs mt-1">All withdrawal requests are already handled.</p>
                        </CardContent>
                    </Card>
                ) : (
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
                                            <p className="text-2xl font-black text-slate-900">{formatMoney(w.merchant_amount ?? w.amount, w.merchant_currency_code)}</p>
                                            <p className="text-xs font-bold text-emerald-700">
                                                Payout {formatMoney(w.payout_amount ?? w.amount, w.payout_currency_code)}
                                            </p>
                                            {(Number(w.payout_snapshot?.fx_margin_amount || 0) > 0 || Number(w.payout_snapshot?.withdrawal_fee_amount || 0) > 0) && (
                                                <p className="text-[11px] font-semibold text-amber-700">
                                                    Buffer {formatMoney(w.payout_snapshot?.fx_margin_amount || 0, w.payout_currency_code)}
                                                    {' '}• Fee {formatMoney(w.payout_snapshot?.withdrawal_fee_amount || 0, w.payout_snapshot?.withdrawal_fee_currency_code || w.payout_currency_code)}
                                                </p>
                                            )}
                                            {w.fx_rate_merchant_to_payout && (
                                                <p className="text-[11px] text-slate-500">
                                                    1 {w.merchant_currency_code} ≈ {Number(w.fx_rate_merchant_to_payout).toLocaleString(undefined, { maximumFractionDigits: 6 })} {w.payout_currency_code}
                                                </p>
                                            )}
                                            <p className="text-xs text-slate-500">
                                                #{w.id} • {new Date(w.created_at).toLocaleDateString('sw-TZ')}
                                                {w.fx_rate_date ? ` • FX ${w.fx_rate_date}` : ''}
                                            </p>
                                        </div>
                                        <Button
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                            onClick={() => approve(w.id)}
                                            disabled={approving === w.id}
                                        >
                                            {approving === w.id ? 'Submitting...' : 'Approve'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
