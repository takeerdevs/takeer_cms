import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Input } from '@/Components/ui/Input';
import { toast } from 'sonner';
import { Boxes, Search, Save, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { formatQuantity, productQuantityLabel } from '@/lib/productUnits';
import { useMerchantPermissions } from '@/lib/merchantPermissions';

export default function Inventory({ merchant }) {
    const { can } = useMerchantPermissions(merchant?.username);
    const [locations, setLocations] = useState([]);
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [rows, setRows] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [assignedLocationId, setAssignedLocationId] = useState(null);

    const fetchLocations = async () => {
        const res = await window.axios.get('/api/merchant/locations');
        let data = res.data.data || [];
        if (assignedLocationId) {
            data = data.filter((loc) => Number(loc.id) === Number(assignedLocationId));
        }
        setLocations(data);
        if (!selectedLocationId && data.length > 0) {
            const preferred = data[0];
            setSelectedLocationId(String(preferred.id));
        }
    };

    const fetchInventory = async (locationId, q = '') => {
        if (!locationId) return;
        setLoading(true);
        try {
            const res = await window.axios.get('/api/retail/inventory', {
                params: { merchant_location_id: locationId, q },
            });
            const items = (res.data.data || []).map((item) => {
                const attrs = item.variant?.attributes && typeof item.variant.attributes === 'object'
                    ? Object.entries(item.variant.attributes)
                        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' • ')
                    : '';

                const productTitle = (item.product?.title && String(item.product.title).trim()) || '';
                const variantName = (item.variant?.name && String(item.variant.name).trim()) || '';
                const cleanVariantName = variantName && productTitle && variantName.toLowerCase() === productTitle.toLowerCase()
                    ? ''
                    : variantName;

                return {
                    id: item.id,
                    row_key: item.row_key || `${item.product_id}:${item.product_variant_id || 0}`,
                    product_id: item.product_id,
                    product_variant_id: item.product_variant_id,
                    title:
                        productTitle ||
                        (item.variant?.name && String(item.variant.name).trim()) ||
                        (item.variant?.sku ? `SKU: ${item.variant.sku}` : null) ||
                        `Product #${item.product_id}`,
                    variant: attrs || cleanVariantName || null,
                    sku: item.variant?.sku || null,
                    product: item.product,
                    expected_quantity: Number(item.quantity || 0),
                    counted_quantity: Number(item.quantity || 0),
                };
            });
            setRows(items);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kupakia inventory.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
        const savedStaff = localStorage.getItem('retail_staff_info');
        if (savedStaff) {
            try {
                const parsed = JSON.parse(savedStaff);
                setAssignedLocationId(parsed?.assigned_location_id ? Number(parsed.assigned_location_id) : null);
            } catch {
                setAssignedLocationId(null);
            }
        }
    }, []);

    useEffect(() => {
        fetchLocations();
    }, [assignedLocationId]);

    const canManageTransfers = can('retail.transfers');

    useEffect(() => {
        if (!selectedLocationId) return;
        fetchInventory(selectedLocationId, search);
    }, [selectedLocationId]);

    const varianceSummary = useMemo(() => {
        let changed = 0;
        let net = 0;
        rows.forEach((row) => {
            const variance = Number(row.counted_quantity) - Number(row.expected_quantity);
            if (variance !== 0) changed += 1;
            net += variance;
        });
        return { changed, net };
    }, [rows]);

    const updateCount = (rowKey, value) => {
        const parsed = Math.max(0, Number(value || 0));
        setRows((prev) => prev.map((row) => row.row_key === rowKey ? { ...row, counted_quantity: parsed } : row));
    };

    const submitDailyCount = async () => {
        const changedRows = rows.filter((row) => Number(row.counted_quantity) !== Number(row.expected_quantity));
        if (changedRows.length === 0) {
            toast.info('Hakuna tofauti ya stock ya kuhifadhi.');
            return;
        }

        setSaving(true);
        try {
            await window.axios.post('/api/retail/inventory/count', {
                merchant_location_id: Number(selectedLocationId),
                items: changedRows.map((row) => ({
                    product_id: row.product_id,
                    product_variant_id: row.product_variant_id,
                    counted_quantity: Number(row.counted_quantity),
                })),
            });
            toast.success('Daily count imehifadhiwa kikamilifu.');
            fetchInventory(selectedLocationId, search);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kuhifadhi count.');
        } finally {
            setSaving(false);
        }
    };

    const handleSearch = () => fetchInventory(selectedLocationId, search);

    return (
        <AppLayout>
            <Head title="Retail Inventory | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            Inventory Count <Boxes className="h-7 w-7 text-brand-600" />
                        </h1>
                        <p className="text-muted-foreground">Storekeeper anaingiza physical stock ya leo kwa location moja moja.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canManageTransfers && (
                            <Button variant="outline" onClick={() => router.visit(`/merchant/${merchant.username}/retail/transfers`)}>
                                <ArrowLeftRight className="h-4 w-4 mr-2" /> Transfers
                            </Button>
                        )}
                    </div>
                </div>

                <Card className="glass-card shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">Daily Count Sheet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Location</label>
                                <select
                                    value={selectedLocationId}
                                    onChange={(e) => setSelectedLocationId(e.target.value)}
                                    disabled={Boolean(assignedLocationId)}
                                    className="w-full h-10 rounded-xl border border-input bg-white px-3 text-sm font-bold mt-1"
                                >
                                    <option value="">Chagua Location</option>
                                    {locations.map((loc) => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.name} ({String(loc.type || 'shop').toLowerCase()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground">Search</label>
                                <div className="relative mt-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9 rounded-xl"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search bidhaa, variant, sku..."
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-1 flex items-end gap-2">
                                <Button variant="outline" className="h-10 w-full" onClick={handleSearch}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-brand-50/40 border border-brand-100">
                            <p className="text-xs font-bold text-brand-700">
                                Lines changed: <span className="font-black">{varianceSummary.changed}</span> | Net variance: <span className="font-black">{formatQuantity(varianceSummary.net)}</span>
                            </p>
                            <Button onClick={submitDailyCount} disabled={saving || loading || varianceSummary.changed === 0}>
                                <Save className="h-4 w-4 mr-2" /> {saving ? 'Inahifadhi...' : 'Submit Daily Count'}
                            </Button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-input">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="text-left p-3 font-black text-xs uppercase tracking-wider">Bidhaa</th>
                                        <th className="text-left p-3 font-black text-xs uppercase tracking-wider">Variant/SKU</th>
                                        <th className="text-right p-3 font-black text-xs uppercase tracking-wider">Expected</th>
                                        <th className="text-right p-3 font-black text-xs uppercase tracking-wider">Counted</th>
                                        <th className="text-right p-3 font-black text-xs uppercase tracking-wider">Variance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && (
                                        <tr>
                                            <td colSpan={5} className="p-6 text-center text-muted-foreground">Inapakia inventory...</td>
                                        </tr>
                                    )}
                                    {!loading && rows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-6 text-center text-muted-foreground">Hakuna stock records kwa location hii.</td>
                                        </tr>
                                    )}
                                    {!loading && rows.map((row) => {
                                        const variance = Number(row.counted_quantity) - Number(row.expected_quantity);
                                        return (
                                            <tr key={row.row_key} className="border-t border-input">
                                                <td className="p-3">
                                                    <p className="font-bold">{row.title}</p>
                                                </td>
                                                <td className="p-3 text-xs text-muted-foreground">
                                                    {row.variant || 'Standard'} {row.sku ? `• ${row.sku}` : ''}
                                                </td>
                                                <td className="p-3 text-right font-bold">{productQuantityLabel(row.product, row.expected_quantity)}</td>
                                                <td className="p-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step={row.product?.unit_type?.allows_decimal ? '0.001' : '1'}
                                                        value={row.counted_quantity}
                                                        onChange={(e) => updateCount(row.row_key, e.target.value)}
                                                        className="w-24 h-9 rounded-lg border border-input text-right px-2 font-bold"
                                                    />
                                                </td>
                                                <td className={`p-3 text-right font-black ${variance === 0 ? 'text-muted-foreground' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {variance > 0 ? `+${productQuantityLabel(row.product, variance)}` : productQuantityLabel(row.product, variance)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
