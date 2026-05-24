import React, { useState, useRef, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/Components/ui/Drawer';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { MapPin, Search, Navigation, CheckCircle2, X } from 'lucide-react';

const MAP_CONTAINER_STYLE = {
    width: '100%',
    height: '300px',
    borderRadius: '16px',
};

const DEFAULT_CENTER = {
    lat: -6.7924, // Dar es Salaam
    lng: 39.2083,
};

const libraries = ['places'];

export default function AddressPickerModal({
    isOpen,
    onOpenChange,
    initialLat,
    initialLng,
    initialAddress,
    initialExtraDetails,
    onSave
}) {
    const [lat, setLat] = useState(parseFloat(initialLat) || DEFAULT_CENTER.lat);
    const [lng, setLng] = useState(parseFloat(initialLng) || DEFAULT_CENTER.lng);
    const [address, setAddress] = useState(initialAddress || '');
    const [extraDetails, setExtraDetails] = useState(initialExtraDetails || '');
    const [city, setCustomerCity] = useState('');
    const [region, setCustomerRegion] = useState('');
    const [mapCenter, setMapCenter] = useState({
        lat: parseFloat(initialLat) || DEFAULT_CENTER.lat,
        lng: parseFloat(initialLng) || DEFAULT_CENTER.lng
    });
    const mapRef = useRef(null);

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries: libraries
    });

    const autocompleteRef = useRef(null);

    // Sync state only when drawer OPENS to avoid resets during typing/selecting
    useEffect(() => {
        if (isOpen) {
            const startLat = parseFloat(initialLat) || DEFAULT_CENTER.lat;
            const startLng = parseFloat(initialLng) || DEFAULT_CENTER.lng;
            setLat(startLat);
            setLng(startLng);
            setAddress(initialAddress || '');
            setExtraDetails(initialExtraDetails || '');
            setCustomerCity('');
            setCustomerRegion('');
            setMapCenter({ lat: startLat, lng: startLng });
        }
    }, [isOpen]); // Depend only on isOpen to trigger initialization once per open

    const onPlaceChanged = () => {
        if (autocompleteRef.current !== null) {
            const place = autocompleteRef.current.getPlace();
            if (place && place.geometry && place.geometry.location) {
                const newLat = place.geometry.location.lat();
                const newLng = place.geometry.location.lng();

                let placeCity = '';
                let placeRegion = '';
                if (place.address_components) {
                    for (const component of place.address_components) {
                        if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                            placeCity = component.long_name;
                        }
                        if (component.types.includes('administrative_area_level_1')) {
                            placeRegion = component.long_name;
                        }
                    }
                }

                const newPos = { lat: newLat, lng: newLng };
                setLat(newLat);
                setLng(newLng);
                setCustomerCity(placeCity);
                setCustomerRegion(placeRegion);
                setMapCenter(newPos);
                setAddress(place.formatted_address || place.name || '');

                if (mapRef.current) {
                    mapRef.current.panTo(newPos);
                    mapRef.current.setZoom(17);
                }
            }
        }
    };

    const reverseGeocode = (latitude, longitude) => {
        if (!window.google) return;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            if (status === 'OK' && results[0]) {
                setAddress(results[0].formatted_address);

                let placeCity = '';
                let placeRegion = '';
                for (const component of results[0].address_components) {
                    if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                        placeCity = component.long_name;
                    }
                    if (component.types.includes('administrative_area_level_1')) {
                        placeRegion = component.long_name;
                    }
                }
                setCustomerCity(placeCity);
                setCustomerRegion(placeRegion);
            }
        });
    };

    const onMarkerDragEnd = (e) => {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        setLat(newLat);
        setLng(newLng);
        reverseGeocode(newLat, newLng);
    };

    const handleSave = () => {
        onSave({
            lat,
            lng,
            address,
            extraDetails,
            city,
            region
        });
        onOpenChange(false);
    };

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange} dismissible={false}>
            <DrawerContent className="w-full sm:max-w-xl sm:mx-auto p-0 border-t-0 bg-background dark:bg-slate-950">
                <div className="p-4 sm:p-6 space-y-4">
                    <DrawerHeader className="p-0 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="bg-emerald-600 p-1.5 rounded-lg text-white">
                                <MapPin className="h-4 w-4" />
                            </div>
                            <DrawerTitle className="text-xl font-black text-brand-900">Chagua Sehemu</DrawerTitle>
                        </div>
                        <DrawerDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">
                            Tafuta mtaa au jengo kisha rekebisha pini
                        </DrawerDescription>
                    </DrawerHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5 pt-1">
                            {isLoaded ? (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                                    <Autocomplete
                                        onLoad={(a) => autocompleteRef.current = a}
                                        onPlaceChanged={onPlaceChanged}
                                    >
                                        <Input
                                            placeholder="Tafuta mtaa, jengo au njiapanda..."
                                            className="bg-muted/30 rounded-xl h-11 border-emerald-100 focus:border-emerald-400 pl-10 font-bold w-full outline-none transition-all"
                                        />
                                    </Autocomplete>
                                </div>
                            ) : (
                                <div className="h-11 bg-muted/30 animate-pulse rounded-xl" />
                            )}
                        </div>

                        <div className="border border-emerald-100 dark:border-emerald-900/60 rounded-2xl overflow-hidden shadow-sm">
                            {isLoaded ? (
                                <GoogleMap
                                    mapContainerStyle={MAP_CONTAINER_STYLE}
                                    center={mapCenter}
                                    zoom={15}
                                    onLoad={map => mapRef.current = map}
                                    options={{
                                        streetViewControl: false,
                                        mapTypeControl: false,
                                        fullscreenControl: false,
                                        zoomControl: false,
                                    }}
                                >
                                    <Marker
                                        position={{ lat, lng }}
                                        draggable={true}
                                        onDragEnd={onMarkerDragEnd}
                                        animation={window.google && window.google.maps.Animation ? window.google.maps.Animation.DROP : null}
                                    />
                                </GoogleMap>
                            ) : (
                                <div className="w-full h-[300px] bg-muted flex items-center justify-center text-xs text-muted-foreground italic font-medium">
                                    Pakia ramani...
                                </div>
                            )}
                        </div>

                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="bg-emerald-600 rounded-lg p-1.5 shrink-0 mt-0.5 shadow-sm text-white">
                                <Navigation className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black leading-tight text-emerald-600 uppercase tracking-widest mb-1">Eneo Lililochaguliwa</p>
                                <p className="text-xs font-bold leading-relaxed text-emerald-900 dark:text-emerald-100">
                                    {address || 'Tafuta sehemu au drag pini...'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                            <label className="text-[10px] font-black tracking-widest ml-1">Maelezo ya ziada (Mtaa/Nyumba/Maelekezo ya nani akabidhiwe)</label>
                            <Input
                                value={extraDetails}
                                onChange={(e) => setExtraDetails(e.target.value)}
                                placeholder="Mfano: Kimara, Mtaa wa Pili, Nyumba no. 43 au karibu na duka la..."
                                className="h-12 bg-white dark:bg-slate-900/50 border-emerald-100 dark:border-brand-900/40 rounded-xl px-4 font-bold text-sm focus:border-emerald-400 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <DrawerFooter className="p-0 pt-2 grid grid-cols-2 gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-slate-200 hover:bg-slate-50"
                        >
                            <X className="h-4 w-4 mr-2" /> Ghairi
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={!address}
                            className="h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-600/20 active:scale-95 transition-all"
                        >
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Hifadhi Mahali
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
