import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, ShieldCheck, Store } from 'lucide-react';

const inputClass = 'h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export default function Claim({ invitation, request }) {
    const { copy } = useLocale();
    const data = request?.data || request;
    const [token, setToken] = useState('');
    const [merchantId, setMerchantId] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (value) {
            sessionStorage.setItem(`social-claim:${invitation.public_id}`, value);
            setToken(value);
        }
    }, [invitation.public_id]);

    async function claim() {
        setBusy(true);
        setError('');
        try {
            const value = token || sessionStorage.getItem(`social-claim:${invitation.public_id}`);
            const response = await axios.post(`/api/social-commerce/claims/${invitation.public_id}/accept`, { claim_token: value, merchant_id: merchantId || undefined });
            sessionStorage.removeItem(`social-claim:${invitation.public_id}`);
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.href = `/merchant/social-commerce/requests/${response.data.request?.data?.public_id || response.data.request?.public_id}`;
        } catch (exception) {
            setError(exception.response?.data?.message || Object.values(exception.response?.data?.errors || {})?.flat()?.[0] || copy('Sign in and choose an active merchant profile.', 'Ingia na uchague profile ya biashara iliyo hai.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppLayout hideTabBar>
            <Head title={`${copy('Accept seller request', 'Kubali ombi la seller')} | Takeer`} />
            <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
                <Button asChild variant="ghost" className="-ml-3"><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />{copy('Back to Takeer', 'Rudi Takeer')}</Link></Button>
                <Card className="mt-4">
                    <CardHeader className="border-b border-border/70 bg-brand-50/50">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-700"><Store className="h-4 w-4" />Takeer seller request</div>
                        <CardTitle className="text-2xl">{copy('Accept customer request', 'Kubali ombi la mteja')}</CardTitle>
                        <CardDescription>{copy('Confirm the product and send the buyer a protected Takeer checkout link.', 'Thibitisha bidhaa na mtumie buyer link salama ya checkout ya Takeer.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5 sm:p-7">
                        <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /><span>{copy('Possession of this link does not prove ownership of the external social account. Product, price and delivery are confirmed inside Takeer.', 'Kuwa na link hii hakuthibitishi umiliki wa akaunti ya nje ya kijamii. Bidhaa, bei na delivery vinathibitishwa ndani ya Takeer.')}</span></div>
                        <div className="rounded-2xl border border-border bg-muted/30 p-4"><p className="font-black">{data.preview?.snapshot?.title || data.buyer_notes?.product || copy('Requested product', 'Bidhaa iliyoombwa')}</p><p className="mt-2 text-sm text-muted-foreground">{data.destination?.summary || copy('Destination will be shared as a city/region summary.', 'Destination itashirikiwa kama muhtasari wa jiji/mkoa.')} · {copy('Expires', 'Inaisha')} {new Date(invitation.expires_at).toLocaleString()}</p></div>
                        {data.original_url && <a href={data.original_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-900 hover:border-sky-400"><ExternalLink className="h-5 w-5 shrink-0 text-sky-700" /><span><span className="block font-black">{copy('Open the original social post', 'Fungua post ya awali ya social media')}</span><span className="mt-1 block truncate text-xs text-sky-700">{data.original_url}</span></span></a>}
                        <label className="block space-y-2"><span className="text-sm font-bold">{copy('Merchant profile ID', 'ID ya profile ya biashara')} <span className="font-normal text-muted-foreground">({copy('if you have more than one', 'ikiwa una zaidi ya moja')})</span></span><input value={merchantId} onChange={(event) => setMerchantId(event.target.value)} placeholder={copy('Optional', 'Si lazima')} className={inputClass} /></label>
                        {!token && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{copy('This invitation token is missing or has expired. Open the complete seller link again.', 'Token ya mwaliko haipo au imeisha. Fungua tena link kamili ya muuzaji.')}</p>}
                        <Button onClick={claim} disabled={busy || !token} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? copy('Accepting…', 'Inakubali…') : <><CheckCircle2 className="mr-2 h-4 w-4" />{copy('Accept customer request', 'Kubali ombi la mteja')}</>}</Button>
                        <Button asChild variant="ghost" className="w-full"><Link href="/">{copy('This is not my listing', 'Hii si listing yangu')}</Link></Button>
                        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
