import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Image, Text, Trash2 } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { useLocale } from '@/lib/i18n';

const sectionTypes = [
    { key: 'text', label: 'Text', icon: Text },
    { key: 'image', label: 'Image', icon: Image },
    { key: 'image_text', label: 'Image + text', icon: Image },
];

const emptySection = (sectionType = 'text') => ({
    section_type: sectionType,
    title: '',
    body: '',
    image_url: '',
    is_visible: true,
});

export default function ProductDetailSectionsEditor({ productDetailSections, setProductDetailSections, onUploadSectionImage }) {
    const { copy } = useLocale();
    const [openIndex, setOpenIndex] = useState(0);

    const updateSection = (index, updates) => {
        setProductDetailSections((prev) => prev.map((section, sectionIndex) => (
            sectionIndex === index ? { ...section, ...updates } : section
        )));
    };

    const addSection = (sectionType = 'text') => {
        setProductDetailSections((prev) => [...prev, emptySection(sectionType)]);
        setOpenIndex(productDetailSections.length);
    };

    const removeSection = (index) => {
        setProductDetailSections((prev) => {
            const next = prev.filter((_, sectionIndex) => sectionIndex !== index);
            return next.length > 0 ? next : [emptySection('text')];
        });
        setOpenIndex((current) => Math.max(0, Math.min(current, productDetailSections.length - 2)));
    };

    const moveSection = (index, direction) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= productDetailSections.length) return;

        setProductDetailSections((prev) => {
            const next = [...prev];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
        setOpenIndex(nextIndex);
    };

    return (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 min-[760px]:flex-row min-[760px]:items-start min-[760px]:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">{copy('In-depth product details / features', 'Maelezo ya kina ya bidhaa / vipengele')}</p>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                        {copy('Add rich product-description blocks. Use text sections for specs or explanations, and image sections for designed feature graphics.', 'Ongeza sehemu zenye maelezo ya kina ya bidhaa. Tumia maandishi kwa specs au maelezo, na picha kwa michoro ya vipengele.')}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {sectionTypes.map(({ key, label, icon: Icon }) => (
                        <Button key={key} type="button" variant="outline" size="sm" className="h-9 rounded-xl text-xs font-black" onClick={() => addSection(key)}>
                            <Icon className="mr-1 h-3.5 w-3.5" />
                            {copy(label, label === 'Image + text' ? 'Picha + maandishi' : label === 'Image' ? 'Picha' : 'Maandishi')}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                {productDetailSections.map((section, index) => {
                    const isOpen = openIndex === index;
                    const typeLabel = copy(sectionTypes.find((type) => type.key === section.section_type)?.label || 'Section', section.section_type === 'image_text' ? 'Picha + maandishi' : section.section_type === 'image' ? 'Picha' : 'Maandishi');
                    const needsText = ['text', 'image_text', 'selling_points', 'company_intro', 'custom'].includes(section.section_type || 'text');
                    const needsImage = ['image', 'image_text'].includes(section.section_type || 'text');

                    return (
                        <div key={`product-detail-section-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                            >
                                <span className="min-w-0">
                                    <span className="block text-sm font-black text-slate-900">
                                        {section.title || `${typeLabel} ${copy('section', 'sehemu')} ${index + 1}`}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                                        {typeLabel}{section.is_visible === false ? ` / ${copy('hidden', 'imefichwa')}` : ''}
                                    </span>
                                </span>
                                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isOpen && (
                                <div className="space-y-3 border-t border-slate-200 bg-white p-3">
                                    <div className="grid gap-2 min-[760px]:grid-cols-[180px_1fr_auto]">
                                        <select
                                            value={section.section_type || 'text'}
                                            onChange={(e) => updateSection(index, {
                                                section_type: e.target.value,
                                                body: e.target.value === 'image' ? '' : section.body,
                                                image_url: e.target.value === 'text' ? '' : section.image_url,
                                            })}
                                            className="h-11 rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                        >
                                            {sectionTypes.map((type) => (
                                                <option key={type.key} value={type.key}>{type.label}</option>
                                            ))}
                                        </select>
                                        <Input
                                            value={section.title || ''}
                                            onChange={(e) => updateSection(index, { title: e.target.value })}
                                            placeholder={copy('Section title, e.g. High speed brushless motor', 'Kichwa cha sehemu, mfano: motor yenye kasi kubwa')}
                                            className="h-11 bg-white"
                                        />
                                        <div className="flex gap-1">
                                            <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                                                <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => moveSection(index, 1)} disabled={index === productDetailSections.length - 1}>
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                            <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl text-red-600" onClick={() => removeSection(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {needsImage && (
                                        <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
                                            {section.image_url || section.local_image_url ? (
                                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                                    <img
                                                        src={section.local_image_url || section.image_url}
                                                        alt={section.title || copy('Product feature', 'Kipengele cha bidhaa')}
                                                        className="max-h-80 w-full object-contain"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="rounded-xl bg-white px-4 py-6 text-center text-xs font-bold text-slate-500">
                                                        {copy('Upload a product feature image. Files are stored by Takeer for persistence.', 'Pakia picha ya kipengele cha bidhaa. Faili zitatunzwa na Takeer.')}
                                                </div>
                                            )}

                                            {section.is_uploading_image && (
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                                    <div
                                                        className="h-full rounded-full bg-brand-600 transition-all"
                                                        style={{ width: `${section.upload_progress || 0}%` }}
                                                    />
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-2 min-[520px]:flex-row">
                                                <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:border-brand-200 hover:text-brand-700">
                                                    {section.image_url ? copy('Replace image', 'Badilisha picha') : copy('Upload image', 'Pakia picha')}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        disabled={section.is_uploading_image}
                                                        onChange={(event) => {
                                                            const file = event.target.files?.[0];
                                                            if (file) onUploadSectionImage?.(index, file);
                                                            event.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                                {section.image_url && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-11 rounded-xl text-red-600"
                                                        onClick={() => updateSection(index, { image_url: '', local_image_url: '', is_uploading_image: false, upload_progress: 0 })}
                                                    >
                                                        {copy('Remove image', 'Ondoa picha')}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {needsText && (
                                        <Textarea
                                            value={section.body || ''}
                                            onChange={(e) => updateSection(index, { body: e.target.value })}
                                            placeholder={copy('Write product details, feature explanation, specs, selling points, or usage notes...', 'Andika maelezo ya bidhaa, ufafanuzi wa kipengele, specs, hoja za mauzo, au matumizi...')}
                                            className="min-h-28 rounded-xl bg-white"
                                        />
                                    )}

                                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={section.is_visible !== false}
                                            onChange={(e) => updateSection(index, { is_visible: e.target.checked })}
                                        />
                                        {copy('Visible on product page', 'Inaonekana kwenye ukurasa wa bidhaa')}
                                    </label>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
