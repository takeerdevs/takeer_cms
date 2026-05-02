import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/Components/ui/Dialog';
import { ArrowLeft, Eye, ShoppingCart, Pencil, Trash2, Package, Boxes, Loader2, MapPin, Link as LinkIcon, FileText, PlayCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import VideoPlayer from '@/Components/VideoPlayer';

export default function ProductDetails({ merchantUsername, productId }) {
    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [activeHotspot, setActiveHotspot] = useState(null);

    const loadProduct = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/products/${productId}/api`);
            const payload = res.data?.data || res.data;
            setProduct(payload || null);
        } catch (error) {
            toast.error('Imeshindwa kupakia taarifa za bidhaa.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProduct();
    }, [productId]);

    const hasVariants = !!product?.has_variants;
    const variants = product?.variants || [];
    const totalVariantStock = useMemo(
        () => variants.reduce((sum, variant) => sum + Number(variant?.inventory_count || 0), 0),
        [variants]
    );
    const images = product?.images || [];
    const activeImage = images[activeImageIndex] || null;
    const activeImageIsVideo = (activeImage?.media_type || activeImage?.type) === 'video';
    const activeImageHotspots = activeImage?.hotspots || [];
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

    const stockPerLocation = useMemo(() => {
        if (!product) return [];
        const locMap = {};

        // Aggregate from product-level inventories
        (product.location_inventories || []).forEach(inv => {
            const locId = inv.merchant_location_id;
            const locName = inv.location_name || `Location ${locId}`;
            if (!locMap[locId]) locMap[locId] = { name: locName, quantity: 0 };
            locMap[locId].quantity += Number(inv.quantity || 0);
        });

        // Aggregate from variants
        (product.variants || []).forEach(variant => {
            (variant.location_inventories || []).forEach(inv => {
                const locId = inv.merchant_location_id;
                const locName = inv.location_name || `Location ${locId}`;
                if (!locMap[locId]) locMap[locId] = { name: locName, quantity: 0 };
                locMap[locId].quantity += Number(inv.quantity || 0);
            });
        });

        return Object.values(locMap);
    }, [product]);

    const handleDelete = async () => {
        if (!product) return;
        if (!confirm('Urhakika unataka kufuta bidhaa hii?')) return;

        setDeleting(true);
        try {
            await axios.delete(`/merchant/${merchantUsername}/products/${product.id}`);
            toast.success('Bidhaa imeondolewa.');
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
            <Head title={`${product?.title || 'Product'} | Takeer`} />
            <div className="max-w-3xl mx-auto p-4 md:p-8 pb-24 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => router.visit(`/merchant/${merchantUsername}/products`)}>
                            <ArrowLeft className="h-4 w-4 mr-1" /> Rudi Bidhaa
                        </Button>
                        {!!product && (
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => router.visit(route('product.show', product.slug || product.id))}
                            >
                                <Eye className="h-4 w-4 mr-1" /> Ione
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white" onClick={() => router.visit(`/merchant/${merchantUsername}/upload?edit=${productId}`)}>
                            <Pencil className="h-4 w-4 mr-1" /> Hariri
                        </Button>
                        {(Number(product?.purchases_count || 0) === 0) && (
                            <Button variant="outline" className="rounded-xl text-red-600 hover:text-red-700" onClick={handleDelete} disabled={deleting}>
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                                Futa
                            </Button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        <p className="text-sm font-medium">Inapakia bidhaa...</p>
                    </div>
                ) : !product ? (
                    <Card><CardContent className="p-6">Bidhaa haijapatikana.</CardContent></Card>
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
                                        value={stockPerLocation.reduce((sum, loc) => sum + loc.quantity, 0).toLocaleString()}
                                    />
                                </div>

                                {Number(product.available_stock || 0) <= 0 && (
                                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                                        Bidhaa imeisha stok. Wateja hawawezi checkout hadi uweke quantity zaidi ya 0.
                                    </div>
                                )}

                                <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
                                    Bidhaa yenye oda haiwezi kufutwa. Tumia <span className="font-semibold">Hariri</span> kuweka quantity kuwa 0 kama unataka kuisimamisha kuuza.
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <p className="text-sm font-bold">Product Info</p>
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
                                    <p className="text-sm text-muted-foreground">Hakuna taarifa za ziada zilizoingizwa kwa bidhaa hii.</p>
                                )}
                                {attributeChips.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Entered Attributes</p>
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

                        {stockPerLocation.length > 0 && (
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold">Stock per Location</p>
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
                                                    {loc.quantity.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <p className="text-sm font-bold">Media & Hotspots</p>
                                {images.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Hakuna media zilizowekwa.</p>
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
                                                    SKU: {variant.sku || '-'} · Bei: TZS {Number(variant.price || 0).toLocaleString()} · Stock: {Number(variant.inventory_count || 0).toLocaleString()}
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
                        <DialogTitle>Picha & Hotspots</DialogTitle>
                    </DialogHeader>
                    {!activeImage ? (
                        <p className="text-sm text-muted-foreground">Picha haijapatikana.</p>
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
                                <p className="text-sm text-muted-foreground">Hakuna hotspots kwenye picha hii.</p>
                            )}

                            {activeHotspot && (
                                <div className="rounded-xl border border-slate-200 p-3 space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Hotspot Detail</p>
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
    return (
        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center gap-1 text-slate-500 text-xs font-semibold">
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
            </div>
            <p className="mt-1 text-base font-black text-slate-900">{value}</p>
        </div>
    );
}
