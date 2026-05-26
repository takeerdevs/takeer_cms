import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/Components/ui/Drawer';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Loader2, ShieldCheck, Zap, Store, Briefcase, ChevronRight, MapPin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePage } from '@inertiajs/react';
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api';

import AddressPickerModal from './AddressPickerModal';
import ShopLocationsModal from './ShopLocationsModal';
import UserAddressManager from './UserAddressManager';
import axios from 'axios';
import { checkoutAttributionFields, trackAttributionEvent } from '@/lib/attribution';
import { formatQuantity } from '@/lib/productUnits';

const DEFAULT_CENTER = {
    lat: -6.7924, // Dar es Salaam
    lng: 39.2083,
};

const COVERAGE_MAP_STYLE = {
    width: '100%',
    height: '220px',
    borderRadius: '16px',
};

const MAP_LIBRARIES = ['places'];

const formatKmRadius = (value) => {
    const radius = Number(value);
    if (!Number.isFinite(radius) || radius <= 0) return null;
    return radius % 1 === 0 ? radius.toLocaleString() : radius.toFixed(1);
};

const googleMapsUrl = (lat, lng) => {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
};

const extendBoundsByRadius = (bounds, lat, lng, radiusKm) => {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.max(Math.cos(lat * Math.PI / 180), 0.2));

    bounds.extend({ lat: lat + latDelta, lng });
    bounds.extend({ lat: lat - latDelta, lng });
    bounds.extend({ lat, lng: lng + lngDelta });
    bounds.extend({ lat, lng: lng - lngDelta });
};

