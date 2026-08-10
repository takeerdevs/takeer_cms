import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { MapPin, Plus, Trash2, Loader2, Globe, CheckCircle2, Pencil, X, Truck, ChevronDown, ChevronUp, Star, ShieldCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import ShippingZonesManager from './ShippingZonesManager';
import { useLocale } from '@/lib/i18n';

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
const PICKUP_DAYS = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 7, label: 'Sun' },
];
const PICKUP_DAY_TRANSLATIONS = { Mon: 'Jumatatu', Tue: 'Jumanne', Wed: 'Jumatano', Thu: 'Alhamisi', Fri: 'Ijumaa', Sat: 'Jumamosi', Sun: 'Jumapili' };

const defaultPickupWindows = () => PICKUP_DAYS.map(({ day }) => ({
    day,
    enabled: day <= 6,
    start: '08:30',
    end: '16:00',
}));

const normalizePickupWindows = (windows) => {
    const byDay = new Map((Array.isArray(windows) ? windows : []).map((window) => [Number(window.day), window]));
    return PICKUP_DAYS.map(({ day }) => {
        const window = byDay.get(day);
        return {
            day,
            enabled: window ? window.enabled !== false : day <= 6,
            start: window?.start || '08:30',
            end: window?.end || '16:00',
        };
    });
};

