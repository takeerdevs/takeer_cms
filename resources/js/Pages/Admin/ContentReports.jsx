import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Flag, RefreshCw, RotateCcw, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useLocale } from '@/lib/i18n';

export default function AdminContentReports() {
    const { t, copy } = useLocale();
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
            toast.error(t('adminUi.loadingReports'));
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
            toast.success(copy('Content report updated.', 'Ripoti ya content imesasishwa.'));
            await loadReports();
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to update content report.', 'Imeshindikana kusasisha ripoti ya content.'));
        } finally {
            setResolvingReportId(null);
        }
    };

    return (
        <AdminLayout title={t('adminUi.contentReports')}>
            <Head title={`${t('adminUi.contentReports')} | Takeer`} />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Flag className="h-6 w-6 text-amber-700" /> {t('adminUi.contentReports')}
                        </h1>
                        <p className="text-slate-600 mt-1 text-sm">{t('adminUi.contentReportsDescription')}</p>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                            <option value="all">{t('adminUi.allStatuses')}</option>
                            <option value="open">{t('adminUi.open')}</option>
                            <option value="under_review">{t('adminUi.underReview')}</option>
                            <option value="resolved">{t('adminUi.resolved')}</option>
                            <option value="dismissed">{t('adminUi.dismissed')}</option>
                        </select>
                        <Button variant="outline" onClick={loadReports}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {t('adminUi.refresh')}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200 p-12 text-center text-slate-500">{t('adminUi.loadingReports')}</Card>
                ) : reports.length === 0 ? (
                    <Card className="bg-white border-slate-200 p-12 text-center text-slate-500">{t('adminUi.noReports')}</Card>
                ) : (
                    <div className="space-y-4">
                        {reports.map((report) => (
                            <Card key={report.id} className="bg-white border-slate-200 shadow-sm p-4 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-bold text-slate-900">Report #{report.id} · {report.item_type} #{report.item_id}</p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            {t('adminUi.merchant')}: {report.merchant?.display_name || '-'} · {copy('Reporter', 'Aliyeripoti')}: {report.reporter?.name || '-'} · {copy('Reason', 'Sababu')}: {report.reason_code || report.reason}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            {copy('Target', 'Lengo')}: {report.item_summary?.label || '-'} · {copy('Context', 'Muktadha')}: {report.report_context || 'marketplace'}
                                        </p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            {t('adminUi.status')}: <span className="font-bold uppercase">{report.status}</span> · {copy('Safety', 'Usalama')}: <span className="font-bold uppercase">{report.safety_state || 'reported'}</span>
                                            {report.item_summary?.deleted_at ? ` · ${copy('Item restricted', 'Item imezuiwa')}` : ''}
                                        </p>
                                    </div>
                                </div>

                                {report.notes && <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{report.notes}</p>}
                                {report.appeal_status && (
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                                        <p className="font-black uppercase tracking-widest">Appeal: {report.appeal_status}</p>
                                        {report.appeal_message && <p className="mt-1 leading-5">{report.appeal_message}</p>}
                                    </div>
                                )}
                                {report.evidence_url && (
                                    <a href={report.evidence_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 underline">
                                        {copy('View evidence', 'Angalia ushahidi')}
                                    </a>
                                )}

                                <textarea
                                    rows={2}
                                    value={noteById[report.id] || ''}
                                    onChange={(e) => setNoteById((prev) => ({ ...prev, [report.id]: e.target.value }))}
                                    placeholder={copy('Resolution note...', 'Maelezo ya utatuzi...')}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'under_review', 'none')}>
                                        {t('adminUi.underReview')}
                                    </Button>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'warn_content')}>
                                        {copy('Resolve + Warn', 'Tatua + Onya')}
                                    </Button>
                                    <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'restrict_item')}>
                                        <ShieldOff className="h-4 w-4 mr-2" />
                                        {copy('Restrict Item', 'Zuia item')}
                                    </Button>
                                    <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'restore_item')}>
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                        {copy('Restore Item', 'Rejesha item')}
                                    </Button>
                                    {report.appeal_status === 'pending' && (
                                        <>
                                            <Button className="bg-cyan-700 hover:bg-cyan-800 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'approve_appeal')}>
                                                {copy('Approve Appeal', 'Kubali rufaa')}
                                            </Button>
                                            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'reject_appeal')}>
                                                {copy('Reject Appeal', 'Kataa rufaa')}
                                            </Button>
                                        </>
                                    )}
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'resolved', 'suspend_merchant')}>
                                        {copy('Suspend Merchant', 'Simamisha merchant')}
                                    </Button>
                                    <Button variant="outline" disabled={resolvingReportId === report.id} onClick={() => resolveContentReport(report.id, 'dismissed', 'none')}>
                                        {t('adminUi.dismissed')}
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