function DeliveryCoverageMap({ anchors, customerLat, customerLng, height = 220 }) {
    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const mapRef = useRef(null);
    const validAnchors = useMemo(() => (
        anchors
            .map((anchor) => ({
                ...anchor,
                lat: Number(anchor.lat),
                lng: Number(anchor.lng),
                radius: Number(anchor.radius),
            }))
            .filter((anchor) => (
                Number.isFinite(anchor.lat)
                && Number.isFinite(anchor.lng)
                && Number.isFinite(anchor.radius)
                && anchor.radius > 0
            ))
    ), [anchors]);
    const customerPosition = useMemo(() => {
        const lat = Number(customerLat);
        const lng = Number(customerLng);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }, [customerLat, customerLng]);
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey,
        libraries: MAP_LIBRARIES,
    });
    const center = validAnchors[0]
        ? { lat: validAnchors[0].lat, lng: validAnchors[0].lng }
        : (customerPosition || DEFAULT_CENTER);

    useEffect(() => {
        if (!isLoaded || !mapRef.current || !window.google) return;

        const bounds = new window.google.maps.LatLngBounds();
        validAnchors.forEach((anchor) => {
            bounds.extend({ lat: anchor.lat, lng: anchor.lng });
            extendBoundsByRadius(bounds, anchor.lat, anchor.lng, anchor.radius);
        });
        if (customerPosition) bounds.extend(customerPosition);

        if (!bounds.isEmpty()) {
            mapRef.current.fitBounds(bounds, 24);
        }
    }, [isLoaded, validAnchors, customerPosition]);

    if (!googleMapsApiKey || !isLoaded || validAnchors.length === 0) return null;

    return (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm">
            <GoogleMap
                mapContainerStyle={{ ...COVERAGE_MAP_STYLE, height: `${height}px` }}
                center={center}
                zoom={12}
                onLoad={(map) => { mapRef.current = map; }}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    clickableIcons: false,
                }}
            >
                {validAnchors.map((anchor) => (
                    <React.Fragment key={`${anchor.label}-${anchor.lat}-${anchor.lng}-${anchor.radius}`}>
                        <Marker
                            position={{ lat: anchor.lat, lng: anchor.lng }}
                            title={anchor.label}
                        />
                        <Circle
                            center={{ lat: anchor.lat, lng: anchor.lng }}
                            radius={anchor.radius * 1000}
                            options={{
                                fillColor: '#0284c7',
                                fillOpacity: 0.12,
                                strokeColor: '#0284c7',
                                strokeOpacity: 0.8,
                                strokeWeight: 2,
                            }}
                        />
                    </React.Fragment>
                ))}
                {customerPosition && (
                    <Marker
                        position={customerPosition}
                        title="Anwani yako"
                        icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#dc2626',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 3,
                        }}
                    />
                )}
            </GoogleMap>
        </div>
    );
}


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
    const [shippingProfile, setShippingProfile] = useState(null);
    const [selectedShippingZoneId, setSelectedShippingZoneId] = useState('');
    const [physicalAddress, setPhysicalAddress] = useState('');
    const [selectedHotspot, setSelectedHotspot] = useState(null);
    const [loadingZones, setLoadingZones] = useState(false);
    const [isSelfPickupChoice, setIsSelfPickupChoice] = useState(false);
    const [extraAddressDetails, setExtraAddressDetails] = useState('');

    // Map Picker State
    const [customerLat, setCustomerLat] = useState(null);
    const [customerLng, setCustomerLng] = useState(null);
    const [customerCity, setCustomerCity] = useState('');
    const [customerRegion, setCustomerRegion] = useState('');
    const [customerCountry, setCustomerCountry] = useState(country?.name || '');
    const [customerCountryCode, setCustomerCountryCode] = useState(detectedIso2);
    const [customerCountryId, setCustomerCountryId] = useState(null);
    const [customerStateId, setCustomerStateId] = useState(null);
    const [customerCityId, setCustomerCityId] = useState(null);
    const [isAddressPickerOpen, setIsAddressPickerOpen] = useState(false);
    const [isShopLocationsOpen, setIsShopLocationsOpen] = useState(false);
    const [isCoverageMapOpen, setIsCoverageMapOpen] = useState(false);

    const [step, setStep] = useState(1); // 1: Details/Shipping, 2: Payment
    const [paymentMethod, setPaymentMethod] = useState('mobile'); // 'mobile', 'card'
    const [mobileSubMethod, setMobileSubMethod] = useState('account'); // 'account', 'other'
    const [couponCode, setCouponCode] = useState('');
    const [isCouponExpanded, setIsCouponExpanded] = useState(false);
    const [servicePricingInputs, setServicePricingInputs] = useState({
        people: '',
        hours: '',
        quantity: '',
        start_date: '',
        end_date: '',
    });

    const autocompleteRef = useRef(null);
    const checkoutStartKeyRef = useRef('');

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
        setCustomerCity('');
        setCustomerRegion('');
        setCustomerCountry(addr.country?.name || addr.forwarder?.country?.name || country?.name || '');
        setCustomerCountryCode(addr.country?.iso_alpha2 || addr.forwarder?.country?.iso_alpha2 || detectedIso2 || '');
        const addressCountryId = addr.country_id || addr.country?.id || addr.forwarder?.country_id || addr.forwarder?.country?.id || null;
        const addressStateId = addr.state_id || addr.state?.id || null;
        const addressCityId = addr.city_id || addr.city_record?.id || null;
        setCustomerCountryId(addressCountryId);
        setCustomerStateId(addressStateId);
        setCustomerCityId(addressCityId);

        findBestShippingZone(parseFloat(addr.latitude), parseFloat(addr.longitude), '', '', addr.country?.name || addr.forwarder?.country?.name || country?.name || '', addressCountryId, addressStateId, addressCityId);
    };

    const handleAddressSaved = async (data) => {
        setCustomerLat(data.lat);
        setCustomerLng(data.lng);
        setPhysicalAddress(data.address);
        setExtraAddressDetails(data.extraDetails);
        setCustomerCity(data.city || '');
        setCustomerRegion(data.region);
        setCustomerCountry(data.country || country?.name || '');
        setCustomerCountryCode(data.countryCode || detectedIso2 || '');
        setCustomerCountryId(null);
        setCustomerStateId(null);
        setCustomerCityId(null);
        findBestShippingZone(data.lat, data.lng, data.region, data.city || '', data.country || country?.name || '');

        // Persistent saving for authenticated users
        if (!isGuest) {
            try {
                const res = await axios.post('/api/me/addresses', {
                    type: 'local',
                    address_line: data.address,
                    extra_details: data.extraDetails,
                    latitude: data.lat,
                    longitude: data.lng,
                    country_name: data.country || undefined,
                    country_iso2: data.countryCode || undefined,
                    state_name: data.region || undefined,
                    city_name: data.city || undefined,
                    name: data.address.split(',')[0],
                    is_default: addresses.length === 0,
                });
                setAddresses(prev => [...prev, res.data.address]);
                setSelectedAddressId(res.data.address.id);
                setCustomerCountryId(res.data.address.country_id || res.data.address.country?.id || null);
                setCustomerStateId(res.data.address.state_id || res.data.address.state?.id || null);
                setCustomerCityId(res.data.address.city_id || res.data.address.city_record?.id || null);
                findBestShippingZone(
                    data.lat,
                    data.lng,
                    data.region,
                    data.city || '',
                    data.country || country?.name || '',
                    res.data.address.country_id || res.data.address.country?.id || null,
                    res.data.address.state_id || res.data.address.state?.id || null,
                    res.data.address.city_id || res.data.address.city_record?.id || null,
                );
            } catch (e) {
                console.error('Failed to persist address', e);
            }
        }
    };

    const normalizeLocationName = (value) => String(value || '').trim().toLowerCase();
    const intercityZoneCoversCustomer = (zone, lat, lng, region, city, buyerCountry = customerCountry, buyerCountryId = customerCountryId, buyerStateId = customerStateId, buyerCityId = customerCityId) => {
        const coverageScope = zone.coverage_scope || 'city_region';

        if (coverageScope === 'countrywide') {
            return Boolean(zone.destination_country_id && buyerCountryId && String(zone.destination_country_id) === String(buyerCountryId));
        }

        if (coverageScope === 'international') {
            return Boolean(zone.destination_country_id && buyerCountryId && String(zone.destination_country_id) === String(buyerCountryId));
        }

        if (zone.destination_city_id && buyerCityId && String(zone.destination_city_id) === String(buyerCityId)) return true;
        if (!zone.destination_city_id && zone.destination_state_id && buyerStateId && String(zone.destination_state_id) === String(buyerStateId)) return true;
        return false;
    };

    const findBestShippingZone = (lat, lng, region, city = customerCity, buyerCountry = customerCountry, buyerCountryId = customerCountryId, buyerStateId = customerStateId, buyerCityId = customerCityId) => {
        if (!shippingZones.length) return;

        setSelectedHotspot(null);
        const eligibleLocationIds = Array.isArray(activeProduct?.availability_location_ids)
            ? activeProduct.availability_location_ids.map((id) => String(id)).filter(Boolean)
            : [];
        const eligibleLocalZone = (zone) => (
            eligibleLocationIds.length === 0
            || !zone.merchant_location_id
            || eligibleLocationIds.includes(String(zone.merchant_location_id))
        );

        const profileAllowsZone = (zone) => {
            if (!shippingProfile) return true;
            if (zone.delivery_type === 'local_boda') return shippingProfile.in_city_enabled !== false;
            if (zone.coverage_scope === 'international') return shippingProfile.international_enabled === true;
            return shippingProfile.intercity_enabled !== false;
        };

        // 1. Try local delivery first. Same-city shop locations are preferred, with radius as a fallback.
        const localZones = shippingZones.filter(z => z.delivery_type === 'local_boda' && z.location && eligibleLocalZone(z) && profileAllowsZone(z));

        let bestLocalMatch = null;

        localZones.forEach(zone => {
            const dist = calculateHaversine(lat, lng, Number(zone.location.latitude), Number(zone.location.longitude));
            const radius = Number(zone.max_distance_km);
            const sameCity = buyerCityId && zone.location.city_id && String(zone.location.city_id) === String(buyerCityId);
            if (sameCity || dist <= radius) {
                const match = {
                    zone,
                    distance: dist,
                    radius: sameCity ? 0 : radius,
                    fee: Number(zone.flat_rate_fee || 0),
                };

                if (
                    !bestLocalMatch
                    || match.radius < bestLocalMatch.radius
                    || (match.radius === bestLocalMatch.radius && match.fee < bestLocalMatch.fee)
                    || (match.radius === bestLocalMatch.radius && match.fee === bestLocalMatch.fee && match.distance < bestLocalMatch.distance)
                ) {
                    bestLocalMatch = match;
                }
            }
        });

        if (bestLocalMatch) {
            setSelectedShippingZoneId(String(bestLocalMatch.zone.id));
            toast.info('Tumekupatia gharama ya usafiri ya local ya karibu!');
            return;
        }

        // 2. Inter-city: match the merchant's priced destination/region.
        let bestIntercityMatch = null;
        shippingZones
            .filter(z => z.delivery_type === 'intercity_bus')
            .filter(profileAllowsZone)
            .filter(z => intercityZoneCoversCustomer(z, lat, lng, region, city, buyerCountry, buyerCountryId, buyerStateId, buyerCityId))
            .forEach((zone) => {
                const directMatch = intercityZoneCoversCustomer(zone, lat, lng, region, city, buyerCountry, buyerCountryId, buyerStateId, buyerCityId);
                const coverageRank = zone.coverage_scope === 'city_region' ? 0 : (zone.coverage_scope === 'countrywide' ? 1 : (zone.coverage_scope === 'international' ? 2 : 3));
                const distance = coverageRank;
                const fee = Number(zone.flat_rate_fee || 0);

                if (!directMatch) return;

                const match = { zone, distance, fee };
                if (
                    !bestIntercityMatch
                    || match.distance < bestIntercityMatch.distance
                    || (match.distance === bestIntercityMatch.distance && match.fee < bestIntercityMatch.fee)
                ) {
                    bestIntercityMatch = match;
                }
            });

        if (bestIntercityMatch) {
            setSelectedShippingZoneId(String(bestIntercityMatch.zone.id));
            setSelectedHotspot(null);
            toast.info(Number(bestIntercityMatch.zone.flat_rate_fee || 0) > 0
                ? `Tumekupatia gharama ya inter-city: ${bestIntercityMatch.zone.zone_name}`
                : `Destination ya inter-city imepatikana: ${bestIntercityMatch.zone.zone_name}. Gharama itathibitishwa kwenye chat.`
            );
            return;
        }

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
            if (['bundle', 'offering_group'].includes(product?.checkoutType) || ['bundle', 'offering_group'].includes(product?.purchasable_type)) return;
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
                    setResolvedProduct({
                        ...data.product,
                        checkout_price: product?.checkout_price ?? data.product.checkout_price,
                        service_request_payment: product?.service_request_payment ?? data.product.service_request_payment,
                        service_request_id: product?.service_request_id ?? data.product.service_request_id,
                        service_request_token: product?.service_request_token ?? data.product.service_request_token,
                    });
                }
            } catch (e) { }
        };

        if (isOpen) fetchProductData();
    }, [isOpen, product]);

    const activeProduct = resolvedProduct || product || null;
    const itemType = activeProduct?.purchasable_type || activeProduct?.checkoutType || 'product';

    useEffect(() => {
        const isPhysicalCheckout = (itemType === 'product' && activeProduct?.type === 'physical')
            || (['bundle', 'offering_group'].includes(itemType) && activeProduct?.has_physical_items);
        if (!isOpen || !activeProduct || !isPhysicalCheckout) return;
        const profileId = activeProduct?.shipping_profile_id;
        const merchantSlug = activeProduct?.merchant?.slug || activeProduct?.merchant?.username;
        if (!profileId && !merchantSlug) return;

        const loadZones = async () => {
            setLoadingZones(true);
            try {
                const url = merchantSlug
                    ? `/api/merchant/${merchantSlug}/shipping-zones${profileId ? `?profile_id=${profileId}` : ''}`
                    : `/api/merchant/shipping-profiles/${profileId}/zones`;
                const res = await fetch(url, { headers: { Accept: 'application/json' } });
                const json = await res.json();
                if (res.ok && json.data) {
                    setShippingZones(json.data);
                    setShippingProfile(json.profile || null);
                    // Reset selected zone when zones reload
                    setSelectedShippingZoneId('');
                }
            } catch (e) { } finally {
                setLoadingZones(false);
            }
        };
        loadZones();
    }, [isOpen, activeProduct?.id, activeProduct?.shipping_profile_id, activeProduct?.has_physical_items, itemType]);

    useEffect(() => {
        if (!isOpen || isSelfPickupChoice || !shippingZones.length || !customerLat || !customerLng) return;
        findBestShippingZone(customerLat, customerLng, customerRegion, customerCity, customerCountry, customerCountryId);
    }, [isOpen, isSelfPickupChoice, shippingZones.length, customerLat, customerLng, customerRegion, customerCity, customerCountry, customerCountryId, shippingProfile?.outside_area_policy]);

    const itemTitle = activeProduct?.title || activeProduct?.name || 'Inapatikana kwa malipo';
    const requiresOwnedStock = activeProduct?.type === 'physical' && (activeProduct?.fulfillment_mode || 'own_stock') === 'own_stock';
    const variants = useMemo(() => (
        (activeProduct?.variants || []).filter((variant) => (
            variant?.is_active !== false && (!requiresOwnedStock || Number(variant?.inventory_count || 0) > 0)
        ))
    ), [activeProduct?.variants, requiresOwnedStock]);
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
    const productOriginCountryIds = useMemo(() => {
        const merchantLocations = Array.isArray(activeProduct?.merchant?.locations)
            ? activeProduct.merchant.locations
            : [];
        const explicitLocationIds = new Set(
            (Array.isArray(activeProduct?.availability_location_ids) ? activeProduct.availability_location_ids : [])
                .map((id) => String(id))
                .filter(Boolean)
        );
        const inventoryRows = activeProduct?.has_variants
            ? (selectedVariant?.location_inventories || [])
            : (activeProduct?.location_inventories || []);

        inventoryRows.forEach((row) => {
            const quantity = Number(row?.quantity_decimal ?? row?.quantity ?? row?.available_quantity ?? row?.inventory_quantity ?? 0);
            if (row?.merchant_location_id && quantity > 0) {
                explicitLocationIds.add(String(row.merchant_location_id));
            }
        });

        const relevantLocations = explicitLocationIds.size > 0
            ? merchantLocations.filter((location) => explicitLocationIds.has(String(location.id)))
            : merchantLocations;

        return [...new Set(relevantLocations
            .map((location) => location.country_id || location.country?.id)
            .filter(Boolean)
            .map(String))];
    }, [
        activeProduct?.availability_location_ids,
        activeProduct?.has_variants,
        activeProduct?.location_inventories,
        activeProduct?.merchant?.locations,
        selectedVariant?.location_inventories,
    ]);
    const hasExplicitCheckoutPrice = activeProduct?.checkout_price !== undefined && activeProduct?.checkout_price !== null;
    const selectedServiceOption = activeProduct?.selected_service_option || null;
    const isVariantSelectionComplete = !activeProduct?.has_variants
        || variantAttributeKeys.every((key) => (variantFilters[key] || '').toString().trim().length > 0);
    const variablePricingUnits = ['hourly', 'daily', 'nightly', 'weekly', 'monthly', 'yearly', 'per_person', 'per_visit', 'per_session', 'per_project'];
    const includedCheckoutCharges = Array.isArray(activeProduct?.service_charges)
        ? activeProduct.service_charges.filter((charge) => charge?.included_in_checkout && Number(charge.amount || 0) > 0)
        : [];
    const activePricingUnits = [
        activeProduct?.type === 'service' && !hasExplicitCheckoutPrice ? (selectedServiceOption?.price_display || activeProduct?.service_price_display) : null,
        ...(!hasExplicitCheckoutPrice ? includedCheckoutCharges.map((charge) => charge.unit || 'fixed') : []),
    ].filter((unit) => variablePricingUnits.includes(unit));
    const needsPeopleInput = activePricingUnits.includes('per_person');
    const needsHoursInput = activePricingUnits.includes('hourly');
    const needsDateRangeInput = activePricingUnits.some((unit) => ['daily', 'nightly', 'weekly', 'monthly', 'yearly'].includes(unit));
    const needsQuantityInput = activePricingUnits.some((unit) => ['per_visit', 'per_session', 'per_project'].includes(unit));
    const servicePricingMultiplier = (unit) => {
        const start = servicePricingInputs.start_date ? new Date(`${servicePricingInputs.start_date}T00:00:00`) : null;
        const end = servicePricingInputs.end_date ? new Date(`${servicePricingInputs.end_date}T00:00:00`) : null;
        const daySpan = start && end && end > start
            ? Math.max(1, Math.round((end - start) / 86400000))
            : 1;

        switch (unit) {
            case 'hourly':
                return Math.max(1, Number(servicePricingInputs.hours || 1));
            case 'daily':
                return daySpan + 1;
            case 'nightly':
                return daySpan;
            case 'weekly':
                return Math.max(1, Math.ceil(daySpan / 7));
            case 'monthly':
                return Math.max(1, Math.ceil(daySpan / 30));
            case 'yearly':
                return Math.max(1, Math.ceil(daySpan / 365));
            case 'per_person':
                return Math.max(1, Number(servicePricingInputs.people || 1));
            case 'per_visit':
            case 'per_session':
            case 'per_project':
                return Math.max(1, Number(servicePricingInputs.quantity || 1));
            default:
                return 1;
        }
    };
    const checkoutIncludedCharges = useMemo(() => (
        Array.isArray(activeProduct?.service_charges)
            ? activeProduct.service_charges.filter((charge) => (
                charge?.included_in_checkout
                && Number(charge.amount || 0) > 0
            ))
            : []
    ), [activeProduct?.service_charges]);
    const checkoutIncludedChargesTotal = useMemo(() => (
        checkoutIncludedCharges.reduce((sum, charge) => sum + (Number(charge.amount || 0) * servicePricingMultiplier(charge.unit || 'fixed')), 0)
    ), [checkoutIncludedCharges, servicePricingInputs]);

    const rawBasePrice = parseFloat((activeProduct?.checkout_price ?? selectedVariant?.price ?? selectedServiceOption?.price ?? activeProduct?.price) || 0);
    const unitType = activeProduct?.unit_type || null;
    const unitSymbol = unitType?.symbol || unitType?.name || 'unit';
    const sellableQuantity = Math.max(0.001, Number(activeProduct?.sellable_quantity || 1));
    const requestedPhysicalQuantity = sellableQuantity;
    const packageContentQuantity = Number(activeProduct?.package_content_quantity || 0);
    const packageContentUnit = activeProduct?.package_content_unit_type || null;
    const checkoutQuantitySummary = packageContentQuantity && packageContentUnit
        ? '1 package'
        : `${formatQuantity(sellableQuantity)} ${unitSymbol}`;
    const serviceBaseMultiplier = activeProduct?.type === 'service' && !hasExplicitCheckoutPrice
        ? servicePricingMultiplier(selectedServiceOption?.price_display || activeProduct?.service_price_display)
        : 1;
    const physicalBaseMultiplier = activeProduct?.type === 'physical' ? (requestedPhysicalQuantity / sellableQuantity) : 1;
    const basePrice = (rawBasePrice * serviceBaseMultiplier * physicalBaseMultiplier) + (!hasExplicitCheckoutPrice && activeProduct?.type === 'service' ? checkoutIncludedChargesTotal : 0);
    const isPhysicalProduct = (itemType === 'product' && activeProduct?.type === 'physical')
        || (['bundle', 'offering_group'].includes(itemType) && activeProduct?.has_physical_items);
    const serviceMode = activeProduct?.service_mode || (
        activeProduct?.service_is_showcase || activeProduct?.service_pricing_model === 'showcase_only'
            ? 'showcase_only'
            : activeProduct?.service_pricing_model === 'contract_quote'
                ? 'request_quote'
                : 'pay_now'
    );
    const servicePriceDisplay = activeProduct?.service_price_display || (
        activeProduct?.service_pricing_model === 'hourly_rate'
            ? 'hourly'
            : activeProduct?.service_pricing_model === 'contract_quote'
                ? 'quote_only'
                : 'fixed'
    );
    const startsAsServiceInquiry = itemType === 'product'
        && activeProduct?.type === 'service'
        && !activeProduct?.service_request_payment
        && !activeProduct?.service_request_id
        && (
            serviceMode === 'request_quote'
            || activeProduct?.service_pricing_model === 'contract_quote'
            || servicePriceDisplay === 'quote_only'
            || ['request', 'manual_confirm'].includes(activeProduct?.service_booking_type || '')
        );
    const fulfillmentMode = activeProduct?.fulfillment_mode || 'own_stock';
    const fulfillmentLeadTimeLabel = fulfillmentMode === 'supplier_sourced' && activeProduct?.availability_lead_time_hours
        ? `Estimated confirmation: ${activeProduct.availability_lead_time_hours} hour${Number(activeProduct.availability_lead_time_hours) === 1 ? '' : 's'}`
        : activeProduct?.availability_lead_time_days
            ? `Estimated preparation: ${activeProduct.availability_lead_time_days} day${Number(activeProduct.availability_lead_time_days) === 1 ? '' : 's'}`
            : null;
    const checkoutFulfillmentGuidance = isPhysicalProduct && itemType === 'product' ? ({
        supplier_sourced: {
            title: 'Availability confirmation',
            body: 'The seller will source and confirm this item after your order. Payment stays protected while fulfillment is confirmed.',
        },
        made_to_order: {
            title: 'Made after order',
            body: 'The seller starts preparing or crafting this item after your order is confirmed. Delivery begins when it is ready.',
        },
        farm_harvest: {
            title: 'Harvest / farm stock',
            body: 'The seller will fulfill this from harvest or farm stock around the expected availability date.',
        },
        preorder: {
            title: 'Preorder',
            body: 'This item is ordered before it is ready. Fulfillment starts around the expected availability date.',
        },
        group_sale: {
            title: 'Group sale preorder',
            body: 'This order follows the group sale target and campaign timing.',
        },
    }[fulfillmentMode] || null) : null;
    const activeShippingZone = shippingZones.find(z => String(z.id) === String(selectedShippingZoneId));
    const isPickup = isSelfPickupChoice || activeShippingZone?.delivery_type === 'self_pickup';
    const shippingFee = (activeShippingZone && isPhysicalProduct && !isSelfPickupChoice) ? parseFloat(activeShippingZone.flat_rate_fee || 0) : 0;
    const price = basePrice + shippingFee;
    const formatPromiseDayRange = (min, max) => {
        const a = min !== null && min !== undefined && min !== '' ? Number(min) : null;
        const b = max !== null && max !== undefined && max !== '' ? Number(max) : null;
        if (a === null && b === null) return '';
        if (a !== null && b !== null && a !== b) return `${a}-${b} days`;
        const value = b ?? a;
        if (value === 0) return 'same day';
        if (value === 1) return '1 day';
        return `${value} days`;
    };
    const deliveryPromiseSource = activeProduct?.delivery_promise?.override_enabled
        ? activeProduct.delivery_promise
        : activeShippingZone;
    const deliveryPromiseText = (() => {
        const promise = deliveryPromiseSource || {};
        const label = promise.label || promise.delivery_promise_label;
        if (label) return label;
        if (promise.requires_confirmation || promise.requires_delivery_confirmation) return 'Delivery time will be confirmed in order chat';
        const handling = formatPromiseDayRange(promise.handling_min_days, promise.handling_max_days);
        const transit = formatPromiseDayRange(promise.transit_min_days, promise.transit_max_days);
        if (handling && transit) return `${handling} preparation + ${transit} delivery`;
        return transit || handling || '';
    })();
    const deliveryPromiseNote = deliveryPromiseSource?.note || deliveryPromiseSource?.delivery_promise_note || '';
    const deliveryCutoffTime = deliveryPromiseSource?.cutoff_time;
    const deliveryCoverageAnchors = useMemo(() => {
        const anchors = new Map();

        shippingZones
            .filter((zone) => (
                zone?.is_active !== false
                && zone?.delivery_type === 'local_boda'
                && Number(zone?.max_distance_km) > 0
            ))
            .forEach((zone) => {
                const location = zone.location || {};
                const lat = location.latitude ?? zone.reference_lat;
                const lng = location.longitude ?? zone.reference_lng;
                const key = location.id
                    ? `location-${location.id}`
                    : `${lat || 'unknown'}-${lng || 'unknown'}-${location.address || zone.reference_name || zone.zone_name || 'business'}`;
                const current = anchors.get(key);
                const radius = Number(zone.max_distance_km);

                if (current && current.radius >= radius) return;

                anchors.set(key, {
                    radius,
                    radiusLabel: formatKmRadius(radius),
                    lat: Number(lat),
                    lng: Number(lng),
                    label: location.address || location.name || zone.reference_name || zone.zone_name || 'eneo la biashara',
                    mapUrl: googleMapsUrl(lat, lng),
                });
            });

        return Array.from(anchors.values()).filter((anchor) => anchor.radiusLabel);
    }, [shippingZones]);
    const hasCustomerDeliveryLocation = Boolean(customerLat && customerLng);
    const blocksOutsideAreas = (shippingProfile?.outside_area_policy || 'inquiry') === 'block';
    const isOutsideFulfillmentArea = isPhysicalProduct && !isPickup && hasCustomerDeliveryLocation && !activeShippingZone;
    const isOutsideAreaBlocked = isOutsideFulfillmentArea && blocksOutsideAreas;
    const isCheckoutDisabledByDeliveryArea = isOutsideAreaBlocked;
    const sortedDeliveryCoverageAnchors = useMemo(() => {
        const lat = Number(customerLat);
        const lng = Number(customerLng);
        const hasCustomerPoint = Number.isFinite(lat) && Number.isFinite(lng);

        return [...deliveryCoverageAnchors].sort((a, b) => {
            if (!hasCustomerPoint) return 0;
            const aDistance = Number.isFinite(a.lat) && Number.isFinite(a.lng)
                ? calculateHaversine(lat, lng, a.lat, a.lng)
                : Number.POSITIVE_INFINITY;
            const bDistance = Number.isFinite(b.lat) && Number.isFinite(b.lng)
                ? calculateHaversine(lat, lng, b.lat, b.lng)
                : Number.POSITIVE_INFINITY;

            return aDistance - bDistance;
        });
    }, [deliveryCoverageAnchors, customerLat, customerLng]);
    const coveragePreviewLabels = sortedDeliveryCoverageAnchors
        .slice(0, 2)
        .map((anchor) => anchor.label)
        .filter(Boolean);
    const radiusCoverageMessage = deliveryCoverageAnchors.length
        ? (deliveryCoverageAnchors.length === 1
            ? `Tunasafirisha ndani ya kilomita ${deliveryCoverageAnchors[0].radiusLabel} kutoka ${deliveryCoverageAnchors[0].label}.`
            : `Tunasafirisha ndani ya maeneo ${deliveryCoverageAnchors.length} ya biashara${coveragePreviewLabels.length ? `, ikiwemo ${coveragePreviewLabels.join(' na ')}` : ''}.`)
        : 'Huduma ya kufikisha haipatikani kwenye eneo ulilochagua.';
    const intercityDestinations = useMemo(() => (
        shippingZones
            .filter((zone) => zone?.is_active !== false && zone?.delivery_type === 'intercity_bus')
            .map((zone) => {
                if (zone.coverage_scope === 'countrywide') return `nchi nzima${zone.destination_country ? ` (${zone.destination_country})` : ''}`;
                if (zone.coverage_scope === 'international') return `international: ${zone.destination_country || zone.zone_name}`;
                return zone.destination_city || zone.zone_name || zone.destination_region;
            })
            .filter(Boolean)
            .filter((value, index, values) => values.indexOf(value) === index)
    ), [shippingZones]);
    const intercityCoverageMessage = intercityDestinations.length
        ? ` Inter-city inapatikana kwenda: ${intercityDestinations.join(', ')}.`
        : '';
    const outsideAreaMessage = `${radiusCoverageMessage}${intercityCoverageMessage} Chagua anwani iliyo karibu au pickup (Kuchukua mwenyewe)`;
    const radiusCoverageNode = deliveryCoverageAnchors.length === 1 ? (
        <span>
            Tunasafirisha ndani ya kilomita {deliveryCoverageAnchors[0].radiusLabel} kutoka{' '}
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    setIsCoverageMapOpen(true);
                }}
                className="underline decoration-amber-700/40 underline-offset-2 hover:text-amber-700"
            >
                {deliveryCoverageAnchors[0].label}
            </button>
            .
        </span>
    ) : deliveryCoverageAnchors.length > 1 ? (
        <span>
            Tunasafirisha ndani ya maeneo {deliveryCoverageAnchors.length} ya biashara
            {coveragePreviewLabels.length ? `, ikiwemo ${coveragePreviewLabels.join(' na ')}` : ''}.{' '}
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    setIsCoverageMapOpen(true);
                }}
                className="underline decoration-amber-700/40 underline-offset-2 hover:text-amber-700"
            >
                Fungua ramani
            </button>{' '}
            kuona yote.
        </span>
    ) : (
        <span>Huduma ya kufikisha haipatikani kwenye eneo ulilochagua.</span>
    );
    const isIntercityDelivery = activeShippingZone?.delivery_type === 'intercity_bus';
    const isInternationalDelivery = activeShippingZone?.coverage_scope === 'international';
    const isCountrywideDelivery = activeShippingZone?.coverage_scope === 'countrywide';
    const matchedShippingFeeLabel = Number(activeShippingZone?.flat_rate_fee || 0) > 0
        ? `Fee TZS ${Number(activeShippingZone.flat_rate_fee || 0).toLocaleString()}`
        : (isIntercityDelivery ? 'Shipping fee will be confirmed in order chat' : 'Free shipping');
    const intercityDestinationLabel = isInternationalDelivery
        ? (activeShippingZone?.destination_country || activeShippingZone?.zone_name)
        : (isCountrywideDelivery
            ? `country-wide${activeShippingZone?.destination_country ? ` (${activeShippingZone.destination_country})` : ''}`
            : (activeShippingZone?.destination_city || activeShippingZone?.zone_name || activeShippingZone?.destination_region));

    // Step management based on product type
    useEffect(() => {
        if (isOpen) {
            const urlCoupon = typeof window !== 'undefined'
                ? new URLSearchParams(window.location.search).get('coupon')
                : '';
            setServicePricingInputs({
                people: '',
                hours: '',
                quantity: '',
                start_date: '',
                end_date: '',
            });
            setCouponCode(urlCoupon || '');
            setIsCouponExpanded(Boolean(urlCoupon));
            if (isPhysicalProduct) {
                setStep(1); // Physical always stays in one "Details" view
            } else {
                setStep(2); // Digital always stays in "Payment" view
            }
        }
    }, [isOpen, isPhysicalProduct]);

    useEffect(() => {
        if (!isOpen || !activeProduct?.id) return;

        const key = `${itemType}:${activeProduct.id}:${activeProduct.group_sale_campaign_id || activeProduct.group_sale_offer?.id || 'standard'}`;
        if (checkoutStartKeyRef.current === key) return;
        checkoutStartKeyRef.current = key;

        trackAttributionEvent('checkout_started', {
            entity_type: itemType,
            entity_id: activeProduct.id,
            merchant_id: activeProduct?.merchant?.id || null,
            value: price || null,
            coupon_code: couponCode.trim() || undefined,
            metadata: {
                product_type: activeProduct?.type || null,
                group_sale_campaign_id: activeProduct.group_sale_campaign_id || activeProduct.group_sale_offer?.id || null,
            },
        });
    }, [isOpen, activeProduct?.id, itemType]);

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

        if (isOutsideAreaBlocked) {
            return toast.error(outsideAreaMessage);
        }

        if (activeProduct?.type === 'service' && !startsAsServiceInquiry) {
            if (needsPeopleInput && Number(servicePricingInputs.people || 0) < 1) {
                return toast.error("Tafadhali weka idadi ya watu/wageni.");
            }
            if (needsHoursInput && Number(servicePricingInputs.hours || 0) <= 0) {
                return toast.error("Tafadhali weka idadi ya saa.");
            }
            if (needsQuantityInput && Number(servicePricingInputs.quantity || 0) < 1) {
                return toast.error("Tafadhali weka quantity.");
            }
            if (needsDateRangeInput && (!servicePricingInputs.start_date || !servicePricingInputs.end_date || servicePricingInputs.end_date <= servicePricingInputs.start_date)) {
                return toast.error("Tafadhali chagua tarehe ya kuanza na kumaliza.");
            }
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
                ...checkoutAttributionFields(),
                variant_id: selectedVariantId || undefined,
                account_phone: normalizedAccountPhone,
                payment_number: isPhysicalProduct ? normalizedAccountPhone : resolvedPaymentPhone,
                buyer_name: name || (isGuest ? 'Guest' : undefined),
                country_iso2: detectedIso2 || undefined,
                user_address_id: isPhysicalProduct && selectedAddressId ? selectedAddressId : undefined,
                delivery_type: isPhysicalProduct ? (isSelfPickupChoice ? 'self_pickup' : 'shipping') : undefined,
                delivery_zone_id: (isPhysicalProduct && !isSelfPickupChoice) ? selectedShippingZoneId : undefined,
                customer_city: isPhysicalProduct ? (customerCity || undefined) : undefined,
                customer_region: isPhysicalProduct ? (customerRegion || undefined) : undefined,
                customer_country: isPhysicalProduct ? (customerCountry || undefined) : undefined,
                customer_country_iso2: isPhysicalProduct ? (customerCountryCode || detectedIso2 || undefined) : undefined,
                customer_country_id: isPhysicalProduct ? (customerCountryId || undefined) : undefined,
                customer_state_id: isPhysicalProduct ? (customerStateId || undefined) : undefined,
                customer_city_id: isPhysicalProduct ? (customerCityId || undefined) : undefined,
                quantity: isPhysicalProduct && itemType === 'product' ? requestedPhysicalQuantity : 1,
                idempotency_key: `q-${itemType}-${activeProduct.id}-${activeProduct.service_request_payment?.id || activeProduct.service_request_id || 'standard'}-${Date.now()}`,
                buyer_lat: isPhysicalProduct ? customerLat : undefined,
                buyer_lng: isPhysicalProduct ? customerLng : undefined,
                physical_address: isPhysicalProduct ? (extraAddressDetails ? `${physicalAddress} (${extraAddressDetails})` : physicalAddress) : undefined,
                shipping_hotspot_id: undefined,
                payment_page_id: activeProduct.payment_page_id || undefined,
                coupon_code: couponCode.trim() || undefined,
                group_sale_campaign_id: activeProduct.group_sale_campaign_id || activeProduct.group_sale_offer?.id || undefined,
                service_request_id: activeProduct.service_request_payment?.id || activeProduct.service_request_id || product?.service_request_payment?.id || product?.service_request_id || undefined,
                service_request_token: activeProduct.service_request_payment?.token || activeProduct.service_request_token || product?.service_request_payment?.token || product?.service_request_token || undefined,
                service_pricing_inputs: activeProduct?.type === 'service' ? {
                    people: servicePricingInputs.people ? Number(servicePricingInputs.people) : undefined,
                    hours: servicePricingInputs.hours ? Number(servicePricingInputs.hours) : undefined,
                    quantity: servicePricingInputs.quantity ? Number(servicePricingInputs.quantity) : undefined,
                    start_date: servicePricingInputs.start_date || undefined,
                    end_date: servicePricingInputs.end_date || undefined,
                    service_option_id: selectedServiceOption?.id || undefined,
                } : undefined,
                selected_bundle_items: itemType === 'bundle' ? (activeProduct.selected_bundle_items || undefined) : undefined,
                selected_offering_group_items: itemType === 'offering_group' ? (activeProduct.selected_offering_group_items || undefined) : undefined,
            };

            const isInquiry = isPhysicalProduct || startsAsServiceInquiry || Boolean(activeProduct?.requires_inquiry);

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

            const successMessage = isInquiry
                ? (data.message || 'Oda yako imeanzishwa! Sasa mnawasiliana na muuzaji.')
                : (data.message || 'Malipo yameanzishwa! Kamilisha malipo kwenye simu yako.');

            toast.success(successMessage);
            onOpenChange(false);

            if (isInquiry) {
                setTimeout(() => {
                    window.location.href = `/chat/${data.order.public_id}`;
                }, 1000);
            } else if (itemType === 'offering_group') {
                setTimeout(() => {
                    window.location.href = '/orders';
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
        'offering_group': 'Malipo ya Offering',
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
        <>
            <Drawer open={isOpen} onOpenChange={onOpenChange}>
                <DrawerContent className="w-full sm:max-w-xl sm:mx-auto p-0 border border-brand-100/70 dark:border-brand-900/60 bg-background dark:bg-slate-950 shadow-2xl shadow-brand-900/10 dark:shadow-black/50 rounded-t-[2.5rem] overflow-hidden">
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
                                <span className="font-black text-xs uppercase tracking-[0.2em] text-white/90">Malipo ya Haraka</span>
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
                                                    productOriginCountryIds={productOriginCountryIds}
                                                    destinationCountryId={customerCountryId || country?.id || null}
                                                />
                                                {hasCustomerDeliveryLocation && (
                                                    <div className={`rounded-2xl border px-3 py-3 text-xs font-bold ${activeShippingZone
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                                        : isOutsideAreaBlocked
                                                            ? 'border-red-200 bg-red-50 text-red-900'
                                                            : 'border-amber-200 bg-amber-50 text-amber-900'
                                                        }`}>
                                                        {isInternationalDelivery ? (
                                                            <span>
                                                                International shipping to {intercityDestinationLabel}. {matchedShippingFeeLabel}{deliveryPromiseText ? ` · ${deliveryPromiseText}` : ''}. Customs, courier office, and final handoff can be confirmed in order chat.
                                                            </span>
                                                        ) : isIntercityDelivery ? (
                                                            <span>
                                                                Inter-city shipping to {intercityDestinationLabel}. {matchedShippingFeeLabel}{deliveryPromiseText ? ` · ${deliveryPromiseText}` : ''}. Exact pickup/drop-off office will be confirmed by transporter or waybill.
                                                            </span>
                                                        ) : activeShippingZone ? (
                                                            deliveryCoverageAnchors.length ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setIsCoverageMapOpen(true)}
                                                                    className="text-right underline decoration-emerald-700/30 underline-offset-2 hover:text-emerald-700"
                                                                >
                                                                    Delivery {matchedShippingFeeLabel}{deliveryPromiseText ? ` · ${deliveryPromiseText}` : ''}.
                                                                </button>
                                                            ) : (
                                                                <span>
                                                                    Delivery {matchedShippingFeeLabel}{deliveryPromiseText ? ` · ${deliveryPromiseText}` : ''}.
                                                                </span>
                                                            )
                                                        ) : isOutsideAreaBlocked ? (
                                                            <>
                                                                <span>{radiusCoverageNode} Chagua anwani iliyo karibu, pickup, au muuzaji mwingine.</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>
                                                                    Anwani hii iko nje ya eneo la kawaida la kufikisha. Muuzaji bado anaweza kuikagua oda na kuthibitisha kwenye chat. {radiusCoverageNode}
                                                                </span>
                                                            </>
                                                        )}
                                                        {(deliveryCutoffTime || deliveryPromiseNote) && (
                                                            <div className="mt-2 text-[11px] font-semibold leading-4 opacity-80">
                                                                {deliveryCutoffTime && <span>Order before {String(deliveryCutoffTime).slice(0, 5)} for this estimate. </span>}
                                                                {deliveryPromiseNote && <span>{deliveryPromiseNote}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
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
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <Input
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Andika jina lako..."
                                                className="h-14 bg-white border-brand-100 focus:border-brand-400 rounded-2xl px-5 font-bold text-brand-900 shadow-sm"
                                            />
                                            <Input
                                                value={accountPhone}
                                                onChange={(e) => setAccountPhone(e.target.value)}
                                                placeholder="Namba ya simu"
                                                type="tel"
                                                inputMode="numeric"
                                                className="h-14 bg-white border-brand-100 focus:border-brand-400 rounded-2xl px-5 font-bold text-brand-900 shadow-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    {isGuest && (
                                        <Input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Andika jina lako..."
                                            className="h-14 bg-white border-brand-100 focus:border-brand-400 rounded-2xl px-5 font-bold text-brand-900 shadow-sm"
                                        />
                                    )}

                                    {/* Digital: Payment Selection Tabs */}
                                    <div className="space-y-4">
                                        <div className="flex p-1 bg-brand-50/50 dark:bg-slate-800 rounded-2xl border border-brand-100 dark:border-slate-700">
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('mobile')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'mobile' ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-md ring-1 ring-brand-100' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                <Zap className={`h-3.5 w-3.5 ${paymentMethod === 'mobile' ? 'fill-current' : ''}`} />
                                                Lipa kwa Simu
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentMethod('card')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'card' ? 'bg-white dark:bg-slate-900 text-brand-600 shadow-md ring-1 ring-brand-100' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                <Briefcase className="h-3.5 w-3.5" />
                                                Lipa kwa Kadi
                                            </button>
                                        </div>

                                        {paymentMethod === 'mobile' && (
                                            <div className="p-4 rounded-3xl bg-brand-50/30 border border-brand-100 space-y-3 animate-in fade-in slide-in-from-top-2">
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

                            {activeProduct?.type === 'service' && !startsAsServiceInquiry && activePricingUnits.length > 0 && (
                                <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3 sm:p-4 space-y-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wider text-brand-700/80">Booking details</p>
                                        <p className="text-[11px] text-brand-700/70 mt-0.5">Used to calculate service charges before payment.</p>
                                        {selectedServiceOption && (
                                            <p className="text-xs font-black text-brand-900 mt-2">
                                                {selectedServiceOption.name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {needsPeopleInput && (
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-bold text-brand-700/80">People / guests</span>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={servicePricingInputs.people}
                                                    onChange={(e) => setServicePricingInputs((prev) => ({ ...prev, people: e.target.value }))}
                                                    placeholder="Mf. 2"
                                                    className="h-12 bg-white rounded-xl font-bold"
                                                />
                                            </label>
                                        )}
                                        {needsHoursInput && (
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-bold text-brand-700/80">Hours</span>
                                                <Input
                                                    type="number"
                                                    min="0.25"
                                                    step="0.25"
                                                    value={servicePricingInputs.hours}
                                                    onChange={(e) => setServicePricingInputs((prev) => ({ ...prev, hours: e.target.value }))}
                                                    placeholder="Mf. 3"
                                                    className="h-12 bg-white rounded-xl font-bold"
                                                />
                                            </label>
                                        )}
                                        {needsQuantityInput && (
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-bold text-brand-700/80">Quantity</span>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={servicePricingInputs.quantity}
                                                    onChange={(e) => setServicePricingInputs((prev) => ({ ...prev, quantity: e.target.value }))}
                                                    placeholder="Mf. 1"
                                                    className="h-12 bg-white rounded-xl font-bold"
                                                />
                                            </label>
                                        )}
                                        {needsDateRangeInput && (
                                            <>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-brand-700/80">Start / check-in</span>
                                                    <Input
                                                        type="date"
                                                        value={servicePricingInputs.start_date}
                                                        onChange={(e) => setServicePricingInputs((prev) => ({ ...prev, start_date: e.target.value }))}
                                                        className="h-12 bg-white rounded-xl font-bold"
                                                    />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-bold text-brand-700/80">End / check-out</span>
                                                    <Input
                                                        type="date"
                                                        value={servicePricingInputs.end_date}
                                                        onChange={(e) => setServicePricingInputs((prev) => ({ ...prev, end_date: e.target.value }))}
                                                        className="h-12 bg-white rounded-xl font-bold"
                                                    />
                                                </label>
                                            </>
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
                                        {isPhysicalProduct && itemType === 'product' && unitType && (
                                            <span className="text-[11px] font-bold text-slate-500">
                                                {checkoutQuantitySummary}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-400">Jumla</span>
                                        <p className="text-xl font-[900] text-brand-900">TZS {price.toLocaleString()}</p>
                                        {checkoutIncludedChargesTotal > 0 && activeProduct?.type === 'service' && (
                                            <p className="text-[10px] font-bold text-emerald-700">
                                                Includes TZS {checkoutIncludedChargesTotal.toLocaleString()} extras
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {!isPhysicalProduct && (
                                    <div className="rounded-2xl border border-brand-100 bg-brand-50/40">
                                        <button
                                            type="button"
                                            onClick={() => setIsCouponExpanded((expanded) => !expanded)}
                                            aria-expanded={isCouponExpanded}
                                            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                                                {couponCode ? 'Punguzo limeongezwa' : 'Una kodi ya punguzo?'}
                                            </span>
                                            <ChevronRight className={`h-4 w-4 text-brand-500 transition-transform ${isCouponExpanded ? 'rotate-90' : ''}`} />
                                        </button>

                                        {isCouponExpanded && (
                                            <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1">
                                                <Input
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                    placeholder="LAUNCH25"
                                                    className="h-11 rounded-xl bg-white font-black tracking-wide"
                                                />
                                                <p className="mt-1 text-[10px] font-semibold text-brand-700/70">
                                                    Punguzo litahakikiwa unapoanza malipo.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {checkoutFulfillmentGuidance && (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                                        <div className="flex items-start gap-2">
                                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                            <div>
                                                <p className="text-xs font-black text-blue-900">
                                                    {checkoutFulfillmentGuidance.title}
                                                </p>
                                                <p className="mt-1 text-[11px] font-semibold leading-5 text-blue-800/80">
                                                    {checkoutFulfillmentGuidance.body}
                                                </p>
                                            </div>
                                        </div>
                                        {(fulfillmentLeadTimeLabel || activeProduct?.available_from) && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {fulfillmentLeadTimeLabel && (
                                                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-blue-800">
                                                        {fulfillmentLeadTimeLabel}
                                                    </span>
                                                )}
                                                {activeProduct?.available_from && (
                                                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-blue-800">
                                                        Expected availability: {activeProduct.available_from}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <p className="mt-2 text-[10px] font-bold text-blue-700/80">
                                            Takeer protects payment until fulfillment or receipt confirmation.
                                        </p>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    disabled={loading || (paymentMethod === 'card' && !isPhysicalProduct) || isCheckoutDisabledByDeliveryArea}
                                    className={`h-14 sm:h-16 w-full rounded-2xl sm:rounded-3xl text-white font-black text-base sm:text-lg uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] group ${isCheckoutDisabledByDeliveryArea
                                        ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                        : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/20'
                                        }`}
                                >
                                    {loading ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        <>
                                            {isPhysicalProduct ? 'Anzisha Oda' : 'Kamilisha Malipo'}
                                            <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </Button>

                                {!isPhysicalProduct && (
                                    <div className="flex items-center gap-2 justify-center py-1">
                                        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                                        <p className="text-[10px] font-bold text-slate-500">Malipo Yako Ni Salama</p>
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
            <Drawer open={isCoverageMapOpen} onOpenChange={setIsCoverageMapOpen} shouldScaleBackground={false}>
                <DrawerContent className="w-full sm:max-w-2xl sm:mx-auto border border-brand-100 bg-white p-0 rounded-t-[2rem] overflow-hidden">
                    <DrawerHeader className="text-left px-5 py-4 border-b border-slate-100">
                        <DrawerTitle className="text-lg font-black text-slate-950">Eneo la kufikisha</DrawerTitle>
                        <DrawerDescription className="text-xs font-bold text-slate-500">
                            Usafirishaji unapatikana kwa maeneo yaliyo ndani ya duara. Alama nyekundu ni biashara ilipo.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="px-5 pb-5">
                        <DeliveryCoverageMap
                            anchors={deliveryCoverageAnchors}
                            customerLat={customerLat}
                            customerLng={customerLng}
                            height={420}
                        />
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
}
