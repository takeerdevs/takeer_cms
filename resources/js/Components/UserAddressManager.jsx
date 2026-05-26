import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { MapPin, Plus, Trash2, CheckCircle2, Globe, Ship, ChevronRight, Search, Loader2, X, Phone, Info, Map as MapIcon, ArrowLeft, Plane, Truck } from 'lucide-react';
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
const ENABLED_FORWARDER_MODES = new Set(['sea_cargo', 'air_cargo']);
const blankShipmentForm = {
    seller_platform: '',
    seller_name: '',
    external_order_ref: '',
    tracking_number: '',
    package_description: '',
    package_count: '1',
    weight_estimate: '',
    declared_value: '',
    declared_currency: 'USD',
    receipt_url: '',
    invoice_url: '',
    notes: '',
};

function routeLabel(route) {
    const firstOrigin = route.origin_locations?.[0];
    const firstDestination = route.destination_locations?.[0];
    const origin = firstOrigin?.country?.name || firstOrigin?.state?.name || firstOrigin?.city_record?.name || 'Origin';
    const destination = firstDestination?.country?.name || firstDestination?.state?.name || firstDestination?.city_record?.name || 'Destination';

    return `${origin} to ${destination}`;
}

function transportModeLabel(mode) {
    return {
        air_cargo: 'Air cargo',
        sea_cargo: 'Sea cargo',
        road_cargo: 'Road cargo',
        bus_parcel: 'Bus parcel',
        customs_clearing: 'Customs clearing',
        warehousing: 'Warehousing',
        last_mile_delivery: 'Last-mile delivery',
        import_forwarding: 'Import forwarding',
    }[mode] || String(mode || '').replace(/_/g, ' ');
}

function transportModeIcon(mode) {
    if (mode === 'air_cargo') return Plane;
    if (mode === 'sea_cargo') return Ship;
    return Truck;
}

function AddressTypeIcon({ address }) {
    if (address.type !== 'forwarder') {
        return <MapPin className="h-5 w-5" />;
    }

    const Icon = transportModeIcon(address.forwarder_transport_mode);

    return <Icon className="h-5 w-5" />;
}

function forwarderAddressEligibility(address, productOriginCountryIds = [], destinationCountryId = null) {
    if (address.type !== 'forwarder') {
        return { allowed: true, reason: '' };
    }

    const originCountrySet = new Set((productOriginCountryIds || []).map((id) => String(id)).filter(Boolean));
    const route = address.forwarder_route || address.forwarderRoute || {};
    const originCountryId = route.origin_country_id || address.country_id || address.country?.id || address.forwarder?.country_id || address.forwarder?.country?.id;
    const routeDestinationCountryId = route.destination_country_id || address.forwarder_destination_country_id || null;
    const destinationCountryKey = destinationCountryId ? String(destinationCountryId) : '';

    if (originCountrySet.size > 0 && !originCountrySet.has(String(originCountryId || ''))) {
        return {
            allowed: false,
            reason: 'Forwarder route hii haianzi kwenye nchi ya duka/bidhaa hii.',
        };
    }

    if (destinationCountryKey && routeDestinationCountryId && String(routeDestinationCountryId) !== destinationCountryKey) {
        return {
            allowed: false,
            reason: 'Forwarder route hii haiendi kwenye nchi ya mteja uliyochagua.',
        };
    }

    return { allowed: true, reason: '' };
}

function pricingUnitLabel(model) {
    return {
        per_kg: 'kg',
        per_cbm: 'CBM',
        per_item: 'item',
        fixed: 'fixed',
        quote: 'quote',
    }[model] || String(model || '').replace('per_', '');
}

function transportModeSummary(mode) {
    const label = transportModeLabel(mode.mode || mode);
    const estimate = mode.estimate ? `${mode.estimate} days` : '';
    const price = mode.price_amount
        ? `${mode.currency || 'USD'} ${mode.price_amount}/${pricingUnitLabel(mode.pricing_model)}`
        : '';

    return [label, estimate, price].filter(Boolean).join(' · ');
}

