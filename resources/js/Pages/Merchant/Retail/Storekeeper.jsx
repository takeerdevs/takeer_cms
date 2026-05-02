import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Package, Truck, Clock3, ArrowRightLeft, MapPin, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Storekeeper({ merchant }) {
    const [hasTerminalSession, setHasTerminalSession] = useState(false);
    const [checkedTerminalSession, setCheckedTerminalSession] = useState(false);
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeStaff, setActiveStaff] = useState(null);
    const [staffSessionLocation, setStaffSessionLocation] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    const handleStaffLogout = () => {
        localStorage.removeItem('retail_staff_token');
        localStorage.removeItem('retail_staff_info');
        localStorage.removeItem('retail_staff_location');
        localStorage.removeItem('retail_staff_merchant');
        delete window.axios?.defaults?.headers?.common?.Authorization;
        router.visit(`/${merchant.username}/terminal`);
    };

    const loadTransfers = async () => {
        try {
            const res = await window.axios.get('/api/retail/transfers');
            setTransfers(res.data?.data || []);
        } catch (err) {
            toast.error('Imeshindwa kupakia transfer tasks.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('retail_staff_token');
        if (!token) {
            setCheckedTerminalSession(true);
            router.visit(`/${merchant.username}/terminal`, { replace: true });
            return;
        }

        window.axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        setHasTerminalSession(true);
        setCheckedTerminalSession(true);

        const savedStaff = localStorage.getItem('retail_staff_info');
        if (savedStaff) setActiveStaff(JSON.parse(savedStaff));
        const savedLocation = localStorage.getItem('retail_staff_location');
        if (savedLocation) setStaffSessionLocation(JSON.parse(savedLocation));

        loadTransfers();
        const timer = setInterval(loadTransfers, 30000);
        return () => {
            clearInterval(timer);
            delete window.axios.defaults.headers.common.Authorization;
        };
    }, [merchant.username]);

    const grouped = useMemo(() => {
        const pending = transfers.filter((t) => t.status === 'PENDING');
        const dispatched = transfers.filter((t) => t.status === 'DISPATCHED');
        const received = transfers.filter((t) => t.status === 'RECEIVED');
        return { pending, dispatched, received };
    }, [transfers]);

    const variantLabel = (transfer) => {
        const variant = transfer?.variant;
        if (!variant) return null;

        const attrs = variant.attributes && typeof variant.attributes === 'object'
            ? Object.entries(variant.attributes)
                .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
                .map(([key, value]) => `${key}: ${value}`)
                .join(' • ')
            : '';

        const productTitle = String(transfer?.product?.title || '').trim();
        const variantName = String(variant.name || '').trim();
        const cleanVariantName = variantName && productTitle && variantName.toLowerCase() === productTitle.toLowerCase()
            ? ''
            : variantName;

        return attrs || cleanVariantName || (variant.sku ? `SKU: ${variant.sku}` : null);
    };

    const act = async (id, action) => {
        try {
            await window.axios.patch(`/api/retail/transfers/${id}/${action}`, {});
            toast.success(action === 'dispatch' ? 'Bidhaa zimetoka store.' : 'Bidhaa zimepokelewa.');
            loadTransfers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindwa kufanya hatua hii.');
        }
    };

    const canDispatch = (transfer) => {
        return transfer.status === 'PENDING' &&
            Number(transfer.from_location_id) === Number(staffSessionLocation?.id || activeStaff?.assigned_location_id || 0);
    };

    const canReceive = (transfer) => {
        return transfer.status === 'DISPATCHED' &&
            Number(transfer.to_location_id) === Number(staffSessionLocation?.id || activeStaff?.assigned_location_id || 0);
    };

    const TransferCard = ({ t }) => {
        const label = variantLabel(t);

        return (
        <Card key={t.id} className="border border-brand-100/50 shadow-sm rounded-2xl">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                        <button
                            type="button"
                            onClick={() => t.product?.image_url ? setPreviewImage({ url: t.product.image_url, title: t.product?.title || 'Product' }) : null}
                            className="h-12 w-12 rounded-xl border border-brand-100 bg-white overflow-hidden shrink-0 flex items-center justify-center"
                        >
                            {t.product?.image_url ? (
                                <img src={t.product.image_url} alt={t.product?.title || 'Product'} className="h-full w-full object-cover" />
                            ) : (
                                <Package className="h-5 w-5 text-brand-300" />
                            )}
                        </button>
                        <div className="min-w-0">
                            <p className="font-black text-sm truncate">{t.product?.title || 'Product'}</p>
                            {label && (
                                <p className="mt-0.5 inline-flex max-w-full rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-700 truncate">
                                    {label}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">Qty: {t.quantity}</p>
                            <p className="text-xs text-slate-500">Available: {Number(t.available_source_quantity ?? 0)}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-slate-100">{t.status}</span>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> From: {t.from_location?.name}</p>
                    <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> To: {t.to_location?.name}</p>
                </div>

                <div className="flex gap-2">
                    {canDispatch(t) && (
                        <Button size="sm" className="h-9 rounded-xl bg-brand-600 text-white font-bold" onClick={() => act(t.id, 'dispatch')}>
                            <Truck className="h-4 w-4 mr-1" /> Dispatch
                        </Button>
                    )}
                    {canReceive(t) && (
                        <Button size="sm" className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => act(t.id, 'receive')}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm Receipt
                        </Button>
                    )}
                    {!canDispatch(t) && !canReceive(t) && (
                        <p className="text-[10px] font-bold text-muted-foreground">Waiting for the other location to verify.</p>
                    )}
                </div>
            </CardContent>
        </Card>
        );
    };

    if (!checkedTerminalSession || !hasTerminalSession) {
        return (
            <AppLayout>
                <Head title="Storekeeper | Takeer" />
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Storekeeper | Takeer" />
            <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black flex items-center gap-2">Storekeeper Tasks <Package className="h-6 w-6 text-brand-600" /></h1>
                        <p className="text-sm text-muted-foreground">Manage transfer requests for your assigned location.</p>
                        {activeStaff && (
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                                <span className="px-2 py-1 rounded-full bg-brand-100 text-brand-700 font-black uppercase">{activeStaff.role || 'STOREKEEPER'}</span>
                                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">{activeStaff.user?.name || activeStaff.name || 'Staff'}</span>
                                <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">{staffSessionLocation?.name || activeStaff.location?.name || 'No assigned location'}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.visit(`/merchant/${merchant.username}/retail/inventory`)}>
                            Inventory
                        </Button>
                        <Button variant="outline" onClick={() => router.visit(`/merchant/${merchant.username}/retail/pos`)}>
                            POS
                        </Button>
                        <Button variant="outline" className="text-red-700 border-red-200" onClick={handleStaffLogout}>
                            Logout
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending Dispatch</p><p className="text-2xl font-black">{grouped.pending.length}</p></CardContent></Card>
                    <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">In Transit</p><p className="text-2xl font-black">{grouped.dispatched.length}</p></CardContent></Card>
                    <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-black">{grouped.received.length}</p></CardContent></Card>
                </div>

                <Card className="rounded-2xl border-brand-100/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Open Transfer Tasks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loading ? (
                            <div className="text-sm text-muted-foreground flex items-center gap-2"><Clock3 className="h-4 w-4 animate-pulse" /> Loading...</div>
                        ) : transfers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No transfer tasks right now.</p>
                        ) : (
                            transfers.filter((t) => t.status === 'PENDING' || t.status === 'DISPATCHED').map((t) => <TransferCard key={t.id} t={t} />)
                        )}
                    </CardContent>
                </Card>
            </div>

            {previewImage && (
                <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                    <div className="max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <p className="font-bold text-sm truncate pr-3">{previewImage.title}</p>
                            <Button variant="ghost" size="sm" onClick={() => setPreviewImage(null)}>Close</Button>
                        </div>
                        <div className="bg-slate-50">
                            <img src={previewImage.url} alt={previewImage.title} className="w-full max-h-[75vh] object-contain" />
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
