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
    ShieldCheck,
    Truck,
    MessageSquare,
    Zap,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import ContentReportButton from '@/Components/ContentReportButton';
import { orderQuantityLabel, orderUnitPriceLabel } from '@/lib/productUnits';

const tabs = [
    { key: 'pulse', label: 'Pulse', icon: Store },
    { key: 'library', label: 'Library', icon: Library },
    { key: 'memberships', label: 'Memberships', icon: Crown },
];

export default function Orders() {
    const { auth } = usePage().props;
    const isMerchant = !!auth?.user?.is_merchant;

    const [activeTab, setActiveTab] = useState('pulse');
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
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [subscriptionPerPage, setSubscriptionPerPage] = useState(12);
    const [pulsePage, setPulsePage] = useState(1);
    const [pulsePerPage, setPulsePerPage] = useState(12);

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

            const [entitlementsRes, subscriptionsRes] = await Promise.allSettled([
                sessionApi.get('/orders/data/entitlements'),
                sessionApi.get('/orders/data/subscriptions'),
            ]);

            if (entitlementsRes.status === 'fulfilled') {
                const base = entitlementsRes.value.data?.entitlements || [];
                setEntitlements(base);
                setLibraryMeta(entitlementsRes.value.data?.meta || { current_page: 1, last_page: 1, total: base.length, unfiltered_total: base.length });
            } else {
                setEntitlements([]);
                setLibraryMeta({ current_page: 1, last_page: 1, total: 0, unfiltered_total: 0 });
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

            if (entitlementsRes.status === 'rejected' && subscriptionsRes.status === 'rejected') {
                throw new Error('Failed to load buyer data');
            }
        } catch (error) {
            toast.error('Imeshindwa kupakia library yako.');
        } finally {
            setLoading(false);
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
            setLibraryMeta(res.data?.meta || { current_page: 1, last_page: 1, total: 0, unfiltered_total: 0 });
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
        const contentCount = entitlements.filter((entry) => ['content_item', 'post'].includes(entry.item_type)).length;
        const bundleCount = entitlements.filter((entry) => entry.item_type === 'bundle').length;
        const productCount = entitlements.filter((entry) => entry.item_type === 'product').length;
        const activeSubs = subscriptions.filter((entry) => ['active', 'pending', 'past_due'].includes(entry.status)).length;

        return [
            { label: 'Owned Content', value: contentCount, icon: BookOpenText, tone: 'from-amber-500/15 to-orange-500/10 text-amber-700' },
            { label: 'Owned Bundles', value: bundleCount, icon: Boxes, tone: 'from-sky-500/15 to-cyan-500/10 text-sky-700' },
            { label: 'Products', value: productCount, icon: ShoppingBag, tone: 'from-violet-500/15 to-indigo-500/10 text-violet-700' },
            { label: 'Memberships', value: activeSubs, icon: Crown, tone: 'from-emerald-500/15 to-teal-500/10 text-emerald-700' },
        ];
    }, [entitlements, subscriptions]);

    const pulseItems = useMemo(() => {
        const entitlementItems = entitlements.map((entry) => {
            const item = entry.item || {};
            const merchant = entry.merchant || item.merchant || {};
            const isProduct = entry.item_type === 'product';
            const isPhysical = isProduct && (item.type === 'physical' || entry.library_type === 'physical_product');
            const isService = isProduct && (item.type === 'service' || entry.library_type === 'service_booking');
            const isCustom = isProduct && item.digital_delivery_type === 'custom_delivery';
            const orderStatus = entry.order_details?.payment_status;
            const title = item.title || item.name || 'Owned item';

            return {
                id: `entitlement-${entry.id}`,
                date: entry.granted_at || entry.starts_at,
                icon: isService ? CalendarClock : isPhysical ? Truck : isCustom ? Sparkles : isProduct ? ShoppingBag : BookOpenText,
                tone: isPhysical ? 'amber' : isService ? 'sky' : isCustom ? 'violet' : 'emerald',
                eyebrow: isPhysical ? 'Physical sale' : isService ? 'Service booking' : isCustom ? 'Custom delivery' : 'Entitled content',
                title,
                body: isPhysical
                    ? orderStatusLabel(entry.order_details)
                    : isService
                        ? serviceStatusLabel(entry.order_details)
                        : `${merchant.name || 'Merchant'} granted access to this item.`,
                meta: merchant.name || 'Takeer merchant',
                href: notificationHref(entry),
                action: isPhysical ? 'Track' : isService ? 'View booking' : 'Open',
                status: orderStatus || entry.status,
                sortDate: new Date(entry.granted_at || entry.starts_at || 0).getTime(),
            };
        });

        const subscriptionItems = subscriptions.map((subscription) => {
            const plan = subscription.plan || {};
            const merchant = subscription.merchant || {};

            return {
                id: `subscription-${subscription.id}`,
                date: subscription.started_at || subscription.created_at || subscription.current_period_start,
                icon: Crown,
                tone: ['active', 'pending', 'past_due'].includes(subscription.status) ? 'emerald' : 'slate',
                eyebrow: 'Subscribed access',
                title: plan.name || 'Membership plan',
                body: `Membership ${subscription.status || 'active'}${subscription.current_period_end ? ` until ${formatDate(subscription.current_period_end)}` : ''}.`,
                meta: merchant.display_name || merchant.name || 'Takeer merchant',
                href: `/plan/${plan.slug || plan.id}`,
                action: 'View plan',
                status: subscription.status,
                sortDate: new Date(subscription.started_at || subscription.created_at || subscription.current_period_start || 0).getTime(),
            };
        });

        const liveItems = merchantLive.map((event) => ({
            id: `live-${event.id}`,
            date: new Date().toISOString(),
            icon: ShoppingBag,
            tone: 'amber',
            eyebrow: 'Live product sale',
            title: event.product_title || 'New paid order',
            body: `Paid TZS ${Number(event.amount || 0).toLocaleString()} and waiting on merchant handling.`,
            meta: event.buyer_phone || 'Buyer',
            href: '/merchant/dashboard',
            action: 'Dashboard',
            status: event.status,
            sortDate: Date.now(),
        }));

        return [...liveItems, ...entitlementItems, ...subscriptionItems]
            .sort((a, b) => b.sortDate - a.sortDate);
    }, [entitlements, subscriptions, merchantLive]);

    const pulseLastPage = Math.max(Math.ceil(pulseItems.length / pulsePerPage), 1);
    const safePulsePage = Math.min(pulsePage, pulseLastPage);
    const visiblePulseItems = pulseItems.slice((safePulsePage - 1) * pulsePerPage, safePulsePage * pulsePerPage);

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
                <div className="max-w-6xl mx-auto p-6 md:p-8 pb-24 flex flex-col items-center justify-center min-h-[60vh] gap-3">
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
                            {pulseItems.length === 0 ? (
                                <EmptyPane icon={Library} title="No pulse yet" body="Your subscribed content, entitled items, and product order updates will appear here as a single feed." compact />
                            ) : (
                                <div className="divide-y divide-border/70">
                                    {visiblePulseItems.map((item) => (
                                        <PulseNotification key={item.id} item={item} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {pulseItems.length > 0 && (
                            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-semibold text-muted-foreground">
                                    Showing {visiblePulseItems.length} of {pulseItems.length} updates · Page {safePulsePage} / {pulseLastPage}
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
    const Icon = item.icon || Library;
    const toneClass = {
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        sky: 'bg-sky-50 text-sky-700 border-sky-100',
        violet: 'bg-violet-50 text-violet-700 border-violet-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
    }[item.tone] || 'bg-slate-50 text-slate-600 border-slate-100';

    return (
        <div className="grid gap-3 p-4 md:grid-cols-[auto_1fr_auto] md:items-center md:p-5">
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

            {item.href ? (
                <Button variant="outline" className="h-10 rounded-xl md:w-28" onClick={() => router.visit(item.href)}>
                    {item.action || 'Open'}
                </Button>
            ) : (
                <Button variant="outline" className="h-10 rounded-xl md:w-28" disabled>
                    {item.action || 'Open'}
                </Button>
            )}
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
    if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted') return 'Shipping quote is ready for payment.';
    if (orderDetails.payment_status === 'awaiting_merchant_confirmation') return 'Paid order is waiting for merchant confirmation.';
    if (orderDetails.payment_status === 'escrow_locked') return 'Payment is protected while delivery is in progress.';
    if (orderDetails.payment_status === 'resolved_merchant_paid') return 'Order completed and merchant has been paid.';
    if (orderDetails.payment_status === 'disputed') return 'A claim is open for this order.';
    return String(orderDetails.payment_status || 'Order update').replaceAll('_', ' ');
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
    const [confirmingReceipt, setConfirmingReceipt] = useState(false);
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
    const refundPolicy = orderDetails?.refund_policy || null;
    const canOpenRefundClaim = !refundPolicy || refundPolicy.status === 'eligible';
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
        setPayingInquiry(true);
        try {
            const res = await window.axios.post(`/api/v1/checkout/pay-inquiry/${orderId}`);
            toast.success(res.data.message || 'Ombi la malipo limetumwa! Weka PIN kwenye simu yako.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Imeshindikana kuanzisha malipo. Jaribu tena.');
        } finally {
            setPayingInquiry(false);
        }
    };
    const orderId = entry.source_type === 'order' ? entry.source_id : null;
    const targetUrl = String(item.url || item.download_link || '').trim();
    const isLinkDigital = isDigitalProduct && /^[a-z][a-z0-9+\-.]*:\/\//i.test(targetUrl);

    const handleConfirmReceipt = async () => {
        const message = isServiceProduct
            ? 'Umehakikisha huduma imetolewa kama mlivyokubaliana? Malipo yatatumwa kwa mtoa huduma.'
            : 'Umehakikisha umepokea mzigo huu na uko katika hali nzuri? Hela zitatumwa kwa muuzaji mara moja.';
        if (!confirm(message)) return;
        setConfirmingReceipt(true);
        try {
            await axios.post(`/api/buyer/orders/${orderDetails.id}/confirm-receipt`);
            toast.success('Hifadhi imethibitishwa! Asante.');
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
        subscription_plan: { icon: Crown, label: 'Post Content', href: item.slug || item.id ? `/plan/${item.slug || item.id}` : null },
        product: { icon: ShoppingBag, label: 'Physical Product', href: item.slug ? route('product.show', item.slug) : null },
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

        if (!orderId) {
            toast.error('Pakua inapatikana kwa manunuzi ya moja kwa moja ya bidhaa hii.');
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
        <Card className="rounded-[24px] overflow-hidden border-border/70">
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
            <CardContent className="p-5 -mt-10 relative">
                <div className="h-14 w-14 bg-background border shadow-sm flex items-center justify-center rounded-2xl">
                    <Icon className="h-6 w-6 text-brand-600" />
                </div>
                <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-700">{config.label}</span>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{entry.source_type}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-black leading-tight">{item.title || item.name || 'Owned item'}</h3>
                    {(item.excerpt || item.description) && (
                        <p className="mt-2 text-sm text-muted-foreground leading-6 line-clamp-2">
                            {item.excerpt || item.description}
                        </p>
                    )}
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">
                        Added {formatDate(entry.granted_at || entry.starts_at)}
                    </p>
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
                                <p className="mt-1 text-sm font-bold">
                                    {customDelivery?.file_name || 'Merchant is preparing your custom delivery.'}
                                </p>
                                {customDelivery?.message && (
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground whitespace-pre-line">{customDelivery.message}</p>
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
                                        placeholder="Need changes? Tell the creator what to revise..."
                                        className="w-full rounded-2xl border border-input bg-background p-3 text-sm"
                                    />
                                    <Button variant="outline" className="w-full rounded-xl" onClick={handleRequestRevision} disabled={revisionSubmitting || revisionMessage.trim().length < 10}>
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
                            ) : isLinkDigital ? (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open Link
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
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shipping:</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${orderDetails.payment_status === 'resolved_merchant_paid' ? 'text-green-600' :
                                    orderDetails.payment_status === 'disputed' ? 'text-red-600' :
                                        orderDetails.payment_status === 'failed' ? 'text-red-600' :
                                            'text-amber-600'
                                    }`}>
                                    {(() => {
                                        const delivType = orderDetails.delivery?.delivery_type || orderDetails.delivery?.type;
                                        // Final status takes precedence
                                        if (orderDetails.payment_status === 'resolved_merchant_paid') return 'Imekamilika';
                                        if (orderDetails.payment_status === 'failed') return 'Imesitishwa';
                                        if (orderDetails.payment_status === 'confirmed') return 'Imepokelewa';
                                        if (orderDetails.payment_status === 'disputed') return 'Mgogoro';

                                        // Inquiry pending — merchant hasn't set shipping yet
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'pending') return 'Inasubiri Bei ya Usafiri';
                                        // Inquiry quoted — shipping fee provided, waiting for buyer to pay
                                        if (orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted') return 'Bei Imewekwa — Lipia Sasa';
                                        // Self pickup orders
                                        if (delivType === 'self_pickup') return 'Kuchukua Dukani';
                                        // Shipping statuses
                                        if (orderDetails.payment_status === 'awaiting_merchant_confirmation') return 'Inasubiri Utumaji';
                                        if (orderDetails.payment_status === 'escrow_locked') return orderDetails.delivery?.status || 'Ikiwa Safehold';
                                        if (orderDetails.payment_status === 'shipped') return 'Imetumwa';
                                        // Fallback: show delivery type if known
                                        if (delivType) return delivType.replace(/_/g, ' ');
                                        return orderDetails.payment_status?.replace(/_/g, ' ') || 'Inaendelea';
                                    })()}
                                </span>
                            </div>

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

                            {orderDetails.is_inquiry && orderDetails.inquiry_status === 'quoted' && orderDetails.payment_status === 'pending' && (
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
                            {orderDetails.payment_status === 'awaiting_merchant_confirmation' && orderDetails.delivery?.type === 'self_pickup' && (
                                <div className="p-3 rounded-2xl bg-brand-50 border border-brand-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-brand-700 mb-1">Your Pickup PIN</p>
                                    <p className="text-xl font-mono font-black tracking-widest text-brand-600">
                                        {showPin ? (orderDetails.delivery?.pickup_pin || '0000') : '****'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        className="mt-1 text-[10px] font-bold text-brand-500 underline uppercase tracking-widest"
                                    >
                                        {showPin ? 'Hide PIN' : 'Reveal PIN'}
                                    </button>
                                    <p className="mt-2 text-[10px] text-brand-800 leading-tight">Mpe huyu PIN boda wako. Atampa muuzaji mzigo unapochukuliwa.</p>
                                </div>
                            )}

                            {orderDetails.payment_status === 'escrow_locked' && orderDetails.delivery?.type === 'local_boda' && (
                                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
                                    <p className="text-[10px] font-black uppercase text-indigo-700 mb-1">Your Release PIN</p>
                                    <p className="text-xl font-mono font-black tracking-widest text-indigo-600">
                                        {showPin ? (orderDetails.delivery?.buyer_release_pin || '0000') : '****'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        className="mt-1 text-[10px] font-bold text-indigo-500 underline uppercase tracking-widest"
                                    >
                                        {showPin ? 'Hide PIN' : 'Reveal PIN'}
                                    </button>
                                    <p className="mt-2 text-[10px] text-indigo-800 leading-tight">Mpe boda wa muuzaji PIN hii akishakukabidhi mzigo wako.</p>
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

                            {(orderDetails.payment_status === 'confirmed' || orderDetails.payment_status === 'resolved_merchant_paid') && (
                                <Button
                                    className="w-full h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px]"
                                    onClick={() => router.visit(orderDetails?.public_id ? `/chat/${orderDetails.public_id}` : `/orders/${orderDetails.id}`)}
                                >
                                    Fungua Chat / Toa Review
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

                {refundPolicy && (
                    <div className={`mt-3 rounded-2xl border px-3 py-3 text-xs leading-5 ${refundPolicyTone}`}>
                        <p className="font-black uppercase tracking-widest">
                            {canOpenRefundClaim ? 'Refund review available' : 'Refund claim unavailable'}
                        </p>
                        <p className="mt-1">{refundPolicy.reason}</p>
                        {refundPolicy.window_ends_at && (
                            <p className="mt-1 font-bold">Window ends {new Date(refundPolicy.window_ends_at).toLocaleDateString()}</p>
                        )}
                        {Number(refundPolicy.download_count || 0) > 0 && (
                            <p className="mt-1 font-bold">Access count: {refundPolicy.download_count}</p>
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
            </CardContent>
        </Card>
    );
}

function MembershipCard({ subscription, onCancel }) {
    const plan = subscription.plan || {};
    const merchant = subscription.merchant || {};
    const statusTone = ['active', 'pending', 'past_due'].includes(subscription.status)
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-muted text-muted-foreground';

    return (
        <Card className="rounded-[24px] border-border/70 overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 border-b">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${statusTone}`}>
                            {subscription.status}
                        </span>
                        <h3 className="mt-4 text-2xl font-black">{plan.name || 'Membership plan'}</h3>
                        <p className="mt-2 text-sm text-muted-foreground leading-6">{plan.description || 'Recurring access to premium items.'}</p>
                    </div>
                    <div className="h-14 w-14 bg-white border flex items-center justify-center shadow-sm">
                        <Crown className="h-6 w-6 text-emerald-600" />
                    </div>
                </div>
            </div>

            <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <InfoChip icon={Store} label="Merchant" value={merchant.display_name || merchant.name || 'Takeer merchant'} />
                    <InfoChip icon={CalendarClock} label="Billing" value={`${plan.interval_count || 1} ${plan.billing_interval || 'month'}`} />
                </div>

                <div className="rounded-2xl bg-accent/40 px-4 py-4">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Current period ends</p>
                    <p className="mt-2 text-sm font-bold">{formatDate(subscription.current_period_end)}</p>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => router.visit(`/plan/${plan.slug || plan.id}`)}>
                        View plan
                    </Button>
                    {['active', 'pending', 'past_due'].includes(subscription.status) && (
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
