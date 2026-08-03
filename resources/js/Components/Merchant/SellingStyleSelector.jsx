import React from 'react';
import { Factory } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

const sellingStyleOptions = [
    ['retail', 'Retail'],
    ['wholesale', 'Wholesale'],
    ['both', 'Both'],
];

export default function SellingStyleSelector({ value, onChange }) {
    const { copy } = useLocale();
    return (
        <div className="grid gap-4 min-[760px]:grid-cols-1 min-[760px]:items-center">
            <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                    <Factory className="h-4 w-4 text-brand-700" />
                    {copy('Selling style', 'Aina ya mauzo')}
                </p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    {copy('Use wholesale for industries, manufacturers, distributors, and bulky reseller orders.', 'Tumia wholesale kwa viwanda, watengenezaji, wasambazaji, na order kubwa za reseller.')}
                </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 min-[420px]:grid-cols-3">
                {sellingStyleOptions.map(([optionValue, label]) => (
                    <button
                        key={optionValue}
                        type="button"
                        onClick={() => onChange(optionValue)}
                        className={`min-h-10 rounded-lg px-2 text-xs font-black leading-tight transition-colors ${value === optionValue
                            ? 'bg-slate-950 text-white'
                            : 'text-slate-600 hover:bg-white'
                            }`}
                    >
                        {copy(label, label === 'Both' ? 'Vyote' : label)}
                    </button>
                ))}
            </div>
        </div>
    );
}
