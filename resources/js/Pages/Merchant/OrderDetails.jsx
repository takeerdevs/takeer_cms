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
    CheckCircle2,
    CircleAlert,
    Copy,
    Download,
    DownloadCloud,
    FileUp,
    Loader2,
    MapPin,
    MessageSquare,
    Image as ImageIcon,
    Layers,
    Link as LinkIcon,
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
    Wrench,
    Crown,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeliveryFlowTimeline, DeliveryDirectionsButton, deliveryCurrentIndex, deliveryStepsFor } from '@/Components/DeliveryFlowTimeline';
import { orderQuantityLabel, orderUnitPriceLabel } from '@/lib/productUnits';
import { useMerchantPermissions } from '@/lib/merchantPermissions';
import { useLocale } from '@/lib/i18n';
import axios from 'axios';
import { toast } from 'sonner';

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

function formatDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return null;

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length <= 6) return `${digits.slice(0, 2)}...${digits.slice(-2)}`;
    return `${digits.slice(0, 3)}...${digits.slice(-3)}`;
}

function typeMeta(kind, translate = (english) => english) {
    const map = {
        physical_product: { label: translate('Physical Product', 'Bidhaa ya kushikika'), icon: ShoppingBag, cls: 'bg-amber-100 text-amber-700' },
        physical_bundle: { label: translate('Physical Bundle', 'Kifurushi cha kushikika'), icon: Boxes, cls: 'bg-amber-100 text-amber-700' },
        bundle: { label: translate('Bundle', 'Kifurushi'), icon: Boxes, cls: 'bg-sky-100 text-sky-700' },
        offering_group: { label: translate('Offering Group', 'Kundi la ofa'), icon: Layers, cls: 'bg-teal-100 text-teal-700' },
        course_bundle: { label: translate('Course Bundle', 'Kifurushi cha kozi'), icon: BookOpenText, cls: 'bg-indigo-100 text-indigo-700' },
        post_content: { label: translate('Post Content', 'Maudhui ya chapisho'), icon: BookOpenText, cls: 'bg-sky-100 text-sky-700' },
        subscription_plan: { label: translate('Membership', 'Uanachama'), icon: Crown, cls: 'bg-violet-100 text-violet-700' },
        digital_file: { label: translate('Digital File', 'Faili ya kidijitali'), icon: Download, cls: 'bg-indigo-100 text-indigo-700' },
        custom_work: { label: translate('Custom Work', 'Kazi maalum'), icon: FileUp, cls: 'bg-indigo-100 text-indigo-700' },
        service_booking: { label: translate('Service/Booking', 'Huduma/Booking'), icon: CalendarClock, cls: 'bg-emerald-100 text-emerald-700' },
    };

    return map[kind] || map.post_content;
}

function fallbackMediaMeta(order) {
    const productType = order?.product?.type;
    const displayKind = order?.display_kind;

    if (productType === 'digital' || ['digital_file', 'custom_work', 'post_content', 'course_bundle'].includes(displayKind)) {
        return {
            Icon: DownloadCloud,
            className: 'border-indigo-100 bg-indigo-50 text-indigo-500',
        };
    }

    if (productType === 'service' || displayKind === 'service_booking') {
        return {
            Icon: Wrench,
            className: 'border-emerald-100 bg-emerald-50 text-emerald-600',
        };
    }

    return {
        Icon: ShoppingBag,
        className: 'border-amber-100 bg-amber-50 text-amber-600',
    };
}

