import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { CheckCircle2, ExternalLink, FileCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';
import { REQUIRED_MERCHANT_DOCUMENT_TYPES, legalDocumentLabel, legalDocumentSlug } from '@/lib/legalDocuments';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const isActive = (document) => document.status === 'active' && (!document.effective_at || new Date(document.effective_at) <= new Date());

export default function LegalDocuments() {
    const { copy } = useLocale();
    const [documents, setDocuments] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activatingId, setActivatingId] = useState(null);

    const loadDocuments = async ({ showSpinner = true } = {}) => {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);

        try {
            const response = await fetch('/admin/api/legal/documents', { headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || copy('Could not load legal documents.', 'Imeshindikana kupakia nyaraka za sheria.'));
            setDocuments(payload.documents || []);
            setDrafts((current) => Object.fromEntries((payload.documents || []).map((document) => [
                document.id,
                current[document.id] || {
                    approval_reference: document.approval_reference || '',
                    immutable_storage_uri: document.immutable_storage_uri || '',
                },
            ])));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const activeRequiredCount = useMemo(() => documents.filter((document) => REQUIRED_MERCHANT_DOCUMENT_TYPES.includes(document.document_type) && isActive(document)).length, [documents]);
    const requiredReady = activeRequiredCount === REQUIRED_MERCHANT_DOCUMENT_TYPES.length;

    const setDraft = (id, key, value) => {
        setDrafts((current) => ({
            ...current,
            [id]: { ...(current[id] || {}), [key]: value },
        }));
    };

    const activate = async (document) => {
        const draft = drafts[document.id] || {};
        if (!draft.approval_reference?.trim() || !draft.immutable_storage_uri?.trim()) {
            toast.error(copy('Add the approval reference and immutable storage URI first.', 'Weka approval reference na immutable storage URI kwanza.'));
            return;
        }

        setActivatingId(document.id);
        try {
            const response = await fetch(`/admin/api/legal/documents/${document.id}/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({
                    approval_reference: draft.approval_reference.trim(),
                    immutable_storage_uri: draft.immutable_storage_uri.trim(),
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || copy('Could not activate this document.', 'Imeshindikana kuwasha hati hii.'));
            toast.success(copy(`${legalDocumentLabel(document.document_type, copy)} is now active.`, `${legalDocumentLabel(document.document_type, copy)} sasa iko active.`));
            await loadDocuments({ showSpinner: false });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setActivatingId(null);
        }
    };

    return (
        <AdminLayout title={copy('Legal documents', 'Nyaraka za sheria')}>
            <Head title={`${copy('Legal documents', 'Nyaraka za sheria')} | Takeer`} />

            <div className="max-w-4xl space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                            <FileCheck className="h-6 w-6 text-brand-600" />
                            {copy('Legal documents', 'Nyaraka za sheria')}
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-slate-600">
                            {copy('Review and activate the documents merchants must accept before publishing products.', 'Kagua na washe nyaraka ambazo wafanyabiashara lazima wakubali kabla ya kuchapisha bidhaa.')}
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => loadDocuments({ showSpinner: false })} disabled={refreshing} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {copy('Refresh', 'Pakia upya')}
                    </Button>
                </div>

                <Card className={requiredReady ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/70'}>
                    <CardContent className="flex items-start gap-3 p-5">
                        {requiredReady ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
                        <div>
                            <p className={`font-black ${requiredReady ? 'text-emerald-900' : 'text-amber-900'}`}>
                                {requiredReady
                                    ? copy('All merchant documents are active.', 'Nyaraka zote za mfanyabiashara ziko active.')
                                    : copy(`${activeRequiredCount} of ${REQUIRED_MERCHANT_DOCUMENT_TYPES.length} required merchant documents are active.`, `${activeRequiredCount} kati ya nyaraka ${REQUIRED_MERCHANT_DOCUMENT_TYPES.length} zinazohitajika ziko active.`)}
                            </p>
                            <p className={`mt-1 text-sm ${requiredReady ? 'text-emerald-800' : 'text-amber-800'}`}>
                                {requiredReady
                                    ? copy('Merchants can now accept the terms after reviewing them.', 'Wafanyabiashara sasa wanaweza kukubali masharti baada ya kuyasoma.')
                                    : copy('Each required document needs an approval reference and must be activated before merchant acceptance is available.', 'Kila hati inayohitajika lazima iwe na approval reference na iwashwe kabla ya mfanyabiashara kuweza kukubali.')}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {loading ? (
                    <div className="flex h-48 items-center justify-center text-sm font-bold text-slate-500">{copy('Loading legal documents...', 'Inapakia nyaraka za sheria...')}</div>
                ) : documents.length === 0 ? (
                    <Card><CardContent className="p-6 text-sm text-slate-600">{copy('No legal documents have been seeded yet.', 'Hakuna nyaraka za sheria zilizowekwa bado.')}</CardContent></Card>
                ) : (
                    <div className="space-y-4">
                        {documents.map((document) => {
                            const active = isActive(document);
                            const draft = drafts[document.id] || {};
                            const required = REQUIRED_MERCHANT_DOCUMENT_TYPES.includes(document.document_type);

                            return (
                                <Card key={document.id} className="border-slate-200 bg-white shadow-sm">
                                    <CardContent className="space-y-4 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="font-black text-slate-900">{legalDocumentLabel(document.document_type, copy)}</h2>
                                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                                                        {active ? copy('Active', 'Active') : copy('Pending approval', 'Inasubiri idhini')}
                                                    </span>
                                                    {required && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">{copy('Required for merchants', 'Inahitajika kwa wafanyabiashara')}</span>}
                                                </div>
                                                <p className="mt-1 text-xs font-semibold text-slate-500">{document.document_type} · {document.version}</p>
                                            </div>
                                            <a href={`/legal/${legalDocumentSlug(document.document_type)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 underline">
                                                {copy('Read document', 'Soma hati')} <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                        </div>

                                        {active ? (
                                            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                                <p><span className="font-black text-slate-800">{copy('Approval:', 'Idhini:')}</span> {document.approval_reference || '—'}</p>
                                                <p><span className="font-black text-slate-800">{copy('Effective:', 'Imeanza:')}</span> {document.effective_at ? new Date(document.effective_at).toLocaleString() : '—'}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <label className="space-y-1.5">
                                                        <span className="text-xs font-black uppercase tracking-wider text-slate-600">{copy('Approval reference', 'Approval reference')}</span>
                                                        <Input value={draft.approval_reference || ''} onChange={(event) => setDraft(document.id, 'approval_reference', event.target.value)} placeholder={copy('e.g. LEGAL-2026-001', 'Mf. LEGAL-2026-001')} />
                                                    </label>
                                                    <label className="space-y-1.5">
                                                        <span className="text-xs font-black uppercase tracking-wider text-slate-600">{copy('Immutable storage URI', 'Immutable storage URI')}</span>
                                                        <Input value={draft.immutable_storage_uri || ''} onChange={(event) => setDraft(document.id, 'immutable_storage_uri', event.target.value)} placeholder="s3://... or internal://..." />
                                                    </label>
                                                </div>
                                                <Button type="button" onClick={() => activate(document)} disabled={activatingId === document.id} className="w-full bg-brand-600 font-black text-white hover:bg-brand-700 sm:w-auto">
                                                    {activatingId === document.id ? copy('Activating...', 'Inawashwa...') : copy('Approve and activate', 'Idhinisha na washa')}
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
