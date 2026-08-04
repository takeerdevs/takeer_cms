import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { AlertTriangle, MapPin, Send, Image as ImageIcon, Camera, ShieldCheck, Loader2, Workflow, ShoppingBag, Tag, Truck, AlertCircle, CircleAlert, Star, X, CheckCircle2, Info, CreditCard, History, ArrowLeft, Video, Search, Plus, Minus, Navigation, Zap, Clock, Store, ChevronRight, ChevronDown, Save, Lock, DownloadCloud, ExternalLink, UserRound, FileDown, Wrench, Sparkles, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerTrigger,
    DrawerClose
} from '@/Components/ui/Drawer';
import { cn } from '@/lib/utils';
import ShopLocationsModal from '@/Components/ShopLocationsModal';
import AddressPickerModal from '@/Components/AddressPickerModal';
import { DeliveryFlowTimeline, DeliveryDirectionsButton, deliveryCurrentIndex, deliveryStatusText, deliveryStatusTextSw, deliveryStepsFor } from '@/Components/DeliveryFlowTimeline';
import { orderPackageCount, orderQuantityLabel, orderUnitPriceLabel } from '@/lib/productUnits';
import { useLocale } from '@/lib/i18n';

const MediaDisplay = ({ url, className, mode = 'cover' }) => {
    const { copy } = useLocale();
    if (!url) return null;
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i) || url.includes('/video/') || url.includes('type=video');

    if (isVideo) {
        return (
            <div className={cn("relative overflow-hidden bg-slate-900 group", className)}>
                <video src={url} className={mode === 'natural' ? "h-auto max-h-80 w-full object-contain" : "w-full h-full object-cover"} controls />
            </div>
        );
    }

    return (
        <div className={cn("relative overflow-hidden bg-slate-100 group cursor-pointer", className)} onClick={() => window.open(url, '_blank')}>
            <img
                src={url}
                className={cn(
                    "w-full transition-transform group-hover:scale-105",
                    mode === 'natural' ? "h-auto max-h-80 object-contain" : "h-full object-cover"
                )}
                alt={copy('Chat attachment', 'Kiambatisho cha chat')}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
    );
};

const isDefaultMediaBody = (body) => ['Picha/Video ya Bidhaa', 'Picha/Video ya Uthibitisho'].includes(String(body || '').trim());

const sanitizeChatBody = (body, copy = (english) => english) => String(body || '')
    .replace(/Pickup PIN ya mteja ni:\s*\d+\.?\s*/gi, '')
    .replace(/Mteja atalipa basi atakapokuja na PIN hii kukuchukulia bidhaa\.?/gi, copy('The buyer pays online; after payment, enter the PIN they show you in the order chat to confirm pickup.', 'Mteja atalipia mtandaoni; baada ya malipo, ingiza PIN atakayokuonyesha kwenye order chat ili kuthibitisha pickup.'))
    .replace(/Mteja akija tumie POS kuingiza pin atakayokutajia na tutaangalia kama inafanana na hii automatic, huhitaji kuikariri\.?/gi, copy('When the buyer arrives, enter the PIN they show you in the order chat or order details to confirm pickup.', 'Mteja akifika, ingiza PIN atakayokuonyesha kwenye order chat au order details ili kuthibitisha pickup.'));

const roleAwareSystemBody = (message, role, order, copy = (english) => english) => {
    const payloadBody = role === 'buyer' ? message?.payload?.buyer_body : message?.payload?.merchant_body;
    if (payloadBody) return payloadBody;

    const body = String(message?.body || '');
    if (role !== 'buyer') return body;

    if (body.includes('mapendekezo ya usafirishaji') || body.includes('thibitisha gharama ya usafiri kwa mteja')) {
        const title = order?.product?.title || order?.display_title || copy('your order', 'order yako');
        return copy(
            `Hello, your order has been started for: ${title}.\nWe checked your location and found a shipping estimate. Wait for the merchant to review the cost and confirm the order before paying.`,
            `Habari, order yako imeanzishwa kwa ajili ya: ${title}.\nTumeangalia eneo lako na kupata makadirio ya usafiri. Subiri muuzaji ahakiki gharama na kuthibitisha kuwa order ipo kabla ya kulipa.`,
        );
    }

    if (body.includes('Mteja amechagua KUCHUKUA DUKANI')) {
        const title = order?.product?.title || order?.display_title || copy('your order', 'order yako');
        return copy(
            `Hello, your order has been started for: ${title}.\nYou selected SELF-PICKUP. Wait for the merchant to confirm the order is available; then you can pay.`,
            `Habari, order yako imeanzishwa kwa ajili ya: ${title}.\nUmechagua KUCHUKUA DUKANI. Subiri muuzaji athibitishe kuwa order ipo; baada ya hapo utaweza kulipia.`,
        );
    }

    return body;
};

const deliveryEventFromMessage = (message) => {
    if (message?.type !== 'action' || message?.payload?.action_type !== 'delivery_status_update') {
        return null;
    }

    return {
        id: message.payload?.delivery_event_id || `chat-${message.id}`,
        status: message.payload?.status,
        note: message.payload?.note,
        proof_url: message.payload?.proof_url || message.media_url,
        proof_type: message.payload?.proof_type,
        metadata: message.payload?.metadata || {},
        actor_type: message.payload?.actor_type,
        created_at: message.created_at,
    };
};

const mergeDeliveryMessageIntoOrder = (order, message) => {
    const event = deliveryEventFromMessage(message);
    if (!event?.status || !order?.delivery) return order;

    const events = Array.isArray(order.delivery.events) ? order.delivery.events : [];
    const signature = `${event.status}|${event.created_at || ''}|${event.note || ''}|${event.proof_url || ''}`;
    const exists = events.some((existing) => {
        const existingSignature = `${existing.status}|${existing.created_at || ''}|${existing.note || ''}|${existing.proof_url || ''}`;
        return String(existing.id) === String(event.id) || existingSignature === signature;
    });

    if (exists) return order;

    const currentIndex = deliveryCurrentIndex(order.delivery);
    const eventIndex = deliveryStepsFor(order.delivery.delivery_type || order.delivery.type).findIndex((step) => step.value === event.status);
    const shouldAdvanceStatus = eventIndex >= 0 && eventIndex >= currentIndex;

    return {
        ...order,
        delivery: {
            ...order.delivery,
            status: shouldAdvanceStatus ? event.status : order.delivery.status,
            delivery_status: shouldAdvanceStatus ? event.status : order.delivery.delivery_status,
            events: [...events, event],
        },
    };
};

const ChatRoleAvatar = ({ role, className }) => {
    const { copy } = useLocale();
    const isMerchant = role === 'merchant';
    const Icon = isMerchant ? Store : UserRound;

    return (
        <div
            className={cn(
                "flex shrink-0 items-center justify-center rounded-full text-white shadow-sm",
                isMerchant ? "bg-brand-600" : "bg-white border border-slate-100 text-slate-600",
                className
            )}
            title={isMerchant ? copy('Merchant', 'Muuzaji') : copy('Customer', 'Mteja')}
            aria-label={isMerchant ? copy('Merchant', 'Muuzaji') : copy('Customer', 'Mteja')}
        >
            <Icon className="h-1/2 w-1/2" strokeWidth={2.6} />
        </div>
    );
};

