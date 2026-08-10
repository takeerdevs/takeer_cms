import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import InlinePhoneAuth from '@/Components/InlinePhoneAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Loader2, ShieldCheck, Store, UserRound, XCircle } from 'lucide-react';

export default function Claim({ invitation, request }) {
    const { copy } = useLocale();
    const { auth } = usePage().props;
    const data = request?.data || request;
    const [token, setToken] = useState('');
    const [merchantId, setMerchantId] = useState('');
    const [inlineUser, setInlineUser] = useState(null);
    const [authOpen, setAuthOpen] = useState(false);
    const [createdProfile, setCreatedProfile] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const isAuthenticated = Boolean(auth?.user || inlineUser);
    const allProfiles = [createdProfile, ...(auth?.user?.merchant_profiles || [])]
        .filter(Boolean)
        .filter((profile, index, profiles) => profile.access_type !== 'staff' && profiles.findIndex((item) => String(item.id) === String(profile.id)) === index);
    const ownedProfiles = allProfiles.filter(isVerifiedProfile);
    const unverifiedProfiles = allProfiles.filter((profile) => !isVerifiedProfile(profile));
    const verificationProfile = unverifiedProfiles[0] || createdProfile;
    const expiry = getExpiryState(invitation.expires_at);
    const sessionKey = 'social-claim:' + invitation.public_id;

    useEffect(() => {
        const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (value) {
            sessionStorage.setItem(sessionKey, value);
            setToken(value);
        }
    }, [invitation.public_id]);

    useEffect(() => {
        if (!merchantId && ownedProfiles.length > 0) {
            setMerchantId(String(ownedProfiles.find((profile) => profile.is_default)?.id || ownedProfiles[0].id));
        }
    }, [merchantId, ownedProfiles]);

    function authenticated(user) {
        setInlineUser(user);
        router.reload({ only: ['auth'], preserveState: true, preserveScroll: true });
    }

    async function createSellerProfile() {
        setBusy(true);
        setError('');
        try {
            const response = await axios.post('/auth/merchant/ensure-personal');
            setCreatedProfile(response.data.merchant);
            setMerchantId('');
            router.reload({ only: ['auth'], preserveState: true, preserveScroll: true });
        } catch (exception) {
            setError(exception.response?.data?.message || copy('We could not prepare your seller profile.', 'Imeshindikana kuandaa profile yako ya seller.'));
        } finally {
            setBusy(false);
        }
    }

    async function claim() {
        if (!isAuthenticated) {
            setAuthOpen(true);
            return;
        }
        if (!merchantId) {
            setError(copy('Choose a verified seller profile before accepting this request.', 'Chagua profile ya seller iliyothibitishwa kabla ya kukubali ombi hili.'));
            return;
        }
        setBusy(true);
        setError('');
        try {
            const value = token || sessionStorage.getItem(sessionKey);
            const response = await axios.post('/api/social-commerce/claims/' + invitation.public_id + '/accept', {
                claim_token: value,
                merchant_id: merchantId,
            });
            sessionStorage.removeItem(sessionKey);
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.href = '/merchant/social-commerce/requests/' + (response.data.request?.data?.public_id || response.data.request?.public_id);
        } catch (exception) {
            setError(exception.response?.data?.message || Object.values(exception.response?.data?.errors || {})?.flat()?.[0] || copy('Sign in and choose a verified merchant profile.', 'Ingia na uchague profile ya biashara iliyothibitishwa.'));
        } finally {
            setBusy(false);
        }
    }

    async function dismiss() {
        const value = token || sessionStorage.getItem(sessionKey);
        if (!value || !window.confirm(copy('Confirm that this is not your listing. The secure link and retained buyer image will be removed.', 'Thibitisha kuwa hii si listing yako. Link salama na picha ya buyer iliyohifadhiwa vitaondolewa.'))) return;
        setBusy(true);
        setError('');
        try {
            await axios.post('/api/social-commerce/claims/' + invitation.public_id + '/dismiss', { claim_token: value });
            sessionStorage.removeItem(sessionKey);
            window.history.replaceState({}, document.title, window.location.pathname);
            setDismissed(true);
        } catch (exception) {
            setError(exception.response?.data?.message || copy('This request could not be dismissed.', 'Ombi hili halikuweza kuondolewa.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppLayout hideTabBar>
            <Head title={copy('Accept seller request', 'Kubali ombi la seller') + ' | Takeer'} />
            <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
                <Button asChild variant="ghost" className="-ml-3">
                    <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />{copy('Back to Takeer', 'Rudi Takeer')}</Link>
                </Button>
                <Card className="mt-4 overflow-hidden rounded-3xl border-slate-200 shadow-xl shadow-slate-900/[0.05]">
                    <CardHeader className="border-b border-border/70 bg-brand-50/50">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-700"><Store className="h-4 w-4" />Takeer seller request</div>
                        <CardTitle className="text-2xl">{copy('Accept customer request', 'Kubali ombi la mteja')}</CardTitle>
                        <CardDescription>{copy('Confirm the product and send the buyer a protected Takeer checkout link.', 'Thibitisha bidhaa ili mteja atumiwe link salama ya kulipia ya Takeer.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5 sm:p-7">
                        {dismissed ? (
                            <div className="py-10 text-center">
                                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                                <h2 className="mt-4 text-xl font-black">{copy('Request removed', 'Ombi limeondolewa')}</h2>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{copy('The invitation is no longer usable and retained buyer evidence has been deleted.', 'Mwaliko hautatumika tena na picha ya buyer iliyokuwa imehifadhiwa imefutwa.')}</p>
                                <Button asChild variant="outline" className="mt-5"><Link href="/">{copy('Return to Takeer', 'Rudi Takeer')}</Link></Button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                                    <span>{copy('Possession of this link does not prove ownership of the external social account. Product, price and delivery are confirmed inside Takeer.', 'Kuwa na link hii hakuthibitishi umiliki wa akaunti. Bidhaa, bei na delivery vinathibitishwa ndani ya Takeer.')}</span>
                                </div>

                                <div className={'flex items-center gap-3 rounded-2xl border p-3 ' + (expiry.urgent ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700')}>
                                    <Clock3 className={'h-5 w-5 shrink-0 ' + (expiry.urgent ? 'text-amber-700' : 'text-slate-500')} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-black uppercase tracking-wider">{expiry.label}</p>
                                        <p className="mt-0.5 truncate text-sm font-bold">{expiry.value}</p>
                                    </div>
                                </div>

                                {data.original_url && (
                                    <a href={data.original_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-900 hover:border-sky-400">
                                        <ExternalLink className="h-5 w-5 shrink-0 text-sky-700" />
                                        <span className="min-w-0">
                                            <span className="block font-black">{copy('Open the original social post', 'Fungua post ya awali kuhakiki bidhaa ni yako')}</span>
                                            <span className="mt-1 block truncate text-xs text-sky-700">{displaySocialUrl(data.original_url)}</span>
                                        </span>
                                    </a>
                                )}

                                {!isAuthenticated ? (
                                    <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
                                        <div className="flex items-start gap-3">
                                            <SmartphoneIcon />
                                            <div>
                                                <p className="font-black">{copy('Verify your phone without leaving this request', 'Thibitisha simu bila kuondoka kwenye ombi hili')}</p>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy('Your secure invitation is kept on this device while you sign in or create an account.', 'Mwaliko wako salama utabaki kwenye kifaa hiki wakati unaingia au kutengeneza akaunti.')}</p>
                                            </div>
                                        </div>
                                        <Button type="button" onClick={() => setAuthOpen(true)} className="mt-4 w-full">{copy('Continue with phone', 'Endelea kwa simu')}</Button>
                                    </div>
                                ) : ownedProfiles.length > 0 ? (
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-sm font-black">{copy('Which verified seller account should handle this order?', 'Akaunti ipi ya seller iliyothibitishwa ishughulikie oda hii?')}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{copy('Only verified profiles can receive and prepare a buyer request.', 'Profile zilizothibitishwa pekee ndizo zinaweza kupokea na kuandaa ombi la buyer.')}</p>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {ownedProfiles.map((profile) => (
                                                <button key={profile.id} type="button" onClick={() => setMerchantId(String(profile.id))} className={'flex items-center gap-3 rounded-2xl border p-3 text-left transition ' + (String(merchantId) === String(profile.id) ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-200')}>
                                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-orange-500 text-sm font-black text-white">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.display_name || 'S').slice(0, 1).toUpperCase()}</span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-black">{profile.display_name}</span>
                                                        <span className="block truncate text-xs text-muted-foreground">@{profile.username} · {copy('verified', 'imethibitishwa')}</span>
                                                    </span>
                                                    {String(merchantId) === String(profile.id) && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-brand-600" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" />
                                            <div>
                                                <p className="font-black text-orange-950">{unverifiedProfiles.length > 0 ? copy('Verify a seller profile to continue', 'Thibitisha profile ya seller ili kuendelea') : copy('Create a seller profile to continue', 'Tengeneza profile ya seller ili kuendelea')}</p>
                                                <p className="mt-1 text-sm leading-6 text-orange-900/75">{unverifiedProfiles.length > 0 ? copy('Unverified accounts are hidden here for safety. Complete KYC, then return to choose the verified profile.', 'Akaunti ambazo hazijathibitishwa zimefichwa hapa kwa usalama. Kamilisha KYC, kisha rudi uchague profile iliyothibitishwa.') : copy('Prepare a personal seller profile, then complete verification before accepting this request.', 'Andaa personal seller profile, kisha kamilisha uthibitisho kabla ya kukubali ombi hili.')}</p>
                                            </div>
                                        </div>
                                        {verificationProfile?.username ? (
                                            <Button asChild className="mt-4 w-full"><Link href={'/merchant/' + verificationProfile.username + '/verification'}>{copy('Continue verification', 'Endelea na uthibitisho')}</Link></Button>
                                        ) : (
                                            <Button type="button" onClick={createSellerProfile} disabled={busy} className="mt-4 w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy('Prepare personal seller profile', 'Andaa personal seller profile')}</Button>
                                        )}
                                    </div>
                                )}

                                {!token && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{copy('This invitation token is missing or has expired. Open the complete seller link again.', 'Token ya mwaliko haipo au imeisha. Fungua tena link kamili ya muuzaji.')}</p>}
                                <Button onClick={claim} disabled={busy || !token || !merchantId} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? copy('Accepting…', 'Inakubali…') : <><CheckCircle2 className="mr-2 h-4 w-4" />{copy('Accept customer request', 'Kubali ombi la mteja')}</>}</Button>
                                <Button type="button" variant="ghost" onClick={dismiss} disabled={busy || !token} className="w-full text-slate-700 hover:bg-red-50 hover:text-red-700"><XCircle className="mr-2 h-4 w-4" />{copy('This is not my listing', 'Hii si listing yangu')}</Button>
                                {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                            </>
                        )}
                    </CardContent>
                </Card>
                <InlinePhoneAuth open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={authenticated} audience="seller" />
            </div>
        </AppLayout>
    );
}

function isVerifiedProfile(profile) {
    return Boolean(profile?.is_verified) || ['approved', 'verified'].includes(String(profile?.kyc_status || '').toLowerCase());
}

function getExpiryState(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { label: 'Expiry unavailable', value: '—', urgent: true };
    const remaining = date.getTime() - Date.now();
    if (remaining <= 0) return { label: 'Request expired', value: formatDateTime(date), urgent: true };
    const hours = Math.floor(remaining / 3600000);
    if (hours < 24) return { label: 'Expires soon', value: 'In ' + Math.max(1, hours) + 'h · ' + formatDateTime(date), urgent: true };
    return { label: 'Request expires', value: formatDateTime(date), urgent: false };
}

function formatDateTime(value) {
    return new Intl.DateTimeFormat('en-TZ', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
}

function displaySocialUrl(value) {
    try {
        const url = new URL(value);
        ['utm_source', 'utm_medium', 'utm_campaign', 'igsh', 'igshid'].forEach((key) => url.searchParams.delete(key));
        return url.toString();
    } catch {
        return value;
    }
}

function SmartphoneIcon() {
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></span>;
}
