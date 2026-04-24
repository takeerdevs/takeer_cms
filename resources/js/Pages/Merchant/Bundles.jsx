import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Boxes, Loader2, Plus, Save, Trash2, Pencil, Package, CalendarClock, BookOpenText } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const initialBundleForm = {
    id: null,
    title: '',
    description: '',
    price: '',
    is_individual_sale: true,
    is_course: false,
    course_format: 'self_paced',
    course_outcomes_text: '',
    course_requirements_text: '',
    course_cover_image_url: '',
    status: 'draft',
    items: [],
};

export default function MerchantBundles({ merchantUsername = '', itemPickerDefaultLimit = 5 }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState([]);
    const [contentItems, setContentItems] = useState([]);
    const [bundles, setBundles] = useState([]);
    const [bundleForm, setBundleForm] = useState(initialBundleForm);
    const [bundleItemSearch, setBundleItemSearch] = useState('');
    const [commerceSummary, setCommerceSummary] = useState(null);
    const selectableItemsLimit = Math.min(20, Math.max(1, Number(itemPickerDefaultLimit) || 5));

    useEffect(() => {
        loadPage();
    }, []);

    const productOptions = useMemo(() => (
        products.map((product) => ({
            key: `product-${product.id}`,
            item_type: 'product',
            item_id: product.id,
            label: product.title,
            meta: product.type,
            image_url: product.image_url || null,
            product_type: product.type || null,
            has_variants: Boolean(product.has_variants),
            variants: Array.isArray(product.variants)
                ? product.variants.filter((variant) => Boolean(variant?.is_active))
                : [],
        }))
    ), [products]);

    const contentOptions = useMemo(() => (
        contentItems.map((item) => ({
            key: `content_item-${item.id}`,
            item_type: 'content_item',
            item_id: item.id,
            label: item.title,
            meta: item.price === null ? 'Free' : `TZS ${Number(item.price).toLocaleString()}`,
            image_url: item.cover_image || item.image_url || null,
            product_type: null,
        }))
    ), [contentItems]);

    const bundleSelectableItems = useMemo(() => [...productOptions, ...contentOptions], [productOptions, contentOptions]);
    const sortOptionsByLatest = (options) => (
        [...options].sort((a, b) => Number(b.item_id || 0) - Number(a.item_id || 0))
    );

    const filterSelectableItems = (options, term) => {
        const normalizedTerm = term.trim().toLowerCase();
        const sorted = sortOptionsByLatest(options);
        if (!normalizedTerm) return sorted;
        return sorted.filter((option) => {
            const haystack = `${option.label || ''} ${option.meta || ''} ${option.item_type || ''}`.toLowerCase();
            return haystack.includes(normalizedTerm);
        });
    };

    const bundleVisibleItems = useMemo(() => {
        const sorted = sortOptionsByLatest(bundleSelectableItems);
        const filtered = filterSelectableItems(bundleSelectableItems, bundleItemSearch);
        const selectedKeys = new Set(bundleForm.items.map((item) => `${item.item_type}-${item.item_id}`));
        const limited = filtered.slice(0, selectableItemsLimit);
        const includedKeys = new Set(limited.map((option) => `${option.item_type}-${option.item_id}`));

        const selectedOutsideLimit = sorted.filter((option) => {
            const key = `${option.item_type}-${option.item_id}`;
            return selectedKeys.has(key) && !includedKeys.has(key);
        });

        return [...limited, ...selectedOutsideLimit];
    }, [bundleForm.items, bundleItemSearch, bundleSelectableItems]);

    const isImageLikeUrl = (value) => {
        if (!value || typeof value !== 'string') return false;
        return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(value.trim());
    };

    const summaryCards = useMemo(() => {
        const data = commerceSummary?.sections?.bundles || {};
        return [
            { label: 'Bundles', value: data.total_items ?? bundles.length },
            { label: 'Published', value: data.published_items ?? 0 },
            { label: 'Orders Today', value: data.today_orders ?? 0 },
            { label: 'Sales Today', value: `TZS ${Number(data.today_sales ?? 0).toLocaleString()}` },
        ];
    }, [bundles.length, commerceSummary]);

    async function loadPage() {
        setLoading(true);
        try {
            const [productsRes, contentRes, bundleRes, summaryRes] = await Promise.all([
                axios.get('/merchant/products/api'),
                axios.get('/merchant/content-items/api'),
                axios.get('/merchant/bundles/api'),
                axios.get(`/merchant/${merchantUsername}/orders/api/commerce-summary`).catch(() => ({ data: null })),
            ]);

            setProducts(productsRes.data?.data || []);
            setContentItems(contentRes.data?.data || []);
            setBundles(bundleRes.data?.data || []);
            setCommerceSummary(summaryRes.data || null);
        } catch (error) {
            toast.error('Imeshindwa kupakia bundles page.');
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setBundleForm(initialBundleForm);
        setBundleItemSearch('');
    }

    function startEditBundle(item) {
        setBundleItemSearch('');
        setBundleForm({
            id: item.id,
            title: item.title || '',
            description: item.description || '',
            price: item.price ?? '',
            is_individual_sale: item.is_individual_sale ?? true,
            is_course: item.is_course ?? false,
            course_format: item.course_format || 'self_paced',
            course_outcomes_text: Array.isArray(item.course_outcomes) ? item.course_outcomes.join('\n') : '',
            course_requirements_text: Array.isArray(item.course_requirements) ? item.course_requirements.join('\n') : '',
            course_cover_image_url: item.course_cover_image_url || '',
            status: item.status || 'draft',
            items: (item.items || []).map((entry) => ({
                item_type: entry.item_type,
                item_id: entry.item_id,
                selected_variant_id: entry.selected_variant_id ?? null,
                section_title: entry.section_title || '',
                lesson_title: entry.lesson_title || '',
                lesson_summary: entry.lesson_summary || '',
                lesson_duration_minutes: entry.lesson_duration_minutes ?? '',
                unlock_after_days: entry.unlock_after_days ?? 0,
                is_preview: Boolean(entry.is_preview),
                sort_order: entry.sort_order ?? 0,
            })),
        });
    }

    async function saveBundle() {
        setSaving(true);
        try {
            const payload = {
                ...bundleForm,
                price: bundleForm.price === '' ? null : Number(bundleForm.price),
                course_outcomes: bundleForm.course_outcomes_text
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean),
                course_requirements: bundleForm.course_requirements_text
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean),
                items: bundleForm.items.map((item, index) => ({
                    ...item,
                    selected_variant_id: item.selected_variant_id ? Number(item.selected_variant_id) : null,
                    lesson_duration_minutes: item.lesson_duration_minutes === '' ? null : Number(item.lesson_duration_minutes),
                    unlock_after_days: Number(item.unlock_after_days || 0),
                    sort_order: index,
                })),
            };

            if (bundleForm.id) {
                await axios.put(`/merchant/bundles/${bundleForm.id}/api`, payload);
                toast.success('Bundle imesasishwa.');
            } else {
                await axios.post('/merchant/bundles/api', payload);
                toast.success('Bundle imeundwa.');
            }

            resetForm();
            await loadPage();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi bundle.');
        } finally {
            setSaving(false);
        }
    }

    async function destroyBundle(id) {
        if (!window.confirm('Una uhakika unataka kufuta bundle hii?')) return;

        try {
            await axios.delete(`/merchant/bundles/${id}/api`);
            toast.success('Bundle imefutwa.');
            if (bundleForm.id === id) resetForm();
            await loadPage();
        } catch (error) {
            toast.error('Imeshindwa kufuta bundle.');
        }
    }

    function toggleBundleItem(option) {
        setBundleForm((current) => {
            const exists = current.items.some((item) => item.item_type === option.item_type && item.item_id === option.item_id);
            return {
                ...current,
                items: exists
                    ? current.items.filter((item) => !(item.item_type === option.item_type && item.item_id === option.item_id))
                    : [...current.items, {
                        item_type: option.item_type,
                        item_id: option.item_id,
                        selected_variant_id: option.item_type === 'product' && option.has_variants
                            ? (option.variants?.[0]?.id ?? null)
                            : null,
                        section_title: '',
                        lesson_title: option.label || '',
                        lesson_summary: '',
                        lesson_duration_minutes: '',
                        unlock_after_days: 0,
                        is_preview: false,
                        sort_order: current.items.length,
                    }],
            };
        });
    }

    function updateSelectedCourseItem(option, patch) {
        setBundleForm((current) => ({
            ...current,
            items: current.items.map((item) => (
                item.item_type === option.item_type && item.item_id === option.item_id
                    ? { ...item, ...patch }
                    : item
            )),
        }));
    }

    if (loading) {
        return (
            <AppLayout>
                <Head title="Bundles | Takeer" />
                <div className="max-w-6xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">Inapakia bundles...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Bundles | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <Card className="rounded-[24px] border-brand-200/70">
                    <CardHeader>
                        <CardTitle className="text-lg font-black">Bundles Summary</CardTitle>
                        <CardDescription>{commerceSummary?.date ? `Daily metrics for ${commerceSummary.date}` : 'Useful performance snapshot for bundles.'}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {summaryCards.map((item) => (
                            <div key={item.label} className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                                <p className="mt-2 text-xl font-black text-foreground">{item.value}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <Card className="rounded-[24px] border-sky-200/70">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl font-black">
                                <Boxes className="h-5 w-5 text-sky-600" />
                                {bundleForm.id ? 'Edit Bundle' : 'Create Bundle'}
                            </CardTitle>
                            <CardDescription>Group products and post content into one sellable offer.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Bundle Name</label>
                                    <Input value={bundleForm.title} onChange={(e) => setBundleForm({ ...bundleForm, title: e.target.value })} placeholder="Mf. Retail Starter Pack" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Price (TZS)</label>
                                    <Input type="number" min="0" value={bundleForm.price} onChange={(e) => setBundleForm({ ...bundleForm, price: e.target.value })} placeholder="25000" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</label>
                                <Textarea rows={4} value={bundleForm.description} onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })} placeholder="Explain what the buyer gets inside this bundle." />
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <label className="rounded-2xl border border-input bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold">Sell individually</p>
                                        <p className="text-xs text-muted-foreground">Buyer can purchase this bundle directly.</p>
                                    </div>
                                    <input type="checkbox" className="h-4 w-4" checked={bundleForm.is_individual_sale} onChange={(e) => setBundleForm({ ...bundleForm, is_individual_sale: e.target.checked })} />
                                </label>
                                <label className="rounded-2xl border border-input bg-sky-50/40 px-4 py-3 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold">Course Mode</p>
                                        <p className="text-xs text-muted-foreground">Treat this bundle as a course package.</p>
                                    </div>
                                    <input type="checkbox" className="h-4 w-4" checked={bundleForm.is_course} onChange={(e) => setBundleForm({ ...bundleForm, is_course: e.target.checked })} />
                                </label>
                            </div>

                            {bundleForm.is_course && (
                                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-indigo-700">Course Builder</p>
                                    <div className="grid md:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Course Format</label>
                                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bundleForm.course_format} onChange={(e) => setBundleForm({ ...bundleForm, course_format: e.target.value })}>
                                                <option value="self_paced">Self-paced</option>
                                                <option value="cohort">Cohort</option>
                                                <option value="live">Live classes</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Course Cover URL</label>
                                            <Input value={bundleForm.course_cover_image_url} onChange={(e) => setBundleForm({ ...bundleForm, course_cover_image_url: e.target.value })} placeholder="https://..." />
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Learning Outcomes</label>
                                            <Textarea rows={4} value={bundleForm.course_outcomes_text} onChange={(e) => setBundleForm({ ...bundleForm, course_outcomes_text: e.target.value })} placeholder={'Write one per line.\nEg: Build a professional plumbing quote'} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Requirements</label>
                                            <Textarea rows={4} value={bundleForm.course_requirements_text} onChange={(e) => setBundleForm({ ...bundleForm, course_requirements_text: e.target.value })} placeholder={'Write one per line.\nEg: Basic smartphone skills'} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Bundle Items</p>
                                    <p className="text-xs text-muted-foreground mt-1">Showing latest {selectableItemsLimit} items by default. Search to find older ones.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Search Items</label>
                                    <Input
                                        value={bundleItemSearch}
                                        onChange={(e) => setBundleItemSearch(e.target.value)}
                                        placeholder="Search products or content..."
                                    />
                                </div>
                                <div className="grid gap-2">
                                    {bundleVisibleItems.map((option) => {
                                        const selected = bundleForm.items.some((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                        const selectedItem = bundleForm.items.find((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                        return (
                                            <div key={option.key} className={`rounded-2xl border px-4 py-3 text-left transition-all ${selected ? 'border-sky-300 bg-sky-50' : 'border-border bg-background hover:bg-muted/40'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleBundleItem(option)}
                                                    className="w-full text-left"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="h-10 w-10 rounded-xl border border-border/70 bg-muted overflow-hidden flex items-center justify-center shrink-0">
                                                                {isImageLikeUrl(option.image_url) ? (
                                                                    <img src={option.image_url} alt={option.label} className="h-full w-full object-cover" />
                                                                ) : option.item_type === 'content_item' ? (
                                                                    <BookOpenText className="h-4 w-4 text-muted-foreground" />
                                                                ) : option.product_type === 'service' ? (
                                                                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                                                ) : (
                                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold truncate">{option.label}</p>
                                                                <p className="text-xs text-muted-foreground truncate">{option.item_type} · {option.meta}</p>
                                                            </div>
                                                        </div>
                                                        <span className={`text-xs font-black uppercase tracking-wider ${selected ? 'text-sky-700' : 'text-muted-foreground'}`}>
                                                            {selected ? 'Selected' : 'Add'}
                                                        </span>
                                                    </div>
                                                </button>
                                                {bundleForm.is_course && selected && (
                                                    <div className="mt-3 pt-3 border-t border-sky-200/70 space-y-2">
                                                        {option.item_type === 'product' && option.has_variants && (
                                                            <div className="space-y-1">
                                                                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Product Variant</label>
                                                                <select
                                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                                    value={selectedItem?.selected_variant_id ?? ''}
                                                                    onChange={(e) => updateSelectedCourseItem(option, { selected_variant_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                                >
                                                                    <option value="">Select variant</option>
                                                                    {(option.variants || []).map((variant) => (
                                                                        <option key={variant.id} value={variant.id}>
                                                                            {variant.name}{variant.price !== null ? ` · TZS ${Number(variant.price).toLocaleString()}` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                        <div className="grid md:grid-cols-2 gap-2">
                                                            <Input
                                                                value={selectedItem?.section_title || ''}
                                                                onChange={(e) => updateSelectedCourseItem(option, { section_title: e.target.value })}
                                                                placeholder="Module title (e.g. Module 1)"
                                                            />
                                                            <Input
                                                                value={selectedItem?.lesson_title || ''}
                                                                onChange={(e) => updateSelectedCourseItem(option, { lesson_title: e.target.value })}
                                                                placeholder="Lesson title"
                                                            />
                                                        </div>
                                                        <Textarea
                                                            rows={2}
                                                            value={selectedItem?.lesson_summary || ''}
                                                            onChange={(e) => updateSelectedCourseItem(option, { lesson_summary: e.target.value })}
                                                            placeholder="Lesson summary"
                                                        />
                                                        <div className="grid md:grid-cols-3 gap-2">
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={selectedItem?.lesson_duration_minutes ?? ''}
                                                                onChange={(e) => updateSelectedCourseItem(option, { lesson_duration_minutes: e.target.value })}
                                                                placeholder="Duration (min)"
                                                            />
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={selectedItem?.unlock_after_days ?? 0}
                                                                onChange={(e) => updateSelectedCourseItem(option, { unlock_after_days: e.target.value })}
                                                                placeholder="Unlock after days"
                                                            />
                                                            <label className="rounded-xl border border-input bg-background px-3 py-2 flex items-center justify-between gap-2">
                                                                <span className="text-xs font-bold text-muted-foreground">Preview Lesson</span>
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4"
                                                                    checked={Boolean(selectedItem?.is_preview)}
                                                                    onChange={(e) => updateSelectedCourseItem(option, { is_preview: e.target.checked })}
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                                {!bundleForm.is_course && selected && option.item_type === 'product' && option.has_variants && (
                                                    <div className="mt-3 pt-3 border-t border-sky-200/70 space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Product Variant</label>
                                                        <select
                                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                                            value={selectedItem?.selected_variant_id ?? ''}
                                                            onChange={(e) => updateSelectedCourseItem(option, { selected_variant_id: e.target.value === '' ? null : Number(e.target.value) })}
                                                        >
                                                            <option value="">Select variant</option>
                                                            {(option.variants || []).map((variant) => (
                                                                <option key={variant.id} value={variant.id}>
                                                                    {variant.name}{variant.price !== null ? ` · TZS ${Number(variant.price).toLocaleString()}` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {bundleVisibleItems.length === 0 && (
                                        <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border px-3 py-2">
                                            No items found for your search.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {bundleForm.is_course && bundleForm.items.length > 0 && (
                                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-widest text-indigo-700">Course Outline Preview</p>
                                    <div className="space-y-2">
                                        {bundleForm.items.map((item, idx) => (
                                            <div key={`${item.item_type}-${item.item_id}-${idx}`} className="rounded-xl bg-white border border-indigo-100 px-3 py-2">
                                                <p className="text-sm font-bold text-indigo-900">{item.lesson_title || `Lesson ${idx + 1}`}</p>
                                                <p className="text-xs text-indigo-700 mt-0.5">
                                                    {(item.section_title || 'General')} • {item.lesson_duration_minutes || 'N/A'} min • Unlock +{Number(item.unlock_after_days || 0)}d {item.is_preview ? '• Preview' : ''}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-end gap-3">
                                <div className="w-full sm:w-[220px] space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bundleForm.status} onChange={(e) => setBundleForm({ ...bundleForm, status: e.target.value })}>
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                                <Button className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl" onClick={saveBundle} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {bundleForm.id ? 'Update Bundle' : 'Save Bundle'}
                                </Button>
                                <Button variant="outline" className="rounded-xl" onClick={resetForm}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Bundle
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[24px]">
                        <CardHeader>
                            <CardTitle className="text-lg font-black">Bundle Catalog</CardTitle>
                            <CardDescription>All bundles in your merchant catalog.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {bundles.length === 0 ? (
                                <EmptyState icon={Boxes} title="Hakuna bundles bado" body="Anza kwa kuunganisha bidhaa na content kwenye offer moja." />
                            ) : bundles.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-border/70 bg-background px-4 py-4 flex items-start gap-3">
                                    <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                                        <Boxes className="h-5 w-5 text-brand-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-foreground">{item.title}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{item.status} · {item.items?.length || 0} items {item.is_course ? '· Course' : ''}</p>
                                        <p className="text-xs font-bold uppercase tracking-widest text-brand-700 mt-2">{item.price ? `TZS ${Number(item.price).toLocaleString()}` : 'No price'}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => startEditBundle(item)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-red-600 hover:text-red-700" onClick={() => destroyBundle(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}

function EmptyState({ icon: Icon, title, body }) {
    return (
        <div className="rounded-3xl border border-dashed border-border px-5 py-10 text-center">
            <div className="mx-auto h-14 w-14 bg-muted flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-black">{title}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-6">{body}</p>
        </div>
    );
}
