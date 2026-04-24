import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import {
    ChevronLeft, ChevronRight, Store, ShieldCheck, Zap, Info, BadgeCheck,
    AlertTriangle, DownloadCloud, CalendarClock, MapPin, Link as LinkIcon,
    ShoppingBag, Bell
} from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import { usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProductDetail({ product }) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [activeHotspot, setActiveHotspot] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [variantFilters, setVariantFilters] = useState({});
    const [isOnWaitlist, setIsOnWaitlist] = useState(false);
    const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);

    const { auth } = usePage().props;

    const images = product?.images || [];
    const heroImage = images[currentImageIndex]?.image_url || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1200';

    const merchantProfile = product?.merchant_profile || product?.merchantProfile || null;
    const merchant = merchantProfile || product?.merchant || {};
    const attributes = product?.attributes || {};
    const isServiceProduct = product?.type === 'service';
    const description = attributes?.suggested_description
        || (isServiceProduct ? 'Maelezo ya huduma hayajapatikana.' : 'Maelezo ya bidhaa hayajapatikana.');
    const merchantUsername = merchantProfile?.username
        || merchant?.username
        || (merchant?.name ? merchant.name.toLowerCase().replace(/\s/g, '_') : '');
    const merchantSlug = merchantProfile?.username || merchant?.username || merchantProfile?.id || merchant?.id;
    const merchantPhone = product?.merchant?.phone_number
        || product?.merchant?.user?.phone_number
        || merchantProfile?.phone_number
        || merchantProfile?.user?.phone_number
        || merchant?.phone_number
        || merchant?.user?.phone_number
        || '';
    const storefrontSettings = merchant?.storefront_setting
        || merchant?.storefrontSetting
        || product?.merchant?.storefront_setting
        || product?.merchant?.storefrontSetting
        || null;
    const serviceAreaType = storefrontSettings?.service_area_type || null;
    const serviceTimezone = storefrontSettings?.service_timezone || null;
    const serviceLocations = Array.isArray(storefrontSettings?.service_locations) ? storefrontSettings.service_locations : [];
    const weekDays = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
    const serviceHours = Array.isArray(storefrontSettings?.service_hours)
        ? storefrontSettings.service_hours
            .filter((row) => row?.day && row?.is_open)
            .map((row) => ({
                dayLabel: weekDays[row.day] || row.day,
                open: row.open || '--:--',
                close: row.close || '--:--',
            }))
        : [];
    const whatsappPhone = merchantPhone
        ? merchantPhone.replace(/[^\d]/g, '').replace(/^0/, '255')
        : '';
    const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}` : null;
    const servicePricingModel = product?.service_pricing_model || 'fixed_price';
    const serviceIsShowcase = Boolean(product?.service_is_showcase);
    const verificationRequiredForListing = Boolean(product?.verification_required_for_listing);
    const merchantCanTransactInApp = Boolean(merchant?.is_verified) || !verificationRequiredForListing;
    const serviceBookingLink = (() => {
        if (product?.type !== 'service') return null;
        const raw = String(product?.url || '').trim();
        if (!raw) return null;
        if (/^https?:\/\//i.test(raw)) return raw;
        if (!raw.includes(':')) return null;
        const [channel, ...rest] = raw.split(':');
        const value = rest.join(':').trim();
        if (!value) return null;
        if (channel === 'whatsapp') {
            const digits = value.replace(/[^\d]/g, '').replace(/^0/, '255');
            return digits ? `https://wa.me/${digits}` : null;
        }
        if (channel === 'phone') {
            return `tel:${value}`;
        }
        return null;
    })();
    const externalContactUrl = serviceBookingLink || whatsappUrl;
    const isServiceContactOnly = product?.type === 'service' && (
        serviceIsShowcase
        || servicePricingModel === 'showcase_only'
        || servicePricingModel === 'contract_quote'
        || servicePricingModel === 'hourly_rate'
    );

    const hotspots = images[currentImageIndex]?.hotspots || [];
    const variants = useMemo(() => (
        (product?.variants || []).filter((variant) => (
            variant?.is_active !== false && Number(variant?.inventory_count || 0) > 0
        ))
    ), [product?.variants]);
    const hasProductVariants = Boolean(product?.has_variants && variants.length > 0);
    const variantAttributeKeys = useMemo(() => (
        [...new Set(variants.flatMap((variant) => Object.keys(variant?.attributes || {})))]
    ), [variants]);
    const variantOptionsByKey = useMemo(() => (
        variantAttributeKeys.reduce((acc, key) => {
            acc[key] = [...new Set(variants
                .map((variant) => variant?.attributes?.[key])
                .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
                .map((value) => String(value)))];
            return acc;
        }, {})
    ), [variantAttributeKeys, variants]);
    const availableOptionsByKey = useMemo(() => (
        variantAttributeKeys.reduce((acc, key) => {
            const options = variantOptionsByKey[key] || [];
            acc[key] = options.filter((option) => (
                variants.some((variant) => {
                    if (String(variant?.attributes?.[key] || '') !== String(option)) return false;
                    return variantAttributeKeys.every((otherKey) => {
                        if (otherKey === key) return true;
                        const selected = (variantFilters[otherKey] || '').toString().trim();
                        if (!selected) return true;
                        return String(variant?.attributes?.[otherKey] || '') === selected;
                    });
                })
            ));
            return acc;
        }, {})
    ), [variantAttributeKeys, variantFilters, variantOptionsByKey, variants]);
    const optionSwatchByKey = useMemo(() => (
        variantAttributeKeys.reduce((acc, key) => {
            acc[key] = {};
            variants.forEach((variant) => {
                const option = String(variant?.attributes?.[key] || '');
                if (!option || !variant?.swatch_image_url || acc[key][option]) return;
                acc[key][option] = variant.swatch_image_url;
            });
            return acc;
        }, {})
    ), [variantAttributeKeys, variants]);
    const filteredVariants = useMemo(() => (
        variants.filter((variant) => (
            variantAttributeKeys.every((key) => {
                const selected = (variantFilters[key] || '').toString().trim();
                return !selected || String(variant?.attributes?.[key] || '') === selected;
            })
        ))
    ), [variantAttributeKeys, variantFilters, variants]);
    const selectedVariant = filteredVariants.find((variant) => String(variant.id) === String(selectedVariantId))
        || variants.find((variant) => String(variant.id) === String(selectedVariantId))
        || filteredVariants[0]
        || variants[0]
        || null;
    const isVariantSelectionComplete = !hasProductVariants
        || variantAttributeKeys.every((key) => (variantFilters[key] || '').toString().trim().length > 0);
    const checkoutPrice = hasProductVariants
        ? Number(selectedVariant?.price || 0)
        : Number(product.discounted_price > 0 ? product.discounted_price : product.price || 0);
    const canCheckout = hasProductVariants
        ? Boolean(selectedVariant?.id && isVariantSelectionComplete && Number(selectedVariant?.inventory_count || 0) > 0)
        : Number(product.available_stock || 0) > 0;

    const getCheckoutButtonText = () => {
        if (hasProductVariants) {
            if (!isVariantSelectionComplete) {
                const missing = variantAttributeKeys.find(key => !(variantFilters[key] || '').toString().trim());
                return `Chagua ${formatAttributeLabel(missing)}`;
            }
            if (!selectedVariant?.id) return "Chagua Chaguo";
            if (Number(selectedVariant?.inventory_count || 0) <= 0) return "Bidhaa Imeisha";
        } else {
            if (Number(product.available_stock || 0) <= 0) return "Bidhaa Imeisha";
        }

        if (product.type === 'service' && servicePricingModel === 'deposit_required') {
            return 'Lipa Deposit';
        }
        if (product.type === 'digital') {
            return 'Lipa Sasa';
        }
        return 'Nunua Kwenye Mtandao';
    };

    useEffect(() => {
        const checkWaitlist = async () => {
            if (!auth.user) return;
            try {
                const res = await fetch(`/api/products/${product.slug}/waitlist/status?variant_id=${selectedVariant?.id || ''}`, {
                    headers: { 'Accept': 'application/json' }
                });
                const data = await res.json();
                setIsOnWaitlist(data.on_waitlist);
            } catch (error) {
                console.error("Failed to check waitlist status", error);
            }
        };
        checkWaitlist();
    }, [product.slug, selectedVariant?.id, auth.user]);

    const toggleWaitlist = async () => {
        if (!auth.user) {
            toast.error("Tafadhali ingia kwenye akaunti yako kwanza.");
            return;
        }
        setIsWaitlistLoading(true);
        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const res = await fetch(`/api/products/${product.slug}/waitlist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || ''
                },
                body: JSON.stringify({ variant_id: selectedVariant?.id || null })
            });
            const data = await res.json();
            setIsOnWaitlist(data.status === 'added');
            toast.success(data.message);
        } catch (error) {
            toast.error("Imeshindwa kubadili waitlist. Jaribu tena.");
        } finally {
            setIsWaitlistLoading(false);
        }
    };

    useEffect(() => {
        setSelectedVariantId('');
        setVariantFilters({});
    }, [product?.id]);

    useEffect(() => {
        if (!hasProductVariants) return;
        if (!selectedVariant?.id) return;
        if (String(selectedVariantId) !== String(selectedVariant.id)) {
            setSelectedVariantId(String(selectedVariant.id));
        }
    }, [hasProductVariants, selectedVariant, selectedVariantId]);

    useEffect(() => {
        if (!hasProductVariants || variantAttributeKeys.length === 0 || !selectedVariant) return;
        setVariantFilters((prev) => {
            const next = { ...prev };
            let changed = false;
            variantAttributeKeys.forEach((key) => {
                const current = (next[key] || '').toString().trim();
                const fallback = String(selectedVariant?.attributes?.[key] || '').trim();
                if (!current && fallback) {
                    next[key] = fallback;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [hasProductVariants, selectedVariant, variantAttributeKeys]);

    useEffect(() => {
        if (!hasProductVariants || variantAttributeKeys.length === 0) return;
        setVariantFilters((prev) => {
            const next = { ...prev };
            let changed = false;
            variantAttributeKeys.forEach((key) => {
                const value = (next[key] || '').toString().trim();
                if (!value) return;
                const available = availableOptionsByKey[key] || [];
                if (!available.includes(value)) {
                    next[key] = '';
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [availableOptionsByKey, hasProductVariants, variantAttributeKeys]);

    const formatAttributeLabel = (key) => (
        String(key || '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
    );

    return (
        <AppLayout hideTabBar>
            <div className="min-h-screen bg-background text-foreground pb-24 md:pb-0 font-sans">
                <Head title={`${product.title} | Takeer`} />

                {/* Sticky Header with Back Button */}
                <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
                    <button
                        onClick={() => window.history.back()}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white pointer-events-auto hover:bg-black/50 transition-colors"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                </div>

                {/* Hero Image Section with Multi-image Slider */}
                <div className="relative w-full aspect-square bg-muted overflow-hidden">
                    <div className="w-full h-full relative group">
                        <img
                            src={heroImage}
                            alt={product.title}
                            className="w-full h-full object-cover transition-all duration-500"
                        />

                        {/* Hotspots Overlay */}
                        {hotspots.map((spot, idx) => (
                            <div
                                key={idx}
                                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20"
                                style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveHotspot((prev) => (prev === spot ? null : spot));
                                }}
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-white/40 rounded-full animate-ping scale-150" />
                                    <div className={`h-8 w-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-all transform hover:scale-110 active:scale-90 ${activeHotspot === spot ? 'bg-brand-600' : 'bg-black/60 backdrop-blur-md'}`}>
                                        {spot.type === 'product' && <ShoppingBag className="h-4 w-4 text-white" />}
                                        {spot.type === 'link' && <LinkIcon className="h-4 w-4 text-white" />}
                                        {spot.type === 'text' && <Info className="h-4 w-4 text-white" />}
                                    </div>
                                </div>

                                {activeHotspot === spot && (
                                    <div
                                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[45] w-56"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="bg-white/95 backdrop-blur-xl p-3 rounded-2xl shadow-2xl border border-white/20 space-y-2 relative">
                                            <button
                                                onClick={() => setActiveHotspot(null)}
                                                className="absolute -top-2 -right-2 h-6 w-6 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg"
                                            >
                                                <ChevronLeft className="h-4 w-4 rotate-90" />
                                            </button>
                                            <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest">
                                                {spot.type}
                                            </p>
                                            <p className="text-sm font-bold text-foreground break-words">
                                                {spot.type === 'product' ? (spot.product?.title || `Bidhaa #${spot.data}`) : spot.data}
                                            </p>
                                            <Button
                                                size="sm"
                                                className="w-full rounded-xl h-9 px-3 bg-brand-600 text-white font-bold"
                                                onClick={() => {
                                                    if (spot.type === 'link') {
                                                        window.open(spot.data, '_blank');
                                                        return;
                                                    }
                                                    if (spot.type === 'product') {
                                                        const target = spot.product?.slug || spot.data;
                                                        if (target) window.location.href = `/product/${target}`;
                                                    }
                                                }}
                                            >
                                                {spot.type === 'product' ? 'Ione' : spot.type === 'link' ? 'Fungua' : 'Sawa'}
                                            </Button>
                                        </div>
                                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white/95" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Navigation Arrows */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={() => { setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1); setActiveHotspot(null); }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/30 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </button>
                                <button
                                    onClick={() => { setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0); setActiveHotspot(null); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/30 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </>
                        )}

                        {/* Image Indicators */}
                        {images.length > 1 && (
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                                {images.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                </div>

                {/* Content Area - Pulls up slightly over the image */}
                <div className="relative z-10 -mt-6 rounded-t-3xl bg-background px-4 pt-6 pb-20 max-w-2xl mx-auto md:mt-0 md:rounded-none md:pt-10">
                    {/* Product Title & Price */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            {product.type === 'digital' && (
                                <span className="bg-brand-100 text-brand-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-max uppercase tracking-widest">
                                    <DownloadCloud className="h-3 w-3" /> Mtandaoni
                                </span>
                            )}
                            {product.type === 'service' && (
                                <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-max uppercase tracking-widest">
                                    <CalendarClock className="h-3 w-3" /> Huduma / Booking
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-black leading-tight mb-2 text-foreground break-words">
                            {product.title}
                        </h1>
                        <div className="flex items-end gap-3">
                            <div className="text-3xl font-extrabold text-brand-600 leading-none">
                                <span className="text-sm font-bold align-text-top mr-1">TZS</span>
                                {parseFloat(checkoutPrice || 0).toLocaleString()}
                            </div>
                            {product.discounted_price > 0 && Number(product.discounted_price) < Number(product.price) && (
                                <div className="text-lg font-bold text-muted-foreground line-through decoration-muted-foreground/60 leading-none mb-1">
                                    {parseFloat(product.price).toLocaleString()}
                                </div>
                            )}
                            {product.discounted_price > 0 && Number(product.discounted_price) < Number(product.price) && (
                                <div className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full mb-1 border border-red-200 uppercase tracking-widest">
                                    OFA
                                </div>
                            )}
                        </div>
                        {product.type === 'service' && servicePricingModel === 'hourly_rate' && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-purple-700">
                                Bei kwa saa · Minimum {Number(product?.service_min_hours || 1)}h
                            </p>
                        )}
                        {product.type === 'service' && servicePricingModel === 'contract_quote' && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-purple-700">
                                Bei kwa makubaliano (Quote/Contract)
                            </p>
                        )}
                        {product.type === 'service' && (serviceIsShowcase || servicePricingModel === 'showcase_only') && (
                            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-purple-700">
                                Showcase only · Wateja wawasiliane moja kwa moja
                            </p>
                        )}
                    </div>

                    {hasProductVariants && (
                        <div className="mb-6 rounded-2xl border border-brand-100 bg-brand-50/40 p-3.5 space-y-3">
                            <p className="text-[11px] font-black uppercase tracking-wider text-brand-700">Chaguo</p>
                            {variantAttributeKeys.map((key) => {
                                const options = variantOptionsByKey[key] || [];
                                const availableOptions = availableOptionsByKey[key] || [];
                                const selectedValue = String(variantFilters[key] || '');
                                const hasSwatchOptions = options.some((option) => !!optionSwatchByKey?.[key]?.[option]);

                                return (
                                    <div key={key} className="space-y-1.5">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{formatAttributeLabel(key)}</p>
                                        {hasSwatchOptions ? (
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {options.map((option) => {
                                                    const swatch = optionSwatchByKey?.[key]?.[option];
                                                    const isAvailable = availableOptions.includes(option);
                                                    const isSelected = selectedValue === option;
                                                    return (
                                                        <button
                                                            key={`${key}-${option}`}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => {
                                                                setVariantFilters((prev) => ({ ...prev, [key]: option }));
                                                                setSelectedVariantId('');
                                                            }}
                                                            className={`w-24 shrink-0 rounded-xl border overflow-hidden ${isSelected ? 'border-brand-600 ring-1 ring-brand-500' : isAvailable ? 'border-slate-300' : 'border-slate-200 opacity-50 cursor-not-allowed'}`}
                                                        >
                                                            <div className="h-14 bg-slate-100">
                                                                {swatch ? (
                                                                    <img src={swatch} alt={option} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-500">No swatch</div>
                                                                )}
                                                            </div>
                                                            <p className="px-2 py-1 text-xs font-semibold text-left truncate">{option}</p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2">
                                                {options.map((option) => {
                                                    const isAvailable = availableOptions.includes(option);
                                                    const isSelected = selectedValue === option;
                                                    return (
                                                        <button
                                                            key={`${key}-${option}`}
                                                            type="button"
                                                            disabled={!isAvailable}
                                                            onClick={() => {
                                                                setVariantFilters((prev) => ({ ...prev, [key]: option }));
                                                                setSelectedVariantId('');
                                                            }}
                                                            className={`h-10 rounded-xl border px-2 text-sm font-semibold text-left ${isSelected ? 'border-brand-600 bg-brand-600 text-white' : isAvailable ? 'border-brand-200 bg-white text-slate-900' : 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed'}`}
                                                        >
                                                            <span className="truncate block">{option}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {selectedVariant && (
                                <div className="rounded-xl border border-brand-200 bg-white p-2.5">
                                    <p className="text-sm font-bold text-brand-900">{selectedVariant.name}</p>
                                    <p className="text-[11px] font-bold text-brand-700">Stock: {Number(selectedVariant.inventory_count || 0)} tu!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Merchant / Seller Info */}
                    <Link
                        href={merchantSlug ? `/m/${merchantSlug}` : '#'}
                        className="flex items-center gap-3 p-4 bg-accent/30 border border-border/50 rounded-2xl mb-6 shadow-sm hover:bg-accent/50 transition-colors"
                    >
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-brand-100 flex items-center justify-center shrink-0">
                            {merchant.avatar_url ? (
                                <img src={merchant.avatar_url} alt={merchant.display_name} className="w-full h-full object-cover" />
                            ) : (
                                <Store className="h-6 w-6 text-brand-500" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 max-w-full">
                                    <p className="font-bold text-base text-foreground truncate">{merchant.display_name || merchant.name}</p>
                                    {merchant.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />}
                                </div>
                                {(merchant.successful_sales || merchant.unsuccessful_sales) ? (
                                    <span className="text-[10px] font-black text-green-700 bg-green-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-max border border-green-200">
                                        <ShieldCheck className="h-3 w-3" />
                                        {Math.round((merchant.successful_sales / ((merchant.successful_sales + merchant.unsuccessful_sales) || 1)) * 100)}% Trust
                                    </span>
                                ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">@{merchantUsername || 'merchant'}</p>
                        </div>
                        <Button variant="secondary" size="sm" className="rounded-full text-xs h-8">
                            Biashara Yote
                        </Button>
                    </Link>

                    {/* Description & Attributes */}
                    <div className="space-y-4 mb-8">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <Info className="h-5 w-5 text-brand-500" />
                            {isServiceProduct ? 'Maelezo ya Huduma' : 'Maelezo ya Bidhaa'}
                        </h2>
                        <p className="text-sm leading-relaxed whitespace-pre-line">
                            {description}
                        </p>

                        {product.type === 'physical' && attributes.category && (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div className="bg-accent/40 p-3 rounded-xl">
                                    <span className="text-xs text-muted-foreground block mb-1">Kategoria</span>
                                    <span className="font-semibold text-sm">{attributes.category}</span>
                                </div>
                                {attributes.colors && attributes.colors.length > 0 && (
                                    <div className="bg-accent/40 p-3 rounded-xl">
                                        <span className="text-xs text-muted-foreground block mb-1">Rangi</span>
                                        <span className="font-semibold text-sm">{attributes.colors.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {product.type === 'service' && (serviceHours.length > 0 || serviceLocations.length > 0 || serviceAreaType || serviceTimezone) && (
                        <div className="space-y-3 mb-8 rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                            <h3 className="font-bold text-base flex items-center gap-2 text-purple-800">
                                <CalendarClock className="h-4 w-4" />
                                Service Availability
                            </h3>

                            {serviceAreaType && (
                                <p className="text-xs font-bold uppercase tracking-wide text-purple-700">
                                    Area: {serviceAreaType === 'onsite' ? 'On-site' : serviceAreaType === 'remote' ? 'Remote' : 'Hybrid'}
                                </p>
                            )}
                            {serviceTimezone && (
                                <p className="text-xs text-purple-700">Timezone: {serviceTimezone}</p>
                            )}

                            {serviceHours.length > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    {serviceHours.map((row) => (
                                        <div key={`${row.dayLabel}-${row.open}`} className="rounded-xl border border-purple-200/80 bg-white/80 px-3 py-2">
                                            <p className="text-xs font-black text-purple-900">{row.dayLabel}</p>
                                            <p className="text-xs text-purple-700 mt-0.5">{row.open} - {row.close}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {serviceLocations.length > 0 && (
                                <div className="rounded-xl border border-purple-200/80 bg-white/80 p-3">
                                    <p className="text-xs font-black text-purple-900 flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" /> Main Service locations
                                    </p>
                                    <p className="text-xs text-purple-700 mt-1">{serviceLocations.join(' • ')}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Trust Badges / Warnings */}
                    {merchantCanTransactInApp ? (
                        <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl p-4 flex items-start gap-3 border border-green-100 dark:border-green-900/20">
                            <ShieldCheck className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm text-green-800 dark:text-green-500">Takeer SafePay</h4>
                                <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-1">
                                    {(!product.type || product.type === 'physical') ? (
                                        "Pesa yako itahifadhiwa kwenye Escrow. Muuzaji atapokea pesa punde tu utakapothibitisha kuipokea mzigo wako."
                                    ) : (
                                        `Utapewa link ya ${product.type === 'digital' ? 'kupakua' : 'kufanya booking'} mara tu baada ya malipo kukamilika.`
                                    )}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 flex items-start gap-3 border border-amber-200 dark:border-amber-900/30">
                            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm text-amber-800 dark:text-amber-500">Muuzaji Hajathibitishwa</h4>
                                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
                                    Muuzaji huyu hajathibitishwa na Takeer. Malipo hufanywa nje ya mtandao wetu, kwa hivyo hatuwezi kudhamini usalama wa miamala yako au kukurejeshea pesa.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Bottom Bar for Purchase */}
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-4 flex items-center justify-between gap-4 max-w-2xl mx-auto shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)]">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Kiasi Jumla</p>
                        <p className="font-black text-lg text-foreground truncate">
                            TZS {parseFloat(checkoutPrice || 0).toLocaleString()}
                        </p>
                    </div>
                    {merchantCanTransactInApp && !isServiceContactOnly ? (
                        <div className="flex-[1.5] flex flex-col gap-1">
                            {!canCheckout && (
                                <p className="text-[10px] font-bold text-red-500 text-center">
                                    {hasProductVariants && !isVariantSelectionComplete ? "Tafadhali kamilisha uchaguzi" :
                                        (Number(selectedVariant?.inventory_count || product.available_stock || 0) <= 0 ? "Samahani, bidhaa hii imeisha" : "")}
                                </p>
                            )}
                            {!canCheckout && Number(selectedVariant?.inventory_count || product.available_stock || 0) <= 0 && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        toggleWaitlist();
                                    }}
                                    disabled={isWaitlistLoading}
                                    className={cn(
                                        "flex items-center justify-center gap-1.5 py-1 px-3 rounded-full border transition-all text-[10px] font-black uppercase tracking-tighter self-center",
                                        isOnWaitlist
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                    )}
                                >
                                    <Bell className={cn("h-3 w-3", isOnWaitlist && "fill-emerald-600")} />
                                    {isOnWaitlist ? "Ninasubiri Taarifa" : "Nijulishe ikirudi"}
                                </button>
                            )}
                            {canCheckout && (<Button
                                className={`h-14 rounded-2xl text-[15px] shadow-lg ${canCheckout ? 'shadow-brand-500/20' : 'bg-slate-300 shadow-none'}`}
                                size="lg"
                                disabled={!canCheckout}
                                onClick={() => {
                                    if (window.__openCheckout) {
                                        window.__openCheckout({
                                            ...product,
                                            preselected_variant_id: selectedVariant?.id || null,
                                            preselected_variant_filters: variantFilters,
                                        });
                                    } else {
                                        alert("Checkout Modal not loaded.");
                                    }
                                }}
                            >
                                <Zap className={`mr-2 h-5 w-5 ${canCheckout ? 'fill-white/20' : 'text-slate-400'}`} />
                                {getCheckoutButtonText()}
                            </Button>
                            )}
                        </div>
                    ) : externalContactUrl ? (
                        <a
                            href={externalContactUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-[1.5] h-14 rounded-2xl text-[15px] bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center font-black"
                        >
                            {product.type === 'service' && servicePricingModel === 'contract_quote'
                                ? 'Omba Nukuu'
                                : 'Wasiliana Nje ya App'}
                        </a>
                    ) : (
                        <Button
                            className="flex-[1.5] h-14 rounded-2xl text-[15px] bg-amber-500/50 text-white shadow-lg shadow-amber-500/20 cursor-not-allowed"
                            size="lg"
                            disabled
                        >
                            Wasiliana Nje ya App
                        </Button>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
