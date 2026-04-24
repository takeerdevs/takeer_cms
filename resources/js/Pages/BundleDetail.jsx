import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Boxes, Package, Store, Zap, Clock3, BookOpenText, CheckCircle2, CalendarClock, Plus, Minus } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';

export default function BundleDetail({ bundle }) {
    const merchant = bundle?.merchant || {};
    const isMenuMode = Boolean(bundle?.is_individual_sale && !bundle?.is_course);
    const selectableItems = useMemo(() => (
        (bundle?.items || []).filter((item) => ['product', 'content_item'].includes(item.item_type))
    ), [bundle?.items]);
    const [selectedItemQty, setSelectedItemQty] = useState({});

    useEffect(() => {
        setSelectedItemQty({});
    }, [bundle?.id]);

    const selectedLines = useMemo(() => (
        selectableItems
            .map((item) => {
                const key = `${item.item_type}-${item.item_id}`;
                const quantity = Number(selectedItemQty[key] || 0);
                if (quantity <= 0) return null;
                const unitPrice = Number(item.price || 0);
                return {
                    item_type: item.item_type,
                    item_id: Number(item.item_id),
                    selected_variant_id: item.selected_variant_id ? Number(item.selected_variant_id) : null,
                    selected_variant_snapshot: item.selected_variant_snapshot || null,
                    quantity,
                    unit_price: unitPrice,
                    line_total: unitPrice * quantity,
                };
            })
            .filter(Boolean)
    ), [selectableItems, selectedItemQty]);
    const selectedTotal = useMemo(() => selectedLines.reduce((sum, row) => sum + Number(row.line_total || 0), 0), [selectedLines]);

    const courseItemsBySection = (bundle?.items || []).reduce((acc, item, index) => {
        const key = item.section_title || 'General';
        if (!acc[key]) acc[key] = [];
        acc[key].push({ ...item, index: index + 1 });
        return acc;
    }, {});
    const checkoutItem = isMenuMode
        ? {
            ...bundle,
            checkoutType: 'bundle',
            checkout_price: selectedTotal,
            selected_bundle_items: selectedLines,
            merchant,
        }
        : {
            ...bundle,
            checkoutType: 'bundle',
            merchant,
        };
    const isImageLikeUrl = (value) => {
        if (!value || typeof value !== 'string') return false;
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(value.trim());
    };
    const getItemQty = (item) => Number(selectedItemQty[`${item.item_type}-${item.item_id}`] || 0);
    const getVariantLabel = (item) => {
        const snapshot = item?.selected_variant_snapshot;
        if (!snapshot) return null;
        const attrs = Array.isArray(snapshot?.attributes)
            ? snapshot.attributes.filter(Boolean).map((attr) => `${attr?.key}: ${attr?.value}`)
            : [];
        if (attrs.length > 0) {
            return `${snapshot.name || 'Variant'} (${attrs.join(', ')})`;
        }
        return snapshot.name || null;
    };
    const toggleItemSelection = (item) => {
        const key = `${item.item_type}-${item.item_id}`;
        setSelectedItemQty((current) => ({
            ...current,
            [key]: current[key] ? 0 : 1,
        }));
    };
    const changeItemQty = (item, delta) => {
        const key = `${item.item_type}-${item.item_id}`;
        setSelectedItemQty((current) => {
            const nextQty = Math.max(0, Math.min(99, Number(current[key] || 0) + delta));
            return { ...current, [key]: nextQty };
        });
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${bundle.title} | Takeer`} />

            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
                <Link href={merchant?.slug ? `/m/${merchant.slug}` : '/'} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to store
                </Link>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[28px] border bg-card p-6 md:p-8">
                        {bundle.is_course && bundle.course_cover_image_url && (
                            <div className="mb-5 rounded-2xl overflow-hidden border">
                                <img src={bundle.course_cover_image_url} alt={bundle.title} className="w-full h-52 object-cover" />
                            </div>
                        )}
                        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-sky-700">
                            <Boxes className="h-3.5 w-3.5" />
                            {bundle.is_course ? 'Course Bundle' : 'Bundle Offer'}
                        </div>
                        <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">{bundle.title}</h1>
                        <p className="mt-4 text-base leading-8 text-muted-foreground">{bundle.description || 'A grouped offer containing multiple premium items.'}</p>
                        {bundle.is_course && (
                            <p className="mt-3 text-xs font-black uppercase tracking-widest text-indigo-700">
                                Format: {(bundle.course_format || 'self_paced').replace('_', ' ')}
                            </p>
                        )}

                        {bundle.is_course && Array.isArray(bundle.course_outcomes) && bundle.course_outcomes.length > 0 && (
                            <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-indigo-700">What you will learn</p>
                                <div className="mt-3 space-y-2">
                                    {bundle.course_outcomes.map((outcome, idx) => (
                                        <div key={`outcome-${idx}`} className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-indigo-600 shrink-0" />
                                            <p className="text-sm text-indigo-900">{outcome}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {bundle.is_course && Array.isArray(bundle.course_requirements) && bundle.course_requirements.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-amber-700">Requirements</p>
                                <ul className="mt-2 space-y-1">
                                    {bundle.course_requirements.map((req, idx) => (
                                        <li key={`req-${idx}`} className="text-sm text-amber-900">• {req}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-8 space-y-3">
                            {(bundle.items || []).length === 0 ? (
                                <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-muted-foreground">
                                    Bundle items will appear here.
                                </div>
                            ) : !bundle.is_course ? (
                                bundle.items.map((item, index) => (
                                    <div key={`${item.item_type}-${item.item_id}-${index}`} className={`rounded-2xl border px-4 py-4 ${isMenuMode && getItemQty(item) > 0 ? 'border-sky-300 bg-sky-50/60' : ''}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-11 w-11 rounded-2xl bg-muted overflow-hidden flex items-center justify-center">
                                                    {isImageLikeUrl(item.image_url) ? (
                                                        <img src={item.image_url} alt={item.title || item.item_type} className="h-full w-full object-cover" />
                                                    ) : item.item_type === 'content_item' ? (
                                                        <BookOpenText className="h-5 w-5 text-sky-600" />
                                                    ) : item.product_type === 'service' ? (
                                                        <CalendarClock className="h-5 w-5 text-sky-600" />
                                                    ) : (
                                                        <Package className="h-5 w-5 text-sky-600" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-sm truncate">{item.title || item.item_type.replace('_', ' ')}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.item_type.replace('_', ' ')} {isMenuMode ? `· TZS ${Number(item.price || 0).toLocaleString()}` : '· Included in this bundle'}
                                                    </p>
                                                    {getVariantLabel(item) && (
                                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                            Variant: {getVariantLabel(item)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {isMenuMode ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleItemSelection(item)}
                                                    className={`h-6 w-6 rounded border ${getItemQty(item) > 0 ? 'bg-sky-600 border-sky-600 text-white' : 'border-border bg-background'}`}
                                                    aria-label="Select bundle item"
                                                >
                                                    {getItemQty(item) > 0 ? '✓' : ''}
                                                </button>
                                            ) : null}
                                        </div>
                                        {isMenuMode && getItemQty(item) > 0 ? (
                                            <div className="mt-3 flex items-center justify-between rounded-xl border bg-white/90 px-3 py-2">
                                                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Quantity</span>
                                                <div className="flex items-center gap-2">
                                                    <button type="button" onClick={() => changeItemQty(item, -1)} className="h-7 w-7 rounded-md border flex items-center justify-center">
                                                        <Minus className="h-3.5 w-3.5" />
                                                    </button>
                                                    <span className="w-8 text-center text-sm font-black">{getItemQty(item)}</span>
                                                    <button type="button" onClick={() => changeItemQty(item, 1)} className="h-7 w-7 rounded-md border flex items-center justify-center">
                                                        <Plus className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ))
                            ) : (
                                Object.entries(courseItemsBySection).map(([sectionTitle, items]) => (
                                    <div key={sectionTitle} className="rounded-2xl border p-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-indigo-700">{sectionTitle}</p>
                                        <div className="mt-3 space-y-2">
                                            {items.map((item) => (
                                                <div key={`${item.item_type}-${item.item_id}-${item.index}`} className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="font-black text-sm text-indigo-900">{item.lesson_title || `Lesson ${item.index}`}</p>
                                                        {item.is_preview && (
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Preview</span>
                                                        )}
                                                    </div>
                                                    {item.lesson_summary && (
                                                        <p className="text-xs text-indigo-800 mt-1.5">{item.lesson_summary}</p>
                                                    )}
                                                    <div className="mt-2 flex items-center gap-3 text-[11px] text-indigo-700">
                                                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{item.lesson_duration_minutes ? `${item.lesson_duration_minutes} min` : 'Duration N/A'}</span>
                                                        <span className="inline-flex items-center gap-1"><BookOpenText className="h-3.5 w-3.5" />Unlock +{Number(item.unlock_after_days || 0)} day(s)</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-[28px] border bg-card p-6">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-sky-50 flex items-center justify-center">
                                    <Store className="h-5 w-5 text-sky-600" />
                                </div>
                                <div>
                                    <p className="font-black">{merchant.display_name || merchant.name}</p>
                                    <p className="text-sm text-muted-foreground">@{merchant.slug || merchant.username || 'merchant'}</p>
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl bg-accent/40 px-4 py-4">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{isMenuMode ? 'Selected Total' : 'Bundle Price'}</p>
                                <p className="mt-2 text-3xl font-black text-brand-600">
                                    TZS {Number(isMenuMode ? selectedTotal : (bundle.price || 0)).toLocaleString()}
                                </p>
                                {isMenuMode && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {selectedLines.length > 0
                                            ? `${selectedLines.length} item(s) selected`
                                            : 'Select at least one item to continue.'}
                                    </p>
                                )}
                            </div>

                            <Button
                                className="w-full mt-5 h-12 rounded-2xl font-black"
                                onClick={() => window.__openCheckout?.(checkoutItem)}
                                disabled={isMenuMode && selectedLines.length === 0}
                            >
                                <Zap className="mr-2 h-4 w-4" />
                                {isMenuMode ? 'Checkout Selected Items' : 'Buy Bundle'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
