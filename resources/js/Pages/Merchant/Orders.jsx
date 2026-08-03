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
    DownloadCloud,
    Filter,
    Loader2,
    Layers,
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
import { useLocale } from '@/lib/i18n';

const tabs = [
    { key: 'all', enLabel: 'All', swLabel: 'Zote', icon: Package },
    { key: 'pending_fulfillment', enLabel: 'New', swLabel: 'Mpya', icon: Clock },
    { key: 'release_eligible', enLabel: 'Release eligible', swLabel: 'Tayari kwa release', icon: Truck },
    { key: 'paid_out', enLabel: 'Completed', swLabel: 'Zilizokamilika', icon: CheckCircle },
    { key: 'disputed', enLabel: 'Disputes', swLabel: 'Migogoro', icon: XCircle },
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

function isInternalPaymentOrder(order) {
    const transactionRef = String(order?.transaction_ref || order?.public_id || '');
    return ['extra_charge', 'pickup_delivery_fee'].includes(order?.purchasable_type)
        || transactionRef.startsWith('EXTRA-');
}

export default function MerchantOrders({ merchantUsername, merchantName }) {
    const { copy } = useLocale();
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
            setOrders((res.data?.data || []).filter((order) => !isInternalPaymentOrder(order)));
            setMeta(res.data?.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            toast.error(copy('Unable to load orders.', 'Imeshindwa kupakia oda.'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <AppLayout>
            <Head title={`${copy('Orders for', 'Oda za')} ${merchantName || copy('Business', 'Biashara')} | Takeer`} />

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
                            {copy('Business orders', 'Oda za biashara')} <ShoppingBag className="h-5 w-5 text-brand-600" />
                        </h1>
                        <p className="text-sm text-muted-foreground">{copy('Manage all your orders and sales.', 'Simamia oda na mauzo yako yote.')}</p>
                    </div>
                </div>

                {/* ── Stats Overview ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label={copy('All orders', 'Oda zote')} value={summary.total || 0} icon={Package} tone="from-gray-500/15 to-slate-500/10 text-gray-700" />
                    <StatCard label={copy('New orders', 'Oda mpya')} value={summary.pending || 0} icon={Clock} tone="from-amber-500/15 to-orange-500/10 text-amber-700" />
                    <StatCard label={copy('Ready for PSP payout', 'Tayari kwa PSP payout')} value={summary.release_eligible || 0} icon={Truck} tone="from-sky-500/15 to-cyan-500/10 text-sky-700" />
                    <StatCard label={copy('Completed', 'Zilizokamilika')} value={summary.completed || 0} icon={CheckCircle} tone="from-emerald-500/15 to-teal-500/10 text-emerald-700" />
                </div>

                {/* ── Tabs ── */}
                <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar">
                    <div className="flex gap-2 rounded-2xl bg-muted/40 p-2 w-fit">
                        {tabs.map(({ key, enLabel, swLabel, icon: Icon }) => (
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
                                {copy(enLabel, swLabel)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Order List ── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        <p className="text-sm font-bold text-muted-foreground">{copy('Loading orders...', 'Inatafuta oda zetu...')}</p>
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
                                    {copy('Previous', 'Iliyopita')}
                                </Button>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    {copy('Page', 'Ukurasa')} {meta.current_page} / {meta.last_page}
                                </p>
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                                    disabled={meta.current_page >= meta.last_page}
                                >
                                    {copy('Next', 'Inayofuata')}
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
    const { copy } = useLocale();
    const messages = {
        all: copy('Your business has no orders yet. Keep promoting your products!', 'Biashara yako haina oda yoyote kwa sasa. Endelea kupromote bidhaa zako!'),
        pending_fulfillment: copy('No new orders are waiting for fulfillment.', 'Hakuna oda mpya zinazosubiri utimilishaji.'),
        release_eligible: copy('No orders are ready to request PSP payout.', 'Hakuna oda zilizo tayari kuomba payout ya PSP.'),
        paid_out: copy('No completed orders for this filter.', 'Hakuna oda zilizokamilika kwenye hii filter.'),
        disputed: copy('Great! There are no disputes for this period.', 'Safi sana! Hakuna migogoro yoyote kwa kipindi hiki.'),
    };

    return (
        <Card className="rounded-[24px] border-dashed bg-background/50">
            <CardContent className="p-10 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                    <Box className="h-8 w-8" />
                </div>
                <p className="text-lg font-black">{copy('No orders', 'Hakuna oda')}</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-6">
                    {messages[activeTab] || messages['all']}
                </p>
            </CardContent>
        </Card>
    );
}

function OrderCard({ order, merchantUsername }) {
    const { copy } = useLocale();
    const [imageFailed, setImageFailed] = useState(false);
    const buyer = order.buyer || {};
    const product = order.product || {};
    const maskedBuyerPhone = maskPhone(buyer.phone_number || '');

    const statusConfig = {
            pending_fulfillment: {
            label: copy('Paid - fulfillment required', 'Imelipwa - utimilishaji unahitajika'),
            classes: 'bg-amber-100 text-amber-700'
        },
        release_eligible: {
            label: copy('Ready to request PSP payout', 'Tayari kuomba PSP payout'),
            classes: 'bg-sky-100 text-sky-700'
        },
        payout_processing: { label: copy('PSP payout processing', 'PSP payout inachakatwa'), classes: 'bg-indigo-100 text-indigo-700' },
        paid_out: { label: copy('Completed', 'Imekamilika'), classes: 'bg-emerald-100 text-emerald-700' },
        disputed: { label: copy('Dispute', 'Mgogoro'), classes: 'bg-red-100 text-red-700' },
        failed: { label: copy('Stopped', 'Imesitishwa'), classes: 'bg-red-100 text-red-700' },
    };

    const config = statusConfig[order.payment_status] || { label: order.payment_status, classes: 'bg-muted text-muted-foreground' };
    const displayTitle = order.display_title || product.title || copy('Order item', 'Item ya oda');
    const displayTotal = order.order_total_with_additions ?? order.total_paid ?? 0;
    const extraChargeTotal = Number(order.additional_paid_total || 0);

    // POS specific display logic
    const isPos = order.source === 'pos';
    const displayId = isPos ? `#POS-${order.public_id}` : `#${order.transaction_ref || order.id}`;
    const customerIdentifier = isPos
        ? (order.customer_name || order.customer_phone || copy('Guest', 'Mgeni'))
        : (buyer.name || maskedBuyerPhone || copy('N/A', 'Haipo'));

    const displayIcon = (() => {
        switch (order.display_icon) {
            case 'book_open': return BookOpenText;
            case 'download': return DownloadCloud;
            case 'calendar_clock': return CalendarClock;
            case 'shopping_bag': return ShoppingBag;
            case 'boxes': return Boxes;
            case 'layers': return Layers;
            case 'crown': return Crown;
            default: return isPos ? Store : Box;
        }
    })();
    const imageUrl = (product.image_url || order.display_image) && !imageFailed
        ? (product.image_url || order.display_image)
        : null;

    return (
        <Card className="rounded-[24px] overflow-hidden hover:border-brand-300 transition-colors group cursor-pointer" onClick={() => router.visit(`/merchant/${merchantUsername}/orders/${order.id}`)}>
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                {/* ── Product Image ── */}
                <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted overflow-hidden border">
                    {imageUrl ? (
                        <img src={imageUrl} alt={displayTitle} onError={() => setImageFailed(true)} className="h-full w-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center bg-brand-50 text-brand-600">
                            {React.createElement(displayIcon, { className: 'h-8 w-8' })}
                        </div>
                    )}
                </div>

                {/* ── Order Details ── */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${config.classes}`}>
                            {config.label}
                        </span>
                        {extraChargeTotal > 0 && (
                            <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-orange-700">
                                {copy('Extra', 'Ziada')} {formatMoney(extraChargeTotal, order.merchant_currency_code || 'TZS')}
                            </span>
                        )}
                        {order.return_request && (
                            <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-sky-700">
                                {copy('Return', 'Return')}: {String(order.return_request.status || '').replaceAll('_', ' ')}
                            </span>
                        )}
                        <span className="text-xs font-bold text-muted-foreground">{displayId}</span>
                    </div>

                    <h3 className="font-black text-lg truncate leading-tight mt-2">{displayTitle}</h3>

                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground font-medium">
                        <span className="flex items-center gap-1.5 bg-background border px-2 py-0.5 rounded-lg text-xs">
                            <Store className="h-3 w-3" /> {isPos ? copy('POS customer:', 'Mteja POS:') : copy('Customer:', 'Mteja:')} {customerIdentifier}
                        </span>
                        <span>•</span>
                        <span>{order.purchasable_type === 'offering_group' ? `${order.offering_group_selection?.lines?.length || 0} ${copy('lines', 'mistari')}` : `${copy('Qty', 'Idadi')}: ${order.quantity || 1}`}</span>
                    </div>
                </div>

                {/* ── Price & Action ── */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 sm:gap-2 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l sm:pl-6 border-dashed">
                    <div className="text-left sm:text-right">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">{copy('Total paid', 'Jumla iliyolipwa')}</p>
                        <p className="text-xl font-black text-brand-600">{formatMoney(displayTotal, order.merchant_currency_code || 'TZS')}</p>
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
