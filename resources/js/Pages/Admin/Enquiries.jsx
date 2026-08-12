import React, { useEffect, useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';
import { CheckCircle2, LifeBuoy, MessageSquare, RefreshCw, Search } from 'lucide-react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { cn } from '@/lib/utils';

export default function Enquiries() {
    const { copy } = useLocale();
    const [enquiries, setEnquiries] = useState([]);
    const [summary, setSummary] = useState({});
    const [categories, setCategories] = useState({});
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [status, setStatus] = useState('all');
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);

    const load = async (page = 1) => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/api/enquiries', {
                params: { status, category, search, page },
            });
            setSummary(res.data?.summary || {});
            setCategories(res.data?.categories || {});
            setEnquiries(res.data?.enquiries?.data || []);
            setMeta({
                current_page: res.data?.enquiries?.current_page || 1,
                last_page: res.data?.enquiries?.last_page || 1,
                total: res.data?.enquiries?.total || 0,
            });
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load enquiries.', 'Imeshindikana kupakia maulizo.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, [status, category]);

    const categoryOptions = useMemo(() => Object.entries(categories), [categories]);

    const updateEnquiry = async (enquiry, next) => {
        setSavingId(enquiry.id);
        try {
            const res = await axios.patch(`/admin/api/enquiries/${enquiry.id}`, {
                status: next.status ?? enquiry.status,
                priority: next.priority ?? enquiry.priority,
                internal_note: next.internal_note ?? enquiry.internal_note ?? '',
            });
            const fresh = res.data?.enquiry;
            if (fresh) {
                setEnquiries((current) => current.map((item) => item.id === fresh.id ? fresh : item));
            }
            setSummary(res.data?.summary || summary);
            toast.success(copy('Enquiry updated.', 'Swali limesasishwa.'));
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Could not update enquiry.', 'Imeshindikana kusasisha swali.'));
        } finally {
            setSavingId(null);
        }
    };

    return (
        <AdminLayout title={copy('Support Enquiries', 'Maulizo ya Usaidizi')}>
            <Head title={`${copy('Support Enquiries', 'Maulizo ya Usaidizi')} | Takeer Admin`} />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-brand-50 p-3 text-brand-700">
                            <LifeBuoy className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{copy('Support Enquiries', 'Maulizo ya Usaidizi')}</h1>
                            <p className="mt-1 text-sm text-slate-600">{copy('Track help requests from buyers, merchants, and visitors.', 'Fuatilia maombi ya msaada kutoka kwa wanunuzi, wauzaji na wageni.')}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => load(meta.current_page)} disabled={loading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
                    <Metric label="Total" value={summary.total || 0} tone="text-slate-900" />
                    <Metric label="New" value={summary.new || 0} tone="text-brand-700" />
                    <Metric label="Open" value={summary.open || 0} tone="text-amber-700" />
                    <Metric label="Resolved" value={summary.resolved || 0} tone="text-emerald-700" />
                    <Metric label="Closed" value={summary.closed || 0} tone="text-slate-600" />
                    <Metric label="High" value={summary.high || 0} tone="text-orange-700" />
                    <Metric label="Urgent" value={summary.urgent || 0} tone="text-red-700" />
                </div>

                <Card className="border-slate-200 bg-white">
                    <CardContent className="p-4">
                        <div className="grid gap-2 lg:grid-cols-[150px_190px_1fr_auto]">
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                                <option value="all">{copy('All statuses', 'Hali zote')}</option>
                                <option value="new">{copy('New', 'Jipya')}</option>
                                <option value="open">{copy('Open', 'Wazi')}</option>
                                <option value="resolved">{copy('Resolved', 'Limetatuliwa')}</option>
                                <option value="closed">{copy('Closed', 'Limefungwa')}</option>
                            </select>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                                <option value="all">{copy('All categories', 'Kategoria zote')}</option>
                                {categoryOptions.map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && load(1)}
                                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                            placeholder={copy('Search reference, contact, order, subject...', 'Tafuta kumbukumbu, mawasiliano, oda, mada...')}
                            />
                            <Button variant="outline" onClick={() => load(1)}>
                                <Search className="mr-2 h-4 w-4" />
                                Search
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-14 text-center text-sm font-semibold text-slate-500">{copy('Loading enquiries...', 'Inapakia maulizo...')}</div>
                        ) : enquiries.length === 0 ? (
                            <div className="py-14 text-center">
                                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                                <p className="mt-3 font-black text-slate-900">{copy('No enquiries found.', 'Hakuna maulizo yaliyopatikana.')}</p>
                                <p className="mt-1 text-sm text-slate-500">{copy('Support requests will appear here when users submit them.', 'Maombi ya msaada yataonekana hapa watumiaji watakapoyatuma.')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {enquiries.map((enquiry) => (
                                    <EnquiryRow
                                        key={enquiry.id}
                                        enquiry={enquiry}
                                        categories={categories}
                                        saving={savingId === enquiry.id}
                                        onUpdate={updateEnquiry}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">Showing page {meta.current_page} of {meta.last_page} · {meta.total} enquiries</p>
                    <div className="flex gap-2">
                        <Button variant="outline" disabled={meta.current_page <= 1 || loading} onClick={() => load(meta.current_page - 1)}>{copy('Previous', 'Iliyotangulia')}</Button>
                        <Button variant="outline" disabled={meta.current_page >= meta.last_page || loading} onClick={() => load(meta.current_page + 1)}>{copy('Next', 'Inayofuata')}</Button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function EnquiryRow({ enquiry, categories, saving, onUpdate }) {
    const [note, setNote] = useState(enquiry.internal_note || '');
    const { copy } = useLocale();

    useEffect(() => {
        setNote(enquiry.internal_note || '');
    }, [enquiry.id, enquiry.internal_note]);

    return (
        <div className="p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">{enquiry.reference}</span>
                        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', statusClass(enquiry.status))}>{enquiry.status}</span>
                        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', priorityClass(enquiry.priority))}>{enquiry.priority}</span>
                        <span className="text-xs font-bold text-slate-500">{formatDate(enquiry.created_at)}</span>
                    </div>
                    <p className="mt-3 text-base font-black text-slate-900">{enquiry.subject || categories[enquiry.category] || 'Support enquiry'}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{categories[enquiry.category] || enquiry.category}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{enquiry.message}</p>
                    <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 md:grid-cols-2">
                        <p><span className="font-black text-slate-900">{copy('Name:', 'Jina:')}</span> {enquiry.name || enquiry.user?.name || '-'}</p>
                        <p><span className="font-black text-slate-900">{copy('Order:', 'Oda:')}</span> {enquiry.order_reference || '-'}</p>
                        <p><span className="font-black text-slate-900">{copy('Email:', 'Barua pepe:')}</span> {enquiry.email || enquiry.user?.email || '-'}</p>
                        <p><span className="font-black text-slate-900">{copy('Phone:', 'Simu:')}</span> {enquiry.phone || enquiry.user?.phone_number || '-'}</p>
                    </div>
                </div>

                <div className="w-full shrink-0 space-y-2 xl:w-72">
                    <select
                        value={enquiry.status}
                        onChange={(e) => onUpdate(enquiry, { status: e.target.value, internal_note: note })}
                        disabled={saving}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"
                    >
                        <option value="new">{copy('New', 'Jipya')}</option>
                        <option value="open">{copy('Open', 'Wazi')}</option>
                        <option value="resolved">{copy('Resolved', 'Limetatuliwa')}</option>
                        <option value="closed">{copy('Closed', 'Limefungwa')}</option>
                    </select>
                    <select
                        value={enquiry.priority || 'normal'}
                        onChange={(e) => onUpdate(enquiry, { priority: e.target.value, internal_note: note })}
                        disabled={saving}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold"
                    >
                        <option value="normal">{copy('Normal', 'Kawaida')}</option>
                        <option value="high">{copy('High', 'Juu')}</option>
                        <option value="urgent">{copy('Urgent', 'Dharura')}</option>
                    </select>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        placeholder={copy('Internal note', 'Maelezo ya ndani')}
                    />
                    <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" disabled={saving} onClick={() => onUpdate(enquiry, { internal_note: note })}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {saving ? 'Saving...' : 'Save note'}
                    </Button>
                    {enquiry.resolved_by && (
                        <p className="text-xs font-semibold text-slate-500">Resolved by {enquiry.resolved_by.name}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function Metric({ label, value, tone }) {
    const { copy } = useLocale();
    const translations = {
        Total: 'Jumla',
        New: 'Jipya',
        Open: 'Wazi',
        Resolved: 'Limetatuliwa',
        Closed: 'Limefungwa',
        High: 'Juu',
        Urgent: 'Dharura',
    };
    return (
        <Card className="border-slate-200 bg-white">
            <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy(label, translations[label] || label)}</p>
                <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

function formatDate(value) {
    if (!value) return '-';

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function statusClass(status) {
    if (status === 'new') return 'bg-brand-50 text-brand-700';
    if (status === 'open') return 'bg-amber-50 text-amber-700';
    if (status === 'resolved') return 'bg-emerald-50 text-emerald-700';
    return 'bg-slate-100 text-slate-600';
}

function priorityClass(priority) {
    if (priority === 'urgent') return 'bg-red-50 text-red-700';
    if (priority === 'high') return 'bg-orange-50 text-orange-700';
    return 'bg-slate-100 text-slate-600';
}
