import React, { useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import {
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Clipboard,
    ExternalLink,
    Image as ImageIcon,
    Link2,
    Loader2,
    MapPin,
    PackagePlus,
    Search,
    Share2,
    ShieldCheck,
} from 'lucide-react';

const inputClass = 'h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export default function SocialCommerceRequestDetails({ request }) {
    const { copy } = useLocale();
    const initial = request?.data || request;
    const [data, setData] = useState(initial);
    const [selectedProduct, setSelectedProduct] = useState(initial.product || null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [searching, setSearching] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    function requestUrl(path) {
        return '/api/merchant/social-commerce/requests/' + encodeURIComponent(data.public_id) + path;
    }

    function apply(response, successMessage = copy('Saved successfully.', 'Imehifadhiwa kwa mafanikio.')) {
        const next = response.data?.data || response.data;
        setData(next);
        if (next.product) {
            setSelectedProduct((current) => ({ ...current, ...next.product }));
        }
        setMessage(successMessage);
        setError('');
    }

    function fail(exception) {
        setError(
            exception.response?.data?.message
            || Object.values(exception.response?.data?.errors || {})?.flat()?.[0]
            || copy('The request could not be updated.', 'Ombi halikuweza kusasishwa.'),
        );
    }

    async function searchProducts(event) {
        event?.preventDefault();
        setSearching(true);
        setError('');
        try {
            const response = await axios.get(requestUrl('/products'), { params: { q: query.trim() } });
            setProducts(response.data?.data || []);
        } catch (exception) {
            fail(exception);
        } finally {
            setSearching(false);
        }
    }

    async function openProductSearch() {
        setSearchOpen(true);
        if (products.length === 0) {
            await searchProducts();
        }
    }

    async function matchProduct(candidate) {
        setBusy(true);
        setMessage('');
        setError('');
        try {
            const response = await axios.post(requestUrl('/match-product'), { product_id: Number(candidate.id) });
            apply(response, copy('Product linked and ready to share.', 'Bidhaa imeunganishwa na iko tayari kushirikishwa.'));
            setSearchOpen(false);
        } catch (exception) {
            fail(exception);
        } finally {
            setBusy(false);
        }
    }

    function canonicalProductUrl(product = selectedProduct || data.product) {
        return data.product_url || product?.url || (product?.slug ? `/product/${product.slug}` : '');
    }

    function absoluteUrl(value) {
        if (!value || typeof window === 'undefined') return value;
        try {
            return new URL(value, window.location.origin).toString();
        } catch {
            return value;
        }
    }

    function productShareMessage() {
        const product = selectedProduct || data.product;
        const productUrl = absoluteUrl(canonicalProductUrl(product));
        return copy(
            `Hi, I have connected ${product?.title || 'this product'} to Takeer. Review the product and continue with secure checkout here: ${productUrl}`,
            `Habari, nimeunganisha ${product?.title || 'bidhaa hii'} na Takeer. Kagua bidhaa na endelea na checkout hapa: ${productUrl}`,
        );
    }

    async function copyProductMessage() {
        const productUrl = canonicalProductUrl();
        if (!productUrl) return;
        await navigator.clipboard?.writeText(productShareMessage());
        setMessage(copy('Product message copied. You can send it in any social app.', 'Ujumbe wa bidhaa umenakiliwa. Unaweza kuutuma kwenye app yoyote ya kijamii.'));
    }

    async function shareProductMessage() {
        const productUrl = canonicalProductUrl();
        if (!productUrl) return;
        if (navigator.share) {
            await navigator.share({
                title: selectedProduct?.title || data.product?.title || 'Takeer product',
                text: productShareMessage(),
                url: absoluteUrl(productUrl),
            }).catch(() => {});
        } else {
            await copyProductMessage();
        }
    }

    const productSetup = ['claimed', 'product_setup', 'offer_ready'].includes(data.status);
    const canConfigure = data.status !== 'onboarding' && data.seller?.eligible_to_sell !== false;
    const sellerUploadUrl = data.seller?.username
        ? '/merchant/' + encodeURIComponent(data.seller.username) + '/upload?social_request=' + encodeURIComponent(data.public_id)
        : null;
    const deliveryDetails = [data.destination?.address, data.destination?.extra_details].filter(Boolean).join(', ');
    const deliveryMapUrl = googleMapsUrl(data.destination, deliveryDetails);
    const linkedProduct = selectedProduct || data.product;
    const linkedProductUrl = canonicalProductUrl(linkedProduct);

    return (
        <AppLayout>
            <Head title={copy('Social-commerce request', 'Ombi la social commerce') + ' | Takeer'} />
            <div className="mx-auto max-w-4xl space-y-5 px-4 pb-24 pt-6 sm:pt-10">
                <Button asChild variant="ghost" className="-ml-3">
                    <Link href="/merchant/social-commerce/requests">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {copy('All requests', 'Maombi yote')}
                    </Link>
                </Button>

                <Card className="overflow-hidden">
                    <CardHeader className="border-b border-border/70 bg-brand-50/40">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">
                                {formatStatus(data.status)}
                            </span>
                            <span className="text-xs text-muted-foreground">{data.public_id}</span>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-brand-700">{data.source?.label || data.platform}</span>
                        </div>
                        <CardTitle className="text-2xl">
                            {data.buyer_notes?.product || data.preview?.snapshot?.title || data.public_id}
                        </CardTitle>
                        <CardDescription>
                            {data.destination?.summary || copy('Buyer destination not provided', 'Destination ya buyer haipo')}
                            {' · '}
                            {copy('Quantity', 'Kiasi')} {data.buyer_notes?.quantity || 1}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5 p-5 sm:p-7">
                        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-white p-2 text-sky-700 shadow-sm">
                                    <ExternalLink className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black text-sky-950">
                                        {copy('Check the original online listing', 'Kagua tangazo la awali mtandaoni')}
                                    </p>
                                    <p className="mt-1 text-xs text-sky-900">
                                        {copy('Confirm that the item in the request is yours before linking it to your Takeer product.', 'Thibitisha kuwa bidhaa kwenye ombi ni yako kabla ya kuiunganisha na bidhaa yako ya Takeer.')}
                                    </p>
                                </div>
                                {data.original_url && (
                                    <a href={data.original_url} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-black text-brand-700 shadow-sm hover:bg-brand-50">
                                        {copy('Open post', 'Fungua')}
                                    </a>
                                )}
                            </div>
                        </div>

                        {data.buyer_evidence?.screenshot_url && (
                            <details className="group rounded-2xl border border-border bg-muted/20">
                                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                                    <ImageIcon className="h-5 w-5 shrink-0 text-sky-700" />
                                    <span className="flex-1 text-sm font-black">
                                        {copy('View buyer product screenshot', 'Ona screenshot ya bidhaa ya buyer')}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                                </summary>
                                <div className="border-t border-border p-4">
                                    <img
                                        src={data.buyer_evidence.screenshot_url}
                                        alt={copy('Buyer-selected product', 'Bidhaa iliyochaguliwa na buyer')}
                                        className="max-h-[28rem] w-full rounded-xl bg-slate-950 object-contain"
                                        loading="lazy"
                                    />
                                </div>
                            </details>
                        )}

                        {deliveryDetails && (
                            <details className="group rounded-2xl border border-border bg-white">
                                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                                    <MapPin className="h-5 w-5 shrink-0 text-brand-600" />
                                    <span className="flex-1">
                                        <span className="block text-sm font-black">{copy('Buyer delivery area', 'Eneo la delivery ya buyer')}</span>
                                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                            {data.destination?.summary || copy('Address available', 'Anuani ipo')}
                                        </span>
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                                </summary>
                                <div className="border-t border-border px-4 pb-4 pt-3 text-sm text-muted-foreground">
                                    <a
                                        href={deliveryMapUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group block rounded-xl border border-brand-100 bg-brand-50/40 p-3 transition hover:border-brand-300 hover:bg-brand-50"
                                    >
                                        <span className="flex items-start justify-between gap-3">
                                            <span className="break-words text-sm text-foreground">{deliveryDetails}</span>
                                            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 transition group-hover:translate-x-0.5" />
                                        </span>
                                        <span className="mt-2 block text-xs font-bold text-brand-700 group-hover:underline">
                                            {copy('Open in Google Maps', 'Fungua kwenye Google Maps')}
                                        </span>
                                    </a>
                                    <p className="mt-2 text-xs">
                                        {copy('Use this only to prepare delivery. The buyer confirms the final offer before payment.', 'Tumia hii kuandaa delivery tu. Buyer anathibitisha offer ya mwisho kabla ya malipo.')}
                                    </p>
                                </div>
                            </details>
                        )}

                        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                            <span>{copy('Once you link a product, the buyer uses its normal Takeer product page and checkout. No separate offer is needed.', 'Ukiunganisha bidhaa, Mteja atatumia ukurasa na checkout ya Takeer. Hakuna offer tofauti inayohitajika.')}</span>
                        </div>

                        {data.status === 'onboarding' || !canConfigure ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                                    <div>
                                        <p className="font-black text-amber-950">{copy('Finish seller verification first', 'Kamilisha uthibitisho wa seller kwanza')}</p>
                                        <p className="mt-1 text-sm leading-6 text-amber-900/80">
                                            {copy('This request is saved safely. Complete KYC for this seller profile, then return here to link a product and share its normal Takeer checkout link.', 'Ombi hili limehifadhiwa salama. Kamilisha KYC ya profile hii, kisha rudi hapa kuunganisha bidhaa na kushirikisha link ya checkout ya kawaida ya Takeer.')}
                                        </p>
                                    </div>
                                </div>
                                {data.seller?.username && (
                                    <Button asChild className="mt-4">
                                        <Link href={'/merchant/' + data.seller.username + '/kyc'}>
                                            {copy('Continue verification', 'Endelea na uthibitisho')}
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                {productSetup && (
                                    <Card className="border-brand-100 bg-brand-50/20 shadow-none">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <Link2 className="h-5 w-5 text-brand-600" />
                                                {copy('Choose the Takeer product', 'Chagua bidhaa ya Takeer')}
                                            </CardTitle>
                                            <CardDescription>
                                                {copy('Link an existing product or create one in the normal product form.', 'Unganisha bidhaa iliyopo au tengeneza mpya kwenye fomu ya kawaida.')}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {selectedProduct ? (
                                                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate font-black text-emerald-950">{selectedProduct.title}</p>
                                                        <p className="mt-1 text-xs text-emerald-800">
                                                            {selectedProduct.price !== undefined && selectedProduct.price !== null ? formatMoney(selectedProduct.price) : copy('Product linked', 'Bidhaa imeunganishwa')}
                                                        </p>
                                                    </div>
                                                    <Button type="button" variant="outline" size="sm" onClick={openProductSearch}>
                                                        {copy('Change', 'Badilisha')}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    <Button type="button" variant="outline" className="h-auto justify-start rounded-2xl p-4 text-left" onClick={openProductSearch}>
                                                        <Search className="mr-3 h-5 w-5 shrink-0 text-brand-600" />
                                                        <span>
                                                            <span className="block font-black">{copy('Find existing product', 'Tafuta bidhaa iliyopo')}</span>
                                                            <span className="mt-1 block text-xs font-normal text-muted-foreground">{copy('Search your catalog', 'Tafuta kwenye catalog')}</span>
                                                        </span>
                                                    </Button>
                                                    {sellerUploadUrl && (
                                                        <Button asChild className="h-auto justify-start rounded-2xl p-4 text-left">
                                                            <Link href={sellerUploadUrl}>
                                                                <PackagePlus className="mr-3 h-5 w-5 shrink-0" />
                                                                <span>
                                                                    <span className="block font-black">{copy('Create product', 'Tengeneza bidhaa')}</span>
                                                                    <span className="mt-1 block text-xs font-normal text-white/80">{copy('Use the full product form', 'Tumia fomu kamili ya bidhaa')}</span>
                                                                </span>
                                                            </Link>
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                            {searchOpen && (
                                                <div className="rounded-2xl border border-border bg-white p-3">
                                                    <form onSubmit={searchProducts} className="flex gap-2">
                                                        <input
                                                            value={query}
                                                            onChange={(event) => setQuery(event.target.value)}
                                                            placeholder={copy('Search product name', 'Tafuta jina la bidhaa')}
                                                            className={inputClass}
                                                            autoFocus
                                                        />
                                                        <Button type="submit" variant="outline" disabled={searching}>
                                                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                                        </Button>
                                                    </form>
                                                    <div className="mt-3 space-y-2">
                                                        {products.map((candidate) => (
                                                            <button
                                                                key={candidate.id}
                                                                type="button"
                                                                onClick={() => matchProduct(candidate)}
                                                                disabled={busy}
                                                                className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
                                                            >
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block truncate text-sm font-black">{candidate.title}</span>
                                                                    <span className="mt-1 block text-xs text-muted-foreground">
                                                                        {candidate.price !== null ? formatMoney(candidate.price) : copy('No price', 'Hakuna bei')}
                                                                        {' · '}
                                                                        {copy('Stock', 'Stock')} {candidate.inventory_quantity ?? candidate.inventory_count ?? 0}
                                                                    </span>
                                                                </span>
                                                                <Link2 className="h-4 w-4 shrink-0 text-brand-600" />
                                                            </button>
                                                        ))}
                                                        {!searching && products.length === 0 && (
                                                            <p className="py-3 text-center text-sm text-muted-foreground">
                                                                {copy('No matching physical products.', 'Hakuna bidhaa za physical zinazolingana.')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {productSetup && linkedProduct && linkedProductUrl && (
                                    <Card className="border-emerald-200 bg-emerald-50/40 shadow-none">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
                                                <CheckCircle2 className="h-5 w-5" />
                                                {copy('Product link is ready', 'Link ya bidhaa iko tayari')}
                                            </CardTitle>
                                            <CardDescription>
                                                {copy('The buyer will use this product page and Takeer’s normal checkout. Share the message below in the social app where you are chatting.', 'Mnunuzi atatumia ukurasa wa bidhaa uliopo Takeer kukamilisha malipo. Shiriki ujumbe hapa chini aendelee na malipo.')}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                                                <p className="truncate font-black text-emerald-950">{linkedProduct.title}</p>
                                                <a href={absoluteUrl(linkedProductUrl)} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm font-semibold text-brand-700 hover:underline">
                                                    {absoluteUrl(linkedProductUrl)}
                                                </a>
                                            </div>
                                            <textarea readOnly value={productShareMessage()} className={`${inputClass} min-h-28 resize-y py-3`} aria-label={copy('Product sharing message', 'Ujumbe wa kushirikisha bidhaa')} />
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <Button type="button" variant="outline" onClick={copyProductMessage}>
                                                    <Clipboard className="mr-2 h-4 w-4" />
                                                    {copy('Copy message', 'Nakili ujumbe')}
                                                </Button>
                                                <Button type="button" onClick={shareProductMessage}>
                                                    <Share2 className="mr-2 h-4 w-4" />
                                                    {copy('Share product', 'Shiriki bidhaa')}
                                                </Button>
                                            </div>
                                            <Button asChild variant="outline" className="w-full">
                                                <a href={absoluteUrl(linkedProductUrl)} target="_blank" rel="noreferrer">
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    {copy('Open product checkout', 'Fungua checkout ya bidhaa')}
                                                </a>
                                            </Button>
                                            <p className="text-xs leading-5 text-emerald-800">
                                                {copy('Takeer has stored this social-post connection. If another buyer pastes the same post later, Takeer can open this product directly.', 'Takeer imehifadhi uhusiano wa post hii na bidhaa. Buyer mwingine akibandika post hii baadaye, Takeer ataweza kufungua bidhaa hii moja kwa moja.')}
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </>
                        )}

                        {message && (
                            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                                {message}
                            </p>
                        )}
                        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

function formatStatus(status) {
    return String(status || '').replaceAll('_', ' ');
}

function formatMoney(value) {
    return 'TZS ' + new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function googleMapsUrl(destination = {}, fallbackAddress = '') {
    const latitude = Number(destination.latitude);
    const longitude = Number(destination.longitude);
    const hasCoordinates = [destination.latitude, destination.longitude].every((value) => (
        value !== null
        && value !== undefined
        && value !== ''
        && Number.isFinite(Number(value))
    ));

    const query = hasCoordinates
        ? `${latitude},${longitude}`
        : [fallbackAddress, destination.summary].filter(Boolean).join(', ');

    return query
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        : '';
}
