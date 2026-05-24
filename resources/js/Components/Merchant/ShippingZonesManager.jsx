import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Truck, Plus, Trash2, Loader2, MapPin, Globe, Pencil, X } from 'lucide-react';
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

export default function ShippingZonesManager({ profileId, locations = [], fixedLocationId = null, merchantId = null, onRefresh: onParentRefresh }) {
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
        merchant_location_id: '',
        max_distance_km: '',
        reference_lat: '',
        reference_lng: '',
        reference_name: '',
        destination_region: '',
        destination_city: '',
        destination_country: '',
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
        const destinationName = newZone.destination_city || newZone.destination_region || newZone.reference_name || newZone.zone_name;
        const payload = {
            ...newZone,
            hotspots: isIntercity ? [] : newZone.hotspots,
            flat_rate_fee: isIntercity ? (intercityFeeKnown ? intercityFeeTotal : 0) : newZone.flat_rate_fee,
            zone_name: isIntercity ? (destinationName || 'Destination ya inter-city') : newZone.zone_name,
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
            if (!destinationName) {
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
            merchant_location_id: zone.merchant_location_id || fixedLocationId || '',
            max_distance_km: zone.max_distance_km || '',
            reference_lat: zone.reference_lat || '',
            reference_lng: zone.reference_lng || '',
            reference_name: zone.reference_name || '',
            destination_region: zone.destination_region || '',
            destination_city: zone.destination_city || '',
            destination_country: zone.destination_country || '',
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
            merchant_location_id: fixedLocationId || (locations.length > 0 ? (locations.find(l => l.is_primary)?.id || locations[0].id) : ''),
            max_distance_km: '',
            reference_lat: '',
            reference_lng: '',
            reference_name: '',
            destination_region: '',
            destination_city: '',
            destination_country: '',
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

        if (place.address_components) {
            for (const component of place.address_components) {
                if (component.types.includes('locality')) city = component.long_name;
                if (component.types.includes('administrative_area_level_1')) region = component.long_name;
                if (component.types.includes('country')) country = component.long_name;
            }
        }

        return { city, region, country };
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
                const { city, region, country } = extractLocationMetadata(place);

                setNewZone(prev => ({
                    ...prev,
                    reference_name: place.name || place.formatted_address || '',
                    reference_lat: lat,
                    reference_lng: lng,
                    destination_city: city,
                    destination_region: region,
                    destination_country: country,
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
                const { city, region, country } = extractLocationMetadata(place);
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

    const formatShippingFee = (fee, deliveryType = null) => {
        const amount = Number(fee || 0);
        if (deliveryType === 'intercity_bus' && amount <= 0) return 'Itathibitishwa kwenye chat';
        return amount > 0 ? `TZS ${amount.toLocaleString()}` : 'Bure';
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
                                            <span>{formatDeliveryType(zone.delivery_type)}</span>
                                            {zone.delivery_type === 'local_boda' && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span>{Number(zone.max_distance_km).toFixed(1)}km</span>
                                                </>
                                            )}
                                            {zone.delivery_type === 'intercity_bus' && (
                                                <>
                                                    <span className="opacity-50">•</span>
                                                    <span>{zone.destination_city || zone.destination_region || zone.reference_name}</span>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aina ya Usafiri</label>
                        <select
                            value={newZone.delivery_type}
                            onChange={e => {
                                const deliveryType = e.target.value;
                                setNewZone({
                                    ...newZone,
                                    delivery_type: deliveryType,
                                    flat_rate_fee: deliveryType === 'intercity_bus' ? 0 : newZone.flat_rate_fee,
                                });
                                if (deliveryType === 'intercity_bus') {
                                    setIntercityFeeKnown(false);
                                    setIntercityFeeParts(EMPTY_INTERCITY_FEE_PARTS);
                                }
                            }}
                            className="flex h-11 w-full rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                        >
                            <option value="local_boda">Dereva wa karibu(Bodaboda, Gari n.k)</option>
                            <option value="intercity_bus">Wadau wa Usafiri (Basi/Lori n.k)</option>
                        </select>
                    </div>
                    {newZone.delivery_type !== 'intercity_bus' ? (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Gharama ya Usafiri (TZS)</label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0 maana yake ni bure"
                                value={newZone.flat_rate_fee}
                                onChange={e => setNewZone({ ...newZone, flat_rate_fee: e.target.value })}
                                required
                                className="bg-muted/30 rounded-xl h-11 font-bold"
                            />
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bei ya inter-city</label>
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
                                className={`flex h-11 w-full items-center justify-between rounded-xl border px-3 text-left text-xs font-black uppercase tracking-wider ${intercityFeeKnown ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-input bg-muted/30 text-muted-foreground'}`}
                            >
                                <span>{intercityFeeKnown ? 'Najua gharama ya destination hii' : 'Gharama itathibitishwa kwenye chat'}</span>
                                <span className={`h-5 w-9 rounded-full p-0.5 transition ${intercityFeeKnown ? 'bg-brand-600' : 'bg-slate-300'}`}>
                                    <span className={`block h-4 w-4 rounded-full bg-white transition ${intercityFeeKnown ? 'translate-x-4' : ''}`} />
                                </span>
                            </button>
                            <p className="text-[10px] font-semibold text-muted-foreground leading-4">
                                Kama hujui bei kwa sababu ya uzito au msafirishaji, acha ithibitishwe kwenye order chat.
                            </p>
                        </div>
                    )}
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
                                <label className="text-[10px] font-black text-brand-700 uppercase tracking-widest">Destination / Region ya inter-city</label>
                                <span className="text-[10px] font-medium italic">Weka mkoa au mji unaoweza kutumiwa kama destination. Utathibitisha bei kwenye chat ya order kulingana na oda husika, hii ni kwa makadirio tu kwa mteja.</span>
                            </div>

                            {intercityFeeKnown && (
                                <div className="rounded-2xl border border-brand-100 bg-white p-3 space-y-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">Shipping fee breakdown</p>
                                        <p className="mt-1 text-[10px] font-semibold leading-4 text-brand-700/70">
                                            Jumuisha first mile, transport na handling kama unatoza. Mteja ataona total moja tu.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <label className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">First mile</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="Dukani -> ofisi"
                                                value={intercityFeeParts.first_mile_fee}
                                                onChange={e => handleIntercityFeePartChange('first_mile_fee', e.target.value)}
                                                className="h-10 rounded-xl bg-brand-50/40 text-xs font-bold"
                                            />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Transport (Kadirio la juu)</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="Basi/lori"
                                                value={intercityFeeParts.transport_fee}
                                                onChange={e => handleIntercityFeePartChange('transport_fee', e.target.value)}
                                                className="h-10 rounded-xl bg-brand-50/40 text-xs font-bold"
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
                                                className="h-10 rounded-xl bg-brand-50/40 text-xs font-bold"
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

                            {isLoaded ? (
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

                            {(newZone.destination_region || newZone.destination_city || newZone.reference_name) && (
                                <div className="p-2.5 bg-white border border-brand-100 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                                            <MapPin className="h-3 w-3 text-brand-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-brand-900 truncate">{newZone.zone_name || newZone.destination_city || newZone.destination_region || newZone.reference_name}</p>
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

                <Button type="submit" disabled={isSaving} className={`w-full ${editingId ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-900 hover:bg-slate-800'} h-11 rounded-xl font-black uppercase tracking-widest flex gap-2 shadow-lg ${editingId ? 'shadow-brand-600/20' : 'shadow-slate-900/20'} text-sm`}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
                    {editingId ? 'SASISHA NJIA' : 'HIFADHI NJIA'}
                </Button>
            </form>
        </div>
    );
}
