import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Calendar, Clock, ExternalLink, MapPin, Search, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const serviceModes = [
    { value: 'all', label: 'All modes' },
    { value: 'showcase_only', label: 'Showcase' },
    { value: 'request_quote', label: 'Request quote' },
    { value: 'book_appointment', label: 'Appointment' },
    { value: 'pay_now', label: 'Pay / reserve' },
    { value: 'external_booking', label: 'External booking' },
];

const serviceModeLabels = {
    showcase_only: 'Showcase',
    request_quote: 'Request quote',
    book_appointment: 'Appointment',
    pay_now: 'Pay / reserve',
    external_booking: 'External booking',
};

const fallbackServiceCategoryOptions = [
    'Health & Wellness',
    'Beauty & Personal Care',
    'Home & Repairs',
    'Education & Training',
    'Professional Services',
    'Events & Hospitality',
    'Automotive & Garage',
    'Accommodation & Stays',
    'Transport & Hire',
    'Moving & Logistics',
    'Property & Survey',
    'Cleaning & Domestic',
    'Funeral & Emergency',
    'Creative & Media',
    'Travel & Recreation',
    'Other',
];

const locationLabels = {
    provider_location: 'Provider venue',
    customer_location: 'Client location',
    remote: 'Remote/online',
    hybrid: 'Hybrid',
};

const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
};

const priceLabel = (service, copy) => {
    if (service.service_price_display === 'hidden') return copy('Hidden', 'Imefichwa');
    if (service.service_price_display === 'quote_only' || service.service_mode === 'request_quote') return copy('Quote only', 'Bei kwa makubaliano');
    if (service.service_price_display === 'starts_from') return `${copy('From', 'Kuanzia')} TZS ${Number(service.price || 0).toLocaleString()}`;
    const units = {
        hourly: ['per hour', 'kwa saa'], daily: ['per day', 'kwa siku'], nightly: ['per night', 'kwa usiku'],
        weekly: ['per week', 'kwa wiki'], monthly: ['per month', 'kwa mwezi'], yearly: ['per year', 'kwa mwaka'],
        per_person: ['per person', 'kwa mtu'], per_visit: ['per visit', 'kwa ziara'], per_session: ['per session', 'kwa kikao'],
        per_project: ['per project', 'kwa mradi'], package: ['package', 'kifurushi'],
    };
    if (units[service.service_price_display]) {
        const [english, swahili] = units[service.service_price_display];
        return `TZS ${Number(service.price || 0).toLocaleString()} ${copy(english, swahili)}`;
    }
    return `TZS ${Number(service.price || 0).toLocaleString()}`;
};

