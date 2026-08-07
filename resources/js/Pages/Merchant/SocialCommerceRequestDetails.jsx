import React, { useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { ArrowLeft, CheckCircle2, ExternalLink, Image as ImageIcon, Link2, Loader2, MapPin, PackagePlus, Send, ShieldCheck } from 'lucide-react';

const inputClass = 'h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export default function SocialCommerceRequestDetails({ request }) {
    const { copy } = useLocale();
    const initial = request?.data || request;
    const [data, setData] = useState(initial);
    const [productId, setProductId] = useState(initial.product?.id || '');
    const [product, setProduct] = useState({ title: '', price: '', inventory_count: 1 });
    const [offer, setOffer] = useState({ product_id: initial.product?.id || '', quantity: initial.buyer_notes?.quantity || 1, unit_price: '', shipping_fee: 0, delivery_type: 'local_boda' });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    function update(setter, key, value) {
        setter((current) => ({ ...current, [key]: value }));
    }

    function apply(response) {
        setData(response.data?.data || response.data);
        setMessage(copy('Saved successfully.', 'Imehifadhiwa kwa mafanikio.'));
        setError('');
    }

    function fail(exception) {
        setError(exception.response?.data?.message || Object.values(exception.response?.data?.errors || {})?.flat()?.[0] || copy('The request could not be updated.', 'Ombi halikuweza kusasishwa.'));
    }

    async function matchProduct(event) {
        event.preventDefault(); setBusy(true); setMessage('');
        try { apply(await axios.post(`/api/merchant/social-commerce/requests/${data.public_id}/match-product`, { product_id: Number(productId) })); setOffer((current) => ({ ...current, product_id: productId })); } catch (exception) { fail(exception); } finally { setBusy(false); }
    }

    async function createProduct(event) {
        event.preventDefault(); setBusy(true); setMessage('');
        try {
            const response = await axios.post(`/api/merchant/social-commerce/requests/${data.public_id}/create-product`, { ...product, price: Number(product.price), inventory_count: Number(product.inventory_count) });
            apply(response);
            const created = response.data?.data?.product?.id;
            if (created) { setProductId(created); setOffer((current) => ({ ...current, product_id: created, unit_price: product.price })); }
        } catch (exception) { fail(exception); } finally { setBusy(false); }
    }

    async function createOffer(event) {
        event.preventDefault(); setBusy(true); setMessage('');
        try { apply(await axios.post(`/api/merchant/social-commerce/requests/${data.public_id}/offer`, { ...offer, product_id: Number(offer.product_id), quantity: Number(offer.quantity), unit_price: Number(offer.unit_price), shipping_fee: Number(offer.shipping_fee) })); } catch (exception) { fail(exception); } finally { setBusy(false); }
    }

    async function sendOffer() {
        setBusy(true); setMessage('');
        try { apply(await axios.post(`/api/merchant/social-commerce/requests/${data.public_id}/send-offer`)); } catch (exception) { fail(exception); } finally { setBusy(false); }
    }

    return (
        <AppLayout>
            <Head title={`${copy('Social-commerce request', 'Ombi la social commerce')} | Takeer`} />
            <div className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-6 sm:pt-10">
                <Button asChild variant="ghost" className="-ml-3"><Link href="/merchant/social-commerce/requests"><ArrowLeft className="mr-2 h-4 w-4" />{copy('All requests', 'Maombi yote')}</Link></Button>
                <Card>
                    <CardHeader className="border-b border-border/70 bg-brand-50/40"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">{formatStatus(data.status)}</span><span className="text-xs text-muted-foreground">{data.public_id}</span></div><CardTitle className="text-2xl">{data.buyer_notes?.product || data.preview?.snapshot?.title || data.public_id}</CardTitle><CardDescription>{data.destination?.summary || copy('Destination summary unavailable', 'Muhtasari wa destination haupatikani')} · {copy('Quantity', 'Kiasi')} {data.buyer_notes?.quantity || 1}</CardDescription></CardHeader>
                    <CardContent className="space-y-5 p-5 sm:p-7">
                        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                                <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm"><ImageIcon className="h-5 w-5" /></div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-950">{copy('Buyer-selected product evidence', 'Ushahidi wa bidhaa iliyochaguliwa na buyer')}</p>
                                    <p className="mt-1 text-xs leading-5 text-sky-900">{copy('This screenshot helps identify the exact item from a carousel or incomplete preview. It is buyer-provided and is not Takeer verification; confirm the final product with the buyer.', 'Screenshot hii inasaidia kutambua bidhaa halisi kutoka carousel au preview isiyokamilika. Imetolewa na buyer na si uthibitisho wa Takeer; thibitisha bidhaa ya mwisho na buyer.')}</p>
                                </div>
                            </div>
                            {data.buyer_evidence?.screenshot_url && <div className="mt-4 overflow-hidden rounded-xl border border-sky-200 bg-slate-950 p-2"><img src={data.buyer_evidence.screenshot_url} alt={copy('Buyer-selected product', 'Bidhaa iliyochaguliwa na buyer')} className="max-h-[34rem] w-full object-contain" loading="lazy" /></div>}
                            {!data.buyer_evidence?.screenshot_url && <p className="mt-3 rounded-xl bg-white/70 p-3 text-xs text-muted-foreground">{copy('No buyer screenshot was attached. Use the original post and the buyer’s description to identify the item.', 'Hakuna screenshot ya buyer iliyowekwa. Tumia post ya awali na maelezo ya buyer kutambua bidhaa.')}</p>}
                            {data.original_url && <a href={data.original_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex max-w-full items-center gap-2 text-xs font-bold text-brand-700 hover:underline"><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{copy('Open original social post', 'Fungua post ya awali ya social media')}</span></a>}
                        </div>
                        {data.destination?.address && <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 text-sm text-brand-900"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /><div><p className="font-black">{copy('Buyer delivery address', 'Anuani ya delivery ya buyer')}</p><p className="mt-1 whitespace-pre-line leading-6">{[data.destination.address, data.destination.extra_details].filter(Boolean).join(', ')}</p><p className="mt-2 text-xs text-brand-700">{copy('Use this location to prepare the delivery estimate. The buyer still confirms the final offer before payment.', 'Tumia eneo hili kuandaa makadirio ya delivery. Buyer bado anathibitisha offer ya mwisho kabla ya malipo.')}</p></div></div>}
                        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /><span>{copy('Confirm the product, price, stock and delivery details before sending a checkout offer.', 'Thibitisha bidhaa, bei, stock na delivery kabla ya kutuma offer ya checkout.')}</span></div>
                        {message && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}
                        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

                        {['claimed', 'onboarding', 'product_setup'].includes(data.status) && <div className="grid gap-4 lg:grid-cols-2"><Card className="bg-muted/20 shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-brand-600" />{copy('Match existing product', 'Linganisha bidhaa iliyopo')}</CardTitle><CardDescription>{copy('Use a product already in your Takeer catalog.', 'Tumia bidhaa iliyo tayari kwenye catalog yako ya Takeer.')}</CardDescription></CardHeader><CardContent><form onSubmit={matchProduct} className="space-y-3"><input value={productId} onChange={(event) => setProductId(event.target.value)} required type="number" min="1" placeholder={copy('Product ID', 'ID ya bidhaa')} className={inputClass} /><Button disabled={busy} type="submit" className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy('Match product', 'Linganisha bidhaa')}</Button></form></CardContent></Card><Card className="bg-muted/20 shadow-none"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><PackagePlus className="h-4 w-4 text-brand-600" />{copy('Create physical product', 'Tengeneza bidhaa ya physical')}</CardTitle><CardDescription>{copy('Add this social request to your Takeer catalog.', 'Ongeza ombi hili kwenye catalog yako ya Takeer.')}</CardDescription></CardHeader><CardContent><form onSubmit={createProduct} className="space-y-3"><input value={product.title} onChange={(event) => update(setProduct, 'title', event.target.value)} required placeholder={copy('Title', 'Jina la bidhaa')} className={inputClass} /><div className="grid grid-cols-2 gap-2"><input value={product.price} onChange={(event) => update(setProduct, 'price', event.target.value)} required type="number" min="0" placeholder={copy('Price', 'Bei')} className={inputClass} /><input value={product.inventory_count} onChange={(event) => update(setProduct, 'inventory_count', event.target.value)} required type="number" min="0" placeholder={copy('Stock', 'Stock')} className={inputClass} /></div><Button disabled={busy} type="submit" variant="outline" className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy('Create product', 'Tengeneza bidhaa')}</Button></form></CardContent></Card></div>}

                        {['product_setup', 'offer_ready'].includes(data.status) && <Card className="border-emerald-200 bg-emerald-50/40 shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base text-emerald-800">{copy('Seller-confirmed offer', 'Offer iliyothibitishwa na seller')}</CardTitle><CardDescription>{copy('Set the final price and delivery details the buyer will review.', 'Weka bei ya mwisho na maelezo ya delivery ambayo buyer atakagua.')}</CardDescription></CardHeader><CardContent><form onSubmit={createOffer} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><input value={offer.product_id} onChange={(event) => update(setOffer, 'product_id', event.target.value)} required type="number" min="1" placeholder={copy('Product ID', 'ID ya bidhaa')} className={inputClass} /><input value={offer.quantity} onChange={(event) => update(setOffer, 'quantity', event.target.value)} required type="number" min="0.001" step="0.001" placeholder={copy('Quantity', 'Kiasi')} className={inputClass} /><input value={offer.unit_price} onChange={(event) => update(setOffer, 'unit_price', event.target.value)} required type="number" min="0" placeholder={copy('Unit price', 'Bei ya moja')} className={inputClass} /><input value={offer.shipping_fee} onChange={(event) => update(setOffer, 'shipping_fee', event.target.value)} required type="number" min="0" placeholder={copy('Shipping fee', 'Gharama ya delivery')} className={inputClass} /><select value={offer.delivery_type} onChange={(event) => update(setOffer, 'delivery_type', event.target.value)} className={inputClass}><option value="local_boda">{copy('Local delivery', 'Delivery ya ndani')}</option><option value="intercity_bus">{copy('Intercity bus', 'Basi la miji')}</option><option value="self_pickup">{copy('Self pickup', 'Kujichukulia')}</option></select></div><Button disabled={busy} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy('Save offer revision', 'Hifadhi toleo la offer')}</Button></form></CardContent></Card>}
                        {data.status === 'offer_ready' && <Button onClick={sendOffer} disabled={busy} className="w-full sm:h-12 sm:text-base">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{copy('Confirm and send checkout link', 'Thibitisha na tuma link ya checkout')}</Button>}
                        {data.offer && <details className="rounded-2xl border border-border bg-muted/30 p-4"><summary className="cursor-pointer text-sm font-bold text-muted-foreground">{copy('Offer data', 'Data ya offer')}</summary><pre className="mt-3 overflow-auto text-xs text-muted-foreground">{JSON.stringify(data.offer, null, 2)}</pre></details>}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function formatStatus(status) {
    return String(status || '').replaceAll('_', ' ');
}
