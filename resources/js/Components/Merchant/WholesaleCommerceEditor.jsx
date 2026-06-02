import React from 'react';
import { ListChecks, Package } from 'lucide-react';
import { Input } from '@/Components/ui/Input';
import SellingStyleSelector from '@/Components/Merchant/SellingStyleSelector';
import { cn } from '@/lib/utils';

export default function WholesaleCommerceEditor({
    sellingStyle,
    setSellingStyle,
    wholesaleEnabled,
    supplyCapacityQuantity,
    setSupplyCapacityQuantity,
    supplyCapacityPeriod,
    setSupplyCapacityPeriod,
    wholesaleDepositMode,
    setWholesaleDepositMode,
    wholesaleDepositPercent,
    setWholesaleDepositPercent,
    wholesaleBalanceDue,
    setWholesaleBalanceDue,
    safePayMethods,
    setSafePayMethods,
    pricingTiers,
    setPricingTiers,
    leadTimeTiers,
    setLeadTimeTiers,
    packagingDetails,
    setPackagingDetails,
    customizationOptions,
    setCustomizationOptions,
    productSpecifications,
    setProductSpecifications,
    pricingUnitLabel = 'unit',
    packagingUnitOptions = [],
    className = '',
}) {
    const addRow = (setter, row) => setter((prev) => [...prev, row]);
    const updateRow = (setter, index, updates) => setter((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, ...updates } : row));
    const removeRow = (setter, index, fallback) => setter((prev) => {
        const next = prev.filter((_, rowIndex) => rowIndex !== index);
        return next.length > 0 ? next : [fallback];
    });
    const orderUnitLabel = pricingUnitLabel || 'unit';
    const normalizedPackagingUnitOptions = packagingUnitOptions
        .map((unit) => ({
            value: unit.symbol || unit.name || unit.code || '',
            label: unit.symbol && unit.name ? `${unit.symbol} - ${unit.name}` : (unit.name || unit.symbol || unit.code || ''),
        }))
        .filter((unit) => unit.value);

    return (
        <div className={cn('space-y-4 rounded-2xl border border-slate-200 bg-white p-4', className)}>
            <SellingStyleSelector value={sellingStyle} onChange={setSellingStyle} />

            {wholesaleEnabled && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2 min-[1100px]:grid-cols-3">
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Supply capacity</span>
                            <Input type="number" min="0.001" value={supplyCapacityQuantity} onChange={(e) => setSupplyCapacityQuantity(e.target.value)} placeholder="10000" className="h-11" />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Capacity period</span>
                            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={supplyCapacityPeriod} onChange={(e) => setSupplyCapacityPeriod(e.target.value)}>
                                <option value="day">Per day</option>
                                <option value="week">Per week</option>
                                <option value="month">Per month</option>
                                <option value="quarter">Per quarter</option>
                                <option value="year">Per year</option>
                                <option value="order">Per order</option>
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deposit terms</span>
                            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={wholesaleDepositMode} onChange={(e) => setWholesaleDepositMode(e.target.value)}>
                                <option value="quote_based">Quote based</option>
                                <option value="deposit_required">Deposit required</option>
                                <option value="full_payment">Full SafePay payment</option>
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deposit %</span>
                            <Input type="number" min="0" max="100" value={wholesaleDepositPercent} onChange={(e) => setWholesaleDepositPercent(e.target.value)} placeholder="30" className="h-11" />
                        </label>
                        <label className="space-y-1.5 min-[760px]:col-span-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Balance due</span>
                            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={wholesaleBalanceDue} onChange={(e) => setWholesaleBalanceDue(e.target.value)}>
                                <option value="before_production">Before production</option>
                                <option value="before_delivery">Before delivery</option>
                                <option value="on_delivery_confirmation">After buyer confirms delivery</option>
                                <option value="manual">Manual agreement</option>
                            </select>
                        </label>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Takeer SafePay funding methods</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 min-[1100px]:grid-cols-4">
                            {[
                                ['mobile_money', 'Mobile money'],
                                ['bank_transfer', 'Takeer bank transfer'],
                                ['wallet', 'Wallet'],
                                ['card', 'Card later'],
                            ].map(([key, label]) => (
                                <label key={key} className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-bold leading-tight text-emerald-900">
                                    <input type="checkbox" checked={Boolean(safePayMethods[key])} onChange={(e) => setSafePayMethods((prev) => ({ ...prev, [key]: e.target.checked }))} />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Pricing tiers</p>
                                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                                    Based on selected selling unit: <span className="font-black text-slate-700">{orderUnitLabel}</span>
                                </p>
                            </div>
                            <button type="button" onClick={() => addRow(setPricingTiers, { min_quantity: '', max_quantity: '', unit_price: '', label: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">Add</button>
                        </div>
                        {pricingTiers.map((tier, index) => (
                            <div key={`pricing-tier-${index}`} className="grid gap-2 min-[980px]:grid-cols-[1fr_1fr_1fr_38px]">
                                <Input type="number" min="0.001" value={tier.min_quantity} onChange={(e) => updateRow(setPricingTiers, index, { min_quantity: e.target.value })} placeholder={`Min ${orderUnitLabel}`} className="h-10 bg-white" />
                                <Input type="number" min="0.001" value={tier.max_quantity} onChange={(e) => updateRow(setPricingTiers, index, { max_quantity: e.target.value })} placeholder={`Max ${orderUnitLabel}`} className="h-10 bg-white" />
                                <Input type="number" min="0" value={tier.unit_price} onChange={(e) => updateRow(setPricingTiers, index, { unit_price: e.target.value })} placeholder={`Price per ${orderUnitLabel}`} className="h-10 bg-white" />
                                <button type="button" onClick={() => removeRow(setPricingTiers, index, { min_quantity: '', max_quantity: '', unit_price: '', label: '' })} className="h-10 rounded-lg border bg-white text-slate-500">&times;</button>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 min-[1120px]:grid-cols-1">
                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Lead time tiers</p>
                                <button type="button" onClick={() => addRow(setLeadTimeTiers, { min_quantity: '', max_quantity: '', lead_time_days: '', label: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">Add</button>
                            </div>
                            {leadTimeTiers.map((tier, index) => (
                                <div key={`lead-tier-${index}`} className="grid gap-2 min-[980px]:grid-cols-[1fr_1fr_1fr_38px]">
                                    <Input type="number" value={tier.min_quantity} onChange={(e) => updateRow(setLeadTimeTiers, index, { min_quantity: e.target.value })} placeholder={`Min ${orderUnitLabel}`} className="h-10 bg-white" />
                                    <Input type="number" value={tier.lead_time_days} onChange={(e) => updateRow(setLeadTimeTiers, index, { lead_time_days: e.target.value })} placeholder="Days" className="h-10 bg-white" />
                                    <Input value={tier.label} onChange={(e) => updateRow(setLeadTimeTiers, index, { label: e.target.value })} placeholder="Label" className="h-10 bg-white" />
                                    <button type="button" onClick={() => removeRow(setLeadTimeTiers, index, { min_quantity: '', max_quantity: '', lead_time_days: '', label: '' })} className="h-10 rounded-lg border bg-white text-slate-500">&times;</button>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Bulk packaging / shipping units</p>
                                    <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                                        Show how bulk orders are packed for delivery. Example: buyer orders pieces, you ship 24 pieces per carton.
                                    </p>
                                </div>
                                <button type="button" onClick={() => addRow(setPackagingDetails, { selling_units: '', package_quantity: '', package_unit: '', package_weight_kg: '', package_length_cm: '', package_width_cm: '', package_height_cm: '', notes: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">Add</button>
                            </div>
                            {packagingDetails.map((detail, index) => (
                                <div key={`packaging-${index}`} className="space-y-2 rounded-xl border bg-white p-2">
                                    <div className="grid gap-2 min-[900px]:grid-cols-3">
                                        <Input value={detail.selling_units} onChange={(e) => updateRow(setPackagingDetails, index, { selling_units: e.target.value })} placeholder="Carton, box, bag, pallet" className="h-10" />
                                        <Input type="number" value={detail.package_quantity} onChange={(e) => updateRow(setPackagingDetails, index, { package_quantity: e.target.value })} placeholder="Units per package" className="h-10" />
                                        {normalizedPackagingUnitOptions.length > 0 ? (
                                            <select
                                                value={detail.package_unit || ''}
                                                onChange={(e) => updateRow(setPackagingDetails, index, { package_unit: e.target.value })}
                                                className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-semibold text-slate-700"
                                            >
                                                <option value="">Unit inside package</option>
                                                {normalizedPackagingUnitOptions.map((unit) => (
                                                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input value={detail.package_unit} onChange={(e) => updateRow(setPackagingDetails, index, { package_unit: e.target.value })} placeholder="pieces / carton" className="h-10" />
                                        )}
                                    </div>
                                    <Input value={detail.notes} onChange={(e) => updateRow(setPackagingDetails, index, { notes: e.target.value })} placeholder="Example: 24 pieces per sealed carton, 20 cartons per pallet" className="h-10" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-600"><Package className="h-3.5 w-3.5" /> Bulk customization options</p>
                                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                                    Optional B2B options such as logo printing, private label packaging, color, size, or made-to-order changes.
                                </p>
                            </div>
                            <button type="button" onClick={() => addRow(setCustomizationOptions, { name: '', description: '', min_order_quantity: '', fee_type: 'quote', fee_amount: '', notes: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">Add</button>
                        </div>
                        {customizationOptions.map((option, index) => (
                            <div key={`customization-${index}`} className="grid gap-2 min-[1120px]:grid-cols-2">
                                <Input value={option.name} onChange={(e) => updateRow(setCustomizationOptions, index, { name: e.target.value })} placeholder="Logo printing / private label" className="h-10 bg-white" />
                                <Input value={option.description} onChange={(e) => updateRow(setCustomizationOptions, index, { description: e.target.value })} placeholder="What buyer can customize" className="h-10 bg-white" />
                                <Input type="number" value={option.min_order_quantity} onChange={(e) => updateRow(setCustomizationOptions, index, { min_order_quantity: e.target.value })} placeholder="MOQ" className="h-10 bg-white" />
                                <select value={option.fee_type} onChange={(e) => updateRow(setCustomizationOptions, index, { fee_type: e.target.value })} className="h-10 rounded-xl border bg-white px-2 text-xs font-bold">
                                    <option value="quote">Quote</option>
                                    <option value="free">Free</option>
                                    <option value="per_unit">Per unit</option>
                                    <option value="fixed">Fixed</option>
                                </select>
                                <button type="button" onClick={() => removeRow(setCustomizationOptions, index, { name: '', description: '', min_order_quantity: '', fee_type: 'quote', fee_amount: '', notes: '' })} className="h-10 rounded-lg border bg-white text-slate-500">&times;</button>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-600"><ListChecks className="h-3.5 w-3.5" /> Specifications</p>
                            <button type="button" onClick={() => addRow(setProductSpecifications, { group_name: '', attribute_name: '', attribute_value: '', is_filterable: true })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">Add</button>
                        </div>
                        {productSpecifications.map((spec, index) => (
                            <div key={`spec-${index}`} className="grid gap-2 min-[900px]:grid-cols-[1fr_1fr_38px]">
                                <Input value={spec.attribute_name} onChange={(e) => updateRow(setProductSpecifications, index, { attribute_name: e.target.value })} placeholder="Attribute" className="h-10 bg-white" />
                                <Input value={spec.attribute_value} onChange={(e) => updateRow(setProductSpecifications, index, { attribute_value: e.target.value })} placeholder="Value" className="h-10 bg-white" />
                                <button type="button" onClick={() => removeRow(setProductSpecifications, index, { group_name: '', attribute_name: '', attribute_value: '', is_filterable: true })} className="h-10 rounded-lg border bg-white text-slate-500">&times;</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
