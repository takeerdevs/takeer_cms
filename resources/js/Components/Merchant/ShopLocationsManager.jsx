import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { MapPin, Plus, Trash2, Loader2, Globe, CheckCircle2, Pencil, X, Truck, ChevronDown, ChevronUp, Star, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import ShippingZonesManager from './ShippingZonesManager';

const MAP_CONTAINER_STYLE = {
    width: '100%',
    height: '250px',
    borderRadius: '12px',
};

const DEFAULT_CENTER = {
    lat: -6.7924, // Dar es Salaam
    lng: 39.2083,
};

const libraries = ['places'];

export default function ShopLocationsManager({ locations = [], onRefresh, loading: propLoading, profiles = [], onRefreshZones, merchantId = null, personalMode = false }) {
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [expandedShippingId, setExpandedShippingId] = useState(null);
    const [formData, setFormData] = useState({
        name: personalMode ? 'Eneo kuu la stock' : 'Duka kuu',
        type: personalMode ? 'store' : 'shop',
        address: '',
        latitude: DEFAULT_CENTER.lat,
        longitude: DEFAULT_CENTER.lng,
        place_id: '',
        city: '',
        region: '',
        is_primary: false,
        allow_self_pickup: true,
        contact_phone: '',
    });
    const [retailSettings, setRetailSettings] = useState(null);
    const [savingRoutes, setSavingRoutes] = useState(false);
    const [shopRoutes, setShopRoutes] = useState([]);

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries: libraries
    });

    const autocompleteRef = useRef(null);

    useEffect(() => {
        if (!editingId) {
            if (locations.length === 0) {
                setFormData(prev => ({ ...prev, name: personalMode ? 'Eneo kuu la stock' : 'Duka kuu', type: personalMode ? 'store' : prev.type }));
            } else {
                setFormData(prev => ({ ...prev, name: personalMode ? `Eneo la stock ${locations.length + 1}` : `Duka ${locations.length + 1}`, type: personalMode ? 'store' : prev.type }));
            }
        }
    }, [locations.length, editingId, personalMode]);

    useEffect(() => {
        const fetchRetailSettings = async () => {
            try {
                const res = await window.axios.get('/api/retail/settings');
                const settings = res.data?.data || {};
                setRetailSettings(settings);
                setShopRoutes(Array.isArray(settings.shop_routes) ? settings.shop_routes : []);
            } catch (err) {
                console.error('Failed to load retail settings', err);
            }
        };

        if (!personalMode) fetchRetailSettings();
    }, [personalMode]);

    const onLoad = (autocomplete) => {
        autocompleteRef.current = autocomplete;
    };

    const onPlaceChanged = () => {
        if (autocompleteRef.current !== null) {
            const place = autocompleteRef.current.getPlace();
            if (place.geometry) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();

                // Extract city/region if possible
                let city = '';
                let region = '';
                if (place.address_components) {
                    for (const component of place.address_components) {
                        if (component.types.includes('locality')) city = component.long_name;
                        if (component.types.includes('administrative_area_level_1')) region = component.long_name;
                    }
                }

                setFormData(prev => ({
                    ...prev,
                    address: place.formatted_address || '',
                    latitude: lat,
                    longitude: lng,
                    place_id: place.place_id || '',
                    city: city,
                    region: region,
                }));
            }
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setIsFormOpen(false);
        setFormData({
            name: personalMode ? `Eneo la stock ${locations.length + 1}` : `Duka ${locations.length + 1}`,
            type: personalMode ? 'store' : 'shop',
            address: '',
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
            place_id: '',
            city: '',
            region: '',
            is_primary: false,
            allow_self_pickup: true,
            contact_phone: '',
        });
    };

    const handleEdit = (loc) => {
        setEditingId(loc.id);
        setIsFormOpen(true);
        setFormData({
            name: loc.name,
            type: String(loc.type || 'shop').toLowerCase(),
            address: loc.address,
            latitude: Number(loc.latitude),
            longitude: Number(loc.longitude),
            place_id: loc.place_id || '',
            city: loc.city || '',
            region: loc.region || '',
            is_primary: !!loc.is_primary,
            allow_self_pickup: loc.allow_self_pickup === null || loc.allow_self_pickup === undefined ? true : !!loc.allow_self_pickup,
            contact_phone: loc.contact_phone || '',
        });

        // Optional: Scroll to form
        const formElement = document.getElementById('shop-location-form');
        if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const startCreate = () => {
        setEditingId(null);
        setIsFormOpen(true);
        setFormData({
            name: personalMode ? `Eneo la stock ${locations.length + 1}` : `Duka ${locations.length + 1}`,
            type: personalMode ? 'store' : 'shop',
            address: '',
            latitude: DEFAULT_CENTER.lat,
            longitude: DEFAULT_CENTER.lng,
            place_id: '',
            city: '',
            region: '',
            is_primary: locations.length === 0,
            allow_self_pickup: true,
            contact_phone: '',
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.address || !formData.latitude) {
            toast.error('Tafadhali chagua eneo sahihi kwenye ramani.');
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                await window.axios.put(`/api/merchant/locations/${editingId}`, { ...formData, merchant_id: merchantId });
                toast.success('Eneo limebadilishwa kwa mafanikio!');
                resetForm();
            } else {
                await window.axios.post('/api/merchant/locations', { ...formData, merchant_id: merchantId });
                resetForm();
                toast.success(personalMode ? 'Eneo la stock/pickup limehifadhiwa!' : 'Eneo la duka limehifadhiwa!');
            }
            if (onRefresh) onRefresh();
        } catch (err) {
            const fallback = editingId ? 'Imeshindikana kubadilisha eneo.' : 'Imeshindikana kuhifadhi eneo hili.';
            toast.error(err.response?.data?.message || fallback);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTogglePickup = async (loc) => {
        try {
            await window.axios.put(`/api/merchant/locations/${loc.id}`, {
                ...loc,
                merchant_id: merchantId,
                type: String(loc.type || 'shop').toLowerCase(),
                allow_self_pickup: !loc.allow_self_pickup
            });
            toast.success(`Kuchukua mwenyewe ${!loc.allow_self_pickup ? 'kumeruhusiwa' : 'kumezimwa'} kwa ${loc.name}`);
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error('Imeshindikana kubadilisha mipangilio ya kuchukua mwenyewe.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Je, una uhakika unataka kufuta eneo hili?')) return;

        try {
            await window.axios.delete(`/api/merchant/locations/${id}`, { data: { merchant_id: merchantId } });
            if (onRefresh) onRefresh();
            toast.success('Eneo limefutwa.');
        } catch (err) {
            toast.error('Imeshindikana kufuta.');
        }
    };

    const onMarkerDragEnd = (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
    };

    const shops = locations.filter((loc) => String(loc.type || '').toLowerCase() === 'shop');
    const supplyLocations = locations.filter((loc) => ['store', 'warehouse'].includes(String(loc.type || '').toLowerCase()));
    const personalLimitReached = personalMode && locations.length >= 1 && !editingId;
    const primaryLocation = locations.find((loc) => loc.is_primary) || locations[0] || null;
    const showStockRouting = !personalMode && shops.length > 0 && supplyLocations.length > 0;
    const routeByShopId = shopRoutes.reduce((acc, row) => {
        acc[Number(row.shop_location_id)] = row;
        return acc;
    }, {});

    const updateShopRoute = (shopId, key, value) => {
        setShopRoutes((prev) => {
            const next = [...prev];
            const idx = next.findIndex((x) => Number(x.shop_location_id) === Number(shopId));
            if (idx >= 0) {
                next[idx] = { ...next[idx], [key]: value === '' ? null : Number(value) };
            } else {
                next.push({
                    shop_location_id: Number(shopId),
                    serving_store_location_id: null,
                    delivery_pickup_location_id: null,
                    [key]: value === '' ? null : Number(value),
                });
            }
            return next;
        });
    };

    const typeLabel = (type) => {
        const normalized = String(type || 'shop').toLowerCase();
        if (personalMode) return 'Stock / kuchukua';
        if (normalized === 'warehouse') return 'Ghala';
        if (normalized === 'store') return 'Stoo';
        if (normalized === 'office') return 'Ofisi';
        return 'Duka';
    };

    const deliveryStatus = (loc) => {
        if (expandedShippingId === loc.id) return 'Inasanidiwa';
        return 'Bonyeza usafirishaji kusanidi';
    };

    const saveShopRoutes = async () => {
        if (!retailSettings) return;
        setSavingRoutes(true);
        try {
            await window.axios.patch('/api/retail/settings', {
                ...retailSettings,
                shop_routes: shopRoutes,
            });
            toast.success('Mpangilio wa mtiririko wa bidhaa umehifadhiwa.');
            setRetailSettings((prev) => ({ ...(prev || {}), shop_routes: shopRoutes }));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kuhifadhi mpangilio wa duka na stoo.');
        } finally {
            setSavingRoutes(false);
        }
    };

    return (
        <Card className="glass-card shadow-sm mt-6">
            <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                    <MapPin className="h-4 w-4" /> {personalMode ? 'Maeneo ya stock / pickup' : 'Maeneo ya ofisi / stock / duka'}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
                <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-brand-700">
                            {personalMode ? 'Eneo la stock na pickup' : 'Eneo kuu la biashara'}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-brand-900/75">
                            {primaryLocation
                                ? `${primaryLocation.name} ndio linaonekana kwanza kwenye mipangilio yako.`
                                : personalMode
                                    ? 'Anza kwa kuweka eneo moja ambalo bidhaa zako zipo au mteja anaweza kuchukua.'
                                    : 'Anza kwa kuweka duka, ofisi, au stoo kuu. Usafirishaji na mtiririko wa stock zitasanidiwa baada ya eneo kuwepo.'}
                        </p>
                    </div>
                    <Button
                        type="button"
                        className="h-10 rounded-xl font-bold"
                        onClick={startCreate}
                        disabled={personalLimitReached}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {locations.length === 0 ? 'Weka eneo la kwanza' : 'Ongeza eneo'}
                    </Button>
                </div>

                {propLoading || loading ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-brand-500" /></div>
                ) : (
                    <div className="space-y-3">
                        {locations.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-5 text-center">
                                <MapPin className="mx-auto h-8 w-8 text-brand-500" />
                                <p className="mt-3 text-sm font-black text-slate-900">
                                    {personalMode ? 'Bado hujaweka eneo la stock/pickup.' : 'Bado hujaweka eneo la biashara.'}
                                </p>
                                <p className="mx-auto mt-1 max-w-xl text-xs font-semibold leading-5 text-muted-foreground">
                                    {personalMode
                                        ? 'Hili linahitajika kama unauza bidhaa uliyonayo mkononi. Anwani kamili hutumika baada ya order kuanzishwa.'
                                        : 'Eneo husaidia pickup, usafirishaji, na mtiririko wa stock kufanya kazi bila kumchanganya mteja.'}
                                </p>
                            </div>
                        ) : (
                            locations.map(loc => (
                                <div key={loc.id} className="space-y-2 rounded-2xl border border-input bg-white p-3">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-black text-slate-900">{loc.name}</p>
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">
                                                    {typeLabel(loc.type)}
                                                </span>
                                                {loc.is_primary && (
                                                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">
                                                        <CheckCircle2 className="h-3 w-3" /> Eneo kuu
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{loc.address}</p>
                                            <div className="mt-3 grid gap-2 text-[11px] font-bold text-slate-600 sm:grid-cols-2">
                                                <span className="rounded-xl bg-slate-50 px-3 py-2">
                                                    Kuchukua mwenyewe: {loc.allow_self_pickup ? 'Inaruhusiwa' : 'Imezimwa'}
                                                </span>
                                                <span className="rounded-xl bg-slate-50 px-3 py-2">
                                                    Usafirishaji: {deliveryStatus(loc)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`h-9 rounded-xl text-xs font-bold ${loc.allow_self_pickup ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                                                onClick={() => handleTogglePickup(loc)}
                                            >
                                                {loc.allow_self_pickup ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
                                                Kuchukua
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`h-9 rounded-xl text-xs font-bold ${expandedShippingId === loc.id ? 'bg-brand-50 border-brand-200 text-brand-700' : ''}`}
                                                onClick={() => setExpandedShippingId(expandedShippingId === loc.id ? null : loc.id)}
                                            >
                                                <Truck className="mr-1.5 h-3.5 w-3.5" />
                                                Usafirishaji
                                                {expandedShippingId === loc.id ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-brand-500 hover:text-brand-700 hover:bg-brand-50" onClick={() => handleEdit(loc)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(loc.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {expandedShippingId === loc.id && (
                                        <div className="rounded-2xl border border-brand-100 bg-brand-50/30 p-3">
                                            <LocationShippingManager
                                                location={loc}
                                                profiles={profiles}
                                                locations={locations}
                                                merchantId={merchantId}
                                                onRefresh={onRefreshZones}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {showStockRouting && (
                    <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 space-y-3">
                        <div>
                            <p className="text-xs font-black uppercase text-brand-700">Bidhaa zinatoka wapi?</p>
                            <p className="text-[11px] font-semibold leading-5 text-brand-700/80">
                                Kwa kila duka, chagua stoo au ghala linalotoa bidhaa. Hii ni muhimu kwa biashara zenye maeneo mengi.
                            </p>
                        </div>

                        <div className="space-y-2">
                            {shops.map((shop) => {
                                const route = routeByShopId[Number(shop.id)] || {};
                                return (
                                    <div key={shop.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl border border-brand-100 bg-white p-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500">Duka</p>
                                            <p className="text-sm font-bold text-slate-900">{shop.name}</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500">Stoo / ghala linalohudumia</label>
                                            <select
                                                className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2 text-xs font-semibold"
                                                value={route.serving_store_location_id ?? ''}
                                                onChange={(e) => updateShopRoute(shop.id, 'serving_store_location_id', e.target.value)}
                                            >
                                                <option value="">Chagua stoo au ghala</option>
                                                {supplyLocations.map((loc) => (
                                                    <option key={loc.id} value={loc.id}>{loc.name} ({typeLabel(loc.type)})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end">
                            <Button
                                type="button"
                                className="h-9 rounded-xl px-4 font-bold"
                                onClick={saveShopRoutes}
                                disabled={savingRoutes || !retailSettings}
                            >
                                {savingRoutes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Hifadhi mpangilio
                            </Button>
                        </div>
                    </div>
                )}

                {personalLimitReached && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                        Personal account inaruhusu eneo moja tu la stock/pickup. Hariri eneo lililopo, au tengeneza biashara nyingine ili kuongeza maeneo mengi.
                    </div>
                )}

                {!personalLimitReached && !isFormOpen && locations.length > 0 && (
                    <Button type="button" variant="outline" onClick={startCreate} className="h-11 w-full rounded-xl border-dashed font-bold">
                        <Plus className="mr-2 h-4 w-4" />
                        Ongeza eneo jingine
                    </Button>
                )}

                {!personalLimitReached && isFormOpen && (
                    <form id="shop-location-form" onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                                    {editingId
                                        ? (personalMode ? 'Hariri eneo la stock/pickup' : 'Hariri eneo')
                                        : (personalMode ? 'Ongeza eneo la stock/pickup' : 'Ongeza eneo jipya')}
                                </h4>
                                <p className="mt-1 text-[11px] font-semibold leading-5 text-muted-foreground">
                                    Chagua aina ya eneo, tafuta anwani kwenye ramani, kisha weka pickup au eneo kuu kama inahitajika.
                                </p>
                            </div>
                            <Button type="button" variant="ghost" onClick={resetForm} className="h-9 rounded-xl px-3 text-xs font-bold">
                                <X className="mr-1.5 h-4 w-4" />
                                Funga
                            </Button>
                        </div>

                        {!personalMode && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Unaongeza eneo la aina gani?</p>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                    {[
                                        { key: 'shop', label: 'Duka / Ofisi', hint: 'Mahali wateja wanaona au kuchukua bidhaa.' },
                                        { key: 'store', label: 'Stoo', hint: 'Chanzo cha stock kwa duka moja au zaidi.' },
                                        { key: 'warehouse', label: 'Ghala', hint: 'Eneo kubwa la kuhifadhi stock.' },
                                    ].map((option) => (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: option.key })}
                                            className={`rounded-xl border p-3 text-left transition ${formData.type === option.key ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-border bg-white hover:bg-muted/50'}`}
                                        >
                                            <span className="block text-xs font-black text-slate-900">{option.label}</span>
                                            <span className="mt-1 block text-[11px] font-semibold leading-4 text-muted-foreground">{option.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {personalMode ? 'Jina la Eneo (Mf. Stock ya Nyumbani)' : 'Jina la Duka (Mf. Duka la Sinza)'}
                                </label>
                                <Input
                                    placeholder="Jina la eneo hili"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="bg-muted/30 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Tafuta Eneo (Google Maps)</label>
                                {isLoaded ? (
                                    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                                        <Input
                                            type="text"
                                            placeholder="Tafuta mtaa au jengo..."
                                            className="bg-muted/30 rounded-xl"
                                        />
                                    </Autocomplete>
                                ) : (
                                    <Input disabled placeholder="Inapakia ramani..." className="bg-muted/30 rounded-xl" />
                                )}
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Namba ya Simu (Si lazima)</label>
                                <Input
                                    placeholder="Mfano: 07........"
                                    value={formData.contact_phone}
                                    onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                    className="bg-muted/30 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="border border-input rounded-xl overflow-hidden">
                            {isLoaded ? (
                                <GoogleMap
                                    mapContainerStyle={MAP_CONTAINER_STYLE}
                                    center={{ lat: Number(formData.latitude), lng: Number(formData.longitude) }}
                                    zoom={15}
                                    options={{
                                        streetViewControl: false,
                                        mapTypeControl: false,
                                        fullscreenControl: false,
                                    }}
                                >
                                    <Marker
                                        position={{ lat: Number(formData.latitude), lng: Number(formData.longitude) }}
                                        draggable={true}
                                        onDragEnd={onMarkerDragEnd}
                                    />
                                </GoogleMap>
                            ) : (
                                <div className="w-full h-[250px] bg-muted flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                                    <Globe className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-xs">Ramani itaonekana hapa ukishaweka Google API Key.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 p-4 bg-brand-50/50 rounded-2xl border border-brand-100 mb-2">
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase text-brand-600 mb-1">Mipangilio ya eneo</p>
                                <div className="flex flex-wrap items-center gap-6">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_primary}
                                            onChange={e => setFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                                            className="h-5 w-5 rounded-lg border-brand-200 text-brand-600 focus:ring-brand-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 group-hover:text-brand-700 transition-colors uppercase">
                                                {personalMode ? 'Eneo kuu la stock' : 'Eneo kuu'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium font-inter">
                                                {personalMode ? 'Eneo hili litakuwa chaguo la kwanza kwa pickup/delivery.' : 'Eneo hili litakuwa chaguo la kwanza la usafirishaji.'}
                                            </span>
                                        </div>
                                    </label>

                                    <div className="h-8 w-px bg-brand-200 hidden md:block" />

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={formData.allow_self_pickup}
                                            onChange={e => setFormData(prev => ({ ...prev, allow_self_pickup: e.target.checked }))}
                                            className="h-5 w-5 rounded-lg border-brand-200 text-brand-600 focus:ring-brand-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-brand-700 group-hover:text-brand-900 transition-colors uppercase">Ruhusu mteja kuchukua mwenyewe</span>
                                            <span className="text-[10px] text-brand-600/60 font-medium font-inter">
                                                {personalMode ? 'Mteja anaweza kulipia kisha mkakubaliana pickup kwenye order chat.' : 'Wateja wataweza kuchukua bidhaa wenyewe kwenye eneo hili.'}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={resetForm} className="h-11 px-4 rounded-xl font-bold flex gap-2">
                                <X className="h-4 w-4" />
                                Ghairi
                            </Button>

                            <Button type="submit" disabled={isSaving || !formData.address} className="bg-brand-600 hover:bg-brand-700 h-11 px-6 rounded-xl font-bold flex gap-2">
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : editingId ? (
                                    <Pencil className="h-4 w-4" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                {editingId ? 'Hifadhi Mabadiliko' : 'Hifadhi Eneo'}
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}

function LocationShippingManager({ location, profiles = [], locations = [], merchantId = null, onRefresh }) {
    const [activeProfileId, setActiveProfileId] = useState(null);
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [isSavingPolicy, setIsSavingPolicy] = useState(false);

    // Default to the first profile or the default one
    useEffect(() => {
        if (profiles.length > 0 && !activeProfileId) {
            const def = profiles.find(p => p.is_default) || profiles[0];
            setActiveProfileId(def.id);
        }
    }, [profiles]);

    const handleAddTemplate = async (e) => {
        e.preventDefault();
        if (!newTemplateName.trim()) return;

        setIsSavingTemplate(true);
        try {
            const res = await window.axios.post('/api/merchant/shipping-profiles', { name: newTemplateName, merchant_id: merchantId });
            setNewTemplateName('');
            setIsAddingTemplate(false);
            toast.success('Mpangilio mpya wa usafirishaji umeongezwa!');
            if (onRefresh) onRefresh();
            // Automatically switch to the new template
            if (res.data.data) setActiveProfileId(res.data.data.id);
        } catch (err) {
            toast.error('Imeshindikana kuongeza mpangilio wa usafirishaji.');
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (id, name) => {
        if (profiles.length <= 1) {
            toast.error('Huwezi kufuta mpangilio wako wa mwisho wa delivery.');
            return;
        }
        if (!confirm(`Je, una uhakika unataka kufuta mpangilio "${name}"? Hii itafuta njia zote za usafirishaji ndani yake.`)) return;

        try {
            await window.axios.delete(`/api/merchant/shipping-profiles/${id}`, { data: { merchant_id: merchantId } });
            toast.success('Mpangilio wa usafirishaji umefutwa.');
            if (activeProfileId === id) {
                const other = profiles.find(p => p.id !== id);
                setActiveProfileId(other ? other.id : null);
            }
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kufuta mpangilio wa usafirishaji.');
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await window.axios.post(`/api/merchant/shipping-profiles/${id}/set-default`, { merchant_id: merchantId });
            toast.success('Mpangilio wa kawaida wa usafirishaji umesasishwa.');
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error('Imeshindikana kusasisha default.');
        }
    };

    const activeProfile = profiles.find(p => String(p.id) === String(activeProfileId));

    const handleOutsideAreaPolicyChange = async (policy) => {
        if (!activeProfile) return;

        setIsSavingPolicy(true);
        try {
            await window.axios.put(`/api/merchant/shipping-profiles/${activeProfile.id}`, {
                merchant_id: merchantId,
                name: activeProfile.name,
                is_default: Boolean(activeProfile.is_default),
                outside_area_policy: policy,
            });
            toast.success('Kanuni ya maeneo imesasishwa.');
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kusasisha kanuni ya maeneo.');
        } finally {
            setIsSavingPolicy(false);
        }
    };

    if (profiles.length === 0 && !isAddingTemplate) {
        return (
            <div className="text-center py-6 bg-muted/20 rounded-xl border border-dashed border-input">
                <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-xs text-muted-foreground font-bold mb-3">Bado huna template yoyote ya usafirishaji.</p>
                <Button size="sm" onClick={() => setIsAddingTemplate(true)} className="bg-brand-600 font-bold">
                    <Plus className="h-4 w-4 mr-1" /> Tengeneza mpangilio wa kwanza
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-1">
                {profiles.map(p => (
                    <div key={p.id} className="relative group">
                        <Button
                            variant={activeProfileId === p.id ? 'default' : 'outline'}
                            size="sm"
                            className={`h-8 px-3 text-[10px] font-black uppercase rounded-full pl-3 pr-8 transition-all ${activeProfileId === p.id ? 'bg-brand-600' : 'text-brand-700 bg-white border-brand-100 hover:border-brand-300'}`}
                            onClick={() => setActiveProfileId(p.id)}
                        >
                            {p.is_default && <ShieldCheck className="h-3 w-3 mr-1 text-green-500" />}
                            {p.name}
                        </Button>

                        <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 transition-opacity ${activeProfileId === p.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {activeProfileId === p.id && !p.is_default && (
                                <button
                                    onClick={() => handleSetDefault(p.id)}
                                    className="p-1 hover:bg-white/20 rounded-full text-white/70 hover:text-white"
                                    title="Weka kama kawaida"
                                >
                                    <Star className="h-2.5 w-2.5" />
                                </button>
                            )}
                            <button
                                onClick={() => handleDeleteTemplate(p.id, p.name)}
                                className={`p-1 rounded-full ${activeProfileId === p.id ? 'hover:bg-white/20 text-white/70 hover:text-white' : 'hover:bg-red-50 text-red-400 hover:text-red-600'}`}
                                title="Futa mpangilio"
                            >
                                <Trash2 className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    </div>
                ))}

                {!isAddingTemplate ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full border border-dashed border-input text-muted-foreground hover:text-brand-600 hover:border-brand-600"
                        onClick={() => setIsAddingTemplate(true)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                ) : (
                    <form onSubmit={handleAddTemplate} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                        <Input
                            value={newTemplateName}
                            onChange={e => setNewTemplateName(e.target.value)}
                            placeholder="Jina la mpangilio..."
                            className="h-8 text-[10px] font-bold w-32 rounded-full"
                            autoFocus
                        />
                        <Button type="submit" size="sm" disabled={isSavingTemplate || !newTemplateName.trim()} className="h-8 w-8 p-0 rounded-full bg-brand-600">
                            {isSavingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingTemplate(false)} className="h-8 w-8 p-0 rounded-full text-red-500">
                            <X className="h-4 w-4" />
                        </Button>
                    </form>
                )}
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
                Hizi ni taratibu zako za usafirishaji, kwa mfano unaweza kuweka utaratibu wa usafirishaji kwa mkoa au wilaya. Weka jina lolote la mpangilio upendalo lenye maana kwako, halitaonekana kwa watumiaji.
            </div>

            <div className="bg-white/50 p-4 rounded-2xl border border-brand-100 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200 min-h-[100px]">
                {activeProfileId ? (
                    <div className="space-y-4">
                        {activeProfile && (
                            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-800">Kanuni ya nje ya maeneo</p>
                                        <p className="mt-1 text-xs font-semibold text-sky-900/70">
                                            Chagua kinachotokea kama eneo la mteja halipo ndani ya maeneo uliyoweka.
                                        </p>
                                    </div>
                                    <select
                                        value={activeProfile.outside_area_policy || 'inquiry'}
                                        disabled={isSavingPolicy}
                                        onChange={(e) => handleOutsideAreaPolicyChange(e.target.value)}
                                        className="h-10 rounded-xl border border-sky-200 bg-white px-3 text-xs font-black text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    >
                                        <option value="inquiry">Ruhusu kupokea oda nje ya maeneo uliyoweka</option>
                                        <option value="block">Zuia wateja walio nje ya maeneo uliyoweka</option>
                                    </select>
                                </div>
                            </div>
                        )}
                        <ShippingZonesManager
                            profileId={activeProfileId}
                            locations={locations}
                            fixedLocationId={location.id}
                            merchantId={merchantId}
                            onRefresh={onRefresh}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground italic">
                        <p className="text-xs">Chagua au tengeneza template kwanza.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
