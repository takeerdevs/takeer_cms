import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import UserAddressManager from '@/Components/UserAddressManager';
import InlinePhoneAuth from '@/Components/InlinePhoneAuth';
import { useLocale } from '@/lib/i18n';
import {
    ArrowRight,
    AtSign,
    Check,
    CheckCircle2,
    Clipboard,
    ExternalLink,
    ImagePlus,
    Link2,
    Loader2,
    MapPin,
    PackageSearch,
    MessageCircle,
    Send,
    Share2,
    ShieldCheck,
    Sparkles,
    Smartphone,
    X,
} from 'lucide-react';

const inputClass = 'h-11 w-full rounded-xl border border-input bg-background px-3 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';
const textareaClass = 'min-h-24 w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export default function Buy({ enabled = true, entryEnabled = true }) {
    const { copy } = useLocale();
    const { auth, geo } = usePage().props;
    const [inlineUser, setInlineUser] = useState(null);
    const [authOpen, setAuthOpen] = useState(false);
    const isAuthenticated = Boolean(auth?.user || inlineUser);
    const isPhoneVerified = Boolean(auth?.user?.phone_verified_at || inlineUser);
    const defaultPhoneRegion = String(geo?.country?.iso_alpha2 || '').toUpperCase();
    const [step, setStep] = useState('link');
    const [url, setUrl] = useState('');
    const [productCode, setProductCode] = useState('');
    const [preview, setPreview] = useState(null);
    const [matchedProduct, setMatchedProduct] = useState(null);
    const detectedPlatform = useMemo(() => detectSocialPlatform(url), [url]);
    const [phoneCandidates, setPhoneCandidates] = useState([]);
    const [selectedPhoneCandidateId, setSelectedPhoneCandidateId] = useState(null);
    const [form, setForm] = useState({ requested_quantity: 1, buyer_product_note: '', buyer_variant_note: '', destination_summary: '', delivery_address: '', seller_phone: '', seller_phone_region: '', seller_phone_source: '', seller_contact_attested: false });
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [request, setRequest] = useState(null);
    const [sellerMatch, setSellerMatch] = useState(null);
    const [buyerScreenshot, setBuyerScreenshot] = useState(null);
    const [buyerScreenshotPreview, setBuyerScreenshotPreview] = useState('');
    const screenshotInputRef = useRef(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [inviteUrl, setInviteUrl] = useState('');
    const [sellerMessage, setSellerMessage] = useState('');
    const [inviteError, setInviteError] = useState('');
    const [inviteBusy, setInviteBusy] = useState(false);

    useEffect(() => () => {
        if (buyerScreenshotPreview) URL.revokeObjectURL(buyerScreenshotPreview);
    }, [buyerScreenshotPreview]);

    const supported = useMemo(() => {
        try {
            return ['http:', 'https:'].includes(new URL(url).protocol);
        } catch {
            return false;
        }
    }, [url]);

    async function loadProductCode(event) {
        event.preventDefault();
        const digits = productCode.replace(/\D/g, '').slice(0, 18);
        const code = `TK${digits}`;
        setProductCode(digits);
        setError('');

        if (digits.length < 5) {
            setError(copy('Enter at least 5 digits after TK.', 'Weka angalau tarakimu 5 baada ya TK.'));
            return;
        }

        setBusy(true);
        try {
            const response = await axios.get(`/api/products/code/${encodeURIComponent(code)}`);
            const product = response.data.product;
            setMatchedProduct({
                product,
                merchant: product.merchant,
                lookup_type: 'code',
            });
            setPreview(null);
            setStep('matched');
        } catch (exception) {
            setError(exception.response?.data?.message || copy(`No product was found with code ${code}.`, `Hakuna bidhaa iliyopatikana kwa namba ${code}.`));
        } finally {
            setBusy(false);
        }
    }

    async function loadPreview(event) {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
            // A seller-confirmed social mapping should go straight to the
            // canonical Takeer product page and its normal checkout flow.
            let fastPathResponse = null;
            try {
                fastPathResponse = await axios.post('/api/social-commerce/resolve', { url });
            } catch {
                // A fast-path miss must never prevent the normal preview flow.
            }

            if (fastPathResponse?.data?.matched && fastPathResponse.data.product?.url) {
                setMatchedProduct(fastPathResponse.data);
                setPreview(null);
                setStep('matched');
                return;
            }

            setMatchedProduct(null);
            const response = await axios.post('/api/social-commerce/previews', { url, phone_region: defaultPhoneRegion || undefined });
            const candidates = response.data.contact_candidates || response.data.preview?.contact_candidates || [];
            const selectedCandidate = candidates.length === 1 ? candidates[0] : null;
            setPreview(response.data);
            setPhoneCandidates(candidates);
            setSelectedPhoneCandidateId(selectedCandidate?.id || null);
            setForm((current) => ({
                ...current,
                seller_phone: selectedCandidate?.normalized || '',
                seller_phone_region: selectedCandidate?.country_iso2 || defaultPhoneRegion || '',
                seller_phone_source: selectedCandidate ? 'public_post' : '',
                seller_contact_attested: false,
            }));
            setStep('details');
            if (!isAuthenticated) setAuthOpen(true);
        } catch (exception) {
            setError(exception.response?.data?.message || copy('We could not read that social-media link yet. Check the URL and try again.', 'Hatukuweza kusoma link hiyo ya mtandao wa kijamii bado. Kagua URL kisha ujaribu tena.'));
        } finally {
            setBusy(false);
        }
    }

    async function submitRequest(event) {
        event.preventDefault();
        setError('');

        if (!isAuthenticated) {
            setError(copy('Sign in or create a Takeer account before sending a seller request.', 'Ingia au fungua akaunti ya Takeer kabla ya kutuma ombi kwa seller.'));
            return;
        }

        if (!isPhoneVerified) {
            setError(copy('Verify your Takeer phone number before sending a seller request.', 'Thibitisha namba yako ya simu ya Takeer kabla ya kutuma ombi kwa seller.'));
            return;
        }

        if (!form.seller_phone.trim()) {
            setError(copy('Enter the seller phone number so Takeer can send the order request by SMS.', 'Weka namba ya simu ya muuzaji ili Takeer itume ombi la oda kwa SMS.'));
            return;
        }

        if (!form.seller_contact_attested) {
            setError(copy('Confirm that this phone number belongs to the seller before continuing.', 'Thibitisha kuwa namba hii ni ya muuzaji kabla ya kuendelea.'));
            return;
        }

        const deliveryAddress = selectedAddress
            ? formatAddress(selectedAddress)
            : form.delivery_address.trim();

        if (isAuthenticated && !deliveryAddress) {
            setError(copy('Choose a saved delivery address or enter the exact delivery address.', 'Chagua anuani ya delivery uliyohifadhi au andika anuani kamili ya delivery.'));
            return;
        }

        setBusy(true);
        try {
            const payload = new FormData();
            const requestData = {
                original_url: url,
                idempotency_key: `social-${crypto.randomUUID()}`,
                requested_quantity: Number(form.requested_quantity),
                user_address_id: selectedAddress?.id || null,
                delivery_address: deliveryAddress || null,
                delivery_context: buildDeliveryContext(selectedAddress, deliveryAddress),
                ...form,
            };

            Object.entries(requestData).forEach(([key, value]) => {
                if (value === null || value === undefined || value === '') return;
                if (key === 'delivery_context' && typeof value === 'object') {
                    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                        if (nestedValue !== null && nestedValue !== undefined && nestedValue !== '') {
                            payload.append(`delivery_context[${nestedKey}]`, String(nestedValue));
                        }
                    });
                    return;
                }
                payload.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
            });
            if (buyerScreenshot) payload.append('buyer_screenshot', buyerScreenshot);

            const response = await axios.post('/api/social-commerce/requests', payload);
            setRequest(response.data.request?.data || response.data.request);
            setSellerMatch(response.data.seller_match || null);
            setStep('track');
        } catch (exception) {
            setError(exception.response?.data?.message || Object.values(exception.response?.data?.errors || {})?.flat()?.[0] || copy('Verify your phone and try again.', 'Thibitisha namba yako ya simu kisha jaribu tena.'));
        } finally {
            setBusy(false);
        }
    }

    async function inviteSeller(event) {
        event.preventDefault();
        setInviteError('');
        setInviteBusy(true);
        try {
            const response = await axios.post(`/api/social-commerce/requests/${request.public_id}/invitations`, { channel: 'copy' });
            const claimUrl = response.data.short_claim_url || response.data.claim_url;
            setInviteUrl(claimUrl);
            setSellerMessage(buildSellerShareMessage(claimUrl));
        } catch (exception) {
            setInviteError(exception.response?.data?.message || Object.values(exception.response?.data?.errors || {})?.flat()?.[0] || copy('The seller invitation could not be created.', 'Mwaliko wa seller haukuweza kutengenezwa.'));
        } finally {
            setInviteBusy(false);
        }
    }

    function buildSellerShareMessage(claimUrl = inviteUrl) {
       const item = [form.buyer_product_note, form.buyer_variant_note].filter(Boolean).join(' · ') || copy('this product', 'bidhaa hii');
        const originalUrl = cleanSocialUrl(url);

        return copy(
            `Hi, I’d like to buy ${item} from your ${detectedPlatform.itemEn}. Please review the original post: ${originalUrl}\nConfirm the product and offer securely on Takeer: ${claimUrl}`,
            `Habari, ningependa kununua ${item} kutoka kwenye ${detectedPlatform.itemSw}. Tafadhali kagua post ya awali: ${originalUrl}\nThibitisha bidhaa na bei kwa ajili ya malipo kupitia Takeer: ${claimUrl}`,
        );
    }

    function sellerShareMessage() {
        return sellerMessage.trim() || buildSellerShareMessage();
    }

    async function copySellerLink() {
        if (!inviteUrl) return;
        await navigator.clipboard?.writeText(sellerShareMessage());
    }

    function openSellerSms() {
        if (!inviteUrl) return;
        const recipient = form.seller_phone.trim();
        window.location.href = `sms:${encodeURIComponent(recipient)}?&body=${encodeURIComponent(sellerShareMessage())}`;
    }

    function openSellerWhatsApp() {
        if (!inviteUrl) return;
        const recipient = form.seller_phone.replace(/\D/g, '');
        window.open(`https://wa.me/${recipient}?text=${encodeURIComponent(sellerShareMessage())}`, '_blank', 'noopener,noreferrer');
    }

    async function shareSellerLink() {
        if (!inviteUrl) return;
        if (navigator.share) {
            await navigator.share({ title: 'Takeer seller request', text: sellerShareMessage(), url: inviteUrl }).catch(() => {});
        } else {
            await copySellerLink();
        }
    }

    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function handleAddressSelect(address) {
        setSelectedAddress(address);
        update('delivery_address', formatAddress(address));
        update('destination_summary', addressSummary(address));
    }

    function handleManualAddressChange(value) {
        setSelectedAddress(null);
        update('delivery_address', value);
    }

    function handleSellerPhoneChange(value) {
        setForm((current) => ({
            ...current,
            seller_phone: value,
            seller_phone_source: 'buyer_entered',
            seller_contact_attested: false,
        }));
        setSelectedPhoneCandidateId(null);
    }

    function choosePhoneCandidate(candidate) {
        setSelectedPhoneCandidateId(candidate.id);
        setForm((current) => ({
            ...current,
            seller_phone: candidate.normalized,
            seller_phone_region: candidate.country_iso2 || '',
            seller_phone_source: 'public_post',
            seller_contact_attested: false,
        }));
    }

    function handleScreenshotChange(event) {
        const file = event.target.files?.[0] || null;
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            setError(copy('Choose a JPG, PNG or WebP screenshot up to 5 MB.', 'Chagua screenshot ya JPG, PNG au WebP yenye ukubwa wa hadi MB 5.'));
            event.target.value = '';
            return;
        }

        setError('');
        setBuyerScreenshot(file);
        setBuyerScreenshotPreview(URL.createObjectURL(file));
    }

    function removeScreenshot() {
        setBuyerScreenshot(null);
        setBuyerScreenshotPreview('');
        if (screenshotInputRef.current) screenshotInputRef.current.value = '';
    }

    if (!enabled || !entryEnabled) {
        return (
            <AppLayout>
                <Head title={`${copy('Buy from online sellers', 'Nunua kwa wauzaji wa mtandaoni')} | Takeer`} />
                <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:py-12">
                    <Card>
                        <CardContent className="flex flex-col items-start gap-4 p-6 sm:p-8">
                            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-700">Takeer</span>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">{copy('Buying from online sellers is temporarily unavailable', 'Ununuzi kwa wauzaji wa mtandaoni haupatikani kwa muda')}</h1>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy('Please try again later. Existing Takeer orders remain available through normal checkout.', 'Tafadhali jaribu tena baadaye. Oda zilizopo za Takeer bado zinapatikana kupitia checkout ya kawaida.')}</p>
                            </div>
                            <Button asChild variant="outline"><Link href="/"><ArrowRight className="mr-2 h-4 w-4" />{copy('Back to Takeer', 'Rudi Takeer')}</Link></Button>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${copy('Buy from online sellers', 'Nunua kwa wauzaji wa mtandaoni')} | Takeer`} />

            <div className="mx-auto max-w-4xl space-y-6 px-4 pb-18 pt-6 sm:pt-10">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Takeer Link Buy</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{copy('Buy safely from online sellers', 'Nunua kwa wauzaji wa mtandaoni')}</h1>
                    </div>
                </div>
                <p className="max-w-3xl text-base font-medium leading-7 text-muted-foreground">{copy('Enter a Takeer product number or paste any public product link from the web. For an external listing, the seller confirms the final Takeer offer before payment starts.', 'Weka namba ya bidhaa ya Takeer au bandika link yoyote ya umma ya bidhaa kutoka mtandaoni. Kwa bidhaa ya nje, muuzaji atathibitisha offer Takeer kabla ya malipo kuanza.')}</p>

                <Card className="overflow-hidden rounded-3xl border-slate-200/90 shadow-xl shadow-slate-900/[0.04]">
                    <CardHeader className="border-b border-slate-200/80 bg-white px-5 py-4 sm:px-8">
                        <div className="flex items-center gap-3 sm:gap-5">
                            <StepIndicator index="1" active={step === 'link'} complete={step !== 'link'} label={copy('Find', 'Tafuta')} />
                            <div className="h-px flex-1 bg-border" />
                            <StepIndicator index="2" active={step === 'details' || step === 'matched'} complete={step === 'track'} label={step === 'matched' ? copy('Product', 'Bidhaa') : copy('Details', 'Maelezo')} />
                            <div className="h-px flex-1 bg-border" />
                            <StepIndicator index="3" active={step === 'track'} label={copy('Track', 'Fuatilia')} />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-5 pb-5 sm:pt-8 sm:pb-8">
                        {step === 'link' && (
                            <div className="space-y-5">
                                <form onSubmit={loadProductCode} className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <div className="rounded-xl bg-brand-100 p-2.5 text-brand-700"><PackageSearch className="h-5 w-5" /></div>
                                        <div>
                                            <h2 className="text-lg font-black tracking-tight text-slate-950">{copy('Enter the seller product number', 'Weka namba ya bidhaa toka kwa muuzaji')}</h2>
                                            <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">{copy('Use the TK code shared by the seller in a live stream, sticker, caption or pinned comment.', 'Weka namba ya bidhaa inayoanza na TK iliyotolewa na muuzaji kwenye live stream, sticker, caption, picha, video au pinned comment.')}</p>
                                        </div>
                                    </div>
                                    <label className="mt-5 block text-sm font-bold" htmlFor="takeer-product-code">{copy('Product number', 'Namba ya bidhaa')}</label>
                                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                        <div className="flex h-12 flex-1 overflow-hidden rounded-xl border border-input bg-background transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                                            <span className="flex items-center border-r border-input bg-slate-100 px-3 font-mono text-base font-black tracking-[0.16em] text-brand-700" aria-hidden="true">TK</span>
                                            <input id="takeer-product-code" value={productCode} onChange={(event) => setProductCode(event.target.value.replace(/\D/g, '').slice(0, 18))} onPaste={(event) => { const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 18); if (digits) { event.preventDefault(); setProductCode(digits); } }} inputMode="numeric" pattern="[0-9]{5,18}" minLength="5" maxLength="18" required placeholder="12345" className="min-w-0 flex-1 border-0 bg-transparent px-3 font-mono text-base font-black tracking-[0.18em] text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground" />
                                        </div>
                                        <Button type="submit" disabled={busy} className="h-12 shrink-0 sm:min-w-36">
                                            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
                                            {copy('Find product', 'Tafuta bidhaa')}
                                        </Button>
                                    </div>
                                </form>

                                <div className="flex items-center gap-3" aria-hidden="true">
                                    <div className="h-px flex-1 bg-slate-200" />
                                    <span className="rounded-full bg-slate-100 px-4 py-1 text-xs font-black uppercase tracking-wider text-slate-500">{copy('OR', 'AU')}</span>
                                    <div className="h-px flex-1 bg-slate-200" />
                                </div>

                                <form onSubmit={loadPreview} className="space-y-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <div className="rounded-xl bg-brand-100 p-2.5 text-brand-700"><Link2 className="h-5 w-5" /></div>
                                        <div>
                                            <h2 className="text-lg font-black tracking-tight text-slate-950">{copy('Enter a product link from the web', 'Weka link ya bidhaa toka mtandaoni')}</h2>
                                            <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">{copy('Paste a public product or listing link from TikTok, Facebook Marketplace, Instagram or any other website.', 'Bandika link ya umma ya bidhaa au tangazo kutoka TikTok, Kupatana, Facebook Marketplace, Instagram au tovuti nyingine yoyote.')}</p>
                                        </div>
                                    </div>
                                    <label className="mt-5 block text-sm font-bold" htmlFor="social-product-link">{copy('Product link', 'Link ya bidhaa')}</label>
                                    <div className="relative mt-2">
                                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input id="social-product-link" value={url} onChange={(event) => setUrl(event.target.value)} type="url" required placeholder="https://tovuti.com/bidhaa/..." className={`${inputClass} h-12 pl-10`} />
                                    </div>
                                    <p className={`mt-2 text-sm font-medium leading-6 ${supported ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                                        {supported ? <><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{copy('Valid web link detected.', 'Link sahihi ya mtandaoni imeonekana.')}</> : copy('Paste any public http:// or https:// product link.', 'Bandika link yoyote ya umma ya bidhaa inayoanza na http:// au https://.')}
                                    </p>
                                    {detectedPlatform.key !== 'other' && <p className="mt-1 text-xs font-bold text-brand-700">{copy(`Source detected: ${detectedPlatform.label}.`, `Chanzo kilichotambuliwa: ${detectedPlatform.label}.`)}</p>}
                                </div>
                                <InfoStrip icon={ShieldCheck} text={copy('No payment starts here. Takeer first confirms the seller offer. You will verify the seller phone before we send an SMS order request.', 'Hulipii chochote kwa sasa hadi oda itakapothibitishiwa. Takeer itathibitisha ofa ya muuzaji kwanza. Utaombwa uthibitishe simu ya muuzaji kabla ya sisi kutuma ombi la oda kwa muuzaki kupitia ujumbe wa maneno(SMS).')} />
                                <Button type="submit" disabled={busy} className="w-full sm:w-auto sm:min-w-36">
                                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                    {busy ? copy('Checking…', 'Inakagua…') : copy('Continue', 'Endelea')}
                                </Button>
                                </form>
                            </div>
                        )}

                        {step === 'details' && (
                            <>
                                <PreviewCard preview={preview} copy={copy} />
                                {!isAuthenticated ? (
                                    <SignInGate copy={copy} onOpen={() => setAuthOpen(true)} onBack={() => setStep('link')} />
                                ) : (
                            <form onSubmit={submitRequest} className="mt-5 space-y-5">
                                {preview?.seller_identity?.handle && (
                                    <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sky-950">
                                        <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm"><AtSign className="h-5 w-5" /></div>
                                        <div>
                                            <p className="text-sm font-black">{copy('Possible seller account found', 'Akaunti inayoweza kuwa ya muuzaji imeonekana')}</p>
                                            <p className="mt-1 text-sm font-bold">@{preview.seller_identity.handle}</p>
                                            <p className="mt-1 text-xs leading-5 text-sky-800">{copy('This handle came from the public link preview. Takeer will compare it with the verified seller phone as more requests arrive.', 'Handle hii imetoka kwenye preview ya link ya umma. Takeer itailinganisha na simu ya muuzaji iliyothibitishwa kadri maombi yanavyoongezeka.')}</p>
                                        </div>
                                    </div>
                                )}
                                <SellerContactSection
                                    copy={copy}
                                    form={form}
                                    phoneCandidates={phoneCandidates}
                                    selectedPhoneCandidateId={selectedPhoneCandidateId}
                                    handleSellerPhoneChange={handleSellerPhoneChange}
                                    choosePhoneCandidate={choosePhoneCandidate}
                                    update={update}
                                />
                                <BuyerEvidenceSection
                                    copy={copy}
                                    file={buyerScreenshot}
                                    previewUrl={buyerScreenshotPreview}
                                    inputRef={screenshotInputRef}
                                    onChange={handleScreenshotChange}
                                    onRemove={removeScreenshot}
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label={copy('What do you want to buy?', 'Unataka kununua nini?')} className="sm:col-span-2">
                                        <input value={form.buyer_product_note} onChange={(event) => update('buyer_product_note', event.target.value)} required className={inputClass} />
                                    </Field>
                                    <Field label={copy('Size, colour, condition or variant', 'Size, rangi, hali au variant')} hint={copy('Optional', 'Si lazima')} className="sm:col-span-2">
                                        <input value={form.buyer_variant_note} onChange={(event) => update('buyer_variant_note', event.target.value)} className={inputClass} />
                                    </Field>
                                    <Field label={copy('Quantity', 'Kiasi')}>
                                        <input value={form.requested_quantity} min="0.001" step="0.001" onChange={(event) => update('requested_quantity', event.target.value)} type="number" required className={inputClass} />
                                    </Field>
                                    <div className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/40 p-4 sm:col-span-2 sm:p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-xl bg-brand-100 p-2 text-brand-700"><MapPin className="h-5 w-5" /></div>
                                            <div>
                                                <p className="text-sm font-black">{copy('Delivery address', 'Anuani ya delivery')} <span className="text-xs font-normal text-destructive">{isAuthenticated ? copy('Required', 'Lazima') : copy('After sign in', 'Baada ya kuingia')}</span></p>
                                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy('Choose a saved address or enter the exact location. This helps the seller estimate delivery accurately.', 'Chagua anuani uliyohifadhi au andika eneo kamili. Hii inamsaidia seller kukadiria delivery kwa usahihi.')}</p>
                                            </div>
                                        </div>
                                        {isAuthenticated ? (
                                            <UserAddressManager mode="select" selectedId={selectedAddress?.id || null} onSelect={handleAddressSelect} />
                                        ) : (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{copy('Sign in to choose a saved Takeer delivery address. You can still preview the social post first.', 'Ingia ili uchague anuani ya delivery ya Takeer uliyohifadhi. Unaweza kuona preview ya post kwanza.')}</div>
                                        )}
                                        <div>
                                            <label className="text-xs font-bold text-muted-foreground" htmlFor="social-delivery-address">{copy('Exact delivery address or landmark', 'Anuani kamili ya delivery au landmark')}</label>
                                            <textarea id="social-delivery-address" value={form.delivery_address} onChange={(event) => handleManualAddressChange(event.target.value)} placeholder={copy('Example: Mbezi Beach, near..., house/office details…', 'Mfano: Mbezi Beach, karibu na..., maelezo ya nyumba/ofisi…')} className={`${textareaClass} mt-2`} required={isAuthenticated && !selectedAddress} />
                                        </div>
                                        {form.destination_summary && <p className="text-xs font-semibold text-brand-700">{copy('Delivery area', 'Eneo la delivery')}: {form.destination_summary}</p>}
                                    </div>
                                </div>
                                {!isPhoneVerified && <InfoStrip icon={ShieldCheck} text={copy('Verify your Takeer phone number before submitting this request.', 'Thibitisha namba yako ya simu ya Takeer kabla ya kutuma ombi hili.')} />}
                                {isPhoneVerified && <InfoStrip icon={ShieldCheck} text={copy('Your verified Takeer account lets us send and track this seller request. External prices and images remain unverified until the seller confirms them.', 'Akaunti yako ya Takeer iliyothibitishwa inatuwezesha kutuma na kufuatilia ombi hili kwa muuzaji. Bei na picha za nje hazijathibitishwa mpaka muuzaji azithibitishe.')} />}
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button type="button" variant="outline" onClick={() => setStep('link')}>{copy('Back', 'Rudi')}</Button>
                                    <Button type="submit" disabled={busy || !isPhoneVerified || !form.seller_phone.trim() || !form.seller_contact_attested} className="sm:min-w-52">
                                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                        {busy ? copy('Submitting…', 'Inatuma…') : copy('Request this product', 'Omba bidhaa hii')}
                                    </Button>
                                </div>
                            </form>
                                )}
                            </>
                        )}

                        {step === 'matched' && matchedProduct?.product && (
                            <div className="space-y-5">
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <div className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm"><CheckCircle2 className="h-5 w-5" /></div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">{matchedProduct.lookup_type === 'code' ? copy(`Product found with code ${matchedProduct.product.code}`, `Bidhaa imepatikana kwa namba ${matchedProduct.product.code}`) : copy('Already available on Takeer', 'Tayari inapatikana Takeer')}</p>
                                            <h2 className="mt-1 text-xl font-black tracking-tight">{matchedProduct.product.title}</h2>
                                            <p className="mt-1 text-sm leading-6 text-emerald-800">
                                                {matchedProduct.lookup_type === 'code' ? copy('Open the product to review its full details and continue with normal checkout.', 'Fungua bidhaa kuona maelezo yake kamili na kuendelea na checkout ya kawaida.') : copy('This web listing is already connected to a Takeer product. Continue directly with the normal product checkout.', 'Tangazo hili la mtandaoni tayari limeunganishwa na bidhaa ya Takeer. Endelea moja kwa moja kwenye checkout ya kawaida ya bidhaa.')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        {matchedProduct.product.image_url && <img src={matchedProduct.product.image_url} alt={matchedProduct.product.title} className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 object-cover" />}
                                        <div>
                                            <p className="text-sm font-black text-slate-950">{matchedProduct.merchant?.display_name || copy('Verified Takeer seller', 'Seller aliyethibitishwa Takeer')}</p>
                                            {matchedProduct.merchant?.username && <p className="mt-1 text-xs font-semibold text-muted-foreground">@{matchedProduct.merchant.username}</p>}
                                        </div>
                                        {matchedProduct.product.price !== null && matchedProduct.product.price !== undefined && <p className="ml-auto shrink-0 font-black text-brand-700">{formatMoney(matchedProduct.product.price)}</p>}
                                    </div>
                                    <a href={matchedProduct.product.tracking_url || matchedProduct.product.url} className="mt-4 block break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-brand-700 hover:underline">
                                        {matchedProduct.product.url}
                                    </a>
                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                        <Button asChild className="sm:flex-1">
                                            <a href={matchedProduct.product.tracking_url || matchedProduct.product.url}>
                                                <ArrowRight className="mr-2 h-4 w-4" />
                                                {copy('Open product checkout', 'Fungua checkout ya bidhaa')}
                                            </a>
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => { setMatchedProduct(null); setStep('link'); }}>
                                            {copy('Find another product', 'Tafuta bidhaa nyingine')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 'track' && (
                            <div className="space-y-5">
                                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                    <div><p className="font-black">{copy('Request created', 'Ombi limetengenezwa')}</p><p className="mt-1 text-sm text-emerald-700">{copy('No payment was taken. The seller must confirm product, price, stock and delivery first.', 'Hakuna malipo yaliyofanyika. Seller lazima athibitishe bidhaa, bei, stock na delivery kwanza.')}</p></div>
                                </div>
                                {sellerMatch && (
                                    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                                        <div>
                                            <p className="font-black">{sellerMatch.merchant?.display_name
                                                ? copy('Takeer recognized this seller account', 'Takeer imetambua akaunti hii ya muuzaji')
                                                : copy('Takeer found a matching seller contact', 'Takeer imepata mawasiliano yanayolingana ya muuzaji')}</p>
                                            <p className="mt-1 text-sm text-emerald-800">@{sellerMatch.handle} · {sellerMatch.merchant?.display_name || copy('same verified handle and phone signal', 'handle na simu iliyothibitishwa vinafanana')}</p>
                                            {sellerMatch.merchant?.display_name && <p className="mt-1 text-xs text-emerald-700">{sellerMatch.merchant.display_name}{sellerMatch.merchant.username ? ` · @${sellerMatch.merchant.username}` : ''}</p>}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-xl font-black">{copy('Invite the seller, then track the offer here.', 'Mwalike muuzaji, kisha fuatilia offer hapa.')}</h2>
                                    <p className="mt-1 text-sm text-muted-foreground">{copy('Create a protected invitation using a channel you control.', 'Tengeneza mwaliko salama ukitumia njia unayoidhibiti.')}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                    <div className="flex items-start gap-3">
                                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-black">{copy('Original social post', 'Post ya awali ya social media')}</p>
                                            <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs font-semibold text-brand-700 hover:underline">{url}</a>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy(`Your message identifies this as a ${detectedPlatform.itemEn} and includes the protected Takeer request link.`, `Ujumbe wako unaonyesha hii ni ${detectedPlatform.itemSw} na una link salama ya ombi la Takeer.`)}</p>
                                        </div>
                                    </div>
                                </div>
                                <Card className="bg-muted/30 shadow-none">
                                    <CardContent className="space-y-4 p-4 sm:p-5">
                                        <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-brand-600" /><p className="text-sm font-black">{copy('Send seller invitation', 'Tuma mwaliko kwa seller')}</p></div>
                                        <form onSubmit={inviteSeller} className="space-y-4">
                                            {!inviteUrl && <Button type="submit" disabled={inviteBusy} className="h-12 w-full rounded-xl">
                                                {inviteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                                                {inviteBusy ? copy('Creating…', 'Inatengeneza…') : copy('Generate secure seller link', 'Tengeneza link salama ya seller')}
                                            </Button>}
                                            {inviteUrl && <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="break-all text-xs text-emerald-800"><p className="font-bold"><Check className="mr-1 inline h-3.5 w-3.5" />{copy('Secure seller link ready', 'Link salama ya seller iko tayari')}</p><p className="mt-1 text-emerald-700/80">{inviteUrl}</p></div><label className="block text-xs font-black text-emerald-950" htmlFor="social-seller-message">{copy('Message you will send', 'Ujumbe utakaotuma')}</label><textarea id="social-seller-message" value={sellerMessage} onChange={(event) => setSellerMessage(event.target.value)} className="min-h-28 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" /><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><ShareAction icon={Clipboard} label={copy('Copy', 'Copy')} onClick={copySellerLink} /><ShareAction icon={MessageCircle} label="SMS" onClick={openSellerSms} /><ShareAction icon={Send} label="WhatsApp" onClick={openSellerWhatsApp} /><ShareAction icon={Share2} label={copy('More', 'Zaidi')} onClick={shareSellerLink} /></div><p className="text-[11px] font-semibold leading-5 text-emerald-800">{copy('You remain the sender. Takeer only prepares the message and secure link; review or edit it before sending.', 'Wewe ndiye mtumaji. Takeer inaandaa ujumbe na link salama tu; kagua au uhariri kabla ya kutuma ila usipunguze wala kuongeza herufi kwenye link zilizowekwa.')}</p></div>}
                                            {inviteError && <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{inviteError}</p>}
                                        </form>
                                    </CardContent>
                                </Card>
                                {request?.public_id && <Button asChild variant="outline" className="w-full"><Link href={`/social-commerce/requests/${request.public_id}`}>{copy('Open request status', 'Fungua hali ya ombi')}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
                            </div>
                        )}
                        {error && <p className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                    </CardContent>
                </Card>
                <InlinePhoneAuth open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={setInlineUser} audience="buyer" />
            </div>
        </AppLayout>
    );
}

function StepIndicator({ index, active, complete, label }) {
    return <span className={`inline-flex items-center gap-2 text-sm font-bold ${active ? 'text-brand-700' : complete ? 'text-emerald-700' : 'text-muted-foreground'}`}><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-brand-600 text-white' : complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-muted-foreground'}`}>{complete ? <Check className="h-3.5 w-3.5" /> : index}</span><span className="hidden sm:inline">{label}</span></span>;
}

function Field({ label, hint, className = '', children }) {
    return <label className={`block space-y-2 ${className}`}><span className="flex items-center gap-2 text-sm font-bold">{label}{hint && <span className="text-xs font-normal text-muted-foreground">({hint})</span>}</span>{children}</label>;
}

function InfoStrip({ icon: Icon, text }) {
    return <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/70 p-3.5 text-sm font-medium leading-6 text-muted-foreground"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />{text}</div>;
}

function RequirementCard({ icon: Icon, title, text }) {
    return <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02]"><div className="rounded-lg bg-slate-100 p-2 text-slate-700"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-950">{title}</p><p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">{text}</p></div></div>;
}

function SignInGate({ copy, onOpen, onBack }) {
    return (
        <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/70 p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 text-brand-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                    <h2 className="text-lg font-black text-slate-950">{copy('Sign in to send this seller request', 'Ingia kutuma ombi hili kwa Muuzaji')}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy('A Takeer account is required so we can send the seller a serious order request and give you a secure place to track the response.', 'Akaunti ya Takeer inahitajika ili tumtumie Muuzaji ombi la oda na kukupa sehemu salama ya kufuatilia majibu na kulipia.')}</p>
                </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button type="button" onClick={onOpen} className="sm:min-w-40"><Smartphone className="mr-2 h-4 w-4" />{copy('Continue with phone', 'Endelea kwa simu')}</Button>
                <Button type="button" variant="outline" onClick={onBack}>{copy('Back', 'Rudi')}</Button>
            </div>
        </div>
    );
}

function ShareAction({ icon: Icon, label, onClick }) {
    return <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-black text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-50"><Icon className="h-4 w-4" />{label}</button>;
}

function SellerContactSection({ copy, form, phoneCandidates, selectedPhoneCandidateId, handleSellerPhoneChange, choosePhoneCandidate, update }) {
    return (
        <section className="space-y-4 rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-brand-100 p-2 text-brand-700"><Smartphone className="h-5 w-5" /></div>
                <div>
                    <p className="text-sm font-black text-slate-950">{copy('Seller phone is required', 'Simu ya muuzaji inahitajika')}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy('Takeer needs the seller’s phone to send the order request by SMS. We may detect it from the post, but you must verify that it belongs to this seller.', 'Takeer inahitaji simu ya muuzaji ili kutuma ombi la oda kwa SMS. Tunaweza kuiona kwenye post, lakini lazima uthibitishe kuwa ni ya muuzaji huyu.')}</p>
                </div>
            </div>
            {phoneCandidates.length > 0 && (
                <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                    <div>
                        <p className="text-sm font-black text-emerald-900">{copy('Possible seller contact found', 'Simu inayoweza kuwa ya muuzaji imepatikana')}</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-800">{phoneCandidates.length === 1
                            ? copy('This number was published in the social post. Check it before confirming SMS.', 'Namba hii iliwekwa kwenye post ya social media. Ikague kabla ya kuthibitisha SMS.')
                            : copy('Several numbers were published. Choose the seller business contact, then check it before confirming SMS.', 'Namba kadhaa ziliwekwa kwenye post. Chagua simu ya biashara ya muuzaji, kisha ikague kabla ya kuthibitisha SMS.')}</p>
                    </div>
                    {phoneCandidates.map((candidate) => (
                        <button
                            key={candidate.id}
                            type="button"
                            onClick={() => choosePhoneCandidate(candidate)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${selectedPhoneCandidateId === candidate.id ? 'border-emerald-600 bg-white shadow-sm' : 'border-emerald-200 bg-white/60 hover:border-emerald-400'}`}
                        >
                            <span>
                                <span className="block text-sm font-black text-foreground">{candidate.display || candidate.normalized}</span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">+{candidate.country_calling_code} · {candidate.country_iso2 || copy('International', 'Kimataifa')}</span>
                            </span>
                            {selectedPhoneCandidateId === candidate.id && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
                        </button>
                    ))}
                </div>
            )}
            <Field label={copy('Seller phone for the order message', 'Simu ya muuzaji kwa ujumbe wa oda')} hint={copy('Required for SMS', 'Lazima kwa SMS')}>
                <input id="social-seller-phone" value={form.seller_phone} onChange={(event) => handleSellerPhoneChange(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" required placeholder={phoneCandidates.length > 0 ? '' : '+255 763 141 335'} aria-describedby="social-seller-phone-help" className={`${inputClass} h-12`} />
                <p id="social-seller-phone-help" className="text-xs leading-5 text-muted-foreground">
                    {form.seller_phone_source === 'public_post'
                        ? copy('Detected from the public post. Verify that it belongs to the seller before we send the order request.', 'Imeonekana kwenye post ya umma. Thibitisha kuwa ni ya muuzaji kabla ya kutuma ombi la oda.')
                        : copy('Enter the seller phone from their bio or post. Takeer will use it to send the protected order request by SMS.', 'Weka simu ya muuzaji kutoka bio au post yake. Takeer itaitumia kutuma ombi salama la oda kwa SMS.')}
                </p>
            </Field>
            {form.seller_phone && <label className="flex items-start gap-2 rounded-xl border border-brand-200 bg-white p-3 text-xs leading-5 text-brand-950"><input type="checkbox" checked={form.seller_contact_attested} onChange={(event) => update('seller_contact_attested', event.target.checked)} required className="mt-0.5 rounded border-input text-brand-600 focus:ring-brand-500" />{copy('I confirm this is the seller’s business phone. I understand Takeer will send this seller an SMS order request.', 'Nathibitisha hii ni simu ya biashara ya muuzaji. Ninaelewa Takeer itamtumia seller huyu ujumbe wa SMS wa ombi la oda.')}</label>}
        </section>
    );
}

function BuyerEvidenceSection({ copy, file, previewUrl, inputRef, onChange, onRemove }) {
    return (
        <section className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm"><ImagePlus className="h-5 w-5" /></div>
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{copy('Show the exact item you want', 'Onyesha bidhaa halisi unayotaka')}</p>
                        <span className="text-xs font-normal text-muted-foreground">({copy('Optional, recommended for carousels', 'Si lazima')})</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy('If the post has multiple images or the preview is incomplete, upload a screenshot showing the exact product. It stays private and helps the seller identify your selection; the seller still confirms the final product.', 'Kama post ina picha nyingi au preview haijakamilika, pakia screenshot inayoonyesha bidhaa halisi uliyochagua. Itabaki ya faragha na itamsaidia muuzaji kutambua chaguo lako; seller bado anathibitisha bidhaa ya mwisho.')}</p>
                </div>
            </div>
            <label htmlFor="social-buyer-screenshot" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sky-300 bg-white px-4 py-3 text-sm font-bold text-sky-800 transition hover:border-sky-500 hover:bg-sky-50">
                <ImagePlus className="h-4 w-4" />
                {file ? copy('Replace screenshot', 'Badilisha screenshot') : copy('Upload selected-item screenshot', 'Pakia screenshot ya bidhaa uliyochagua')}
            </label>
            <input ref={inputRef} id="social-buyer-screenshot" type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} className="sr-only" />
            {file && previewUrl && (
                <div className="relative overflow-hidden rounded-xl border border-sky-200 bg-slate-950 p-2">
                    <img src={previewUrl} alt={copy('Selected product evidence', 'Ushahidi wa bidhaa iliyochaguliwa')} className="max-h-72 w-full object-contain" />
                    <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-xs">
                        <span className="truncate font-semibold text-slate-700">{file.name}</span>
                        <button type="button" onClick={onRemove} className="inline-flex shrink-0 items-center gap-1 font-bold text-destructive hover:underline">
                            <X className="h-3.5 w-3.5" />{copy('Remove', 'Ondoa')}
                        </button>
                    </div>
                </div>
            )}
            <p className="text-[11px] leading-5 text-sky-800">{copy('JPG, PNG or WebP up to 5 MB. This is buyer-provided evidence, not a Takeer verification of the listing.', 'JPG, PNG au WebP hadi MB 5.')}</p>
        </section>
    );
}

