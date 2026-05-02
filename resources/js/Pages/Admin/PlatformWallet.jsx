import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Wallet, TrendingUp, ReceiptText, ArrowDownToLine, Store, ShieldCheck, Globe2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PlatformWallet() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        setLoading(true);
        fetch(`/admin/api/platform-wallet?page=${page}`, { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const payload = await r.json();
                if (!r.ok) throw new Error(payload.message || 'Failed to load platform wallet.');
                return payload;
            })
            .then((payload) => {
                setData(payload);
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });
    }, [page]);

    const metrics = data?.metrics || {};
    const transactions = data?.transactions?.data || [];
    const nativeCurrencyTotals = data?.native_currency_totals || [];
    const countryTotals = data?.country_totals || [];
    const meta = data?.transactions || {};
    const baseCurrency = metrics.base_currency_code || 'USD';

    const formatMoney = (amount, currency = baseCurrency) => new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'USD' ? 2 : 0,
    }).format(Number(amount || 0));

    const formatDate = (value) => value
        ? new Intl.DateTimeFormat('sw-TZ', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value))
        : '-';

    return (
        <AdminLayout title="Platform Wallet">
            <Head title="Platform Wallet | Takeer Admin" />

            <div className="space-y-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Wallet className="h-6 w-6 text-brand-700" /> Platform Wallet
                        </h1>
                        <p className="text-slate-600 mt-1 text-sm">
                            Track Takeer fees, GMV, merchant payouts, and transaction proof for investor-ready reporting.
                        </p>
                    </div>
                    <Link href="/admin/withdrawals">
                        <Button variant="outline" className="rounded-xl">
                            <ArrowDownToLine className="h-4 w-4 mr-2" /> Merchant Withdrawals
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <MetricCard
                        title={`System Wallet (${baseCurrency})`}
                        value={formatMoney(metrics.total_takeer_fees)}
                        hint="Lifetime Takeer platform fees"
                        icon={Wallet}
                        tone="text-brand-700"
                    />
                    <MetricCard
                        title={`This Month Fees (${baseCurrency})`}
                        value={formatMoney(metrics.this_month_takeer_fees)}
                        hint={`Today: ${formatMoney(metrics.today_takeer_fees)}`}
                        icon={TrendingUp}
                        tone="text-emerald-700"
                    />
                    <MetricCard
                        title={`Platform GMV (${baseCurrency})`}
                        value={formatMoney(metrics.total_gmv)}
                        hint={`${Number(metrics.total_orders || 0).toLocaleString()} orders`}
                        icon={ReceiptText}
                        tone="text-indigo-700"
                    />
                    <MetricCard
                        title={`Net to Merchants (${baseCurrency})`}
                        value={formatMoney(metrics.total_net_to_merchants)}
                        hint="Converted using transaction-time FX snapshots"
                        icon={ShieldCheck}
                        tone="text-amber-700"
                    />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <BreakdownPanel
                        title="Native Currency Totals"
                        description="Local values stay separated, so TZS and KES are never summed directly."
                        rows={nativeCurrencyTotals}
                        emptyText="No native currency totals yet."
                        renderRow={(row) => (
                            <>
                                <div>
                                    <p className="text-sm font-black text-slate-900">{row.currency_code}</p>
                                    <p className="text-xs text-slate-500">{Number(row.transaction_count || 0).toLocaleString()} transactions</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">{formatMoney(row.total_gmv, row.currency_code)}</p>
                                    <p className="text-xs text-emerald-600 font-bold">Fees {formatMoney(row.total_takeer_fees, row.currency_code)}</p>
                                </div>
                            </>
                        )}
                    />
                    <BreakdownPanel
                        title={`Country Totals (${baseCurrency})`}
                        description="Country view uses local GMV plus the stored base equivalent for investor reporting."
                        rows={countryTotals}
                        emptyText="No country totals yet."
                        renderRow={(row) => (
                            <>
                                <div>
                                    <p className="text-sm font-black text-slate-900">{row.country_name || row.country_code}</p>
                                    <p className="text-xs text-slate-500">{formatMoney(row.native_gmv, row.currency_code)} native GMV</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900">{formatMoney(row.base_gmv)}</p>
                                    <p className="text-xs text-emerald-600 font-bold">Fees {formatMoney(row.base_takeer_fees)}</p>
                                </div>
                            </>
                        )}
                    />
                </div>

                <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                        <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Transaction Proof Ledger</h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Every row ties Takeer fee revenue back to a payment reference, order, merchant, and customer.
                                </p>
                            </div>
                            <Store className="h-5 w-5 text-slate-400" />
                        </div>

                        {loading ? (
                            <div className="p-16 text-center text-slate-500 font-bold">Loading platform ledger...</div>
                        ) : transactions.length === 0 ? (
                            <div className="p-16 text-center text-slate-500">
                                <p className="font-bold">No platform transactions yet.</p>
                                <p className="text-xs mt-1">Takeer fees will appear here after paid orders are recorded.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Date / Ref</th>
                                            <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Merchant</th>
                                            <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Customer / Product</th>
                                            <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Gross</th>
                                            <th className="p-4 text-[11px] font-black uppercase tracking-widest text-red-500">Takeer Fee</th>
                                            <th className="p-4 text-[11px] font-black uppercase tracking-widest text-emerald-600">Merchant Net</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {transactions.map((tx) => (
                                            <tr key={`${tx.type}-${tx.id}`} className="hover:bg-slate-50">
                                                <td className="p-4">
                                                    <p className="text-sm font-black text-slate-900 whitespace-nowrap">{formatDate(tx.created_at)}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono mt-1">Ref: {tx.reference || 'N/A'}</p>
                                                    {tx.order_id && <p className="text-[10px] text-slate-400 mt-0.5">Order #{tx.order_id}</p>}
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-bold text-slate-900">{tx.merchant?.name || 'N/A'}</p>
                                                    {tx.merchant?.username && <p className="text-xs text-slate-500">@{tx.merchant.username}</p>}
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-bold text-slate-900">{tx.customer?.name || 'Mteja'}</p>
                                                    <p className="text-xs text-slate-500 italic mt-0.5">{tx.product_name || 'Order payment'}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-bold text-slate-700">{formatMoney(tx.gross_amount, tx.currency_code)}</p>
                                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{formatMoney(tx.gross_amount_base, tx.base_currency_code)}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-black text-red-500">{formatMoney(tx.fee_amount, tx.currency_code)}</p>
                                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{formatMoney(tx.fee_amount_base, tx.base_currency_code)}</p>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-black text-emerald-600">{formatMoney(tx.net_amount, tx.currency_code)}</p>
                                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{formatMoney(tx.net_amount_base, tx.base_currency_code)}</p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {meta.last_page > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-xs font-bold text-slate-500">
                            Page {meta.current_page} of {meta.last_page} • {Number(meta.total || 0).toLocaleString()} records
                        </p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                Previous
                            </Button>
                            <Button variant="outline" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function MetricCard({ title, value, hint, icon: Icon, tone }) {
    return (
        <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
                    <Icon className={`h-5 w-5 ${tone}`} />
                </div>
                <p className={`text-2xl font-black ${tone}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{hint}</p>
            </CardContent>
        </Card>
    );
}

function BreakdownPanel({ title, description, rows, emptyText, renderRow }) {
    return (
        <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
                        <p className="text-xs text-slate-500 mt-1">{description}</p>
                    </div>
                    <Globe2 className="h-5 w-5 text-brand-600 shrink-0" />
                </div>
                <div className="mt-4 divide-y divide-slate-100">
                    {rows.length === 0 ? (
                        <p className="py-5 text-sm text-slate-500">{emptyText}</p>
                    ) : rows.map((row, index) => (
                        <div key={`${row.currency_code || row.country_code}-${index}`} className="py-3 flex items-center justify-between gap-4">
                            {renderRow(row)}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
