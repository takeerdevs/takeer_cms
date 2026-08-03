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
    Lock,
    Loader2,
    PackageCheck,
    ShoppingBag,
    Sparkles,
    Store,
    Tag,
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
    Bell,
    BellOff,
    TrendingDown,
    BadgeCheck,
    ArrowUpRight,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import ContentReportButton from '@/Components/ContentReportButton';
import { orderQuantityLabel, orderUnitPriceLabel } from '@/lib/productUnits';
import { useSubscriptionCountdown } from '@/lib/subscriptionCountdown';
import { useLocale } from '@/lib/i18n';

const tabs = [
    { key: 'library', label: 'Library', icon: Library },
    { key: 'cargo', label: 'Cargo', icon: Truck },
    { key: 'memberships', label: 'Memberships', icon: Crown },
    { key: 'following', label: 'Following', icon: Bell },
    { key: 'pulse', label: 'Pulse', icon: Store },
];

export default function Orders() {
    const { auth } = usePage().props;
    const { t, copy } = useLocale();
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
    const [cargoShipments, setCargoShipments] = useState([]);
    const [cargoLoading, setCargoLoading] = useState(false);
    const [followedStores, setFollowedStores] = useState([]);
    const [followingLoading, setFollowingLoading] = useState(false);

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
        if (loading || activeTab !== 'cargo') return;
        loadCargoShipments();
    }, [loading, activeTab]);

    useEffect(() => {
        if (loading || activeTab !== 'following') return;
        loadFollowedStores();
    }, [loading, activeTab]);

    useEffect(() => {
        if (!isMerchant || !auth?.user || !window.Echo) return;

        const channel = window.Echo.private(`merchant.${auth.user.id}`);
        channel.listen('.order.paid', (e) => {
            toast.success(`${copy('New order:', 'Oda Mpya:')} ${e.product_title}`, {
                description: t('orders.paymentReceivedByPsp', { amount: e.amount.toLocaleString() }),
                duration: 8000,
                icon: <ShoppingBag className="text-brand-500" />,
            });

            setMerchantLive((prev) => [{
                id: e.order_id,
                product_title: e.product_title,
                amount: e.amount,
                status: 'pending_fulfillment',
                buyer_phone: e.buyer_phone,
            }, ...prev]);
        });

        return () => {
            window.Echo.leave(`merchant.${auth.user.id}`);
        };
    }, [auth, isMerchant, t]);

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
            toast.error(t('orders.loadLibraryFailed'));
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
            toast.error(t('orders.loadPulseFailed'));
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
            toast.error(t('orders.filterLibraryFailed'));
        } finally {
            setLibraryLoading(false);
        }
    }

    async function loadCargoShipments() {
        setCargoLoading(true);
        try {
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;
            const res = await sessionApi.get('/api/me/forwarder-shipments');
            setCargoShipments(res.data?.shipments || []);
        } catch (error) {
            toast.error(t('orders.loadCargoFailed'));
        } finally {
            setCargoLoading(false);
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
            toast.error(t('orders.loadMembershipsFailed'));
        } finally {
            setSubscriptionLoading(false);
        }
    }

    async function loadFollowedStores() {
        setFollowingLoading(true);
        try {
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;
            const res = await sessionApi.get('/orders/data/followed-stores');
            setFollowedStores(res.data?.data || []);
        } catch (error) {
            toast.error(t('orders.loadFollowingFailed'));
        } finally {
            setFollowingLoading(false);
        }
    }

    async function updateFollowPreferences(slug, preferences) {
        const current = followedStores;
        setFollowedStores((rows) => rows.map((row) => (
            row.merchant?.slug === slug
                ? { ...row, notification_preferences: { ...row.notification_preferences, ...preferences } }
                : row
        )));

        try {
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;
            await sessionApi.patch(`/orders/data/followed-stores/${slug}`, {
                notification_preferences: preferences,
            });
        } catch (error) {
            setFollowedStores(current);
            toast.error(error.response?.data?.message || t('orders.updatePreferencesFailed'));
        }
    }

    async function unfollowStore(slug) {
        const current = followedStores;
        setFollowedStores((rows) => rows.filter((row) => row.merchant?.slug !== slug));

        try {
            const sessionApi = axios.create();
            delete sessionApi.defaults.headers.common.Authorization;
            await sessionApi.delete(`/orders/data/followed-stores/${slug}`);
            toast.success(t('orders.storeUnfollowed'));
        } catch (error) {
            setFollowedStores(current);
            toast.error(error.response?.data?.message || t('orders.unfollowFailed'));
        }
    }

    async function cancelSubscription(id) {
        try {
            await axios.post(`/api/me/subscriptions/${id}/cancel`);
            toast.success(t('orders.subscriptionCancelled'));
            await loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || t('orders.cancelSubscriptionFailed'));
        }
    }

    const stats = useMemo(() => {
        const summary = librarySummary || {};
        const activeSubs = subscriptions.filter((entry) => ['active', 'pending', 'past_due'].includes(entry.status)).length;

        return [
            { label: t('orders.stats.items'), value: Number(summary.total || 0), icon: Library, tone: 'from-amber-500/15 to-orange-500/10 text-amber-700' },
            { label: t('orders.stats.content'), value: Number(summary.content || 0), icon: BookOpenText, tone: 'from-sky-500/15 to-cyan-500/10 text-sky-700' },
            { label: t('orders.stats.purchases'), value: Number(summary.purchases || 0), icon: ShoppingBag, tone: 'from-violet-500/15 to-indigo-500/10 text-violet-700' },
            { label: t('orders.stats.memberships'), value: activeSubs, icon: Crown, tone: 'from-emerald-500/15 to-teal-500/10 text-emerald-700' },
        ];
    }, [librarySummary, subscriptions, t]);

    const pulseLastPage = pulseMeta.last_page || 1;
    const safePulsePage = pulseMeta.current_page || 1;
    const visiblePulseItems = pulseItems;

    useEffect(() => {
        if (pulsePage > pulseLastPage) {
            setPulsePage(pulseLastPage);
        }
    }, [pulsePage, pulseLastPage]);

    const visibleTabs = [
        { key: 'library', label: t('orders.tabs.library'), icon: Library },
        { key: 'cargo', label: t('orders.tabs.cargo'), icon: Truck },
        { key: 'memberships', label: t('orders.tabs.memberships'), icon: Crown },
        { key: 'following', label: t('orders.tabs.following'), icon: Bell },
        { key: 'pulse', label: t('orders.tabs.pulse'), icon: Store },
    ];

    const libraryTypeOptions = [
        { key: 'all', label: t('orders.types.all') },
        { key: 'physical_product', label: t('orders.types.physical') },
        { key: 'post_content', label: t('orders.types.post') },
        { key: 'digital_file', label: t('orders.types.digital') },
        { key: 'service_booking', label: t('orders.types.service') },
    ];

    if (loading) {
        return (
            <AppLayout>
                <Head title={`${t('orders.library')} | Takeer`} />
                <div className="max-w-5xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">{t('orders.loadingLibrary')}</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${t('orders.library')} | Takeer`} />

            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <section className="relative overflow-hidden rounded-[30px] border border-border/70 bg-gradient-to-br from-[#f8fbff] via-[#fffdf7] to-[#f8fff8] shadow-sm">
                    <div className="absolute inset-y-0 right-0 w-64 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_60%)]" />
                    <div className="relative p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                            <div>
                                <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                                    {t('orders.heroTitle')}
                                </h1>
                                <p className="mt-3 max-w-3xl text-sm md:text-base text-slate-600 leading-7">
                                    {t('orders.heroDescription')}
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
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">{t('orders.tabs.pulse')}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {t('orders.pulseDescription')}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {isMerchant && (
                                    <span className={`w-fit text-xs font-black px-3 py-1 rounded-full ${window.Echo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                                        {window.Echo ? t('orders.liveConnected') : t('orders.liveOffline')}
                                    </span>
                                )}
                                <select
                                    value={pulsePerPage}
                                    onChange={(e) => setPulsePerPage(Number(e.target.value))}
                                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                >
                                    <option value={8}>{copy('8 / page', '8 / ukurasa')}</option>
                                    <option value={12}>{copy('12 / page', '12 / ukurasa')}</option>
                                    <option value={24}>{copy('24 / page', '24 / ukurasa')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-border/70 bg-card overflow-hidden">
                            {pulseLoading ? (
                                <div className="flex items-center justify-center gap-3 p-8 text-sm font-semibold text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                                    {t('orders.loadingPulse')}
                                </div>
                            ) : pulseItems.length === 0 ? (
                                <EmptyPane icon={Library} title={t('orders.noPulse')} body={t('orders.noPulseDescription')} compact />
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
                                    {t('orders.showingUpdates', { shown: visiblePulseItems.length, total: pulseMeta.total || 0, page: safePulsePage, pages: pulseLastPage })}
                                </p>
                                {pulseLastPage > 1 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => setPulsePage((p) => Math.max(1, p - 1))}
                                            disabled={safePulsePage <= 1}
                                        >
                                            {t('common.previous')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => setPulsePage((p) => Math.min(pulseLastPage, p + 1))}
                                            disabled={safePulsePage >= pulseLastPage}
                                        >
                                            {t('common.next')}
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
                                    placeholder={t('orders.searchPlaceholder')}
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
                                        <option value="all">{t('orders.date.any')}</option>
                                        <option value="7">{t('orders.date.days7')}</option>
                                        <option value="30">{t('orders.date.days30')}</option>
                                        <option value="90">{t('orders.date.days90')}</option>
                                        <option value="365">{t('orders.date.months12')}</option>
                                    </select>
                                    <select
                                        value={libraryPerPage}
                                        onChange={(e) => setLibraryPerPage(Number(e.target.value))}
                                        className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                                    >
                                        <option value={12}>{copy('12 / page', '12 / ukurasa')}</option>
                                        <option value={24}>{copy('24 / page', '24 / ukurasa')}</option>
                                        <option value={48}>{copy('48 / page', '48 / ukurasa')}</option>
                                    </select>
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                {t('orders.showingLibrary', { shown: entitlements.length, total: libraryMeta.total || 0, all: libraryMeta.unfiltered_total || 0 })}
                            </p>
                        </div>

                        {libraryLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {libraryMeta.unfiltered_total === 0 ? (
                                    <EmptyPane icon={Library} title={t('orders.emptyLibrary')} body={t('orders.emptyLibraryDescription')} />
                                ) : entitlements.length === 0 ? (
                                    <EmptyPane icon={Library} title={t('orders.noLibraryMatches')} body={t('orders.noLibraryMatchesDescription')} />
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
                                    {t('common.pageOf', { page: libraryMeta.current_page, pages: libraryMeta.last_page })}
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

                {activeTab === 'following' && (
                    <section className="space-y-3">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-slate-900">{t('orders.tabs.following')}</h2>
                            <p className="text-sm text-muted-foreground">
                                {t('orders.followingDescription')}
                            </p>
                        </div>

                        <div className="rounded-[24px] border border-border/70 bg-card overflow-hidden">
                            {followingLoading ? (
                                <div className="flex items-center justify-center gap-3 p-8 text-sm font-semibold text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                                    {t('orders.loadingFollowing')}
                                </div>
                            ) : followedStores.length === 0 ? (
                                <EmptyPane icon={BellOff} title={t('orders.noFollowing')} body={t('orders.noFollowingDescription')} compact />
                            ) : (
                                <div className="divide-y divide-border/70">
                                    {followedStores.map((row) => (
                                        <FollowedStoreRow
                                            key={row.id}
                                            row={row}
                                            onPreferenceChange={updateFollowPreferences}
                                            onUnfollow={unfollowStore}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {activeTab === 'cargo' && (
                    <section className="space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">{t('orders.tabs.cargo')}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {t('orders.cargoDescription')}
                                </p>
                            </div>
                            <Button type="button" variant="outline" className="rounded-xl" onClick={loadCargoShipments} disabled={cargoLoading}>
                                {cargoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                                {t('common.refresh')}
                            </Button>
                        </div>

                        {cargoLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                            </div>
                        ) : cargoShipments.length === 0 ? (
                            <EmptyPane icon={Truck} title={t('orders.noCargo')} body={t('orders.noCargoDescription')} />
                        ) : (
                            <div className="grid gap-4">
                                {cargoShipments.map((shipment) => (
                                    <CargoShipmentCard key={shipment.id} shipment={shipment} onChanged={loadCargoShipments} />
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'memberships' && (
                    <div className="space-y-3">
                        <div className="flex justify-end">
                            <select
                                value={subscriptionPerPage}
                                onChange={(e) => setSubscriptionPerPage(Number(e.target.value))}
                                className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                            >
                                <option value={12}>{copy('12 / page', '12 / ukurasa')}</option>
                                <option value={24}>{copy('24 / page', '24 / ukurasa')}</option>
                                <option value={48}>{copy('48 / page', '48 / ukurasa')}</option>
                            </select>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {subscriptionLoading ? (
                                <div className="md:col-span-2 flex items-center justify-center py-16">
                                    <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
                                </div>
                            ) : subscriptions.length === 0 ? (
                                <EmptyPane icon={Crown} title={t('orders.noMemberships')} body={t('orders.noMembershipsDescription')} />
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
                                        {t('common.previous')}
                                    </Button>
                                    <p className="text-sm font-semibold text-muted-foreground">
                                        {t('common.pageOf', { page: subscriptionMeta.current_page, pages: subscriptionMeta.last_page })}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => setSubscriptionPage((p) => Math.min(subscriptionMeta.last_page, p + 1))}
                                        disabled={subscriptionMeta.current_page >= subscriptionMeta.last_page}
                                    >
                                        {t('common.next')}
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
        package_check: PackageCheck,
        refresh: RefreshCcw,
        receipt: ReceiptText,
        shield_check: ShieldCheck,
        smile: Sparkles,
        shopping_bag: ShoppingBag,
        sparkles: Sparkles,
        truck: Truck,
        tag: Tag,
        trending_down: TrendingDown,
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

function FollowedStoreRow({ row, onPreferenceChange, onUnfollow }) {
    const { t } = useLocale();
    const merchant = row.merchant || {};
    const preferences = row.notification_preferences || {};
    const avatarInitial = (merchant.name || merchant.slug || 'S').charAt(0).toUpperCase();
    const isMuted = preferences.muted === true;

    return (
        <div className="grid gap-4 p-4 md:grid-cols-[auto_1fr_auto] md:items-center md:p-5">
            <Link href={`/u/${merchant.slug}`} className="h-14 w-14 overflow-hidden rounded-full border border-border bg-muted">
                {merchant.avatar_url ? (
                    <img src={merchant.avatar_url} alt={merchant.name || 'Store'} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-black text-muted-foreground">
                        {avatarInitial}
                    </div>
                )}
            </Link>

            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/u/${merchant.slug}`} className="truncate text-base font-black text-slate-900 hover:text-brand-700">
                        {merchant.name || merchant.slug}
                    </Link>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {t('orders.followers', { count: Number(merchant.followers_count || 0).toLocaleString() })}
                    </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">@{merchant.slug}</p>
                {merchant.business_category && (
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{merchant.business_category}</p>
                )}
                {isMuted && (
                    <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {t('orders.muted')}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <PreferenceToggle
                    label={t('orders.preference.posts')}
                    active={!isMuted && preferences.posts !== false}
                    onClick={() => onPreferenceChange(merchant.slug, { posts: preferences.posts === false })}
                />
                <PreferenceToggle
                    label={t('orders.preference.offers')}
                    active={!isMuted && preferences.offers !== false}
                    onClick={() => onPreferenceChange(merchant.slug, { offers: preferences.offers === false })}
                />
                <PreferenceToggle
                    label={t('orders.preference.sms')}
                    active={!isMuted && preferences.sms !== false}
                    onClick={() => onPreferenceChange(merchant.slug, { sms: preferences.sms === false })}
                />
                <PreferenceToggle
                    label={t('orders.preference.whatsapp')}
                    active={!isMuted && preferences.whatsapp !== false}
                    onClick={() => onPreferenceChange(merchant.slug, { whatsapp: preferences.whatsapp === false })}
                />
                <PreferenceToggle
                    label={isMuted ? t('orders.unmute') : t('orders.mute')}
                    active={isMuted}
                    onClick={() => onPreferenceChange(merchant.slug, { muted: !isMuted })}
                />
                <Button variant="outline" className="rounded-xl" onClick={() => onUnfollow(merchant.slug)}>
                    {t('orders.unfollow')}
                </Button>
            </div>
        </div>
    );
}

function PreferenceToggle({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'inline-flex h-9 items-center rounded-xl border px-3 text-xs font-black transition-colors',
                active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-border bg-background text-muted-foreground',
            ].join(' ')}
        >
            {label}
        </button>
    );
}

const cargoStatusLabels = {
    incoming: 'Incoming',
    received_at_origin: 'Received at origin',
    in_transit: 'In transit',
    arrived_country: 'Arrived in country',
    customs_handling: 'Customs / handling',
    ready_for_pickup: 'Ready for pickup',
    handoff_confirmed: 'Handoff confirmed',
    completed: 'Completed',
    on_hold: 'On hold',
};

function cargoEventLabel(event, isTakeerOrder, orderSummary = {}, labels = cargoStatusLabels) {
    if (!event) return '';
    if (event.metadata?.buyer_confirmed_handoff) return 'Handoff confirmed';
    if (isTakeerOrder && event.status === 'completed' && orderSummary.delivery_status === 'customer_confirmed') {
        return 'Handoff confirmed';
    }

    return labels[event.status] || event.status;
}

function cargoPaymentTermLabel(term, t = null) {
    if (t) {
        return {
            pay_on_pickup: t('orders.paymentTerms.payOnPickup'),
            pay_before_shipping: t('orders.paymentTerms.payBeforeShipping'),
            deposit_balance: t('orders.paymentTerms.depositBalance'),
            quote_after_receiving: t('orders.paymentTerms.quoteAfterReceiving'),
            included_or_seller_paid: t('orders.paymentTerms.includedSellerPaid'),
        }[term] || '';
    }
    return {
        pay_on_pickup: 'Pay on pickup',
        pay_before_shipping: 'Pay before shipping',
        deposit_balance: 'Deposit + balance',
        quote_after_receiving: 'Quote after receiving',
        included_or_seller_paid: 'Included / seller paid',
    }[term] || '';
}

function cargoPaymentTermText(shipment, t = null) {
    const detail = shipment.route_snapshot?.payment_terms?.[shipment.transport_mode] || {};
    const label = cargoPaymentTermLabel(detail.payment_term, t);
    if (!label) return '';
    if (detail.payment_term === 'deposit_balance' && detail.deposit_value) {
        const deposit = detail.deposit_type === 'fixed' ? detail.deposit_value : `${detail.deposit_value}%`;
        return `${label}: ${deposit}${detail.balance_due ? `, balance ${detail.balance_due}` : ''}`;
    }
    return [label, detail.payment_notes].filter(Boolean).join(' · ');
}

function CargoShipmentCard({ shipment, onChanged }) {
    const { t } = useLocale();
    const [confirming, setConfirming] = useState(false);
    const events = [...(shipment.events || [])].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    const latestEvent = events[events.length - 1];
    const isTakeerOrder = shipment.source_type === 'takeer_order';
    const orderSummary = shipment.order_summary || {};
    const buyerConfirmedHandoff = events.some((event) => event.metadata?.buyer_confirmed_handoff)
        || (isTakeerOrder && shipment.status === 'completed' && orderSummary.delivery_status === 'customer_confirmed');
    const visibleStatus = buyerConfirmedHandoff && shipment.status === 'completed' ? 'handoff_confirmed' : shipment.status;
    const freightTracking = shipment.metadata?.freight_tracking || {};
    const canConfirmHandoff = isTakeerOrder
        && orderSummary.id
        && shipment.status === 'received_at_origin'
        && !['paid_out', 'released'].includes(orderSummary.payment_status);
    const localizedCargoStatusLabels = {
        incoming: t('orders.cargoStatus.incoming'), received_at_origin: t('orders.cargoStatus.receivedAtOrigin'), in_transit: t('orders.cargoStatus.inTransit'), arrived_country: t('orders.cargoStatus.arrivedCountry'), customs_handling: t('orders.cargoStatus.customsHandling'), ready_for_pickup: t('orders.cargoStatus.readyForPickup'), handoff_confirmed: t('orders.cargoStatus.handoffConfirmed'), completed: t('orders.cargoStatus.completed'), on_hold: t('orders.cargoStatus.onHold'),
    };
    const paymentText = cargoPaymentTermText(shipment, t);
    const routeName = shipment.route_snapshot?.label || [
        shipment.route?.origin_country?.name || shipment.route?.originCountry?.name,
        shipment.route?.destination_country?.name || shipment.route?.destinationCountry?.name,
    ].filter(Boolean).join(' to ');

    const confirmForwarderHandoff = async () => {
        const ok = window.confirm(t('orders.confirmForwarderHandoff'));
        if (!ok) return;

        setConfirming(true);
        try {
            await axios.post(`/api/buyer/orders/${orderSummary.id}/confirm-receipt`);
            toast.success(t('orders.forwarderHandoffConfirmed'));
            await onChanged?.();
        } catch (error) {
            toast.error(error.response?.data?.message || t('orders.confirmHandoffFailed'));
        } finally {
            setConfirming(false);
        }
    };

    return (
        <Card className="overflow-hidden rounded-[24px] border-border/70 bg-card shadow-sm">
            <CardContent className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{shipment.public_id}</p>
                        <h3 className="mt-1 text-xl font-black text-slate-950">{shipment.package_description || shipment.external_order_ref || 'Cargo shipment'}</h3>
                        <p className="mt-1 text-sm font-semibold text-muted-foreground">{shipment.forwarder?.name || 'Forwarder'}{routeName ? ` · ${routeName}` : ''}</p>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${isTakeerOrder ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {isTakeerOrder ? t('orders.takeerProtected') : t('orders.externalTracking')}
                    </span>
                </div>

                <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-3">
                    <span className="rounded-xl bg-slate-50 px-3 py-2">{t('orders.status')}: {localizedCargoStatusLabels[visibleStatus] || visibleStatus}</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">{t('orders.tracking')}: {shipment.tracking_number || t('orders.notAdded')}</span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2">{t('orders.seller')}: {shipment.seller_name || shipment.seller_platform || t('orders.notProvided')}</span>
                </div>

                {(shipment.tracking_number || freightTracking.tracking_url || freightTracking.carrier_name || freightTracking.transport_reference || freightTracking.eta_text) && (
                    <CargoTrackingSummary
                        className="mt-3"
                        trackingNumber={shipment.tracking_number}
                        metadata={freightTracking}
                    />
                )}

                {paymentText && (
                    <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900">
                        {t('orders.forwarderPayment')}: {paymentText}
                    </div>
                )}

                {canConfirmHandoff && (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{t('orders.forwarderHandoffReview')}</p>
                        <p className="mt-1 text-sm font-bold leading-6 text-emerald-950">
                            {t('orders.forwarderHandoffHelp')}
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <Button
                                type="button"
                                onClick={confirmForwarderHandoff}
                                disabled={confirming}
                                className="h-11 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-widest hover:bg-emerald-700"
                            >
                                {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                {t('orders.confirmHandoff')}
                            </Button>
                            <ContentReportButton
                                itemType="order"
                                itemId={orderSummary.id}
                                context="order"
                                label={t('orders.reportIssue')}
                                compact
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 text-xs font-black uppercase tracking-widest text-red-700 hover:bg-red-50"
                            />
                        </div>
                    </div>
                )}

                {!isTakeerOrder && (
                    <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 md:grid-cols-4">
                        <span className="rounded-xl bg-slate-50 px-3 py-2">{t('orders.orderRef')}: {shipment.external_order_ref || t('orders.notProvided')}</span>
                        <span className="rounded-xl bg-slate-50 px-3 py-2">{t('orders.packages')}: {shipment.package_count || t('orders.notSet')}</span>
                        <span className="rounded-xl bg-slate-50 px-3 py-2">{t('orders.weight')}: {shipment.weight_estimate || t('orders.notSet')}</span>
                        <span className="rounded-xl bg-slate-50 px-3 py-2">{t('orders.declared')}: {[shipment.metadata?.declared_currency, shipment.metadata?.declared_value].filter(Boolean).join(' ') || t('orders.notSet')}</span>
                    </div>
                )}

                {!isTakeerOrder && (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        {t('orders.externalPurchaseNotice')}
                    </div>
                )}

                {Array.isArray(shipment.attachments) && shipment.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {shipment.attachments.map((attachment, index) => (
                            <a
                                key={`${attachment.type || 'file'}-${index}`}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-700 hover:bg-brand-50"
                            >
                                <ExternalLink className="h-3 w-3" />
                                {attachment.type || t('orders.attachment')}
                            </a>
                        ))}
                    </div>
                )}

                {latestEvent && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('orders.latestUpdate')}</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{cargoEventLabel(latestEvent, isTakeerOrder, orderSummary, localizedCargoStatusLabels)}{latestEvent.location?.name ? ` · ${latestEvent.location.name}` : ''}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{latestEvent.note || t('orders.statusUpdated')}</p>
                        <CargoTrackingSummary className="mt-2" trackingNumber={latestEvent.metadata?.tracking_number} metadata={latestEvent.metadata} compact />
                    </div>
                )}

                {events.length > 1 && (
                    <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('orders.history')}</p>
                        {events.slice().reverse().map((event) => (
                            <div key={event.id} className="flex gap-3 text-xs">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                                <div>
                                    <p className="font-black text-slate-800">{cargoEventLabel(event, isTakeerOrder, orderSummary, localizedCargoStatusLabels)}{event.location?.name ? ` · ${event.location.name}` : ''}</p>
                                    <p className="font-semibold text-slate-500">{event.note || t('orders.statusUpdated')}</p>
                                    <CargoTrackingSummary className="mt-2" trackingNumber={event.metadata?.tracking_number} metadata={event.metadata} compact />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CargoTrackingSummary({ metadata = {}, trackingNumber = '', compact = false, className = '' }) {
    const { t } = useLocale();
    const rows = [
        [t('orders.carrierCargo'), metadata?.carrier_name],
        [t('orders.tracking'), trackingNumber || metadata?.tracking_number],
        [t('orders.reference'), metadata?.transport_reference],
        [t('orders.eta'), metadata?.eta_text],
    ].filter(([, value]) => value);

    if (rows.length === 0 && !metadata?.tracking_url) return null;

    return (
        <div className={`${compact ? 'grid gap-1 rounded-xl border border-slate-100 bg-white px-2 py-2' : 'rounded-2xl border border-sky-100 bg-sky-50 p-3'} ${className}`}>
            <div className={`grid gap-2 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
                {rows.map(([label, value]) => (
                    <span key={label} className={`${compact ? 'text-[11px]' : 'rounded-xl bg-white px-3 py-2 text-xs'} font-bold text-slate-700`}>
                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                        {value}
                    </span>
                ))}
                {metadata?.tracking_url && (
                    <a
                        href={metadata.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${compact ? 'text-[11px]' : 'rounded-xl bg-white px-3 py-2 text-xs'} inline-flex items-center gap-1 font-black text-brand-700 underline decoration-brand-200 underline-offset-4`}
                    >
                        <ExternalLink className="h-3 w-3" />
                        {t('orders.trackingLink')}
                    </a>
                )}
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
    if (orderDetails.payment_status === 'pending_fulfillment') return 'Payment confirmed by the PSP; fulfillment is required.';
    if (orderDetails.payment_status === 'release_eligible') return 'Order is eligible for a provider payout after the release check.';
    if (orderDetails.payment_status === 'paid_out') return 'Order completed and the PSP confirmed seller payout.';
    if (orderDetails.payment_status === 'refund_pending') return 'Refund is waiting for admin approval.';
    if (orderDetails.payment_status === 'disputed') return 'A claim is open for this order.';
    return String(orderDetails.payment_status || 'Order update').replaceAll('_', ' ');
}

function deliveryStatusText(status, translate = (_, swahili) => swahili) {
    const map = {
        inquiry: ['Awaiting details', 'Inasubiri taarifa'],
        packing: ['Being prepared', 'Inaandaliwa'],
        ready_for_pickup: ['Ready for pickup', 'Tayari kuchukuliwa'],
        awaiting_boda: ['Awaiting delivery', 'Inasubiri usafirishaji'],
        awaiting_pickup: ['Awaiting pickup', 'Inasubiri kuchukuliwa'],
        dispatched: ['Dispatched', 'Imetumwa'],
        with_boda: ['With rider', 'Ipo kwa dereva'],
        in_transit: ['In transit', 'Ipo njiani'],
        arrived: ['Arrived in your area', 'Imefika eneo la mteja'],
        ready_at_terminal: ['At terminal', 'Ipo terminal'],
        delivered: ['Delivered', 'Imekabidhiwa'],
        issue_reported: ['Issue reported', 'Kuna taarifa ya tatizo'],
        disputed: ['Disputed', 'Mgogoro'],
        customer_confirmed: ['Customer confirmed', 'Mteja amethibitisha'],
    };

    return map[status] ? translate(...map[status]) : (status ? String(status).replaceAll('_', ' ') : translate('In progress', 'Inaendelea'));
}

function isActiveDeliveryStatus(status) {
    return ['with_boda', 'in_transit', 'arrived', 'ready_at_terminal', 'issue_reported'].includes(status);
}

function compactDeliveryStatus(orderDetails, translate = (_, swahili) => swahili) {
    const delivery = orderDetails?.delivery || null;
    const status = delivery?.status || delivery?.delivery_status;
    const type = delivery?.delivery_type || delivery?.type;

    if (!delivery) return null;
    if (type === 'self_pickup') return translate('Store pickup', 'Kuchukua dukani');
    if (type === 'forwarder') {
        if (status === 'ready_at_terminal' || status === 'customer_confirmed' || status === 'delivered') return translate('Received by forwarder', 'Forwarder amepokea');
        if (status === 'with_boda' || status === 'dispatched' || status === 'in_transit') return translate('On the way to forwarder', 'Inaenda kwa forwarder');
        if (status === 'packing') return translate('Being prepared', 'Inaandaliwa');
        if (status === 'inquiry') return translate('Awaiting details', 'Inasubiri taarifa');
    }
    if (status === 'delivered' || orderDetails?.payment_status === 'paid_out') return translate('Delivered', 'Imekabidhiwa');
    if (status === 'ready_at_terminal') return translate('At terminal', 'Ipo terminal');
    if (status === 'arrived') return translate('Arrived in your area', 'Imefika eneo la mteja');
    if (status === 'in_transit') return translate('In transit', 'Ipo njiani');
    if (status === 'with_boda') return translate('With rider', 'Ipo kwa dereva');
    if (status === 'issue_reported') return translate('Delivery issue reported', 'Kuna tatizo kwenye delivery');
    if (status === 'dispatched') return translate('Dispatched', 'Imetumwa');
    if (status === 'packing') return translate('Being prepared', 'Inaandaliwa');
    if (status) return deliveryStatusText(status, translate);

    return null;
}

function compactPickupStatus(orderDetails, translate = (_, swahili) => swahili) {
    const status = orderDetails?.pickup_status;
    const paymentStatus = orderDetails?.payment_status;
    const deliveryStatus = orderDetails?.delivery?.status || orderDetails?.delivery?.delivery_status;

    if (status === 'completed' || orderDetails?.pickup_completed_at || paymentStatus === 'paid_out') return translate('Delivered', 'Imekabidhiwa');
    if (paymentStatus === 'refund_pending') return translate('Refund awaiting admin review', 'Refund inasubiri admin');
    if (status === 'buyer_no_show') return translate('Buyer did not arrive', 'Mteja hakufika');
    if (status === 'cancelled_after_grace') return translate('Cancelled after deadline', 'Imefutwa baada ya deadline');
    if (status === 'pickup_overdue') return translate('Pickup deadline passed', 'Muda wa pickup umepita');
    if (status === 'extension_requested') return translate('Extension requested', 'Extension imeombwa');
    if (status === 'delivery_conversion_requested') return translate('Delivery requested', 'Delivery imeombwa');
    if (status === 'delivery_conversion_quoted') return translate('Delivery price set', 'Bei ya delivery imewekwa');
    if (status === 'delivery_conversion_payment_pending') return translate('Awaiting delivery payment', 'Inasubiri malipo ya delivery');
    if (status === 'converted_to_delivery') return translate('Converted to delivery', 'Imebadilishwa kuwa delivery');
    if (status === 'ready_for_pickup' || deliveryStatus === 'ready_for_pickup') return translate('Ready for pickup', 'Tayari kuchukuliwa');
    if (deliveryStatus === 'awaiting_pickup') return translate('Awaiting pickup', 'Inasubiri kuchukuliwa');
    if (['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(paymentStatus)) return translate('Awaiting pickup', 'Inasubiri kuchukuliwa');

    return translate('Store pickup', 'Kuchukua dukani');
}

function deliveryEventStatusLabel(status, type, translate = (_, swahili) => swahili) {
    if (type === 'self_pickup') {
        const map = {
            ready_for_pickup: ['Ready for pickup', 'Tayari kuchukuliwa'],
            awaiting_pickup: ['Awaiting pickup', 'Inasubiri kuchukuliwa'],
            buyer_no_show: ['Buyer did not arrive', 'Mteja hakufika'],
            pickup_overdue: ['Pickup deadline passed', 'Muda wa pickup umepita'],
            customer_confirmed: ['Customer confirmed', 'Mteja amethibitisha'],
            delivered: ['Delivered', 'Imekabidhiwa'],
            issue_reported: ['Issue reported', 'Kuna taarifa ya tatizo'],
        };

        return map[status] ? translate(...map[status]) : deliveryStatusText(status, translate);
    }

    if (type === 'forwarder') {
        if (status === 'ready_at_terminal' || status === 'customer_confirmed' || status === 'delivered') return translate('Received by forwarder', 'Forwarder amepokea');
        if (status === 'with_boda' || status === 'dispatched' || status === 'in_transit') return translate('On the way to forwarder', 'Inaenda kwa forwarder');
        if (status === 'packing') return translate('Being prepared', 'Inaandaliwa');
    }

    return deliveryStatusText(status, translate);
}

function serviceStatusLabel(orderDetails) {
    const serviceRequest = orderDetails?.service_request || null;
    if (serviceRequest?.scheduled_at) return `Scheduled for ${new Date(serviceRequest.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`;
    if (serviceRequest?.payment_status === 'held') return 'Payment is protected until the service is confirmed.';
    if (serviceRequest?.payment_status === 'released') return 'Service completed and payment released.';
    return orderStatusLabel(orderDetails);
}

function MerchantProfileStrip({ merchant }) {
    const { copy } = useLocale();
    const username = merchant?.slug || merchant?.username;
    const displayName = merchant?.display_name || merchant?.name || username || copy('Merchant', 'Muuzaji');
    const avatarUrl = merchant?.avatar_url;
    const category = merchant?.business_category || merchant?.business_subcategory;
    const shopHref = username ? `/u/${username}/shop/all` : null;
    const initial = String(displayName || copy('M', 'M')).trim().charAt(0).toUpperCase();

    const content = (
        <div className={`group flex items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-2.5 py-2 text-left shadow-sm transition ${shopHref ? 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-slate-900/5 focus:outline-none focus:ring-4 focus:ring-brand-100' : ''}`}>
            <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-sm font-black text-slate-500">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                        <span>{initial}</span>
                    )}
                </div>
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-sm font-black leading-tight text-slate-900">{displayName}</p>
                        {merchant?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" />}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                        {username ? `@${username}` : copy('Takeer merchant', 'Muuzaji wa Takeer')}
                        {category ? ` · ${category}` : ''}
                    </p>
                </div>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition group-hover:bg-brand-50 group-hover:text-brand-700">
                <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
        </div>
    );

    if (!shopHref) {
        return content;
    }

    return (
        <Link href={shopHref} className="block" aria-label={copy(`Open ${displayName} shop`, `Fungua duka la ${displayName}`)}>
            {content}
        </Link>
    );
}

function OwnedCard({ entry }) {
    const { t, copy } = useLocale();
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
    const isPhysicalProduct = entry.item_type === 'product' && item.type === 'physical';
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
    const activeDeliveryLabel = compactDeliveryStatus(orderDetails, copy);
    const deliveryType = orderDetails?.delivery?.delivery_type || orderDetails?.delivery?.type || '';
    const isSelfPickupOrder = deliveryType === 'self_pickup';
    const isLocalDeliveryOrder = deliveryType === 'local_boda';
    const isIntercityOrder = deliveryType === 'intercity_bus';
    const isForwarderOrder = deliveryType === 'forwarder';
    const forwarderHandoffReady = isForwarderOrder
        && ['ready_at_terminal', 'customer_confirmed'].includes(orderDetails?.delivery?.delivery_status || orderDetails?.delivery?.status);
    const showProviderReceiptActions = (isForwarderOrder
        ? ['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(orderDetails.payment_status)
        : ['release_eligible', 'payout_processing'].includes(orderDetails.payment_status))
        && (!isForwarderOrder || forwarderHandoffReady);
    const isDeliveryActive = isActiveDeliveryStatus(orderDetails?.delivery?.status || orderDetails?.delivery?.delivery_status);
    const hasReview = Boolean(orderDetails?.review?.id);
    const refundPolicy = orderDetails?.refund_policy || null;
    const returnRequest = orderDetails?.return_request || null;
    const canOpenRefundClaim = !refundPolicy || refundPolicy.status === 'eligible';
    const canOpenReturnRequest = isPhysicalProduct && canOpenRefundClaim && !returnRequest;
    const claimButtonDisabled = isPhysicalProduct ? !canOpenReturnRequest : !canOpenRefundClaim;
    const shouldShowRefundPolicy = refundPolicy && (canOpenRefundClaim || (!isDeliveryActive && orderDetails?.payment_status !== 'release_eligible'));
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

        toast.error(t('orders.openOrderChatToPay'));
    };
    const orderId = entry.source_type === 'order' ? entry.source_id : null;
    const merchantConfirmed = Boolean(orderDetails?.is_merchant_confirmed || orderDetails?.merchant_confirmed_at);
    const agreementSnapshot = orderDetails?.agreement_snapshot || {};
    const isB2BOrder = agreementSnapshot?.order_mode === 'b2b_quote'
        || ['wholesale', 'both'].includes(orderDetails?.product?.selling_style || agreementSnapshot?.selling_style || '');
    const balanceDueLabel = {
        before_production: 'Before production',
        before_delivery: 'Before delivery',
        on_delivery_confirmation: 'After buyer confirms delivery',
        manual: 'Manual agreement',
    }[agreementSnapshot?.balance_due] || 'Before delivery';
    const depositPercent = Number(agreementSnapshot?.deposit_percent || 0);
    const depositAmount = Number(agreementSnapshot?.deposit_amount || (depositPercent > 0 ? (Number(orderDetails?.total_paid || 0) * depositPercent / 100) : 0));
    const balanceAmount = Number(agreementSnapshot?.balance_amount || (depositAmount > 0 ? Math.max(0, Number(orderDetails?.total_paid || 0) - depositAmount) : 0));
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
    const pickupDeadlineLabel = orderDetails?.pickup_deadline_at
        ? new Date(orderDetails.pickup_deadline_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null;

    const confirmReceiptCopy = (() => {
        if (isCustomDeliveryProduct) {
            return {
                title: t('orders.confirm.customTitle'),
                body: t('orders.confirm.customBody'),
                cancel: t('orders.confirm.keepReviewing'),
                confirm: t('orders.confirm.acceptCustom'),
            };
        }
        if (isServiceProduct) {
            return {
                title: t('orders.confirm.serviceTitle'),
                body: t('orders.confirm.serviceBody'),
                cancel: t('orders.confirm.notYet'),
                confirm: t('orders.confirm.releasePayment'),
            };
        }
        if (isIntercityOrder) {
            return {
                title: t('orders.confirm.terminalTitle'),
                body: t('orders.confirm.terminalBody'),
                cancel: t('orders.confirm.notYet'),
                confirm: t('orders.confirm.receivedPackage'),
            };
        }
        if (isForwarderOrder) {
            return {
                title: t('orders.confirm.forwarderTitle'),
                body: t('orders.confirm.forwarderBody'),
                cancel: t('orders.confirm.keepVerifying'),
                confirm: t('orders.confirm.handoff'),
            };
        }

        return {
            title: t('orders.confirm.receiptTitle'),
            body: t('orders.confirm.receiptBody'),
            cancel: t('orders.confirm.keepChecking'),
            confirm: t('orders.confirm.receipt'),
        };
    })();

    const handleConfirmReceipt = () => {
        setShowReceiptConfirmModal(true);
    };

    const submitConfirmReceipt = async () => {
        setConfirmingReceipt(true);
        try {
            await axios.post(`/api/buyer/orders/${orderDetails.id}/confirm-receipt`);
            toast.success(t('orders.receiptConfirmed'));
            setShowReceiptConfirmModal(false);
            window.location.reload(); // Refresh to update status
        } catch (error) {
            toast.error(error.response?.data?.message || t('orders.confirmReceiptFailed'));
        } finally {
            setConfirmingReceipt(false);
        }
    };

    const handleFileDispute = async (e) => {
        e.preventDefault();
        if (!disputeReason || (!isPhysicalProduct && !disputeAllowsOptionalEvidence && !unboxingVideo)) return;
        setDisputeSubmitting(true);
        const formData = new FormData();
        if (unboxingVideo) formData.append(isPhysicalProduct ? 'evidence' : 'unboxing_video', unboxingVideo);
        formData.append('reason', disputeReason);
        try {
            const endpoint = isPhysicalProduct
                ? `/api/buyer/orders/${orderDetails.id}/return-request`
                : `/api/buyer/orders/${orderDetails.id}/dispute`;
            await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(isPhysicalProduct ? t('orders.returnSent') : t('orders.claimOpened'));
            setShowDisputeModal(false);
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || (isPhysicalProduct ? t('orders.returnFailed') : t('orders.claimFailed')));
        } finally {
            setDisputeSubmitting(false);
        }
    };

    const handleEscalateReturn = async () => {
        if (!returnRequest?.id) return;
        setDisputeSubmitting(true);
        try {
            await axios.post(`/api/buyer/return-requests/${returnRequest.id}/escalate`, {
                reason: 'Customer escalated the return request from orders.',
            });
            toast.success(t('orders.returnEscalated'));
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || t('orders.returnEscalateFailed'));
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
            toast.success(t('orders.revisionSent'));
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || t('orders.revisionFailed'));
        } finally {
            setRevisionSubmitting(false);
        }
    };

    const labelMap = {
        content_item: { icon: BookOpenText, label: t('orders.itemTypes.postContent'), href: item.slug ? route('content.show', item.slug) : null },
        post: { icon: BookOpenText, label: t('orders.itemTypes.postContent'), href: postRouteKey ? route('post.show', postRouteKey) : null },
        bundle: {
            icon: item.is_course ? BookOpenText : Boxes,
            label: item.is_course ? t('orders.itemTypes.course') : t('orders.itemTypes.bundle'),
            href: item.is_course && item.slug ? `/learn/bundles/${item.slug}` : (item.slug ? route('bundle.show', item.slug) : null),
        },
        subscription_plan: { icon: Crown, label: t('orders.itemTypes.membership'), href: item.slug || item.id ? `/plan/${item.slug || item.id}` : null },
        product: { icon: ShoppingBag, label: t('orders.itemTypes.physical'), href: item.slug ? route('product.show', item.slug) : null },
        offering_group: { icon: ShoppingBag, label: t('orders.itemTypes.menuOrder'), href: item.slug ? `/offerings/${item.id}` : null },
    };

    let config = labelMap[entry.item_type] || { icon: Library, label: entry.item_type, href: null };
    if (entry.item_type === 'product') {
        if (item.type === 'service') {
            config = { ...config, icon: CalendarClock, label: t('orders.itemTypes.service') };
        } else if (isCustomDeliveryProduct) {
            config = { ...config, icon: Sparkles, label: t('orders.itemTypes.custom') };
        } else if (isDigitalProduct && !isLinkDigital) {
            config = { ...config, icon: Download, label: t('orders.itemTypes.digital') };
        } else if (isLinkDigital) {
            config = { ...config, icon: ExternalLink, label: t('orders.itemTypes.digital') };
        } else {
            config = { ...config, icon: ShoppingBag, label: t('orders.itemTypes.physical') };
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
                toast.info(res.data?.message || copy('The merchant is still preparing your custom delivery.', 'Merchant bado anaandaa custom delivery yako.'));
                return;
            }
            const targetUrl = res.data?.url;

            if (!targetUrl) {
                throw new Error(copy('No download link was found.', 'Hakuna kiungo cha kupakua kilichopatikana.'));
            }

            window.open(targetUrl, '_blank', 'noopener,noreferrer');
                toast.success(res.data?.message || copy('Your download link is ready.', 'Kiungo cha kupakua kiko tayari.'));
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || copy('Could not prepare the download.', 'Imeshindwa kuandaa upakuaji.'));
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
                    title={copy('Open order chat', 'Fungua order chat')}
                    aria-label={copy('Open order chat', 'Fungua order chat')}
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
                            {item.title || item.name || copy('Owned item', 'Bidhaa uliyo nayo')}
                        </h3>
                        {canShowDescription && (
                            <p className="mt-2 text-sm text-muted-foreground leading-6 line-clamp-2">
                                {fullDescription}
                            </p>
                        )}
                    </button>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">
                        {copy('Added', 'Imeongezwa')} {formatDate(entry.granted_at || entry.starts_at)}
                    </p>
                    {!isPhysicalProduct && (
                        <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${isTemporaryAccess ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-sky-100 bg-sky-50 text-sky-800'}`}>
                            <p className="shrink-0 font-black uppercase tracking-widest">
                                {isTemporaryAccess ? copy('Membership item', 'Bidhaa ya uanachama') : copy('Owned item', 'Bidhaa uliyo nayo')}
                            </p>
                            <p className="min-w-0 truncate font-semibold">
                                {isTemporaryAccess
                                    ? `Active${accessTimeLeft ? ` · ${accessTimeLeft}` : ''}${accessExpiresLabel ? ` · ends ${accessExpiresLabel}` : ''}`
                                    : copy('Saved in your library.', 'Imehifadhiwa kwenye maktaba yako.')}
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-5">
                    <MerchantProfileStrip merchant={merchant} />
                </div>

                {isSelfPickupOrder && pickupDeadlineLabel && !orderDetails?.pickup_completed_at && (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                        <p className="font-black uppercase tracking-widest">{copy('Pickup deadline', 'Mwisho wa kuchukua')}</p>
                        <p className="mt-1 font-bold">{copy('Collect before', 'Chukua kabla ya')} {pickupDeadlineLabel}</p>
                    </div>
                )}

                <div className="mt-5">
                    {isCustomDeliveryProduct ? (
                        <div className="space-y-3">
                            <div className={`rounded-2xl border p-3 ${customDelivery?.delivered_at ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'}`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${customDelivery?.delivered_at ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {customDelivery?.status === 'revision_requested'
                                        ? copy('Revision requested', 'Marekebisho yameombwa')
                                        : customDelivery?.status === 'accepted'
                                            ? copy('Accepted', 'Imekubaliwa')
                                            : customDelivery?.delivered_at
                                                ? copy('Delivered for review', 'Imewasilishwa kwa ukaguzi')
                                                : copy('In production', 'Inaandaliwa')}
                                </p>
                                <p className="mt-1 min-w-0 truncate text-sm font-bold" title={customDelivery?.file_name || undefined}>
                                    {customDelivery?.file_name || copy('Merchant is preparing your custom delivery.', 'Muuzaji anaandaa faili lako maalum.')}
                                </p>
                                {customDelivery?.message && (
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground whitespace-pre-line">{customDelivery.message}</p>
                                )}
                                {customDeliveryDueLabel && (
                                    <p className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${customDeliveryIsOverdue ? 'text-red-700' : 'text-muted-foreground'}`}>
                                        <CalendarClock className="h-3.5 w-3.5" />
                                        {copy('Due', 'Mwisho')} {customDeliveryDueLabel}
                                    </p>
                                )}
                                {customDelivery?.revision_message && (
                                    <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-amber-900">
                                        {copy('Revision note', 'Maelezo ya marekebisho')}: {customDelivery.revision_message}
                                    </p>
                                )}
                            </div>

                            {customDelivery?.delivered_at && (
                                <Button className="w-full rounded-2xl" onClick={handleDownload} disabled={isDownloading}>
                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    {copy('Download Delivery', 'Pakua faili la delivery')}
                                </Button>
                            )}

                            {orderDetails?.payment_status === 'release_eligible' && !customDelivery?.delivered_at && customDeliveryIsOverdue && (
                                <Button variant="outline" className="w-full rounded-xl text-red-600 border-red-200" onClick={() => setShowDisputeModal(true)} disabled={claimButtonDisabled}>
                                    {copy('Dispute missed deadline', 'Fungua mgogoro wa kuchelewa')}
                                </Button>
                            )}

                            {orderDetails?.payment_status === 'release_eligible' && customDelivery?.delivered_at && customDelivery?.status !== 'accepted' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" className="rounded-xl text-red-600 border-red-200" onClick={() => setShowDisputeModal(true)} disabled={claimButtonDisabled}>
                                            Dispute
                                        </Button>
                                        <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConfirmReceipt} disabled={confirmingReceipt}>
                                            {confirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : copy('Accept Work', 'Kubali kazi')}
                                        </Button>
                                    </div>
                                    <textarea
                                        value={revisionMessage}
                                        onChange={(e) => setRevisionMessage(e.target.value)}
                                        rows={3}
                                        placeholder={customRevisionLimitReached ? copy('Revision limit reached. Accept the work or open a dispute.', 'Kikomo cha marekebisho kimefikiwa. Kubali kazi au fungua mgogoro.') : copy('Need changes? Tell the creator what to revise...', 'Unahitaji mabadiliko? Mwambie mtayarishaji cha kurekebisha...')}
                                        disabled={customRevisionLimitReached}
                                        className="w-full rounded-2xl border border-input bg-background p-3 text-sm"
                                    />
                                    <p className="text-[11px] font-semibold text-muted-foreground">
                                        {customRevisionRemaining} {copy('of', 'kati ya')} {customRevisionLimit} {copy('revision requests remaining', 'maombi ya marekebisho yaliyobaki')}
                                    </p>
                                    <Button variant="outline" className="w-full rounded-xl" onClick={handleRequestRevision} disabled={customRevisionLimitReached || revisionSubmitting || revisionMessage.trim().length < 10}>
                                        {revisionSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                        {copy('Request Revision', 'Omba marekebisho')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : isDigitalProduct ? (
                        <Button className="w-full rounded-2xl" onClick={handleDownload} disabled={isDownloading}>
                            {isDownloading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {copy('Preparing...', 'Inaandaliwa...')}
                                </>
                            ) : isSubscriptionDigitalAccess ? (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    {copy('Open Access', 'Fungua ufikiaji')}
                                </>
                            ) : isLinkDigital ? (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    {copy('Open Link', 'Fungua kiungo')}
                                </>
                            ) : shouldOpenProtectedStreamInModal ? (
                                <>
                                    <BookOpenText className="mr-2 h-4 w-4" />
                                    {copy('Open', 'Fungua')}
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    {copy('Download', 'Pakua')}
                                </>
                            )}
                        </Button>
                    ) : isServiceProduct ? (
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-800">{copy('Booking', 'Miadi')}</p>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${serviceRequest?.payment_status === 'released' || orderDetails?.payment_status === 'paid_out'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : serviceRequest?.payment_status === 'disputed' || orderDetails?.payment_status === 'disputed'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>
                                        {serviceRequest?.payment_status === 'released' || orderDetails?.payment_status === 'paid_out'
                                            ? copy('Completed', 'Imekamilika')
                                            : serviceRequest?.payment_status === 'held'
                                                ? copy('PSP payment confirmed', 'Malipo ya PSP yamethibitishwa')
                                                : serviceRequest?.payment_status === 'disputed'
                                                    ? copy('Disputed', 'Mgogoro')
                                                    : (serviceRequest?.payment_status || orderDetails?.payment_status || 'Pending').replaceAll('_', ' ')}
                                    </span>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">{copy('Time', 'Muda')}</span>
                                        <span className="font-black text-right">
                                            {serviceRequest?.scheduled_at
                                                ? new Date(serviceRequest.scheduled_at).toLocaleString([], { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                                                : [serviceRequest?.preferred_date, serviceRequest?.preferred_time].filter(Boolean).join(' ') || copy('Provider will confirm', 'Mtoa huduma atathibitisha')}
                                        </span>
                                    </div>
                                    {serviceRequest?.service_option?.name && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">{copy('Option', 'Chaguo')}</span>
                                            <span className="font-black text-right">{serviceRequest.service_option.name}</span>
                                        </div>
                                    )}
                                    {serviceRequest?.location_text && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">{copy('Location', 'Mahali')}</span>
                                            <span className="font-black text-right">{serviceRequest.location_text}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">{copy('Payment', 'Malipo')}</span>
                                        <span className="font-black text-right">TZS {Number(orderDetails?.total_paid || serviceRequest?.quoted_amount || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            {serviceRequest?.delivery_status === 'provider_marked_delivered' && orderDetails?.payment_status === 'release_eligible' ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
                                        onClick={() => setShowDisputeModal(true)}
                                        disabled={claimButtonDisabled}
                                    >
                                        {copy('Open dispute', 'Fungua Mgogoro')}
                                    </Button>
                                    <Button
                                        className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={handleConfirmReceipt}
                                        disabled={confirmingReceipt}
                                    >
                                        {confirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : copy('I received the service', 'Nimepata Huduma')}
                                    </Button>
                                </div>
                            ) : serviceRequest?.payment_status === 'held' ? (
                                <p className="text-xs text-muted-foreground text-center">
                                    {copy('Your payment is held by the PSP until you confirm the service.', 'Malipo yako yako chini ya mchakato wa PSP hadi uthibitishe huduma.')}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground text-center">
                                    {copy('Your booking is placed. The provider will notify you of changes.', 'Umeweka miadi. Mtoa huduma atakujulisha mabadiliko.')}
                                </p>
                            )}
                            {['held', 'disputed'].includes(serviceRequest?.payment_status) && (
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                                    <p className="font-black flex items-center gap-1.5">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {copy('Order and PSP protection', 'Ulinzi wa order na PSP')}
                                    </p>
                                    <p className="mt-1">
                                        {copy('Takeer holds the payment until you confirm the service. If you open a dispute, the payment remains held while our team reviews the evidence.', 'Takeer hushikilia malipo hadi uthibitishe huduma. Ukiweka mgogoro, malipo yatasimama hadi timu yetu ikague ushahidi.')}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : orderDetails ? (
                        <div className="space-y-3">
                            {orderDetails.unit_snapshot && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">{copy('Quantity', 'Kiasi')}</p>
                                        <p className="mt-1 text-sm font-black text-brand-900">{orderQuantityLabel(orderDetails)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-brand-100 bg-white p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-700">{copy('Price', 'Bei')}</p>
                                        <p className="mt-1 text-sm font-black text-brand-900">{orderUnitPriceLabel(orderDetails)}</p>
                                    </div>
                                </div>
                            )}
                            {/* Fulfillment Status Badge */}
                            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-muted-foreground/10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {isSelfPickupOrder ? copy('Pickup:', 'Pickup:') : (activeDeliveryLabel ? copy('Delivery:', 'Delivery:') : copy('Shipping:', 'Usafirishaji:'))}
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${orderDetails.payment_status === 'paid_out' ? 'text-green-600' :
                                    orderDetails.payment_status === 'disputed' ? 'text-red-600' :
                                        orderDetails.payment_status === 'failed' ? 'text-red-600' :
                                            'text-amber-600'
                                    }`}>
                                    {(() => {
                                        const delivType = orderDetails.delivery?.delivery_type || orderDetails.delivery?.type;
                                        const deliveryLabel = compactDeliveryStatus(orderDetails, copy);
                                        if (delivType === 'self_pickup') return compactPickupStatus(orderDetails, copy);
                                        // Final status takes precedence
                                        if (orderDetails.payment_status === 'paid_out') return copy('Completed', 'Imekamilika');
                                        if (orderDetails.payment_status === 'failed') return copy('Failed', 'Imesitishwa');
                                        if (orderDetails.payment_status === 'confirmed') return copy('Received', 'Imepokelewa');
                                        if (orderDetails.payment_status === 'disputed') return copy('Disputed', 'Mgogoro');
                                        if (deliveryLabel && delivType !== 'self_pickup') return deliveryLabel;

                                        // Inquiry pending — merchant hasn't set shipping yet
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'pending') return copy('Waiting for shipping quote', 'Inasubiri Bei ya Usafiri');
                                        // Inquiry quoted — shipping fee provided, waiting for buyer to pay
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && !merchantConfirmed) return copy('Waiting for confirmation', 'Inasubiri Uthibitisho');
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted') {
                                            if (['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(orderDetails.payment_status)) return copy('Paid — awaiting dispatch', 'Imelipwa — Inasubiri Utumaji');
                                            return copy('Quote ready — pay now', 'Bei Imewekwa — Lipia Sasa');
                                        }
                                        // Shipping statuses
                                        if (orderDetails.payment_status === 'pending_fulfillment') return copy('Awaiting dispatch', 'Inasubiri Utumaji');
                                        if (['release_eligible', 'payout_processing'].includes(orderDetails.payment_status)) return deliveryStatusText(orderDetails.delivery?.status, copy);
                                        // Fallback: show delivery type if known
                                        if (delivType) return delivType === 'intercity_bus' ? copy('Intercity bus', 'Basi la mikoani') : delivType.replace(/_/g, ' ');
                                        return orderDetails.payment_status?.replace(/_/g, ' ') || copy('In progress', 'Inaendelea');
                                    })()}
                                </span>
                            </div>

                            {latestDeliveryEvent && (
                                <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2">
                                    <div className="flex items-start gap-2">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                {isSelfPickupOrder ? copy('Pickup update', 'Taarifa ya pickup') : copy('Delivery update', 'Taarifa ya delivery')}
                                            </p>
                                            <p className="mt-0.5 truncate text-xs font-black text-slate-950">
                                                {deliveryEventStatusLabel(latestDeliveryEvent.status, deliveryType, copy)}
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
                                    <p className="text-[10px] font-black uppercase text-brand-700 mb-1 leading-tight">
                                        {isB2BOrder ? copy('The merchant has not sent the proforma yet.', 'Muuzaji bado hajatuma proforma.') : copy('The merchant has not provided the shipping cost yet.', 'Muuzaji bado hajakupa bei ya usafiri.')}
                                    </p>
                                    <p className="text-[10px] text-brand-800 leading-tight mb-3">
                                        {isB2BOrder
                                            ? copy('Use chat to agree on MOQ, customization, delivery, and PSP/provider payout terms.', 'Tumia chat kukubaliana MOQ, customization, delivery, na masharti ya PSP/provider payout.')
                                            : copy('Use the chat below to agree on the shipping cost.', 'Tumia chat hapa chini kukubaliana naye bei ya usafiri.')}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="w-full text-xs font-bold border-brand-200 text-brand-700 hover:bg-brand-100"
                                        onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        {copy('Open chat', 'Fungua chat')}
                                    </Button>
                                </div>
                            )}

                            {orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && !merchantConfirmed && orderDetails.payment_status === 'pending' && (
                                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-amber-800 mb-1 leading-tight">
                                        {isB2BOrder ? copy('The proforma is awaiting confirmation.', 'Proforma inasubiri uthibitisho.') : copy('The merchant has not confirmed the order yet.', 'Muuzaji bado hajathibitisha oda.')}
                                    </p>
                                    <p className="text-[10px] text-amber-900 leading-tight mb-3">
                                        {isB2BOrder
                                            ? copy('PSP payment will start after the merchant confirms the official proforma.', 'Malipo ya PSP yataanza baada ya muuzaji kuthibitisha proforma rasmi.')
                                            : copy('Payment will open after the merchant confirms the order is available.', 'Malipo yatafunguka baada ya muuzaji kuthibitisha kuwa order ipo.')}
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="w-full text-xs font-bold border-amber-200 text-amber-800 hover:bg-amber-100"
                                        onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        {copy('Open chat', 'Fungua chat')}
                                    </Button>
                                </div>
                            )}

                            {orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && merchantConfirmed && orderDetails.payment_status === 'pending' && (
                                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                                    {isB2BOrder ? (
                                        <div className="space-y-2 mb-3">
                                            <div className="flex items-start gap-2 rounded-xl bg-white/70 border border-emerald-100 p-3">
                                                <ShieldCheck className="h-4 w-4 mt-0.5 text-emerald-700" />
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">{copy('Takeer PSP payment pro forma', 'Proforma ya malipo ya Takeer PSP')}</p>
                                                    <p className="mt-1 text-[10px] leading-4 text-emerald-900">
                                                        {copy('Pay only through Takeer. Funds stay protected until delivery, confirmation, or dispute resolution.', 'Lipa kupitia Takeer pekee. Fedha zinalindwa hadi delivery, uthibitisho, au utatuzi wa mgogoro.')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="rounded-xl bg-white/70 border border-emerald-100 p-2">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">{copy('Quantity', 'Kiasi')}</p>
                                                    <p className="text-xs font-black text-emerald-950">{orderQuantityLabel(orderDetails)}</p>
                                                </div>
                                                <div className="rounded-xl bg-white/70 border border-emerald-100 p-2">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">{copy('Unit price', 'Bei kwa kipimo')}</p>
                                                    <p className="text-xs font-black text-emerald-950">{orderUnitPriceLabel(orderDetails)}</p>
                                                </div>
                                                {depositAmount > 0 && (
                                                    <div className="rounded-xl bg-white/70 border border-emerald-100 p-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">{copy('Deposit', 'Amana')}</p>
                                                        <p className="text-xs font-black text-emerald-950">TZS {depositAmount.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                {balanceAmount > 0 && (
                                                    <div className="rounded-xl bg-white/70 border border-emerald-100 p-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">{copy('Balance', 'Salio')}</p>
                                                        <p className="text-xs font-black text-emerald-950">TZS {balanceAmount.toLocaleString()}</p>
                                                    </div>
                                                )}
                                                {agreementSnapshot?.production_lead_time_days && (
                                                    <div className="rounded-xl bg-white/70 border border-emerald-100 p-2">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">{copy('Lead time', 'Muda wa maandalizi')}</p>
                                                        <p className="text-xs font-black text-emerald-950">{agreementSnapshot.production_lead_time_days} days</p>
                                                    </div>
                                                )}
                                                <div className="rounded-xl bg-white/70 border border-emerald-100 p-2">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">{copy('Balance due', 'Salio linadaiwa')}</p>
                                                    <p className="text-xs font-black text-emerald-950">{balanceDueLabel}</p>
                                                </div>
                                            </div>
                                            {(agreementSnapshot?.payment_terms_note || agreementSnapshot?.customization_note) && (
                                                <div className="rounded-xl bg-white/70 border border-emerald-100 p-2 text-[10px] leading-4 text-emerald-900">
                                                    {agreementSnapshot?.payment_terms_note && <p><span className="font-black">{copy('Terms:', 'Masharti:')}</span> {agreementSnapshot.payment_terms_note}</p>}
                                                    {agreementSnapshot?.customization_note && <p><span className="font-black">{copy('Customization:', 'Marekebisho:')}</span> {agreementSnapshot.customization_note}</p>}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-[10px] font-black uppercase text-emerald-700">{copy('Shipping Fee:', 'Ada ya usafirishaji:')}</p>
                                                <p className="text-sm font-black text-emerald-600">TZS {Number(orderDetails.shipping_fee || 0).toLocaleString()}</p>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex justify-between items-center border-t border-emerald-200 pt-2 mb-3">
                                        <p className="text-[10px] font-black uppercase text-emerald-800">{isB2BOrder ? copy('PSP Payment Total:', 'Jumla ya malipo ya PSP:') : copy('Total to Pay:', 'Jumla ya kulipa:')}</p>
                                        <p className="text-lg font-black text-emerald-700">TZS {Number(orderDetails.order_total_with_additions ?? orderDetails.total_paid ?? 0).toLocaleString()}</p>
                                    </div>
                                    <Button
                                        className="w-full rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20"
                                        onClick={() => handlePayInquiry(orderDetails.id)}
                                        disabled={payingInquiry}
                                    >
                                        {payingInquiry ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2 fill-white" />}
                                        {isB2BOrder ? copy('Pay through PSP', 'Lipa kupitia PSP') : copy('Pay now', 'Lipa Sasa')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="w-full mt-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                                        onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        {copy('Return to chat', 'Rudi kwenye Chat')}
                                    </Button>
                                </div>
                            )}

                            {/* PIN Display for provider release eligibility */}
                            {isForwarderOrder && ['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(orderDetails.payment_status) && (
                                <div className="p-3 rounded-2xl bg-violet-50 border border-violet-100">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                        {forwarderHandoffReady ? copy('Forwarder handoff review', 'Ukaguzi wa makabidhiano kwa forwarder') : copy('Forwarder drop-off', 'Kukabidhi kwa forwarder')}
                                    </p>
                                    <p className="mt-1 text-[10px] text-violet-900 leading-tight">
                                        {forwarderHandoffReady
                                            ? copy('The seller provided proof that the shipment reached the forwarder. Review the receipt or tracking, or contact the forwarder. If satisfied, confirm the handoff so a PSP payout can be requested.', 'Muuzaji ameweka ushahidi kuwa mzigo umefika kwa forwarder. Hakiki risiti, tracking, au wasiliana na forwarder. Ukiridhika, thibitisha handoff ili PSP payout iweze kuombwa.')
                                            : copy('The seller is sending the shipment to the forwarder warehouse. After handoff proof is submitted, review the tracking or receipt, or report an issue before a payout request.', 'Muuzaji anatuma mzigo kwenda warehouse ya forwarder. Baada ya handoff proof kuwasilishwa, hakiki tracking/risiti au ripoti tatizo kabla ya payout request.')}
                                    </p>
                                </div>
                            )}

                            {isIntercityOrder && ['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(orderDetails.payment_status) && (
                                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{copy('Intercity / cargo pickup', 'Intercity / kuchukua mzigo')}</p>
                                    <p className="mt-1 text-[10px] text-indigo-900 leading-tight">
                                        {copy('Use the waybill, phone, or identification details required by the transporter to collect the shipment. After receiving and checking it, confirm receipt.', 'Tumia taarifa za waybill, simu, au utambulisho unaohitajika na transporter kuchukua mzigo. Ukishapokea na kukagua, thibitisha receipt.')}
                                    </p>
                                </div>
                            )}

                            {['pending_fulfillment', 'release_eligible'].includes(orderDetails.payment_status) && isSelfPickupOrder && (orderDetails.is_merchant_confirmed || orderDetails.merchant_confirmed_at) && orderDetails.pickup_status === 'ready_for_pickup' && orderDetails.delivery?.pickup_pin && (
                                <div className="overflow-hidden rounded-[2rem] border border-brand-100 bg-white text-center shadow-xl shadow-brand-100/50">
                                    <div className="bg-brand-50/80 px-4 py-4">
                                        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-500">{copy('Pickup PIN', 'PIN ya pickup')}</p>
                                        <div className="mt-3 flex justify-center gap-1.5">
                                            {String(showPin ? orderDetails.delivery.pickup_pin : '****').padStart(4, '*').split('').map((digit, index) => (
                                                <span key={`${digit}-${index}`} className="flex h-11 w-9 items-center justify-center rounded-xl border border-brand-100 bg-white text-xl font-black text-brand-900 shadow-sm">
                                                    {digit}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-[10px] font-bold leading-tight text-brand-800">{copy('Show this PIN at the store or give it to the person collecting the shipment for you.', 'Onyesha PIN hii dukani au mpe mtu uliyemtuma kuchukua mzigo.')}</p>
                                        <button
                                            type="button"
                                            onClick={() => setShowPin(!showPin)}
                                            className="mt-2 text-[10px] font-black uppercase tracking-widest text-brand-600 underline"
                                        >
                                            {showPin ? copy('Hide PIN', 'Ficha PIN') : copy('Reveal PIN', 'Onyesha PIN')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {['pending_fulfillment', 'release_eligible', 'payout_processing'].includes(orderDetails.payment_status) && isLocalDeliveryOrder && orderDetails.delivery?.buyer_release_pin && (
                                <div className="overflow-hidden rounded-[2rem] border border-sky-100 bg-white text-center shadow-xl shadow-sky-100/60">
                                    <div className="bg-sky-50/80 px-4 py-4">
                                        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-500">{copy('Delivery PIN', 'PIN ya delivery')}</p>
                                        <div className="mt-3 flex justify-center gap-1.5">
                                            {String(showPin ? orderDetails.delivery.buyer_release_pin : '****').padStart(4, '*').split('').map((digit, index) => (
                                                <span key={`${digit}-${index}`} className="flex h-11 w-9 items-center justify-center rounded-xl border border-sky-100 bg-white text-xl font-black text-brand-900 shadow-sm">
                                                    {digit}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-[10px] font-bold leading-tight text-slate-600">{copy('Check the shipment first. Give this PIN to the rider after confirming it is your order and is safe.', 'Kagua mzigo kwanza. Mpe dereva PIN hii baada ya kuhakikisha ni order yako na iko salama.')}</p>
                                        <button
                                            type="button"
                                            onClick={() => setShowPin(!showPin)}
                                            className="mt-2 text-[10px] font-black uppercase tracking-widest text-brand-600 underline"
                                        >
                                            {showPin ? copy('Hide PIN', 'Ficha PIN') : copy('Reveal PIN', 'Onyesha PIN')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Provider settlement actions */}
                            {showProviderReceiptActions && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 rounded-xl h-10 text-xs font-bold border-red-200 text-red-600 hover:bg-red-50"
                                        onClick={() => setShowDisputeModal(true)}
                                        disabled={isForwarderOrder ? false : claimButtonDisabled}
                                    >
                                        {isForwarderOrder ? copy('Report issue', 'Ripoti tatizo') : (isPhysicalProduct ? copy('Return request', 'Ombi la kurudisha') : copy('File claim', 'Fungua dai'))}
                                    </Button>
                                    <Button
                                        className="flex-1 rounded-xl h-10 text-xs font-bold bg-green-600 hover:bg-green-700 text-white"
                                        onClick={handleConfirmReceipt}
                                        disabled={confirmingReceipt}
                                    >
                                        {confirmingReceipt ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : (isForwarderOrder ? copy('Confirm handoff', 'Thibitisha makabidhiano') : copy('Confirm receipt', 'Thibitisha kupokea'))}
                                    </Button>
                                </div>
                            )}

                            {!hasReview && (orderDetails.payment_status === 'payment_confirmed' || orderDetails.payment_status === 'paid_out') && (
                                <Button
                                    className="w-full h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px]"
                                    onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                >
                                    {copy('Leave review', 'Acha tathmini')}
                                </Button>
                            )}

                            {orderDetails.payment_status === 'disputed' && (
                                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-center">
                                    <p className="text-xs font-black text-red-700 uppercase">{copy('Dispute in progress', 'Mgogoro Unaendelea')}</p>
                                    <p className="text-[10px] text-red-600 mt-1 leading-tight">{copy('Our team is reviewing your refund or replacement request.', 'Timu yetu inafanyia kazi ombi lako la kurejeshewa pesa au kubadilisha bidhaa.')}</p>
                                </div>
                            )}
                        </div>
                    ) : config.href ? (
                        <Link href={config.href}>
                            <Button className="w-full rounded-2xl">
                                {copy('Open', 'Fungua')}
                            </Button>
                        </Link>
                    ) : (
                        <Button className="w-full rounded-2xl" disabled>{copy('Open', 'Fungua')}</Button>
                    )}
                </div>

                {shouldShowRefundPolicy && (
                    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${refundPolicyTone}`}>
                        <p className="font-black uppercase tracking-widest">
                            {canOpenRefundClaim ? 'Refund review available' : 'Refund claim unavailable'}
                        </p>
                        <p className="mt-1 truncate font-semibold">
                            {canOpenRefundClaim ? 'You can open a claim while the provider settlement is unresolved.' : 'Claim is closed for this order.'}
                        </p>
                        {refundPolicy.window_ends_at && (
                            <p className="mt-1 font-bold">Ends {new Date(refundPolicy.window_ends_at).toLocaleDateString()}</p>
                        )}
                        {Number(refundPolicy.download_count || 0) > 0 && (
                            <p className="mt-1 font-bold">Accessed {refundPolicy.download_count}x</p>
                        )}
                    </div>
                )}

                {returnRequest && (
                    <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                        <p className="font-black uppercase tracking-widest">Return request: {String(returnRequest.status || '').replaceAll('_', ' ')}</p>
                        <p className="mt-1 font-semibold">{returnRequest.merchant_note || returnRequest.reason}</p>
                        {returnRequest.policy_snapshot?.window_ends_at && (
                            <p className="mt-1 font-bold">Policy window ends {new Date(returnRequest.policy_snapshot.window_ends_at).toLocaleDateString()}</p>
                        )}
                        {!['completed', 'escalated'].includes(returnRequest.status) && (
                            <Button
                                type="button"
                                variant="outline"
                                className="mt-2 h-9 rounded-xl border-sky-200 bg-white text-xs font-black text-sky-700 hover:bg-sky-100"
                                onClick={handleEscalateReturn}
                                disabled={disputeSubmitting}
                            >
                                {disputeSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Escalate to Takeer
                            </Button>
                        )}
                    </div>
                )}

                {reportTarget.itemId && !showProviderReceiptActions && (
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
                                    <h2 className="text-2xl font-black tracking-tight">{isPhysicalProduct ? copy('Request a return', 'Omba kurudisha') : (isServiceProduct ? copy('Open a dispute', 'Fungua mgogoro') : copy('File a claim', 'Wasilisha dai'))}</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {isPhysicalProduct
                                            ? copy('Explain the issue and your request. The merchant will handle it according to the product return policy.', 'Eleza tatizo na ombi lako. Muuzaji ataishughulikia kulingana na return policy ya bidhaa.')
                                            : disputeAllowsOptionalEvidence
                                                ? 'Eleza kilichotokea. Unaweza kuongeza picha, video au PDF kama ushahidi.'
                                                : copy('Please upload an unboxing video and explain why you want to return the package or request a refund.', 'Tafadhali pakia video ya unboxing na maelezo ya kwanini unataka kurudisha mzigo au kurudishiwa pesa.')}
                                    </p>
                                </div>

                                <form onSubmit={handleFileDispute} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                            {isPhysicalProduct || disputeAllowsOptionalEvidence ? copy('Evidence (optional)', 'Ushahidi (si lazima)') : copy('Unboxing video (required)', 'Video ya unboxing (inahitajika)')}
                                        </label>
                                        {(isPhysicalProduct || disputeAllowsOptionalEvidence) && (
                                            <p className="text-xs leading-5 text-muted-foreground">
                                                {copy('You can add an image, video, or PDF.', 'Unaweza kuweka picha, video au PDF.')} {isPhysicalProduct ? copy('If the return needs help, you can escalate it to Takeer.', 'Return iki-hitaji msaada, unaweza kui-escalate kwa Takeer.') : copy('After the dispute is submitted, Takeer will continue holding the payment until the evidence is reviewed.', 'Mgogoro ukitumwa, Takeer itaendelea kushikilia malipo hadi ushahidi ukaguliwe.')}
                                            </p>
                                        )}
                                        <input
                                            type="file"
                                            accept={isPhysicalProduct || disputeAllowsOptionalEvidence ? 'image/*,video/*,application/pdf' : 'video/*'}
                                            onChange={e => setUnboxingVideo(e.target.files?.[0])}
                                            required={!isPhysicalProduct && !disputeAllowsOptionalEvidence}
                                            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                            {isPhysicalProduct ? copy('Reason for return', 'Sababu ya return') : (isServiceProduct ? copy('Reason for dispute', 'Sababu ya mgogoro') : copy('Reason for dispute', 'Sababu ya mgogoro'))}
                                        </label>
                                        <textarea
                                            required
                                            value={disputeReason}
                                            onChange={e => setDisputeReason(e.target.value)}
                                            placeholder={isCustomDeliveryProduct
                                                ? copy('E.g. Please change this part, or the file is not as agreed...', 'Mf. Naomba ubadilishe sehemu hii, au faili si kama tulivyokubaliana...')
                                                : (isServiceProduct
                                                    ? copy('E.g. The service was not delivered as agreed...', 'Mf. Huduma haikutolewa kama tulivyokubaliana...')
                                                    : copy('E.g. The product arrived damaged, incorrect, or not as described...', 'Mf. Bidhaa iliyofika imevunjika, si sahihi, au si kama ilivyoelezwa...'))}
                                            className="w-full min-h-[100px] rounded-2xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full h-12 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-brand-500/20" disabled={disputeSubmitting}>
                                        {disputeSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : (isPhysicalProduct ? 'TUMA RETURN REQUEST' : (isServiceProduct ? 'TUMA MGOGORO' : 'SUBMIT CLAIM'))}
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
    const { copy } = useLocale();
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
                        aria-label={copy('Close description', 'Funga maelezo')}
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
                        {copy('Okay', 'Sawa')}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function MembershipCard({ subscription, onCancel }) {
    const { copy } = useLocale();
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
    const periodLabel = isExpiredByTime ? copy('Membership expired', 'Uanachama umeisha') : copy('Membership active', 'Uanachama unaendelea');
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
                        <h3 className="mt-4 text-2xl font-black">{plan.name || copy('Membership plan', 'Mpango wa uanachama')}</h3>
                        <p className="mt-2 text-sm text-muted-foreground leading-6">{plan.description || copy('Recurring access to premium items.', 'Ufikiaji unaorudiwa wa bidhaa maalum.')}</p>
                    </div>
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${iconTone}`}>
                        <Crown className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <InfoChip icon={Store} label={copy('Merchant', 'Muuzaji')} value={merchant.display_name || merchant.name || copy('Takeer merchant', 'Muuzaji wa Takeer')} />
                    <InfoChip icon={CalendarClock} label={copy('Duration', 'Muda')} value={durationLabel} />
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
                            <p className="text-[11px] font-black uppercase tracking-widest opacity-70">{copy('Started', 'Ilianza')}</p>
                            <p className="mt-1 text-sm font-black">{periodStartLabel}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest opacity-70">{isExpiredByTime ? copy('Expired', 'Imeisha') : copy('Ends', 'Inaisha')}</p>
                            <p className="mt-1 text-sm font-black">{periodEndLabel}</p>
                        </div>
                    </div>
                    <p className="mt-4 text-xs font-semibold leading-5 opacity-80">
                        {isActiveStatus
                            ? copy('Subscription items stay available in Orders until this period ends.', 'Bidhaa za uanachama zitaendelea kupatikana kwenye Oda hadi muda huu uishe.')
                            : copy('Subscription access has ended. Direct purchases remain in your Library.', 'Ufikiaji wa uanachama umeisha. Ununuzi wa moja kwa moja unabaki kwenye Maktaba yako.')}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => router.visit(`/plan/${plan.slug || plan.id}`)}>
                        {copy('View plan', 'Tazama mpango')}
                    </Button>
                    {isActiveStatus && (
                        <Button className="rounded-2xl bg-red-600 hover:bg-red-700 text-white" onClick={onCancel}>
                            {copy('Cancel', 'Ghairi')}
                        </Button>
                    )}
                </div>

                {plan.id && (
                    <ContentReportButton
                        itemType="subscription_plan"
                        itemId={plan.id}
                        merchantId={merchant.id || plan.merchant_id || null}
                        context="membership"
                        label={copy('Report Membership', 'Ripoti uanachama')}
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