function PreviewCard({ preview, copy }) {
    const imageUrl = preview?.preview?.image_url || preview?.preview?.image_urls?.[0] || null;
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => setImageFailed(false), [imageUrl]);

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-muted/40">
            {imageUrl && !imageFailed ? (
                <div className="relative flex w-full items-center justify-center overflow-hidden">
                    <img src={imageUrl} alt={preview?.preview?.title || copy('Social product preview', 'Preview ya bidhaa ya social media')} className="h-full w-full object-contain" loading="lazy" onError={() => setImageFailed(true)} />
                </div>
            ) : (
                <div className="flex min-h-28 items-center justify-center border-b border-border bg-muted/50 px-5 text-center text-xs text-muted-foreground">{copy('The post image is unavailable. Continue with the link and confirm the product with the seller.', 'Picha ya post haipatikani. Endelea na link na thibitisha bidhaa na Muuzaji.')}</div>
            )}
            <div className="p-4">
                <p className="text-xs font-black uppercase tracking-wider text-brand-700">{preview?.provenance === 'public_metadata' ? copy('Unverified public preview', 'Preview ya link haijathibitishwa') : copy('Preview unavailable', 'Preview haipatikani')}</p>
                <p className="mt-2 font-bold">{preview?.preview?.title || copy('Add the product details below', 'Ongeza maelezo ya bidhaa hapa chini')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{preview?.preview?.description || copy('You can continue with a screenshot or manual description.', 'Unaweza kuendelea na screenshot au maelezo ya mkono.')}</p>
            </div>
        </div>
    );
}

