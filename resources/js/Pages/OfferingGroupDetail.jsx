import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Check,
    Clock,
    Layers,
    Minus,
    Plus,
    Route,
    ShoppingBag,
    Sparkles,
    Store,
    Utensils,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import CheckoutModal from '@/Components/CheckoutModal';
import { cn } from '@/lib/utils';

const templateMeta = {
    menu_board: {
        eyebrow: 'Menu',
        icon: Utensils,
        accent: 'text-orange-700',
        chip: 'bg-orange-50 text-orange-800 border-orange-100',
        button: 'bg-orange-600 hover:bg-orange-700',
    },
    itinerary: {
        eyebrow: 'Itinerary',
        icon: Route,
        accent: 'text-sky-700',
        chip: 'bg-sky-50 text-sky-800 border-sky-100',
        button: 'bg-sky-700 hover:bg-sky-800',
    },
    service_package: {
        eyebrow: 'Package',
        icon: Layers,
        accent: 'text-teal-700',
        chip: 'bg-teal-50 text-teal-800 border-teal-100',
        button: 'bg-teal-700 hover:bg-teal-800',
    },
};

const fallbackLayoutByTemplate = {
    menu_board: 'classic_menu',
    itinerary: 'timeline',
    service_package: 'package',
};

const layoutLabels = {
    classic_menu: 'Classic menu',
    photo_grid: 'Photo grid',
    price_board: 'Price board',
    room_service: 'Room service',
    package: 'Package',
    catalog_grid: 'Catalog grid',
    price_list: 'Price list',
    timeline: 'Timeline',
    trip_package: 'Trip package',
    schedule: 'Schedule',
};

const menuLikeLayouts = ['classic_menu', 'photo_grid', 'price_board', 'room_service'];
const gridLikeLayouts = ['classic_menu', 'photo_grid', 'room_service', 'catalog_grid'];
const listLikeLayouts = ['price_board', 'price_list'];
const itineraryLikeLayouts = ['timeline', 'trip_package', 'schedule'];

