import React from 'react';
import { Input } from '@/Components/ui/Input';
import { useLocale } from '@/lib/i18n';

export default function VariantIdentityEditor({
    variant,
    index,
    setVariants,
    variantAxisAttributes,
    generatedName,
    suggestions,
}) {
    const { copy } = useLocale();
    const updateName = (name) => {
        setVariants((prev) => prev.map((row, idx) => idx === index ? { ...row, name } : row));
    };

    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="font-semibold text-slate-900">{variant.name || generatedName || `Variant ${index + 1}`}</p>
                    {generatedName && (
                        <p className="text-[11px] font-medium text-slate-500">
                            {copy('Generated:', 'Imetengenezwa:')} {generatedName}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {variantAxisAttributes.length > 0
                    ? variantAxisAttributes.map((axis) => (
                        <span key={`${variant.id || index}-${axis.key}`} className="inline-flex items-center rounded-full border border-slate-300 px-2 py-1 text-xs">
                            {axis.label}: {variant.attributes?.[axis.key] || '-'}
                        </span>
                    ))
                    : Object.entries(variant.attributes || {}).map(([key, value]) => (
                        <span key={`${variant.id || index}-${key}`} className="inline-flex items-center rounded-full border border-slate-300 px-2 py-1 text-xs">
                            {key}: {String(value)}
                        </span>
                    ))
                }
            </div>

            <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                <div className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr]">
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">{copy('Buyer-facing name', 'Jina la kuuza kwa mteja')}</label>
                        <Input
                            className="h-10 bg-white"
                            placeholder={generatedName || copy('Example: Family pack, quarter kilo, carton of 12', 'Mfano: Family pack, Robo kilo, Carton ya 12')}
                            value={variant.name || ''}
                            onChange={(e) => updateName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700">{copy('Quick examples', 'Mifano ya haraka')}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={`${variant.id || index}-${suggestion}`}
                                    type="button"
                                    className="rounded-full border border-brand-200 bg-white px-2 py-1 text-[10px] font-bold text-brand-700"
                                    onClick={() => updateName(suggestion)}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
