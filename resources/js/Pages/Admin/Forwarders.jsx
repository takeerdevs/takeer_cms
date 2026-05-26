import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, usePage } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Card } from '@/Components/ui/Card';
import AddressPickerModal from '@/Components/AddressPickerModal';
import { Building2, CheckCircle2, ExternalLink, FileText, Globe, Mail, MapPin, Phone, Plus, Search, Ship, Trash2, UserRound, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const emptyForwarder = {
    name: '',
    legal_name: '',
    description: '',
    address_line: '',
    country_id: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    whatsapp_phone: '',
    website: '',
    service_types: ['air_cargo'],
    required_fields: ['customer_id'],
    verification_status: 'pending',
};

const emptyLocation = {
    roles: ['origin'],
    name: '',
    address_line: '',
    country_id: '',
    country_iso2: '',
    country_name: '',
    state_name: '',
    city_name: '',
    latitude: '',
    longitude: '',
    contact_phone: '',
    contact_person: '',
    business_hours: '',
    merchant_instructions: '',
    customer_instructions: '',
    is_verified: true,
    is_active: true,
};

const roleMeta = {
    origin: { label: 'Origin warehouse/drop-off', badge: 'bg-indigo-50 text-indigo-700' },
    destination: { label: 'Destination collection office', badge: 'bg-emerald-50 text-emerald-700' },
};

const serviceLabel = (key) => ({
    sea_cargo: 'Sea cargo',
    air_cargo: 'Air cargo',
    customs_clearing: 'Customs clearing',
    warehousing: 'Warehousing',
    last_mile_delivery: 'Last-mile delivery',
    import_forwarding: 'Import forwarding',
}[key] || String(key || '').replaceAll('_', ' '));

function DetailItem({ label, value, href = null, icon: Icon = null }) {
    const display = value || 'Not provided';
    const content = (
        <div className={`rounded-xl border px-3 py-2 ${value ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className={`mt-1 flex items-center gap-2 break-words text-sm font-bold ${value ? 'text-slate-900' : 'text-slate-400'}`}>
                {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
                {display}
            </p>
        </div>
    );

    if (href && value) {
        return (
            <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80">
                {content}
            </a>
        );
    }

    return content;
}

export default function AdminForwarders() {
    const { countries = [] } = usePage().props;
    const [forwarders, setForwarders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [form, setForm] = useState(emptyForwarder);
    const [locationForm, setLocationForm] = useState(emptyLocation);
    const [selectedForwarderId, setSelectedForwarderId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);

    const selectedForwarder = useMemo(
        () => forwarders.find((item) => Number(item.id) === Number(selectedForwarderId)) || forwarders[0] || null,
        [forwarders, selectedForwarderId],
    );
    const selectedDocuments = selectedForwarder?.documents || {};
    const countryNameById = useMemo(() => {
        const map = new Map();
        countries.forEach((country) => map.set(Number(country.id), country.name));
        return map;
    }, [countries]);
    const countryIdByIso = useMemo(() => {
        const map = new Map();
        countries.forEach((country) => map.set(String(country.iso_alpha2 || '').toUpperCase(), country.id));
        return map;
    }, [countries]);

    const fetchForwarders = async (nextPage = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/admin/api/forwarders?page=${nextPage}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load forwarders.');
            const paged = data.forwarders || {};
            setForwarders(paged.data || []);
            setPage(paged.current_page || 1);
            setLastPage(paged.last_page || 1);
            setSelectedForwarderId((current) => current || paged.data?.[0]?.id || null);
        } catch (error) {
            toast.error(error.message);
            setForwarders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchForwarders(1); }, []);

    const jsonList = (value) => String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const saveForwarder = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                service_types: Array.isArray(form.service_types) ? form.service_types : jsonList(form.service_types),
                required_fields: Array.isArray(form.required_fields) ? form.required_fields : jsonList(form.required_fields),
            };
            const res = await fetch('/admin/api/forwarders', {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save forwarder.');
            toast.success('Forwarder created.');
            setForm(emptyForwarder);
            await fetchForwarders(1);
            setSelectedForwarderId(data.forwarder?.id || null);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (forwarder, verification_status) => {
        try {
            const res = await fetch(`/admin/api/forwarders/${forwarder.id}/status`, {
                method: 'PATCH',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ verification_status, admin_notes: forwarder.admin_notes || '' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update status.');
            toast.success('Forwarder status updated.');
            fetchForwarders(page);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const updateSelectedForwarder = (patch) => {
        if (!selectedForwarder) return;
        setForwarders((items) => items.map((item) => (
            Number(item.id) === Number(selectedForwarder.id) ? { ...item, ...patch } : item
        )));
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

    const addLocation = async (e) => {
        e.preventDefault();
        if (!selectedForwarder) return;
        if ((locationForm.roles || []).length === 0) {
            toast.error('Choose whether this location is an origin, destination, or both.');
            return;
        }
        if (!locationForm.latitude || !locationForm.longitude || !(locationForm.country_id || locationForm.country_iso2 || locationForm.country_name)) {
            toast.error('Pick the exact location on the map first so country, region, city, and coordinates are linked correctly.');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`/admin/api/forwarders/${selectedForwarder.id}/locations`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ ...locationForm, roles: Array.from(new Set(locationForm.roles || [])).filter(Boolean) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to add location.');
            toast.success('Location added.');
            setLocationForm(emptyLocation);
            fetchForwarders(page);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const updateLocation = async (location, patch) => {
        try {
            const res = await fetch(`/admin/api/forwarder-locations/${location.id}`, {
                method: 'PUT',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ ...location, ...patch }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update location.');
            toast.success('Location updated.');
            fetchForwarders(page);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const deleteLocation = async (location) => {
        if (!confirm(`Delete ${location.name}?`)) return;
        try {
            const res = await fetch(`/admin/api/forwarder-locations/${location.id}`, {
                method: 'DELETE',
                headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to delete location.');
            toast.success('Location deleted.');
            fetchForwarders(page);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const geoCountryLabel = locationForm.country_name || countryNameById.get(Number(locationForm.country_id)) || '';
    const pickerSearchLabel = [locationForm.city_name, locationForm.state_name, geoCountryLabel].filter(Boolean).join(', ');

    const toggleLocationRole = (role) => {
        setLocationForm((prev) => {
            const current = new Set(prev.roles || []);
            if (current.has(role)) current.delete(role);
            else current.add(role);
            if (current.size === 0) current.add(role);
            return { ...prev, roles: Array.from(current) };
        });
    };

    return (
        <AdminLayout title="Forwarders">
            <Head title="Forwarders | Admin" />

            <div className="space-y-6">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                        <Ship className="h-6 w-6 text-indigo-700" /> Forwarder Network
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Verify cargo companies, China warehouses, and African collection offices before customers can import them.
                    </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <Card className="border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_160px_auto]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input className="pl-9" placeholder="Search forwarders..." value={search} onChange={(e) => setSearch(e.target.value)} />
                            </div>
                            <select className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="all">All</option>
                                <option value="pending">Pending</option>
                                <option value="verified">Verified</option>
                                <option value="rejected">Rejected</option>
                                <option value="suspended">Suspended</option>
                            </select>
                            <Button variant="outline" onClick={() => fetchForwarders(1)}>Apply</Button>
                        </div>

                        <div className="space-y-2">
                            {loading ? (
                                <div className="py-12 text-center text-sm font-semibold text-slate-500">Loading forwarders...</div>
                            ) : forwarders.length === 0 ? (
                                <div className="py-12 text-center text-sm font-semibold text-slate-500">No forwarders yet.</div>
                            ) : forwarders.map((forwarder) => (
                                <button
                                    key={forwarder.id}
                                    type="button"
                                    onClick={() => setSelectedForwarderId(forwarder.id)}
                                    className={`w-full rounded-xl border p-3 text-left transition ${Number(selectedForwarder?.id) === Number(forwarder.id) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-black text-slate-900">{forwarder.name}</p>
                                            <p className="text-xs font-semibold text-slate-500">{forwarder.contact_phone || forwarder.contact_email || 'No contact'}</p>
                                            <p className="mt-1 text-xs text-slate-500">{forwarder.locations?.length || 0} locations · {forwarder.user_addresses_count || 0} customer imports</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${forwarder.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' : forwarder.verification_status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {forwarder.verification_status || 'pending'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button variant="outline" disabled={page <= 1} onClick={() => fetchForwarders(page - 1)}>Prev</Button>
                            <span className="text-sm text-slate-600">Page {page} / {lastPage}</span>
                            <Button variant="outline" disabled={page >= lastPage} onClick={() => fetchForwarders(page + 1)}>Next</Button>
                        </div>
                    </Card>

                    <Card className="border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-700">
                            <Plus className="h-4 w-4" /> Add Forwarder
                        </h2>
                        <form onSubmit={saveForwarder} className="space-y-3">
                            <Input placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                            <Input placeholder="Legal name" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
                            <Input placeholder="Main address" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} required />
                            <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={form.country_id} onChange={(e) => setForm({ ...form, country_id: e.target.value })}>
                                <option value="">Primary country</option>
                                {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
                            </select>
                            <Input placeholder="Contact person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                            <Input placeholder="Phone / WhatsApp" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                            <Input placeholder="Email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                            <Input placeholder="Required fields, comma separated" value={Array.isArray(form.required_fields) ? form.required_fields.join(', ') : form.required_fields} onChange={(e) => setForm({ ...form, required_fields: e.target.value })} />
                            <Button type="submit" disabled={saving} className="w-full">Create Forwarder</Button>
                        </form>
                    </Card>
                </div>

                {selectedForwarder && (
                    <Card className="border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">{selectedForwarder.name}</h2>
                                <p className="text-sm text-slate-500">{selectedForwarder.description || 'No description yet.'}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    {selectedForwarder.legal_name || 'No legal name'} · {selectedForwarder.business_registration_number || 'No registration number'}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedForwarder.merchant && (
                                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700">
                                            @{selectedForwarder.merchant.username} · {selectedForwarder.merchant.display_name}
                                        </span>
                                    )}
                                    {selectedForwarder.submitter && (
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
                                            Submitted by {selectedForwarder.submitter.name || selectedForwarder.submitter.email}
                                        </span>
                                    )}
                                    {selectedForwarder.application_submitted_at && (
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
                                            {new Date(selectedForwarder.application_submitted_at).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {['pending', 'verified', 'rejected', 'suspended'].map((nextStatus) => (
                                    <Button
                                        key={nextStatus}
                                        variant={selectedForwarder.verification_status === nextStatus ? 'default' : 'outline'}
                                        onClick={() => updateStatus(selectedForwarder, nextStatus)}
                                        className="capitalize"
                                    >
                                        {nextStatus === 'verified' && <CheckCircle2 className="mr-1 h-4 w-4" />}
                                        {nextStatus}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Application details</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">Full information entered by the forwarder applicant.</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${selectedForwarder.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' : selectedForwarder.verification_status === 'rejected' || selectedForwarder.verification_status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {selectedForwarder.verification_status || 'pending'}
                                </span>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <DetailItem label="Trading name" value={selectedForwarder.name} />
                                <DetailItem label="Legal registered name" value={selectedForwarder.legal_name} />
                                <DetailItem label="Registration number" value={selectedForwarder.business_registration_number} />
                                <DetailItem label="Contact person" value={selectedForwarder.contact_person} icon={UserRound} />
                                <DetailItem label="Primary phone" value={selectedForwarder.contact_phone} icon={Phone} />
                                <DetailItem label="WhatsApp phone" value={selectedForwarder.whatsapp_phone} icon={Phone} />
                                <DetailItem label="Email address" value={selectedForwarder.contact_email} icon={Mail} />
                                <DetailItem label="Website / social profile" value={selectedForwarder.website} href={selectedForwarder.website} icon={ExternalLink} />
                                <DetailItem label="Main address / internal label" value={selectedForwarder.address_line} />
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">How the business operates</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                                    {selectedForwarder.application_summary || selectedForwarder.description || 'No application summary submitted.'}
                                </p>
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Services offered</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {(selectedForwarder.service_types || []).length > 0 ? (
                                            selectedForwarder.service_types.map((service) => (
                                                <span key={service} className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                                                    {serviceLabel(service)}
                                                </span>
                                            ))
                                        ) : (
                                            <p className="text-sm font-semibold text-slate-500">No services submitted.</p>
                                        )}
                                    </div>
                                </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operating countries</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {(selectedForwarder.operating_country_ids || []).length > 0 ? (
                                        selectedForwarder.operating_country_ids.map((id) => (
                                            <span key={id} className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-700">
                                                {countryNameById.get(Number(id)) || `Country #${id}`}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-sm font-semibold text-slate-500">No operating countries submitted.</p>
                                    )}
                                </div>
                            </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proof documents</p>
                                <div className="mt-2 space-y-2">
                                    {(selectedDocuments.files || []).map((file) => (
                                        <a key={file.path || file.url} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-white px-2 py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900">
                                            <FileText className="h-4 w-4" /> {file.name || 'Uploaded file'} <ExternalLink className="ml-auto h-3.5 w-3.5" />
                                        </a>
                                    ))}
                                    {(selectedDocuments.links || []).map((link) => (
                                        <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-white px-2 py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900">
                                            <ExternalLink className="h-4 w-4" /> {link}
                                        </a>
                                    ))}
                                    {(selectedDocuments.files || []).length === 0 && (selectedDocuments.links || []).length === 0 && (
                                        <p className="text-sm font-semibold text-slate-500">No proof documents submitted.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <label className="text-xs font-black uppercase tracking-widest text-amber-800">Admin notes</label>
                            <textarea
                                className="mt-2 min-h-20 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                                placeholder="Visible to merchant if the application needs updates."
                                value={selectedForwarder.admin_notes || ''}
                                onChange={(e) => updateSelectedForwarder({ admin_notes: e.target.value })}
                            />
                            <p className="mt-1 text-xs font-semibold text-amber-800">
                                These notes are sent with status changes, especially rejected or suspended applications.
                            </p>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
                            <div className="space-y-3">
                                {(selectedForwarder.locations || []).map((location) => (
                                    <div key={location.id} className="rounded-xl border border-slate-200 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="flex items-center gap-2 font-black text-slate-900">
                                                    {(location.roles || []).includes('origin') ? <Warehouse className="h-4 w-4 text-indigo-600" /> : <Building2 className="h-4 w-4 text-emerald-600" />}
                                                    {location.name}
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-slate-500">{location.address_line}</p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {[location.city_record?.name, location.state?.name, location.country?.name].filter(Boolean).join(', ') || 'No geography linked'}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {(location.roles || []).map((role) => (
                                                        <span key={role} className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${roleMeta[role]?.badge || 'bg-slate-100 text-slate-600'}`}>
                                                            {role}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => updateLocation(location, { is_verified: !location.is_verified })}>
                                                    {location.is_verified ? 'Verified' : 'Verify'}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deleteLocation(location)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={addLocation} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <h3 className="text-sm font-black uppercase text-slate-700">Add warehouse / office</h3>
                                <div className="grid gap-2">
                                    {Object.entries(roleMeta).map(([role, meta]) => {
                                        const active = (locationForm.roles || []).includes(role);
                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => toggleLocationRole(role)}
                                                className={`flex min-h-10 items-center justify-between rounded-lg border px-3 text-left text-sm font-bold ${active ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-500'}`}
                                            >
                                                {meta.label}
                                                <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                                <Input placeholder="Location name" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} required />
                                <Input placeholder="Official address" value={locationForm.address_line} onChange={(e) => setLocationForm({ ...locationForm, address_line: e.target.value })} required />
                                <Button type="button" variant="outline" className="w-full justify-center border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" onClick={() => setIsLocationPickerOpen(true)}>
                                    <MapPin className="mr-2 h-4 w-4" /> Pick exact location on map (required)
                                </Button>
                                <Input className="bg-slate-100" placeholder="Country from map pin" value={geoCountryLabel} readOnly />
                                <Input className="bg-slate-100" placeholder="State / region from map pin" value={locationForm.state_name} readOnly />
                                <Input className="bg-slate-100" placeholder="City from map pin" value={locationForm.city_name} readOnly />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input className="bg-slate-100" placeholder="Latitude" value={locationForm.latitude} readOnly />
                                    <Input className="bg-slate-100" placeholder="Longitude" value={locationForm.longitude} readOnly />
                                </div>
                                <Input placeholder="Contact phone" value={locationForm.contact_phone} onChange={(e) => setLocationForm({ ...locationForm, contact_phone: e.target.value })} />
                                <Input
                                    placeholder="Business hours, e.g. Mon-Fri (09:00 AM - 2:00 PM), Sat (09:00 AM - 12:00 PM)"
                                    value={locationForm.business_hours}
                                    onChange={(e) => setLocationForm({ ...locationForm, business_hours: e.target.value })}
                                />
                                <textarea
                                    className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Seller instructions, e.g. write customer code on carton and send packing list on WhatsApp."
                                    value={locationForm.merchant_instructions}
                                    onChange={(e) => setLocationForm({ ...locationForm, merchant_instructions: e.target.value })}
                                />
                                <textarea
                                    className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Customer instructions, e.g. bring ID and order code when collecting cargo."
                                    value={locationForm.customer_instructions}
                                    onChange={(e) => setLocationForm({ ...locationForm, customer_instructions: e.target.value })}
                                />
                                <Button type="submit" disabled={saving} className="w-full">Add Location</Button>
                            </form>
                            <AddressPickerModal
                                isOpen={isLocationPickerOpen}
                                onOpenChange={setIsLocationPickerOpen}
                                initialLat={locationForm.latitude}
                                initialLng={locationForm.longitude}
                                initialAddress={pickerSearchLabel}
                                onSave={applyPickedLocation}
                            />
                        </div>
                    </Card>
                )}
            </div>
        </AdminLayout>
    );
}
