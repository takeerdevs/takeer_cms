import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { ArrowLeft, CheckCircle2, FileCheck, ShieldCheck, Ship, UploadCloud, Search, X } from 'lucide-react';
import { toast } from 'sonner';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';
const inputClass = 'h-12 rounded-xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus-visible:ring-brand-500/10 focus-visible:ring-4 focus-visible:ring-offset-0 transition-all duration-200';
const textAreaClass = 'min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus-visible:ring-brand-500/10 focus-visible:ring-4 focus-visible:ring-offset-0 transition-all duration-200';

const SERVICE_OPTIONS = [
    { key: 'sea_cargo', label: 'Sea cargo' },
    { key: 'air_cargo', label: 'Air cargo' },
    // Re-enable later when cargo operations expand beyond direct goods shipment.
    // { key: 'customs_clearing', label: 'Customs clearing' },
    // { key: 'warehousing', label: 'Warehousing' },
    // { key: 'last_mile_delivery', label: 'Last-mile delivery' },
    // { key: 'import_forwarding', label: 'Import forwarding' },
];
const ENABLED_SERVICE_KEYS = new Set(SERVICE_OPTIONS.map((option) => option.key));

const normalizeCountryId = (id) => Number(id);

function Field({ label, children, hint }) {
    return (
        <label className="block space-y-1.5">
            <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">{label}</span>
            {children}
            {hint && <span className="block text-[11px] font-semibold leading-5 text-slate-500">{hint}</span>}
        </label>
    );
}

