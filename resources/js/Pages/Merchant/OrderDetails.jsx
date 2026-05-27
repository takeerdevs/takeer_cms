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
    Printer,
    ReceiptText,
    RefreshCcw,
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
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeliveryFlowTimeline, DeliveryDirectionsButton, deliveryCurrentIndex, deliveryStepsFor } from '@/Components/DeliveryFlowTimeline';
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
    if (type === 'forwarder') return 'FORWARDER DROP-OFF';
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
    if (type === 'forwarder' && status === 'inquiry') {
        return 'Awaiting dispatch to forwarder';
    }
    if (type === 'forwarder' && status === 'ready_at_terminal') {
        return 'Received by forwarder';
    }
    if (type === 'forwarder' && status === 'customer_confirmed') {
        return 'Handoff verified by buyer';
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
    if (type === 'forwarder') {
        return [
            { value: 'packing', label: 'Packing order' },
            { value: 'with_boda', label: 'Dispatched to forwarder' },
            { value: 'ready_at_terminal', label: 'Received by forwarder' },
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

function availableDeliveryStatusOptions(delivery) {
    const options = deliveryStatusOptions(delivery);
    const type = delivery?.delivery_type || delivery?.type || '';

    if (type === 'self_pickup') return options;

    const steps = deliveryStepsFor(type);
    const currentIndex = deliveryCurrentIndex(delivery);
    const allowed = new Set(['issue_reported']);

    if (currentIndex >= 0) {
        if (steps[currentIndex]?.value) allowed.add(steps[currentIndex].value);
        if (steps[currentIndex + 1]?.value) allowed.add(steps[currentIndex + 1].value);
    } else if (steps[0]?.value) {
        allowed.add(steps[0].value);
    }

    return options.filter((option) => allowed.has(option.value));
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

function packageTitleForLabel(order) {
    if (!order) return 'Takeer package';

    if (order.product?.title) return order.product.title;

    const bundleTitles = Array.isArray(order.bundle_item_selection)
        ? order.bundle_item_selection.map((item) => item?.title).filter(Boolean)
        : [];
    if (bundleTitles.length) return bundleTitles.join(', ');

    const groupTitles = Array.isArray(order.offering_group_selection?.lines)
        ? order.offering_group_selection.lines.map((line) => line?.title).filter(Boolean)
        : [];

    return groupTitles.join(', ') || 'Takeer package';
}

function forwarderShipmentRef(order) {
    return order?.delivery?.forwarder_shipment_public_id || order?.public_id || order?.transaction_ref || `ORDER-${order?.id || ''}`;
}

function forwarderShippingLabelText(order) {
    const ref = forwarderShipmentRef(order);
    const address = order?.delivery?.physical_address || 'Forwarder warehouse address unavailable';
    const buyerName = order?.buyer?.name || 'Customer';
    const buyerPhone = order?.buyer?.phone_number || order?.account_phone || order?.payment_phone || 'Not provided';
    const packageTitle = packageTitleForLabel(order);
    const qty = order?.requested_quantity || order?.quantity || 1;

    return [
        `Recipient: Forwarder warehouse / Takeer ${ref}`,
        `Takeer shipment ref: ${ref}`,
        `Takeer order ref: ${order?.public_id || 'Not provided'}`,
        `Customer: ${buyerName}`,
        `Customer phone: ${buyerPhone}`,
        `Package: ${packageTitle}`,
        `Quantity: ${qty}`,
        '',
        'Warehouse address:',
        address,
        '',
        'Instruction: Please write the Takeer shipment ref on the parcel or attach this label before handoff.',
    ].join('\n');
}

function printForwarderShippingLabel(order) {
    const text = forwarderShippingLabelText(order);
    const ref = forwarderShipmentRef(order);
    const lines = text.split('\n').map((line) => `<div>${escapeHtml(line) || '&nbsp;'}</div>`).join('');
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=720,height=840');

    if (!popup) {
        toast.error('Browser blocked the print window. Copy the label instead.');
        return;
    }

    popup.document.write(`
        <!doctype html>
        <html>
            <head>
                <title>Takeer Shipping Label ${escapeHtml(ref)}</title>
                <style>
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #0f172a; }
                    .label { border: 3px solid #0f172a; border-radius: 18px; padding: 24px; max-width: 680px; }
                    .title { font-size: 26px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 18px; }
                    .ref { border: 2px solid #0ea5e9; border-radius: 14px; padding: 14px; font-size: 22px; font-weight: 900; margin-bottom: 18px; }
                    .body { white-space: pre-wrap; font-size: 18px; line-height: 1.45; font-weight: 700; }
                    .footer { margin-top: 22px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; }
                    @media print { body { padding: 0; } .label { border-radius: 0; max-width: none; min-height: 100vh; } }
                </style>
            </head>
            <body>
                <div class="label">
                    <div class="title">Takeer Forwarder Drop-off</div>
                    <div class="ref">${escapeHtml(ref)}</div>
                    <div class="body">${lines}</div>
                    <div class="footer">Attach to package or show to domestic courier/warehouse receiver.</div>
                </div>
                <script>window.onload = () => { window.print(); };</script>
            </body>
        </html>
    `);
    popup.document.close();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function ForwarderShippingLabelTools({ order }) {
    if (!order?.delivery?.physical_address) return null;

    const ref = forwarderShipmentRef(order);
    const labelText = forwarderShippingLabelText(order);

    const copyLabel = async () => {
        try {
            await navigator.clipboard.writeText(labelText);
            toast.success('Shipping label copied.');
        } catch (error) {
            toast.error('Could not copy the label.');
        }
    };

    return (
        <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Shipping label</p>
                    <p className="mt-1 text-sm font-black text-slate-950">Takeer ref: {ref}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-sky-900">
                        Print or copy this label so the warehouse can identify the parcel when it arrives.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={copyLabel} className="h-10 rounded-xl border-sky-200 bg-white text-xs font-black text-sky-700">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Label
                    </Button>
                    <Button type="button" onClick={() => printForwarderShippingLabel(order)} className="h-10 rounded-xl text-xs font-black">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Label
                    </Button>
                </div>
            </div>
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-sky-100 bg-white p-3 text-xs font-bold leading-5 text-slate-700">
                {labelText}
            </pre>
        </div>
    );
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
    const [deliveryStatusProofs, setDeliveryStatusProofs] = useState([]);
    const [deliveryProofDragging, setDeliveryProofDragging] = useState(false);
    const [deliveryCourierReceipt, setDeliveryCourierReceipt] = useState(null);
    const [forwarderEvidenceType, setForwarderEvidenceType] = useState('manual_forwarder');
    const [trackingLink, setTrackingLink] = useState('');
    const [deliveryStatusSubmitting, setDeliveryStatusSubmitting] = useState(false);
    const [riderLink, setRiderLink] = useState('');
    const [riderLinkExpiresAt, setRiderLinkExpiresAt] = useState(null);
    const [riderLinkGenerating, setRiderLinkGenerating] = useState(false);
    const [returnNote, setReturnNote] = useState('');
    const [returnResolution, setReturnResolution] = useState('replacement');
    const [returnSubmitting, setReturnSubmitting] = useState(false);

    useEffect(() => {
        loadOrder();
    }, [merchantUsername, orderId]);

    useEffect(() => {
        if (order?.shipping_fee !== null && order?.shipping_fee !== undefined) {
            setShippingFeeInput(String(order.shipping_fee));
        }
    }, [order?.shipping_fee]);

    useEffect(() => {
        const options = availableDeliveryStatusOptions(order?.delivery);
        if (!options.some((option) => option.value === deliveryStatusInput)) {
            setDeliveryStatusInput(options[0]?.value || 'packing');
        }
    }, [order?.delivery?.delivery_type, order?.delivery?.delivery_status, order?.delivery?.status, order?.delivery?.events?.length, deliveryStatusInput]);

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
    const isForwarderOrder = (order?.delivery?.delivery_type || order?.delivery?.type) === 'forwarder';
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
    const routeUrl = isForwarderOrder ? '' : googleRouteUrl(closestLocation, customerLocation);
    const routeShareText = routeUrl
        ? `Delivery route: ${closestLocation?.name ? `${closestLocation.name} to ` : ''}${order?.delivery?.physical_address || 'customer location'} ${routeUrl}`
        : '';
    const canEditShipping = canUpdateOrder
        && order?.is_inquiry
        && order?.payment_status === 'pending'
        && order?.delivery?.delivery_type !== 'self_pickup';
    const isWaitingForShippingFee = canEditShipping && order?.shipping_fee === null;
    const statusOptions = availableDeliveryStatusOptions(order?.delivery);
    const deliveryEvents = Array.isArray(order?.delivery?.events) ? order.delivery.events : [];
    const isForwarderHandoffComplete = isForwarderOrder
        && deliveryCurrentIndex(order?.delivery || {}) >= deliveryStepsFor('forwarder').length - 1;
    const canUpdateDeliveryStatus = !!order
        && order.is_escrow_order
        && (canDispatch || canUpdateOrder)
        && ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped', 'disputed'].includes(order.payment_status);
    const isSubscriptionOrder = order?.purchasable_type === 'subscription_plan';
    const isCustomDigitalDelivery = order?.product?.type === 'digital'
        && order?.product?.digital_delivery_type === 'custom_delivery';
    const returnRequest = order?.return_request || null;

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
        deliveryStatusProofs.forEach((file) => formData.append('proofs[]', file));
        if (isForwarderOrder && ['with_boda', 'ready_at_terminal'].includes(deliveryStatusInput)) {
            if (deliveryCourierReceipt) formData.append('courier_receipt', deliveryCourierReceipt);
            if (busCompany.trim()) formData.append('bus_company', busCompany.trim());
            if (waybillTrackingNumber.trim()) formData.append('waybill_tracking_number', waybillTrackingNumber.trim());
            if (trackingLink.trim()) formData.append('tracking_link', trackingLink.trim());
            formData.append('forwarder_evidence_type', forwarderEvidenceType);
        }
        if (order?.delivery?.delivery_type === 'local_boda' && bodaPhone.trim()) {
            formData.append('boda_phone', bodaPhone.trim());
        }

        setDeliveryStatusSubmitting(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/orders/${orderId}/delivery-status`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success('Delivery status imehifadhiwa.');
            setDeliveryStatusNote('');
            setDeliveryStatusProofs([]);
            setDeliveryCourierReceipt(null);
            setTrackingLink('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindwa kuhifadhi delivery status.');
        } finally {
            setDeliveryStatusSubmitting(false);
        }
    }

    function addDeliveryStatusProofs(files) {
        const incoming = Array.from(files || []);
        if (!incoming.length) return;

        setDeliveryStatusProofs((current) => {
            const merged = [...current, ...incoming];
            const unique = [];
            const seen = new Set();
            merged.forEach((file) => {
                const key = `${file.name}-${file.size}-${file.lastModified}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(file);
                }
            });

            if (unique.length > 10) {
                toast.error('Unaweza kuweka hadi media 10 kwa status moja.');
            }

            return unique.slice(0, 10);
        });
    }

    function removeDeliveryStatusProof(index) {
        setDeliveryStatusProofs((current) => current.filter((_, itemIndex) => itemIndex !== index));
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

    async function submitReturnAction(action) {
        if (!canUpdateOrder || !order?.return_request || returnSubmitting) return;
        if (action === 'reject' && !returnNote.trim()) {
            toast.error('Andika sababu ya kukataa return request.');
            return;
        }

        setReturnSubmitting(true);
        try {
            const payload = {};
            if (returnNote.trim()) {
                payload.merchant_note = returnNote.trim();
            }
            if (action === 'complete') {
                payload.resolution_type = returnResolution;
            }

            await axios.post(`/merchant/${merchantUsername}/orders/${orderId}/return-request/${action}`, payload);
            toast.success('Return request imesasishwa.');
            setReturnNote('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Imeshindikana kusasisha return request.');
        } finally {
            setReturnSubmitting(false);
        }
    }

    // Auto-select dispatch mode based on delivery type
    useEffect(() => {
        if (order?.delivery?.delivery_type) {
            if (order.delivery.delivery_type === 'local_boda') {
                setDispatchMode('local');
            } else if (['intercity_bus', 'forwarder'].includes(order.delivery.delivery_type)) {
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
                                                <div>
                                                    <span className="text-muted-foreground">{isForwarderOrder ? 'Forwarder warehouse:' : 'Anwani ya Mteja:'}</span>
                                                    <p className="mt-1 whitespace-pre-line font-semibold leading-6">{order.delivery.physical_address}</p>
                                                </div>
                                            )}
                                            {isForwarderOrder && !order.is_inquiry && <ForwarderShippingLabelTools order={order} />}
                                            {order.delivery.delivery_type === 'intercity_bus' && order.delivery.shipping_zone && (
                                                <p><span className="text-muted-foreground">Inter-city destination:</span> <span className="font-semibold">{order.delivery.shipping_zone.destination_city || order.delivery.shipping_zone.zone_name || order.delivery.shipping_zone.destination_region}</span></p>
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
                                            {canUpdateDeliveryStatus && order.delivery.delivery_type !== 'self_pickup' && !isForwarderOrder && (
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
                                </CardContent>
                            </Card>

                            {order.is_inquiry && (
                                <Card className="rounded-2xl md:col-span-2 border-brand-200 bg-brand-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-brand-600" />
                                            {isForwarderOrder ? 'Forwarder Drop-off Quote' : 'Shipping Quote Inquiry'}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="bg-white/60 p-4 rounded-xl border border-brand-100/50">
                                            <p className="text-xs font-black uppercase tracking-widest text-brand-700/80 mb-2">{isForwarderOrder ? 'Forwarder warehouse:' : 'Customer Address:'}</p>
                                            <p className="font-bold text-brand-900 mb-2 whitespace-pre-line leading-6">{order.delivery?.physical_address || 'Anwani haikuwekwa'}</p>
                                            {!isForwarderOrder && closestLocation && (
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
                                            {isForwarderOrder && (
                                                <>
                                                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                                                        Forwarder drop-off uses domestic courier, cargo, or warehouse drop-off proof. Add courier tracking or waybill evidence after payment.
                                                    </div>
                                                    <ForwarderShippingLabelTools order={order} />
                                                </>
                                            )}
                                            {!isForwarderOrder && !closestLocation && routeUrl && (
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
                                            <form onSubmit={submitQuote} className={`rounded-xl border bg-white/80 p-4 transition-colors ${isWaitingForShippingFee ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100'}`}>
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
                                                            className={`font-bold rounded-xl h-11 ${isWaitingForShippingFee ? 'border-red-400 bg-red-50/40 focus-visible:ring-red-200' : ''}`}
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

                            {canUpdateDeliveryStatus && order.delivery && (
                                <Card className="rounded-2xl md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <RefreshCcw className="h-4 w-4 text-brand-600" />
                                            Delivery Status Update
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <DeliveryFlowTimeline delivery={order.delivery} className="mb-4" />
                                        {isForwarderHandoffComplete ? (
                                            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white">
                                                        <CircleAlert className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black uppercase tracking-wider text-amber-900">Handoff submitted for verification</p>
                                                        <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
                                                            The seller has submitted forwarder handoff proof. Escrow stays held until the buyer confirms, the verification window passes, or Takeer reviews the evidence.
                                                        </p>
                                                        {order.payment_status === 'resolved_merchant_paid' ? (
                                                            <p className="mt-2 text-xs font-black uppercase tracking-widest text-emerald-700">Escrow released to merchant</p>
                                                        ) : (
                                                            <p className="mt-2 text-xs font-black uppercase tracking-widest text-amber-700">Escrow held until verification or admin review</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                        <form onSubmit={submitDeliveryStatus} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
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
                                                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                    Proof Photo/Video
                                                    <label
                                                        htmlFor="delivery-status-proofs"
                                                        onDragOver={(event) => {
                                                            event.preventDefault();
                                                            setDeliveryProofDragging(true);
                                                        }}
                                                        onDragLeave={() => setDeliveryProofDragging(false)}
                                                        onDrop={(event) => {
                                                            event.preventDefault();
                                                            setDeliveryProofDragging(false);
                                                            addDeliveryStatusProofs(event.dataTransfer.files);
                                                        }}
                                                        className={cn(
                                                            'mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-white px-4 py-5 text-center transition',
                                                            deliveryProofDragging ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-slate-300 hover:border-brand-300 hover:bg-brand-50/40'
                                                        )}
                                                    >
                                                        <input
                                                            id="delivery-status-proofs"
                                                            type="file"
                                                            accept="image/*,video/*"
                                                            multiple
                                                            onChange={(e) => {
                                                                addDeliveryStatusProofs(e.target.files);
                                                                e.target.value = '';
                                                            }}
                                                            className="sr-only"
                                                        />
                                                        <FileUp className="mb-2 h-7 w-7 text-brand-600" />
                                                        <span className="text-sm font-black normal-case tracking-normal text-slate-950">
                                                            Tap to add photos/videos
                                                        </span>
                                                        <span className="mt-1 text-[11px] font-bold normal-case tracking-normal text-muted-foreground">
                                                            Or drop files here. Up to 10 media files.
                                                        </span>
                                                    </label>
                                                    {deliveryStatusProofs.length > 0 && (
                                                        <div className="mt-2 grid gap-2 normal-case tracking-normal">
                                                            {deliveryStatusProofs.map((file, index) => (
                                                                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-black text-slate-900">{file.name}</p>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                            {(file.size / 1024 / 1024).toFixed(1)} MB · {file.type?.startsWith('video/') ? 'Video' : 'Photo'}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeDeliveryStatusProof(index)}
                                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600"
                                                                        aria-label={`Remove ${file.name}`}
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {order.delivery.delivery_type === 'local_boda' && (
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
                                                {isForwarderOrder && ['with_boda', 'ready_at_terminal'].includes(deliveryStatusInput) && (
                                                    <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                                                        <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground md:col-span-2">
                                                            Evidence Type
                                                            <select
                                                                value={forwarderEvidenceType}
                                                                onChange={(e) => setForwarderEvidenceType(e.target.value)}
                                                                className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                            >
                                                                <option value="tracked_courier">Tracked courier (DHL/FedEx/UPS/SF etc.)</option>
                                                                <option value="manual_forwarder">Manual forwarder / cargo / bus receipt</option>
                                                                <option value="takeer_verified_forwarder">Takeer verified forwarder</option>
                                                            </select>
                                                        </label>
                                                        <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                            Transport Receipt / Waybill
                                                            <input
                                                                type="file"
                                                                accept="image/*,application/pdf"
                                                                onChange={(e) => setDeliveryCourierReceipt(e.target.files?.[0] || null)}
                                                                className="mt-2 block w-full rounded-xl border border-input bg-white px-3 py-2 text-xs normal-case tracking-normal text-slate-700"
                                                            />
                                                            {deliveryCourierReceipt && (
                                                                <p className="mt-2 truncate text-[11px] font-bold normal-case tracking-normal text-brand-700">{deliveryCourierReceipt.name}</p>
                                                            )}
                                                        </label>
                                                        <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                            Carrier / Forwarder
                                                            <input
                                                                value={busCompany}
                                                                onChange={(e) => setBusCompany(e.target.value)}
                                                                placeholder="Mf. DHL / Silent Ocean / local cargo"
                                                                className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                            />
                                                        </label>
                                                        <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                            Receipt / Waybill / Tracking # (optional)
                                                            <input
                                                                value={waybillTrackingNumber}
                                                                onChange={(e) => setWaybillTrackingNumber(e.target.value)}
                                                                placeholder="Reference, waybill, or tracking number"
                                                                className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                            />
                                                        </label>
                                                        <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                            Tracking Link (optional)
                                                            <input
                                                                type="url"
                                                                value={trackingLink}
                                                                onChange={(e) => setTrackingLink(e.target.value)}
                                                                placeholder="https://..."
                                                                className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground md:col-span-2">
                                                    Note
                                                    <textarea
                                                        value={deliveryStatusNote}
                                                        onChange={(e) => setDeliveryStatusNote(e.target.value)}
                                                        placeholder={isForwarderOrder ? 'Mf. Package dispatched to forwarder warehouse with courier proof.' : 'Mf. Package handed to rider, waiting for customer PIN.'}
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
                                    </CardContent>
                                </Card>
                            )}

                            {order.is_escrow_order && (canDispatch || canVerifyPickup) && order.delivery?.delivery_type !== 'self_pickup' && !isForwarderOrder && (
                                <Card className="rounded-2xl md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-brand-600" />
                                            {isForwarderOrder
                                                ? 'Forwarder Drop-off Evidence'
                                                : (order.payment_status === 'escrow_locked' ? 'Verification & Delivery Info' : 'Dispatch Evidence (Physical Only)')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {order.payment_status === 'awaiting_merchant_confirmation' && canDispatch && (
                                            <>
                                                {!isForwarderOrder && (
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
                                                )}

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
                                                                {isForwarderOrder ? 'Courier Receipt / Waybill' : 'Transport Receipt / Waybill'}
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
                                                                <span className="mb-2 inline-flex items-center gap-2 font-semibold">{isForwarderOrder ? 'Courier / Cargo Company (optional)' : 'Bus Company (optional)'}</span>
                                                                <input
                                                                    value={busCompany}
                                                                    onChange={(e) => setBusCompany(e.target.value)}
                                                                    placeholder={isForwarderOrder ? 'Mf. SF Express / DHL / local cargo' : 'Mf. Tashriff'}
                                                                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                                                />
                                                            </label>
                                                            <label className="rounded-xl border border-input bg-background p-3 text-sm">
                                                                <span className="mb-2 inline-flex items-center gap-2 font-semibold">Waybill Tracking # (optional)</span>
                                                                <input
                                                                    value={waybillTrackingNumber}
                                                                    onChange={(e) => setWaybillTrackingNumber(e.target.value)}
                                                                    placeholder={isForwarderOrder ? 'Tracking / waybill number' : 'BUS-12345'}
                                                                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                                                />
                                                            </label>
                                                        </>
                                                    )}

                                                    <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
                                                        <p className="text-xs text-muted-foreground">
                                                            {canDispatchNow
                                                                ? (isForwarderOrder ? 'Weka packing proof na courier/waybill evidence ya mzigo kwenda forwarder.' : 'Weka ushahidi wa dispatch ili escrow iendelee salama.')
                                                                : 'Dispatch imefungwa kwa status ya sasa ya order.'}
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
                                                <p className="text-sm mt-1">Destination na bei ya mkoa vimehifadhiwa kwenye order. Pickup/drop-off office halisi itathibitishwa kwenye waybill/risiti au simu kutoka transporter. Mteja akichukua mzigo na kila kitu kiko sawa, atathibitisha kwenye App.</p>
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

                            {returnRequest && (
                                <Card className="rounded-2xl md:col-span-2 border-sky-200 bg-sky-50/80">
                                    <CardContent className="p-4 text-sm">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <p className="font-black text-sky-800 flex items-center gap-2">
                                                    <RefreshCcw className="h-4 w-4" />
                                                    Return request
                                                </p>
                                                <p className="mt-1 text-sky-800/90"><span className="font-semibold">Status:</span> {String(returnRequest.status || '').replaceAll('_', ' ')}</p>
                                                <p className="mt-1 text-sky-800/90"><span className="font-semibold">Customer reason:</span> {returnRequest.reason || 'N/A'}</p>
                                                {returnRequest.policy_snapshot?.window_ends_at && (
                                                    <p className="mt-1 text-sky-800/90"><span className="font-semibold">Policy window:</span> ends {new Date(returnRequest.policy_snapshot.window_ends_at).toLocaleDateString()}</p>
                                                )}
                                                {returnRequest.evidence_url && (
                                                    <a href={returnRequest.evidence_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-black uppercase tracking-widest text-sky-700 underline">
                                                        View evidence
                                                    </a>
                                                )}
                                            </div>
                                            {canUpdateOrder && !['completed', 'escalated'].includes(returnRequest.status) && (
                                                <div className="w-full space-y-2 md:max-w-sm">
                                                    <textarea
                                                        value={returnNote}
                                                        onChange={(e) => setReturnNote(e.target.value)}
                                                        rows={3}
                                                        placeholder="Message to customer: return instructions, rejection reason, or resolution note..."
                                                        className="w-full rounded-2xl border border-sky-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/20"
                                                    />
                                                    {['approved', 'item_received'].includes(returnRequest.status) && (
                                                        <select
                                                            value={returnResolution}
                                                            onChange={(e) => setReturnResolution(e.target.value)}
                                                            className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold"
                                                        >
                                                            <option value="replacement">Replacement sent</option>
                                                            <option value="refund">Refund buyer</option>
                                                            <option value="store_credit">Store credit</option>
                                                            <option value="other">Other resolution</option>
                                                        </select>
                                                    )}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {returnRequest.status === 'pending_merchant_review' && (
                                                            <>
                                                                <Button type="button" className="rounded-xl bg-sky-700 text-white hover:bg-sky-800" disabled={returnSubmitting} onClick={() => submitReturnAction('approve')}>
                                                                    Approve
                                                                </Button>
                                                                <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-700" disabled={returnSubmitting} onClick={() => submitReturnAction('reject')}>
                                                                    Reject
                                                                </Button>
                                                            </>
                                                        )}
                                                        {returnRequest.status === 'approved' && (
                                                            <Button type="button" className="col-span-2 rounded-xl bg-sky-700 text-white hover:bg-sky-800" disabled={returnSubmitting} onClick={() => submitReturnAction('received')}>
                                                                Mark Item Received
                                                            </Button>
                                                        )}
                                                        {['approved', 'item_received'].includes(returnRequest.status) && (
                                                            <Button type="button" variant="outline" className="col-span-2 rounded-xl border-emerald-200 text-emerald-700" disabled={returnSubmitting} onClick={() => submitReturnAction('complete')}>
                                                                Complete Return
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
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
