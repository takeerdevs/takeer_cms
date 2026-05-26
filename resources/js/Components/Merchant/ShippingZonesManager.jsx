import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Truck, Plus, Trash2, Loader2, MapPin, Globe, Pencil, X, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Circle } from '@react-google-maps/api';

const MAP_CONTAINER_STYLE = {
    width: '100%',
    height: '200px',
    borderRadius: '12px',
};

const DEFAULT_CENTER = {
    lat: -6.7924, // Dar es Salaam
    lng: 39.2083,
};

const libraries = ['places'];
const EMPTY_INTERCITY_FEE_PARTS = {
    first_mile_fee: '',
    transport_fee: '',
    handling_fee: '',
};
const DELIVERY_PRESETS = [
    { key: 'same_day', label: 'Leo leo', hint: 'Boda/local delivery ndani ya siku hiyo hiyo.', handling: [0, 0], transit: [0, 0], buyerLabel: 'Same day delivery' },
    { key: 'next_day', label: 'Kesho', hint: 'Mteja apokee kesho.', handling: [0, 1], transit: [1, 1], buyerLabel: 'Delivery by tomorrow' },
    { key: 'one_two', label: 'Siku 1-2', hint: 'Kwa oda za kawaida ndani ya mji.', handling: [0, 1], transit: [1, 2], buyerLabel: 'Delivery in 1-2 days' },
    { key: 'bus_two_four', label: 'Basi siku 2-4', hint: 'Inter-city kupitia basi/parcel office.', handling: [0, 1], transit: [2, 4], buyerLabel: 'Inter-city delivery in 2-4 days by bus' },
    { key: 'confirm', label: 'Tutathibitisha', hint: 'Kwa mizigo mikubwa au bei/muda hutegemea transporter.', handling: ['', ''], transit: ['', ''], buyerLabel: 'Delivery time will be confirmed in chat', confirm: true },
];