function formatAddress(address) {
    if (!address) return '';
    return [address.address_line, address.extra_details].filter(Boolean).join(', ').trim();
}

function addressSummary(address) {
    if (!address) return '';
    return [
        address.city_record?.name || address.cityRecord?.name,
        address.state?.name,
        address.country?.name,
    ].filter(Boolean).join(', ');
}

function buildDeliveryContext(address, deliveryAddress) {
    if (address) {
        return {
            source: 'saved_address',
            address_id: address.id,
            address_line: address.address_line || null,
            extra_details: address.extra_details || null,
            latitude: address.latitude || null,
            longitude: address.longitude || null,
            country_id: address.country_id || address.country?.id || null,
            state_id: address.state_id || address.state?.id || null,
            city_id: address.city_id || address.city_record?.id || null,
        };
    }

    return deliveryAddress ? { source: 'manual', address_line: deliveryAddress } : null;
}

function detectSocialPlatform(value) {
    const fallback = {
        key: 'other',
        label: 'social media',
        itemEn: 'social-media post or listing',
        itemSw: 'post au tangazo la mtandao wa kijamii',
    };

    try {
        const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');

        if (['instagram.com', 'm.instagram.com'].includes(hostname)) {
            return { key: 'instagram', label: 'Instagram', itemEn: 'Instagram post/reel', itemSw: 'post/reel ya Instagram' };
        }
        if (['facebook.com', 'm.facebook.com', 'web.facebook.com'].includes(hostname)) {
            return { key: 'facebook', label: 'Facebook', itemEn: 'Facebook post/listing', itemSw: 'post/tangazo la Facebook' };
        }
        if (['tiktok.com', 'vm.tiktok.com'].includes(hostname)) {
            return { key: 'tiktok', label: 'TikTok', itemEn: 'TikTok video', itemSw: 'video ya TikTok' };
        }
        if (['youtube.com', 'youtu.be'].includes(hostname)) {
            return { key: 'youtube', label: 'YouTube', itemEn: 'YouTube video', itemSw: 'video ya YouTube' };
        }
        if (['x.com', 'twitter.com'].includes(hostname)) {
            return { key: 'x', label: 'X', itemEn: 'post on X', itemSw: 'post ya X' };
        }
        if (['t.me', 'telegram.me', 'telegram.org'].includes(hostname)) {
            return { key: 'telegram', label: 'Telegram', itemEn: 'Telegram post', itemSw: 'post ya Telegram' };
        }
        if (['pinterest.com', 'pin.it'].includes(hostname)) {
            return { key: 'pinterest', label: 'Pinterest', itemEn: 'Pinterest pin', itemSw: 'pin ya Pinterest' };
        }

        return { key: 'web', label: hostname, itemEn: 'online listing', itemSw: 'tangazo la mtandaoni' };
    } catch {
        return fallback;
    }
}

function formatMoney(value) {
    return 'TZS ' + new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function cleanSocialUrl(value) {
    try {
        const parsed = new URL(value);
        [...parsed.searchParams.keys()].forEach((key) => {
            const normalized = key.toLowerCase();
            if (normalized.startsWith('utm_') || ['fbclid', 'igsh', 'igshid', 'mibextid'].includes(normalized)) {
                parsed.searchParams.delete(key);
            }
        });
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return value;
    }
}
