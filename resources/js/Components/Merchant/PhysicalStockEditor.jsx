import React from 'react';
import { AlertTriangle, Store } from 'lucide-react';
import { Input } from '@/Components/ui/Input';
import { useLocale } from '@/lib/i18n';

export function MissingStockLocationNotice({ merchantUsername }) {
    const { copy } = useLocale();
    return (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
            <div className="space-y-1">
                <p className="text-sm font-bold text-orange-800">{copy('No shop or stock/pickup location has been added.', 'Hujajaza duka au eneo la stock/pickup')}</p>
                <p className="text-xs leading-relaxed text-orange-700">
                    {copy('To sell an item you have in stock, use an existing shop or add a stock/pickup location in Settings.', 'Ili kuuza bidhaa uliyonayo mkononi, tumia duka lililopo au ongeza eneo la stock/pickup kwenye Mipangilio.')}
                </p>
                <button
                    type="button"
                    className="pt-1 text-xs font-black text-orange-900 underline"
                    onClick={() => { window.location.href = `/merchant/${merchantUsername}/settings`; }}
                >
                    {copy('Open Settings', 'Fungua Mipangilio')}
                </button>
            </div>
        </div>
    );
}

export default function PhysicalStockEditor({
    physicalLocations,
    stockStep,
    stockUnitLabel,
    locationInventories,
    setLocationInventories,
    merchantUsername,
}) {
    const { copy } = useLocale();
    return (
        <div className="space-y-4 sm:col-span-2">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <Store className="h-3 w-3" /> {copy('Stock & Availability (Retail)', 'Hifadhi & Upatikanaji (Stock) [Reja Reja]')}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {physicalLocations.map((loc) => (
                    <div key={loc.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <label className="truncate text-xs font-bold text-slate-700">{loc.name}</label>
                            {loc.is_primary && (
                                <span className="rounded border border-brand-100 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-600">{copy('Primary', 'Kuu')}</span>
                            )}
                        </div>
                        <Input
                            type="number"
                            step={stockStep}
                            placeholder="0"
                            className="h-10 bg-white text-lg font-black"
                            value={locationInventories[loc.id] || ''}
                            onChange={(e) => setLocationInventories((prev) => ({ ...prev, [loc.id]: e.target.value }))}
                        />
                        <p className="text-[10px] font-semibold text-slate-500">{stockUnitLabel} {copy('in stock', 'zilizopo stock')}</p>
                    </div>
                ))}
            </div>
            {physicalLocations.length === 0 && (
                <MissingStockLocationNotice merchantUsername={merchantUsername} />
            )}
        </div>
    );
}
