import React, { useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgeCheck,
    ChefHat,
    ChevronRight,
    Clock3,
    Flame,
    Leaf,
    MapPin,
    Minus,
    Plus,
    ShoppingBag,
    Store,
    Utensils,
    Zap,
} from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { cn } from '@/lib/utils';
import { productCardPriceLabel } from '@/lib/productUnits';

export default function MenuProductTemplate({ product }) {
    const [quantity, setQuantity] = useState(1);
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const details = product?.module_details || {};
    const variants = useMemo(() => (
        (product?.variants || []).filter((variant) => variant?.is_active !== false && Number(variant?.inventory_count || 0) > 0)
    ), [product?.variants]);
    const selectedVariant = variants.find((variant) => String(variant.id) === String(selectedVariantId)) || variants[0] || null;
    const hasVariants = Boolean(product?.has_variants && variants.length > 0);
    const merchant = product?.merchant_profile || product?.merchant || {};
    const merchantSlug = merchant?.username || product?.merchant?.username || '';
    const price = hasVariants
        ? Number(selectedVariant?.price || product?.checkout_price || product?.discounted_price || product?.price || 0)
        : Number(product?.checkout_price || product?.discounted_price || product?.price || 0);
    const total = price * quantity;
    const inStock = hasVariants ? Boolean(selectedVariant) : Number(product?.available_stock || product?.inventory_count || 0) > 0;
    const image = product?.images?.[0]?.image_url || product?.images?.[0]?.thumbnail_url || product?.image_url;
    const tags = Array.isArray(details?.dietary_tags) ? details.dietary_tags : [];
    const addOns = Array.isArray(details?.add_ons) ? details.add_ons.filter((item) => item?.name) : [];
    const optionGroups = [
        details?.portion_size ? ['Portion', details.portion_size] : null,
        details?.spice_level ? ['Spice', details.spice_level] : null,
        details?.serving_temperature ? ['Served', details.serving_temperature] : null,
        details?.section ? ['Menu section', details.section] : null,
    ].filter(Boolean);

    const openCheckout = () => {
        if (!window.__openCheckout || !inStock) return;

        window.__openCheckout({
            ...product,
            checkout_price: total,
            quantity,
            selected_quantity: quantity,
            preselected_variant_id: selectedVariant?.id || null,
            preselected_variant_filters: selectedVariant?.attributes || {},
        });
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${product.title} | Takeer`} />
            <div className="min-h-screen bg-[#fbfaf7] pb-28 text-slate-950">
                <div className="relative min-h-[340px] overflow-hidden bg-slate-950 text-white">
                    {image ? (
                        <img src={image} alt={product.title} className="absolute inset-0 h-full w-full object-cover opacity-85" />
                    ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#f97316,#111827_52%)]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
                    <div className="relative z-10 flex min-h-[340px] flex-col justify-between p-4 md:mx-auto md:max-w-5xl md:p-8">
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur transition hover:bg-black/50"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>

                        <div className="max-w-2xl">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                    <Utensils className="h-3.5 w-3.5" />
                                    Menu item
                                </span>
                                {details?.section && (
                                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wide backdrop-blur">
                                        {details.section}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-4xl font-black leading-none tracking-tight md:text-6xl">{product.title}</h1>
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-white/90">
                                {details?.prep_time_minutes && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock3 className="h-4 w-4" />
                                        {details.prep_time_minutes} min
                                    </span>
                                )}
                                {details?.spice_level && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Flame className="h-4 w-4" />
                                        {details.spice_level}
                                    </span>
                                )}
                                {merchant?.display_name && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Store className="h-4 w-4" />
                                        {merchant.display_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <main className="mx-auto grid max-w-5xl gap-5 p-4 md:grid-cols-[minmax(0,1fr)_360px] md:p-8">
                    <div className="space-y-5">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <p className="text-sm leading-7 text-slate-700">{product.description || product.attributes?.suggested_description || 'Freshly prepared menu item.'}</p>
                            {tags.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-800">
                                            <Leaf className="h-3.5 w-3.5" />
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </section>

                        {optionGroups.length > 0 && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Item details</h2>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    {optionGroups.map(([label, value]) => (
                                        <div key={label} className="rounded-xl bg-slate-50 p-3">
                                            <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                                            <p className="mt-1 font-black text-slate-950">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {addOns.length > 0 && (
                            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                                <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Available add-ons</h2>
                                <div className="mt-4 divide-y divide-slate-100">
                                    {addOns.map((item, index) => (
                                        <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                            <div>
                                                <p className="font-black">{item.name}</p>
                                                {item.description && <p className="text-sm text-slate-500">{item.description}</p>}
                                            </div>
                                            <p className="shrink-0 font-black text-brand-700">TZS {Number(item.price || 0).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {merchantSlug && (
                            <Link href={`/m/${merchantSlug}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                                        <Store className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="font-black">{merchant?.display_name || 'View restaurant'}</p>
                                        <p className="text-sm text-slate-500">See more menu items from this business</p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-400" />
                            </Link>
                        )}
                    </div>

                    <aside className="space-y-4 md:sticky md:top-5 md:self-start">
                        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Price</p>
                                    <p className="mt-1 text-3xl font-black text-brand-700">
                                        {hasVariants && selectedVariant ? `TZS ${Number(selectedVariant.price || 0).toLocaleString()}` : productCardPriceLabel(product, price)}
                                    </p>
                                </div>
                                {inStock ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
                                        <BadgeCheck className="h-3.5 w-3.5" />
                                        Available
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500">Sold out</span>
                                )}
                            </div>

                            {hasVariants && (
                                <div className="mt-5 space-y-2">
                                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Choose option</p>
                                    {variants.map((variant) => {
                                        const selected = String(selectedVariant?.id || '') === String(variant.id);
                                        const label = Object.values(variant.attributes || {}).filter(Boolean).join(' / ') || variant.sku || 'Option';
                                        return (
                                            <button
                                                key={variant.id}
                                                type="button"
                                                onClick={() => setSelectedVariantId(String(variant.id))}
                                                className={cn(
                                                    'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition',
                                                    selected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                                                )}
                                            >
                                                <span className="font-bold">{label}</span>
                                                <span className="font-black text-brand-700">TZS {Number(variant.price || 0).toLocaleString()}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-2">
                                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="text-lg font-black">{quantity}</span>
                                <button type="button" onClick={() => setQuantity((value) => Math.min(99, value + 1))} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-white">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold text-white/70">Total</span>
                                    <span className="text-xl font-black">TZS {Number(total || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <Button className="mt-4 h-12 w-full rounded-xl text-base font-black" disabled={!inStock} onClick={openCheckout}>
                                <Zap className="mr-2 h-5 w-5" />
                                {inStock ? 'Add to order' : 'Unavailable'}
                            </Button>
                        </section>

                        <section className="rounded-2xl bg-orange-50 p-4 text-orange-950 ring-1 ring-orange-100">
                            <div className="flex gap-3">
                                <ChefHat className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-black">Prepared by the merchant</p>
                                    <p className="mt-1 text-sm text-orange-900/75">Confirm delivery, pickup, or table service details during checkout or directly with the business.</p>
                                </div>
                            </div>
                        </section>
                    </aside>
                </main>

                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
                    <div className="mx-auto flex max-w-5xl items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase text-slate-500">Total</p>
                            <p className="truncate text-lg font-black text-brand-700">TZS {Number(total || 0).toLocaleString()}</p>
                        </div>
                        <Button className="h-12 rounded-xl font-black" disabled={!inStock} onClick={openCheckout}>
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            Order
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