export default function Services() {
    const { copy } = useLocale();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState('all');
    const [category, setCategory] = useState('');
    const [serviceCategoryOptions, setServiceCategoryOptions] = useState(fallbackServiceCategoryOptions);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const loadServiceCategories = async () => {
        try {
            const response = await fetch('/admin/api/service-categories', {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || copy('Failed to load service categories.', 'Imeshindikana kupakia kategoria za huduma.'));
            const options = (data.data || []).map((item) => item.name).filter(Boolean);
            if (options.length) setServiceCategoryOptions(options);
        } catch (error) {
            console.error(error);
        }
    };

    const loadServices = async (nextPage = 1, q = search) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(nextPage),
                search: q,
                mode,
            });
            if (category) params.set('category', category);

            const response = await fetch(`/admin/api/services?${params.toString()}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || copy('Failed to load services.', 'Imeshindikana kupakia huduma.'));

            setServices(data.data || []);
            setPage(data.current_page || 1);
            setLastPage(data.last_page || 1);
        } catch (error) {
            toast.error(error.message);
            setServices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServiceCategories();
        loadServices(1, '');
    }, [mode, category]);

    return (
        <AdminLayout title={copy('Services Monitor', 'Ufuatiliaji wa Huduma')}>
            <Head title={`${copy('Services Monitor', 'Ufuatiliaji wa Huduma')} | Takeer`} />

            <div className="space-y-5">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">{copy('Services Monitor', 'Ufuatiliaji wa Huduma')}</h1>
                    <p className="text-sm text-slate-600">
                        {copy('Read-only visibility into service listings, booking modes, locations, and customer request activity.', 'Mwonekano wa kusoma tu wa huduma, aina za booking, maeneo na maombi ya wateja.')}
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="relative lg:col-span-5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            className="bg-white border-slate-300 text-slate-900 pl-9"
                            placeholder={copy('Search service, merchant, category...', 'Tafuta huduma, muuzaji, kategoria...')}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') loadServices(1, search);
                            }}
                        />
                    </div>
                    <select
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm lg:col-span-3"
                        value={mode}
                        onChange={(event) => setMode(event.target.value)}
                    >
                        {serviceModes.map((option) => (
                            <option key={option.value} value={option.value}>{modeLabel(option.value, copy)}</option>
                        ))}
                    </select>
                    <select
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm lg:col-span-2"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                    >
                        <option value="">{copy('All categories', 'Kategoria zote')}</option>
                        {serviceCategoryOptions.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                    <Button variant="outline" className="lg:col-span-2" onClick={() => loadServices(1, search)}>
                        {copy('Search', 'Tafuta')}
                    </Button>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">{copy('Loading services...', 'Inapakia huduma...')}</CardContent>
                    </Card>
                ) : services.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">{copy('No services found.', 'Hakuna huduma zilizopatikana.')}</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {services.map((service) => (
                            <Card key={service.id} className="bg-white border-slate-200">
                                <CardContent className="p-4">
                                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                                        <div className="xl:col-span-5 min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="h-14 w-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                                    {service.image_url ? (
                                                        <img src={service.image_url} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Calendar className="h-6 w-6 text-slate-400 m-4" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap gap-1.5 mb-1">
                                                        <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                                                            {modeLabel(service.service_mode, copy)}
                                                        </span>
                                                        {service.status && (
                                                            <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                                                                {service.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="font-black text-slate-900 truncate">{service.title}</p>
                                                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                                                        <Store className="h-3.5 w-3.5" />
                                                        {service.merchant?.display_name || copy('Merchant', 'Muuzaji')}
                                                        {service.merchant?.username ? ` (@${service.merchant.username})` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="xl:col-span-3 space-y-2 text-sm text-slate-700">
                                            <p className="font-black text-slate-900">{priceLabel(service, copy)}</p>
                                            {service.service_charges?.length > 0 && (
                                                <p className="text-xs font-semibold text-indigo-700">
                                                    + {service.service_charges.length} {copy(service.service_charges.length > 1 ? 'extra charges' : 'extra charge', service.service_charges.length > 1 ? 'gharama za ziada' : 'gharama ya ziada')}
                                                </p>
                                            )}
                                            <p>
                                                {service.service_subcategory || service.service_category || copy('Uncategorized', 'Haijaainishwa')}
                                            </p>
                                            <p className="flex items-center gap-1 text-xs text-slate-600">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {locationLabel(service.service_location_type, copy)}
                                            </p>
                                            {service.service_duration_minutes && (
                                                <p className="flex items-center gap-1 text-xs text-slate-600">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {service.service_duration_minutes} {copy('min', 'dak')}
                                                </p>
                                            )}
                                        </div>

                                        <div className="xl:col-span-2 grid grid-cols-3 xl:grid-cols-1 gap-2">
                                            <Metric label={copy('Requests', 'Maombi')} value={service.service_requests_count} />
                                            <Metric label={copy('Open', 'Wazi')} value={service.pending_requests_count} />
                                            <Metric label={copy('Paid', 'Imelipwa')} value={service.paid_requests_count} />
                                        </div>

                                        <div className="xl:col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{copy('Recent requests', 'Maombi ya hivi karibuni')}</p>
                                            {service.latest_requests?.length ? (
                                                <div className="space-y-1.5">
                                                    {service.latest_requests.map((request) => (
                                                        <div key={request.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                            <p className="text-xs font-bold text-slate-800 truncate">{request.customer_name || copy('Customer', 'Mteja')}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {request.status} · {request.payment_status || 'unpaid'}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500">{copy('No requests yet.', 'Hakuna maombi bado.')}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                                        <span>{copy('Created', 'Imeundwa')} {formatDate(service.created_at)}</span>
                                        {service.service_area?.length > 0 && (
                                            <span>{copy('Areas:', 'Maeneo:')} {service.service_area.slice(0, 4).join(', ')}</span>
                                        )}
                                        {service.merchant?.id && (
                                            <Link href={`/admin/merchants/${service.merchant.id}`} className="ml-auto inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900">
                                                {copy('Merchant', 'Muuzaji')} <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => loadServices(page - 1, search)}>{copy('Prev', 'Iliyotangulia')}</Button>
                    <span className="text-sm text-slate-700">{copy('Page', 'Ukurasa')} {page} / {lastPage}</span>
                    <Button variant="outline" disabled={page >= lastPage} onClick={() => loadServices(page + 1, search)}>{copy('Next', 'Inayofuata')}</Button>
                </div>
            </div>
        </AdminLayout>
    );
}

function Metric({ label, value }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
            <p className="text-lg font-black text-slate-900">{Number(value || 0).toLocaleString()}</p>
        </div>
    );
}

function modeLabel(value, copy) {
    const labels = {
        all: ['All modes', 'Aina zote'],
        showcase_only: ['Showcase', 'Onyesha tu'],
        request_quote: ['Request quote', 'Omba bei'],
        book_appointment: ['Appointment', 'Miadi'],
        pay_now: ['Pay / reserve', 'Lipa / hifadhi'],
        external_booking: ['External booking', 'Booking ya nje'],
    };
    const [english, swahili] = labels[value] || ['Service', 'Huduma'];
    return copy(english, swahili);
}

function locationLabel(value, copy) {
    const labels = {
        provider_location: ['Provider venue', 'Eneo la mtoa huduma'],
        customer_location: ['Client location', 'Eneo la mteja'],
        remote: ['Remote/online', 'Mbali/mtandaoni'],
        hybrid: ['Hybrid', 'Mchanganyiko'],
    };
    const [english, swahili] = labels[value] || [value || 'No location type', value || 'Hakuna aina ya eneo'];
    return copy(english, swahili);
}
