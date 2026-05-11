import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Crown, Loader2, Plus, Save, Trash2, Pencil, Clock3, Users, PauseCircle, XCircle, CheckCircle2, MessageCircle, Send, ExternalLink } from 'lucide-react';
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
const initialCommunityForm = {
    title: '',
    excerpt: '',
    body: '',
    caption: '',
    comments_enabled_override: true,
    reactions_enabled_override: true,
};

function planCadenceLabel(plan) {
    const interval = plan.billing_interval || 'monthly';
    const count = Number(plan.interval_count || 1);
    const intervalLabels = {
        hourly: ['Hour', 'Hours'],
        daily: ['Day', 'Days'],
        weekly: ['Week', 'Weeks'],
        monthly: ['Month', 'Months'],
    };
    const [single, plural] = intervalLabels[interval] || [interval, `${interval}s`];

    if (count <= 1) {
        return single;
    }

    return `Every ${count} ${plural}`;
}

function planStatusClasses(status) {
    if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'draft') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
}

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
    const [selectedMembersPlan, setSelectedMembersPlan] = useState(null);
    const [members, setMembers] = useState([]);
    const [memberStats, setMemberStats] = useState(null);
    const [membersLoading, setMembersLoading] = useState(false);
    const [memberBusyId, setMemberBusyId] = useState(null);
    const [selectedCommunityPlan, setSelectedCommunityPlan] = useState(null);
    const [communityPosts, setCommunityPosts] = useState([]);
    const [communityLoading, setCommunityLoading] = useState(false);
    const [communitySaving, setCommunitySaving] = useState(false);
    const [communityDeletingId, setCommunityDeletingId] = useState(null);
    const [communityForm, setCommunityForm] = useState(initialCommunityForm);
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

    const digitalProductOptions = useMemo(() => (
        products
            .filter((product) => product.type === 'digital')
            .map((product) => ({
                key: `product-${product.id}`,
                item_type: 'product',
                item_id: product.id,
                label: product.title,
                meta: `${product.digital_delivery_type || product.delivery_mode || 'digital'} · TZS ${Number(product.price || 0).toLocaleString()}`,
            }))
    ), [products]);

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

    const planSelectableItems = useMemo(() => [...contentOptions, ...digitalProductOptions, ...bundleOptions], [contentOptions, digitalProductOptions, bundleOptions]);
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

    async function loadMembers(plan) {
        if (!plan) return;
        setSelectedMembersPlan(plan);
        setMembersLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/subscription-plans/${plan.id}/members/api`);
            setMembers(res.data?.members || []);
            setMemberStats(res.data?.stats || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kupakia members.');
        } finally {
            setMembersLoading(false);
        }
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

    async function updateMemberStatus(memberId, status) {
        if (!selectedMembersPlan) return;
        setMemberBusyId(`${memberId}:${status}`);
        try {
            await axios.patch(`/merchant/${merchantUsername}/subscription-plans/${selectedMembersPlan.id}/members/${memberId}/api`, { status });
            toast.success('Member access updated.');
            await loadMembers(selectedMembersPlan);
            await loadPage();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kusasisha member.');
        } finally {
            setMemberBusyId(null);
        }
    }

    async function loadCommunityPosts(plan) {
        if (!plan) return;
        setSelectedCommunityPlan(plan);
        setCommunityLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/subscription-plans/${plan.id}/community-posts/api`);
            setCommunityPosts(res.data?.posts || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kupakia member posts.');
        } finally {
            setCommunityLoading(false);
        }
    }

    async function publishCommunityPost() {
        if (!selectedCommunityPlan) return;
        setCommunitySaving(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/subscription-plans/${selectedCommunityPlan.id}/community-posts/api`, communityForm);
            setCommunityPosts((current) => [res.data?.post, ...current].filter(Boolean));
            setCommunityForm(initialCommunityForm);
            toast.success(res.data?.message || 'Member post published.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuchapisha member post.');
        } finally {
            setCommunitySaving(false);
        }
    }

    async function deleteCommunityPost(postId) {
        if (!selectedCommunityPlan || !postId || !window.confirm('Futa member post hii?')) return;
        setCommunityDeletingId(postId);
        try {
            await axios.delete(`/merchant/${merchantUsername}/subscription-plans/${selectedCommunityPlan.id}/community-posts/${postId}/api`);
            setCommunityPosts((current) => current.filter((post) => Number(post.id) !== Number(postId)));
            toast.success('Member post imefutwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kufuta member post.');
        } finally {
            setCommunityDeletingId(null);
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
                        <CardTitle className="text-lg font-black">Creator Club Summary</CardTitle>
                        <CardDescription>{commerceSummary?.date ? `Daily metrics for ${commerceSummary.date}` : 'Recurring membership access for creator clubs, paid communities, and subscriber-only drops.'}</CardDescription>
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
                                {planForm.id ? 'Edit Creator Club Tier' : 'Create Creator Club Tier'}
                            </CardTitle>
                            <CardDescription>Build recurring access plans for member-only posts, digital products, live events, downloads, and course bundles.</CardDescription>
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
                                    <p className="text-xs text-muted-foreground mt-1">Creator Club tiers unlock posts/articles, digital products, live events, and digital/course bundles. Physical products stay outside memberships.</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Search Items</label>
                                    <Input
                                        value={planItemSearch}
                                        onChange={(e) => setPlanItemSearch(e.target.value)}
                                        placeholder="Search content, digital products, or course bundles..."
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
                            <CardTitle className="text-lg font-black">Creator Club Ladder</CardTitle>
                            <CardDescription>Your membership and recurring access offers.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {plans.length === 0 ? (
                                <EmptyState icon={Crown} title="Hakuna tiers bado" body="Create your first subscription level for recurring revenue." />
                            ) : plans.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                                                <Crown className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="max-w-[220px] truncate text-sm font-black text-foreground sm:max-w-[280px]">{item.name}</p>
                                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black capitalize leading-none ${planStatusClasses(item.status)}`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                                                    <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-1">
                                                        <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                                                        {planCadenceLabel(item)}
                                                    </span>
                                                    <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-1">
                                                        <Users className="mr-1.5 h-3.5 w-3.5" />
                                                        {Number(item.active_members_count || 0).toLocaleString()} active
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                                            <div className="text-left sm:text-right">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Price</p>
                                                <p className="mt-1 whitespace-nowrap text-base font-black text-brand-700">TZS {Number(item.price || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-muted/30 p-1">
                                                <Button title="Member feed" aria-label="Member feed" variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => loadCommunityPosts(item)}>
                                                    <MessageCircle className="h-4 w-4" />
                                                </Button>
                                                <Button title="Members" aria-label="Members" variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => loadMembers(item)}>
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                                <Button title="Edit tier" aria-label="Edit tier" variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => startEditPlan(item)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button title="Delete tier" aria-label="Delete tier" variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-red-600 hover:text-red-700" onClick={() => destroyPlan(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {selectedCommunityPlan && (
                    <Card className="rounded-[24px] border-emerald-200/70">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-black">
                                <MessageCircle className="h-5 w-5 text-emerald-600" />
                                Member Feed: {selectedCommunityPlan.name}
                            </CardTitle>
                            <CardDescription>Publish subscriber-only updates, drops, discussions, and long-form notes directly into this membership.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                            <div className="rounded-2xl border border-border/70 bg-background p-4 space-y-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Title</label>
                                    <Input value={communityForm.title} onChange={(e) => setCommunityForm({ ...communityForm, title: e.target.value })} placeholder="Mf. Member update ya wiki hii" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Short preview</label>
                                    <Input value={communityForm.excerpt} onChange={(e) => setCommunityForm({ ...communityForm, excerpt: e.target.value })} placeholder="A quick summary members will see..." />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Post body</label>
                                    <Textarea rows={7} value={communityForm.body} onChange={(e) => setCommunityForm({ ...communityForm, body: e.target.value })} placeholder="Write the member-only post..." />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Feed caption</label>
                                    <Textarea rows={3} value={communityForm.caption} onChange={(e) => setCommunityForm({ ...communityForm, caption: e.target.value })} placeholder="Optional short caption for the feed..." />
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-bold">
                                        <input type="checkbox" checked={Boolean(communityForm.comments_enabled_override)} onChange={(e) => setCommunityForm({ ...communityForm, comments_enabled_override: e.target.checked })} />
                                        Comments
                                    </label>
                                    <label className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-bold">
                                        <input type="checkbox" checked={Boolean(communityForm.reactions_enabled_override)} onChange={(e) => setCommunityForm({ ...communityForm, reactions_enabled_override: e.target.checked })} />
                                        Reactions
                                    </label>
                                </div>
                                <Button className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={publishCommunityPost} disabled={communitySaving}>
                                    {communitySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Publish to members
                                </Button>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                        {communityPosts.length.toLocaleString()} member posts
                                    </p>
                                    {selectedCommunityPlan.slug && (
                                        <Link href={`/plan/${selectedCommunityPlan.slug}#community`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            View page
                                        </Link>
                                    )}
                                </div>
                                {communityLoading ? (
                                    <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading member posts...
                                    </div>
                                ) : communityPosts.length === 0 ? (
                                    <EmptyState icon={MessageCircle} title="No member posts yet" body="Publish the first update for this creator club tier." />
                                ) : (
                                    <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                                        {communityPosts.map((post) => (
                                            <div key={post.id} className="p-4 flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-black truncate">{post.title || post.caption || 'Member post'}</p>
                                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                                        {post.excerpt || post.body || post.caption || 'Subscriber-only update'}
                                                    </p>
                                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                                        {post.created_at ? new Date(post.created_at).toLocaleString() : ''} · {Number(post.comment_count || 0).toLocaleString()} comments
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Link href={`/p/${post.public_id || post.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent">
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Link>
                                                    <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 text-red-600 hover:text-red-700" onClick={() => deleteCommunityPost(post.id)} disabled={communityDeletingId === post.id}>
                                                        {communityDeletingId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {selectedMembersPlan && (
                    <Card className="rounded-[24px] border-brand-200/70">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg font-black">
                                <Users className="h-5 w-5 text-brand-600" />
                                Members: {selectedMembersPlan.name}
                            </CardTitle>
                            <CardDescription>Pause, cancel, or reactivate membership access. Access entitlements update with the member status.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Total', value: memberStats?.total ?? members.length },
                                    { label: 'Active', value: memberStats?.active ?? 0 },
                                    { label: 'Paused', value: memberStats?.paused ?? 0 },
                                    { label: 'Cancelled', value: memberStats?.cancelled ?? 0 },
                                ].map((stat) => (
                                    <div key={stat.label} className="rounded-2xl border border-border/70 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                                        <p className="mt-2 text-xl font-black">{Number(stat.value || 0).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>

                            {membersLoading ? (
                                <div className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading members...
                                </div>
                            ) : members.length === 0 ? (
                                <EmptyState icon={Users} title="No members yet" body="Members will appear here after customers subscribe to this tier." />
                            ) : (
                                <div className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                                    {members.map((member) => (
                                        <div key={member.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black truncate">{member.user?.name || 'Member'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {member.user?.phone_number || member.user?.email || 'No contact'} · <span className="font-bold capitalize">{member.status}</span>
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Period ends: {member.current_period_end ? new Date(member.current_period_end).toLocaleDateString() : 'Not set'}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button variant="outline" size="sm" className="rounded-xl text-emerald-700" onClick={() => updateMemberStatus(member.id, 'active')} disabled={!!memberBusyId}>
                                                    {memberBusyId === `${member.id}:active` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                    Active
                                                </Button>
                                                <Button variant="outline" size="sm" className="rounded-xl text-amber-700" onClick={() => updateMemberStatus(member.id, 'paused')} disabled={!!memberBusyId}>
                                                    {memberBusyId === `${member.id}:paused` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                                                    Pause
                                                </Button>
                                                <Button variant="outline" size="sm" className="rounded-xl text-red-700" onClick={() => updateMemberStatus(member.id, 'cancelled')} disabled={!!memberBusyId}>
                                                    {memberBusyId === `${member.id}:cancelled` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
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