const PickupPinCard = ({ pickupPin, amount, timestamp, onShopLocations, showShopLocations = true, className }) => {
    const { copy } = useLocale();
    const pinDigits = String(pickupPin || '').padStart(4, '0').split('');

    return (
        <div className={cn("w-full max-w-md overflow-hidden rounded-[2rem] border border-brand-100 bg-white shadow-xl shadow-brand-100/60 dark:border-brand-900/50 dark:bg-slate-900", className)}>
            <div className="bg-brand-50/80 px-5 py-5 text-center dark:bg-brand-950/30">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                    <Lock className="h-6 w-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-500">{copy('Pickup PIN', 'PIN ya kuchukua')}</p>
                <div className="mt-3 flex justify-center gap-2">
                    {pinDigits.map((digit, index) => (
                        <span key={`${digit}-${index}`} className="flex h-14 w-12 items-center justify-center rounded-2xl border border-brand-100 bg-white text-3xl font-black text-brand-900 shadow-sm dark:border-brand-800 dark:bg-slate-950 dark:text-brand-100">
                            {digit}
                        </span>
                    ))}
                </div>
                <p className="mx-auto mt-3 max-w-xs text-[11px] font-bold leading-relaxed text-slate-500">
                    {copy('Show this PIN at the shop to collect your products.', 'Onyesha PIN hii dukani ili kuchukua bidhaa zako.')}
                </p>
            </div>
            <div className="space-y-2 p-4">
                {amount !== undefined && amount !== null && (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy('Payment', 'Malipo')}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">TZS {Number(amount || 0).toLocaleString()}</span>
                    </div>
                )}
                {showShopLocations && (
                    <button
                        type="button"
                        onClick={onShopLocations}
                        className="flex w-full items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3 text-left text-brand-800 transition-colors hover:bg-brand-50 dark:border-brand-900/50 dark:bg-slate-950 dark:text-brand-100 dark:hover:bg-brand-950/40"
                    >
                        <span className="flex min-w-0 items-center gap-3">
                            <Store className="h-5 w-5 shrink-0 text-brand-600" />
                            <span className="text-xs font-black uppercase tracking-widest">{copy('Shop locations', 'Maeneo ya duka')}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                    </button>
                )}
            </div>
            {timestamp && (
                <div className="border-t border-slate-100 px-4 py-2 text-right text-[9px] font-bold text-slate-300 dark:border-slate-800">
                    {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </div>
    );
};

const ReleasePinCard = ({ releasePin, timestamp, onReportIssue, className }) => {
    const { copy } = useLocale();
    const pinDigits = String(releasePin || '').padStart(4, '0').split('');

    return (
        <div className={cn("w-full max-w-md overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-xl shadow-sky-100/60 dark:border-sky-900/50 dark:bg-slate-900", className)}>
            <div className="bg-sky-50/80 px-5 py-5 text-center dark:bg-sky-950/30">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                    <Truck className="h-6 w-6" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-500">{copy('Delivery PIN', 'PIN ya delivery')}</p>
                <div className="mt-3 flex justify-center gap-2">
                    {pinDigits.map((digit, index) => (
                        <span key={`${digit}-${index}`} className="flex h-14 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-white text-3xl font-black text-brand-900 shadow-sm dark:border-sky-800 dark:bg-slate-950 dark:text-brand-100">
                            {digit}
                        </span>
                    ))}
                </div>
                <p className="mx-auto mt-3 max-w-xs text-[11px] font-bold leading-relaxed text-slate-500">
                    {copy('Inspect the package first. Give this PIN to the rider after confirming it is your order and is safe.', 'Kagua mzigo kwanza. Mpe dereva PIN hii baada ya kuhakikisha ni order yako na iko salama.')}
                </p>
            </div>
            <div className="space-y-2 p-4">
                {onReportIssue && (
                    <button
                        type="button"
                        onClick={onReportIssue}
                        className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-white px-4 py-3 text-left text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-950 dark:hover:bg-red-950/20"
                    >
                        <span className="flex min-w-0 items-center gap-3">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span className="text-xs font-black uppercase tracking-widest">{copy('Report an issue', 'Ripoti tatizo')}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0" />
                    </button>
                )}
            </div>
            {timestamp && (
                <div className="border-t border-slate-100 px-4 py-2 text-right text-[9px] font-bold text-slate-300 dark:border-slate-800">
                    {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </div>
    );
};

const orderItemMeta = (item = {}, order = null, translate = (english) => english) => {
    const type = item.type || item.product_type || item.purchasable_type || (!item.isExtra ? order?.product?.type : null);
    const deliveryType = item.digital_delivery_type || (!item.isExtra ? order?.product?.digital_delivery_type : null);
    const isCustomPhysical = type === 'physical' && deliveryType === 'custom_delivery';

    if (type === 'physical' || isCustomPhysical) {
        return {
            label: translate('Physical fulfillment', 'Utimilishaji wa bidhaa'),
            detail: translate('Pickup/delivery handling required after payment.', 'Utunzaji wa pickup/delivery unahitajika baada ya malipo.'),
            Icon: PackageCheck,
            tone: 'text-amber-700 bg-amber-50 border-amber-100',
        };
    }

    if (type === 'service') {
        return {
            label: translate('Service order', 'Order ya huduma'),
            detail: translate('Shown in Orders; no physical pickup unless the service requires it.', 'Inaonekana kwenye Orders; hakuna pickup ya kushikika isipokuwa huduma inahitaji.'),
            Icon: Wrench,
            tone: 'text-indigo-700 bg-indigo-50 border-indigo-100',
        };
    }

    if (deliveryType === 'custom_delivery') {
        return {
            label: translate('Custom digital work', 'Kazi maalum ya kidijitali'),
            detail: translate('Merchant delivers the final file in Orders.', 'Muuzaji anawasilisha faili ya mwisho kwenye Orders.'),
            Icon: Sparkles,
            tone: 'text-violet-700 bg-violet-50 border-violet-100',
        };
    }

    if (type === 'digital') {
        return {
            label: translate('Digital download', 'Upakuaji wa kidijitali'),
            detail: translate('Access is added to the customer Orders page after payment.', 'Ufikiaji unaongezwa kwenye ukurasa wa Orders wa mteja baada ya malipo.'),
            Icon: FileDown,
            tone: 'text-sky-700 bg-sky-50 border-sky-100',
        };
    }

    if (item.isExtra) {
        return {
            label: translate('Added item', 'Item iliyoongezwa'),
            detail: translate('This item will be handled according to its product type after payment.', 'Item hii itashughulikiwa kulingana na aina yake baada ya malipo.'),
            Icon: ShoppingBag,
            tone: 'text-slate-700 bg-slate-50 border-slate-100',
        };
    }

    return {
        label: translate('Order item', 'Item ya order'),
        detail: translate('Added to this order.', 'Imeongezwa kwenye order hii.'),
        Icon: ShoppingBag,
        tone: 'text-slate-700 bg-slate-50 border-slate-100',
    };
};

const isPhysicalDealItem = (item = {}, order = null) => {
    const type = item.type || item.product_type || (!item.isExtra ? order?.product?.type : null);

    if (type) return type === 'physical';
    if (item.isExtra === false) return Boolean(order?.requires_physical_fulfillment);

    return false;
};

const dealItemQuantityState = (item = {}, order = null) => {
    const quantityValue = Number(item.isMain ? orderPackageCount(order) : (item.quantity ?? 1));
    const quantityStep = 1;

    return {
        quantityValue,
        quantityStep,
        canDecrease: quantityValue > quantityStep,
        decreaseQuantity: Math.max(quantityStep, quantityValue - quantityStep),
        increaseQuantity: quantityValue + quantityStep,
    };
};

const flattenOfferingGroupLines = (lines = []) => {
    if (!Array.isArray(lines)) return [];

    return lines.flatMap((line) => [
        line,
        ...flattenOfferingGroupLines(line.child_lines || []),
    ]);
};

const offeringGroupOrderItems = (order) => {
    const lines = flattenOfferingGroupLines(order?.offering_group_selection?.lines || []);

    return lines.map((line, index) => {
        const quantity = Number(line.quantity || 1);
        const addOns = Array.isArray(line.selected_add_ons) ? line.selected_add_ons : [];

        return {
            key: `offering-${line.group_item_id || line.item_id || index}`,
            id: line.item_id,
            variant_id: line.selected_variant_id,
            title: line.title || 'Offering item',
            image: line.image_url,
            quantity,
            quantityLabel: `${quantity.toLocaleString()} x ${line.title || 'Offering item'}`,
            price: Number(line.line_total || 0),
            unit_price: Number(line.unit_price || 0),
            section: line.section || 'Main',
            role: line.role || 'optional',
            addOns,
            addOnsTotal: Number(line.add_ons_unit_total || 0) * quantity,
            type: line.product_type || line.item_type,
            product_type: line.product_type || line.item_type,
            isMain: index === 0,
            isExtra: index > 0,
            isOfferingLine: true,
        };
    });
};

function OrderSelectionSummaryCard({ items = [], subtotal = 0, shipping = 0, discount = 0, total = 0, title = 'Your selection' }) {
    const { copy } = useLocale();
    return (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-700">
                    <ShoppingBag className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{title}</p>
                    <p className="text-lg font-black leading-tight text-slate-950">
                        {items.length} {copy(items.length === 1 ? 'item selected' : 'items selected', items.length === 1 ? 'item imechaguliwa' : 'item zimechaguliwa')}
                    </p>
                </div>
            </div>

            <div className="mt-5 space-y-2">
                {items.map((item) => (
                    <div key={item.key} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="break-words text-base font-black leading-tight text-slate-700">
                                    {Number(item.quantity || 1).toLocaleString()} x {item.title || copy('Order item', 'Bidhaa ya oda')}
                                </p>
                                {Array.isArray(item.addOns) && item.addOns.length > 0 && (
                                    <p className="mt-1 text-sm font-bold leading-snug text-slate-500">
                                        {copy('Add-ons:', 'Viongezi:')} {item.addOns.map((addOn) => addOn.name).join(', ')}
                                    </p>
                                )}
                            </div>
                            <p className="shrink-0 text-base font-black text-slate-950">
                                TZS {Number(item.price || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-500">{copy('Subtotal', 'Jumla ndogo')}</span>
                    <span className="text-base font-black text-slate-950">TZS {Number(subtotal || 0).toLocaleString()}</span>
                </div>
                {Number(shipping) > 0 && (
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-black text-slate-500">
                            <Truck className="h-4 w-4 text-emerald-500" />
                            {copy('Shipping', 'Usafirishaji')}
                        </span>
                        <span className="text-base font-black text-emerald-600">+ TZS {Number(shipping).toLocaleString()}</span>
                    </div>
                )}
                {Number(discount) > 0 && (
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-black text-slate-500">
                            <Tag className="h-4 w-4 text-amber-500" />
                            {copy('Discount', 'Punguzo')}
                        </span>
                        <span className="text-base font-black text-amber-600">- TZS {Number(discount).toLocaleString()}</span>
                    </div>
                )}
                <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-sm font-black text-slate-500">{copy('Total', 'Jumla')}</span>
                    <span className="text-3xl font-black tracking-tight text-slate-950">TZS {Number(total || 0).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

const calculateHaversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const findBestShippingZone = (lat, lng, region, zones) => {
    if (!zones?.length) return null;

    // 1. Try Local based on distance
    const localZones = zones.filter(z => (z.delivery_type === 'local_boda' || z.delivery_type === 'local') && z.location);
    let bestLocalZone = null;
    let minActualDist = Infinity;

    localZones.forEach(zone => {
        const dist = calculateHaversine(lat, lng, Number(zone.location.latitude), Number(zone.location.longitude));
        if (dist <= Number(zone.max_distance_km)) {
            if (dist < minActualDist) {
                minActualDist = dist;
                bestLocalZone = zone;
            }
        }
    });

    if (bestLocalZone) return { zone: bestLocalZone, hotspot: null };

    // 2. Try inter-city by merchant-priced destination/region.
    if (region) {
        const normalizedRegion = String(region || '').trim().toLowerCase();
        const busZone = zones.find(z => {
            if (z.delivery_type !== 'intercity_bus') return false;
            const zoneCity = String(z.destination_city || '').trim().toLowerCase();
            const zoneRegion = String(z.destination_region || '').trim().toLowerCase();
            return zoneCity === normalizedRegion || zoneRegion === normalizedRegion || zoneRegion.includes(normalizedRegion);
        });
        if (busZone) {
            return { zone: busZone, hotspot: null };
        }
    }

    const nearestBusZone = zones
        .filter(z => z.delivery_type === 'intercity_bus' && z.reference_lat && z.reference_lng)
        .map(z => ({
            zone: z,
            hotspot: null,
            distance: calculateHaversine(lat, lng, Number(z.reference_lat), Number(z.reference_lng)),
        }))
        .sort((a, b) => a.distance - b.distance)[0];

    if (nearestBusZone) return nearestBusZone;

    return null;
};

const statusCopy = (order, translate = (english) => english) => {
    if (!order) return { label: translate('In progress', 'Inaendelea'), tone: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (order.payment_status === 'failed') return { label: translate('Failed', 'Imesitishwa'), tone: 'bg-red-50 text-red-700 border-red-100' };
    if (order.payment_status === 'paid_out') return { label: translate('Completed', 'Imekamilika'), tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (order.payment_status === 'disputed') return { label: translate('Disputed', 'Mgogoro'), tone: 'bg-red-50 text-red-700 border-red-100' };
    if (order.payment_status === 'release_eligible') return { label: translate('Ready for PSP payout', 'Tayari kwa PSP payout'), tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
    if (order.payment_status === 'pending_fulfillment') return { label: translate('Paid', 'Imelipwa'), tone: 'bg-sky-50 text-sky-700 border-sky-100' };
    if (order.is_inquiry && order.inquiry_status === 'quoted' && !(order.is_merchant_confirmed || order.merchant_confirmed_at)) return { label: translate('Awaiting approval', 'Inasubiri idhini'), tone: 'bg-amber-50 text-amber-700 border-amber-100' };
    if (order.is_inquiry && order.inquiry_status === 'quoted') return { label: translate('Offer ready', 'Ofa iko tayari'), tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (order.is_inquiry) return { label: translate('Bargaining', 'Majadiliano'), tone: 'bg-amber-50 text-amber-700 border-amber-100' };
    return { label: String(order.payment_status || translate('In progress', 'Inaendelea')).replaceAll('_', ' '), tone: 'bg-slate-100 text-slate-600 border-slate-200' };
};

const deliveryCopy = (order, translate = (english) => english) => {
    const type = order?.delivery?.delivery_type || order?.delivery?.type;
    if (type === 'self_pickup') return translate('Self pickup', 'Kuchukua mwenyewe');
    if (type === 'forwarder') return translate('Forwarder drop-off', 'Kupeleka kwa forwarder');
    if (type === 'local_boda') return translate('Local delivery', 'Delivery ya karibu');
    if (type === 'intercity_bus') return translate('Intercity bus', 'Basi la mkoa');
    if (type === 'shipping') return translate('Local delivery', 'Delivery ya karibu');
    if (isPhysicalOrder(order)) return translate('Physical order', 'Order ya bidhaa');
    if (isDigitalOrder(order)) return digitalAccessCopy(order, translate);
    return translate('Delivery pending', 'Delivery inasubiri');
};

const isDigitalOrder = (order) => {
    const productType = order?.product?.type;
    if (productType === 'physical') return false;
    if (productType === 'service') return false;
    if (order?.delivery?.delivery_type || order?.delivery?.type) return false;

    return productType === 'digital'
        || ['content_item', 'subscription_plan'].includes(order?.purchasable_type)
        || Boolean(order?.product?.digital_delivery_type || order?.product?.download_link);
};

const isPhysicalOrder = (order) => {
    if (!order) return false;
    if (isDigitalOrder(order)) return false;
    if (order?.product?.type === 'service') return false;
    return order?.product?.type === 'physical'
        || Boolean(order?.delivery?.delivery_type || order?.delivery?.type)
        || Boolean(order?.requires_physical_fulfillment);
};

const isServiceOrder = (order) => order?.product?.type === 'service';

const orderIntentMeta = (order, translate = (english) => english) => {
    if (isServiceOrder(order)) {
        return {
            label: translate('Service', 'Huduma'),
            itemLabel: translate('Service', 'Huduma'),
            totalLabel: translate('Service', 'Huduma'),
            Icon: Wrench,
        };
    }

    if (isDigitalOrder(order)) {
        return {
            label: digitalAccessCopy(order, translate),
            itemLabel: translate('Digital', 'Digitali'),
            totalLabel: translate('Digital', 'Digitali'),
            Icon: DownloadCloud,
        };
    }

    return {
        label: deliveryCopy(order, translate),
        itemLabel: translate('Product', 'Bidhaa'),
        totalLabel: translate('Product', 'Bidhaa'),
        Icon: ShoppingBag,
    };
};

const ProductFallbackIcon = ({ type, className }) => {
    const Icon = type === 'digital'
        ? DownloadCloud
        : type === 'service'
            ? Wrench
            : ShoppingBag;

    return (
        <div className={cn("flex h-full w-full items-center justify-center", className)}>
            <Icon className="h-8 w-8" />
        </div>
    );
};

const digitalAccessCopy = (order, translate = (english) => english) => {
    const type = order?.product?.digital_delivery_type;
    if (type === 'custom_delivery') return translate('Custom delivery', 'Delivery maalum');
    if (type === 'video_stream') return translate('Video access', 'Ufikiaji wa video');
    if (type === 'audio_stream') return translate('Audio access', 'Ufikiaji wa audio');
    if (type === 'gallery_pack') return translate('Gallery access', 'Ufikiaji wa gallery');
    if (type === 'live_event') return translate('Event access', 'Ufikiaji wa tukio');
    return translate('Digital access', 'Ufikiaji wa kidijitali');
};

const formatTimeLeft = (expiresAt, nowMs = Date.now(), translate = (english) => english) => {
    if (!expiresAt) return '';
    const expiresMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresMs)) return '';

    const diffMs = expiresMs - nowMs;
    if (diffMs <= 0) return translate('Expired', 'Imeisha');

    const totalMinutes = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) return `${translate('Time left', 'Muda uliobaki')} ${hours}h ${minutes}m`;
    return `${translate('Time left', 'Muda uliobaki')} ${minutes}m`;
};

const formatChatNoticeTimestamp = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const ChatNoticeTimestamp = ({ value, className }) => {
    const label = formatChatNoticeTimestamp(value);
    if (!label) return null;

    return (
        <span className={cn("mt-1 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-400", className)}>
            {label}
        </span>
    );
};

const systemBodyForOrder = (body, order, copy = (english) => english) => {
    if (!isDigitalOrder(order) || !body) return body;
    if (!body.includes('anza mchakato wa kusafirisha') && !body.includes('usafirishaji')) return body;

    const title = order?.product?.title || order?.display_title || copy('digital product', 'bidhaa ya digitali');
    const accessLabel = digitalAccessCopy(order, copy).toLowerCase();
    return copy(
        `Hello, a new order was placed for: ${title}.\nPayment succeeded. This is an ${accessLabel} order, so no shipping cost is needed. The buyer can open or download the content on Takeer.`,
        `Habari, order mpya imewekwa kwa ajili ya: ${title}.\nMalipo yamefanikiwa. Hii ni oda ya ${accessLabel}, hakuna gharama ya usafiri inayohitajika. Mteja anaweza kufungua/download content yake kwenye Takeer.`,
    );
};

export default function Chat({
    orderId,
    publicId,
    initialMessages = [],
    orderStatus,
    orderFlow = 'instant',
    actingAs = 'buyer',
    order: initialOrder
}) {
    const { auth, country } = usePage().props;
    const { copy, locale } = useLocale();
    const [messages, setMessages] = useState(initialMessages);
    const [order, setOrder] = useState(initialOrder);
    const [nowMs, setNowMs] = useState(Date.now());
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef(null);
    const mediaRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    // Action State
    const [activeAction, setActiveAction] = useState(null); // 'items', 'discount', 'shipping', 'proof', 'complaint', 'review', 'upsell', 'order_items', 'order_delivery'
    const [actionPayload, setActionPayload] = useState({});
    const [isShopModalOpen, setIsShopModalOpen] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showDiscountResetConfirm, setShowDiscountResetConfirm] = useState(false);
    const [pickupActionSubmitting, setPickupActionSubmitting] = useState(false);
    const [pickupActionForm, setPickupActionForm] = useState(null);
    const [pickupExtensionDeadline, setPickupExtensionDeadline] = useState('');
    const [pickupExtensionReason, setPickupExtensionReason] = useState('');
    const [extraChargeAmount, setExtraChargeAmount] = useState('');
    const [extraChargeNote, setExtraChargeNote] = useState('');
    const [extraChargePaymentNumber, setExtraChargePaymentNumber] = useState('');
    const [conversionAddress, setConversionAddress] = useState('');
    const [conversionNote, setConversionNote] = useState('');
    const [conversionQuoteFee, setConversionQuoteFee] = useState('');
    const [conversionQuoteNote, setConversionQuoteNote] = useState('');
    const [conversionPaymentNumber, setConversionPaymentNumber] = useState('');

    // Shipping Management State
    const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
    const [shippingZones, setShippingZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(false);
    const [isSelfPickupChoice, setIsSelfPickupChoice] = useState(order?.delivery?.delivery_type === 'self_pickup');
    const [customerLat, setCustomerLat] = useState(parseFloat(order?.delivery?.latitude) || null);
    const [customerLng, setCustomerLng] = useState(parseFloat(order?.delivery?.longitude) || null);
    const [physicalAddress, setPhysicalAddress] = useState(order?.delivery?.physical_address || '');
    const [selectedZoneId, setSelectedZoneId] = useState(order?.delivery?.shipping_zone_id || '');
    const [selectedHotspot, setSelectedHotspot] = useState(null);

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const isRouteForwarderOrder = (order?.delivery?.delivery_type || order?.delivery?.type) === 'forwarder';

    const closestLocation = React.useMemo(() => {
        if (isRouteForwarderOrder) return null;
        const locations = order?.merchant?.locations || [];
        const customerLat = order?.delivery?.latitude;
        const customerLng = order?.delivery?.longitude;

        if (!locations.length || !customerLat || !customerLng) return null;

        let closest = null;
        let minDistance = Infinity;

        locations.forEach(loc => {
            const dist = calculateHaversine(
                parseFloat(customerLat),
                parseFloat(customerLng),
                parseFloat(loc.latitude),
                parseFloat(loc.longitude)
            );
            if (dist < minDistance) {
                minDistance = dist;
                closest = { ...loc, distance: dist };
            }
        });

        return closest;
    }, [isRouteForwarderOrder, order?.merchant?.locations, order?.delivery?.latitude, order?.delivery?.longitude]);
    const deliveryRouteUrl = !isRouteForwarderOrder && closestLocation && order?.delivery?.latitude && order?.delivery?.longitude
        ? `https://www.google.com/maps/dir/?api=1&origin=${closestLocation.latitude},${closestLocation.longitude}&destination=${order.delivery.latitude},${order.delivery.longitude}&travelmode=driving`
        : null;

    useEffect(() => {
        if (activeAction === 'order_delivery' && order?.delivery) {
            setIsSelfPickupChoice(order.delivery.delivery_type === 'self_pickup');
            setCustomerLat(parseFloat(order.delivery.latitude) || null);
            setCustomerLng(parseFloat(order.delivery.longitude) || null);
            setPhysicalAddress(order.delivery.physical_address || '');
            setSelectedZoneId(order.delivery.shipping_zone_id || '');
        }
    }, [activeAction, order?.delivery?.id, order?.delivery?.delivery_type, order?.delivery?.physical_address]);

    useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
        return () => window.clearInterval(timer);
    }, []);



    const handleAddressSaved = (data) => {
        setCustomerLat(data.lat);
        setCustomerLng(data.lng);
        setPhysicalAddress(data.address);

        const result = findBestShippingZone(data.lat, data.lng, data.region, shippingZones);
        if (result) {
            setSelectedZoneId(String(result.zone.id));
            setSelectedHotspot(result.hotspot);
            if (result.zone.delivery_type === 'intercity_bus' && Number(result.zone.flat_rate_fee || 0) <= 0) {
                toast.success(copy('Destination found. The shipping cost will be confirmed in chat.', 'Destination imepatikana. Gharama ya usafiri itathibitishwa kwenye chat.'));
            } else {
                toast.success(copy(`Shipping cost found: TZS ${Number(result.zone.flat_rate_fee).toLocaleString()}`, `Tumekupatia gharama ya usafiri: TZS ${Number(result.zone.flat_rate_fee).toLocaleString()}`));
            }
        } else {
            setSelectedZoneId('');
            setSelectedHotspot(null);
            toast.info(copy('Your location needs the merchant to set the cost manually. You can continue.', 'Eneo lako linahitaji muuzaji aweke gharama mwenyewe. Unaweza kuendelea.'));
        }
    };

    // Upsell & Modal state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [isDealExpanded, setIsDealExpanded] = useState(false);

    // Payment State
    const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false);
    const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('mobile'); // 'mobile', 'card'
    const [paymentPhone, setPaymentPhone] = useState(initialOrder?.account_phone || auth.user?.phone_number || '');
    const [isPaying, setIsPaying] = useState(false);
    const [confirmingAvailability, setConfirmingAvailability] = useState(false);

    // Merchant Shipping & Dispatch State
    const [quoteSubmitting, setQuoteSubmitting] = useState(false);
    const [shippingFeeInput, setShippingFeeInput] = useState('');
    const [dispatchMode, setDispatchMode] = useState('local');
    const [dispatchVideo, setDispatchVideo] = useState(null);
    const [transportReceipt, setTransportReceipt] = useState(null);
    const [bodaPhone, setBodaPhone] = useState('');
    const [deliveryPersonName, setDeliveryPersonName] = useState('');
    const [busCompany, setBusCompany] = useState('');
    const [waybillTrackingNumber, setWaybillTrackingNumber] = useState('');
    const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
    const [pinVerifying, setPinVerifying] = useState(false);
    const [releasePinInput, setReleasePinInput] = useState('');
    const [pickupPinInput, setPickupPinInput] = useState('');

    // Buyer provider-settlement states
    const [isConfirmingReceipt, setIsConfirmingReceipt] = useState(false);
    const [isDisputeDrawerOpen, setIsDisputeDrawerOpen] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const [disputeVideo, setDisputeVideo] = useState(null);
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Review States
    const [reviewStars, setReviewStars] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);



    // Auto-scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!window.Echo) return;

        const channel = window.Echo.private(`chat.order.${orderId}`);

        channel.listen('MessageSent', (e) => {
            // If we are not the sender, append to chat array
            if (e.message.sender_id !== auth.user.id) {
                setMessages(prev => [...prev, e.message]);
            }
            setOrder(prev => mergeDeliveryMessageIntoOrder(prev, e.message));
        });

        // Optional typing indicators:
        // channel.listenForWhisper('typing', (e) => { ... })

        return () => window.Echo.leave(`chat.order.${orderId}`);
    }, [orderId, auth.user.id]);

    useEffect(() => {
        setOrder(prev => messages.reduce((nextOrder, message) => mergeDeliveryMessageIntoOrder(nextOrder, message), prev));
    }, [messages]);

    const refreshMessages = async () => {
        const res = await fetch(`/api/chat/order/${orderId}/messages`, {
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Imeshindwa kusasisha chat.');
        setMessages(data.messages || []);
    };

    useEffect(() => {
        if (order?.delivery?.delivery_type) {
            if (order.delivery.delivery_type === 'local_boda') {
                setDispatchMode('local');
            } else if (order.delivery.delivery_type === 'forwarder') {
                setDispatchMode('local');
            } else if (order.delivery.delivery_type === 'intercity_bus') {
                setDispatchMode('intercity');
            }
        }
    }, [order?.delivery?.delivery_type]);

    const submitQuote = async (e) => {
        e.preventDefault();
        if (quoteSubmitting || !shippingFeeInput) return;

        setQuoteSubmitting(true);
        try {
            const quoteLabel = order?.product?.type === 'service'
                ? copy('Service offer', 'Offer ya huduma')
                : order?.product?.type === 'digital'
                    ? copy('Digital work offer', 'Offer ya digital work')
                    : (isForwarderOrder ? copy('Forwarder delivery cost', 'Gharama ya kupeleka kwa forwarder') : copy('Shipping cost', 'Gharama ya usafiri'));
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/merchant/orders/${orderId}/quote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({ shipping_fee: shippingFeeInput })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kutuma gharama.');

            toast.success(`${quoteLabel} ${copy('was sent to the buyer.', 'imetumwa kwa mteja.')}`);
            setShippingFeeInput('');
            if (data.order) setOrder(data.order);

            // Notify optimistic UI with a system-like message
            const actionMsg = {
                id: Date.now(),
                sender_id: auth.user.id,
                type: 'text',
                body: `${quoteLabel} ${copy('set:', 'imewekwa:')} TZS ${Number(shippingFeeInput).toLocaleString()}`,
                payload: { acting_as: actingAs },
                sender: { role: auth.user.role, name: auth.user.name },
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, actionMsg]);
        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setQuoteSubmitting(false);
        }
    };

    const confirmAvailability = async () => {
        if (confirmingAvailability) return;

        setConfirmingAvailability(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/merchant/orders/${orderId}/confirm-availability`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kuthibitisha order.');

            toast.success(data.message || copy('Order confirmed.', 'Order imethibitishwa.'));
            if (data.order) setOrder(data.order);
            const isPaidPickupConfirmation = canMerchantConfirmPaidPickup;
            setMessages(prev => [...prev, {
                id: Date.now(),
                sender_id: auth.user.id,
                type: 'text',
                body: isPaidPickupConfirmation
                    ? copy('I confirmed the order is available. It is ready for pickup at the selected time.', 'Nimethibitisha kuwa order ipo. Iko tayari kwa pickup kulingana na muda mliochagua.')
                    : copy('I confirmed that the order is ready. You can pay now.', 'Nimethibitisha kuwa order ipo tayari. Unaweza kulipia sasa.'),
                payload: { acting_as: actingAs },
                sender: { role: auth.user.role, name: auth.user.name },
                created_at: new Date().toISOString()
            }]);
        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setConfirmingAvailability(false);
        }
    };

    const submitDispatch = async (e) => {
        e.preventDefault();
        const canDispatchNow = !!order && order?.product?.type === 'physical' && ['pending_fulfillment', 'release_eligible'].includes(order.payment_status);
        if (!canDispatchNow || dispatchSubmitting) return;

        if (!dispatchVideo) {
            toast.error(copy('Choose the packing video first.', 'Tafadhali chagua video ya packing kwanza.'));
            return;
        }
        if (dispatchMode === 'intercity' && !transportReceipt) {
            toast.error(copy('Upload the shipping receipt/waybill.', 'Tafadhali pakia risiti/waybill ya usafirishaji.'));
            return;
        }

        setIsUploading(true);
        setDispatchSubmitting(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;

            // 1. Upload video
            const videoData = new FormData();
            videoData.append('file', dispatchVideo);
            videoData.append('type', 'public');
            videoData.append('folder', `chat/${orderId}/dispatch`);

            let videoRes = await fetch('/api/media/upload', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': token || '' },
                body: videoData
            });
            if (!videoRes.ok) throw new Error('Imeshindwa kupakia video.');
            let videoDataJson = await videoRes.json();
            let videoUrl = videoDataJson.url;

            // 2. Upload receipt if intercity
            let receiptUrl = null;
            if (dispatchMode === 'intercity' && transportReceipt) {
                const receiptData = new FormData();
                receiptData.append('file', transportReceipt);
                receiptData.append('type', 'public');
                receiptData.append('folder', `chat/${orderId}/dispatch`);

                let receiptRes = await fetch('/api/media/upload', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': token || '' },
                    body: receiptData
                });
                if (!receiptRes.ok) throw new Error('Imeshindwa kupakia risiti.');
                let receiptDataJson = await receiptRes.json();
                receiptUrl = receiptDataJson.url;
            }

            // 3. Submit to Dispatch API
            const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
            const payload = {
                merchant_dispatch_video_url: videoUrl,
            };
            if (dispatchMode === 'intercity') {
                payload.waybill_photo_url = receiptUrl;
                if (busCompany.trim()) payload.bus_company = busCompany.trim();
                if (waybillTrackingNumber.trim()) payload.waybill_tracking_number = waybillTrackingNumber.trim();
            } else if (bodaPhone.trim()) {
                payload.boda_phone = bodaPhone.trim();
            }
            if (deliveryPersonName.trim()) {
                payload.delivery_person_name = deliveryPersonName.trim();
            }

            const res = await fetch(`/api/merchant/${merchantUsername}/dispatch/${orderId}/${dispatchMode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kuhifadhi dispatch evidence.');

            toast.success(copy('Dispatch evidence saved.', 'Dispatch evidence imehifadhiwa.'));
            setDispatchVideo(null);
            setTransportReceipt(null);
            setDeliveryPersonName('');
            if (data.order) setOrder(data.order);

            // Send formatted action to chat
            submitAction('shipping_proof', {
                title: 'Dispatch Evidence',
                dispatch_mode: dispatchMode,
                bus_company: dispatchMode === 'intercity' ? busCompany.trim() : null,
                waybill_tracking_number: dispatchMode === 'intercity' ? waybillTrackingNumber.trim() : null,
                boda_phone: dispatchMode === 'local' ? bodaPhone.trim() : null,
                delivery_person_name: deliveryPersonName.trim() || null,
                mediaUrl: videoUrl,
                receiptUrl: receiptUrl
            });

        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setDispatchSubmitting(false);
            setIsUploading(false);
        }
    };

    const verifyPickupPin = async (e) => {
        e.preventDefault();
        if (!pickupPinInput || pinVerifying) return;
        setPinVerifying(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
            const res = await fetch(`/api/merchant/${merchantUsername}/orders/${orderId}/verify-pickup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({ pickup_pin: pickupPinInput })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kuhakiki PIN.');

            toast.success(copy('Pickup confirmed! Payment is eligible for release.', 'Pickup imethibitishwa! Malipo yameidhinishwa.'));
            setPickupPinInput('');
            if (data.order) {
                setOrder(prev => ({
                    ...prev,
                    payment_status: data.order.payment_status || 'paid_out',
                    delivery: {
                        ...(prev?.delivery || {}),
                        delivery_status: data.order.delivery_status || 'delivered',
                    },
                }));
            }
            if (data.chat_message) {
                setMessages(prev => prev.some(message => message.id === data.chat_message.id)
                    ? prev
                    : [...prev, data.chat_message]);
            }
        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setPinVerifying(false);
        }
    };

    const verifyDeliveryPin = async (e) => {
        e.preventDefault();
        if (!releasePinInput || pinVerifying) return;
        setPinVerifying(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
            const res = await fetch(`/api/merchant/${merchantUsername}/orders/${orderId}/verify-delivery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({ buyer_release_pin: releasePinInput })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kuhakiki PIN.');

            toast.success(copy('The package has arrived! Payment is eligible for release.', 'Mzigo umefika! Malipo yameidhinishwa.'));
            setReleasePinInput('');
            if (data.order) setOrder(data.order);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setPinVerifying(false);
        }
    };

    const confirmReceipt = async () => {
        setIsConfirmingReceipt(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/buyer/orders/${orderId}/confirm-receipt`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                }
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kudhibitisha.');

            toast.success(data.message || copy('Action completed.', 'Hatua imekamilika.'));
            setOrder(prev => ({ ...prev, payment_status: 'paid_out' }));
        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setIsConfirmingReceipt(false);
        }
    };

    const submitDispute = async () => {
        setIsSubmittingDispute(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const formData = new FormData();
            formData.append('unboxing_video', disputeVideo);
            formData.append('reason', disputeReason);

            const res = await fetch(`/api/buyer/orders/${orderId}/dispute`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kutuma ripoti.');

            toast.success(data.message || copy('Report submitted.', 'Ripoti imetumwa.'));
            setIsDisputeDrawerOpen(false);
            setOrder(prev => ({ ...prev, payment_status: 'disputed' }));
        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const submitReview = async () => {
        if (!reviewComment.trim()) {
            toast.error(copy('Enter your review.', 'Tafadhali weka maoni yako.'));
            return;
        }
        setIsSubmittingReview(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/chat/order/${orderId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({
                    body: `Alitoa Review: ${reviewStars} Stars`,
                    type: 'action',
                    acting_as: actingAs,
                    payload: {
                        action_type: 'review',
                        stars: reviewStars,
                        comment: reviewComment,
                        acting_as: actingAs
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kutuma review.');

            toast.success(copy('Thank you for your review!', 'Asante kwa review yako!'));
            setReviewComment('');
            setMessages(prev => [...prev, data.message]);
            if (data.order) setOrder(data.order);
        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const sendMessage = async (e, mediaUrl = null) => {
        if (e) e.preventDefault();
        if ((!input.trim() && !mediaUrl) || isLoading) return;

        const body = input.trim() || (mediaUrl ? (actingAs === 'merchant' ? 'Picha/Video ya Bidhaa' : 'Picha/Video ya Uthibitisho') : '');
        setInput('');

        // Optimistic UI update
        const tempId = Date.now();
        const optimisticMsg = {
            id: tempId,
            sender_id: auth.user.id,
            body: body,
            media_url: mediaUrl,
            payload: { acting_as: actingAs },
            sender: { role: auth.user.role },
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/chat/order/${orderId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({
                    body,
                    media_url: mediaUrl,
                    type: 'text',
                    acting_as: actingAs
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kutuma ujumbe.');

            // Replace temporary message with actual DB record and update order
            setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
            if (data.order) setOrder(data.order);

        } catch (error) {
            toast.error(error.message);
            // Revert optimistic if failed
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const handleMediaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation: size check (e.g. 50MB for chat)
        if (file.size > 50 * 1024 * 1024) {
            toast.error(copy('The file is too large. Please use a file under 50MB.', 'Faili ni kubwa mno. Tafadhali tumia chini ya 50MB.'));
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', `chat/${orderId}`);

        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch('/api/media/upload', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Imeshindwa kupakia media.');
            }

            const data = await res.json();

            if (activeAction === 'shipping_proof') {
                submitAction('shipping_proof', { mediaUrl: data.url, title: 'Ushahidi wa Dispatch' });
                setActiveAction(null);
                setDrawerOpen(false);
            } else if (activeAction === 'unboxing_video') {
                submitAction('unboxing_video', { mediaUrl: data.url, title: 'Video ya Unboxing' });
                setActiveAction(null);
                setDrawerOpen(false);
            } else {
                sendMessage(null, data.url);
            }

        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsUploading(false);
            if (mediaRef.current) mediaRef.current.value = '';
        }
    };

    const handleMerchantLockAction = async (actionType) => {
        setIsLoading(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const endpoint = actionType === 'extend_lock' ? 'extend-lock' : 'release-inventory';
            const res = await fetch(`/api/merchant/${order.merchant.username}/orders/${order.id}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                }
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || 'Imeshindwa kukamilisha hatua hiyo.');
            }

            const data = await res.json();
            if (data.order) setOrder(data.order);
            if (data.messages) setMessages(data.messages);
            toast.success(data.message);
            setActiveAction(null);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const getActiveComplaint = () => {
        if (!order?.dispute) return null;
        if (order.dispute.status === 'resolved' || order.dispute.status === 'closed') return null;
        return order.dispute;
    };

    const openComplaintCenter = () => {
        setActiveAction('complaint');
        setActionPayload({
            title: 'Complaint Centre',
            reason: '',
        });
        setIsActionDrawerOpen(true);
    };

    const handleSearchProducts = async (q) => {
        setSearchQuery(q);
        // If query is empty, still fetch latest products
        setIsSearching(true);
        try {
            const res = await fetch(`/api/chat/order/${orderId}/search-products?q=${encodeURIComponent(q)}`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            // The API returns paginated data: data.data.data
            setSearchResults(data.data.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const getPriceRange = (product) => {
        if (!product.has_variants || !product.variants?.length) return `TZS ${Number(product.price).toLocaleString()}`;
        const prices = product.variants.map(v => Number(v.price));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === max) return `TZS ${min.toLocaleString()}`;
        return `TZS ${min.toLocaleString()} - ${max.toLocaleString()}`;
    };


    const submitAction = async (actionType, payload) => {
        // Optimistic UI update
        const tempId = Date.now();
        const actionMsg = {
            id: tempId,
            sender_id: auth.user.id,
            type: 'action',
            body: payload.title || `Oda imebadilishwa: ${actionType}`,
            payload: { ...payload, action_type: actionType, acting_as: actingAs, actor_name: auth.user.name },
            sender: { role: auth.user.role, name: auth.user.name },
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, actionMsg]);
        setActiveAction(null);
        setActionPayload({});

        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/chat/order/${orderId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({
                    body: actionMsg.body,
                    type: 'action',
                    acting_as: actingAs,
                    payload: actionMsg.payload
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Imeshindwa kutuma mabadiliko.');

            if (data.order_deleted) {
                toast.success(copy('The order was cancelled because it has no items left.', 'Oda imefutwa kwa sababu haina vitu tena.'));
                window.location.href = '/orders'; // Or library
                return;
            }

            // Replace temporary message with actual DB record and real order math
            setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
            if (data.order) setOrder(data.order);

            toast.success(`${actionMsg.body} ${copy('was completed successfully!', 'imewekwa kikamilifu!')}`);
            return data;

        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
            // Revert optimistic if failed
            setMessages(prev => prev.filter(m => m.id !== tempId));
            return null;
        }
    };

    const runPickupAgreementAction = async (endpoint, payload = {}, successMessage = copy('Pickup agreement updated.', 'Makubaliano ya pickup yamesasishwa.'), method = 'POST') => {
        if (pickupActionSubmitting) return;

        setPickupActionSubmitting(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || copy('Could not complete this action.', 'Imeshindwa kukamilisha hatua hii.'));

            if (data.order) setOrder(data.order);
            await refreshMessages();
            toast.success(data.message || successMessage);
        } catch (error) {
            toast.error(error.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        } finally {
            setPickupActionSubmitting(false);
        }
    };

    const openPickupActionForm = (form) => {
        if (form === 'extension_request') {
            const defaultDate = order?.pickup_deadline_at
                ? new Date(new Date(order.pickup_deadline_at).getTime() + (24 * 60 * 60 * 1000))
                : new Date(Date.now() + (24 * 60 * 60 * 1000));
            setPickupExtensionDeadline(defaultDate.toISOString().slice(0, 16));
            setPickupExtensionReason('');
        }
        if (form === 'extra_charge_payment') {
            setExtraChargePaymentNumber(order?.payment_phone || order?.account_phone || auth.user?.phone_number || '');
        }
        if (form === 'delivery_conversion_request') {
            setConversionAddress(order?.delivery?.physical_address || '');
            setConversionNote('');
        }
        if (form === 'delivery_conversion_quote') {
            setConversionQuoteFee('');
            setConversionQuoteNote('');
        }
        if (form === 'delivery_conversion_payment') {
            setConversionPaymentNumber(order?.payment_phone || order?.account_phone || auth.user?.phone_number || '');
        }
        setPickupActionForm(form);
    };

    const prepareExtraChargeForm = () => {
        const activeFee = order?.pickup_policy_snapshot?.active_extra_charge || {};
        const policyAmount = activeFee?.amount || '';
        setExtraChargeAmount(policyAmount ? String(policyAmount) : '');
        setExtraChargeNote(activeFee?.note || '');
    };

    const openExtraChargeForm = () => {
        prepareExtraChargeForm();
        setActionPayload({ title: activeExtraCharge?.status === 'proposed' ? 'Update Extra Charge' : 'Extra Charge' });
        setActiveAction('extra_charge');
        setIsActionDrawerOpen(true);
    };

    const requestPickupExtension = async (event) => {
        event?.preventDefault();
        const requestedDate = new Date(pickupExtensionDeadline);
        if (Number.isNaN(requestedDate.getTime()) || requestedDate <= new Date()) {
            toast.error(copy('Enter a valid future date and time.', 'Tafadhali weka tarehe na muda sahihi wa baadaye.'));
            return;
        }

        await runPickupAgreementAction(
            `/api/buyer/orders/${orderId}/pickup-extension`,
            { requested_deadline_at: requestedDate.toISOString(), reason: pickupExtensionReason },
            copy('The extension request was sent.', 'Ombi la kuongeza muda limetumwa.')
        );
        setPickupActionForm(null);
    };

    const requestDeliveryConversion = async (event) => {
        event?.preventDefault();
        if (!conversionAddress.trim()) {
            toast.error(copy('Enter the delivery address.', 'Weka anwani ya kufikishiwa.'));
            return;
        }

        await runPickupAgreementAction(
            `/api/buyer/orders/${orderId}/pickup-delivery-conversion`,
            {
                delivery_type: 'local_boda',
                physical_address: conversionAddress.trim(),
                note: conversionNote.trim(),
            },
            copy('The delivery conversion request was sent.', 'Ombi la kubadili kwenda delivery limetumwa.')
        );
        setPickupActionForm(null);
    };

    const quoteDeliveryConversion = async (event) => {
        event?.preventDefault();
        const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
        const shippingFee = Number(String(conversionQuoteFee).replace(/,/g, ''));
        if (!merchantUsername || !Number.isFinite(shippingFee) || shippingFee <= 0) {
            toast.error(copy('Enter a valid delivery cost.', 'Weka gharama sahihi ya delivery.'));
            return;
        }

        await runPickupAgreementAction(
            `/api/merchant/${merchantUsername}/orders/${orderId}/pickup-delivery-conversion/quote`,
            { shipping_fee: shippingFee, note: conversionQuoteNote.trim() },
            copy('The delivery quote was sent.', 'Delivery quote imetumwa.')
        );
        setPickupActionForm(null);
    };

    const acceptDeliveryConversion = async (event) => {
        event?.preventDefault();
        if (!conversionPaymentNumber.trim()) {
            toast.error(copy('Enter the payment number.', 'Weka namba ya malipo.'));
            return;
        }

        await runPickupAgreementAction(
            `/api/buyer/orders/${orderId}/pickup-delivery-conversion/accept`,
            { payment_number: conversionPaymentNumber.trim() },
            copy('The delivery fee payment request was sent.', 'Delivery fee payment request imetumwa.')
        );
        setPickupActionForm(null);
    };

    const resolvePickupExtension = async (decision, extensionId = null) => {
        const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
        if (!merchantUsername) {
            toast.error(copy('The merchant was not found for this order.', 'Merchant haijapatikana kwa order hii.'));
            return;
        }

        const pending = order?.pickup_policy_snapshot?.pending_extension || {};
        const payload = { decision };
        if (extensionId) payload.extension_id = extensionId;

        if (decision === 'approved') {
            const suggested = pending.requested_deadline_at
                ? new Date(pending.requested_deadline_at).toISOString().slice(0, 16).replace('T', ' ')
                : '';
            const approved = window.prompt(copy('Confirm the new pickup time:', 'Thibitisha muda mpya wa pickup:'), suggested);
            if (!approved) return;

            const approvedDate = new Date(approved.replace(' ', 'T'));
            if (Number.isNaN(approvedDate.getTime()) || approvedDate <= new Date()) {
                toast.error(copy('Enter a valid future date and time.', 'Tafadhali weka tarehe na muda sahihi wa baadaye.'));
                return;
            }
            payload.approved_deadline_at = approvedDate.toISOString();
        }

        const note = window.prompt(decision === 'approved' ? copy('Message for the buyer? (optional)', 'Ujumbe kwa mteja? (hiari)') : copy('Reason for declining? (optional)', 'Sababu ya kukataa? (hiari)'), '') || '';
        if (note) payload.note = note;

        await runPickupAgreementAction(
            `/api/merchant/${merchantUsername}/orders/${orderId}/pickup-extension`,
            payload,
            decision === 'approved' ? copy('Pickup time extended.', 'Muda wa pickup umeongezwa.') : copy('The extension request was declined.', 'Ombi la kuongeza muda limekataliwa.')
        );
    };

    const proposeExtraCharge = async (event) => {
        event?.preventDefault();
        const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
        if (!merchantUsername) {
            toast.error(copy('The merchant was not found for this order.', 'Merchant haijapatikana kwa order hii.'));
            return;
        }

        const amount = Number(String(extraChargeAmount).replace(/,/g, ''));
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error(copy('Enter a valid amount.', 'Tafadhali weka kiwango sahihi.'));
            return;
        }

        await runPickupAgreementAction(
            `/api/merchant/${merchantUsername}/orders/${orderId}/extra-charges`,
            { amount, note: extraChargeNote.trim() },
            copy('The extra charge was sent to the buyer.', 'Gharama ya ziada imetumwa kwa mteja.')
        );
        setPickupActionForm(null);
        setActiveAction(null);
    };

    const removeExtraCharge = async () => {
        const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
        if (!merchantUsername) {
            toast.error(copy('The merchant was not found for this order.', 'Merchant haijapatikana kwa order hii.'));
            return;
        }

        await runPickupAgreementAction(
            `/api/merchant/${merchantUsername}/orders/${orderId}/extra-charges`,
            {},
            copy('The extra charge was removed.', 'Gharama ya ziada imeondolewa.'),
            'DELETE'
        );
        setPickupActionForm(null);
        setActiveAction(null);
    };

    const cancelPickupAfterGrace = async () => {
        const merchantUsername = order?.merchant?.username || order?.product?.merchant?.username;
        if (!merchantUsername) {
            toast.error(copy('The merchant was not found for this order.', 'Merchant haijapatikana kwa order hii.'));
            return;
        }

        const reason = window.prompt(copy('Reason for cancellation after the deadline? (optional)', 'Sababu ya cancellation baada ya deadline kupita? (hiari)'), copy('The buyer did not collect the package within the agreed time.', 'Mteja hakuchukua mzigo ndani ya muda mliokubaliana.')) || '';
        await runPickupAgreementAction(
            `/api/merchant/${merchantUsername}/orders/${orderId}/pickup-cancel-after-grace`,
            { reason },
            copy('The order was cancelled after the deadline.', 'Order imecanceliwa baada ya deadline kupita.')
        );
    };

    const acceptExtraCharge = async (event) => {
        event?.preventDefault();
        if (!extraChargePaymentNumber.trim()) {
            toast.error(copy('Enter the payment number.', 'Weka namba ya malipo.'));
            return;
        }

        await runPickupAgreementAction(
            `/api/buyer/orders/${orderId}/extra-charges/accept`,
            {
                payment_number: extraChargePaymentNumber.trim(),
                proposal_id: order?.pickup_policy_snapshot?.active_extra_charge?.id,
            },
            copy('The extra cost payment request was sent.', 'Extra cost payment request imetumwa.')
        );
        setPickupActionForm(null);
    };

    const visibleMessages = [...messages].reverse().reduce((acc, msg) => {
        const isPaymentNotice = msg.type === 'action'
            && msg.payload?.action_type === 'initiate_payment';
        const isDeliveryTimelineNotice = msg.type === 'action'
            && msg.payload?.action_type === 'delivery_status_update';
        const isReviewNotice = msg.type === 'action'
            && msg.payload?.action_type === 'review';
        const shouldHideCompletedMerchantPaymentNotice = isPaymentNotice
            && actingAs === 'merchant'
            && order?.payment_status === 'paid_out';
        const key = isPaymentNotice ? 'payment-initiation' : null;

        if (shouldHideCompletedMerchantPaymentNotice || isDeliveryTimelineNotice || isReviewNotice) {
            return acc;
        }

        if (key && acc.seen.has(key)) {
            return acc;
        }

        if (key) {
            acc.seen.add(key);
        }

        acc.items.push(msg);
        return acc;
    }, { items: [], seen: new Set() }).items.reverse();

    const reviewMessage = [...messages].reverse().find((msg) => msg.type === 'action' && msg.payload?.action_type === 'review');
    const completedReview = reviewMessage
        ? {
            rating: Number(reviewMessage.payload?.stars || 5),
            comment: reviewMessage.payload?.comment || '',
            created_at: reviewMessage.created_at,
        }
        : order?.review
            ? {
                rating: Number(order.review.rating || 5),
                comment: order.review.comment || '',
                created_at: order.review.created_at,
            }
            : null;

    const groupedMessages = visibleMessages.reduce((acc, msg) => {
        const dateObj = new Date(msg.created_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        if (dateObj.toDateString() === today.toDateString()) {
            dateStr = copy('Today', 'Leo');
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
            dateStr = copy('Yesterday', 'Jana');
        }

        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(msg);
        return acc;
    }, {});

    const currentStatus = statusCopy(order, copy);
    const productType = order?.product?.type;
    const serviceOrder = isServiceOrder(order);
    const digitalOrder = isDigitalOrder(order);
    const physicalOrder = isPhysicalOrder(order);
    const customDigitalOrder = productType === 'digital' && order?.product?.digital_delivery_type === 'custom_delivery';
    const intentMeta = orderIntentMeta(order, copy);
    const IntentIcon = intentMeta.Icon;
    const merchantConfirmed = Boolean(order?.is_merchant_confirmed || order?.merchant_confirmed_at);
    const canBuyerPay = actingAs === 'buyer'
        && order?.payment_status === 'pending'
        && (!order?.is_inquiry || merchantConfirmed)
        && (order?.is_inquiry
            ? order?.inquiry_status === 'quoted' && (
                serviceOrder
                || digitalOrder
                || order?.delivery?.delivery_type === 'self_pickup'
                || order?.shipping_fee !== null
                || order?.delivery?.shipping_zone_id
            )
            : (
                serviceOrder
                || digitalOrder
                || order?.delivery?.delivery_type === 'self_pickup'
                || order?.shipping_fee !== null
                || order?.delivery?.shipping_zone_id
            ));
    const canCancelBeforePayment = order?.payment_status === 'pending';
    const canMerchantQuote = actingAs === 'merchant'
        && order?.is_inquiry
        && order?.payment_status === 'pending'
        && order?.inquiry_status === 'pending'
        && (
            serviceOrder
            || digitalOrder
            || order?.delivery?.delivery_type !== 'self_pickup'
        );
    const isWaitingForShippingFee = canMerchantQuote
        && physicalOrder
        && order?.shipping_fee === null;
    const canMerchantConfirmUnpaid = actingAs === 'merchant'
        && order?.is_inquiry
        && order?.payment_status === 'pending'
        && order?.inquiry_status === 'quoted'
        && !merchantConfirmed;
    const canMerchantConfirmPaidPickup = actingAs === 'merchant'
        && order?.product?.type === 'physical'
        && order?.payment_status === 'pending_fulfillment'
        && order?.delivery?.delivery_type === 'self_pickup'
        && !merchantConfirmed;
    const canMerchantConfirm = canMerchantConfirmUnpaid || canMerchantConfirmPaidPickup;
    const agreedAt = order?.agreed_at || order?.agreement_snapshot?.agreed_at || order?.agreement_snapshot?.offered_at;
    const orderImageUrl = order?.variant?.swatch_image_url
        || order?.variant_snapshot?.swatch_image_url
        || order?.product?.image_url
        || order?.product?.url;
    const expiryLabel = order?.payment_status === 'pending' ? formatTimeLeft(order?.expires_at, nowMs, copy) : '';
    const offeringItems = offeringGroupOrderItems(order);
    const orderItems = offeringItems.length > 0 ? offeringItems : [
        {
            key: `main-${order?.product?.id || order?.product_id || 'item'}`,
            id: order?.product_id,
            variant_id: order?.variant_id,
            title: order?.product?.title || order?.display_title || copy('Order item', 'Bidhaa ya oda'),
            image: orderImageUrl,
            quantityLabel: orderQuantityLabel(order),
            price: Number(order?.unit_price || 0) * orderPackageCount(order),
            quantity: order?.quantity,
            requested_quantity: order?.requested_quantity,
            unit_snapshot: order?.unit_snapshot,
            type: productType || (order?.requires_physical_fulfillment ? 'physical' : undefined),
            digital_delivery_type: order?.product?.digital_delivery_type,
            product_type: productType,
            isMain: true,
            isExtra: false,
        },
        ...(order?.extra_items || []).map((item, index) => ({
            key: `extra-${item.variant_id || item.id || index}`,
            id: item.id,
            variant_id: item.variant_id,
            title: item.title || copy('Added product', 'Bidhaa iliyoongezwa'),
            image: item.image,
            quantityLabel: `${Number(item.quantity || 1).toLocaleString()} ${copy(Number(item.quantity || 1) === 1 ? 'item' : 'items', Number(item.quantity || 1) === 1 ? 'bidhaa' : 'bidhaa')}`,
            price: Number(item.price || 0) * (isPhysicalDealItem({ ...item, isExtra: true }, order) ? Number(item.quantity || 1) : 1),
            quantity: item.quantity ?? 1,
            type: item.type || item.product_type,
            digital_delivery_type: item.digital_delivery_type,
            product_type: item.product_type || item.type,
            isMain: false,
            isExtra: true,
        })),
    ];
    const itemsSubtotal = orderItems.reduce((sum, item) => sum + item.price, 0);
    const shippingTotal = Number(order?.shipping_fee || 0);
    const discountTotal = Number(order?.discount_amount || 0);
    const dealTotal = Math.max(0, itemsSubtotal + shippingTotal - discountTotal);
    const dealSummaryParts = [
        `${orderItems.length} ${copy(orderItems.length === 1 ? 'item' : 'items', orderItems.length === 1 ? 'bidhaa' : 'bidhaa')}`,
        shippingTotal > 0 ? `${copy('Shipping', 'Usafiri')} ${shippingTotal.toLocaleString()}` : null,
        discountTotal > 0 ? `${copy('Discount', 'Punguzo')} -${discountTotal.toLocaleString()}` : null,
    ].filter(Boolean);
    const hasPhysicalOrderItems = orderItems.some((item) => isPhysicalDealItem(item, order));
    const isSelfPickupOrder = (order?.delivery?.delivery_type || order?.delivery?.type) === 'self_pickup';
    const pickupSnapshot = order?.pickup_policy_snapshot || {};
    const activeExtraCharge = pickupSnapshot?.active_extra_charge || null;
    const orderDisplayTotal = Number(order?.order_total_with_additions ?? order?.total_paid ?? 0);
    const pickupReadyForRelease = order?.pickup_status === 'ready_for_pickup';
    const pendingPickupExtension = pickupSnapshot?.pending_extension;
    const pickupDeadlineAt = order?.pickup_deadline_at ? new Date(order.pickup_deadline_at) : null;
    const pickupDeadlinePassed = Boolean(pickupDeadlineAt && pickupDeadlineAt.getTime() <= nowMs);
    const pickupClosed = Boolean(
        order?.pickup_completed_at
        || ['completed', 'buyer_no_show'].includes(order?.pickup_status)
        || ['paid_out', 'refunded', 'refund_pending'].includes(order?.payment_status)
    );
    const pickupPaid = ['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(order?.payment_status);
    const hasPendingPickupExtension = isSelfPickupOrder
        && order?.pickup_status === 'extension_requested'
        && pendingPickupExtension?.status === 'pending';
    const deliveryConversion = pickupSnapshot?.delivery_conversion || null;
    const canRequestDeliveryConversion = actingAs === 'buyer'
        && isSelfPickupOrder
        && pickupPaid
        && !pickupClosed
        && !['requested', 'quoted', 'payment_pending', 'paid_held'].includes(deliveryConversion?.status);
    const canQuoteDeliveryConversion = actingAs === 'merchant'
        && isSelfPickupOrder
        && !pickupClosed
        && deliveryConversion?.status === 'requested';
    const canAcceptDeliveryConversion = actingAs === 'buyer'
        && isSelfPickupOrder
        && !pickupClosed
        && deliveryConversion?.status === 'quoted';
    const canRequestPickupExtension = actingAs === 'buyer'
        && isSelfPickupOrder
        && pickupPaid
        && !pickupClosed
        && !hasPendingPickupExtension
        && (pickupSnapshot?.extension_allowed ?? true) !== false;
    const canResolvePickupExtension = actingAs === 'merchant' && hasPendingPickupExtension && !pickupClosed;
    const canProposeExtraCharge = actingAs === 'merchant'
        && isSelfPickupOrder
        && pickupPaid
        && !pickupClosed;
    const canRemoveExtraCharge = actingAs === 'merchant'
        && isSelfPickupOrder
        && !pickupClosed
        && activeExtraCharge?.status === 'proposed';
    const canCancelPickupAfterGrace = actingAs === 'merchant'
        && isSelfPickupOrder
        && pickupPaid
        && pickupDeadlinePassed
        && !pickupClosed;
    const canAcceptExtraCharge = actingAs === 'buyer'
        && isSelfPickupOrder
        && !pickupClosed
        && activeExtraCharge?.status === 'proposed';
    const isForwarderOrder = (order?.delivery?.delivery_type || order?.delivery?.type) === 'forwarder';
    const isIntercityOrder = (order?.delivery?.delivery_type || order?.delivery?.type) === 'intercity_bus';
    const isLocalDeliveryOrder = (order?.delivery?.delivery_type || order?.delivery?.type) === 'local_boda';
    const deliveryStatus = order?.delivery?.delivery_status || order?.delivery?.status;
    const isPaymentResolved = order?.payment_status === 'paid_out';
    const isDeliveryHandoffReady = ['delivered', 'customer_confirmed'].includes(deliveryStatus);
    const isDeliveryCompleted = isPaymentResolved || isDeliveryHandoffReady;
    const deliveryStageStatuses = ['dispatched', 'with_boda', 'in_transit', 'arrived', 'ready_at_terminal', 'delivered'];
    const canBuyerActOnDelivery = isForwarderOrder
        ? deliveryStatus === 'ready_at_terminal'
        : isIntercityOrder
            ? ['ready_at_terminal', 'delivered'].includes(deliveryStatus)
            : isLocalDeliveryOrder && deliveryStatus === 'delivered';
    const canBuyerConfirmReceipt = Boolean(
        actingAs === 'buyer'
        && order?.delivery
        && !isPaymentResolved
        && deliveryStatus !== 'customer_confirmed'
        && (isForwarderOrder
            ? ['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(order?.payment_status)
            : ['release_eligible', 'payout_processing'].includes(order?.payment_status))
        && (isLocalDeliveryOrder || isIntercityOrder || isForwarderOrder)
        && canBuyerActOnDelivery
    );
    const buyerReceiptCopy = isForwarderOrder
        ? {
            title: copy('Confirm handoff', 'Thibitisha handoff'),
            body: copy('The merchant says the package was received by the forwarder. Check the tracking/receipt or contact the forwarder. If everything is correct, confirm so the PSP payout can be requested.', 'Muuzaji amesema mzigo umepokelewa na forwarder. Hakiki tracking/risiti au wasiliana na forwarder. Ukiridhika, thibitisha ili PSP payout iweze kuombwa.'),
            confirm: copy('I CONFIRM HANDOFF', 'NIMETHIBITISHA HANDOFF'),
            report: copy('REPORT AN ISSUE', 'RIPOTI TATIZO'),
        }
        : isIntercityOrder
            ? {
                title: copy('Confirm pickup', 'Thibitisha pickup'),
                body: copy('After collecting the package from the terminal or cargo office and checking that it is safe, confirm so the merchant can be paid. If there is a problem, report it.', 'Ukishachukua mzigo kwenye terminal au ofisi ya cargo na umeukagua uko salama, thibitisha ili muuzaji alipwe. Kama kuna tatizo, fungua ripoti.'),
                confirm: copy('I RECEIVED THE PACKAGE', 'NIMEPOKEA MZIGO'),
                report: copy('REPORT AN ISSUE', 'RIPOTI TATIZO'),
            }
            : {
                title: copy('Confirm package', 'Thibitisha mzigo'),
                body: copy('Did you receive your package in good condition? Confirm so the merchant can be paid, or report a problem if needed.', 'Je, umepokea mzigo wako na uko salama? Thibitisha ili muuzaji alipwe au fungua madai kama kuna tatizo.'),
                confirm: copy('YES, I RECEIVED IT', 'NDIO, NIMEPOKEA'),
                report: copy('NOT RECEIVED / ISSUE', 'SIJAPATA / TATIZO'),
            };
    const isDeliveryStageOrder = Boolean(
        order?.delivery
        && !isSelfPickupOrder
        && (
            deliveryStageStatuses.includes(order.delivery.delivery_status || order.delivery.status)
            || ['release_eligible', 'payout_processing'].includes(order?.payment_status)
        )
    );
    const agreementActionDesc = serviceOrder
        ? copy('Service scope, timing, or cost', 'Scope, muda au gharama ya huduma')
        : customDigitalOrder
            ? copy('Scope, files, or revisions', 'Scope, files au revisions')
            : copy('Order agreement', 'Makubaliano ya oda');
    const merchantQuickActions = physicalOrder ? [
        { id: 'shipping_cost', label: isForwarderOrder ? copy('Forwarder drop-off', 'Forwarder drop-off') : copy('Shipping cost', 'Gharama ya usafiri'), icon: Truck, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100', desc: isForwarderOrder ? copy('Cost to forwarder', 'Gharama hadi forwarder') : copy('Set the cost here', 'Weka gharama hapa'), disabled: order?.delivery?.delivery_type === 'self_pickup' || isDeliveryStageOrder, disabledReason: isDeliveryStageOrder ? copy('DELIVERY ACTIVE', 'DELIVERY INAENDELEA') : copy('PICKUP ONLY', 'PICKUP PEKEE') },
        { id: 'discount', label: copy('Discount', 'Punguzo'), icon: Tag, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100', desc: copy('Reduce the order price', 'Punguza bei ya oda'), disabled: isDeliveryStageOrder, disabledReason: copy('DELIVERY ACTIVE', 'DELIVERY INAENDELEA') },
        { id: 'extra_charge', label: copy('Extra charge', 'Gharama ya ziada'), icon: CreditCard, color: 'bg-orange-50 text-orange-600', border: 'border-orange-100', desc: activeExtraCharge?.status === 'proposed' ? copy('Update/remove charge', 'Sasisha/ondoa gharama') : copy('Storage or another cost', 'Ghala au gharama nyingine'), disabled: !canProposeExtraCharge && !canRemoveExtraCharge, disabledReason: copy('PICKUP ONLY', 'PICKUP PEKEE') },
        { id: 'extend_lock', label: copy('Extend time', 'Ongeza muda'), icon: Clock, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100', desc: copy('Extend stock lock by 30 minutes', 'Ongeza lock ya stock kwa dk 30'), disabled: order?.payment_status !== 'pending' || isDeliveryStageOrder, disabledReason: isDeliveryStageOrder ? copy('DELIVERY ACTIVE', 'DELIVERY INAENDELEA') : copy('PENDING ONLY', 'INASUBIRI TU') },
        { id: 'release_stock', label: copy('Release stock', 'Achia stock'), icon: X, color: 'bg-slate-50 text-slate-600', border: 'border-slate-100', desc: copy('Stop and return stock', 'Sitisha na rudisha stock'), disabled: order?.payment_status !== 'pending' || isDeliveryStageOrder, disabledReason: isDeliveryStageOrder ? copy('DELIVERY ACTIVE', 'DELIVERY INAENDELEA') : copy('PENDING ONLY', 'INASUBIRI TU') },
        { id: 'upsell', label: copy('Recommend products', 'Pendekeza bidhaa'), icon: Plus, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100', desc: copy('Sell more here', 'Uza zaidi hapa'), disabled: isDeliveryStageOrder, disabledReason: copy('DELIVERY ACTIVE', 'DELIVERY INAENDELEA') },
        { id: 'shipping_proof', label: copy('Waybill & video', 'Waybill na video'), icon: ShieldCheck, color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100', desc: copy('Shipping evidence', 'Ushahidi wa safari'), disabled: order?.delivery?.delivery_type === 'self_pickup', disabledReason: copy('PICKUP ONLY', 'PICKUP PEKEE') },
    ] : [
        { id: 'discount', label: copy('Discount', 'Punguzo'), icon: Tag, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100', desc: copy('Reduce the offer/order price', 'Punguza offer/bei ya oda') },
        { id: 'extend_lock', label: copy('Extend time', 'Ongeza muda'), icon: Clock, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100', desc: copy('Extend payment time', 'Ongeza muda wa kulipa'), disabled: order?.payment_status !== 'pending', disabledReason: copy('PENDING ONLY', 'INASUBIRI TU') },
        { id: 'release_stock', label: copy('Cancel order', 'Sitisha oda'), icon: X, color: 'bg-slate-50 text-slate-600', border: 'border-slate-100', desc: copy('Close this enquiry', 'Funga enquiry hii'), disabled: order?.payment_status !== 'pending', disabledReason: 'PENDING ONLY' },
        { id: 'upsell', label: serviceOrder ? copy('Recommend service', 'Pendekeza huduma') : copy('Recommend digital', 'Pendekeza digital'), icon: Plus, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100', desc: agreementActionDesc },
    ];
    const buyerQuickActions = physicalOrder ? [
        { id: 'shop_locations', label: copy('Shop locations', 'Maeneo ya shop'), icon: MapPin, color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100', desc: copy('See where the shop is', 'Ona duka lilipo'), disabled: isDeliveryStageOrder, disabledReason: 'DELIVERY ACTIVE' },
        { id: 'order_delivery', label: copy('Delivery', 'Usafirishaji'), icon: Truck, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100', desc: copy('Change delivery vs pickup', 'Badili delivery dhidi ya pickup'), disabled: isDeliveryStageOrder, disabledReason: 'DELIVERY ACTIVE' },
        { id: 'order_items', label: copy('Order', 'Oda'), icon: ShoppingBag, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100', desc: copy('View and change items', 'Ona na badili vitu'), disabled: isDeliveryStageOrder, disabledReason: 'DELIVERY ACTIVE' },
        { id: 'upsell', label: copy('More products', 'Bidhaa zaidi'), icon: Plus, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100', desc: copy('Other products from this shop', 'Vitu vingine vya duka hili'), disabled: isDeliveryStageOrder, disabledReason: 'DELIVERY ACTIVE' },
        { id: 'complaint', label: copy('Complaint centre', 'Kituo cha malalamiko'), icon: AlertCircle, color: 'bg-red-50 text-red-600', border: 'border-red-100', desc: copy('Make a complaint', 'Toa malalamiko') },
        { id: 'unboxing_video', label: copy('Unboxing video', 'Video ya unboxing'), icon: Video, color: 'bg-indigo-50 text-indigo-600', border: 'border-indigo-100', desc: copy('Proof of receipt', 'Ushahidi wa kupokea') },
        { id: 'review', label: copy('Review', 'Review'), icon: Star, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100', desc: copy('Share your feedback', 'Toa maoni yako') },
    ] : [
        { id: 'order_items', label: serviceOrder ? copy('Service', 'Huduma') : copy('Digital order', 'Oda ya digital'), icon: IntentIcon, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100', desc: copy('View agreement and total', 'Ona makubaliano na jumla') },
        { id: 'upsell', label: serviceOrder ? copy('More services', 'Huduma zaidi') : copy('More digital', 'Digital zaidi'), icon: Plus, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100', desc: agreementActionDesc },
        { id: 'complaint', label: copy('Complaint centre', 'Kituo cha malalamiko'), icon: AlertCircle, color: 'bg-red-50 text-red-600', border: 'border-red-100', desc: copy('Make a complaint', 'Toa malalamiko') },
        { id: 'review', label: copy('Review', 'Review'), icon: Star, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100', desc: copy('Share your feedback', 'Toa maoni yako') },
    ];

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('checkout') !== '1') return;
        if (actingAs !== 'buyer' || order?.payment_status !== 'pending' || !canBuyerPay) return;

        setIsPaymentDrawerOpen(true);
        params.delete('checkout');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }, [actingAs, canBuyerPay, order?.payment_status]);

    return (
        <AppLayout>
            <Head title={`${copy('Order chat', 'Chat ya oda')} #${publicId?.substring(0, 8)} | Takeer`} />

            <div className="relative flex h-[calc(100vh-64px)] min-h-0 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
                {/* Fixed Order Header */}
                <div className="sticky top-0 z-30 px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-brand-100 dark:border-brand-900/50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 shrink-0">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                                <IntentIcon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-brand-900 dark:text-brand-100 uppercase tracking-tight">{copy('Order', 'Oda')} #{publicId?.substring(0, 8)}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black py-0.5 px-2 bg-brand-50 text-brand-600 rounded-full border border-brand-100 uppercase tracking-tighter">
                                        {intentMeta.label}
                                    </span>
                                    <span className={cn(
                                        "text-[10px] font-black py-0.5 px-2 rounded-full uppercase tracking-tighter border",
                                        ['paid_out', 'pending_fulfillment', 'release_eligible', 'payout_processing'].includes(order?.payment_status) || orderStatus === 'delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                            order?.payment_status === 'failed' ? "bg-red-50 text-red-600 border-red-100" :
                                                "bg-amber-50 text-amber-600 border-amber-100"
                                    )}>
                                        {currentStatus.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end">
                            <p className="text-[9px] font-black text-brand-600/60 uppercase tracking-widest leading-none mb-1">{copy('Order total', 'Jumla ya oda')}</p>
                            <p className="text-lg font-black text-brand-800 dark:text-brand-200 tracking-tighter leading-none">TZS {dealTotal.toLocaleString()}</p>
                            <div className="flex gap-2 text-[9px] font-bold text-slate-400 mt-1">
                                <span>{intentMeta.totalLabel}: {itemsSubtotal.toLocaleString()}</span>
                                {shippingTotal > 0 && (
                                    <span className="text-emerald-500 font-black">+ {copy('Shipping', 'Usafiri')}: {shippingTotal.toLocaleString()}</span>
                                )}
                                {discountTotal > 0 && (
                                    <span className="text-amber-600 font-black">- {copy('Discount', 'Punguzo')}: {discountTotal.toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Current Deal */}
                <div className="shrink-0 px-4 pt-3">
                    <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                        <button
                            type="button"
                            aria-expanded={isDealExpanded}
                            onClick={() => setIsDealExpanded((value) => !value)}
                            className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-950"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy('Order', 'Oda')}</p>
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${currentStatus.tone}`}>
                                        {currentStatus.label}
                                    </span>
                                </div>
                                <p className="mt-1 text-lg font-black tracking-tight text-slate-950 dark:text-slate-100">
                                    TZS {dealTotal.toLocaleString()}
                                </p>
                                <p className="mt-0.5 text-[10px] font-bold text-slate-500">
                                    {dealSummaryParts.join(' · ')}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="inline-flex rounded-xl bg-brand-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-700">
                                    {isDealExpanded ? copy('Hide', 'Ficha') : `${copy('View', 'Ona')} ${intentMeta.itemLabel}`}
                                </span>
                                <ChevronDown className={cn("h-5 w-5 text-slate-400 transition-transform duration-300", isDealExpanded && "rotate-180")} />
                            </div>
                        </button>

                        <div
                            aria-hidden={!isDealExpanded}
                            className={cn(
                                "grid border-t border-slate-100 transition-[grid-template-rows,opacity,border-color] duration-300 ease-out dark:border-slate-800",
                                isDealExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] border-transparent opacity-0 dark:border-transparent"
                            )}
                        >
                            <div className="overflow-hidden">
                                <div className="p-3">
                                    <OrderSelectionSummaryCard
                                        items={orderItems}
                                        subtotal={itemsSubtotal}
                                        shipping={shippingTotal}
                                        discount={discountTotal}
                                        total={dealTotal}
                                    />

                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
                                        <span>{deliveryCopy(order, copy)}</span>
                                        {agreedAt && <span>{new Date(agreedAt).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(canBuyerPay || canMerchantQuote || canMerchantConfirmUnpaid || canCancelBeforePayment || canRequestPickupExtension || canResolvePickupExtension || canProposeExtraCharge || canAcceptExtraCharge || canRequestDeliveryConversion || canQuoteDeliveryConversion || canAcceptDeliveryConversion) && (
                            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                                {canBuyerPay && (
                                    <Button
                                        onClick={() => setIsPaymentDrawerOpen(true)}
                                        className="h-9 rounded-xl bg-brand-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-brand-700"
                                    >
                                        <Zap className="mr-1.5 h-3.5 w-3.5 fill-white" />
                                        {copy('Accept & pay', 'Kubali na lipa')}
                                    </Button>
                                )}
                                {canMerchantQuote && (
                                    <Button
                                        onClick={() => {
                                            setShippingFeeInput(order?.shipping_fee !== null && order?.shipping_fee !== undefined ? String(order.shipping_fee) : '');
                                            setActiveAction(null);
                                        }}
                                        className="h-9 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800"
                                    >
                                        <Save className="mr-1.5 h-3.5 w-3.5" />
                                        {copy('Send offer', 'Tuma offer')}
                                    </Button>
                                )}
                                {canMerchantConfirmUnpaid && (
                                    <Button
                                        onClick={confirmAvailability}
                                        disabled={confirmingAvailability}
                                        className="h-9 rounded-xl bg-emerald-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                    >
                                        {confirmingAvailability ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                        {copy('Confirm available', 'Thibitisha inapatikana')}
                                    </Button>
                                )}
                                {canCancelBeforePayment && (
                                    <Button
                                        variant="outline"
                                        onClick={() => submitAction('cancel_order', { title: 'Order cancelled', reason: `${actingAs} cancelled before payment.` })}
                                        className="h-9 rounded-xl border-red-100 px-4 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                                    >
                                        <X className="mr-1.5 h-3.5 w-3.5" />
                                        {copy('Cancel', 'Ghairi')}
                                    </Button>
                                )}
                                {canRequestPickupExtension && (
                                    <Button
                                        variant="outline"
                                        onClick={() => openPickupActionForm('extension_request')}
                                        disabled={pickupActionSubmitting}
                                        className="h-9 rounded-xl border-sky-100 px-4 text-[10px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-50"
                                    >
                                        {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Clock className="mr-1.5 h-3.5 w-3.5" />}
                                        {copy('Request pickup time', 'Omba muda wa pickup')}
                                    </Button>
                                )}
                                {canResolvePickupExtension && (
                                    <>
                                        <Button
                                            onClick={() => resolvePickupExtension('approved', pendingPickupExtension?.id)}
                                            disabled={pickupActionSubmitting}
                                            className="h-9 rounded-xl bg-emerald-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                        >
                                            {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                            {copy('Approve pickup time', 'Kubali muda wa pickup')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => resolvePickupExtension('rejected', pendingPickupExtension?.id)}
                                            disabled={pickupActionSubmitting}
                                            className="h-9 rounded-xl border-red-100 px-4 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                                        >
                                            <X className="mr-1.5 h-3.5 w-3.5" />
                                            {copy('Reject time', 'Kataa muda')}
                                        </Button>
                                    </>
                                )}
                                {canProposeExtraCharge && (
                                    <Button
                                        onClick={openExtraChargeForm}
                                        disabled={pickupActionSubmitting}
                                        className="h-9 rounded-xl bg-amber-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-amber-700"
                                    >
                                        {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Tag className="mr-1.5 h-3.5 w-3.5" />}
                                        {copy('Add extra cost', 'Ongeza gharama ya ziada')}
                                    </Button>
                                )}
                                {canCancelPickupAfterGrace && (
                                    <Button
                                        variant="outline"
                                        onClick={cancelPickupAfterGrace}
                                        disabled={pickupActionSubmitting}
                                        className="h-9 rounded-xl border-red-100 px-4 text-[10px] font-black uppercase tracking-widest text-red-700 hover:bg-red-50"
                                    >
                                        {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                                        {copy('Cancel pickup', 'Ghairi pickup')}
                                    </Button>
                                )}
                                {canAcceptExtraCharge && (
                                    <Button
                                        onClick={() => openPickupActionForm('extra_charge_payment')}
                                        disabled={pickupActionSubmitting}
                                        className="h-9 rounded-xl bg-emerald-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                    >
                                        {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                        {copy('Accept & pay extra cost', 'Kubali na lipa gharama ya ziada')}
                                    </Button>
                                )}
                                {canRequestDeliveryConversion && (
                                    <Button
                                        variant="outline"
                                        onClick={() => openPickupActionForm('delivery_conversion_request')}
                                        disabled={pickupActionSubmitting}
                                        className="h-9 rounded-xl border-emerald-100 px-4 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-50"
                                    >
                                        <Truck className="mr-1.5 h-3.5 w-3.5" />
                                        {copy('Request delivery', 'Omba delivery')}
                                    </Button>
                                )}
                                {canQuoteDeliveryConversion && (
                                    <Button
                                        onClick={() => openPickupActionForm('delivery_conversion_quote')}
                                        disabled={pickupActionSubmitting}
                                        className="h-9 rounded-xl bg-sky-700 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-sky-800"
                                    >
                                        <Truck className="mr-1.5 h-3.5 w-3.5" />
                                        {copy('Quote delivery', 'Tuma quote ya delivery')}
                                    </Button>
                                )}
                                {canAcceptDeliveryConversion && (
                                    <Button
                                        onClick={() => openPickupActionForm('delivery_conversion_payment')}
                                        disabled={pickupActionSubmitting}
                                        className="h-9 rounded-xl bg-emerald-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                    >
                                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                        {copy('Accept & pay delivery', 'Kubali na lipa delivery')}
                                    </Button>
                                )}
                                {expiryLabel && (
                                    <span className={cn(
                                        "inline-flex h-9 items-center rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest",
                                        expiryLabel === 'Expired'
                                            ? "border-red-100 bg-red-50 text-red-600"
                                            : "border-amber-100 bg-amber-50 text-amber-700"
                                    )}>
                                        <Clock className="mr-1.5 h-3.5 w-3.5" />
                                        {expiryLabel}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat History */}
                <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-60">
                            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-sm font-medium">{copy('Safe Chat for order', 'Safe-Chat kwa oda')} #{publicId?.substring(0, 8)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{copy('All messages are securely recorded in case a dispute occurs.', 'Ujumbe wote unawekwa kwenye kumbukumbu kwa usalama iwapo kutatokea mgogoro (Dispute).')}</p>
                        </div>
                    )}

                    <div className="max-w-3xl mx-auto w-full space-y-8">
                        {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                            <div key={dateLabel} className="space-y-6">
                                <div className="flex justify-center my-8 relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200/60 dark:border-slate-800/60" /></div>
                                    <span className="relative px-4 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                                        {dateLabel}
                                    </span>
                                </div>

                                {msgs.map((msg) => {
                                    const isSystem = msg.type === 'system';
                                    const isAction = msg.type === 'action';

                                    // Deterministic role binding based on acting_as or real sender.
                                    const msgActingAs = msg.payload?.acting_as
                                        || (msg.sender_id
                                            ? (msg.sender_id === order.merchant?.user_id ? 'merchant' : 'buyer')
                                            : 'system');
                                    const isMe = msgActingAs === actingAs;

                                    const getSenderName = () => {
                                        if (isMe) return copy('You', 'Wewe');
                                        if (msgActingAs === 'merchant') return copy('Merchant', 'Muuzaji');
                                        if (msgActingAs === 'system') return 'Takeer';
                                        if (order?.account_phone) {
                                            const p = order.account_phone;
                                            return p.substring(0, 4) + '***' + p.slice(-3);
                                        }
                                        return copy('Buyer', 'Mteja');
                                    };
                                    const renderedName = getSenderName();
                                    const displayedBody = sanitizeChatBody(isSystem ? roleAwareSystemBody(msg, actingAs, order, copy) : msg.body, copy);

                                    if (isSystem) {
                                        if (msgActingAs !== 'system') {
                                            return (
                                                <div key={msg.id} className={cn("flex w-full mb-3 items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                                                    {!isMe && (
                                                        <ChatRoleAvatar role={msgActingAs} className="mb-1 h-8 w-8" />
                                                    )}
                                                    <div className={cn("max-w-[520px] flex flex-col gap-1 min-w-0", isMe ? "items-end" : "items-start")}>
                                                        <span className="text-[9px] font-semibold text-slate-400 px-1">{renderedName}</span>
                                                        <div className={cn(
                                                            "px-4 py-3 rounded-2xl shadow-sm border text-sm font-bold leading-relaxed whitespace-pre-wrap break-words",
                                                            isMe
                                                                ? "bg-brand-600 text-white rounded-br-sm border-brand-600"
                                                                : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-sm border-slate-100 dark:border-slate-800"
                                                        )}>
                                                            <div>{displayedBody}</div>
                                                            <div className={cn("mt-1 flex items-center justify-end gap-1 text-[9px] font-black uppercase tracking-widest", isMe ? "text-white/50" : "text-slate-400")}>
                                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isMe && (
                                                        <ChatRoleAvatar role={msgActingAs} className="mb-1 h-8 w-8" />
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={msg.id} className="flex justify-center my-2">
                                                <div className="text-[11px] font-bold text-center text-brand-700/80 dark:text-brand-300/80 bg-brand-50/80 dark:bg-brand-900/40 px-4 py-2 rounded-2xl max-w-[85%] leading-relaxed border border-brand-100/50 shadow-sm">
                                                    <div className="whitespace-pre-wrap">{displayedBody}</div>
                                                    <ChatNoticeTimestamp value={msg.created_at} className="text-brand-500/60 dark:text-brand-200/50" />
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (isAction) {
                                        const actionType = msg.payload?.action_type;
                                        if (actionType === 'suggest_product') {
                                            const p = msg.payload?.product;
                                            const productUrl = p?.id ? `/product/${p.id}` : null;
                                            return (
                                                <div key={msg.id} className={cn("flex w-full my-6", isMe ? "justify-end" : "justify-start")}>
                                                    <div className="flex flex-col" style={{ width: 'min(356px, 82%)' }}>
                                                        <div className={cn("flex items-center gap-2 mb-2 opacity-60", isMe ? "justify-end" : "justify-start")}>
                                                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{renderedName}</span>
                                                        </div>
                                                        <div
                                                            role={productUrl ? 'link' : undefined}
                                                            tabIndex={productUrl ? 0 : undefined}
                                                            onClick={() => productUrl && window.open(productUrl, '_blank', 'noopener,noreferrer')}
                                                            onKeyDown={(event) => {
                                                                if (!productUrl || !['Enter', ' '].includes(event.key)) return;
                                                                event.preventDefault();
                                                                window.open(productUrl, '_blank', 'noopener,noreferrer');
                                                            }}
                                                            className={cn(
                                                                "relative group w-full min-w-48 overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/50 transition-all sm:min-w-64",
                                                                productUrl && "cursor-pointer hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-brand-100"
                                                            )}
                                                            title={productUrl ? copy('Open product details', 'Fungua maelezo ya bidhaa') : undefined}
                                                        >
                                                            {p.image && <img src={p.image} className="h-auto max-h-80 w-full object-contain bg-slate-50 opacity-90 transition-opacity group-hover:opacity-100" alt={p.title || copy('Product', 'Bidhaa')} />}
                                                            <div className="p-5">
                                                                <h4 className="mb-1 whitespace-normal break-words font-black leading-snug text-brand-900">{p.title}</h4>
                                                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                                                    <span className="text-xl font-black text-brand-600">TZS {Number(p.price).toLocaleString()}</span>
                                                                    {productUrl && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">
                                                                            {copy('Details', 'Maelezo')} <ExternalLink className="h-3 w-3" />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {order?.payment_status !== 'failed' && !isMe && (
                                                                    <Button
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            submitAction('add_to_order', {
                                                                                product: {
                                                                                    id: p.id,
                                                                                    variant_id: p.variant_id,
                                                                                    title: p.title, // already includes variant name if suggested from modal
                                                                                    price: p.price,
                                                                                    image: p.image,
                                                                                    quantity: 1,
                                                                                    type: p.type,
                                                                                    product_type: p.product_type || p.type,
                                                                                    digital_delivery_type: p.digital_delivery_type,
                                                                                    digital_content_type: p.digital_content_type,
                                                                                    service_location_type: p.service_location_type
                                                                                },
                                                                                title: `ONGEZA ${p.title.toUpperCase()}`
                                                                            });
                                                                        }}
                                                                        className="w-full h-12 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black uppercase text-xs tracking-widest flex items-center gap-2"
                                                                    >
                                                                        <Plus className="h-4 w-4" /> {copy('ADD TO ORDER', 'WEKA KWENYE ODA')}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (actionType === 'add_to_order') {
                                            const item = msg.payload?.product;
                                            return (
                                                <div key={msg.id} className={cn("flex w-full my-4", isMe ? "justify-end" : "justify-start")}>
                                                    <div className={cn("flex max-w-[356px] flex-col gap-1", isMe ? "items-end" : "items-start")}>
                                                        <span className="px-1 text-[9px] font-semibold text-slate-400">{renderedName}</span>
                                                        <div className={cn(
                                                            "flex w-full items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm dark:bg-slate-900",
                                                            isMe ? "rounded-br-sm border-brand-100" : "rounded-bl-sm border-slate-100 dark:border-slate-800"
                                                        )}>
                                                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 flex items-center justify-center">
                                                                {item?.image ? (
                                                                    <img src={item.image} alt={item?.title || copy('Added product', 'Bidhaa iliyoongezwa')} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <ShoppingBag className="h-6 w-6" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="mb-1 flex items-center gap-1.5 text-emerald-600">
                                                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                                                    <span className="text-[9px] font-black uppercase tracking-widest">{copy('Added to order', 'Imeongezwa kwenye oda')}</span>
                                                                </div>
                                                                <p className="line-clamp-2 text-sm font-black leading-snug text-slate-900 dark:text-slate-100">
                                                                    {item?.title || displayedBody}
                                                                </p>
                                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                    <span>{Number(item?.quantity || 1).toLocaleString()} {copy(Number(item?.quantity || 1) === 1 ? 'item' : 'items', Number(item?.quantity || 1) === 1 ? 'item' : 'items')}</span>
                                                                    <span>TZS {Number(item?.price || 0).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className="px-1 text-[9px] font-bold text-slate-300">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (['update_item_quantity', 'remove_item'].includes(actionType)) {
                                            const actorName = msg.payload?.actor_name || msg.sender?.name || renderedName;
                                            const productTitle = msg.payload?.product_title || msg.payload?.title || displayedBody?.replace(/^(Ongeza|Punguza|Ondoa)\s+/i, '') || 'item';
                                            const label = actionType === 'remove_item'
                                                ? `${actorName} removed ${productTitle} from the order`
                                                : `${actorName} updated quantity for ${productTitle} to`;
                                            const quantity = msg.payload?.quantity;
                                            const ActorIcon = msgActingAs === 'merchant' ? Store : UserRound;

                                            return (
                                                <div key={msg.id} className="flex justify-center my-2">
                                                    <div className="max-w-[85%] rounded-2xl border border-brand-100/60 bg-brand-50/80 px-4 py-2 text-center text-[11px] font-bold leading-relaxed text-brand-700/90 shadow-sm dark:border-brand-900/40 dark:bg-brand-900/40 dark:text-brand-200">
                                                        <div className="inline-flex items-center gap-2">
                                                            <ActorIcon className="h-3.5 w-3.5 shrink-0" />
                                                            <span>
                                                                {label}
                                                                {quantity ? ` ${Number(quantity).toLocaleString()}` : ''}
                                                            </span>
                                                        </div>
                                                        <ChatNoticeTimestamp value={msg.created_at} className="text-brand-500/60 dark:text-brand-200/50" />
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (actionType === 'pickup_verified') {
                                            const actorName = msg.payload?.actor_name || msg.sender?.name || renderedName;
                                            const merchantName = msg.payload?.merchant_name || 'merchant';

                                            return (
                                                <div key={msg.id} className="flex justify-center my-2">
                                                    <div className="max-w-[85%] rounded-2xl border border-emerald-100/70 bg-emerald-50/80 px-4 py-2 text-center text-[11px] font-bold leading-relaxed text-emerald-800 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-100">
                                                        <div className="inline-flex items-center gap-2">
                                                            <Store className="h-3.5 w-3.5 shrink-0" />
                                                            <span>{actorName} confirmed pickup for {merchantName} and released this order.</span>
                                                        </div>
                                                        <ChatNoticeTimestamp value={msg.created_at} className="text-emerald-600/60 dark:text-emerald-100/50" />
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (['pickup_window_expired', 'pickup_cancelled_after_grace', 'pickup_extension_requested', 'pickup_extension_approved', 'pickup_extension_rejected', 'extra_charge_proposed', 'extra_charge_removed', 'extra_charge_payment_started', 'extra_charge_paid_held', 'delivery_conversion_requested', 'delivery_conversion_quoted', 'delivery_conversion_payment_started', 'delivery_conversion_paid_held'].includes(actionType)) {
                                            const requestedDeadline = msg.payload?.requested_deadline_at
                                                ? new Date(msg.payload.requested_deadline_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                                                : null;
                                            const pickupDeadline = msg.payload?.pickup_deadline_at
                                                ? new Date(msg.payload.pickup_deadline_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                                                : null;
                                            const amount = Number(msg.payload?.amount || 0);
                                            const isPickupWindowExpired = actionType === 'pickup_window_expired';
                                            const isPickupCancelledAfterGrace = actionType === 'pickup_cancelled_after_grace';
                                            const isExtensionRequest = actionType === 'pickup_extension_requested';
                                            const isExtensionApproved = actionType === 'pickup_extension_approved';
                                            const isExtensionRejected = actionType === 'pickup_extension_rejected';
                                            const isActiveExtensionRequest = isExtensionRequest
                                                && Boolean(pendingPickupExtension?.id)
                                                && Boolean(msg.payload?.extension_id)
                                                && pendingPickupExtension?.status === 'pending'
                                                && String(pendingPickupExtension?.id || '') === String(msg.payload?.extension_id || '');
                                            const isExtraChargeProposal = actionType === 'extra_charge_proposed';
                                            const isExtraChargeRemoved = actionType === 'extra_charge_removed';
                                            const isExtraChargePaymentStarted = actionType === 'extra_charge_payment_started';
                                            const isExtraChargePaidHeld = actionType === 'extra_charge_paid_held';
                                            const isActiveExtraChargeProposal = isExtraChargeProposal
                                                && activeExtraCharge?.status === 'proposed'
                                                && String(activeExtraCharge?.id || '') === String(msg.payload?.proposal_id || '');
                                            const isActiveExtraChargePaymentPending = isExtraChargePaymentStarted
                                                && activeExtraCharge?.status === 'payment_pending'
                                                && String(activeExtraCharge?.id || '') === String(msg.payload?.proposal_id || '');
                                            const isDeliveryConversionRequested = actionType === 'delivery_conversion_requested';
                                            const isDeliveryConversionQuoted = actionType === 'delivery_conversion_quoted';
                                            const isDeliveryConversionPaymentStarted = actionType === 'delivery_conversion_payment_started';
                                            const isDeliveryConversionPaidHeld = actionType === 'delivery_conversion_paid_held';
                                            const tone = isExtensionRejected || isPickupCancelledAfterGrace || isExtraChargeRemoved
                                                ? 'border-red-100 bg-red-50 text-red-800'
                                                : isPickupWindowExpired || isExtraChargeProposal || isExtraChargePaymentStarted
                                                    ? 'border-amber-100 bg-amber-50 text-amber-900'
                                                    : isExtraChargePaidHeld || isDeliveryConversionPaidHeld
                                                        ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
                                                        : (isDeliveryConversionRequested || isDeliveryConversionQuoted || isDeliveryConversionPaymentStarted)
                                                            ? 'border-sky-100 bg-sky-50 text-sky-900'
                                                            : 'border-sky-100 bg-sky-50 text-sky-900';
                                            const Icon = (isPickupWindowExpired || isPickupCancelledAfterGrace) ? AlertTriangle : (isExtraChargeProposal || isExtraChargeRemoved || isExtraChargePaymentStarted || isExtraChargePaidHeld ? Tag : (isDeliveryConversionRequested || isDeliveryConversionQuoted || isDeliveryConversionPaymentStarted || isDeliveryConversionPaidHeld ? Truck : Clock));
                                            const title = isPickupWindowExpired
                                                ? copy('Pickup window expired', 'Muda wa pickup umeisha')
                                                : isPickupCancelledAfterGrace
                                                    ? copy('Pickup cancelled', 'Pickup imeghairiwa')
                                                    : isExtensionRequest
                                                        ? copy('Pickup extension requested', 'Ombi la kuongeza muda wa pickup')
                                                        : isExtensionApproved
                                                            ? copy('Pickup time approved', 'Muda wa pickup umeidhinishwa')
                                                            : isExtensionRejected
                                                                ? copy('Pickup extension rejected', 'Ombi la kuongeza muda wa pickup limekataliwa')
                                                                : isExtraChargeProposal
                                                                    ? copy('Extra cost proposed', 'Gharama ya ziada imependekezwa')
                                                                    : isExtraChargeRemoved
                                                                        ? copy('Extra cost removed', 'Gharama ya ziada imeondolewa')
                                                                        : isExtraChargePaidHeld
                                                                            ? copy('Extra cost paid & held', 'Gharama ya ziada imelipwa na kushikiliwa')
                                                                            : isExtraChargePaymentStarted
                                                                                ? copy('Extra cost payment started', 'Malipo ya gharama ya ziada yameanza')
                                                                                : isDeliveryConversionRequested
                                                                                    ? copy('Delivery requested', 'Delivery imeombwa')
                                                                                    : isDeliveryConversionQuoted
                                                                                        ? copy('Delivery fee quoted', 'Gharama ya delivery imenukuliwa')
                                                                                        : isDeliveryConversionPaidHeld
                                                                                            ? copy('Delivery fee paid & held', 'Gharama ya delivery imelipwa na kushikiliwa')
                                                                                            : copy('Delivery payment started', 'Malipo ya delivery yameanza');
                                            const body = isPickupWindowExpired
                                                ? copy('The pickup window has passed. Agree on the next step here in chat: extend the time, switch to delivery, add an extra cost, or cancel.', 'Muda wa pickup umepita. Kubalianeni hatua inayofuata hapa kwenye chat: kuongeza muda, kubadili kwenda delivery, kuweka gharama ya ziada, au cancellation.')
                                                : isPickupCancelledAfterGrace
                                                    ? copy(`The pickup deadline passed without pickup. The order was cancelled; a TZS ${Number(msg.payload?.penalty_amount || 0).toLocaleString()} penalty went to the merchant and a TZS ${Number(msg.payload?.refund_amount || 0).toLocaleString()} refund is awaiting admin approval.`, `Pickup deadline imepita bila pickup. Order imefutwa; penalty TZS ${Number(msg.payload?.penalty_amount || 0).toLocaleString()} imeenda kwa merchant na refund TZS ${Number(msg.payload?.refund_amount || 0).toLocaleString()} inasubiri approval ya admin.`)
                                                    : isExtensionRequest
                                                        ? copy(`The buyer requested pickup until ${requestedDeadline || 'the proposed new time'}.`, `Mteja ameomba kuchukua mpaka ${requestedDeadline || 'muda mpya uliopendekezwa'}.`)
                                                        : isExtensionApproved
                                                            ? copy(`The new pickup time for the order is ${pickupDeadline || 'confirmed'}.`, `Muda mpya wa kuchukua order ni ${pickupDeadline || 'umethibitishwa'}.`)
                                                            : isExtensionRejected
                                                                ? copy('The merchant rejected the pickup extension request.', 'Muuzaji amekataa ombi la kuongeza muda wa pickup.')
                                                                : isExtraChargeProposal
                                                                    ? copy(`The merchant requested an extra cost of TZS ${amount.toLocaleString()}.`, `Muuzaji ameomba gharama ya ziada ya TZS ${amount.toLocaleString()}.`)
                                                                    : isExtraChargeRemoved
                                                                        ? copy(`The merchant removed the extra cost proposal of TZS ${amount.toLocaleString()}.`, `Muuzaji ameondoa proposal ya gharama ya ziada ya TZS ${amount.toLocaleString()}.`)
                                                                        : isExtraChargePaidHeld
                                                                            ? copy(`The extra cost of TZS ${amount.toLocaleString()} was paid by the buyer.`, `Gharama ya ziada ya TZS ${amount.toLocaleString()} imelipwa na mteja.`)
                                                                            : isExtraChargePaymentStarted
                                                                                ? copy(`The buyer accepted the extra cost of TZS ${amount.toLocaleString()} and started payment.`, `Mteja amekubali gharama ya ziada ya TZS ${amount.toLocaleString()} na ameanza malipo.`)
                                                                                : isDeliveryConversionRequested
                                                                                    ? copy(`The buyer requested changing the order from pickup to delivery${msg.payload?.physical_address ? `: ${msg.payload.physical_address}` : ''}.`, `Mteja ameomba order ibadilishwe kutoka pickup kwenda delivery${msg.payload?.physical_address ? `: ${msg.payload.physical_address}` : ''}.`)
                                                                                    : isDeliveryConversionQuoted
                                                                                        ? copy(`The merchant quoted a delivery fee of TZS ${Number(msg.payload?.shipping_fee || 0).toLocaleString()}.`, `Muuzaji ameweka gharama ya delivery: TZS ${Number(msg.payload?.shipping_fee || 0).toLocaleString()}.`)
                                                                                        : isDeliveryConversionPaidHeld
                                                                                            ? copy(`The TZS ${Number(msg.payload?.shipping_fee || 0).toLocaleString()} delivery fee was paid through the PSP; the order payout follows delivery completion.`, `Delivery fee ya TZS ${Number(msg.payload?.shipping_fee || 0).toLocaleString()} imelipwa kupitia PSP; payout ya order itafuata baada ya delivery.`)
                                                                                            : copy(`The buyer accepted the TZS ${Number(msg.payload?.shipping_fee || 0).toLocaleString()} delivery fee and started payment.`, `Mteja amekubali delivery fee ya TZS ${Number(msg.payload?.shipping_fee || 0).toLocaleString()} na ameanza malipo.`);

                                            return (
                                                <div key={msg.id} className="flex justify-center my-3">
                                                    <div className={cn("w-full max-w-[620px] rounded-2xl border px-4 py-3 shadow-sm", tone)}>
                                                        <div className="flex items-start gap-3">
                                                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                                                                <Icon className="h-4 w-4" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{copy('Pickup Agreement', 'Makubaliano ya pickup')}</p>
                                                                <h4 className="mt-0.5 text-sm font-black uppercase tracking-wide">{title}</h4>
                                                                <p className="mt-1 text-sm font-bold leading-relaxed opacity-90">{body}</p>
                                                                {msg.payload?.reason && (
                                                                    <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold italic text-slate-700">"{msg.payload.reason}"</p>
                                                                )}
                                                                {msg.payload?.note && (
                                                                    <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold italic text-slate-700">"{msg.payload.note}"</p>
                                                                )}
                                                                {(isExtensionRequest && isActiveExtensionRequest && actingAs === 'merchant' && canResolvePickupExtension) && (
                                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                                        <Button
                                                                            onClick={() => resolvePickupExtension('approved', msg.payload?.extension_id)}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl bg-emerald-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                                                        >
                                                                            {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                                                            {copy('Approve', 'Kubali')}
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            onClick={() => resolvePickupExtension('rejected', msg.payload?.extension_id)}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl border-red-100 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                                                                        >
                                                                            <X className="mr-1.5 h-3.5 w-3.5" />
                                                                            {copy('Reject', 'Kataa')}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {(isExtraChargeProposal && isActiveExtraChargeProposal && actingAs === 'buyer' && canAcceptExtraCharge) && (
                                                                    <div className="mt-3">
                                                                        <Button
                                                                            onClick={() => openPickupActionForm('extra_charge_payment')}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl bg-emerald-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                                                        >
                                                                            {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                                                            {copy('Accept & pay', 'Kubali na lipa')}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {(isExtraChargePaymentStarted && isActiveExtraChargePaymentPending && actingAs === 'buyer' && !pickupClosed) && (
                                                                    <div className="mt-3">
                                                                        <Button
                                                                            onClick={() => openPickupActionForm('extra_charge_payment')}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl bg-emerald-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                                                        >
                                                                            {pickupActionSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5" />}
                                                                            {copy('Pay now', 'Lipa sasa')}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {(isExtraChargeProposal && isActiveExtraChargeProposal && actingAs === 'merchant' && canProposeExtraCharge) && (
                                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                                        <Button
                                                                            onClick={openExtraChargeForm}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl bg-orange-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-orange-700"
                                                                        >
                                                                            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                                                                            {copy('Edit', 'Hariri')}
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            onClick={removeExtraCharge}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl border-red-100 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                                                                        >
                                                                            <X className="mr-1.5 h-3.5 w-3.5" />
                                                                            {copy('Remove', 'Ondoa')}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {(isDeliveryConversionRequested && actingAs === 'merchant' && canQuoteDeliveryConversion) && (
                                                                    <div className="mt-3">
                                                                        <Button
                                                                            onClick={() => openPickupActionForm('delivery_conversion_quote')}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl bg-sky-700 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-sky-800"
                                                                        >
                                                                            <Truck className="mr-1.5 h-3.5 w-3.5" />
                                                                            {copy('Quote delivery', 'Nukuu ya delivery')}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                {(isDeliveryConversionQuoted && actingAs === 'buyer' && canAcceptDeliveryConversion) && (
                                                                    <div className="mt-3">
                                                                        <Button
                                                                            onClick={() => openPickupActionForm('delivery_conversion_payment')}
                                                                            disabled={pickupActionSubmitting}
                                                                            className="h-8 rounded-xl bg-emerald-600 px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700"
                                                                        >
                                                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                                            {copy('Accept & pay', 'Kubali na lipa')}
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                                <ChatNoticeTimestamp value={msg.created_at} className="text-slate-500/70" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (actionType === 'initiate_payment') {
                                            const pickupPin = msg.payload?.pickup_pin || order?.delivery?.pickup_pin;
                                            const paymentAmount = Number(msg.payload?.total_paid || orderDisplayTotal || dealTotal || 0);
                                            const showPickupCard = hasPhysicalOrderItems
                                                && (isSelfPickupOrder || msg.payload?.delivery_type === 'self_pickup')
                                                && merchantConfirmed
                                                && pickupReadyForRelease
                                                && pickupPin;

                                            if (showPickupCard && actingAs === 'buyer') {
                                                return (
                                                    <div key={msg.id} className="my-5 flex w-full justify-center">
                                                        <PickupPinCard
                                                            pickupPin={pickupPin}
                                                            amount={paymentAmount}
                                                            timestamp={msg.created_at}
                                                            onShopLocations={() => setIsShopModalOpen(true)}
                                                        />
                                                    </div>
                                                );
                                            }

                                            if (showPickupCard) {
                                                return (
                                                    <div key={msg.id} className="flex justify-center my-2">
                                                        <div className="max-w-[85%] rounded-2xl border border-brand-100/60 bg-brand-50/80 px-4 py-2 text-center text-[11px] font-bold leading-relaxed text-brand-700/90 shadow-sm dark:border-brand-900/40 dark:bg-brand-900/40 dark:text-brand-200">
                                                            <div className="inline-flex items-center gap-2">
                                                                <Store className="h-3.5 w-3.5 shrink-0" />
                                                                <span>{copy('The pickup PIN has been sent to the buyer for collection.', 'Pickup PIN imetumwa kwa mteja kwa ajili ya kuchukua bidhaa.')}</span>
                                                            </div>
                                                            <ChatNoticeTimestamp value={msg.created_at} className="text-brand-500/60 dark:text-brand-200/50" />
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={msg.id} className="flex justify-center my-2">
                                                    <div className="max-w-[85%] rounded-2xl border border-brand-100/70 bg-white px-4 py-2 text-center text-[11px] font-bold leading-relaxed text-brand-800 shadow-sm dark:border-brand-900/40 dark:bg-slate-900 dark:text-brand-100">
                                                        <div className="inline-flex items-center gap-2">
                                                            <CreditCard className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                                                            <span>{copy('Payment started', 'Malipo yameanzishwa')} · TZS {paymentAmount.toLocaleString()}</span>
                                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                        </div>
                                                        <ChatNoticeTimestamp value={msg.created_at} />
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (actionType === 'discount') {
                                            const amount = Number(msg.payload?.amount || 0);

                                            return (
                                                <div key={msg.id} className={cn("flex w-full my-4", isMe ? "justify-end" : "justify-start")}>
                                                    <div className={cn("flex w-full max-w-[540px] flex-col gap-1", isMe ? "items-end" : "items-start")}>
                                                        <span className="px-1 text-[9px] font-semibold text-slate-400">{renderedName}</span>
                                                        <div className={cn(
                                                            "flex w-full items-center justify-between gap-4 rounded-[2rem] border border-amber-100 bg-amber-50/70 px-5 py-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20",
                                                            isMe ? "rounded-tr-xl" : "rounded-tl-xl"
                                                        )}>
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">{copy('Discount', 'Punguzo')}</p>
                                                                <p className="mt-1 text-2xl font-black text-amber-950 dark:text-amber-100">- TZS {amount.toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-500 shadow-sm dark:bg-slate-950">
                                                                <Tag className="h-5 w-5" />
                                                            </div>
                                                        </div>
                                                        <span className="px-1 text-[9px] font-bold text-slate-300">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (actionType === 'review') {
                                            const stars = Number(msg.payload?.stars || 5);
                                            const comment = msg.payload?.comment || 'Hakuna maoni ya ziada.';

                                            return (
                                                <div key={msg.id} className={cn("flex w-full my-4", isMe ? "justify-end" : "justify-start")}>
                                                    <div className={cn("flex w-full max-w-[540px] flex-col gap-1", isMe ? "items-end" : "items-start")}>
                                                        <span className="px-1 text-[9px] font-semibold text-slate-400">{renderedName}</span>
                                                        <div className={cn(
                                                            "flex w-full items-center justify-between gap-4 rounded-[2rem] border border-amber-100 bg-amber-50/50 px-5 py-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20",
                                                            isMe ? "rounded-tr-xl" : "rounded-tl-xl"
                                                        )}>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    {[...Array(Math.max(1, Math.min(stars, 5)))].map((_, i) => (
                                                                        <Star key={i} className="h-5 w-5 fill-amber-500 text-amber-500" />
                                                                    ))}
                                                                </div>
                                                                <p className="mt-3 break-words text-sm font-bold italic leading-relaxed text-amber-950 dark:text-amber-100">"{comment}"</p>
                                                            </div>
                                                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                                                        </div>
                                                        <span className="px-1 text-[9px] font-bold text-slate-300">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={msg.id} className={cn("flex w-full my-6 animate-in zoom-in-95 duration-500", isMe ? "justify-end" : "justify-start")}>
                                                <div className="flex flex-col w-full max-w-[94%] md:max-w-[78%]">
                                                    {/* Action Header Label */}
                                                    <div className={cn("flex items-center gap-2 mb-2", isMe ? "justify-end" : "justify-start")}>
                                                        <span className={cn(
                                                            "text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full",
                                                            isMe ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500"
                                                        )}>
                                                            {renderedName}
                                                        </span>
                                                    </div>

                                                    <div className={cn(
                                                        "bg-white dark:bg-slate-900 border shadow-[0_8px_40px_rgb(0,0,0,0.03)] p-3 w-full group transition-all hover:shadow-[0_12px_50px_rgb(0,0,0,0.06)] overflow-hidden",
                                                        isMe ? "border-brand-100 rounded-[2.5rem] rounded-tr-xl bg-brand-50/5" : "border-slate-100 dark:border-slate-800 rounded-[2.5rem] rounded-tl-xl"
                                                    )}>
                                                        <div className={cn("flex items-start gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
                                                            {/* User Avatar Circle */}
                                                            <ChatRoleAvatar role={msgActingAs} className="h-10 w-10 rounded-2xl shadow-inner" />

                                                            <div className={cn("flex-1 min-w-0", isMe ? "text-right" : "text-left")}>
                                                                <div className={cn("flex flex-wrap items-start gap-x-2 gap-y-1", isMe ? "justify-end" : "justify-start")}>
                                                                    <h4 className="min-w-0 break-words text-xs font-black leading-5 text-brand-900 dark:text-brand-100 uppercase tracking-tight">{displayedBody}</h4>
                                                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                                                </div>

                                                                {/* Content Renderers */}
                                                                <div className="mt-3 max-w-full overflow-hidden">
                                                                    {actionType === 'discount' && (
                                                                        <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50">
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-0.5">{copy('Discount', 'Punguzo')}</p>
                                                                                <p className="text-lg font-black text-amber-900 dark:text-amber-100">- TZS {Number(msg.payload?.amount || 0).toLocaleString()}</p>
                                                                            </div>
                                                                            <Tag className="h-6 w-6 text-amber-400 opacity-50" />
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'shipping_cost' && (
                                                                        <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50">
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">{copy('Shipping cost', 'Gharama ya usafiri')}</p>
                                                                                <p className="text-lg font-black text-emerald-900 dark:text-emerald-100">TZS {Number(msg.payload?.amount || 0).toLocaleString()}</p>
                                                                            </div>
                                                                            <Truck className="h-6 w-6 text-emerald-400 opacity-50" />
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'quantity' && (
                                                                        <div className="flex items-center justify-between py-3 px-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50">
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">{copy('Item quantity', 'Idadi ya vitu')}</p>
                                                                                <p className="text-lg font-black text-blue-900 dark:text-blue-100">{msg.payload?.quantity} Items</p>
                                                                            </div>
                                                                            <ShoppingBag className="h-6 w-6 text-blue-400 opacity-50" />
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'complaint' && (
                                                                        <div className="space-y-3">
                                                                            <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-100/50">
                                                                                <div className="flex items-center gap-2 mb-2">
                                                                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                                                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{copy('Complaint details', 'Maelezo ya malalamiko')}</p>
                                                                                </div>
                                                                                <p className="text-sm font-bold text-red-900 dark:text-red-100 italic leading-relaxed">"{msg.payload?.reason}"</p>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 px-1">
                                                                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                                                                <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">{copy('Waiting for merchant resolution', 'Inasubiri utatuzi kutoka kwa muuzaji')}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'complaint_resolved' && (
                                                                        <div className="bg-emerald-500 rounded-3xl p-6 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden">
                                                                            <div className="relative z-10">
                                                                                <div className="flex items-center gap-3 mb-3">
                                                                                    <div className="h-10 w-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                                                        <CheckCircle2 className="h-6 w-6" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{copy('Complaint closed', 'Malalamiko yamefungwa')}</p>
                                                                                        <h4 className="text-xl font-black tracking-tight">{copy('RESOLVED', 'YAMETATULIWA')}</h4>
                                                                                    </div>
                                                                                </div>
                                                                                <p className="text-xs font-bold leading-relaxed opacity-90">{copy('The merchant marked this complaint resolved after reaching an agreement with the buyer.', 'Muuzaji amemark malalamiko haya kama yaliyotatuliwa baada ya kukubaliana na mteja.')}</p>
                                                                            </div>
                                                                            <div className="absolute -bottom-6 -right-6 opacity-10"><CheckCircle2 className="h-32 w-32" /></div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'complaint_appealed' && (
                                                                        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-800">
                                                                            <div className="relative z-10">
                                                                                <div className="flex items-center gap-3 mb-3">
                                                                                    <div className="h-10 w-10 rounded-2xl bg-red-600 flex items-center justify-center">
                                                                                        <ShieldCheck className="h-6 w-6" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-red-400">{copy('Escalated to admin', 'Imefikishwa kwa admin')}</p>
                                                                                        <h4 className="text-xl font-black tracking-tight">{copy('APPEAL', 'RUFAA')}</h4>
                                                                                    </div>
                                                                                </div>
                                                                                <p className="text-xs font-bold leading-relaxed text-slate-300">{copy('The merchant appealed. Takeer will review the complaint and issue a final decision within 24 hours.', 'Muuzaji amekata rufaa. Timu ya Takeer itapitia malalamiko haya na kutoa uamuzi wa mwisho ndani ya saa 24.')}</p>
                                                                            </div>
                                                                            <div className="absolute -bottom-6 -right-6 opacity-10"><ShieldCheck className="h-32 w-32" /></div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'unboxing_video' && (
                                                                        <div className="space-y-3 w-full">
                                                                            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl p-4 border border-indigo-100/50">
                                                                                <div className="flex items-center gap-3 mb-3">
                                                                                    <div className="h-8 w-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center">
                                                                                        <Video className="h-4 w-4" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{copy('Unboxing video', 'Video ya unboxing')}</p>
                                                                                        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-100">{copy('Proof of receiving the package', 'Ushahidi wa kupokea mzigo')}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <MediaDisplay url={msg.payload?.mediaUrl || msg.media_url} className="aspect-video rounded-xl shadow-sm" />
                                                                            </div>
                                                                            <div className="flex items-center gap-2 px-1">
                                                                                <ShieldCheck className="h-3 w-3 text-indigo-500" />
                                                                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">{copy('Customer proof submitted', 'Uthibitisho wa mteja umewasilishwa')}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'shipping_proof' && (
                                                                        <div className="space-y-4 w-full">
                                                                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-3">
                                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                                    {msg.payload?.dispatch_mode === 'intercity' ? (
                                                                                        <>
                                                                                            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{copy('Bus company', 'Kampuni ya basi')}</span>
                                                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{msg.payload?.bus_company || copy('N/A', 'Haipo')}</span>
                                                                                            </div>
                                                                                            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{copy('Tracking no.', 'Namba ya ufuatiliaji')}</span>
                                                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{msg.payload?.waybill_tracking_number || copy('N/A', 'Haipo')}</span>
                                                                                            </div>
                                                                                        </>
                                                                                    ) : (
                                                                                        <div className="col-span-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                                            <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{copy('Delivery contact', 'Mawasiliano ya delivery')}</span>
                                                                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                                                {[msg.payload?.delivery_person_name, msg.payload?.boda_phone].filter(Boolean).join(' · ') || copy('N/A', 'Haipo')}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {(msg.payload?.mediaUrl || msg.payload?.receiptUrl || msg.media_url) && (
                                                                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                                                        {msg.payload?.mediaUrl || msg.media_url ? (
                                                                                            <div className="space-y-1">
                                                                                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">{copy('Packing proof', 'Ushahidi wa kufunga')}</span>
                                                                                                <MediaDisplay url={msg.payload?.mediaUrl || msg.media_url} className="aspect-[4/3] rounded-xl" />
                                                                                            </div>
                                                                                        ) : null}
                                                                                        {msg.payload?.receiptUrl ? (
                                                                                            <div className="space-y-1">
                                                                                                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">{copy('Waybill / receipt', 'Waybill / risiti')}</span>
                                                                                                <MediaDisplay url={msg.payload.receiptUrl} className="aspect-[4/3] rounded-xl" />
                                                                                            </div>
                                                                                        ) : null}
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <p className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-tight flex items-center gap-2 italic">
                                                                                <Info className="h-3 w-3" /> {copy('Upload and waybill proof has been saved.', 'Ushahidi wa upakiaji na waybill umehifadhiwa.')}
                                                                            </p>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'delivery_status_update' && (
                                                                        <div className="space-y-3 w-full">
                                                                            <div className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white">
                                                                                        <Truck className="h-5 w-5" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">{copy('Delivery update', 'Sasisho la delivery')}</p>
                                                                                        <h4 className="text-base font-black text-sky-950">
                                                                                            {isForwarderOrder && msg.payload?.status === 'ready_at_terminal'
                                                                                                ? copy('Received by forwarder', 'Imepokelewa na forwarder')
                                                                                                : (locale === 'sw' ? deliveryStatusTextSw(msg.payload?.status) : deliveryStatusText(msg.payload?.status))}
                                                                                        </h4>
                                                                                    </div>
                                                                                </div>
                                                                                {msg.payload?.note && (
                                                                                    <p className="mt-3 rounded-2xl bg-white/80 p-3 text-sm font-semibold text-slate-700">{msg.payload.note}</p>
                                                                                )}
                                                                                {(msg.payload?.courier_company || msg.payload?.bus_company || msg.payload?.waybill_tracking_number || msg.payload?.tracking_link || msg.payload?.forwarder_evidence_type) && (
                                                                                    <div className="mt-3 grid gap-2 rounded-2xl border border-sky-100 bg-white/80 p-3 sm:grid-cols-2">
                                                                                        {msg.payload?.forwarder_evidence_type && (
                                                                                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                                                                {copy('Evidence', 'Ushahidi')}
                                                                                                <span className="mt-1 block text-sm font-bold normal-case tracking-normal text-slate-800">{String(msg.payload.forwarder_evidence_type).replaceAll('_', ' ')}</span>
                                                                                            </p>
                                                                                        )}
                                                                                        {(msg.payload?.courier_company || msg.payload?.bus_company) && (
                                                                                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                                                                {copy('Carrier/forwarder', 'Carrier/forwarder')}
                                                                                                <span className="mt-1 block text-sm font-bold normal-case tracking-normal text-slate-800">{msg.payload.courier_company || msg.payload.bus_company}</span>
                                                                                            </p>
                                                                                        )}
                                                                                        {msg.payload?.waybill_tracking_number && (
                                                                                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                                                                {copy('Receipt/tracking', 'Risiti/ufuatiliaji')}
                                                                                                <span className="mt-1 block text-sm font-bold normal-case tracking-normal text-slate-800">{msg.payload.waybill_tracking_number}</span>
                                                                                            </p>
                                                                                        )}
                                                                                        {msg.payload?.tracking_link && (
                                                                                            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                                                                {copy('Tracking link', 'Kiungo cha ufuatiliaji')}
                                                                                                <a href={msg.payload.tracking_link} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-bold normal-case tracking-normal text-sky-700 underline">{copy('Open tracking', 'Fungua ufuatiliaji')}</a>
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                                    {(Array.isArray(msg.payload?.proofs) && msg.payload.proofs.length > 0
                                                                                        ? msg.payload.proofs
                                                                                        : ((msg.payload?.proof_url || msg.media_url) ? [{ url: msg.payload?.proof_url || msg.media_url }] : [])
                                                                                    ).map((proof, proofIndex, proofs) => (
                                                                                        <a key={`${proof.url}-${proofIndex}`} href={proof.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-[10px] font-black uppercase tracking-widest text-sky-700 underline">
                                                                                            {proofs.length > 1 ? `${copy('Proof', 'Ushahidi')} ${proofIndex + 1}` : copy('Proof added', 'Ushahidi umeongezwa')}
                                                                                        </a>
                                                                                    ))}
                                                                                    {msg.payload?.route_url && (
                                                                                        <a href={msg.payload.route_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-xl bg-sky-700 px-3 text-[10px] font-black uppercase tracking-widest text-white">
                                                                                            {copy('Directions', 'Maelekezo')}
                                                                                        </a>
                                                                                    )}
                                                                                    {msg.payload?.boda_phone && (
                                                                                        <a href={`tel:${msg.payload.boda_phone}`} className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                                                            {copy('Delivery phone', 'Namba ya delivery')}
                                                                                        </a>
                                                                                    )}
                                                                                    {msg.payload?.delivery_person_name && (
                                                                                        <span className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-[10px] font-black uppercase tracking-widest text-sky-700">
                                                                                            {msg.payload.delivery_person_name}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {actionType === 'review' && (
                                                                        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 rounded-2xl p-4">
                                                                            <div className="flex items-center gap-1 mb-2">
                                                                                {[...Array(msg.payload?.stars || 5)].map((_, i) => (
                                                                                    <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                                                                                ))}
                                                                            </div>
                                                                            <p className="text-sm font-bold text-amber-900 dark:text-amber-100 italic leading-relaxed">"{msg.payload?.comment || 'Hakuna maoni ya ziada.'}"</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={cn("mt-3 flex text-[9px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600", isMe ? "justify-end" : "justify-start")}>
                                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={msg.id} className={cn("flex w-full mb-3 items-end gap-2", isMe ? "justify-end" : "justify-start")}>
                                            {!isMe && (
                                                <ChatRoleAvatar role={msgActingAs} className="mb-1 h-8 w-8" />
                                            )}
                                            <div className={cn("max-w-[356px] flex flex-col gap-1 min-w-0", isMe ? "items-end" : "items-start")}>
                                                <span className="text-[9px] font-semibold text-slate-400 px-1">{renderedName}</span>
                                                {msg.media_url ? (
                                                    <div className={cn(
                                                        "relative overflow-hidden rounded-2xl shadow-sm bg-slate-100 dark:bg-slate-900",
                                                        isMe ? "rounded-br-sm" : "rounded-bl-sm"
                                                    )}>
                                                        <MediaDisplay url={msg.media_url} mode="natural" className="max-h-80 w-full min-w-48 sm:min-w-64 overflow-hidden" />
                                                        {!isDefaultMediaBody(msg.body) && displayedBody && (
                                                            <p className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                                                                {displayedBody}
                                                            </p>
                                                        )}
                                                        <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                                                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className={cn(
                                                        "rounded-2xl px-4 py-3 shadow-sm relative",
                                                        isMe ? "bg-brand-600 text-white rounded-br-sm" : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-100 dark:border-slate-800"
                                                    )}>
                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{displayedBody}</p>
                                                        <div className={cn("flex items-center justify-end gap-1 mt-1", isMe ? "text-white/50" : "text-slate-400")}>
                                                            <span className="text-[9px]">
                                                                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {isMe && (
                                                <ChatRoleAvatar role={actingAs} className="mb-1 h-8 w-8" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Payment Action Button */}
                    {actingAs === 'buyer' && order?.payment_status === 'pending' && !canBuyerPay && (
                        <div className="px-4 pb-2 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-4 rounded-[2rem] bg-amber-50/50 border border-amber-100 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <p className="text-[10px] font-bold text-amber-900 uppercase leading-relaxed">
                                    {order?.is_inquiry && order?.inquiry_status === 'quoted' && !merchantConfirmed
                                        ? 'Subiri muuzaji athibitishe oda kabla ya kulipia.'
                                        : (isForwarderOrder
                                            ? 'Subiri muuzaji athibitishe gharama ya kupeleka mzigo kwa forwarder ili uweze kulipia. Malipo ya forwarder kwenda eneo lako yatafuata kwenye freight.'
                                            : 'Subiri muuzaji aweke gharama ya usafiri au chagua pickup ili uweze kulipia.')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Buyer Action Panels */}
                    {actingAs === 'buyer' && order?.delivery && order?.delivery?.delivery_type !== 'self_pickup' && (
                        <div className="px-4 pb-2 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="mx-auto max-w-3xl">
                                <DeliveryFlowTimeline
                                    delivery={order.delivery}
                                    swahili={locale === 'sw'}
                                    compact
                                    className="shadow-sm"
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {!isDeliveryCompleted && <DeliveryDirectionsButton routeUrl={deliveryRouteUrl} />}
                                    {order.delivery.delivery_person_name && (
                                        <span className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-100 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-600">
                                            {order.delivery.delivery_person_name}
                                        </span>
                                    )}
                                    {!isForwarderOrder && order.delivery.boda_phone && (
                                        <a href={`tel:${order.delivery.boda_phone}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-100 bg-white px-4 text-xs font-black uppercase tracking-widest text-sky-700">
                                            {copy('Delivery phone', 'Namba ya delivery')}
                                        </a>
                                    )}
                                </div>
                            </div>
                            {canBuyerConfirmReceipt && (
                                <div className="p-4 rounded-[2rem] bg-indigo-50/80 border border-indigo-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ShieldCheck className="h-5 w-5 text-indigo-600" />
                                        <h4 className="font-black text-indigo-900 uppercase tracking-tight text-sm">{buyerReceiptCopy.title}</h4>
                                    </div>
                                    <p className="text-xs text-indigo-800/80 mb-3 font-medium">{buyerReceiptCopy.body}</p>
                                    <div className="flex gap-2">
                                        <Button onClick={confirmReceipt} disabled={isConfirmingReceipt} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold uppercase text-[10px] tracking-widest">
                                            {isConfirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : buyerReceiptCopy.confirm}
                                        </Button>
                                        <Button variant="outline" onClick={openComplaintCenter} className="flex-1 h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-bold uppercase text-[10px] tracking-widest">
                                            {buyerReceiptCopy.report}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(order?.payment_status) && order?.delivery?.delivery_type === 'local_boda' && order?.delivery?.buyer_release_pin && (
                                <div className="mx-auto flex w-full max-w-lg flex-col">
                                    <ReleasePinCard
                                        releasePin={order?.delivery?.buyer_release_pin}
                                        onReportIssue={openComplaintCenter}
                                        className="max-w-none"
                                    />
                                </div>
                            )}

                            {['pending_fulfillment', 'release_eligible'].includes(order?.payment_status) && order?.delivery?.delivery_type === 'self_pickup' && merchantConfirmed && pickupReadyForRelease && order?.delivery?.pickup_pin && (
                                <div className="mx-auto flex w-full max-w-lg flex-col">
                                    <PickupPinCard
                                        pickupPin={order?.delivery?.pickup_pin}
                                        amount={orderDisplayTotal}
                                        onShopLocations={() => setIsShopModalOpen(true)}
                                        className="max-w-none"
                                    />
                                    <Button variant="ghost" onClick={openComplaintCenter} className="w-full mt-2 h-10 rounded-xl text-red-600 hover:bg-red-50 font-bold uppercase text-[10px] tracking-widest">
                                        {copy('REPORT ISSUE', 'RIPOTI TATIZO')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {actingAs === 'merchant' && order?.delivery && order?.delivery?.delivery_type !== 'self_pickup' && (
                        <div className="px-4 pb-2 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="mx-auto max-w-3xl">
                                <DeliveryFlowTimeline delivery={order.delivery} compact swahili={locale === 'sw'} className="shadow-sm" />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {!isDeliveryCompleted && <DeliveryDirectionsButton routeUrl={deliveryRouteUrl} />}
                                    {order.delivery.delivery_person_name && (
                                        <span className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-100 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-600">
                                            {order.delivery.delivery_person_name}
                                        </span>
                                    )}
                                    {order.delivery.boda_phone && (
                                        <a href={`tel:${order.delivery.boda_phone}`} className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-100 bg-white px-4 text-xs font-black uppercase tracking-widest text-sky-700">
                                            {copy('Delivery phone', 'Simu ya delivery')}
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Buyer Review Panel */}
                    {actingAs === 'buyer' && order?.payment_status === 'paid_out' && !completedReview && (
                        <div className="px-4 pb-2 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="p-4 rounded-[2rem] bg-amber-50/80 border border-amber-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <Star className="h-5 w-5 text-amber-600 fill-amber-600" />
                                    <h4 className="font-black text-amber-900 uppercase tracking-tight text-sm">{copy('Leave your review', 'Toa review yako')}</h4>
                                </div>
                                <p className="text-xs text-amber-800/80 mb-4 font-medium">{copy('Thanks for buying! Share your feedback about the product and merchant service.', 'Asante kwa kununua! Toa maoni yako kuhusu bidhaa na huduma ya muuzaji.')}</p>

                                <div className="flex justify-center gap-3 mb-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setReviewStars(star)}
                                            className="transition-transform active:scale-90"
                                        >
                                            <Star className={cn("h-8 w-8", star <= reviewStars ? "fill-amber-500 text-amber-500" : "text-amber-200")} />
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    placeholder={copy('Write your review here...', 'Andika maoni yako hapa...')}
                                    className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 mb-3"
                                    rows={2}
                                />

                                <Button
                                    onClick={submitReview}
                                    disabled={isSubmittingReview || !reviewComment.trim()}
                                    className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 font-black text-white uppercase tracking-widest text-[10px]"
                                >
                                    {isSubmittingReview ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : copy('SUBMIT REVIEW', 'TUMA REVIEW')}
                                </Button>
                            </div>
                        </div>
                    )}

                    {completedReview && (
                        <div className="px-4 pb-2 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="mx-auto max-w-3xl rounded-[2rem] border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">{copy('Customer review', 'Review ya mteja')}</p>
                                        <div className="mt-2 flex gap-1 text-amber-500">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={cn("h-5 w-5", star <= Number(completedReview.rating || 0) ? "fill-amber-500" : "text-amber-200")}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                                </div>
                                {completedReview.comment && (
                                    <p className="mt-3 text-sm font-bold italic leading-relaxed text-amber-950">
                                        "{completedReview.comment}"
                                    </p>
                                )}
                                {completedReview.created_at && (
                                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-700/70">
                                        {new Date(completedReview.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Merchant Action Panels */}
                    {actingAs === 'merchant' && (
                        <div className="px-4 pb-2 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                            {canMerchantConfirm && (
                                <div className="p-4 rounded-[2rem] bg-emerald-50/80 border border-emerald-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        <h4 className="font-black text-emerald-900 uppercase tracking-tight text-sm">
                                            {canMerchantConfirmPaidPickup ? copy('Confirm pickup availability', 'Thibitisha pickup ipo') : copy('Confirm availability', 'Thibitisha upatikanaji')}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-emerald-900/80 mb-3 font-medium">
                                        {canMerchantConfirmPaidPickup
                                            ? copy('The buyer has paid. Confirm stock/capacity so the pickup PIN and pickup time can become active.', 'Mteja amelipa. Thibitisha stock/uwezo wa kutimiza ili pickup PIN na muda wa pickup uanze kufanya kazi.')
                                            : copy('The buyer cannot pay until you confirm that the order is available and can be fulfilled.', 'Mteja hawezi kulipa mpaka uthibitishe kuwa order ipo na unaweza kuitimiza.')}
                                    </p>
                                    <Button
                                        type="button"
                                        onClick={confirmAvailability}
                                        disabled={confirmingAvailability}
                                        className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold uppercase text-[10px] tracking-widest"
                                    >
                                        {confirmingAvailability ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                        {canMerchantConfirmPaidPickup ? copy('CONFIRM PICKUP IS AVAILABLE', 'THIBITISHA PICKUP IPO') : copy('CONFIRM ORDER IS AVAILABLE', 'THIBITISHA ORDER IPO')}
                                    </Button>
                                </div>
                            )}
                            {order?.is_inquiry && order?.inquiry_status === 'pending' && order?.payment_status === 'pending' && (
                                serviceOrder || digitalOrder || (order?.delivery?.delivery_type !== 'self_pickup' && order?.shipping_fee === null)
                            ) && (
                                    <div className={cn(
                                        "p-4 rounded-[2rem] bg-brand-50/80 border shadow-sm transition-colors",
                                        isWaitingForShippingFee ? "border-red-300 ring-2 ring-red-100" : "border-brand-200"
                                    )}>
                                        <div className="flex items-center gap-2 mb-3">
                                            {physicalOrder ? <Truck className="h-5 w-5 text-brand-600" /> : <IntentIcon className="h-5 w-5 text-brand-600" />}
                                            <h4 className="font-black text-brand-900 uppercase tracking-tight text-sm">
                                                {serviceOrder ? copy('Service offer enquiry', 'Ombi la ofa ya huduma') : (digitalOrder ? copy('Digital work enquiry', 'Ombi la kazi ya digitali') : (isForwarderOrder ? copy('Forwarder drop-off quote', 'Quote ya kupeleka kwa forwarder') : copy('Shipping quote enquiry', 'Ombi la quote ya usafiri')))}
                                            </h4>
                                        </div>
                                        {physicalOrder && (
                                            <div className="bg-white/80 p-3 rounded-2xl border border-brand-100 mb-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-700/80 mb-1">
                                                    {isForwarderOrder ? copy('Forwarder warehouse:', 'Ghala la forwarder:') : copy('Customer address:', 'Anwani ya mteja:')}
                                                </p>
                                                <p className="font-bold text-sm text-brand-900">{order?.delivery?.physical_address || copy('Address not provided', 'Anwani haikuwekwa')}</p>

                                                {!isForwarderOrder && closestLocation && (
                                                    <div className="mt-3 p-2 rounded-xl bg-brand-50/50 border border-brand-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center text-brand-600 shadow-sm">
                                                                <Store className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase text-brand-700 tracking-tight">{copy('From:', 'Kutoka:')} {closestLocation.name}</p>
                                                                <p className="text-[10px] font-black text-brand-900 tracking-tight">{copy('Distance:', 'Umbali:')} {closestLocation.distance.toFixed(1)} km</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {isForwarderOrder && (
                                                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-900">
                                                        {copy('Use domestic courier, cargo, or warehouse drop-off details. After payment, update status to Dispatched to forwarder and attach courier/waybill details there.', 'Tumia courier wa ndani, cargo, au maelezo ya ghala. Baada ya malipo, sasisha hali kuwa imetumwa kwa forwarder na ambatisha maelezo ya courier/waybill hapo.')}
                                                    </div>
                                                )}

                                                {!isForwarderOrder && order?.delivery?.latitude && (
                                                    <a
                                                        href={`https://www.google.com/maps/dir/${closestLocation?.latitude || ''},${closestLocation?.longitude || ''}/${order.delivery.latitude},${order.delivery.longitude}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-brand-600 hover:text-brand-700 underline"
                                                    >
                                                        <MapPin className="h-3 w-3" /> {copy('OPEN IN MAPS', 'FUNGUA KWENYE RAMANI')}
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {!physicalOrder && (
                                            <div className="mb-3 rounded-2xl border border-brand-100 bg-white/80 p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-700/80 mb-1">
                                                    {serviceOrder ? copy('Service agreement', 'Makubaliano ya huduma') : copy('Digital order agreement', 'Makubaliano ya digital order')}
                                                </p>
                                                <p className="text-sm font-bold leading-5 text-brand-900">
                                                    {copy('Use chat to agree on scope, deliverables, deadline, revisions, and price before the buyer pays.', 'Tumia chat kukubaliana scope, deliverables, deadline, revisions, na bei kabla ya mteja kulipa.')}
                                                </p>
                                            </div>
                                        )}
                                        <form onSubmit={submitQuote} className="flex gap-2">
                                            <Input
                                                type="number"
                                                placeholder={serviceOrder ? copy('Enter service offer (TZS)', 'Weka offer ya huduma (TZS)') : (digitalOrder ? copy('Enter digital work offer (TZS)', 'Weka offer ya digital work (TZS)') : (isForwarderOrder ? copy('Forwarder drop-off cost (TZS)', 'Gharama ya kupeleka kwa forwarder (TZS)') : copy('Enter cost (TZS)', 'Weka gharama (TZS)')))}
                                                value={shippingFeeInput}
                                                onChange={e => setShippingFeeInput(e.target.value)}
                                                className={cn(
                                                    "flex-1 font-bold h-12 rounded-xl",
                                                    isWaitingForShippingFee && "border-red-400 bg-red-50/40 focus-visible:ring-red-200"
                                                )}
                                                required
                                            />
                                            <Button type="submit" disabled={quoteSubmitting || !shippingFeeInput} className="h-12 rounded-xl px-6 bg-brand-600 font-bold uppercase text-[10px] tracking-widest">
                                                {quoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} {copy('SEND', 'TUMA')}
                                            </Button>
                                        </form>
                                    </div>
                                )}

                            {order?.product?.type === 'physical' && order?.payment_status === 'pending_fulfillment' && order?.delivery?.delivery_type !== 'self_pickup' && !isForwarderOrder && (
                                <div className="p-4 rounded-[2rem] bg-brand-50/80 border border-brand-200 shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Truck className="h-5 w-5 text-brand-600" />
                                        <h4 className="font-black text-brand-900 uppercase tracking-tight text-sm">{copy('Dispatch Evidence', 'Ushahidi wa dispatch')}</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <button type="button" onClick={() => setDispatchMode('intercity')} className={cn("h-10 rounded-xl border text-xs font-bold transition-all", dispatchMode === 'intercity' ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-500 border-slate-200")}>{isForwarderOrder ? 'Courier to forwarder' : 'Intercity Bus'}</button>
                                        <button type="button" onClick={() => setDispatchMode('local')} className={cn("h-10 rounded-xl border text-xs font-bold transition-all", dispatchMode === 'local' ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-500 border-slate-200")}>{isForwarderOrder ? 'Drop-off' : 'Local'}</button>
                                    </div>
                                    <form onSubmit={submitDispatch} className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button type="button" onClick={() => { const el = document.getElementById('dispatch-video-input'); if (el) el.click(); }} className="flex flex-col items-center justify-center p-3 h-20 rounded-xl bg-white border border-slate-200 hover:border-brand-300">
                                                <Camera className={cn("h-5 w-5 mb-1", dispatchVideo ? "text-emerald-500" : "text-brand-500")} />
                                                <span className="text-[10px] font-black uppercase text-slate-500">{copy('Packing proof', 'Ushahidi wa kufunga')}</span>
                                                <input id="dispatch-video-input" type="file" accept="image/*,video/*" className="hidden" onChange={e => setDispatchVideo(e.target.files?.[0])} />
                                            </button>
                                            {dispatchMode === 'intercity' ? (
                                                <button type="button" onClick={() => { const el = document.getElementById('dispatch-receipt-input'); if (el) el.click(); }} className="flex flex-col items-center justify-center p-3 h-20 rounded-xl bg-white border border-slate-200 hover:border-brand-300">
                                                    <ImageIcon className={cn("h-5 w-5 mb-1", transportReceipt ? "text-emerald-500" : "text-brand-500")} />
                                                    <span className="text-[10px] font-black uppercase text-slate-500">{copy('Waybill', 'Waybill')}</span>
                                                    <input id="dispatch-receipt-input" type="file" accept="image/*" className="hidden" onChange={e => setTransportReceipt(e.target.files?.[0])} />
                                                </button>
                                            ) : (
                                                <Input type="text" placeholder={copy('Boda phone...', 'Namba ya boda...')} value={bodaPhone} onChange={e => setBodaPhone(e.target.value)} className="h-20 rounded-xl bg-white border-slate-200 text-center font-bold" />
                                            )}
                                        </div>
                                        <Input
                                            type="text"
                                            placeholder={copy('Delivery person name (optional)', 'Jina la anayefikisha (hiari)')}
                                            value={deliveryPersonName}
                                            onChange={e => setDeliveryPersonName(e.target.value)}
                                            className="h-10 rounded-xl bg-white"
                                        />
                                        {dispatchMode === 'intercity' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input type="text" placeholder={copy('Bus company...', 'Kampuni ya basi...')} value={busCompany} onChange={e => setBusCompany(e.target.value)} className="h-10 rounded-xl bg-white" />
                                                <Input type="text" placeholder={copy('Tracking #...', 'Namba ya ufuatiliaji...')} value={waybillTrackingNumber} onChange={e => setWaybillTrackingNumber(e.target.value)} className="h-10 rounded-xl bg-white" />
                                            </div>
                                        )}
                                        <Button type="submit" disabled={dispatchSubmitting || !dispatchVideo || (dispatchMode === 'intercity' && !transportReceipt)} className="w-full h-12 rounded-xl bg-brand-600 font-bold uppercase text-[10px] tracking-widest">
                                            {dispatchSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {copy('CONFIRM DISPATCH', 'THIBITISHA DISPATCH')}
                                        </Button>
                                    </form>
                                </div>
                            )}

                            {order?.payment_status === 'release_eligible' && order?.delivery?.delivery_type === 'local_boda' && (
                                <div className="rounded-[2rem] border border-brand-100 bg-white p-5 shadow-xl shadow-brand-100/50">
                                    <div className="mb-4 flex items-start gap-3">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">{copy('Delivery verification', 'Uthibitisho wa delivery')}</p>
                                            <h4 className="mt-1 text-lg font-black leading-tight text-slate-950">{copy('Confirm & release', 'Thibitisha na toa')}</h4>
                                            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{copy('Ask the rider for the 4-digit Release PIN after the customer has inspected and accepted the package.', 'Omba rider PIN ya Release yenye tarakimu 4 baada ya mteja kukagua na kukubali mzigo.')}</p>
                                        </div>
                                    </div>
                                    <form onSubmit={verifyDeliveryPin} className="space-y-3">
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={4}
                                            placeholder="0000"
                                            value={releasePinInput}
                                            onChange={e => setReleasePinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                            className="mx-auto h-16 w-full max-w-44 rounded-2xl border-2 border-brand-100 bg-brand-50/40 text-center text-2xl font-black tracking-[0.35em] text-brand-900 shadow-inner focus:border-brand-400"
                                        />
                                        <Button type="submit" disabled={pinVerifying || releasePinInput.length !== 4} className="h-14 w-full rounded-2xl bg-brand-600 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-brand-600/25 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400">
                                            {pinVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                            {copy('Confirm delivery', 'Thibitisha delivery')}
                                        </Button>
                                    </form>
                                </div>
                            )}

                            {order?.payment_status === 'pending_fulfillment' && order?.delivery?.delivery_type === 'self_pickup' && merchantConfirmed && pickupReadyForRelease && (
                                <div className="rounded-[2rem] border border-brand-100 bg-white p-5 shadow-xl shadow-brand-100/50">
                                    <div className="mb-4 flex items-start gap-3">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                                            <Store className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">{copy('Pickup verification', 'Uthibitisho wa pickup')}</p>
                                            <h4 className="mt-1 text-lg font-black leading-tight text-slate-950">{copy('Confirm & release', 'Thibitisha na toa')}</h4>
                                            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{copy('Ask the customer for the 4-digit PIN shown in their chat, then release the order.', 'Omba mteja PIN ya tarakimu 4 iliyo kwenye chat yake, kisha toa order.')}</p>
                                        </div>
                                    </div>
                                    <form onSubmit={verifyPickupPin} className="space-y-3">
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={4}
                                            placeholder="0000"
                                            value={pickupPinInput}
                                            onChange={e => setPickupPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                            className="mx-auto h-16 w-full max-w-44 rounded-2xl border-2 border-brand-100 bg-brand-50/40 text-center text-2xl font-black tracking-[0.35em] text-brand-900 shadow-inner focus:border-brand-400"
                                        />
                                        <Button type="submit" disabled={pinVerifying || pickupPinInput.length !== 4} className="h-14 w-full rounded-2xl bg-brand-600 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-brand-600/25 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400">
                                            {pinVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                            {copy('Confirm pickup', 'Thibitisha pickup')}
                                        </Button>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}

                    <div ref={bottomRef} className="h-4" />
                </div>

                <Drawer open={!!pickupActionForm} onOpenChange={(open) => !open && setPickupActionForm(null)}>
                    <DrawerContent className="rounded-t-[2rem] bg-white dark:bg-slate-950">
                        <div className="mx-auto w-full max-w-lg p-5">
                            <DrawerHeader className="px-0 text-left">
                                <DrawerTitle className="text-xl font-black tracking-tight text-slate-950">
                                    {pickupActionForm === 'extension_request' && copy('Request pickup time', 'Omba muda wa pickup')}
                                    {pickupActionForm === 'extra_charge_payment' && copy('Accept & pay extra cost', 'Kubali na lipa gharama ya ziada')}
                                    {pickupActionForm === 'delivery_conversion_request' && copy('Request delivery', 'Omba delivery')}
                                    {pickupActionForm === 'delivery_conversion_quote' && copy('Quote delivery', 'Nukuu delivery')}
                                    {pickupActionForm === 'delivery_conversion_payment' && copy('Accept & pay delivery', 'Kubali na lipa delivery')}
                                </DrawerTitle>
                                <DrawerDescription className="text-xs font-bold text-slate-500">
                                    {copy('This action is recorded in order chat as part of the agreement trail.', 'Kitendo hiki kinarekodiwa kwenye chat ya order kama sehemu ya historia ya makubaliano.')}
                                </DrawerDescription>
                            </DrawerHeader>

                            {pickupActionForm === 'extension_request' && (
                                <form onSubmit={requestPickupExtension} className="space-y-3">
                                    <Input type="datetime-local" value={pickupExtensionDeadline} onChange={(event) => setPickupExtensionDeadline(event.target.value)} className="h-12 rounded-xl font-bold" required />
                                    <textarea value={pickupExtensionReason} onChange={(event) => setPickupExtensionReason(event.target.value)} rows={3} placeholder={copy('Reason or note...', 'Sababu au ujumbe...')} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                                    <Button type="submit" disabled={pickupActionSubmitting} className="h-12 w-full rounded-xl bg-sky-700 font-black uppercase tracking-widest text-white hover:bg-sky-800">
                                        {pickupActionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                                        {copy('Send request', 'Tuma ombi')}
                                    </Button>
                                </form>
                            )}

                            {pickupActionForm === 'extra_charge_payment' && (
                                <form onSubmit={acceptExtraCharge} className="space-y-3">
                                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">{copy('Extra agreed cost', 'Gharama ya ziada iliyokubaliwa')}</p>
                                        <p className="mt-1 text-2xl font-black text-amber-950">TZS {Number(activeExtraCharge?.amount || 0).toLocaleString()}</p>
                                        <p className="mt-1 text-xs font-bold text-amber-800/80">{copy('The PSP controls payment settlement; seller payout follows verified pickup or delivery completion.', 'PSP inadhibiti settlement ya malipo; payout ya muuzaji hufuata pickup au delivery iliyothibitishwa.')}</p>
                                    </div>
                                    <Input value={extraChargePaymentNumber} onChange={(event) => setExtraChargePaymentNumber(event.target.value)} placeholder={copy('Payment phone number', 'Namba ya simu ya malipo')} className="h-12 rounded-xl font-bold" required />
                                    <Button type="submit" disabled={pickupActionSubmitting} className="h-12 w-full rounded-xl bg-emerald-600 font-black uppercase tracking-widest text-white hover:bg-emerald-700">
                                        {pickupActionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        {copy('Accept & pay', 'Kubali na lipa')}
                                    </Button>
                                </form>
                            )}

                            {pickupActionForm === 'delivery_conversion_request' && (
                                <form onSubmit={requestDeliveryConversion} className="space-y-3">
                                    <textarea value={conversionAddress} onChange={(event) => setConversionAddress(event.target.value)} rows={3} placeholder={copy('Delivery address...', 'Anwani ya delivery...')} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20" required />
                                    <textarea value={conversionNote} onChange={(event) => setConversionNote(event.target.value)} rows={2} placeholder={copy('Note for merchant...', 'Ujumbe kwa muuzaji...')} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                                    <Button type="submit" disabled={pickupActionSubmitting} className="h-12 w-full rounded-xl bg-emerald-600 font-black uppercase tracking-widest text-white hover:bg-emerald-700">
                                        {pickupActionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                                        {copy('Send delivery request', 'Tuma ombi la delivery')}
                                    </Button>
                                </form>
                            )}

                            {pickupActionForm === 'delivery_conversion_quote' && (
                                <form onSubmit={quoteDeliveryConversion} className="space-y-3">
                                    <Input type="number" min="1" value={conversionQuoteFee} onChange={(event) => setConversionQuoteFee(event.target.value)} placeholder={copy('Delivery fee (TZS)', 'Gharama ya delivery (TZS)')} className="h-12 rounded-xl font-bold" required />
                                    <textarea value={conversionQuoteNote} onChange={(event) => setConversionQuoteNote(event.target.value)} rows={2} placeholder={copy('Note for buyer...', 'Ujumbe kwa mteja...')} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                                    <Button type="submit" disabled={pickupActionSubmitting} className="h-12 w-full rounded-xl bg-sky-700 font-black uppercase tracking-widest text-white hover:bg-sky-800">
                                        {pickupActionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                                        {copy('Send quote', 'Tuma nukuu')}
                                    </Button>
                                </form>
                            )}

                            {pickupActionForm === 'delivery_conversion_payment' && (
                                <form onSubmit={acceptDeliveryConversion} className="space-y-3">
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{copy('Delivery fee', 'Gharama ya delivery')}</p>
                                        <p className="mt-1 text-2xl font-black text-emerald-950">TZS {Number(deliveryConversion?.shipping_fee || 0).toLocaleString()}</p>
                                        <p className="mt-1 text-xs font-bold text-emerald-800/80">{copy('The PSP controls settlement until delivery is completed and Takeer can request the order payout.', 'PSP inadhibiti settlement hadi delivery ikamilike na Takeer iweze kuomba payout ya order.')}</p>
                                    </div>
                                    <Input value={conversionPaymentNumber} onChange={(event) => setConversionPaymentNumber(event.target.value)} placeholder={copy('Payment phone number', 'Namba ya simu ya malipo')} className="h-12 rounded-xl font-bold" required />
                                    <Button type="submit" disabled={pickupActionSubmitting} className="h-12 w-full rounded-xl bg-emerald-600 font-black uppercase tracking-widest text-white hover:bg-emerald-700">
                                        {pickupActionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        {copy('Accept & pay', 'Kubali na lipa')}
                                    </Button>
                                </form>
                            )}
                        </div>
                    </DrawerContent>
                </Drawer>

                {/* Input Area */}
                <div className="shrink-0 bg-white dark:bg-slate-950 border-t border-brand-100 dark:border-brand-900/40 p-4">
                    {(order?.payment_status === 'paid_out' || order?.payment_status === 'failed') ? (
                        <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-500">
                            <Lock className="h-4 w-4 text-slate-400 mr-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {order?.payment_status === 'failed' ? copy('Order failed. Chat is closed.', 'Oda imesitishwa. Chat imefungwa.') : copy('Order completed. Chat is closed.', 'Oda imekamilika. Chat imefungwa.')}
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={sendMessage} className="flex items-center gap-2">
                            <Drawer open={isActionDrawerOpen} onOpenChange={setIsActionDrawerOpen}>
                                <DrawerTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setIsActionDrawerOpen(true)} className="shrink-0 h-12 w-12 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100">
                                        <Plus className="h-6 w-6" />
                                    </Button>
                                </DrawerTrigger>
                                <DrawerContent className="rounded-t-[3rem] bg-white dark:bg-slate-950 border-t-2 border-brand-100 dark:border-brand-900/50">
                                    <div className="mx-auto w-full max-w-lg flex flex-col h-[70vh]">
                                        {activeAction === null ? (
                                            <>
                                                <DrawerHeader className="text-left pb-2 pt-6 shrink-0">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <DrawerTitle className="text-2xl font-black tracking-tight text-brand-900">{copy('Quick actions', 'Njia za mkato')}</DrawerTitle>
                                                            <DrawerDescription className="font-bold text-brand-600/60 uppercase text-[10px] tracking-widest mt-0.5">{copy('Safe & fast for order', 'Salama na haraka kwa oda')} #{publicId?.substring(0, 8)}</DrawerDescription>
                                                        </div>
                                                        <DrawerClose asChild>
                                                            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-accent/50"><X className="h-5 w-5 text-muted-foreground" /></Button>
                                                        </DrawerClose>
                                                    </div>
                                                </DrawerHeader>
                                                <div className="p-4 grid grid-cols-2 gap-3 pb-12 overflow-y-auto">
                                                    {(actingAs === 'merchant' ? merchantQuickActions : buyerQuickActions).map((action) => {
                                                        const Icon = action.icon;
                                                        const isDisabled = action.disabled;
                                                        return (
                                                            <button
                                                                key={action.id}
                                                                disabled={isDisabled}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (action.id === 'shop_locations') {
                                                                        setIsShopModalOpen(true);
                                                                        setIsActionDrawerOpen(false);
                                                                    } else if (action.id === 'extend_lock' || action.id === 'release_stock') {
                                                                        handleMerchantLockAction(action.id);
                                                                        setIsActionDrawerOpen(false);
                                                                    } else {
                                                                        setActiveAction(action.id);
                                                                        setActionPayload({
                                                                            title: action.label,
                                                                            amount: action.id === 'discount' ? 5000 : action.id === 'shipping_cost' ? 7000 : 0,
                                                                            quantity: order?.quantity || 1
                                                                        });
                                                                        if (action.id === 'extra_charge') prepareExtraChargeForm();
                                                                        if (action.id === 'upsell') handleSearchProducts('');
                                                                        if (action.id === 'order_delivery') {
                                                                            const profileId = order?.product?.shipping_profile_id;
                                                                            if (profileId) {
                                                                                setLoadingZones(true);
                                                                                fetch(`/api/merchant/shipping-profiles/${profileId}/zones`, { headers: { Accept: 'application/json' } })
                                                                                    .then(res => res.json())
                                                                                    .then(json => {
                                                                                        if (json.data) setShippingZones(json.data);
                                                                                    })
                                                                                    .finally(() => setLoadingZones(false));
                                                                            }
                                                                        }
                                                                    }
                                                                }}
                                                                className={cn(
                                                                    "group relative flex flex-col items-start p-4 rounded-3xl border transition-all duration-300 text-left bg-white/50 hover:bg-white hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md overflow-hidden",
                                                                    action.border,
                                                                    isDisabled && "opacity-50 grayscale cursor-not-allowed"
                                                                )}
                                                            >
                                                                {isDisabled && (
                                                                    <div className="absolute inset-0 bg-slate-50/40 flex items-center justify-center backdrop-blur-[1px]">
                                                                        <span className="bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">{action.disabledReason || copy('LOCKED', 'IMEFUNGWA')}</span>
                                                                    </div>
                                                                )}
                                                                <div className={cn("p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110", action.color)}><Icon className="h-6 w-6" /></div>
                                                                <span className="font-black text-sm text-brand-900 tracking-tight leading-tight mb-1">{action.label}</span>
                                                                <span className="text-[10px] font-bold text-muted-foreground line-clamp-2">{action.desc}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="p-6 flex flex-col min-h-[400px] animate-in slide-in-from-right-4 duration-300">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div className="flex items-center gap-3">
                                                        <Button variant="ghost" size="icon" onClick={() => setActiveAction(null)} className="rounded-full h-10 w-10 bg-accent/50 hover:bg-accent"><ArrowLeft className="h-5 w-5 text-brand-900" /></Button>
                                                        <div>
                                                            <h3 className="text-xl font-black text-brand-900 dark:text-brand-100 flex items-center gap-2">{actionPayload.title}</h3>
                                                        </div>
                                                    </div>
                                                    <DrawerClose asChild><Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-accent/20"><X className="h-4 w-4 text-muted-foreground" /></Button></DrawerClose>
                                                </div>

                                                <div className="flex-1 space-y-6 overflow-y-auto pr-1">
                                                    {activeAction === 'order_delivery' && actingAs === 'buyer' && (
                                                        <div className="space-y-6">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <button
                                                                    onClick={() => setIsSelfPickupChoice(true)}
                                                                    className={cn(
                                                                        "p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                                                                        isSelfPickupChoice ? "border-brand-600 bg-brand-50" : "border-slate-100 bg-slate-50 opacity-60"
                                                                    )}
                                                                >
                                                                    <Store className={cn("h-8 w-8", isSelfPickupChoice ? "text-brand-600" : "text-slate-400")} />
                                                                    <span className={cn("font-black text-[10px] uppercase tracking-widest", isSelfPickupChoice ? "text-brand-600" : "text-slate-500")}>{copy('Pickup', 'Kuchukua')}</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => setIsSelfPickupChoice(false)}
                                                                    className={cn(
                                                                        "p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                                                                        !isSelfPickupChoice ? "border-brand-600 bg-brand-50" : "border-slate-100 bg-slate-50 opacity-60"
                                                                    )}
                                                                >
                                                                    <Truck className={cn("h-8 w-8", !isSelfPickupChoice ? "text-brand-600" : "text-slate-400")} />
                                                                    <span className={cn("font-black text-[10px] uppercase tracking-widest", !isSelfPickupChoice ? "text-brand-600" : "text-slate-500")}>{copy('Delivery', 'Kuletewa')}</span>
                                                                </button>
                                                            </div>

                                                            {isSelfPickupChoice ? (
                                                                <div className="p-6 rounded-[2.5rem] bg-indigo-50 border border-indigo-100 space-y-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                                            <MapPin className="h-5 w-5" />
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="font-black text-indigo-900 uppercase text-[11px] tracking-widest">{copy('Pickup locations', 'Maeneo ya kuchukua')}</h4>
                                                                            <p className="text-[10px] font-bold text-indigo-600/70">{copy('Your order will be collected at the merchant shop.', 'Oda yako itachukuliwa dukani mwa muuzaji')}</p>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        onClick={() => setIsShopModalOpen(true)}
                                                                        variant="outline"
                                                                        className="w-full h-12 rounded-2xl border-indigo-200 text-indigo-700 font-bold text-[11px] uppercase tracking-widest bg-white hover:bg-indigo-50"
                                                                    >
                                                                        {copy('View merchant shops', 'Ona maduka ya muuzaji')}
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    <div className="p-6 rounded-[2.5rem] bg-emerald-50 border border-emerald-100 space-y-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                                                <Navigation className="h-5 w-5" />
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="font-black text-emerald-900 uppercase text-[11px] tracking-widest">{copy('Delivery location', 'Eneo la kufikisha')}</h4>
                                                                                <p className="text-[10px] font-bold text-emerald-600/70">{copy('Choose a location so we can calculate shipping cost.', 'Chagua eneo ili tujue gharama ya usafiri')}</p>
                                                                            </div>
                                                                        </div>

                                                                        <button
                                                                            onClick={() => setIsAddressPickerOpen(true)}
                                                                            className="w-full p-4 rounded-2xl bg-white border border-emerald-200 text-left hover:border-emerald-400 transition-colors group"
                                                                        >
                                                                            {(physicalAddress || order?.delivery?.physical_address) ? (
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs font-bold text-emerald-900 line-clamp-1">{physicalAddress || order?.delivery?.physical_address}</span>
                                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 ml-2" />
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs font-bold text-emerald-600/50 uppercase tracking-widest">{copy('Choose on map (zone matching)', 'Chagua kwenye ramani (zone matching)')}</span>
                                                                                    <ChevronRight className="h-4 w-4 text-emerald-300 group-hover:translate-x-1 transition-transform" />
                                                                                </div>
                                                                            )}
                                                                        </button>

                                                                        <div className="space-y-2">
                                                                            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1">{copy('Delivery address (manual)', 'Anwani ya kufikisha (manual)')}</label>
                                                                            <textarea
                                                                                value={physicalAddress || order?.delivery?.physical_address || ''}
                                                                                onChange={e => setPhysicalAddress(e.target.value)}
                                                                                placeholder={copy('Example: Uhuru Street, China Plaza Building, Room 402...', 'Mfano: Mtaa wa Uhuru, Jengo la China Plaza, Room 402...')}
                                                                                className="w-full min-h-[80px] p-4 rounded-2xl bg-white border border-emerald-100 focus:border-emerald-400 outline-none text-xs font-bold text-emerald-900 resize-none transition-colors"
                                                                            />
                                                                            <p className="text-[9px] font-bold text-emerald-600/60 leading-relaxed italic px-1">
                                                                                * {copy('Use this field for extra details or the freight agent address.', 'Tumia sehemu hii kuweka maelezo ya ziada au address ya wakala (freight agent).')}
                                                                            </p>
                                                                        </div>

                                                                        {selectedZoneId && (
                                                                            <div className="pt-2 flex items-center justify-between border-t border-emerald-100">
                                                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{copy('Shipping cost', 'Gharama ya usafiri')}</span>
                                                                                <span className="text-sm font-black text-emerald-900">
                                                                                    {(() => {
                                                                                        const selectedZone = shippingZones.find(z => String(z.id) === String(selectedZoneId));
                                                                                        const selectedFee = Number(selectedZone?.flat_rate_fee || 0);
                                                                                        if (selectedZone?.delivery_type === 'intercity_bus' && selectedFee <= 0) {
                                                                                            return 'Itathibitishwa kwenye chat';
                                                                                        }
                                                                                        return `TZS ${selectedFee.toLocaleString()}`;
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <Button
                                                                onClick={() => {
                                                                    const activeZone = shippingZones.find(z => String(z.id) === String(selectedZoneId));
                                                                    submitAction('update_delivery', {
                                                                        delivery_type: isSelfPickupChoice ? 'self_pickup' : (activeZone?.delivery_type || 'local_boda'),
                                                                        delivery_zone_id: isSelfPickupChoice ? null : selectedZoneId,
                                                                        shipping_fee: isSelfPickupChoice ? 0 : (activeZone?.flat_rate_fee || 0),
                                                                        physical_address: physicalAddress || order?.delivery?.physical_address,
                                                                        latitude: customerLat || order?.delivery?.latitude,
                                                                        longitude: customerLng || order?.delivery?.longitude,
                                                                        shipping_hotspot_id: null,
                                                                        title: isSelfPickupChoice ? 'NIMECHAGUA PICKUP' : `NIMECHAGUA DELIVERY: ${physicalAddress || order?.delivery?.physical_address}`
                                                                    });
                                                                }}
                                                                disabled={!isSelfPickupChoice && !selectedZoneId && !physicalAddress && !order?.delivery?.physical_address}
                                                                className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-brand-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                                            >
                                                                {copy('Confirm shipping', 'Thibitisha usafirishaji')}
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {activeAction === 'shipping_cost' && actingAs === 'merchant' && (
                                                        <div className="p-4 rounded-2xl bg-brand-50 border border-brand-100 space-y-3">
                                                            <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest flex items-center gap-2"><MapPin className="h-3 w-3" /> {copy('Shipping information', 'Taarifa za usafirishaji')}</p>
                                                            <div className="space-y-1">
                                                                <p className="text-xs font-black text-brand-900">{order?.delivery?.physical_address || (order?.delivery?.latitude ? `${order.delivery.latitude}, ${order.delivery.longitude}` : 'Address Haijawekwa')}</p>
                                                                {!isForwarderOrder && (() => {
                                                                    const closest = findClosestLocation();
                                                                    return closest ? (
                                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                            <Navigation className="h-3 w-3" />
                                                                            <span>{closest.distance}km kutoka duka lako la {closest.name}</span>
                                                                        </div>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                            {isForwarderOrder && (
                                                                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-900">
                                                                    {copy('Forwarder drop-off uses courier/waybill evidence, not a Takeer driver route.', 'Kupeleka kwa forwarder hutumia ushahidi wa courier/waybill, si route ya dereva wa Takeer.')}
                                                                </div>
                                                            )}
                                                            {!isForwarderOrder && order?.delivery?.latitude && (
                                                                <a href={`https://www.google.com/maps/search/?api=1&query=${order.delivery.latitude},${order.delivery.longitude}`} target="_blank" className="block text-center py-2 bg-white rounded-xl border border-brand-200 text-[10px] font-black text-brand-700 hover:bg-brand-50 transition-colors">{copy('OPEN MAP', 'FUNGUA RAMANI')}</a>
                                                            )}
                                                        </div>
                                                    )}

                                                    {activeAction === 'discount' && (
                                                        <div className="space-y-6">
                                                            {Number(order.discount_amount) > 0 && (
                                                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                                    <p className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-2 tracking-widest">{copy('Current discount', 'Punguzo la sasa')}</p>
                                                                    {showDiscountResetConfirm ? (
                                                                        <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-between gap-4 animate-in zoom-in-95 duration-200">
                                                                            <p className="text-[10px] font-black text-red-900 uppercase">{copy('Remove this discount?', 'Futa punguzo hili?')}</p>
                                                                            <div className="flex gap-2">
                                                                                <Button onClick={() => { submitAction('discount', { mode: 'reset', title: copy('REMOVE DISCOUNT', 'FUTA PUNGUZO') }); setShowDiscountResetConfirm(false); }} className="h-8 px-4 rounded-xl bg-red-600 text-white font-black text-[10px] uppercase">{copy('YES', 'NDIYO')}</Button>
                                                                                <Button onClick={() => setShowDiscountResetConfirm(false)} variant="ghost" className="h-8 px-4 rounded-xl font-black text-[10px] uppercase">{copy('BACK', 'RUDI')}</Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-100 flex items-center justify-between shadow-sm group">
                                                                            <div>
                                                                                <p className="text-xl font-black text-amber-600">TZS {Number(order.discount_amount || 0).toLocaleString()}</p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => setShowDiscountResetConfirm(true)}
                                                                                className="h-10 w-10 rounded-xl bg-white border border-amber-200 text-amber-400 flex items-center justify-center hover:bg-red-500 hover:border-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                                                            >
                                                                                <X className="h-5 w-5" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="space-y-3">
                                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('Add discount', 'Ongeza punguzo')}</label>
                                                                <div className="relative group">
                                                                    <Input
                                                                        type="number"
                                                                        value={actionPayload.amount || ''}
                                                                        onChange={e => setActionPayload(p => ({ ...p, amount: Number(e.target.value) }))}
                                                                        className="h-16 rounded-2xl text-2xl font-black bg-slate-50 border-2 border-transparent transition-all focus:bg-white focus:border-amber-200 outline-none pl-6 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        placeholder="0.00"
                                                                    />
                                                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 pointer-events-none group-focus-within:text-amber-300 transition-colors">TZS</div>
                                                                </div>
                                                            </div>

                                                            <div className="pt-4">
                                                                <Button
                                                                    onClick={() => {
                                                                        submitAction('discount', { ...actionPayload, mode: 'add', title: `WEKA PUNGUZO TZS ${Number(actionPayload.amount).toLocaleString()}` });
                                                                        setActionPayload({ ...actionPayload, amount: '' });
                                                                    }}
                                                                    disabled={!actionPayload.amount || actionPayload.amount <= 0}
                                                                    className="w-full h-16 rounded-[2rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-600/30 transition-all active:scale-[0.98]"
                                                                >
                                                                    {copy('ADD DISCOUNT', 'WEKA PUNGUZO')}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeAction === 'shipping_cost' && (
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('What TZS charge?', 'Ushaji wa TZS gani?')}</label>
                                                            <div className="relative group">
                                                                <Input type="number" value={actionPayload.amount} onChange={e => setActionPayload(p => ({ ...p, amount: Number(e.target.value) }))} className="h-16 rounded-2xl text-2xl font-black bg-slate-50 border-2 border-transparent transition-all focus:bg-white focus:border-brand-200 outline-none pl-6 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0.00" />
                                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 pointer-events-none group-focus-within:text-brand-200 transition-colors">TZS</div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeAction === 'extra_charge' && actingAs === 'merchant' && (
                                                        <form onSubmit={proposeExtraCharge} className="space-y-5">
                                                            <div className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-xs font-bold leading-relaxed text-orange-900">
                                                                {copy('This action is recorded in order chat as part of the agreement trail.', 'Kitendo hiki kinarekodiwa kwenye chat ya order kama sehemu ya historia ya makubaliano.')}
                                                            </div>
                                                            {activeExtraCharge?.status === 'proposed' && (
                                                                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-900">
                                                                    {copy('An extra charge is awaiting the buyer response. Saving here updates that same proposal.', 'Kuna extra charge inayosubiri jibu la mteja. Ukisave hapa, amount/note itabadilishwa kwenye proposal hiyo hiyo.')}
                                                                </div>
                                                            )}
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('Extra cost', 'Gharama ya ziada')}</label>
                                                                <div className="relative group">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        value={extraChargeAmount}
                                                                        onChange={e => setExtraChargeAmount(e.target.value)}
                                                                        className="h-16 rounded-2xl text-2xl font-black bg-slate-50 border-2 border-transparent transition-all focus:bg-white focus:border-orange-200 outline-none pl-6 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        placeholder="0.00"
                                                                    />
                                                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300 pointer-events-none group-focus-within:text-orange-300 transition-colors">TZS</div>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('Note for buyer', 'Maelezo kwa mteja')}</label>
                                                                <textarea
                                                                    value={extraChargeNote}
                                                                    onChange={e => setExtraChargeNote(e.target.value)}
                                                                    placeholder={copy('Example: Extra cost agreed in chat...', 'Mfano: Gharama ya ziada mliyokubaliana kwenye chat...')}
                                                                    className="w-full min-h-[110px] rounded-2xl bg-slate-50 border-2 border-transparent p-4 text-sm font-bold placeholder:opacity-50 resize-none outline-none focus:bg-white focus:border-orange-200 focus:ring-4 ring-orange-500/5 transition-all"
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                                {canRemoveExtraCharge && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        onClick={removeExtraCharge}
                                                                        disabled={pickupActionSubmitting}
                                                                        className="h-14 rounded-2xl border-red-100 text-[11px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50"
                                                                    >
                                                                        <X className="mr-2 h-4 w-4" />
                                                                        {copy('Remove', 'Ondoa')}
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    type="submit"
                                                                    disabled={pickupActionSubmitting || Number(String(extraChargeAmount).replace(/,/g, '')) <= 0}
                                                                    className={cn(
                                                                        "h-14 rounded-2xl bg-orange-600 text-[11px] font-black uppercase tracking-widest text-white hover:bg-orange-700",
                                                                        !canRemoveExtraCharge && "sm:col-span-2"
                                                                    )}
                                                                >
                                                                    {pickupActionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                                                                    {activeExtraCharge?.status === 'proposed' ? 'Update Charge' : 'Send Charge'}
                                                                </Button>
                                                            </div>
                                                        </form>
                                                    )}

                                                    {activeAction === 'quantity' && (
                                                        <div className="space-y-4">
                                                            <div className="p-6 rounded-3xl bg-blue-50/50 border border-blue-100 flex flex-col items-center gap-4">
                                                                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest">{copy('Quantity of', 'Idadi ya')} {order?.product?.title || copy('Product', 'Bidhaa')}</p>
                                                                <div className="flex items-center gap-6">
                                                                    <button onClick={() => setActionPayload(p => ({ ...p, quantity: Math.max(1, p.quantity - 1) }))} className="h-12 w-12 rounded-2xl bg-white border-2 border-blue-100 text-blue-600 flex items-center justify-center text-2xl font-black active:scale-90 transition-transform shadow-sm">-</button>
                                                                    <span className="text-4xl font-black text-brand-900">{actionPayload.quantity}</span>
                                                                    <button onClick={() => setActionPayload(p => ({ ...p, quantity: p.quantity + 1 }))} className="h-12 w-12 rounded-2xl bg-white border-2 border-blue-100 text-blue-600 flex items-center justify-center text-2xl font-black active:scale-90 transition-transform shadow-sm">+</button>
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-center text-slate-400 px-4 italic leading-relaxed">{copy('Changing the quantity updates the order total based on this product price.', 'Unapobadilisha idadi, jumla ya gharama ya oda itabadilika kulingana na bei ya bidhaa hii.')}</p>
                                                        </div>
                                                    )}

                                                    {activeAction === 'complaint' && (
                                                        <div className="space-y-6">
                                                            {getActiveComplaint() ? (
                                                                <div className="space-y-6">
                                                                    <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-brand-100 dark:border-brand-900/50">
                                                                        <div className="flex items-center gap-3 mb-4">
                                                                            <div className="h-10 w-10 rounded-2xl bg-red-500 flex items-center justify-center text-white">
                                                                                <AlertTriangle className="h-6 w-6" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy('Complaint status', 'Hali ya malalamiko')}</p>
                                                                                <h4 className="text-lg font-black text-brand-900 dark:text-brand-100 uppercase tracking-tight">{copy('ESCALATED', 'INAPELELEZWA')}</h4>
                                                                            </div>
                                                                        </div>

                                                                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-brand-50 dark:border-brand-900/40">
                                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{copy('Your details', 'Maelezo yako')}</p>
                                                                            <p className="text-sm font-bold text-brand-900 dark:text-brand-100 leading-relaxed italic">"{getActiveComplaint().payload?.reason}"</p>
                                                                        </div>

                                                                        {actingAs === 'merchant' && (
                                                                            <div className="grid grid-cols-2 gap-3 mt-6">
                                                                                <Button onClick={() => submitAction('complaint_resolved', { title: copy('COMPLAINT RESOLVED', 'MALALAMIKO YAMETATULIWA') })} className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-600/20">{copy('MARK RESOLVED', 'WEKA IMETATULIWA')}</Button>
                                                                                <Button onClick={() => submitAction('complaint_appealed', { title: copy('APPEAL SUBMITTED', 'RUFAA IMEKATWA') })} variant="outline" className="h-14 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 font-black uppercase tracking-widest text-[10px]">{copy('APPEAL', 'KATA RUFAA')}</Button>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <p className="text-[10px] font-bold text-center text-slate-400 px-6 leading-relaxed uppercase italic">
                                                                        {actingAs === 'buyer'
                                                                            ? "Tayari una malalamiko ya oda hii yanayofanyiwa kazi. Huwezi kufungua mapya mpaka yaliyopo yatatuliwe."
                                                                            : "Kama muuzaji, unaweza kumaliza mgogoro huu kwa kukubaliana na mteja au kukata rufaa kwa platform."}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                actingAs === 'buyer' ? (
                                                                    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                                                                        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold leading-relaxed space-y-2">
                                                                            <p className="font-black uppercase text-[10px] tracking-widest text-red-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {copy('IMPORTANT NOTICE', 'TANBIHI MUHIMU')}</p>
                                                                            <p>{copy('Complaints are sent directly to the Takeer platform for resolution.', 'Malalamiko yatatumwa moja kwa moja kwenye platform ya Takeer kwa ajili ya utatuzi.')}</p>
                                                                            <p className="italic underline">{copy('Report an issue if the product is not what you ordered or shows signs of fraud.', 'Tuma malalamiko ikiwa bidhaa uliyopokea sio yenyewe au kuna dalili zozote za utapeli.')}</p>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('Full details', 'Maelezo kamili')}</label>
                                                                            <textarea className="w-full h-32 rounded-2xl bg-slate-50 border-2 border-transparent p-4 text-sm font-bold placeholder:opacity-50 resize-none outline-none focus:bg-white focus:border-red-200 focus:ring-4 ring-red-500/5 transition-all" placeholder={copy('Briefly explain what happened...', 'Elezea kwa kifupi kilichotokea...')} onChange={e => setActionPayload(p => ({ ...p, reason: e.target.value }))} />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-12 flex flex-col items-center text-center space-y-4">
                                                                        <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center">
                                                                            <ShieldCheck className="h-10 w-10 text-slate-200" />
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">{copy('No complaints', 'Hakuna malalamiko')}</h4>
                                                                            <p className="text-[11px] font-bold text-slate-300 mt-1 uppercase">{copy('The buyer has not opened a dispute about this order.', 'Mteja hajafungua mgogoro wowote kuhusu oda hii.')}</p>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}

                                                    {activeAction === 'upsell' && (
                                                        <div className="space-y-6">
                                                            <div className="relative group mx-4">
                                                                <Input
                                                                    type="text"
                                                                    placeholder={copy('Search this shop...', 'Tafuta bidhaa za duka hili...')}
                                                                    className="h-14 rounded-[1.25rem] pl-12 bg-white border-2 border-slate-100 focus:border-brand-300 outline-none transition-all shadow-sm font-bold"
                                                                    value={searchQuery}
                                                                    onChange={(e) => handleSearchProducts(e.target.value)}
                                                                />
                                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
                                                                {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-brand-500" />}
                                                            </div>

                                                            {/* Horizontal Scroll List */}
                                                            <div className="flex gap-4 overflow-x-auto pb-4 px-4 no-scrollbar scroll-smooth">
                                                                {searchResults.length > 0 ? searchResults.map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        onClick={() => {
                                                                            setSelectedProduct(p);
                                                                            setSelectedVariant(p.has_variants && p.variants?.length ? p.variants[0] : null);
                                                                        }}
                                                                        className="flex flex-col w-44 shrink-0 p-3 rounded-[2.5rem] bg-white border border-slate-100 hover:border-brand-200 transition-all shadow-sm hover:shadow-md group text-left"
                                                                    >
                                                                        <div className="h-36 w-full rounded-[2rem] bg-slate-50 flex-shrink-0 overflow-hidden mb-3">
                                                                            {p.image_url || p.url ? (
                                                                                <img src={p.image_url || p.url} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                                                                            ) : (
                                                                                <ProductFallbackIcon type={p.type} className="text-slate-300" />
                                                                            )}
                                                                        </div>
                                                                        <div className="px-1 min-w-0">
                                                                            <h4 className="font-black text-brand-900 text-xs truncate mb-1">{p.title}</h4>
                                                                            <span className="text-[10px] font-black text-brand-600 block">{getPriceRange(p)}</span>
                                                                        </div>
                                                                    </button>
                                                                )) : searchQuery && !isSearching ? (
                                                                    <div className="w-full py-12 flex flex-col items-center justify-center opacity-40">
                                                                        <Search className="h-12 w-12 mb-4" />
                                                                        <p className="font-black uppercase text-xs tracking-widest">{copy('No results', 'Hakuna matokeo')}</p>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeAction === 'order_items' && (
                                                        <div className="space-y-8 px-4 pb-12">
                                                            <OrderSelectionSummaryCard
                                                                items={orderItems}
                                                                subtotal={itemsSubtotal}
                                                                shipping={shippingTotal}
                                                                discount={discountTotal}
                                                                total={dealTotal}
                                                            />

                                                            {order.payment_status !== 'paid' && actingAs === 'buyer' && (
                                                                <div className="text-center">
                                                                    {showCancelConfirm ? (
                                                                        <div className="p-6 rounded-[2rem] bg-red-50 border-2 border-red-100 animate-in zoom-in-95 duration-200">
                                                                            <p className="text-xs font-black text-red-900 mb-4">{copy('Are you sure you want to cancel this order? It cannot be reopened.', 'Je, una uhakika unataka kughairi oda hii? Haiwezi kufunguliwa tena.')}</p>
                                                                            <div className="grid grid-cols-2 gap-3">
                                                                                <Button onClick={() => submitAction('cancel_order', { title: copy('CANCEL ORDER', 'GHAIRI ODA') })} variant="destructive" className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]">{copy('YES, CANCEL', 'NDIYO, GHAIRI')}</Button>
                                                                                <Button onClick={() => setShowCancelConfirm(false)} variant="ghost" className="h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]">{copy('NO, GO BACK', 'HAPANA, RUDI')}</Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setShowCancelConfirm(true)}
                                                                            className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors underline underline-offset-4"
                                                                        >
                                                                            {copy('CANCEL THIS ORDER', 'GHAIRI ODA HII')}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {activeAction === 'review' && (
                                                        <div className="space-y-6">
                                                            {orderStatus !== 'delivered' && orderStatus !== 'completed' ? (
                                                                <div className="p-8 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center text-center">
                                                                    <X className="h-10 w-10 text-slate-300 mb-4" />
                                                                    <p className="text-sm font-black text-slate-500 uppercase tracking-tight mb-2">{copy('You cannot review yet', 'Hauwezi kutoa maoni sasa')}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase">{copy('Please wait until you receive your product before reviewing this service.', 'Tafadhali subiri mpaka upokee bidhaa yako ndipo utoe maoni kuhusu huduma hii.')}</p>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex flex-col items-center justify-center p-6 bg-amber-50/50 rounded-3xl border border-amber-100 group">
                                                                        <p className="text-[10px] font-black uppercase text-amber-600 mb-4 tracking-widest">{copy('Tap a star to rate', 'Gusa nyota ili upige kura')}</p>
                                                                        <div className="flex items-center gap-2">
                                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                                <button key={s} onClick={() => setActionPayload(p => ({ ...p, stars: s }))} className="p-1 transition-transform hover:scale-125 active:scale-90"><Star className={cn("h-10 w-10 transition-colors", s <= (actionPayload.stars || 5) ? "fill-amber-500 text-amber-500" : "text-amber-200")} /></button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('Your review', 'Maoni yako')}</label>
                                                                        <textarea className="w-full h-24 rounded-2xl bg-slate-50 border-2 border-transparent p-4 text-sm font-bold placeholder:opacity-50 resize-none outline-none focus:bg-white focus:border-amber-200 focus:ring-4 ring-amber-500/5 transition-all" placeholder={copy('Write your review here...', 'Toa maoni yako hapa...')} onChange={e => setActionPayload(p => ({ ...p, comment: e.target.value }))} />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {activeAction === 'shipping_proof' && (
                                                        <div className="space-y-4">
                                                            <p className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('Files to upload', 'Vitu vya kupakia')}</p>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <button
                                                                    onClick={() => mediaRef.current?.click()}
                                                                    className="group flex flex-col items-center justify-center gap-3 h-40 border-2 border-dashed border-brand-200 rounded-3xl bg-brand-50/30 hover:bg-white hover:border-brand-500 transition-all"
                                                                >
                                                                    <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform"><ImageIcon className="h-6 w-6" /></div>
                                                                    <span className="text-[10px] font-black uppercase text-brand-900 tracking-tighter">{copy('Waybill receipt', 'Risiti ya waybill')}</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => mediaRef.current?.click()}
                                                                    className="group flex flex-col items-center justify-center gap-3 h-40 border-2 border-dashed border-brand-200 rounded-3xl bg-brand-50/30 hover:bg-white hover:border-brand-500 transition-all"
                                                                >
                                                                    <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 group-hover:scale-110 transition-transform"><Video className="h-6 w-6" /></div>
                                                                    <span className="text-[10px] font-black uppercase text-brand-900 tracking-tighter">{copy('Packing proof', 'Ushahidi wa kufunga')}</span>
                                                                </button>
                                                            </div>
                                                            <p className="text-[9px] font-bold text-center text-slate-400 uppercase">{copy('This photo or video helps if the buyer opens a dispute.', 'Picha au video hii itasaidia kama mteja akifungua mgogoro (dispute)')}</p>
                                                        </div>
                                                    )}

                                                    {activeAction === 'unboxing_video' && (
                                                        <div className="space-y-4">
                                                            <p className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">{copy('Unboxing video', 'Video ya unboxing')}</p>
                                                            <button
                                                                onClick={() => mediaRef.current?.click()}
                                                                className="group flex flex-col items-center justify-center gap-3 w-full h-40 border-2 border-dashed border-brand-200 rounded-3xl bg-brand-50/30 hover:bg-white hover:border-brand-500 transition-all"
                                                            >
                                                                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform"><Video className="h-6 w-6" /></div>
                                                                <span className="text-[10px] font-black uppercase text-brand-900 tracking-tighter">{copy('Upload unboxing video', 'Pakia video ya unboxing')}</span>
                                                            </button>
                                                            <p className="text-[9px] font-bold text-center text-slate-400 uppercase leading-relaxed px-6">{copy('This video is important if you need a refund because the product arrived damaged or faulty.', 'Hii video ni muhimu kama utahitaji kurejeshewa pesa endapo bidhaa imekuja na tatizo au imevunjika.')}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-6 pb-6 mt-auto">
                                                    {activeAction !== 'upsell' && activeAction !== 'order_items' && activeAction !== 'discount' && activeAction !== 'order_delivery' && activeAction !== 'extra_charge' && (
                                                        <Button
                                                            className="w-full h-16 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-600/30 transition-all active:scale-[0.98]"
                                                            disabled={
                                                                (activeAction === 'review' && (orderStatus !== 'delivered' && orderStatus !== 'completed')) ||
                                                                (activeAction === 'complaint' && (getActiveComplaint() || (actingAs === 'merchant')))
                                                            }
                                                            onClick={() => submitAction(activeAction, { ...actionPayload, title: `SETI ${activeAction.toUpperCase()}`, userName: auth.user.name })}
                                                        >
                                                            SETI {activeAction.toUpperCase()}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </DrawerContent>
                            </Drawer>

                            <div className="relative flex-1">
                                <Input type="text" placeholder={copy('Write your message here...', 'Andika ujumbe wako hapa...')} value={input} onChange={(e) => setInput(e.target.value)} className="h-12 pl-4 pr-10 rounded-full border-brand-100 focus-visible:ring-brand-500 shadow-sm" />
                                <input
                                    type="file"
                                    ref={mediaRef}
                                    className="absolute inset-0 opacity-0 cursor-pointer pointer-events-none w-0 h-0"
                                    accept="image/*,video/*"
                                    onChange={handleMediaUpload}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => mediaRef.current?.click()}
                                    disabled={isUploading}
                                    title={copy('Attach photo or video', 'Ambatanisha picha au video')}
                                    className="absolute right-1 top-1 h-10 w-10 text-brand-400 hover:text-brand-600 hover:bg-transparent"
                                >
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-5 w-5" />}
                                </Button>
                            </div>

                            <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0 h-12 w-12 rounded-full bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-600/20">
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </Button>
                        </form>
                    )}
                </div>

                <ShopLocationsModal
                    isOpen={isShopModalOpen}
                    onOpenChange={setIsShopModalOpen}
                    locations={order?.merchant?.locations || []}
                    productName={order?.product?.title}
                />

                <AddressPickerModal
                    isOpen={isAddressPickerOpen}
                    onOpenChange={setIsAddressPickerOpen}
                    onSave={handleAddressSaved}
                    initialLat={customerLat}
                    initialLng={customerLng}
                />

                {/* Product Chat Detail Modal */}
                <Drawer open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
                    <DrawerContent className="mx-auto w-full max-w-xl rounded-t-[1.5rem] border-t border-slate-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex max-h-[82vh] flex-col">
                            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {actingAs === 'merchant' ? copy('Recommend a product', 'Pendekeza bidhaa') : copy('Add to order', 'Ongeza kwenye oda')}
                                    </p>
                                    <h3 className="mt-0.5 text-base font-black text-slate-950 dark:text-slate-100">
                                        {copy('Review the product before sending', 'Hakiki bidhaa kabla ya kutuma')}
                                    </h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedProduct(null)}
                                    className="h-10 w-10 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                                <div className="flex gap-4">
                                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                                        {selectedProduct?.image_url || selectedProduct?.url ? (
                                            <img src={selectedProduct.image_url || selectedProduct.url} className="h-full w-full object-cover" alt={selectedProduct?.title || copy('Product', 'Bidhaa')} />
                                        ) : (
                                            <ProductFallbackIcon type={selectedProduct?.type} className="text-slate-300" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="line-clamp-2 text-lg font-black leading-snug text-slate-950 dark:text-slate-100">
                                            {selectedVariant ? `${selectedProduct?.title} (${selectedVariant.name})` : selectedProduct?.title}
                                        </h2>
                                        <p className="mt-2 text-2xl font-black text-brand-700">
                                            TZS {Number(selectedVariant?.price ?? selectedProduct?.price ?? 0).toLocaleString()}
                                        </p>
                                        {selectedProduct?.compare_at_price && (
                                            <p className="mt-0.5 text-xs font-bold text-slate-400 line-through">
                                                TZS {Number(selectedProduct.compare_at_price).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {selectedProduct?.has_variants && selectedProduct?.variants?.length > 0 && (
                                    <div className="mt-5 space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy('Choose type', 'Chagua aina')}</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedProduct.variants.map(v => (
                                                <button
                                                    key={v.id}
                                                    type="button"
                                                    onClick={() => setSelectedVariant(v)}
                                                    className={cn(
                                                        "min-h-12 rounded-2xl border px-3 py-2 text-left transition-all",
                                                        selectedVariant?.id === v.id
                                                            ? "border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-200"
                                                            : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                                    )}
                                                >
                                                    <span className="block truncate text-xs font-black">{v.name}</span>
                                                    <span className="mt-0.5 block text-[10px] font-bold text-slate-500">TZS {Number(v.price || 0).toLocaleString()}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950">
                                <Button
                                    onClick={() => {
                                        const p = {
                                            id: selectedProduct.id,
                                            variant_id: selectedVariant?.id,
                                            title: selectedVariant ? `${selectedProduct.title} (${selectedVariant.name})` : selectedProduct.title,
                                            price: selectedVariant ? selectedVariant.price : selectedProduct.price,
                                            image: selectedProduct.image_url || selectedProduct.url,
                                            quantity: 1,
                                            variant_name: selectedVariant?.name,
                                            type: selectedProduct.type,
                                            product_type: selectedProduct.type,
                                            digital_delivery_type: selectedProduct.digital_delivery_type,
                                            digital_content_type: selectedProduct.digital_content_type,
                                            service_location_type: selectedProduct.service_location_type
                                        };
                                        submitAction(actingAs === 'merchant' ? 'suggest_product' : 'add_to_order', {
                                            product: p,
                                            title: actingAs === 'merchant' ? `SUGGEST ${p.title}` : `ADD ${p.title}`
                                        });
                                        setSelectedProduct(null);
                                    }}
                                    disabled={selectedProduct?.has_variants && selectedProduct?.variants?.length > 0 && !selectedVariant}
                                    className="h-14 w-full rounded-2xl bg-brand-600 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
                                >
                                    {actingAs === 'merchant' ? (
                                        <><Plus className="mr-2 h-5 w-5" /> {copy('Suggest to buyer', 'Pendekeza kwa mteja')}</>
                                    ) : (
                                        <><ShoppingBag className="mr-2 h-5 w-5" /> {copy('Add to order', 'Ongeza kwenye oda')}</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DrawerContent>
                </Drawer>
                {/* Payment Drawer */}
                <Drawer open={isPaymentDrawerOpen} onOpenChange={setIsPaymentDrawerOpen}>
                    <DrawerContent className="mx-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] border-t border-brand-100/50 bg-white p-0 dark:border-brand-900/50 dark:bg-slate-950 sm:max-w-xl">
                        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900 p-8 text-white">
                            <div className="absolute top-[-20%] right-[-10%] h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center mb-4 border border-white/30 shadow-lg">
                                    <Zap className="h-10 w-10 fill-white" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-1">{copy('Payment process', 'Mchakato wa malipo')}</p>
                                <h2 className="text-4xl font-black tracking-tight mb-2">TZS {orderDisplayTotal.toLocaleString()}</h2>
                                <div className="px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3" /> {copy('Secure payment through PSP', 'Malipo salama kupitia PSP')}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-8 overflow-y-auto p-8 pb-12">
                            {/* Custom Tabs */}
                            <div className="grid grid-cols-2 gap-3 p-1.5 rounded-[2rem] bg-slate-50 border border-slate-100">
                                <button
                                    onClick={() => setPaymentMethod('mobile')}
                                    className={cn(
                                        "flex items-center justify-center gap-3 py-4 rounded-[1.50rem] font-black text-[11px] uppercase tracking-widest transition-all",
                                        paymentMethod === 'mobile' ? "bg-white shadow-lg text-brand-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <Zap className={cn("h-4 w-4", paymentMethod === 'mobile' ? "fill-brand-600" : "fill-slate-400")} />
                                    {copy('Pay by mobile', 'Lipa kwa simu')}
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('card')}
                                    className={cn(
                                        "flex items-center justify-center gap-3 py-4 rounded-[1.50rem] font-black text-[11px] uppercase tracking-widest transition-all",
                                        paymentMethod === 'card' ? "bg-white shadow-lg text-brand-600" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    <CreditCard className="h-4 w-4" />
                                    {copy('Pay by card', 'Lipa kwa kadi')}
                                </button>
                            </div>

                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {paymentMethod === 'mobile' ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{copy('Payment phone number', 'Namba ya simu ya malipo')}</label>
                                            <div className="relative group">
                                                <Input
                                                    value={paymentPhone}
                                                    onChange={e => setPaymentPhone(e.target.value)}
                                                    className="h-20 rounded-3xl text-3xl font-black bg-slate-50 border-2 border-transparent focus:border-brand-300 outline-none pl-8 shadow-inner"
                                                    placeholder="0XXX XXXXXX"
                                                />
                                                <div className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-slate-300 pointer-events-none group-focus-within:text-brand-300 transition-colors uppercase tracking-widest text-xs">{copy('Phone', 'Simu')}</div>
                                            </div>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic px-2">
                                            {copy('Keep your phone nearby. You will receive a PIN prompt to complete payment.', 'Hakikisha simu iko karibu. Utapokea ombi la kuweka PIN ili kukamilisha malipo.')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="aspect-video bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-8 gap-4">
                                        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                            <CreditCard className="h-8 w-8" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-black text-slate-400 uppercase tracking-widest text-sm">{copy('Card payments coming soon', 'Malipo ya kadi yanakuja hivi karibuni')}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 leading-relaxed max-w-[200px]">{copy('We are finalizing bank integrations to enable card payments.', 'Tunakamilisha ushirikiano na benki ili kukuwezesha kulipa kwa kadi.')}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={async () => {
                                    if (paymentMethod === 'card') {
                                        toast.info(copy('Please use mobile money payment for now.', 'Tafadhali tumia malipo ya simu kwa sasa.'));
                                        return;
                                    }
                                    setIsPaying(true);
                                    try {
                                        const paymentResult = await submitAction('initiate_payment', {
                                            payment_number: paymentPhone,
                                            title: copy(`Payment started — TZS ${orderDisplayTotal.toLocaleString()}`, `Malipo yameanzishwa — TZS ${orderDisplayTotal.toLocaleString()}`)
                                        });

                                        const freshOrder = paymentResult?.order;
                                        if (!freshOrder || freshOrder.payment_status === 'pending') {
                                            return;
                                        }

                                        setOrder(freshOrder);
                                        setIsPaymentDrawerOpen(false);
                                        toast.success(copy(`Payment of TZS ${Number(freshOrder.order_total_with_additions || freshOrder.total_paid || orderDisplayTotal).toLocaleString()} completed!`, `Malipo ya TZS ${Number(freshOrder.order_total_with_additions || freshOrder.total_paid || orderDisplayTotal).toLocaleString()} yamekamilika!`));
                                    } finally {
                                        setIsPaying(false);
                                    }
                                }}
                                disabled={isPaying || (paymentMethod === 'mobile' && !paymentPhone)}
                                className="w-full h-20 rounded-[2.5rem] bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-brand-600/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {isPaying ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <>
                                        <ShieldCheck className="h-5 w-5" />
                                        {copy('Complete payment', 'Kamilisha malipo')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </DrawerContent>
                </Drawer>

                {/* Dispute Drawer */}
                <Drawer open={isDisputeDrawerOpen} onOpenChange={setIsDisputeDrawerOpen}>
                    <DrawerContent className="rounded-t-[2rem] bg-white dark:bg-slate-950">
                        <DrawerHeader>
                            <DrawerTitle className="text-xl font-black text-red-600 uppercase tracking-tight">{copy('Report an issue (Dispute)', 'Ripoti tatizo (mgogoro)')}</DrawerTitle>
                            <DrawerDescription className="text-xs font-bold text-slate-500">{copy('Provider settlement is not complete. Explain the issue and add video evidence (unboxing video).', 'Provider settlement haijakamilika. Tueleze tatizo na weka ushahidi wa video (unboxing video).')}</DrawerDescription>
                        </DrawerHeader>
                        <div className="p-4 space-y-4 pb-10">
                            <textarea
                                value={disputeReason}
                                onChange={e => setDisputeReason(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                                placeholder={copy('Explain the issue in detail...', 'Eleza tatizo kwa kina...')}
                                rows={4}
                            />
                            <button type="button" onClick={() => { const el = document.getElementById('dispute-video-input'); if (el) el.click(); }} className={cn("w-full flex flex-col items-center justify-center p-6 rounded-xl border border-dashed transition-colors", disputeVideo ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "border-slate-300 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800")}>
                                <Video className={cn("h-8 w-8 mb-3", disputeVideo ? "text-emerald-500" : "text-slate-400")} />
                                <span className={cn("text-[10px] font-black uppercase tracking-widest", disputeVideo ? "text-emerald-600" : "text-slate-500")}>
                                    {disputeVideo ? copy('Video selected', 'Video imechaguliwa') : copy('Add unboxing video (MP4/MOV)', 'Weka unboxing video (MP4/MOV)')}
                                </span>
                                <input id="dispute-video-input" type="file" accept="image/*,video/*" className="hidden" onChange={e => setDisputeVideo(e.target.files?.[0])} />
                            </button>
                            <Button
                                onClick={submitDispute}
                                disabled={isSubmittingDispute || !disputeReason || !disputeVideo}
                                className="w-full h-14 rounded-xl bg-red-600 hover:bg-red-700 font-black text-white uppercase tracking-[0.2em] text-xs shadow-lg shadow-red-600/20"
                            >
                                {isSubmittingDispute ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : 'TUMA RIPOTI'}
                            </Button>
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>
        </AppLayout>
    );
}
