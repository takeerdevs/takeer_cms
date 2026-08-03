import React, { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const DEFAULT_REASONS = [
    { value: 'misleading', label: 'Misleading or scam' },
    { value: 'copyright', label: 'Copyright or stolen work' },
    { value: 'download_abuse', label: 'Download or file problem' },
    { value: 'license_abuse', label: 'License or key abuse' },
    { value: 'custom_work_issue', label: 'Custom work issue' },
    { value: 'harassment', label: 'Harassment or abuse' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Other' },
];

export default function ContentReportButton({
    itemType,
    itemId,
    merchantId = null,
    context = 'marketplace',
    label = null,
    compact = false,
    className = '',
    reasons = DEFAULT_REASONS,
}) {
    const { t, copy } = useLocale();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState(reasons[0]?.value || 'misleading');
    const [notes, setNotes] = useState('');
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = Boolean(itemType && itemId && reason && !submitting);
    const modalTitle = useMemo(() => {
        if (context === 'custom_work') return t('sharedUi.reportCustomWork');
        if (context === 'license_abuse') return t('sharedUi.reportLicense');
        if (context === 'order') return t('sharedUi.reportPurchase');
        return t('sharedUi.reportContent');
    }, [context, t]);

    const submitReport = async () => {
        if (!canSubmit) return;

        setSubmitting(true);
        try {
            await axios.post('/api/content/report', {
                merchant_id: merchantId || null,
                item_type: itemType,
                item_id: itemId,
                reason,
                report_context: context,
                notes: notes.trim() || null,
                evidence_url: evidenceUrl.trim() || null,
            });
            toast.success(t('sharedUi.reportSubmitted'));
            setOpen(false);
            setReason(reasons[0]?.value || 'misleading');
            setNotes('');
            setEvidenceUrl('');
        } catch (error) {
            toast.error(error.response?.data?.message || t('sharedUi.submitFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={className || `inline-flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 ${compact ? '' : 'w-full'}`}
            >
                <AlertTriangle className="h-4 w-4" />
                {label || t('sharedUi.report')}
            </button>

            {open && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-4 backdrop-blur-[1px] sm:items-center" onClick={() => setOpen(false)}>
                    <div className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-wider">{modalTitle}</h3>
                                <p className="mt-1 text-xs text-muted-foreground">{t('sharedUi.reportHint')}</p>
                            </div>
                            <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4 p-4">
                            <div className="space-y-2">
                                <label htmlFor="content-report-reason" className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('sharedUi.reason')}</label>
                                <select
                                    id="content-report-reason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                                >
                                    {reasons.map((entry) => (
                                        <option key={entry.value} value={entry.value}>
                                            {entry.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('sharedUi.evidenceOptional')}</p>
                                <input
                                    value={evidenceUrl}
                                    onChange={(e) => setEvidenceUrl(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                    placeholder={copy('Evidence URL (optional)', 'URL ya ushahidi (si lazima)')}
                                    type="url"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{t('sharedUi.notesOptional')}</p>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="min-h-[96px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                                    placeholder={t('sharedUi.notesPlaceholder')}
                                    maxLength={2000}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent">
                                    {t('sharedUi.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={submitReport}
                                    disabled={!canSubmit}
                                    className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
                                >
                                    {submitting ? t('sharedUi.submitting') : t('sharedUi.submit')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
