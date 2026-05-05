import React, { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const DEFAULT_REASONS = [
    { value: 'misleading', label: 'Misleading or scam' },
    { value: 'copyright', label: 'Copyright or stolen work' },
    { value: 'download_abuse', label: 'Download or file problem' },
    { value: 'license_abuse', label: 'License or key abuse' },
    { value: 'custom_work_issue', label: 'Custom work issue' },
    { value: 'adult_content', label: 'Adult content' },
    { value: 'harassment', label: 'Harassment or abuse' },
    { value: 'spam', label: 'Spam' },
    { value: 'other', label: 'Other' },
];

export default function ContentReportButton({
    itemType,
    itemId,
    merchantId = null,
    context = 'marketplace',
    label = 'Report',
    compact = false,
    className = '',
    reasons = DEFAULT_REASONS,
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState(reasons[0]?.value || 'misleading');
    const [notes, setNotes] = useState('');
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = Boolean(itemType && itemId && reason && !submitting);
    const modalTitle = useMemo(() => {
        if (context === 'custom_work') return 'Report Custom Work';
        if (context === 'license_abuse') return 'Report License Issue';
        if (context === 'order') return 'Report Purchase';
        return 'Report Content';
    }, [context]);

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
            toast.success('Report submitted.');
            setOpen(false);
            setReason(reasons[0]?.value || 'misleading');
            setNotes('');
            setEvidenceUrl('');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit report.');
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
                {label}
            </button>

            {open && (
                <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-4 backdrop-blur-[1px] sm:items-center" onClick={() => setOpen(false)}>
                    <div className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-wider">{modalTitle}</h3>
                                <p className="mt-1 text-xs text-muted-foreground">Takeer will review this and may restrict the item while investigating.</p>
                            </div>
                            <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4 p-4">
                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Reason</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {reasons.map((entry) => (
                                        <button
                                            key={entry.value}
                                            type="button"
                                            onClick={() => setReason(entry.value)}
                                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${reason === entry.value ? 'border-brand-300 bg-brand-100' : 'border-border hover:bg-accent'}`}
                                        >
                                            {entry.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Evidence link (Optional)</p>
                                <input
                                    value={evidenceUrl}
                                    onChange={(e) => setEvidenceUrl(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                                    placeholder="https://..."
                                    type="url"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Notes (Optional)</p>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="min-h-[96px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                                    placeholder="Tell us what happened..."
                                    maxLength={2000}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent">
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitReport}
                                    disabled={!canSubmit}
                                    className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
