import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    ArrowLeft,
    BookOpenText,
    Boxes,
    CalendarClock,
    Camera,
    CircleAlert,
    Download,
    Loader2,
    MapPin,
    MessageSquare,
    Image as ImageIcon,
    Play,
    ReceiptText,
    Save,
    ShieldCheck,
    ShoppingBag,
    Star,
    Store,
    Truck,
    UserRound,
    Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { toast } from 'sonner';

function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 6) return `${digits.slice(0, 2)}...${digits.slice(-2)}`;
    return `${digits.slice(0, 3)}...${digits.slice(-3)}`;
}

function typeMeta(kind) {
    const map = {
        physical_product: { label: 'Physical Product', icon: ShoppingBag, cls: 'bg-amber-100 text-amber-700' },
        physical_bundle: { label: 'Physical Bundle', icon: Boxes, cls: 'bg-amber-100 text-amber-700' },
        bundle: { label: 'Bundle', icon: Boxes, cls: 'bg-sky-100 text-sky-700' },
        course_bundle: { label: 'Course Bundle', icon: BookOpenText, cls: 'bg-indigo-100 text-indigo-700' },
        post_content: { label: 'Post Content', icon: BookOpenText, cls: 'bg-sky-100 text-sky-700' },
        digital_file: { label: 'Digital File', icon: Download, cls: 'bg-indigo-100 text-indigo-700' },
        service_booking: { label: 'Service/Booking', icon: CalendarClock, cls: 'bg-emerald-100 text-emerald-700' },
    };

    return map[kind] || map.post_content;
}

function statusMeta(status, isEscrowOrder) {
    const map = {
        awaiting_merchant_confirmation: {
            label: isEscrowOrder ? 'Mpya - Thibitisha' : 'Imelipwa',
            cls: isEscrowOrder ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
        },
        escrow_locked: {
            label: isEscrowOrder ? 'Pesa Ipo Escrow' : 'Imelipwa',
            cls: isEscrowOrder ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700',
        },
        shipped: { label: 'Imesafirishwa', cls: 'bg-indigo-100 text-indigo-700' },
        resolved_merchant_paid: { label: 'Imekamilika', cls: 'bg-emerald-100 text-emerald-700' },
        disputed: { label: 'Mgogoro', cls: 'bg-red-100 text-red-700' },
        resolved_buyer_refunded: { label: 'Mteja Amerudishiwa', cls: 'bg-slate-100 text-slate-700' },
    };

    return map[status] || { label: status || 'Unknown', cls: 'bg-muted text-muted-foreground' };
}

