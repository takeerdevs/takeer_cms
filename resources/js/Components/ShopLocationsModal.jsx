import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/Components/ui/Drawer';
import { Button } from '@/Components/ui/Button';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { MapPin, Navigation, X, Store, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';

const MAP_CONTAINER_STYLE = {
    width: '100%',
    height: '250px',
    borderRadius: '16px',
};

const libraries = ['places'];

export default function ShopLocationsModal({ 
    isOpen, 
    onOpenChange, 
    locations = [], 
    inventories = [],
    productName = 'Bidhaa'
}) {
    const [selectedLocation, setSelectedLocation] = useState(locations.find(l => l.is_primary) || locations[0] || null);

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries: libraries
    });

    const getStockForLocation = (locationId) => {
        const inv = inventories.find(i => i.merchant_location_id === locationId);
        return inv ? inv.quantity : 0;
    };

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent className="w-full sm:max-w-xl sm:mx-auto p-0 border-t-0 bg-background dark:bg-slate-950">
                <div className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                    <DrawerHeader className="p-0 mb-2">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="bg-brand-600 p-1.5 rounded-lg text-white">
                                <Store className="h-4 w-4" />
                            </div>
                            <DrawerTitle className="text-xl font-black">Ona Bidhaa Ilipo</DrawerTitle>
                        </div>
                        <DrawerDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-none">
                            Shop na maeneo yanayopatikana kwa pickup
                        </DrawerDescription>
                    </DrawerHeader>

                    {selectedLocation && (
                        <div className="border border-brand-100 dark:border-brand-900/60 rounded-2xl overflow-hidden shadow-sm">
                            {isLoaded ? (
                                <GoogleMap
                                    mapContainerStyle={MAP_CONTAINER_STYLE}
                                    center={{ 
                                        lat: parseFloat(selectedLocation.latitude), 
                                        lng: parseFloat(selectedLocation.longitude) 
                                    }}
                                    zoom={15}
                                    options={{ 
                                        streetViewControl: false, 
                                        mapTypeControl: false, 
                                        fullscreenControl: false,
                                        zoomControl: false,
                                    }}
                                >
                                    <Marker
                                        position={{ 
                                            lat: parseFloat(selectedLocation.latitude), 
                                            lng: parseFloat(selectedLocation.longitude) 
                                        }}
                                    />
                                </GoogleMap>
                            ) : (
                                <div className="w-full h-[250px] bg-muted animate-pulse" />
                            )}
                        </div>
                    )}

                    <div className="space-y-3 pt-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Orodha ya Maduka</p>
                        
                        <div className="grid gap-2.5">
                            {locations.map((loc) => {
                                const stock = getStockForLocation(loc.id);
                                const isSelected = selectedLocation?.id === loc.id;
                                
                                return (
                                    <button
                                        key={loc.id}
                                        onClick={() => setSelectedLocation(loc)}
                                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between gap-3 ${isSelected ? 'border-brand-600 bg-brand-50/50 shadow-sm' : 'border-slate-100 bg-white hover:border-brand-200'}`}
                                    >
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className={`font-black uppercase tracking-widest text-[11px] ${isSelected ? 'text-brand-700' : 'text-slate-900'}`}>{loc.name}</p>
                                                    {loc.is_primary && (
                                                        <span className="bg-brand-100 text-brand-700 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Primary</span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-slate-500 truncate mb-1.5">{loc.address}</p>
                                                {loc.contact_phone && (
                                                    <p className="text-[10px] font-bold text-brand-600 mb-1.5 flex items-center gap-1">
                                                        Simu: {loc.contact_phone}
                                                    </p>
                                                )}
                                                
                                                <div className="flex items-center gap-2">
                                                    {stock > 0 ? (
                                                        <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Inapatikana ({stock})</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Stock Imeisha</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {!isSelected && <ChevronRight className="h-4 w-4 text-slate-300" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <DrawerFooter className="p-0 pt-4">
                        <Button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="h-14 rounded-2xl bg-slate-900 hover:bg-black font-black uppercase tracking-widest text-xs shadow-lg"
                        >
                            Funga
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
