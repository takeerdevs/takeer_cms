import React from 'react';
import { Input } from '@/Components/ui/Input';
import { useLocale } from '@/lib/i18n';

export default function PhysicalPackageEditor({
    className = '',
    compact = false,
    selectedSchemaUnitTypes,
    selectedUnitTypeId,
    setSelectedUnitTypeId,
    stockUnitLabel,
    stockStep,
    sellableQuantity,
    setSellableQuantity,
    selectedPackageContentUnitType,
    packageContentQuantity,
    setPackageContentQuantity,
    packageContentUnitTypeId,
    setPackageContentUnitTypeId,
    packageContentItems,
    setPackageContentItems,
    cleanPackageContentItems = [],
    formatPackageQuantity,
    packageContents,
    setPackageContents,
    packagePreviewLabel,
    minOrderQuantity,
    setMinOrderQuantity,
    selectedUnitType,
    quantityChipLabel,
}) {
    const { copy } = useLocale();
    const updatePackageContentItem = (index, updates) => {
        setPackageContentItems((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, ...updates } : row));
    };

    const removePackageContentItem = (index) => {
        setPackageContentItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    };

    return (
        <div className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-4 ${compact ? 'space-y-3' : 'space-y-4'} ${className}`}>
            <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">{copy('What does this price cover?', 'Bei hii ni ya nini?')}</p>
                <p className="text-xs text-slate-500">
                    {compact
                        ? copy('This line appears on the card and order. Example: 1 pc (50 g), 1 pack (250 ml), or 3 pairs.', 'Mstari huu utaonekana kwenye card na order. Mfano: 1 pc (50 g), 1 pack (250 ml), au 3 pairs.')
                        : copy('Create a short line the buyer will see on the card. Example: 1 pc (50 g), 1 pack (250 ml), 3 pairs, or 2 pcs (675 ml).', 'Tengeneza mstari mfupi ambao mteja ataona kwenye card. Mfano: 1 pc (50 g), 1 pack (250 ml), 3 pairs, au 2 pcs (675 ml).')}
                </p>
            </div>
            <div className="grid gap-3">
                <label className={compact ? 'space-y-1' : 'space-y-1.5'}>
                    <span className="text-[11px] font-semibold text-slate-600">{copy('What will the buyer purchase?', 'Mteja atanunua nini?')}</span>
                    <select
                        className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
                        value={selectedUnitTypeId}
                        onChange={(e) => setSelectedUnitTypeId(e.target.value)}
                    >
                        <option value="">{copy('Choose a unit', 'Chagua kipimo')}</option>
                        {selectedSchemaUnitTypes.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                                {unit.name}{unit.symbol ? ` (${unit.symbol})` : ''}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={compact ? 'space-y-1' : 'space-y-1.5'}>
                    <span className="text-[11px] font-semibold text-slate-600">{copy(`Quantity of ${stockUnitLabel} at this price`, `Idadi ya ${stockUnitLabel} kwa bei hii`)}</span>
                    <Input
                        type="number"
                        min="0.001"
                        step={stockStep}
                        className="h-11 bg-white"
                        value={sellableQuantity}
                        onChange={(e) => setSellableQuantity(e.target.value)}
                        placeholder={compact ? 'Mf. 1' : '1'}
                    />
                    {!compact && (
                        <p className="text-[10px] font-semibold leading-snug text-slate-500">
                            {copy('Example: enter 1 for one T-shirt, 3 for three pairs of socks, or 4 for a battery pack of 4 pcs when the unit is pc.', 'Mfano: tshirt moja weka 1. Soksi jozi 3 weka 3. Betri pack ya 4 pcs weka 4 kama kipimo ni pc.')}
                        </p>
                    )}
                </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className={compact ? 'space-y-1' : 'space-y-1.5'}>
                    <span className="text-[11px] font-semibold text-slate-600">{compact ? copy('Inner quantity (optional)', 'Kipimo cha ndani (hiari)') : copy('What quantity is inside? (optional)', 'Ndani yake kuna kipimo gani? (hiari)')}</span>
                    <Input
                        type="number"
                        min="0.001"
                        step={selectedPackageContentUnitType?.allows_decimal ? '0.001' : '1'}
                        className="h-11 bg-white"
                        value={packageContentQuantity}
                        onChange={(e) => setPackageContentQuantity(e.target.value)}
                        placeholder={copy('E.g. 250', 'Mf. 250')}
                    />
                </label>
                <label className={compact ? 'space-y-1' : 'space-y-1.5'}>
                    <span className="text-[11px] font-semibold text-slate-600">{compact ? copy('Inner unit', 'Unit ya ndani') : copy('Inner unit', 'Kipimo cha ndani')}</span>
                    <select
                        className="h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
                        value={packageContentUnitTypeId}
                        onChange={(e) => setPackageContentUnitTypeId(e.target.value)}
                    >
                        <option value="">{copy('None', 'Hakuna')}</option>
                        {selectedSchemaUnitTypes.map((unit) => (
                            <option key={`content-${unit.id}`} value={unit.id}>
                                {unit.name}{unit.symbol ? ` (${unit.symbol})` : ''}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">{copy('Package contents', 'Yaliyomo kwenye package')}</p>
                        {!compact && (
                            <p className="text-[10px] font-semibold text-slate-500">{copy('Add one item per line. It will appear as 1x Charging Cable, 2x Cell Batteries.', 'Ongeza item moja kwa mstari. Itaonekana kama 1x Charging Cable, 2x Cell Batteries.')}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-black text-slate-700"
                        onClick={() => setPackageContentItems((prev) => [...prev, { qty: '1', unit: 'pc', name: '' }])}
                    >
                        {copy('Add', 'Ongeza')}
                    </button>
                </div>
                <div className="space-y-2">
                    {packageContentItems.map((item, index) => (
                        <div key={`content-row-${index}`} className="grid gap-2 sm:grid-cols-[80px_90px_1fr_36px]">
                            <Input
                                type="number"
                                min="0.001"
                                step="0.001"
                                className="h-10 bg-slate-50"
                                value={item.qty}
                                onChange={(e) => updatePackageContentItem(index, { qty: e.target.value })}
                                placeholder="1"
                            />
                            <Input
                                className="h-10 bg-slate-50"
                                value={item.unit}
                                onChange={(e) => updatePackageContentItem(index, { unit: e.target.value })}
                                placeholder={copy('pc', 'vipande')}
                            />
                            <Input
                                className="h-10 bg-slate-50"
                                value={item.name}
                                onChange={(e) => updatePackageContentItem(index, { name: e.target.value })}
                                placeholder={copy('Charging cable', 'Cable ya kuchaji')}
                            />
                            <button
                                type="button"
                                className="h-10 rounded-lg border border-slate-200 text-slate-500"
                                onClick={() => removePackageContentItem(index)}
                                aria-label={copy('Remove package content', 'Ondoa kilichomo kwenye package')}
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
                {!compact && cleanPackageContentItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {cleanPackageContentItems.map((item, index) => (
                            <span key={`${item.name}-${index}`} className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                                {formatPackageQuantity(item.qty)}x {item.name}
                            </span>
                        ))}
                    </div>
                )}
                <Input
                    className="h-10 bg-white"
                    value={packageContents}
                    onChange={(e) => setPackageContents(e.target.value)}
                    placeholder={compact ? copy('Extra note (optional)', 'Dokezo la ziada (hiari)') : copy('Extra note (optional), e.g. colors may vary', 'Dokezo la ziada (hiari), mf. rangi zinaweza kutofautiana')}
                />
            </div>
            {packagePreviewLabel && (
                <div className={`rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-900 ${compact ? 'mt-2' : ''}`}>
                    {copy('Buyer preview:', 'Mwonekano kwa mteja:')} <span className="text-emerald-700">{packagePreviewLabel}</span>
                </div>
            )}
            <details className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-slate-700">
                    {copy('Minimum order rule (optional)', 'Sheria ya order ya chini (hiari)')}
                </summary>
                <div className="mt-3 space-y-2">
                    <Input
                        type="number"
                        min="0.001"
                        step={stockStep}
                        className="h-11 bg-white"
                        value={minOrderQuantity}
                        onChange={(e) => setMinOrderQuantity(e.target.value)}
                        placeholder={selectedUnitType?.min_order_quantity || sellableQuantity || '1'}
                    />
                    <p className="text-[10px] font-semibold leading-5 text-slate-500">
                        {compact
                            ? copy('If left blank, the minimum order will equal the package/sale quantity above.', 'Ukiiacha wazi, oda ya chini itakuwa sawa na pakiti/kiasi cha mauzo hapo juu.')
                            : copy('Use this only when buyers must purchase at least a certain amount. If blank, the minimum order will equal the package/sale quantity above.', 'Tumia hii tu kama hutaki mteja anunue chini ya kiwango fulani. Ukiiacha wazi, oda ya chini itakuwa sawa na pakiti/kiasi cha mauzo hapo juu.')}
                    </p>
                </div>
            </details>
            {!compact && (
                <div className="flex flex-wrap gap-2">
                    {(selectedUnitType?.common_quantities || []).map((entry) => (
                        <button
                            key={`${entry.label}-${entry.value}`}
                            type="button"
                            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                            onClick={() => {
                                setSellableQuantity(String(entry.quantity ?? entry.value ?? 1));
                            }}
                        >
                            {quantityChipLabel(entry)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