export default function MerchantOrderDetails({ merchantUsername, merchantName, orderId }) {
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [dispatchMode, setDispatchMode] = useState('intercity');
    const [dispatchVideo, setDispatchVideo] = useState(null);
    const [transportReceipt, setTransportReceipt] = useState(null);
    const [busCompany, setBusCompany] = useState('');
    const [waybillTrackingNumber, setWaybillTrackingNumber] = useState('');
    const [bodaPhone, setBodaPhone] = useState(''); // Keep variable name but update label below
    const [localDeliveryPhone, setLocalDeliveryPhone] = useState('');
    const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
    
    // PIN Verification State
    const [pickupPinInput, setPickupPinInput] = useState('');
    const [releasePinInput, setReleasePinInput] = useState('');
    const [pinVerifying, setPinVerifying] = useState(false);

    // Inquiry Quote State
    const [shippingFeeInput, setShippingFeeInput] = useState('');
    const [quoteSubmitting, setQuoteSubmitting] = useState(false);

    useEffect(() => {
        loadOrder();
    }, [merchantUsername, orderId]);

    async function loadOrder() {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/orders/${orderId}/api`);
            setOrder(res.data);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kupakia order details.');
        } finally {
            setLoading(false);
        }
    }

    const kind = typeMeta(order?.display_kind);
    const status = statusMeta(order?.payment_status, !!order?.is_escrow_order);
    const KindIcon = kind.icon;

    const flowCopy = useMemo(() => {
        if (!order) return '';
        if (order.order_flow === 'escrow') {
            if (['awaiting_merchant_confirmation', 'escrow_locked', 'disputed'].includes(order.payment_status)) {
                return 'Hii ni order ya escrow: pesa hushikiliwa hadi hatua za utimilifu zikamilike.';
            }
            return 'Escrow imekamilika kwa order hii.';
        }
        return 'Hii ni order ya instant flow: malipo huwekwa settled mara moja.';
    }, [order]);

    const canDispatchNow = !!order
        && order.is_escrow_order
        && ['awaiting_merchant_confirmation', 'escrow_locked'].includes(order.payment_status);

    async function submitDispatch(e) {
        e.preventDefault();
        if (!canDispatchNow || dispatchSubmitting) return;

        if (!dispatchVideo) {
            toast.error('Tafadhali chagua video ya packing kwanza.');
            return;
        }
        if (dispatchMode === 'intercity' && !transportReceipt) {
            toast.error('Tafadhali pakia risiti/waybill ya usafirishaji.');
            return;
        }

        const formData = new FormData();
        formData.append('dispatch_video', dispatchVideo);
        if (dispatchMode === 'intercity') {
            formData.append('transport_receipt', transportReceipt);
            if (busCompany.trim()) formData.append('bus_company', busCompany.trim());
            if (waybillTrackingNumber.trim()) formData.append('waybill_tracking_number', waybillTrackingNumber.trim());
        } else if (bodaPhone.trim()) {
            formData.append('boda_phone', bodaPhone.trim());
        }

        setDispatchSubmitting(true);
        try {
            const endpoint = `/merchant/${merchantUsername}/dispatch/${orderId}/${dispatchMode}`;
            await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Dispatch evidence imehifadhiwa.');
            setDispatchVideo(null);
            setTransportReceipt(null);
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuhifadhi dispatch evidence.');
        } finally {
            setDispatchSubmitting(false);
        }
    }

    // Auto-select dispatch mode based on delivery type
    useEffect(() => {
        if (order?.delivery?.delivery_type) {
            if (order.delivery.delivery_type === 'local_boda') {
                setDispatchMode('local');
            } else if (order.delivery.delivery_type === 'intercity_bus') {
                setDispatchMode('intercity');
            }
        }
    }, [order?.delivery?.delivery_type]);

    async function submitQuote(e) {
        e.preventDefault();
        if (quoteSubmitting || !shippingFeeInput) return;

        setQuoteSubmitting(true);
        try {
            await axios.post(`/api/merchant/orders/${orderId}/quote`, {
                shipping_fee: shippingFeeInput,
            });
            toast.success('Gharama ya usafiri imetumwa kwa mteja.');
            setShippingFeeInput('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kutuma gharama.');
        } finally {
            setQuoteSubmitting(false);
        }
    }

    async function verifyPickupPin(e) {
        e.preventDefault();
        if (!pickupPinInput || pinVerifying) return;
        setPinVerifying(true);
        try {
            await axios.post(`/api/merchant/${merchantUsername}/orders/${orderId}/verify-pickup`, {
                pickup_pin: pickupPinInput
            });
            toast.success('Pickup imethibitishwa! Malipo yameidhinishwa.');
            setPickupPinInput('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'PIN si sahihi.');
        } finally {
            setPinVerifying(false);
        }
    }

    async function verifyDeliveryPin(e) {
        e.preventDefault();
        if (!releasePinInput || pinVerifying) return;
        setPinVerifying(true);
        try {
            await axios.post(`/api/merchant/${merchantUsername}/orders/${orderId}/verify-delivery`, {
                buyer_release_pin: releasePinInput
            });
            toast.success('Delivery imethibitishwa! Malipo yameidhinishwa.');
            setReleasePinInput('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'PIN si sahihi.');
        } finally {
            setPinVerifying(false);
        }
    }

    const isPos = order?.source === 'pos';
    const displayId = isPos ? `#POS-${order.public_id}` : `#${order?.transaction_ref || orderId}`;

    return (
        <AppLayout>
            <Head title={`Order ${displayId} | ${merchantName || 'Biashara'} | Takeer`} />

            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5 pb-24">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 bg-accent hover:bg-accent/80"
                            onClick={() => router.visit(`/merchant/${merchantUsername}/orders`)}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Order Details</h1>
                            <p className="text-sm text-muted-foreground">{displayId} • {merchantName || 'Biashara'}</p>
                        </div>
                    </div>
                    <Button
                        className="rounded-xl font-bold"
                        onClick={() => router.visit(`/chat/${order?.public_id}?acting_as=merchant`)}
                        disabled={loading || !order?.public_id}
                    >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Open Chat
                    </Button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                    </div>
                ) : !order ? (
                    <Card className="rounded-2xl border-dashed">
                        <CardContent className="p-8 text-center text-muted-foreground font-medium">
                            Order details hazijapatikana.
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card className="rounded-2xl overflow-hidden">
                            <CardContent className="p-5 md:p-6 flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${status.cls}`}>
                                            {status.label}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${kind.cls}`}>
                                            <KindIcon className="h-3.5 w-3.5" />
                                            {kind.label}
                                        </span>
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-black mt-3 break-words">{order.display_title || 'Order item'}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                                    </p>
                                </div>
                                <p className="text-3xl md:text-4xl font-black text-brand-600 shrink-0">
                                    TZS {Number(order.total_paid || 0).toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <UserRound className="h-4 w-4 text-brand-600" />
                                        Customer Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {isPos ? (
                                        <>
                                            <p><span className="text-muted-foreground">Jina (POS):</span> <span className="font-semibold">{order.customer_name || 'Anonymous'}</span></p>
                                            <p><span className="text-muted-foreground">Namba:</span> <span className="font-semibold">{order.customer_phone || 'N/A'}</span></p>
                                        </>
                                    ) : (
                                        <>
                                            <p><span className="text-muted-foreground">Jina:</span> <span className="font-semibold">{order.buyer?.name || 'N/A'}</span></p>
                                            <p><span className="text-muted-foreground">Namba:</span> <span className="font-semibold">{order.buyer?.phone_number || 'N/A'}</span></p>
                                            <p><span className="text-muted-foreground">Masked:</span> <span className="font-semibold">{maskPhone(order.buyer?.phone_number || '') || 'N/A'}</span></p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ReceiptText className="h-4 w-4 text-brand-600" />
                                        Payment Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <p><span className="text-muted-foreground">Order Ref:</span> <span className="font-semibold">{isPos ? `#POS-${order.public_id}` : (order.transaction_ref || `#${order.id}`)}</span></p>
                                    <p><span className="text-muted-foreground">Kiasi:</span> <span className="font-semibold">{order.quantity || 1}</span></p>
                                    <p><span className="text-muted-foreground">Bei moja:</span> <span className="font-semibold">TZS {Number(order.unit_price || 0).toLocaleString()}</span></p>
                                    <p><span className="text-muted-foreground">Jumla:</span> <span className="font-semibold">TZS {Number(order.total_paid || 0).toLocaleString()}</span></p>
                                    <p><span className="text-muted-foreground">Payment phone:</span> <span className="font-semibold">{order.payment_phone || 'N/A'}</span></p>
                                    <p><span className="text-muted-foreground">Account phone:</span> <span className="font-semibold">{order.account_phone || 'N/A'}</span></p>
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl md:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-brand-600" />
                                        Fulfilment Workflow
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <p className="font-medium text-foreground">{flowCopy}</p>
                                    {order.delivery && (
                                        <>
                                            <p><span className="text-muted-foreground">Delivery Method:</span> <span className="font-semibold uppercase text-brand-700">{order.delivery.delivery_type === 'local_boda' ? 'LOCAL' : (order.delivery.delivery_type?.replace('_', ' ') || 'Standard')}</span></p>
                                            <p><span className="text-muted-foreground">Delivery status:</span> <span className="font-semibold">{order.delivery.delivery_status || 'N/A'}</span></p>
                                            {order.delivery.physical_address && (
                                                <p><span className="text-muted-foreground">Anwani ya Mteja:</span> <span className="font-semibold">{order.delivery.physical_address}</span></p>
                                            )}
                                            {order.delivery.bus_company && <p><span className="text-muted-foreground">Bus company:</span> <span className="font-semibold">{order.delivery.bus_company}</span></p>}
                                            {order.delivery.waybill_tracking_number && <p><span className="text-muted-foreground">Waybill tracking:</span> <span className="font-semibold">{order.delivery.waybill_tracking_number}</span></p>}
                                            {order.delivery.boda_phone && <p><span className="text-muted-foreground">Delivery phone:</span> <span className="font-semibold">{order.delivery.boda_phone}</span></p>}
                                            {order.delivery.delivery_type !== 'self_pickup' && order.delivery.buyer_release_pin && (
                                                <p><span className="text-muted-foreground">Expected PIN from Buyer:</span> <span className="font-mono font-bold text-brand-600 ml-1">Needed for payout</span></p>
                                            )}
                                        </>
                                    )}
                                    {!order.delivery && (
                                        <p className="text-muted-foreground">Hakuna taarifa za delivery kwa order hii.</p>
                                    )}
                                </CardContent>
                            </Card>

                            {order.is_inquiry && (
                                <Card className="rounded-2xl md:col-span-2 border-brand-200 bg-brand-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-brand-600" />
                                            Shipping Quote Inquiry
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="bg-white/60 p-4 rounded-xl border border-brand-100/50">
                                            <p className="text-xs font-black uppercase tracking-widest text-brand-700/80 mb-2">Customer Address:</p>
                                            <p className="font-bold text-brand-900 mb-2">{order.delivery?.physical_address || 'Anwani haikuwekwa'}</p>
                                            {order.delivery?.latitude && (
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${order.delivery.latitude},${order.delivery.longitude}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100 hover:bg-brand-100 transition-colors"
                                                >
                                                    <MapPin className="h-3 w-3" /> FUNGUA KWENY RAMANI
                                                </a>
                                            )}
                                        </div>

                                        {order.inquiry_status === 'pending' ? (
                                            <form onSubmit={submitQuote} className="flex flex-col sm:flex-row gap-3">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block ml-1">Enter Shipping Fee (TZS)</label>
                                                    <Input 
                                                        type="number"
                                                        placeholder="Mf. 5000" 
                                                        value={shippingFeeInput}
                                                        onChange={e => setShippingFeeInput(e.target.value)}
                                                        className="font-bold rounded-xl h-11"
                                                        required
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <Button 
                                                        type="submit" 
                                                        className="h-11 rounded-xl px-8 bg-brand-600 hover:bg-brand-700 font-bold"
                                                        disabled={quoteSubmitting || !shippingFeeInput}
                                                    >
                                                        {quoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                        TUMA GHARAMA
                                                    </Button>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-green-700 mb-1">Gharama uliyoweka:</p>
                                                    <p className="text-lg font-black text-green-600">TZS {Number(order.shipping_fee || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-green-700 mb-1">Hali ya Inquiry:</p>
                                                    <span className="text-xs font-bold bg-green-200/50 text-green-800 px-3 py-1 rounded-full uppercase tracking-widest">Quoted</span>
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-[11px] text-muted-foreground italic font-medium">Ukishatuma gharama, mteja ataiona na atakuwa na chaguo la kulipia ili kukamilisha order.</p>
                                    </CardContent>
                                </Card>
                            )}

                            {order.is_escrow_order && order.delivery?.delivery_type === 'self_pickup' && order.payment_status === 'awaiting_merchant_confirmation' && (
                                <Card className="rounded-2xl md:col-span-2 border-brand-200 bg-brand-50/30">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-brand-600" />
                                            Verification: Customer Pickup (Self Delivery)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5">
                                        <div className="flex flex-col gap-4">
                                            <p className="text-sm font-medium">Mteja umechagua kutuma dereva wake kuchukua mzigo. Unapomkabidhi mzigo huyo dereva, omba aakupe <strong>Pickup PIN</strong> aliyopewa na Mteja.</p>
                                            <form onSubmit={verifyPickupPin} className="flex gap-2 max-w-sm">
                                                <Input 
                                                    placeholder="Weka 4-Digit PIN..." 
                                                    value={pickupPinInput}
                                                    onChange={e => setPickupPinInput(e.target.value)}
                                                    maxLength={4}
                                                    className="font-bold text-center tracking-[0.5em] text-lg"
                                                />
                                                <Button type="submit" disabled={pinVerifying || pickupPinInput.length !== 4}>
                                                    {pinVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'KABIDHI MZIGO'}
                                                </Button>
                                            </form>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {order.is_escrow_order && order.delivery?.delivery_type !== 'self_pickup' && (
                                <Card className="rounded-2xl md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-brand-600" />
                                            {order.payment_status === 'escrow_locked' ? 'Verification & Delivery Info' : 'Dispatch Evidence (Physical Only)'}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {order.payment_status === 'awaiting_merchant_confirmation' && (
                                            <>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDispatchMode('intercity')}
                                                        className={`h-11 rounded-xl border text-sm font-bold ${dispatchMode === 'intercity' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-input bg-background text-muted-foreground'}`}
                                                    >
                                                        Intercity Bus
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDispatchMode('local')}
                                                        className={`h-11 rounded-xl border text-sm font-bold ${dispatchMode === 'local' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-input bg-background text-muted-foreground'}`}
                                                    >
                                                        Local
                                                    </button>
                                                </div>

                                                <form onSubmit={submitDispatch} className="grid gap-3 md:grid-cols-2 mt-4">
                                                    <label className="rounded-xl border border-input bg-background p-3 text-sm">
                                                        <span className="mb-2 inline-flex items-center gap-2 font-semibold">
                                                            <Camera className="h-4 w-4 text-brand-600" />
                                                            Packing Video
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="video/*"
                                                            onChange={(e) => setDispatchVideo(e.target.files?.[0] || null)}
                                                            className="mt-2 block w-full text-xs"
                                                            required
                                                        />
                                                    </label>

                                                    {dispatchMode === 'intercity' ? (
                                                        <label className="rounded-xl border border-input bg-background p-3 text-sm">
                                                            <span className="mb-2 inline-flex items-center gap-2 font-semibold">
                                                                <ImageIcon className="h-4 w-4 text-brand-600" />
                                                                Transport Receipt / Waybill
                                                            </span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => setTransportReceipt(e.target.files?.[0] || null)}
                                                                className="mt-2 block w-full text-xs"
                                                                required
                                                            />
                                                        </label>
                                                    ) : (
                                                        <label className="rounded-xl border border-input bg-background p-3 text-sm">
                                                            <span className="mb-2 inline-flex items-center gap-2 font-semibold">Delivery Phone (optional)</span>
                                                            <input
                                                                value={bodaPhone}
                                                                onChange={(e) => setBodaPhone(e.target.value)}
                                                                placeholder="+2557..."
                                                                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                                            />
                                                        </label>
                                                    )}

                                                    {dispatchMode === 'intercity' && (
                                                        <>
                                                            <label className="rounded-xl border border-input bg-background p-3 text-sm">
                                                                <span className="mb-2 inline-flex items-center gap-2 font-semibold">Bus Company (optional)</span>
                                                                <input
                                                                    value={busCompany}
                                                                    onChange={(e) => setBusCompany(e.target.value)}
                                                                    placeholder="Mf. Tashriff"
                                                                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                                                />
                                                            </label>
                                                            <label className="rounded-xl border border-input bg-background p-3 text-sm">
                                                                <span className="mb-2 inline-flex items-center gap-2 font-semibold">Waybill Tracking # (optional)</span>
                                                                <input
                                                                    value={waybillTrackingNumber}
                                                                    onChange={(e) => setWaybillTrackingNumber(e.target.value)}
                                                                    placeholder="BUS-12345"
                                                                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                                                />
                                                            </label>
                                                        </>
                                                    )}

                                                    <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
                                                        <p className="text-xs text-muted-foreground">
                                                            {canDispatchNow ? 'Weka ushahidi wa dispatch ili escrow iendelee salama.' : 'Dispatch imefungwa kwa status ya sasa ya order.'}
                                                        </p>
                                                        <Button type="submit" className="rounded-xl font-bold" disabled={!canDispatchNow || dispatchSubmitting}>
                                                            {dispatchSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                                            THIBITISHA DISPATCH
                                                        </Button>
                                                    </div>
                                                </form>
                                            </>
                                        )}

                                        {order.payment_status === 'escrow_locked' && order.delivery?.delivery_type === 'local_boda' && (
                                            <div className="bg-brand-50/50 p-4 rounded-xl border border-brand-100 flex flex-col gap-3">
                                                <p className="text-sm font-semibold text-brand-900">Delivery verification needed:</p>
                                                <p className="text-sm">Dereva wako akishamkabidhi mteja mzigo, mteja atampa huyo dereva <strong>Release PIN</strong>. Ingiza hapa chini ili kupata pesa zako:</p>
                                                <form onSubmit={verifyDeliveryPin} className="flex gap-2 max-w-sm">
                                                    <Input 
                                                        placeholder="Enter 4-Digit Release PIN..." 
                                                        value={releasePinInput}
                                                        onChange={e => setReleasePinInput(e.target.value)}
                                                        maxLength={4}
                                                        className="font-bold text-center tracking-[0.5em]"
                                                    />
                                                    <Button type="submit" disabled={pinVerifying || releasePinInput.length !== 4}>
                                                        {pinVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ITHIBITISHE'}
                                                    </Button>
                                                </form>
                                            </div>
                                        )}

                                        {order.payment_status === 'escrow_locked' && order.delivery?.delivery_type === 'intercity_bus' && (
                                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                                <p className="text-sm font-bold text-indigo-900">In Transit (Mkoani)</p>
                                                <p className="text-sm mt-1">Mteja akichukua mzigo station na akiona kila kitu kiko sawa, atathibitisha kwenye App yake na hela zingeingia kwako moja kwa moja. Endapo kuna tatizo, mteja ataanzisha claim.</p>
                                            </div>
                                        )}

                                        {(order.merchant_dispatch_video_url || order.delivery?.waybill_photo_url) && (
                                            <div className="grid gap-2 text-sm md:grid-cols-2 pt-2 border-t mt-2">
                                                <p className="truncate">
                                                    <span className="text-muted-foreground text-xs uppercase font-black">Packing video:</span>{' '}
                                                    {order.merchant_dispatch_video_url ? <a className="font-semibold text-brand-600 underline" href={order.merchant_dispatch_video_url} target="_blank" rel="noreferrer">View</a> : 'N/A'}
                                                </p>
                                                <p className="truncate">
                                                    <span className="text-muted-foreground text-xs uppercase font-black">Waybill/receipt:</span>{' '}
                                                    {order.delivery?.waybill_photo_url ? <a className="font-semibold text-brand-600 underline" href={order.delivery.waybill_photo_url} target="_blank" rel="noreferrer">View</a> : 'N/A'}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {order.review && (
                                <Card className="rounded-2xl md:col-span-2 border-amber-200 bg-amber-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Star className="h-4 w-4 text-amber-600 fill-amber-600" />
                                            Customer Review
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        <div className="flex gap-1 mb-2">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star key={s} className={cn("h-4 w-4", s <= order.review.rating ? "text-amber-500 fill-amber-500" : "text-amber-200")} />
                                            ))}
                                        </div>
                                        <p className="text-sm font-medium text-amber-900 italic">"{order.review.comment}"</p>
                                        <p className="text-[10px] text-amber-700/60 font-bold uppercase tracking-widest">
                                            {order.review.created_at ? new Date(order.review.created_at).toLocaleString() : ''}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {order.delivery?.buyer_unboxing_video_url && (
                                <Card className="rounded-2xl md:col-span-2 border-indigo-200 bg-indigo-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Video className="h-4 w-4 text-indigo-600" />
                                            Unboxing Video (Customer)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between bg-white/60 p-4 rounded-xl border border-indigo-100">
                                            <p className="text-sm font-bold text-indigo-900">Ushahidi wa Kupokea</p>
                                            <a
                                                href={order.delivery.buyer_unboxing_video_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 hover:underline bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                                            >
                                                <Play className="h-3 w-3" /> TAZAMA VIDEO
                                            </a>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {order.dispute && (
                                <Card className="rounded-2xl md:col-span-2 border-red-200 bg-red-50/70">
                                    <CardContent className="p-4 text-sm">
                                        <p className="font-black text-red-700 flex items-center gap-2">
                                            <CircleAlert className="h-4 w-4" />
                                            Order ina mgogoro
                                        </p>
                                        <p className="mt-1 text-red-700/90"><span className="font-semibold">Status:</span> {order.dispute.status || 'open'}</p>
                                        <p className="mt-1 text-red-700/90"><span className="font-semibold">Reason:</span> {order.dispute.reason || 'N/A'}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-xl" onClick={() => router.visit(`/merchant/${merchantUsername}/orders`)}>
                                <Store className="h-4 w-4 mr-2" />
                                Back to Orders
                            </Button>
                            <Button 
                                className="rounded-xl" 
                                onClick={() => router.visit(`/chat/${order?.public_id}?acting_as=merchant`)}
                                disabled={loading || !order?.public_id}
                            >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Continue in Safe Chat
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
