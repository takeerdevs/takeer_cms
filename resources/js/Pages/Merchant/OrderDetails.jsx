import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { QRCodeCanvas } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import {
    ArrowLeft,
    BookOpenText,
    Boxes,
    CalendarClock,
    Camera,
    CheckCircle2,
    CircleAlert,
    Copy,
    Download,
    FileUp,
    Loader2,
    MapPin,
    MessageSquare,
    Image as ImageIcon,
    Layers,
    Play,
    ReceiptText,
    Save,
    Share2,
    ShieldCheck,
    ShoppingBag,
    Star,
    Store,
    Truck,
    UserRound,
    Video,
    Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeliveryFlowTimeline, DeliveryDirectionsButton } from '@/Components/DeliveryFlowTimeline';
import { orderQuantityLabel, orderUnitPriceLabel } from '@/lib/productUnits';
import { useMerchantPermissions } from '@/lib/merchantPermissions';
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
        offering_group: { label: 'Offering Group', icon: Layers, cls: 'bg-teal-100 text-teal-700' },
        course_bundle: { label: 'Course Bundle', icon: BookOpenText, cls: 'bg-indigo-100 text-indigo-700' },
        post_content: { label: 'Post Content', icon: BookOpenText, cls: 'bg-sky-100 text-sky-700' },
        subscription_plan: { label: 'Membership', icon: Crown, cls: 'bg-violet-100 text-violet-700' },
        digital_file: { label: 'Digital File', icon: Download, cls: 'bg-indigo-100 text-indigo-700' },
        custom_work: { label: 'Custom Work', icon: FileUp, cls: 'bg-indigo-100 text-indigo-700' },
        service_booking: { label: 'Service/Booking', icon: CalendarClock, cls: 'bg-emerald-100 text-emerald-700' },
    };

    return map[kind] || map.post_content;
}