function paymentTermLabel(term) {
    return {
        pay_on_pickup: 'Pay on pickup',
        pay_before_shipping: 'Pay before shipping',
        deposit_balance: 'Deposit + balance',
        quote_after_receiving: 'Quote after receiving',
        included_or_seller_paid: 'Included / seller paid',
    }[term] || '';
}

function paymentTermSummary(mode) {
    const label = paymentTermLabel(mode.payment_term);
    if (!label) return '';
    if (mode.payment_term === 'deposit_balance' && mode.deposit_value) {
        const deposit = mode.deposit_type === 'fixed' ? mode.deposit_value : `${mode.deposit_value}%`;
        return `${label}: ${deposit}${mode.balance_due ? `, balance ${mode.balance_due}` : ''}`;
    }
    return [label, mode.payment_notes].filter(Boolean).join(' · ');
}

function routeTransportSummary(route) {
    return (route.transport_modes || [])
        .map(transportModeSummary)
        .filter(Boolean)
        .join(' / ');
}

function locationPlace(location) {
    return [
        location?.city_record?.name,
        location?.state?.name,
        location?.country?.name,
    ].filter(Boolean).join(', ');
}

function templateFieldDefinitions(template = '', fallbackFields = []) {
    const matches = [...String(template || '').matchAll(/\{\{\s*([a-zA-Z0-9_ -]+)\s*:\s*([^}]+)\s*\}\}/g)];
    if (matches.length > 0) {
        return matches.map((match) => ({
            key: String(match[1] || '').trim().replace(/\s+/g, '_').toLowerCase(),
            label: String(match[2] || match[1] || '').trim(),
        })).filter((field) => field.key);
    }

    return (Array.isArray(fallbackFields) ? fallbackFields : []).map((field) => ({
        key: String(field || '').trim().replace(/\s+/g, '_').toLowerCase(),
        label: String(field || '').replace(/_/g, ' '),
    })).filter((field) => field.key);
}

function fillAddressTemplate(template = '', inputs = {}) {
    return String(template || '').replace(
        /\{\{\s*([a-zA-Z0-9_ -]+)\s*:\s*([^}]+)\s*\}\}/g,
        (_, rawKey) => inputs[String(rawKey || '').trim().replace(/\s+/g, '_').toLowerCase()] || '',
    ).replace(/[ \t]{2,}/g, ' ').trim();
}

function previewAddressTemplate(template = '') {
    return String(template || '').replace(
        /\{\{\s*([a-zA-Z0-9_ -]+)\s*:\s*([^}]+)\s*\}\}/g,
        (_, rawKey, label) => `[${String(label || rawKey || '').trim()}]`,
    ).replace(/[ \t]{2,}/g, ' ').trim();
}

