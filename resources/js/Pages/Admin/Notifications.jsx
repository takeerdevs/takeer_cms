import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Bell, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

export default function Notifications() {
    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState({});
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('all');
    const [channel, setChannel] = useState('all');
    const [search, setSearch] = useState('');

    const load = async (page = 1) => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/api/notifications', {
                params: { status, channel, search, page },
            });
            setSummary(res.data?.summary || {});
            setLogs(res.data?.logs?.data || []);
            setMeta({
                current_page: res.data?.logs?.current_page || 1,
                last_page: res.data?.logs?.last_page || 1,
                total: res.data?.logs?.total || 0,
            });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load notifications.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(1);
    }, [status, channel]);

    const formatDate = (value) => value
        ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
        : '-';

    return (
        <AdminLayout title="Notification Outbox">
            <Head title="Notification Outbox | Takeer" />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-sky-100 text-sky-700">
                            <Bell className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Notification Outbox</h1>
                            <p className="text-sm text-slate-600">Monitor SMS, WhatsApp, and email payloads prepared by Takeer.</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => load(meta.current_page)} disabled={loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
                    <Metric label="Total" value={summary.total || 0} tone="text-slate-900" />
                    <Metric label="Pending" value={summary.pending || 0} tone="text-amber-700" />
                    <Metric label="Failed" value={summary.failed || 0} tone="text-red-700" />
                    <Metric label="Sent" value={summary.sent || 0} tone="text-emerald-700" />
                    <Metric label="SMS" value={summary.sms || 0} tone="text-sky-700" />
                    <Metric label="WhatsApp" value={summary.whatsapp || 0} tone="text-green-700" />
                    <Metric label="Email" value={summary.email || 0} tone="text-indigo-700" />
                </div>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-4">
                        <div className="grid md:grid-cols-[160px_160px_1fr_auto] gap-2">
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                            >
                                <option value="all">All statuses</option>
                                <option value="pending">Pending</option>
                                <option value="failed">Failed</option>
                                <option value="sent">Sent</option>
                            </select>
                            <select
                                value={channel}
                                onChange={(e) => setChannel(e.target.value)}
                                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                            >
                                <option value="all">All channels</option>
                                <option value="sms">SMS</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="email">Email</option>
                            </select>
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && load(1)}
                                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                                placeholder="Search recipient, user, subject, message..."
                            />
                            <Button variant="outline" onClick={() => load(1)}>
                                <Search className="h-4 w-4 mr-2" />
                                Search
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-14 text-center text-slate-500">Loading notifications...</div>
                        ) : logs.length === 0 ? (
                            <div className="py-14 text-center text-slate-500">No notifications found.</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {logs.map((log) => (
                                    <div key={log.id} className="p-4">
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                                                        {log.channel || 'sms'}
                                                    </span>
                                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(log.status)}`}>
                                                        {log.status}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-500">{log.gateway || '-'}</span>
                                                </div>
                                                <p className="mt-2 font-black text-slate-900">
                                                    {log.subject || log.metadata?.kind || 'Notification'}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{log.message}</p>
                                                {log.error_message && (
                                                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{log.error_message}</p>
                                                )}
                                            </div>
                                            <div className="lg:w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                                <p><span className="font-black text-slate-900">Recipient:</span> {log.recipient || log.phone || log.email || '-'}</p>
                                                <p><span className="font-black text-slate-900">User:</span> {log.user?.name || '-'} {log.user?.email ? `(${log.user.email})` : ''}</p>
                                                <p><span className="font-black text-slate-900">Created:</span> {formatDate(log.created_at)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">Showing page {meta.current_page} of {meta.last_page} · {meta.total} logs</p>
                    <div className="flex gap-2">
                        <Button variant="outline" disabled={loading || meta.current_page <= 1} onClick={() => load(meta.current_page - 1)}>Previous</Button>
                        <Button variant="outline" disabled={loading || meta.current_page >= meta.last_page} onClick={() => load(meta.current_page + 1)}>Next</Button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function Metric({ label, value, tone }) {
    return (
        <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

function statusClass(status) {
    if (status === 'sent') return 'bg-emerald-100 text-emerald-700';
    if (status === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
}