export default function OfferingGroupDetail({ offeringGroup }) {
    const meta = templateMeta[offeringGroup.template_key] || templateMeta.service_package;
    const HeroIcon = meta.icon;
    const displayLayout = offeringGroup.display_settings?.layout
        || fallbackLayoutByTemplate[offeringGroup.template_key]
        || 'package';
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('');
    const [selection, setSelection] = useState(() => (
        (offeringGroup.items || []).reduce((acc, item) => {
            const selected = Boolean(item.is_required || item.is_default_selected || ['included', 'required_choice'].includes(item.role));
            acc[item.id] = {
                group_item_id: item.id,
                selected,
                quantity: Number(item.quantity_min || 1),
            };
            return acc;
        }, {})
    ));

    const sections = useMemo(() => {
        const grouped = (offeringGroup.items || []).reduce((acc, item) => {
            const section = item.section || (itineraryLikeLayouts.includes(displayLayout) ? 'Day 1' : 'Main');
            acc[section] ||= [];
            acc[section].push(item);
            return acc;
        }, {});

        Object.keys(grouped).forEach((key) => {
            grouped[key].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
        });

        return grouped;
    }, [offeringGroup.items, displayLayout]);

    const sectionNames = Object.keys(sections);
    const shouldShowSectionTabs = menuLikeLayouts.includes(displayLayout);
    const visibleSections = shouldShowSectionTabs && activeSection
        ? { [activeSection]: sections[activeSection] || [] }
        : sections;

    const itemPrice = (item) => {
        if (['included', 'quote_only'].includes(item.pricing_behavior)) return 0;
        if (item.pricing_behavior === 'override') return Number(item.price_override || 0);
        return Number(item.price || 0);
    };

    const addOnsForRow = (row, item) => {
        const selectedNames = new Set((row?.add_ons || []).map((addOn) => String(addOn.name || '').toLowerCase()));
        return (item?.add_ons || []).filter((addOn) => selectedNames.has(String(addOn.name || '').toLowerCase()));
    };

    const selectedItems = Object.values(selection).filter((row) => row.selected);
    const selectionIssues = useMemo(() => {
        const sectionRules = offeringGroup.checkout_rules?.section_rules || {};
        return Object.entries(sectionRules).reduce((issues, [section, rule]) => {
            const selectedCount = selectedItems.filter((row) => {
                const item = offeringGroup.items.find((candidate) => Number(candidate.id) === Number(row.group_item_id));
                return (item?.section || 'Main') === section;
            }).length;
            const min = Number(rule?.min_selected || 0);
            const max = Number(rule?.max_selected || 0);

            if (min > 0 && selectedCount < min) {
                issues.push(`Select at least ${min} item${min === 1 ? '' : 's'} from ${section}.`);
            }

            if (max > 0 && selectedCount > max) {
                issues.push(`Select no more than ${max} item${max === 1 ? '' : 's'} from ${section}.`);
            }

            return issues;
        }, []);
    }, [offeringGroup.checkout_rules, offeringGroup.items, selectedItems]);
    const selectedTotal = useMemo(() => {
        const childrenTotal = selectedItems.reduce((sum, row) => {
            const item = offeringGroup.items.find((candidate) => Number(candidate.id) === Number(row.group_item_id));
            if (!item) return sum;
            const addOnsTotal = addOnsForRow(row, item).reduce((addOnSum, addOn) => addOnSum + Number(addOn.price || 0), 0);
            return sum + ((itemPrice(item) + addOnsTotal) * Number(row.quantity || 1));
        }, 0);
        const base = Number(offeringGroup.base_price || 0);
        if (offeringGroup.pricing_mode === 'fixed') return base;
        if (offeringGroup.pricing_mode === 'fixed_or_sum') return Math.max(base, childrenTotal);
        if (['free', 'quote_only'].includes(offeringGroup.pricing_mode)) return 0;
        return childrenTotal;
    }, [selectedItems, offeringGroup.items, offeringGroup.pricing_mode, offeringGroup.base_price]);

    const checkoutItem = {
        ...offeringGroup,
        title: offeringGroup.title,
        purchasable_type: 'offering_group',
        checkoutType: 'offering_group',
        type: 'offering_group',
        checkout_price: selectedTotal,
        price: selectedTotal,
        selected_offering_group_items: selectedItems,
        has_physical_items: offeringGroup.has_physical_items,
        requires_inquiry: offeringGroup.requires_inquiry || offeringGroup.checkout_mode === 'request_quote',
        merchant: offeringGroup.merchant,
    };

    const toggleItem = (item) => {
        if (item.is_required || item.role === 'included') return;
        setSelection((current) => ({
            ...current,
            [item.id]: {
                ...(current[item.id] || { group_item_id: item.id, quantity: Number(item.quantity_min || 1) }),
                selected: !current[item.id]?.selected,
            },
        }));
    };

    const adjustQuantity = (item, direction) => {
        setSelection((current) => {
            const row = current[item.id] || { group_item_id: item.id, selected: true, quantity: Number(item.quantity_min || 1) };
            const min = Number(item.quantity_min || 1);
            const max = item.quantity_max ? Number(item.quantity_max) : 99;
            return {
                ...current,
                [item.id]: {
                    ...row,
                    selected: true,
                    quantity: Math.min(max, Math.max(min, Number(row.quantity || min) + direction)),
                },
            };
        });
    };

    const toggleAddOn = (item, addOn) => {
        setSelection((current) => {
            const row = current[item.id] || { group_item_id: item.id, selected: true, quantity: Number(item.quantity_min || 1), add_ons: [] };
            const addOns = Array.isArray(row.add_ons) ? row.add_ons : [];
            const exists = addOns.some((candidate) => String(candidate.name || '').toLowerCase() === String(addOn.name || '').toLowerCase());

            return {
                ...current,
                [item.id]: {
                    ...row,
                    selected: true,
                    add_ons: exists
                        ? addOns.filter((candidate) => String(candidate.name || '').toLowerCase() !== String(addOn.name || '').toLowerCase())
                        : [...addOns, { name: addOn.name }],
                },
            };
        });
    };

    const renderSections = () => {
        if (itineraryLikeLayouts.includes(displayLayout)) {
            return <ItineraryLayout sections={visibleSections} selection={selection} itemPrice={itemPrice} toggleItem={toggleItem} adjustQuantity={adjustQuantity} toggleAddOn={toggleAddOn} />;
        }

        if (listLikeLayouts.includes(displayLayout)) {
            return <PriceListLayout sections={visibleSections} selection={selection} itemPrice={itemPrice} toggleItem={toggleItem} adjustQuantity={adjustQuantity} />;
        }

        if (gridLikeLayouts.includes(displayLayout)) {
            return <MenuLayout sections={visibleSections} selection={selection} itemPrice={itemPrice} toggleItem={toggleItem} adjustQuantity={adjustQuantity} toggleAddOn={toggleAddOn} />;
        }

        return <PackageLayout sections={visibleSections} selection={selection} itemPrice={itemPrice} toggleItem={toggleItem} adjustQuantity={adjustQuantity} toggleAddOn={toggleAddOn} />;
    };

    return (
        <AppLayout>
            <Head title={`${offeringGroup.title} | Takeer`} />
            <div className="min-h-screen bg-slate-50 pb-28">
                <div className="relative overflow-hidden bg-slate-950 text-white">
                    {offeringGroup.cover_image_url && (
                        <img src={offeringGroup.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/72 to-slate-950/35" />
                    <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-10">
                        <Link href="/feed" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
                            <div className="max-w-3xl">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wider">
                                        <HeroIcon className="h-3.5 w-3.5" /> {meta.eyebrow}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wider">
                                        <Store className="h-3.5 w-3.5" /> {offeringGroup.merchant?.display_name || 'Merchant'}
                                    </span>
                                </div>
                                <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{offeringGroup.title}</h1>
                                {offeringGroup.description && (
                                    <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/80">{offeringGroup.description}</p>
                                )}
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                                <p className="text-xs font-black uppercase tracking-widest text-white/60">Starts from</p>
                                <p className="mt-1 text-3xl font-black">TZS {Number(offeringGroup.checkout_price || selectedTotal || 0).toLocaleString()}</p>
                                <p className="mt-2 text-xs font-bold text-white/65">{layoutLabels[displayLayout] || 'Custom layout'} · {sectionNames.length} section{sectionNames.length === 1 ? '' : 's'} · {offeringGroup.items?.length || 0} item{Number(offeringGroup.items?.length || 0) === 1 ? '' : 's'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {shouldShowSectionTabs && sectionNames.length > 1 && (
                    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
                        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
                            <button
                                type="button"
                                onClick={() => setActiveSection('')}
                                className={cn('shrink-0 rounded-full px-4 py-2 text-xs font-black', !activeSection ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600')}
                            >
                                All
                            </button>
                            {sectionNames.map((section) => (
                                <button
                                    key={section}
                                    type="button"
                                    onClick={() => setActiveSection(section)}
                                    className={cn('shrink-0 rounded-full px-4 py-2 text-xs font-black', activeSection === section ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600')}
                                >
                                    {section}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div>{renderSections()}</div>
                    <SelectionSummary
                        offeringGroup={offeringGroup}
                        selectedItems={selectedItems}
                        selectedTotal={selectedTotal}
                        itemPrice={itemPrice}
                        addOnsForRow={addOnsForRow}
                        meta={meta}
                        selectionIssues={selectionIssues}
                        onCheckout={() => setCheckoutOpen(true)}
                    />
                </div>
            </div>

            <CheckoutModal product={checkoutItem} isOpen={checkoutOpen} onOpenChange={setCheckoutOpen} />
        </AppLayout>
    );
}

function MenuLayout({ sections, selection, itemPrice, toggleItem, adjustQuantity, toggleAddOn }) {
    return (
        <div className="space-y-8">
            {Object.entries(sections).map(([section, items]) => (
                <section key={section} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-black tracking-tight text-slate-950">{section}</h2>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">{items.length} item{items.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {items.map((item) => (
                            <SelectableItemCard
                                key={item.id}
                                item={item}
                                selection={selection}
                                itemPrice={itemPrice}
                                toggleItem={toggleItem}
                                adjustQuantity={adjustQuantity}
                                toggleAddOn={toggleAddOn}
                                variant="menu"
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function PriceListLayout({ sections, selection, itemPrice, toggleItem, adjustQuantity }) {
    return (
        <div className="space-y-6">
            {Object.entries(sections).map(([section, items]) => (
                <section key={section} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <h2 className="text-lg font-black tracking-tight text-slate-950">{section}</h2>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">{items.length} item{items.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {items.map((item) => {
                            const row = selection[item.id] || {};
                            const selected = Boolean(row.selected);
                            const locked = item.is_required || item.role === 'included';
                            const price = itemPrice(item);

                            return (
                                <div key={item.id} className={cn('grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', selected && 'bg-brand-50/40')}>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-black text-slate-950">{item.title}</h3>
                                            {locked && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                                    <Check className="h-3 w-3" /> Included
                                                </span>
                                            )}
                                            {item.item_type === 'offering_group' && (
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600">Nested group</span>
                                            )}
                                        </div>
                                        {item.description && <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">{item.description}</p>}
                                    </div>
                                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                                        <p className="shrink-0 text-base font-black text-brand-700">
                                            {item.pricing_behavior === 'included' ? 'Included' : price > 0 ? `TZS ${price.toLocaleString()}` : 'Quote'}
                                        </p>
                                        <button
                                            type="button"
                                            disabled={locked}
                                            onClick={() => toggleItem(item)}
                                            className={cn(
                                                'rounded-xl px-3 py-2 text-xs font-black transition disabled:cursor-default disabled:opacity-70',
                                                selected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                            )}
                                        >
                                            {selected ? 'Selected' : 'Select'}
                                        </button>
                                        {selected && (
                                            <div className="flex items-center gap-1">
                                                <button type="button" className="rounded-full bg-white p-2 shadow-sm hover:bg-slate-100" onClick={() => adjustQuantity(item, -1)}>
                                                    <Minus className="h-4 w-4" />
                                                </button>
                                                <span className="w-7 text-center text-sm font-black">{row.quantity || 1}</span>
                                                <button type="button" className="rounded-full bg-white p-2 shadow-sm hover:bg-slate-100" onClick={() => adjustQuantity(item, 1)}>
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

function PackageLayout({ sections, selection, itemPrice, toggleItem, adjustQuantity, toggleAddOn }) {
    return (
        <div className="space-y-6">
            {Object.entries(sections).map(([section, items]) => (
                <section key={section} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                            {section.toLowerCase().includes('add') ? <Plus className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-950">{section}</h2>
                            <p className="text-xs font-bold text-slate-500">{items.length} configurable item{items.length === 1 ? '' : 's'}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {items.map((item) => (
                            <SelectableItemCard
                                key={item.id}
                                item={item}
                                selection={selection}
                                itemPrice={itemPrice}
                                toggleItem={toggleItem}
                                adjustQuantity={adjustQuantity}
                                toggleAddOn={toggleAddOn}
                                variant="package"
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function ItineraryLayout({ sections, selection, itemPrice, toggleItem, adjustQuantity, toggleAddOn }) {
    return (
        <div className="space-y-0">
            {Object.entries(sections).map(([section, items], sectionIndex) => (
                <section key={section} className="relative grid gap-4 border-l-2 border-sky-100 pb-8 pl-5 last:pb-0">
                    <div className="absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full border-4 border-slate-50 bg-sky-600 text-white">
                        <CalendarDays className="h-3 w-3" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600">Stop {sectionIndex + 1}</p>
                        <h2 className="text-xl font-black text-slate-950">{section}</h2>
                    </div>
                    <div className="grid gap-3">
                        {items.map((item) => (
                            <SelectableItemCard
                                key={item.id}
                                item={item}
                                selection={selection}
                                itemPrice={itemPrice}
                                toggleItem={toggleItem}
                                adjustQuantity={adjustQuantity}
                                toggleAddOn={toggleAddOn}
                                variant="itinerary"
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function SelectableItemCard({ item, selection, itemPrice, toggleItem, adjustQuantity, toggleAddOn, variant }) {
    const row = selection[item.id] || {};
    const selected = Boolean(row.selected);
    const locked = item.is_required || item.role === 'included';
    const price = itemPrice(item);
    const isMenu = variant === 'menu';
    const isItinerary = variant === 'itinerary';
    const selectedAddOnNames = new Set((row.add_ons || []).map((addOn) => String(addOn.name || '').toLowerCase()));

    return (
        <div className={cn(
            'overflow-hidden border bg-white shadow-sm transition',
            isMenu ? 'rounded-2xl' : 'rounded-xl',
            selected ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-200',
        )}>
            {isMenu && item.image_url && (
                <div className="aspect-[4/3] bg-slate-100">
                    <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                </div>
            )}
            <div className="p-4">
                <div className="flex gap-4">
                    {!isMenu && item.image_url && (
                        <img src={item.image_url} alt="" className={cn('shrink-0 rounded-xl object-cover', isItinerary ? 'h-20 w-24' : 'h-16 w-16')} />
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-black text-slate-950">{item.title}</h3>
                                    {locked && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                            <Check className="h-3 w-3" /> Included
                                        </span>
                                    )}
                                </div>
                                {item.description && <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">{item.description}</p>}
                                {item.item_type === 'offering_group' && (
                                    <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                        Nested group
                                    </p>
                                )}
                            </div>
                            <p className="shrink-0 text-sm font-black text-brand-700">
                                {item.pricing_behavior === 'included' ? 'Included' : price > 0 ? `TZS ${price.toLocaleString()}` : 'Quote'}
                            </p>
                        </div>

                        {Array.isArray(item.add_ons) && item.add_ons.length > 0 && (
                            <div className="mt-4 rounded-xl bg-slate-50 p-3">
                                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Add-ons</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {item.add_ons.map((addOn) => {
                                        const checked = selectedAddOnNames.has(String(addOn.name || '').toLowerCase());

                                        return (
                                            <button
                                                key={addOn.name}
                                                type="button"
                                                onClick={() => toggleAddOn?.(item, addOn)}
                                                className={cn(
                                                    'rounded-full border px-3 py-1.5 text-xs font-black transition',
                                                    checked ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200',
                                                )}
                                            >
                                                {addOn.name}{Number(addOn.price || 0) > 0 ? ` +TZS ${Number(addOn.price || 0).toLocaleString()}` : ''}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                disabled={locked}
                                onClick={() => toggleItem(item)}
                                className={cn(
                                    'rounded-xl px-4 py-2 text-sm font-black transition disabled:cursor-default disabled:opacity-70',
                                    selected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                )}
                            >
                                {selected ? 'Selected' : 'Select'}
                            </button>
                            {selected && (
                                <div className="flex items-center gap-2">
                                    <button type="button" className="rounded-full bg-slate-100 p-2 hover:bg-slate-200" onClick={() => adjustQuantity(item, -1)}>
                                        <Minus className="h-4 w-4" />
                                    </button>
                                    <span className="w-8 text-center text-sm font-black">{row.quantity || 1}</span>
                                    <button type="button" className="rounded-full bg-slate-100 p-2 hover:bg-slate-200" onClick={() => adjustQuantity(item, 1)}>
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SelectionSummary({ offeringGroup, selectedItems, selectedTotal, itemPrice, addOnsForRow, meta, selectionIssues = [], onCheckout }) {
    const selectedRows = selectedItems
        .map((row) => {
            const item = offeringGroup.items.find((candidate) => Number(candidate.id) === Number(row.group_item_id));
            return item ? { ...row, item } : null;
        })
        .filter(Boolean);

    return (
        <aside className="h-max rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
            <div className="flex items-center gap-2">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', meta.chip)}>
                    <ShoppingBag className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400">Your selection</p>
                    <p className="text-sm font-black text-slate-950">{selectedRows.length} item{selectedRows.length === 1 ? '' : 's'} selected</p>
                </div>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {selectedRows.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Choose at least one item.</p>
                ) : selectedRows.map((row) => {
                    const { item, quantity } = row;
                    const addOns = addOnsForRow(row, item);
                    const addOnsTotal = addOns.reduce((sum, addOn) => sum + Number(addOn.price || 0), 0);

                    return (
                    <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex justify-between gap-3">
                            <span className="font-bold text-slate-700">{quantity} x {item.title}</span>
                            <span className="font-black text-slate-950">TZS {((itemPrice(item) + addOnsTotal) * Number(quantity || 1)).toLocaleString()}</span>
                        </div>
                        {addOns.length > 0 && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                Add-ons: {addOns.map((addOn) => addOn.name).join(', ')}
                            </p>
                        )}
                    </div>
                    );
                })}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
                {selectionIssues.length > 0 && (
                    <div className="mb-3 space-y-1 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
                        {selectionIssues.map((issue) => (
                            <p key={issue}>{issue}</p>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-500">Total</span>
                    <span className="text-2xl font-black text-slate-950">TZS {selectedTotal.toLocaleString()}</span>
                </div>
                {offeringGroup.checkout_mode === 'book_group' && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <Clock className="h-3.5 w-3.5" /> Booking details are confirmed during checkout or chat.
                    </p>
                )}
                <Button type="button" className={cn('mt-4 h-12 w-full rounded-xl font-black text-white', meta.button)} disabled={selectedRows.length === 0 || selectionIssues.length > 0} onClick={onCheckout}>
                    <ShoppingBag className="mr-2 h-5 w-5" />
                    {offeringGroup.requires_inquiry || offeringGroup.checkout_mode === 'request_quote' ? 'Request offer' : 'Checkout'}
                </Button>
            </div>
        </aside>
    );
}