export default function UserAddressManager({
    onSelect,
    selectedId,
    mode = 'manage',
    isGuest = false,
    productOriginCountryIds = [],
    destinationCountryId = null,
}) {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(!isGuest);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isForwarderPickerOpen, setIsForwarderPickerOpen] = useState(false);
    const [forwarders, setForwarders] = useState([]);
    const [selectedForwarder, setSelectedForwarder] = useState(null);
    const [selectedTransportMode, setSelectedTransportMode] = useState('');
    const [forwarderInputs, setForwarderInputs] = useState({});
    const [forwarderSearchQuery, setForwarderSearchQuery] = useState('');
    const [shipmentAddress, setShipmentAddress] = useState(null);
    const [shipmentForm, setShipmentForm] = useState(blankShipmentForm);
    const [shipmentSubmitting, setShipmentSubmitting] = useState(false);

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
            const flattened = (res.data.forwarders || []).flatMap((forwarder) => {
                const routeOrigins = (forwarder.routes || []).flatMap((route) => (
                    (route.origin_locations || []).map((location) => ({
                        ...location,
                        forwarder_route_id: route.id,
                        forwarder_route_uid: route.route_uid,
                        route_label: routeLabel(route),
                        route_rates_info: routeTransportSummary(route),
                        transport_modes: (route.transport_modes || []).filter((mode) => ENABLED_FORWARDER_MODES.has(mode.mode || mode)),
                        route_customer_instructions: route.customer_instructions,
                        route_destination_label: route.destination_locations?.map((item) => item.country?.name).filter(Boolean).filter((item, index, all) => all.indexOf(item) === index).join(', '),
                        route_destination_country_ids: route.destination_locations?.map((item) => item.country_id || item.country?.id).filter(Boolean).map(String) || [],
                        destination_location_id: route.destination_locations?.[0]?.id || null,
                    }))
                ));
                const verifiedLocations = (routeOrigins.length > 0 ? routeOrigins : (forwarder.locations || [])).filter((location) => (
                    location.is_active !== false
                    && (location.roles || []).includes('origin')
                ));

                if (verifiedLocations.length === 0) {
                    return [];
                }

                return verifiedLocations.map((location) => {
                    const fieldDefinitions = templateFieldDefinitions(location.address_template || location.address_line, []);
                    return ({
                    ...forwarder,
                    picker_id: `${forwarder.id}-${location.forwarder_route_id || 'location'}-${location.id}`,
                    display_name: location.route_label || `${forwarder.name} · ${location.name}`,
                    location_name: location.name,
                    address_line: location.address_line,
                    address_template: location.address_template || location.address_line,
                    address_preview: previewAddressTemplate(location.address_template || location.address_line),
                    latitude: location.latitude,
                    longitude: location.longitude,
                    contact_phone: location.contact_phone || forwarder.contact_phone,
                    forwarder_route_id: location.forwarder_route_id || null,
                    forwarder_route_uid: location.forwarder_route_uid || null,
                    forwarder_location_id: location.id,
                    destination_location_id: location.destination_location_id || null,
                    route_destination_country_ids: location.route_destination_country_ids || [],
                    country_id: location.country_id || forwarder.country_id,
                    country: location.country || forwarder.country,
                    state_id: location.state_id,
                    state: location.state,
                    city_id: location.city_id,
                    city_record: location.city_record,
                    required_fields: fieldDefinitions.map((field) => field.key),
                    required_field_labels: Object.fromEntries(fieldDefinitions.map((field) => [field.key, field.label])),
                    rates_info: location.route_rates_info || forwarder.rates_info,
                    transport_modes: location.transport_modes || [],
                    route_customer_instructions: location.route_customer_instructions,
                    route_destination_label: location.route_destination_label,
                    place_label: locationPlace(location),
                    merchant_instructions: location.merchant_instructions,
                    customer_instructions: location.customer_instructions,
                    });
                });
            });
            setForwarders(flattened);
        } catch (e) {
            toast.error('Imeshindwa kupata orodha ya mawakala.');
        }
    };

    const chooseForwarder = (forwarder) => {
        setSelectedForwarder(forwarder);
        setForwarderInputs({});
        const modes = forwarder.transport_modes || [];
        setSelectedTransportMode(modes.length === 1 ? (modes[0].mode || modes[0]) : '');
    };

    const filteredForwarders = useMemo(() => {
        const originCountrySet = new Set((productOriginCountryIds || []).map((id) => String(id)).filter(Boolean));
        const destinationCountryKey = destinationCountryId ? String(destinationCountryId) : '';
        const routeRelevantForwarders = forwarders.filter((forwarder) => {
            const originCountryId = forwarder.country_id || forwarder.country?.id;
            const destinationCountryIds = (forwarder.route_destination_country_ids || []).map(String);
            const matchesOrigin = originCountrySet.size === 0 || originCountrySet.has(String(originCountryId || ''));
            const matchesDestination = !destinationCountryKey || destinationCountryIds.length === 0 || destinationCountryIds.includes(destinationCountryKey);

            return matchesOrigin && matchesDestination;
        });

        if (!forwarderSearchQuery) return routeRelevantForwarders;
        const q = forwarderSearchQuery.toLowerCase();
        return routeRelevantForwarders.filter(f =>
            f.name.toLowerCase().includes(q) ||
            (f.display_name || '').toLowerCase().includes(q) ||
            (f.location_name || '').toLowerCase().includes(q) ||
            (f.route_destination_label || '').toLowerCase().includes(q) ||
            (f.country?.name || '').toLowerCase().includes(q)
        );
    }, [destinationCountryId, forwarderSearchQuery, forwarders, productOriginCountryIds]);

    const groupedForwarders = useMemo(() => {
        const groups = {};
        filteredForwarders.forEach(f => {
            const countryName = f.route_destination_label
                ? `${f.country?.name || 'Origin'} → ${f.route_destination_label}`
                : (f.country?.name || 'Mataifa Mengine');
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

    const handleDelete = async (address) => {
        if (!window.confirm('Una uhakika unataka kufuta anuani hii?')) return;

        if (isGuest || String(address.id || '').startsWith('guest-')) {
            setAddresses((current) => current.filter((item) => item.id !== address.id));
            if (selectedId === address.id) {
                onSelect?.(null);
            }
            toast.success('Anuani imefutwa!');
            return;
        }

        try {
            await axios.delete(`/api/me/addresses/${address.id}`);
            toast.success('Anuani imefutwa!');
            if (selectedId === address.id) {
                onSelect?.(null);
            }
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
        const extraDetails = [
            details,
            selectedTransportMode ? `MODE: ${transportModeLabel(selectedTransportMode)}` : '',
            selectedForwarder.location_name ? `LOCATION: ${selectedForwarder.location_name}` : '',
            selectedForwarder.contact_phone ? `SIMU: ${selectedForwarder.contact_phone}` : '',
        ].filter(Boolean).join(' | ');
        const formattedAddress = fillAddressTemplate(selectedForwarder.address_template || selectedForwarder.address_line, forwarderInputs) || selectedForwarder.address_line;

        try {
            const res = await axios.post('/api/me/addresses', {
                type: 'forwarder',
                forwarder_id: selectedForwarder.id,
                forwarder_route_id: selectedForwarder.forwarder_route_id || undefined,
                forwarder_route_uid: selectedForwarder.forwarder_route_uid || undefined,
                forwarder_location_id: selectedForwarder.forwarder_location_id || undefined,
                forwarder_transport_mode: selectedTransportMode || undefined,
                name: selectedForwarder.display_name || selectedForwarder.name,
                address_line: formattedAddress,
                extra_details: extraDetails,
                forwarder_customer_id: forwarderInputs.customer_id || '',
                latitude: selectedForwarder.latitude,
                longitude: selectedForwarder.longitude,
                country_id: selectedForwarder.country_id || selectedForwarder.country?.id || undefined,
                state_id: selectedForwarder.state_id || selectedForwarder.state?.id || undefined,
                city_id: selectedForwarder.city_id || selectedForwarder.city_record?.id || undefined,
                is_default: addresses.length === 0,
            });
            toast.success(`Anuani ya ${selectedForwarder.name} imeongezwa!`);
            setIsForwarderPickerOpen(false);
            setSelectedForwarder(null);
            setSelectedTransportMode('');
            setForwarderInputs({});
            fetchAddresses();
            if (mode === 'select') {
                onSelect?.(res.data.address);
            }
        } catch (e) {
            toast.error('Imeshindwa kuhifadhi wakala.');
        }
    };

    const openShipmentForm = (address) => {
        setShipmentAddress(address);
        setShipmentForm({
            ...blankShipmentForm,
            external_order_ref: address.forwarder_customer_id || '',
        });
    };

    const handleCreateShipment = async () => {
        if (!shipmentAddress) return;
        if (!shipmentForm.package_description.trim() && !shipmentForm.external_order_ref.trim() && !shipmentForm.tracking_number.trim()) {
            toast.error('Add package description, seller order number, or tracking number.');
            return;
        }

        setShipmentSubmitting(true);

        try {
            await axios.post('/api/me/forwarder-shipments', {
                user_address_id: shipmentAddress.id,
                forwarder_route_id: shipmentAddress.forwarder_route_id || undefined,
                transport_mode: shipmentAddress.forwarder_transport_mode || undefined,
                origin_location_id: shipmentAddress.forwarder_location_id || undefined,
                seller_platform: shipmentForm.seller_platform || undefined,
                seller_name: shipmentForm.seller_name || undefined,
                external_order_ref: shipmentForm.external_order_ref || undefined,
                tracking_number: shipmentForm.tracking_number || undefined,
                package_description: shipmentForm.package_description || undefined,
                package_count: shipmentForm.package_count ? Number(shipmentForm.package_count) : undefined,
                weight_estimate: shipmentForm.weight_estimate || undefined,
                attachments: [
                    shipmentForm.receipt_url ? { type: 'receipt', url: shipmentForm.receipt_url } : null,
                    shipmentForm.invoice_url ? { type: 'invoice', url: shipmentForm.invoice_url } : null,
                ].filter(Boolean),
                metadata: {
                    declared_value: shipmentForm.declared_value || null,
                    declared_currency: shipmentForm.declared_currency || null,
                    customer_notes: shipmentForm.notes || null,
                },
            });
            toast.success('Shipment request created. The forwarder can now see it as incoming.');
            setShipmentAddress(null);
            setShipmentForm(blankShipmentForm);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Imeshindwa kutengeneza shipment.');
        } finally {
            setShipmentSubmitting(false);
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
                {addresses.map((addr) => {
                    const forwarderRoute = addr.forwarder_route || addr.forwarderRoute;
                    const isInactiveForwarderRoute = addr.type === 'forwarder' && addr.forwarder_route_id && forwarderRoute?.is_active === false;
                    const eligibility = forwarderAddressEligibility(addr, productOriginCountryIds, destinationCountryId);
                    const isUnavailableForwarderRoute = isInactiveForwarderRoute || !eligibility.allowed;

                    return (
                    <div
                        key={addr.id}
                        onClick={() => {
                            if (mode !== 'select') return;
                            if (isInactiveForwarderRoute) {
                                toast.error('Route hii ya freight haipo active kwa oda mpya.');
                                return;
                            }
                            if (!eligibility.allowed) {
                                toast.error(eligibility.reason || 'Forwarder route hii haitumiki kwa bidhaa hii.');
                                return;
                            }
                            onSelect?.(addr);
                        }}
                        className={`group relative rounded-2xl border-2 transition-all ${isUnavailableForwarderRoute ? 'cursor-not-allowed opacity-60 grayscale' : 'cursor-pointer'} ${mode === 'select' ? 'p-3' : 'p-4'} ${selectedId === addr.id
                            ? 'border-brand-500 bg-brand-50/50'
                            : 'border-border hover:border-brand-200 bg-card'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`rounded-xl shrink-0 ${mode === 'select' ? 'p-2' : 'p-2'} ${addr.type === 'forwarder' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                <AddressTypeIcon address={addr} />
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
                                {addr.forwarder_transport_mode && (
                                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-indigo-600">{transportModeLabel(addr.forwarder_transport_mode)}</p>
                                )}
                                {isInactiveForwarderRoute && (
                                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Route inactive</p>
                                )}
                                {!isInactiveForwarderRoute && !eligibility.allowed && (
                                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Not for this product route</p>
                                )}
                            </div>

                            <div className={`flex shrink-0 items-center gap-1 ${mode === 'manage' ? 'opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100' : 'opacity-100'}`}>
                                {mode === 'manage' && (
                                    <>
                                    {!addr.is_default && (
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground hover:text-brand-600"
                                            onClick={(e) => { e.stopPropagation(); handleSetDefault(addr.id); }}
                                            aria-label="Weka kama chaguo msingi"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {addr.type === 'forwarder' && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                                            onClick={(e) => { e.stopPropagation(); openShipmentForm(addr); }}
                                        >
                                            Shipment
                                        </Button>
                                    )}
                                    </>
                                )}
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className={`${mode === 'select' ? 'h-9 w-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-100' : 'h-8 w-8 text-muted-foreground hover:text-red-600'}`}
                                    onClick={(e) => { e.stopPropagation(); handleDelete(addr); }}
                                    aria-label="Futa anuani"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    );
                })}

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
                                                        key={f.picker_id || f.id}
                                                        onClick={() => chooseForwarder(f)}
                                                        className="p-4 rounded-2xl border border-white hover:border-brand-500 cursor-pointer flex items-center justify-between group transition-all bg-white shadow-sm hover:shadow-md"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
                                                                {f.logo_url ? <img src={f.logo_url} alt={f.name} className="h-full w-full object-contain p-2" /> : <Ship className="h-6 w-6" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-foreground">{f.display_name || f.name}</p>
                                                                {f.city_record?.name && <p className="text-[10px] font-bold text-slate-500 mt-0.5">{f.city_record.name}</p>}
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
                                        onClick={() => { setSelectedForwarder(null); setSelectedTransportMode(''); }}
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
                                                <h3 className="text-xl font-black">{selectedForwarder.display_name || selectedForwarder.name}</h3>
                                                <p className="text-indigo-100 text-xs font-medium flex items-center gap-1 mt-1">
                                                    <Globe className="h-3 w-3" /> {selectedForwarder.country?.name || 'Mataifa Mengine'}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-indigo-50 leading-relaxed font-medium">
                                            {selectedForwarder.route_customer_instructions || selectedForwarder.description || 'Huduma za kusafirisha mizigo kwa uaminifu na haraka.'}
                                        </p>
                                    </div>

                                    {/* Detailed Sections */}
                                    <div className="grid gap-4">
                                        {(selectedForwarder.transport_modes || []).length > 1 && (
                                            <div className="rounded-3xl border border-slate-200 bg-white p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Chagua njia ya kusafirisha</p>
                                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                    {(selectedForwarder.transport_modes || []).map((mode) => {
                                                        const modeKey = mode.mode || mode;
                                                        const Icon = transportModeIcon(modeKey);
                                                        const active = selectedTransportMode === modeKey;

                                                        return (
                                                            <button
                                                                key={modeKey}
                                                                type="button"
                                                                onClick={() => setSelectedTransportMode(modeKey)}
                                                                className={`rounded-2xl border p-4 text-left transition ${active ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50'}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                                        <Icon className="h-5 w-5" />
                                                                    </span>
                                                                    <span>
                                                                        <span className="block text-sm font-black text-slate-950">{transportModeLabel(modeKey)}</span>
                                                                        <span className="block text-xs font-bold text-slate-500">{mode.estimate ? `${mode.estimate} days` : 'Estimate not set'}</span>
                                                                    </span>
                                                                </div>
                                                                {mode.price_amount && (
                                                                    <p className="mt-3 rounded-full bg-white px-3 py-1 text-center text-xs font-black text-slate-900 shadow-sm">
                                                                        {mode.currency || 'USD'} {mode.price_amount}/{pricingUnitLabel(mode.pricing_model)}
                                                                    </p>
                                                                )}
                                                                {paymentTermSummary(mode) && (
                                                                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{paymentTermSummary(mode)}</p>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {(selectedForwarder.transport_modes || []).length === 1 && (
                                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Njia ya kusafirisha</p>
                                                <p className="mt-1 text-sm font-black text-indigo-950">{transportModeSummary(selectedForwarder.transport_modes[0])}</p>
                                                {paymentTermSummary(selectedForwarder.transport_modes[0]) && (
                                                    <p className="mt-1 text-xs font-bold text-indigo-800">{paymentTermSummary(selectedForwarder.transport_modes[0])}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Office Location Map */}
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                                                <MapIcon className="h-3 w-3" /> Ofisi na Warehouse (Location)
                                            </p>
                                            <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
                                                {isLoaded && selectedForwarder.latitude && selectedForwarder.longitude ? (
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
                                                ) : <div className="flex h-[180px] items-center justify-center bg-slate-100 text-xs font-bold text-slate-400">Map point not available</div>}
                                                <div className="p-3 bg-muted/20 border-t border-border">
                                                    <p className="whitespace-pre-line text-xs font-bold text-foreground">{selectedForwarder.address_line}</p>
                                                    {selectedForwarder.place_label && (
                                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{selectedForwarder.place_label}</p>
                                                    )}
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

                                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Anuani utakayo import</p>
                                            <p className="mt-2 whitespace-pre-line text-sm font-black leading-6 text-slate-950">
                                                {fillAddressTemplate(selectedForwarder.address_template || selectedForwarder.address_line, forwarderInputs) || selectedForwarder.address_preview || selectedForwarder.address_line}
                                            </p>
                                        </div>

                                        {/* Requirements Input */}
                                        {(selectedForwarder.required_fields || []).length > 0 && (
                                        <div className="p-6 rounded-3xl border-2 border-brand-100 bg-brand-50/10 space-y-4">
                                            <div className="space-y-1">
                                                <h4 className="font-black text-brand-900">Mahitaji ya Wakala</h4>
                                                <p className="text-xs text-muted-foreground font-medium">Jaza taarifa hizi ili anuani yako iwe kamili na wakala akutambue.</p>
                                            </div>

                                            <div className="space-y-4">
                                                {(selectedForwarder.required_fields || []).map(field => (
                                                    <div key={field} className="space-y-1.5">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                                                            {selectedForwarder.required_field_labels?.[field] || (field === 'customer_id' ? 'ID Yako ya Mteja (Customer ID)' : field.replace(/_/g, ' '))}
                                                        </label>
                                                        <Input
                                                            placeholder={`Ingiza ${selectedForwarder.required_field_labels?.[field] || field.replace(/_/g, ' ')}...`}
                                                            value={forwarderInputs[field] || ''}
                                                            onChange={(e) => setForwarderInputs(prev => ({ ...prev, [field]: e.target.value }))}
                                                            className="h-12 rounded-xl font-bold border-brand-100 focus:border-brand-500 shadow-sm"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        )}
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
                                        if (selectedForwarder) { setSelectedForwarder(null); setSelectedTransportMode(''); }
                                        else setIsForwarderPickerOpen(false);
                                    }}
                                >
                                    {selectedForwarder ? 'Rudi' : 'Funga'}
                                </Button>
                                <Button
                                    type="button"
                                    className="h-14 flex-1 rounded-2xl bg-brand-600 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                                    disabled={!selectedForwarder || ((selectedForwarder.transport_modes || []).length > 0 && !selectedTransportMode) || (selectedForwarder.required_fields || []).some(f => !forwarderInputs[f])}
                                    onClick={handleImportForwarder}
                                >
                                    {selectedForwarder ? 'Import Anuani Hii' : 'Chagua Wakala'}
                                </Button>
                            </div>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
            <Drawer open={Boolean(shipmentAddress)} onOpenChange={(open) => !open && setShipmentAddress(null)}>
                <DrawerContent
                    overlayClassName="bg-slate-950/55 backdrop-blur-[2px]"
                    className="mx-auto max-h-[92vh] max-w-2xl overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
                >
                    <div className="flex max-h-[92vh] flex-col bg-white">
                        <DrawerHeader className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 text-left">
                            <DrawerTitle className="text-2xl font-black tracking-tight text-slate-950">Create cargo request</DrawerTitle>
                            <DrawerDescription className="mt-1 text-sm font-semibold text-slate-500">
                                Add external purchase details so the forwarder can identify what is incoming.
                            </DrawerDescription>
                        </DrawerHeader>
                        <div className="flex-1 overflow-y-auto px-5 py-5">
                            {shipmentAddress && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Forwarder address</p>
                                        <h3 className="mt-1 text-lg font-black text-slate-950">{shipmentAddress.name || 'Imported forwarder address'}</h3>
                                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-600">{shipmentAddress.address_line}</p>
                                        {shipmentAddress.forwarder_transport_mode && (
                                            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-indigo-700">{transportModeLabel(shipmentAddress.forwarder_transport_mode)}</p>
                                        )}
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <ShipmentField label="Seller platform">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.seller_platform} onChange={(event) => setShipmentForm((prev) => ({ ...prev, seller_platform: event.target.value }))} placeholder="Alibaba, Taobao, 1688..." />
                                        </ShipmentField>
                                        <ShipmentField label="Seller name">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.seller_name} onChange={(event) => setShipmentForm((prev) => ({ ...prev, seller_name: event.target.value }))} placeholder="Supplier/store name" />
                                        </ShipmentField>
                                        <ShipmentField label="Order number">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.external_order_ref} onChange={(event) => setShipmentForm((prev) => ({ ...prev, external_order_ref: event.target.value }))} placeholder="Seller order/reference number" />
                                        </ShipmentField>
                                        <ShipmentField label="Tracking number">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.tracking_number} onChange={(event) => setShipmentForm((prev) => ({ ...prev, tracking_number: event.target.value }))} placeholder="Courier/tracking code if available" />
                                        </ShipmentField>
                                    </div>

                                    <ShipmentField label="Package description" hint="Describe what the forwarder should expect.">
                                        <textarea
                                            className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                            value={shipmentForm.package_description}
                                            onChange={(event) => setShipmentForm((prev) => ({ ...prev, package_description: event.target.value }))}
                                            placeholder="E.g. 2 cartons of shoes, electronics accessories, spare parts..."
                                        />
                                    </ShipmentField>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <ShipmentField label="Packages">
                                            <Input type="number" min="1" className="h-12 rounded-xl font-bold" value={shipmentForm.package_count} onChange={(event) => setShipmentForm((prev) => ({ ...prev, package_count: event.target.value }))} />
                                        </ShipmentField>
                                        <ShipmentField label="Weight estimate">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.weight_estimate} onChange={(event) => setShipmentForm((prev) => ({ ...prev, weight_estimate: event.target.value }))} placeholder="E.g. 12kg" />
                                        </ShipmentField>
                                        <ShipmentField label="Declared value">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.declared_value} onChange={(event) => setShipmentForm((prev) => ({ ...prev, declared_value: event.target.value }))} placeholder="E.g. 120" />
                                        </ShipmentField>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <ShipmentField label="Receipt link">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.receipt_url} onChange={(event) => setShipmentForm((prev) => ({ ...prev, receipt_url: event.target.value }))} placeholder="Paste receipt URL if available" />
                                        </ShipmentField>
                                        <ShipmentField label="Invoice link">
                                            <Input className="h-12 rounded-xl font-bold" value={shipmentForm.invoice_url} onChange={(event) => setShipmentForm((prev) => ({ ...prev, invoice_url: event.target.value }))} placeholder="Paste invoice/packing list URL" />
                                        </ShipmentField>
                                    </div>

                                    <ShipmentField label="Notes for forwarder">
                                        <textarea
                                            className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                            value={shipmentForm.notes}
                                            onChange={(event) => setShipmentForm((prev) => ({ ...prev, notes: event.target.value }))}
                                            placeholder="Any special instruction, supplier contact, or package identification note."
                                        />
                                    </ShipmentField>

                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
                                        External purchases are tracking-only on Takeer. Refunds or seller disputes stay with the platform where payment happened.
                                    </div>
                                </div>
                            )}
                        </div>
                        <DrawerFooter className="shrink-0 border-t border-slate-100 bg-white p-4">
                            <div className="flex gap-3">
                                <Button type="button" variant="outline" className="h-12 flex-1 rounded-2xl font-black" onClick={() => setShipmentAddress(null)}>Cancel</Button>
                                <Button type="button" className="h-12 flex-1 rounded-2xl font-black" disabled={shipmentSubmitting} onClick={handleCreateShipment}>
                                    {shipmentSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Create shipment
                                </Button>
                            </div>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
}

function ShipmentField({ label, hint, children }) {
    return (
        <label className="block space-y-1.5">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
            {hint && <span className="block text-xs font-semibold text-slate-500">{hint}</span>}
            {children}
        </label>
    );
}
