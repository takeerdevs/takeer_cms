import React, { useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { ArrowLeft, CheckCircle2, Loader2, MapPin, ShieldCheck } from 'lucide-react';

const textareaClass = 'min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export default function Offer({ request }) {
    const { copy } = useLocale();
    const data = request?.data || request;
    const offer = data.offer || {};
    const [address, setAddress] = useState('');
    const [terms, setTerms] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function accept() {
        setBusy(true);
        setError('');
        try {
            const response = await axios.post(`/api/social-commerce/requests/${data.public_id}/offers/accept`, { idempotency_key: `social-accept-${crypto.randomUUID()}`, accept_terms: terms, physical_address: address });
            window.location.href = `/orders/${response.data.order?.public_id || response.data.order?.id}`;
        } catch (exception) {
            setError(exception.response?.data?.message || Object.values(exception.response?.data?.errors || {})?.flat()?.[0] || copy('This offer could not be converted.', 'Offer hii haikuweza kubadilishwa.'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppLayout>
            <Head title={`${copy('Review offer', 'Kagua offer')} | Takeer`} />
            <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 pt-6 sm:pt-10">
                <Button asChild variant="ghost" className="-ml-3"><Link href={`/social-commerce/requests/${data.public_id}`}><ArrowLeft className="mr-2 h-4 w-4" />{copy('Request status', 'Hali ya ombi')}</Link></Button>
                <Card>
                    <CardHeader className="border-b border-border/70 bg-emerald-50/50">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700"><CheckCircle2 className="h-4 w-4" />{copy('Seller-confirmed offer', 'Offer iliyothibitishwa na seller')}</div>
                        <CardTitle className="text-2xl">{offer.product_title || copy('Takeer product offer', 'Offer ya bidhaa Takeer')}</CardTitle>
                        <CardDescription>{copy('Review the final details before continuing to secure payment.', 'Kagua maelezo ya mwisho kabla ya kuendelea kwenye malipo salama.')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 p-5 sm:p-7">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Summary label={copy('Quantity', 'Kiasi')} value={offer.quantity} />
                            <Summary label={copy('Unit price', 'Bei ya moja')} value={`${offer.unit_price} ${offer.currency_code}`} />
                            <Summary label={copy('Delivery', 'Delivery')} value={`${offer.shipping_fee} ${offer.currency_code}`} />
                            <Summary label={copy('Total', 'Jumla')} value={`${offer.total} ${offer.currency_code}`} emphasis />
                            <Summary label={copy('Offer expires', 'Offer inaisha')} value={data.offer_expires_at} className="sm:col-span-2" />
                        </div>
                        <label className="block space-y-2"><span className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-brand-600" />{copy('Final delivery address or landmark', 'Anwani ya mwisho ya delivery au alama ya eneo')}</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} required className={textareaClass} /></label>
                        <label className="flex items-start gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5 rounded border-input text-brand-600 focus:ring-brand-500" />{copy('I accept the seller-confirmed offer and Takeer checkout terms.', 'Ninakubali offer iliyothibitishwa na seller pamoja na masharti ya checkout ya Takeer.')}</label>
                        <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{copy('Pay only through Takeer PSP checkout. Takeer does not operate a wallet or unlicensed escrow account.', 'Lipa kupitia Takeer PSP checkout pekee. Takeer haiendeshi wallet au escrow isiyo na leseni.')}</div>
                        <Button onClick={accept} disabled={!terms || !address.trim() || busy} className="w-full sm:h-12 sm:text-base">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? copy('Creating order…', 'Inatengeneza oda…') : copy('Accept offer and continue to payment', 'Kubali offer na endelea kwenye malipo')}</Button>
                        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function Summary({ label, value, emphasis = false, className = '' }) {
    return <div className={`rounded-xl border border-border bg-muted/30 p-3 ${className}`}><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 ${emphasis ? 'text-lg font-black text-brand-700' : 'font-bold text-foreground'}`}>{value || '—'}</p></div>;
}
