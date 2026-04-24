import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Flag, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

export default function AdminContentReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [resolvingReportId, setResolvingReportId] = useState(null);
    const [noteById, setNoteById] = useState({});

    useEffect(() => {
        loadReports();
    }, [statusFilter]);

    const loadReports = async () => {
        setLoading(true);
        try {
            const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
            const res = await axios.get(`/admin/api/content-reports${query}`);
            setReports(res.data?.data || []);
        } catch (error) {
            toast.error('Failed to load content reports.');
        } finally {
            setLoading(false);
        }
    };

    const resolveContentReport = async (reportId, status, actionTaken = 'none') => {
        setResolvingReportId(reportId);
        try {
            await axios.patch(`/admin/api/content-reports/${reportId}/resolve`, {
                status,
                action_taken: actionTaken,
                resolution_note: noteById[reportId] || '',
            });
            toast.success('Content report updated.');
            await loadReports();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update content report.');
        } finally {
            setResolvingReportId(null);
        }
    };

    return (
        <AdminLayout title="Content Reports">
            <Head title="Admin Content Reports | Takeer" />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Flag className="h-6 w-6 text-amber-700" /> Reported Content
                        </h1>
                        <p className="text-slate-600 mt-1 text-sm">Manage policy reports with actual platform data.</p>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                            <option value="all">All statuses</option>
                            <option value="open">Open</option>
                            <option value="under_review">Under Review</option>
                            <option value="resolved">Resolved</option>
                            <option value="dismissed">Dismissed</option>
                        </select>
                        <Button variant="outline" onClick={loadReports}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200 p-12 text-center text-slate-500">Loading reports...</Card>
                ) : reports.length === 0 ? (
                    <Card className="bg-white border-slate-200 p-12 text-center text-slate-500">No reports right now.</Card>
                ) : (
                    <div className="space-y-4">
                        {reports.map((report) => (
                            <Card key={report.id} className="bg-white border-slate-200 shadow-sm p-4 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-bold text-slate-900">Report #{report.id} · {report.item_type} #{report.item_id}</p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Merchant: {report.merchant?.display_name || '-'} · Reporter: {report.reporter?.name || '-'} · Reason: {report.reason}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">Status: <span className="font-bold uppercase">{report.status}</span></p>
                                    </div>
                                </div>

                                {report.notes && <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{report.notes}</p>}

                                <textarea
                                    rows={2}
                                    value={noteById[report.id] || ''}
                                    onChange={(e) => setNoteById((prev) => ({ ...prev, [report.id]: e.target.value }))}
                                    placeholder="Resolution note..."
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'under_review', 'none')}>
                                        Under Review
                                    </Button>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'warn_content')}>
                                        Resolve + Warn
                                    </Button>
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'suspend_merchant')}>
                                        Suspend Merchant
                                    </Button>
                                    <Button variant="outline" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'dismissed', 'none')}>
                                        Dismiss
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
