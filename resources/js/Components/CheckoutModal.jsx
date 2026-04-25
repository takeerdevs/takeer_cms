import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/Components/ui/Drawer';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Loader2, ShieldCheck, Zap, Store, Briefcase, ChevronRight, MapPin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePage } from '@inertiajs/react';

import AddressPickerModal from './AddressPickerModal';
import ShopLocationsModal from './ShopLocationsModal';
import UserAddressManager from './UserAddressManager';
import axios from 'axios';

const DEFAULT_CENTER = {
    lat: -6.7924, // Dar es Salaam
    lng: 39.2083,
};


export default function CheckoutModal({ product, isOpen, onOpenChange }) {
    const { auth, country } = usePage().props;
    const isGuest = !auth?.user;
    const detectedIso2 = (country?.iso_alpha2 || '').toUpperCase();

    const [accountPhone, setAccountPhone] = useState(auth?.user?.phone_number || '');
    const [paymentPhone, setPaymentPhone] = useState(auth?.user?.phone_number || '');
    const [payWithDifferentNumber, setPayWithDifferentNumber] = useState(false);
    const [name, setName] = useState(auth?.user?.name || '');
    const [loading, setLoading] = useState(false);
    const [resolvedProduct, setResolvedProduct] = useState(product);
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [variantFilters, setVariantFilters] = useState({});

    // Shipping State
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [shippingZones, setShippingZones] = useState([]);
    const [selectedShippingZoneId, setSelectedShippingZoneId] = useState('');
    const [physicalAddress, setPhysicalAddress] = useState('');
    const [selectedHotspot, setSelectedHotspot] = useState(null);
    const [loadingZones, setLoadingZones] = useState(false);
    const [isSelfPickupChoice, setIsSelfPickupChoice] = useState(false);
    const [extraAddressDetails, setExtraAddressDetails] = useState('');

    // Map Picker State
    const [customerLat, setCustomerLat] = useState(null);
    const [customerLng, setCustomerLng] = useState(null);
    const [customerRegion, setCustomerRegion] = useState('');
    const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
    const [isShopLocationsOpen, setIsShopLocationsOpen] = useState(false);

    const [step, setStep] = useState(1); // 1: Details/Shipping, 2: Payment
    const [paymentMethod, setPaymentMethod] = useState('mobile'); // 'mobile', 'card'
    const [mobileSubMethod, setMobileSubMethod] = useState('account'); // 'account', 'other'

    const autocompleteRef = useRef(null);

    const fetchUserAddresses = async () => {
        if (isGuest) return;
        try {
            const res = await axios.get('/api/me/addresses');
            setAddresses(res.data.addresses);

            // Auto-select default address
            const defaultAddr = res.data.addresses.find(a => a.is_default);
            if (defaultAddr) {
                applyAddress(defaultAddr);
            }
        } catch (e) { }
    };

    const applyAddress = (addr) => {
        setSelectedAddressId(addr.id);
        setCustomerLat(parseFloat(addr.latitude));
        setCustomerLng(parseFloat(addr.longitude));

        let displayAddress = addr.address_line;
        if (addr.type === 'forwarder' && addr.forwarder_customer_id) {
            displayAddress = `${addr.address_line} [ID: ${addr.forwarder_customer_id}]`;
        }

        setPhysicalAddress(displayAddress);
        setExtraAddressDetails(addr.extra_details || '');

        findBestShippingZone(parseFloat(addr.latitude), parseFloat(addr.longitude), '');
    };

    const handleAddressSaved = async (data) => {
        setCustomerLat(data.lat);
        setCustomerLng(data.lng);
        setPhysicalAddress(data.address);
        setExtraAddressDetails(data.extraDetails);
        setCustomerRegion(data.region);
        findBestShippingZone(data.lat, data.lng, data.region);

        // Persistent saving for authenticated users
        if (!isGuest) {
            try {
                const res = await axios.post('/api/me/addresses', {
                    type: 'local',
                    address_line: data.address,
                    extra_details: data.extraDetails,
                    latitude: data.lat,
                    longitude: data.lng,
                    name: data.address.split(',')[0],
                    is_default: addresses.length === 0,
                });
                setAddresses(prev => [...prev, res.data.address]);
                setSelectedAddressId(res.data.address.id);
            } catch (e) {
                console.error('Failed to persist address', e);
            }
        }
    };

    const findBestShippingZone = (lat, lng, region) => {
        if (!shippingZones.length) return;

        setSelectedHotspot(null);

        // 1. Try Local based on distance
        const localZones = shippingZones.filter(z => z.delivery_type === 'local_boda' && z.location);

        let bestLocalZone = null;
        let minActualDist = Infinity;

        localZones.forEach(zone => {
            const dist = calculateHaversine(lat, lng, Number(zone.location.latitude), Number(zone.location.longitude));
            if (dist <= Number(zone.max_distance_km)) {
                if (dist < minActualDist) {
                    minActualDist = dist;
                    bestLocalZone = zone;
                }
            }
        });

        if (bestLocalZone) {
            setSelectedShippingZoneId(String(bestLocalZone.id));
            toast.info('Tumekupatia gharama ya usafiri ya local ya karibu!');
            return;
        }

        // 2. Try Intercity Bus based on region
        if (region) {
            const busZone = shippingZones.find(z =>
                z.delivery_type === 'intercity_bus' &&
                z.destination_region?.toLowerCase().includes(region.toLowerCase())
            );
            if (busZone) {
                setSelectedShippingZoneId(String(busZone.id));

                // Find closest hotspot within this bus zone
                if (busZone.hotspots && busZone.hotspots.length > 0) {
                    let closest = null;
                    let minHsDist = Infinity;
                    busZone.hotspots.forEach(hs => {
                        const d = calculateHaversine(lat, lng, Number(hs.latitude), Number(hs.longitude));
                        if (d < minHsDist) {
                            minHsDist = d;
                            closest = hs;
                        }
                    });
                    setSelectedHotspot(closest);
                    toast.info(`Tumekupatia gharama ya mkoa: ${region}. Kituo cha karibu: ${closest.name}`);
                } else {
                    toast.info(`Tumekupatia gharama ya usafiri ya basi ya mkoa wako: ${region}`);
                }
                return;
            }
        }

        // 3. Fallback to Inquiry
        setSelectedShippingZoneId('');
    };

    const calculateHaversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    useEffect(() => {
        if (isOpen && !isGuest) {
            fetchUserAddresses();
        }
    }, [isOpen, isGuest]);

    // Sync state when props change
    useEffect(() => {
        if (auth?.user) {
            setAccountPhone(auth.user.phone_number || '');
            setPaymentPhone(auth.user.phone_number || '');
            setName(auth.user.name || '');
            setPayWithDifferentNumber(false);
        }
    }, [auth?.user, isOpen, isGuest]);

    useEffect(() => {
        setResolvedProduct(product);
        setSelectedVariantId(product?.preselected_variant_id ? String(product.preselected_variant_id) : '');
        setVariantFilters(product?.preselected_variant_filters || {});
    }, [product, isOpen]);

    useEffect(() => {
        const fetchProductData = async () => {
            const hasMerchantLocations = product?.merchant?.locations && product.merchant.locations.length > 0;
            // Only fetch if variants are missing AND product has variants OR if merchant locations are missing
            if (!product?.has_variants && hasMerchantLocations) return;
            if (product?.has_variants && (product?.variants || []).length > 0 && hasMerchantLocations) return;

            const routeKey = product?.slug || product?.id;
            if (!routeKey) return;

            try {
                const res = await fetch(`/api/pwa/product/${routeKey}`, { headers: { Accept: 'application/json' } });
                const data = await res.json();
                if (res.ok && data?.product) {
                    setResolvedProduct(data.product);
                }
            } catch (e) { }
        };

        if (isOpen) fetchProductData();
    }, [isOpen, product]);

    const activeProduct = resolvedProduct || product || null;
    const itemType = activeProduct?.purchasable_type || activeProduct?.checkoutType || 'product';

    useEffect(() => {
        if (!isOpen || !activeProduct || itemType !== 'product' || activeProduct?.type !== 'physical') return;
        const profileId = activeProduct?.shipping_profile_id;
        if (!profileId) return;

        const loadZones = async () => {
            setLoadingZones(true);
            try {
                const res = await fetch(`/api/merchant/shipping-profiles/${profileId}/zones`, { headers: { Accept: 'application/json' } });
                const json = await res.json();
                if (res.ok && json.data) {
                    setShippingZones(json.data);
                    // Reset selected zone when zones reload
                    setSelectedShippingZoneId('');
                }
            } catch (e) { } finally {
                setLoadingZones(false);
            }
        };
        loadZones();
    }, [isOpen, activeProduct?.id, activeProduct?.shipping_profile_id]);

    const itemTitle = activeProduct?.title || activeProduct?.name || 'Inapatikana kwa malipo';
    const variants = useMemo(() => (
        (activeProduct?.variants || []).filter((variant) => (
            variant?.is_active !== false && Number(variant?.inventory_count || 0) > 0
        ))
    ), [activeProduct?.variants]);
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
    ), [variants, variantAttributeKeys]);
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
    const optionPreviewVariantByKey = useMemo(() => (
        variantAttributeKeys.reduce((acc, key) => {
            acc[key] = {};
            (variantOptionsByKey[key] || []).forEach((option) => {
                const matched = variants.find((variant) => {
                    if (String(variant?.attributes?.[key] || '') !== String(option)) return false;
                    return variantAttributeKeys.every((otherKey) => {
                        if (otherKey === key) return true;
                        const selected = (variantFilters[otherKey] || '').toString().trim();
                        if (!selected) return true;
                        return String(variant?.attributes?.[otherKey] || '') === selected;
                    });
                }) || variants.find((variant) => String(variant?.attributes?.[key] || '') === String(option));

                if (matched) acc[key][option] = matched;
            });
            return acc;
        }, {})
    ), [variantAttributeKeys, variantFilters, variantOptionsByKey, variants]);
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
    const isVariantSelectionComplete = !activeProduct?.has_variants
        || variantAttributeKeys.every((key) => (variantFilters[key] || '').toString().trim().length > 0);

    const basePrice = parseFloat((activeProduct?.checkout_price ?? selectedVariant?.price ?? activeProduct?.price) || 0);
    const isPhysicalProduct = itemType === 'product' && activeProduct?.type === 'physical';
    const activeShippingZone = shippingZones.find(z => String(z.id) === String(selectedShippingZoneId));
    const isPickup = isSelfPickupChoice || activeShippingZone?.delivery_type === 'self_pickup';
    const shippingFee = (activeShippingZone && isPhysicalProduct && !isSelfPickupChoice) ? parseFloat(activeShippingZone.flat_rate_fee || 0) : 0;
    const price = basePrice + shippingFee;

    // Step management based on product type
    useEffect(() => {
        if (isOpen) {
            if (isPhysicalProduct) {
                setStep(1); // Physical always stays in one "Details" view
            } else {
                setStep(2); // Digital always stays in "Payment" view
            }
        }
    }, [isOpen, isPhysicalProduct]);

    useEffect(() => {
        if (!activeProduct?.has_variants) return;
        if (!selectedVariant?.id) return;
        if (String(selectedVariantId) !== String(selectedVariant.id)) {
            setSelectedVariantId(String(selectedVariant.id));
        }
    }, [activeProduct?.has_variants, selectedVariant, selectedVariantId]);

    useEffect(() => {
        if (!activeProduct?.has_variants || variantAttributeKeys.length === 0 || !selectedVariant) return;
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
    }, [activeProduct?.has_variants, selectedVariant, variantAttributeKeys]);

    useEffect(() => {
        if (!activeProduct?.has_variants || variantAttributeKeys.length === 0) return;
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
    }, [activeProduct?.has_variants, availableOptionsByKey, variantAttributeKeys]);

    if (!activeProduct) return null;

    const normalizePhoneForCheckout = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';

        const digits = raw.replace(/\D/g, '');

        if (raw.startsWith('+')) {
            return `+${digits}`;
        }
        if (raw.startsWith('00') && digits.length > 2) {
            return `+${digits.slice(2)}`;
        }
        if (digits.length >= 7 && digits.length <= 15) {
            return raw;
        }

        return '';
    };

    const normalizedAccountPhone = normalizePhoneForCheckout(accountPhone);
    const normalizedPaymentPhoneInput = normalizePhoneForCheckout(paymentPhone);
    const resolvedPaymentPhone = payWithDifferentNumber ? normalizedPaymentPhoneInput : normalizedAccountPhone;

    const handleCheckout = async (e) => {
        e.preventDefault();

        if (isGuest && (!name || name.trim().length < 2)) {
            return toast.error("Tafadhali weka jina lako kamili");
        }

        if (!normalizedAccountPhone) {
            return toast.error("Tafadhali weka namba sahihi ya akaunti");
        }
        if (!resolvedPaymentPhone) {
            return toast.error("Tafadhali weka namba sahihi ya malipo");
        }

        if (isPhysicalProduct && !isPickup && (!customerLat || !customerLng)) {
            return toast.error("Tafadhali chagua eneo/mtaa wako kwenye ramani ili tuweze kufikisha mzigo wako kwa usahihi.");
        }

        setLoading(true);

        try {
            const token = document.head.querySelector('meta[name="csrf-token"]')?.content;
            const bearerToken = localStorage.getItem('takeer_token');
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': token || ''
            };

            if (bearerToken) {
                headers['Authorization'] = `Bearer ${bearerToken}`;
            }

            const payload = {
                purchasable_type: itemType,
                purchasable_id: activeProduct.id,
                variant_id: selectedVariantId || undefined,
                account_phone: normalizedAccountPhone,
                payment_number: isPhysicalProduct ? normalizedAccountPhone : resolvedPaymentPhone,
                buyer_name: name || (isGuest ? 'Guest' : undefined),
                country_iso2: detectedIso2 || undefined,
                delivery_type: isPhysicalProduct ? (isSelfPickupChoice ? 'self_pickup' : 'shipping') : undefined,
                delivery_zone_id: (isPhysicalProduct && !isSelfPickupChoice) ? selectedShippingZoneId : undefined,
                quantity: 1,
                idempotency_key: `q-${itemType}-${activeProduct.id}-${Date.now()}`,
                buyer_lat: isPhysicalProduct ? customerLat : undefined,
                buyer_lng: isPhysicalProduct ? customerLng : undefined,
                physical_address: isPhysicalProduct ? (extraAddressDetails ? `${physicalAddress} (${extraAddressDetails})` : physicalAddress) : undefined,
                shipping_hotspot_id: (isPhysicalProduct && !isSelfPickupChoice && selectedHotspot) ? selectedHotspot.id : undefined,
                payment_page_id: activeProduct.payment_page_id || undefined,
            };

            const isInquiry = isPhysicalProduct; // Physical is always an inquiry first

            if (isPhysicalProduct && !isPickup) {
                if (!physicalAddress || physicalAddress.trim().length < 5) {
                    throw new Error('Tafadhali weka anwani yako ya usafirishaji ili muuzaji ajue mahali pa kuleta mzigo.');
                }
            }

            if (activeProduct?.has_variants && !selectedVariant?.id) {
                throw new Error('Tafadhali chagua sifa za bidhaa kabla ya kuendelea.');
            }

            const endpoint = isInquiry ? '/api/v1/checkout/inquire' : '/api/v1/checkout/initiate';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Hitilafu imetokea');
            }

            if (data.token) {
                localStorage.setItem('takeer_token', data.token);
                await bootstrapSessionFromToken(data.token);
            }

            const successMessage = isPhysicalProduct
                ? (data.message || 'Oda yako imeanzishwa! Sasa mnawasiliana na muuzaji.')
                : (data.message || 'Malipo yameanzishwa! Kamilisha malipo kwenye simu yako.');

            toast.success(successMessage);
            onOpenChange(false);

            if (isPhysicalProduct) {
                setTimeout(() => {
                    window.location.href = `/chat/${data.order.public_id}`;
                }, 1000);
            } else {
                // For digital items, poll until access is granted then update the page intelligently
                const orderId = data.order?.id || data.order_id || null;
                pollAccessUnlock(activeProduct?.id, itemType, orderId);
            }

        } catch (error) {
            toast.error(error.message || 'Imeshindikana kuanzisha malipo. Jaribu tena.');
        } finally {
            setLoading(false);
        }
    };

    const pollAccessUnlock = (itemId, type, orderId = null) => {
        const bearerToken = localStorage.getItem('takeer_token');
        let attempts = 0;
        const maxAttempts = 20;

        // Immediately fire the 'unlocking' event so the UI shows a spinner
        window.dispatchEvent(new CustomEvent('takeer:access-unlocking', {
            detail: { itemId, itemType: type }
        }));

        const interval = setInterval(async () => {
            attempts += 1;
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': bearerToken ? `Bearer ${bearerToken}` : '',
                };

                const res = await fetch('/api/me/entitlements/check', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ item_type: type, item_id: itemId }),
                });
                const payload = await res.json();

                if (res.ok && payload.allowed) {
                    clearInterval(interval);

                    const isDigitalProduct = type === 'product';

                    if (isDigitalProduct && orderId) {
                        // Digital product: show download modal (no reload)
                        window.dispatchEvent(new CustomEvent('takeer:digital-ready', {
                            detail: {
                                itemId,
                                itemType: type,
                                orderId,
                                productTitle: activeProduct?.title || activeProduct?.name || 'Bidhaa Yako',
                            }
                        }));
                    } else {
                        // Content unlock: signal the card/detail to refetch
                        toast.success('Malipo yamepokelewa! Content imefunguliwa.');
                        window.dispatchEvent(new CustomEvent('takeer:access-unlocked', {
                            detail: { itemId, itemType: type }
                        }));
                    }
                    return;
                }
            } catch (e) { }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                // Fallback: reload if we gave up polling
                window.location.reload();
            }
        }, 3000);
    };

    const bootstrapSessionFromToken = async (tokenValue) => {
        if (!tokenValue) return;

        const csrf = document.head.querySelector('meta[name="csrf-token"]')?.content;
        try {
            await fetch('/auth/session/bootstrap', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf || '',
                    'Authorization': `Bearer ${tokenValue}`,
                },
                body: JSON.stringify({}),
            });
        } catch (e) {
            // Keep checkout flow resilient even if session bootstrap fails.
        }
    };

    const itemLabel = {
        'product': 'Bei ya Bidhaa',
        'bundle': 'Malipo ya Bundle',
        'subscription_plan': 'Malipo ya Kifurushi',
        'post': 'Malipo ya Maandishi/Picha',
        'content_item': 'Malipo ya Maandishi/Picha',
    }[itemType] || 'Malipo ya Bidhaa';

    const formatAttributeLabel = (key) => (
        String(key || '')
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase())
    );

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="w-full sm:max-w-xl sm:mx-auto p-0 border border-brand-100/70 dark:border-brand-900/60 bg-background dark:bg-slate-950 shadow-2xl shadow-brand-900/10 dark:shadow-black/50 rounded-t-[2.5rem]">
                {/* Visual Header */}
                <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-4 sm:px-6 pt-5 pb-4 sm:py-6 text-white relative overflow-hidden">
                    <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl pointer-events-none" />
                    <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.09)_35%,transparent_70%)] pointer-events-none" />

                    <DrawerHeader className="relative z-10 text-left p-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-white/15 p-2 rounded-xl backdrop-blur-md inline-flex border border-white/25 shadow-sm">
                                <Zap className="h-5 w-5 fill-white" />
                            </div>
                            <span className="font-black text-xs uppercase tracking-[0.2em] text-white/90">Quick Checkout</span>
                        </div>
                        <DrawerTitle className="text-[28px] sm:text-3xl font-[900] leading-tight mb-1">
                            {itemTitle}
                        </DrawerTitle>
                        <DrawerDescription className="text-white/80 text-sm flex items-center gap-1.5 font-bold">
                            <Store className="h-3.5 w-3.5" />
                            {activeProduct?.merchant?.display_name || activeProduct?.merchant?.name || 'Takeer Store'}
                        </DrawerDescription>
                    </DrawerHeader>
                </div>

                <div className="flex flex-col max-h-[85vh]">
                    <div className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 scrollbar-hide">
                        {/* Variant Selection (Common for both if applicable) */}
                        {activeProduct?.has_variants && (
                            <div className="rounded-2xl border border-brand-100 dark:border-slate-700 bg-brand-50/40 dark:bg-slate-900/70 p-3 sm:p-4 space-y-3">
                                <p className="text-xs font-black uppercase tracking-wider text-brand-700/80 dark:text-brand-300/80">Chagua Sifa Za Bidhaa</p>

                                {variantAttributeKeys.map((key) => {
                                    const options = variantOptionsByKey[key] || [];
                                    const availableOptions = availableOptionsByKey[key] || [];
                                    const selectedValue = String(variantFilters[key] || '');
                                    const hasSwatchOptions = options.some((option) => !!optionSwatchByKey?.[key]?.[option]);

                                    return (
                                        <div key={key} className="space-y-1.5">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{formatAttributeLabel(key)}</label>
                                            {hasSwatchOptions ? (
                                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                                    {options.map((option) => {
                                                        const swatch = optionSwatchByKey?.[key]?.[option];
                                                        const previewVariant = optionPreviewVariantByKey?.[key]?.[option];
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
                                                                className={`shrink-0 w-28 rounded-xl border text-left overflow-hidden transition ${isSelected
                                                                    ? 'border-brand-600 ring-1 ring-brand-500'
                                                                    : isAvailable
                                                                        ? 'border-slate-300 hover:border-brand-400'
                                                                        : 'border-slate-200 opacity-50 cursor-not-allowed'
                                                                    }`}
                                                            >
                                                                <div className="h-16 bg-slate-100">
                                                                    {swatch ? (
                                                                        <img src={swatch} alt={option} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        <div className="h-full w-full flex items-center justify-center text-[10px] font-semibold text-slate-500">
                                                                            No swatch
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className={`px-2 py-1.5 ${isSelected ? 'bg-brand-50' : 'bg-white'}`}>
                                                                    <p className="text-xs font-bold truncate">{option}</p>
                                                                    {previewVariant?.price !== null && previewVariant?.price !== undefined && (
                                                                        <p className="text-[11px] text-slate-600">TZS {Number(previewVariant.price || 0).toLocaleString()}</p>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                                                                className={`h-11 rounded-xl border px-3 text-left text-sm font-semibold transition flex items-center gap-2 ${isSelected
                                                                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                                                                    : isAvailable
                                                                        ? 'border-brand-200 bg-white text-brand-900 hover:border-brand-400'
                                                                        : 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed'
                                                                    }`}
                                                            >
                                                                <span className="truncate">{option}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {isPhysicalProduct ? (
                            <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                {/* Physical: Shipping Form */}
                                <div className="rounded-2xl border border-brand-100 dark:border-slate-700 bg-brand-50/40 dark:bg-slate-900/70 p-3 sm:p-4 space-y-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-xs font-black uppercase tracking-wider text-brand-700/80 dark:text-brand-300/80">Usafirishaji</p>
                                    </div>

                                    {activeProduct?.merchant?.can_self_pickup && (
                                        <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-brand-100 dark:border-slate-800 shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => setIsSelfPickupChoice(false)}
                                                className={`h-11 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${!isSelfPickupChoice ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                Kuletewa
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsSelfPickupChoice(true)}
                                                className={`h-11 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${isSelfPickupChoice ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                Kuchukua (Pickup)
                                            </button>
                                        </div>
                                    )}

                                    {!isSelfPickupChoice ? (
                                        <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sehemu ya Kufikishiwa</label>
                                            <UserAddressManager
                                                mode="select"
                                                isGuest={isGuest}
                                                selectedId={selectedAddressId}
                                                onSelect={applyAddress}
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-2xl bg-brand-100/40 border border-brand-100 shadow-sm mt-2">
                                            <p className="text-xs font-bold text-brand-800">
                                                Unaweza kufuata bidhaa mwenyewe ilipo. Tutakutumia anwani na neno la siri na kuchati na muuzaji kwa makubaliano zaidi mara baada ya kuanzisha oda.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {isGuest && (
                                    <div className="p-4 rounded-2xl bg-brand-50/50 border border-brand-100 space-y-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-brand-900">Taarifa Zako</p>
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-brand-700/80 ml-1">Jina Lako Kamili</label>
                                                <Input
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="Andika jina lako..."
                                                    className="h-12 bg-white border-brand-100 focus:border-brand-400 rounded-xl px-4 font-bold text-brand-900 shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-brand-700/80 ml-1">Namba ya Simu</label>
                                                <Input
                                                    value={accountPhone}
                                                    onChange={(e) => setAccountPhone(e.target.value)}
                                                    placeholder="Mfano: 07XX..."
                                                    type="tel"
                                                    inputMode="numeric"
                                                    className="h-12 bg-white border-brand-100 focus:border-brand-400 rounded-xl px-4 font-bold text-brand-900 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Digital: Payment Selection Tabs */}
                                <div className="space-y-4">
                                    <div className="flex p-1 bg-brand-50/50 dark:bg-slate-800 rounded-2xl border border-brand-100 dark:border-slate-700">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('mobile')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'mobile' ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-md ring-1 ring-brand-100' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Zap className={`h-3.5 w-3.5 ${paymentMethod === 'mobile' ? 'fill-current' : ''}`} />
                                            Mobile Pay
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('card')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'card' ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-md ring-1 ring-brand-100' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Briefcase className="h-3.5 w-3.5" />
                                            Card Pay
                                        </button>
                                    </div>

                                    {paymentMethod === 'mobile' && (
                                        <div className="p-5 rounded-3xl bg-brand-50/30 border border-brand-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600">Namba ya Kulipia</label>
                                                    <span className="text-[9px] font-bold text-brand-400 uppercase">USSD Push</span>
                                                </div>
                                                <Input
                                                    value={paymentPhone}
                                                    onChange={(e) => {
                                                        setPaymentPhone(e.target.value);
                                                        if (isGuest) setAccountPhone(e.target.value);
                                                    }}
                                                    placeholder="07XX XXX XXX"
                                                    type="tel"
                                                    inputMode="numeric"
                                                    className="h-14 bg-white border-brand-100 focus:border-brand-400 rounded-2xl px-5 font-black text-brand-900 text-lg shadow-sm"
                                                />
                                                <p className="text-[9px] text-brand-700/60 ml-1 leading-relaxed">
                                                    Ingiza namba ya M-Pesa, TigoPesa, Airtel Money au HaloPesa. Utapata ujumbe wa kuweka PIN kwenye simu yako.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'card' && (
                                        <div className="p-10 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 text-center animate-in fade-in zoom-in-95">
                                            <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-4" />
                                            <p className="font-black text-slate-600 uppercase tracking-widest text-[10px]">Inakuja Hivi Karibuni</p>
                                            <p className="text-[11px] text-slate-400 mt-1">Kwa sasa tunapokea malipo ya simu pekee kwa usalama zaidi.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Fixed Footer */}
                    <div className="px-4 sm:px-6 pb-6 pt-4 bg-white border-t border-brand-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                        <form onSubmit={handleCheckout} className="space-y-4">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-400">{itemLabel}</span>
                                    <span className="text-sm font-black text-brand-900 truncate max-w-[150px] sm:max-w-[250px]">{itemTitle}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-400">Jumla</span>
                                    <p className="text-xl font-[900] text-brand-900">TZS {price.toLocaleString()}</p>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading || (paymentMethod === 'card' && !isPhysicalProduct)}
                                className="h-14 sm:h-16 w-full rounded-2xl sm:rounded-3xl bg-brand-600 hover:bg-brand-700 text-white font-black text-base sm:text-lg uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-all active:scale-[0.98] group"
                            >
                                {loading ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <>
                                        {isPhysicalProduct ? 'ANZISHA ODA' : 'Kamilisha Malipo'}
                                        <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </Button>

                            {!isPhysicalProduct && (
                                <div className="flex items-center gap-2 justify-center py-1">
                                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                                    <p className="text-[10px] font-bold text-slate-500">Malipo Yako Ni Salama (Secure Checkout)</p>
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                <ShopLocationsModal
                    isOpen={isShopLocationsOpen}
                    onOpenChange={setIsShopLocationsOpen}
                    locations={activeProduct?.merchant?.locations || []}
                    inventories={
                        activeProduct?.has_variants
                            ? (activeProduct.variants.find(v => v.id === selectedVariantId)?.location_inventories || [])
                            : (activeProduct?.location_inventories || [])
                    }
                    productName={activeProduct?.title || 'Bidhaa'}
                />
            </DrawerContent>
        </Drawer>
    );
}
