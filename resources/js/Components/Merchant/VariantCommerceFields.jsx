import React from 'react';
import { Store } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';

export default function VariantCommerceFields({
    variant,
    index,
    setVariants,
    wholesaleOnly,
    requiresLocationInventory,
    physicalLocations,
    stockStep,
    openSwatchModal,
}) {
    const updateVariant = (updates) => {
        setVariants((prev) => prev.map((row, idx) => idx === index ? { ...row, ...updates } : row));
    };

    const updateLocationInventory = (locationId, value) => {
        setVariants((prev) => prev.map((row, idx) => (
            idx === index
                ? {
                    ...row,
                    location_inventories: {
                        ...(row.location_inventories || {}),
                        [locationId]: value,
                    },
                }
                : row
        )));
    };

    return (
        <div className={`grid gap-2 ${wholesaleOnly ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
            <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">SKU (optional)</label>
                <Input
                    className="h-10"
                    placeholder="SKU"
                    value={variant.sku || ''}
                    onChange={(e) => updateVariant({ sku: e.target.value })}
                />
            </div>
            {!wholesaleOnly && (
                <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Bei ya Reja Reja (Tsh)</label>
                    <Input
                        type="number"
                        className="h-10"
                        placeholder="Bei"
                        value={variant.price ?? ''}
                        onChange={(e) => updateVariant({ price: e.target.value })}
                    />
                </div>
            )}
            <div className="space-y-1 sm:col-span-2">
                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                    <Store className="h-2.5 w-2.5" /> Stock kwa Maeneo
                </label>
                {requiresLocationInventory ? (
                    <>
                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                            {physicalLocations.map((loc) => (
                                <div key={loc.id} className="space-y-1">
                                    <label className="block truncate text-[10px] font-bold text-slate-500">{loc.name}</label>
                                    <Input
                                        type="number"
                                        step={stockStep}
                                        className="h-8 bg-white text-xs font-black"
                                        placeholder="0"
                                        value={variant.location_inventories?.[loc.id] || ''}
                                        onChange={(e) => updateLocationInventory(loc.id, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                        {physicalLocations.length === 0 && (
                            <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-800">
                                Ongeza duka au eneo la stock/pickup kwenye Mipangilio ili kuweka stock ya variants.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-semibold text-blue-800">
                        Mode hii haihitaji stock kwa kila eneo kabla ya publish.
                    </p>
                )}
            </div>
            <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Picha (Mwonekano)</label>
                <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full"
                    onClick={() => openSwatchModal(index)}
                >
                    {variant.isUploadingSwatch ? 'Uploading...' : 'Swatch'}
                </Button>
            </div>
        </div>
    );
}
