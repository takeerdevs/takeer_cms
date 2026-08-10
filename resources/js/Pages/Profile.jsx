import React, { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage, router, useForm } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/Components/ui/Dialog';
import {
    User, Shield, Settings, LogOut, Store, ExternalLink, ChevronRight, Plus, ChevronDown, ChevronUp, BarChart3, Package, DownloadCloud, Briefcase,
    Wallet, CreditCard, Link as LinkIcon, Truck, TrendingUp, AlertTriangle, FileCheck, CheckCircle2, ShieldCheck, BookOpenText, Boxes, Crown, CalendarClock, ShoppingBag,
    Mail, Phone, Fingerprint, FileText, Camera, Clock, ArrowLeft, Building2, Landmark, ShieldAlert, Smartphone, User2, MessageSquare, HardDrive, Megaphone, Layers,
    Search, Loader2, KeyRound, MapPin, Globe, Ship
} from 'lucide-react';
import axios from 'axios';
import ProfileSwitcher from '@/Components/ProfileSwitcher';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { businessToolLabel } from '@/lib/businessToolCopy';
import { useLocale } from '@/lib/i18n';

import {
    Dialog as CreateDialog,
    DialogContent as CreateDialogContent,
    DialogHeader as CreateDialogHeader,
    DialogTitle as CreateDialogTitle,
    DialogDescription as CreateDialogDescription,
    DialogFooter as CreateDialogFooter
} from '@/Components/ui/Dialog';

function orderIconFromKey(key) {
    const map = {
        shopping_bag: ShoppingBag,
        book_open: BookOpenText,
        download: DownloadCloud,
        calendar_clock: CalendarClock,
        boxes: Boxes,
        crown: Crown,
        layers: Layers,
    };
    return map[key] || Package;
}

function RecentOrderThumb({ order }) {
    const { copy } = useLocale();
    const [imageFailed, setImageFailed] = useState(false);
    const imageUrl = order.image_url && !imageFailed ? order.image_url : null;
    const Icon = orderIconFromKey(order.display_icon);

    return (
        <div className={cn(
            "h-12 w-12 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden transition-colors group-hover:border-brand-100",
            imageUrl ? "bg-slate-50 border-slate-100 group-hover:bg-brand-50" : "bg-brand-50 border-brand-100 text-brand-600"
        )}>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={order.display_title || copy('Order item', 'Bidhaa ya oda')}
                    onError={() => setImageFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : (
                <Icon className="h-6 w-6" />
            )}
        </div>
    );
}

