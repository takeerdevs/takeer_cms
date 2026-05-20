import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Banknote, CalendarDays, CheckCircle2, CreditCard, Link as LinkIcon, Phone, ReceiptText, Search, Send, User2 } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import { toast } from 'sonner';

export default function Outstanding({ merchant }) {
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState({ count: 0, outstanding_credit: 0 });
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [settleNote, setSettleNote] = useState('');
    const [settling, setSettling] = useState(false);
    const [generatingLinkId, setGeneratingLinkId] = useState(null);
    const [paymentLink, setPaymentLink] = useState(null);
    const toBool = (value) => value === true || value === 1 || value === '1' || value === 'true';
    const posPaymentLinksDisabled = toBool(summary.pos_payment_links_disabled)
        || toBool(merchant?.retail_settings?.disable_pos_payment_links);

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: merchant.currency?.code || 'TZS',
        minimumFractionDigits: 0,
    }).format(Number(val || 0));

    const formatDateTime = (val) => {
        if (!val) return 'Unknown date';

        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(val));
    };

    const customerGroups = useMemo(() => {
        const groups = new Map();

        orders.forEach((order) => {
            const phone = (order.customer_phone || '').trim();
            const name = (order.customer_name || 'Walk-in customer').trim();
            const key = phone || name.toLowerCase();

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    name,
                    phone,
                    totalOutstanding: 0,
                    totalPayable: 0,
                    totalPaid: 0,
                    orders: [],
                });
            }

            const group = groups.get(key);
            group.totalOutstanding += Number(order.outstanding_balance || 0);
            group.totalPayable += Number(order.payable_total || 0);
            group.totalPaid += Number(order.total_paid || 0);
            group.orders.push(order);
        });

        return Array.from(groups.values()).map((group) => ({
            ...group,
            orders: group.orders.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
        }));
    }, [orders]);

    const fetchOutstanding = async (q = query) => {
        setLoading(true);
        try {
            delete window.axios.defaults.headers.common.Authorization;
            const res = await window.axios.get('/api/retail/outstanding-balances', {
                params: { q },
            });
            setOrders(res.data.data || []);
            setSummary(res.data.summary || { count: 0, outstanding_credit: 0 });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load outstanding balances.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(() => fetchOutstanding(query), 350);
        return () => clearTimeout(timeout);
    }, [query]);

    const openSettle = (order) => {
        setSelectedOrder(order);
        setSettleAmount(String(order.outstanding_balance || ''));
        setSettleNote('');
    };

    const settleOrder = async () => {
        if (!selectedOrder || settling) return;
        const amount = Number(settleAmount || 0);
        if (!amount || amount <= 0) {
            toast.error('Enter a valid payment amount.');
            return;
        }

        setSettling(true);
        try {
            await window.axios.post(`/api/retail/outstanding-balances/${selectedOrder.id}/settle`, {
                amount,
                note: settleNote,
            });
            toast.success('Payment recorded.');
            setSelectedOrder(null);
            await fetchOutstanding();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to settle this balance.');
        } finally {
            setSettling(false);
        }
    };

    const copyText = async (text) => {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    };

    const sendPaymentLink = async (order) => {
        if (!order || generatingLinkId) return;
        if (posPaymentLinksDisabled) {
            toast.error('POS payment links are disabled for this merchant.');
            return;
        }

        setGeneratingLinkId(order.id);
        try {
            const res = await window.axios.post(`/api/retail/outstanding-balances/${order.id}/payment-link`);
            const url = res.data?.url;
            if (!url) throw new Error('Missing URL');

            setPaymentLink({ order, url });
            try {
                await copyText(url);
                toast.success('Payment link copied. Send it to the customer on WhatsApp or SMS.');
            } catch (copyErr) {
                toast.success('Payment link created. Copy it from the box below.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not create payment link.');
        } finally {
            setGeneratingLinkId(null);
        }
    };

    return (
        <AppLayout>
            <Head title={`Outstanding Balances | ${merchant.display_name}`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <Button
                            variant="ghost"
                            className="h-9 px-2 text-slate-500 hover:text-slate-900"
                            onClick={() => router.visit(`/merchant/${merchant.username}/retail/dashboard`)}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" /> Retail Dashboard
                        </Button>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                                Outstanding Balances <CreditCard className="h-7 w-7 text-amber-600" />
                            </h1>
                            <p className="text-muted-foreground">Find credit customers and record payments when they come back.</p>
                        </div>
                    </div>
                    <Card className="bg-amber-50 border-amber-100 shadow-sm">
                        <CardContent className="p-5 min-w-[240px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Total Outstanding</p>
                            <p className="text-3xl font-black text-amber-900">{formatCurrency(summary.outstanding_credit)}</p>
                            <p className="text-xs font-bold text-amber-700 mt-1">{summary.count} open balances</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="relative max-w-xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search customer, phone, or POS number"
                        className="pl-10 h-12 rounded-xl bg-white"
                    />
                </div>

                {posPaymentLinksDisabled && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                        POS payment links are disabled for this merchant. You can still record cash or manual payments, but customers cannot pay outstanding POS balances through links until Takeer re-enables them.
                    </div>
                )}

                {loading ? (
                    <div className="py-16 text-center text-sm font-bold text-muted-foreground">Loading outstanding balances...</div>
                ) : orders.length === 0 ? (
                    <div className="py-16 rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 text-center">
                        <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
                        <p className="font-black text-emerald-900">No outstanding balances found.</p>
                        <p className="text-sm text-emerald-700">All store credit orders are settled.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {customerGroups.map((customer) => (
                            <Card key={customer.key} className="bg-white border-amber-100 shadow-sm rounded-2xl overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="p-5 md:p-6 border-b border-amber-100 bg-amber-50/50">
                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                                    <User2 className="h-4 w-4" />
                                                    Customer account
                                                </div>
                                                <h2 className="text-2xl font-black text-slate-950 mt-2 truncate">{customer.name}</h2>
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mt-1">
                                                    <Phone className="h-4 w-4" />
                                                    {customer.phone || 'No phone saved'}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 md:min-w-[420px]">
                                                <div className="rounded-xl bg-white p-3 border border-amber-100">
                                                    <p className="text-[9px] font-black uppercase text-slate-400">Open</p>
                                                    <p className="text-sm font-black text-slate-900">{customer.orders.length} balances</p>
                                                </div>
                                                <div className="rounded-xl bg-white p-3 border border-amber-100">
                                                    <p className="text-[9px] font-black uppercase text-emerald-600">Paid</p>
                                                    <p className="text-sm font-black text-emerald-700">{formatCurrency(customer.totalPaid)}</p>
                                                </div>
                                                <div className="rounded-xl bg-white p-3 border border-amber-100">
                                                    <p className="text-[9px] font-black uppercase text-amber-700">Owes</p>
                                                    <p className="text-sm font-black text-amber-800">{formatCurrency(customer.totalOutstanding)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                        {customer.orders.map((order) => (
                                            <div key={order.id} className="p-5 md:p-6 space-y-4">
                                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                                    <div className="min-w-0 space-y-2">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">#POS-{order.public_id}</p>
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                                                <CalendarDays className="h-3.5 w-3.5" />
                                                                Taken {formatDateTime(order.created_at)}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {(order.items || []).slice(0, 4).map((item) => (
                                                                <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
                                                                    <span className="font-bold text-slate-700 truncate">
                                                                        {item.product_title}{item.variant_name ? ` (${item.variant_name})` : ''}
                                                                    </span>
                                                                    <span className="font-black text-slate-900 shrink-0">Qty {item.quantity}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:min-w-[520px]">
                                                        <div className="rounded-xl bg-slate-50 p-3">
                                                            <p className="text-[9px] font-black uppercase text-slate-400">Total</p>
                                                            <p className="text-sm font-black">{formatCurrency(order.payable_total)}</p>
                                                        </div>
                                                        <div className="rounded-xl bg-emerald-50 p-3">
                                                            <p className="text-[9px] font-black uppercase text-emerald-600">Paid</p>
                                                            <p className="text-sm font-black text-emerald-700">{formatCurrency(order.total_paid)}</p>
                                                        </div>
                                                        <div className="rounded-xl bg-amber-50 p-3">
                                                            <p className="text-[9px] font-black uppercase text-amber-700">Balance</p>
                                                            <p className="text-sm font-black text-amber-800">{formatCurrency(order.outstanding_balance)}</p>
                                                        </div>
                                                        <div className="rounded-xl bg-slate-50 p-3">
                                                            <p className="text-[9px] font-black uppercase text-slate-400">Staff</p>
                                                            <p className="text-sm font-black truncate">{order.pos_staff?.name || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {(order.payment_history || []).length > 0 && (
                                                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2">
                                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                            <ReceiptText className="h-3.5 w-3.5" />
                                                            Payment history
                                                        </div>
                                                        {(order.payment_history || []).map((payment) => (
                                                            <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-bold text-slate-600">
                                                                <span>
                                                                    {formatCurrency(payment.amount)} paid on {formatDateTime(payment.recorded_at)}
                                                                    {payment.recorded_by ? ` by ${payment.recorded_by}` : ''}
                                                                </span>
                                                                <span className="text-slate-500">
                                                                    Remaining {formatCurrency(payment.remaining_balance)}
                                                                    {payment.note ? ` - ${payment.note}` : ''}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="grid sm:grid-cols-2 gap-2">
                                                    <Button
                                                        className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
                                                        onClick={() => openSettle(order)}
                                                    >
                                                        <Banknote className="h-4 w-4 mr-2" /> Record Payment
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className={`w-full h-11 rounded-xl font-black ${posPaymentLinksDisabled ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed' : 'border-amber-200 text-amber-800 hover:bg-amber-50'}`}
                                                        onClick={() => sendPaymentLink(order)}
                                                        disabled={generatingLinkId === order.id || posPaymentLinksDisabled}
                                                    >
                                                        {posPaymentLinksDisabled ? (
                                                            <>
                                                                <LinkIcon className="h-4 w-4 mr-2" /> Links Disabled
                                                            </>
                                                        ) : generatingLinkId === order.id ? (
                                                            <>
                                                                <LinkIcon className="h-4 w-4 mr-2" /> Creating...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Send className="h-4 w-4 mr-2" /> Send Payment Link
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <User2 className="h-5 w-5 text-amber-600" />
                            Clear Customer Balance
                        </DialogTitle>
                        <DialogDescription>
                            Record a full or partial payment for #{selectedOrder?.public_id}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                            <p className="font-black text-slate-900">{selectedOrder?.customer_name}</p>
                            <p className="text-xs font-bold text-slate-500">{selectedOrder?.customer_phone}</p>
                            <p className="text-sm font-black text-amber-700 mt-3">
                                Remaining: {formatCurrency(selectedOrder?.outstanding_balance)}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount Paid</label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={settleAmount}
                                onChange={(e) => setSettleAmount(e.target.value)}
                                className="h-12 rounded-xl font-black"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note</label>
                            <Input
                                value={settleNote}
                                onChange={(e) => setSettleNote(e.target.value)}
                                placeholder="Cash, mobile money ref, or internal note"
                                className="h-12 rounded-xl"
                            />
                        </div>
                        <Button
                            className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
                            onClick={settleOrder}
                            disabled={settling}
                        >
                            {settling ? 'Recording...' : 'Save Payment'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!paymentLink} onOpenChange={(open) => !open && setPaymentLink(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-amber-600" />
                            Send Payment Link
                        </DialogTitle>
                        <DialogDescription>
                            Share this link with {paymentLink?.order?.customer_name || 'the customer'} so they can pay online.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">POS Balance</p>
                            <p className="font-black text-slate-900 mt-1">#POS-{paymentLink?.order?.public_id}</p>
                            <p className="text-sm font-black text-amber-700 mt-2">
                                Remaining: {formatCurrency(paymentLink?.order?.outstanding_balance)}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment URL</label>
                            <Input
                                readOnly
                                value={paymentLink?.url || ''}
                                className="h-12 rounded-xl text-xs font-bold"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                        <Button
                            className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
                            onClick={async () => {
                                try {
                                    await copyText(paymentLink?.url || '');
                                    toast.success('Payment link copied.');
                                } catch (err) {
                                    toast.error('Select the link and copy it manually.');
                                }
                            }}
                        >
                            <LinkIcon className="h-4 w-4 mr-2" /> Copy Link
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
