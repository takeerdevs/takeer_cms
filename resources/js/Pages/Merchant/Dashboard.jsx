import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    Package, ShoppingBag, Video, UploadCloud,
    TrendingUp, Store, ChevronRight, Truck, ShieldCheck,
    AlertTriangle, FileCheck, CheckCircle2, Settings, BookOpenText, Boxes, Crown, Download, CalendarClock, MapPin, MessageSquare,
    Users, ClipboardList, BarChart3, UserCog, Utensils, BedDouble, Clock3, Megaphone, LayoutGrid, Layers, Link2
} from 'lucide-react';
import { router } from '@inertiajs/react';
import ProfileSwitcher from '@/Components/ProfileSwitcher';
import { useMerchantPermissions } from '@/lib/merchantPermissions';
import { businessToolLabel } from '@/lib/businessToolCopy';
import { useLocale } from '@/lib/i18n';

export default function MerchantDashboard({ merchantUsername, merchantName }) {
    const { auth } = usePage().props;
    const { locale, t, copy } = useLocale();

    // In production, these should come from a dedicated API endpoint / Inertia props
    // We default them to empty/0 so the dashboard doesn't crash before the backend sends them
    const summary = auth?.user?.merchant_summary || {
        total_products: 0,
        orders_today: 0,
        orders_pending: 0,
        orders_completed: 0,
    };

    const recentOrders = auth?.user?.recent_orders || [];

    const merchantProfile = auth?.user?.merchant_profiles?.find(p => p.username === merchantUsername)
        || auth?.user?.merchant_profiles?.[0];
    const merchantSlug = merchantUsername || merchantProfile?.username || '';
    const businessCurrencyCode = merchantProfile?.currency?.code || merchantProfile?.currency_code || summary.currency_code || 'TZS';
    const isVerified = merchantProfile?.is_verified ?? false;
    const activeModules = merchantProfile?.active_modules || [];
    const commerceModes = merchantProfile?.business_profile?.commerce_modes || [];
    const recommendedModules = merchantProfile?.business_profile?.recommended_modules || [];
    const { can, canAny } = useMerchantPermissions(merchantSlug);
    const canCreateItem = canAny(['products.create', 'digital_products.create']);
    const hasModule = (module) => activeModules.includes(module);
    const hasMode = (mode) => commerceModes.includes(mode);
    const usesConfiguredSetup = activeModules.length > 0 || commerceModes.length > 0;
    const formatMoney = (amount, currency = businessCurrencyCode) => {
        const code = currency || 'TZS';

        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: code,
                minimumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(code) ? 0 : 2,
                maximumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(code) ? 0 : 2,
            }).format(Number(amount || 0));
        } catch {
            return `${code} ${Number(amount || 0).toLocaleString()}`;
        }
    };

    const statusBadge = (status) => {
        const map = {
            pending_fulfillment: { label: copy('FULFILLMENT', 'UTIMILISHAJI'), cls: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
            release_eligible: { label: copy('READY FOR PSP', 'IKO TAYARI KWA PSP'), cls: 'bg-brand-500/20 text-brand-700 dark:text-brand-300' },
            payout_processing: { label: copy('PSP PAYOUT', 'MALIPO YA PSP'), cls: 'bg-sky-500/20 text-sky-700 dark:text-sky-300' },
            paid_out: { label: copy('COMPLETED', 'IMEKAMILIKA'), cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
            disputed: { label: copy('DISPUTED', 'MGOGORO'), cls: 'bg-red-500/20 text-red-700 dark:text-red-300' },
            refunded: { label: copy('REFUNDED', 'IMEREJESHWA'), cls: 'bg-slate-500/20 text-slate-700 dark:text-slate-300' },
            pending: { label: copy('PENDING', 'INASUBIRI'), cls: 'bg-slate-500/20 text-slate-700 dark:text-slate-300' },
            failed: { label: copy('FAILED', 'IMESHINDWA'), cls: 'bg-red-500/20 text-red-700 dark:text-red-300' },
        };
        const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
        );
    };

    const typeMeta = (kind) => {
        const map = {
            physical_product: { label: copy('Physical product', 'Bidhaa ya kawaida'), icon: ShoppingBag, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
            post_content: { label: copy('Post content', 'Maudhui ya chapisho'), icon: BookOpenText, cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
            subscription_plan: { label: copy('Membership', 'Uanachama'), icon: Crown, cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
            digital_file: { label: copy('Digital file', 'Faili ya kidijitali'), icon: Download, cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' },
            service_booking: { label: copy('Service/booking', 'Huduma/booking'), icon: CalendarClock, cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
            offering_group: { label: copy('Offering group', 'Kikundi cha ofa'), icon: Layers, cls: 'bg-teal-500/15 text-teal-700 dark:text-teal-300' },
            physical_bundle: { label: copy('Physical bundle', 'Kifurushi cha kawaida'), icon: Boxes, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
        };
        return map[kind] || { label: copy('Post content', 'Maudhui ya chapisho'), icon: BookOpenText, cls: 'bg-muted text-muted-foreground' };
    };

    const iconFromKey = (key) => {
        const map = {
            shopping_bag: ShoppingBag,
            book_open: BookOpenText,
            download: Download,
            calendar_clock: CalendarClock,
            boxes: Boxes,
            crown: Crown,
            layers: Layers,
        };
        return map[key] || Package;
    };

    const setupQuickActions = [
        ...(canAny(['settings.view', 'settings.update']) ? [{
            key: 'modules',
            label: copy('Business tools', 'Zana za Biashara'),
            icon: Settings,
            href: `/merchant/${merchantSlug}/modules`,
        }] : []),
        ...((hasModule('products') || hasMode('physical_products')) && can('products.create') ? [{
            key: 'product',
            label: copy('Add product', 'Ongeza Bidhaa'),
            icon: Package,
            href: `/merchant/${merchantSlug}/upload?type=physical`,
            primary: true,
        }] : []),
        ...((hasModule('menu') || hasMode('food_menu')) && can('products.create') ? [{
            key: 'menu',
            label: copy('Add menu item', 'Ongeza kipengele cha menyu'),
            icon: ShoppingBag,
            href: `/merchant/${merchantSlug}/upload?type=physical&module=menu`,
            primary: !hasModule('products') && !hasMode('physical_products'),
        }] : []),
        /* Service creation is intentionally commented out for the launch.
           Restore this quick action when service-provider onboarding is ready. */
        /* Scheduling and booking quick actions are intentionally commented out
           with the service launch scope. */
        ...((hasModule('digital_products') || hasMode('digital_products')) && can('digital_products.create') ? [{
            key: 'digital',
            label: copy('Add digital product', 'Ongeza bidhaa ya kidijitali'),
            icon: Download,
            href: `/merchant/${merchantSlug}/upload?type=digital`,
        }] : []),
        /* Custom service orders are also part of the deferred service launch. */
        ...((hasModule('courses') || hasModule('workshops') || hasMode('courses_learning')) && can('bundles.view') ? [{
            key: 'course',
            label: copy('Courses / classes', 'Kozi / madarasa'),
            icon: BookOpenText,
            href: `/merchant/${merchantSlug}/courses`,
        }] : []),
        ...((hasModule('enrollments') || hasModule('courses') || hasModule('workshops') || hasMode('courses_learning')) && canAny(['bundles.manage_course', 'orders.view']) ? [{
            key: 'enrollments',
            label: copy('Manage enrollments', 'Simamia usajili'),
            icon: FileCheck,
            href: `/merchant/${merchantSlug}/enrollments`,
        }] : []),
        ...((hasModule('subscriptions') || hasMode('subscriptions_memberships')) && can('subscriptions.view') ? [{
            key: 'subscriptions',
            label: copy('Subscriptions', 'Usajili wa mara kwa mara'),
            icon: Crown,
            href: `/merchant/${merchantSlug}/subscriptions`,
        }] : []),
        ...((hasModule('customers') || hasModule('orders') || hasModule('marketing') || hasMode('physical_products') || hasMode('services_bookings') || hasMode('courses_learning') || hasMode('subscriptions_memberships')) && canAny(['orders.view', 'marketing.view', 'retail.customers']) ? [{
            key: 'customers',
            label: copy('Customers', 'Wateja'),
            icon: ShieldCheck,
            href: `/merchant/${merchantSlug}/customers`,
        }] : []),
        ...((hasModule('communications') || hasModule('customers') || hasModule('marketing') || hasModule('orders') || hasMode('physical_products') || hasMode('services_bookings') || hasMode('courses_learning') || hasMode('subscriptions_memberships')) && canAny(['marketing.view', 'orders.view', 'services.view']) ? [{
            key: 'communications',
            label: copy('Communications', 'Mawasiliano'),
            icon: MessageSquare,
            href: `/merchant/${merchantSlug}/communications`,
        }] : []),
        ...((hasModule('team') || hasModule('retail_ops')) && can('team.view') ? [{
            key: 'team',
            label: copy('Team', 'Timu'),
            icon: Store,
            href: `/merchant/${merchantSlug}/team`,
        }] : []),
        ...((hasModule('reports') || hasModule('bookkeeping') || hasModule('orders')) && canAny(['dashboard.view', 'orders.view', 'bookkeeping.view']) ? [{
            key: 'overview',
            label: copy('Business overview', 'Muhtasari wa biashara'),
            icon: TrendingUp,
            href: `/merchant/${merchantSlug}/overview`,
        }] : []),
    ];
    const primaryAction = setupQuickActions.find(action => action.primary) || setupQuickActions[0];
    const secondaryActions = setupQuickActions.filter(action => action.key !== primaryAction?.key).slice(0, 5);
    const workspaceItems = [
        { key: 'products', label: copy('Products', 'Bidhaa'), description: copy('Inventory, variants, stock, and product listings.', 'Inventory, variants, stock na orodha za bidhaa.'), icon: Package, href: `/merchant/${merchantSlug}/products`, permissions: ['products.view'], modules: ['products'], modes: ['physical_products'] },
        { key: 'menu', label: copy('Menu', 'Menyu'), description: copy('Food, drinks, add-ons, and menu prices.', 'Chakula, vinywaji, viongezi na bei za menyu.'), icon: Utensils, href: `/merchant/${merchantSlug}/menu`, permissions: ['products.view'], modules: ['menu'], modes: ['food_menu'] },
        { key: 'orders', label: copy('Orders', 'Oda'), description: copy('Purchases, payment status, fulfillment, and dispatch.', 'Manunuzi, hali ya malipo, utimilishaji na usafirishaji.'), icon: ShoppingBag, href: `/merchant/${merchantSlug}/orders`, permissions: ['orders.view'], modules: ['orders'], modes: ['physical_products', 'food_menu', 'digital_products', 'custom_orders_quotes', 'subscriptions_memberships'] },
        { key: 'link_buy_requests', label: copy('Online buyer requests', 'Maombi ya wanunuzi mtandaoni'), description: copy('Track secure Link Buy requests and see where customer traffic originated.', 'Fuatilia maombi salama ya Link Buy na uone wateja walikotoka.'), icon: Link2, href: '/merchant/social-commerce/requests', permissions: ['orders.view'], modules: ['orders'], modes: ['physical_products', 'food_menu', 'custom_orders_quotes'] },
        /* Service, custom-order, availability, and booking workspace items are
           intentionally commented out for the launch. */
        { key: 'digital_products', label: copy('Digital products', 'Bidhaa za kidijitali'), description: copy('Downloads, files, content access, and license keys.', 'Upakuaji, faili, ufikiaji wa maudhui na funguo za leseni.'), icon: Download, href: `/merchant/${merchantSlug}/downloads`, permissions: ['digital_products.view'], modules: ['digital_products'], modes: ['digital_products'] },
        { key: 'courses', label: copy('Courses / classes', 'Kozi / madarasa'), description: copy('Learning services, lessons, cohorts, and materials.', 'Huduma za kujifunza, masomo, cohorts na vifaa.'), icon: BookOpenText, href: `/merchant/${merchantSlug}/courses`, permissions: ['bundles.view'], modules: ['courses', 'workshops'], modes: ['courses_learning'] },
        { key: 'enrollments', label: copy('Enrollments', 'Usajili'), description: copy('Students, participants, applicants, and class statuses.', 'Wanafunzi, washiriki, waombaji na hali za darasa.'), icon: ClipboardList, href: `/merchant/${merchantSlug}/enrollments`, permissions: ['bundles.manage_course', 'orders.view'], modules: ['enrollments', 'courses', 'workshops'], modes: ['courses_learning'] },
        { key: 'subscriptions', label: copy('Subscriptions', 'Usajili wa mara kwa mara'), description: copy('Membership plans, recurring access, and members.', 'Mipango ya uanachama, ufikiaji wa mara kwa mara na wanachama.'), icon: Crown, href: `/merchant/${merchantSlug}/subscriptions`, permissions: ['subscriptions.view'], modules: ['subscriptions'], modes: ['subscriptions_memberships'] },
        { key: 'customers', label: copy('Customers / CRM', 'Wateja / CRM'), description: copy('Buyers, guests, students, members, and returning customers.', 'Wanunuzi, wageni, wanafunzi, wanachama na wateja wanaorudi.'), icon: Users, href: `/merchant/${merchantSlug}/customers`, permissions: ['orders.view', 'marketing.view', 'retail.customers'], modules: ['customers'], modes: ['physical_products', 'services_bookings', 'courses_learning', 'subscriptions_memberships'] },
        { key: 'communications', label: copy('Communications', 'Mawasiliano'), description: copy('Follow-ups, reminders, updates, and contact logs.', 'Ufuatiliaji, vikumbusho, masasisho na kumbukumbu za mawasiliano.'), icon: MessageSquare, href: `/merchant/${merchantSlug}/communications`, permissions: ['marketing.view', 'orders.view', 'services.view'], modules: ['communications'], modes: ['physical_products', 'services_bookings', 'courses_learning', 'subscriptions_memberships'] },
        { key: 'marketing', label: copy('Marketing', 'Masoko'), description: copy('Campaigns, coupons, referrals, SMS, social DMs, and WhatsApp.', 'Kampeni, kuponi, referrals, SMS, DM za kijamii na WhatsApp.'), icon: Megaphone, href: `/merchant/${merchantSlug}/marketing`, permissions: ['marketing.view'], modules: ['marketing'], modes: [] },
        { key: 'reports', label: copy('Business overview', 'Muhtasari wa biashara'), description: copy('Revenue, customers, bookings, catalog, team, and operations.', 'Mapato, wateja, booking, katalogi, timu na shughuli.'), icon: BarChart3, href: `/merchant/${merchantSlug}/overview`, permissions: ['dashboard.view', 'orders.view', 'bookkeeping.view'], modules: ['reports'], modes: [] },
        // Bookkeeping is intentionally hidden until the launch-phase workflow is complete.
        { key: 'team', label: copy('Team', 'Timu'), description: copy('Staff roles, workplace access, PINs, and permissions.', 'Majukumu ya wafanyakazi, ufikiaji, PIN na ruhusa.'), icon: UserCog, href: `/merchant/${merchantSlug}/team`, permissions: ['team.view'], modules: ['team', 'retail_ops'], modes: [] },
        { key: 'retail_ops', label: copy('Retail / POS', 'Rejareja / POS'), description: copy('POS, inventory, transfers, storekeeper tools, and counters.', 'POS, inventory, uhamisho, zana za storekeeper na kaunta.'), icon: Store, href: `/merchant/${merchantSlug}/retail/dashboard`, permissions: ['retail.dashboard', 'retail.pos', 'retail.inventory'], modules: ['retail_ops'], modes: [] },
    ]
        .filter(item => item.modules.some(hasModule) || item.modes.some(hasMode))
        .filter(item => (item.requiresModules || []).every(hasModule))
        .filter(item => canAny(item.permissions));

    return (
        <AppLayout>
            <Head title={`${t('merchantUi.myBusiness')} | Takeer`} />
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
                            <h1 className="text-xl md:text-2xl font-black tracking-tight">{t('merchantUi.myBusiness')} 🛍️</h1>
                            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                                {t('merchantUi.welcome')}, <span className="font-semibold text-foreground">{merchantProfile?.display_name || merchantProfile?.username || t('merchantUi.seller')}</span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ProfileSwitcher />
                        {can('settings.view') && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-xl h-9 w-9 border-muted"
                                onClick={() => router.visit(`/merchant/${merchantSlug}/settings`)}
                            >
                                <Settings className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        )}
                        <a
                            href={`/m/${merchantSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 shadow-sm border border-brand-200 hover:bg-brand-100 px-3 py-2 rounded-xl transition-colors shrink-0"
                        >
                            <Store className="h-4 w-4" /> {copy('View business', 'Angalia biashara')}
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
                                <h3 className="font-bold text-amber-900 dark:text-amber-500">{copy('Your business is not verified', 'Biashara yako haijathibitishwa')}</h3>
                                <p className="text-sm text-amber-800 dark:text-amber-400/80 mt-1 max-w-2xl">
                                    {copy('Verify your business (KYC) to start receiving payments through Takeer Instant Checkout. For now, buyers will see a warning and must contact you outside the platform.', 'Thibitisha biashara yako (KYC) ili uanze kupokea malipo kupitia Takeer Instant Checkout. Kwa sasa, wanunuzi wataonyeshwa onyo na watalazimika kuwasiliana nawe nje ya mfumo.')}
                                </p>
                            </div>
                        </div>
                        {can('kyc.view') && (
                            <Link
                                href={`/merchant/${merchantSlug}/kyc`}
                                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md px-4 py-2 inline-flex items-center"
                            >
                                <FileCheck className="mr-2 h-4 w-4" /> {copy('Start verification (KYC)', 'Anza uthibitisho (KYC)')}
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-green-900 dark:text-green-500">{copy('Your business is verified', 'Biashara yako imethibitishwa')} <ShieldCheck className="h-4 w-4 inline text-green-600" /></h3>
                                <p className="text-sm text-green-800 dark:text-green-400 mt-1">
                                    {copy('Payments are processed by a licensed PSP and order protection follows provider rules.', 'Malipo yanachakatwa na PSP mwenye leseni na ulinzi wa oda unafuata masharti ya mtoa huduma.')}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {isVerified && activeModules.length === 0 && recommendedModules.length > 0 && can('settings.update') && (
                    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-black text-brand-950">{copy('Choose what this business does', 'Chagua biashara hii inafanya nini')}</h3>
                            <p className="text-sm text-brand-800 mt-1 max-w-2xl">
                                {copy('These tools are recommended based on your selected activities. Choose what this business uses: products, digital products, menu, courses, orders, bookkeeping, and more.', 'Kuna zana zilizopendekezwa kulingana na shughuli ulizochagua. Chagua biashara hii inatumia nini: bidhaa, bidhaa za kidijitali, menyu, kozi, oda, utunzaji wa vitabu na zaidi.')}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {recommendedModules.slice(0, 8).map(module => (
                                    <span key={module} className="rounded-full bg-white border border-brand-100 px-2.5 py-1 text-[10px] font-black text-brand-700">
                                        {businessToolLabel(module, locale)}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <Button
                            className="shrink-0 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                            onClick={() => router.visit(`/merchant/${merchantSlug}/settings`)}
                        >
                            {copy('Set up tools', 'Weka zana')}
                        </Button>
                    </div>
                )}

                {/* KPI chips */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        ...(can('products.view') ? [{ label: copy('Products', 'Bidhaa'), value: summary.total_products, icon: Package, color: 'text-brand-600', link: `/merchant/${merchantSlug}/products` }] : []),
                        ...(can('orders.view') ? [
                            { label: copy('Orders today', 'Oda leo'), value: summary.orders_today, icon: TrendingUp, color: 'text-green-600', link: `/merchant/${merchantSlug}/orders` },
                            { label: copy('Pending', 'Zinasubiri'), value: summary.orders_pending, icon: Truck, color: 'text-amber-600', link: `/merchant/${merchantSlug}/orders` },
                        ] : []),
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
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">{t('merchantUi.quickActions')}</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {usesConfiguredSetup && primaryAction ? (
                            <Button
                                className="h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-brand-600/20"
                                onClick={() => router.visit(primaryAction.href)}
                            >
                                {React.createElement(primaryAction.icon, { className: 'h-5 w-5' })} {primaryAction.label}
                            </Button>
                        ) : canCreateItem && (
                            <Button
                                className="h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-brand-600/20"
                                onClick={() => router.visit(`/merchant/${merchantSlug}/upload`)}
                            >
                                <UploadCloud className="h-5 w-5" /> {copy('Add product', 'Ongeza bidhaa')}
                            </Button>
                        )}
                        {usesConfiguredSetup && secondaryActions.map(action => (
                            <Button
                                key={action.key}
                                variant="outline"
                                className="h-14 rounded-2xl font-bold flex items-center gap-2"
                                onClick={() => router.visit(action.href)}
                            >
                                {React.createElement(action.icon, { className: 'h-5 w-5' })} {action.label}
                            </Button>
                        ))}
                        {can('posts.view') && (
                            <Button
                                variant="outline"
                                className="h-14 rounded-2xl font-bold flex items-center gap-2"
                                onClick={() => router.visit(`/merchant/${merchantSlug}/posts`)}
                            >
                                <BookOpenText className="h-5 w-5" /> {copy('Posts', 'Machapisho')}
                            </Button>
                        )}
                        {can('orders.view') && (
                            <Button
                                variant="outline"
                                className="h-14 rounded-2xl font-bold flex items-center gap-2 col-span-2"
                                onClick={() => router.visit(`/merchant/${merchantSlug}/orders`)}
                            >
                                <ShoppingBag className="h-5 w-5" /> {copy('View all orders', 'Angalia oda zote')} <ChevronRight className="h-4 w-4 ml-auto" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Workspace launcher */}
                {usesConfiguredSetup && (
                    <div>
                        <div className="mb-3 flex items-center justify-between gap-3 px-1">
                            <div>
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('merchantUi.workspace')}</h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {workspaceItems.length} {copy(workspaceItems.length === 1 ? 'active tool' : 'active tools', workspaceItems.length === 1 ? 'zana inayotumika' : 'zana zinazotumika')} {copy('for this business.', 'kwa biashara hii.')}
                                </p>
                            </div>
                            {can('settings.view') && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => router.visit(`/merchant/${merchantSlug}/modules`)}
                                >
                                    <LayoutGrid className="mr-2 h-4 w-4" />
                                    {copy('Tools', 'Zana')}
                                </Button>
                            )}
                        </div>

                        {workspaceItems.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-border bg-card/40 p-6 text-center">
                                <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground" />
                                <p className="mt-3 text-sm font-semibold text-muted-foreground">{copy('No tools are available for your current permissions.', 'Hakuna zana zinazopatikana kwa ruhusa zako za sasa.')}</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {workspaceItems.map((item) => (
                                    <Card
                                        key={item.key}
                                        className="group cursor-pointer overflow-hidden border-border/70 transition-all hover:border-brand-300 hover:bg-brand-50/40 active:scale-[0.99]"
                                        onClick={() => router.visit(item.href)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-colors group-hover:bg-brand-100 group-hover:text-brand-700">
                                                    {React.createElement(item.icon, { className: 'h-5 w-5' })}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h3 className="font-black leading-tight group-hover:text-brand-800">{item.label}</h3>
                                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700" />
                                                    </div>
                                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Recent Orders */}
                {can('orders.view') && (
                <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">{t('merchantUi.recentOrders')}</h2>
                    <div className="space-y-3">
                        {recentOrders.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground bg-card/40 rounded-3xl border border-border/50">
                                <p className="text-sm font-semibold">{copy('No new orders.', 'Hakuna oda mpya.')}</p>
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
                                                        <p className="font-black text-sm md:text-lg truncate group-hover:text-brand-700 transition-colors">{order.display_title || copy('Order item', 'Kipengele cha oda')}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                                                            {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{copy('Price', 'Bei')}</p>
                                                    <p className="font-black text-brand-600 text-lg md:text-2xl">{formatMoney(order.amount || 0, order.currency_code || businessCurrencyCode)}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
                )}
            </div>
        </AppLayout>
    );
}
