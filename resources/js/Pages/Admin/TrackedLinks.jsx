import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { AlertTriangle, ExternalLink, Link as LinkIcon, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const statusOptions = ['all', 'active', 'paused', 'disabled'];

export default function AdminTrackedLinks() {
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('all');
    const [reportedOnly, setReportedOnly] = useState(false);
    const [query, setQuery] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [noteById, setNoteById] = useState({});

    useEffect(() => {
        loadLinks();
    }, [status, reportedOnly]);

    const loadLinks = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('status', status);
            if (reportedOnly) params.set('reported', '1');
            if (query.trim()) params.set('q', query.trim());
            const res = await axios.get(`/admin/api/tracked-links?${params.toString()}`);
            setLinks(res.data?.data || []);
        } catch (error) {
            toast.error('Failed to load tracked links.');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (linkId, nextStatus) => {
        setUpdatingId(linkId);
        try {
            await axios.patch(`/admin/api/tracked-links/${linkId}`, {
                status: nextStatus,
                moderation_note: noteById[linkId] || '',
            });
            toast.success('Tracked link updated.');
            await loadLinks();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update tracked link.');
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <AdminLayout title="Tracked Links">
            <Head title="Tracked Links | Takeer Admin" />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                            <LinkIcon className="h-6 w-6 text-brand-700" /> Tracked Links
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">Review outbound destinations, reports, and creator link activity.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadLinks()}
                            placeholder="Search URL, host, code..."
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        />
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <Button variant={reportedOnly ? 'default' : 'outline'} onClick={() => setReportedOnly((value) => !value)}>
                            <AlertTriangle className="mr-2 h-4 w-4" /> Reported
                        </Button>
                        <Button variant="outline" onClick={loadLinks}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card className="border-slate-200 bg-white p-12 text-center text-slate-500">Loading tracked links...</Card>
                ) : links.length === 0 ? (
                    <Card className="border-slate-200 bg-white p-12 text-center text-slate-500">No tracked links found.</Card>
                ) : (
                    <div className="space-y-4">
                        {links.map((item) => (
                            <Card key={item.id} className="space-y-4 border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-black text-slate-950">{item.label || item.destination_host || item.code}</p>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${statusClass(item.status)}`}>{item.status}</span>
                                            {item.open_reports_count > 0 && (
                                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                                                    {item.open_reports_count} open report{item.open_reports_count === 1 ? '' : 's'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 break-all text-xs text-slate-600">{item.destination_url}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {item.link_type} · {item.source_surface || 'unknown'} · clicks {Number(item.clicks_count || 0).toLocaleString()} · code {item.code}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Merchant: {item.merchant?.display_name || '-'}
                                            {item.merchant?.id && (
                                                <> · <Link className="font-bold text-brand-700 underline" href={`/admin/merchants/${item.merchant.id}`}>view merchant</Link></>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        <a href={item.tracked_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                            <ExternalLink className="mr-2 h-4 w-4" /> Open
                                        </a>
                                        <Button className="bg-red-600 text-white hover:bg-red-700" disabled={updatingId === item.id || item.status === 'disabled'} onClick={() => updateStatus(item.id, 'disabled')}>
                                            <ShieldOff className="mr-2 h-4 w-4" /> Disable
                                        </Button>
                                        <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={updatingId === item.id || item.status === 'active'} onClick={() => updateStatus(item.id, 'active')}>
                                            <ShieldCheck className="mr-2 h-4 w-4" /> Restore
                                        </Button>
                                    </div>
                                </div>

                                <textarea
                                    rows={2}
                                    value={noteById[item.id] || ''}
                                    onChange={(e) => setNoteById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    placeholder="Moderation note..."
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function statusClass(status) {
    if (status === 'active') return 'bg-emerald-50 text-emerald-700';
    if (status === 'disabled') return 'bg-red-50 text-red-700';
    return 'bg-amber-50 text-amber-700';
}