export default function ForwarderEnroll({ countries = [], merchantUsername = null, merchantName = null, mode = 'public', application = null, hasVerifiedPersonalProfile = false }) {
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const existingDocuments = application?.documents || {};
    const [form, setForm] = useState({
        name: application?.name || merchantName || '',
        legal_name: application?.legal_name || '',
        business_registration_number: application?.business_registration_number || '',
        description: application?.description || '',
        application_summary: application?.application_summary || '',
        contact_person: application?.contact_person || '',
        contact_phone: application?.contact_phone || '',
        contact_email: application?.contact_email || '',
        whatsapp_phone: application?.whatsapp_phone || '',
        website: application?.website || '',
        service_types: (application?.service_types || ['sea_cargo', 'air_cargo']).filter((type) => ENABLED_SERVICE_KEYS.has(type)),
        operating_country_ids: (application?.operating_country_ids || []).map(normalizeCountryId).filter(Boolean),
        document_links: (existingDocuments.links || []).join('\n'),
        document_files: [],
    });

    const toggleService = (key) => {
        setForm((prev) => ({
            ...prev,
            service_types: prev.service_types.includes(key)
                ? prev.service_types.filter((item) => item !== key)
                : [...prev.service_types, key],
        }));
    };

    const toggleCountry = (id) => {
        const countryId = normalizeCountryId(id);
        setForm((prev) => ({
            ...prev,
            operating_country_ids: prev.operating_country_ids.includes(countryId)
                ? prev.operating_country_ids.filter((item) => item !== countryId)
                : [...prev.operating_country_ids, countryId],
        }));
    };

    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const payload = new FormData();
            payload.append('name', form.name);
            payload.append('legal_name', form.legal_name);
            payload.append('business_registration_number', form.business_registration_number);
            payload.append('description', form.description);
            payload.append('application_summary', form.application_summary);
            payload.append('contact_person', form.contact_person);
            payload.append('contact_phone', form.contact_phone);
            payload.append('contact_email', form.contact_email);
            payload.append('whatsapp_phone', form.whatsapp_phone);
            payload.append('website', form.website);
            if (merchantUsername) payload.append('merchant_username', merchantUsername);
            form.service_types.forEach((item) => payload.append('service_types[]', item));
            form.operating_country_ids.forEach((id) => payload.append('operating_country_ids[]', id));
            String(form.document_links || '').split('\n').map((item) => item.trim()).filter(Boolean).forEach((link) => payload.append('document_links[]', link));
            Array.from(form.document_files || []).forEach((file) => payload.append('document_files[]', file));

            const res = await fetch('/api/forwarders/enroll', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: payload,
            });
            const data = await res.json();
            if (!res.ok) {
                const firstError = data.errors ? Object.values(data.errors).flat()[0] : null;
                throw new Error(firstError || data.message || 'Application could not be submitted.');
            }
            setSubmitted(true);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <Head title="Freight Application | Takeer" />
            <div className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
                    <Link href={merchantUsername ? '/profile' : '/'} className="flex items-center gap-3 text-sm font-black text-slate-900">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                            <ArrowLeft className="h-5 w-5" />
                        </span>
                        <span>{merchantName || 'Takeer Logistics'}</span>
                    </Link>
                    <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-black text-brand-700">
                        {mode === 'merchant_setup' ? 'Freight Application' : 'Forwarder Verification'}
                    </span>
                </div>
            </div>

            <main className="mx-auto max-w-5xl px-4 py-8">
                {!hasVerifiedPersonalProfile ? (
                    <div className="mt-10 rounded-3xl border border-amber-100 bg-white p-10 text-center shadow-sm">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                            <ShieldCheck className="h-7 w-7" />
                        </div>
                        <h1 className="mt-4 text-2xl font-black">Verify your personal profile first</h1>
                        <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                            Freight and forwarding applications require the owner to be personally verified before the business can apply.
                        </p>
                        <Link href="/profile" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-brand-600 px-6 text-sm font-black text-white">
                            Go to profile verification
                        </Link>
                    </div>
                ) : submitted ? (
                    <div className="mt-10 rounded-3xl border border-emerald-100 bg-white p-10 text-center shadow-sm">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                        <h1 className="mt-4 text-2xl font-black">Application received</h1>
                        <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                            Admin will review your freight/forwarding documents. Once approved, logistics management cards will appear in your profile.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-6">
                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                                <Ship className="h-7 w-7" />
                            </div>
                            <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-brand-700">
                                DIGITIZE YOUR FREIGHT OPERATIONS
                            </p>
                            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Freight & forwarding application</h1>
                            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">
                                Submit your company details and operating proof. Warehouses, routes, schedules, and address templates for customers to one click import unlock after approval.
                            </p>
                            {application && (
                                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-amber-800">
                                        Current status: {application.verification_status || 'pending'}
                                    </p>
                                    {application.admin_notes && (
                                        <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">{application.admin_notes}</p>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Company Details</h2>
                                <p className="mt-1 text-xs font-semibold text-slate-500">This is used to verify the forwarder business.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Trading name">
                                    <Input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                </Field>
                                <Field label="Legal registered name">
                                    <Input className={inputClass} required value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
                                </Field>
                                <Field label="Business registration number">
                                    <Input className={inputClass} value={form.business_registration_number} onChange={(e) => setForm({ ...form, business_registration_number: e.target.value })} />
                                </Field>
                                <Field label="Website / social profile">
                                    <Input className={inputClass} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
                                </Field>
                                <Field label="Contact person">
                                    <Input className={inputClass} required value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
                                </Field>
                                <Field label="Primary phone">
                                    <Input className={inputClass} required value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                                </Field>
                                <Field label="Email address">
                                    <Input className={inputClass} type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                                </Field>
                                <Field label="WhatsApp phone">
                                    <Input className={inputClass} value={form.whatsapp_phone} onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })} />
                                </Field>
                            </div>
                            <div className="mt-4">
                                <Field label="How does this freight business operate?">
                                    <textarea className={textAreaClass} value={form.application_summary} onChange={(e) => setForm({ ...form, application_summary: e.target.value })} placeholder="Explain the flow of process the customer will do to a point of collecting their cargo." />
                                </Field>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Services Offered</h2>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {SERVICE_OPTIONS.map((option) => {
                                    const selected = form.service_types.includes(option.key);
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => toggleService(option.key)}
                                            className={`min-h-12 rounded-xl border px-3 text-sm font-black transition ${selected ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200'}`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Countries You Operate In</h2>
                                <p className="text-xs font-semibold text-slate-500">Select countries where you are licensed directly or through verified partners.</p>
                            </div>

                            {/* Search Input Container */}
                            <div className="relative mt-4">
                                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search countries..."
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-10 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus-visible:ring-brand-500/10 focus-visible:ring-4 focus-visible:ring-offset-0 transition-all duration-200"
                                />
                                {countrySearch && (
                                    <button
                                        type="button"
                                        onClick={() => setCountrySearch('')}
                                        className="absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Selected Countries Tags (Only show when there are selected countries) */}
                            {(() => {
                                const selectedCountries = countries.filter(c => form.operating_country_ids.includes(c.id));
                                if (selectedCountries.length === 0) return null;
                                return (
                                    <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-3">
                                        <span className="w-full text-[10px] font-black uppercase tracking-[0.15em] text-emerald-800 mb-1">
                                            Selected ({selectedCountries.length})
                                        </span>
                                        {selectedCountries.map((country) => (
                                            <div
                                                key={country.id}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white pl-3 pr-2 py-1.5 text-sm font-bold text-emerald-800 shadow-sm transition hover:border-emerald-300"
                                            >
                                                <span>{country.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCountry(country.id)}
                                                    className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 transition"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* Scrollable Suggestions / Available Countries */}
                            {(() => {
                                const filteredCountries = countries.filter(c => {
                                    const isSelected = form.operating_country_ids.includes(c.id);
                                    const matchesSearch = c.name.toLowerCase().includes(countrySearch.toLowerCase());
                                    return !isSelected && matchesSearch;
                                });

                                return (
                                    <div className="mt-4">
                                        <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">
                                            {countrySearch ? 'Matching Countries' : 'Available Countries'}
                                        </span>
                                        {filteredCountries.length > 0 ? (
                                            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                                                {filteredCountries.map((country) => (
                                                    <button
                                                        key={country.id}
                                                        type="button"
                                                        onClick={() => {
                                                            toggleCountry(country.id);
                                                            setCountrySearch('');
                                                        }}
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-800 active:scale-[0.99]"
                                                    >
                                                        {country.name}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                                                <p className="text-sm font-semibold text-slate-500">
                                                    {countrySearch ? 'No other matching countries found.' : 'All countries have been selected.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                                    <FileCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Permits / Proof</h2>
                                    <p className="text-xs font-semibold text-slate-500">Upload licenses, certificates, registration, or partner proof.</p>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Upload documents" hint="PDF, Word, JPG, PNG. Max 10MB each.">
                                    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-brand-300 hover:bg-brand-50">
                                        <UploadCloud className="h-7 w-7 text-slate-500" />
                                        <span className="mt-2 text-sm font-black text-slate-700">Choose files</span>
                                        <span className="mt-1 text-xs font-semibold text-slate-500">{Array.from(form.document_files || []).length} selected</span>
                                        {(existingDocuments.files || []).length > 0 && (
                                            <span className="mt-1 text-xs font-semibold text-emerald-700">{existingDocuments.files.length} already uploaded</span>
                                        )}
                                        <input type="file" multiple className="hidden" onChange={(e) => setForm({ ...form, document_files: e.target.files })} />
                                    </label>
                                </Field>
                                <Field label="Document links" hint="One link per line, if documents are hosted elsewhere.">
                                    <textarea className={textAreaClass} value={form.document_links} onChange={(e) => setForm({ ...form, document_links: e.target.value })} placeholder="https://..." />
                                </Field>
                            </div>
                        </section>

                        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                            <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl text-base font-black">
                                {loading ? 'Submitting...' : 'Submit Application'}
                            </Button>
                        </div>
                    </form>
                )}
            </main>
        </div>
    );
}
