import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Download, Loader2, RefreshCw, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90;

export default function TryOnModal({ product, variantId = null, open, onClose }) {
    const { copy } = useLocale();
    const fileInputRef = useRef(null);
    const objectUrlRef = useRef(null);
    const [portrait, setPortrait] = useState(null);
    const [portraitPreview, setPortraitPreview] = useState('');
    const [consent, setConsent] = useState(false);
    const [status, setStatus] = useState('idle');
    const [resultUrl, setResultUrl] = useState('');
    const [error, setError] = useState('');
    const [accessPrompt, setAccessPrompt] = useState(null);

    useEffect(() => {
        if (!open) return undefined;
        setStatus('idle');
        setResultUrl('');
        setError('');
        setAccessPrompt(null);
        setConsent(false);
        setPortrait(null);
        setPortraitPreview('');
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [open, product?.id]);

    if (!open) return null;

    const choosePortrait = (file) => {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError(copy('Please choose a JPG, PNG, or WebP image.', 'Tafadhali chagua picha ya JPG, PNG au WebP.'));
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError(copy('The photo must be smaller than 10 MB.', 'Picha isiwe kubwa kuliko MB 10.'));
            return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = URL.createObjectURL(file);
        setPortrait(file);
        setPortraitPreview(objectUrlRef.current);
        setError('');
        setStatus('idle');
        setResultUrl('');
    };

    const submit = async () => {
        if (!portrait) {
            setError(copy('Add a clear front-facing photo first.', 'Weka kwanza picha iliyo wazi ya upande wa mbele.'));
            return;
        }
        if (!consent) {
            setError(copy('Please agree to the temporary photo processing notice.', 'Tafadhali kubali taarifa ya kuchakata picha kwa muda.'));
            return;
        }

        setStatus('uploading');
        setError('');
        try {
            const formData = new FormData();
            formData.append('portrait', portrait);
            formData.append('consent', '1');
            if (variantId) formData.append('variant_id', String(variantId));

            const response = await fetch(`/api/try-on/products/${product.slug || product.id}/sessions`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content || '',
                },
                body: formData,
            });
            const data = await response.json().catch(() => ({}));
            if (response.status === 402) {
                setAccessPrompt(data.access || { reason: 'subscription_required' });
                setStatus('idle');
                return;
            }
            if (!response.ok) throw new Error(data.message || copy('Try-on could not be started.', 'Try-on haikuweza kuanzishwa.'));

            setStatus('processing');
            await poll(data.session_id, data.token);
        } catch (submitError) {
            setStatus('failed');
            setError(submitError.message || copy('Something went wrong. Please try again.', 'Kuna tatizo. Tafadhali jaribu tena.'));
        }
    };

    const poll = async (sessionId, token) => {
        for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            const response = await fetch(`/api/try-on/sessions/${sessionId}?token=${encodeURIComponent(token)}`, {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || copy('Could not read try-on progress.', 'Imeshindikana kusoma maendeleo ya try-on.'));

            if (data.status === 'completed') {
                setResultUrl(data.result_url);
                setStatus('completed');
                return;
            }
            if (data.status === 'failed') {
                throw new Error(data.error_message || copy('The try-on preview failed. Please try another photo.', 'Try-on imeshindikana. Tafadhali jaribu picha nyingine.'));
            }
        }
        throw new Error(copy('This is taking longer than expected. Please try again.', 'Inachukua muda mrefu kuliko ilivyotarajiwa. Tafadhali jaribu tena.'));
    };

    const reset = () => {
        setStatus('idle');
        setResultUrl('');
        setError('');
        setAccessPrompt(null);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border bg-background shadow-2xl sm:rounded-3xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 px-5 py-4 backdrop-blur">
                    <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                            <Sparkles className="h-3.5 w-3.5" /> {copy('Virtual try-on', 'Jaribisha kuvaa')}
                        </p>
                        <h2 className="mt-1 text-xl font-black">{product?.title}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" aria-label={copy('Close', 'Funga')}>
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4 p-5">
                    {status === 'completed' && resultUrl ? (
                        <>
                            <div className="overflow-hidden rounded-2xl border bg-slate-950">
                                <img src={resultUrl} alt={copy('Virtual try-on result', 'Matokeo ya jaribio la kuvaa')} className="max-h-[58vh] w-full object-contain" />
                            </div>
                            <div className="flex gap-2">
                                <a href={resultUrl} download={`takeer-try-on-${product?.slug || product?.id}.jpg`} className="flex-1">
                                    <Button type="button" variant="outline" className="w-full rounded-xl"><Download className="mr-2 h-4 w-4" /> {copy('Save image', 'Hifadhi picha')}</Button>
                                </a>
                                <Button type="button" onClick={reset} className="flex-1 rounded-xl bg-brand-600 text-white"><RefreshCw className="mr-2 h-4 w-4" /> {copy('Try another', 'Jaribu nyingine')}</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div
                                className="relative flex min-h-64 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {portraitPreview ? (
                                    <img src={portraitPreview} alt={copy('Your portrait preview', 'Muonekano wa picha yako')} className="max-h-80 w-full object-contain" />
                                ) : (
                                    <div className="p-6 text-center">
                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Camera className="h-7 w-7" /></div>
                                        <p className="mt-3 text-sm font-black">{copy('Upload a clear portrait', 'Pakia portrait iliyo wazi')}</p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy('Front-facing, good lighting, and your upper body visible works best.', 'Picha ya mbele, mwanga mzuri, na mwili wa juu uonekane vizuri.')}</p>
                                        <span className="mt-4 inline-flex items-center rounded-xl bg-brand-600 px-3 py-2 text-xs font-black text-white"><Upload className="mr-1.5 h-3.5 w-3.5" /> {copy('Choose photo', 'Chagua picha')}</span>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => choosePortrait(event.target.files?.[0])} />
                            </div>

                            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-5 text-blue-900">
                                <p className="flex items-center gap-1.5 font-black"><ShieldCheck className="h-4 w-4" /> {copy('Privacy notice', 'Taarifa ya faragha')}</p>
                                <p className="mt-1">{copy('Your portrait is used only to create this preview and is deleted after processing or expiry.', 'Portrait yako inatumika tu kutengeneza preview hii na inafutwa baada ya kuchakatwa au muda kuisha.')}</p>
                            </div>

                            <label className="flex items-start gap-2 text-xs font-semibold leading-5">
                                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 rounded border-input" />
                                <span>{copy('I agree that Takeer may temporarily process this portrait to generate a clothing preview. I understand this is not a fit or measurement guarantee.', 'Nakubali Takeer ichakate portrait hii kwa muda ili kutengeneza preview ya nguo. Ninaelewa kuwa hii si dhamana ya fitting au vipimo.')}</span>
                            </label>

                            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}

                            {accessPrompt && (
                                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950">
                                    <p className="font-black">{copy('Virtual try-on uses AI credits', 'Virtual try-on hutumia credits za AI')}</p>
                                    <p className="mt-1 text-xs leading-5 text-brand-800">{accessPrompt.reason === 'credits_required' ? copy('This account needs more credits before creating another preview.', 'Akaunti hii inahitaji credits zaidi kabla ya kutengeneza preview nyingine.') : copy('Choose an AI plan for virtual try-on, or continue shopping and try again later.', 'Chagua mpango wa AI kwa virtual try-on, au endelea kununua ujaribu tena baadaye.')}</p>
                                    <div className="mt-3 flex gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>{copy('View plans later', 'Angalia mipango baadaye')}</Button><Button type="button" className="rounded-xl bg-brand-600 text-white" onClick={() => setAccessPrompt(null)}>{copy('Continue', 'Endelea')}</Button></div>
                                </div>
                            )}

                            <Button type="button" onClick={submit} disabled={status === 'uploading' || status === 'processing'} className="h-12 w-full rounded-xl bg-brand-600 font-black text-white">
                                {status === 'uploading' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {copy('Uploading photo...', 'Inapakia picha...')}</> : status === 'processing' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {copy('Creating your preview...', 'Inatengeneza preview yako...')}</> : <><Sparkles className="mr-2 h-4 w-4" /> {copy('Try this on', 'Jaribu kuvaa')}</>}
                            </Button>

                            {status === 'processing' && <p className="text-center text-xs font-semibold text-muted-foreground">{copy('This can take up to a minute. Keep this window open.', 'Hii inaweza kuchukua hadi dakika moja. Usifunge dirisha hili.')}</p>}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