function OfferingGroupLines({ lines = [], currency = 'TZS', translate = (english) => english }) {
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
                                        <img src={line.image_url} alt={line.title || translate('Offering item', 'Item ya ofa')} className="h-full w-full object-cover" />
                                    ) : (
                                        <ImageIcon className="h-5 w-5" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="break-words font-black text-slate-950">{line.title || translate('Offering item', 'Item ya ofa')}</p>
                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                        {line.section || translate('Main', 'Kuu')} · {String(line.role || translate('optional', 'hiari')).replace(/_/g, ' ')}
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="text-sm font-black text-brand-700">{formatMoney(line.line_total || 0, currency)}</p>
                                <p className="text-[11px] font-bold text-muted-foreground">{translate('Qty', 'Idadi')} {Number(line.quantity || 1).toLocaleString()}</p>
                            </div>
                        </div>

                        {addOns.length > 0 && (
                            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{translate('Add-ons', 'Viongezi')}</p>
                                        <p className="mt-1 text-xs font-bold text-emerald-900">
                                            {addOns.map((addOn) => addOn.name).join(', ')}
                                        </p>
                                    </div>
                                    {addOnsTotal > 0 && (
                                        <p className="shrink-0 text-xs font-black text-emerald-700">
                                            + {formatMoney(addOnsTotal, currency)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {Array.isArray(line.child_lines) && line.child_lines.length > 0 && (
                            <div className="mt-3 border-l-2 border-slate-100 pl-3">
                                <OfferingGroupLines lines={line.child_lines} currency={currency} translate={translate} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function statusMeta(status, translate = (english) => english) {
    const map = {
        pending_fulfillment: { label: translate('Paid - fulfillment required', 'Imelipwa - utimilishaji'), cls: 'bg-amber-100 text-amber-700' },
        release_eligible: { label: translate('Ready for PSP payout', 'Tayari kwa PSP payout'), cls: 'bg-sky-100 text-sky-700' },
        payout_processing: { label: translate('PSP payout processing', 'PSP payout inachakatwa'), cls: 'bg-indigo-100 text-indigo-700' },
        paid_out: { label: translate('Completed', 'Imekamilika'), cls: 'bg-emerald-100 text-emerald-700' },
        disputed: { label: translate('Disputed', 'Mgogoro'), cls: 'bg-red-100 text-red-700' },
        refund_pending: { label: translate('Refund pending admin review', 'Refund inasubiri admin'), cls: 'bg-amber-100 text-amber-700' },
        refunded: { label: translate('Buyer refunded', 'Mteja amerudishiwa'), cls: 'bg-slate-100 text-slate-700' },
    };

    return map[status] || { label: status || translate('Unknown', 'Haijulikani'), cls: 'bg-muted text-muted-foreground' };
}

function deliveryMethodLabel(delivery, translate = (english) => english) {
    const type = delivery?.delivery_type || delivery?.type || '';
    if (type === 'self_pickup') return translate('SELF PICKUP', 'KUCHUKUA');
    if (type === 'forwarder') return translate('FORWARDER DROP-OFF', 'FORWARDER DROP-OFF');
    if (type === 'local_boda') return translate('LOCAL DELIVERY', 'DELIVERY YA KARIBU');
    if (type === 'intercity_bus') return translate('INTERCITY BUS', 'BASI LA MKOA');
    return type ? type.replaceAll('_', ' ').toUpperCase() : translate('STANDARD', 'KAWAIDA');
}

function deliveryStatusLabel(delivery, translate = (english) => english) {
    const type = delivery?.delivery_type || delivery?.type || '';
    const status = delivery?.delivery_status || delivery?.status || '';
    if (type === 'self_pickup' && ['awaiting_boda', 'inquiry', 'awaiting_pickup'].includes(status)) {
        return deliveryStatusText('awaiting_pickup', translate);
    }
    if (type === 'forwarder' && status === 'inquiry') {
        return translate('Awaiting dispatch to forwarder', 'Inasubiri kupelekwa kwa forwarder');
    }
    if (type === 'forwarder' && status === 'ready_at_terminal') {
        return translate('Received by forwarder', 'Imepokelewa na forwarder');
    }
    if (type === 'forwarder' && status === 'customer_confirmed') {
        return translate('Handoff verified by buyer', 'Makabidhiano yamethibitishwa na mteja');
    }
    return deliveryStatusText(status, translate);
}

function deliveryStatusText(status, translate = (english) => english) {
    const map = {
        inquiry: translate('Inquiry', 'Inquiry'),
        packing: translate('Packing order', 'Kuandaa order'),
        ready_for_pickup: translate('Ready for pickup', 'Tayari kuchukuliwa'),
        awaiting_boda: translate('Awaiting delivery', 'Inasubiri delivery'),
        awaiting_pickup: translate('Awaiting pickup', 'Inasubiri kuchukuliwa'),
        dispatched: translate('Dispatched', 'Imetumwa'),
        with_boda: translate('With delivery rider', 'Iko kwa dereva wa delivery'),
        in_transit: translate('In transit', 'Iko njiani'),
        arrived: translate('Arrived at customer area', 'Imefika eneo la mteja'),
        ready_at_terminal: translate('Ready at terminal', 'Tayari kituoni'),
        delivered: translate('Delivered', 'Imefikishwa'),
        issue_reported: translate('Issue reported', 'Tatizo limeripotiwa'),
        disputed: translate('Disputed', 'Mgogoro'),
        customer_confirmed: translate('Customer confirmed', 'Mteja amethibitisha'),
    };

    return map[status] || (status ? status.replaceAll('_', ' ') : translate('N/A', 'Haipo'));
}

function deliveryStatusOptions(delivery, translate = (english) => english) {
    const type = delivery?.delivery_type || delivery?.type || '';
    if (type === 'self_pickup') {
        return [
            { value: 'ready_for_pickup', label: translate('Ready for pickup', 'Tayari kuchukuliwa') },
            { value: 'issue_reported', label: translate('Issue reported', 'Tatizo limeripotiwa') },
        ];
    }
    if (type === 'intercity_bus') {
        return [
            { value: 'packing', label: translate('Packing order', 'Kuandaa order') },
            { value: 'with_boda', label: translate('Dispatched to bus', 'Imetumwa kwenye basi') },
            { value: 'in_transit', label: translate('In transit', 'Iko njiani') },
            { value: 'ready_at_terminal', label: translate('Ready at terminal (Bus Terminal)', 'Tayari kituo cha basi') },
            { value: 'delivered', label: translate('Delivered', 'Imefikishwa') },
            { value: 'issue_reported', label: translate('Issue reported', 'Tatizo limeripotiwa') },
        ];
    }
    if (type === 'forwarder') {
        return [
            { value: 'packing', label: translate('Packing order', 'Kuandaa order') },
            { value: 'with_boda', label: translate('Dispatched to forwarder', 'Imetumwa kwa forwarder') },
            { value: 'ready_at_terminal', label: translate('Received by forwarder', 'Imepokelewa na forwarder') },
            { value: 'issue_reported', label: translate('Issue reported', 'Tatizo limeripotiwa') },
        ];
    }
    return [
        { value: 'packing', label: translate('Packing order', 'Kuandaa order') },
        { value: 'with_boda', label: translate('With delivery rider', 'Iko kwa dereva wa delivery') },
        { value: 'in_transit', label: translate('In transit', 'Iko njiani') },
        { value: 'arrived', label: translate('Arrived at customer area', 'Imefika eneo la mteja') },
        { value: 'delivered', label: translate('Delivered', 'Imefikishwa') },
        { value: 'issue_reported', label: translate('Issue reported', 'Tatizo limeripotiwa') },
    ];
}

function availableDeliveryStatusOptions(delivery, translate = (english) => english) {
    const options = deliveryStatusOptions(delivery, translate);
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

function paymentOverview(order, translate = (english) => english) {
    const total = Number(order?.order_total_with_additions ?? order?.total_paid ?? 0);
    const explicitPaid = order?.amount_paid ?? order?.paid_amount ?? null;
    const paidStatuses = ['payment_confirmed', 'pending_fulfillment', 'release_eligible', 'payout_processing', 'disputed', 'paid_out'];
    const paid = explicitPaid !== null
        ? Number(explicitPaid || 0)
        : (paidStatuses.includes(order?.payment_status) ? total : 0);
    const left = Math.max(0, total - paid);
    const isComplete = paid >= total && total > 0;
    const isPartial = paid > 0 && paid < total;

    if (isComplete) {
        return {
            label: order?.payment_status === 'paid_out' ? translate('Completed', 'Imekamilika') : translate('Paid', 'Imelipwa'),
            body: order?.payment_status === 'paid_out'
                ? translate('The PSP confirmed seller payout.', 'PSP imethibitisha malipo ya muuzaji.')
                : translate('The PSP confirmed payment; fulfilment must be completed before payout.', 'PSP imethibitisha malipo; utimilishaji ukamilike kabla ya payout.'),
            tone: 'border-emerald-100 bg-emerald-50 text-emerald-800',
            paid,
            left,
            total,
        };
    }

    if (isPartial) {
        return {
            label: translate('Partially paid', 'Imelipwa kwa sehemu'),
            body: translate('Customer has paid part of the order. Do not release until the remaining amount is cleared.', 'Mteja amelipa sehemu ya order. Usitoe mzigo hadi kiasi kilichobaki kilipwe.'),
            tone: 'border-amber-100 bg-amber-50 text-amber-800',
            paid,
            left,
            total,
        };
    }

    return {
        label: translate('Not paid', 'Haijalipwa'),
        body: translate('Payment has not been completed yet. Wait for payment before releasing goods or services.', 'Malipo hayajakamilika. Subiri malipo kabla ya kutoa bidhaa au huduma.'),
        tone: 'border-red-100 bg-red-50 text-red-800',
        paid,
        left,
        total,
    };
}

function extraChargeStatusLabel(status, orderPaymentStatus = null, translate = (english) => english) {
    if (status === 'paid_held' && orderPaymentStatus === 'paid_out') {
        return translate('Released', 'Imetolewa');
    }

    return {
        proposed: translate('Proposed', 'Imependekezwa'),
        accepted: translate('Accepted', 'Imekubaliwa'),
        payment_pending: translate('Payment started', 'Malipo yameanza'),
        paid_held: translate('Paid & held', 'Imelipwa na kushikiliwa'),
        released: translate('Released', 'Imetolewa'),
        paid_out: translate('PSP payout confirmed', 'PSP imethibitisha payout'),
        release_eligible: translate('Release eligible', 'Tayari kutolewa'),
        pending_fulfillment: translate('Paid - fulfillment required', 'Imelipwa - inahitaji utimilishaji'),
    }[status] || String(status || translate('Extra charge', 'Gharama ya ziada')).replaceAll('_', ' ');
}

function packageTitleForLabel(order, translate = (english) => english) {
    if (!order) return translate('Takeer package', 'Kifurushi cha Takeer');

    if (order.product?.title) return order.product.title;

    const bundleTitles = Array.isArray(order.bundle_item_selection)
        ? order.bundle_item_selection.map((item) => item?.title).filter(Boolean)
        : [];
    if (bundleTitles.length) return bundleTitles.join(', ');

    const groupTitles = Array.isArray(order.offering_group_selection?.lines)
        ? order.offering_group_selection.lines.map((line) => line?.title).filter(Boolean)
        : [];

    return groupTitles.join(', ') || translate('Takeer package', 'Kifurushi cha Takeer');
}

function orderStatusLabel(value, translate = (english) => english) {
    const labels = {
        pending_merchant_review: translate('Awaiting merchant review', 'Inasubiri ukaguzi wa muuzaji'),
        approved: translate('Approved', 'Imekubaliwa'),
        item_received: translate('Item received', 'Bidhaa imepokelewa'),
        completed: translate('Completed', 'Imekamilika'),
        escalated: translate('Escalated', 'Imepelekwa ngazi ya juu'),
        open: translate('Open', 'Wazi'),
        under_review: translate('Under review', 'Inakaguliwa'),
        resolved: translate('Resolved', 'Imetatuliwa'),
        rejected: translate('Rejected', 'Imekataliwa'),
        cancelled: translate('Cancelled', 'Imeghairiwa'),
        disputed: translate('Disputed', 'Ina mgogoro'),
    };

    return labels[value] || (value ? String(value).replaceAll('_', ' ') : translate('N/A', 'Haipo'));
}

function forwarderShipmentRef(order) {
    return order?.delivery?.forwarder_shipment_public_id || order?.public_id || order?.transaction_ref || `ORDER-${order?.id || ''}`;
}

function forwarderShippingLabelText(order, translate = (english) => english) {
    const ref = forwarderShipmentRef(order);
    const address = order?.delivery?.physical_address || translate('Forwarder warehouse address unavailable', 'Anwani ya ghala la forwarder haipatikani');
    const buyerName = order?.buyer?.name || translate('Customer', 'Mteja');
    const buyerPhone = order?.buyer?.phone_number || order?.account_phone || order?.payment_phone || translate('Not provided', 'Haijatolewa');
    const packageTitle = packageTitleForLabel(order, translate);
    const qty = order?.requested_quantity || order?.quantity || 1;

    return [
        `${translate('Recipient', 'Mpokeaji')}: ${translate('Forwarder warehouse', 'Ghala la forwarder')} / Takeer ${ref}`,
        `${translate('Takeer shipment ref', 'Ref ya shipment ya Takeer')}: ${ref}`,
        `${translate('Takeer order ref', 'Ref ya order ya Takeer')}: ${order?.public_id || translate('Not provided', 'Haijatolewa')}`,
        `${translate('Customer', 'Mteja')}: ${buyerName}`,
        `${translate('Customer phone', 'Namba ya mteja')}: ${buyerPhone}`,
        `${translate('Package', 'Kifurushi')}: ${packageTitle}`,
        `${translate('Quantity', 'Idadi')}: ${qty}`,
        '',
        `${translate('Warehouse address:', 'Anwani ya ghala:')}`,
        address,
        '',
        `${translate('Instruction: Please write the Takeer shipment ref on the parcel or attach this label before handoff.', 'Maelekezo: Andika ref ya shipment ya Takeer kwenye kifurushi au ambatisha label hii kabla ya kukabidhi.')}`,
    ].join('\n');
}

function printForwarderShippingLabel(order, translate = (english) => english) {
    const text = forwarderShippingLabelText(order, translate);
    const ref = forwarderShipmentRef(order);
    const lines = text.split('\n').map((line) => `<div>${escapeHtml(line) || '&nbsp;'}</div>`).join('');
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=720,height=840');

    if (!popup) {
        toast.error(translate('Browser blocked the print window. Copy the label instead.', 'Browser imezuia dirisha la kuchapisha. Nakili label badala yake.'));
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
                    <div class="title">${escapeHtml(translate('Takeer Forwarder Drop-off', 'Takeer kupeleka kwa forwarder'))}</div>
                    <div class="ref">${escapeHtml(ref)}</div>
                    <div class="body">${lines}</div>
                    <div class="footer">${escapeHtml(translate('Attach to package or show to domestic courier/warehouse receiver.', 'Ambatisha kwenye kifurushi au onyesha kwa courier wa ndani/mpokeaji wa ghala.'))}</div>
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
    const { copy } = useLocale();
    if (!order?.delivery?.physical_address) return null;

    const ref = forwarderShipmentRef(order);
    const labelText = forwarderShippingLabelText(order, copy);

    const copyLabel = async () => {
        try {
            await navigator.clipboard.writeText(labelText);
            toast.success(copy('Shipping label copied.', 'Label ya usafirishaji imenakiliwa.'));
        } catch (error) {
            toast.error(copy('Could not copy the label.', 'Imeshindwa kunakili label.'));
        }
    };

    return (
        <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">{copy('Shipping label', 'Label ya usafirishaji')}</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{copy('Takeer ref:', 'Ref ya Takeer:')} {ref}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-sky-900">
                        {copy('Print or copy this label so the warehouse can identify the parcel when it arrives.', 'Chapisha au nakili label hii ili ghala litambue kifurushi kinapowasili.')}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={copyLabel} className="h-10 rounded-xl border-sky-200 bg-white text-xs font-black text-sky-700">
                        <Copy className="mr-2 h-4 w-4" />
                        {copy('Copy Label', 'Nakili label')}
                    </Button>
                    <Button type="button" onClick={() => printForwarderShippingLabel(order, copy)} className="h-10 rounded-xl text-xs font-black">
                        <Printer className="mr-2 h-4 w-4" />
                        {copy('Print Label', 'Chapisha label')}
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
    const { copy } = useLocale();
    const { can } = useMerchantPermissions(merchantUsername);
    const canDispatch = can('orders.dispatch');
    const canUpdateOrder = can('orders.update');
    const canVerifyPickup = can('orders.verify_pickup');
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [busCompany, setBusCompany] = useState('');
    const [waybillTrackingNumber, setWaybillTrackingNumber] = useState('');
    const [bodaPhone, setBodaPhone] = useState(''); // Keep variable name but update label below

    // PIN Verification State
    const [pickupPinInput, setPickupPinInput] = useState('');
    const [releasePinInput, setReleasePinInput] = useState('');
    const [pinVerifying, setPinVerifying] = useState(false);

    // Inquiry Quote State
    const [shippingFeeInput, setShippingFeeInput] = useState('');
    const [quoteUnitPriceInput, setQuoteUnitPriceInput] = useState('');
    const [quoteDepositPercent, setQuoteDepositPercent] = useState('');
    const [quoteProductionDays, setQuoteProductionDays] = useState('');
    const [quoteBalanceDue, setQuoteBalanceDue] = useState('before_delivery');
    const [quoteInspectionRequired, setQuoteInspectionRequired] = useState(true);
    const [quotePaymentTermsNote, setQuotePaymentTermsNote] = useState('');
    const [quoteCustomizationNote, setQuoteCustomizationNote] = useState('');
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
    const [pickupNoShowSubmitting, setPickupNoShowSubmitting] = useState(false);
    const [orderImageFailed, setOrderImageFailed] = useState(false);

    useEffect(() => {
        loadOrder();
    }, [merchantUsername, orderId]);

    useEffect(() => {
        setOrderImageFailed(false);
    }, [order?.variant?.swatch_image_url, order?.product?.image_url, order?.display_image]);

    useEffect(() => {
        if (order?.shipping_fee !== null && order?.shipping_fee !== undefined) {
            setShippingFeeInput(String(order.shipping_fee));
        }
        if (order?.unit_price !== null && order?.unit_price !== undefined) {
            setQuoteUnitPriceInput(String(order.unit_price));
        }
        const agreement = order?.agreement_snapshot || {};
        setQuoteDepositPercent(agreement.deposit_percent !== null && agreement.deposit_percent !== undefined ? String(agreement.deposit_percent) : '');
        setQuoteProductionDays(agreement.production_lead_time_days !== null && agreement.production_lead_time_days !== undefined ? String(agreement.production_lead_time_days) : '');
        setQuoteBalanceDue(agreement.balance_due || 'before_delivery');
        setQuoteInspectionRequired(agreement.inspection_required !== false);
        setQuotePaymentTermsNote(agreement.payment_terms_note || '');
        setQuoteCustomizationNote(agreement.customization_note || '');
    }, [order?.shipping_fee, order?.unit_price, order?.agreement_snapshot]);

    useEffect(() => {
        const options = availableDeliveryStatusOptions(order?.delivery, copy);
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
            toast.error(error?.response?.data?.message || copy('Could not load order details.', 'Imeshindwa kupakia maelezo ya order.'));
        } finally {
            setLoading(false);
        }
    }

    const kind = typeMeta(order?.display_kind, copy);
    const status = statusMeta(order?.payment_status, copy);
    const paymentState = paymentOverview(order, copy);
    const currencyCode = order?.merchant_currency_code || order?.merchant?.currency?.code || 'TZS';
    const extraChargeLines = useMemo(() => (
        Array.isArray(order?.extra_charges)
            ? order.extra_charges.filter((charge) => !['removed', 'rejected', 'cancelled'].includes(charge.status))
            : []
    ), [order?.extra_charges]);
    const extraChargeTotal = Number(order?.additional_paid_total || 0);
    const paymentBreakdownLines = useMemo(() => {
        const lines = [
            {
                key: 'package',
                label: copy('Package cost', 'Gharama ya kifurushi'),
                description: order?.display_title || order?.product?.title || copy('Main order package', 'Kifurushi kikuu cha order'),
                amount: Number(order?.total_paid || 0),
                status: order?.payment_status,
            },
        ];

        if (extraChargeLines.length > 0) {
            extraChargeLines.forEach((charge) => {
                lines.push({
                    key: charge.id || charge.public_id,
                    label: copy('Extra charge', 'Gharama ya ziada'),
                    description: charge.description || charge.title || copy('Extra charge agreed in chat', 'Gharama ya ziada iliyokubaliwa kwenye chat'),
                    amount: Number(charge.amount || 0),
                    currency: charge.currency_code,
                    status: charge.status,
                });
            });
        } else if (extraChargeTotal > 0) {
            lines.push({
                key: 'extra-charges-total',
                label: copy('Extra charges', 'Gharama za ziada'),
                description: copy('Extra charges agreed in chat', 'Gharama za ziada zilizokubaliwa kwenye chat'),
                amount: extraChargeTotal,
                status: 'paid_held',
            });
        }

        return lines;
    }, [extraChargeLines, extraChargeTotal, order?.display_title, order?.payment_status, order?.product?.title, order?.total_paid, copy]);
    const KindIcon = kind.icon;

    const flowCopy = useMemo(() => {
        if (!order) return '';
        if (order.order_flow === 'fulfillment') {
            if (['pending_fulfillment', 'release_eligible', 'disputed'].includes(order.payment_status)) {
                return copy('PSP confirmed payment; payout follows fulfilment evidence.', 'PSP imethibitisha malipo; payout itafuata baada ya ushahidi wa utimilishaji.');
            }
            if (order.payment_status === 'paid_out') {
                return copy('PSP confirmed seller payout after the order was completed.', 'PSP imethibitisha payout ya muuzaji baada ya order kukamilika.');
            }
            return copy('This order is still being fulfilled.', 'Utimilishaji wa order hii bado unaendelea.');
        }
        return copy('This is an instant-flow order: payment is settled immediately.', 'Hii ni order ya instant flow: malipo huwekwa settled mara moja.');
    }, [order, copy]);

    const merchantConfirmed = Boolean(order?.is_merchant_confirmed || order?.merchant_confirmed_at);
    const isForwarderOrder = (order?.delivery?.delivery_type || order?.delivery?.type) === 'forwarder';
    const deliveryType = order?.delivery?.delivery_type || order?.delivery?.type || '';
    const hasDeliveryFeeWorkflow = deliveryType && deliveryType !== 'self_pickup';
    const buyerRequestedPickupSlot = order?.pickup_policy_snapshot?.buyer_requested_slot || null;
    const pickupDeadlineAt = order?.pickup_deadline_at ? new Date(order.pickup_deadline_at) : null;
    const pickupGraceEndsAt = order?.pickup_grace_ends_at ? new Date(order.pickup_grace_ends_at) : null;
    const pickupDeadlinePassed = pickupDeadlineAt && !Number.isNaN(pickupDeadlineAt.valueOf()) && pickupDeadlineAt.getTime() <= Date.now();
    const canMarkPickupNoShow = canUpdateOrder
        && deliveryType === 'self_pickup'
        && pickupDeadlinePassed
        && !order?.pickup_completed_at
        && !order?.pickup_no_show_marked_at
        && !['paid_out', 'refunded'].includes(order?.payment_status);
    const isPackingStatus = deliveryStatusInput === 'packing';
    const needsTransportEvidence = ['intercity_bus', 'forwarder'].includes(deliveryType)
        && ['with_boda', 'in_transit', 'ready_at_terminal'].includes(deliveryStatusInput);
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
        ? `${copy('Delivery route:', 'Njia ya delivery:')} ${closestLocation?.name ? `${closestLocation.name} ${copy('to', 'hadi')} ` : ''}${order?.delivery?.physical_address || copy('customer location', 'eneo la mteja')} ${routeUrl}`
        : '';
    const canEditShipping = canUpdateOrder
        && order?.is_inquiry
        && order?.payment_status === 'pending'
        && order?.delivery?.delivery_type !== 'self_pickup';
    const isB2BOrder = order?.product?.type === 'physical'
        && ['wholesale', 'both'].includes(order?.product?.selling_style || order?.agreement_snapshot?.selling_style || '');
    const canEditQuoteTerms = canUpdateOrder
        && order?.is_inquiry
        && order?.payment_status === 'pending'
        && (canEditShipping || isB2BOrder);
    const isWaitingForShippingFee = canEditShipping && order?.shipping_fee === null;
    const statusOptions = availableDeliveryStatusOptions(order?.delivery, copy);
    const deliveryEvents = Array.isArray(order?.delivery?.events) ? order.delivery.events : [];
    const isForwarderHandoffComplete = isForwarderOrder
        && deliveryCurrentIndex(order?.delivery || {}) >= deliveryStepsFor('forwarder').length - 1;
    const canUpdateDeliveryStatus = !!order
        && deliveryType !== 'self_pickup'
        && (canDispatch || canUpdateOrder)
        && ['pending_fulfillment', 'release_eligible', 'payout_processing', 'disputed'].includes(order.payment_status);
    const canConfirmPaidPickup = canUpdateOrder
        && order?.product?.type === 'physical'
        && order?.payment_status === 'pending_fulfillment'
        && deliveryType === 'self_pickup'
        && !merchantConfirmed;
    const canConfirmUnpaidPickup = canUpdateOrder
        && order?.product?.type === 'physical'
        && order?.is_inquiry
        && order?.payment_status === 'pending'
        && order?.inquiry_status === 'quoted'
        && deliveryType === 'self_pickup'
        && !merchantConfirmed;
    const isSubscriptionOrder = order?.purchasable_type === 'subscription_plan';
    const isCustomDigitalDelivery = order?.product?.type === 'digital'
        && order?.product?.digital_delivery_type === 'custom_delivery';
    const returnRequest = order?.return_request || null;

    async function submitDeliveryStatus(e) {
        e.preventDefault();
        if (!canUpdateDeliveryStatus || deliveryStatusSubmitting) return;

        const formData = new FormData();
        formData.append('status', deliveryStatusInput);
        if (deliveryStatusNote.trim()) {
            formData.append('note', deliveryStatusNote.trim());
        }
        deliveryStatusProofs.forEach((file) => formData.append('proofs[]', file));
        if (needsTransportEvidence) {
            if (deliveryCourierReceipt) formData.append('courier_receipt', deliveryCourierReceipt);
            if (busCompany.trim()) formData.append('bus_company', busCompany.trim());
            if (waybillTrackingNumber.trim()) formData.append('waybill_tracking_number', waybillTrackingNumber.trim());
            if (trackingLink.trim()) formData.append('tracking_link', trackingLink.trim());
            if (isForwarderOrder) formData.append('forwarder_evidence_type', forwarderEvidenceType);
        }
        if (order?.delivery?.delivery_type === 'local_boda' && bodaPhone.trim()) {
            formData.append('boda_phone', bodaPhone.trim());
        }

        setDeliveryStatusSubmitting(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/orders/${orderId}/delivery-status`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toast.success(copy('Delivery status saved.', 'Hali ya delivery imehifadhiwa.'));
            setDeliveryStatusNote('');
            setDeliveryStatusProofs([]);
            setDeliveryCourierReceipt(null);
            setTrackingLink('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not save delivery status.', 'Imeshindwa kuhifadhi hali ya delivery.'));
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
                toast.error(copy('You can add up to 10 media files for one status.', 'Unaweza kuweka hadi media 10 kwa hali moja.'));
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
                toast.success(copy('Rider link generated and copied.', 'Rider link imetengenezwa na kunakiliwa.'));
            } else {
                toast.success(copy('Rider link generated.', 'Rider link imetengenezwa.'));
            }
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not generate rider link.', 'Imeshindwa kutengeneza rider link.'));
        } finally {
            setRiderLinkGenerating(false);
        }
    }

    async function copyRiderLink() {
        if (!riderLink) return;
        try {
            await navigator.clipboard.writeText(riderLink);
            toast.success(copy('Rider link copied.', 'Rider link imenakiliwa.'));
        } catch (error) {
            toast.error(copy('Could not copy rider link.', 'Imeshindwa kunakili rider link.'));
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
            toast.success(copy('Custom delivery uploaded.', 'Custom delivery imepakiwa.'));
            setCustomDeliveryFile(null);
            setCustomDeliveryMessage('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not upload custom delivery.', 'Imeshindwa kupakia custom delivery.'));
        } finally {
            setCustomDeliverySubmitting(false);
        }
    }

    async function submitReturnAction(action) {
        if (!canUpdateOrder || !order?.return_request || returnSubmitting) return;
        if (action === 'reject' && !returnNote.trim()) {
            toast.error(copy('Enter a reason for rejecting the return request.', 'Andika sababu ya kukataa ombi la kurudisha.'));
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
            toast.success(copy('Return request updated.', 'Ombi la kurudisha limesasishwa.'));
            setReturnNote('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not update the return request.', 'Imeshindikana kusasisha ombi la kurudisha.'));
        } finally {
            setReturnSubmitting(false);
        }
    }

    async function submitQuote(e) {
        e.preventDefault();
        if (!canUpdateOrder) return;
        if (quoteSubmitting) return;
        if (!isB2BOrder && !shippingFeeInput) return;
        if (isB2BOrder && !quoteUnitPriceInput) {
            toast.error(copy('Enter the proforma unit price.', 'Weka unit price ya proforma.'));
            return;
        }

        setQuoteSubmitting(true);
        try {
            await axios.post(`/api/merchant/orders/${orderId}/quote`, {
                unit_price: quoteUnitPriceInput || undefined,
                shipping_fee: shippingFeeInput || 0,
                deposit_percent: quoteDepositPercent || undefined,
                balance_due: quoteBalanceDue,
                production_lead_time_days: quoteProductionDays || undefined,
                inspection_required: quoteInspectionRequired,
                payment_terms_note: quotePaymentTermsNote || undefined,
                customization_note: quoteCustomizationNote || undefined,
            });
            toast.success(isB2BOrder ? copy('Proforma terms sent to the buyer.', 'Proforma terms zimetumwa kwa mteja.') : copy('Shipping cost sent to the buyer.', 'Gharama ya usafiri imetumwa kwa mteja.'));
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not send the cost.', 'Imeshindwa kutuma gharama.'));
        } finally {
            setQuoteSubmitting(false);
        }
    }

    async function confirmAvailability() {
        if (!canUpdateOrder || quoteSubmitting) return;

        setQuoteSubmitting(true);
        try {
            await axios.post(`/api/merchant/orders/${orderId}/confirm-availability`);
            toast.success(canConfirmPaidPickup
                ? copy('Pickup confirmed. The PIN is now available to the buyer.', 'Pickup imethibitishwa. PIN sasa inapatikana kwa mteja.')
                : copy('Order confirmed. The buyer can pay now.', 'Order imethibitishwa. Mteja anaweza kulipia sasa.')
            );
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not confirm the order.', 'Imeshindwa kuthibitisha order.'));
        } finally {
            setQuoteSubmitting(false);
        }
    }

    async function copyRouteLink() {
        if (!routeUrl) return;

        try {
            await navigator.clipboard.writeText(routeShareText || routeUrl);
            toast.success(copy('Route link copied.', 'Route link imenakiliwa.'));
        } catch (error) {
            toast.error(copy('Could not copy the route link.', 'Imeshindwa kunakili route link.'));
        }
    }

    async function shareRouteLink() {
        if (!routeUrl) return;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: copy('Delivery route', 'Njia ya delivery'),
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
            toast.success(copy('Pickup confirmed! Payment is now eligible for release.', 'Pickup imethibitishwa! Malipo yameidhinishwa.'));
            setPickupPinInput('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('The PIN is not correct.', 'PIN si sahihi.'));
        } finally {
            setPinVerifying(false);
        }
    }

    async function markPickupNoShow() {
        if (!canMarkPickupNoShow || pickupNoShowSubmitting) return;
        const confirmed = window.confirm(copy('Mark this pickup as buyer no-show? This will be recorded in the order chat.', 'Weka pickup kuwa mteja hakutokea? Hii itaandikwa kwenye chat ya order.'));
        if (!confirmed) return;

        setPickupNoShowSubmitting(true);
        try {
            await axios.post(`/api/merchant/${merchantUsername}/orders/${orderId}/pickup-no-show`, {
                reason: 'Buyer did not collect within the agreed pickup window.',
            });
            toast.success(copy('Pickup marked as buyer no-show.', 'Pickup imewekwa kuwa mteja hakutokea.'));
            await loadOrder();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not mark the pickup as no-show.', 'Imeshindikana kuweka no-show.'));
        } finally {
            setPickupNoShowSubmitting(false);
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
            toast.success(copy('Delivery confirmed! Payment is now eligible for release.', 'Delivery imethibitishwa! Malipo yameidhinishwa.'));
            setReleasePinInput('');
            await loadOrder();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('The PIN is not correct.', 'PIN si sahihi.'));
        } finally {
            setPinVerifying(false);
        }
    }

    const isPos = order?.source === 'pos';
    const displayId = isPos ? `#POS-${order.public_id}` : `#${order?.transaction_ref || orderId}`;
    const orderImage = order?.variant?.swatch_image_url || order?.product?.image_url || order?.display_image;
    const displayOrderImage = orderImage && !orderImageFailed;
    const productDetailUrl = order?.product?.id ? `/merchant/${merchantUsername}/products/${order.product.id}` : null;
    const mediaFallback = fallbackMediaMeta(order);
    const MediaFallbackIcon = mediaFallback.Icon;

    return (
        <AppLayout>
            <Head title={`${copy('Order', 'Order')} ${displayId} | ${merchantName || copy('Business', 'Biashara')} | Takeer`} />

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
                            <h1 className="text-2xl font-black tracking-tight">{copy('Order Details', 'Maelezo ya order')}</h1>
                            <p className="text-sm text-muted-foreground">{displayId} • {merchantName || copy('Business', 'Biashara')}</p>
                        </div>
                    </div>
                    {!loading && order && !isSubscriptionOrder && (
                        <Button
                            className="rounded-xl font-bold"
                            onClick={() => router.visit(`/chat/${order?.public_id}?acting_as=merchant`)}
                            disabled={!order?.public_id}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            {copy('Open Chat', 'Fungua chat')}
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
                            {copy('Order details were not found.', 'Maelezo ya order hayakupatikana.')}
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card className="rounded-2xl overflow-hidden">
                            <CardContent className="p-5 md:p-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-4">
                                    <div className={cn(
                                        "relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border md:h-28 md:w-28",
                                        displayOrderImage ? "bg-accent text-muted-foreground" : mediaFallback.className
                                    )}>
                                        {displayOrderImage ? (
                                            productDetailUrl ? (
                                                <button
                                                    type="button"
                                                    className="group h-full w-full cursor-pointer"
                                                    onClick={() => router.visit(productDetailUrl)}
                                                    aria-label={`${copy('Open product details for', 'Fungua maelezo ya bidhaa ya')} ${order.display_title || copy('order item', 'bidhaa ya order')}`}
                                                >
                                                    <img src={orderImage} alt={order.display_title || copy('Order item', 'Bidhaa ya order')} onError={() => setOrderImageFailed(true)} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                                                    <span className="absolute bottom-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                    </span>
                                                </button>
                                            ) : (
                                                <img src={orderImage} alt={order.display_title || copy('Order item', 'Bidhaa ya order')} onError={() => setOrderImageFailed(true)} className="h-full w-full object-cover" />
                                            )
                                        ) : (
                                            <>
                                                <MediaFallbackIcon className="h-10 w-10 opacity-90" />
                                                {productDetailUrl && (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.visit(productDetailUrl)}
                                                        aria-label={`${copy('Open product details for', 'Fungua maelezo ya bidhaa ya')} ${order.display_title || copy('order item', 'bidhaa ya order')}`}
                                                        className="absolute bottom-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-brand-600 hover:text-white"
                                                    >
                                                        <LinkIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
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
                                        <h2 className="text-xl md:text-2xl font-black mt-3 break-words">{order.display_title || copy('Order item', 'Bidhaa ya order')}</h2>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-3xl md:text-4xl font-black text-brand-600 shrink-0 sm:text-right">
                                    {formatMoney(order.order_total_with_additions ?? order.total_paid ?? 0, currencyCode)}
                                </p>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <UserRound className="h-4 w-4 text-brand-600" />
                                        {copy('Customer Details', 'Maelezo ya mteja')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    {isPos ? (
                                        <>
                                            <p><span className="text-muted-foreground">{copy('Name (POS):', 'Jina (POS):')}</span> <span className="font-semibold">{order.customer_name || copy('Anonymous', 'Mteja asiyejulikana')}</span></p>
                                            <p><span className="text-muted-foreground">{copy('Phone:', 'Namba:')}</span> <span className="font-semibold">{order.customer_phone || copy('N/A', 'Haipo')}</span></p>
                                        </>
                                    ) : (
                                        <>
                                            <p><span className="text-muted-foreground">{copy('Name:', 'Jina:')}</span> <span className="font-semibold">{order.buyer?.name || copy('N/A', 'Haipo')}</span></p>
                                            <p><span className="text-muted-foreground">{copy('Phone:', 'Namba:')}</span> <span className="font-semibold">{order.buyer?.phone_number || copy('N/A', 'Haipo')}</span></p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="rounded-2xl">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ReceiptText className="h-4 w-4 text-brand-600" />
                                        {copy('Payment Details', 'Maelezo ya malipo')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <p><span className="text-muted-foreground">{copy('Order Ref:', 'Ref ya order:')}</span> <span className="font-semibold">{isPos ? `#POS-${order.public_id}` : (order.transaction_ref || `#${order.id}`)}</span></p>
                                    <p><span className="text-muted-foreground">{copy('Quantity:', 'Kiasi:')}</span> <span className="font-semibold">{orderQuantityLabel(order)}</span></p>
                                    <p><span className="text-muted-foreground">{copy('Unit price:', 'Bei moja:')}</span> <span className="font-semibold">{orderUnitPriceLabel(order)}</span></p>
                                    <p><span className="text-muted-foreground">{copy('Total:', 'Jumla:')}</span> <span className="font-semibold">{formatMoney(order.order_total_with_additions ?? order.total_paid ?? 0, currencyCode)}</span></p>
                                    {Number(order.additional_paid_total || 0) > 0 && (
                                        <p><span className="text-muted-foreground">{copy('Extra charges:', 'Gharama za ziada:')}</span> <span className="font-semibold">{formatMoney(order.additional_paid_total || 0, currencyCode)}</span></p>
                                    )}
                                    {extraChargeLines.length > 0 && (
                                        <div className="space-y-1 pt-1">
                                            {extraChargeLines.map((charge) => (
                                                <p key={charge.id || charge.public_id} className="flex items-start justify-between gap-3 text-xs">
                                                    <span className="text-muted-foreground break-words">{charge.description || charge.title || copy('Extra charge', 'Gharama ya ziada')}</span>
                                                    <span className="shrink-0 font-black text-slate-950">{formatMoney(charge.amount || 0, charge.currency_code || currencyCode)}</span>
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    <p><span className="text-muted-foreground">{copy('Payment phone:', 'Namba ya malipo:')}</span> <span className="font-semibold">{maskPhone(order.payment_phone)}</span></p>
                                    <p><span className="text-muted-foreground">{copy('Account phone:', 'Namba ya akaunti:')}</span> <span className="font-semibold">{maskPhone(order.account_phone)}</span></p>
                                </CardContent>
                            </Card>

                            {order.offering_group_selection?.lines?.length > 0 && (
                                <Card className="rounded-2xl md:col-span-2 border-teal-100 bg-teal-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-teal-700" />
                                            {copy('Offering Selection', 'Uchaguzi wa ofa')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-xl bg-white p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{copy('Offering', 'Ofa')}</p>
                                                <p className="mt-1 font-black text-slate-950">{order.offering_group_selection?.group?.title || order.display_title}</p>
                                            </div>
                                            <div className="rounded-xl bg-white p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{copy('Lines', 'Mistari')}</p>
                                                <p className="mt-1 font-black text-slate-950">{order.offering_group_selection.lines.length}</p>
                                            </div>
                                            <div className="rounded-xl bg-white p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{copy('Subtotal', 'Jumla ndogo')}</p>
                                                <p className="mt-1 font-black text-slate-950">{formatMoney(order.offering_group_selection?.subtotal || 0, currencyCode)}</p>
                                            </div>
                                        </div>
                                        <OfferingGroupLines lines={order.offering_group_selection.lines} currency={currencyCode} translate={copy} />
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="rounded-2xl md:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-brand-600" />
                                        {copy('Fulfilment Workflow', 'Mchakato wa utimilishaji')}
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
                                            <p><span className="text-muted-foreground">{deliveryType === 'self_pickup' ? copy('Fulfilment Method:', 'Njia ya utimilishaji:') : copy('Delivery Method:', 'Njia ya delivery:')}</span> <span className="font-semibold uppercase text-brand-700">{deliveryMethodLabel(order.delivery, copy)}</span></p>
                                            <p><span className="text-muted-foreground">{deliveryType === 'self_pickup' ? copy('Pickup status:', 'Hali ya kuchukua:') : copy('Delivery status:', 'Hali ya delivery:')}</span> <span className="font-semibold">{deliveryStatusLabel(order.delivery, copy)}</span></p>
                                            {deliveryType === 'self_pickup' && buyerRequestedPickupSlot?.start_at && buyerRequestedPickupSlot?.end_at && (
                                                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">{copy('Buyer-selected time', 'Muda aliochagua mteja')}</p>
                                                    <p className="mt-1 text-sm font-black text-brand-950">
                                                        {formatDateTime(buyerRequestedPickupSlot.start_at)} - {formatDateTime(buyerRequestedPickupSlot.end_at)}
                                                    </p>
                                                </div>
                                            )}
                                            {(canConfirmUnpaidPickup || canConfirmPaidPickup) && (
                                                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{copy('Waiting for your confirmation', 'Inasubiri uthibitisho wako')}</p>
                                                            <p className="mt-1 text-sm font-bold leading-6 text-emerald-950">
                                                                {canConfirmPaidPickup
                                                                    ? copy('Buyer has paid. Confirm stock/capacity before the pickup PIN is shown.', 'Mteja amelipa. Thibitisha stock/uwezo wa kutimiza kabla pickup PIN haijaonekana.')
                                                                    : copy('Confirm stock/capacity so the buyer can pay.', 'Thibitisha stock/uwezo wa kutimiza order ili mteja aweze kulipia.')}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            onClick={confirmAvailability}
                                                            disabled={quoteSubmitting || !canUpdateOrder}
                                                            className="h-11 rounded-xl bg-emerald-600 px-5 font-black uppercase tracking-widest hover:bg-emerald-700"
                                                        >
                                                            {quoteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                            {canConfirmPaidPickup ? copy('CONFIRM PICKUP READY', 'THIBITISHA PICKUP IPO') : copy('CONFIRM ORDER READY', 'THIBITISHA ORDER IPO')}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            {order.delivery.physical_address && (
                                                <div>
                                                    <span className="text-muted-foreground">{isForwarderOrder ? copy('Forwarder warehouse:', 'Ghala la forwarder:') : copy('Customer address:', 'Anwani ya mteja:')}</span>
                                                    <p className="mt-1 whitespace-pre-line font-semibold leading-6">{order.delivery.physical_address}</p>
                                                </div>
                                            )}
                                            {isForwarderOrder && !order.is_inquiry && <ForwarderShippingLabelTools order={order} />}
                                            {order.delivery.delivery_type === 'intercity_bus' && order.delivery.shipping_zone && (
                                                <p><span className="text-muted-foreground">{copy('Inter-city destination:', 'Unakoenda mkoani:')}</span> <span className="font-semibold">{order.delivery.shipping_zone.destination_city || order.delivery.shipping_zone.zone_name || order.delivery.shipping_zone.destination_region}</span></p>
                                            )}
                                            {order.delivery.bus_company && <p><span className="text-muted-foreground">{copy('Bus company:', 'Kampuni ya basi:')}</span> <span className="font-semibold">{order.delivery.bus_company}</span></p>}
                                            {order.delivery.waybill_tracking_number && <p><span className="text-muted-foreground">{copy('Waybill tracking:', 'Ufuatiliaji wa waybill:')}</span> <span className="font-semibold">{order.delivery.waybill_tracking_number}</span></p>}
                                            {order.delivery.boda_phone && <p><span className="text-muted-foreground">{copy('Delivery phone:', 'Namba ya delivery:')}</span> <span className="font-semibold">{order.delivery.boda_phone}</span></p>}
                                            {order.delivery.delivery_type !== 'self_pickup' && order.delivery.buyer_release_pin && (
                                                <p><span className="text-muted-foreground">{copy('Expected PIN from buyer:', 'PIN inayotarajiwa kutoka kwa mteja:')}</span> <span className="font-mono font-bold text-brand-600 ml-1">{copy('Needed for payout', 'Inahitajika kwa payout')}</span></p>
                                            )}
                                            {order.delivery.delivery_type !== 'self_pickup' && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <DeliveryDirectionsButton routeUrl={routeUrl} />
                                                    {order.delivery.boda_phone && (
                                                        <a href={`tel:${order.delivery.boda_phone}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-100 bg-white px-4 text-xs font-black uppercase tracking-widest text-sky-700">
                                                            {copy('Delivery phone', 'Namba ya delivery')}
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            {canUpdateDeliveryStatus && order.delivery.delivery_type !== 'self_pickup' && !isForwarderOrder && (
                                                <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">{copy('Temporary rider link', 'Kiungo cha muda cha rider')}</p>
                                                            <p className="mt-1 text-xs font-semibold text-sky-900">
                                                                {copy('Let a boda/rider update package status and upload proof without merchant login.', 'Mruhusu boda/rider kusasisha hali ya mzigo na kupakia ushahidi bila kuingia kama merchant.')}
                                                            </p>
                                                            {order.delivery.rider_access_active && !riderLink && (
                                                                <p className="mt-2 text-[11px] font-bold text-sky-700">
                                                                    {copy('Existing link active until', 'Kiungo kilichopo kinafanya kazi hadi')} {order.delivery.rider_access_expires_at ? new Date(order.delivery.rider_access_expires_at).toLocaleString() : copy('expiry', 'kuisha')}. {copy('Regenerate if you need to copy it again.', 'Tengeneza tena ikiwa unahitaji kukinakili.')}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Button type="button" variant="outline" onClick={generateRiderLink} disabled={riderLinkGenerating} className="h-11 rounded-xl border-sky-200 bg-white font-bold text-sky-700 hover:bg-sky-50">
                                                            {riderLinkGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                                                            {copy('Generate link', 'Tengeneza kiungo')}
                                                        </Button>
                                                    </div>
                                                    {riderLink && (
                                                        <div className="mt-3 rounded-xl border border-sky-100 bg-white p-3">
                                                            <p className="break-all text-xs font-bold text-slate-700">{riderLink}</p>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <Button type="button" size="sm" onClick={copyRiderLink} className="rounded-lg font-bold">
                                                                    <Copy className="mr-2 h-3.5 w-3.5" />
                                                                    {copy('Copy', 'Nakili')}
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
                                                                    {copy('Expires', 'Inaisha')} {new Date(riderLinkExpiresAt).toLocaleString()}.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!order.delivery && (
                                        <p className="text-muted-foreground">{copy('No delivery information for this order.', 'Hakuna taarifa za delivery kwa order hii.')}</p>
                                    )}
                                </CardContent>
                            </Card>

                            {order.is_inquiry && hasDeliveryFeeWorkflow && (
                                <Card className="rounded-2xl md:col-span-2 border-brand-200 bg-brand-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-brand-600" />
                                            {isForwarderOrder ? copy('Forwarder drop-off quote', 'Nukuu ya kupeleka kwa forwarder') : copy('Shipping quote inquiry', 'Inquiry ya gharama ya usafiri')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="bg-white/60 p-4 rounded-xl border border-brand-100/50">
                                            <p className="text-xs font-black uppercase tracking-widest text-brand-700/80 mb-2">{isForwarderOrder ? copy('Forwarder warehouse:', 'Ghala la forwarder:') : copy('Customer address:', 'Anwani ya mteja:')}</p>
                                            <p className="font-bold text-brand-900 mb-2 whitespace-pre-line leading-6">{order.delivery?.physical_address || copy('Address not provided', 'Anwani haikuwekwa')}</p>
                                            {!isForwarderOrder && closestLocation && (
                                                <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/70 p-3">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-brand-600 shadow-sm">
                                                                <Store className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">{copy('Nearest shop', 'Duka lililo karibu')}</p>
                                                                <p className="text-sm font-black text-brand-950">{closestLocation.name}</p>
                                                                <p className="text-xs font-bold text-brand-800">{closestLocation.distance.toFixed(1)} {copy('km from customer', 'km kutoka kwa mteja')}</p>
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
                                                                    <MapPin className="h-3 w-3" /> {copy('ROUTE', 'NJIA')}
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
                                                                    {copy('SHARE', 'GAWANA')}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {isForwarderOrder && (
                                                <>
                                                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                                                        {copy('Forwarder drop-off uses domestic courier, cargo, or warehouse drop-off proof. Add courier tracking or waybill evidence after payment.', 'Kupeleka kwa forwarder hutumia ushahidi wa courier wa ndani, cargo, au ghala. Ongeza ufuatiliaji wa courier au waybill baada ya malipo.')}
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
                                                    <MapPin className="h-3 w-3" /> {copy('OPEN IN MAP', 'FUNGUA KWENYE RAMANI')}
                                                </a>
                                            )}
                                        </div>

                                        {canEditQuoteTerms ? (
                                            <form onSubmit={submitQuote} className={`rounded-xl border bg-white/80 p-4 transition-colors ${isWaitingForShippingFee ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-100'}`}>
                                                {isB2BOrder && (
                                                    <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">{copy('Wholesale proforma', 'Proforma ya jumla')}</p>
                                                        <p className="mt-1 text-xs font-semibold leading-5 text-emerald-900">
                                                            {copy('Buyer payment must go through the configured licensed PSP. Use these terms for deposit, production, delivery, and payout/dispute decisions.', 'Malipo ya mteja lazima yapitie PSP mwenye leseni aliyesanidiwa. Tumia masharti haya kwa amana, uzalishaji, delivery, na maamuzi ya payout/mgogoro.')}
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                    {isB2BOrder && (
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block ml-1">
                                                                {copy('Unit price', 'Bei ya unit')} ({currencyCode})
                                                            </label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                placeholder={copy('E.g. 25000', 'Mf. 25000')}
                                                                value={quoteUnitPriceInput}
                                                                onChange={e => setQuoteUnitPriceInput(e.target.value)}
                                                                className="font-bold rounded-xl h-11"
                                                                required
                                                            />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block ml-1">
                                                            {order.shipping_fee !== null && order.shipping_fee !== undefined ? `${copy('Update shipping fee', 'Sasisha gharama ya usafiri')} (${currencyCode})` : `${copy('Enter shipping fee', 'Weka gharama ya usafiri')} (${currencyCode})`}
                                                        </label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            placeholder={copy('E.g. 5000', 'Mf. 5000')}
                                                            value={shippingFeeInput}
                                                            onChange={e => setShippingFeeInput(e.target.value)}
                                                            className={`font-bold rounded-xl h-11 ${isWaitingForShippingFee ? 'border-red-400 bg-red-50/40 focus-visible:ring-red-200' : ''}`}
                                                            required={!isB2BOrder}
                                                        />
                                                    </div>
                                                    {isB2BOrder && (
                                                        <>
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block ml-1">{copy('Deposit %', 'Amana %')}</label>
                                                                <Input type="number" min="0" max="100" placeholder="30" value={quoteDepositPercent} onChange={e => setQuoteDepositPercent(e.target.value)} className="font-bold rounded-xl h-11" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block ml-1">{copy('Production days', 'Siku za uzalishaji')}</label>
                                                                <Input type="number" min="0" placeholder="14" value={quoteProductionDays} onChange={e => setQuoteProductionDays(e.target.value)} className="font-bold rounded-xl h-11" />
                                                            </div>
                                                            <div className="sm:col-span-2">
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 block ml-1">{copy('Balance due', 'Salio la kulipa')}</label>
                                                                <select value={quoteBalanceDue} onChange={(e) => setQuoteBalanceDue(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold">
                                                                    <option value="before_production">{copy('Before production', 'Kabla ya uzalishaji')}</option>
                                                                    <option value="before_delivery">{copy('Before delivery', 'Kabla ya delivery')}</option>
                                                                    <option value="on_delivery_confirmation">{copy('After buyer confirms delivery', 'Baada ya mteja kuthibitisha delivery')}</option>
                                                                    <option value="manual">{copy('Manual agreement', 'Makubaliano ya mkono')}</option>
                                                                </select>
                                                            </div>
                                                            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                                                                <input type="checkbox" checked={quoteInspectionRequired} onChange={(e) => setQuoteInspectionRequired(e.target.checked)} />
                                                                {copy('Inspection required before release', 'Ukaguzi unahitajika kabla ya kutoa')}
                                                            </label>
                                                        </>
                                                    )}
                                                    <div className="flex items-end">
                                                        <Button
                                                            type="submit"
                                                            className="h-11 w-full rounded-xl px-8 bg-brand-600 hover:bg-brand-700 font-bold"
                                                            disabled={quoteSubmitting || (!isB2BOrder && shippingFeeInput === '') || (isB2BOrder && quoteUnitPriceInput === '')}
                                                        >
                                                            {quoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                            {isB2BOrder ? copy('SEND PROFORMA', 'TUMA PROFORMA') : (order.shipping_fee !== null && order.shipping_fee !== undefined ? copy('UPDATE COST', 'SASISHA GHARAMA') : copy('SEND COST', 'TUMA GHARAMA'))}
                                                        </Button>
                                                    </div>
                                                </div>
                                                {isB2BOrder && (
                                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                        <Input value={quotePaymentTermsNote} onChange={(e) => setQuotePaymentTermsNote(e.target.value)} placeholder={copy('Payment terms note, e.g. 30% deposit, 70% before dispatch', 'Maelezo ya masharti ya malipo, mf. deposit 30%, 70% kabla ya kutuma')} className="h-11 rounded-xl" />
                                                        <Input value={quoteCustomizationNote} onChange={(e) => setQuoteCustomizationNote(e.target.value)} placeholder={copy('Customization or packaging note', 'Maelezo ya customization au packaging')} className="h-11 rounded-xl" />
                                                    </div>
                                                )}
                                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{copy('Current shipping', 'Usafiri wa sasa')}</p>
                                                        <p className="text-sm font-black text-slate-950">{formatMoney(order.shipping_fee || 0, currencyCode)}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{copy('Items total', 'Jumla ya items')}</p>
                                                        <p className="text-sm font-black text-slate-950">{formatMoney((order.total_paid || 0) - (order.shipping_fee || 0), currencyCode)}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{copy('Customer total', 'Jumla ya mteja')}</p>
                                                        <p className="text-sm font-black text-brand-700">{formatMoney(order.order_total_with_additions ?? order.total_paid ?? 0, currencyCode)}</p>
                                                    </div>
                                                </div>
                                            </form>
                                        ) : order.inquiry_status === 'pending' && !canUpdateOrder ? (
                                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-600">
                                                {copy('Shipping quote is pending. You have view-only access for this order.', 'Nukuu ya usafiri inasubiri. Una ruhusa ya kuangalia tu order hii.')}
                                            </div>
                                        ) : order.inquiry_status === 'quoted' && !merchantConfirmed ? (
                                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-amber-700 mb-1">{copy('Waiting for your confirmation:', 'Inasubiri uthibitisho wako:')}</p>
                                                    <p className="text-sm font-bold text-amber-900">{copy('The cost is ready. Confirm stock/capacity so the buyer can pay.', 'Gharama ipo tayari. Thibitisha stock/uwezo wa kutimiza order ili mteja aweze kulipia.')}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    onClick={confirmAvailability}
                                                    disabled={quoteSubmitting || !canUpdateOrder}
                                                    className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                                                >
                                                    {quoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                    {copy('CONFIRM', 'THIBITISHA')}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-green-700 mb-1">{copy('Your quoted cost:', 'Gharama uliyoweka:')}</p>
                                                    <p className="text-lg font-black text-green-600">{formatMoney(order.shipping_fee || 0, currencyCode)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-green-700 mb-1">{copy('Inquiry status:', 'Hali ya inquiry:')}</p>
                                                    <span className="text-xs font-bold bg-green-200/50 text-green-800 px-3 py-1 rounded-full uppercase tracking-widest">{copy('Quoted', 'Imenukuliwa')}</span>
                                                </div>
                                            </div>
                                        )}
                                        {hasDeliveryFeeWorkflow && (
                                            <p className="text-[11px] text-muted-foreground italic font-medium">
                                                {copy('Before the buyer pays, you can update the shipping cost based on boda agreement or urgent changes. After payment, the cost is locked.', 'Kabla ya mteja kulipa, unaweza kusasisha gharama ya usafiri kulingana na makubaliano ya boda au mabadiliko ya haraka. Baada ya malipo, gharama inafungwa.')}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            <Card className="rounded-2xl md:col-span-2 overflow-hidden border-slate-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <ReceiptText className="h-4 w-4 text-brand-600" />
                                        {copy('Payment Status', 'Hali ya malipo')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-5">
                                    <div className={`rounded-[1.75rem] border p-5 ${paymentState.tone}`}>
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{copy('Payment state', 'Hali ya malipo')}</p>
                                                <h3 className="mt-1 text-2xl font-black">{paymentState.label}</h3>
                                                <p className="mt-1 max-w-2xl text-sm font-semibold opacity-80">{paymentState.body}</p>
                                            </div>
                                            <div className="grid min-w-full gap-2 sm:grid-cols-3 md:min-w-[420px]">
                                                <div className="rounded-2xl bg-white/75 px-4 py-3">
                                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">{copy('Total', 'Jumla')}</p>
                                                    <p className="mt-1 text-lg font-black text-slate-950">{formatMoney(paymentState.total, currencyCode)}</p>
                                                </div>
                                                <div className="rounded-2xl bg-white/75 px-4 py-3">
                                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">{copy('Paid', 'Imelipwa')}</p>
                                                    <p className="mt-1 text-lg font-black text-emerald-700">{formatMoney(paymentState.paid, currencyCode)}</p>
                                                </div>
                                                <div className="rounded-2xl bg-white/75 px-4 py-3">
                                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60">{copy('Left', 'Iliyobaki')}</p>
                                                    <p className="mt-1 text-lg font-black text-amber-700">{formatMoney(paymentState.left, currencyCode)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {extraChargeTotal > 0 && (
                                            <div className="mt-4 border-t border-current/10 pt-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{copy('Payment breakdown', 'Mgawanyo wa malipo')}</p>
                                                        <p className="mt-1 text-sm font-semibold opacity-80">{copy('Package cost plus any extra charges agreed in chat.', 'Gharama ya kifurushi pamoja na gharama za ziada zilizokubaliwa kwenye chat.')}</p>
                                                    </div>
                                                    <p className="text-lg font-black">{formatMoney(paymentState.total, currencyCode)}</p>
                                                </div>
                                                <div className="mt-3 divide-y divide-current/10 overflow-hidden rounded-2xl bg-white/60">
                                                    {paymentBreakdownLines.map((line) => (
                                                        <div key={line.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black text-slate-950 break-words">{line.description}</p>
                                                                <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest opacity-60">
                                                                    {line.label} · {extraChargeStatusLabel(line.status, order?.payment_status, copy)}
                                                                </p>
                                                            </div>
                                                            <p className="shrink-0 text-sm font-black text-slate-950">{formatMoney(line.amount || 0, line.currency || currencyCode)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {isCustomDigitalDelivery && canDispatch && (
                                <Card className="rounded-2xl md:col-span-2 border-indigo-200 bg-indigo-50/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <FileUp className="h-4 w-4 text-indigo-600" />
                                            {copy('Custom Digital Delivery', 'Delivery ya kidijitali maalum')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-5 space-y-4">
                                        {order.custom_delivery?.delivered_at ? (
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm font-black text-emerald-800">
                                                        {order.custom_delivery.status === 'revision_requested'
                                                            ? copy('Revision requested', 'Marekebisho yameombwa')
                                                            : order.custom_delivery.status === 'accepted'
                                                                ? copy('Accepted by buyer', 'Yamekubaliwa na mteja')
                                                                : copy('Delivered', 'Yamewasilishwa')}
                                                    </p>
                                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                        {order.custom_delivery.status || copy('delivered', 'imewasilishwa')}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs font-semibold text-emerald-700">
                                                    {order.custom_delivery.file_name || copy('Final file', 'Faili ya mwisho')} · {order.custom_delivery.delivered_at ? new Date(order.custom_delivery.delivered_at).toLocaleString() : ''}
                                                </p>
                                                {order.custom_delivery.message && (
                                                    <p className="mt-2 text-sm text-emerald-900 whitespace-pre-line">{order.custom_delivery.message}</p>
                                                )}
                                                {order.custom_delivery.revision_message && (
                                                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">{copy('Buyer revision note', 'Ujumbe wa marekebisho wa mteja')}</p>
                                                        <p className="mt-1 text-sm text-amber-950 whitespace-pre-line">{order.custom_delivery.revision_message}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                                                {copy('Buyer has paid. Upload the finished file when the custom work is ready.', 'Mteja amelipa. Pakia faili iliyokamilika kazi maalum ikiwa tayari.')}
                                            </div>
                                        )}

                                        <form onSubmit={submitCustomDelivery} className="space-y-3">
                                            <label className="rounded-xl border border-input bg-background p-3 text-sm block">
                                                <span className="mb-2 inline-flex items-center gap-2 font-semibold">
                                                    <FileUp className="h-4 w-4 text-indigo-600" />
                                                    {copy('Final delivery file', 'Faili ya mwisho ya delivery')}
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
                                                placeholder={copy('Optional delivery note, instructions, revision note, or usage guidance...', 'Ujumbe wa delivery, maelekezo, marekebisho, au mwongozo wa matumizi (hiari)...')}
                                                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                                            />
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs text-muted-foreground">
                                                    {copy('Uploading a new file replaces the previous final delivery for this order.', 'Kupakia faili mpya kunabadilisha delivery ya mwisho ya awali ya order hii.')}
                                                </p>
                                                <Button type="submit" className="rounded-xl font-bold" disabled={!customDeliveryFile || customDeliverySubmitting}>
                                                    {customDeliverySubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
                                                    {copy('Upload delivery', 'Pakia delivery')}
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            )}

                            {canVerifyPickup && order.delivery?.delivery_type === 'self_pickup' && ['pending_fulfillment', 'release_eligible'].includes(order.payment_status) && merchantConfirmed && order.pickup_status === 'ready_for_pickup' && (
                                <Card className="rounded-[2rem] md:col-span-2 overflow-hidden border-brand-100 bg-white shadow-xl shadow-brand-100/40">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-brand-600" />
                                            {copy('Verification: Customer Pickup (Self Delivery)', 'Uthibitisho: Mteja anachukua (self delivery)')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-xl shadow-brand-600/25">
                                                <Store className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black tracking-tight text-slate-950">{copy('Confirm customer pickup', 'Thibitisha mteja amechukua')}</h3>
                                                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                                                    {copy('When the customer arrives, ask for the Pickup PIN from their chat. After you verify it, the order becomes release-eligible and the PSP payout request follows provider rules.', 'Mteja akifika, omba Pickup PIN aliyopewa kwenye chat yake. Ukithibitisha PIN, order itakuwa release-eligible na PSP payout itaombwa kulingana na provider rules.')}
                                                </p>
                                            </div>
                                            {order.pickup_deadline_at && (
                                                <div className="w-full rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-left">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">{copy('Pickup agreement', 'Makubaliano ya kuchukua')}</p>
                                                    <p className="mt-1 text-sm font-black text-amber-950">
                                                        {copy('Collect before', 'Chukua kabla ya')} {formatDateTime(order.pickup_deadline_at)}
                                                    </p>
                                                    {order.pickup_policy_snapshot?.instructions && (
                                                        <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-5 text-slate-600">
                                                            {order.pickup_policy_snapshot.instructions}
                                                        </p>
                                                    )}
                                                    {canMarkPickupNoShow && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={markPickupNoShow}
                                                            disabled={pickupNoShowSubmitting}
                                                            className="mt-3 h-10 rounded-xl border-amber-200 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-amber-800 hover:bg-amber-100"
                                                        >
                                                            {pickupNoShowSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleAlert className="mr-2 h-4 w-4" />}
                                                            {copy('Mark buyer no-show', 'Weka mteja hakutokea')}
                                                        </Button>
                                                    )}
                                                    {order.pickup_no_show_marked_at && (
                                                        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-amber-800">
                                                            {copy('No-show marked', 'Mteja hakutokea')} {formatDateTime(order.pickup_no_show_marked_at)}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
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
                                                    {copy('Confirm pickup', 'Thibitisha kuchukua')}
                                                </Button>
                                            </form>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {canUpdateDeliveryStatus && hasDeliveryFeeWorkflow && order.delivery && (
                                <Card className="rounded-2xl md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <RefreshCcw className="h-4 w-4 text-brand-600" />
                                            {copy('Delivery Status Update', 'Sasisho la hali ya delivery')}
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
                                                        <p className="text-sm font-black uppercase tracking-wider text-amber-900">{copy('Handoff submitted for verification', 'Makabidhiano yametumwa kwa uthibitisho')}</p>
                                                        <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
                                                            {copy('The seller has submitted forwarder handoff proof. The provider payout request waits until the buyer confirms, the verification window passes, or Takeer reviews the evidence.', 'Muuzaji ametuma ushahidi wa makabidhiano kwa forwarder. Ombi la payout linasubiri hadi mteja athibitishe, muda wa uthibitisho upite, au Takeer ipitie ushahidi.')}
                                                        </p>
                                                        {order.payment_status === 'paid_out' ? (
                                                            <p className="mt-2 text-xs font-black uppercase tracking-widest text-emerald-700">{copy('PSP payout confirmed', 'PSP imethibitisha payout')}</p>
                                                        ) : (
                                                            <p className="mt-2 text-xs font-black uppercase tracking-widest text-amber-700">{copy('Payout waits for verification or operations review', 'Payout inasubiri uthibitisho au ukaguzi wa operations')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <form onSubmit={submitDeliveryStatus} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                        {copy('Delivery status', 'Hali ya delivery')}
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
                                                        {isPackingStatus ? copy('Packing proof photo/video', 'Picha/video ya ushahidi wa kufunga') : copy('Proof photo/video', 'Picha/video ya ushahidi')}
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
                                                                {copy('Tap to add photos/videos', 'Gusa kuongeza picha/video')}
                                                            </span>
                                                            <span className="mt-1 text-[11px] font-bold normal-case tracking-normal text-muted-foreground">
                                                                {copy('Or drop files here. Up to 10 media files.', 'Au dondosha faili hapa. Hadi faili 10 za media.')}
                                                            </span>
                                                        </label>
                                                        {deliveryStatusProofs.length > 0 && (
                                                            <div className="mt-2 grid min-w-0 gap-2 normal-case tracking-normal">
                                                                {deliveryStatusProofs.map((file, index) => (
                                                                    <div key={`${file.name}-${file.size}-${index}`} className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="truncate text-xs font-black text-slate-900">{file.name}</p>
                                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                                {(file.size / 1024 / 1024).toFixed(1)} MB · {file.type?.startsWith('video/') ? copy('Video', 'Video') : copy('Photo', 'Picha')}
                                                                            </p>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeDeliveryStatusProof(index)}
                                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600"
                                                                            aria-label={`${copy('Remove', 'Ondoa')} ${file.name}`}
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
                                                            {copy('Delivery phone', 'Namba ya delivery')}
                                                            <input
                                                                value={bodaPhone}
                                                                onChange={(e) => setBodaPhone(e.target.value)}
                                                                placeholder={order.delivery.boda_phone || '+2557...'}
                                                                className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                            />
                                                        </label>
                                                    )}
                                                    {needsTransportEvidence && (
                                                        <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                                                            {isForwarderOrder && (
                                                                <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground md:col-span-2">
                                                                    {copy('Evidence type', 'Aina ya ushahidi')}
                                                                    <select
                                                                        value={forwarderEvidenceType}
                                                                        onChange={(e) => setForwarderEvidenceType(e.target.value)}
                                                                        className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                                    >
                                                                        <option value="tracked_courier">{copy('Tracked courier (DHL/FedEx/UPS/SF etc.)', 'Courier anayefuatiliwa (DHL/FedEx/UPS/SF n.k.)')}</option>
                                                                        <option value="manual_forwarder">{copy('Manual forwarder / cargo / bus receipt', 'Forwarder / cargo / risiti ya basi ya mkono')}</option>
                                                                        <option value="takeer_verified_forwarder">{copy('Takeer verified forwarder', 'Forwarder aliyethibitishwa na Takeer')}</option>
                                                                    </select>
                                                                </label>
                                                            )}
                                                            <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                                {copy('Transport receipt / waybill', 'Risiti ya usafiri / waybill')}
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
                                                                {isForwarderOrder ? copy('Carrier / forwarder', 'Carrier / forwarder') : copy('Bus / cargo company', 'Kampuni ya basi / cargo')}
                                                                <input
                                                                    value={busCompany}
                                                                    onChange={(e) => setBusCompany(e.target.value)}
                                                                    placeholder={isForwarderOrder ? 'Mf. DHL / Silent Ocean / local cargo' : 'Mf. Tashriff / BM Coach / cargo'}
                                                                    className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                                />
                                                            </label>
                                                            <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                                {copy('Receipt / waybill / tracking # (optional)', 'Risiti / waybill / namba ya ufuatiliaji (hiari)')}
                                                                <input
                                                                    value={waybillTrackingNumber}
                                                                    onChange={(e) => setWaybillTrackingNumber(e.target.value)}
                                                                    placeholder={copy('Reference, waybill, or tracking number', 'Rejeo, waybill, au namba ya ufuatiliaji')}
                                                                    className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-950"
                                                                />
                                                            </label>
                                                            <label className="rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                                                {copy('Tracking link (optional)', 'Kiungo cha ufuatiliaji (hiari)')}
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
                                                        {copy('Note', 'Ujumbe')}
                                                        <textarea
                                                            value={deliveryStatusNote}
                                                            onChange={(e) => setDeliveryStatusNote(e.target.value)}
                                                            placeholder={isPackingStatus ? 'Mf. Package packed and sealed, ready for pickup.' : (isForwarderOrder ? 'Mf. Package dispatched to forwarder warehouse with courier proof.' : 'Mf. Package handed to rider, waiting for customer PIN.')}
                                                            className="mt-2 min-h-[84px] w-full rounded-xl border border-input bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-950"
                                                        />
                                                    </label>
                                                </div>
                                                <div className="mt-3 flex items-center justify-between gap-3">
                                                    <p className="text-xs text-muted-foreground">{copy('Delivery updates stay separate from payment status and build a proof timeline for both sides.', 'Masasisho ya delivery yanabaki tofauti na hali ya malipo na huunda timeline ya ushahidi kwa pande zote.')}</p>
                                                    <Button type="submit" className="rounded-xl font-bold" disabled={deliveryStatusSubmitting}>
                                                        {deliveryStatusSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                        {copy('Save status', 'Hifadhi hali')}
                                                    </Button>
                                                </div>
                                            </form>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {canVerifyPickup && order.payment_status === 'release_eligible' && ['local_boda', 'intercity_bus'].includes(order.delivery?.delivery_type) && (
                                <Card className="rounded-2xl md:col-span-2">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-brand-600" />
                                            {copy('Verification & Delivery Info', 'Uthibitisho na taarifa za delivery')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {order.delivery?.delivery_type === 'local_boda' && (
                                            <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-[2rem] border border-brand-100 bg-white p-6 text-center shadow-xl shadow-brand-100/40">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-xl shadow-brand-600/25">
                                                    <Truck className="h-8 w-8" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">{copy('Delivery verification', 'Uthibitisho wa delivery')}</p>
                                                    <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{copy('Confirm customer handoff', 'Thibitisha makabidhiano kwa mteja')}</h3>
                                                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                                                        {copy('After the rider hands over the package, the buyer should inspect it and give the rider the Release PIN. Enter the PIN here to authorize payment.', 'Baada ya dereva kumkabidhi mteja mzigo, mteja akague kwanza kisha ampe dereva Release PIN. Ingiza PIN hapa ili kuidhinisha malipo.')}
                                                    </p>
                                                </div>
                                                <form onSubmit={verifyDeliveryPin} className="w-full space-y-3">
                                                    <Input
                                                        inputMode="numeric"
                                                        placeholder="0000"
                                                        value={releasePinInput}
                                                        onChange={e => setReleasePinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                        maxLength={4}
                                                        className="mx-auto h-20 max-w-60 rounded-3xl border-2 border-brand-100 bg-brand-50/50 text-center text-3xl font-black tracking-[0.35em] text-brand-900 shadow-inner focus:border-brand-400"
                                                    />
                                                    <Button type="submit" disabled={pinVerifying || releasePinInput.length !== 4} className="mx-auto h-14 w-full max-w-80 rounded-2xl bg-brand-600 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-brand-600/25 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400">
                                                        {pinVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                                        {copy('Confirm delivery', 'Thibitisha delivery')}
                                                    </Button>
                                                </form>
                                            </div>
                                        )}

                                        {order.delivery?.delivery_type === 'intercity_bus' && (
                                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                                <p className="text-sm font-bold text-indigo-900">{copy('In transit (intercity)', 'Inasafirishwa (mkoani)')}</p>
                                                <p className="text-sm mt-1">{copy('The destination and intercity price are stored on the order. The actual pickup/drop-off office is confirmed on the waybill/receipt or by phone from the transporter. Once the buyer receives the package and everything is correct, they confirm in the app.', 'Destination na bei ya mkoa vimehifadhiwa kwenye order. Pickup/drop-off office halisi itathibitishwa kwenye waybill/risiti au simu kutoka transporter. Mteja akichukua mzigo na kila kitu kiko sawa, atathibitisha kwenye App.')}</p>
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
                                            {copy('Customer Review', 'Mapitio ya mteja')}
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
                                            {copy('Unboxing Video (Customer)', 'Video ya kufungua mzigo (mteja)')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between bg-white/60 p-4 rounded-xl border border-indigo-100">
                                            <p className="text-sm font-bold text-indigo-900">{copy('Proof of receipt', 'Ushahidi wa kupokea')}</p>
                                            <a
                                                href={order.delivery.buyer_unboxing_video_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 hover:underline bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                                            >
                                                <Play className="h-3 w-3" /> {copy('WATCH VIDEO', 'TAZAMA VIDEO')}
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
                                                    {copy('Return request', 'Ombi la kurudisha')}
                                                </p>
                                                <p className="mt-1 text-sky-800/90"><span className="font-semibold">{copy('Status:', 'Hali:')}</span> {orderStatusLabel(returnRequest.status, copy)}</p>
                                                <p className="mt-1 text-sky-800/90"><span className="font-semibold">{copy('Customer reason:', 'Sababu ya mteja:')}</span> {returnRequest.reason || copy('N/A', 'Haipo')}</p>
                                                {returnRequest.policy_snapshot?.window_ends_at && (
                                                    <p className="mt-1 text-sky-800/90"><span className="font-semibold">{copy('Policy window:', 'Muda wa sera:')}</span> {copy('ends', 'unaisha')} {new Date(returnRequest.policy_snapshot.window_ends_at).toLocaleDateString()}</p>
                                                )}
                                                {returnRequest.evidence_url && (
                                                    <a href={returnRequest.evidence_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-black uppercase tracking-widest text-sky-700 underline">
                                                        {copy('View evidence', 'Tazama ushahidi')}
                                                    </a>
                                                )}
                                            </div>
                                            {canUpdateOrder && !['completed', 'escalated'].includes(returnRequest.status) && (
                                                <div className="w-full space-y-2 md:max-w-sm">
                                                    <textarea
                                                        value={returnNote}
                                                        onChange={(e) => setReturnNote(e.target.value)}
                                                        rows={3}
                                                        placeholder={copy('Message to customer: return instructions, rejection reason, or resolution note...', 'Ujumbe kwa mteja: maelekezo ya kurudisha, sababu ya kukataa, au maelezo ya suluhisho...')}
                                                        className="w-full rounded-2xl border border-sky-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/20"
                                                    />
                                                    {['approved', 'item_received'].includes(returnRequest.status) && (
                                                        <select
                                                            value={returnResolution}
                                                            onChange={(e) => setReturnResolution(e.target.value)}
                                                            className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold"
                                                        >
                                                            <option value="replacement">{copy('Replacement sent', 'Bidhaa mbadala imetumwa')}</option>
                                                            <option value="refund">{copy('Refund buyer', 'Mrejesho kwa mteja')}</option>
                                                            <option value="store_credit">{copy('Store credit', 'Salio la duka')}</option>
                                                            <option value="other">{copy('Other resolution', 'Suluhisho jingine')}</option>
                                                        </select>
                                                    )}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {returnRequest.status === 'pending_merchant_review' && (
                                                            <>
                                                                <Button type="button" className="rounded-xl bg-sky-700 text-white hover:bg-sky-800" disabled={returnSubmitting} onClick={() => submitReturnAction('approve')}>
                                                                    {copy('Approve', 'Kubali')}
                                                                </Button>
                                                                <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-700" disabled={returnSubmitting} onClick={() => submitReturnAction('reject')}>
                                                                    {copy('Reject', 'Kataa')}
                                                                </Button>
                                                            </>
                                                        )}
                                                        {returnRequest.status === 'approved' && (
                                                            <Button type="button" className="col-span-2 rounded-xl bg-sky-700 text-white hover:bg-sky-800" disabled={returnSubmitting} onClick={() => submitReturnAction('received')}>
                                                                {copy('Mark item received', 'Weka item imepokelewa')}
                                                            </Button>
                                                        )}
                                                        {['approved', 'item_received'].includes(returnRequest.status) && (
                                                            <Button type="button" variant="outline" className="col-span-2 rounded-xl border-emerald-200 text-emerald-700" disabled={returnSubmitting} onClick={() => submitReturnAction('complete')}>
                                                                {copy('Complete return', 'Kamilisha kurudisha')}
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
                                            {copy('Order is disputed', 'Order ina mgogoro')}
                                        </p>
                                        <p className="mt-1 text-red-700/90"><span className="font-semibold">{copy('Status:', 'Hali:')}</span> {orderStatusLabel(order.dispute.status, copy)}</p>
                                        <p className="mt-1 text-red-700/90"><span className="font-semibold">{copy('Reason:', 'Sababu:')}</span> {order.dispute.reason || copy('N/A', 'Haipo')}</p>
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
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-700">{copy('Share route', 'Gawana njia')}</p>
                                <h3 className="mt-1 text-xl font-black text-slate-950">{copy('Delivery Route', 'Njia ya delivery')}</h3>
                                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                    {closestLocation?.name || copy('Shop', 'Duka')} {copy('to', 'hadi')} {order?.delivery?.physical_address || copy('customer location', 'eneo la mteja')}
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
                            {copy('A boda rider with a smartphone can scan this QR to open the route in Google Maps.', 'Boda mwenye smartphone anaweza kuscan hii QR kufungua route Google Maps.')}
                        </p>

                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <Button type="button" onClick={shareRouteLink} className="h-11 rounded-xl bg-brand-600 font-black">
                                <Share2 className="h-4 w-4 mr-2" />
                                {copy('Share', 'Gawana')}
                            </Button>
                            <Button type="button" variant="outline" onClick={copyRouteLink} className="h-11 rounded-xl font-black">
                                <Copy className="h-4 w-4 mr-2" />
                                {copy('Copy', 'Nakili')}
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
                            {copy('Open Google Maps', 'Fungua Google Maps')}
                        </a>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