function OfferingGroupLines({ lines = [] }) {
    if (!Array.isArray(lines) || lines.length === 0) return null;

    return (
        <div className="space-y-2">
            {lines.map((line, index) => {
                const addOns = Array.isArray(line.selected_add_ons) ? line.selected_add_ons : [];
                const addOnsTotal = Number(line.add_ons_unit_total || 0) * Number(line.quantity || 1);

                return (
                    <div key={`${line.group_item_id || line.item_id}-${index}`} className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 text-slate-300">
                                    {line.image_url ? (
                                        <img src={line.image_url} alt={line.title || 'Offering item'} className="h-full w-full object-cover" />
                                    ) : (
                                        <ImageIcon className="h-5 w-5" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="break-words font-black text-slate-950">{line.title || 'Offering item'}</p>
                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                        {line.section || 'Main'} · {String(line.role || 'optional').replace(/_/g, ' ')}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-sm font-black text-brand-700">TZS {Number(line.line_total || 0).toLocaleString()}</p>
                                <p className="text-[11px] font-bold text-muted-foreground">Qty {Number(line.quantity || 1).toLocaleString()}</p>
                            </div>
                        </div>

                        {addOns.length > 0 && (
                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Add-ons</p>
                                        <p className="mt-1 text-xs font-bold text-emerald-900">
                                            {addOns.map((addOn) => addOn.name).join(', ')}
                                        </p>
                                    </div>
                                    {addOnsTotal > 0 && (
                                        <p className="shrink-0 text-xs font-black text-emerald-700">
                                            + TZS {addOnsTotal.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {Array.isArray(line.child_lines) && line.child_lines.length > 0 && (
                            <div className="mt-3 border-l-2 border-slate-100 pl-3">
                                <OfferingGroupLines lines={line.child_lines} />
                            </div>
                        )}
                    </div>
                );
            })}
                        </div>
    );
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

function deliveryMethodLabel(delivery) {
    const type = delivery?.delivery_type || delivery?.type || '';
    if (type === 'self_pickup') return 'SELF PICKUP';
    if (type === 'local_boda') return 'LOCAL DELIVERY';
    if (type === 'intercity_bus') return 'INTERCITY BUS';
    return type ? type.replaceAll('_', ' ').toUpperCase() : 'STANDARD';
}

function deliveryStatusLabel(delivery) {
    const type = delivery?.delivery_type || delivery?.type || '';
    const status = delivery?.delivery_status || delivery?.status || '';
    if (type === 'self_pickup' && ['awaiting_boda', 'inquiry', 'awaiting_pickup'].includes(status)) {
        return deliveryStatusText('awaiting_pickup');
    }
    return deliveryStatusText(status);
}

function deliveryStatusText(status) {
    const map = {
        inquiry: 'Inquiry',
        packing: 'Packing order',
        ready_for_pickup: 'Ready for pickup',
        awaiting_boda: 'Awaiting delivery',
        awaiting_pickup: 'Awaiting pickup',
        dispatched: 'Dispatched',
        with_boda: 'With delivery rider',
        in_transit: 'In transit',
        arrived: 'Arrived at customer area',
        ready_at_terminal: 'Ready at terminal',
        delivered: 'Delivered',
        issue_reported: 'Issue reported',
        disputed: 'Disputed',
        customer_confirmed: 'Customer confirmed',
    };

    return map[status] || (status ? status.replaceAll('_', ' ') : 'N/A');
}

function deliveryStatusOptions(delivery) {
    const type = delivery?.delivery_type || delivery?.type || '';
    if (type === 'self_pickup') {
        return [
            { value: 'ready_for_pickup', label: 'Ready for pickup' },
            { value: 'issue_reported', label: 'Issue reported' },
        ];
    }
    if (type === 'intercity_bus') {
        return [
            { value: 'packing', label: 'Packing order' },
            { value: 'dispatched', label: 'Dispatched to bus' },
            { value: 'in_transit', label: 'In transit' },
            { value: 'ready_at_terminal', label: 'Ready at terminal (Bus Terminal)' },
            { value: 'issue_reported', label: 'Issue reported' },
        ];
    }
    return [
        { value: 'packing', label: 'Packing order' },
        { value: 'ready_for_pickup', label: 'Ready for rider' },
        { value: 'with_boda', label: 'With delivery rider' },
        { value: 'arrived', label: 'Arrived at customer area' },
        { value: 'issue_reported', label: 'Issue reported' },
    ];
}

function distanceKm(aLat, aLng, bLat, bLng) {
    const toRad = (value) => (Number(value) * Math.PI) / 180;
    const radius = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function googleRouteUrl(origin, destination) {
    if (origin?.latitude && origin?.longitude && destination?.latitude && destination?.longitude) {
        return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    }

    if (destination?.latitude && destination?.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${destination.latitude},${destination.longitude}`;
    }

    return null;
}

function paymentOverview(order) {
    const total = Number(order?.total_paid || 0);
    const explicitPaid = order?.amount_paid ?? order?.paid_amount ?? null;
    const paidStatuses = ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped', 'disputed', 'resolved_merchant_paid'];
    const paid = explicitPaid !== null
        ? Number(explicitPaid || 0)
        : (paidStatuses.includes(order?.payment_status) ? total : 0);
    const left = Math.max(0, total - paid);
    const isComplete = paid >= total && total > 0;
    const isPartial = paid > 0 && paid < total;

    if (isComplete) {
        return {
            label: order?.payment_status === 'resolved_merchant_paid' ? 'Completed' : 'Paid',
            body: order?.payment_status === 'resolved_merchant_paid'
                ? 'Payment has been released to the merchant.'
                : 'Payment is received and protected until fulfilment is completed.',
            tone: 'border-emerald-100 bg-emerald-50 text-emerald-800',
            paid,
            left,
            total,
        };
    }

    if (isPartial) {
        return {
            label: 'Partially paid',
            body: 'Customer has paid part of the order. Do not release until the remaining amount is cleared.',
            tone: 'border-amber-100 bg-amber-50 text-amber-800',
            paid,
            left,
            total,
        };
    }

    return {
        label: 'Not paid',
        body: 'Payment has not been completed yet. Wait for payment before releasing goods or services.',
        tone: 'border-red-100 bg-red-50 text-red-800',
        paid,
        left,
        total,
    };
}

export default function MerchantOrderDetails({ merchantUsername, merchantName, orderId }) {
    const { can } = useMerchantPermissions(merchantUsername);
    const canDispatch = can('orders.dispatch');
    const canUpdateOrder = can('orders.update');
    const canVerifyPickup = can('orders.verify_pickup');
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
    const [showRouteShare, setShowRouteShare] = useState(false);
    const [customDeliveryFile, setCustomDeliveryFile] = useState(null);
    const [customDeliveryMessage, setCustomDeliveryMessage] = useState('');
    const [customDeliverySubmitting, setCustomDeliverySubmitting] = useState(false);
    const [deliveryStatusInput, setDeliveryStatusInput] = useState('packing');
    const [deliveryStatusNote, setDeliveryStatusNote] = useState('');
    const [deliveryStatusProof, setDeliveryStatusProof] = useState(null);
    const [deliveryStatusSubmitting, setDeliveryStatusSubmitting] = useState(false);
    const [riderLink, setRiderLink] = useState('');
    const [riderLinkExpiresAt, setRiderLinkExpiresAt] = useState(null);
    const [riderLinkGenerating, setRiderLinkGenerating] = useState(false);

    useEffect(() => {
        loadOrder();
    }, [merchantUsername, orderId]);

    useEffect(() => {
        if (order?.shipping_fee !== null && order?.shipping_fee !== undefined) {
            setShippingFeeInput(String(order.shipping_fee));
        }
    }, [order?.shipping_fee]);

    useEffect(() => {
        const options = deliveryStatusOptions(order?.delivery);
        if (!options.some((option) => option.value === deliveryStatusInput)) {
            setDeliveryStatusInput(options[0]?.value || 'packing');
        }
    }, [order?.delivery?.delivery_type]);

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
    const paymentState = paymentOverview(order);
    const KindIcon = kind.icon;

    const flowCopy = useMemo(() => {
        if (!order) return '';
        if (order.order_flow === 'escrow') {
            if (['awaiting_merchant_confirmation', 'escrow_locked', 'disputed'].includes(order.payment_status)) {
                return 'Hii ni order ya escrow: pesa hushikiliwa hadi hatua za utimilifu zikamilike.';
            }
            if (order.payment_status === 'resolved_merchant_paid') {
                return 'Escrow imekamilika: mteja amelipa, order imekabidhiwa, na fedha zimetumwa kwa muuzaji.';
            }
            return 'Escrow bado haijakamilika kwa order hii.';
        }
        return 'Hii ni order ya instant flow: malipo huwekwa settled mara moja.';
    }, [order]);

    const canDispatchNow = !!order
        && order.is_escrow_order
        && ['awaiting_merchant_confirmation', 'escrow_locked'].includes(order.payment_status);
    const merchantConfirmed = Boolean(order?.is_merchant_confirmed || order?.merchant_confirmed_at);
    const customerLocation = order?.delivery?.latitude && order?.delivery?.longitude
        ? {
            latitude: Number(order.delivery.latitude),
            longitude: Number(order.delivery.longitude),
            address: order.delivery.physical_address,
        }
        : null;
    const closestLocation = useMemo(() => {
        const locations = order?.merchant?.locations || [];
        if (!customerLocation || !locations.length) return null;

        return locations
            .filter((location) => location.latitude && location.longitude)
            .map((location) => ({
                ...location,
                distance: distanceKm(
                    Number(location.latitude),
                    Number(location.longitude),
                    customerLocation.latitude,
                    customerLocation.longitude
                ),
            }))
            .sort((a, b) => a.distance - b.distance)[0] || null;
    }, [order?.merchant?.locations, customerLocation?.latitude, customerLocation?.longitude]);
    const routeUrl = googleRouteUrl(closestLocation, customerLocation);
    const routeShareText = routeUrl
        ? `Delivery route: ${closestLocation?.name ? `${closestLocation.name} to ` : ''}${order?.delivery?.physical_address || 'customer location'} ${routeUrl}`
        : '';
    const canEditShipping = canUpdateOrder
        && order?.is_inquiry
        && order?.payment_status === 'pending'
        && order?.delivery?.delivery_type !== 'self_pickup';
    const statusOptions = deliveryStatusOptions(order?.delivery);
    const deliveryEvents = Array.isArray(order?.delivery?.events) ? order.delivery.events : [];
    const canUpdateDeliveryStatus = !!order
        && order.is_escrow_order
        && (canDispatch || canUpdateOrder)
        && ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped', 'disputed'].includes(order.payment_status);
    const isSubscriptionOrder = order?.purchasable_type === 'subscription_plan';
    const isCustomDigitalDelivery = order?.product?.type === 'digital'
        && order?.product?.digital_delivery_type === 'custom_delivery';

    async function submitDispatch(e) {
        e.preventDefault();
        if (!canDispatch) return;
        if (!canDispatchNow || dispatchSubmitting) return;

        if (!dispatchVideo) {
            toast.error('Tafadhali chagua picha au video ya packing kwanza.');
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

    async function submitDeliveryStatus(e) {
        e.preventDefault();
        if (!canUpdateDeliveryStatus || deliveryStatusSubmitting) return;

        const formData = new FormData();
        formData.append('status', deliveryStatusInput);
        if (deliveryStatusNote.trim()) {
            formData.append('note', deliveryStatusNote.trim());
        }
        if (deliveryStatusProof) {
            formData.append('proof', deliveryStatusProof);
        }
        if ((order?.delivery?.delivery_type === 'local_boda' || deliveryStatusInput === 'with_boda') && bodaPhone.trim()) {
            formData.append('boda_phone', bodaPhone.trim());
        }

        setDeliveryStatusSubmitting(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/orders/${orderId}/delivery-status`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Delivery status imehifadhiwa.');
            setDeliveryStatusNote('');
            setDeliveryStatusProof(null);
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuhifadhi delivery status.');
        } finally {
            setDeliveryStatusSubmitting(false);
        }
    }

    async function generateRiderLink() {
        if (!canUpdateDeliveryStatus || riderLinkGenerating) return;

        setRiderLinkGenerating(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/orders/${orderId}/rider-access`, {
                expires_in_hours: 24,
            });
            setRiderLink(res.data.url || '');
            setRiderLinkExpiresAt(res.data.expires_at || null);
            if (res.data.url) {
                await navigator.clipboard?.writeText(res.data.url);
                toast.success('Rider link imetengenezwa na kunakiliwa.');
            } else {
                toast.success('Rider link imetengenezwa.');
            }
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kutengeneza rider link.');
        } finally {
            setRiderLinkGenerating(false);
        }
    }

    async function copyRiderLink() {
        if (!riderLink) return;
        try {
            await navigator.clipboard.writeText(riderLink);
            toast.success('Rider link imenakiliwa.');
        } catch (error) {
            toast.error('Imeshindwa kunakili rider link.');
        }
    }

    async function submitCustomDelivery(e) {
        e.preventDefault();
        if (!canDispatch) return;
        if (!customDeliveryFile || customDeliverySubmitting) return;

        const formData = new FormData();
        formData.append('file', customDeliveryFile);
        if (customDeliveryMessage.trim()) {
            formData.append('message', customDeliveryMessage.trim());
        }

        setCustomDeliverySubmitting(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/orders/${orderId}/custom-delivery`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Custom delivery imepakiwa.');
            setCustomDeliveryFile(null);
            setCustomDeliveryMessage('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kupakia custom delivery.');
        } finally {
            setCustomDeliverySubmitting(false);
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
        if (!canUpdateOrder) return;
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

    async function confirmAvailability() {
        if (!canUpdateOrder || quoteSubmitting) return;

        setQuoteSubmitting(true);
        try {
            await axios.post(`/api/merchant/orders/${orderId}/confirm-availability`);
            toast.success('Order imethibitishwa. Mteja anaweza kulipia sasa.');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuthibitisha order.');
        } finally {
            setQuoteSubmitting(false);
        }
    }

    async function copyRouteLink() {
        if (!routeUrl) return;

        try {
            await navigator.clipboard.writeText(routeShareText || routeUrl);
            toast.success('Route link imenakiliwa.');
        } catch (error) {
            toast.error('Imeshindwa kunakili route link.');
        }
    }

    async function shareRouteLink() {
        if (!routeUrl) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Delivery route',
                    text: routeShareText,
                    url: routeUrl,
                });
                return;
            } catch (error) {
                if (error?.name === 'AbortError') return;
            }
        }

        await copyRouteLink();
    }

    async function verifyPickupPin(e) {
        e.preventDefault();
        if (!canVerifyPickup) return;
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
        if (!canVerifyPickup) return;
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
                    {!loading && order && !isSubscriptionOrder && (
                        <Button
                            className="rounded-xl font-bold"
                            onClick={() => router.visit(`/chat/${order?.public_id}?acting_as=merchant`)}
                            disabled={!order?.public_id}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Open Chat
                        </Button>
                    )}
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
                                    <p><span className="text-muted-foreground">Kiasi:</span> <span className="font-semibold">{orderQuantityLabel(order)}</span></p>
                                    <p><span className="text-muted-foreground">Bei moja:</span> <span className="font-semibold">{orderUnitPriceLabel(order)}</span></p>
                                    <p><span className="text-muted-foreground">Jumla:</span> <span className="font-semibold">TZS {Number(order.total_paid || 0).toLocaleString()}</span></p>
                                    <p><span className="text-muted-foreground">Payment phone:</span> <span className="font-semibold">{maskPhone(order.payment_phone)}</span></p>
                                    <p><span className="text-muted-foreground">Account phone:</span> <span className="font-semibold">{maskPhone(order.account_phone)}</span></p>
                                </CardContent>
                            </Card>

                            {order.offering_group_selection?.lines?.length > 0 && (
                                <Card className="rounded-2xl md:col-span-2 border-teal-100 bg-teal-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-teal-700" />
                                            Offering Selection
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-xl bg-white p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Offering</p>
                                                <p className="mt-1 font-black text-slate-950">{order.offering_group_selection?.group?.title || order.display_title}</p>
                                            </div>
                                            <div className="rounded-xl bg-white p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lines</p>
                                                <p className="mt-1 font-black text-slate-950">{order.offering_group_selection.lines.length}</p>
                                            </div>
                                            <div className="rounded-xl bg-white p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal</p>
                                                <p className="mt-1 font-black text-slate-950">TZS {Number(order.offering_group_selection?.subtotal || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <OfferingGroupLines lines={order.offering_group_selection.lines} />
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="rounded-2xl md:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-brand-600" />
                                        Fulfilment Workflow
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <p className="font-medium text-foreground">
                                        {isSubscriptionOrder
                                            ? 'Hii ni subscription order: access hutolewa moja kwa moja kulingana na muda wa membership.'
                                            : flowCopy}
                                    </p>
                                    {order.delivery && (
                                        <>
                                            <p><span className="text-muted-foreground">Delivery Method:</span> <span className="font-semibold uppercase text-brand-700">{deliveryMethodLabel(order.delivery)}</span></p>
                                            <p><span className="text-muted-foreground">Delivery status:</span> <span className="font-semibold">{deliveryStatusLabel(order.delivery)}</span></p>
                                            {order.delivery.physical_address && (
                                                <p><span className="text-muted-foreground">Anwani ya Mteja:</span> <span className="font-semibold">{order.delivery.physical_address}</span></p>
                                            )}
                                            {order.delivery.bus_company && <p><span className="text-muted-foreground">Bus company:</span> <span className="font-semibold">{order.delivery.bus_company}</span></p>}
                                            {order.delivery.waybill_tracking_number && <p><span className="text-muted-foreground">Waybill tracking:</span> <span className="font-semibold">{order.delivery.waybill_tracking_number}</span></p>}
                                            {order.delivery.boda_phone && <p><span className="text-muted-foreground">Delivery phone:</span> <span className="font-semibold">{order.delivery.boda_phone}</span></p>}
                                            {order.delivery.delivery_type !== 'self_pickup' && order.delivery.buyer_release_pin && (
                                                <p><span className="text-muted-foreground">Expected PIN from Buyer:</span> <span className="font-mono font-bold text-brand-600 ml-1">Needed for payout</span></p>
                                            )}
                                            {order.delivery.delivery_type !== 'self_pickup' && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <DeliveryDirectionsButton routeUrl={routeUrl} />
                                                    {order.delivery.boda_phone && (
                                                        <a href={`tel:${order.delivery.boda_phone}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-100 bg-white px-4 text-xs font-black uppercase tracking-widest text-sky-700">
                                                            Delivery phone
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            {canUpdateDeliveryStatus && order.delivery.delivery_type !== 'self_pickup' && (
                                                <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Temporary rider link</p>
                                                            <p className="mt-1 text-xs font-semibold text-sky-900">
                                                                Let a boda/rider update package status and upload proof without merchant login.
                                                            </p>
                                                            {order.delivery.rider_access_active && !riderLink && (
                                                                <p className="mt-2 text-[11px] font-bold text-sky-700">
                                                                    Existing link active until {order.delivery.rider_access_expires_at ? new Date(order.delivery.rider_access_expires_at).toLocaleString() : 'expiry'}.
                                                                    Regenerate if you need to copy it again.
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Button type="button" variant="outline" onClick={generateRiderLink} disabled={riderLinkGenerating} className="h-11 rounded-xl border-sky-200 bg-white font-bold text-sky-700 hover:bg-sky-50">
                                                            {riderLinkGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                                                            Generate Link
                                                        </Button>
                                                    </div>
                                                    {riderLink && (
                                                        <div className="mt-3 rounded-xl border border-sky-100 bg-white p-3">
                                                            <p className="break-all text-xs font-bold text-slate-700">{riderLink}</p>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <Button type="button" size="sm" onClick={copyRiderLink} className="rounded-lg font-bold">
                                                                    <Copy className="mr-2 h-3.5 w-3.5" />
                                                                    Copy
                                                                </Button>
                                                                <a
                                                                    href={`https://wa.me/?text=${encodeURIComponent(`Delivery update link: ${riderLink}`)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex h-9 items-center rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-xs font-black uppercase tracking-wider text-emerald-700"
                                                                >
                                                                    WhatsApp
                                                                </a>
                                                                <a
                                                                    href={`sms:?&body=${encodeURIComponent(`Delivery update link: ${riderLink}`)}`}
                                                                    className="inline-flex h-9 items-center rounded-lg border border-sky-100 bg-sky-50 px-3 text-xs font-black uppercase tracking-wider text-sky-700"
                                                                >
                                                                    SMS
                                                                </a>
                                                            </div>
                                                            {riderLinkExpiresAt && (
                                                                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                                                                    Expires {new Date(riderLinkExpiresAt).toLocaleString()}.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!order.delivery && (
                                        <p className="text-muted-foreground">Hakuna taarifa za delivery kwa order hii.</p>
                                    )}
                                    {canUpdateDeliveryStatus && order.delivery && (
                                        <form onSubmit={submitDeliveryStatus} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                    Delivery Status
                                                    <select
                                                        value={deliveryStatusInput}
                                                        onChange={(e) => setDeliveryStatusInput(e.target.value)}
                                                        className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                    >
                                                        {statusOptions.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                    Proof Photo/Video
                                                    <input
                                                        type="file"
                                                        accept="image/*,video/*"
                                                        onChange={(e) => setDeliveryStatusProof(e.target.files?.[0] || null)}
                                                        className="mt-2 block w-full rounded-xl border border-input bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-700"
                                                    />
                                                </label>
                                                {(order.delivery.delivery_type === 'local_boda' || deliveryStatusInput === 'with_boda') && (
                                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                        Delivery Phone
                                                        <input
                                                            value={bodaPhone}
                                                            onChange={(e) => setBodaPhone(e.target.value)}
                                                            placeholder={order.delivery.boda_phone || '+2557...'}
                                                            className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                        />
                                                    </label>
                                                )}
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground md:col-span-2">
                                                    Note
                                                    <textarea
                                                        value={deliveryStatusNote}
                                                        onChange={(e) => setDeliveryStatusNote(e.target.value)}
                                                        placeholder="Mf. Package handed to rider, waiting for customer PIN."
                                                        className="mt-2 min-h-[84px] w-full rounded-xl border border-input bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-950"
                                                    />
                                                </label>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between gap-3">
                                                <p className="text-xs text-muted-foreground">Delivery updates stay separate from payment status and build a proof timeline for both sides.</p>
                                                <Button type="submit" className="rounded-xl font-bold" disabled={deliveryStatusSubmitting}>
                                                    {deliveryStatusSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                    Save Status
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                    {deliveryEvents.length > 0 && (
                                        <DeliveryFlowTimeline delivery={order.delivery} className="mt-4" />
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
                                            {closestLocation && (
                                                <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/70 p-3">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                                                                <Store className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">Nearest shop</p>
                                                                <p className="text-sm font-black text-brand-950">{closestLocation.name}</p>
                                                                <p className="text-xs font-bold text-brand-800">{closestLocation.distance.toFixed(1)} km from customer</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {routeUrl && (
                                                                <a
                                                                    href={routeUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-brand-700 bg-white px-3 py-2 rounded-xl border border-brand-100 hover:bg-brand-50 transition-colors"
                                                                >
                                                                    <MapPin className="h-3 w-3" /> ROUTE
                                                                </a>
                                                            )}
                                                            {routeUrl && (
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() => setShowRouteShare(true)}
                                                                    className="h-8 rounded-xl border-brand-100 bg-white px-3 text-[10px] font-black text-brand-700 hover:bg-brand-50"
                                                                >
                                                                    <Share2 className="h-3 w-3 mr-1" />
                                                                    SHARE
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {!closestLocation && routeUrl && (
                                                <a
                                                    href={routeUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100 hover:bg-brand-100 transition-colors"
                                                >
                                                    <MapPin className="h-3 w-3" /> FUNGUA KWENYE RAMANI
                                                </a>
                                            )}
                                        </div>

                                        {canEditShipping ? (
                                            <form onSubmit={submitQuote} className="rounded-xl border border-slate-100 bg-white/80 p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block ml-1">
                                                            {order.shipping_fee !== null && order.shipping_fee !== undefined ? 'Update Shipping Fee (TZS)' : 'Enter Shipping Fee (TZS)'}
                                                        </label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            placeholder="Mf. 5000"
                                                            value={shippingFeeInput}
                                                            onChange={e => setShippingFeeInput(e.target.value)}
                                                            className="font-bold rounded-xl h-11"
                                                            required
                                                        />
                                                    </div>
                                                    <Button
                                                        type="submit"
                                                        className="h-11 rounded-xl px-8 bg-brand-600 hover:bg-brand-700 font-bold"
                                                        disabled={quoteSubmitting || shippingFeeInput === ''}
                                                    >
                                                        {quoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                        {order.shipping_fee !== null && order.shipping_fee !== undefined ? 'SASISHA GHARAMA' : 'TUMA GHARAMA'}
                                                    </Button>
                                                </div>
                                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Current shipping</p>
                                                        <p className="text-sm font-black text-slate-950">TZS {Number(order.shipping_fee || 0).toLocaleString()}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Items total</p>
                                                        <p className="text-sm font-black text-slate-950">TZS {Number((order.total_paid || 0) - (order.shipping_fee || 0)).toLocaleString()}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Customer total</p>
                                                        <p className="text-sm font-black text-brand-700">TZS {Number(order.total_paid || 0).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </form>
                                        ) : order.inquiry_status === 'pending' && !canUpdateOrder ? (
                                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-600">
                                                Shipping quote is pending. You have view-only access for this order.
                                            </div>
                                        ) : order.inquiry_status === 'quoted' && !merchantConfirmed ? (
                                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-amber-700 mb-1">Inasubiri uthibitisho wako:</p>
                                                    <p className="text-sm font-bold text-amber-900">Gharama ipo tayari. Thibitisha stock/uwezo wa kutimiza order ili mteja aweze kulipa.</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={confirmAvailability}
                                                    disabled={quoteSubmitting || !canUpdateOrder}
                                                    className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                                                >
                                                    {quoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                    THIBITISHA
                                                </Button>
                                            </div>
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
                                        {order.inquiry_status === 'quoted' && !merchantConfirmed && order.payment_status === 'pending' && (
                                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-amber-700 mb-1">Inasubiri uthibitisho wako:</p>
                                                    <p className="text-sm font-bold text-amber-900">Thibitisha stock/uwezo wa kutimiza order ili mteja aweze kulipa.</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={confirmAvailability}
                                                    disabled={quoteSubmitting || !canUpdateOrder}
                                                    className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                                                >
                                                    {quoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                    THIBITISHA
                                                </Button>
                                            </div>
                                        )}
                                        <p className="text-[11px] text-muted-foreground italic font-medium">
                                            Kabla ya mteja kulipa, unaweza kusasisha gharama ya usafiri kulingana na makubaliano ya boda au mabadiliko ya haraka. Baada ya malipo, gharama inafungwa.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="rounded-2xl md:col-span-2 overflow-hidden border-slate-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ReceiptText className="h-4 w-4 text-brand-600" />
                                        Payment Status
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5">
                                    <div className={`rounded-[1.75rem] border p-5 ${paymentState.tone}`}>
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">Payment state</p>
                                                <h3 className="mt-1 text-2xl font-black">{paymentState.label}</h3>
                                                <p className="mt-1 max-w-2xl text-sm font-semibold opacity-80">{paymentState.body}</p>
                                            </div>
                                            <div className="grid min-w-full gap-2 sm:grid-cols-3 md:min-w-[420px]">
                                                <div className="rounded-2xl bg-white/75 px-4 py-3">
                                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Total</p>
                                                    <p className="mt-1 text-lg font-black text-slate-950">TZS {paymentState.total.toLocaleString()}</p>
                                                </div>
                                                <div className="rounded-2xl bg-white/75 px-4 py-3">
                                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Paid</p>
                                                    <p className="mt-1 text-lg font-black text-emerald-700">TZS {paymentState.paid.toLocaleString()}</p>
                                                </div>
                                                <div className="rounded-2xl bg-white/75 px-4 py-3">
                                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Left</p>
                                                    <p className="mt-1 text-lg font-black text-amber-700">TZS {paymentState.left.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {isCustomDigitalDelivery && canDispatch && (
                                <Card className="rounded-2xl md:col-span-2 border-indigo-200 bg-indigo-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <FileUp className="h-4 w-4 text-indigo-600" />
                                            Custom Digital Delivery
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        {order.custom_delivery?.delivered_at ? (
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm font-black text-emerald-800">
                                                        {order.custom_delivery.status === 'revision_requested'
                                                            ? 'Revision requested'
                                                            : order.custom_delivery.status === 'accepted'
                                                                ? 'Accepted by buyer'
                                                                : 'Delivered'}
                                                    </p>
                                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                        {order.custom_delivery.status || 'delivered'}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs font-semibold text-emerald-700">
                                                    {order.custom_delivery.file_name || 'Final file'} · {order.custom_delivery.delivered_at ? new Date(order.custom_delivery.delivered_at).toLocaleString() : ''}
                                                </p>
                                                {order.custom_delivery.message && (
                                                    <p className="mt-2 text-sm text-emerald-900 whitespace-pre-line">{order.custom_delivery.message}</p>
                                                )}
                                                {order.custom_delivery.revision_message && (
                                                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Buyer revision note</p>
                                                        <p className="mt-1 text-sm text-amber-950 whitespace-pre-line">{order.custom_delivery.revision_message}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                                                Buyer has paid. Upload the finished file when the custom work is ready.
                                            </div>
                                        )}

                                        <form onSubmit={submitCustomDelivery} className="space-y-3">
                                            <label className="rounded-xl border border-input bg-background p-3 text-sm block">
                                                <span className="mb-2 inline-flex items-center gap-2 font-semibold">
                                                    <FileUp className="h-4 w-4 text-indigo-600" />
                                                    Final delivery file
                                                </span>
                                                <input
                                                    type="file"
                                                    onChange={(e) => setCustomDeliveryFile(e.target.files?.[0] || null)}
                                                    className="mt-2 block w-full text-xs"
                                                    required
                                                />
                                            </label>
                                            <textarea
                                                value={customDeliveryMessage}
                                                onChange={(e) => setCustomDeliveryMessage(e.target.value)}
                                                rows={3}
                                                placeholder="Optional delivery note, instructions, revision note, or usage guidance..."
                                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                            />
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs text-muted-foreground">
                                                    Uploading a new file replaces the previous final delivery for this order.
                                                </p>
                                                <Button type="submit" className="rounded-xl font-bold" disabled={!customDeliveryFile || customDeliverySubmitting}>
                                                    {customDeliverySubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
                                                    Upload Delivery
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            )}

                            {order.is_escrow_order && canVerifyPickup && order.delivery?.delivery_type === 'self_pickup' && order.payment_status === 'awaiting_merchant_confirmation' && (
                                <Card className="rounded-[2rem] md:col-span-2 overflow-hidden border-brand-100 bg-white shadow-xl shadow-brand-100/40">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-brand-600" />
                                            Verification: Customer Pickup (Self Delivery)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-xl shadow-brand-600/25">
                                                <Store className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black tracking-tight text-slate-950">Confirm customer pickup</h3>
                                                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                                                    Mteja akifika, omba <strong>Pickup PIN</strong> aliyopewa kwenye chat yake. Ukithibitisha PIN, order itatolewa na escrow itaendelea kukamilishwa.
                                                </p>
                                            </div>
                                            <form onSubmit={verifyPickupPin} className="w-full space-y-3">
                                                <Input
                                                    inputMode="numeric"
                                                    placeholder="0000"
                                                    value={pickupPinInput}
                                                    onChange={e => setPickupPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                    maxLength={4}
                                                    className="mx-auto h-20 max-w-60 rounded-3xl border-2 border-brand-100 bg-brand-50/50 text-center text-3xl font-black tracking-[0.35em] text-brand-900 shadow-inner focus:border-brand-400"
                                                />
                                                <Button type="submit" disabled={pinVerifying || pickupPinInput.length !== 4} className="mx-auto h-14 w-full max-w-80 rounded-2xl bg-brand-600 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-brand-600/25 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400">
                                                    {pinVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                                    Kabidhi Mzigo
                                                </Button>
                                            </form>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {order.is_escrow_order && (canDispatch || canVerifyPickup) && order.delivery?.delivery_type !== 'self_pickup' && (
                                <Card className="rounded-2xl md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-brand-600" />
                                            {order.payment_status === 'escrow_locked' ? 'Verification & Delivery Info' : 'Dispatch Evidence (Physical Only)'}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {order.payment_status === 'awaiting_merchant_confirmation' && canDispatch && (
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
                                                            Packing Proof
                                                        </span>
                                                        <input
                                                            type="file"
                                                            accept="image/*,video/*"
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

                                        {order.payment_status === 'escrow_locked' && canVerifyPickup && order.delivery?.delivery_type === 'local_boda' && (
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
                                                    <span className="text-muted-foreground text-xs uppercase font-black">Packing proof:</span>{' '}
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
                    </>
                )}
            </div>
            {showRouteShare && routeUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-700">Share route</p>
                                <h3 className="mt-1 text-xl font-black text-slate-950">Delivery Route</h3>
                                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                    {closestLocation?.name || 'Shop'} to {order?.delivery?.physical_address || 'customer location'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRouteShare(false)}
                                className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mt-5 flex justify-center rounded-3xl border border-slate-100 bg-slate-50 p-5">
                            <QRCodeCanvas value={routeUrl} size={220} includeMargin />
                        </div>
                        <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
                            Boda mwenye smartphone anaweza kuscan hii QR kufungua route Google Maps.
                        </p>

                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <Button type="button" onClick={shareRouteLink} className="h-11 rounded-xl bg-brand-600 font-black">
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                            </Button>
                            <Button type="button" variant="outline" onClick={copyRouteLink} className="h-11 rounded-xl font-black">
                                <Copy className="h-4 w-4 mr-2" />
                                Copy
                            </Button>
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(routeShareText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-xs font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100"
                            >
                                WhatsApp
                            </a>
                            <a
                                href={`sms:?&body=${encodeURIComponent(routeShareText)}`}
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-xs font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100"
                            >
                                SMS
                            </a>
                        </div>

                        <a
                            href={routeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-xs font-black uppercase tracking-widest text-brand-700 hover:bg-brand-100"
                        >
                            <MapPin className="h-4 w-4 mr-2" />
                            Open Google Maps
                        </a>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
