import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import { ArrowLeft, Eye, ShoppingCart, Pencil, Trash2, Package, Boxes, Loader2, MapPin, Link as LinkIcon, FileText, PlayCircle, CalendarClock, Users, Send, CheckCircle2, XCircle, Clock, Save, Sparkles, Upload, ShieldCheck, Copy, Download, QrCode } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import VideoPlayer from '@/Components/VideoPlayer';
import { productPriceLabel, productStockLabel } from '@/lib/productUnits';
import { useLocale } from '@/lib/i18n';

export default function ProductDetails({ merchantUsername, productId }) {
    const { copy } = useLocale();
    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [activeHotspot, setActiveHotspot] = useState(null);
    const [liveEventDashboard, setLiveEventDashboard] = useState(null);
    const [liveEventLoading, setLiveEventLoading] = useState(false);
    const [liveEventSaving, setLiveEventSaving] = useState(false);
    const [liveEventBusyOrder, setLiveEventBusyOrder] = useState(null);
    const [tryOnConfig, setTryOnConfig] = useState(null);
    const [tryOnLoading, setTryOnLoading] = useState(false);
    const [tryOnSaving, setTryOnSaving] = useState(false);
    const [tryOnUploading, setTryOnUploading] = useState(false);
    const [now, setNow] = useState(Date.now());
    const productQrRef = useRef(null);
    const [liveEventForm, setLiveEventForm] = useState({
        live_event_starts_at: '',
        live_event_duration_minutes: '',
        live_event_timezone: '',
        live_event_access_url: '',
        live_event_venue: '',
        live_event_capacity: '',
        live_event_replay_url: '',
        live_event_instructions: '',
    });

    const loadProduct = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/products/${productId}/api`);
            const payload = res.data?.data || res.data;
            setProduct(payload || null);
        } catch (error) {
            toast.error(copy('Failed to load product details.', 'Imeshindikana kupakia taarifa za bidhaa.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProduct();
    }, [productId]);

    const loadTryOn = async () => {
        setTryOnLoading(true);
        try {
            const response = await axios.get(`/merchant/products/${productId}/try-on`);
            setTryOnConfig(response.data || null);
        } catch (error) {
            setTryOnConfig(null);
        } finally {
            setTryOnLoading(false);
        }
    };

    useEffect(() => {
        if (product?.id) loadTryOn();
    }, [product?.id, productId]);

    const updateTryOnEnabled = async (enabled) => {
        setTryOnSaving(true);
        try {
            const response = await axios.patch(`/merchant/products/${productId}/try-on`, { enabled });
            setTryOnConfig((previous) => ({ ...(previous || {}), enabled: Boolean(response.data?.enabled) }));
            toast.success(response.data?.message || copy('Virtual try-on updated.', 'Virtual try-on imesasishwa.'));
            loadProduct();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not update virtual try-on.', 'Imeshindikana kusasisha virtual try-on.'));
        } finally {
            setTryOnSaving(false);
        }
    };

    const uploadTryOnGarment = async (file) => {
        if (!file || !product || product.type !== 'physical') return;
        setTryOnUploading(true);
        try {
            const formData = new FormData();
            formData.append('garment', file);
            const response = await axios.post(`/merchant/products/${productId}/try-on/assets`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', Accept: 'application/json' },
            });
            setTryOnConfig((previous) => ({ ...(previous || {}), assets: [response.data.asset, ...(previous?.assets || [])] }));
            toast.success(copy('Garment image saved. Enable virtual try-on when ready.', 'Picha ya nguo imehifadhiwa. Washa virtual try-on ukiwa tayari.'));
            loadProduct();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not upload the garment image.', 'Imeshindikana kupakia picha ya nguo.'));
        } finally {
            setTryOnUploading(false);
        }
    };

    const removeTryOnGarment = async (assetId) => {
        try {
            await axios.delete(`/merchant/products/${productId}/try-on/assets/${assetId}`);
            setTryOnConfig((previous) => ({ ...(previous || {}), assets: (previous?.assets || []).filter((asset) => asset.id !== assetId) }));
            toast.success(copy('Garment image removed.', 'Picha ya nguo imeondolewa.'));
            loadProduct();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not remove the garment image.', 'Imeshindikana kuondoa picha ya nguo.'));
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(timer);
    }, []);

    const hasVariants = !!product?.has_variants;
    const variants = product?.variants || [];
    const totalVariantStock = useMemo(
        () => variants.reduce((sum, variant) => sum + Number(variant?.inventory_quantity ?? variant?.inventory_count ?? 0), 0),
        [variants]
    );
    const images = product?.images || [];
    const activeImage = images[activeImageIndex] || null;
    const activeImageIsVideo = (activeImage?.media_type || activeImage?.type) === 'video';
    const activeImageHotspots = activeImage?.hotspots || [];
    const isLiveEvent = product?.type === 'digital' && product?.digital_delivery_type === 'live_event';
    const eventStartsAt = product?.live_event?.starts_at ? new Date(product.live_event.starts_at) : null;
    const countdown = useMemo(() => {
        if (!eventStartsAt || Number.isNaN(eventStartsAt.getTime())) return null;
        const diff = eventStartsAt.getTime() - now;
        if (diff <= 0) return 'Started';
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${Math.max(1, minutes)}m`;
    }, [eventStartsAt, now]);
    const attributeChips = useMemo(() => {
        return (product?.category_attribute_values || [])
            .map((entry) => {
                const label = entry?.attribute?.label || entry?.attribute?.key || 'Attribute';
                let value = null;
                if (entry?.value_text !== null && entry?.value_text !== undefined && entry?.value_text !== '') {
                    value = entry.value_text;
                } else if (entry?.value_number !== null && entry?.value_number !== undefined && entry?.value_number !== '') {
                    const unit = entry?.value_json && typeof entry.value_json === 'object' ? entry.value_json.unit : null;
                    value = unit ? `${entry.value_number} ${unit}` : entry.value_number;
                } else if (entry?.value_boolean !== null && entry?.value_boolean !== undefined) {
                    value = entry.value_boolean ? 'Yes' : 'No';
                } else if (Array.isArray(entry?.value_json) && entry.value_json.length > 0) {
                    value = entry.value_json.join(', ');
                } else if (entry?.value_json && typeof entry.value_json === 'object' && entry.value_json.unit) {
                    value = `Unit: ${entry.value_json.unit}`;
                }

                if (value === null || value === undefined || value === '') return null;
                return { key: String(entry.category_attribute_id), label, value: String(value) };
            })
            .filter(Boolean);
    }, [product?.category_attribute_values]);
    const productInfoRows = useMemo(() => {
        if (!product) return [];
        const rows = [
            product?.attributes?.category ? { label: 'Category', value: product.attributes.category } : null,
            product?.attributes?.sub_category ? { label: 'Subcategory', value: product.attributes.sub_category } : null,
            product?.attributes?.brand_name ? { label: 'Brand', value: product.attributes.brand_name } : null,
            product?.attributes?.model_name ? { label: 'Model', value: product.attributes.model_name } : null,
            product?.compare_at_price ? { label: 'Compare Price', value: `TZS ${Number(product.compare_at_price).toLocaleString()}` } : null,
            { label: 'Stock Mode', value: hasVariants ? 'Variant-level stock' : 'Single stock' },
            product?.attributes?.suggested_description ? { label: 'Description', value: product.attributes.suggested_description } : null,
            (product?.type === 'digital' && (product?.url || product?.download_link)) ? { label: 'Delivery / URL', value: product.url || product.download_link } : null,
        ].filter(Boolean);
        return rows;
    }, [product, hasVariants]);

    const fillLiveEventForm = (event) => {
        const startsAt = event?.starts_at ? new Date(event.starts_at) : null;
        const datetimeLocal = startsAt && !Number.isNaN(startsAt.getTime())
            ? new Date(startsAt.getTime() - startsAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            : '';

        setLiveEventForm({
            live_event_starts_at: datetimeLocal,
            live_event_duration_minutes: event?.duration_minutes ? String(event.duration_minutes) : '',
            live_event_timezone: event?.timezone || product?.live_event?.timezone || 'Africa/Dar_es_Salaam',
            live_event_access_url: event?.access_url || product?.live_event?.access_url || '',
            live_event_venue: event?.venue || product?.live_event?.venue || '',
            live_event_capacity: event?.capacity ? String(event.capacity) : '',
            live_event_replay_url: event?.replay_url || product?.live_event?.replay_url || '',
            live_event_instructions: event?.instructions || product?.live_event?.instructions || '',
        });
    };

    const loadLiveEventDashboard = async () => {
        if (!isLiveEvent) return;
        setLiveEventLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/products/${productId}/live-event`);
            setLiveEventDashboard(res.data);
            fillLiveEventForm(res.data?.event);
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Could not load the event dashboard.', 'Imeshindwa kupakia event dashboard.'));
        } finally {
            setLiveEventLoading(false);
        }
    };

    useEffect(() => {
        if (isLiveEvent) {
            fillLiveEventForm(product?.live_event);
            loadLiveEventDashboard();
        } else {
            setLiveEventDashboard(null);
        }
    }, [isLiveEvent, productId, product?.id]);

    const saveLiveEvent = async () => {
        setLiveEventSaving(true);
        try {
            const payload = {
                ...liveEventForm,
                live_event_duration_minutes: Number(liveEventForm.live_event_duration_minutes || 0) || null,
                live_event_capacity: Number(liveEventForm.live_event_capacity || 0) || null,
            };
            const res = await axios.put(`/merchant/${merchantUsername}/products/${productId}/live-event`, payload);
            setLiveEventDashboard(res.data);
            fillLiveEventForm(res.data?.event);
            toast.success(copy('Live event details updated.', 'Taarifa za tukio la moja kwa moja zimesasishwa.'));
            loadProduct();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to save live event.', 'Imeshindikana kuhifadhi tukio la moja kwa moja.'));
        } finally {
            setLiveEventSaving(false);
        }
    };

    const markAttendance = async (orderId, status) => {
        setLiveEventBusyOrder(`${orderId}:${status}`);
        try {
            await axios.post(`/merchant/${merchantUsername}/products/${productId}/live-event/orders/${orderId}/attendance`, { status });
            toast.success(copy('Attendance updated.', 'Mahudhurio yamesasishwa.'));
            loadLiveEventDashboard();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to save attendance.', 'Imeshindikana kuhifadhi mahudhurio.'));
        } finally {
            setLiveEventBusyOrder(null);
        }
    };

    const resendAccess = async (orderId) => {
        setLiveEventBusyOrder(`${orderId}:send`);
        try {
            await axios.post(`/merchant/${merchantUsername}/products/${productId}/live-event/orders/${orderId}/resend-access`);
            toast.success(copy('Access details prepared.', 'Taarifa za ufikiaji zimeandaliwa.'));
            loadLiveEventDashboard();
        } catch (error) {
            toast.error(error?.response?.data?.message || copy('Failed to send access details.', 'Imeshindikana kutuma taarifa za ufikiaji.'));
        } finally {
            setLiveEventBusyOrder(null);
        }
    };

    const stockPerLocation = useMemo(() => {
        if (!product) return [];
        const locMap = {};

        // Aggregate from product-level inventories
        (product.location_inventories || []).forEach(inv => {
            const locId = inv.merchant_location_id;
            const locName = inv.location_name || `Location ${locId}`;
            if (!locMap[locId]) locMap[locId] = { name: locName, quantity: 0 };
            locMap[locId].quantity += Number(inv.quantity_decimal ?? inv.quantity ?? 0);
        });

        // Aggregate from variants
        (product.variants || []).forEach(variant => {
            (variant.location_inventories || []).forEach(inv => {
                const locId = inv.merchant_location_id;
                const locName = inv.location_name || `Location ${locId}`;
                if (!locMap[locId]) locMap[locId] = { name: locName, quantity: 0 };
                locMap[locId].quantity += Number(inv.quantity_decimal ?? inv.quantity ?? 0);
            });
        });

        return Object.values(locMap);
    }, [product]);

    const productPermalink = product ? route('product.show', product.slug || product.id) : '';

    const copyText = async (value, successMessage) => {
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);
            toast.success(successMessage);
        } catch (error) {
            toast.error(copy('Could not copy. Please copy it manually.', 'Imeshindikana kunakili. Tafadhali nakili mwenyewe.'));
        }
    };

    const downloadProductQr = () => {
        const canvas = productQrRef.current;
        if (!canvas) return;

        const download = document.createElement('a');
        const filenameCode = String(product?.product_code || `product-${product?.id}`).toLowerCase();
        download.download = `takeer-${filenameCode}-product-qr.png`;
        download.href = canvas.toDataURL('image/png');
        download.click();
        toast.success(copy('Product QR code downloaded.', 'QR code ya bidhaa imepakuliwa.'));
    };

    const handleDelete = async () => {
        if (!product) return;
        if (!confirm('Urhakika unataka kufuta bidhaa hii?')) return;

        setDeleting(true);
        try {
            await axios.delete(`/merchant/${merchantUsername}/products/${product.id}`);
            toast.success(copy('Product removed.', 'Bidhaa imeondolewa.'));
            router.visit(`/merchant/${merchantUsername}/products`);
        } catch (error) {
            const message = error?.response?.data?.message || 'Imeshindwa kufuta bidhaa.';
            toast.error(message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <AppLayout>
            <Head title={`${product?.title || copy('Product', 'Bidhaa')} | Takeer`} />
            <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => router.visit(`/merchant/${merchantUsername}/products`)}>
                            <ArrowLeft className="h-4 w-4 mr-1" /> {copy('Back to products', 'Rudi kwenye bidhaa')}
                        </Button>
                        {!!product && (
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => router.visit(route('product.show', product.slug || product.id))}
                            >
                            <Eye className="h-4 w-4 mr-1" /> {copy('View', 'Tazama')}
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" onClick={() => router.visit(`/merchant/${merchantUsername}/upload?edit=${productId}`)}>
                            <Pencil className="h-4 w-4 mr-1" /> {copy('Edit', 'Hariri')}
                        </Button>
                        {(Number(product?.purchases_count || 0) === 0) && (
                            <Button variant="outline" className="rounded-xl text-red-600 hover:text-red-700" onClick={handleDelete} disabled={deleting}>
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                                {copy('Delete', 'Futa')}
                            </Button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        <p className="text-sm font-medium">{copy('Loading product...', 'Inapakia bidhaa...')}</p>
                    </div>
                ) : !product ? (
                    <Card><CardContent className="p-6">{copy('Product not found.', 'Bidhaa haijapatikana.')}</CardContent></Card>
                ) : (
                    <>
                        <Card className="overflow-hidden">
                            <CardContent className="p-4 md:p-5 space-y-4">
                                <div className="flex gap-3">
                                    <div className="h-20 w-20 rounded-xl bg-muted overflow-hidden shrink-0">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.title} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h1 className="text-xl font-black leading-tight">{product.title}</h1>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {product.type} · {hasVariants ? 'Ina variants' : 'Bila variants'}
                                        </p>
                                        <p className="text-base font-bold mt-2">TZS {Number(product.price || 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <StatCard icon={Eye} label="Views" value={Number(product.views_count || 0).toLocaleString()} />
                                    <StatCard icon={ShoppingCart} label="Purchases" value={Number(product.purchases_count || 0).toLocaleString()} />
                                    <StatCard
                                        icon={Boxes}
                                        label="Available Stock"
                                        value={productStockLabel(product, stockPerLocation.reduce((sum, loc) => sum + loc.quantity, 0))}
                                    />
                                </div>

                                {Number(product.available_stock || 0) <= 0 && (
                                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                                        {copy('This product is out of stock. Customers cannot check out until you add a quantity greater than 0.', 'Bidhaa imeisha stok. Wateja hawawezi checkout hadi uweke quantity zaidi ya 0.')}
                                    </div>
                                )}

                                <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                                    {copy('A product with orders cannot be deleted. Use Edit to set quantity to 0 if you want to stop selling it.', 'Bidhaa yenye oda haiwezi kufutwa. Tumia Hariri kuweka quantity kuwa 0 kama unataka kuisimamisha kuuza.')}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden border-brand-100">
                            <CardContent className="p-0">
                                <div className="border-b border-brand-100 bg-gradient-to-r from-brand-50 via-white to-sky-50 px-4 py-4 md:px-5">
                                    <p className="flex items-center gap-2 text-sm font-black text-slate-950">
                                        <QrCode className="h-4 w-4 text-brand-600" />
                                        {copy('Share this product', 'Shiriki bidhaa hii')}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {copy('Use the product code in livestreams, videos and images, or share the QR code to open the product page directly.', 'Tumia namba ya bidhaa kwenye livestream, video na picha, au shiriki QR code kufungua ukurasa wa bidhaa moja kwa moja.')}
                                    </p>
                                </div>

                                <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_260px] md:p-5">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-700">
                                                {copy('Product code', 'Namba ya bidhaa')}
                                            </p>
                                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                                                <div className="flex min-h-16 flex-1 items-center rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50 px-4">
                                                    <span className="font-mono text-3xl font-black tracking-[0.16em] text-brand-700 md:text-4xl">
                                                        {product.product_code || copy('Not assigned', 'Haijapewa')}
                                                    </span>
                                                </div>
                                                {product.product_code && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="min-h-12 rounded-xl font-black sm:min-h-16"
                                                        onClick={() => copyText(product.product_code, copy('Product code copied.', 'Namba ya bidhaa imenakiliwa.'))}
                                                    >
                                                        <Copy className="mr-2 h-4 w-4" />
                                                        {copy('Copy code', 'Nakili namba')}
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                                {copy('Customers can enter this code in Takeer. Add it to product photos, videos, pinned comments, or mention it during a live sale.', 'Wateja wanaweza kuingiza namba hii Takeer. Iweke kwenye picha, video, pinned comments, au itaje unapouza live.')}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                {copy('Permanent product link', 'Kiungo cha kudumu cha bidhaa')}
                                            </p>
                                            <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={productPermalink}>{productPermalink}</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-xl"
                                                    onClick={() => copyText(productPermalink, copy('Product link copied.', 'Kiungo cha bidhaa kimenakiliwa.'))}
                                                >
                                                    <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                                                    {copy('Copy link', 'Nakili kiungo')}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="rounded-xl"
                                                    onClick={() => router.visit(productPermalink)}
                                                >
                                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                                    {copy('Open product', 'Fungua bidhaa')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                                        <div className="rounded-2xl border border-slate-100 bg-white p-2">
                                            <QRCodeCanvas
                                                ref={productQrRef}
                                                value={productPermalink}
                                                size={512}
                                                level="H"
                                                includeMargin
                                                className="h-[200px] w-[200px]"
                                            />
                                        </div>
                                        <p className="mt-3 text-xs font-black text-slate-900">
                                            {copy('QR opens the product page', 'QR inafungua ukurasa wa bidhaa')}
                                        </p>
                                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                                            {copy('It contains the permalink—not the product code.', 'Ina permalink—siyo namba ya bidhaa.')}
                                        </p>
                                        <Button
                                            type="button"
                                            className="mt-3 w-full rounded-xl bg-brand-600 font-black text-white hover:bg-brand-700"
                                            onClick={downloadProductQr}
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            {copy('Download QR PNG', 'Pakua QR PNG')}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {isLiveEvent && (
                            <Card>
                                <CardContent className="p-4 md:p-5 space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black flex items-center gap-2">
                                                <CalendarClock className="h-4 w-4 text-brand-600" />
                                                {copy('Live event control', 'Udhibiti wa tukio la moja kwa moja')}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {copy('Manage access, replay, attendees, and check-ins from one place.', 'Simamia ufikiaji, replay, waliohudhuria na kuingia kutoka sehemu moja.')}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-right">
                                            <p className="text-[10px] uppercase tracking-wider font-black text-brand-700">{copy('Starts in', 'Inaanza')}</p>
                                            <p className="text-lg font-black text-brand-700">{countdown || 'TBA'}</p>
                                        </div>
                                    </div>

                                    {liveEventLoading ? (
                                        <div className="py-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" /> {copy('Loading event details...', 'Inapakia taarifa za tukio...')}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <StatCard icon={Users} label="Registered" value={Number(liveEventDashboard?.stats?.registered_seats || 0).toLocaleString()} />
                                                <StatCard icon={CheckCircle2} label="Checked In" value={Number(liveEventDashboard?.stats?.checked_in || 0).toLocaleString()} />
                                                <StatCard icon={Boxes} label="Remaining" value={liveEventDashboard?.stats?.seats_remaining === null || liveEventDashboard?.stats?.seats_remaining === undefined ? copy('Unlimited', 'Bila kikomo') : Number(liveEventDashboard.stats.seats_remaining).toLocaleString()} />
                                                <StatCard icon={ShoppingCart} label="Revenue" value={`TZS ${Number(liveEventDashboard?.stats?.revenue || 0).toLocaleString()}`} />
                                            </div>

                                            <div className="rounded-xl border border-slate-200 p-3 space-y-3">
                                                <div className="grid md:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Start time', 'Muda wa kuanza')}</label>
                                                        <input
                                                            type="datetime-local"
                                                            value={liveEventForm.live_event_starts_at}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_starts_at: e.target.value }))}
                                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Timezone', 'Eneo la muda')}</label>
                                                        <input
                                                            value={liveEventForm.live_event_timezone}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_timezone: e.target.value }))}
                                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Duration (minutes)', 'Muda (dakika)')}</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={liveEventForm.live_event_duration_minutes}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_duration_minutes: e.target.value }))}
                                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Capacity (attendee limit)', 'Uwezo (kikomo cha washiriki)')}</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={liveEventForm.live_event_capacity}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_capacity: e.target.value }))}
                                                            placeholder={copy('Optional', 'Si lazima')}
                                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Private join link', 'Kiungo binafsi cha kujiunga')}</label>
                                                        <input
                                                            value={liveEventForm.live_event_access_url}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_access_url: e.target.value }))}
                                                            placeholder={copy('Zoom, Google Meet, livestream, or webinar link', 'Kiungo cha Zoom, Google Meet, livestream au webinar')}
                                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Venue / access note', 'Eneo / maelezo ya ufikiaji')}</label>
                                                        <input
                                                            value={liveEventForm.live_event_venue}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_venue: e.target.value }))}
                                                            placeholder={copy('Physical location or extra access note', 'Eneo la tukio au maelezo ya ziada ya ufikiaji')}
                                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Replay link', 'Kiungo cha kurudia')}</label>
                                                        <input
                                                            value={liveEventForm.live_event_replay_url}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_replay_url: e.target.value }))}
                                                            placeholder={copy('Add after the event when the replay is ready', 'Ongeza baada ya tukio wakati replay iko tayari')}
                                                            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1">
                                                        <label className="text-[11px] font-black uppercase tracking-wide text-slate-500">{copy('Buyer instructions', 'Maelekezo kwa mnunuzi')}</label>
                                                        <textarea
                                                            value={liveEventForm.live_event_instructions}
                                                            onChange={(e) => setLiveEventForm((prev) => ({ ...prev, live_event_instructions: e.target.value }))}
                                                            rows={3}
                                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end">
                                                    <Button onClick={saveLiveEvent} disabled={liveEventSaving} className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white">
                                                        {liveEventSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                                                        {copy('Save event details', 'Hifadhi taarifa za tukio')}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                                                    <p className="text-sm font-black">{copy('Attendees', 'Washiriki')}</p>
                                                    <span className="text-xs text-muted-foreground">{Number(liveEventDashboard?.attendees?.length || 0).toLocaleString()} orders</span>
                                                </div>
                                                {(liveEventDashboard?.attendees || []).length === 0 ? (
                                                    <p className="p-4 text-sm text-muted-foreground">{copy('No paid attendees yet.', 'Hakuna waliohudhuria waliolipa bado.')}</p>
                                                ) : (
                                                    <div className="divide-y divide-slate-100">
                                                        {liveEventDashboard.attendees.map((attendee) => (
                                                            <div key={attendee.order_id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-black truncate">{attendee.buyer_name || 'Buyer'}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {attendee.buyer_phone || 'No phone'} · Seats {attendee.quantity} · TZS {Number(attendee.total_paid || 0).toLocaleString()}
                                                                    </p>
                                                                    <p className="text-[11px] text-muted-foreground">
                                                                        Status: <span className="font-bold capitalize">{attendee.status}</span>
                                                                        {attendee.access_last_sent_at ? ` · Last sent ${new Date(attendee.access_last_sent_at).toLocaleString()}` : ''}
                                                                    </p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => resendAccess(attendee.order_id)} disabled={!!liveEventBusyOrder}>
                                                                        {liveEventBusyOrder === `${attendee.order_id}:send` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                                                        Send
                                                                    </Button>
                                                                    <Button variant="outline" size="sm" className="rounded-xl text-emerald-700" onClick={() => markAttendance(attendee.order_id, 'present')} disabled={!!liveEventBusyOrder}>
                                                                        {liveEventBusyOrder === `${attendee.order_id}:present` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                        Present
                                                                    </Button>
                                                                    <Button variant="outline" size="sm" className="rounded-xl text-amber-700" onClick={() => markAttendance(attendee.order_id, 'late')} disabled={!!liveEventBusyOrder}>
                                                                        {liveEventBusyOrder === `${attendee.order_id}:late` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                                                                        Late
                                                                    </Button>
                                                                    <Button variant="outline" size="sm" className="rounded-xl text-red-700" onClick={() => markAttendance(attendee.order_id, 'absent')} disabled={!!liveEventBusyOrder}>
                                                                        {liveEventBusyOrder === `${attendee.order_id}:absent` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                                                        Absent
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <p className="text-sm font-bold">{copy('Product info', 'Taarifa za bidhaa')}</p>
                                {productInfoRows.length > 0 ? (
                                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                        {productInfoRows.map((row) => (
                                            <div key={row.label} className={`rounded-xl border border-slate-200 p-2 ${row.label === 'Description' || row.label === 'Delivery / URL' ? 'sm:col-span-2' : ''}`}>
                                                <p className="text-[11px] uppercase tracking-wider text-slate-500">{row.label}</p>
                                                <p className="font-semibold break-words">{row.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{copy('No additional information has been entered for this product.', 'Hakuna taarifa za ziada zilizoingizwa kwa bidhaa hii.')}</p>
                                )}
                                {attributeChips.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{copy('Entered attributes', 'Sifa zilizoingizwa')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {attributeChips.map((chip) => (
                                                <span key={chip.key} className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-xs">
                                                    {chip.label}: {chip.value}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {product.type === 'physical' && (
                            <Card className="border-brand-200">
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="flex items-center gap-2 text-sm font-black">
                                                <Sparkles className="h-4 w-4 text-brand-600" />
                                                {copy('Photo virtual try-on', 'Virtual try-on kwa picha')}
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                {copy('Let shoppers upload a portrait and preview this garment before buying.', 'Waruhusu wateja kupakia portrait na kuona preview ya nguo kabla ya kununua.')}
                                            </p>
                                        </div>
                                        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-black">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(tryOnConfig?.enabled)}
                                                disabled={tryOnLoading || tryOnSaving || !tryOnConfig?.assets?.length}
                                                onChange={(event) => updateTryOnEnabled(event.target.checked)}
                                                className="h-4 w-4 rounded border-input text-brand-600"
                                            />
                                            {tryOnConfig?.enabled ? copy('Enabled', 'Imewashwa') : copy('Off', 'Imezimwa')}
                                        </label>
                                    </div>

                                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs leading-5 text-blue-900">
                                        <p className="flex items-center gap-1.5 font-black"><ShieldCheck className="h-4 w-4" /> {copy('Merchant setup guidance', 'Mwongozo wa kuweka merchant')}</p>
                                        <p className="mt-1">{copy('Use a front-facing transparent PNG of the garment where possible. Photo try-on is an approximation, not a fit guarantee.', 'Tumia PNG yenye background transparent ya nguo ikiwa inawezekana. Photo try-on ni makadirio, si dhamana ya fitting.')}</p>
                                    </div>

                                    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 px-3 text-sm">
                                        <span className="flex items-center gap-2 font-black text-brand-800"><Upload className="h-4 w-4" /> {tryOnUploading ? copy('Uploading garment...', 'Inapakia nguo...') : copy('Upload garment image', 'Pakia picha ya nguo')}</span>
                                        <span className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">PNG/JPG</span>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="sr-only"
                                            disabled={tryOnUploading}
                                            onChange={(event) => {
                                                uploadTryOnGarment(event.target.files?.[0]);
                                                event.target.value = '';
                                            }}
                                        />
                                    </label>

                                    {(tryOnConfig?.assets || []).length > 0 && (
                                        <div className="space-y-2">
                                            {tryOnConfig.assets.filter((asset) => asset.is_active !== false).map((asset) => (
                                                <div key={asset.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                                                    <img src={asset.preview_url} alt={asset.original_name || 'Try-on garment'} className="h-16 w-16 rounded-lg bg-slate-100 object-contain" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs font-black">{asset.original_name || copy('Garment image', 'Picha ya nguo')}</p>
                                                        <p className="mt-1 text-[11px] text-muted-foreground">{asset.variant_name || copy('Product-wide asset', 'Asset ya bidhaa nzima')}</p>
                                                    </div>
                                                    <Button type="button" variant="outline" size="sm" className="rounded-xl text-red-600" onClick={() => removeTryOnGarment(asset.id)}>
                                                        {copy('Remove', 'Ondoa')}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {stockPerLocation.length > 0 && (
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                <p className="text-sm font-bold">{copy('Stock per location', 'Stock kwa eneo')}</p>
                                        <MapPin className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {stockPerLocation.map((loc, idx) => (
                                            <div key={idx} className="py-2.5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-brand-500" />
                                                    <span className="text-sm font-medium text-slate-700">{loc.name}</span>
                                                </div>
                                                <span className={`text-sm font-black ${loc.quantity > 0 ? 'text-slate-900' : 'text-red-500'}`}>
                                                    {productStockLabel(product, loc.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <p className="text-sm font-bold">{copy('Media & hotspots', 'Media na hotspots')}</p>
                                {images.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{copy('No media have been added.', 'Hakuna media zilizowekwa.')}</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {images.map((img, idx) => (
                                            <button
                                                key={`${img.image_url}-${idx}`}
                                                type="button"
                                                className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200"
                                                onClick={() => {
                                                    setActiveImageIndex(idx);
                                                    setActiveHotspot(null);
                                                    setImageModalOpen(true);
                                                }}
                                            >
                                                {(img.media_type || img.type) === 'video' ? (
                                                    <>
                                                        {img.thumbnail_url ? (
                                                            <img src={img.thumbnail_url} alt={`Product ${idx + 1}`} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="h-full w-full bg-slate-900 flex items-center justify-center">
                                                                <PlayCircle className="h-8 w-8 text-white/70" />
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <div className="h-9 w-9 rounded-full bg-black/55 flex items-center justify-center">
                                                                <PlayCircle className="h-5 w-5 text-white" />
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <img src={img.image_url} alt={`Product ${idx + 1}`} className="h-full w-full object-cover" />
                                                )}
                                                {(img.hotspots || []).length > 0 && (
                                                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                                                        <MapPin className="h-3 w-3" /> {(img.hotspots || []).length}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {hasVariants && (
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    <p className="text-sm font-bold">Variants ({variants.length})</p>
                                    <div className="space-y-2">
                                        {variants.map((variant) => (
                                            <div key={variant.id} className="rounded-xl border p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold">{variant.name}</p>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${Number(variant.inventory_count || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {Number(variant.inventory_count || 0) > 0 ? 'Available' : 'Depleted'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {Object.entries(variant.attributes || {}).map(([key, value]) => (
                                                        <span key={`${variant.id}-${key}`} className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-700">
                                                            {key}: {String(value)}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    SKU: {variant.sku || '-'} · Bei: {productPriceLabel(product, variant.price || 0)} · Stock: {productStockLabel(product, variant.inventory_quantity ?? variant.inventory_count)}
                                                </p>
                                                {variant.swatch_image_url && (
                                                    <div className="mt-2">
                                                        <img src={variant.swatch_image_url} alt={variant.name} className="h-10 w-10 rounded border border-slate-200 object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>

            <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{copy('Image & hotspots', 'Picha na hotspots')}</DialogTitle>
                    </DialogHeader>
                    {!activeImage ? (
                        <p className="text-sm text-muted-foreground">{copy('Image not found.', 'Picha haijapatikana.')}</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative overflow-hidden rounded-xl border border-slate-200">
                                {activeImageIsVideo ? (
                                    <VideoPlayer
                                        src={activeImage.image_url || activeImage.url}
                                        processedUrl={activeImage.processed_url}
                                        hlsUrl={activeImage.hls_url}
                                        poster={activeImage.thumbnail_url || undefined}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="w-full max-h-[70vh] object-contain bg-black"
                                    />
                                ) : (
                                    <img src={activeImage.image_url} alt={`Product ${activeImageIndex + 1}`} className="w-full max-h-[70vh] object-contain bg-black/5" />
                                )}
                                {!activeImageIsVideo && activeImageHotspots.map((spot) => (
                                    <button
                                        key={spot.id}
                                        type="button"
                                        className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-brand-600 text-white shadow"
                                        style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                                        onClick={() => setActiveHotspot(spot)}
                                        title={spot.type}
                                    >
                                        <span className="text-[10px] font-bold">+</span>
                                    </button>
                                ))}
                            </div>

                            {activeImageHotspots.length > 0 ? (
                                <div className="grid sm:grid-cols-2 gap-2">
                                    {activeImageHotspots.map((spot, idx) => (
                                        <button
                                            key={`${spot.id}-detail`}
                                            type="button"
                                            className={`text-left rounded-xl border p-2 ${activeHotspot?.id === spot.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
                                            onClick={() => setActiveHotspot(spot)}
                                        >
                                            <p className="text-xs font-bold text-slate-700">Hotspot #{idx + 1}</p>
                                            <p className="text-xs text-slate-600 capitalize">{spot.type}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">{copy('No hotspots on this image.', 'Hakuna hotspots kwenye picha hii.')}</p>
                            )}

                            {activeHotspot && (
                                <div className="rounded-xl border border-slate-200 p-3 space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{copy('Hotspot detail', 'Maelezo ya hotspot')}</p>
                                    <p className="text-sm flex items-center gap-1 text-slate-700 capitalize">
                                        {activeHotspot.type === 'link' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                        {activeHotspot.type}
                                    </p>
                                    <p className="text-sm break-words text-slate-900">{activeHotspot.data || '-'}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function StatCard({ icon: Icon, label, value }) {
    const { copy } = useLocale();
    const translations = {
        Views: 'Mionekano',
        Purchases: 'Manunuzi',
        'Available Stock': 'Stock inayopatikana',
        Registered: 'Waliosajiliwa',
        'Checked In': 'Walioingia',
        Remaining: 'Iliyobaki',
        Revenue: 'Mapato',
    };
    return (
        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center gap-1 text-slate-500 text-xs font-semibold">
                <Icon className="h-3.5 w-3.5" />
                <span>{copy(label, translations[label] || label)}</span>
            </div>
            <p className="mt-1 text-base font-black text-slate-900">{value}</p>
        </div>
    );
}
