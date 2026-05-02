import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Calendar, Clock, ExternalLink, MapPin, Search, Store } from 'lucide-react';
import { toast } from 'sonner';

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

const priceLabel = (service) => {
    if (service.service_price_display === 'hidden') return 'Hidden';
    if (service.service_price_display === 'quote_only' || service.service_mode === 'request_quote') return 'Quote only';
    if (service.service_price_display === 'starts_from') return `From TZS ${Number(service.price || 0).toLocaleString()}`;
    if (service.service_price_display === 'hourly') return `TZS ${Number(service.price || 0).toLocaleString()}/hr`;
    if (service.service_price_display === 'daily') return `TZS ${Number(service.price || 0).toLocaleString()}/day`;
    if (service.service_price_display === 'nightly') return `TZS ${Number(service.price || 0).toLocaleString()}/night`;
    if (service.service_price_display === 'weekly') return `TZS ${Number(service.price || 0).toLocaleString()}/week`;
    if (service.service_price_display === 'monthly') return `TZS ${Number(service.price || 0).toLocaleString()}/month`;
    if (service.service_price_display === 'yearly') return `TZS ${Number(service.price || 0).toLocaleString()}/year`;
    if (service.service_price_display === 'per_person') return `TZS ${Number(service.price || 0).toLocaleString()}/person`;
    if (service.service_price_display === 'per_visit') return `TZS ${Number(service.price || 0).toLocaleString()}/visit`;
    if (service.service_price_display === 'per_session') return `TZS ${Number(service.price || 0).toLocaleString()}/session`;
    if (service.service_price_display === 'per_project') return `TZS ${Number(service.price || 0).toLocaleString()}/project`;
    if (service.service_price_display === 'package') return `TZS ${Number(service.price || 0).toLocaleString()} package`;
    return `TZS ${Number(service.price || 0).toLocaleString()}`;
};

export default function Services() {
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
            if (!response.ok) throw new Error(data.message || 'Failed to load service categories.');
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
            if (!response.ok) throw new Error(data.message || 'Failed to load services.');

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
        <AdminLayout title="Services Monitor">
            <Head title="Services Monitor | Takeer" />

            <div className="space-y-5">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Services Monitor</h1>
                    <p className="text-sm text-slate-600">
                        Read-only visibility into service listings, booking modes, locations, and customer request activity.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="relative lg:col-span-5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            className="bg-white border-slate-300 text-slate-900 pl-9"
                            placeholder="Search service, merchant, category..."
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
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm lg:col-span-2"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                    >
                        <option value="">All categories</option>
                        {serviceCategoryOptions.map((item) => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                    </select>
                    <Button variant="outline" className="lg:col-span-2" onClick={() => loadServices(1, search)}>
                        Search
                    </Button>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">Loading services...</CardContent>
                    </Card>
                ) : services.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="p-10 text-center text-slate-500">No services found.</CardContent>
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
                                                            {serviceModeLabels[service.service_mode] || 'Service'}
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
                                                        {service.merchant?.display_name || 'Merchant'}
                                                        {service.merchant?.username ? ` (@${service.merchant.username})` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="xl:col-span-3 space-y-2 text-sm text-slate-700">
                                            <p className="font-black text-slate-900">{priceLabel(service)}</p>
                                            {service.service_charges?.length > 0 && (
                                                <p className="text-xs font-semibold text-indigo-700">
                                                    + {service.service_charges.length} extra charge{service.service_charges.length > 1 ? 's' : ''}
                                                </p>
                                            )}
                                            <p>
                                                {service.service_subcategory || service.service_category || 'Uncategorized'}
                                            </p>
                                            <p className="flex items-center gap-1 text-xs text-slate-600">
                                                <MapPin className="h-3.5 w-3.5" />
                                                {locationLabels[service.service_location_type] || service.service_location_type || 'No location type'}
                                            </p>
                                            {service.service_duration_minutes && (
                                                <p className="flex items-center gap-1 text-xs text-slate-600">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {service.service_duration_minutes} min
                                                </p>
                                            )}
                                        </div>

                                        <div className="xl:col-span-2 grid grid-cols-3 xl:grid-cols-1 gap-2">
                                            <Metric label="Requests" value={service.service_requests_count} />
                                            <Metric label="Open" value={service.pending_requests_count} />
                                            <Metric label="Paid" value={service.paid_requests_count} />
                                        </div>

                                        <div className="xl:col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Recent requests</p>
                                            {service.latest_requests?.length ? (
                                                <div className="space-y-1.5">
                                                    {service.latest_requests.map((request) => (
                                                        <div key={request.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                            <p className="text-xs font-bold text-slate-800 truncate">{request.customer_name || 'Customer'}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {request.status} · {request.payment_status || 'unpaid'}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500">No requests yet.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                                        <span>Created {formatDate(service.created_at)}</span>
                                        {service.service_area?.length > 0 && (
                                            <span>Areas: {service.service_area.slice(0, 4).join(', ')}</span>
                                        )}
                                        {service.merchant?.id && (
                                            <Link href={`/admin/merchants/${service.merchant.id}`} className="ml-auto inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900">
                                                Merchant <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => loadServices(page - 1, search)}>Prev</Button>
                    <span className="text-sm text-slate-700">Page {page} / {lastPage}</span>
                    <Button variant="outline" disabled={page >= lastPage} onClick={() => loadServices(page + 1, search)}>Next</Button>
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