export default function ShippingZonesManager({ profileId, locations = [], fixedLocationId = null, merchantId = null, onRefresh: onParentRefresh, activeProfile = null, countries = [] }) {
    const [profile, setProfile] = useState(null);
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [savingFeeId, setSavingFeeId] = useState(null);
    const [feeDrafts, setFeeDrafts] = useState({});
    const formRef = useRef(null);
    const [newZone, setNewZone] = useState({
        zone_name: '',
        flat_rate_fee: '',
        delivery_type: 'local_boda',
        coverage_scope: 'distance_band',
        merchant_location_id: '',
        max_distance_km: '',
        reference_lat: '',
        reference_lng: '',
        reference_name: '',
        destination_region: '',
        destination_city: '',
        destination_country: '',
        destination_country_id: '',
        destination_state_id: '',
        destination_city_id: '',
        handling_min_days: '',
        handling_max_days: '',
        transit_min_days: '',
        transit_max_days: '',
        cutoff_time: '',
        business_days_only: true,
        delivery_promise_label: '',
        delivery_promise_note: '',
        requires_delivery_confirmation: false,
        hotspots: [],
    });

    const [hotspotSearch, setHotspotSearch] = useState('');
    const [pendingHotspot, setPendingHotspot] = useState(null);
    const [intercityFeeParts, setIntercityFeeParts] = useState(EMPTY_INTERCITY_FEE_PARTS);
    const [intercityFeeKnown, setIntercityFeeKnown] = useState(false);
    const hotspotAutocompleteRef = useRef(null);

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries: libraries
    });

    const autocompleteRef = useRef(null);

    useEffect(() => {
        if (profileId) {
            fetchZones();
        }
    }, [profileId]);

    useEffect(() => {
        if (fixedLocationId) {
            setNewZone(prev => ({ ...prev, merchant_location_id: fixedLocationId }));
        } else if (locations.length > 0 && !newZone.merchant_location_id) {
            const primary = locations.find(l => l.is_primary) || locations[0];
            setNewZone(prev => ({ ...prev, merchant_location_id: primary.id }));
        }
    }, [locations, profileId, fixedLocationId]);

    const fetchZones = async () => {
        if (!profileId) {
            console.warn('ShippingZonesManager: No profileId provided, skipping zone fetch.');
            return;
        }
        setLoading(true);
        try {
            const res = await window.axios.get(`/api/merchant/shipping-profiles/${profileId}/zones`, {
                params: { merchant_id: merchantId },
            });
            let fetchedZones = res.data.data || [];
            if (fixedLocationId) {
                fetchedZones = fetchedZones.filter(z => String(z.merchant_location_id) === String(fixedLocationId));
            }
            setZones(fetchedZones);
            setFeeDrafts(fetchedZones.reduce((drafts, zone) => ({
                ...drafts,
                [zone.id]: zone.flat_rate_fee ?? '',
            }), {}));
        } catch (err) {
            console.error('Failed to load shipping zones', err);
            const msg = err.response?.data?.message || 'Imeshindikana kupakia njia za usafirishaji.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleFeeDraftChange = (zoneId, value) => {
        setFeeDrafts(prev => ({ ...prev, [zoneId]: value }));
    };

    const handleQuickFeeSave = async (zone) => {
        const draftValue = feeDrafts[zone.id];
        if (draftValue === '' || Number(draftValue) < 0) {
            toast.error('Tafadhali weka gharama sahihi ya usafiri.');
            return;
        }

        setSavingFeeId(zone.id);
        try {
            const res = await window.axios.put(`/api/merchant/shipping-zones/${zone.id}`, {
                merchant_id: merchantId,
                flat_rate_fee: draftValue,
            });
            setZones(prev => prev.map(item => item.id === zone.id ? res.data.data : item));
            setFeeDrafts(prev => ({ ...prev, [zone.id]: res.data.data.flat_rate_fee ?? draftValue }));
            toast.success('Gharama ya usafiri imesasishwa.');
            if (onParentRefresh) onParentRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kusasisha gharama.');
        } finally {
            setSavingFeeId(null);
        }
    };

    const handleIntercityFeePartChange = (key, value) => {
        setIntercityFeeParts(prev => {
            const next = { ...prev, [key]: value };
            const total = Object.values(next).reduce((sum, item) => sum + Number(item || 0), 0);
            setNewZone(zone => ({ ...zone, flat_rate_fee: total }));

            return next;
        });
    };

    const intercityFeeTotal = Object.values(intercityFeeParts)
        .reduce((sum, item) => sum + Number(item || 0), 0);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const selectedShop = locations.find(l => String(l.id) === String(newZone.merchant_location_id));

    useEffect(() => {
        if (selectedShop && newZone.reference_lat && newZone.reference_lng) {
            const dist = calculateDistance(
                Number(selectedShop.latitude), Number(selectedShop.longitude),
                Number(newZone.reference_lat), Number(newZone.reference_lng)
            );
            setNewZone(prev => ({ ...prev, max_distance_km: dist }));
        }
    }, [newZone.merchant_location_id, newZone.reference_lat, newZone.reference_lng]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isIntercity = newZone.delivery_type === 'intercity_bus';
        const isCountrywide = newZone.coverage_scope === 'countrywide';
        const isInternational = newZone.coverage_scope === 'international';
        const sectionAllowed = isShippingSectionEnabled(newZone);
        if (!sectionAllowed) {
            toast.error('Sehemu hii imezimwa kwenye template hii. Iwashe kwanza juu ya template.');
            return;
        }
        const shouldSaveCutoff = shouldShowCutoff(newZone);
        const destinationName = isCountrywide
            ? (newZone.destination_country ? `Nchi nzima - ${newZone.destination_country}` : 'Delivery nchi nzima')
            : (isInternational
                ? (newZone.destination_country || newZone.zone_name)
                : (newZone.destination_city || newZone.destination_region || newZone.reference_name || newZone.zone_name));
        const payload = {
            ...newZone,
            hotspots: isIntercity ? [] : newZone.hotspots,
            flat_rate_fee: isIntercity ? (intercityFeeKnown ? intercityFeeTotal : 0) : newZone.flat_rate_fee,
            zone_name: isIntercity ? (destinationName || 'Destination ya inter-city') : newZone.zone_name,
            coverage_scope: newZone.delivery_type === 'local_boda' ? 'distance_band' : newZone.coverage_scope,
            cutoff_time: shouldSaveCutoff ? newZone.cutoff_time : null,
        };

        if (!isIntercity && !payload.zone_name) {
            toast.error('Tafadhali jaza jina la ukanda.');
            return;
        }

        if (payload.flat_rate_fee === '' || Number(payload.flat_rate_fee) < 0 || (isIntercity && intercityFeeKnown && intercityFeeTotal <= 0)) {
            toast.error(isIntercity ? 'Weka gharama sahihi au chagua ithibitishwe kwenye chat.' : 'Tafadhali jaza gharama.');
            return;
        }

        // Validations
        if (payload.delivery_type === 'local_boda') {
            if (!payload.merchant_location_id) {
                toast.error('Tafadhali chagua eneo la duka.');
                return;
            }
            if (!payload.reference_lat && !payload.max_distance_km) {
                toast.error('Tafadhali chagua eneo mwisho au weka umbali wa KM.');
                return;
            }
        }

        if (isIntercity) {
            if (isInternational && !payload.destination_country_id && !payload.destination_country) {
                toast.error('Tafadhali weka nchi unayotaka kusafirisha kwenda.');
                return;
            }
            if (!isCountrywide && !isInternational && !destinationName) {
                toast.error('Tafadhali chagua au andika destination/region ya inter-city.');
                return;
            }
        }

        if (!profileId) {
            toast.error('Hitilafu: Profile ya usafirishaji haijatambuliwa.');
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                const res = await window.axios.put(`/api/merchant/shipping-zones/${editingId}`, { ...payload, merchant_id: merchantId });
                setZones(zones.map(z => z.id === editingId ? res.data.data : z));
                toast.success('Njia ya usafirishaji imesasishwa!');
            } else {
                const res = await window.axios.post(`/api/merchant/shipping-profiles/${profileId}/zones`, { ...payload, merchant_id: merchantId });
                setZones([res.data.data, ...zones]);
                toast.success('Njia ya usafirishaji imeongezwa!');
            }

            handleCancelEdit();
            if (onParentRefresh) onParentRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kuhifadhi njia hii.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (zone) => {
        setEditingId(zone.id);
        setNewZone({
            zone_name: zone.zone_name || '',
            flat_rate_fee: zone.flat_rate_fee || '',
            delivery_type: zone.delivery_type || 'local_boda',
            coverage_scope: zone.coverage_scope || (zone.delivery_type === 'local_boda' ? 'distance_band' : 'city_region'),
            merchant_location_id: zone.merchant_location_id || fixedLocationId || '',
            max_distance_km: zone.max_distance_km || '',
            reference_lat: zone.reference_lat || '',
            reference_lng: zone.reference_lng || '',
            reference_name: zone.reference_name || '',
            destination_region: zone.destination_region || '',
            destination_city: zone.destination_city || '',
            destination_country: zone.destination_country || '',
            destination_country_id: zone.destination_country_id || '',
            destination_state_id: zone.destination_state_id || '',
            destination_city_id: zone.destination_city_id || '',
            handling_min_days: zone.handling_min_days ?? '',
            handling_max_days: zone.handling_max_days ?? '',
            transit_min_days: zone.transit_min_days ?? '',
            transit_max_days: zone.transit_max_days ?? '',
            cutoff_time: zone.cutoff_time ? String(zone.cutoff_time).slice(0, 5) : '',
            business_days_only: zone.business_days_only ?? true,
            delivery_promise_label: zone.delivery_promise_label || '',
            delivery_promise_note: zone.delivery_promise_note || '',
            requires_delivery_confirmation: zone.requires_delivery_confirmation ?? false,
            is_active: zone.is_active ?? true,
            hotspots: zone.hotspots || [],
        });
        setIntercityFeeParts(zone.delivery_type === 'intercity_bus' && Number(zone.flat_rate_fee || 0) > 0
            ? { ...EMPTY_INTERCITY_FEE_PARTS, transport_fee: zone.flat_rate_fee }
            : EMPTY_INTERCITY_FEE_PARTS
        );
        setIntercityFeeKnown(zone.delivery_type === 'intercity_bus' ? Number(zone.flat_rate_fee || 0) > 0 : false);

        // Scroll to form
        if (formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setNewZone({
            zone_name: '',
            flat_rate_fee: '',
            delivery_type: 'local_boda',
            coverage_scope: 'distance_band',
            merchant_location_id: fixedLocationId || (locations.length > 0 ? (locations.find(l => l.is_primary)?.id || locations[0].id) : ''),
            max_distance_km: '',
            reference_lat: '',
            reference_lng: '',
            reference_name: '',
            destination_region: '',
            destination_city: '',
            destination_country: '',
            destination_country_id: '',
            destination_state_id: '',
            destination_city_id: '',
            handling_min_days: '',
            handling_max_days: '',
            transit_min_days: '',
            transit_max_days: '',
            cutoff_time: '',
            business_days_only: true,
            delivery_promise_label: '',
            delivery_promise_note: '',
            requires_delivery_confirmation: false,
            is_active: true,
            hotspots: [],
        });
        setIntercityFeeParts(EMPTY_INTERCITY_FEE_PARTS);
        setIntercityFeeKnown(false);
    };

    const extractLocationMetadata = (place) => {
        let city = '';
        let region = '';
        let country = '';
        let countryCode = '';

        if (place.address_components) {
            for (const component of place.address_components) {
                if (component.types.includes('locality')) city = component.long_name;
                if (component.types.includes('administrative_area_level_1')) region = component.long_name;
                if (component.types.includes('country')) {
                    country = component.long_name;
                    countryCode = component.short_name;
                }
            }
        }

        return { city, region, country, countryCode };
    };

    const handleDelete = async (id) => {
        if (!confirm('Je, una uhakika unataka kufuta njia hii?')) return;

        try {
            await window.axios.delete(`/api/merchant/shipping-zones/${id}`, { data: { merchant_id: merchantId } });
            setZones(zones.filter(z => z.id !== id));
            toast.success('Imefutwa kikamilifu.');
            if (onParentRefresh) onParentRefresh();
        } catch (err) {
            toast.error('Imeshindikana kufuta.');
        }
    };

    const onLoad = (autocomplete) => {
        autocompleteRef.current = autocomplete;
    };

    const onPlaceChanged = () => {
        if (autocompleteRef.current !== null) {
            const place = autocompleteRef.current.getPlace();
            if (place.geometry) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const { city, region, country, countryCode } = extractLocationMetadata(place);
                const countryId = findCountryIdByName(countryCode || country);

                setNewZone(prev => ({
                    ...prev,
                    reference_name: place.name || place.formatted_address || '',
                    reference_lat: lat,
                    reference_lng: lng,
                    destination_city: city,
                    destination_region: region,
                    destination_country: country,
                    destination_country_id: countryId,
                    destination_state_id: '',
                    destination_city_id: '',
                    zone_name: prev.zone_name || `Eneo la ${place.name || 'hapa'}`,
                }));
            }
        }
    };

    const onMarkerDragEnd = (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setNewZone(prev => ({ ...prev, reference_lat: lat, reference_lng: lng }));
    };

    const handleIntercityDestinationChanged = () => {
        if (hotspotAutocompleteRef.current !== null) {
            const place = hotspotAutocompleteRef.current.getPlace();
            if (place && place.geometry) {
                const { city, region, country, countryCode } = extractLocationMetadata(place);
                const countryId = findCountryIdByName(countryCode || country);
                const name = place.name || city || region || place.formatted_address || '';
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const destinationName = city || region || name;

                setNewZone(prev => ({
                    ...prev,
                    hotspots: [],
                    zone_name: destinationName || prev.zone_name,
                    reference_name: name || place.formatted_address || destinationName,
                    reference_lat: lat,
                    reference_lng: lng,
                    destination_city: city,
                    destination_region: region || city,
                    destination_country: country,
                    destination_country_id: countryId,
                    destination_state_id: '',
                    destination_city_id: '',
                }));
                setHotspotSearch('');
                toast.success(`Destination imewekwa: ${destinationName || name}`);
            }
        }
    };

    const removeHotspot = (index) => {
        setNewZone(prev => ({
            ...prev,
            hotspots: prev.hotspots.filter((_, i) => i !== index)
        }));
    };

    const formatDeliveryType = (type) => {
        if (type === 'self_pickup') return 'Mteja kuchukua';
        if (type === 'local_boda') return 'Dereva wa karibu';
        if (type === 'intercity_bus') return 'Basi la mikoani';
        return type;
    };

    const coverageMode = newZone.delivery_type === 'local_boda'
        ? 'in_city'
        : (newZone.coverage_scope === 'international' ? 'international' : 'inter_city');

    const isShippingSectionEnabled = (zone) => {
        if (!activeProfile) return true;
        if (zone.delivery_type === 'local_boda') return activeProfile.in_city_enabled !== false;
        if (zone.coverage_scope === 'international') return activeProfile.international_enabled === true;
        return activeProfile.intercity_enabled !== false;
    };

    const countryNameById = (countryId) => countries.find(country => String(country.id) === String(countryId))?.name || '';

    const countryCodeById = (countryId) => countries.find(country => String(country.id) === String(countryId))?.code || countries.find(country => String(country.id) === String(countryId))?.iso_alpha2 || '';

    const findCountryIdByName = (countryName) => {
        const normalized = String(countryName || '').trim().toLowerCase();
        if (!normalized) return '';
        const match = countries.find(country => (
            String(country.name || '').trim().toLowerCase() === normalized
            || String(country.code || country.iso_alpha2 || '').trim().toLowerCase() === normalized
        ));
        return match ? String(match.id) : '';
    };

    const setDestinationCountryId = (countryId, overrides = {}) => {
        const countryName = countryNameById(countryId);
        setNewZone(prev => ({
            ...prev,
            destination_country_id: countryId,
            destination_country: countryName,
            destination_state_id: '',
            destination_city_id: '',
            ...overrides,
        }));
    };

    const setCoverageMode = (mode) => {
        if (mode === 'in_city') {
            if (activeProfile && activeProfile.in_city_enabled === false) {
                toast.error('Ndani ya mji imezimwa kwenye template hii.');
                return;
            }
            setNewZone(prev => ({
                ...prev,
                delivery_type: 'local_boda',
                coverage_scope: 'distance_band',
                flat_rate_fee: prev.flat_rate_fee || '',
            }));
            return;
        }

        if (mode === 'international' && activeProfile && activeProfile.international_enabled !== true) {
            toast.error('Nje ya nchi imezimwa kwenye template hii.');
            return;
        }
        if (mode === 'inter_city' && activeProfile && activeProfile.intercity_enabled === false) {
            toast.error('Mikoani imezimwa kwenye template hii.');
            return;
        }

        setNewZone(prev => ({
            ...prev,
            delivery_type: 'intercity_bus',
            coverage_scope: mode === 'international' ? 'international' : 'city_region',
            flat_rate_fee: 0,
            merchant_location_id: prev.merchant_location_id || fixedLocationId || '',
            destination_city: mode === 'international' ? '' : prev.destination_city,
            destination_region: mode === 'international' ? '' : prev.destination_region,
        }));
        setIntercityFeeKnown(false);
        setIntercityFeeParts(EMPTY_INTERCITY_FEE_PARTS);
    };

    const formatCoverageScope = (zone) => {
        if (zone.coverage_scope === 'international') return `Kimataifa${zone.destination_country ? `: ${zone.destination_country}` : ''}`;
        if (zone.coverage_scope === 'countrywide') return `Nchi nzima${zone.destination_country ? `: ${zone.destination_country}` : ''}`;
        if (zone.delivery_type === 'local_boda') return 'Ndani ya mji';
        if (zone.delivery_type === 'intercity_bus') return 'Mji/Mkoa maalum';
        return formatDeliveryType(zone.delivery_type);
    };

    const formatShippingFee = (fee, deliveryType = null) => {
        const amount = Number(fee || 0);
        if (deliveryType === 'intercity_bus' && amount <= 0) return 'Itathibitishwa kwenye chat';
        return amount > 0 ? `TZS ${amount.toLocaleString()}` : 'Bure';
    };

    const formatDayRange = (min, max) => {
        const a = min !== null && min !== undefined && min !== '' ? Number(min) : null;
        const b = max !== null && max !== undefined && max !== '' ? Number(max) : null;
        if (a === null && b === null) return '';
        if (a !== null && b !== null && a !== b) return `${a}-${b} days`;
        const value = b ?? a;
        if (value === 0) return 'same day';
        if (value === 1) return '1 day';
        return `${value} days`;
    };

    const formatDeliveryPromise = (zone) => {
        if (zone.delivery_promise_label) return zone.delivery_promise_label;
        const handling = formatDayRange(zone.handling_min_days, zone.handling_max_days);
        const transit = formatDayRange(zone.transit_min_days, zone.transit_max_days);
        if (zone.requires_delivery_confirmation) return 'Time confirmed in chat';
        if (handling && transit) return `${handling} prep + ${transit} transit`;
        return transit || handling || '';
    };

    const hasDayValue = (value) => value !== null && value !== undefined && value !== '';

    const shouldShowDetailedPromiseDays = (zone) => !zone.requires_delivery_confirmation;

    const isSameDayPromise = (zone) => {
        const label = String(zone.delivery_promise_label || '').toLowerCase();
        const hasExplicitDays = [
            zone.handling_min_days,
            zone.handling_max_days,
            zone.transit_min_days,
            zone.transit_max_days,
        ].some(hasDayValue);

        const maxHandling = Number(zone.handling_max_days || 0);
        const maxTransit = Number(zone.transit_max_days || 0);

        return label.includes('same day')
            || label.includes('leo leo')
            || (hasExplicitDays && maxHandling <= 0 && maxTransit <= 0);
    };

    const shouldShowCutoff = (zone) => shouldShowDetailedPromiseDays(zone) && isSameDayPromise(zone);

    const deliveryPreviewText = (() => {
        if (newZone.requires_delivery_confirmation) {
            return 'Mteja ataona muda utathibitishwa kwenye chat. Hapa hakuna haja ya kuonyesha deadline ya same-day.';
        }

        if (shouldShowCutoff(newZone)) {
            return newZone.cutoff_time
                ? `Mteja ataelewa: same-day ikiwa ameagiza kabla ya ${newZone.cutoff_time}.`
                : 'Hii ni same-day. Weka saa ya mwisho kama una deadline ya kupokea oda za leo.';
        }

        const label = newZone.delivery_promise_label || formatDeliveryPromise(newZone);
        return label
            ? `Mteja ataona: ${label}. Deadline ya saa imefichwa kwa sababu si ahadi ya same-day.`
            : 'Chagua preset au andika maneno rahisi ambayo mteja ataona.';
    })();

    const applyDeliveryPreset = (preset) => {
        setNewZone(prev => ({
            ...prev,
            handling_min_days: preset.handling[0],
            handling_max_days: preset.handling[1],
            transit_min_days: preset.transit[0],
            transit_max_days: preset.transit[1],
            delivery_promise_label: preset.buyerLabel,
            requires_delivery_confirmation: Boolean(preset.confirm),
            cutoff_time: preset.key === 'same_day' ? prev.cutoff_time : '',
        }));
    };

    return (
        <div className="space-y-4">
            {!fixedLocationId && (
                <div className="flex items-center gap-2 mb-2 bg-brand-50 p-3 rounded-xl border border-brand-100">
                    <Truck className="h-5 w-5 text-brand-600" />
                    <div>
                        <p className="text-xs font-black text-brand-900 leading-none">Njia za Usafirishaji</p>
                        <p className="text-[10px] text-brand-700 font-medium mt-1">Usimamizi wa kanda zote za uwasilishaji.</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-brand-500" /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                    {zones.length === 0 ? (
                        <p className="col-span-full text-[11px] text-brand-600 font-bold bg-brand-50/50 p-3 rounded-xl border border-brand-100 border-dashed text-center">
                            Bado hujaweka njia yoyote hapa.
                        </p>
                    ) : (
                        zones.map(zone => (
                            <div key={zone.id} className="p-2.5 rounded-xl border border-input bg-background/50 group h-full space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-black truncate">{zone.zone_name}</p>
                                        <div className="flex flex-wrap gap-1.5 items-center text-[9px] text-muted-foreground mt-0.5 font-bold">
                                            <span className="text-brand-600 font-black">
                                                {formatShippingFee(zone.flat_rate_fee, zone.delivery_type)}
                                            </span>
                                            <span className="opacity-50">•</span>
                                            <span>{formatCoverageScope(zone)}</span>
                                            {zone.delivery_type === 'local_boda' && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span>{Number(zone.max_distance_km).toFixed(1)}km</span>
                                                </>
                                            )}
                                            {zone.delivery_type === 'intercity_bus' && zone.coverage_scope !== 'countrywide' && zone.coverage_scope !== 'international' && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span>{zone.destination_city || zone.destination_region || zone.reference_name}</span>
                                                </>
                                            )}
                                            {formatDeliveryPromise(zone) && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock3 className="h-3 w-3" />
                                                        {formatDeliveryPromise(zone)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-brand-600 hover:text-brand-800 hover:bg-brand-50" onClick={() => handleEdit(zone)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(zone.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                {zone.delivery_type !== 'intercity_bus' && (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            value={feeDrafts[zone.id] ?? ''}
                                            onChange={(e) => handleFeeDraftChange(zone.id, e.target.value)}
                                            className="h-8 rounded-lg bg-white text-xs font-black"
                                            aria-label="Gharama ya usafiri"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={savingFeeId === zone.id || String(feeDrafts[zone.id] ?? '') === String(zone.flat_rate_fee ?? '')}
                                            onClick={() => handleQuickFeeSave(zone)}
                                            className="h-8 rounded-lg px-3 text-[10px] font-black uppercase bg-brand-600 hover:bg-brand-700"
                                        >
                                            {savingFeeId === zone.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Hifadhi'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className={`space-y-4 border-t pt-4 border-dashed mt-4 p-4 rounded-2xl transition-colors duration-300 ${editingId ? 'bg-brand-50/50 border-brand-200' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${editingId ? 'bg-brand-600' : 'bg-slate-900'} text-white`}>
                            {editingId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-wider">
                            {editingId ? 'Hariri Njia ya Usafirishaji' : 'Ongeza Njia Mpya'}
                        </h3>
                    </div>
                    {editingId && (
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 text-xs font-bold gap-1 text-slate-500 hover:text-slate-900 border border-slate-200">
                            <X className="h-3 w-3" /> Ghairi
                        </Button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                        { key: 'in_city', title: 'Ndani ya mji', hint: 'Boda/gari kutoka stoo hadi umbali ulioweka.' },
                        { key: 'inter_city', title: 'Mikoani', hint: 'Mji/mkoa maalum au nchi nzima ndani ya nchi ya biashara.' },
                        { key: 'international', title: 'Nje ya nchi', hint: 'Kenya, Uganda, Rwanda na nchi nyingine unazoweka.' },
                    ].map((mode) => {
                        const modeEnabled = mode.key === 'in_city'
                            ? activeProfile?.in_city_enabled !== false
                            : mode.key === 'international'
                                ? activeProfile?.international_enabled === true
                                : activeProfile?.intercity_enabled !== false;
                        return (
                            <button
                                key={mode.key}
                                type="button"
                                onClick={() => setCoverageMode(mode.key)}
                                className={`rounded-2xl border p-3 text-left transition ${coverageMode === mode.key ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-200'} ${!modeEnabled ? 'opacity-50' : ''}`}
                            >
                                <span className="block text-xs font-black uppercase tracking-wider text-slate-900">{mode.title}</span>
                                <span className="mt-1 block text-[10px] font-semibold leading-4 text-slate-500">{mode.hint}</span>
                            </button>
                        );
                    })}
                </div>

                {newZone.delivery_type !== 'intercity_bus' && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Jina la Ukanda / Labeli (Mf. Dar - Karibu na Duka)</label>
                        <Input
                            placeholder="Jina la utambulisho (halitaonekana kwa mteja)"
                            value={newZone.zone_name}
                            onChange={e => setNewZone({ ...newZone, zone_name: e.target.value })}
                            required
                            className="bg-muted/30 rounded-xl h-11 font-bold"
                        />
                    </div>
                )}

                <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                    <div className="flex items-start gap-2">
                        <Clock3 className="mt-0.5 h-4 w-4 text-emerald-700" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Muda wa kufikisha</p>
                            <p className="text-[10px] font-semibold leading-4 text-emerald-800/80">
                                Chagua ahadi moja. Tutaficha vitu visivyoendana nayo ili mteja asione ahadi mbili tofauti.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {DELIVERY_PRESETS.map((preset) => (
                            <button key={preset.key} type="button" onClick={() => applyDeliveryPreset(preset)} className={`rounded-2xl border bg-white px-3 py-2 text-left transition hover:border-emerald-300 ${newZone.delivery_promise_label === preset.buyerLabel ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-emerald-100'}`}>
                                <span className="block text-xs font-black text-emerald-900">{preset.label}</span>
                                <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-emerald-700/75">{preset.hint}</span>
                            </button>
                        ))}
                    </div>
                    {shouldShowDetailedPromiseDays(newZone) ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <label className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Kuandaa kuanzia</span>
                                    <Input type="number" min="0" placeholder="0" value={newZone.handling_min_days} onChange={e => setNewZone({ ...newZone, handling_min_days: e.target.value })} className="h-10 rounded-xl bg-white text-xs font-bold" />
                                    <span className="block text-[9px] font-semibold text-muted-foreground">Siku kabla mzigo haujatoka dukani.</span>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Kuandaa mpaka</span>
                                    <Input type="number" min="0" placeholder="1" value={newZone.handling_max_days} onChange={e => setNewZone({ ...newZone, handling_max_days: e.target.value })} className="h-10 rounded-xl bg-white text-xs font-bold" />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Safari kuanzia</span>
                                    <Input type="number" min="0" placeholder={newZone.delivery_type === 'local_boda' ? '0' : '1'} value={newZone.transit_min_days} onChange={e => setNewZone({ ...newZone, transit_min_days: e.target.value })} className="h-10 rounded-xl bg-white text-xs font-bold" />
                                    <span className="block text-[9px] font-semibold text-muted-foreground">Siku za boda/basi/cargo kufikisha.</span>
                                </label>
                                <label className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Safari mpaka</span>
                                    <Input type="number" min="0" placeholder={newZone.delivery_type === 'local_boda' ? '0' : '4'} value={newZone.transit_max_days} onChange={e => setNewZone({ ...newZone, transit_max_days: e.target.value })} className="h-10 rounded-xl bg-white text-xs font-bold" />
                                </label>
                            </div>
                            {shouldShowCutoff(newZone) && (
                                <label className="block space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Muda wa mwisho mteja kuweka oda ili kutumwa siku hiyo hiyo</span>
                                    <Input type="time" value={newZone.cutoff_time} onChange={e => setNewZone({ ...newZone, cutoff_time: e.target.value })} className="h-10 rounded-xl bg-white text-xs font-bold" />
                                    <span className="block text-[9px] font-semibold text-muted-foreground">Inaonekana tu kwa ahadi ya leo leo. Mf. oda kabla ya saa 8 mchana.</span>
                                </label>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-900">
                            Umechagua kuthibitisha muda kwenye chat, kwa hiyo siku na deadline ya saa zimefichwa.
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-2">
                        <label className="space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Maneno atakayoona mteja</span>
                            <Input placeholder="Mf. Leo leo Dar / Siku 2-4 kwa basi" value={newZone.delivery_promise_label} onChange={e => setNewZone({ ...newZone, delivery_promise_label: e.target.value })} className="h-10 rounded-xl bg-white text-xs font-bold" />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setNewZone({ ...newZone, business_days_only: !newZone.business_days_only })} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${newZone.business_days_only ? 'border-emerald-200 bg-white text-emerald-800' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
                            {newZone.business_days_only ? 'Siku za kazi' : 'Kila siku'}
                        </button>
                        <button type="button" onClick={() => setNewZone({ ...newZone, requires_delivery_confirmation: !newZone.requires_delivery_confirmation, cutoff_time: newZone.requires_delivery_confirmation ? newZone.cutoff_time : '' })} className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider ${newZone.requires_delivery_confirmation ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
                            {newZone.requires_delivery_confirmation ? 'Tuta-confirm kwa chat' : 'Mteja aone estimate'}
                        </button>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-[11px] font-bold leading-5 text-emerald-900">
                        {deliveryPreviewText}
                    </div>
                    <Input placeholder="Ujumbe wa ziada, mf. Ofisi ya basi itathibitishwa baada ya oda" value={newZone.delivery_promise_note} onChange={e => setNewZone({ ...newZone, delivery_promise_note: e.target.value })} className="h-10 rounded-xl bg-white text-xs font-bold" />
                </div>

                {newZone.delivery_type === 'local_boda' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-brand-50/30 p-4 rounded-2xl border border-brand-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {!fixedLocationId ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Chagua Eneo la Duka</label>
                                    <select
                                        value={newZone.merchant_location_id}
                                        onChange={e => setNewZone({ ...newZone, merchant_location_id: e.target.value })}
                                        className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    >
                                        <option value="" disabled>Chagua duka...</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Eneo la Duka</label>
                                    <div className="h-11 flex items-center px-4 bg-white border border-brand-200 rounded-xl text-xs font-bold text-brand-800">
                                        <MapPin className="h-3 w-3 mr-2 text-brand-500" /> {selectedShop?.name}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tafuta Eneo la Mwisho kwa Umbali</label>
                                {isLoaded ? (
                                    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                                        <Input
                                            placeholder="Mf. Kariakoo, Posta, Kimara..."
                                            className="bg-white rounded-xl h-11"
                                        />
                                    </Autocomplete>
                                ) : (
                                    <Input disabled placeholder="Inapakia ramani..." className="bg-white rounded-xl h-11" />
                                )}
                            </div>
                        </div>

                        <div className="border border-brand-200 rounded-xl overflow-hidden relative">
                            {isLoaded ? (
                                <GoogleMap
                                    mapContainerStyle={MAP_CONTAINER_STYLE}
                                    center={newZone.reference_lat ? { lat: Number(newZone.reference_lat), lng: Number(newZone.reference_lng) } : (selectedShop ? { lat: Number(selectedShop.latitude), lng: Number(selectedShop.longitude) } : DEFAULT_CENTER)}
                                    zoom={13}
                                    options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                                >
                                    {selectedShop && (
                                        <Marker
                                            position={{ lat: Number(selectedShop.latitude), lng: Number(selectedShop.longitude) }}
                                            label="DUKA"
                                        />
                                    )}
                                    {newZone.reference_lat && (
                                        <Marker
                                            position={{ lat: Number(newZone.reference_lat), lng: Number(newZone.reference_lng) }}
                                            draggable={true}
                                            onDragEnd={onMarkerDragEnd}
                                            label="MWISHO"
                                        />
                                    )}
                                    {selectedShop && newZone.max_distance_km && (
                                        <Circle
                                            center={{ lat: Number(selectedShop.latitude), lng: Number(selectedShop.longitude) }}
                                            radius={Number(newZone.max_distance_km) * 1000}
                                            options={{
                                                strokeColor: '#2563eb',
                                                strokeOpacity: 0.8,
                                                strokeWeight: 2,
                                                fillColor: '#2563eb',
                                                fillOpacity: 0.15,
                                                clickable: false,
                                                draggable: false,
                                                editable: false,
                                                visible: true,
                                                zIndex: 1
                                            }}
                                        />
                                    )}
                                </GoogleMap>
                            ) : (
                                <div className="w-full h-[200px] bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                    Weka VITE_GOOGLE_MAPS_API_KEY kuona ramani
                                </div>
                            )}
                            <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded-lg border shadow-sm flex items-center">
                                <p className="text-[10px] font-bold text-brand-800">
                                    {newZone.reference_name ? `Eneo: ${newZone.reference_name}` : 'Tafuta au angusha pini kuweka umbali wa mwisho.'}
                                </p>
                                {newZone.max_distance_km && (
                                    <p className="text-[10px] font-black text-brand-600 ml-6">Umbali: {Number(newZone.max_distance_km).toFixed(1)} km</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {newZone.delivery_type === 'intercity_bus' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200 bg-brand-50/30 p-4 rounded-2xl border border-brand-100">
                        <div className="space-y-3">
                            <div className="flex items-start flex-col gap-1 ">
                                <label className="text-[10px] font-black text-brand-700 uppercase tracking-widest">
                                    {newZone.coverage_scope === 'international' ? 'Nchi ya mteja' : 'Coverage ya mikoani'}
                                </label>
                                <span className="text-[10px] font-medium italic">
                                    {newZone.coverage_scope === 'international'
                                        ? 'Weka nchi moja kwa kila template. Ukiuza Kenya na Uganda, tengeneza njia mbili tofauti ili muda na gharama ziwe sahihi.'
                                        : 'Unaweza kuweka mji/mkoa maalum au kuwasha nchi nzima kama customer yuko nje ya in-city delivery.'}
                                </span>
                            </div>

                            {coverageMode === 'inter_city' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {[
                                        { key: 'city_region', title: 'Miji au mikoa maalum', hint: 'Mf. Morogoro, Dodoma, Mwanza. Weka Mkoa mmoja then hifadhi njia na uweke mkoa mwingine hadi mikoa yote unayofanya delivery iwekwe, wateja wa mikoa hiyo wataoneshwa kuwa delivery ipo' },
                                        { key: 'countrywide', title: 'Nchi nzima', hint: 'Chagua kama delivery unafanya nchi nzima.' },
                                    ].map((scope) => (
                                        <button
                                            key={scope.key}
                                            type="button"
                                            onClick={() => setNewZone(prev => ({
                                                ...prev,
                                                coverage_scope: scope.key,
                                                destination_city: scope.key === 'countrywide' ? '' : prev.destination_city,
                                                destination_region: scope.key === 'countrywide' ? '' : prev.destination_region,
                                                reference_name: scope.key === 'countrywide' ? 'Country-wide delivery' : prev.reference_name,
                                                zone_name: scope.key === 'countrywide' ? (prev.destination_country ? `Nchi nzima - ${prev.destination_country}` : 'Delivery nchi nzima') : prev.zone_name,
                                            }))}
                                            className={`rounded-2xl border bg-white p-3 text-left transition ${newZone.coverage_scope === scope.key ? 'border-brand-400 ring-2 ring-brand-100' : 'border-brand-100'}`}
                                        >
                                            <span className="block text-xs font-black text-brand-900">{scope.title}</span>
                                            <span className="mt-1 block text-[10px] font-semibold leading-4 text-brand-700/70">{scope.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!isShippingSectionEnabled(newZone) && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-900">
                                    Sehemu hii imezimwa kwenye template hii. Iwashe kwenye switches za template hapo juu kabla ya kuhifadhi njia.
                                </div>
                            )}

                            {newZone.coverage_scope === 'international' ? (
                                <select
                                    value={newZone.destination_country_id}
                                    onChange={e => {
                                        const countryId = e.target.value;
                                        const countryName = countryNameById(countryId);
                                        setDestinationCountryId(countryId, {
                                            zone_name: countryName ? `International - ${countryName}` : '',
                                            reference_name: countryName,
                                        });
                                    }}
                                    className="h-11 w-full rounded-xl border border-brand-200 bg-white px-3 text-sm font-bold text-brand-900"
                                >
                                    <option value="">Chagua nchi, mf. Kenya, Uganda, Rwanda</option>
                                    {countries.map(country => (
                                        <option key={country.id} value={country.id}>
                                            {country.name}{countryCodeById(country.id) ? ` (${countryCodeById(country.id)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : newZone.coverage_scope === 'countrywide' ? (
                                <select
                                    value={newZone.destination_country_id}
                                    onChange={e => {
                                        const countryId = e.target.value;
                                        const countryName = countryNameById(countryId);
                                        setDestinationCountryId(countryId, {
                                            zone_name: countryName ? `Nchi nzima - ${countryName}` : 'Delivery nchi nzima',
                                            reference_name: 'Country-wide delivery',
                                        });
                                    }}
                                    className="h-11 w-full rounded-xl border border-brand-200 bg-white px-3 text-sm font-bold text-brand-900"
                                >
                                    <option value="">Chagua nchi ya biashara</option>
                                    {countries.map(country => (
                                        <option key={country.id} value={country.id}>
                                            {country.name}{countryCodeById(country.id) ? ` (${countryCodeById(country.id)})` : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : isLoaded ? (
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Autocomplete
                                            onLoad={(a) => hotspotAutocompleteRef.current = a}
                                            onPlaceChanged={handleIntercityDestinationChanged}
                                        >
                                            <Input
                                                placeholder="Tafuta mkoa/mji, mf. Morogoro, Dodoma, Mwanza"
                                                value={hotspotSearch}
                                                onChange={e => setHotspotSearch(e.target.value)}
                                                className="bg-white border-brand-200 rounded-xl h-11 text-sm font-medium"
                                            />
                                        </Autocomplete>
                                    </div>
                                </div>
                            ) : (
                                <Input
                                    placeholder="Andika mkoa/mji, mf. Morogoro, Dodoma, Mwanza"
                                    value={newZone.zone_name}
                                    onChange={e => setNewZone({
                                        ...newZone,
                                        zone_name: e.target.value,
                                        reference_name: e.target.value,
                                        destination_region: e.target.value,
                                    })}
                                    className="bg-white border-brand-200 rounded-xl h-11 text-sm font-medium"
                                />
                            )}

                            {(newZone.destination_region || newZone.destination_city || newZone.reference_name || newZone.destination_country) && (
                                <div className="p-2.5 bg-white border border-brand-100 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                                            {newZone.coverage_scope === 'international' ? <Globe className="h-3 w-3 text-brand-600" /> : <MapPin className="h-3 w-3 text-brand-600" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-brand-900 truncate">{newZone.zone_name || newZone.destination_country || newZone.destination_city || newZone.destination_region || newZone.reference_name}</p>
                                            <p className="text-[10px] text-brand-700/70 truncate">
                                                {intercityFeeKnown && Number(newZone.flat_rate_fee || 0) > 0
                                                    ? `Mteja ataona TZS ${Number(newZone.flat_rate_fee || 0).toLocaleString()}`
                                                    : 'Gharama itathibitishwa kwenye order chat; waybill itaonyesha pickup/drop-off halisi.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Gharama ya usafiri</p>
                        <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                            Hii ndiyo gharama ambayo mteja ataona kwenye checkout kwa njia hii.
                        </p>
                    </div>
                    {newZone.delivery_type !== 'intercity_bus' ? (
                        <label className="block space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Gharama ya usafiri (TZS)</span>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0 maana yake ni bure"
                                value={newZone.flat_rate_fee}
                                onChange={e => setNewZone({ ...newZone, flat_rate_fee: e.target.value })}
                                required
                                className="bg-slate-50 rounded-xl h-11 font-bold"
                            />
                        </label>
                    ) : (
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setIntercityFeeKnown(prev => {
                                        const next = !prev;
                                        if (!next) {
                                            setNewZone(zone => ({ ...zone, flat_rate_fee: 0 }));
                                            setIntercityFeeParts(EMPTY_INTERCITY_FEE_PARTS);
                                        }
                                        return next;
                                    });
                                }}
                                className={`flex h-11 w-full items-center justify-between rounded-xl border px-3 text-left text-xs font-black uppercase tracking-wider ${intercityFeeKnown ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
                            >
                                <span>{intercityFeeKnown ? 'Najua gharama ya destination hii' : 'Gharama itathibitishwa kwenye chat'}</span>
                                <span className={`h-5 w-9 rounded-full p-0.5 transition ${intercityFeeKnown ? 'bg-brand-600' : 'bg-amber-300'}`}>
                                    <span className={`block h-4 w-4 rounded-full bg-white transition ${intercityFeeKnown ? 'translate-x-4' : ''}`} />
                                </span>
                            </button>
                            <p className="text-[10px] font-semibold text-muted-foreground leading-4">
                                Kama hujui bei kwa sababu ya uzito au msafirishaji, acha ithibitishwe kwenye order chat.
                            </p>
                            {intercityFeeKnown && (
                                <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-3 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <label className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">First mile</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="Dukani -> ofisi"
                                                value={intercityFeeParts.first_mile_fee}
                                                onChange={e => handleIntercityFeePartChange('first_mile_fee', e.target.value)}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Transport</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="Basi/lori"
                                                value={intercityFeeParts.transport_fee}
                                                onChange={e => handleIntercityFeePartChange('transport_fee', e.target.value)}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Handling</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="Packaging"
                                                value={intercityFeeParts.handling_fee}
                                                onChange={e => handleIntercityFeePartChange('handling_fee', e.target.value)}
                                                className="h-10 rounded-xl bg-white text-xs font-bold"
                                            />
                                        </label>
                                    </div>
                                    {intercityFeeTotal > 0 && (
                                        <div className="flex items-center justify-between rounded-xl bg-brand-900 px-3 py-2 text-white">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Total inayohifadhiwa</span>
                                            <span className="text-sm font-black">TZS {intercityFeeTotal.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <Button type="submit" disabled={isSaving} className={`w-full ${editingId ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-900 hover:bg-slate-800'} h-11 rounded-xl font-black uppercase tracking-widest flex gap-2 shadow-lg ${editingId ? 'shadow-brand-600/20' : 'shadow-slate-900/20'} text-sm`}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
                    {editingId ? 'SASISHA NJIA' : 'HIFADHI NJIA'}
                </Button>
            </form>
        </div>
    );
}