export default function Profile({
    activeMerchant = null,
    weeklyStats = { payments: 0, transactions: 0, percentChange: 0 },
    summary = { total_products: 0, orders_today: 0, orders_pending: 0, orders_completed: 0 },
    recentOrders = [],
    thisMonthEarnings = 0,
    salesBreakdown = { digital: 0, physical: 0, services: 0 },
    commerceHubSummary = { physical: 0, digital: 0, services: 0, posts: 0, bundles: 0, offerings: 0, subscriptions: 0 },
    creatorMonetization = null,
    activeMerchantAccess = null,
    countries = [],
    currencies = [],
    businessCategories = {},
    merchantKyc = null,
    merchantKycStatus = 'unverified',
    forwarderApplication = null,
    hasVerifiedPersonalProfile = false
}) {
    const { auth } = usePage().props;
    const { t, copy } = useLocale();
    const merchants = auth?.user?.merchant_profiles ?? [];

    const [isSecurityOpen, setIsSecurityOpen] = useState(false);
    const [isCreateShopModalOpen, setIsCreateShopModalOpen] = useState(false);
    const [isOrderCheckupOpen, setIsOrderCheckupOpen] = useState(false);
    const [checkupCode, setCheckupCode] = useState('');
    const [checkupPickupPin, setCheckupPickupPin] = useState('');
    const [checkupOrder, setCheckupOrder] = useState(null);
    const [checkupLoading, setCheckupLoading] = useState(false);
    const [checkupVerifying, setCheckupVerifying] = useState(false);
    const retailEligible = isRetailEligible(activeMerchant, merchantKyc, merchantKycStatus);
    const hasVerifiedEmail = Boolean(auth?.user?.email && auth?.user?.email_verified_at);
    const hasTotpEnabled = Boolean(auth?.user?.two_factor_enabled);
    const isVerified = activeMerchant?.is_verified ?? false;
    const merchantSlug = activeMerchant?.username ?? '';
    const isBusinessMerchant = Boolean(activeMerchant && activeMerchant.type !== 'personal');
    const businessCurrencyCode = creatorMonetization?.currency_code || activeMerchant?.currency?.code || 'TZS';
    const activePermissions = activeMerchantAccess?.permissions ?? activeMerchant?.permissions ?? [];
    const can = (permission) => activePermissions.includes('*') || activePermissions.includes(permission);
    const activeModules = activeMerchant?.active_modules || [];
    const commerceModes = activeMerchant?.business_profile?.commerce_modes || [];
    const hasModule = (module) => activeModules.includes(module);
    const hasMode = (mode) => commerceModes.includes(mode);
    const shouldShowHubItem = (item) => {
        if (isBusinessMerchant) return true;
        if (activeModules.length === 0 && commerceModes.length === 0) return true;

        return (item.modules || []).some(hasModule) || (item.modes || []).some(hasMode);
    };
    const commerceHubItems = [
        { key: 'products', title: t('profile.hub.physical'), count: commerceHubSummary.physical ?? 0, icon: Package, href: `/merchant/${merchantSlug}/products`, permission: 'products.view', modules: ['products'], modes: ['physical_products'] },
        { key: 'digital', title: t('profile.hub.digital'), count: commerceHubSummary.digital ?? 0, icon: DownloadCloud, href: `/merchant/${merchantSlug}/downloads`, permission: 'digital_products.view', modules: ['digital_products'], modes: ['digital_products'] },
        // Services hub is intentionally commented out for the launch.
        { key: 'posts', title: t('profile.hub.posts'), count: commerceHubSummary.posts ?? 0, icon: BookOpenText, href: `/merchant/${merchantSlug}/posts`, permission: 'posts.view', modules: ['marketing'], modes: [] },
        { key: 'offerings', title: t('profile.hub.offerings'), count: commerceHubSummary.offerings ?? 0, icon: Layers, href: `/merchant/${merchantSlug}/offering-groups`, permission: 'services.view', modules: ['services', 'menu', 'courses', 'tour_departures'], modes: ['services_bookings', 'food_menu', 'courses_learning'] },
        { key: 'bundles', title: t('profile.hub.bundles'), count: commerceHubSummary.bundles ?? 0, icon: Boxes, href: `/merchant/${merchantSlug}/bundles`, permission: 'bundles.view', modules: [], modes: [] },
        { key: 'subscriptions', title: t('profile.hub.subscriptions'), count: commerceHubSummary.subscriptions ?? 0, icon: Crown, href: `/merchant/${merchantSlug}/subscriptions`, permission: 'subscriptions.view', modules: ['subscriptions'], modes: ['subscriptions_memberships'] },
    ].filter((item) => can(item.permission) && (!item.businessOnly || isBusinessMerchant) && shouldShowHubItem(item) && (item.requiresModules || []).every(hasModule));
    const forwarderStatus = forwarderApplication?.verification_status || null;
    const forwarderApproved = forwarderStatus === 'verified' || forwarderApplication?.is_verified;
    const forwarderApplied = Boolean(forwarderApplication);
    const freightHubItems = [
        { key: 'forwarder_profile', title: t('profile.freight.profile'), icon: Truck, href: `/merchant/${merchantSlug}/forwarders/setup`, description: t('profile.freight.profileDescription'), permission: 'services.view' },
        { key: 'locations', title: t('profile.freight.locations'), icon: MapPin, href: `/merchant/${merchantSlug}/forwarders/locations`, description: t('profile.freight.locationsDescription'), permission: 'services.create' },
        { key: 'routes', title: t('profile.freight.routes'), icon: Globe, href: `/merchant/${merchantSlug}/forwarders/routes`, description: t('profile.freight.routesDescription'), permission: 'services.create' },
        { key: 'schedules', title: t('profile.freight.schedules'), icon: CalendarClock, href: `/merchant/${merchantSlug}/forwarders/schedules`, description: t('profile.freight.schedulesDescription'), permission: 'services.create' },
        { key: 'shipments', title: t('profile.freight.shipments'), icon: Ship, href: `/merchant/${merchantSlug}/forwarders/shipments`, description: t('profile.freight.shipmentsDescription'), permission: 'services.view' },
        { key: 'updates', title: t('profile.freight.updates'), icon: Megaphone, href: `/merchant/${merchantSlug}/posts?compose=1&source=forwarder_update`, description: t('profile.freight.updatesDescription'), permission: 'posts.create' },
    ].filter((item) => can(item.permission));
    const canAddNew = can('products.create') || can('digital_products.create');

    // Verification State
    const [verifView, setVerifView] = useState('main'); // main, selection, form
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [retryVerif, setRetryVerif] = useState(false);
    const [form, setForm] = useState({
        business_type: activeMerchant?.type || 'personal',
        first_name: auth?.user?.name?.split(' ')[0] || '',
        middle_name: '',
        last_name: auth?.user?.name?.split(' ').slice(1).join(' ') || '',
        id_type: '',
        id_number: '',
        date_of_birth: '',
        gender: '',
        residential_address: '',
        occupation: '',
        country: 'Tanzania',
        id_front: null,
        id_back: null,
    });
    const [previews, setPreviews] = useState({
        id_front: null,
        id_back: null,
        tin_document: null,
        business_license: null,
        registration_doc: null,
    });

    const [bizForm, setBizForm] = useState({
        display_name: '',
        username: '',
        type: 'sole_proprietor',
    });
    const [creatingBiz, setCreatingBiz] = useState(false);

    const handleCreateBusiness = async (e) => {
        e.preventDefault();
        setCreatingBiz(true);
        try {
            const res = await axios.post('/merchant/add-business', bizForm);
            toast.success(res.data.message);
            setIsCreateShopModalOpen(false);
            router.visit('/profile');
        } catch (err) {
            const firstError = err.response?.data?.errors
                ? Object.values(err.response.data.errors).flat()[0]
                : null;
            toast.error(firstError || err.response?.data?.message || t('profile.createBusinessFailed'));
        } finally {
            setCreatingBiz(false);
        }
    };

    const statusBadge = (status) => {
        const map = {
            pending_fulfillment: { label: t('profile.status.fulfillment'), cls: 'bg-amber-500/10 text-amber-600' },
            release_eligible: { label: t('profile.status.readyForPsp'), cls: 'bg-brand-500/10 text-brand-700' },
            payout_processing: { label: t('profile.status.pspPayout'), cls: 'bg-sky-500/10 text-sky-700' },
            paid_out: { label: t('profile.status.completed'), cls: 'bg-emerald-500/10 text-emerald-700' },
            disputed: { label: t('profile.status.disputed'), cls: 'bg-red-500/10 text-red-700' },
            refunded: { label: t('profile.status.refunded'), cls: 'bg-slate-500/10 text-slate-700' },
            pending: { label: t('profile.status.pending'), cls: 'bg-slate-500/10 text-slate-700' },
        };
        const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
        );
    };

    const typeMeta = (kind) => {
        const map = {
            physical_product: { label: t('profile.types.physical'), icon: ShoppingBag, cls: 'bg-amber-500/10 text-amber-700' },
            post_content: { label: t('profile.types.post'), icon: BookOpenText, cls: 'bg-sky-500/10 text-sky-700' },
            subscription_plan: { label: t('profile.types.membership'), icon: Crown, cls: 'bg-violet-500/10 text-violet-700' },
            digital_file: { label: t('profile.types.digital'), icon: DownloadCloud, cls: 'bg-indigo-500/10 text-indigo-700' },
            service_booking: { label: t('profile.types.service'), icon: CalendarClock, cls: 'bg-emerald-500/10 text-emerald-700' },
            offering_group: { label: t('profile.types.offering'), icon: Layers, cls: 'bg-teal-500/10 text-teal-700' },
            physical_bundle: { label: t('profile.types.physicalBundle'), icon: Boxes, cls: 'bg-amber-500/10 text-amber-700' },
        };
        return map[kind] || { label: 'Post Content', icon: BookOpenText, cls: 'bg-muted text-muted-foreground' };
    };

    const handleLogout = () => {
        router.post('/logout', {}, {
            onFinish: () => {
                localStorage.removeItem('takeer_token');
                delete axios.defaults.headers.common['Authorization'];
            }
        });
    };

    const formatMoney = (amount, currency = businessCurrencyCode) => {
        const code = currency || businessCurrencyCode;
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

    const lookupOrderCheckup = async (e) => {
        e?.preventDefault();
        if (!merchantSlug || !checkupCode.trim() || checkupLoading) return;

        setCheckupLoading(true);
        setCheckupOrder(null);
        setCheckupPickupPin('');
        try {
            const res = await axios.post(`/api/merchant/${merchantSlug}/order-checkup/lookup`, {
                code: checkupCode.trim(),
            });
            setCheckupOrder(res.data.order);
            toast.success(t('profile.orderFound'));
        } catch (error) {
            toast.error(error.response?.data?.message || t('profile.orderNotFound'));
        } finally {
            setCheckupLoading(false);
        }
    };

    const verifyOrderCheckupPickup = async () => {
        if (!merchantSlug || !checkupOrder?.id || checkupPickupPin.length !== 4 || checkupVerifying) return;

        setCheckupVerifying(true);
        try {
            const res = await axios.post(`/api/merchant/${merchantSlug}/orders/${checkupOrder.id}/verify-pickup`, {
                pickup_pin: checkupPickupPin,
            });
            toast.success(res.data.message || t('profile.pickupConfirmed'));
            setCheckupPickupPin('');
            setCheckupOrder(prev => res.data.order ? {
                ...prev,
                ...res.data.order,
                can_verify_pickup: false,
            } : prev);
        } catch (error) {
            toast.error(error.response?.data?.message || t('profile.pickupConfirmFailed'));
        } finally {
            setCheckupVerifying(false);
        }
    };

    // Verification Handlers
    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            setForm(prev => ({ ...prev, [field]: file }));
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviews(prev => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDocSelect = (docType) => {
        setSelectedDoc(docType);
        let backendDocType = docType;
        if (docType === 'NIDA') backendDocType = 'National ID Card (NIDA)';
        if (docType === 'Passport') backendDocType = 'Passport';
        if (docType === 'Voters ID') backendDocType = 'Voter ID';

        // Check if user has a verified identity from another profile
        const verifiedKyc = merchants.find(m => m.kyc?.status === 'verified')?.kyc;
        if (verifiedKyc) {
            setForm(prev => ({
                ...prev,
                id_type: verifiedKyc.id_type,
                id_number: verifiedKyc.id_number,
                first_name: verifiedKyc.first_name,
                last_name: verifiedKyc.last_name,
                gender: verifiedKyc.gender,
                date_of_birth: verifiedKyc.date_of_birth ? new Date(verifiedKyc.date_of_birth).toISOString().split('T')[0] : '',
                residential_address: verifiedKyc.residential_address,
                occupation: verifiedKyc.occupation
            }));
            // Also set previews for visuals if they exist
            setPreviews(prev => ({
                ...prev,
                id_front: verifiedKyc.id_front_signed_url,
                id_back: verifiedKyc.id_back_signed_url
            }));
        } else {
            setForm(prev => ({ ...prev, id_type: backendDocType }));
        }

        setVerifView('form');
    };

    const handleSubmitVerification = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const formData = new FormData();
        Object.keys(form).forEach(key => {
            if (form[key]) {
                formData.append(key, form[key]);
            }
        });

        try {
            await axios.post(`/merchant/${merchantSlug}/kyc/api`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(t('profile.verificationReceived'));
            router.reload();
        } catch (err) {
            const msg = err.response?.data?.message || t('profile.genericError');
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppLayout>
            <Head title={`${t('profile.pageTitle')} | Takeer`} />

            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">

                {/* ── Profile Header ── */}
                <div className="mb-8 flex items-center justify-between gap-4">
                    <ProfileSwitcher
                        variant="hero"
                        className="min-w-0"
                        onCreateBusiness={() => setIsCreateShopModalOpen(true)}
                    />

                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl h-11 w-11 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <CreateDialog open={isCreateShopModalOpen} onOpenChange={setIsCreateShopModalOpen}>
                    <CreateDialogContent className="max-w-md p-0 overflow-hidden border-none rounded-[2rem] bg-slate-50">
                        <div className="p-8 space-y-6">
                            <CreateDialogHeader className="space-y-2">
                                <CreateDialogTitle className="text-2xl font-black text-slate-900 tracking-tight">{t('profile.createBusiness')}</CreateDialogTitle>
                                <CreateDialogDescription className="text-slate-500 font-medium">{t('profile.createBusinessDescription')}</CreateDialogDescription>
                            </CreateDialogHeader>

                            <form onSubmit={handleCreateBusiness} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('profile.businessType')}</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {[
                                                { id: 'sole_proprietor', label: t('profile.soleProprietor'), desc: t('profile.soleProprietorDescription'), icon: Store },
                                                { id: 'business', label: t('profile.registeredBusiness'), desc: t('profile.registeredBusinessDescription'), icon: Building2 },
                                                { id: 'ngo', label: t('profile.ngo'), desc: t('profile.ngoDescription'), icon: Landmark }
                                            ].map((type) => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => setBizForm(prev => ({ ...prev, type: type.id }))}
                                                    className={cn(
                                                        "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                                                        bizForm.type === type.id
                                                            ? "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600"
                                                            : "border-slate-200 bg-white hover:border-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-lg flex items-center justify-center",
                                                            bizForm.type === type.id ? "bg-brand-100 text-brand-600" : "bg-slate-50 text-slate-400"
                                                        )}>
                                                            <type.icon className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-xs">{type.label}</p>
                                                            <p className="text-[10px] text-slate-400">{type.desc}</p>
                                                        </div>
                                                    </div>
                                                    {bizForm.type === type.id && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('profile.businessName')}</label>
                                            <Input
                                            placeholder={copy('Example: Takeer Store', 'Mfano: Takeer Store')}
                                            value={bizForm.display_name}
                                            onChange={e => setBizForm(prev => ({ ...prev, display_name: e.target.value }))}
                                            className="h-12 rounded-xl border-slate-200 font-bold bg-white"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('profile.businessUsername')}</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                                            <Input
                                                placeholder={copy('username', 'jina la mtumiaji')}
                                                value={bizForm.username}
                                                onChange={e => setBizForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                                                className="h-12 rounded-xl border-slate-200 font-bold pl-8 bg-white"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <CreateDialogFooter className="pt-4 gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsCreateShopModalOpen(false)}
                                        className="h-12 rounded-xl font-bold flex-1"
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={creatingBiz}
                                        className="h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex-1 shadow-lg shadow-brand-600/20"
                                    >
                                        {creatingBiz ? t('profile.creatingBusiness') : t('profile.createBusiness')}
                                    </Button>
                                </CreateDialogFooter>
                            </form>
                        </div>
                    </CreateDialogContent>
                </CreateDialog>

                <Dialog open={isOrderCheckupOpen} onOpenChange={(open) => {
                    setIsOrderCheckupOpen(open);
                    if (!open) {
                        setCheckupCode('');
                        setCheckupPickupPin('');
                        setCheckupOrder(null);
                    }
                }}>
                    <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden rounded-[2rem] border-slate-100 p-0">
                        <div className="max-h-[90vh] overflow-y-auto p-6 space-y-5">
                            <DialogHeader>
                                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                                    <KeyRound className="h-6 w-6" />
                                </div>
                                <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">{t('common.orderCheckup')}</DialogTitle>
                                <DialogDescription className="text-sm font-medium text-slate-500">
                                    {t('common.orderCheckupDescription')}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={lookupOrderCheckup} className="relative">
                                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
                                <Input
                                    value={checkupCode}
                                    onChange={(event) => setCheckupCode(event.target.value.toUpperCase())}
                                    placeholder={t('common.orderRefOrPickupCode')}
                                    className="h-14 rounded-2xl border-brand-100 bg-brand-50/40 pl-11 pr-24 text-base font-black tracking-widest text-brand-900 focus:border-brand-300"
                                />
                                <Button
                                    type="submit"
                                    disabled={checkupLoading || !checkupCode.trim()}
                                    className="absolute right-1.5 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-brand-600 px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-brand-700"
                                >
                                    {checkupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.check')}
                                </Button>
                            </form>

                            {checkupOrder && (
                                <div className="overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm">
                                    <div className="flex items-start gap-4 p-4">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 text-slate-400">
                                            {checkupOrder.image_url ? (
                                                <img src={checkupOrder.image_url} alt={checkupOrder.title} className="h-full w-full object-cover" />
                                            ) : (
                                                <Package className="h-7 w-7" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-700">
                                                    #{String(checkupOrder.public_id || '').slice(0, 8)}
                                                </span>
                                                <span className={cn(
                                                    "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                                                    checkupOrder.can_verify_pickup ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {checkupOrder.can_verify_pickup ? t('common.ready') : String(checkupOrder.payment_status || '').replaceAll('_', ' ')}
                                                </span>
                                            </div>
                                            <h4 className="line-clamp-2 text-sm font-black leading-snug text-slate-900">{checkupOrder.title}</h4>
                                            <p className="mt-1 text-xs font-bold text-slate-500">
                                                {checkupOrder.customer_name || checkupOrder.customer_phone || t('common.customer')} · {String(checkupOrder.delivery_type || 'order').replaceAll('_', ' ')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 border-t border-slate-100 bg-slate-50/70 p-4">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{t('common.itemsInOrder')}</p>
                                        {(checkupOrder.items || []).map((item) => (
                                            <div key={item.key || item.title} className="flex items-center gap-3 rounded-2xl bg-white p-2">
                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 text-slate-400">
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Package className="h-5 w-5" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-black text-slate-900">{item.title}</p>
                                                    <p className="text-[10px] font-bold text-slate-500">
                                                        {t('common.quantity')} {Number(item.quantity || 1).toLocaleString()} · {formatMoney(item.line_total || 0)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 bg-slate-50/70 p-4">
                                        <div className="rounded-2xl bg-white px-3 py-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('common.total')}</p>
                                            <p className="mt-0.5 text-sm font-black text-slate-900">{formatMoney(checkupOrder.amount_total ?? checkupOrder.total_paid ?? 0)}</p>
                                        </div>
                                        <div className="rounded-2xl bg-emerald-50 px-3 py-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">{t('common.paid')}</p>
                                            <p className="mt-0.5 text-sm font-black text-emerald-800">{formatMoney(checkupOrder.amount_paid || 0)}</p>
                                        </div>
                                        <div className="rounded-2xl bg-amber-50 px-3 py-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">{t('common.left')}</p>
                                            <p className="mt-0.5 text-sm font-black text-amber-800">{formatMoney(checkupOrder.amount_remaining || 0)}</p>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 px-4 py-3">
                                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('common.pickupStatus')}</span>
                                            <span className="text-xs font-black text-slate-900">{String(checkupOrder.delivery_status || 'pending').replaceAll('_', ' ')}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 p-4">
                                        {checkupOrder.can_verify_pickup ? (
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                                                    <Input
                                                        value={checkupPickupPin}
                                                        onChange={(event) => setCheckupPickupPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                        placeholder={t('common.customerPin')}
                                                        className="h-14 rounded-2xl border-emerald-100 bg-emerald-50/45 pl-11 text-center text-xl font-black tracking-[0.35em] text-emerald-900 focus:border-emerald-300"
                                                    />
                                                </div>
                                                <Button
                                                    onClick={verifyOrderCheckupPickup}
                                                    disabled={checkupVerifying || checkupPickupPin.length !== 4}
                                                    className="h-12 w-full rounded-2xl bg-emerald-600 text-[11px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
                                                >
                                                    {checkupVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                                    {t('common.confirmReleaseOrder')}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-amber-800">
                                                {checkupOrder.release_blocked_reason || t('common.releaseBlocked')}
                                            </div>
                                        )}
                                        {checkupOrder.chat_url && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => router.visit(checkupOrder.chat_url)}
                                                className="h-11 w-full rounded-2xl border-brand-100 text-[11px] font-black uppercase tracking-widest text-brand-700 hover:bg-brand-50"
                                            >
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                Open Chat
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-12 space-y-6">

                        {isVerified ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

                                {creatorMonetization && (
                                    <Card className="min-w-0 border border-brand-100 rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-white to-brand-50/40">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">{t('profileUi.creatorMonetization')}</CardTitle>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{creatorMonetization.window}</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl text-xs font-black"
                                                    onClick={() => router.visit(`/m/${merchantSlug}`)}
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                                    {t('profileUi.storefront')}
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="min-w-0 space-y-4">
                                            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                <MiniMetric label={t('profileUi.revenue')} value={formatMoney(creatorMonetization.total_revenue || 0)} icon={BarChart3} tone="brand" />
                                                <MiniMetric label={t('profileUi.orders')} value={Number(creatorMonetization.total_orders || 0).toLocaleString()} icon={ShoppingBag} tone="amber" />
                                                <MiniMetric
                                                    label={t('profileUi.members')}
                                                    value={Number(creatorMonetization.active_members || 0).toLocaleString()}
                                                    icon={User2}
                                                    tone="sky"
                                                    onClick={() => router.visit(`/merchant/${merchantSlug}/subscription-members`)}
                                                    actionLabel={t('profileUi.viewSubscribers')}
                                                />
                                            </div>
                                            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                <MiniMetric label={t('profileUi.released')} value={formatMoney(creatorMonetization.released_revenue || 0)} icon={FileCheck} tone="emerald" compact />
                                                <MiniMetric label={t('profileUi.pending')} value={formatMoney(creatorMonetization.pending_revenue || 0)} icon={Clock} tone="orange" compact />
                                                <MiniMetric label={t('profileUi.estimatedNet')} value={formatMoney(creatorMonetization.estimated_net || 0)} icon={Wallet} tone="slate" compact />
                                                <MiniMetric label={t('profileUi.change')} value={`${Number(creatorMonetization.revenue_change_percent || 0).toLocaleString()}%`} icon={TrendingUp} tone="blue" compact />
                                            </div>
                                            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                                <PayoutMetric label={t('profileUi.providerPayoutCompleted')} value={formatMoney(creatorMonetization.payouts?.provider_payouts_completed || 0)} icon={FileCheck} tone="emerald" />
                                                <PayoutMetric label={t('profileUi.awaitingProviderPayout')} value={formatMoney(creatorMonetization.payouts?.provider_payouts_pending || 0)} icon={ShieldCheck} tone="blue" />
                                            </div>
                                            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                                                <div className="min-w-0 rounded-2xl border border-white bg-white/80 p-3">
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <div>
                                                            <p className="text-xs font-black uppercase tracking-wider text-slate-900">{t('profileUi.revenueByContent')}</p>
                                                            <p className="text-[11px] font-semibold text-slate-500">{t('profileUi.revenueByContentDescription')}</p>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            className="rounded-xl text-[11px] font-black h-8"
                                                            onClick={() => router.visit(`/merchant/${merchantSlug}/overview`)}
                                                        >
                                                            {t('profileUi.ledger')}
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {(creatorMonetization.buckets || [])
                                                            .filter((bucket) => Number(bucket.revenue || 0) > 0 || Number(bucket.orders || 0) > 0)
                                                            .map((bucket) => (
                                                                <MonetizationBucketRow
                                                                    key={bucket.key}
                                                                    bucket={bucket}
                                                                    total={creatorMonetization.total_revenue || 0}
                                                                    formatMoney={formatMoney}
                                                                />
                                                            ))}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 rounded-2xl border border-white bg-white/80 p-3">
                                                    <p className="text-xs font-black uppercase tracking-wider text-slate-900">{t('profileUi.topEarners')}</p>
                                                    <p className="text-[11px] font-semibold text-slate-500 mb-3">{t('profileUi.topEarnersDescription')}</p>
                                                    <div className="space-y-2">
                                                        {(creatorMonetization.top_items || []).length > 0 ? (
                                                            creatorMonetization.top_items.map((item, index) => (
                                                                <TopCreatorItem key={`${item.kind}-${item.id || item.product_id || item.order_id || item.title}-${index}`} item={item} formatMoney={formatMoney} iconFromKey={orderIconFromKey} />
                                                            ))
                                                        ) : (
                                                            <p className="text-sm font-semibold text-slate-500 py-4 text-center">{t('profileUi.noPaidSales')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <div className="xl:col-span-1 space-y-6">
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('profileUi.quickActions')}</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                {canAddNew && (
                                                    <ActionBtn icon={Plus} label={t('profileUi.addNew')} href={`/merchant/${merchantSlug}/upload`} color="bg-brand-600" textColor="text-white" />
                                                )}
                                                {can('orders.verify_pickup') && (
                                                    <ActionBtn icon={KeyRound} label={t('common.orderCheckup')} onClick={() => setIsOrderCheckupOpen(true)} color="bg-emerald-50" textColor="text-emerald-700" borderColor="border-emerald-100" />
                                                )}
                                                {retailEligible && (can('retail.dashboard') || can('retail.pos')) && (
                                                    <ActionBtn icon={Store} label={t('profileUi.retail')} href={`/merchant/${merchantSlug}/retail/${can('retail.dashboard') ? 'dashboard' : 'pos'}`} color="bg-brand-50" textColor="text-brand-700" borderColor="border-brand-100" />
                                                )}
                                                {can('settings.update') && (
                                                    <ActionBtn icon={HardDrive} label={t('profileUi.storagePlan')} href={`/merchant/${merchantSlug}/platform-subscriptions/storage`} color="bg-sky-50" textColor="text-sky-700" borderColor="border-sky-100" />
                                                )}
                                                {can('dashboard.view') && (
                                                    <ActionBtn icon={Clock} label={t('orders.tabs.pulse')} href={`/merchant/${merchantSlug}/pulse`} color="bg-blue-50" textColor="text-blue-700" borderColor="border-blue-100" />
                                                )}
                                                {can('marketing.view') && (
                                                    <ActionBtn icon={Megaphone} label={t('profileUi.marketing')} href={`/merchant/${merchantSlug}/marketing`} color="bg-violet-50" textColor="text-violet-700" borderColor="border-violet-100" />
                                                )}
                                                {can('settings.view') && (
                                                    <ActionBtn icon={Settings} label={t('profileUi.settings')} href={`/merchant/${merchantSlug}/settings`} color="bg-slate-50" textColor="text-slate-700" borderColor="border-slate-100" />
                                                )}
                                            </div>
                                        </div>

                                        {isBusinessMerchant && !hasVerifiedPersonalProfile && can('services.create') && (
                                            <Card className="border border-slate-200 bg-slate-50 rounded-2xl shadow-sm">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600">
                                                            <ShieldCheck className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-950">{t('profileUi.verifyPersonalFirst')}</p>
                                                            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                                                                {t('profileUi.verifyPersonalDescription')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {isBusinessMerchant && forwarderApplied && !forwarderApproved && (
                                            <Card className="border border-amber-200 bg-amber-50 rounded-2xl shadow-sm">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-700">
                                                            <ShieldAlert className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-amber-950">
                                                                {forwarderStatus === 'rejected' ? 'Freight application needs updates' : 'Freight application under review'}
                                                            </p>
                                                            <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">
                                                                {forwarderStatus === 'rejected'
                                                                    ? (forwarderApplication?.admin_notes || 'Admin rejected this application. Update your proof and submit again.')
                                                                    : 'Admin will review your permits and business proof before logistics tools are enabled.'}
                                                            </p>
                                                            {can('services.create') && (
                                                                <Link href={`/merchant/${merchantSlug}/forwarders/setup`} className="mt-3 inline-flex h-9 items-center rounded-xl bg-amber-600 px-3 text-xs font-black text-white">
                                                                    Update application
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <CardHeader className="pb-2">
                                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('common.salesBreakdown')}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <BreakdownRow label="Digital / Unlockables" count={salesBreakdown.digital} color="bg-indigo-500" total={salesBreakdown.digital + salesBreakdown.physical} />
                                                <BreakdownRow label="Physical Products" count={salesBreakdown.physical} color="bg-emerald-500" total={salesBreakdown.digital + salesBreakdown.physical} />
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="xl:col-span-2 space-y-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <div>
                                                    <h3 className="text-xs font-bold uppercase tracking-wider">{t('common.commerceHub')}</h3>
                                                    <p className="mt-1 text-xs text-slate-500">{t('common.commerceHubDescription')}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                                {commerceHubItems.map((item) => (
                                                    <button
                                                        key={item.key}
                                                        type="button"
                                                        onClick={() => router.visit(item.href)}
                                                        className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                                                                <item.icon className="h-5 w-5" />
                                                            </div>
                                                            <span className="text-2xl font-black text-slate-900">{Number(item.count || 0).toLocaleString()}</span>
                                                        </div>
                                                        <p className="mt-3 text-sm font-black text-slate-900 leading-tight">{item.title}</p>
                                                        <p className="mt-1 text-[11px] font-semibold text-slate-400">{t('common.tapToManage')}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {isBusinessMerchant && forwarderApproved && freightHubItems.length > 0 && (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between px-1">
                                                    <div>
                                                        <h3 className="text-xs font-bold uppercase tracking-wider">{t('common.freightHub')}</h3>
                                                        <p className="mt-1 text-xs text-slate-500">{t('common.freightHubDescription')}</p>
                                                    </div>
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                        <ShieldCheck className="h-3.5 w-3.5" /> {t('common.verified')}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                                    {freightHubItems.map((item) => (
                                                        <button
                                                            key={item.key}
                                                            type="button"
                                                            onClick={() => router.visit(item.href)}
                                                            className="group rounded-2xl border border-indigo-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                                                        >
                                                            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                <item.icon className="h-5 w-5" />
                                                            </div>
                                                            <p className="mt-3 text-sm font-black text-slate-900 leading-tight">{item.title}</p>
                                                            <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-400">{item.description}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('common.recentTransactions')}</h3>
                                                {can('orders.view') && (
                                                    <Link href={`/merchant/${merchantSlug}/orders`} className="text-xs font-bold text-brand-600 hover:underline">{t('common.viewAll')}</Link>
                                                )}
                                            </div>

                                            <div className="space-y-3">
                                                {recentOrders.length === 0 ? (
                                                    <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200">
                                                        <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                                        <p className="text-slate-400 font-medium text-sm">{t('common.noTransactions')}</p>
                                                    </div>
                                                ) : (
                                                    recentOrders.map(order => (
                                                        <Card key={order.id} className="border border-slate-100 hover:border-brand-200 transition-all rounded-xl shadow-sm group">
                                                            <CardContent className="p-4">
                                                                <Link href={can('orders.view') ? `/merchant/${merchantSlug}/orders/${order.id}` : '#'} className="flex items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <RecentOrderThumb order={order} />
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                <span className="text-[10px] font-bold text-slate-400">#{order.id}</span>
                                                                                {statusBadge(order.status)}
                                                                            </div>
        <p className="font-bold text-slate-900 truncate text-sm">{order.display_title || copy('Order item', 'Bidhaa ya oda')}</p>
                                                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                                                                {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <p className="font-bold text-slate-900 text-lg">
                                                                        {formatMoney(order.amount || 0, order.currency_code || businessCurrencyCode)}
                                                                    </p>
                                                                </Link>
                                                            </CardContent>
                                                        </Card>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-400">
                                {activeMerchant && (
                                    <div className="space-y-6">
                                        <AnimatePresence mode="wait">
                                            {merchantKycStatus === 'pending' ? (
                                                <motion.div
                                                    key="pending"
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="text-center py-10 px-6 rounded-2xl border border-amber-200 bg-amber-50/20 space-y-4"
                                                >
                                                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mx-auto animate-pulse">
                                                        <Clock className="h-8 w-8" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h2 className="text-xl font-bold text-slate-900">{copy('Information is under review', 'Taarifa zinahakikiwa')}</h2>
                                                        <p className="text-slate-600 text-sm max-w-sm mx-auto">
                                                            {copy('We received your documents. Our team is reviewing them. This process takes 12–24 hours.', 'Tumepokea nyaraka zako. Timu yetu inazihakiki. Huu mchakato huchukua masaa 12–24.')}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ) : (merchantKycStatus === 'rejected' && !retryVerif) ? (
                                                <motion.div
                                                    key="rejected"
                                                    initial={{ opacity: 0, scale: 0.98 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="p-6 md:p-8 rounded-2xl border border-red-200 bg-red-50/20 space-y-4"
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                                            <AlertTriangle className="h-6 w-6" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <h2 className="text-lg font-bold text-slate-900">{copy('Verification rejected', 'Uhakiki Umekataliwa')}</h2>
                                                            <p className="text-slate-600 text-sm font-medium">
                                                                {copy('Your information was not accepted for the following reason:', 'Maelezo yako hayajakubaliwa kutokana na sababu ifuatayo:')}
                                                            </p>
                                                            <div className="mt-3 p-4 rounded-xl bg-white border border-red-100 text-red-700 font-bold text-sm italic shadow-sm">
                                                                "{merchantKyc?.rejection_reason || copy('Your documents are unclear or incomplete.', 'Nyaraka zako haziko wazi au hazitoshi.')}"
                                                            </div>
                                                            <div className="pt-2">
                                                                <Button
                                                                    className="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-sm hover:bg-slate-800 transition-all"
                                                                    onClick={() => {
                                                                        setRetryVerif(true);
                                                                        setVerifView('selection');
                                                                    }}
                                                                >
                                                                    {copy('Try again', 'Jaribu Tena')}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ) : verifView === 'main' ? (
                                                <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                                    <div className="space-y-3">
                                                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                                            {activeMerchant?.type === 'personal' ? copy('1. Contact verification', '1. Uthibitisho wa Mawasiliano') : copy('1. Business contact', '1. Mawasiliano ya Biashara')}
                                                        </h2>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {activeMerchant?.type === 'personal' ? (
                                                                <>
                                                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                                                                <Phone className="h-5 w-5" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-slate-900 text-sm">{copy('Phone number', 'Nambari ya Simu')}</p>
                                                                                <p className="text-xs text-slate-500">{auth?.user?.phone_number}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                                                                            <CheckCircle2 className="h-3 w-3" /> {copy('Verified', 'Imethibitishwa')}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                                                                <Mail className="h-5 w-5" />
                                                                            </div>
                                                                            <div>
                                                                                    <p className="font-bold text-slate-900 text-sm">{copy('Email', 'Barua Pepe')}</p>
                                                                                <p className="text-xs text-slate-500">{auth?.user?.email || 'Google Verification'}</p>
                                                                            </div>
                                                                        </div>
                                                                        {auth?.user?.email_verified_at ? (
                                                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                                                                                <CheckCircle2 className="h-3 w-3" /> {copy('Verified', 'Imethibitishwa')}
                                                                            </div>
                                                                        ) : (
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 flex items-center gap-2"
                                                                                onClick={() => window.location.href = '/auth/google/redirect'}
                                                                            >
                                                                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-3.5 w-3.5" alt="Google" />
                                                                                {copy('Connect', 'Unganisha')}
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="col-span-2 space-y-4">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                        {activeMerchant?.locations?.length > 0 ? activeMerchant.locations.map((loc, idx) => (
                                                                            <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                                                                                <div className="flex items-start justify-between">
                                                                                    <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                                                                                        <Store className="h-4 w-4" />
                                                                                    </div>
                                                                                    {loc.is_primary && (
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest bg-brand-600 text-white px-2 py-0.5 rounded-full">{copy('Primary', 'Kuu')}</span>
                                                                                    )}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-slate-900 text-sm truncate">{loc.name}</p>
                                                                                    <p className="text-[10px] text-slate-500 truncate">{loc.address}</p>
                                                                                </div>
                                                                                <div className="pt-2 flex items-center gap-2 text-[11px] font-bold text-slate-600">
                                                                                    <Phone className="h-3 w-3 text-slate-400" /> {loc.contact_phone || copy('No phone', 'Hakuna Simu')}
                                                                                </div>
                                                                            </div>
                                                                        )) : (
                                                                            <div className="col-span-full p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-3">
                                                                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                                                                                    <Truck className="h-6 w-6 text-slate-400" />
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-slate-900">{copy('No business locations', 'Hakuna Maeneo ya Biashara')}</p>
                                                                                    <p className="text-xs text-slate-500">{copy('Add your business locations in settings so customers can find you.', 'Ongeza maeneo ya biashara yako kwenye mipangilio ili wateja wakupate.')}</p>
                                                                                </div>
                                                                                <Link href={`/merchant/${activeMerchant?.username}/settings`} className="inline-flex h-9 items-center justify-center px-4 rounded-lg bg-brand-600 text-white font-bold text-xs">
                                                                                    {copy('Open settings', 'Weka Mipangilio')}
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">{copy('2. Identity verification', '2. Uthibitisho wa Utambulisho')}</h2>
                                                        <div className="p-6 rounded-2xl border border-brand-200 bg-brand-50/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                            <div className="flex gap-4">
                                                                <div className="h-12 w-12 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                                                                    <ShieldCheck className="h-6 w-6" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-lg font-bold text-slate-900">{copy('KYC verification', 'Uthibitisho wa KYC')}</h3>
                                                                    <p className="text-slate-600 text-sm font-medium mt-0.5 leading-relaxed max-w-sm">
                                                                        {copy('Verify your identity to start receiving payouts and sell your products securely.', 'Hakiki utambulisho wako ili kuanza kutoa pesa na kuuza bidhaa zako kwa usalama.')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                className="h-12 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition-all shrink-0"
                                                                onClick={() => {
                                                                    const bizType = activeMerchant?.type || 'personal';
                                                                    setForm(prev => ({ ...prev, business_type: bizType }));

                                                                    if (bizType !== 'personal') {
                                                                        // Since they must be verified to create a business,
                                                                        // we go straight to the form and pre-fill the identity.
                                                                        handleDocSelect('NIDA');
                                                                    } else {
                                                                        setVerifView('selection');
                                                                    }
                                                                }}
                                                            >
                                                                {copy('Start now', 'Anza Sasa')}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ) : verifView === 'business_selection' ? (
                                                <motion.div
                                                    key="biz_selection"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="space-y-6"
                                                >
                                                    <div className="space-y-1 text-center md:text-left">
                                                        <h3 className="text-xl font-bold text-slate-900">{copy('Supported business types', 'Aina za biashara zinazoungwa mkono')}</h3>
                                                        <p className="text-sm text-slate-500">{copy('Select your business legal structure to continue.', 'Chagua muundo wa kisheria wa biashara yako ili kuendelea.')}</p>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {[
                                                            { id: 'individual', label: copy('Individual / personal', 'Mtu binafsi / binafsi'), desc: copy('National ID', 'Kitambulisho cha Taifa'), icon: User },
                                                            { id: 'sole_proprietor', label: copy('Sole proprietor', 'Mmiliki binafsi wa biashara'), desc: copy('National ID + TIN', 'Kitambulisho cha Taifa + TIN'), icon: Store },
                                                            { id: 'business', label: copy('Registered business', 'Biashara iliyosajiliwa'), desc: copy('BRELA + licence + TIN', 'BRELA + leseni + TIN'), icon: Building2 },
                                                            { id: 'ngo', label: copy('NGO / non-profit', 'NGO / isiyo ya faida'), desc: copy('Registration document', 'Nyaraka za usajili'), icon: Landmark }
                                                        ].map((type) => (
                                                            <button
                                                                key={type.id}
                                                                onClick={() => {
                                                                    setForm(prev => ({ ...prev, business_type: type.id }));
                                                                    setVerifView('selection');
                                                                }}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group",
                                                                    form.business_type === type.id
                                                                        ? "border-emerald-600 bg-emerald-50/30"
                                                                        : "border-slate-100 hover:border-slate-200 bg-white"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className={cn(
                                                                        "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                                                                        form.business_type === type.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                                                                    )}>
                                                                        <type.icon className="h-5 w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-slate-900 text-sm">{type.label}</p>
                                                                    </div>
                                                                </div>
                                                                <span className="px-2 py-1 rounded-md bg-slate-50 text-slate-500 text-[10px] font-bold border border-slate-100">
                                                                    {type.desc}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{copy('Step 1 of 3', 'Hatua 1 kati ya 3')}</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-slate-400 hover:text-slate-600"
                                                            onClick={() => setVerifView('main')}
                                                        >
                                                            {copy('Cancel', 'Ghairi')}
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ) : verifView === 'selection' ? (
                                                <motion.div key="selection" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <Button variant="ghost" size="icon" onClick={() => setVerifView('business_selection')} className="rounded-lg border border-slate-200 h-9 w-9">
                                                            <ArrowLeft className="h-4 w-4" />
                                                        </Button>
                                                        <h2 className="text-lg font-bold text-slate-900">{copy('Choose ID type', 'Chagua Aina ya Kitambulisho')}</h2>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <DocTypeCard icon={Fingerprint} title="NIDA" desc={copy('National ID', 'Kitambulisho cha Taifa')} onClick={() => handleDocSelect('NIDA')} />
                                                        <DocTypeCard icon={FileText} title={copy('Passport', 'Pasipoti')} desc={copy('International passport', 'Pasipoti ya kimataifa')} onClick={() => handleDocSelect('Passport')} />
                                                        <DocTypeCard icon={CreditCard} title={copy('Voter ID', 'Kitambulisho cha mpiga kura')} desc={copy('Voter identification', 'Kitambulisho cha mpiga kura')} onClick={() => handleDocSelect('Voters ID')} />
                                                    </div>
                                                </motion.div>
                                            ) : verifView === 'form' && (
                                                <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl mx-auto">
                                                    <div className="flex items-center gap-3">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                if (form.business_type !== 'personal' && form.business_type !== 'individual') {
                                                                    setVerifView(null);
                                                                } else {
                                                                    setVerifView('selection');
                                                                }
                                                            }}
                                                            className="rounded-lg border border-slate-200 h-9 w-9"
                                                        >
                                                            <ArrowLeft className="h-4 w-4" />
                                                        </Button>
                                                        <h2 className="text-lg font-bold text-slate-900">
                                                            {form.business_type !== 'personal' && form.business_type !== 'individual'
                                                                ? copy('Business verification', 'Uhakiki wa Biashara')
                                                                : `${copy('Details for', 'Maelezo ya')} ${selectedDoc}`}
                                                        </h2>
                                                    </div>

                                                    <form onSubmit={handleSubmitVerification} className="space-y-6">
                                                        {/* ── IDENTITY SECTION (Only for Personal) ── */}
                                                        {(form.business_type === 'personal' || form.business_type === 'individual') && (
                                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">{copy('First name', 'Jina la Kwanza')}</label>
                                                                        <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">{copy('Last name', 'Jina la Mwisho')}</label>
                                                                        <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">{copy('Gender', 'Jinsia')}</label>
                                                                        <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 outline-none" required>
                                                                            <option value="">{copy('Choose', 'Chagua')}</option>
                                                                            <option value="Male">{copy('Male', 'Mwanaume')}</option>
                                                                            <option value="Female">{copy('Female', 'Mwanamke')}</option>
                                                                            <option value="Other">{copy('Other', 'Nyingine')}</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 ml-1">{copy('Date of birth', 'Tarehe ya Kuzaliwa')}</label>
                                                                        <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} className="h-11 rounded-xl border-slate-200 text-sm" required />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 ml-1">{copy('Identification number', 'Namba ya Kitambulisho')} ({selectedDoc})</label>
                                                                    <Input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 ml-1">{copy('Residential address', 'Anwani ya Makazi')}</label>
                                                                    <Input placeholder={copy('Example: Mbezi, Dar es Salaam', 'Mfano: Mbezi, Dar es Salaam')} value={form.residential_address} onChange={e => setForm({ ...form, residential_address: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 ml-1">{copy('Occupation / profession', 'Kazi / Taaluma')}</label>
                                                                    <Input placeholder={copy('Example: Retailer', 'Mfano: Retailer')} value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">{copy('Front image', 'Picha ya Mbele')}</label>
                                                                        <UploadBox id="id_front" preview={previews.id_front} onChange={(e) => handleFileChange(e, 'id_front')} />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">{copy('Back image', 'Picha ya Nyuma')}</label>
                                                                        <UploadBox id="id_back" preview={previews.id_back} onChange={(e) => handleFileChange(e, 'id_back')} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* ── BUSINESS SECTION (Focused on specific type) ── */}
                                                        {form.business_type !== 'personal' && form.business_type !== 'individual' && (
                                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex gap-3">
                                                                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-emerald-600 shrink-0 shadow-sm border border-emerald-100">
                                                                        <ShieldCheck className="h-5 w-5" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-bold text-emerald-900 text-sm">{copy('Identity verified', 'Utambulisho umethibitishwa')}</p>
                                                                        <p className="text-[11px] text-emerald-700 leading-tight">{copy('Your identity is already approved. Complete only the business documents.', 'Kitambulisho chako kimeshakubaliwa. Jaza nyaraka za biashara pekee.')}</p>
                                                                    </div>
                                                                </div>

                                                                {(form.business_type === 'sole_proprietor' || form.business_type === 'business') && (
                                                                    <div className="space-y-5">
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">{copy('TIN number', 'Namba ya TIN')}</label>
                                                                            <Input placeholder={copy('9-digit TIN number', 'Namba ya TIN ya tarakimu 9')} value={form.tin_number} onChange={e => setForm({ ...form, tin_number: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">{copy('TIN certificate (Upload)', 'Cheti cha TIN (Upload)')}</label>
                                                                            <UploadBox id="tin_document" preview={previews.tin_document} onChange={(e) => handleFileChange(e, 'tin_document')} />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {form.business_type === 'business' && (
                                                                    <div className="space-y-5">
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">{copy('BRELA registration number', 'Namba ya Usajili wa BRELA')}</label>
                                                                            <Input placeholder={copy('BRELA registration number', 'Namba ya usajili wa BRELA')} value={form.brela_number} onChange={e => setForm({ ...form, brela_number: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">{copy('Business licence', 'Leseni ya Biashara')}</label>
                                                                            <UploadBox id="business_license" preview={previews.business_license} onChange={(e) => handleFileChange(e, 'business_license')} />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {form.business_type === 'ngo' && (
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">{copy('NGO registration documents', 'Nyaraka za Usajili wa NGO')}</label>
                                                                        <UploadBox id="registration_doc" preview={previews.registration_doc} onChange={(e) => handleFileChange(e, 'registration_doc')} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <Button
                                                            type="submit"
                                                            className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold mt-4 shadow-lg shadow-brand-600/20"
                                                            disabled={submitting}
                                                        >
                                                            {submitting ? copy('Submitting...', 'Inatuma...') : copy('Submit for verification', 'Wasilisha kwa Uhakiki')}
                                                        </Button>
                                                    </form>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {!auth?.user?.is_merchant && (
                                    <div className="p-8 rounded-2xl border border-dashed border-brand-200 bg-brand-50/10 flex flex-col items-center text-center space-y-5">
                                        <div className="space-y-2">
                                            <h2 className="text-xl font-bold text-slate-900">{copy('Set up your business', 'Anzisha Biashara Yako')}</h2>
                                            <p className="text-slate-600 font-medium text-sm max-w-2xl mx-auto">
                                                {copy('Create extra income by selling physical products, digital downloads, booking services, or your knowledge as paid content, bundles, courses, and memberships.', 'Tengeneza kipato cha ziada kwa kuuza bidhaa za kawaida, digital downloads, huduma za booking, au maarifa yako kama paid content, bundles, courses na memberships.')}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
                                            {[
                                                { icon: Package, label: copy('Physical products', 'Bidhaa za kushikika') },
                                                { icon: DownloadCloud, label: copy('Digital products', 'Bidhaa za kidijitali') },
                                                // Services are intentionally omitted until service-provider launch.
                                                { icon: BookOpenText, label: copy('Paid knowledge', 'Maarifa ya kulipia') },
                                            ].map((item) => {
                                                const Icon = item.icon;

                                                return (
                                                    <div key={item.label} className="rounded-xl border border-brand-100 bg-white px-3 py-3 flex flex-col items-center gap-2">
                                                        <Icon className="h-5 w-5 text-brand-600" />
                                                        <span className="text-[11px] font-black text-slate-700">{item.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {!hasVerifiedEmail && (
                                            <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-3 py-1.5">
                                                {copy('Connect Google first so we can use a verified email for receipts, notifications, and account security.', 'Unganisha Google kwanza ili tupate email iliyothibitishwa kwa risiti, notifications na usalama wa akaunti.')}
                                            </p>
                                        )}
                                        {hasVerifiedEmail ? (
                                            <Link href="/merchant/register" className="h-11 px-6 rounded-xl bg-brand-600 text-white font-bold text-sm flex items-center justify-center hover:bg-brand-700 transition-all active:scale-95">
                                                {copy('Join now', 'Jiunge Sasa')} <ChevronRight className="ml-1 h-4 w-4" />
                                            </Link>
                                        ) : (
                                            <a href="/auth/google/redirect" className="h-11 px-6 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
                                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-4 w-4" alt="Google" />
                                                {copy('Connect Google', 'Unganisha Google')}
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Security Accordion ── */}
                        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <button
                                className="w-full text-left hover:bg-slate-50 transition-colors flex items-center justify-between p-5"
                                onClick={() => setIsSecurityOpen(!isSecurityOpen)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100">
                                        <Shield className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-900 text-base">{copy('Profile and security', 'Wasifu na Usalama')}</span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{copy('Profile & Security', 'Wasifu na Usalama')}</p>
                                    </div>
                                </div>
                                {isSecurityOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                            </button>

                            <AnimatePresence>
                                {isSecurityOpen && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-50 overflow-hidden">
                                        <div className="p-6 space-y-4">
                                            <DetailRow label={copy('Phone number', 'Namba ya Simu')} value={auth?.user?.phone_number ? `${auth.user.phone_number.slice(0, 4)} ••• ••• ${auth.user.phone_number.slice(-3)}` : '+255 ••• ••• ***'} />
                                            <DetailRow
                                                label={copy('Email', 'Barua Pepe')}
                                                value={auth?.user?.email_verified_at ? (
                                                    maskEmail(auth?.user?.email)
                                                ) : (
                                                    <a
                                                        href="/auth/google/redirect"
                                                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-50"
                                                    >
                                                        <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-3.5 w-3.5" alt="Google" />
                                                        {auth?.user?.email ? copy('Verify with Google', 'Thibitisha kwa Google') : copy('Connect Google', 'Unganisha Google')}
                                                    </a>
                                                )}
                                            />
                                            <DetailRow
                                                label={copy('Authenticator 2FA', 'Authenticator 2FA')}
                                                value={(
                                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${hasTotpEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${hasTotpEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            {hasTotpEnabled ? copy('Already set', 'Imewekwa') : copy('Not set', 'Haijawekwa')}
                                                        </span>
                                                        <Link
                                                            href="/profile/security"
                                                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-50"
                                                        >
                                                            {hasTotpEnabled ? copy('Manage', 'Simamia') : copy('Set up', 'Sanidi')}
                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </div>
                                                )}
                                            />
                                            <DetailRow label={copy('Username', 'Jina la Mtumiaji')} value={`@${activeMerchant?.username || 'user'}`} />
                                            <div className="flex items-center justify-between py-3">
                                                <span className="text-slate-500 font-medium text-sm">{copy('Account status', 'Hali ya Akaunti')}</span>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                    <span className={`font-bold text-[10px] uppercase ${isVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {isVerified ? copy('Verified', 'Imethibitishwa') : copy('Verification required', 'Uthibitisho unahitajika')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <Link
                                                    href="/profile/settings"
                                                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition-colors hover:bg-white"
                                                >
                                                    <span>{copy('Profile settings', 'Mipangilio ya Wasifu')}</span>
                                                    <ChevronRight className="h-4 w-4 text-slate-500" />
                                                </Link>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function isRetailEligible(merchant, merchantKyc = null, merchantKycStatus = 'unverified') {
    if (!merchant) return false;

    const businessTypes = ['sole_proprietor', 'business', 'ngo'];
    const kyc = merchantKyc || merchant.kyc;

    return businessTypes.includes(merchant.type)
        && Boolean(merchant.is_verified)
        && (merchant.kyc_status || merchantKycStatus) === 'verified'
        && kyc?.status === 'verified'
        && businessTypes.includes(kyc?.business_type);
}

// ── Sub-Components ──

function ActionBtn({ icon: Icon, label, href, onClick, color, textColor, borderColor = "" }) {
    const Comp = href ? Link : 'button';
    const props = href ? { href } : { type: 'button', onClick };

    return (
        <Comp {...props} className={cn("flex flex-col items-center justify-center gap-2.5 p-5 rounded-2xl border transition-all active:scale-[0.98] group shadow-sm", color, textColor, borderColor || "border-transparent")}>
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110", textColor === 'text-white' ? "bg-white/10" : "bg-white border " + borderColor)}>
                <Icon className="h-5 w-5" />
            </div>
            <span className="font-bold text-[10px] uppercase tracking-wide">{label}</span>
        </Comp>
    );
}

function BreakdownRow({ label, count, color, total }) {
    const { copy } = useLocale();
    const translations = {
        'Digital / Unlockables': 'Kidijitali / Vinavyofunguliwa',
        'Physical Products': 'Bidhaa halisi',
        'Huduma (Services)': 'Huduma',
    };
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>{copy(label, translations[label] || label)}</span>
                <span className="text-slate-900">{count}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
}

function MiniMetric({ label, value, icon: Icon, tone = 'slate', compact = false, onClick = null, actionLabel = null }) {
    const toneClasses = {
        brand: 'border-brand-100 bg-brand-50/45 text-brand-700',
        amber: 'border-amber-100 bg-amber-50/55 text-amber-700',
        sky: 'border-sky-100 bg-sky-50/55 text-sky-700',
        emerald: 'border-emerald-100 bg-emerald-50/55 text-emerald-700',
        orange: 'border-orange-100 bg-orange-50/55 text-orange-700',
        blue: 'border-blue-100 bg-blue-50/55 text-blue-700',
        slate: 'border-slate-200 bg-slate-50/70 text-slate-700',
    }[tone] || 'border-slate-200 bg-slate-50/70 text-slate-700';

    const handleKeyDown = (event) => {
        if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onClick();
    };

    return (
        <div className={cn(
            "min-w-0 rounded-2xl border bg-white px-3 shadow-sm ring-1 ring-slate-900/[0.02]",
            compact ? "py-3" : "py-4",
            onClick && "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
            toneClasses
        )}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick || undefined}
            onKeyDown={handleKeyDown}
        >
            <div className="flex min-w-0 items-center gap-2">
                {Icon && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/75 shadow-sm">
                        <Icon className="h-3.5 w-3.5" />
                    </span>
                )}
                <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-wider">{label}</p>
            </div>
            <p className={cn(
                "mt-2 font-black text-slate-950 truncate",
                compact ? "text-sm md:text-base" : "text-base md:text-lg"
            )}>{value}</p>
            {actionLabel && (
                <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{actionLabel}</p>
            )}
        </div>
    );
}

function PayoutMetric({ label, value, icon: Icon, tone = 'emerald', href = null, actionLabel = null, actionHref = null }) {
    const toneClasses = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
    }[tone] || 'bg-slate-50 text-slate-700 border-slate-100';

    const goToHref = () => {
        if (href) router.visit(href);
    };

    const handleKeyDown = (event) => {
        if (!href || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        goToHref();
    };

    return (
        <div
            role={href ? 'button' : undefined}
            tabIndex={href ? 0 : undefined}
            onClick={goToHref}
            onKeyDown={handleKeyDown}
            className={cn(
                "rounded-2xl border bg-white/80 p-3 text-left",
                href && "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                toneClasses
            )}
        >
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-black text-slate-900 md:text-base">{value}</p>
                {actionLabel && actionHref && (
                    <Button
                        type="button"
                        variant="outline"
                        className="h-8 shrink-0 rounded-xl border-emerald-200 bg-white/75 px-3 text-xs font-black text-slate-950 shadow-none hover:bg-white"
                        onClick={(event) => {
                            event.stopPropagation();
                            router.visit(actionHref);
                        }}
                    >
                        {actionLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}

function MonetizationBucketRow({ bucket, total, formatMoney }) {
    const share = Number(bucket.share ?? (total > 0 ? (Number(bucket.revenue || 0) / total) * 100 : 0));

    return (
        <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{bucket.label}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                        {Number(bucket.orders || 0).toLocaleString()} orders · {Number(bucket.units || 0).toLocaleString()} units · {share.toFixed(1)}%
                    </p>
                </div>
                <div className="min-w-0 shrink-0 text-right">
                    <p className="text-sm font-black text-slate-900">{formatMoney(bucket.revenue || 0)}</p>
                    <p className="text-[10px] font-semibold text-slate-500">{formatMoney(bucket.pending || 0)} pending</p>
                </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(Math.max(share, 0), 100)}%` }} />
            </div>
        </div>
    );
}

function TopCreatorItem({ item, formatMoney, iconFromKey }) {
    const Icon = iconFromKey(item.icon);

    return (
        <div className="min-w-0 rounded-xl border border-slate-100 bg-white px-3 py-2">
            <div className="flex min-w-0 items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{item.title}</p>
                        <p className="text-[11px] font-semibold text-slate-500 truncate">{item.bucket_label} · {Number(item.orders || 0).toLocaleString()} orders</p>
                    </div>
                    <p className="mt-1 text-xs font-black text-brand-600 sm:mt-0 sm:text-sm sm:shrink-0">{formatMoney(item.revenue || 0)}</p>
                </div>
            </div>
        </div>
    );
}

function DocTypeCard({ icon: Icon, title, desc, onClick }) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-200 bg-white hover:border-brand-500 hover:bg-brand-50/20 transition-all text-center w-full active:scale-[0.98] shadow-sm">
            <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
                <Icon className="h-6 w-6" />
            </div>
            <div>
                <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">{desc}</p>
            </div>
        </button>
    );
}

function UploadBox({ id, preview, onChange }) {
    const { copy } = useLocale();
    return (
        <div className="relative group">
            <input type="file" id={id} className="hidden" accept="image/*" onChange={onChange} />
            <label htmlFor={id} className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${preview ? 'border-brand-300 bg-brand-50/10' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'}`}>
                {preview ? (
                    <div className="relative w-full h-full p-1.5">
                        <img src={preview} alt={copy('Preview', 'Mwonekano')} className="w-full h-full object-cover rounded-lg" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <Camera className="h-5 w-5 text-white" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2">
                            <Camera className="h-4.5 w-4.5" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{copy('Upload image', 'Pakia Picha')}</p>
                    </>
                )}
            </label>
        </div>
    );
}

function DetailRow({ label, value }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-slate-50 border-dashed gap-1">
            <span className="text-slate-500 font-medium text-sm">{label}</span>
            <span className="font-bold text-slate-900 text-sm">{value}</span>
        </div>
    );
}

function maskEmail(email) {
    if (!email) return '';

    const [name, domain] = String(email).split('@');
    if (!name || !domain) return email;

    const visibleName = name.length <= 2
        ? name[0]
        : `${name.slice(0, 2)}${'•'.repeat(Math.min(4, name.length - 2))}`;

    const [domainName, ...tldParts] = domain.split('.');
    const tld = tldParts.join('.');
    const visibleDomain = domainName.length <= 2
        ? domainName[0]
        : `${domainName[0]}${'•'.repeat(Math.min(4, domainName.length - 1))}`;

    return `${visibleName}@${visibleDomain}${tld ? `.${tld}` : ''}`;
}
