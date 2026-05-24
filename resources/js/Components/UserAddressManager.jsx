import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { MapPin, Plus, Trash2, CheckCircle2, Globe, Ship, ChevronRight, Search, Loader2, X, Phone, Info, Map as MapIcon, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import AddressPickerModal from './AddressPickerModal';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/Components/ui/Drawer';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const MAP_CONTAINER_STYLE = {
    width: '100%',
    height: '180px',
    borderRadius: '16px',
};

const libraries = ['places'];

export default function UserAddressManager({ onSelect, selectedId, mode = 'manage', isGuest = false }) {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(!isGuest);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isForwarderPickerOpen, setIsForwarderPickerOpen] = useState(false);
    const [forwarders, setForwarders] = useState([]);
    const [selectedForwarder, setSelectedForwarder] = useState(null);
    const [forwarderInputs, setForwarderInputs] = useState({});
    const [forwarderSearchQuery, setForwarderSearchQuery] = useState('');

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries: libraries,
    });

    useEffect(() => {
        if (!isGuest) {
            fetchAddresses();
        }
    }, [isGuest]);

    const fetchAddresses = async () => {
        try {
            const res = await axios.get('/api/me/addresses');
            setAddresses(res.data.addresses);
        } catch (e) {
            toast.error('Imeshindwa kupata anuani zako.');
        } finally {
            setLoading(false);
        }
    };

    const fetchForwarders = async () => {
        try {
            const res = await axios.get('/api/forwarders');
            setForwarders(res.data.forwarders);
        } catch (e) {
            toast.error('Imeshindwa kupata orodha ya mawakala.');
        }
    };

    const filteredForwarders = useMemo(() => {
        if (!forwarderSearchQuery) return forwarders;
        const q = forwarderSearchQuery.toLowerCase();
        return forwarders.filter(f =>
            f.name.toLowerCase().includes(q) ||
            (f.country?.name || '').toLowerCase().includes(q)
        );
    }, [forwarders, forwarderSearchQuery]);

    const groupedForwarders = useMemo(() => {
        const groups = {};
        filteredForwarders.forEach(f => {
            const countryName = f.country?.name || 'Mataifa Mengine';
            if (!groups[countryName]) groups[countryName] = [];
            groups[countryName].push(f);
        });
        return groups;
    }, [filteredForwarders]);

    const handleSetDefault = async (id) => {
        try {
            await axios.post(`/api/me/addresses/${id}/set-default`);
            toast.success('Anuani imewekwa kama chaguo msingi!');
            fetchAddresses();
        } catch (e) {
            toast.error('Imeshindwa kubadili chaguo msingi.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Una uhakika unataka kufuta anuani hii?')) return;
        try {
            await axios.delete(`/api/me/addresses/${id}`);
            toast.success('Anuani imefutwa!');
            fetchAddresses();
        } catch (e) {
            toast.error('Imeshindwa kufuta anuani.');
        }
    };

    const handleSaveFromMap = async (data) => {
        if (isGuest) {
            const guestAddr = {
                id: 'guest-' + Date.now(),
                type: 'local',
                address_line: data.address,
                extra_details: data.extraDetails,
                latitude: data.lat,
                longitude: data.lng,
                name: data.address.split(',')[0],
            };
            setAddresses([guestAddr]);
            onSelect?.(guestAddr);
            setIsMapOpen(false);
            return;
        }

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
            toast.success('Anuani mpya imeongezwa!');
            fetchAddresses();
            if (mode === 'select') {
                onSelect?.(res.data.address);
            }
        } catch (e) {
            toast.error('Imeshindwa kuhifadhi anuani.');
        }
    };

    const handleImportForwarder = async () => {
        if (!selectedForwarder) return;

        const details = Object.entries(forwarderInputs)
            .map(([k, v]) => `${k.replace('_', ' ').toUpperCase()}: ${v}`)
            .join(' | ');

        try {
            const res = await axios.post('/api/me/addresses', {
                type: 'forwarder',
                forwarder_id: selectedForwarder.id,
                name: selectedForwarder.name,
                address_line: selectedForwarder.address_line,
                extra_details: `${details}${selectedForwarder.contact_phone ? ' | SIMU: ' + selectedForwarder.contact_phone : ''}`,
                forwarder_customer_id: forwarderInputs.customer_id || '',
                latitude: selectedForwarder.latitude,
                longitude: selectedForwarder.longitude,
                is_default: addresses.length === 0,
            });
            toast.success(`Anuani ya ${selectedForwarder.name} imeongezwa!`);
            setIsForwarderPickerOpen(false);
            setSelectedForwarder(null);
            setForwarderInputs({});
            fetchAddresses();
            if (mode === 'select') {
                onSelect?.(res.data.address);
            }
        } catch (e) {
            toast.error('Imeshindwa kuhifadhi wakala.');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p className="text-sm">Inapakia anuani...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Address List */}
            <div className={`grid gap-3 ${mode === 'select' ? 'max-h-40 overflow-y-auto overscroll-contain pr-1' : ''}`}>
                {addresses.map((addr) => (
                    <div
                        key={addr.id}
                        onClick={() => mode === 'select' && onSelect?.(addr)}
                        className={`group relative rounded-2xl border-2 transition-all cursor-pointer ${mode === 'select' ? 'p-3' : 'p-4'} ${selectedId === addr.id
                            ? 'border-brand-500 bg-brand-50/50'
                            : 'border-border hover:border-brand-200 bg-card'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`rounded-xl shrink-0 ${mode === 'select' ? 'p-2' : 'p-2'} ${addr.type === 'forwarder' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                {addr.type === 'forwarder' ? <Ship className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-foreground truncate">{addr.name || 'Anuani'}</h3>
                                    {addr.is_default && (
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-brand-600 text-white px-1.5 py-0.5 rounded">Chaguo Msingi</span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-1">{addr.address_line}</p>
                                {addr.forwarder_customer_id && (
                                    <p className="text-xs font-mono text-brand-600 mt-1">ID: {addr.forwarder_customer_id}</p>
                                )}
                            </div>

                            {mode === 'manage' && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!addr.is_default && (
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground hover:text-brand-600"
                                            onClick={(e) => { e.stopPropagation(); handleSetDefault(addr.id); }}
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {addresses.length === 0 && (
                    <div className="p-8 border-2 border-dashed border-border rounded-2xl text-center text-muted-foreground">
                        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">Hujapata kuhifadhi anuani yoyote.</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
                <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-xl gap-2 font-bold text-xs uppercase tracking-widest"
                    onClick={() => setIsMapOpen(true)}
                >
                    <Plus className="h-4 w-4" /> Ongeza Mahali
                </Button>
                {!isGuest && (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl gap-2 font-bold text-xs uppercase tracking-widest border-indigo-100 text-indigo-700 hover:bg-indigo-50"
                        onClick={() => { fetchForwarders(); setIsForwarderPickerOpen(true); }}
                    >
                        <Ship className="h-4 w-4" /> Import Forwarder
                    </Button>
                )}
            </div>

            <AddressPickerModal
                isOpen={isMapOpen}
                onOpenChange={setIsMapOpen}
                onSave={handleSaveFromMap}
            />

            {/* Forwarder Picker Drawer Redesign */}
            <Drawer open={isForwarderPickerOpen} onOpenChange={setIsForwarderPickerOpen}>
                <DrawerContent
                    overlayClassName="bg-slate-950/55 backdrop-blur-[2px]"
                    className="mx-auto h-[88vh] max-w-xl overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
                >
                    <div className="flex h-full flex-col overflow-hidden bg-white">
                        <DrawerHeader className="shrink-0 border-b border-slate-100 bg-white px-5 pb-4 pt-3 text-left">
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <DrawerTitle className="text-2xl font-black tracking-tight text-slate-950">Mawakala wa Kusafirisha</DrawerTitle>
                                    <DrawerDescription className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                                        Pata anuani ya wakala wako wa kusafirisha mizigo toka nje.
                                    </DrawerDescription>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsForwarderPickerOpen(false)}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                                    aria-label="Funga"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {!selectedForwarder && (
                                <div className="mt-4 relative">
                                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        placeholder="Tafuta wakala au nchi..."
                                        value={forwarderSearchQuery}
                                        onChange={(e) => setForwarderSearchQuery(e.target.value)}
                                        className="h-14 rounded-2xl border-slate-200 bg-slate-50 pl-12 text-base font-bold text-slate-900 shadow-inner shadow-slate-200/40 placeholder:text-slate-400 focus:bg-white"
                                    />
                                </div>
                            )}
                        </DrawerHeader>

                        <div className="flex-1 overflow-y-auto bg-slate-50 px-5 pb-5">
                            {!selectedForwarder ? (
                                <div className="space-y-6 pt-4">
                                    {Object.entries(groupedForwarders).map(([country, items]) => (
                                        <div key={country} className="space-y-3">
                                            <div className="flex items-center gap-2 px-1">
                                                <Globe className="h-4 w-4 text-brand-600" />
                                                <h4 className="text-xs font-black uppercase tracking-widest text-brand-900/60">{country}</h4>
                                            </div>
                                            <div className="grid gap-2">
                                                {items.map(f => (
                                                    <div
                                                        key={f.id}
                                                        onClick={() => setSelectedForwarder(f)}
                                                        className="p-4 rounded-2xl border border-white hover:border-brand-500 cursor-pointer flex items-center justify-between group transition-all bg-white shadow-sm hover:shadow-md"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                                                                {f.logo_url ? <img src={f.logo_url} alt={f.name} className="h-full w-full object-contain p-2" /> : <Ship className="h-6 w-6" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-foreground">{f.name}</p>
                                                                {f.rates_info && <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight mt-0.5">{f.rates_info}</p>}
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-brand-600 transition-transform group-hover:translate-x-1" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(groupedForwarders).length === 0 && (
                                        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-8 text-center">
                                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                                                <Search className="h-8 w-8" />
                                            </div>
                                            <p className="text-base font-black text-slate-800">Hakuna wakala aliyepatikana</p>
                                            <p className="mt-2 max-w-xs text-sm font-semibold leading-6 text-slate-500">
                                                Jaribu kutafuta kwa jina la wakala au nchi nyingine.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6 pt-4 animate-in slide-in-from-right-4 duration-300">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedForwarder(null)}
                                        className="flex items-center gap-2 text-xs font-bold text-brand-600 uppercase tracking-widest hover:translate-x-[-4px] transition-transform"
                                    >
                                        <ArrowLeft className="h-3 w-3" /> Rudi kwenye orodha
                                    </button>

                                    <div className="p-6 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-200">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                                <Ship className="h-8 w-8 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black">{selectedForwarder.name}</h3>
                                                <p className="text-indigo-100 text-xs font-medium flex items-center gap-1 mt-1">
                                                    <Globe className="h-3 w-3" /> {selectedForwarder.country?.name || 'Mataifa Mengine'}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-indigo-50 leading-relaxed font-medium">
                                            {selectedForwarder.description || 'Huduma za kusafirisha mizigo kwa uaminifu na haraka.'}
                                        </p>
                                    </div>

                                    {/* Detailed Sections */}
                                    <div className="grid gap-4">
                                        {/* Office Location Map */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                                <MapIcon className="h-3 w-3" /> Ofisi na Warehouse (Location)
                                            </p>
                                            <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
                                                {isLoaded ? (
                                                    <GoogleMap
                                                        mapContainerStyle={MAP_CONTAINER_STYLE}
                                                        center={{ lat: parseFloat(selectedForwarder.latitude), lng: parseFloat(selectedForwarder.longitude) }}
                                                        zoom={14}
                                                        options={{
                                                            streetViewControl: false,
                                                            mapTypeControl: false,
                                                            fullscreenControl: false,
                                                            zoomControl: false,
                                                        }}
                                                    >
                                                        <Marker position={{ lat: parseFloat(selectedForwarder.latitude), lng: parseFloat(selectedForwarder.longitude) }} />
                                                    </GoogleMap>
                                                ) : <div className="h-[180px] bg-muted animate-pulse" />}
                                                <div className="p-3 bg-muted/20 border-t border-border">
                                                    <p className="text-xs font-bold text-foreground">{selectedForwarder.address_line}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Rates & Contact */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/30 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                                                    <Info className="h-3 w-3" /> Gharama (Rates)
                                                </p>
                                                <p className="text-xs font-bold text-indigo-950 leading-relaxed">
                                                    {selectedForwarder.rates_info || 'Wasiliana na wakala kujua gharama.'}
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                                                    <Phone className="h-3 w-3" /> Mawasiliano
                                                </p>
                                                <p className="text-xs font-bold text-emerald-950">
                                                    {selectedForwarder.contact_phone || 'Namba haijawekwa.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Requirements Input */}
                                        <div className="p-6 rounded-3xl border-2 border-brand-100 bg-brand-50/10 space-y-4">
                                            <div className="space-y-1">
                                                <h4 className="font-black text-brand-900">Mahitaji ya Wakala</h4>
                                                <p className="text-xs text-muted-foreground font-medium">Jaza taarifa hizi ili anuani yako iwe kamili na wakala akutambue.</p>
                                            </div>

                                            <div className="space-y-4">
                                                {(selectedForwarder.required_fields || ['customer_id']).map(field => (
                                                    <div key={field} className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                            {field === 'customer_id' ? 'ID Yako ya Mteja (Customer ID)' : field.replace('_', ' ')}
                                                        </label>
                                                        <Input
                                                            placeholder={`Ingiza ${field}...`}
                                                            value={forwarderInputs[field] || ''}
                                                            onChange={(e) => setForwarderInputs(prev => ({ ...prev, [field]: e.target.value }))}
                                                            className="h-12 rounded-xl font-bold border-brand-100 focus:border-brand-500 shadow-sm"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DrawerFooter className="shrink-0 border-t border-slate-200 bg-white p-4">
                            <div className="mx-auto flex w-full max-w-xl gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-14 flex-1 rounded-2xl border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-950 shadow-sm hover:bg-slate-50"
                                    onClick={() => {
                                        if (selectedForwarder) setSelectedForwarder(null);
                                        else setIsForwarderPickerOpen(false);
                                    }}
                                >
                                    {selectedForwarder ? 'Rudi' : 'Funga'}
                                </Button>
                                <Button
                                    type="button"
                                    className="h-14 flex-1 rounded-2xl bg-brand-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                                    disabled={!selectedForwarder || (selectedForwarder.required_fields || ['customer_id']).some(f => !forwarderInputs[f])}
                                    onClick={handleImportForwarder}
                                >
                                    {selectedForwarder ? 'Import Anuani Hii' : 'Chagua Wakala'}
                                </Button>
                            </div>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
