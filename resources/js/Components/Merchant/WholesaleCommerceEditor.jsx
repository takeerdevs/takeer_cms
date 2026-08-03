import React from 'react';
import { ListChecks, Package } from 'lucide-react';
import { Input } from '@/Components/ui/Input';
import SellingStyleSelector from '@/Components/Merchant/SellingStyleSelector';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

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
    providerPaymentMethods,
    setProviderPaymentMethods,
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
    const { copy } = useLocale();
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
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Supply capacity', 'Uwezo wa supply')}</span>
                            <Input type="number" min="0.001" value={supplyCapacityQuantity} onChange={(e) => setSupplyCapacityQuantity(e.target.value)} placeholder="10000" className="h-11" />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Capacity period', 'Muda wa capacity')}</span>
                            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={supplyCapacityPeriod} onChange={(e) => setSupplyCapacityPeriod(e.target.value)}>
                                <option value="day">{copy('Per day', 'Kwa siku')}</option>
                                <option value="week">{copy('Per week', 'Kwa wiki')}</option>
                                <option value="month">{copy('Per month', 'Kwa mwezi')}</option>
                                <option value="quarter">{copy('Per quarter', 'Kwa robo mwaka')}</option>
                                <option value="year">{copy('Per year', 'Kwa mwaka')}</option>
                                <option value="order">{copy('Per order', 'Kwa order')}</option>
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Deposit terms', 'Masharti ya deposit')}</span>
                            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={wholesaleDepositMode} onChange={(e) => setWholesaleDepositMode(e.target.value)}>
                                <option value="quote_based">{copy('Quote based', 'Kulingana na quote')}</option>
                                <option value="deposit_required">{copy('Deposit required', 'Deposit inahitajika')}</option>
                                <option value="full_payment">{copy('Full PSP payment', 'Malipo kamili kupitia PSP')}</option>
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Deposit %', 'Deposit %')}</span>
                            <Input type="number" min="0" max="100" value={wholesaleDepositPercent} onChange={(e) => setWholesaleDepositPercent(e.target.value)} placeholder="30" className="h-11" />
                        </label>
                        <label className="space-y-1.5 min-[760px]:col-span-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Balance due', 'Salio linalipwa')}</span>
                            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold" value={wholesaleBalanceDue} onChange={(e) => setWholesaleBalanceDue(e.target.value)}>
                                <option value="before_production">{copy('Before production', 'Kabla ya uzalishaji')}</option>
                                <option value="before_delivery">{copy('Before delivery', 'Kabla ya delivery')}</option>
                                <option value="on_delivery_confirmation">{copy('After buyer confirms delivery', 'Baada ya mteja kuthibitisha delivery')}</option>
                                <option value="manual">{copy('Manual agreement', 'Makubaliano ya manual')}</option>
                            </select>
                        </label>
                    </div>

                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">{copy('Licensed PSP payment methods', 'Njia za malipo za PSP yenye leseni')}</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 min-[1100px]:grid-cols-4">
                            {[
                                ['mobile_money', copy('Mobile money', 'Mobile money')],
                                ['bank_transfer', copy('Provider bank transfer', 'Bank transfer ya provider')],
                                ['card', copy('Card later', 'Kadi baadaye')],
                            ].map(([key, label]) => (
                                <label key={key} className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-bold leading-tight text-emerald-900">
                                    <input type="checkbox" checked={Boolean(providerPaymentMethods[key])} onChange={(e) => setProviderPaymentMethods((prev) => ({ ...prev, [key]: e.target.checked }))} />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{copy('Pricing tiers', 'Ngazi za bei')}</p>
                                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                                    {copy('Based on selected selling unit:', 'Kulingana na kipimo cha mauzo:')} <span className="font-black text-slate-700">{orderUnitLabel}</span>
                                </p>
                            </div>
                            <button type="button" onClick={() => addRow(setPricingTiers, { min_quantity: '', max_quantity: '', unit_price: '', label: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">{copy('Add', 'Ongeza')}</button>
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
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{copy('Lead time tiers', 'Ngazi za muda wa maandalizi')}</p>
                                <button type="button" onClick={() => addRow(setLeadTimeTiers, { min_quantity: '', max_quantity: '', lead_time_days: '', label: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">{copy('Add', 'Ongeza')}</button>
                            </div>
                            {leadTimeTiers.map((tier, index) => (
                                <div key={`lead-tier-${index}`} className="grid gap-2 min-[980px]:grid-cols-[1fr_1fr_1fr_38px]">
                                    <Input type="number" value={tier.min_quantity} onChange={(e) => updateRow(setLeadTimeTiers, index, { min_quantity: e.target.value })} placeholder={`Min ${orderUnitLabel}`} className="h-10 bg-white" />
                                    <Input type="number" value={tier.lead_time_days} onChange={(e) => updateRow(setLeadTimeTiers, index, { lead_time_days: e.target.value })} placeholder={copy('Days', 'Siku')} className="h-10 bg-white" />
                                    <Input value={tier.label} onChange={(e) => updateRow(setLeadTimeTiers, index, { label: e.target.value })} placeholder={copy('Label', 'Labeli')} className="h-10 bg-white" />
                                    <button type="button" onClick={() => removeRow(setLeadTimeTiers, index, { min_quantity: '', max_quantity: '', lead_time_days: '', label: '' })} className="h-10 rounded-lg border bg-white text-slate-500">&times;</button>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{copy('Bulk packaging / shipping units', 'Packaging / vipimo vya usafirishaji wa bulk')}</p>
                                    <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                                        {copy('Show how bulk orders are packed for delivery. Example: buyer orders pieces, you ship 24 pieces per carton.', 'Onyesha jinsi order za bulk zinavyopakiwa kwa delivery. Mfano: mteja anaagiza pieces, unatuma pieces 24 kwa carton.')}
                                    </p>
                                </div>
                                <button type="button" onClick={() => addRow(setPackagingDetails, { selling_units: '', package_quantity: '', package_unit: '', package_weight_kg: '', package_length_cm: '', package_width_cm: '', package_height_cm: '', notes: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">{copy('Add', 'Ongeza')}</button>
                            </div>
                            {packagingDetails.map((detail, index) => (
                                <div key={`packaging-${index}`} className="space-y-2 rounded-xl border bg-white p-2">
                                    <div className="grid gap-2 min-[900px]:grid-cols-3">
                                        <Input value={detail.selling_units} onChange={(e) => updateRow(setPackagingDetails, index, { selling_units: e.target.value })} placeholder={copy('Carton, box, bag, pallet', 'Carton, box, mfuko, pallet')} className="h-10" />
                                        <Input type="number" value={detail.package_quantity} onChange={(e) => updateRow(setPackagingDetails, index, { package_quantity: e.target.value })} placeholder={copy('Units per package', 'Vipimo kwa package')} className="h-10" />
                                        {normalizedPackagingUnitOptions.length > 0 ? (
                                            <select
                                                value={detail.package_unit || ''}
                                                onChange={(e) => updateRow(setPackagingDetails, index, { package_unit: e.target.value })}
                                                className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-semibold text-slate-700"
                                            >
                                                <option value="">{copy('Unit inside package', 'Kipimo ndani ya package')}</option>
                                                {normalizedPackagingUnitOptions.map((unit) => (
                                                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input value={detail.package_unit} onChange={(e) => updateRow(setPackagingDetails, index, { package_unit: e.target.value })} placeholder={copy('pieces / carton', 'vipande / carton')} className="h-10" />
                                        )}
                                    </div>
                                    <Input value={detail.notes} onChange={(e) => updateRow(setPackagingDetails, index, { notes: e.target.value })} placeholder={copy('Example: 24 pieces per sealed carton, 20 cartons per pallet', 'Mfano: vipande 24 kwa carton iliyofungwa, cartons 20 kwa pallet')} className="h-10" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-600"><Package className="h-3.5 w-3.5" /> {copy('Bulk customization options', 'Chaguo za customization ya bulk')}</p>
                                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                                    {copy('Optional B2B options such as logo printing, private label packaging, color, size, or made-to-order changes.', 'Chaguo za hiari za B2B kama kuchapisha logo, private label packaging, rangi, size, au mabadiliko ya made-to-order.')}
                                </p>
                            </div>
                            <button type="button" onClick={() => addRow(setCustomizationOptions, { name: '', description: '', min_order_quantity: '', fee_type: 'quote', fee_amount: '', notes: '' })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">{copy('Add', 'Ongeza')}</button>
                        </div>
                        {customizationOptions.map((option, index) => (
                            <div key={`customization-${index}`} className="grid gap-2 min-[1120px]:grid-cols-2">
                                <Input value={option.name} onChange={(e) => updateRow(setCustomizationOptions, index, { name: e.target.value })} placeholder={copy('Logo printing / private label', 'Uchapishaji wa logo / private label')} className="h-10 bg-white" />
                                <Input value={option.description} onChange={(e) => updateRow(setCustomizationOptions, index, { description: e.target.value })} placeholder={copy('What buyer can customize', 'Kile ambacho mnunuzi anaweza kubadilisha')} className="h-10 bg-white" />
                                <Input type="number" value={option.min_order_quantity} onChange={(e) => updateRow(setCustomizationOptions, index, { min_order_quantity: e.target.value })} placeholder={copy('MOQ', 'Kiasi cha chini cha oda')} className="h-10 bg-white" />
                                <select value={option.fee_type} onChange={(e) => updateRow(setCustomizationOptions, index, { fee_type: e.target.value })} className="h-10 rounded-xl border bg-white px-2 text-xs font-bold">
                                    <option value="quote">{copy('Quote', 'Quote')}</option>
                                    <option value="free">{copy('Free', 'Bure')}</option>
                                    <option value="per_unit">{copy('Per unit', 'Kwa kipimo')}</option>
                                    <option value="fixed">{copy('Fixed', 'Kudumu')}</option>
                                </select>
                                <button type="button" onClick={() => removeRow(setCustomizationOptions, index, { name: '', description: '', min_order_quantity: '', fee_type: 'quote', fee_amount: '', notes: '' })} className="h-10 rounded-lg border bg-white text-slate-500">&times;</button>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-600"><ListChecks className="h-3.5 w-3.5" /> {copy('Specifications', 'Specifications')}</p>
                            <button type="button" onClick={() => addRow(setProductSpecifications, { group_name: '', attribute_name: '', attribute_value: '', is_filterable: true })} className="rounded-lg border bg-white px-2.5 py-1 text-[10px] font-black">{copy('Add', 'Ongeza')}</button>
                        </div>
                        {productSpecifications.map((spec, index) => (
                            <div key={`spec-${index}`} className="grid gap-2 min-[900px]:grid-cols-[1fr_1fr_38px]">
                                <Input value={spec.attribute_name} onChange={(e) => updateRow(setProductSpecifications, index, { attribute_name: e.target.value })} placeholder={copy('Attribute', 'Sifa')} className="h-10 bg-white" />
                                <Input value={spec.attribute_value} onChange={(e) => updateRow(setProductSpecifications, index, { attribute_value: e.target.value })} placeholder={copy('Value', 'Thamani')} className="h-10 bg-white" />
                                <button type="button" onClick={() => removeRow(setProductSpecifications, index, { group_name: '', attribute_name: '', attribute_value: '', is_filterable: true })} className="h-10 rounded-lg border bg-white text-slate-500">&times;</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
