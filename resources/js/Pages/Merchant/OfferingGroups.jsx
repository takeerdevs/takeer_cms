import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { ArrowDown, ArrowUp, Box, CalendarDays, ClipboardList, Copy, ExternalLink, Image as ImageIcon, Layers, Loader2, Plus, Save, Search, Trash2, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent } from '@/Components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import AutoPostTargetsPanel, { defaultAutoPostTargets } from '@/Components/Merchant/AutoPostTargetsPanel';

const templateIcon = {
    menu_board: Utensils,
    service_package: Layers,
    itinerary: CalendarDays,
};

const labelFromKey = (value) => String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function OfferingGroups({ merchantUsername }) {
    const { auth } = usePage().props;
    const currentMerchant = auth?.user?.merchant_profiles?.find(m => m.username === merchantUsername)
        || auth?.user?.merchant_profiles?.[0] || {};
    const [merchantLocations, setMerchantLocations] = useState(currentMerchant?.locations || []);
    const servingLocations = merchantLocations.filter((loc) => String(loc.type || 'SHOP').toUpperCase() === 'SHOP' || !loc.type);
    const [groups, setGroups] = useState([]);
    const [templates, setTemplates] = useState({});
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [catalog, setCatalog] = useState([]);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [builderSaving, setBuilderSaving] = useState(false);
    const [form, setForm] = useState({
        title: '',
        template_key: 'service_package',
        description: '',
        publish_targets: defaultAutoPostTargets,
    });

    const publicOfferingUrl = (group) => `/offerings/${group.id}`;

    const copyPublicLink = async (group) => {
        const url = `${window.location.origin}${publicOfferingUrl(group)}`;
        try {
            await navigator.clipboard.writeText(url);
            toast.success('Public link copied.');
        } catch (error) {
            toast.error('Could not copy the public link.');
        }
    };

    const loadGroups = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/merchant/offering-groups');
            setTemplates(response.data?.templates || {});
            setGroups(response.data?.groups?.data || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load offering groups.');
        } finally {
            setLoading(false);
        }
    };

    const loadMerchantLocations = async () => {
        try {
            const response = await axios.get('/api/merchant/locations');
            setMerchantLocations(response.data?.data || []);
        } catch (error) {
            setMerchantLocations(currentMerchant?.locations || []);
        }
    };

    useEffect(() => {
        loadGroups();
        loadMerchantLocations();
    }, []);

    const groupedItems = useMemo(() => {
        const items = selectedGroup?.items || [];
        return items.reduce((acc, item) => {
            const section = item.section?.trim() || 'Main';
            acc[section] ||= [];
            acc[section].push(item);
            return acc;
        }, {});
    }, [selectedGroup?.items]);

    const layoutOptionsFor = (group) => {
        const template = templates[group?.template_key] || {};
        return template.layouts?.length ? template.layouts : ['package'];
    };

    const selectedLayoutFor = (group) => {
        const options = layoutOptionsFor(group);
        return group?.display_settings?.layout || options[0] || 'package';
    };

    const sectionRuleFor = (section) => selectedGroup?.checkout_rules?.section_rules?.[section] || {};

    const availabilityLocationIds = Array.isArray(selectedGroup?.availability_location_ids)
        ? selectedGroup.availability_location_ids.map(String)
        : [];

    const setAvailabilityLocationIds = (ids) => {
        updateSelectedGroup({ availability_location_ids: ids.map(String) });
    };

    const toggleAvailabilityLocation = (locationId) => {
        const id = String(locationId);
        setAvailabilityLocationIds(
            availabilityLocationIds.includes(id)
                ? availabilityLocationIds.filter((value) => value !== id)
                : [...availabilityLocationIds, id]
        );
    };

    const loadCatalog = async (groupId = selectedGroup?.id, search = catalogSearch) => {
        if (!groupId) return;
        setCatalogLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('exclude_group_id', groupId);
            if (search.trim()) params.set('search', search.trim());
            const response = await axios.get(`/api/merchant/offering-groups/catalog?${params.toString()}`);
            setCatalog(response.data?.items || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load catalog.');
        } finally {
            setCatalogLoading(false);
        }
    };

    const openBuilder = async (group) => {
        setSelectedGroup(group);
        try {
            const response = await axios.get(`/api/merchant/offering-groups/${group.id}`);
            const loaded = response.data?.group;
            setSelectedGroup(loaded);
            await loadCatalog(loaded.id, catalogSearch);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to open group.');
        }
    };

    const createGroup = async (event) => {
        event.preventDefault();
        if (!form.title.trim()) {
            toast.error('Add a group name first.');
            return;
        }

        setSaving(true);
        try {
            const template = templates[form.template_key] || {};
            await axios.post('/api/merchant/offering-groups', {
                ...form,
                group_type: template.group_type || 'package',
                display_settings: {
                    layout: template.layouts?.[0] || null,
                },
                publish_targets: form.publish_targets,
            });
            toast.success('Offering group created.');
            setCreateOpen(false);
            setForm({ title: '', template_key: 'service_package', description: '', publish_targets: defaultAutoPostTargets });
            await loadGroups();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create offering group.');
        } finally {
            setSaving(false);
        }
    };

    const updateSelectedGroup = (patch) => {
        setSelectedGroup((current) => current ? { ...current, ...patch } : current);
    };

    const updateItem = (index, patch) => {
        setSelectedGroup((current) => {
            if (!current) return current;
            const items = [...(current.items || [])];
            items[index] = { ...items[index], ...patch };
            return { ...current, items };
        });
    };

    const itemAddOns = (item) => Array.isArray(item.metadata?.add_ons) ? item.metadata.add_ons : [];

    const updateItemAddOns = (index, addOns) => {
        updateItem(index, {
            metadata: {
                ...(selectedGroup?.items?.[index]?.metadata || {}),
                add_ons: addOns,
            },
        });
    };

    const addItemAddOn = (index) => {
        const item = selectedGroup?.items?.[index];
        updateItemAddOns(index, [...itemAddOns(item), { name: '', price: '' }]);
    };

    const updateItemAddOn = (itemIndex, addOnIndex, patch) => {
        const item = selectedGroup?.items?.[itemIndex];
        updateItemAddOns(itemIndex, itemAddOns(item).map((row, index) => (
            index === addOnIndex ? { ...row, ...patch } : row
        )));
    };

    const removeItemAddOn = (itemIndex, addOnIndex) => {
        const item = selectedGroup?.items?.[itemIndex];
        updateItemAddOns(itemIndex, itemAddOns(item).filter((_, index) => index !== addOnIndex));
    };

    const moveItem = (index, direction) => {
        setSelectedGroup((current) => {
            if (!current) return current;
            const items = [...(current.items || [])];
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= items.length) return current;
            [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
            return { ...current, items };
        });
    };

    const updateSectionRule = (section, patch) => {
        setSelectedGroup((current) => {
            if (!current) return current;
            return {
                ...current,
                checkout_rules: {
                    ...(current.checkout_rules || {}),
                    section_rules: {
                        ...(current.checkout_rules?.section_rules || {}),
                        [section]: {
                            ...(current.checkout_rules?.section_rules?.[section] || {}),
                            ...patch,
                        },
                    },
                },
            };
        });
    };

    const addCatalogItem = (catalogItem) => {
        setSelectedGroup((current) => {
            if (!current) return current;
            const exists = (current.items || []).some((item) => item.item_type === catalogItem.item_type && Number(item.item_id) === Number(catalogItem.item_id));
            if (exists) {
                toast.info('That item is already in this group.');
                return current;
            }
            return {
                ...current,
                items: [
                    ...(current.items || []),
                    {
                        item_type: catalogItem.item_type,
                        item_id: catalogItem.item_id,
                        title: catalogItem.title,
                        kind: catalogItem.kind,
                        price: catalogItem.price,
                        image_url: catalogItem.image_url,
                        add_ons: catalogItem.add_ons || [],
                        section: current.template_key === 'menu_board' ? 'Main Menu' : 'Main',
                        sort_order: current.items?.length || 0,
                        role: current.template_key === 'menu_board' ? 'optional' : 'included',
                        pricing_behavior: current.template_key === 'menu_board' ? 'separate' : 'included',
                        quantity_min: 1,
                        quantity_max: null,
                        is_required: false,
                        is_default_selected: current.template_key !== 'menu_board',
                        is_orderable_alone: true,
                        is_orderable_in_group: true,
                        metadata: { add_ons: [] },
                    },
                ],
            };
        });
    };

    const removeItem = (index) => {
        setSelectedGroup((current) => {
            if (!current) return current;
            return { ...current, items: (current.items || []).filter((_, itemIndex) => itemIndex !== index) };
        });
    };

    const saveBuilder = async () => {
        if (!selectedGroup) return;
        setBuilderSaving(true);
        try {
            const payload = {
                title: selectedGroup.title,
                description: selectedGroup.description || '',
                status: selectedGroup.status || 'draft',
                group_type: selectedGroup.group_type || 'package',
                template_key: selectedGroup.template_key || 'service_package',
                pricing_mode: selectedGroup.pricing_mode || 'sum_children',
                base_price: selectedGroup.base_price ?? null,
                checkout_mode: selectedGroup.checkout_mode || 'select_items',
                availability_mode: selectedGroup.availability_mode || 'inherit_children',
                availability_location_ids: availabilityLocationIds.map((id) => Number(id)).filter(Boolean),
                checkout_rules: selectedGroup.checkout_rules || null,
                display_settings: {
                    ...(selectedGroup.display_settings || {}),
                    layout: selectedLayoutFor(selectedGroup),
                },
                items: (selectedGroup.items || []).map((item, index) => ({
                    item_type: item.item_type,
                    item_id: item.item_id,
                    section: item.section || null,
                    sort_order: index,
                    role: item.role || 'optional',
                    pricing_behavior: item.pricing_behavior || 'separate',
                    price_override: item.pricing_behavior === 'override' ? Number(item.price_override || 0) : null,
                    quantity_min: item.quantity_min || null,
                    quantity_max: item.quantity_max || null,
                    is_required: Boolean(item.is_required),
                    is_default_selected: Boolean(item.is_default_selected),
                    is_orderable_alone: item.is_orderable_alone !== false,
                    is_orderable_in_group: item.is_orderable_in_group !== false,
                    choice_rules: item.choice_rules || null,
                    metadata: item.metadata || null,
                })),
                publish_targets: selectedGroup.publish_targets || defaultAutoPostTargets,
            };
            const response = await axios.put(`/api/merchant/offering-groups/${selectedGroup.id}`, payload);
            setSelectedGroup(response.data?.group || selectedGroup);
            toast.success('Offering group saved.');
            await loadGroups();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save offering group.');
        } finally {
            setBuilderSaving(false);
        }
    };

    return (
        <AppLayout>
            <Head title="Offering Groups | Takeer" />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wider text-brand-600">Commerce builder</p>
                        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Offering Groups</h1>
                        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                            Build menus, packages, itineraries, and nested offerings from products, services, and other groups.
                        </p>
                    </div>
                    <Button type="button" className="h-12 rounded-2xl px-5 font-black" onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-5 w-5" /> New Group
                    </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    {Object.entries(templates).map(([key, template]) => {
                        const Icon = templateIcon[key] || Box;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => {
                                    setForm((current) => ({ ...current, template_key: key }));
                                    setCreateOpen(true);
                                }}
                                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-950">{template.label}</p>
                                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{template.description}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
                    <Card className="overflow-hidden rounded-2xl border-slate-200">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 p-12 text-sm font-bold text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading groups...
                                </div>
                            ) : groups.length === 0 ? (
                                <div className="p-12 text-center">
                                    <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
                                    <p className="mt-3 text-sm font-black text-slate-900">No offering groups yet.</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">Start with a menu board, service package, or itinerary.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {groups.map((group) => {
                                        const template = templates[group.template_key] || {};
                                        const Icon = templateIcon[group.template_key] || Box;
                                        const layout = group.display_settings?.layout;
                                        return (
                                            <div key={group.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                                                        <Icon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-950">{group.title}</p>
                                                        <p className="mt-1 text-xs font-semibold text-slate-500">
                                                            {template.label || group.template_key} · {layout ? `${labelFromKey(layout)} · ` : ''}{group.items_count || 0} item{Number(group.items_count || 0) === 1 ? '' : 's'} · {group.status}
                                                        </p>
                                                        {group.description && (
                                                            <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    <span className="w-max rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                                        {group.checkout_mode?.replace(/_/g, ' ') || 'select items'}
                                                    </span>
                                                    {group.status === 'published' && (
                                                        <>
                                                            <a
                                                                href={publicOfferingUrl(group)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-brand-200 hover:text-brand-700"
                                                            >
                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                Public
                                                            </a>
                                                            <Button type="button" variant="outline" size="icon" className="rounded-xl h-10 w-10" onClick={() => copyPublicLink(group)}>
                                                                <Copy className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => openBuilder(group)}>Edit</Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="overflow-hidden rounded-2xl border-slate-200">
                        <CardContent className="p-0">
                            {!selectedGroup ? (
                                <div className="p-10 text-center">
                                    <Layers className="mx-auto h-10 w-10 text-slate-300" />
                                    <p className="mt-3 text-sm font-black text-slate-900">Select a group to build it.</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">Add menu items, services, products, or another group.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    <div className="space-y-3 p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-wider text-brand-600">Builder</p>
                                                <h2 className="text-xl font-black text-slate-950">{selectedGroup.title}</h2>
                                            </div>
                                            <Button type="button" className="rounded-xl" onClick={saveBuilder} disabled={builderSaving}>
                                                {builderSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                Save
                                            </Button>
                                        </div>
                                        {selectedGroup.status === 'published' && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <a
                                                    href={publicOfferingUrl(selectedGroup)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-3 text-xs font-black text-brand-700 hover:bg-brand-100"
                                                >
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    View public offering
                                                </a>
                                                <Button type="button" variant="outline" className="h-9 rounded-xl text-xs" onClick={() => copyPublicLink(selectedGroup)}>
                                                    <Copy className="mr-2 h-4 w-4" />
                                                    Copy link
                                                </Button>
                                            </div>
                                        )}
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="space-y-1.5 block">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Name</span>
                                                <Input value={selectedGroup.title || ''} onChange={(event) => updateSelectedGroup({ title: event.target.value })} />
                                            </label>
                                            <label className="space-y-1.5 block">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Status</span>
                                                <select className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold" value={selectedGroup.status || 'draft'} onChange={(event) => updateSelectedGroup({ status: event.target.value })}>
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                    <option value="archived">Archived</option>
                                                </select>
                                            </label>
                                            <label className="space-y-1.5 block">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Pricing</span>
                                                <select className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold" value={selectedGroup.pricing_mode || 'sum_children'} onChange={(event) => updateSelectedGroup({ pricing_mode: event.target.value })}>
                                                    <option value="sum_children">Sum selected items</option>
                                                    <option value="fixed">Fixed group price</option>
                                                    <option value="fixed_or_sum">Fixed or selected total</option>
                                                    <option value="quote_only">Quote only</option>
                                                    <option value="free">Free</option>
                                                </select>
                                            </label>
                                            <label className="space-y-1.5 block">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Checkout</span>
                                                <select className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold" value={selectedGroup.checkout_mode || 'select_items'} onChange={(event) => updateSelectedGroup({ checkout_mode: event.target.value })}>
                                                    <option value="select_items">Customer selects items</option>
                                                    <option value="buy_group">Buy whole group</option>
                                                    <option value="book_group">Book group</option>
                                                    <option value="request_quote">Request quote</option>
                                                    <option value="visible_only">Visible only</option>
                                                </select>
                                            </label>
                                            <label className="space-y-1.5 block">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Display layout</span>
                                                <select
                                                    className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                                    value={selectedLayoutFor(selectedGroup)}
                                                    onChange={(event) => updateSelectedGroup({
                                                        display_settings: {
                                                            ...(selectedGroup.display_settings || {}),
                                                            layout: event.target.value,
                                                        },
                                                    })}
                                                >
                                                    {layoutOptionsFor(selectedGroup).map((layout) => (
                                                        <option key={layout} value={layout}>{labelFromKey(layout)}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Inapatikana kwenye shop gani?</p>
                                                <p className="mt-1 text-xs font-semibold text-slate-500">Empty selection means this offering group is available at all active shop locations.</p>
                                            </div>
                                            {servingLocations.length === 0 ? (
                                                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                                    Add shop locations in Settings when this group should be served by specific branches.
                                                </p>
                                            ) : (
                                                <>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        <button
                                                            type="button"
                                                            className={`rounded-xl border px-3 py-2 text-left text-xs font-black ${availabilityLocationIds.length === 0 ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                                            onClick={() => setAvailabilityLocationIds([])}
                                                        >
                                                            All active shop locations
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`rounded-xl border px-3 py-2 text-left text-xs font-black ${availabilityLocationIds.length > 0 ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                                            onClick={() => setAvailabilityLocationIds([String(servingLocations[0].id)])}
                                                        >
                                                            Selected locations only
                                                        </button>
                                                    </div>
                                                    {availabilityLocationIds.length > 0 && (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {servingLocations.map((loc) => (
                                                                <label key={loc.id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="mt-1"
                                                                        checked={availabilityLocationIds.includes(String(loc.id))}
                                                                        onChange={() => toggleAvailabilityLocation(loc.id)}
                                                                    />
                                                                    <span>
                                                                        <span className="block">{loc.name}</span>
                                                                        <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{loc.address}</span>
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {['fixed', 'fixed_or_sum'].includes(selectedGroup.pricing_mode) && (
                                            <label className="space-y-1.5 block">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Base price</span>
                                                <Input type="number" min="0" value={selectedGroup.base_price ?? ''} onChange={(event) => updateSelectedGroup({ base_price: event.target.value })} />
                                            </label>
                                        )}
                                        <AutoPostTargetsPanel
                                            value={selectedGroup.publish_targets || defaultAutoPostTargets}
                                            onChange={(publishTargets) => updateSelectedGroup({ publish_targets: publishTargets })}
                                        />
                                    </div>

                                    <div className="space-y-3 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-black text-slate-950">Items</p>
                                            <span className="text-xs font-bold text-slate-500">{selectedGroup.items?.length || 0} total</span>
                                        </div>
                                        {Object.keys(groupedItems).length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-500">
                                                No items in this group yet.
                                            </div>
                                        ) : Object.entries(groupedItems).map(([section, items]) => (
                                            <div key={section} className="space-y-2">
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Section</p>
                                                            <p className="text-sm font-black text-slate-950">{section}</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 sm:w-72">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={sectionRuleFor(section).min_selected ?? ''}
                                                                onChange={(event) => updateSectionRule(section, { min_selected: event.target.value === '' ? null : Number(event.target.value) })}
                                                                placeholder="Min choices"
                                                            />
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={sectionRuleFor(section).max_selected ?? ''}
                                                                onChange={(event) => updateSectionRule(section, { max_selected: event.target.value === '' ? null : Number(event.target.value) })}
                                                                placeholder="Max choices"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                {items.map((item) => {
                                                    const index = selectedGroup.items.findIndex((candidate) => candidate === item);
                                                    return (
                                                        <div key={`${item.item_type}-${item.item_id}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                                            <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 items-start gap-3">
                                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                                                                {item.image_url ? (
                                                                    <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <ImageIcon className="h-5 w-5" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-black text-slate-950">{item.title || 'Untitled item'}</p>
                                                                <p className="mt-1 text-xs font-semibold text-slate-500">{item.item_type.replace('_', ' ')} · {item.kind || 'item'}</p>
                                                            </div>
                                                        </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                                                                        <ArrowUp className="h-4 w-4" />
                                                                    </button>
                                                                    <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveItem(index, 1)} disabled={index === (selectedGroup.items?.length || 0) - 1}>
                                                                        <ArrowDown className="h-4 w-4" />
                                                                    </button>
                                                                    <button type="button" className="rounded-lg p-2 text-red-500 hover:bg-red-50" onClick={() => removeItem(index)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                                <Input value={item.section || ''} onChange={(event) => updateItem(index, { section: event.target.value })} placeholder="Section, e.g. Lunch" />
                                                                <select className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-bold" value={item.role || 'optional'} onChange={(event) => updateItem(index, { role: event.target.value })}>
                                                                    <option value="included">Included</option>
                                                                    <option value="optional">Optional</option>
                                                                    <option value="add_on">Add-on</option>
                                                                    <option value="required_choice">Required choice</option>
                                                                    <option value="choose_one">Choose one</option>
                                                                    <option value="choose_many">Choose many</option>
                                                                    <option value="visible_only">Visible only</option>
                                                                </select>
                                                                <select className="h-10 rounded-xl border border-input bg-white px-3 text-sm font-bold" value={item.pricing_behavior || 'separate'} onChange={(event) => updateItem(index, { pricing_behavior: event.target.value })}>
                                                                    <option value="separate">Use item price</option>
                                                                    <option value="included">Included in group</option>
                                                                    <option value="override">Override price</option>
                                                                    <option value="quote_only">Quote only</option>
                                                                </select>
                                                                <Input type="number" min="0" value={item.price_override ?? ''} onChange={(event) => updateItem(index, { price_override: event.target.value })} placeholder="Override price" disabled={item.pricing_behavior !== 'override'} />
                                                                <Input type="number" min="0" value={item.quantity_min ?? ''} onChange={(event) => updateItem(index, { quantity_min: event.target.value })} placeholder="Min quantity" />
                                                                <Input type="number" min="0" value={item.quantity_max ?? ''} onChange={(event) => updateItem(index, { quantity_max: event.target.value })} placeholder="Max quantity" />
                                                            </div>
                                                            <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-3">
                                                                <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                                                    <input type="checkbox" checked={Boolean(item.is_required)} onChange={(event) => updateItem(index, { is_required: event.target.checked })} />
                                                                    Required
                                                                </label>
                                                                <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                                                    <input type="checkbox" checked={Boolean(item.is_default_selected)} onChange={(event) => updateItem(index, { is_default_selected: event.target.checked })} />
                                                                    Preselected
                                                                </label>
                                                                <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                                                    <input type="checkbox" checked={item.is_orderable_in_group !== false} onChange={(event) => updateItem(index, { is_orderable_in_group: event.target.checked })} />
                                                                    Orderable here
                                                                </label>
                                                            </div>
                                                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                                    <div>
                                                                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Add-ons</p>
                                                                        {Array.isArray(item.add_ons) && item.add_ons.length > 0 && (
                                                                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                                                                Inherited: {item.add_ons.map((row) => row.name).join(', ')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <Button type="button" variant="outline" className="h-9 rounded-xl text-xs" onClick={() => addItemAddOn(index)}>
                                                                        <Plus className="mr-2 h-4 w-4" />
                                                                        Add add-on
                                                                    </Button>
                                                                </div>
                                                                {itemAddOns(item).length > 0 && (
                                                                    <div className="mt-3 space-y-2">
                                                                        {itemAddOns(item).map((addOn, addOnIndex) => (
                                                                            <div key={addOnIndex} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_2.5rem]">
                                                                                <Input
                                                                                    value={addOn.name || ''}
                                                                                    onChange={(event) => updateItemAddOn(index, addOnIndex, { name: event.target.value })}
                                                                                    placeholder="Add-on name"
                                                                                />
                                                                                <Input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={addOn.price ?? ''}
                                                                                    onChange={(event) => updateItemAddOn(index, addOnIndex, { price: event.target.value })}
                                                                                    placeholder="Price"
                                                                                />
                                                                                <Button type="button" variant="ghost" size="icon" className="rounded-xl text-red-500" onClick={() => removeItemAddOn(index, addOnIndex)}>
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-3 p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <Input className="pl-9" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Search products or groups..." />
                                            </div>
                                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => loadCatalog(selectedGroup.id, catalogSearch)} disabled={catalogLoading}>
                                                {catalogLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                                            </Button>
                                        </div>
                                        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                                            {catalog.map((item) => (
                                                <button key={`${item.item_type}-${item.item_id}`} type="button" onClick={() => addCatalogItem(item)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-200 hover:bg-brand-50/40">
                                                    <span className="flex min-w-0 items-center gap-3">
                                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                                                            {item.image_url ? (
                                                                <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                                                            ) : (
                                                                <ImageIcon className="h-5 w-5" />
                                                            )}
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block truncate text-sm font-black text-slate-950">{item.title}</span>
                                                            <span className="mt-0.5 block text-xs font-semibold text-slate-500">{item.item_type.replace('_', ' ')} · {item.kind}</span>
                                                        </span>
                                                    </span>
                                                    <Plus className="h-4 w-4 shrink-0 text-brand-600" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-xl rounded-2xl">
                    <form onSubmit={createGroup}>
                        <DialogHeader>
                            <DialogTitle>Create offering group</DialogTitle>
                            <DialogDescription>
                                Choose the merchant-facing template now. Items and nested groups will be added from the builder.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                            <label className="space-y-1.5 block">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Template</span>
                                <select
                                    className="h-12 w-full rounded-xl border border-input bg-white px-3 text-sm font-bold"
                                    value={form.template_key}
                                    onChange={(event) => setForm((current) => ({ ...current, template_key: event.target.value }))}
                                >
                                    {Object.entries(templates).map(([key, template]) => (
                                        <option key={key} value={key}>{template.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1.5 block">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Name</span>
                                <Input className="h-12" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Lunch Menu, Bridal Package, 3 Day Safari..." />
                            </label>
                            <label className="space-y-1.5 block">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Description</span>
                                <Textarea className="min-h-24" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Short merchant-facing description..." />
                            </label>
                            <AutoPostTargetsPanel
                                value={form.publish_targets}
                                onChange={(publishTargets) => setForm((current) => ({ ...current, publish_targets: publishTargets }))}
                            />
                        </div>
                        <DialogFooter className="mt-5">
                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button type="submit" className="rounded-xl" disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Create
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
