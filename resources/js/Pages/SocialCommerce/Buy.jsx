import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import UserAddressManager from '@/Components/UserAddressManager';
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
    MessageCircle,
    ShieldCheck,
    Sparkles,
    Smartphone,
    X,
} from 'lucide-react';

const inputClass = 'h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';
const textareaClass = 'min-h-24 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export default function Buy({ enabled = true, entryEnabled = true }) {
    const { copy } = useLocale();
    const { auth, geo } = usePage().props;
    const isAuthenticated = Boolean(auth?.user);
    const isPhoneVerified = Boolean(auth?.user?.phone_verified_at);
    const defaultPhoneRegion = String(geo?.country?.iso_alpha2 || '').toUpperCase();
    const [step, setStep] = useState('link');
    const [url, setUrl] = useState('');
    const [preview, setPreview] = useState(null);
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
    const [inviteChannel, setInviteChannel] = useState('share_link');
    const [inviteUrl, setInviteUrl] = useState('');
    const [inviteError, setInviteError] = useState('');
    const [inviteBusy, setInviteBusy] = useState(false);

    useEffect(() => () => {
        if (buyerScreenshotPreview) URL.revokeObjectURL(buyerScreenshotPreview);
    }, [buyerScreenshotPreview]);

    const supported = useMemo(() => /instagram\.com\/(?:p|reel)\/|facebook\.com\/(?:[a-z]{2}(?:_[A-Z]{2})?\/)?(?:marketplace\/item|share)\//i.test(url), [url]);

    async function loadPreview(event) {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
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
        } catch (exception) {
            setError(exception.response?.data?.message || copy('Use a supported Instagram post/reel, Facebook Marketplace item, or Facebook share link.', 'Tumia link ya Instagram post/reel, Facebook Marketplace, au Facebook share inayokubalika.'));
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
            const payload = { channel: inviteChannel };
            if (inviteChannel === 'sms') {
                payload.recipient = form.seller_phone;
                payload.seller_phone_region = form.seller_phone_region || undefined;
                payload.seller_contact_attested = form.seller_contact_attested;
            }
            const response = await axios.post(`/api/social-commerce/requests/${request.public_id}/invitations`, payload);
            const claimUrl = response.data.claim_url;
            setInviteUrl(claimUrl);
            if (inviteChannel === 'copy' && navigator.clipboard) {
                await navigator.clipboard.writeText(`Original social post: ${url}\nProtected Takeer request: ${claimUrl}`);
            }
            if (inviteChannel === 'share_link' && navigator.share) {
                await navigator.share({
                    title: 'Takeer seller request',
                    text: `Original social post: ${url}\nProtected Takeer request: ${claimUrl}`,
                    url: claimUrl,
                }).catch(() => {});
            }
        } catch (exception) {
            setInviteError(exception.response?.data?.message || Object.values(exception.response?.data?.errors || {})?.flat()?.[0] || copy('The seller invitation could not be created.', 'Mwaliko wa seller haukuweza kutengenezwa.'));
        } finally {
            setInviteBusy(false);
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
                <Head title="Buy from social media | Takeer" />
                <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:py-12">
                    <Card>
                        <CardContent className="flex flex-col items-start gap-4 p-6 sm:p-8">
                            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-700">Takeer</span>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight">{copy('Buy from social media is temporarily unavailable', 'Ununuzi kutoka mitandao ya kijamii haupatikani kwa muda')}</h1>
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
            <Head title={`${copy('Buy from social media', 'Nunua kutoka mitandao ya kijamii')} | Takeer`} />

            <div className="mx-auto max-w-4xl space-y-6 px-4 pb-24 pt-6 sm:pt-10">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Takeer Link Buy</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{copy('Buy safely from social media', 'Nunua kwa usalama kutoka mitandao ya kijamii')}</h1>
                    </div>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy('Paste an Instagram post/reel or Facebook Marketplace item. The seller confirms the final Takeer offer before any payment starts.', 'Bandika post/reel ya Instagram au bidhaa ya Facebook Marketplace. Muuzaji atathibitisha offer ya Takeer kabla ya malipo kuanza.')}</p>

                <Card className="overflow-hidden rounded-3xl border-slate-200/90 shadow-xl shadow-slate-900/[0.04]">
                    <CardHeader className="border-b border-slate-200/80 bg-white px-5 py-4 sm:px-8">
                        <div className="flex items-center gap-3 sm:gap-5">
                            <StepIndicator index="1" active={step === 'link'} complete={step !== 'link'} label={copy('Link', 'Link')} />
                            <div className="h-px flex-1 bg-border" />
                            <StepIndicator index="2" active={step === 'details'} complete={step === 'track'} label={copy('Details', 'Maelezo')} />
                            <div className="h-px flex-1 bg-border" />
                            <StepIndicator index="3" active={step === 'track'} label={copy('Track', 'Fuatilia')} />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-5 pb-5 sm:pt-8 sm:pb-8">
                        {step === 'link' && (
                            <form onSubmit={loadPreview} className="space-y-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
                                    <div className="flex items-start gap-3">
                                        <div className="rounded-xl bg-brand-100 p-2.5 text-brand-700"><Link2 className="h-5 w-5" /></div>
                                        <div>
                                            <h2 className="text-lg font-black tracking-tight text-slate-950">{copy('Start with the product link', 'Anza na link ya bidhaa')}</h2>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy('Paste the exact Instagram post/reel or Facebook Marketplace listing you want to buy.', 'Bandika post/reel halisi ya Instagram au tangazo la Facebook Marketplace unalotaka kununua.')}</p>
                                        </div>
                                    </div>
                                    <label className="mt-5 block text-sm font-bold" htmlFor="social-product-link">{copy('Product link', 'Link ya bidhaa')}</label>
                                    <div className="relative mt-2">
                                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <input id="social-product-link" value={url} onChange={(event) => setUrl(event.target.value)} type="url" required placeholder="https://www.instagram.com/p/..." className={`${inputClass} h-12 pl-10`} />
                                    </div>
                                    <p className={`mt-2 text-xs ${supported ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                        {supported ? <><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{copy('Supported link detected.', 'Link inayokubalika imeonekana.')}</> : copy('Supported: Instagram post/reel, Facebook Marketplace item, or Facebook share link.', 'Inayokubalika: Instagram post/reel, Facebook Marketplace item, au Facebook share link.')}
                                    </p>
                                </div>
                                <InfoStrip icon={ShieldCheck} text={copy('No payment starts here. Takeer first confirms the seller offer. You will verify the seller phone before we send an SMS order request.', 'Hulipii chochote kwa sasa hadi oda itakapothibitishiwa. Takeer itathibitisha ofa ya muuzaji kwanza. Utaombwa uthibitishe simu ya muuzaji kabla ya sisi kutuma ombi la oda kwa muuzaki kupitia ujumbe wa maneno(SMS).')} />
                                <Button type="submit" disabled={busy} className="w-full sm:w-auto sm:min-w-36">
                                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                    {busy ? copy('Checking…', 'Inakagua…') : copy('Continue', 'Endelea')}
                                </Button>
                            </form>
                        )}

                        {step === 'details' && (
                            <>
                                <PreviewCard preview={preview} copy={copy} />
                                {!isAuthenticated ? (
                                    <SignInGate copy={copy} onBack={() => setStep('link')} />
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
                                    <h2 className="text-xl font-black">{copy('Invite the seller, then track the offer here.', 'Mwalike seller, kisha fuatilia offer hapa.')}</h2>
                                    <p className="mt-1 text-sm text-muted-foreground">{copy('Create a protected invitation using a channel you control.', 'Tengeneza mwaliko salama ukitumia njia unayoidhibiti.')}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                    <div className="flex items-start gap-3">
                                        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-black">{copy('Original social post', 'Post ya awali ya social media')}</p>
                                            <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs font-semibold text-brand-700 hover:underline">{url}</a>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy('The seller receives this original post together with the protected Takeer request link.', 'Seller atapokea post hii ya awali pamoja na link salama ya ombi la Takeer.')}</p>
                                        </div>
                                    </div>
                                </div>
                                <Card className="bg-muted/30 shadow-none">
                                    <CardContent className="space-y-4 p-4 sm:p-5">
                                        <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-brand-600" /><p className="text-sm font-black">{copy('Send seller invitation', 'Tuma mwaliko kwa seller')}</p></div>
                                        <form onSubmit={inviteSeller} className="space-y-4">
                                            <div className="grid grid-cols-3 gap-2">
                                                {[["share_link", "Share", Smartphone], ["copy", "Copy", Clipboard], ["sms", "SMS", MessageCircle]].map(([value, label, Icon]) => (
                                                    <button key={value} type="button" onClick={() => setInviteChannel(value)} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${inviteChannel === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                        <Icon className="h-3.5 w-3.5" />{copy(label, label)}
                                                    </button>
                                                ))}
                                            </div>
                                            {inviteChannel === 'sms' && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{copy('SMS uses the seller business contact you confirmed on the previous step.', 'SMS itatumia simu ya biashara ya muuzaji uliyothibitisha awali.')}</p>}
                                            <Button type="submit" disabled={inviteBusy || (inviteChannel === 'sms' && (!form.seller_phone || !form.seller_contact_attested))} className="w-full">
                                                {inviteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                                                {inviteBusy ? copy('Sending…', 'Inatuma…') : copy('Create protected invitation', 'Tengeneza mwaliko salama')}
                                            </Button>
                                            {inviteUrl && <div className="break-all rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><p className="font-bold"><Check className="mr-1 inline h-3.5 w-3.5" />{copy('Protected seller link ready', 'Link salama ya muuzaji iko tayari')}</p><p className="mt-1 text-muted-foreground">{inviteUrl}</p></div>}
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
            </div>
        </AppLayout>
    );
}

function StepIndicator({ index, active, complete, label }) {
    return <span className={`inline-flex items-center gap-2 text-xs font-bold ${active ? 'text-brand-700' : complete ? 'text-emerald-700' : 'text-muted-foreground'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${active ? 'bg-brand-600 text-white' : complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-muted-foreground'}`}>{complete ? <Check className="h-3.5 w-3.5" /> : index}</span><span className="hidden sm:inline">{label}</span></span>;
}

function Field({ label, hint, className = '', children }) {
    return <label className={`block space-y-2 ${className}`}><span className="flex items-center gap-2 text-sm font-bold">{label}{hint && <span className="text-xs font-normal text-muted-foreground">({hint})</span>}</span>{children}</label>;
}

function InfoStrip({ icon: Icon, text }) {
    return <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{text}</div>;
}

function RequirementCard({ icon: Icon, title, text }) {
    return <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02]"><div className="rounded-lg bg-slate-100 p-2 text-slate-700"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-bold text-slate-950">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>;
}

function SignInGate({ copy, onBack }) {
    return (
        <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/70 p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2.5 text-brand-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                    <h2 className="text-lg font-black text-slate-950">{copy('Sign in to send this seller request', 'Ingia kutuma ombi hili kwa seller')}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy('A Takeer account is required so we can send the seller a serious order request and give you a secure place to track the response.', 'Akaunti ya Takeer inahitajika ili tumtumie seller ombi la oda lenye uzito na kukupa sehemu salama ya kufuatilia majibu.')}</p>
                </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button asChild className="sm:min-w-40"><Link href="/login"><ArrowRight className="mr-2 h-4 w-4" />{copy('Sign in or register', 'Ingia au jisajili')}</Link></Button>
                <Button type="button" variant="outline" onClick={onBack}>{copy('Back', 'Rudi')}</Button>
            </div>
        </div>
    );
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
                <div className="flex min-h-28 items-center justify-center border-b border-border bg-muted/50 px-5 text-center text-xs text-muted-foreground">{copy('The post image is unavailable. Continue with the link and confirm the product with the seller.', 'Picha ya post haipatikani. Endelea na link na thibitisha bidhaa na seller.')}</div>
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