export default function ShopLocationsManager({ locations = [], onRefresh, loading: propLoading, profiles = [], onRefreshZones, merchantId = null, personalMode = false, countries = [] }) {
    const { copy } = useLocale();
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
        country_name: '',
        country_iso2: '',
        state_name: '',
        city_name: '',
        city: '',
        region: '',
        is_primary: false,
        allow_self_pickup: true,
        pickup_hold_hours: 2,
        pickup_grace_hours: 0,
        pickup_available_windows: defaultPickupWindows(),
        pickup_instructions: '',
        pickup_cancellation_penalty_percent: 0,
        pickup_advance_days: 2,
        contact_phone: '',
    });
    const [retailSettings, setRetailSettings] = useState(null);
    const [savingRoutes, setSavingRoutes] = useState(false);
    const [shopRoutes, setShopRoutes] = useState([]);

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries: libraries,
        version: 'weekly',
        authReferrerPolicy: 'origin',
        preventGoogleFontsLoading: true,
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
                let countryName = '';
                let countryCode = '';
                if (place.address_components) {
                    for (const component of place.address_components) {
                        if (component.types.includes('locality')) city = component.long_name;
                        if (component.types.includes('administrative_area_level_1')) region = component.long_name;
                        if (component.types.includes('country')) {
                            countryName = component.long_name;
                            countryCode = component.short_name;
                        }
                    }
                }

                setFormData(prev => ({
                    ...prev,
                    address: place.formatted_address || '',
                    latitude: lat,
                    longitude: lng,
                    place_id: place.place_id || '',
                    country_name: countryName,
                    country_iso2: countryCode,
                    state_name: region,
                    city_name: city,
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
            country_name: '',
            country_iso2: '',
            state_name: '',
            city_name: '',
            city: '',
            region: '',
            is_primary: false,
            allow_self_pickup: true,
            pickup_hold_hours: 2,
            pickup_grace_hours: 0,
            pickup_available_windows: defaultPickupWindows(),
            pickup_instructions: '',
            pickup_cancellation_penalty_percent: 0,
            pickup_advance_days: 2,
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
            country_name: loc.country?.name || '',
            country_iso2: loc.country?.iso_alpha2 || '',
            state_name: loc.state?.name || loc.region || '',
            city_name: loc.city_record?.name || loc.city || '',
            city: loc.city || '',
            region: loc.region || '',
            is_primary: !!loc.is_primary,
            allow_self_pickup: loc.allow_self_pickup === null || loc.allow_self_pickup === undefined ? true : !!loc.allow_self_pickup,
            pickup_hold_hours: loc.pickup_hold_hours || 2,
            pickup_grace_hours: 0,
            pickup_available_windows: normalizePickupWindows(loc.pickup_available_windows),
            pickup_instructions: loc.pickup_instructions || '',
            pickup_cancellation_penalty_percent: loc.pickup_cancellation_penalty_percent ?? 0,
            pickup_advance_days: loc.pickup_advance_days ?? 2,
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
            country_name: '',
            country_iso2: '',
            state_name: '',
            city_name: '',
            city: '',
            region: '',
            is_primary: locations.length === 0,
            allow_self_pickup: true,
            pickup_hold_hours: 2,
            pickup_grace_hours: 0,
            pickup_available_windows: defaultPickupWindows(),
            pickup_instructions: '',
            pickup_cancellation_penalty_percent: 0,
            pickup_advance_days: 2,
            contact_phone: '',
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.address || !formData.latitude) {
            toast.error(copy('Choose a valid location on the map.', 'Tafadhali chagua eneo sahihi kwenye ramani.'));
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                merchant_id: merchantId,
                pickup_hold_hours: 2,
                pickup_grace_hours: 0,
                pickup_available_windows: formData.allow_self_pickup
                    ? normalizePickupWindows(formData.pickup_available_windows).filter(window => window.enabled)
                    : null,
            };
            if (editingId) {
                await window.axios.put(`/api/merchant/locations/${editingId}`, payload);
            toast.success(copy('Location updated successfully!', 'Eneo limebadilishwa kwa mafanikio!'));
                resetForm();
            } else {
                await window.axios.post('/api/merchant/locations', payload);
                resetForm();
            toast.success(personalMode ? copy('Stock/pickup location saved!', 'Eneo la stock/pickup limehifadhiwa!') : copy('Shop location saved!', 'Eneo la duka limehifadhiwa!'));
            }
            if (onRefresh) onRefresh();
        } catch (err) {
            const fallback = editingId ? copy('Could not update the location.', 'Imeshindikana kubadilisha eneo.') : copy('Could not save this location.', 'Imeshindikana kuhifadhi eneo hili.');
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
            toast.success(copy(`Self-pickup ${!loc.allow_self_pickup ? 'enabled' : 'disabled'} for ${loc.name}`, `Kuchukua mwenyewe ${!loc.allow_self_pickup ? 'kumeruhusiwa' : 'kumezimwa'} kwa ${loc.name}`));
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error(copy('Could not update self-pickup settings.', 'Imeshindikana kubadilisha mipangilio ya kuchukua mwenyewe.'));
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(copy('Are you sure you want to delete this location?', 'Je, una uhakika unataka kufuta eneo hili?'))) return;

        try {
            await window.axios.delete(`/api/merchant/locations/${id}`, { data: { merchant_id: merchantId } });
            if (onRefresh) onRefresh();
            toast.success(copy('Location deleted.', 'Eneo limefutwa.'));
        } catch (err) {
            toast.error(copy('Could not delete.', 'Imeshindikana kufuta.'));
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
        if (personalMode) return copy('Stock / pickup', 'Stock / kuchukua');
        if (normalized === 'warehouse') return copy('Warehouse', 'Ghala');
        if (normalized === 'store') return copy('Store', 'Stoo');
        if (normalized === 'office') return copy('Office', 'Ofisi');
        return copy('Shop', 'Duka');
    };

    const deliveryStatus = (loc) => {
        if (expandedShippingId === loc.id) return copy('Configuring', 'Inasanidiwa');
        return copy('Click to configure shipping', 'Bonyeza usafirishaji kusanidi');
    };

    const saveShopRoutes = async () => {
        if (!retailSettings) return;
        setSavingRoutes(true);
        try {
            await window.axios.patch('/api/retail/settings', {
                ...retailSettings,
                shop_routes: shopRoutes,
            });
            toast.success(copy('Product flow settings saved.', 'Mpangilio wa mtiririko wa bidhaa umehifadhiwa.'));
            setRetailSettings((prev) => ({ ...(prev || {}), shop_routes: shopRoutes }));
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not save shop and stock settings.', 'Imeshindikana kuhifadhi mpangilio wa duka na stoo.'));
        } finally {
            setSavingRoutes(false);
        }
    };

    return (
        <Card className="glass-card shadow-sm mt-6">
            <CardHeader className="p-5 pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                    <MapPin className="h-4 w-4" /> {personalMode ? copy('Business (Stock / Pickup) locations', 'Maeneo ya Biashara (Stock / Pickup)') : copy('Office / stock / shop locations', 'Maeneo ya ofisi / stock / duka')}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
                <div className="grid gap-2 sm:grid-cols-3">
                    {[
                        [copy('1. Add your location', '1. Weka eneo lako'), copy('Shop, office, stock room, or home pickup.', 'Duka, ofisi, stoo, au pickup ya nyumbani.')],
                        [copy('2. Choose pickup', '2. Chagua pickup'), copy('Allow customers to collect there if you want.', 'Ruhusu wateja kuchukua hapo ukitaka.')],
                        [copy('3. Set delivery', '3. Weka delivery'), copy('Add only the areas and prices you currently offer.', 'Weka maeneo na bei unazotumia sasa tu.')],
                    ].map(([title, hint]) => (
                        <div key={title} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-xs font-black text-slate-900">{title}</p>
                            <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">{hint}</p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide text-brand-700">
                            {personalMode ? copy('Stock and pickup location', 'Eneo la stock na pickup') : copy('Main business location', 'Eneo kuu la biashara')}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-brand-900/75">
                            {primaryLocation
                                ? copy(`${primaryLocation.name} is shown first in your settings.`, `${primaryLocation.name} ndio linaonekana kwanza kwenye mipangilio yako.`)
                                : personalMode
                                    ? copy('Start by adding one location where your products are kept or where the customer can collect them.', 'Anza kwa kuweka eneo moja ambalo bidhaa zako zipo au mteja anaweza kuchukua.')
                                    : copy('Start by adding your main shop, office, or store. Shipping and stock routing will be configured after a location exists.', 'Anza kwa kuweka duka, ofisi, au stoo kuu. Usafirishaji na mtiririko wa stock zitasanidiwa baada ya eneo kuwepo.')}
                        </p>
                    </div>
                    <Button
                        type="button"
                        className="h-10 rounded-xl font-bold"
                        onClick={startCreate}
                        disabled={personalLimitReached}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {locations.length === 0 ? copy('Add the first location', 'Weka eneo la kwanza') : copy('Add location', 'Ongeza eneo')}
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
                                    {personalMode ? copy('You have not added a stock/pickup location yet.', 'Bado hujaweka eneo la stock/pickup.') : copy('You have not added a business location yet.', 'Bado hujaweka eneo la biashara.')}
                                </p>
                                <p className="mx-auto mt-1 max-w-xl text-xs font-semibold leading-5 text-muted-foreground">
                                    {personalMode
                                        ? copy('This is required when you sell stock on hand. The full address is used after an order starts.', 'Hili linahitajika kama unauza bidhaa uliyonayo mkononi. Anwani kamili hutumika baada ya order kuanzishwa.')
                                        : copy('A location keeps pickup, shipping, and stock routing clear for the customer.', 'Eneo husaidia pickup, usafirishaji, na mtiririko wa stock kufanya kazi bila kumchanganya mteja.')}
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
                                                countries={countries}
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
                            <p className="text-xs font-black uppercase text-brand-700">{copy('Where do products come from?', 'Bidhaa zinatoka wapi?')}</p>
                            <p className="text-[11px] font-semibold leading-5 text-brand-700/80">
                                {copy('For each shop, choose the store or warehouse that supplies products. This matters for businesses with multiple locations.', 'Kwa kila duka, chagua stoo au ghala linalotoa bidhaa. Hii ni muhimu kwa biashara zenye maeneo mengi.')}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {shops.map((shop) => {
                                const route = routeByShopId[Number(shop.id)] || {};
                                return (
                                    <div key={shop.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl border border-brand-100 bg-white p-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-500">{copy('Shop', 'Duka')}</p>
                                            <p className="text-sm font-bold text-slate-900">{shop.name}</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-500">{copy('Serving store / warehouse', 'Stoo / ghala linalohudumia')}</label>
                                            <select
                                                className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2 text-xs font-semibold"
                                                value={route.serving_store_location_id ?? ''}
                                                onChange={(e) => updateShopRoute(shop.id, 'serving_store_location_id', e.target.value)}
                                            >
                                                <option value="">{copy('Choose store or warehouse', 'Chagua stoo au ghala')}</option>
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
                                {copy('Save routing', 'Hifadhi mpangilio')}
                            </Button>
                        </div>
                    </div>
                )}

                {personalLimitReached && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                        {copy('A personal account allows one stock/pickup location. Edit the existing location, or create a business to add more locations.', 'Personal account inaruhusu eneo moja tu la stock/pickup. Hariri eneo lililopo, au tengeneza biashara nyingine ili kuongeza maeneo mengi.')}
                    </div>
                )}

                {!personalLimitReached && !isFormOpen && locations.length > 0 && (
                    <Button type="button" variant="outline" onClick={startCreate} className="h-11 w-full rounded-xl border-dashed font-bold">
                        <Plus className="mr-2 h-4 w-4" />
                        {copy('Add another location', 'Ongeza eneo jingine')}
                    </Button>
                )}

                {!personalLimitReached && isFormOpen && (
                    <form id="shop-location-form" onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                                    {editingId
                                        ? (personalMode ? copy('Edit stock/pickup location', 'Hariri eneo la stock/pickup') : copy('Edit location', 'Hariri eneo'))
                                        : (personalMode ? copy('Add stock/pickup location', 'Ongeza eneo la stock/pickup') : copy('Add new location', 'Ongeza eneo jipya'))}
                                </h4>
                                <p className="mt-1 text-[11px] font-semibold leading-5 text-muted-foreground">
                                    {copy('Choose the location type, find the address on the map, then set pickup or primary location options as needed.', 'Chagua aina ya eneo, tafuta anwani kwenye ramani, kisha weka pickup au eneo kuu kama inahitajika.')}
                                </p>
                            </div>
                            <Button type="button" variant="ghost" onClick={resetForm} className="h-9 rounded-xl px-3 text-xs font-bold">
                                <X className="mr-1.5 h-4 w-4" />
                                {copy('Close', 'Funga')}
                            </Button>
                        </div>

                        {!personalMode && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{copy('What type of location are you adding?', 'Unaongeza eneo la aina gani?')}</p>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                    {[
                                        { key: 'shop', label: copy('Shop / office', 'Duka / Ofisi'), hint: copy('Where customers see or collect products.', 'Mahali wateja wanaona au kuchukua bidhaa.') },
                                        { key: 'store', label: copy('Store', 'Stoo'), hint: copy('Stock source for one or more shops.', 'Chanzo cha stock kwa duka moja au zaidi.') },
                                        { key: 'warehouse', label: copy('Warehouse', 'Ghala'), hint: copy('A larger place for storing stock.', 'Eneo kubwa la kuhifadhi stock.') },
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
                                    {personalMode ? copy('Location name (e.g. Home stock)', 'Jina la Eneo (Mf. Stock ya Nyumbani)') : copy('Shop name (e.g. Sinza shop)', 'Jina la Duka (Mf. Duka la Sinza)')}
                                </label>
                                <Input
                                    placeholder={copy('Name this location', 'Jina la eneo hili')}
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="bg-muted/30 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">{copy('Find location (Google Maps)', 'Tafuta Eneo (Google Maps)')}</label>
                                {isLoaded ? (
                                    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
                                        <Input
                                            type="text"
                                            placeholder={copy('Search a street or building...', 'Tafuta mtaa au jengo...')}
                                            className="bg-muted/30 rounded-xl"
                                        />
                                    </Autocomplete>
                                ) : (
                                    <Input disabled placeholder={copy('Loading map...', 'Inapakia ramani...')} className="bg-muted/30 rounded-xl" />
                                )}
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">{copy('Phone number for this shop/store', 'Namba ya Simu ya Ofisi/Stoo hii')}</label>
                                <Input
                                    placeholder={copy('Example: 07........', 'Mfano: 07........')}
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
                                    <p className="text-xs">{copy('The map will appear here after you add the Google API key.', 'Ramani itaonekana hapa ukishaweka Google API Key.')}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 p-4 bg-brand-50/50 rounded-2xl border border-brand-100 mb-2">
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase text-brand-600 mb-1">{copy('Location settings', 'Mipangilio ya eneo')}</p>
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
                                                {personalMode ? copy('Primary stock location', 'Eneo kuu la stock') : copy('Primary location', 'Eneo kuu')}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium font-inter">
                                                {personalMode ? copy('This will be the first choice for pickup/delivery.', 'Eneo hili litakuwa chaguo la kwanza kwa pickup/delivery.') : copy('This will be the first choice for shipping.', 'Eneo hili litakuwa chaguo la kwanza la usafirishaji.')}
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
                                            <span className="text-xs font-black text-brand-700 group-hover:text-brand-900 transition-colors uppercase">{copy('Allow customer pickup', 'Ruhusu mteja kuchukua mwenyewe')}</span>
                                            <span className="text-[10px] text-brand-600/60 font-medium font-inter">
                                                {personalMode ? copy('The customer can pay, then agree pickup in the order chat.', 'Mteja anaweza kulipia kisha mkakubaliana pickup kwenye order chat.') : copy('Customers can collect products themselves at this location.', 'Wateja wataweza kuchukua bidhaa wenyewe kwenye eneo hili.')}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        {formData.allow_self_pickup && (
                            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                                <div className="mb-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">{copy('Pickup policy', 'Sera ya pickup')}</p>
                                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                                        {copy('The customer chooses a pickup day and time window before paying. Record any later changes in the order chat.', 'Mteja atachagua siku na muda wa juu wa kuchukua kabla ya kulipa. Mabadiliko yoyote baada ya hapo yaandikwe kwenye order chat.')}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">{copy('Days ahead available for pickup selection', 'Siku za mbele za kuchagua muda wa pickup')}</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="30"
                                            value={formData.pickup_advance_days}
                                            onChange={e => setFormData(prev => ({ ...prev, pickup_advance_days: e.target.value }))}
                                            className="rounded-xl bg-white"
                                        />
                                        <p className="text-[10px] font-semibold leading-4 text-slate-500">
                                            {copy('How many days ahead can the customer choose? 0 = today only. 1 = today and tomorrow.', 'Utaruhusu mteja achague kuja kuchukua hadi siku ngapi mbele toka muda wa kuweka oda? 0 = leo tu. 1 = leo na kesho.')}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">{copy('Cancellation penalty (%)', 'Penalty ya cancellation (%)')}</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="99.99"
                                            step="0.01"
                                            value={formData.pickup_cancellation_penalty_percent}
                                            onChange={e => setFormData(prev => ({ ...prev, pickup_cancellation_penalty_percent: e.target.value }))}
                                            className="rounded-xl bg-white"
                                        />
                                        <p className="text-[10px] font-semibold leading-4 text-slate-500">
                                            {copy('Applied if the customer does not collect before the agreed time and the order is cancelled for non-collection.', 'Ikitumika kama mteja hajachukua mpaka muda mlioafikiana upite na order kusitishwa kwa mteja kufeli kuchukua.')}
                                        </p>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <label className="inline-flex items-center gap-2 text-[10px] font-bold uppercase text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5" />
                                                {copy('Pickup time', 'Muda wa pickup')}
                                            </label>
                                            <span className="text-[10px] font-semibold text-slate-500">
                                                {copy('Customers choose within these one-hour time ranges.', 'Wateja watachagua ndani ya muda huu kwa range za saa moja.')}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                            {normalizePickupWindows(formData.pickup_available_windows).map((window) => (
                                                <div key={window.day} className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white p-2">
                                                    <label className="flex w-16 items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                                        <input
                                                            type="checkbox"
                                                            checked={window.enabled}
                                                            onChange={e => setFormData(prev => ({
                                                                ...prev,
                                                                pickup_available_windows: normalizePickupWindows(prev.pickup_available_windows).map(item => item.day === window.day ? { ...item, enabled: e.target.checked } : item)
                                                            }))}
                                                        />
                                                        {(() => { const label = PICKUP_DAYS.find(day => day.day === window.day)?.label || ''; return copy(label, PICKUP_DAY_TRANSLATIONS[label] || label); })()}
                                                    </label>
                                                    <Input
                                                        type="time"
                                                        step="1800"
                                                        value={window.start}
                                                        disabled={!window.enabled}
                                                        onChange={e => setFormData(prev => ({
                                                            ...prev,
                                                            pickup_available_windows: normalizePickupWindows(prev.pickup_available_windows).map(item => item.day === window.day ? { ...item, start: e.target.value } : item)
                                                        }))}
                                                        className="h-9 rounded-lg bg-white text-xs disabled:opacity-50"
                                                    />
                                                    <span className="text-xs font-bold text-slate-400">{copy('to', 'hadi')}</span>
                                                    <Input
                                                        type="time"
                                                        step="1800"
                                                        value={window.end}
                                                        disabled={!window.enabled}
                                                        onChange={e => setFormData(prev => ({
                                                            ...prev,
                                                            pickup_available_windows: normalizePickupWindows(prev.pickup_available_windows).map(item => item.day === window.day ? { ...item, end: e.target.value } : item)
                                                        }))}
                                                        className="h-9 rounded-lg bg-white text-xs disabled:opacity-50"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">{copy('Pickup instructions', 'Maelekezo ya pickup')}</label>
                                        <textarea
                                            value={formData.pickup_instructions}
                                            onChange={e => setFormData(prev => ({ ...prev, pickup_instructions: e.target.value }))}
                                            placeholder={copy('E.g. Bring the Pickup PIN. Pickup Monday-Saturday 8:30 AM-4 PM. Agree any extension in the order chat before cancellation.', 'Mf. Njoo na Pickup PIN. Pickup Jumatatu-Jumamosi 8:30AM-4PM. Ukihitaji extension, tukubaliane kwenye order chat kabla order haijacanceliwa.')}
                                            className="min-h-20 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-200"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={resetForm} className="h-11 px-4 rounded-xl font-bold flex gap-2">
                                <X className="h-4 w-4" />
                                {copy('Cancel', 'Ghairi')}
                            </Button>

                            <Button type="submit" disabled={isSaving || !formData.address} className="bg-brand-600 hover:bg-brand-700 h-11 px-6 rounded-xl font-bold flex gap-2">
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : editingId ? (
                                    <Pencil className="h-4 w-4" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                {editingId ? copy('Save changes', 'Hifadhi Mabadiliko') : copy('Save location', 'Hifadhi Eneo')}
                            </Button>
                        </div>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}

function LocationShippingManager({ location, profiles = [], locations = [], merchantId = null, onRefresh, countries = [] }) {
    const { copy } = useLocale();
    const [activeProfileId, setActiveProfileId] = useState(null);
    const [isAddingTemplate, setIsAddingTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [isSavingPolicy, setIsSavingPolicy] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

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
            toast.success(copy('New shipping setup added!', 'Mpangilio mpya wa usafirishaji umeongezwa!'));
            if (onRefresh) onRefresh();
            // Automatically switch to the new template
            if (res.data.data) setActiveProfileId(res.data.data.id);
        } catch (err) {
            toast.error(copy('Could not add shipping setup.', 'Imeshindikana kuongeza mpangilio wa usafirishaji.'));
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (id, name) => {
        if (profiles.length <= 1) {
            toast.error(copy('You cannot delete your last delivery setup.', 'Huwezi kufuta mpangilio wako wa mwisho wa delivery.'));
            return;
        }
        if (!confirm(copy(`Are you sure you want to delete the "${name}" setup? This will delete all shipping routes inside it.`, `Je, una uhakika unataka kufuta mpangilio "${name}"? Hii itafuta njia zote za usafirishaji ndani yake.`))) return;

        try {
            await window.axios.delete(`/api/merchant/shipping-profiles/${id}`, { data: { merchant_id: merchantId } });
            toast.success(copy('Shipping setup deleted.', 'Mpangilio wa usafirishaji umefutwa.'));
            if (activeProfileId === id) {
                const other = profiles.find(p => p.id !== id);
                setActiveProfileId(other ? other.id : null);
            }
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not delete shipping setup.', 'Imeshindikana kufuta mpangilio wa usafirishaji.'));
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await window.axios.post(`/api/merchant/shipping-profiles/${id}/set-default`, { merchant_id: merchantId });
            toast.success(copy('Default shipping setup updated.', 'Mpangilio wa kawaida wa usafirishaji umesasishwa.'));
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error(copy('Could not update default.', 'Imeshindikana kusasisha default.'));
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
                in_city_enabled: Boolean(activeProfile.in_city_enabled),
                intercity_enabled: Boolean(activeProfile.intercity_enabled),
                international_enabled: Boolean(activeProfile.international_enabled),
            });
            toast.success(copy('Area rule updated.', 'Kanuni ya maeneo imesasishwa.'));
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not update area rule.', 'Imeshindikana kusasisha kanuni ya maeneo.'));
        } finally {
            setIsSavingPolicy(false);
        }
    };

    const handleSectionToggle = async (key) => {
        if (!activeProfile) return;

        setIsSavingPolicy(true);
        try {
            await window.axios.put(`/api/merchant/shipping-profiles/${activeProfile.id}`, {
                merchant_id: merchantId,
                name: activeProfile.name,
                is_default: Boolean(activeProfile.is_default),
                outside_area_policy: activeProfile.outside_area_policy || 'inquiry',
                in_city_enabled: key === 'in_city_enabled' ? !activeProfile.in_city_enabled : Boolean(activeProfile.in_city_enabled),
                intercity_enabled: key === 'intercity_enabled' ? !activeProfile.intercity_enabled : Boolean(activeProfile.intercity_enabled),
                international_enabled: key === 'international_enabled' ? !activeProfile.international_enabled : Boolean(activeProfile.international_enabled),
            });
            toast.success(copy('Template section updated.', 'Sehemu ya template imesasishwa.'));
            if (onRefresh) onRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not update template section.', 'Imeshindikana kusasisha sehemu ya template.'));
        } finally {
            setIsSavingPolicy(false);
        }
    };

    if (profiles.length === 0 && !isAddingTemplate) {
        return (
            <div className="text-center py-6 bg-muted/20 rounded-xl border border-dashed border-input">
                <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-md text-muted-foreground font-bold mb-3">{copy('No shipping templates yet.', 'Bado hujaweka mipangilio ya usafirishaji.')}</p>
                <p className="mx-auto mb-3 max-w-lg text-xs font-semibold leading-5 text-muted-foreground">{copy('Create one setup for products that use the same delivery prices. You can add another later for heavier or larger products.', 'Tengeneza mpangilio mmoja kwa bidhaa zenye bei sawa ya delivery. Unaweza kuongeza mwingine baadaye kwa bidhaa nzito au kubwa.')}</p>
                <Button size="sm" onClick={() => setIsAddingTemplate(true)} className="bg-brand-600 font-bold">
                    <Plus className="h-4 w-4 mr-1" /> {copy('Create first template', 'Tengeneza mpangilio wa kwanza')}
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
                                    title={copy('Set as default', 'Weka kama kawaida')}
                                >
                                    <Star className="h-2.5 w-2.5" />
                                </button>
                            )}
                            <button
                                onClick={() => handleDeleteTemplate(p.id, p.name)}
                                className={`p-1 rounded-full ${activeProfileId === p.id ? 'hover:bg-white/20 text-white/70 hover:text-white' : 'hover:bg-red-50 text-red-400 hover:text-red-600'}`}
                                title={copy('Delete template', 'Futa mpangilio')}
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
                            placeholder={copy('Template name...', 'Jina la mpangilio...')}
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
                {copy('These setup names are only for you. Customers will not see them.', 'Majina haya ya mipangilio ni kwa ajili yako tu. Wateja hawatayaona.')}
            </div>

            <div className="bg-white/50 p-4 rounded-2xl border border-brand-100 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200 min-h-[100px]">
                {activeProfileId ? (
                    <div className="space-y-4">
                        {activeProfile && (
                            <button
                                type="button"
                                onClick={() => setShowAdvancedSettings((current) => !current)}
                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                <span>{copy('Advanced coverage rules', 'Mipangilio ya ziada ya maeneo')}</span>
                                {showAdvancedSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                        )}
                        {activeProfile && showAdvancedSettings && (
                            <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                                <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-800">{copy('Delivery sections in this template', 'Sehemu za delivery kwenye template hii')}</p>
                                    <p className="mt-1 text-xs font-semibold text-sky-900/70">
                                        {copy('Enable the areas where products in this template can be delivered. Each route you add below belongs to one area.', 'Washa sehemu ambazo bidhaa za template hii zinaweza kufikishwa. Kila njia utakayoongeza chini itaangukia kwenye sehemu moja.')}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                    {[
                                        { key: 'in_city_enabled', title: copy('Within city', 'Ndani ya mji'), hint: copy('Allow local/distance rules in this template.', 'Ruhusu rules za local/distance kwenye template hii.') },
                                        { key: 'intercity_enabled', title: copy('Intercity', 'Mikoani'), hint: copy('Allow cities, regions, or country-wide delivery within the country.', 'Ruhusu miji, mikoa, au country-wide ndani ya nchi.') },
                                        { key: 'international_enabled', title: copy('International', 'Nje ya nchi'), hint: copy('Allow international countries in this template.', 'Ruhusu nchi za kimataifa kwa template hii.') },
                                    ].map((section) => (
                                        <button
                                            key={section.key}
                                            type="button"
                                            disabled={isSavingPolicy}
                                            onClick={() => handleSectionToggle(section.key)}
                                            className={`rounded-2xl border p-3 text-left transition ${activeProfile[section.key] ? 'border-sky-300 bg-white text-sky-900' : 'border-slate-200 bg-white/60 text-slate-400'}`}
                                        >
                                            <span className="block text-xs font-black uppercase tracking-wide">{activeProfile[section.key] ? 'ON' : 'OFF'} · {section.title}</span>
                                            <span className="mt-1 block text-[10px] font-semibold leading-4">{section.hint}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex flex-col gap-3 rounded-2xl border border-white bg-white/80 p-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">{copy('If the customer address is outside your configured areas', 'Kama anwani ya Mteja ipo nje ya maeneo uliyoweka')}</p>
                                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                                            {copy('This applies after checking all enabled areas: within city, intercity, and international.', 'Hii hutumika baada ya kuangalia sehemu zote zilizo ON: ndani ya mji, mikoani, na nje ya nchi.')}
                                        </p>
                                    </div>
                                    <select
                                        value={activeProfile.outside_area_policy || 'inquiry'}
                                        disabled={isSavingPolicy}
                                        onChange={(e) => handleOutsideAreaPolicyChange(e.target.value)}
                                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    >
                                        <option value="inquiry">{copy('Accept order, confirm delivery in chat', 'Pokea oda, thibitisha delivery kwenye chat')}</option>
                                        <option value="block">{copy('Block checkout if no route matches', 'Zuia checkout kama hakuna njia inayolingana')}</option>
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
                            activeProfile={activeProfile}
                            countries={countries}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground italic">
                        <p className="text-xs">{copy('Choose or create a template first.', 'Chagua au tengeneza template kwanza.')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
