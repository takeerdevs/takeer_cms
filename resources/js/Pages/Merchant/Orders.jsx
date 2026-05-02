import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    ArrowLeft,
    Box,
    BookOpenText,
    CheckCircle,
    Clock,
    Crown,
    Download,
    Filter,
    Loader2,
    Package,
    ShoppingBag,
    Store,
    Truck,
    XCircle,
    ChevronRight,
    CalendarClock,
    Boxes,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const tabs = [
    { key: 'all', label: 'Zote', icon: Package },
    { key: 'awaiting_merchant_confirmation', label: 'Mpya', icon: Clock },
    { key: 'escrow_locked', label: 'Escrow (Safarini)', icon: Truck },
    { key: 'resolved_merchant_paid', label: 'Zilizokamilika', icon: CheckCircle },
    { key: 'disputed', label: 'Migogoro', icon: XCircle },
];

export default function MerchantOrders({ merchantUsername, merchantName }) {
    const { auth } = usePage().props;
    const merchantSlug = merchantUsername || auth?.user?.merchant_profiles?.[0]?.username || '';

    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState({});
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [perPage, setPerPage] = useState(20);

    useEffect(() => {
        loadSummary();
    }, [merchantSlug]);

    useEffect(() => {
        setPage(1);
    }, [merchantSlug, activeTab, perPage]);

    useEffect(() => {
        loadOrders();
    }, [merchantSlug, activeTab, page, perPage]);

    async function loadSummary() {
        try {
            const res = await axios.get(`/merchant/${merchantSlug}/orders/api/summary`);
            setSummary(res.data);
        } catch (error) {
            console.error('Failed to load order summary', error);
        }
    }

    async function loadOrders() {
        setLoading(true);
        try {
            const statusFilter = activeTab === 'all' ? '' : `?status=${activeTab}`;
            const pageParam = `page=${page}`;
            const perPageParam = `per_page=${perPage}`;
            const query = statusFilter ? `${statusFilter}&${pageParam}&${perPageParam}` : `?${pageParam}&${perPageParam}`;
            const res = await axios.get(`/merchant/${merchantSlug}/orders/api${query}`);
            setOrders(res.data?.data || []);
            setMeta(res.data?.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            toast.error('Imeshindwa kupakia oda.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <AppLayout>
            <Head title={`Oda za ${merchantName || 'Biashara'} | Takeer`} />

            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-10 w-10 bg-accent hover:bg-accent/80"
                        onClick={() => router.visit(`/merchant/${merchantSlug}/dashboard`)}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            Oda za Biashara <ShoppingBag className="h-5 w-5 text-brand-600" />
                        </h1>
                        <p className="text-sm text-muted-foreground">Simamia oda na mauzo yako yote.</p>
                    </div>
                </div>

                {/* ── Stats Overview ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Zote Zote" value={summary.total || 0} icon={Package} tone="from-gray-500/15 to-slate-500/10 text-gray-700" />
                    <StatCard label="Oda Mpya" value={summary.pending || 0} icon={Clock} tone="from-amber-500/15 to-orange-500/10 text-amber-700" />
                    <StatCard label="Escrow (Safarini)" value={summary.escrow || 0} icon={Truck} tone="from-sky-500/15 to-cyan-500/10 text-sky-700" />
                    <StatCard label="Zilizokamilika" value={summary.completed || 0} icon={CheckCircle} tone="from-emerald-500/15 to-teal-500/10 text-emerald-700" />
                </div>

                {/* ── Tabs ── */}
                <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
                    <div className="flex gap-2 rounded-2xl bg-muted/40 p-2 w-fit">
                        {tabs.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setActiveTab(key)}
                                className={[
                                    'inline-flex items-center whitespace-nowrap gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all',
                                    activeTab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                ].join(' ')}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <select
                        value={perPage}
                        onChange={(e) => setPerPage(Number(e.target.value))}
                        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                        <option value={12}>12 / page</option>
                        <option value={24}>24 / page</option>
                        <option value={48}>48 / page</option>
                    </select>
                </div>

                {/* ── Order List ── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        <p className="text-sm font-bold text-muted-foreground">Inatafuta oda zetu...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <EmptyState activeTab={activeTab} />
                ) : (
                    <div className="grid gap-4">
                        {orders.map(order => (
                            <OrderCard key={order.id} order={order} merchantUsername={merchantSlug} />
                        ))}

                        {meta.last_page > 1 && (
                            <div className="flex items-center justify-between pt-1">
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={meta.current_page <= 1}
                                >
                                    Previous
                                </Button>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    Page {meta.current_page} / {meta.last_page}
                                </p>
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                                    disabled={meta.current_page >= meta.last_page}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function StatCard({ label, value, icon: Icon, tone }) {
    return (
        <div className={`rounded-2xl border border-white/70 bg-gradient-to-br ${tone} px-4 py-4 shadow-sm`}>
            <Icon className="h-5 w-5 mb-3 opacity-80" />
            <p className="text-2xl font-black">{value}</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80 mt-1 truncate">{label}</p>
        </div>
    );
}

function EmptyState({ activeTab }) {
    const messages = {
        all: "Biashara yako haina oda yoyote kwa sasa. Endelea kupromote bidhaa zako!",
        awaiting_merchant_confirmation: "Hakuna oda mpya zinazosubiri uhakiki.",
        escrow_locked: "Hakuna oda zilizopo kwenye Escrow (safarini) kwa sasa.",
        resolved_merchant_paid: "Hakuna oda zilizokamilika kwenye hii filter.",
        disputed: "Safi sana! Hakuna migogoro yoyote kwa kipindi hiki.",
    };

    return (
        <Card className="rounded-[24px] border-dashed bg-background/50">
            <CardContent className="p-10 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                    <Box className="h-8 w-8" />
                </div>
                <p className="text-lg font-black">Hakuna Oda</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-6">
                    {messages[activeTab] || messages['all']}
                </p>
            </CardContent>
        </Card>
    );
}

function OrderCard({ order, merchantUsername }) {
    const buyer = order.buyer || {};
    const product = order.product || {};
    const maskedBuyerPhone = maskPhone(buyer.phone_number || '');

    const statusConfig = {
        awaiting_merchant_confirmation: {
            label: order.is_escrow_order ? 'Mpya - Thibitisha' : 'Imelipwa',
            classes: order.is_escrow_order ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
        },
        escrow_locked: {
            label: order.is_escrow_order ? 'Inasafirisha (Escrow)' : 'Imelipwa',
            classes: order.is_escrow_order ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
        },
        shipped: { label: 'Njiani', classes: 'bg-indigo-100 text-indigo-700' },
        resolved_merchant_paid: { label: 'Imekamilika', classes: 'bg-emerald-100 text-emerald-700' },
        disputed: { label: 'Mgogoro', classes: 'bg-red-100 text-red-700' },
        failed: { label: 'Imesitishwa', classes: 'bg-red-100 text-red-700' },
    };

    const config = statusConfig[order.payment_status] || { label: order.payment_status, classes: 'bg-muted text-muted-foreground' };
    const displayTitle = order.display_title || product.title || 'Order item';
    
    // POS specific display logic
    const isPos = order.source === 'pos';
    const displayId = isPos ? `#POS-${order.public_id}` : `#${order.transaction_ref || order.id}`;
    const customerIdentifier = isPos 
        ? (order.customer_name || order.customer_phone || 'Guest') 
        : (buyer.name || maskedBuyerPhone || 'N/A');

    const displayIcon = (() => {
        switch (order.display_icon) {
            case 'book_open': return BookOpenText;
            case 'download': return Download;
            case 'calendar_clock': return CalendarClock;
            case 'shopping_bag': return ShoppingBag;
            case 'boxes': return Boxes;
            case 'crown': return Crown;
            default: return isPos ? Store : Box;
        }
    })();

    return (
        <Card className="rounded-[24px] overflow-hidden hover:border-brand-300 transition-colors group cursor-pointer" onClick={() => router.visit(`/merchant/${merchantUsername}/orders/${order.id}`)}>
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                {/* ── Product Image ── */}
                <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted overflow-hidden border">
                    {product.image_url ? (
                        <img src={product.image_url} alt={product.title} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground bg-accent">
                            {React.createElement(displayIcon, { className: 'h-8 w-8 opacity-70' })}
                        </div>
                    )}
                </div>
 
                {/* ── Order Details ── */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${config.classes}`}>
                            {config.label}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">{displayId}</span>
                    </div>

                    <h3 className="font-black text-lg truncate leading-tight mt-2">{displayTitle}</h3>

                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground font-medium">
                        <span className="flex items-center gap-1.5 bg-background border px-2 py-0.5 rounded-lg text-xs">
                            <Store className="h-3 w-3" /> {isPos ? 'Mteja POS:' : 'Mteja:'} {customerIdentifier}
                        </span>
                        <span>•</span>
                        <span>Qty: {order.quantity || 1}</span>
                    </div>
                </div>

                {/* ── Price & Action ── */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 sm:gap-2 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l sm:pl-6 border-dashed">
                    <div className="text-left sm:text-right">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Total Paid</p>
                        <p className="text-xl font-black text-brand-600">TZS {Number(order.total_paid || 0).toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 hover:text-brand-700">
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}

function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 6) return `${digits.slice(0, 2)}...${digits.slice(-2)}`;
    return `${digits.slice(0, 3)}...${digits.slice(-3)}`;
}
