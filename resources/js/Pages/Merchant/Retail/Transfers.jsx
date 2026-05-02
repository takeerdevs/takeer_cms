import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import {
    ArrowRightLeft,
    PlusCircle,
    Package,
    ArrowRight,
    CheckCircle2,
    Truck,
    Search,
    Filter,
    CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';

export default function Transfers({ merchant }) {
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRequesting, setIsRequesting] = useState(false);
    const [locations, setLocations] = useState([]);
    const [products, setProducts] = useState([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [query, setQuery] = useState('');
    const [fromFilter, setFromFilter] = useState('');
    const [toFilter, setToFilter] = useState('');

    const [form, setForm] = useState({
        product_id: '',
        product_variant_id: '',
        from_location_id: '',
        to_location_id: '',
        quantity: 1,
        notes: ''
    });

    const variantLabel = (variant, productTitle = '') => {
        if (!variant) return null;

        const attrs = variant.attributes && typeof variant.attributes === 'object'
            ? Object.entries(variant.attributes)
                .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
                .map(([key, value]) => `${key}: ${value}`)
                .join(' • ')
            : '';

        const variantName = String(variant.name || '').trim();
        const cleanVariantName = variantName && productTitle && variantName.toLowerCase() === String(productTitle).toLowerCase()
            ? ''
            : variantName;

        return attrs || cleanVariantName || (variant.sku ? `SKU: ${variant.sku}` : null);
    };

    const transferItems = products.flatMap((product) => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        if (product.has_variants && variants.length > 0) {
            return variants.map((variant) => ({
                key: `${product.id}:${variant.id}`,
                product_id: product.id,
                product_variant_id: variant.id,
                title: product.title,
                label: `${product.title} - ${variantLabel(variant, product.title) || `Variant #${variant.id}`}`,
                product,
                variant,
            }));
        }

        return [{
            key: `${product.id}:0`,
            product_id: product.id,
            product_variant_id: '',
            title: product.title,
            label: product.title,
            product,
            variant: null,
        }];
    });

    const selectedTransferItem = transferItems.find((item) =>
        String(item.product_id) === String(form.product_id) &&
        String(item.product_variant_id || '') === String(form.product_variant_id || '')
    );

    const locationStockForSelectedItem = (locationId) => {
        const product = selectedTransferItem?.product;
        if (!product) return 0;

        const variantId = selectedTransferItem.product_variant_id || null;
        const inventoryRows = variantId
            ? (selectedTransferItem.variant?.location_inventories?.length
                ? selectedTransferItem.variant.location_inventories
                : (product.location_inventories || []))
            : (product.location_inventories || []);

        const inventory = inventoryRows.find((row) => {
            const rowVariantId = row.product_variant_id || null;
            return String(row.merchant_location_id) === String(locationId) &&
                String(rowVariantId || '') === String(variantId || '');
        });

        return Number(inventory?.quantity || 0);
    };

    const fetchTransfers = async () => {
        try {
            const res = await window.axios.get('/api/retail/transfers', {
                params: {
                    ...(dateFrom ? { date_from: dateFrom } : {}),
                    ...(dateTo ? { date_to: dateTo } : {}),
                    ...(query ? { q: query } : {}),
                    ...(fromFilter ? { from_location_id: fromFilter } : {}),
                    ...(toFilter ? { to_location_id: toFilter } : {}),
                }
            });
            setTransfers(res.data.data || []);
        } catch (err) {
            console.error('Failed to load transfers', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const [locRes, prodRes] = await Promise.all([
                window.axios.get('/api/merchant/locations', { params: { merchant_id: merchant.id } }),
                window.axios.get('/api/retail/pos/products', { params: { q: '', merchant_id: merchant.id } })
            ]);
            setLocations(locRes.data.data || []);
            setProducts(prodRes.data.data || []);
        } catch (err) {
            console.error('Failed to load initial data', err);
        }
    };

    useEffect(() => {
        fetchTransfers();
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchTransfers();
    }, [dateFrom, dateTo, query, fromFilter, toFilter]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await window.axios.post('/api/retail/transfers', {
                ...form,
                product_variant_id: form.product_variant_id || null,
            });
            setIsRequesting(false);
            fetchTransfers();
        } catch (err) {
            alert('Failed to request transfer: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleAction = async (id, action) => {
        try {
            // Placeholder staff_id = 1 (Owner/Manager context)
            await window.axios.patch(`/api/retail/transfers/${id}/${action}`, { staff_id: 1 });
            fetchTransfers();
        } catch (err) {
            alert(`Failed to ${action}: ` + (err.response?.data?.message || err.message));
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'DISPATCHED': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'RECEIVED': return 'bg-green-100 text-green-700 border-green-200';
            case 'CANCELLED': return 'bg-gray-100 text-gray-600 border-gray-200';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const fmtDateTime = (val) => {
        if (!val) return '—';
        const dt = new Date(val);
        if (Number.isNaN(dt.getTime())) return '—';
        return dt.toLocaleString();
    };

    const transferVariantLabel = (transfer) => variantLabel(transfer?.variant, transfer?.product?.title);
    const isShopLocation = (location) => String(location?.type || '').toLowerCase() === 'shop';
    const needsShopDispatchVerification = (transfer) => transfer.status === 'PENDING' && isShopLocation(transfer.from_location);
    const needsShopReceiptVerification = (transfer) => transfer.status === 'DISPATCHED' && isShopLocation(transfer.to_location);

    return (
        <AppLayout>
            <Head title="Stock Transfers | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            Stock Movements <ArrowRightLeft className="h-8 w-8 text-brand-600" />
                        </h1>
                        <p className="text-muted-foreground">Move inventory between stores and shops with digital handshakes.</p>
                    </div>
                    <Button
                        onClick={() => setIsRequesting(!isRequesting)}
                        className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg"
                    >
                        {isRequesting ? 'Cancel' : <><PlusCircle className="mr-2 h-4 w-4" /> Move Stock</>}
                    </Button>
                </div>

                <Card className="glass-card border-brand-100 shadow-sm">
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Search className="h-3.5 w-3.5" /> Search Product/SKU</label>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="e.g. Router, TL Link, SKU..."
                                className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> From Date</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">To Date</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="h-11 rounded-xl" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                                Clear Filters
                            </Button>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> From Location</label>
                            <select value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm">
                                <option value="">All</option>
                                {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">To Location</label>
                            <select value={toFilter} onChange={(e) => setToFilter(e.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm">
                                <option value="">All</option>
                                {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {isRequesting && (
                    <Card className="glass-card border-brand-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                        <CardHeader className="bg-brand-50/50 p-6">
                            <CardTitle className="text-lg font-bold">New Transfer Request</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Select Product / Variant</label>
                                    <select
                                        required
                                        className="flex h-12 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm font-bold"
                                        value={form.product_id ? `${form.product_id}:${form.product_variant_id || 0}` : ''}
                                        onChange={e => {
                                            const [productId, variantId] = e.target.value.split(':');
                                            setForm({
                                                ...form,
                                                product_id: productId || '',
                                                product_variant_id: variantId && variantId !== '0' ? variantId : '',
                                                from_location_id: '',
                                            });
                                        }}
                                    >
                                        <option value="">-- Choose Item --</option>
                                        {transferItems.map(item => (
                                            <option key={item.key} value={item.key}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">From (Source)</label>
                                    <select
                                        required
                                        className="flex h-12 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                                        value={form.from_location_id}
                                        onChange={e => setForm({ ...form, from_location_id: e.target.value })}
                                    >
                                        <option value="">-- Select Source --</option>
                                        {locations.map(loc => {
                                            const qty = locationStockForSelectedItem(loc.id);
                                            return (
                                                <option key={loc.id} value={loc.id}>
                                                    {loc.name} {form.product_id ? `(${qty} in stock)` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">To (Destination)</label>
                                    <select
                                        required
                                        className="flex h-12 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                                        value={form.to_location_id}
                                        onChange={e => setForm({ ...form, to_location_id: e.target.value })}
                                    >
                                        <option value="">-- Select Destination --</option>
                                        {locations.map(loc => {
                                            const qty = locationStockForSelectedItem(loc.id);
                                            return (
                                                <option key={loc.id} value={loc.id}>
                                                    {loc.name} {form.product_id ? `(${qty} in stock)` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quantity</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="flex h-12 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm font-black"
                                        value={form.quantity}
                                        onChange={e => setForm({ ...form, quantity: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 lg:col-span-2 flex items-end">
                                    <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl h-12 font-black">
                                        Create Transfer Request
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-4">
                    {transfers.map((t) => {
                        const label = transferVariantLabel(t);
                        const shopDispatchRequired = needsShopDispatchVerification(t);
                        const shopReceiptRequired = needsShopReceiptVerification(t);

                        return (
                        <Card key={t.id} className="glass-card border shadow-sm hover:shadow-md transition-all bg-white overflow-hidden">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row">
                                    {/* Left: Product & Quantity */}
                                    <button
                                        type="button"
                                        className="p-6 md:w-1/3 flex items-center gap-4 bg-gray-50/50 text-left"
                                        onClick={() => router.visit(`/merchant/${merchant.username}/retail/products/${t.product?.id}/timeline`)}
                                    >
                                        <div className="h-14 w-14 rounded-2xl bg-white border border-brand-100 flex items-center justify-center text-brand-600 shadow-sm">
                                            <Package className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900">{t.product?.title}</h3>
                                            {label && (
                                                <p className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-700">
                                                    {label}
                                                </p>
                                            )}
                                            <p className="text-xl font-black text-brand-600">{t.quantity} Units</p>
                                        </div>
                                    </button>

                                    {/* Middle: Route */}
                                    <div className="p-6 flex-1 flex items-center justify-center gap-6 border-y md:border-y-0 md:border-x border-brand-50">
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">From</p>
                                            <p className="text-sm font-bold">{t.from_location?.name}</p>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-brand-200" />
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">To</p>
                                            <p className="text-sm font-bold">{t.to_location?.name}</p>
                                        </div>
                                    </div>

                                    {/* Right: Status & Actions */}
                                    <div className="p-6 md:w-1/3 flex flex-col justify-center items-end gap-3">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${getStatusStyle(t.status)}`}>
                                            {t.status}
                                        </span>
                                        <div className="text-[10px] text-muted-foreground text-right space-y-0.5">
                                            <p><span className="font-bold">Requested:</span> {fmtDateTime(t.created_at)}</p>
                                            <p><span className="font-bold">Dispatched:</span> {fmtDateTime(t.dispatched_at)}</p>
                                            <p><span className="font-bold">Received:</span> {fmtDateTime(t.received_at)}</p>
                                            <p><span className="font-bold">Requested by:</span> {t.requested_by?.user?.name || '—'}</p>
                                            <p><span className="font-bold">Dispatched by:</span> {t.dispatched_by?.user?.name || '—'}</p>
                                            <p><span className="font-bold">Received by:</span> {t.received_by?.user?.name || '—'}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {t.status === 'PENDING' && (
                                                <>
                                                    <Button variant="outline" size="sm" className="rounded-lg text-xs font-bold text-red-600" onClick={() => handleAction(t.id, 'cancel')}>Cancel</Button>
                                                    {shopDispatchRequired ? (
                                                        <Button
                                                            size="sm"
                                                            className="rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                                                            onClick={() => router.visit(`/merchant/${merchant.username}/retail/storekeeper`)}
                                                        >
                                                            Verify at {t.from_location?.name}
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" className="rounded-lg text-xs font-bold bg-brand-600 text-white" onClick={() => handleAction(t.id, 'dispatch')}>Dispatch</Button>
                                                    )}
                                                </>
                                            )}
                                            {t.status === 'DISPATCHED' && (
                                                shopReceiptRequired ? (
                                                    <Button
                                                        size="sm"
                                                        className="rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                                                        onClick={() => router.visit(`/merchant/${merchant.username}/retail/storekeeper`)}
                                                    >
                                                        Verify at {t.to_location?.name}
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" className="rounded-lg text-xs font-bold bg-green-600 text-white" onClick={() => handleAction(t.id, 'receive')}>Confirm Receipt</Button>
                                                )
                                            )}
                                            {t.status === 'RECEIVED' && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                                                    <CheckCircle2 className="h-3 w-3" /> Handshake Complete
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        );
                    })}

                    {transfers.length === 0 && !loading && (
                        <div className="py-20 text-center border-2 border-dashed border-brand-100 rounded-3xl">
                            <ArrowRightLeft className="h-16 w-16 text-brand-100 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-gray-400">No stock movements yet</h2>
                            <p className="text-muted-foreground mt-2">Inventory transfers will appear here once requested.</p>
                        </div>
                    )}
                </div>

            </div>
        </AppLayout>
    );
}
