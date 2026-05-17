import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import {
    LayoutDashboard,
    Wallet,
    HandCoins,
    TrendingUp,
    AlertTriangle,
    History,
    PlusCircle,
    ArrowRightLeft,
    Users,
    ShoppingCart,
    Package,
    FileDown,
    Upload,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Settings,
    Gavel,
    Plus,
    ShoppingBag,
    User2,
    Phone,
    CreditCard,
    Banknote,
    Clock,
    BookOpenCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/Components/ui/Dialog';
import {
    Drawer,
    DrawerContent,
    DrawerClose
} from '@/Components/ui/Drawer';
import { Input } from '@/Components/ui/Input';
import { toast } from 'sonner';
import { useMerchantPermissions } from '@/lib/merchantPermissions';

export default function Dashboard({ merchant }) {
    const { can, canAny } = useMerchantPermissions(merchant?.username);
    const canRetailPos = can('retail.pos');
    const canRetailTransfers = can('retail.transfers');
    const canRetailInventory = can('retail.inventory');
    const canRetailSettings = can('retail.settings');
    const canRetailCustomers = can('retail.customers');
    const canRetailApproveSale = can('retail.approve_sale');
    const canBookkeepingView = can('bookkeeping.view');
    const canTeamView = can('team.view');
    const canWalletView = can('wallet.view');
    const canOrdersView = can('orders.view');
    const canTrustSafetyView = canAny(['retail.settings', 'settings.view']);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [permissionError, setPermissionError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [restockAmount, setRestockAmount] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [trustSafety, setTrustSafety] = useState(null);
    const [isReviewDrawerOpen, setIsReviewDrawerOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [counterTotal, setCounterTotal] = useState('');
    const [managerNotes, setManagerNotes] = useState('');
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);

    const fetchDashboardData = async () => {
        try {
            // Retail dashboard relies on web session auth; clear any terminal bearer token header.
            delete window.axios.defaults.headers.common.Authorization;
            const [metricsRes, logsRes, trustRes] = await Promise.all([
                window.axios.get('/api/retail/dashboard', { params: { merchant_id: merchant.id } }),
                window.axios.get('/api/retail/audit-logs', { params: { merchant_id: merchant.id } }),
                window.axios.get('/api/retail/trust-safety', { params: { merchant_id: merchant.id } })
            ]);
            setData({ ...metricsRes.data, logs: logsRes.data });
            setTrustSafety(trustRes.data);
        } catch (err) {
            if (err.response?.status === 403) {
                setPermissionError(err.response.data.message);
            } else {
                console.error('Failed to load dashboard', err);
                toast.error('Imeshindwa kupakia taarifa za dashboard.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const handleRestock = async () => {
        if (!canRetailInventory) return;
        if (!restockAmount || restockAmount <= 0) return;
        try {
            await window.axios.post('/api/retail/inventory/restock', {
                product_id: selectedItem.product_id,
                merchant_location_id: selectedItem.merchant_location_id,
                product_variant_id: selectedItem.product_variant_id,
                add_quantity: parseInt(restockAmount)
            });
            toast.success('Stock updated successfully!');
            setIsRestockModalOpen(false);
            setRestockAmount('');
            fetchDashboardData();
        } catch (err) {
            toast.error('Failed to update stock');
        }
    };

    const handleImport = async (e) => {
        if (!canRetailInventory) return;
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            await window.axios.post('/api/retail/inventory/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Bulk import completed!');
            setIsImportModalOpen(false);
            fetchDashboardData();
        } catch (err) {
            toast.error('Import failed. Please verify CSV format.');
        } finally {
            setImporting(false);
        }
    };

    const handleReviewOrder = (order) => {
        if (!canRetailApproveSale) return;
        setSelectedOrder(order);
        setCounterTotal(order.grand_total?.toString() || '');
        setManagerNotes(order.manager_notes || '');
        setIsReviewDrawerOpen(true);
    };

    const handleApproveOrder = async (order, reject = false) => {
        if (!canRetailApproveSale) return;
        if (!order?.id) return;
        if (reject) setRejecting(true);
        else setApproving(true);

        try {
            if (reject) {
                await window.axios.post(`/api/retail/pos/sale/${order.id}/reject`);
                toast.warning('Oda imekataliwa na stock imerudishwa.');
            } else {
                await window.axios.post(`/api/retail/pos/sale/${order.id}/approve`, {
                    payment_mode: order.payment_mode,
                    counter_total: counterTotal,
                    manager_notes: managerNotes
                });
                toast.success('Oda imeidhinishwa kikamilifu!');
            }
            setIsReviewDrawerOpen(false);
            fetchDashboardData();
        } catch (err) {
            toast.error(reject ? 'Imeshindwa kukataa oda.' : 'Imeshindwa kuidhinisha oda.');
        } finally {
            setApproving(false);
            setRejecting(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: merchant.currency?.code || 'TZS',
        }).format(val);
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Retail Dashboard | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24">

                {permissionError ? (
                    <div className="py-20 flex flex-col items-center text-center">
                        <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                            <AlertTriangle className="h-10 w-10 text-amber-600" />
                        </div>
                        <h2 className="text-2xl font-black mb-2">Ufikiaji Umezuiwa</h2>
                        <p className="text-muted-foreground max-w-md mb-8">{permissionError}</p>
                        
                        <div className="flex flex-wrap justify-center gap-4">
                            {canRetailPos && (
                                <Button
                                    className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl h-12 px-6"
                                    onClick={() => router.visit(`/merchant/${merchant.username}/retail/pos`)}
                                >
                                    <ShoppingCart className="mr-2 h-5 w-5" /> Fungua POS (Uza)
                                </Button>
                            )}
                            {canRetailTransfers && (
                                <Button
                                    variant="outline"
                                    className="rounded-xl border-brand-200 h-12 px-6"
                                    onClick={() => router.visit(`/merchant/${merchant.username}/retail/transfers`)}
                                >
                                    <ArrowRightLeft className="mr-2 h-5 w-5 text-brand-600" /> Hamisha Stock
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            Retail Operations <LayoutDashboard className="h-8 w-8 text-brand-600" />
                        </h1>
                        <p className="text-muted-foreground">Monitor sales, inventory, and staff across all locations.</p>
                    </div>

                {trustSafety && (
                    <Card className={`border shadow-sm ${trustSafety.status?.standing === 'good' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
                        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className={`h-11 w-11 rounded-xl grid place-items-center ${trustSafety.status?.standing === 'good' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {trustSafety.status?.standing === 'good' ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trust & Safety</p>
                                    <h2 className="text-lg font-black text-slate-950">
                                        {trustSafety.status?.standing === 'good' ? 'Account in good standing' : 'Account needs attention'}
                                    </h2>
                                    <p className="text-sm font-bold text-slate-600 mt-1">
                                        {trustSafety.status?.pos_payment_links_disabled
                                            ? 'POS payment links are disabled while Takeer reviews your account.'
                                            : trustSafety.status?.standing === 'good'
                                                ? `${trustSafety.status?.strike_count || 0} past strike(s), no active POS restrictions.`
                                                : `${trustSafety.status?.open_pos_reports || 0} open POS report(s), ${trustSafety.status?.pending_review_count || 0} pending review(s).`}
                                    </p>
                                </div>
                            </div>
                            {canTrustSafetyView && (
                                <Button
                                    variant="outline"
                                    className="rounded-xl bg-white"
                                    onClick={() => router.visit(`/merchant/${merchant.username}/retail/trust-safety`)}
                                >
                                    <Gavel className="h-4 w-4 mr-2" />
                                    View Status
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}
                {/* Pending Approvals Alert Section */}
                {canRetailApproveSale && data?.pending_approvals?.length > 0 && (
                    <div className="mb-8 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="h-5 w-5 text-amber-600 animate-pulse" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Mahitaji ya Idhini ({data.pending_approvals.length})</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.pending_approvals.map(order => (
                                <Card key={order.id} className="border-none shadow-xl shadow-amber-500/10 rounded-[2rem] overflow-hidden bg-amber-50/50 border-2 border-amber-100/50">
                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm overflow-hidden border border-amber-100/50">
                                                {order.product?.image_url ? (
                                                    <img src={order.product.image_url} className="h-full w-full object-cover" alt="" />
                                                ) : (
                                                    <Package className="h-5 w-5 text-amber-300" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black truncate text-slate-900">#POS-{order.public_id}</p>
                                                <p className="text-[10px] text-slate-500 font-bold truncate">{order.product?.title || 'Multiple Items'}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[9px] font-black text-amber-600 uppercase">Discount:</span>
                                                    <span className="text-[9px] font-black text-amber-700">{formatCurrency(order.discount_amount)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white/60 rounded-2xl p-3 mb-4 space-y-2 border border-amber-100/20">
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span className="text-slate-400 uppercase tracking-tight">Staff:</span>
                                                <span className="text-slate-900">{order.pos_staff?.user?.name || 'Unknown'}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span className="text-slate-400 uppercase tracking-tight">Total:</span>
                                                <span className="text-slate-900 font-black">{formatCurrency(order.grand_total)}</span>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-600/20"
                                            onClick={() => handleReviewOrder(order)}
                                        >
                                            Review & Respond
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Financial Cards (Ledger Distinction) */}
                {canWalletView && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card
                        className="bg-brand-700 text-white border-brand-800 shadow-lg shadow-brand-700/20 cursor-pointer transition-transform active:scale-[0.99] hover:bg-brand-800"
                        role="button"
                        tabIndex={0}
                        onClick={() => router.visit(`/merchant/${merchant.username}/wallet/ledger?type=escrow`)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                router.visit(`/merchant/${merchant.username}/wallet/ledger?type=escrow`);
                            }
                        }}
                    >
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <Wallet className="h-8 w-8 text-brand-100" />
                                <span className="text-[10px] font-bold bg-white text-brand-700 px-2 py-1 rounded-full uppercase tracking-widest">In Escrow</span>
                            </div>
                            <p className="text-xs font-bold text-brand-100 uppercase tracking-wider mb-1">Takeer Balance</p>
                            <h2 className="text-3xl font-black">{formatCurrency(data?.metrics?.takeer_balance || 0)}</h2>
                            <p className="text-[10px] mt-4 text-brand-100">Payouts are processed weekly.</p>
                        </CardContent>
                    </Card>

                    <Card
                        className="glass-card border-brand-100 shadow-lg shadow-brand-100/20 bg-white cursor-pointer transition-transform active:scale-[0.99] hover:border-brand-200"
                        onClick={() => router.visit(`/merchant/${merchant.username}/wallet/ledger?type=non-escrow`)}
                    >
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <HandCoins className="h-8 w-8 text-green-600" />
                                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full uppercase tracking-widest">Collected</span>
                            </div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Today's In-Hand Revenue</p>
                            <h2 className="text-3xl font-black text-gray-900">{formatCurrency(data?.metrics?.today_in_hand || 0)}</h2>
                            <p className="text-[10px] mt-4 text-muted-foreground">Cash and Merchant Mobile Money total.</p>
                        </CardContent>
                    </Card>

                    <Card
                        className="glass-card border-amber-100 shadow-lg shadow-amber-100/20 bg-white cursor-pointer transition-transform active:scale-[0.99] hover:border-amber-200"
                        onClick={() => router.visit(`/merchant/${merchant.username}/wallet/ledger?type=credit`)}
                    >
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <TrendingUp className="h-8 w-8 text-amber-600" />
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full uppercase tracking-widest">Pending</span>
                            </div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Outstanding Balances</p>
                            <h2 className="text-3xl font-black text-gray-900">{formatCurrency(data?.metrics?.outstanding_credit || 0)}</h2>
                            <p className="text-[10px] mt-4 text-muted-foreground">Click to collect unpaid POS balances.</p>
                        </CardContent>
                    </Card>
                </div>
                )}

                {/* Quick Actions */}
                <div className="rounded-[2rem] border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                                <LayoutDashboard className="h-5 w-5" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quick Actions</p>
                        </div>
                        {data?.pending_approvals?.length > 0 && (
                            <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 border border-amber-100">
                                {data.pending_approvals.length} Approval{data.pending_approvals.length === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
                        {canRetailPos && (
                            <Button
                                className="group h-20 justify-start gap-4 rounded-2xl bg-brand-600 px-4 text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700 sm:col-span-2"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/pos`)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
                                    <ShoppingCart className="h-6 w-6 group-hover:scale-110 transition-transform" />
                                </span>
                                <span className="text-base font-black">New Sale</span>
                            </Button>
                        )}
                        {canRetailTransfers && (
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 rounded-2xl border-slate-200 bg-slate-50/60 px-4 text-slate-950 hover:bg-brand-50 hover:border-brand-200"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/transfers`)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-slate-100 text-brand-600">
                                    <ArrowRightLeft className="h-5 w-5" />
                                </span>
                                <span className="text-base font-black">Transfer</span>
                            </Button>
                        )}
                        {canRetailInventory && (
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 rounded-2xl border-slate-200 bg-slate-50/60 px-4 text-slate-950 hover:bg-brand-50 hover:border-brand-200"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/inventory`)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-slate-100 text-brand-600">
                                    <Package className="h-5 w-5" />
                                </span>
                                <span className="text-base font-black">Inventory</span>
                            </Button>
                        )}
                        {canBookkeepingView && (
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 rounded-2xl border-slate-200 bg-slate-50/60 px-4 text-slate-950 hover:bg-brand-50 hover:border-brand-200"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/bookkeeping`)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-slate-100 text-brand-600">
                                    <BookOpenCheck className="h-5 w-5" />
                                </span>
                                <span className="text-base font-black">Bookkeeping</span>
                            </Button>
                        )}
                        {canRetailInventory && (
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 rounded-2xl border-slate-200 bg-slate-50/60 px-4 text-slate-950 hover:bg-brand-50 hover:border-brand-200"
                                onClick={() => setIsImportModalOpen(true)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-slate-100 text-brand-600">
                                    <Upload className="h-5 w-5" />
                                </span>
                                <span className="text-base font-black">Bulk Import</span>
                            </Button>
                        )}
                        {canTeamView && (
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 rounded-2xl border-slate-200 bg-slate-50/60 px-4 text-slate-950 hover:bg-brand-50 hover:border-brand-200"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/staff`)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-slate-100 text-brand-600">
                                    <Users className="h-5 w-5" />
                                </span>
                                <span className="text-base font-black">Staff</span>
                            </Button>
                        )}
                        {canRetailSettings && (
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 rounded-2xl border-slate-200 bg-slate-50/60 px-4 text-slate-950 hover:bg-brand-50 hover:border-brand-200"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/settings`)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-slate-100 text-brand-600">
                                    <Settings className="h-5 w-5" />
                                </span>
                                <span className="text-base font-black">Settings</span>
                            </Button>
                        )}
                        {canRetailCustomers && (
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 rounded-2xl border-slate-200 bg-slate-50/60 px-4 text-slate-950 hover:bg-brand-50 hover:border-brand-200"
                                onClick={() => router.visit(`/merchant/${merchant.username}/retail/customers`)}
                            >
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white border border-slate-100 text-brand-600">
                                    <Users className="h-5 w-5" />
                                </span>
                                <span className="text-base font-black">Customers</span>
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Low Stock Alerts */}
                    <Card className="glass-card shadow-sm border-brand-50">
                        <CardHeader className="p-6 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-4 w-4" /> Low Stock Alerts
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {data?.low_stock?.length > 0 ? (
                                <div className="space-y-3">
                                    {data.low_stock.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border border-red-100 overflow-hidden">
                                                    {item.product?.image_url ? (
                                                        <img src={item.product.image_url} alt={item.product?.title || 'Product image'} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Package className="h-5 w-5 text-red-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{item.product?.title || item.variant?.name || (item.variant?.sku ? `SKU: ${item.variant.sku}` : `Product #${item.product_id}`)}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{item.location?.name}</p>
                                                </div>
                                            </div>
                                             <div className="text-right">
                                                <p className="text-sm font-black text-red-600">{item.quantity} Left</p>
                                                {canRetailInventory && (
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedItem(item);
                                                            setIsRestockModalOpen(true);
                                                        }}
                                                        className="text-[10px] font-bold text-brand-600 hover:underline"
                                                    >
                                                        Restock
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-sm text-muted-foreground">No critical stock levels detected. ✅</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card className="glass-card shadow-sm border-brand-50">
                        <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                                <History className="h-4 w-4" /> Miamala ya hivi karibuni
                            </CardTitle>
                            {canOrdersView && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-[10px] font-black text-brand-600 hover:bg-brand-50 rounded-lg h-7"
                                    onClick={() => router.visit(`/merchant/${merchant.username}/orders`)}
                                >
                                    ONA ODA ZOTE
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-6">
                                {data?.recent_activity?.map((log, idx) => (
                                    <div 
                                        key={idx} 
                                        className={[
                                            "relative pl-6 before:absolute before:left-[3px] before:top-1.5 before:h-full before:w-[1px] before:bg-brand-100 last:before:hidden",
                                            log.metadata?.order_id ? "cursor-pointer group/item hover:bg-brand-50/50 -mx-4 px-10 py-3 rounded-2xl transition-colors" : ""
                                        ].join(' ')}
                                        onClick={() => {
                                            if (canOrdersView && log.metadata?.order_id) {
                                                router.visit(`/merchant/${merchant.username}/orders/${log.metadata.order_id}`);
                                            }
                                        }}
                                    >
                                        <div className="absolute left-0 group-hover/item:left-4 top-1.5 group-hover/item:top-4.5 h-2 w-2 rounded-full bg-brand-400 transition-all"></div>
                                        <div className="flex items-center gap-3">
                                            <div className="shrink-0">
                                                {log.action === 'POS_SALE' && log.metadata?.product_image ? (
                                                    <img src={log.metadata.product_image} className="h-10 w-10 rounded-lg object-cover border" alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border">
                                                        <History className="h-5 w-5 text-muted-foreground opacity-50" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold leading-snug group-hover/item:text-brand-700 transition-colors break-words">{log.description}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                                                    {log.staff?.user?.name || 'Owner'} • {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!data?.recent_activity || data.recent_activity.length === 0) && (
                                    <p className="text-sm text-center text-muted-foreground py-12">No activity logged yet.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Retail Review Drawer */}
                <Drawer open={isReviewDrawerOpen} onOpenChange={setIsReviewDrawerOpen}>
                    <DrawerContent className="max-w-2xl mx-auto h-[92vh] flex flex-col p-0 rounded-t-[40px] border-none shadow-2xl overflow-hidden bg-slate-50">
                        {selectedOrder && (() => {
                            const actualProductTotal = (selectedOrder.pos_items || []).reduce((acc, item) => acc + ((item.unit_price || item.price_at_sale || 0) * item.quantity), 0);
                            const salesAmount = selectedOrder.grand_total || 0;
                            const paidNow = selectedOrder.total_paid || 0;
                            const balanceOrDiscount = Math.abs(salesAmount - actualProductTotal);

                            return (
                                <>
                                    <div className="p-6 bg-white border-b border-slate-100 shrink-0">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100 shrink-0">
                                                    <ShoppingBag className="h-6 w-6 text-amber-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="text-xl font-black text-slate-900 truncate">Review #POS-{selectedOrder.public_id}</h2>
                                                    <p className="font-bold text-slate-400 text-xs truncate">
                                                        By {selectedOrder.pos_staff?.user?.name || 'Unknown'}
                                                    </p>
                                                </div>
                                            </div>
                                            <DrawerClose className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0">
                                                <Plus className="h-5 w-5 rotate-45" />
                                            </DrawerClose>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        {(selectedOrder.customer_name || selectedOrder.customer_phone) && (
                                            <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-3">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-500 flex items-center gap-2">
                                                    <User2 className="h-3 w-3" /> Taarifa za Mteja
                                                </h4>
                                                <div className="flex justify-between items-center gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-900 truncate">{selectedOrder.customer_name || 'N/A'}</p>
                                                        <p className="text-[11px] font-bold text-slate-400 truncate">{selectedOrder.customer_phone || 'Hajatoa namba'}</p>
                                                    </div>
                                                    <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                                                        <Phone className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                    <CreditCard className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Mode</h4>
                                                    <p className="text-xs font-black text-slate-900 uppercase truncate">{selectedOrder.payment_mode?.replace('_', ' ') || 'N/A'}</p>
                                                </div>
                                            </div>
                                            {selectedOrder.payment_mode === 'store_credit' && (
                                                <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-tight animate-pulse shrink-0">
                                                    Pay Later
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Items</h4>
                                            <div className="grid grid-cols-1 gap-2">
                                                {(selectedOrder.pos_items || []).map((item, idx) => {
                                                    const unitPrice = item.unit_price || item.price_at_sale || 0;

                                                    return (
                                                        <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                                                    <Package className="h-4 w-4 text-slate-400" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[11px] font-black text-slate-900 truncate">{item.product?.title || 'Unknown Product'}</p>
                                                                    <p className="text-[9px] text-slate-400 font-bold">Qty {item.quantity} @ {formatCurrency(unitPrice)}</p>
                                                                </div>
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-900 shrink-0">{formatCurrency(item.quantity * unitPrice)}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="p-5 rounded-[2rem] bg-slate-900 text-white space-y-4 shadow-xl">
                                            <div className="flex justify-between items-center gap-3 text-sm">
                                                <span className="font-bold text-slate-400">Bei ya Bidhaa (Actual):</span>
                                                <span className="font-black text-slate-200">{formatCurrency(actualProductTotal)}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-3 text-sm">
                                                <span className="font-bold text-slate-400">Kiasi cha Mauzo (Entered):</span>
                                                <span className="font-black text-white">{formatCurrency(salesAmount)}</span>
                                            </div>
                                            <div className="h-px bg-slate-800" />
                                            <div className="flex justify-between items-center gap-3">
                                                <span className="text-sm font-bold text-slate-400">Deni / Punguzo:</span>
                                                <span className={`text-lg font-black ${salesAmount >= actualProductTotal ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {formatCurrency(balanceOrDiscount)}
                                                </span>
                                            </div>
                                            <div className="bg-white/10 p-3 rounded-2xl flex justify-between items-center gap-3">
                                                <span className="text-xs font-bold text-white/60 uppercase">Kiasi Kilicholipwa (Advance):</span>
                                                <span className="text-sm font-black text-emerald-400">{formatCurrency(paidNow)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Counter-Offer (Agreed Total)</label>
                                                <div className="relative">
                                                    <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-600" />
                                                    <Input
                                                        type="number"
                                                        value={counterTotal}
                                                        onChange={e => setCounterTotal(e.target.value)}
                                                        className="h-12 pl-11 rounded-2xl border-brand-100 bg-white font-black text-brand-900 focus:ring-brand-500"
                                                        placeholder="Enter agreed total..."
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Manager Feedback / Secret Notes</label>
                                                <textarea
                                                    value={managerNotes}
                                                    onChange={e => setManagerNotes(e.target.value)}
                                                    className="w-full min-h-[100px] p-4 rounded-2xl border-slate-200 bg-white font-medium text-xs focus:ring-brand-500 resize-none shadow-sm"
                                                    placeholder="Andika maelezo kwa mhudumu..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                                        {canRetailApproveSale && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 h-14 rounded-3xl border-2 border-slate-100 font-black text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                                                    onClick={() => handleApproveOrder(selectedOrder, true)}
                                                    disabled={rejecting || approving}
                                                >
                                                    {rejecting ? <Clock className="h-4 w-4 animate-spin mr-2" /> : 'REJECT'}
                                                </Button>
                                                <Button
                                                    className="flex-[2] h-14 rounded-3xl bg-brand-600 hover:bg-brand-700 text-white font-black shadow-xl shadow-brand-600/20 transition-all active:scale-95"
                                                    onClick={() => handleApproveOrder(selectedOrder, false)}
                                                    disabled={approving || rejecting}
                                                >
                                                    {approving ? <Clock className="h-4 w-4 animate-spin mr-2" /> : 'APPROVE & SEND'}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </DrawerContent>
                </Drawer>

                {/* Restock Modal */}
                <Dialog open={isRestockModalOpen} onOpenChange={setIsRestockModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <PlusCircle className="h-5 w-5 text-brand-600" />
                                Restock Product
                            </DialogTitle>
                            <DialogDescription>
                                Add inventory for <span className="font-bold text-foreground">{selectedItem?.product?.title}</span> at <span className="font-bold text-foreground">{selectedItem?.location?.name}</span>.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <label className="text-xs font-black uppercase text-muted-foreground mb-2 block">Quantity to Add</label>
                            <Input
                                type="number"
                                placeholder="e.g. 50"
                                value={restockAmount}
                                onChange={(e) => setRestockAmount(e.target.value)}
                                className="h-12 text-lg font-bold"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRestockModalOpen(false)}>Cancel</Button>
                            {canRetailInventory && (
                                <Button 
                                    className="bg-brand-600 hover:bg-brand-700 text-white" 
                                    onClick={handleRestock}
                                    disabled={!restockAmount || restockAmount <= 0}
                                >
                                    Update Inventory
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Bulk Import Modal */}
                <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-brand-600" />
                                Bulk Inventory Import
                            </DialogTitle>
                            <DialogDescription>
                                Upload a CSV file to update stock levels across all your locations.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-6 space-y-4">
                            <div className="p-8 border-2 border-dashed border-brand-100 rounded-2xl bg-brand-50/30 flex flex-col items-center justify-center text-center">
                                <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center mb-4">
                                    <FileDown className="h-6 w-6 text-brand-600" />
                                </div>
                                <p className="text-sm font-bold text-brand-900">Choose CSV File</p>
                                <p className="text-[10px] text-muted-foreground mt-1 mb-4">Format: sku, location_id, quantity, title, price, image_url</p>
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    onChange={handleImport}
                                    className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-700 cursor-pointer"
                                />
                            </div>
                            
                            <a 
                                href={`/merchant/${merchant.username}/retail/onboarding/template`} 
                                className="flex items-center justify-center gap-2 text-[10px] font-bold text-brand-600 hover:underline"
                                download
                            >
                                <FileDown className="h-3 w-3" /> Download CSV Template
                            </a>
                        </div>
                        {importing && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-2"></div>
                                <p className="text-xs font-black uppercase text-brand-900">Processing Import...</p>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
                    </>
                )}

            </div>
        </AppLayout>
    );
}
