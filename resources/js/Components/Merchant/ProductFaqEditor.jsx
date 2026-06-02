import React from 'react';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';

export default function ProductFaqEditor({ productFaqs, setProductFaqs }) {
    return (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700">Product FAQ</p>
                    <p className="text-xs text-slate-500">Maswali na majibu yatakayoonekana kwenye ukurasa wa bidhaa.</p>
                </div>
                <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-700"
                    onClick={() => setProductFaqs((prev) => [...prev, { question: '', answer: '', is_published: true }])}
                >
                    Add FAQ
                </button>
            </div>
            <div className="space-y-3">
                {productFaqs.map((faq, index) => (
                    <div key={`product-faq-${index}`} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">FAQ {index + 1}</span>
                            <button
                                type="button"
                                className="text-xs font-black text-red-600"
                                onClick={() => setProductFaqs((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            >
                                Remove
                            </button>
                        </div>
                        <Input
                            className="h-10 bg-slate-50"
                            value={faq.question}
                            onChange={(e) => setProductFaqs((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, question: e.target.value } : row))}
                            placeholder="Mf. Does it come with charger?"
                        />
                        <Textarea
                            className="min-h-20 rounded-xl bg-slate-50"
                            value={faq.answer}
                            onChange={(e) => setProductFaqs((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, answer: e.target.value } : row))}
                            placeholder="Mf. Yes, it includes 1 charging cable and manual."
                        />
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                            <input
                                type="checkbox"
                                checked={faq.is_published !== false}
                                onChange={(e) => setProductFaqs((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, is_published: e.target.checked } : row))}
                            />
                            Published
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}
