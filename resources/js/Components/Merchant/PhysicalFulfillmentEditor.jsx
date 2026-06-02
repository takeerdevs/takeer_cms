import React from 'react';
import { Info } from 'lucide-react';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';

export default function PhysicalFulfillmentEditor({
    fulfillmentMode,
    setFulfillmentMode,
    fulfillmentModeOptions,
    selectedCatalogSchema,
    sourceDetails,
    updateSourceDetail,
    availabilityLeadTimeDays,
    setAvailabilityLeadTimeDays,
    availabilityDateCopy,
    availableFrom,
    setAvailableFrom,
    groupSaleGoalQuantity,
    setGroupSaleGoalQuantity,
    groupSaleDeadline,
    setGroupSaleDeadline,
    requiresLocationInventory,
    selectedFulfillmentMode,
}) {
    return (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
            <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Fulfillment / Source</p>
                <p className="text-xs text-slate-500">Chagua kama bidhaa ipo mkononi, inatengenezwa, itatafutwa kwa supplier, au ni preorder/group sale.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
                {fulfillmentModeOptions.map((mode) => (
                    <button
                        key={mode.key}
                        type="button"
                        className={`rounded-xl border p-3 text-left transition ${fulfillmentMode === mode.key ? 'border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-200'}`}
                        onClick={() => setFulfillmentMode(mode.key)}
                    >
                        <span className="block text-sm font-black">{mode.label}</span>
                        <span className="mt-1 block text-[11px] font-semibold leading-snug opacity-75">{mode.hint}</span>
                    </button>
                ))}
            </div>
            {selectedCatalogSchema?.requires_verified_business && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Category hii inaweza kuhitaji verified business/KYB kabla ya kuchapishwa au kupata review ya Takeer.
                </div>
            )}
            {fulfillmentMode === 'supplier_sourced' && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Supplier/shop name</span>
                        <Input className="h-11" value={sourceDetails.supplier_name} onChange={(e) => updateSourceDetail('supplier_name', e.target.value)} placeholder="Private to Takeer" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Supplier phone/WhatsApp</span>
                        <Input className="h-11" value={sourceDetails.supplier_phone} onChange={(e) => updateSourceDetail('supplier_phone', e.target.value)} placeholder="Private to Takeer" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Supplier area/location</span>
                        <Input className="h-11" value={sourceDetails.supplier_location} onChange={(e) => updateSourceDetail('supplier_location', e.target.value)} placeholder="Optional private note" />
                    </label>
                    <label className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Hours to confirm/source</span>
                        <Input type="number" min="0" className="h-11" value={sourceDetails.confirmation_hours} onChange={(e) => updateSourceDetail('confirmation_hours', e.target.value)} placeholder="Mf. 6" />
                        <span className="block text-[10px] font-semibold text-muted-foreground">How many hours you need to confirm or get the item from supplier after order.</span>
                    </label>
                </div>
            )}
            {fulfillmentMode === 'made_to_order' && (
                <label className="block space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Preparation days after order</span>
                    <Input type="number" min="0" className="h-11" value={availabilityLeadTimeDays} onChange={(e) => setAvailabilityLeadTimeDays(e.target.value)} placeholder="Mf. 3" />
                    <span className="block text-[10px] font-semibold text-muted-foreground">How many days you need to make, assemble, or prepare the item after the customer orders.</span>
                </label>
            )}
            {['farm_harvest', 'preorder', 'group_sale'].includes(fulfillmentMode) && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <label className={fulfillmentMode === 'group_sale' ? 'space-y-1' : 'space-y-1 sm:col-span-3'}>
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{availabilityDateCopy?.label || 'Expected availability date'}</span>
                        <Input type="date" className="h-11" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} aria-label={availabilityDateCopy?.placeholder || 'Expected availability date'} />
                        <span className="block text-[10px] font-semibold text-muted-foreground">{availabilityDateCopy?.helper || 'Date when customers should expect this item to be available.'}</span>
                    </label>
                    {fulfillmentMode === 'group_sale' && (
                        <>
                            <label className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Target orders needed</span>
                                <Input type="number" min="2" className="h-11" value={groupSaleGoalQuantity} onChange={(e) => setGroupSaleGoalQuantity(e.target.value)} placeholder="Mf. 20" />
                                <span className="block text-[10px] font-semibold text-muted-foreground">Minimum customer quantity needed before fulfillment starts.</span>
                            </label>
                            <label className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Group sale closing date</span>
                                <Input type="date" className="h-11" value={groupSaleDeadline} onChange={(e) => setGroupSaleDeadline(e.target.value)} aria-label="Group sale closing date" />
                                <span className="block text-[10px] font-semibold text-muted-foreground">Last day customers can join this group sale.</span>
                            </label>
                        </>
                    )}
                </div>
            )}
            {['supplier_sourced', 'farm_harvest', 'preorder', 'group_sale'].includes(fulfillmentMode) && (
                <Textarea
                    className="min-h-20 rounded-xl"
                    value={sourceDetails.source_note}
                    onChange={(e) => updateSourceDetail('source_note', e.target.value)}
                    placeholder={fulfillmentMode === 'farm_harvest' ? 'Private note: farm/harvest source, batch details, or pickup plan' : 'Private source note for Takeer support/review'}
                />
            )}
            {!requiresLocationInventory && (
                <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{selectedFulfillmentMode.label} haitahitaji stock kwenye eneo sasa. Mnunuzi ataona matarajio siku bidhaa itakamilika, na malipo yatashikiliwa hadi mteja atakapokea bidhaa yake ndani ya siku ulizoweka.</span>
                </div>
            )}
        </div>
    );
}
