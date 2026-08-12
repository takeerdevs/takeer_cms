import React, { useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ExternalLink, Image as ImageIcon, Loader2, XCircle } from 'lucide-react';

const stages = ['awaiting_seller', 'claimed', 'product_setup', 'offer_ready', 'converted'];

export default function RequestStatus({ request }) {
    const { copy } = useLocale();
    const data = request?.data || request;
    const [cancelling, setCancelling] = useState(false);

    async function cancel() {
        if (!window.confirm(copy('Cancel this request?', 'Unaghairi ombi hili?'))) return;
        setCancelling(true);
        try {
            await axios.post(`/api/social-commerce/requests/${data.public_id}/cancel`);
            window.location.reload();
        } finally {
            setCancelling(false);
        }
    }

    const currentIndex = stages.indexOf(data.status);

    return (
        <AppLayout>
            <Head title={`${copy('Request status', 'Hali ya ombi')} | Takeer`} />
            <div className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-6 sm:pt-10">
                <Button asChild variant="ghost" className="-ml-3"><Link href="/buy-from-social-media"><ArrowLeft className="mr-2 h-4 w-4" />{copy('Buy from online sellers', 'Nunua kwa wauzaji wa mtandaoni')}</Link></Button>
                <Card>
                    <CardHeader className="border-b border-border/70 bg-muted/20">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-700"><span className="rounded-full bg-brand-50 px-2.5 py-1">{data.source?.label || data.platform}</span><StatusPill status={data.status} /></div>
                        <CardTitle className="pt-1 text-2xl">{data.buyer_notes?.product || data.preview?.snapshot?.title || copy('Social-commerce request', 'Ombi la ununuzi wa kijamii')}</CardTitle>
                        <CardDescription>{copy('Request', 'Ombi')} {data.public_id} · {formatStatus(data.status)}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 p-5 sm:p-7">
                        <div className="grid gap-3 sm:grid-cols-5">
                            {stages.map((status, index) => {
                                const complete = currentIndex >= 0 && index < currentIndex;
                                const active = status === data.status;
                                return <div key={status} className={`rounded-2xl border p-3 ${active ? 'border-brand-300 bg-brand-50 text-brand-800' : complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-border bg-muted/30 text-muted-foreground'}`}><div className="flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-black">{complete ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><span className="text-xs font-bold leading-4">{formatStatus(status)}</span></div></div>;
                            })}
                        </div>

                        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm"><ImageIcon className="h-5 w-5" /></div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-950">{copy('Your selected product evidence', 'Ushahidi wa bidhaa uliyochagua')}</p>
                                    <p className="mt-1 text-xs leading-5 text-sky-900">{copy('The seller can use this screenshot to identify the exact item in a carousel. The seller still confirms the final product and offer.', 'Seller anaweza kutumia screenshot hii kutambua bidhaa halisi kwenye carousel. Seller bado anathibitisha bidhaa na offer ya mwisho.')}</p>
                                </div>
                            </div>
                            {data.buyer_evidence?.screenshot_url && <div className="mt-4 overflow-hidden rounded-xl border border-sky-200 bg-slate-950 p-2"><img src={data.buyer_evidence.screenshot_url} alt={copy('Selected product evidence', 'Ushahidi wa bidhaa iliyochaguliwa')} className="max-h-[34rem] w-full object-contain" loading="lazy" /></div>}
                            {data.original_url && <a href={data.original_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex max-w-full items-center gap-2 text-xs font-bold text-brand-700 hover:underline"><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{copy('Open original online listing', 'Fungua tangazo la awali mtandaoni')}</span></a>}
                        </div>

                        {data.offer && <Card className="border-emerald-200 bg-emerald-50/60 shadow-none"><CardContent className="space-y-3 p-4 sm:p-5"><div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><p className="font-black">{copy('Seller-confirmed offer', 'Offer iliyothibitishwa na Muuzaji')}</p></div><p className="text-sm text-emerald-900">{data.offer.product_title} · {data.offer.quantity} × {data.offer.unit_price} {data.offer.currency_code} + {data.offer.shipping_fee} {copy('delivery', 'delivery')}</p><Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"><Link href={`/social-commerce/requests/${data.public_id}/offer`}>{copy('Review offer', 'Kagua offer')}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>}

                        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span>{copy('The seller confirms stock, price and delivery before payment begins.', 'Seller anathibitisha stock, bei na delivery kabla ya malipo kuanza.')}</span></div>{['awaiting_seller', 'claimed', 'product_setup', 'offer_ready'].includes(data.status) && <Button variant="outline" size="sm" onClick={cancel} disabled={cancelling} className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/5">{cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy('Cancel request', 'Ghairi ombi')}</Button>}</div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function StatusPill({ status }) {
    return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${status === 'converted' ? 'bg-emerald-100 text-emerald-700' : status === 'blocked' || status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700'}`}>{formatStatus(status)}</span>;
}

function formatStatus(status) {
    return String(status || '').replaceAll('_', ' ');
}
