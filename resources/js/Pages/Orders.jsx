import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    BookOpenText,
    Boxes,
    Crown,
    Download,
    ExternalLink,
    Library,
    Loader2,
    ShoppingBag,
    Sparkles,
    Store,
    CalendarClock,
    CheckCircle2,
    ShieldCheck,
    Truck,
    MessageSquare,
    Zap,
    AlertTriangle,
    KeyRound,
    RefreshCcw,
    ReceiptText,
    X,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import ContentReportButton from '@/Components/ContentReportButton';
import { orderQuantityLabel, orderUnitPriceLabel } from '@/lib/productUnits';
import { useSubscriptionCountdown } from '@/lib/subscriptionCountdown';

const tabs = [
    { key: 'library', label: 'Library', icon: Library },
    { key: 'memberships', label: 'Memberships', icon: Crown },
    { key: 'pulse', label: 'Pulse', icon: Store },
];

export default function Orders() {
    const { auth } = usePage().props;
    const isMerchant = !!auth?.user?.is_merchant;

    const [activeTab, setActiveTab] = useState('library');
    const [loading, setLoading] = useState(true);
    const [entitlements, setEntitlements] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [subscriptionPage, setSubscriptionPage] = useState(1);
    const [subscriptionMeta, setSubscriptionMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [subscriptionLoading, setSubscriptionLoading] = useState(false);
    const [merchantLive, setMerchantLive] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [libraryPage, setLibraryPage] = useState(1);
    const [libraryPerPage, setLibraryPerPage] = useState(12);
    const [libraryMeta, setLibraryMeta] = useState({ current_page: 1, last_page: 1, total: 0, unfiltered_total: 0 });
    const [librarySummary, setLibrarySummary] = useState({ total: 0, content: 0, bundles: 0, purchases: 0 });
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [subscriptionPerPage, setSubscriptionPerPage] = useState(12);
    const [pulsePage, setPulsePage] = useState(1);
    const [pulsePerPage, setPulsePerPage] = useState(12);
    const [pulseItems, setPulseItems] = useState([]);
    const [pulseMeta, setPulseMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [pulseLoading, setPulseLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (loading || activeTab !== 'library') return;
        setLibraryPage(1);
    }, [searchTerm, typeFilter, dateFilter, libraryPerPage, activeTab]);

    useEffect(() => {
        if (loading || activeTab !== 'memberships') return;
        setSubscriptionPage(1);
    }, [subscriptionPerPage, activeTab]);

    useEffect(() => {
        if (loading || activeTab !== 'pulse') return;
        setPulsePage(1);
    }, [pulsePerPage, activeTab]);

    useEffect(() => {
        if (loading || activeTab !== 'pulse') return;
        loadPulsePage();
    }, [pulsePage, pulsePerPage, activeTab]);

    useEffect(() => {
        if (loading || activeTab !== 'library') return;
        loadLibraryWithFilters();
    }, [libraryPage, libraryPerPage, activeTab]);

    useEffect(() => {
        if (loading || activeTab !== 'memberships') return;
        loadSubscriptionsPage();
    }, [subscriptionPage, subscriptionPerPage, activeTab]);

    useEffect(() => {
        if (!isMerchant || !auth?.user || !window.Echo) return;

        const channel = window.Echo.private(`merchant.${auth.user.id}`);
        channel.listen('.order.paid', (e) => {
            toast.success(`Oda Mpya: ${e.product_title}`, {
                description: `Umelipwa TZS ${e.amount.toLocaleString()} (Escrow).`,
                duration: 8000,
                icon: <ShoppingBag className="text-brand-500" />,
            });

            setMerchantLive((prev) => [{
                id: e.order_id,
                product_title: e.product_title,
                amount: e.amount,
                status: 'awaiting_merchant_confirmation',
                buyer_phone: e.buyer_phone,
            }, ...prev]);
        });

        return () => {
            window.Echo.leave(`merchant.${auth.user.id}`);
        };
    }, [auth, isMerchant]);

    async function loadData() {
        setLoading(true);
        try {
            // Use session-cookie auth for Buyer Hub APIs to avoid stale bearer tokens
            // left in axios defaults by checkout flows.
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;

            const [pulseRes, entitlementsRes, subscriptionsRes] = await Promise.allSettled([
                sessionApi.get('/orders/data/pulse', { params: { page: pulsePage, per_page: pulsePerPage } }),
                sessionApi.get('/orders/data/entitlements'),
                sessionApi.get('/orders/data/subscriptions'),
            ]);

            if (pulseRes.status === 'fulfilled') {
                setPulseItems(pulseRes.value.data?.events || []);
                setPulseMeta(pulseRes.value.data?.meta || { current_page: 1, last_page: 1, total: 0 });
            } else {
                setPulseItems([]);
                setPulseMeta({ current_page: 1, last_page: 1, total: 0 });
            }

            if (entitlementsRes.status === 'fulfilled') {
                const base = entitlementsRes.value.data?.entitlements || [];
                const meta = entitlementsRes.value.data?.meta || { current_page: 1, last_page: 1, total: base.length, unfiltered_total: base.length };
                setEntitlements(base);
                setLibraryMeta(meta);
                setLibrarySummary(meta.summary || { total: base.length, content: 0, bundles: 0, purchases: base.filter((entry) => entry.source_type === 'order' || entry.item_type === 'product').length });
            } else {
                setEntitlements([]);
                setLibraryMeta({ current_page: 1, last_page: 1, total: 0, unfiltered_total: 0 });
                setLibrarySummary({ total: 0, content: 0, bundles: 0, purchases: 0 });
            }

            if (subscriptionsRes.status === 'fulfilled') {
                setSubscriptions(subscriptionsRes.value.data?.data || []);
                setSubscriptionMeta({
                    current_page: subscriptionsRes.value.data?.current_page || 1,
                    last_page: subscriptionsRes.value.data?.last_page || 1,
                    total: subscriptionsRes.value.data?.total || (subscriptionsRes.value.data?.data || []).length,
                });
            } else {
                setSubscriptions([]);
                setSubscriptionMeta({ current_page: 1, last_page: 1, total: 0 });
            }

            if (pulseRes.status === 'rejected' && entitlementsRes.status === 'rejected' && subscriptionsRes.status === 'rejected') {
                throw new Error('Failed to load buyer data');
            }
        } catch (error) {
            toast.error('Imeshindwa kupakia library yako.');
        } finally {
            setLoading(false);
        }
    }

    async function loadPulsePage() {
        setPulseLoading(true);
        try {
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;
            const res = await sessionApi.get('/orders/data/pulse', {
                params: { page: pulsePage, per_page: pulsePerPage },
            });
            setPulseItems(res.data?.events || []);
            setPulseMeta(res.data?.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            toast.error('Imeshindwa kupakia Pulse.');
        } finally {
            setPulseLoading(false);
        }
    }

    async function loadLibraryWithFilters() {
        setLibraryLoading(true);
        try {
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;

            const params = {};
            if (typeFilter !== 'all') params.type = typeFilter;
            if (searchTerm.trim()) params.q = searchTerm.trim();
            if (dateFilter !== 'all') params.days = Number(dateFilter);
            params.page = libraryPage;
            params.per_page = libraryPerPage;

            const res = await sessionApi.get('/orders/data/entitlements', { params });
            setEntitlements(res.data?.entitlements || []);
            const meta = res.data?.meta || { current_page: 1, last_page: 1, total: 0, unfiltered_total: 0 };
            setLibraryMeta(meta);
            if (typeFilter === 'all' && !searchTerm.trim() && dateFilter === 'all') {
                setLibrarySummary(meta.summary || { total: res.data?.entitlements?.length || 0, content: 0, bundles: 0, purchases: 0 });
            }
        } catch (error) {
            toast.error('Imeshindwa kuchuja library.');
        } finally {
            setLibraryLoading(false);
        }
    }

    async function loadSubscriptionsPage() {
        setSubscriptionLoading(true);
        try {
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;
            const res = await sessionApi.get('/orders/data/subscriptions', {
                params: { page: subscriptionPage, per_page: subscriptionPerPage },
            });
            setSubscriptions(res.data?.data || []);
            setSubscriptionMeta({
                current_page: res.data?.current_page || 1,
                last_page: res.data?.last_page || 1,
                total: res.data?.total || (res.data?.data || []).length,
            });
        } catch (error) {
            toast.error('Imeshindwa kupakia memberships.');
        } finally {
            setSubscriptionLoading(false);
        }
    }

    async function cancelSubscription(id) {
        try {
            await axios.post(`/api/me/subscriptions/${id}/cancel`);
            toast.success('Subscription imeghairiwa.');
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kughairi subscription.');
        }
    }

    const stats = useMemo(() => {
        const summary = librarySummary || {};
        const activeSubs = subscriptions.filter((entry) => ['active', 'pending', 'past_due'].includes(entry.status)).length;

        return [
            { label: 'Library Items', value: Number(summary.total || 0), icon: Library, tone: 'from-amber-500/15 to-orange-500/10 text-amber-700' },
            { label: 'Content', value: Number(summary.content || 0), icon: BookOpenText, tone: 'from-sky-500/15 to-cyan-500/10 text-sky-700' },
            { label: 'Purchases', value: Number(summary.purchases || 0), icon: ShoppingBag, tone: 'from-violet-500/15 to-indigo-500/10 text-violet-700' },
            { label: 'Memberships', value: activeSubs, icon: Crown, tone: 'from-emerald-500/15 to-teal-500/10 text-emerald-700' },
        ];
    }, [librarySummary, subscriptions]);

    const pulseLastPage = pulseMeta.last_page || 1;
    const safePulsePage = pulseMeta.current_page || 1;
    const visiblePulseItems = pulseItems;

    useEffect(() => {
        if (pulsePage > pulseLastPage) {
            setPulsePage(pulseLastPage);
        }
    }, [pulsePage, pulseLastPage]);

    const visibleTabs = tabs;

    const libraryTypeOptions = [
        { key: 'all', label: 'All Types' },
        { key: 'physical_product', label: 'Physical Product' },
        { key: 'post_content', label: 'Post Content' },
        { key: 'digital_file', label: 'Digital File' },
        { key: 'service_booking', label: 'Service/Booking' },
    ];

    if (loading) {
        return (
            <AppLayout>
                <Head title="Library | Takeer" />
                <div className="max-w-5xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">Inapakia library yako...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Library | Takeer" />

            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-gradient-to-br from-[#f8fbff] via-[#fffdf7] to-[#f8fff8] shadow-sm">
                    <div className="absolute inset-y-0 right-0 w-64 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_60%)]" />
                    <div className="relative p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                            <div>
                                <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                                    Your purchases, premium access, and memberships in one clean space.
                                </h1>
                                <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-600 leading-7">
                                    Fungua articles ulizonunua, fuatilia bundles ulizomiliki, na simamia subscriptions zako bila kupotea kwenye interface nyingi tofauti.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {stats.map(({ label, value, icon: Icon, tone }) => (
                                <div key={label} className={`rounded-2xl border border-white/70 bg-gradient-to-br ${tone} px-4 py-4 shadow-sm`}>
                                    <Icon className="h-5 w-5 mb-3" />
                                    <p className="text-2xl font-black">{value}</p>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em]">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="flex flex-wrap gap-2 rounded-2xl bg-muted/40 p-2 w-fit">
                    {visibleTabs.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveTab(key)}
                            className={[
                                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all',
                                activeTab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                            ].join(' ')}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {activeTab === 'pulse' && (
                    <section className="space-y-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">Pulse</h2>
                                <p className="text-sm text-muted-foreground">
                                    Subscriptions, entitled content, and physical product sales in one notification stream.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {isMerchant && (
                                    <span className={`w-fit text-xs font-black px-3 py-1 rounded-full ${window.Echo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                        {window.Echo ? 'Live connected' : 'Live offline'}
                                    </span>
                                )}
                                <select
                                    value={pulsePerPage}
                                    onChange={(e) => setPulsePerPage(Number(e.target.value))}
                                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                >
                                    <option value={8}>8 / page</option>
                                    <option value={12}>12 / page</option>
                                    <option value={24}>24 / page</option>
                                </select>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-border/70 bg-card overflow-hidden">
                            {pulseLoading ? (
                                <div className="flex items-center justify-center gap-3 p-8 text-sm font-semibold text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                                    Inapakia Pulse...
                                </div>
                            ) : pulseItems.length === 0 ? (
                                <EmptyPane icon={Library} title="No pulse yet" body="Payment confirmations, delivery updates, access usage, service bookings, and membership changes will appear here." compact />
                            ) : (
                                <div className="divide-y divide-border/70">
                                    {visiblePulseItems.map((item) => (
                                        <PulseNotification key={item.id} item={item} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {(pulseMeta.total || 0) > 0 && (
                            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-semibold text-muted-foreground">
                                    Showing {visiblePulseItems.length} of {pulseMeta.total || 0} updates · Page {safePulsePage} / {pulseLastPage}
                                </p>
                                {pulseLastPage > 1 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => setPulsePage((p) => Math.max(1, p - 1))}
                                            disabled={safePulsePage <= 1}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => setPulsePage((p) => Math.min(pulseLastPage, p + 1))}
                                            disabled={safePulsePage >= pulseLastPage}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'library' && (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-border/70 bg-card/40 p-3 md:p-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search title, description, merchant..."
                                    className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                />
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                >
                                    {libraryTypeOptions.map((option) => (
                                        <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                </select>
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
                                    <select
                                        value={dateFilter}
                                        onChange={(e) => setDateFilter(e.target.value)}
                                        className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="all">Any date</option>
                                        <option value="7">Last 7 days</option>
                                        <option value="30">Last 30 days</option>
                                        <option value="90">Last 90 days</option>
                                        <option value="365">Last 12 months</option>
                                    </select>
                                    <select
                                        value={libraryPerPage}
                                        onChange={(e) => setLibraryPerPage(Number(e.target.value))}
                                        className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                    >
                                        <option value={12}>12 / page</option>
                                        <option value={24}>24 / page</option>
                                        <option value={48}>48 / page</option>
                                    </select>
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Showing {entitlements.length} of {libraryMeta.total || 0} filtered items (total library: {libraryMeta.unfiltered_total || 0}).
                            </p>
                        </div>

                        {libraryLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {libraryMeta.unfiltered_total === 0 ? (
                                    <EmptyPane icon={Library} title="Library yako iko tupu" body="Ukishanunua content, bundles, au bidhaa za kidigitali zitaonekana hapa." />
                                ) : entitlements.length === 0 ? (
                                    <EmptyPane icon={Library} title="No items match your filters" body="Jaribu kubadilisha search, type, au date filter uone matokeo zaidi." />
                                ) : (
                                    entitlements.map((entry) => (
                                        <OwnedCard key={entry.id} entry={entry} />
                                    ))
                                )}
                            </div>
                        )}

                        {libraryMeta.last_page > 1 && (
                            <div className="flex items-center justify-between gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setLibraryPage((p) => Math.max(1, p - 1))}
                                    disabled={libraryPage <= 1 || libraryLoading}
                                >
                                    Previous
                                </Button>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    Page {libraryMeta.current_page} / {libraryMeta.last_page}
                                </p>
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => setLibraryPage((p) => Math.min(libraryMeta.last_page, p + 1))}
                                    disabled={libraryPage >= libraryMeta.last_page || libraryLoading}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'memberships' && (
                    <div className="space-y-3">
                        <div className="flex justify-end">
                            <select
                                value={subscriptionPerPage}
                                onChange={(e) => setSubscriptionPerPage(Number(e.target.value))}
                                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                            >
                                <option value={12}>12 / page</option>
                                <option value={24}>24 / page</option>
                                <option value={48}>48 / page</option>
                            </select>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {subscriptionLoading ? (
                                <div className="md:col-span-2 flex items-center justify-center py-16">
                                    <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                                </div>
                            ) : subscriptions.length === 0 ? (
                                <EmptyPane icon={Crown} title="Hakuna memberships bado" body="Jiunge na subscription plan ili upate access ya muda mrefu kwa bundles na premium content." />
                            ) : (
                                subscriptions.map((subscription) => (
                                    <MembershipCard key={subscription.id} subscription={subscription} onCancel={() => cancelSubscription(subscription.id)} />
                                ))
                            )}
                            {!subscriptionLoading && subscriptionMeta.last_page > 1 && (
                                <div className="md:col-span-2 flex items-center justify-between gap-3 pt-1">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => setSubscriptionPage((p) => Math.max(1, p - 1))}
                                        disabled={subscriptionMeta.current_page <= 1}
                                    >
                                        Previous
                                    </Button>
                                    <p className="text-sm font-semibold text-muted-foreground">
                                        Page {subscriptionMeta.current_page} / {subscriptionMeta.last_page}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => setSubscriptionPage((p) => Math.min(subscriptionMeta.last_page, p + 1))}
                                        disabled={subscriptionMeta.current_page >= subscriptionMeta.last_page}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}

function PulseNotification({ item }) {
    const iconMap = {
        alert: AlertTriangle,
        calendar: CalendarClock,
        check: CheckCircle2,
        crown: Crown,
        download: Download,
        key: KeyRound,
        message_circle: MessageSquare,
        refresh: RefreshCcw,
        receipt: ReceiptText,
        shield_check: ShieldCheck,
        smile: Sparkles,
        shopping_bag: ShoppingBag,
        sparkles: Sparkles,
        truck: Truck,
    };
    const Icon = iconMap[item.icon] || Library;
    const toneClass = {
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        sky: 'bg-sky-50 text-sky-700 border-sky-100',
        violet: 'bg-violet-50 text-violet-700 border-violet-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
    }[item.tone] || 'bg-slate-50 text-slate-600 border-slate-100';

    return (
        <div
            className={[
                'grid gap-3 p-4 md:grid-cols-[auto_1fr] md:items-center md:p-5',
                item.href ? 'cursor-pointer transition-colors hover:bg-muted/30' : '',
            ].join(' ')}
            onClick={() => item.href && router.visit(item.href)}
            role={item.href ? 'button' : undefined}
            tabIndex={item.href ? 0 : undefined}
            onKeyDown={(event) => {
                if (item.href && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    router.visit(item.href);
                }
            }}
        >
            <div className={`h-11 w-11 rounded-2xl border flex items-center justify-center ${toneClass}`}>
                <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-700">{item.eyebrow}</p>
                    {item.status && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            {String(item.status).replaceAll('_', ' ')}
                        </span>
                    )}
                </div>
                <h3 className="mt-1 truncate text-base font-black text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {[item.meta, formatDate(item.date)].filter(Boolean).join(' · ')}
                </p>
            </div>

        </div>
    );
}

function notificationHref(entry) {
    const item = entry.item || {};
    const orderDetails = entry.order_details || null;
    const postRouteKey = item.public_id || item.id;

    if (entry.item_type === 'product' && orderDetails?.public_id) {
        return `/chat/${orderDetails.public_id}`;
    }

    if (entry.item_type === 'content_item') {
        return item.slug ? route('content.show', item.slug) : null;
    }

    if (entry.item_type === 'post') {
        return postRouteKey ? route('post.show', postRouteKey) : null;
    }

    if (entry.item_type === 'bundle') {
        return item.is_course && item.slug ? `/learn/bundles/${item.slug}` : (item.slug ? route('bundle.show', item.slug) : null);
    }

    if (entry.item_type === 'subscription_plan') {
        return item.slug || item.id ? `/plan/${item.slug || item.id}` : null;
    }

    if (entry.item_type === 'product') {
        return item.slug ? route('product.show', item.slug) : null;
    }

    return null;
}

function orderStatusLabel(orderDetails) {
    if (!orderDetails) return 'Product purchase added to your orders.';
    if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'pending') return 'Waiting for the merchant to quote or confirm shipping.';
    if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && !(orderDetails.is_merchant_confirmed || orderDetails.merchant_confirmed_at)) return 'Waiting for the merchant to confirm availability.';
    if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted') return 'Shipping quote is ready for payment.';
    if (orderDetails.payment_status === 'awaiting_merchant_confirmation') return 'Paid order is waiting for merchant confirmation.';
    if (orderDetails.payment_status === 'escrow_locked') return 'Payment is protected while delivery is in progress.';
    if (orderDetails.payment_status === 'resolved_merchant_paid') return 'Order completed and merchant has been paid.';
    if (orderDetails.payment_status === 'disputed') return 'A claim is open for this order.';
    return String(orderDetails.payment_status || 'Order update').replaceAll('_', ' ');
}

function deliveryStatusText(status) {
    const map = {
        inquiry: 'Inasubiri taarifa',
        packing: 'Inaandaliwa',
        ready_for_pickup: 'Tayari kuchukuliwa',
        awaiting_boda: 'Inasubiri usafirishaji',
        awaiting_pickup: 'Inasubiri kuchukuliwa',
        dispatched: 'Imetumwa',
        with_boda: 'Ipo kwa dereva',
        in_transit: 'Ipo njiani',
        arrived: 'Imefika eneo la mteja',
        ready_at_terminal: 'Ipo terminal',
        delivered: 'Imekabidhiwa',
        issue_reported: 'Kuna taarifa ya tatizo',
        disputed: 'Mgogoro',
        customer_confirmed: 'Mteja amethibitisha',
    };

    return map[status] || (status ? String(status).replaceAll('_', ' ') : 'Inaendelea');
}

function isActiveDeliveryStatus(status) {
    return ['with_boda', 'in_transit', 'arrived', 'ready_at_terminal', 'issue_reported'].includes(status);
}

function compactDeliveryStatus(orderDetails) {
    const delivery = orderDetails?.delivery || null;
    const status = delivery?.status || delivery?.delivery_status;
    const type = delivery?.delivery_type || delivery?.type;

    if (!delivery) return null;
    if (type === 'self_pickup') return 'Kuchukua dukani';
    if (status === 'delivered' || orderDetails?.payment_status === 'resolved_merchant_paid') return 'Imekabidhiwa';
    if (status === 'ready_at_terminal') return 'Ipo terminal';
    if (status === 'arrived') return 'Imefika eneo la mteja';
    if (status === 'in_transit') return 'Ipo njiani';
    if (status === 'with_boda') return 'Ipo kwa dereva';
    if (status === 'issue_reported') return 'Kuna tatizo kwenye delivery';
    if (status === 'dispatched') return 'Imetumwa';
    if (status === 'packing') return 'Inaandaliwa';
    if (status) return deliveryStatusText(status);

    return null;
}

function serviceStatusLabel(orderDetails) {
    const serviceRequest = orderDetails?.service_request || null;
    if (serviceRequest?.scheduled_at) return `Scheduled for ${new Date(serviceRequest.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`;
    if (serviceRequest?.payment_status === 'held') return 'Payment is protected until the service is confirmed.';
    if (serviceRequest?.payment_status === 'released') return 'Service completed and payment released.';
    return orderStatusLabel(orderDetails);
}

function OwnedCard({ entry }) {
    const item = entry.item || {};
    const merchant = entry.merchant || item.merchant || {};
    const orderDetails = entry.order_details;
    const postRouteKey = item.public_id || item.id;
    const [isDownloading, setIsDownloading] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [showReceiptConfirmModal, setShowReceiptConfirmModal] = useState(false);
    const [confirmingReceipt, setConfirmingReceipt] = useState(false);
    const [showDescriptionModal, setShowDescriptionModal] = useState(false);
    const [revisionMessage, setRevisionMessage] = useState('');
    const [revisionSubmitting, setRevisionSubmitting] = useState(false);

    // Dispute state
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const [unboxingVideo, setUnboxingVideo] = useState(null);
    const [disputeSubmitting, setDisputeSubmitting] = useState(false);
    const [payingInquiry, setPayingInquiry] = useState(false);

    const isDigitalProduct = entry.item_type === 'product' && item.type === 'digital';
    const isCustomDeliveryProduct = isDigitalProduct && item.digital_delivery_type === 'custom_delivery';
    const isServiceProduct = entry.item_type === 'product' && item.type === 'service';
    const disputeAllowsOptionalEvidence = isServiceProduct || isCustomDeliveryProduct;
    const serviceRequest = orderDetails?.service_request || null;
    const customDelivery = orderDetails?.custom_delivery || null;
    const customRevisionLimit = Number(customDelivery?.revision_limit || 3);
    const customRevisionCount = Number(customDelivery?.revision_count || 0);
    const customRevisionRemaining = Math.max(customRevisionLimit - customRevisionCount, 0);
    const customRevisionLimitReached = customRevisionRemaining <= 0;
    const customDeliveryDueDate = customDelivery?.due_at ? new Date(customDelivery.due_at) : null;
    const customDeliveryDueLabel = customDeliveryDueDate && !Number.isNaN(customDeliveryDueDate.valueOf())
        ? customDeliveryDueDate.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null;
    const customDeliveryIsOverdue = customDeliveryDueDate && !customDelivery?.delivered_at && customDeliveryDueDate.getTime() < Date.now();
    const deliveryEvents = Array.isArray(orderDetails?.delivery?.events) ? orderDetails.delivery.events : [];
    const latestDeliveryEvent = deliveryEvents.length ? deliveryEvents[deliveryEvents.length - 1] : null;
    const activeDeliveryLabel = compactDeliveryStatus(orderDetails);
    const isDeliveryActive = isActiveDeliveryStatus(orderDetails?.delivery?.status || orderDetails?.delivery?.delivery_status);
    const hasReview = Boolean(orderDetails?.review?.id);
    const refundPolicy = orderDetails?.refund_policy || null;
    const canOpenRefundClaim = !refundPolicy || refundPolicy.status === 'eligible';
    const shouldShowRefundPolicy = refundPolicy && (canOpenRefundClaim || (!isDeliveryActive && orderDetails?.payment_status !== 'escrow_locked'));
    const refundPolicyTone = canOpenRefundClaim
        ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
        : 'border-amber-100 bg-amber-50 text-amber-900';
    const reportTarget = orderDetails?.id
        ? {
            itemType: 'order',
            itemId: orderDetails.id,
            context: isCustomDeliveryProduct ? 'custom_work' : (isDigitalProduct ? 'download_abuse' : 'order'),
        }
        : {
            itemType: entry.item_type,
            itemId: item.id || entry.item_id,
            context: entry.item_type === 'subscription_plan'
                ? 'membership'
                : entry.item_type === 'post'
                    ? 'feed_post'
                    : entry.item_type === 'content_item'
                        ? 'premium_content'
                        : entry.item_type,
        };

    const handlePayInquiry = async (orderId) => {
        const chatTarget = orderDetails?.public_id ? `/chat/${orderDetails.public_id}?checkout=1` : null;
        if (chatTarget) {
            router.visit(chatTarget);
            return;
        }

        toast.error('Fungua order chat ili kukamilisha malipo.');
    };
    const orderId = entry.source_type === 'order' ? entry.source_id : null;
    const merchantConfirmed = Boolean(orderDetails?.is_merchant_confirmed || orderDetails?.merchant_confirmed_at);
    const orderChatUrl = orderDetails?.public_id ? `/chat/${orderDetails.public_id}?acting_as=buyer` : null;
    const targetUrl = String(item.url || item.download_link || '').trim();
    const isLinkDigital = isDigitalProduct && /^[a-z][a-z0-9+\-.]*:\/\//i.test(targetUrl);
    const shouldOpenProtectedStreamInModal = isDigitalProduct
        && ['video_stream', 'audio_stream'].includes(item.digital_delivery_type)
        && !item.allow_download;
    const isTemporaryAccess = Boolean(entry.is_temporary_access || entry.expires_at);
    const accessTimeLeft = useSubscriptionCountdown(entry.expires_at);
    const accessExpiresLabel = entry.expires_at
        ? new Date(entry.expires_at).toLocaleString('sw-TZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;
    const sourceLabel = entry.access_label || String(entry.source_type || 'access').replaceAll('_', ' ');
    const isSubscriptionDigitalAccess = isDigitalProduct && !orderId;
    const fullDescription = String(item.description || item.excerpt || item.body || '').trim();
    const canShowDescription = fullDescription.length > 0;

    const confirmReceiptCopy = (() => {
        if (isCustomDeliveryProduct) {
            return {
                title: 'Accept Custom Work?',
                body: 'Confirm only if you are happy with this custom delivery. Takeer will release the held payment to the creator.',
                cancel: 'Keep Reviewing',
                confirm: 'Accept Custom Work',
            };
        }
        if (isServiceProduct) {
            return {
                title: 'Confirm Service Complete?',
                body: 'Confirm only if the service was delivered as agreed. Takeer will release the held payment to the provider.',
                cancel: 'Not Yet',
                confirm: 'Release Payment',
            };
        }

        return {
            title: 'Confirm Receipt?',
            body: 'Confirm only if you received the item and it is in good condition. Takeer will release the held payment to the seller.',
            cancel: 'Keep Checking',
            confirm: 'Confirm Receipt',
        };
    })();

    const handleConfirmReceipt = () => {
        setShowReceiptConfirmModal(true);
    };

    const submitConfirmReceipt = async () => {
        setConfirmingReceipt(true);
        try {
            await axios.post(`/api/buyer/orders/${orderDetails.id}/confirm-receipt`);
            toast.success('Hifadhi imethibitishwa! Asante.');
            setShowReceiptConfirmModal(false);
            window.location.reload(); // Refresh to update status
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kudhibitisha.');
        } finally {
            setConfirmingReceipt(false);
        }
    };

    const handleFileDispute = async (e) => {
        e.preventDefault();
        if (!disputeReason || (!disputeAllowsOptionalEvidence && !unboxingVideo)) return;
        setDisputeSubmitting(true);
        const formData = new FormData();
        if (unboxingVideo) formData.append('unboxing_video', unboxingVideo);
        formData.append('reason', disputeReason);
        try {
            await axios.post(`/api/buyer/orders/${orderDetails.id}/dispute`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Mgogoro umefunguliwa. Tutawasiliana nawe.');
            setShowDisputeModal(false);
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kufungua mgogoro.');
        } finally {
            setDisputeSubmitting(false);
        }
    };

    const handleRequestRevision = async () => {
        if (!orderDetails?.id || !revisionMessage.trim()) return;
        setRevisionSubmitting(true);
        try {
            await axios.post(`/api/buyer/orders/${orderDetails.id}/request-revision`, {
                message: revisionMessage.trim(),
            });
            toast.success('Revision request sent.');
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kutuma revision request.');
        } finally {
            setRevisionSubmitting(false);
        }
    };

    const labelMap = {
        content_item: { icon: BookOpenText, label: 'Post Content', href: item.slug ? route('content.show', item.slug) : null },
        post: { icon: BookOpenText, label: 'Post Content', href: postRouteKey ? route('post.show', postRouteKey) : null },
        bundle: {
            icon: item.is_course ? BookOpenText : Boxes,
            label: item.is_course ? 'Course' : 'Bundle',
            href: item.is_course && item.slug ? `/learn/bundles/${item.slug}` : (item.slug ? route('bundle.show', item.slug) : null),
        },
        subscription_plan: { icon: Crown, label: 'Membership', href: item.slug || item.id ? `/plan/${item.slug || item.id}` : null },
        product: { icon: ShoppingBag, label: 'Physical Product', href: item.slug ? route('product.show', item.slug) : null },
        offering_group: { icon: ShoppingBag, label: 'Menu Order', href: item.slug ? `/offerings/${item.id}` : null },
    };

    let config = labelMap[entry.item_type] || { icon: Library, label: entry.item_type, href: null };
    if (entry.item_type === 'product') {
        if (item.type === 'service') {
            config = { ...config, icon: CalendarClock, label: 'Service/Booking' };
        } else if (isCustomDeliveryProduct) {
            config = { ...config, icon: Sparkles, label: 'Custom Work' };
        } else if (isDigitalProduct && !isLinkDigital) {
            config = { ...config, icon: Download, label: 'Digital File' };
        } else if (isLinkDigital) {
            config = { ...config, icon: ExternalLink, label: 'Digital File' };
        } else {
            config = { ...config, icon: ShoppingBag, label: 'Physical Product' };
        }
    }
    const Icon = config.icon;

    const handleDownload = async () => {
        if (!isDigitalProduct) return;

        if (entry.id || orderId) {
            window.dispatchEvent(new CustomEvent('takeer:digital-ready', {
                detail: {
                    entitlementId: entry.id || null,
                    orderId: entry.id ? null : orderId,
                    productTitle: item.title || item.name || 'Premium media',
                    itemId: item.id || entry.item_id,
                },
            }));
            return;
        }

        setIsDownloading(true);
        try {
            // Prefer session cookie auth for consistency with Buyer Hub data fetches.
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;

            const res = await sessionApi.get(`/orders/${orderId}/download`);
            if (res.status === 202 || res.data?.type === 'custom_pending') {
                toast.info(res.data?.message || 'Merchant bado anaandaa custom delivery yako.');
                return;
            }
            const targetUrl = res.data?.url;

            if (!targetUrl) {
                throw new Error('Hakuna kiungo cha kupakua kilichopatikana.');
            }

            window.open(targetUrl, '_blank', 'noopener,noreferrer');
            toast.success(res.data?.message || 'Kiungo cha kupakua kiko tayari.');
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Imeshindwa kuandaa upakuaji.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Card className="relative overflow-hidden rounded-[24px] border-border/70">
            {/* Card Header — show product image if available, else gradient */}
            {(() => {
                const imgUrl = item.image_url || item.url || item.cover_image || item.thumbnail;
                const isImg = imgUrl && !/^(private:\/\/|https?:\/\/.+\.(mp4|webm|ogg|mov))/i.test(imgUrl);
                return isImg ? (
                    <div className="h-36 relative overflow-hidden bg-slate-100">
                        <img
                            src={imgUrl}
                            alt={item.title || 'Item'}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
                    </div>
                ) : (
                    <div className="h-28 bg-gradient-to-br from-brand-50 via-sky-50 to-emerald-50" />
                );
            })()}
            {orderChatUrl && (
                <button
                    type="button"
                    onClick={() => router.visit(orderChatUrl)}
                    className="absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-white/90 text-brand-700 shadow-lg shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:bg-brand-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-brand-200"
                    title="Fungua order chat"
                    aria-label="Fungua order chat"
                >
                    <MessageSquare className="h-5 w-5" strokeWidth={2.8} />
                </button>
            )}
            <CardContent className="p-5 -mt-10 relative">
                <div className="h-14 w-14 bg-background border shadow-sm flex items-center justify-center rounded-2xl">
                    <Icon className="h-6 w-6 text-brand-600" />
                </div>
                <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-700">{config.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${isTemporaryAccess ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                            {sourceLabel}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => canShowDescription && setShowDescriptionModal(true)}
                        disabled={!canShowDescription}
                        className="mt-2 block w-full text-left disabled:cursor-default"
                    >
                        <h3 className="text-lg font-black leading-tight transition-colors hover:text-brand-700">
                            {item.title || item.name || 'Owned item'}
                        </h3>
                        {canShowDescription && (
                            <p className="mt-2 text-sm text-muted-foreground leading-6 line-clamp-2">
                                {fullDescription}
                            </p>
                        )}
                    </button>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">
                        Added {formatDate(entry.granted_at || entry.starts_at)}
                    </p>
                    <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isTemporaryAccess ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-sky-100 bg-sky-50 text-sky-800'}`}>
                        <p className="shrink-0 font-black uppercase tracking-widest">
                            {isTemporaryAccess ? 'Membership item' : 'Owned item'}
                        </p>
                        <p className="min-w-0 truncate font-semibold">
                            {isTemporaryAccess
                                ? `Active${accessTimeLeft ? ` · ${accessTimeLeft}` : ''}${accessExpiresLabel ? ` · ends ${accessExpiresLabel}` : ''}`
                                : 'Saved in your library.'}
                        </p>
                    </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5" />
                        {merchant.name || 'Merchant'}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                        Active
                    </span>
                </div>

                <div className="mt-5">
                    {isCustomDeliveryProduct ? (
                        <div className="space-y-3">
                            <div className={`rounded-2xl border p-3 ${customDelivery?.delivered_at ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${customDelivery?.delivered_at ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {customDelivery?.status === 'revision_requested'
                                        ? 'Revision requested'
                                        : customDelivery?.status === 'accepted'
                                            ? 'Accepted'
                                            : customDelivery?.delivered_at
                                                ? 'Delivered for review'
                                                : 'In production'}
                                </p>
                                <p className="mt-1 min-w-0 truncate text-sm font-bold" title={customDelivery?.file_name || undefined}>
                                    {customDelivery?.file_name || 'Merchant is preparing your custom delivery.'}
                                </p>
                                {customDelivery?.message && (
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground whitespace-pre-line">{customDelivery.message}</p>
                                )}
                                {customDeliveryDueLabel && (
                                    <p className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${customDeliveryIsOverdue ? 'text-red-700' : 'text-muted-foreground'}`}>
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        Due {customDeliveryDueLabel}
                                    </p>
                                )}
                                {customDelivery?.revision_message && (
                                    <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-amber-900">
                                        Revision note: {customDelivery.revision_message}
                                    </p>
                                )}
                            </div>

                            {customDelivery?.delivered_at && (
                                <Button className="w-full rounded-2xl" onClick={handleDownload} disabled={isDownloading}>
                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Download Delivery
                                </Button>
                            )}

                            {orderDetails?.payment_status === 'escrow_locked' && !customDelivery?.delivered_at && customDeliveryIsOverdue && (
                                <Button variant="outline" className="w-full rounded-xl text-red-600 border-red-200" onClick={() => setShowDisputeModal(true)} disabled={!canOpenRefundClaim}>
                                    Dispute missed deadline
                                </Button>
                            )}

                            {orderDetails?.payment_status === 'escrow_locked' && customDelivery?.delivered_at && customDelivery?.status !== 'accepted' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" className="rounded-xl text-red-600 border-red-200" onClick={() => setShowDisputeModal(true)} disabled={!canOpenRefundClaim}>
                                            Dispute
                                        </Button>
                                        <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmReceipt} disabled={confirmingReceipt}>
                                            {confirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept Work'}
                                        </Button>
                                    </div>
                                    <textarea
                                        value={revisionMessage}
                                        onChange={(e) => setRevisionMessage(e.target.value)}
                                        rows={3}
                                        placeholder={customRevisionLimitReached ? 'Revision limit reached. Accept the work or open a dispute.' : 'Need changes? Tell the creator what to revise...'}
                                        disabled={customRevisionLimitReached}
                                        className="w-full rounded-2xl border border-input bg-background p-3 text-sm"
                                    />
                                    <p className="text-[11px] font-semibold text-muted-foreground">
                                        {customRevisionRemaining} of {customRevisionLimit} revision requests remaining
                                    </p>
                                    <Button variant="outline" className="w-full rounded-xl" onClick={handleRequestRevision} disabled={customRevisionLimitReached || revisionSubmitting || revisionMessage.trim().length < 10}>
                                        {revisionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                        Request Revision
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : isDigitalProduct ? (
                        <Button className="w-full rounded-2xl" onClick={handleDownload} disabled={isDownloading}>
                            {isDownloading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Preparing...
                                </>
                            ) : isSubscriptionDigitalAccess ? (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open Access
                                </>
                            ) : isLinkDigital ? (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open Link
                                </>
                            ) : shouldOpenProtectedStreamInModal ? (
                                <>
                                    <BookOpenText className="mr-2 h-4 w-4" />
                                    Open
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </>
                            )}
                        </Button>
                    ) : isServiceProduct ? (
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-800">Miadi</p>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${serviceRequest?.payment_status === 'released' || orderDetails?.payment_status === 'resolved_merchant_paid'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : serviceRequest?.payment_status === 'disputed' || orderDetails?.payment_status === 'disputed'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {serviceRequest?.payment_status === 'released' || orderDetails?.payment_status === 'resolved_merchant_paid'
                                            ? 'Imekamilika'
                                            : serviceRequest?.payment_status === 'held'
                                                ? 'SafePay'
                                                : serviceRequest?.payment_status === 'disputed'
                                                    ? 'Mgogoro'
                                                    : (serviceRequest?.payment_status || orderDetails?.payment_status || 'Pending').replaceAll('_', ' ')}
                                    </span>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Muda</span>
                                        <span className="font-black text-right">
                                            {serviceRequest?.scheduled_at
                                                ? new Date(serviceRequest.scheduled_at).toLocaleString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                                                : [serviceRequest?.preferred_date, serviceRequest?.preferred_time].filter(Boolean).join(' ') || 'Mtoa huduma atathibitisha'}
                                        </span>
                                    </div>
                                    {serviceRequest?.service_option?.name && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Option</span>
                                            <span className="font-black text-right">{serviceRequest.service_option.name}</span>
                                        </div>
                                    )}
                                    {serviceRequest?.location_text && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Mahali</span>
                                            <span className="font-black text-right">{serviceRequest.location_text}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Malipo</span>
                                        <span className="font-black text-right">TZS {Number(orderDetails?.total_paid || serviceRequest?.quoted_amount || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            {serviceRequest?.delivery_status === 'provider_marked_delivered' && orderDetails?.payment_status === 'escrow_locked' ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
                                        onClick={() => setShowDisputeModal(true)}
                                        disabled={!canOpenRefundClaim}
                                    >
                                        Fungua Mgogoro
                                    </Button>
                                    <Button
                                        className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={handleConfirmReceipt}
                                        disabled={confirmingReceipt}
                                    >
                                        {confirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nimepata Huduma'}
                                    </Button>
                                </div>
                            ) : serviceRequest?.payment_status === 'held' ? (
                                <p className="text-xs text-muted-foreground text-center">
                                    Malipo yako yako SafePay hadi uthibitishe huduma.
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground text-center">
                                    Umeweka miadi. Mtoa huduma atakujulisha mabadiliko.
                                </p>
                            )}
                            {['held', 'disputed'].includes(serviceRequest?.payment_status) && (
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                                    <p className="font-black flex items-center gap-1.5">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        Ulinzi wa SafePay
                                    </p>
                                    <p className="mt-1">
                                        Takeer hushikilia malipo hadi uthibitishe huduma. Ukiweka mgogoro, malipo yatasimama hadi timu yetu ikague ushahidi.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : orderDetails ? (
                        <div className="space-y-3">
                            {orderDetails.unit_snapshot && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">Kiasi</p>
                                        <p className="mt-1 text-sm font-black text-brand-900">{orderQuantityLabel(orderDetails)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-brand-100 bg-white p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">Bei</p>
                                        <p className="mt-1 text-sm font-black text-brand-900">{orderUnitPriceLabel(orderDetails)}</p>
                                    </div>
                                </div>
                            )}
                            {/* Shipping Status Badge */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-muted-foreground/10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {activeDeliveryLabel ? 'Delivery:' : 'Shipping:'}
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${orderDetails.payment_status === 'resolved_merchant_paid' ? 'text-green-600' :
                                    orderDetails.payment_status === 'disputed' ? 'text-red-600' :
                                        orderDetails.payment_status === 'failed' ? 'text-red-600' :
                                            'text-amber-600'
                                    }`}>
                                    {(() => {
                                        const delivType = orderDetails.delivery?.delivery_type || orderDetails.delivery?.type;
                                        const deliveryLabel = compactDeliveryStatus(orderDetails);
                                        // Final status takes precedence
                                        if (orderDetails.payment_status === 'resolved_merchant_paid') return 'Imekamilika';
                                        if (orderDetails.payment_status === 'failed') return 'Imesitishwa';
                                        if (orderDetails.payment_status === 'confirmed') return 'Imepokelewa';
                                        if (orderDetails.payment_status === 'disputed') return 'Mgogoro';
                                        if (deliveryLabel && delivType !== 'self_pickup') return deliveryLabel;

                                        // Inquiry pending — merchant hasn't set shipping yet
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'pending') return 'Inasubiri Bei ya Usafiri';
                                        // Inquiry quoted — shipping fee provided, waiting for buyer to pay
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && !merchantConfirmed) return 'Inasubiri Uthibitisho';
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted') {
                                            if (['awaiting_merchant_confirmation', 'escrow_locked', 'shipped'].includes(orderDetails.payment_status)) return 'Imelipwa — Inasubiri Utumaji';
                                            return 'Bei Imewekwa — Lipia Sasa';
                                        }
                                        // Self pickup orders
                                        if (delivType === 'self_pickup') return 'Kuchukua Dukani';
                                        // Shipping statuses
                                        if (orderDetails.payment_status === 'awaiting_merchant_confirmation') return 'Inasubiri Utumaji';
                                        if (orderDetails.payment_status === 'escrow_locked') return deliveryStatusText(orderDetails.delivery?.status);
                                        if (orderDetails.payment_status === 'shipped') return 'Imetumwa';
                                        // Fallback: show delivery type if known
                                        if (delivType) return delivType.replace(/_/g, ' ');
                                        return orderDetails.payment_status?.replace(/_/g, ' ') || 'Inaendelea';
                                    })()}
                                </span>
                            </div>

                            {latestDeliveryEvent && (
                                <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Taarifa ya delivery</p>
                                            <p className="mt-0.5 truncate text-xs font-black text-slate-950">
                                                {deliveryStatusText(latestDeliveryEvent.status)}
                                            </p>
                                            {latestDeliveryEvent.note && (
                                                <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-muted-foreground">{latestDeliveryEvent.note}</p>
                                            )}
                                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                {latestDeliveryEvent.created_at ? new Date(latestDeliveryEvent.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                                                {deliveryEvents.length > 1 ? ` · ${deliveryEvents.length} updates` : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Inquiry Action for Buyer */}
                            {orderDetails.is_inquiry && orderDetails.inquiry_status === 'pending' && orderDetails.payment_status === 'pending' && (
                                <div className="p-3 rounded-2xl bg-brand-50 border border-brand-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-brand-700 mb-1 leading-tight">Muuzaji bado hajakupa bei ya usafiri.</p>
                                    <p className="text-[10px] text-brand-800 leading-tight mb-3">Tumia chat hapa chini kukubaliana naye bei ya usafiri.</p>
                                    <Button
                                        variant="outline"
                                        className="w-full text-xs font-bold border-brand-200 text-brand-700 hover:bg-brand-100"
                                        onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Fungua Chat
                                    </Button>
                                </div>
                            )}

                            {orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && !merchantConfirmed && orderDetails.payment_status === 'pending' && (
                                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-amber-800 mb-1 leading-tight">Muuzaji bado hajathibitisha oda.</p>
                                    <p className="text-[10px] text-amber-900 leading-tight mb-3">Malipo yatafunguka baada ya muuzaji kuthibitisha kuwa order ipo.</p>
                                    <Button
                                        variant="outline"
                                        className="w-full text-xs font-bold border-amber-200 text-amber-800 hover:bg-amber-100"
                                        onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Fungua Chat
                                    </Button>
                                </div>
                            )}

                            {orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && merchantConfirmed && orderDetails.payment_status === 'pending' && (
                                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-[10px] font-black uppercase text-emerald-700">Shipping Fee:</p>
                                        <p className="text-sm font-black text-emerald-600">TZS {Number(orderDetails.shipping_fee || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-emerald-200 pt-2 mb-3">
                                        <p className="text-[10px] font-black uppercase text-emerald-800">Total to Pay:</p>
                                        <p className="text-lg font-black text-emerald-700">TZS {Number(orderDetails.total_paid || 0).toLocaleString()}</p>
                                    </div>
                                    <Button
                                        className="w-full rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20"
                                        onClick={() => handlePayInquiry(orderDetails.id)}
                                        disabled={payingInquiry}
                                    >
                                        {payingInquiry ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2 fill-white" />}
                                        Lipa Sasa (Pay Now)
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="w-full mt-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                                        onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Rudi kwenye Chat
                                    </Button>
                                </div>
                            )}

                            {/* PIN Display for Escrow */}
                            {['awaiting_merchant_confirmation', 'escrow_locked'].includes(orderDetails.payment_status) && orderDetails.delivery?.type === 'self_pickup' && orderDetails.delivery?.pickup_pin && (
                                <div className="p-3 rounded-2xl bg-brand-50 border border-brand-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-brand-700 mb-1">Your Pickup PIN</p>
                                    <p className="text-xl font-mono font-black tracking-widest text-brand-600">
                                        {showPin ? orderDetails.delivery.pickup_pin : '****'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        className="mt-1 text-[10px] font-bold text-brand-500 underline uppercase tracking-widest"
                                    >
                                        {showPin ? 'Hide PIN' : 'Reveal PIN'}
                                    </button>
                                    <p className="mt-2 text-[10px] text-brand-800 leading-tight">Mpe hii PIN boda wako. Atampa muuzaji mzigo unapochukuliwa.</p>
                                </div>
                            )}

                            {['awaiting_merchant_confirmation', 'escrow_locked', 'shipped'].includes(orderDetails.payment_status) && orderDetails.delivery?.type !== 'self_pickup' && orderDetails.delivery?.buyer_release_pin && (
                                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-indigo-700 mb-1">Your Release PIN</p>
                                    <p className="text-xl font-mono font-black tracking-widest text-indigo-600">
                                        {showPin ? orderDetails.delivery.buyer_release_pin : '****'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        className="mt-1 text-[10px] font-bold text-indigo-500 underline uppercase tracking-widest"
                                    >
                                        {showPin ? 'Hide PIN' : 'Reveal PIN'}
                                    </button>
                                    <p className="mt-2 text-[10px] text-indigo-800 leading-tight">Mpe msafirishaji/muuzaji PIN hii baada ya kupokea na kukagua mzigo wako.</p>
                                </div>
                            )}

                            {/* Escrow Actions */}
                            {['escrow_locked', 'shipped'].includes(orderDetails.payment_status) && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 rounded-xl h-10 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50"
                                        onClick={() => setShowDisputeModal(true)}
                                        disabled={!canOpenRefundClaim}
                                    >
                                        File Claim
                                    </Button>
                                    <Button
                                        className="flex-1 rounded-xl h-10 text-xs font-bold bg-green-600 hover:bg-green-700 text-white"
                                        onClick={handleConfirmReceipt}
                                        disabled={confirmingReceipt}
                                    >
                                        {confirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : 'Confirm Receipt'}
                                    </Button>
                                </div>
                            )}

                            {!hasReview && (orderDetails.payment_status === 'confirmed' || orderDetails.payment_status === 'resolved_merchant_paid') && (
                                <Button
                                    className="w-full h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px]"
                                    onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                >
                                    Leave Review
                                </Button>
                            )}

                            {orderDetails.payment_status === 'disputed' && (
                                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-center">
                                    <p className="text-xs font-black text-red-700 uppercase">Mgogoro Unaendelea</p>
                                    <p className="text-[10px] text-red-600 mt-1 leading-tight">Timu yetu inafanyia kazi ombi lako la kurejeshewa pesa au kubadilisha bidhaa.</p>
                                </div>
                            )}
                        </div>
                    ) : config.href ? (
                        <Link href={config.href}>
                            <Button className="w-full rounded-2xl">
                                Open
                            </Button>
                        </Link>
                    ) : (
                        <Button className="w-full rounded-2xl" disabled>Open</Button>
                    )}
                </div>

                {shouldShowRefundPolicy && (
                    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${refundPolicyTone}`}>
                        <p className="font-black uppercase tracking-widest">
                            {canOpenRefundClaim ? 'Refund review available' : 'Refund claim unavailable'}
                        </p>
                        <p className="mt-1 truncate font-semibold">
                            {canOpenRefundClaim ? 'You can open a claim while SafePay holds funds.' : 'Claim is closed for this order.'}
                        </p>
                        {refundPolicy.window_ends_at && (
                            <p className="mt-1 font-bold">Ends {new Date(refundPolicy.window_ends_at).toLocaleDateString()}</p>
                        )}
                        {Number(refundPolicy.download_count || 0) > 0 && (
                            <p className="mt-1 font-bold">Accessed {refundPolicy.download_count}x</p>
                        )}
                    </div>
                )}

                {reportTarget.itemId && (
                    <div className="mt-3">
                        <ContentReportButton
                            itemType={reportTarget.itemType}
                            itemId={reportTarget.itemId}
                            merchantId={merchant.id || item.merchant_id || null}
                            context={reportTarget.context}
                            label={isCustomDeliveryProduct ? 'Report Custom Work' : 'Report Issue'}
                        />
                    </div>
                )}

                {/* Dispute Modal */}
                {showDisputeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-background rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 md:p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center">
                                        <ShieldCheck className="h-6 w-6 text-red-600" />
                                    </div>
                                    <button onClick={() => setShowDisputeModal(false)} className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black tracking-tight">{isServiceProduct ? 'Fungua Mgogoro' : 'File a Claim'}</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {disputeAllowsOptionalEvidence
                                            ? 'Eleza kilichotokea. Unaweza kuongeza picha, video au PDF kama ushahidi.'
                                            : 'Tafadhali pakia video ya unboxing na maelezo ya kwanini unataka kurudisha mzigo au kurudishiwa pesa.'}
                                    </p>
                                </div>

                                <form onSubmit={handleFileDispute} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                            {disputeAllowsOptionalEvidence ? 'Ushahidi (si lazima)' : 'Unboxing Video (Required)'}
                                        </label>
                                        {disputeAllowsOptionalEvidence && (
                                            <p className="text-xs leading-5 text-muted-foreground">
                                                Unaweza kuweka picha, video au PDF. Mgogoro ukitumwa, Takeer itaendelea kushikilia malipo hadi ushahidi ukaguliwe.
                                            </p>
                                        )}
                                        <input
                                            type="file"
                                            accept={disputeAllowsOptionalEvidence ? 'image/*,video/*,application/pdf' : 'video/*'}
                                            onChange={e => setUnboxingVideo(e.target.files?.[0])}
                                            required={!disputeAllowsOptionalEvidence}
                                            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                            {isServiceProduct ? 'Sababu ya mgogoro' : 'Reason for Dispute'}
                                        </label>
                                        <textarea
                                            required
                                            value={disputeReason}
                                            onChange={e => setDisputeReason(e.target.value)}
                                            placeholder={isCustomDeliveryProduct ? 'Mf. Naomba ubadilishe sehemu hii, au faili si kama tulivyokubaliana...' : (isServiceProduct ? 'Mf. Huduma haikutolewa kama tulivyokubaliana...' : 'Mf. Bidhaa iliyofika imevunjika...')}
                                            className="w-full min-h-[100px] rounded-2xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-500/20" disabled={disputeSubmitting}>
                                        {disputeSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : (isServiceProduct ? 'TUMA MGOGORO' : 'SUBMIT CLAIM')}
                                    </Button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {showReceiptConfirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-background rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 space-y-5">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-black tracking-tight">{confirmReceiptCopy.title}</h2>
                                    <p className="text-sm leading-6 text-muted-foreground">{confirmReceiptCopy.body}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => setShowReceiptConfirmModal(false)}
                                        disabled={confirmingReceipt}
                                    >
                                        {confirmReceiptCopy.cancel}
                                    </Button>
                                    <Button
                                        type="button"
                                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={submitConfirmReceipt}
                                        disabled={confirmingReceipt}
                                    >
                                        {confirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmReceiptCopy.confirm}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DescriptionModal
                    open={showDescriptionModal}
                    onClose={() => setShowDescriptionModal(false)}
                    title={item.title || item.name || 'Owned item'}
                    label={config.label}
                    description={fullDescription}
                />
            </CardContent>
        </Card>
    );
}

function DescriptionModal({ open, onClose, title, label, description }) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg overflow-hidden rounded-t-[28px] border border-white/70 bg-white shadow-2xl sm:rounded-[28px]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">{label}</p>
                        <h2 className="mt-1 text-xl font-black leading-tight text-slate-950">{title}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                        aria-label="Close description"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="max-h-[62vh] overflow-y-auto px-5 py-5">
                    <p className="whitespace-pre-line break-words text-base leading-8 text-slate-700">
                        {description}
                    </p>
                </div>
                <div className="border-t border-slate-100 px-5 py-4">
                    <Button type="button" className="w-full rounded-2xl" onClick={onClose}>
                        Okay
                    </Button>
                </div>
            </div>
        </div>
    );
}

function MembershipCard({ subscription, onCancel }) {
    const plan = subscription.plan || {};
    const merchant = subscription.merchant || {};
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    const isExpiredByTime = periodEnd && !Number.isNaN(periodEnd.valueOf()) && periodEnd.getTime() <= Date.now();
    const displayStatus = isExpiredByTime ? 'expired' : (subscription.status || 'active');
    const isActiveStatus = ['active', 'pending', 'past_due'].includes(displayStatus);
    const statusTone = isActiveStatus
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-rose-50 text-rose-700';
    const iconTone = isActiveStatus
        ? 'border-emerald-100 bg-emerald-50 text-emerald-700 shadow-emerald-900/5'
        : 'border-rose-100 bg-rose-50 text-rose-700 shadow-rose-900/5';
    const periodTone = isActiveStatus
        ? 'border-emerald-100 bg-emerald-50/80 text-emerald-900'
        : 'border-rose-100 bg-rose-50/80 text-rose-900';
    const periodLabel = isExpiredByTime ? 'Membership expired' : 'Membership active';
    const periodStartLabel = formatDateTime(subscription.current_period_start || subscription.started_at);
    const periodEndLabel = formatDateTime(subscription.current_period_end);
    const billingCadence = formatBillingCadence(plan.billing_interval, plan.interval_count);
    const durationLabel = formatMembershipDuration(plan.billing_interval, plan.interval_count);

    return (
        <Card className="rounded-[24px] border-border/70 overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 border-b border-border/70">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${statusTone}`}>
                            {displayStatus}
                        </span>
                        <h3 className="mt-4 text-2xl font-black">{plan.name || 'Membership plan'}</h3>
                        <p className="mt-2 text-sm text-muted-foreground leading-6">{plan.description || 'Recurring access to premium items.'}</p>
                    </div>
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${iconTone}`}>
                        <Crown className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <InfoChip icon={Store} label="Merchant" value={merchant.display_name || merchant.name || 'Takeer merchant'} />
                    <InfoChip icon={CalendarClock} label="Duration" value={durationLabel} />
                </div>

                <div className={`rounded-2xl border px-4 py-4 ${periodTone}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-widest">{periodLabel}</p>
                        <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                            {billingCadence}
                        </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest opacity-70">Started</p>
                            <p className="mt-1 text-sm font-black">{periodStartLabel}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest opacity-70">{isExpiredByTime ? 'Expired' : 'Ends'}</p>
                            <p className="mt-1 text-sm font-black">{periodEndLabel}</p>
                        </div>
                    </div>
                    <p className="mt-4 text-xs font-semibold leading-5 opacity-80">
                        {isActiveStatus
                            ? 'Subscription items stay available in Orders until this period ends.'
                            : 'Subscription access has ended. Direct purchases remain in your Library.'}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => router.visit(`/plan/${plan.slug || plan.id}`)}>
                        View plan
                    </Button>
                    {isActiveStatus && (
                        <Button className="rounded-2xl bg-red-600 hover:bg-red-700 text-white" onClick={onCancel}>
                            Cancel
                        </Button>
                    )}
                </div>

                {plan.id && (
                    <ContentReportButton
                        itemType="subscription_plan"
                        itemId={plan.id}
                        merchantId={merchant.id || plan.merchant_id || null}
                        context="membership"
                        label="Report Membership"
                    />
                )}
            </CardContent>
        </Card>
    );
}

function InfoChip({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl border bg-background px-4 py-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            <p className="mt-3 text-sm font-bold leading-6">{value}</p>
        </div>
    );
}

function EmptyPane({ icon: Icon, title, body, compact = false }) {
    return (
        <Card className={`rounded-[24px] border-dashed ${compact ? '' : 'md:col-span-2 xl:col-span-3'}`}>
            <CardContent className="p-10 text-center">
                <div className="mx-auto h-14 w-14 bg-muted flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-lg font-black">{title}</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-7">{body}</p>
            </CardContent>
        </Card>
    );
}

function formatDate(value) {
    if (!value) return 'Not set';
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return value;
    }
}

function formatDateTime(value) {
    if (!value) return 'Not set';
    try {
        return new Date(value).toLocaleString('sw-TZ', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
}

function formatBillingCadence(interval = 'month', count = 1) {
    const safeCount = Math.max(1, Number(count || 1));
    const unit = membershipIntervalUnit(interval);
    const plural = safeCount === 1 ? unit : `${unit}s`;

    return safeCount === 1 ? `Every ${unit}` : `Every ${safeCount} ${plural}`;
}

function formatMembershipDuration(interval = 'month', count = 1) {
    const safeCount = Math.max(1, Number(count || 1));
    const unit = membershipIntervalUnit(interval);
    const plural = safeCount === 1 ? unit : `${unit}s`;

    return `${safeCount} ${plural}`;
}

function membershipIntervalUnit(interval = 'month') {
    return {
        hourly: 'hour',
        daily: 'day',
        weekly: 'week',
        monthly: 'month',
        month: 'month',
    }[String(interval || 'month')] || String(interval || 'month');
}
