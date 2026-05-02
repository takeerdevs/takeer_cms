import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Crown, Loader2, Plus, Save, Trash2, Pencil, Clock3 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const initialPlanForm = {
    id: null,
    name: '',
    description: '',
    price: '',
    billing_interval: 'monthly',
    interval_count: 1,
    weekly_days: [],
    monthly_day: '',
    trial_days: '',
    tier: 1,
    status: 'draft',
    items: [],
};

const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function MerchantSubscriptions({ merchantUsername = '', itemPickerDefaultLimit = 5 }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState([]);
    const [contentItems, setContentItems] = useState([]);
    const [bundles, setBundles] = useState([]);
    const [plans, setPlans] = useState([]);
    const [planForm, setPlanForm] = useState(initialPlanForm);
    const [planItemSearch, setPlanItemSearch] = useState('');
    const [commerceSummary, setCommerceSummary] = useState(null);
    const selectableItemsLimit = Math.min(20, Math.max(1, Number(itemPickerDefaultLimit) || 5));

    useEffect(() => {
        loadPage();
    }, []);

    const productsById = useMemo(() => (
        new Map(products.map((product) => [Number(product.id), product]))
    ), [products]);

    const contentOptions = useMemo(() => (
        contentItems.map((item) => ({
            key: `content_item-${item.id}`,
            item_type: 'content_item',
            item_id: item.id,
            label: item.title,
            meta: item.price === null ? 'Free' : `TZS ${Number(item.price).toLocaleString()}`,
        }))
    ), [contentItems]);

    const bundleOptions = useMemo(() => (
        bundles
            .filter((bundle) => !((bundle.items || []).some((item) => {
                if (item.item_type !== 'product') return false;
                return productsById.get(Number(item.item_id))?.type === 'physical';
            })))
            .map((bundle) => ({
                key: `bundle-${bundle.id}`,
                item_type: 'bundle',
                item_id: bundle.id,
                label: bundle.title,
                meta: bundle.is_course ? 'Course bundle' : `${bundle.items?.length || 0} content items`,
            }))
    ), [bundles, productsById]);

    const planSelectableItems = useMemo(() => [...contentOptions, ...bundleOptions], [contentOptions, bundleOptions]);
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

    const planVisibleItems = useMemo(() => {
        const sorted = sortOptionsByLatest(planSelectableItems);
        const filtered = filterSelectableItems(planSelectableItems, planItemSearch);
        const selectedKeys = new Set(planForm.items.map((item) => `${item.item_type}-${item.item_id}`));
        const limited = filtered.slice(0, selectableItemsLimit);
        const includedKeys = new Set(limited.map((option) => `${option.item_type}-${option.item_id}`));

        const selectedOutsideLimit = sorted.filter((option) => {
            const key = `${option.item_type}-${option.item_id}`;
            return selectedKeys.has(key) && !includedKeys.has(key);
        });

        return [...limited, ...selectedOutsideLimit];
    }, [planForm.items, planItemSearch, planSelectableItems]);

    const summaryCards = useMemo(() => {
        const data = commerceSummary?.sections?.subscriptions || {};
        return [
            { label: 'Subscription Tiers', value: data.total_items ?? plans.length },
            { label: 'Active Tiers', value: data.active_tiers ?? 0 },
            { label: 'Active Members', value: data.active_members ?? 0 },
            { label: 'Sales Today', value: `TZS ${Number(data.today_sales ?? 0).toLocaleString()}` },
        ];
    }, [commerceSummary, plans.length]);

    async function loadPage() {
        setLoading(true);
        try {
            const [productsRes, contentRes, bundleRes, planRes, summaryRes] = await Promise.all([
                axios.get(`/merchant/${merchantUsername}/products/api`),
                axios.get(`/merchant/${merchantUsername}/content-items/api`),
                axios.get(`/merchant/${merchantUsername}/bundles/api`),
                axios.get(`/merchant/${merchantUsername}/subscription-plans/api`),
                axios.get(`/merchant/${merchantUsername}/orders/api/commerce-summary`).catch(() => ({ data: null })),
            ]);

            setProducts(productsRes.data?.data || []);
            setContentItems(contentRes.data?.data || []);
            setBundles(bundleRes.data?.bundles || bundleRes.data?.data || []);
            setPlans(planRes.data?.plans || planRes.data?.data || []);
            setCommerceSummary(summaryRes.data || null);
        } catch (error) {
            toast.error('Imeshindwa kupakia subscriptions page.');
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setPlanForm(initialPlanForm);
        setPlanItemSearch('');
    }

    function startEditPlan(item) {
        setPlanItemSearch('');
        setPlanForm({
            id: item.id,
            name: item.name || '',
            description: item.description || '',
            price: item.price ?? '',
            billing_interval: item.billing_interval || 'monthly',
            interval_count: item.interval_count || 1,
            weekly_days: item.weekly_days || [],
            monthly_day: item.monthly_day ?? '',
            trial_days: item.trial_days ?? '',
            tier: item.tier || 1,
            status: item.status || 'draft',
            items: (item.items || []).map((entry) => ({
                item_type: entry.item_type,
                item_id: entry.item_id,
                unlock_after_days: entry.unlock_after_days ?? 0,
            })),
        });
    }

    async function savePlan() {
        setSaving(true);
        try {
            const payload = {
                ...planForm,
                price: Number(planForm.price),
                interval_count: Number(planForm.interval_count || 1),
                monthly_day: planForm.monthly_day === '' ? null : Number(planForm.monthly_day),
                trial_days: planForm.trial_days === '' ? null : Number(planForm.trial_days),
                tier: Number(planForm.tier || 1),
                items: planForm.items.map((item) => ({
                    ...item,
                    unlock_after_days: Number(item.unlock_after_days || 0),
                })),
            };

            if (planForm.id) {
                await axios.put(`/merchant/${merchantUsername}/subscription-plans/${planForm.id}/api`, payload);
                toast.success('Subscription plan imesasishwa.');
            } else {
                await axios.post(`/merchant/${merchantUsername}/subscription-plans/api`, payload);
                toast.success('Subscription plan imeundwa.');
            }

            resetForm();
            await loadPage();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi subscription plan.');
        } finally {
            setSaving(false);
        }
    }

    async function destroyPlan(id) {
        if (!window.confirm('Una uhakika unataka kufuta tier hii?')) return;

        try {
            await axios.delete(`/merchant/${merchantUsername}/subscription-plans/${id}/api`);
            toast.success('Tier imefutwa.');
            if (planForm.id === id) resetForm();
            await loadPage();
        } catch (error) {
            toast.error('Imeshindwa kufuta tier.');
        }
    }

    function togglePlanItem(option) {
        setPlanForm((current) => {
            const exists = current.items.some((item) => item.item_type === option.item_type && item.item_id === option.item_id);
            return {
                ...current,
                items: exists
                    ? current.items.filter((item) => !(item.item_type === option.item_type && item.item_id === option.item_id))
                    : [...current.items, { item_type: option.item_type, item_id: option.item_id, unlock_after_days: 0 }],
            };
        });
    }

    function updatePlanItemDelay(itemType, itemId, value) {
        setPlanForm((current) => ({
            ...current,
            items: current.items.map((item) => (
                item.item_type === itemType && item.item_id === itemId
                    ? { ...item, unlock_after_days: value }
                    : item
            )),
        }));
    }

    if (loading) {
        return (
            <AppLayout>
                <Head title="Subscriptions | Takeer" />
                <div className="max-w-6xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">Inapakia subscriptions...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Subscriptions | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <Card className="rounded-[24px] border-brand-200/70">
                    <CardHeader>
                        <CardTitle className="text-lg font-black">Subscriptions Summary</CardTitle>
                        <CardDescription>{commerceSummary?.date ? `Daily metrics for ${commerceSummary.date}` : 'Useful performance snapshot for subscriptions.'}</CardDescription>
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
                    <Card className="rounded-[24px] border-emerald-200/70">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-xl font-black">
                                <Crown className="h-5 w-5 text-emerald-600" />
                                {planForm.id ? 'Edit Subscription Tier' : 'Create Subscription Tier'}
                            </CardTitle>
                            <CardDescription>Build recurring access plans for member-only content, downloads, and course bundles.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tier Name</label>
                                    <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Mf. Gold Business Circle" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Price (TZS)</label>
                                    <Input type="number" min="0" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} placeholder="10000" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</label>
                                <Textarea rows={4} value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Describe this tier..." />
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Billing Interval</label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={planForm.billing_interval} onChange={(e) => setPlanForm({ ...planForm, billing_interval: e.target.value })}>
                                        <option value="hourly">Hourly</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Every</label>
                                    <Input type="number" min="1" value={planForm.interval_count} onChange={(e) => setPlanForm({ ...planForm, interval_count: e.target.value })} placeholder="1" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tier Rank</label>
                                    <Input type="number" min="1" value={planForm.tier} onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value })} placeholder="1" />
                                </div>
                            </div>

                            {planForm.billing_interval === 'weekly' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Weekly Days</label>
                                    <div className="flex flex-wrap gap-2">
                                        {weekDays.map((day) => {
                                            const selected = planForm.weekly_days.includes(day);
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => {
                                                        setPlanForm((current) => ({
                                                            ...current,
                                                            weekly_days: selected
                                                                ? current.weekly_days.filter((entry) => entry !== day)
                                                                : [...current.weekly_days, day],
                                                        }));
                                                    }}
                                                    className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${selected ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-border text-muted-foreground'}`}
                                                >
                                                    {day.slice(0, 3)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {planForm.billing_interval === 'monthly' && (
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Billing Day</label>
                                        <Input type="number" min="1" max="28" value={planForm.monthly_day} onChange={(e) => setPlanForm({ ...planForm, monthly_day: e.target.value })} placeholder="1" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Trial Days</label>
                                        <Input type="number" min="0" max="60" value={planForm.trial_days} onChange={(e) => setPlanForm({ ...planForm, trial_days: e.target.value })} placeholder="0" />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Included Access</p>
                                    <p className="text-xs text-muted-foreground mt-1">Subscriptions unlock content items and digital/course bundles. Physical products stay outside subscriptions.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Search Items</label>
                                    <Input
                                        value={planItemSearch}
                                        onChange={(e) => setPlanItemSearch(e.target.value)}
                                        placeholder="Search content or course bundles..."
                                    />
                                </div>
                                <div className="grid gap-2">
                                    {planVisibleItems.map((option) => {
                                        const selectedItem = planForm.items.find((item) => item.item_type === option.item_type && item.item_id === option.item_id);
                                        const selected = Boolean(selectedItem);
                                        return (
                                            <div key={option.key} className={`rounded-2xl border px-4 py-3 ${selected ? 'border-emerald-300 bg-emerald-50/60' : 'border-border bg-background'}`}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <button type="button" onClick={() => togglePlanItem(option)} className="text-left flex-1">
                                                        <p className="text-sm font-bold">{option.label}</p>
                                                        <p className="text-xs text-muted-foreground">{option.item_type} · {option.meta}</p>
                                                    </button>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${selected ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                                                        {selected ? 'Included' : 'Add'}
                                                    </span>
                                                </div>
                                                {selected && (
                                                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2 border border-emerald-100">
                                                        <Clock3 className="h-4 w-4 text-emerald-600" />
                                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unlock after days</span>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="h-9 max-w-[120px]"
                                                            value={selectedItem.unlock_after_days}
                                                            onChange={(e) => updatePlanItemDelay(option.item_type, option.item_id, e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {planVisibleItems.length === 0 && (
                                        <p className="text-xs text-muted-foreground rounded-xl border border-dashed border-border px-3 py-2">
                                            No items found for your search.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-end gap-3">
                                <div className="w-full sm:w-[220px] space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={planForm.status} onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}>
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" onClick={savePlan} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {planForm.id ? 'Update Tier' : 'Save Tier'}
                                </Button>
                                <Button variant="outline" className="rounded-xl" onClick={resetForm}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Tier
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[24px]">
                        <CardHeader>
                            <CardTitle className="text-lg font-black">Subscription Ladder</CardTitle>
                            <CardDescription>Your membership and recurring access offers.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {plans.length === 0 ? (
                                <EmptyState icon={Crown} title="Hakuna tiers bado" body="Create your first subscription level for recurring revenue." />
                            ) : plans.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-border/70 bg-background px-4 py-4 flex items-start gap-3">
                                    <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                                        <Crown className="h-5 w-5 text-brand-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-foreground">{item.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{item.status} · {item.billing_interval} every {item.interval_count}</p>
                                        <p className="text-xs font-bold uppercase tracking-widest text-brand-700 mt-2">TZS {Number(item.price || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => startEditPlan(item)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-red-600 hover:text-red-700" onClick={() => destroyPlan(item.id)}>
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
