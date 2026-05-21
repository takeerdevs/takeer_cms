import React from 'react';
import { Camera, Check, Circle, MapPin, Phone, TriangleAlert, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

export const LOCAL_DELIVERY_STEPS = [
    { value: 'with_boda', label: 'Picked up', riderLabel: 'Nimechukua mzigo' },
    { value: 'in_transit', label: 'On the way', riderLabel: 'Nipo njiani' },
    { value: 'arrived', label: 'Arrived', riderLabel: 'Nimefika kwa mteja' },
    { value: 'delivered', label: 'Delivered', riderLabel: 'Imekabidhiwa' },
];

export const INTERCITY_DELIVERY_STEPS = [
    { value: 'with_boda', label: 'Picked up', riderLabel: 'Nimechukua mzigo' },
    { value: 'in_transit', label: 'On the way', riderLabel: 'Nipo njiani' },
    { value: 'ready_at_terminal', label: 'At terminal (Bus Terminal)', riderLabel: 'Uko terminal (Bus Terminal)' },
    { value: 'delivered', label: 'Delivered', riderLabel: 'Imekabidhiwa' },
];

export function deliveryStepsFor(deliveryType) {
    return deliveryType === 'intercity_bus' ? INTERCITY_DELIVERY_STEPS : LOCAL_DELIVERY_STEPS;
}

export function deliveryStatusText(status) {
    const map = {
        inquiry: 'Inquiry',
        packing: 'Packing order',
        ready_for_pickup: 'Ready for pickup',
        awaiting_boda: 'Awaiting delivery',
        awaiting_pickup: 'Awaiting pickup',
        dispatched: 'Dispatched',
        with_boda: 'Picked up',
        in_transit: 'On the way',
        arrived: 'Arrived at customer area',
        ready_at_terminal: 'At terminal (Bus Terminal)',
        delivered: 'Delivered',
        issue_reported: 'Issue reported',
        disputed: 'Disputed',
        customer_confirmed: 'Customer confirmed',
    };

    return map[status] || (status ? String(status).replaceAll('_', ' ') : 'No update yet');
}

export function deliveryStatusTextSw(status) {
    const map = {
        inquiry: 'Ombi',
        packing: 'Mzigo unaandaliwa',
        ready_for_pickup: 'Tayari kuchukuliwa',
        awaiting_boda: 'Inasubiri dereva',
        awaiting_pickup: 'Inasubiri kuchukuliwa',
        dispatched: 'Imetumwa',
        with_boda: 'Mzigo umechukuliwa',
        in_transit: 'Uko njiani',
        arrived: 'Umefika kwa mteja',
        ready_at_terminal: 'Uko terminal (Bus Terminal)',
        delivered: 'Imekabidhiwa',
        issue_reported: 'Kuna tatizo',
        disputed: 'Kuna malalamiko',
        customer_confirmed: 'Mteja amethibitisha',
    };

    return map[status] || (status ? String(status).replaceAll('_', ' ') : 'Hakuna taarifa bado');
}

export function deliveryCurrentIndex(delivery = {}) {
    const steps = deliveryStepsFor(delivery.delivery_type || delivery.type);
    const eventStatuses = Array.isArray(delivery.events) ? delivery.events.map((event) => event.status) : [];
    const status = delivery.status || delivery.delivery_status;
    const indexes = [...eventStatuses, status]
        .map((value) => steps.findIndex((step) => step.value === value))
        .filter((index) => index >= 0);

    return indexes.length ? Math.max(...indexes) : -1;
}

export function DeliveryFlowTimeline({
    delivery = {},
    compact = false,
    selectable = false,
    selectedStatus,
    onSelectStatus,
    riderLabels = false,
    disabledStatuses = [],
    renderAfterStep,
    swahili = false,
    className = '',
}) {
    const steps = deliveryStepsFor(delivery.delivery_type || delivery.type);
    const events = Array.isArray(delivery.events)
        ? [...delivery.events].sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return String(a.id || '').localeCompare(String(b.id || ''));
        })
        : [];
    const currentIndex = deliveryCurrentIndex(delivery);
    const latestSelectableIndex = Math.min(currentIndex + 1, steps.length - 1);
    const grouped = steps.reduce((acc, step) => {
        acc[step.value] = events.filter((event) => event.status === step.value || event.metadata?.stage_status === step.value);
        return acc;
    }, {});
    const otherEvents = events.filter((event) => !steps.some((step) => step.value === event.status || event.metadata?.stage_status === step.value));

    return (
        <div className={cn('rounded-3xl border border-slate-200 bg-white p-4', className)}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{swahili ? 'Hatua za mzigo' : 'Delivery Flow'}</p>
                {(delivery.delivery_person_name || delivery.boda_phone) && (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {delivery.delivery_person_name && (
                            <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                {delivery.delivery_person_name}
                            </span>
                        )}
                        {delivery.boda_phone && (
                            <a href={`tel:${delivery.boda_phone}`} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700">
                                <Phone className="h-3 w-3" />
                                {delivery.boda_phone}
                            </a>
                        )}
                    </div>
                )}
            </div>

            <div className={cn('mt-4', compact ? 'space-y-3' : 'space-y-4')}>
                {steps.map((step, index) => {
                    const isDone = index <= currentIndex;
                    const isSelected = selectedStatus === step.value;
                    const isDisabledStatus = disabledStatuses.includes(step.value);
                    const canSelect = selectable && !isDone && !isDisabledStatus && index <= latestSelectableIndex;
                    const label = riderLabels ? (step.riderLabel || step.label) : step.label;

                    return (
                        <div key={step.value} className="relative pl-8">
                            {index < steps.length - 1 && (
                                <span className={cn('absolute left-[11px] top-7 h-full w-0.5', isDone ? 'bg-sky-500' : 'bg-slate-200')} />
                            )}
                            <button
                                type="button"
                                disabled={!canSelect}
                                onClick={() => canSelect && onSelectStatus?.(step.value)}
                                className={cn(
                                    'group flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition',
                                    isDone ? 'border-sky-100 bg-sky-50/70' : 'border-slate-200 bg-white',
                                    isSelected && 'ring-2 ring-sky-400',
                                    canSelect && 'hover:border-sky-300 hover:bg-sky-50',
                                    (!selectable || isDisabledStatus) && 'cursor-default',
                                    isDisabledStatus && !isDone && 'opacity-60',
                                )}
                            >
                                <span className={cn('absolute left-0 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white', isDone ? 'border-sky-500 text-sky-600' : 'border-slate-300 text-slate-300')}>
                                    {isDone ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2.5 w-2.5 fill-current" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className={cn('text-sm font-black', isDone ? 'text-sky-900' : 'text-slate-700')}>{label}</p>
                                    {grouped[step.value]?.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            {grouped[step.value].map((event) => (
                                                <div
                                                    key={event.id}
                                                    className={cn(
                                                        'rounded-xl px-3 py-2 text-xs',
                                                        event.status === 'issue_reported'
                                                            ? 'border border-amber-100 bg-amber-50/90'
                                                            : 'bg-white/80',
                                                    )}
                                                >
                                                    {event.status === 'issue_reported' && (
                                                        <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                                                            <TriangleAlert className="h-3 w-3" />
                                                            {swahili ? 'Tatizo kwenye hatua hii' : 'Issue at this stage'}
                                                        </p>
                                                    )}
                                                    {event.note && <p className="font-semibold text-slate-700">{event.note}</p>}
                                                    <p className={cn('mt-1 font-bold uppercase tracking-wider', event.status === 'issue_reported' ? 'text-amber-500' : 'text-slate-400')}>
                                                        {event.created_at ? new Date(event.created_at).toLocaleString(swahili ? 'sw-TZ' : [], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                                                        {event.actor_type ? ` · ${swahili && event.actor_type === 'rider' ? 'dereva' : event.actor_type}` : ''}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                        {event.proof_url && (
                                                            <a href={event.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-700 underline">
                                                                <Camera className="h-3 w-3" />
                                                                {swahili ? 'Ushahidi' : 'Proof'}
                                                            </a>
                                                        )}
                                                        {event.metadata?.latitude && event.metadata?.longitude && (
                                                            <a href={`https://www.google.com/maps/search/?api=1&query=${event.metadata.latitude},${event.metadata.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 underline">
                                                                <MapPin className="h-3 w-3" />
                                                                {swahili ? 'Mahali' : 'Location'}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </button>
                            {renderAfterStep?.(step, { index, isDone, currentIndex })}
                        </div>
                    );
                })}
            </div>

            {otherEvents.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">{swahili ? 'Taarifa nyingine' : 'Other updates'}</p>
                    <div className="mt-2 space-y-2">
                        {otherEvents.map((event) => (
                            <div key={event.id} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-amber-900">
                                <p className="font-black">{swahili ? deliveryStatusTextSw(event.status) : deliveryStatusText(event.status)}</p>
                                {event.note && <p className="mt-1 text-slate-700">{event.note}</p>}
                                <p className="mt-1 font-bold uppercase tracking-wider text-amber-500">
                                    {event.created_at ? new Date(event.created_at).toLocaleString(swahili ? 'sw-TZ' : [], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                                    {event.actor_type ? ` · ${swahili && event.actor_type === 'rider' ? 'dereva' : event.actor_type}` : ''}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {event.proof_url && (
                                        <a href={event.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-700 underline">
                                            <Camera className="h-3 w-3" />
                                            {swahili ? 'Ushahidi' : 'Proof'}
                                        </a>
                                    )}
                                    {event.metadata?.latitude && event.metadata?.longitude && (
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${event.metadata.latitude},${event.metadata.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 underline">
                                            <MapPin className="h-3 w-3" />
                                            {swahili ? 'Mahali' : 'Location'}
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function DeliveryDirectionsButton({ routeUrl, className = '', label = 'Directions' }) {
    if (!routeUrl) return null;

    return (
        <a
            href={routeUrl}
            target="_blank"
            rel="noreferrer"
            className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-sky-900/20', className)}
        >
            <Truck className="h-4 w-4" />
            {label}
        </a>
    );
}
