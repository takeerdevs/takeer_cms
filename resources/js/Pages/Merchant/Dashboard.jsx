import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    Wallet, Package, ShoppingBag, Video, UploadCloud,
    TrendingUp, Store, ChevronRight, Truck, ShieldCheck,
    AlertTriangle, FileCheck, CheckCircle2, Settings, BookOpenText, Boxes, Crown, Download, CalendarClock
} from 'lucide-react';
import { router } from '@inertiajs/react';
import ProfileSwitcher from '@/Components/ProfileSwitcher';

export default function MerchantDashboard({ merchantUsername, merchantName }) {
    const { auth } = usePage().props;

    // In production, these should come from a dedicated API endpoint / Inertia props
    // We default them to empty/0 so the dashboard doesn't crash before the backend sends them
    const summary = auth?.user?.merchant_summary || {
        wallet_balance: 0,
        frozen_balance: 0,
        total_products: 0,
        orders_today: 0,
        orders_pending: 0,
        orders_completed: 0,
    };

    const recentOrders = auth?.user?.recent_orders || [];

    const merchantProfile = auth?.user?.merchant_profiles?.find(p => p.username === merchantUsername)
        || auth?.user?.merchant_profiles?.[0];
    const merchantSlug = merchantUsername || merchantProfile?.username || '';
    const isVerified = merchantProfile?.is_verified ?? false;

    const statusBadge = (status) => {
        const map = {
            awaiting_merchant_confirmation: { label: 'MPYA', cls: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
            escrow_locked: { label: 'ESCROW', cls: 'bg-brand-500/20 text-brand-700 dark:text-brand-300' },
            shipped: { label: 'IN DELIVERY', cls: 'bg-sky-500/20 text-sky-700 dark:text-sky-300' },
            resolved_merchant_paid: { label: 'IMEKAMILIKA', cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
            disputed: { label: 'MGOGORO', cls: 'bg-red-500/20 text-red-700 dark:text-red-300' },
            resolved_buyer_refunded: { label: 'REFUNDED', cls: 'bg-slate-500/20 text-slate-700 dark:text-slate-300' },
            pending: { label: 'PENDING', cls: 'bg-slate-500/20 text-slate-700 dark:text-slate-300' },
            failed: { label: 'IMESITISHWA', cls: 'bg-red-500/20 text-red-700 dark:text-red-300' },
        };
        const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
        );
    };

    const typeMeta = (kind) => {
        const map = {
            physical_product: { label: 'Physical Product', icon: ShoppingBag, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
            post_content: { label: 'Post Content', icon: BookOpenText, cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
            subscription_plan: { label: 'Membership', icon: Crown, cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
            digital_file: { label: 'Digital File', icon: Download, cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' },
            service_booking: { label: 'Service/Booking', icon: CalendarClock, cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
        };
        return map[kind] || { label: 'Post Content', icon: BookOpenText, cls: 'bg-muted text-muted-foreground' };
    };

    const iconFromKey = (key) => {
        const map = {
            shopping_bag: ShoppingBag,
            book_open: BookOpenText,
            download: Download,
            calendar_clock: CalendarClock,
            boxes: Boxes,
            crown: Crown,
        };
        return map[key] || Package;
    };

    return (
        <AppLayout>
            <Head title="Biashara Yangu | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-7 pb-24">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {merchantProfile?.avatar_url ? (
                            <img
                                src={merchantProfile.avatar_url}
                                alt={merchantProfile.display_name}
                                className="h-12 w-12 rounded-full object-cover border border-border shadow-sm shrink-0"
                            />
                        ) : (
                            <div className="h-12 w-12 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center shadow-sm shrink-0">
                                <Store className="h-6 w-6 text-brand-600" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl md:text-2xl font-black tracking-tight">Biashara Yangu 🛍️</h1>
                            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                                Karibu, <span className="font-semibold text-foreground">{merchantProfile?.display_name || merchantProfile?.username || 'Muuzaji'}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ProfileSwitcher />
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-xl h-9 w-9 border-muted"
                            onClick={() => router.visit(`/merchant/${merchantSlug}/settings`)}
                        >
                            <Settings className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <a
                            href={`/m/${merchantSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 shadow-sm border border-brand-200 hover:bg-brand-100 px-3 py-2 rounded-xl transition-colors shrink-0"
                        >
                            <Store className="h-4 w-4" /> Angalia Biashara
                        </a>
                    </div>
                </div>

                {/* Verification Banner */}
                {!isVerified ? (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0 h-fit">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-900 dark:text-amber-500">Biashara Yako Halijathibitishwa!</h3>
                                <p className="text-sm text-amber-800 dark:text-amber-400/80 mt-1 max-w-2xl">
                                    Thibitisha biashara yako (KYC) ili uanze kupokea malipo kupitia Takeer Instant Checkout. Kwa sasa, wanunuzi wataonyeshwa onyo na watalazimika kuwasiliana nawe nje ya mfumo.
                                </p>
                            </div>
                        </div>
                        <Link 
                            href={`/merchant/${merchantSlug}/verification`}
                            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md px-4 py-2 inline-flex items-center"
                        >
                            <FileCheck className="mr-2 h-4 w-4" /> Anza Uthibitisho (KYC)
                        </Link>
                    </div>
                ) : (
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-green-900 dark:text-green-500">Biashara Yako Imethibitishwa <ShieldCheck className="h-4 w-4 inline text-green-600" /></h3>
                                <p className="text-sm text-green-800 dark:text-green-400 mt-1">
                                    Unapokea malipo kwenye Escrow na wateja wako wanalindwa 100%.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Wallet */}
                <div className="grid grid-cols-2 gap-3">
                    <Card
                        className="bg-gradient-to-br from-brand-600 to-brand-700 border-0 text-white shadow-xl shadow-brand-600/20 cursor-pointer hover:shadow-brand-600/40 transition-shadow active:scale-[0.98]"
                        onClick={() => router.visit(`/merchant/${merchantSlug}/wallet`)}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <Wallet className="h-4 w-4 opacity-80" />
                                <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Salio</p>
                            </div>
                            <p className="text-2xl font-black">TZS {summary.wallet_balance.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                    <Card
                        className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700/30 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors active:scale-[0.98]"
                        onClick={() => router.visit(`/merchant/${merchantSlug}/wallet`)}
                    >
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="h-4 w-4 text-amber-600" />
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">Escrow</p>
                            </div>
                            <p className="text-2xl font-black text-amber-700 dark:text-amber-400">TZS {summary.frozen_balance.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* KPI chips */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { label: 'Bidhaa', value: summary.total_products, icon: Package, color: 'text-brand-600', link: `/merchant/${merchantSlug}/products` },
                        { label: 'Oda Leo', value: summary.orders_today, icon: TrendingUp, color: 'text-green-600' },
                        { label: 'Zinasubiri', value: summary.orders_pending, icon: Truck, color: 'text-amber-600' },
                    ].map(({ label, value, icon: Icon, color, link }) => (
                        <Card
                            key={label}
                            className={`glass-card shadow-sm transition-all ${link ? 'cursor-pointer hover:bg-muted/30 active:scale-95' : ''}`}
                            onClick={() => link && router.visit(link)}
                        >
                            <CardContent className="p-4 text-center">
                                <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
                                <p className={`text-xl font-black ${color}`}>{value}</p>
                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Quick actions */}
                <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Vitendo vya Haraka</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            className="h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-brand-600/20"
                            onClick={() => router.visit(`/merchant/${merchantSlug}/upload`)}
                        >
                            <UploadCloud className="h-5 w-5" /> Ongeza Bidhaa
                        </Button>
                        <Button
                            variant="outline"
                            className="h-14 rounded-2xl font-bold flex items-center gap-2"
                            onClick={() => router.visit(`/merchant/${merchantSlug}/posts`)}
                        >
                            <BookOpenText className="h-5 w-5" /> Posts
                        </Button>
                        <Button
                            variant="outline"
                            className="h-14 rounded-2xl font-bold flex items-center gap-2 col-span-2"
                            onClick={() => router.visit(`/merchant/${merchantSlug}/orders`)}
                        >
                            <ShoppingBag className="h-5 w-5" /> Angalia Oda Zote <ChevronRight className="h-4 w-4 ml-auto" />
                        </Button>
                    </div>
                </div>

                {/* Recent Orders */}
                <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">Oda za Hivi Karibuni</h2>
                    <div className="space-y-3">
                        {recentOrders.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground bg-card/40 rounded-3xl border border-border/50">
                                <p className="text-sm font-semibold">Hakuna oda mpya.</p>
                            </div>
                        ) : (
                            recentOrders.map(order => {
                                const isPos = order.source === 'pos';
                                const displayId = isPos ? `#POS-${order.public_id}` : `#${order.transaction_ref || order.id || order.id}`;

                                return (
                                    <Card
                                        key={order.id}
                                        className="overflow-hidden cursor-pointer hover:border-brand-300 transition-colors group"
                                        onClick={() => router.visit(`/merchant/${merchantSlug}/orders/${order.id}`)}
                                    >
                                        <CardContent className="p-4 md:p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex items-start gap-4">
                                                    <div className="h-14 w-14 rounded-2xl border bg-accent/50 flex items-center justify-center shrink-0 overflow-hidden">
                                                        {order.display_image ? (
                                                            <img src={order.display_image} className="h-full w-full object-cover group-hover:scale-110 transition-transform" alt="" />
                                                        ) : (
                                                            React.createElement(iconFromKey(order.display_icon), { className: 'h-6 w-6 text-brand-600 opacity-60' })
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center flex-wrap gap-2 mb-1">
                                                            <span className="text-[10px] font-black text-muted-foreground tracking-widest">{displayId}</span>
                                                            {statusBadge(order.status)}
                                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${typeMeta(order.display_kind).cls}`}>
                                                                {React.createElement(typeMeta(order.display_kind).icon, { className: 'h-3 w-3' })}
                                                                {typeMeta(order.display_kind).label}
                                                            </span>
                                                        </div>
                                                        <p className="font-black text-sm md:text-lg truncate group-hover:text-brand-700 transition-colors">{order.display_title || 'Order item'}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                                                            {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Price</p>
                                                    <p className="font-black text-brand-600 text-lg md:text-2xl">TZS {Number(order.amount || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
