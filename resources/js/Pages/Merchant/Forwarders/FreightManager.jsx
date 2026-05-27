import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Card, CardContent } from '@/Components/ui/Card';
import AddressPickerModal from '@/Components/AddressPickerModal';
import {
    ArrowLeft,
    Building2,
    CalendarClock,
    ExternalLink,
    Globe,
    MapPin,
    Megaphone,
    Plane,
    Plus,
    Route,
    Save,
    Ship,
    Trash2,
    Truck,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const sectionMeta = {
    locations: { title: 'Locations', icon: MapPin, description: 'Origin warehouses, drop-off points, and destination collection offices.' },
    routes: { title: 'Routes', icon: Globe, description: 'Build import routes from real origin locations to real collection offices.' },
    schedules: { title: 'Schedules', icon: CalendarClock, description: 'Attach shipping windows to the routes customers follow.' },
    shipments: { title: 'Shipments', icon: Truck, description: 'Track incoming customer cargo requests.' },
};

const blankLocation = {
    roles: ['origin'],
    name: '',
    address_line: '',
    address_template: '',
    country_id: '',
    country_iso2: '',
    country_name: '',
    state_name: '',
    city_name: '',
    latitude: '',
    longitude: '',
    contact_person: '',
    contact_phone: '',
    business_hours: '',
    merchant_instructions: '',
    customer_instructions: '',
    is_active: true,
};

const blankDestination = {
    origin_country_id: '',
    destination_country_id: '',
    origin_location_ids: [],
    destination_location_ids: [],
    transport_modes: ['sea_cargo'],
    transport_details: {},
    customer_instructions: '',
    post_to_feed: false,
    is_active: true,
};

const blankSchedule = {
    title: '',
    route_id: '',
    transport_mode: 'sea_cargo',
    departure_date: '',
    cutoff_date: '',
    eta_text: '',
    status: 'open',
    notes: '',
};

const blankUpdate = {
    title: '',
    body: '',
    audience: 'customers',
    status: 'published',
};

const blankTransportDetail = {
    estimate: '',
    pricing_model: 'per_kg',
    price_amount: '',
    currency: 'USD',
    minimum_charge: '',
    payment_term: 'pay_on_pickup',
    deposit_type: '',
    deposit_value: '',
    balance_due: '',
    payment_notes: '',
    notes: '',
    allowed_items: '',
    disallowed_items: '',
    details: {},
};

function Field({ label, children, hint, className = '' }) {
    return (
        <label className={`block min-w-0 space-y-1.5 ${className}`}>
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
            {hint && <span className="block text-[11px] font-semibold leading-5 text-slate-500">{hint}</span>}
            {children}
        </label>
    );
}

const inputClass = 'h-12 w-full min-w-0 rounded-xl border-slate-200 bg-white text-sm font-bold text-slate-900 placeholder:text-slate-400';
const readOnlyInputClass = 'h-12 w-full min-w-0 rounded-xl border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 placeholder:text-slate-400';
const textAreaClass = 'min-h-28 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100';
const errorMessage = (error, fallback = 'Something went wrong.') => {
    const errors = error.response?.data?.errors;
    const firstValidationMessage = errors
        ? Object.values(errors).flat().find(Boolean)
        : null;

    return firstValidationMessage || error.response?.data?.message || error.message || fallback;
};
const roleMeta = {
    origin: { label: 'Origin warehouse / drop-off', badge: 'bg-indigo-50 text-indigo-700', icon: 'Origin' },
    destination: { label: 'Destination collection office', badge: 'bg-emerald-50 text-emerald-700', icon: 'Destination' },
};

const transportOptions = [
    ['sea_cargo', 'Sea cargo'],
    ['air_cargo', 'Air cargo'],
    // Re-enable later when the freight product expands beyond air/sea goods shipment.
    // ['road_cargo', 'Road cargo'],
    // ['bus_parcel', 'Bus parcel'],
    // ['customs_clearing', 'Customs clearing'],
    // ['warehousing', 'Warehousing'],
    // ['last_mile_delivery', 'Last-mile delivery'],
    // ['import_forwarding', 'Import forwarding'],
];
const enabledTransportModeKeys = new Set(transportOptions.map(([key]) => key));
const paymentTermOptions = [
    ['pay_on_pickup', 'Pay on pickup'],
    ['pay_before_shipping', 'Pay before shipping'],
    ['deposit_balance', 'Deposit + balance'],
    ['quote_after_receiving', 'Quote after receiving'],
    ['included_or_seller_paid', 'Included / seller paid'],
];

function shipmentPaymentTermText(shipment) {
    const detail = shipment.route_snapshot?.payment_terms?.[shipment.transport_mode] || {};
    const label = paymentTermOptions.find(([key]) => key === detail.payment_term)?.[1] || '';
    if (!label) return '';
    if (detail.payment_term === 'deposit_balance' && detail.deposit_value) {
        const deposit = detail.deposit_type === 'fixed' ? detail.deposit_value : `${detail.deposit_value}%`;
        return `${label}: ${deposit}${detail.balance_due ? `, balance ${detail.balance_due}` : ''}`;
    }
    return [label, detail.payment_notes].filter(Boolean).join(' · ');
}

export default function FreightManager({ merchantUsername, section = 'profile', forwarder = {}, countries = [], currencies = [] }) {
    const activeMeta = sectionMeta[section] || sectionMeta.locations;
    const ActiveIcon = activeMeta.icon;
    const [data, setData] = useState(forwarder);
    const [saving, setSaving] = useState(false);
    const [profileForm, setProfileForm] = useState({
        name: forwarder.name || '',
        legal_name: forwarder.legal_name || '',
        business_registration_number: forwarder.business_registration_number || '',
        contact_person: forwarder.contact_person || '',
        contact_phone: forwarder.contact_phone || '',
        contact_email: forwarder.contact_email || '',
        whatsapp_phone: forwarder.whatsapp_phone || '',
        website: forwarder.website || '',
        description: forwarder.description || '',
        required_fields: forwarder.required_fields || ['customer_id'],
    });
    const [locationForm, setLocationForm] = useState(blankLocation);
    const [editingLocationId, setEditingLocationId] = useState(null);
    const [editingRouteId, setEditingRouteId] = useState(null);
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [destinations, setDestinations] = useState(forwarder.destinations_config || []);
    const [schedules, setSchedules] = useState(forwarder.shipping_schedules || []);
    const [updates, setUpdates] = useState(forwarder.logistics_updates || []);
    const [shipments, setShipments] = useState([]);
    const [shipmentsMeta, setShipmentsMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 12, status_counts: {} });
    const [shipmentQuery, setShipmentQuery] = useState('');
    const [shipmentPage, setShipmentPage] = useState(1);
    const [shipmentsLoading, setShipmentsLoading] = useState(false);

    const locations = data.locations || [];
    const originLocations = locations.filter((location) => (location.roles || []).includes('origin'));
    const destinationLocations = locations.filter((location) => (location.roles || []).includes('destination'));
    const approvedCountryIds = useMemo(() => new Set((data.operating_country_ids || []).map((id) => Number(id)).filter(Boolean)), [data.operating_country_ids]);
    const approvedCountries = useMemo(
        () => countries.filter((country) => approvedCountryIds.has(Number(country.id))),
        [countries, approvedCountryIds],
    );
    const approvedTransportModes = useMemo(() => {
        const allowed = new Set((data.service_types || []).filter((type) => enabledTransportModeKeys.has(type)));
        return transportOptions.filter(([key]) => allowed.has(key));
    }, [data.service_types]);
    const countryName = useMemo(() => {
        const map = new Map();
        countries.forEach((country) => map.set(Number(country.id), country.name));
        return map;
    }, [countries]);
    const countryIdByIso = useMemo(() => {
        const map = new Map();
        countries.forEach((country) => map.set(String(country.iso_alpha2 || '').toUpperCase(), country.id));
        return map;
    }, [countries]);

    const apiBase = `/api/merchant/${merchantUsername}/forwarders`;

    useEffect(() => {
        if (section !== 'shipments') return;

        setShipmentsLoading(true);
        axios.get(`${apiBase}/shipments`, {
            params: { page: shipmentPage, per_page: shipmentsMeta.per_page || 12, q: shipmentQuery || undefined },
        })
            .then(({ data: res }) => {
                setShipments(res.shipments || []);
                setShipmentsMeta(res.meta || { current_page: 1, last_page: 1, total: res.shipments?.length || 0, per_page: 12, status_counts: {} });
            })
            .catch(() => toast.error('Could not load shipments.'))
            .finally(() => setShipmentsLoading(false));
    }, [section, apiBase, shipmentPage, shipmentQuery, shipmentsMeta.per_page]);

    useEffect(() => {
        setShipmentPage(1);
    }, [shipmentQuery]);

    const refreshForwarder = (nextForwarder) => {
        if (nextForwarder) setData(nextForwarder);
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const { data: res } = await axios.patch(`${apiBase}/profile`, profileForm);
            refreshForwarder(res.forwarder);
            toast.success(res.message || 'Profile updated.');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not save profile.'));
        } finally {
            setSaving(false);
        }
    };

    const saveLocation = async (event) => {
        event.preventDefault();
        if ((locationForm.roles || []).length === 0) {
            toast.error('Choose whether this location is an origin, destination, or both.');
            return;
        }
        if (!locationForm.latitude || !locationForm.longitude || !(locationForm.country_id || locationForm.country_iso2 || locationForm.country_name)) {
            toast.error('Pick the exact location on the map first so we can link country, region, city, and coordinates.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...locationForm,
                roles: Array.from(new Set(locationForm.roles || [])).filter(Boolean),
                address_template: locationForm.address_template || locationForm.address_line,
                country_id: locationForm.country_id || null,
                country_iso2: locationForm.country_iso2 || null,
                country_name: locationForm.country_name || null,
                latitude: locationForm.latitude || null,
                longitude: locationForm.longitude || null,
            };
            const url = editingLocationId ? `${apiBase}/locations/${editingLocationId}` : `${apiBase}/locations`;
            const method = editingLocationId ? 'put' : 'post';
            const { data: res } = await axios[method](url, payload);
            const nextLocations = editingLocationId
                ? locations.map((location) => Number(location.id) === Number(editingLocationId) ? res.location : location)
                : [...locations, res.location];
            setData((prev) => ({ ...prev, locations: nextLocations }));
            setLocationForm(blankLocation);
            setEditingLocationId(null);
            toast.success(res.message || 'Location saved.');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not save location.'));
        } finally {
            setSaving(false);
        }
    };

    const editLocation = (location) => {
        setEditingLocationId(location.id);
        setLocationForm({
            ...blankLocation,
            ...location,
            roles: location.roles || [],
            country_id: location.country_id || '',
            country_iso2: location.country?.iso_alpha2 || '',
            country_name: location.country?.name || '',
            state_name: location.state?.name || '',
            city_name: location.city_record?.name || location.cityRecord?.name || '',
            latitude: location.latitude || '',
            longitude: location.longitude || '',
        });
    };

    const applyPickedLocation = (picked) => {
        const iso = String(picked.countryCode || '').toUpperCase();
        setLocationForm((prev) => ({
            ...prev,
            latitude: picked.lat || '',
            longitude: picked.lng || '',
            city_name: picked.city || '',
            state_name: picked.region || '',
            country_name: picked.country || '',
            country_iso2: iso,
            country_id: countryIdByIso.get(iso) || prev.country_id || '',
        }));
    };

    const deleteLocation = async (location) => {
        if (!confirm(`Delete ${location.name}?`)) return;
        try {
            await axios.delete(`${apiBase}/locations/${location.id}`);
            setData((prev) => ({ ...prev, locations: locations.filter((item) => item.id !== location.id) }));
            toast.success('Location deleted.');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not delete location.'));
        }
    };

    const saveJsonSection = async (kind) => {
        setSaving(true);
        try {
            const payload = {
                destinations: { url: `${apiBase}/routes`, body: { destinations_config: destinations.map(routePayloadForSave) } },
                schedules: { url: `${apiBase}/schedules`, body: { shipping_schedules: schedules } },
                updates: { url: `${apiBase}/updates`, body: { logistics_updates: updates } },
            }[kind];
            const { data: res } = await axios.put(payload.url, payload.body);
            refreshForwarder(res.forwarder);
            if (kind === 'destinations') {
                setDestinations(res.forwarder?.destinations_config || destinations);
                setEditingRouteId(null);
            }
            toast.success(res.message || 'Saved.');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not save.'));
        } finally {
            setSaving(false);
        }
    };

    const addRow = (kind) => {
        if (kind === 'destinations') {
            const id = crypto.randomUUID?.() || String(Date.now());
            setDestinations((items) => [...items, { ...blankDestination, id }]);
            setEditingRouteId(id);
        }
        if (kind === 'schedules') setSchedules((items) => [...items, { ...blankSchedule, id: crypto.randomUUID?.() || String(Date.now()) }]);
        if (kind === 'updates') setUpdates((items) => [...items, { ...blankUpdate, id: crypto.randomUUID?.() || String(Date.now()) }]);
    };

    const updateRow = (kind, index, patch) => {
        const setters = { destinations: setDestinations, schedules: setSchedules, updates: setUpdates };
        setters[kind]((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    };

    const removeRow = (kind, index) => {
        const setters = { destinations: setDestinations, schedules: setSchedules, updates: setUpdates };
        setters[kind]((items) => items.filter((_, itemIndex) => itemIndex !== index));
    };

    const updateShipmentStatus = async (shipment, payload) => {
        try {
            const { data: res } = await axios.patch(`${apiBase}/shipments/${shipment.id}`, payload);
            setShipments((items) => items.map((item) => Number(item.id) === Number(shipment.id) ? res.shipment : item));
            toast.success(res.message || 'Shipment updated.');
        } catch (error) {
            toast.error(errorMessage(error, 'Could not update shipment.'));
        }
    };

    const toggleLocationRole = (role) => {
        setLocationForm((prev) => {
            const current = new Set(prev.roles || []);
            if (current.has(role)) current.delete(role);
            else current.add(role);

            if (current.size === 0) {
                current.add(role);
            }

            return { ...prev, roles: Array.from(current) };
        });
    };

    const geoCountryLabel = locationForm.country_name || countryName.get(Number(locationForm.country_id)) || '';
    const pickerSearchLabel = [locationForm.city_name, locationForm.state_name, geoCountryLabel].filter(Boolean).join(', ');
    const routeOptions = destinations.map((route, index) => ({
        ...route,
        id: route.id || String(index),
        label: routeLabel(route, locations, index),
    }));

    return (
        <AppLayout>
            <Head title={`${activeMeta.title} | Freight Hub`} />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <Link href="/profile" className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-brand-700">
                            <ArrowLeft className="h-4 w-4" /> Profile
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">
                                <ActiveIcon className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-950">{activeMeta.title}</h1>
                                <p className="text-sm font-semibold text-slate-500">{activeMeta.description}</p>
                            </div>
                        </div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-700">
                        <Ship className="h-4 w-4" /> Verified Freight
                    </span>
                </div>

                {section === 'locations' && (
                    <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
                        <div className="space-y-3">
                            {locations.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">No locations yet.</div>
                            ) : locations.map((location) => (
                                <Card key={location.id} className="rounded-2xl border-slate-200 bg-white shadow-sm">
                                    <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <p className="flex items-center gap-2 text-base font-black text-slate-950">
                                                {(location.roles || []).includes('origin') ? <WarehouseIcon /> : <Building2 className="h-5 w-5 text-emerald-700" />}
                                                {location.name}
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-500">{location.address_line}</p>
                                            <p className="mt-1 text-xs font-bold text-slate-400">
                                                {[location.city_record?.name, location.state?.name, location.country?.name].filter(Boolean).join(', ') || 'No linked geography'}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {(location.roles || []).map((role) => (
                                                    <span key={role} className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${roleMeta[role]?.badge || 'bg-slate-100 text-slate-600'}`}>
                                                        {roleMeta[role]?.icon || role}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button type="button" variant="outline" onClick={() => editLocation(location)}>Edit</Button>
                                            <Button type="button" variant="ghost" className="text-red-600" onClick={() => deleteLocation(location)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
                            <CardContent className="p-5">
                                <form onSubmit={saveLocation} className="space-y-4">
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">{editingLocationId ? 'Edit location' : 'Add location'}</h2>
                                    <Field label="Location roles" hint="A single physical office can be used as origin, destination, or both.">
                                        <div className="grid gap-2">
                                            {Object.entries(roleMeta).map(([role, meta]) => {
                                                const active = (locationForm.roles || []).includes(role);
                                                return (
                                                    <button
                                                        key={role}
                                                        type="button"
                                                        onClick={() => toggleLocationRole(role)}
                                                        className={`flex min-h-12 items-center justify-between rounded-xl border px-3 text-left text-sm font-black transition ${active ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                                                    >
                                                        {meta.label}
                                                        <span className={`h-3 w-3 rounded-full ${active ? 'bg-brand-600' : 'bg-slate-200'}`} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Field>
                                    <Field label="Location name"><Input className={inputClass} value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} required /></Field>
                                    <Field label="Official address"><textarea className={textAreaClass} value={locationForm.address_line} onChange={(e) => setLocationForm({ ...locationForm, address_line: e.target.value })} required /></Field>
                                    <Field
                                        label="Customer shipping address format"
                                        hint="This is the address customers copy/import for this exact location. Add customer fields with {{field_key: Field label}}, e.g. Suite {{suite_number: Suite number}}."
                                    >
                                        <textarea
                                            className={textAreaClass}
                                            value={locationForm.address_template || ''}
                                            onChange={(e) => setLocationForm({ ...locationForm, address_template: e.target.value })}
                                            placeholder={'{{full_name:Customer full name}}\nNo. 15 Gongtong Industrial Zone East, Lishui Town, Nanhai District, Foshan City\nSuite {{suite_number:Suite number}}\n{{phone_number:Customer phone number}}'}
                                        />
                                    </Field>
                                    <button
                                        type="button"
                                        onClick={() => setIsLocationPickerOpen(true)}
                                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                                    >
                                        <MapPin className="h-4 w-4" /> Pick exact location on map (required)
                                    </button>
                                    <Field label="Country" hint="Filled from the map pin for accurate country matching.">
                                        <Input className={readOnlyInputClass} value={geoCountryLabel} placeholder="Pick on map" readOnly />
                                    </Field>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="State / region"><Input className={readOnlyInputClass} value={locationForm.state_name} placeholder="Pick on map" readOnly /></Field>
                                        <Field label="City"><Input className={readOnlyInputClass} value={locationForm.city_name} placeholder="Pick on map" readOnly /></Field>
                                        <Field label="Latitude"><Input className={readOnlyInputClass} value={locationForm.latitude} placeholder="Pick on map" readOnly /></Field>
                                        <Field label="Longitude"><Input className={readOnlyInputClass} value={locationForm.longitude} placeholder="Pick on map" readOnly /></Field>
                                    </div>
                                    <Field label="Contact person"><Input className={inputClass} value={locationForm.contact_person} onChange={(e) => setLocationForm({ ...locationForm, contact_person: e.target.value })} /></Field>
                                    <Field label="Contact phone"><Input className={inputClass} value={locationForm.contact_phone} onChange={(e) => setLocationForm({ ...locationForm, contact_phone: e.target.value })} /></Field>
                                    <Field label="Business hours" hint="When this office accepts packages or serves customers.">
                                        <Input
                                            className={inputClass}
                                            value={locationForm.business_hours}
                                            onChange={(e) => setLocationForm({ ...locationForm, business_hours: e.target.value })}
                                            placeholder="E.g. Mon-Fri (09:00 AM - 2:00 PM), Sat (09:00 AM - 12:00 PM)"
                                        />
                                    </Field>
                                    <Field label="Seller instructions" hint="Information sellers/merchants should know before sending a package to this location.">
                                        <textarea
                                            className={textAreaClass}
                                            value={locationForm.merchant_instructions}
                                            onChange={(e) => setLocationForm({ ...locationForm, merchant_instructions: e.target.value })}
                                            placeholder="E.g. Write customer code on the carton, send packing list on WhatsApp, no liquids or restricted goods."
                                        />
                                    </Field>
                                    <Field label="Customer instructions" hint="Information customers should see when choosing this pickup or forwarding location.">
                                        <textarea
                                            className={textAreaClass}
                                            value={locationForm.customer_instructions}
                                            onChange={(e) => setLocationForm({ ...locationForm, customer_instructions: e.target.value })}
                                            placeholder="E.g. Bring ID and order code when collecting. You will receive SMS/WhatsApp once cargo arrives."
                                        />
                                    </Field>
                                    <div className="flex gap-2">
                                        <Button type="submit" disabled={saving} className="h-12 flex-1 rounded-2xl font-black"><Save className="mr-2 h-4 w-4" /> Save</Button>
                                        {editingLocationId && <Button type="button" variant="outline" onClick={() => { setEditingLocationId(null); setLocationForm(blankLocation); }}>Cancel</Button>}
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                        <AddressPickerModal
                            isOpen={isLocationPickerOpen}
                            onOpenChange={setIsLocationPickerOpen}
                            initialLat={locationForm.latitude}
                            initialLng={locationForm.longitude}
                            initialAddress={pickerSearchLabel}
                            onSave={applyPickedLocation}
                        />
                    </div>
                )}

                {section === 'routes' && (
                    <RoutesPanel
                        routes={destinations}
                        locations={locations}
                        originLocations={originLocations}
                        destinationLocations={destinationLocations}
                        approvedCountries={approvedCountries}
                        approvedCountryIds={approvedCountryIds}
                        approvedTransportModes={approvedTransportModes}
                        currencies={currencies}
                        editingRouteId={editingRouteId}
                        saving={saving}
                        onAdd={addRow}
                        onSave={saveJsonSection}
                        onRemove={removeRow}
                        onUpdate={updateRow}
                        onEdit={setEditingRouteId}
                        onCancel={() => setEditingRouteId(null)}
                    />
                )}

                {section === 'schedules' && (
                    <JsonList
                        title="Shipping schedules"
                        items={schedules}
                        kind="schedules"
                        addLabel="Add schedule"
                        onAdd={addRow}
                        onSave={saveJsonSection}
                        onRemove={removeRow}
                        renderItem={(item, index) => (
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Schedule title"><Input className={inputClass} value={item.title || ''} onChange={(e) => updateRow('schedules', index, { title: e.target.value })} placeholder="Guangzhou sea cargo - June batch" /></Field>
                                <Field label="Route"><RouteSelect routes={routeOptions} value={item.route_id} onChange={(value) => updateRow('schedules', index, { route_id: value })} /></Field>
                                <Field label="Transport mode"><TransportSelect value={item.transport_mode} onChange={(value) => updateRow('schedules', index, { transport_mode: value })} /></Field>
                                <Field label="Departure date"><Input type="date" className={inputClass} value={item.departure_date || ''} onChange={(e) => updateRow('schedules', index, { departure_date: e.target.value })} /></Field>
                                <Field label="Cargo cutoff date"><Input type="date" className={inputClass} value={item.cutoff_date || ''} onChange={(e) => updateRow('schedules', index, { cutoff_date: e.target.value })} /></Field>
                                <Field label="ETA text"><Input className={inputClass} value={item.eta_text || ''} onChange={(e) => updateRow('schedules', index, { eta_text: e.target.value })} placeholder="Arrives Dar in 35-45 days" /></Field>
                                <Field label="Status"><Input className={inputClass} value={item.status || ''} onChange={(e) => updateRow('schedules', index, { status: e.target.value })} placeholder="open / full / departed" /></Field>
                                <div className="md:col-span-2"><Field label="Notes"><textarea className={textAreaClass} value={item.notes || ''} onChange={(e) => updateRow('schedules', index, { notes: e.target.value })} /></Field></div>
                            </div>
                        )}
                    />
                )}

                {section === 'shipments' && (
                    <ShipmentsPanel
                        shipments={shipments}
                        meta={shipmentsMeta}
                        loading={shipmentsLoading}
                        query={shipmentQuery}
                        onQueryChange={setShipmentQuery}
                        onPageChange={setShipmentPage}
                        locations={locations}
                        onStatusChange={updateShipmentStatus}
                    />
                )}

                {section === 'updates' && (
                    <JsonList
                        title="Logistics updates"
                        items={updates}
                        kind="updates"
                        addLabel="Add update"
                        onAdd={addRow}
                        onSave={saveJsonSection}
                        onRemove={removeRow}
                        renderItem={(item, index) => (
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Update title"><Input className={inputClass} value={item.title || ''} onChange={(e) => updateRow('updates', index, { title: e.target.value })} placeholder="June shipment has departed" /></Field>
                                <Field label="Audience"><Input className={inputClass} value={item.audience || ''} onChange={(e) => updateRow('updates', index, { audience: e.target.value })} placeholder="customers / sellers" /></Field>
                                <Field label="Status"><Input className={inputClass} value={item.status || ''} onChange={(e) => updateRow('updates', index, { status: e.target.value })} placeholder="published / draft" /></Field>
                                <div className="md:col-span-2"><Field label="Message"><textarea className={textAreaClass} value={item.body || ''} onChange={(e) => updateRow('updates', index, { body: e.target.value })} /></Field></div>
                            </div>
                        )}
                    />
                )}
            </div>
        </AppLayout>
    );
}

const shipmentStatuses = [
    ['incoming', 'Incoming'],
    ['received_at_origin', 'Received at origin'],
    ['in_transit', 'In transit'],
    ['arrived_country', 'Arrived in country'],
    ['customs_handling', 'Customs / handling'],
    ['ready_for_pickup', 'Ready for pickup'],
    ['completed', 'Completed'],
    ['on_hold', 'On hold'],
];

function ShipmentsPanel({ shipments, meta, loading, query, onQueryChange, onPageChange, locations, onStatusChange }) {
    const statusCounts = meta?.status_counts || {};
    const currentPage = Number(meta?.current_page || 1);
    const lastPage = Number(meta?.last_page || 1);

    return (
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-4 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Shipment inbox</h2>
                        <p className="text-xs font-semibold text-slate-500">Customers create these from imported forwarder addresses. External purchases are tracking-only, not Takeer purchase protection.</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">Integration-ready lookup: update by Takeer shipment ID, tracking number, or external order reference.</p>
                    </div>
                    <Input
                        className={`${inputClass} lg:max-w-xs`}
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search shipment, tracking, customer..."
                    />
                </div>

                {shipments.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {shipmentStatuses.slice(0, 4).map(([key, label]) => (
                            <div key={key} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                                <p className="mt-1 text-2xl font-black text-slate-950">{statusCounts[key] || 0}</p>
                            </div>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-500">Loading shipments...</div>
                ) : shipments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-500">No shipment requests yet.</div>
                ) : (
                    <div className="space-y-3">
                        {shipments.map((shipment) => (
                            <ShipmentCard key={shipment.id} shipment={shipment} locations={locations} onStatusChange={onStatusChange} />
                        ))}
                    </div>
                )}

                {lastPage > 1 && (
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs font-black text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                        <span>Page {currentPage} of {lastPage} · {meta?.total || 0} shipments</span>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" disabled={currentPage <= 1 || loading} onClick={() => onPageChange(currentPage - 1)}>Previous</Button>
                            <Button type="button" variant="outline" disabled={currentPage >= lastPage || loading} onClick={() => onPageChange(currentPage + 1)}>Next</Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ShipmentCard({ shipment, locations, onStatusChange }) {
    const events = [...(shipment.events || [])].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const latestEvent = events[events.length - 1];
    const paymentText = shipmentPaymentTermText(shipment);
    const [status, setStatus] = useState(shipment.status || 'incoming');
    const [note, setNote] = useState('');
    const [locationId, setLocationId] = useState('');
    const [trackingNumber, setTrackingNumber] = useState(shipment.tracking_number || '');
    const [trackingUrl, setTrackingUrl] = useState(shipment.metadata?.freight_tracking?.tracking_url || '');
    const [carrierName, setCarrierName] = useState(shipment.metadata?.freight_tracking?.carrier_name || '');
    const [transportReference, setTransportReference] = useState(shipment.metadata?.freight_tracking?.transport_reference || '');
    const [etaText, setEtaText] = useState(shipment.metadata?.freight_tracking?.eta_text || '');
    const [expanded, setExpanded] = useState(false);
    const selectedAddress = shipment.selected_address || {};
    const destinationAddress = shipment.destination_address || {};
    const customerContact = shipment.customer_contact || {};
    const packageItems = Array.isArray(shipment.package_items) ? shipment.package_items : [];
    const orderSummary = shipment.order_summary || null;
    const paymentLabel = shipmentPaymentStatusLabel(orderSummary?.payment_status || shipment.metadata?.payment_status, shipment.source_type);
    const deliveryLabel = shipmentDeliveryStatusLabel(orderSummary?.delivery_status, shipment.source_type);
    const dropOffPlace = selectedAddress.place || placeLabel(selectedAddress.location) || selectedAddress.name || 'Not linked';
    const destinationPlace = destinationAddress?.place || placeLabel(destinationAddress) || destinationAddress?.name || routeDisplayName(shipment) || 'Not linked';
    const customerMapUrl = customerContact.default_delivery_map_url || googleMapsUrl(customerContact.default_delivery_address);
    const freightTracking = shipment.metadata?.freight_tracking || {};

    useEffect(() => {
        setStatus(shipment.status || 'incoming');
        setTrackingNumber(shipment.tracking_number || '');
        setTrackingUrl(shipment.metadata?.freight_tracking?.tracking_url || '');
        setCarrierName(shipment.metadata?.freight_tracking?.carrier_name || '');
        setTransportReference(shipment.metadata?.freight_tracking?.transport_reference || '');
        setEtaText(shipment.metadata?.freight_tracking?.eta_text || '');
    }, [shipment.status, shipment.tracking_number, shipment.metadata?.freight_tracking]);

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{shipment.public_id} · {shipment.source_type === 'takeer_order' ? 'Takeer order' : 'External purchase'}</p>
                </div>
                <span className="w-fit rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">{statusLabel(shipment.status)}</span>
            </div>
            <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-2">
                <span className="rounded-xl bg-white px-3 py-2">Drop-off: {dropOffPlace}</span>
                <span className="rounded-xl bg-white px-3 py-2">Route landing: {destinationPlace}</span>
                <span className="rounded-xl bg-white px-3 py-2">
                    Drop-off address:
                    <span className="mt-1 block whitespace-pre-line text-slate-700">
                        {selectedAddress.address_line || selectedAddress.location?.address_line || 'No address snapshot'}
                    </span>
                </span>
                <span className="rounded-xl bg-white px-3 py-2">
                    Landing address:
                    <span className="mt-1 block whitespace-pre-line text-slate-700">
                        {destinationAddress?.address_line || destinationAddress?.name || 'No destination office linked'}
                    </span>
                </span>
            </div>

            <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-3">
                <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-950">Customer phone: {customerContact.phone || 'Not provided'}</span>
                <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-950">Email: {customerContact.email || 'Not provided'}</span>
                <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-950">Name: {customerContact.name || shipment.user?.name || 'Customer'}</span>
                {customerContact.default_delivery_address && (
                    <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-950 md:col-span-3">
                        Default delivery address:
                        {customerMapUrl ? (
                            <a
                                href={customerMapUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 flex items-start gap-2 whitespace-pre-line text-emerald-900 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-700"
                            >
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    {customerContact.default_delivery_address}
                                    {customerContact.default_delivery_place && (
                                        <span className="block text-[10px] uppercase tracking-widest text-emerald-700">{customerContact.default_delivery_place}</span>
                                    )}
                                </span>
                            </a>
                        ) : (
                            <span className="mt-1 block whitespace-pre-line text-emerald-900">{customerContact.default_delivery_address}</span>
                        )}
                    </span>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => setExpanded((value) => !value)}>
                    {expanded ? 'Hide package' : 'Check package'}
                </Button>
            </div>

            {expanded && (
                <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Package contents</p>
                        <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                            {packageItems.map((item, index) => (
                                <div key={`${item.title}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                    <div className="min-w-0">
                                        <p className="truncate font-black text-slate-900">{item.title || 'Package item'}</p>
                                        <p className="text-xs font-bold text-slate-400">Qty {item.quantity || 1}</p>
                                    </div>
                                    {item.amount !== null && item.amount !== undefined && (
                                        <span className="text-xs font-black text-slate-700">TZS {Number(item.amount || 0).toLocaleString()}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 text-xs font-bold text-slate-600">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Order details</p>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">Order: {orderSummary?.public_id || shipment.external_order_ref || shipment.public_id}</div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">Payment: {paymentLabel}</div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">Seller handoff: {deliveryLabel}</div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">Total: {orderSummary?.total_paid ? `TZS ${Number(orderSummary.total_paid).toLocaleString()}` : 'Not in Takeer escrow'}</div>
                        {destinationAddress.name && <div className="rounded-xl bg-slate-50 px-3 py-2">Destination: {destinationAddress.name}</div>}
                    </div>
                </div>
            )}

            {shipment.source_type === 'external_purchase' && (
                <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-4">
                    <span className="rounded-xl bg-white px-3 py-2">Order ref: {shipment.external_order_ref || 'Not provided'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">Packages: {shipment.package_count || 'Not set'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">Weight: {shipment.weight_estimate || 'Not set'}</span>
                    <span className="rounded-xl bg-white px-3 py-2">Declared: {[shipment.metadata?.declared_currency, shipment.metadata?.declared_value].filter(Boolean).join(' ') || 'Not set'}</span>
                </div>
            )}

            {paymentText && (
                <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900">
                    Payment terms: {paymentText}
                </div>
            )}

            {(shipment.tracking_number || freightTracking.tracking_url || freightTracking.carrier_name || freightTracking.transport_reference || freightTracking.eta_text) && (
                <FreightTrackingSummary
                    className="mt-3"
                    trackingNumber={shipment.tracking_number}
                    metadata={freightTracking}
                />
            )}

            {shipment.metadata?.customer_notes && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                    Customer note: {shipment.metadata.customer_notes}
                </div>
            )}

            {Array.isArray(shipment.attachments) && shipment.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {shipment.attachments.map((attachment, index) => (
                        <a
                            key={`${attachment.type || 'file'}-${index}`}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-700 hover:bg-brand-50"
                        >
                            {attachment.type || 'Attachment'}
                        </a>
                    ))}
                </div>
            )}

            {shipment.source_type === 'external_purchase' && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    External purchase: Takeer helps track this shipment, but refunds and seller disputes are handled where the customer paid.
                </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Field label="New status">
                    <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
                        {shipmentStatuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                </Field>
                <Field label="Location">
                    <select className={inputClass} value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                        <option value="">No location</option>
                        {(locations || []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                </Field>
                <Field label="Tracking number">
                    <Input className={inputClass} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Forwarder tracking code" />
                </Field>
                <Field label="Note">
                    <Input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="E.g. Received at Foshan warehouse" />
                </Field>
                <Field label="Carrier / cargo company">
                    <Input className={inputClass} value={carrierName} onChange={(event) => setCarrierName(event.target.value)} placeholder="DHL, Silent Ocean, SF Express" />
                </Field>
                <Field label="Tracking link">
                    <Input className={inputClass} value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Flight / ship / container / batch">
                    <Input className={inputClass} value={transportReference} onChange={(event) => setTransportReference(event.target.value)} placeholder="Flight, vessel, container, batch" />
                </Field>
                <Field label="ETA / next movement">
                    <Input className={inputClass} value={etaText} onChange={(event) => setEtaText(event.target.value)} placeholder="E.g. Departs Friday, ETA 14 days" />
                </Field>
            </div>
            <div className="mt-3 flex justify-end">
                <Button type="button" onClick={() => {
                    onStatusChange(shipment, {
                        status,
                        note,
                        tracking_number: trackingNumber || null,
                        tracking_url: trackingUrl || null,
                        carrier_name: carrierName || null,
                        transport_reference: transportReference || null,
                        eta_text: etaText || null,
                        forwarder_location_id: locationId || null,
                    });
                    setNote('');
                }}>Update status</Button>
            </div>
            {latestEvent && (
                <p className="mt-3 text-xs font-semibold text-slate-500">Latest: {statusLabel(latestEvent.status)} {latestEvent.note ? `- ${latestEvent.note}` : ''}</p>
            )}
            {events.length > 0 && (
                <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tracking history</p>
                    <div className="space-y-2">
                        {events.slice(-5).reverse().map((event) => (
                            <div key={event.id} className="flex gap-3 text-xs">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                                <div>
                                    <p className="font-black text-slate-800">{statusLabel(event.status)} {event.location?.name ? `· ${event.location.name}` : ''}</p>
                                    <p className="font-semibold text-slate-500">{event.note || 'Status updated.'}</p>
                                    <FreightTrackingSummary className="mt-2" trackingNumber={event.metadata?.tracking_number} metadata={event.metadata} compact />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function FreightTrackingSummary({ metadata = {}, trackingNumber = '', compact = false, className = '' }) {
    const rows = [
        ['Carrier/cargo', metadata.carrier_name],
        ['Tracking', trackingNumber || metadata.tracking_number],
        ['Reference', metadata.transport_reference],
        ['ETA / next movement', metadata.eta_text],
    ].filter(([, value]) => value);

    if (rows.length === 0 && !metadata.tracking_url) return null;

    return (
        <div className={`${compact ? 'grid gap-1 rounded-xl border border-slate-100 bg-white px-2 py-2' : 'rounded-2xl border border-sky-100 bg-sky-50 p-3'} ${className}`}>
            <div className={`grid gap-2 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
                {rows.map(([label, value]) => (
                    <span key={label} className={`${compact ? 'text-[11px]' : 'rounded-xl bg-white px-3 py-2 text-xs'} font-bold text-slate-700`}>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                        {value}
                    </span>
                ))}
                {metadata.tracking_url && (
                    <a
                        href={metadata.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${compact ? 'text-[11px]' : 'rounded-xl bg-white px-3 py-2 text-xs'} inline-flex items-center gap-1 font-black text-brand-700 underline decoration-brand-200 underline-offset-4`}
                    >
                        <ExternalLink className="h-3 w-3" />
                        Tracking link
                    </a>
                )}
            </div>
        </div>
    );
}

function RoutesPanel({
    routes,
    locations,
    originLocations,
    destinationLocations,
    approvedCountries,
    approvedCountryIds,
    approvedTransportModes,
    currencies,
    editingRouteId,
    saving,
    onAdd,
    onSave,
    onRemove,
    onUpdate,
    onEdit,
    onCancel,
}) {
    const editingIndex = routes.findIndex((route, index) => routeKey(route, index) === editingRouteId);
    const editingRoute = editingIndex >= 0 ? routes[editingIndex] : null;
    const handleRouteRemove = (route, index) => {
        if (route.has_customer_usage) {
            if (!confirm('Archive this route? It will be hidden from new customers, but existing imported addresses and shipments will remain.')) return;
            onUpdate('destinations', index, { is_active: false });
            return;
        }

        if (!confirm('Delete this unsaved route?')) return;
        onRemove('destinations', index);
    };

    return (
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-5 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Routes</h2>
                        <p className="text-xs font-semibold text-slate-500">Create customer-ready route cards, then open any route to edit pricing and rules.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onAdd('destinations')}><Plus className="mr-2 h-4 w-4" /> Add route</Button>
                        <Button type="button" disabled={saving} onClick={() => onSave('destinations')}><Save className="mr-2 h-4 w-4" /> Save</Button>
                    </div>
                </div>

                {routes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-500">No routes yet.</div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {routes.map((route, index) => (
                            <RouteSummaryCard
                                key={routeKey(route, index)}
                                route={route}
                                index={index}
                                locations={locations}
                                active={routeKey(route, index) === editingRouteId}
                                onEdit={() => onEdit(routeKey(route, index))}
                                onRemove={() => handleRouteRemove(route, index)}
                                onToggleActive={() => onUpdate('destinations', index, { is_active: route.is_active === false })}
                            />
                        ))}
                    </div>
                )}

                {editingRoute && (
                    <div className="rounded-3xl border border-brand-100 bg-slate-50 p-4">
                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-brand-700">Editing route</p>
                                <h3 className="text-xl font-black text-slate-950">{routeLabel(editingRoute, locations, editingIndex)}</h3>
                            </div>
                            <Button type="button" variant="outline" onClick={onCancel}>Close editor</Button>
                        </div>
                        <RouteForm
                            route={editingRoute}
                            index={editingIndex}
                            locations={locations}
                            originLocations={originLocations}
                            destinationLocations={destinationLocations}
                            approvedCountries={approvedCountries}
                            approvedCountryIds={approvedCountryIds}
                            approvedTransportModes={approvedTransportModes}
                            currencies={currencies}
                            onChange={(patch) => onUpdate('destinations', editingIndex, patch)}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function RouteSummaryCard({ route, index, locations, active, onEdit, onRemove, onToggleActive }) {
    const locationById = new Map((locations || []).map((location) => [String(location.id), location]));
    const origins = (route.origin_location_ids || []).map((id) => locationById.get(String(id))).filter(Boolean);
    const destinations = (route.destination_location_ids || []).map((id) => locationById.get(String(id))).filter(Boolean);
    const label = routeLabel(route, locations, index);
    const originCount = (route.origin_location_ids || []).length;
    const destinationCount = (route.destination_location_ids || []).length;
    const modeLabels = (route.transport_modes || []).map((mode) => transportLabel(mode));
    const routeIsActive = route.is_active !== false;
    const [originFallback = 'Origin', destinationFallback = 'Destination'] = label.split(' to ');
    const originName = routePlaceNames(origins) || originFallback || 'Origin';
    const destinationName = routePlaceNames(destinations) || destinationFallback || 'Destination';
    const modeSummaries = (route.transport_modes || [])
        .map((mode) => ({
            mode,
            label: transportLabel(mode),
            detail: normalizeTransportDetail(mode, route.transport_details?.[mode]),
        }))
        .filter((item) => item.detail?.price_amount || item.detail?.estimate || item.detail?.pricing_model === 'quote')
        .slice(0, 2);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onEdit}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onEdit();
                }
            }}
            className={`group cursor-pointer overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition hover:border-brand-200 hover:shadow-md ${active ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200'} ${routeIsActive ? '' : 'opacity-60 grayscale'}`}
        >
            <div className="relative overflow-hidden bg-slate-950 px-4 py-4 text-white">
                <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.42),transparent_58%)]" />
                <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-sky-100">
                            <Ship className="h-3 w-3" />
                            Route {index + 1}
                        </div>
                        {!routeIsActive && (
                            <span className="ml-2 inline-flex rounded-full border border-amber-300/30 bg-amber-300/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-amber-100">
                                Inactive
                            </span>
                        )}
                        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                            <div className="min-w-0">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">From</p>
                                <p className="mt-1 truncate text-xl font-black leading-none">{originName}</p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10">
                                <Route className="h-4 w-4 text-sky-200" />
                            </div>
                            <div className="min-w-0 text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/45">To</p>
                                <p className="mt-1 truncate text-xl font-black leading-none">{destinationName}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-center shadow-inner">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/45">Offices</p>
                        <p className="text-lg font-black">{originCount} → {destinationCount}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-4">
                {modeSummaries.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {modeSummaries.map(({ mode, label: labelText, detail }) => {
                            const ModeIcon = mode === 'air_cargo' ? Plane : Ship;
                            const price = detail.price_amount
                                ? `${detail.currency || ''} ${detail.price_amount}${detail.pricing_model && detail.pricing_model !== 'quote' ? ` ${pricingModelLabel(detail.pricing_model)}` : ''}`.trim()
                                : (detail.pricing_model === 'quote' ? 'Quote' : '');
                            return (
                                <div key={mode} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <ModeIcon className="h-4 w-4 shrink-0 text-indigo-600" />
                                            <p className="truncate text-sm font-black text-slate-950">{labelText}</p>
                                        </div>
                                        {price && <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black text-slate-900">{price}</span>}
                                    </div>
                                    {detail.estimate && <p className="mt-1 text-xs font-black text-slate-500">{detail.estimate}</p>}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {modeLabels.map((labelText) => (
                            <span key={labelText} className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700">{labelText}</span>
                        ))}
                        {modeLabels.length === 0 && (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Add air or sea cargo</span>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {!routeIsActive && !route.has_customer_usage && (
                            <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); onRemove(); }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                                aria-label="Delete inactive route"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); onToggleActive?.(); }}
                            className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${routeIsActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                        >
                            {routeIsActive ? 'Archive' : 'Activate'}
                        </button>
                        <span className="text-xs font-black text-slate-400 transition group-hover:text-brand-600">Open to edit</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RouteForm({
    route,
    index,
    locations,
    originLocations,
    destinationLocations,
    approvedCountries,
    approvedCountryIds,
    approvedTransportModes,
    currencies = [],
    onChange,
}) {
    const selectedModes = (route.transport_modes || []).filter((mode) => approvedTransportModes.some(([key]) => key === mode));
    const updateTransportModes = (modes) => {
        onChange({
            transport_modes: modes,
            transport_details: syncTransportDetails(route.transport_details, modes),
        });
    };

    return (
        <div className="grid gap-3 md:grid-cols-2">
            <Field label="Origin country" hint="Add new countries from the Forwarder profile.">
                <CountrySelect
                    countries={approvedCountries}
                    value={route.origin_country_id || ''}
                    onChange={(value) => onChange({ origin_country_id: value, origin_location_ids: [] })}
                />
            </Field>
            <Field label="Destination country" hint="Routes can only be created between approved operating countries.">
                <CountrySelect
                    countries={approvedCountries}
                    value={route.destination_country_id || ''}
                    onChange={(value) => onChange({ destination_country_id: value, destination_location_ids: [] })}
                />
            </Field>
            <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 md:col-span-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">Route name</p>
                <p className="mt-1 text-base font-black text-slate-950">{routeLabel(route, locations, index)}</p>
            </div>
            <div className="md:col-span-2">
                <Field label="Origin locations" hint="Select every warehouse/drop-off that can process this route.">
                    <LocationChecklist
                        locations={locationsInApprovedCountry(originLocations, route.origin_country_id, approvedCountryIds)}
                        value={route.origin_location_ids || []}
                        onChange={(value) => onChange({ origin_location_ids: value })}
                        emptyText={route.origin_country_id ? 'No origin-role locations in this country yet.' : 'Select origin country first.'}
                    />
                </Field>
            </div>
            <div className="md:col-span-2">
                <Field label="Destination collection offices" hint="Customers will see these offices for pickup or in-country handling.">
                    <LocationChecklist
                        locations={locationsInApprovedCountry(destinationLocations, route.destination_country_id, approvedCountryIds)}
                        value={route.destination_location_ids || []}
                        onChange={(value) => onChange({ destination_location_ids: value })}
                        emptyText={route.destination_country_id ? 'No destination-role locations in this country yet.' : 'Select destination country first.'}
                    />
                </Field>
            </div>
            <div className="md:col-span-2">
                <Field label="Shipping types available" hint="Each selected shipping type can have its own price, estimate, and cargo restrictions.">
                    <TransportChecklist
                        options={approvedTransportModes}
                        value={selectedModes}
                        onChange={updateTransportModes}
                    />
                </Field>
            </div>
            <div className="md:col-span-2">
                <TransportDetails
                    modes={selectedModes}
                    details={route.transport_details || {}}
                    currencies={currencies}
                    onChange={(transport_details) => onChange({ transport_details })}
                />
            </div>
            <div className="md:col-span-2">
                <Field label="Customer instructions" hint="Shown on the route so customers understand how this lane works.">
                    <textarea
                        className={textAreaClass}
                        value={route.customer_instructions || ''}
                        onChange={(event) => onChange({ customer_instructions: event.target.value })}
                        placeholder="E.g. Cargo is consolidated weekly. Customer chooses preferred pickup office after arrival."
                    />
                </Field>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 md:col-span-2">
                <input type="checkbox" checked={Boolean(route.post_to_feed)} onChange={(event) => onChange({ post_to_feed: event.target.checked })} />
                Post this route to feed after saving
            </label>
        </div>
    );
}

function TransportDetails({ modes, details = {}, currencies = [], onChange }) {
    if (modes.length === 0) {
        return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm font-bold text-slate-400">Select at least one shipping type to add pricing and restrictions.</div>;
    }

    const updateMode = (mode, patch) => {
        onChange({
            ...syncTransportDetails(details, modes),
            [mode]: {
                ...normalizeTransportDetail(mode, details[mode]),
                ...patch,
            },
        });
    };

    return (
        <div className="space-y-3">
            {modes.map((mode) => {
                const detail = normalizeTransportDetail(mode, details[mode]);
                return (
                    <div key={mode} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div>
                            <h4 className="text-sm font-black text-slate-950">{transportLabel(mode)}</h4>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{serviceCardDescription(mode)}</p>
                        </div>
                        <ServiceSpecificFields
                            mode={mode}
                            detail={detail}
                            currencies={currencies}
                            onChange={(patch) => updateMode(mode, patch)}
                        />
                    </div>
                );
            })}
        </div>
    );
}

function ServiceSpecificFields({ mode, detail, currencies = [], onChange }) {
    const updateDetail = (key, value) => onChange({
        details: {
            ...(detail.details || {}),
            [key]: value,
        },
    });

    if (mode === 'customs_clearing') {
        return (
            <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <CommonServicePricing detail={detail} mode={mode} currencies={currencies} onChange={onChange} labels={{ estimate: 'Processing time', price: 'Service fee', notes: 'Duties / taxes note' }} />
                <Field className="lg:col-span-6" label="Documents required" hint="Examples: invoice, packing list, ID, TIN, permit, HS code."><textarea className={textAreaClass} value={detail.details?.documents_required || ''} onChange={(event) => updateDetail('documents_required', event.target.value)} placeholder="Commercial invoice, packing list, ID/TIN, import permit where required." /></Field>
                <Field className="lg:col-span-6" label="Government charges note" hint="Tell customers what is estimated versus confirmed by customs."><textarea className={textAreaClass} value={detail.details?.government_charges_note || ''} onChange={(event) => updateDetail('government_charges_note', event.target.value)} placeholder="Duties, VAT, inspection, storage, and port charges are confirmed after document review." /></Field>
                <Field className="lg:col-span-6" label="HS code support"><Input className={inputClass} value={detail.details?.hs_code_support || ''} onChange={(event) => updateDetail('hs_code_support', event.target.value)} placeholder="We help classify / customer provides" /></Field>
                <Field className="lg:col-span-6" label="Permit support"><Input className={inputClass} value={detail.details?.permit_support || ''} onChange={(event) => updateDetail('permit_support', event.target.value)} placeholder="TFDA/TBS/TRA permits if needed" /></Field>
                <Field className="lg:col-span-12" label="Restricted items note"><Input className={inputClass} value={detail.details?.restricted_items_note || ''} onChange={(event) => updateDetail('restricted_items_note', event.target.value)} placeholder="Medicine, batteries, cosmetics, food, counterfeit goods require review." /></Field>
            </div>
        );
    }

    if (mode === 'warehousing') {
        return (
            <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <CommonServicePricing detail={detail} mode={mode} currencies={currencies} onChange={onChange} labels={{ estimate: 'Storage availability', price: 'Storage fee', notes: 'Storage notes' }} />
                <Field className="lg:col-span-6" label="Free storage days"><Input className={inputClass} value={detail.details?.free_storage_days || ''} onChange={(event) => updateDetail('free_storage_days', event.target.value)} placeholder="E.g. 7 days" /></Field>
                <Field className="lg:col-span-6" label="Receiving fee"><Input className={inputClass} value={detail.details?.receiving_fee || ''} onChange={(event) => updateDetail('receiving_fee', event.target.value)} placeholder="E.g. 2 USD/package" /></Field>
                <Field className="lg:col-span-6" label="Handling fee"><Input className={inputClass} value={detail.details?.handling_fee || ''} onChange={(event) => updateDetail('handling_fee', event.target.value)} placeholder="E.g. repack fee" /></Field>
                <Field className="lg:col-span-6" label="Max dimensions"><Input className={inputClass} value={detail.details?.max_dimensions || ''} onChange={(event) => updateDetail('max_dimensions', event.target.value)} placeholder="E.g. pallet / CBM limit" /></Field>
                <Field className="lg:col-span-6" label="Storage rules"><textarea className={textAreaClass} value={detail.details?.storage_rules || ''} onChange={(event) => updateDetail('storage_rules', event.target.value)} placeholder="Storage period, abandoned cargo policy, repacking rules." /></Field>
                <Field className="lg:col-span-6" label="Insurance note"><textarea className={textAreaClass} value={detail.details?.insurance_note || ''} onChange={(event) => updateDetail('insurance_note', event.target.value)} placeholder="Insurance included, optional, or customer-provided." /></Field>
            </div>
        );
    }

    if (mode === 'last_mile_delivery') {
        return (
            <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <CommonServicePricing detail={detail} mode={mode} currencies={currencies} onChange={onChange} labels={{ estimate: 'Delivery window', price: 'Delivery fee', notes: 'Delivery notes' }} />
                <Field className="lg:col-span-6" label="Coverage area"><Input className={inputClass} value={detail.details?.coverage_area || ''} onChange={(event) => updateDetail('coverage_area', event.target.value)} placeholder="Dar, Nairobi CBD, upcountry quote first" /></Field>
                <Field className="lg:col-span-6" label="Max weight"><Input className={inputClass} value={detail.details?.max_weight || ''} onChange={(event) => updateDetail('max_weight', event.target.value)} placeholder="E.g. up to 30kg" /></Field>
                <Field className="lg:col-span-6" label="Proof of delivery"><Input className={inputClass} value={detail.details?.proof_of_delivery || ''} onChange={(event) => updateDetail('proof_of_delivery', event.target.value)} placeholder="Photo/signature/OTP" /></Field>
                <Field className="lg:col-span-6" label="COD support"><Input className={inputClass} value={detail.details?.cod_support || ''} onChange={(event) => updateDetail('cod_support', event.target.value)} placeholder="No / yes with fee" /></Field>
                <Field className="lg:col-span-6" label="Return handling"><textarea className={textAreaClass} value={detail.details?.return_handling || ''} onChange={(event) => updateDetail('return_handling', event.target.value)} placeholder="How failed delivery, re-delivery, and returns are handled." /></Field>
            </div>
        );
    }

    if (mode === 'import_forwarding') {
        return (
            <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <CommonServicePricing detail={detail} mode={mode} currencies={currencies} onChange={onChange} labels={{ estimate: 'Handling time', price: 'Forwarding fee', notes: 'Forwarding notes' }} />
                <Field className="lg:col-span-6" label="Service scope"><textarea className={textAreaClass} value={detail.details?.service_scope || ''} onChange={(event) => updateDetail('service_scope', event.target.value)} placeholder="Buying support, seller coordination, consolidation, export docs, clearing support." /></Field>
                <Field className="lg:col-span-6" label="Customer steps"><textarea className={textAreaClass} value={detail.details?.customer_steps || ''} onChange={(event) => updateDetail('customer_steps', event.target.value)} placeholder="Customer sends invoice/tracking, waits for cargo receipt, pays duties when confirmed." /></Field>
                <Field className="lg:col-span-6" label="Origin handling"><Input className={inputClass} value={detail.details?.origin_handling || ''} onChange={(event) => updateDetail('origin_handling', event.target.value)} placeholder="China warehouse receives/consolidates" /></Field>
                <Field className="lg:col-span-6" label="Destination handling"><Input className={inputClass} value={detail.details?.destination_handling || ''} onChange={(event) => updateDetail('destination_handling', event.target.value)} placeholder="Tanzania clearing + pickup" /></Field>
                <Field className="lg:col-span-12" label="Required documents"><Input className={inputClass} value={detail.details?.required_documents || ''} onChange={(event) => updateDetail('required_documents', event.target.value)} placeholder="Invoice, packing list, supplier tracking, customer ID." /></Field>
            </div>
        );
    }

    return (
        <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <CommonServicePricing detail={detail} mode={mode} currencies={currencies} onChange={onChange} labels={{ estimate: 'Transit estimate', price: 'Freight price', notes: 'Cargo notes' }} />
            <Field className="lg:col-span-6" label="Allowed items"><textarea className={textAreaClass} value={detail.allowed_items || ''} onChange={(event) => onChange({ allowed_items: event.target.value })} placeholder="E.g. clothes, electronics, spare parts." /></Field>
            <Field className="lg:col-span-6" label="Disallowed items"><textarea className={textAreaClass} value={detail.disallowed_items || ''} onChange={(event) => onChange({ disallowed_items: event.target.value })} placeholder="E.g. liquids, batteries, medicine, counterfeit goods." /></Field>
            <Field className="lg:col-span-6" label="Billing weight note"><Input className={inputClass} value={detail.details?.billing_weight_note || ''} onChange={(event) => updateDetail('billing_weight_note', event.target.value)} placeholder="Actual vs volumetric weight." /></Field>
            <Field className="lg:col-span-6" label="Consolidation schedule"><Input className={inputClass} value={detail.details?.consolidation_schedule || ''} onChange={(event) => updateDetail('consolidation_schedule', event.target.value)} placeholder="Weekly / twice monthly" /></Field>
            <Field className="lg:col-span-6" label="Cutoff note"><Input className={inputClass} value={detail.details?.cutoff_note || ''} onChange={(event) => updateDetail('cutoff_note', event.target.value)} placeholder="Cargo must arrive before Friday." /></Field>
            <Field className="lg:col-span-6" label="Insurance note"><Input className={inputClass} value={detail.details?.insurance_note || ''} onChange={(event) => updateDetail('insurance_note', event.target.value)} placeholder="Optional / included / not included" /></Field>
        </div>
    );
}

function CommonServicePricing({ detail, mode, currencies = [], onChange, labels }) {
    const currencyOptions = currencySelectOptions(currencies, detail.currency);

    return (
        <>
            <Field className="lg:col-span-4" label={labels.estimate || 'Estimate'}>
                <Input className={inputClass} value={detail.estimate || ''} onChange={(event) => onChange({ estimate: event.target.value })} placeholder={estimatePlaceholder(mode)} />
            </Field>
            <Field className="lg:col-span-4" label="Pricing model">
                <select className={inputClass} value={detail.pricing_model || defaultPricingModel(mode)} onChange={(event) => onChange({ pricing_model: event.target.value })}>
                    {pricingOptionsForMode(mode).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </Field>
            <Field className="lg:col-span-3" label={labels.price || 'Price'}>
                <Input className={inputClass} value={detail.price_amount || ''} onChange={(event) => onChange({ price_amount: event.target.value })} placeholder={pricePlaceholder(mode)} />
            </Field>
            <Field className="lg:col-span-1" label="Currency">
                <select className={inputClass} value={detail.currency || defaultCurrencyCode(currencies)} onChange={(event) => onChange({ currency: event.target.value })}>
                    {currencyOptions.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                            {currency.code}
                        </option>
                    ))}
                </select>
            </Field>
            <Field className="lg:col-span-4" label="Minimum charge">
                <Input className={inputClass} value={detail.minimum_charge || ''} onChange={(event) => onChange({ minimum_charge: event.target.value })} placeholder={minimumChargePlaceholder(mode)} />
            </Field>
            <Field className="lg:col-span-4" label="Payment terms" hint="How customers pay this freight service.">
                <select className={inputClass} value={detail.payment_term || 'pay_on_pickup'} onChange={(event) => onChange({ payment_term: event.target.value })}>
                    {paymentTermOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </Field>
            {detail.payment_term === 'deposit_balance' && (
                <>
                    <Field className="lg:col-span-2" label="Deposit type">
                        <select className={inputClass} value={detail.deposit_type || 'percent'} onChange={(event) => onChange({ deposit_type: event.target.value })}>
                            <option value="percent">Percent</option>
                            <option value="fixed">Fixed</option>
                        </select>
                    </Field>
                    <Field className="lg:col-span-2" label="Deposit value">
                        <Input className={inputClass} value={detail.deposit_value || ''} onChange={(event) => onChange({ deposit_value: event.target.value })} placeholder={detail.deposit_type === 'fixed' ? 'E.g. 20 USD' : 'E.g. 30'} />
                    </Field>
                </>
            )}
            <Field className={detail.payment_term === 'deposit_balance' ? 'lg:col-span-4' : 'lg:col-span-4'} label="Balance due">
                <Input className={inputClass} value={detail.balance_due || ''} onChange={(event) => onChange({ balance_due: event.target.value })} placeholder="E.g. On pickup / before dispatch" />
            </Field>
            <Field className="lg:col-span-8" label="Payment notes">
                <Input className={inputClass} value={detail.payment_notes || ''} onChange={(event) => onChange({ payment_notes: event.target.value })} placeholder="E.g. Pay after warehouse receives and weighs the package." />
            </Field>
            <Field className="lg:col-span-12" label={labels.notes || 'Notes'}>
                <Input className={inputClass} value={detail.notes || ''} onChange={(event) => onChange({ notes: event.target.value })} placeholder={notesPlaceholder(mode)} />
            </Field>
        </>
    );
}

function WarehouseIcon() {
    return <Building2 className="h-5 w-5 text-indigo-700" />;
}

function CountrySelect({ countries, value, onChange }) {
    return (
        <select className={inputClass} value={value || ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select country</option>
            {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
        </select>
    );
}

function RouteSelect({ routes, value, onChange }) {
    return (
        <select className={inputClass} value={value || ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select route</option>
            {routes.map((route) => <option key={route.id} value={route.id}>{route.label}</option>)}
        </select>
    );
}

function locationsInApprovedCountry(locations, countryId, approvedCountryIds) {
    if (!countryId) return [];

    return (locations || []).filter((location) => (
        approvedCountryIds.has(Number(location.country_id))
        && Number(location.country_id) === Number(countryId)
    ));
}

function routeKey(route, index) {
    return String(route.id || index);
}

function routeLabel(route, locations, index = 0) {
    const locationById = new Map((locations || []).map((location) => [String(location.id), location]));
    const origins = (route.origin_location_ids || []).map((id) => locationById.get(String(id))).filter(Boolean);
    const destinations = (route.destination_location_ids || []).map((id) => locationById.get(String(id))).filter(Boolean);
    const originNames = routePlaceNames(origins);
    const destinationNames = routePlaceNames(destinations);
    const derived = `${originNames || 'Origin'} to ${destinationNames || 'Destination'}`;

    return derived === 'Origin to Destination' ? `Route ${index + 1}` : derived;
}

function routePlaceNames(locations) {
    if (!locations.length) return '';

    const countryNames = uniqueNames(locations, (location) => location.country?.name);
    if (countryNames.length > 1) return countryNames.join(', ');

    const stateNames = uniqueNames(locations, (location) => location.state?.name);
    if (stateNames.length > 1) return stateNames.join(', ');

    const cityNames = uniqueNames(locations, (location) => location.city_record?.name || location.cityRecord?.name);
    if (cityNames.length > 1) return cityNames.join(', ');

    if (countryNames.length === 1) return countryNames[0];
    if (stateNames.length === 1) return stateNames[0];
    if (cityNames.length === 1) return cityNames[0];

    return uniqueNames(locations, (location) => location.name).join(', ');
}

function uniqueNames(items, getter) {
    return [...new Set(items.map(getter).filter(Boolean))];
}

function transportLabel(mode) {
    return transportOptions.find(([key]) => key === mode)?.[1] || String(mode || '').replace(/_/g, ' ');
}

function syncTransportDetails(details = {}, modes = []) {
    return modes.reduce((next, mode) => ({
        ...next,
        [mode]: normalizeTransportDetail(mode, details?.[mode]),
    }), {});
}

function routePayloadForSave(route) {
    const { estimate, rates_info, address_template, ...payload } = route;
    return {
        ...payload,
        transport_details: syncTransportDetails(route.transport_details, route.transport_modes || []),
    };
}

function normalizeTransportDetail(mode, detail = {}) {
    return {
        ...blankTransportDetail,
        pricing_model: defaultPricingModel(mode),
        currency: 'USD',
        ...(detail || {}),
        details: {
            ...defaultServiceDetails(mode),
            ...((detail || {}).details || {}),
        },
    };
}

function defaultServiceDetails(mode) {
    const keys = {
        customs_clearing: ['government_charges_note', 'documents_required', 'hs_code_support', 'permit_support', 'tax_handling', 'restricted_items_note'],
        warehousing: ['free_storage_days', 'storage_pricing_unit', 'receiving_fee', 'handling_fee', 'storage_rules', 'max_dimensions', 'insurance_note'],
        last_mile_delivery: ['coverage_area', 'delivery_window', 'max_weight', 'proof_of_delivery', 'cod_support', 'return_handling'],
        import_forwarding: ['service_scope', 'origin_handling', 'destination_handling', 'customer_steps', 'required_documents', 'partner_notes'],
    }[mode] || ['billing_weight_note', 'consolidation_schedule', 'cutoff_note', 'cargo_handling_note', 'insurance_note'];

    return keys.reduce((all, key) => ({ ...all, [key]: '' }), {});
}

function serviceCardDescription(mode) {
    return {
        customs_clearing: 'Clearing fees, government charge notes, documents, HS code, permits, and restricted goods.',
        warehousing: 'Storage fee, free days, receiving/handling charges, storage rules, dimensions, and insurance.',
        last_mile_delivery: 'Coverage, delivery fee, delivery window, proof of delivery, weight limit, and returns.',
        import_forwarding: 'Forwarding scope, origin/destination handling, customer steps, and required documents.',
        air_cargo: 'Air freight by kg/volume weight with transit estimate, cutoffs, and restricted cargo rules.',
        sea_cargo: 'Sea freight by kg/CBM with consolidation schedule, cutoffs, and cargo rules.',
        road_cargo: 'Road cargo rates, transit timing, cargo rules, and handling notes.',
        bus_parcel: 'Bus/parcel route pricing, terminal handling, cutoff, and allowed cargo.',
    }[mode] || 'Pricing and operational rules for this freight service.';
}

function pricingOptionsForMode(mode) {
    if (mode === 'customs_clearing') {
        return [
            ['quote', 'Quote first'],
            ['fixed', 'Fixed clearing fee'],
            ['percent_declared_value', '% of declared/CIF value'],
            ['percent_duty_tax', '% of duty/tax amount'],
            ['fee_plus_government', 'Service fee + government charges'],
        ];
    }
    if (mode === 'warehousing') {
        return [
            ['per_day', 'Per day'],
            ['per_week', 'Per week'],
            ['per_cbm_day', 'Per CBM/day'],
            ['per_pallet', 'Per pallet'],
            ['fixed', 'Fixed'],
            ['quote', 'Quote first'],
        ];
    }
    if (mode === 'last_mile_delivery') {
        return [
            ['per_zone', 'Per zone'],
            ['per_km', 'Per km'],
            ['per_kg', 'Per kg'],
            ['fixed', 'Fixed'],
            ['quote', 'Quote first'],
        ];
    }
    if (mode === 'import_forwarding') {
        return [
            ['quote', 'Quote first'],
            ['fixed', 'Fixed service fee'],
            ['percent_declared_value', '% of declared value'],
            ['retainer', 'Retainer'],
        ];
    }
    return [
        ['per_kg', 'Per kg'],
        ['per_cbm', 'Per CBM'],
        ['fixed', 'Fixed'],
        ['quote', 'Quote first'],
    ];
}

function defaultPricingModel(mode) {
    return {
        customs_clearing: 'quote',
        warehousing: 'per_day',
        last_mile_delivery: 'per_zone',
        import_forwarding: 'quote',
    }[mode] || 'per_kg';
}

function defaultCurrencyCode(currencies = []) {
    return currencies.find((currency) => currency.code === 'USD')?.code
        || currencies[0]?.code
        || 'USD';
}

function currencySelectOptions(currencies = [], selectedCode = '') {
    const selected = String(selectedCode || '').toUpperCase();
    const options = (currencies || []).map((currency) => ({
        ...currency,
        code: String(currency.code || '').toUpperCase(),
    })).filter((currency) => currency.code);

    if (selected && !options.some((currency) => currency.code === selected)) {
        return [{ code: selected, name: selected, symbol: '' }, ...options];
    }

    return options.length ? options : [{ code: 'USD', name: 'US Dollar', symbol: '$' }];
}

function estimatePlaceholder(mode) {
    return {
        air_cargo: '7-10 days',
        sea_cargo: '35-45 days',
        customs_clearing: '1-3 working days after documents',
        warehousing: 'Available after cargo receipt',
        last_mile_delivery: 'Same day / next day',
        import_forwarding: 'Confirmed after seller tracking',
    }[mode] || '2-7 days';
}

function pricePlaceholder(mode) {
    return {
        customs_clearing: 'Quote after invoice review',
        warehousing: '1',
        last_mile_delivery: '5',
        import_forwarding: 'Quote',
    }[mode] || '5';
}

function minimumChargePlaceholder(mode) {
    return {
        customs_clearing: 'E.g. 20 USD service minimum',
        warehousing: 'E.g. 5 USD/day minimum',
        last_mile_delivery: 'E.g. 10,000 TZS',
        import_forwarding: 'E.g. 15 USD',
    }[mode] || '10 USD';
}

function notesPlaceholder(mode) {
    return {
        customs_clearing: 'Duties/taxes are government charges and confirmed after documents/HS code review.',
        warehousing: 'Storage starts after free days; abandoned cargo policy applies.',
        last_mile_delivery: 'Remote areas, fragile cargo, and oversized cargo may require quote first.',
        import_forwarding: 'Forwarding fee excludes supplier cost, duties, storage, and inspections unless stated.',
    }[mode] || 'E.g. Volume weight applies for bulky cargo.';
}

function routePricingSummary(route) {
    const details = route.transport_details || {};
    return (route.transport_modes || [])
        .map((mode) => {
            const detail = normalizeTransportDetail(mode, details[mode]);
            if (!detail.price_amount && !detail.estimate) return null;
            const price = detail.price_amount
                ? `${detail.currency || ''} ${detail.price_amount}${detail.pricing_model && detail.pricing_model !== 'quote' ? ` ${pricingModelLabel(detail.pricing_model)}` : ''}`.trim()
                : null;
            return [transportLabel(mode), price, detail.estimate].filter(Boolean).join(' · ');
        })
        .filter(Boolean)
        .join(' / ');
}

function pricingModelLabel(model) {
    return {
        per_kg: '/kg',
        per_cbm: '/CBM',
        per_day: '/day',
        per_week: '/week',
        per_cbm_day: '/CBM/day',
        per_pallet: '/pallet',
        per_km: '/km',
        per_zone: '/zone',
        percent_declared_value: '% value',
        percent_duty_tax: '% duty/tax',
        fee_plus_government: '+ govt charges',
        retainer: 'retainer',
        fixed: 'fixed',
        quote: 'quote',
    }[model] || model;
}

function statusLabel(status) {
    return shipmentStatuses.find(([key]) => key === status)?.[1] || String(status || '').replace(/_/g, ' ');
}

function shipmentPaymentStatusLabel(status, sourceType) {
    if (sourceType === 'external_purchase') return 'Tracking only';

    return {
        pending: 'Payment not completed',
        awaiting_merchant_confirmation: 'Paid, waiting for seller to accept',
        escrow_locked: 'SafePay held',
        shipped: 'SafePay held, shipment active',
        resolved_merchant_paid: 'Released to seller',
        disputed: 'Held for review',
    }[status] || String(status || 'Not available').replace(/_/g, ' ');
}

function shipmentDeliveryStatusLabel(status, sourceType) {
    if (sourceType === 'external_purchase') return 'External seller';

    return {
        inquiry: 'Waiting for seller',
        packing: 'Seller packing',
        with_boda: 'Sent toward forwarder',
        ready_at_terminal: 'Received by forwarder',
        customer_confirmed: 'Buyer confirmed handoff',
        issue_reported: 'Issue reported',
        disputed: 'Issue under review',
    }[status] || String(status || 'Not synced').replace(/_/g, ' ');
}

function routeDisplayName(shipment) {
    const route = shipment.route;
    if (!route) return '';

    const origin = route.origin_country?.name || route.originCountry?.name || 'Origin';
    const destination = route.destination_country?.name || route.destinationCountry?.name || 'Destination';

    return `${origin} to ${destination}`;
}

function placeLabel(location) {
    if (!location) return '';

    return [location.city?.name, location.state?.name, location.country?.name].filter(Boolean).join(', ');
}

function googleMapsUrl(address) {
    if (!address) return '';

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function LocationChecklist({ locations, value = [], onChange, emptyText }) {
    const selected = new Set((value || []).map((item) => String(item)));

    const toggle = (id) => {
        const key = String(id);
        const next = new Set(selected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onChange(Array.from(next));
    };

    if (locations.length === 0) {
        return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-400">{emptyText}</div>;
    }

    return (
        <div className="grid gap-2 md:grid-cols-2">
            {locations.map((location) => {
                const active = selected.has(String(location.id));
                return (
                    <button
                        key={location.id}
                        type="button"
                        onClick={() => toggle(location.id)}
                        className={`min-h-16 rounded-2xl border px-3 py-2 text-left transition ${active ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                        <span className="block text-sm font-black text-slate-900">{location.name}</span>
                        <span className="block text-xs font-semibold text-slate-500">
                            {[location.city_record?.name, location.state?.name, location.country?.name].filter(Boolean).join(', ') || location.address_line}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function TransportChecklist({ options = transportOptions, value = [], onChange }) {
    const selected = new Set(value || []);

    const toggle = (key) => {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onChange(Array.from(next));
    };

    if (options.length === 0) {
        return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-400">No approved shipping service type yet.</div>;
    }

    return (
        <div className="grid gap-2 md:grid-cols-3">
            {options.map(([key, label]) => {
                const active = selected.has(key);
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => toggle(key)}
                        className={`h-12 rounded-xl border px-3 text-sm font-black transition ${active ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

function TransportSelect({ value, onChange }) {
    return (
        <select className={inputClass} value={value || 'sea_cargo'} onChange={(e) => onChange(e.target.value)}>
            <option value="sea_cargo">Sea cargo</option>
            <option value="air_cargo">Air cargo</option>
            {/* Re-enable later when supported in production. */}
            {/* <option value="road_cargo">Road cargo</option> */}
            {/* <option value="bus_parcel">Bus parcel</option> */}
            {/* <option value="customs_clearing">Customs clearing</option> */}
            {/* <option value="warehousing">Warehousing</option> */}
            {/* <option value="last_mile_delivery">Last-mile delivery</option> */}
            {/* <option value="import_forwarding">Import forwarding</option> */}
        </select>
    );
}

function JsonList({ title, kind, items, addLabel, onAdd, onSave, onRemove, renderItem }) {
    return (
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-4 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">{title}</h2>
                        <p className="text-xs font-semibold text-slate-500">Saved to the verified forwarder profile.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onAdd(kind)}><Plus className="mr-2 h-4 w-4" /> {addLabel}</Button>
                        <Button type="button" disabled={false} onClick={() => onSave(kind)}><Save className="mr-2 h-4 w-4" /> Save</Button>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-500">Nothing added yet.</div>
                ) : items.map((item, index) => (
                    <div key={item.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Entry {index + 1}</span>
                            <Button type="button" variant="ghost" className="text-red-600" onClick={() => onRemove(kind, index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        {renderItem(item, index)}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
