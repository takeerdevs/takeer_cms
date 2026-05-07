import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage, router, useForm } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/Components/ui/Dialog';
import {
    User, UserCircle, Shield, Settings, LogOut, Store, ExternalLink, ChevronRight, Plus, ChevronDown, ChevronUp, BarChart3, Package, DownloadCloud, Briefcase,
    Wallet, CreditCard, Link as LinkIcon, Truck, TrendingUp, Banknote, AlertTriangle, FileCheck, CheckCircle2, ShieldCheck, BookOpenText, Boxes, Crown, CalendarClock, ShoppingBag,
    Mail, Phone, Fingerprint, FileText, Camera, Clock, ArrowLeft, Building2, Landmark, ShieldAlert, Smartphone, User2, MessageSquare, HardDrive, Megaphone
} from 'lucide-react';
import axios from 'axios';
import ProfileSwitcher from '@/Components/ProfileSwitcher';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import {
    Dialog as CreateDialog,
    DialogContent as CreateDialogContent,
    DialogHeader as CreateDialogHeader,
    DialogTitle as CreateDialogTitle,
    DialogDescription as CreateDialogDescription,
    DialogFooter as CreateDialogFooter
} from '@/Components/ui/Dialog';

export default function Profile({
    activeMerchant = null,
    weeklyStats = { payments: 0, transactions: 0, percentChange: 0 },
    summary = { total_products: 0, orders_today: 0, orders_pending: 0, orders_completed: 0 },
    recentOrders = [],
    thisMonthEarnings = 0,
    salesBreakdown = { digital: 0, physical: 0, services: 0 },
    commerceHubSummary = { physical: 0, digital: 0, services: 0, posts: 0, bundles: 0, subscriptions: 0 },
    creatorMonetization = null,
    countries = [],
    currencies = [],
    merchantKyc = null,
    merchantKycStatus = 'unverified'
}) {
    const { auth } = usePage().props;
    const merchants = auth?.user?.merchant_profiles ?? [];

    const [isSecurityOpen, setIsSecurityOpen] = useState(false);
    const [isCreateShopModalOpen, setIsCreateShopModalOpen] = useState(false);
    const [retailDashboard, setRetailDashboard] = useState(null);
    const retailEligible = isRetailEligible(activeMerchant, merchantKyc, merchantKycStatus);
    const retailActive = retailEligible && activeMerchant?.active_modules?.includes('retail_ops');

    useEffect(() => {
        if (retailActive) {
            axios.get('/api/retail/dashboard')
                .then(res => setRetailDashboard(res.data))
                .catch(err => console.error('Failed to load retail stats', err));
        } else {
            setRetailDashboard(null);
        }
    }, [activeMerchant, retailActive]);

    const isVerified = activeMerchant?.is_verified ?? false;
    const merchantSlug = activeMerchant?.username ?? '';
    const commerceHubItems = [
        { key: 'physical', title: 'Physical Products', count: commerceHubSummary.physical ?? 0, icon: Package, href: `/merchant/${merchantSlug}/products` },
        { key: 'digital', title: 'Digital Downloads', count: commerceHubSummary.digital ?? 0, icon: DownloadCloud, href: `/merchant/${merchantSlug}/downloads` },
        { key: 'services', title: 'Services/Booking', count: commerceHubSummary.services ?? 0, icon: Briefcase, href: `/merchant/${merchantSlug}/services` },
        { key: 'posts', title: 'Posts', count: commerceHubSummary.posts ?? 0, icon: BookOpenText, href: `/merchant/${merchantSlug}/posts` },
        { key: 'bundles', title: 'Bundles', count: commerceHubSummary.bundles ?? 0, icon: Boxes, href: `/merchant/${merchantSlug}/bundles` },
        { key: 'subscriptions', title: 'Subscriptions', count: commerceHubSummary.subscriptions ?? 0, icon: Crown, href: `/merchant/${merchantSlug}/subscriptions` },
        { key: 'marketing', title: 'Marketing', count: 0, icon: Megaphone, href: `/merchant/${merchantSlug}/marketing` },
    ];

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
        type: 'sole_proprietor'
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
            toast.error(err.response?.data?.message || 'Imefeli kuongeza biashara.');
        } finally {
            setCreatingBiz(false);
        }
    };

    const statusBadge = (status) => {
        const map = {
            awaiting_merchant_confirmation: { label: 'MPYA', cls: 'bg-amber-500/10 text-amber-600' },
            escrow_locked: { label: 'ESCROW', cls: 'bg-brand-500/10 text-brand-700' },
            shipped: { label: 'IN DELIVERY', cls: 'bg-sky-500/10 text-sky-700' },
            resolved_merchant_paid: { label: 'IMEKAMILIKA', cls: 'bg-emerald-500/10 text-emerald-700' },
            disputed: { label: 'MGOGORO', cls: 'bg-red-500/10 text-red-700' },
            resolved_buyer_refunded: { label: 'REFUNDED', cls: 'bg-slate-500/10 text-slate-700' },
            pending: { label: 'PENDING', cls: 'bg-slate-500/10 text-slate-700' },
        };
        const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
        );
    };

    const typeMeta = (kind) => {
        const map = {
            physical_product: { label: 'Physical Product', icon: ShoppingBag, cls: 'bg-amber-500/10 text-amber-700' },
            post_content: { label: 'Post Content', icon: BookOpenText, cls: 'bg-sky-500/10 text-sky-700' },
            digital_file: { label: 'Digital File', icon: DownloadCloud, cls: 'bg-indigo-500/10 text-indigo-700' },
            service_booking: { label: 'Service/Booking', icon: CalendarClock, cls: 'bg-emerald-500/10 text-emerald-700' },
        };
        return map[kind] || { label: 'Post Content', icon: BookOpenText, cls: 'bg-muted text-muted-foreground' };
    };

    const iconFromKey = (key) => {
        const map = {
            shopping_bag: ShoppingBag,
            book_open: BookOpenText,
            download: DownloadCloud,
            calendar_clock: CalendarClock,
            boxes: Boxes,
            crown: Crown,
        };
        return map[key] || Package;
    };

    const handleLogout = () => {
        router.post('/logout', {}, {
            onFinish: () => {
                localStorage.removeItem('takeer_token');
                delete axios.defaults.headers.common['Authorization'];
            }
        });
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-TZ', {
            style: 'currency',
            currency: 'TZS',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const fetchDashboard = () => {
        if (retailActive) {
            axios.get('/api/retail/dashboard')
                .then(res => setRetailDashboard(res.data))
                .catch(err => console.error('Failed to load retail stats', err));
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
            toast.success('Ombi lako limepokelewa!');
            router.reload();
        } catch (err) {
            const msg = err.response?.data?.message || 'Kuna tatizo. Tafadhali jaribu tena.';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AppLayout>
            <Head title="Akaunti Yangu | Takeer" />

            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">

                {/* ── Profile Header ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                            <UserCircle className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Akaunti Yangu</h1>
                            <p className="text-slate-500 font-medium text-sm">
                                {activeMerchant?.type === 'personal' ? 'Personal Profile' : (activeMerchant?.type?.replace('_', ' ').toUpperCase() || 'Business Profile')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <ProfileSwitcher onCreateBusiness={() => setIsCreateShopModalOpen(true)} />
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
                                <CreateDialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Ongeza Biashara Mpya</CreateDialogTitle>
                                <CreateDialogDescription className="text-slate-500 font-medium">Anzisha wasifu mpya wa biashara yako Takeer.</CreateDialogDescription>
                            </CreateDialogHeader>

                            <form onSubmit={handleCreateBusiness} className="space-y-4">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Aina ya Biashara</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {[
                                                { id: 'sole_proprietor', label: 'Sole Proprietor', desc: 'Verified Identity + TIN', icon: Store },
                                                { id: 'business', label: 'Registered Business', desc: 'BRELA + License + TIN', icon: Building2 },
                                                { id: 'ngo', label: 'NGO / Non-Profit', desc: 'Registration Doc', icon: Landmark }
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
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Jina la Biashara</label>
                                        <Input
                                            placeholder="Mfano: Takeer Store"
                                            value={bizForm.display_name}
                                            onChange={e => setBizForm(prev => ({ ...prev, display_name: e.target.value }))}
                                            className="h-12 rounded-xl border-slate-200 font-bold bg-white"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Username (ID ya Biashara)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                                            <Input
                                                placeholder="username"
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
                                        Ghairi
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={creatingBiz}
                                        className="h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex-1 shadow-lg shadow-brand-600/20"
                                    >
                                        {creatingBiz ? 'Inatengeneza...' : 'Tengeneza Biashara'}
                                    </Button>
                                </CreateDialogFooter>
                            </form>
                        </div>
                    </CreateDialogContent>
                </CreateDialog>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-12 space-y-6">

                        {isVerified ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

                                {retailActive && (
                                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <StatCard
                                            title="Takeer Balance (Escrow)"
                                            value={formatMoney(retailDashboard?.metrics?.takeer_balance || 0)}
                                            icon={Wallet}
                                            color="text-emerald-600"
                                            bgColor="bg-emerald-50"
                                            borderColor="border-emerald-100"
                                            onClick={() => router.visit(`/merchant/${activeMerchant.username}/wallet/ledger?type=escrow`)}
                                        />
                                        <StatCard
                                            title="Today's In-Hand Revenue"
                                            value={formatMoney(retailDashboard?.metrics?.today_in_hand || 0)}
                                            icon={Banknote}
                                            color="text-brand-600"
                                            bgColor="bg-brand-50"
                                            borderColor="border-brand-100"
                                            onClick={() => router.visit(`/merchant/${activeMerchant.username}/wallet/ledger?type=non-escrow`)}
                                        />
                                        <StatCard
                                            title="Outstanding Credit"
                                            value={formatMoney(retailDashboard?.metrics?.outstanding_credit || 0)}
                                            icon={TrendingUp}
                                            color="text-amber-600"
                                            bgColor="bg-amber-50"
                                            borderColor="border-amber-100"
                                            onClick={() => router.visit(`/merchant/${activeMerchant.username}/wallet/ledger?type=credit`)}
                                        />
                                        <StatCard
                                            title="Total Balance"
                                            value={formatMoney(thisMonthEarnings)}
                                            icon={CreditCard}
                                            color="text-blue-600"
                                            bgColor="bg-blue-50"
                                            borderColor="border-blue-100"
                                            onClick={() => router.visit(`/merchant/${activeMerchant.username}/wallet/ledger`)}
                                        />
                                    </div>
                                )}

                                {creatorMonetization && (
                                    <Card className="border border-brand-100 rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-white to-brand-50/40">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900">Creator Monetization</CardTitle>
                                                    <p className="mt-1 text-xs font-semibold text-slate-500">{creatorMonetization.window}</p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="rounded-xl text-xs font-black"
                                                    onClick={() => router.visit(`/m/${merchantSlug}`)}
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                                    Storefront
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-3 gap-3">
                                                <MiniMetric label="Revenue" value={formatMoney(creatorMonetization.total_revenue || 0)} />
                                                <MiniMetric label="Orders" value={Number(creatorMonetization.total_orders || 0).toLocaleString()} />
                                                <MiniMetric label="Members" value={Number(creatorMonetization.active_members || 0).toLocaleString()} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                                <MiniMetric label="Released" value={formatMoney(creatorMonetization.released_revenue || 0)} />
                                                <MiniMetric label="Pending" value={formatMoney(creatorMonetization.pending_revenue || 0)} />
                                                <MiniMetric label="Est. net" value={formatMoney(creatorMonetization.estimated_net || 0)} />
                                                <MiniMetric label="Change" value={`${Number(creatorMonetization.revenue_change_percent || 0).toLocaleString()}%`} />
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-3">
                                                <PayoutMetric label="Available payout" value={formatMoney(creatorMonetization.payouts?.available_balance || 0)} icon={Wallet} tone="emerald" />
                                                <PayoutMetric label="Held / escrow" value={formatMoney(creatorMonetization.payouts?.held_balance || 0)} icon={ShieldCheck} tone="blue" />
                                                <PayoutMetric label="Pending withdrawals" value={formatMoney(creatorMonetization.payouts?.pending_withdrawals || 0)} icon={Banknote} tone="amber" />
                                            </div>
                                            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                                                <div className="rounded-2xl border border-white bg-white/80 p-3">
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <div>
                                                            <p className="text-xs font-black uppercase tracking-wider text-slate-900">Revenue by content type</p>
                                                            <p className="text-[11px] font-semibold text-slate-500">Gross sales grouped by creator monetization format.</p>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            className="rounded-xl text-[11px] font-black h-8"
                                                            onClick={() => router.visit(`/merchant/${merchantSlug}/wallet/ledger`)}
                                                        >
                                                            Ledger
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
                                                <div className="rounded-2xl border border-white bg-white/80 p-3">
                                                    <p className="text-xs font-black uppercase tracking-wider text-slate-900">Top earners</p>
                                                    <p className="text-[11px] font-semibold text-slate-500 mb-3">Best selling offers in this window.</p>
                                                    <div className="space-y-2">
                                                        {(creatorMonetization.top_items || []).length > 0 ? (
                                                            creatorMonetization.top_items.map((item) => (
                                                                <TopCreatorItem key={`${item.kind}-${item.title}`} item={item} formatMoney={formatMoney} iconFromKey={iconFromKey} />
                                                            ))
                                                        ) : (
                                                            <p className="text-sm font-semibold text-slate-500 py-4 text-center">No paid creator sales yet.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Actions</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <ActionBtn icon={Plus} label="New Item" href={`/merchant/${merchantSlug}/upload`} color="bg-brand-600" textColor="text-white" />
                                                {retailEligible && (
                                                    <ActionBtn icon={Store} label="Retail Plan" href={`/merchant/${merchantSlug}/platform-subscriptions/retail-operations`} color="bg-amber-50" textColor="text-amber-700" borderColor="border-amber-100" />
                                                )}
                                                <ActionBtn icon={HardDrive} label="Storage Plan" href={`/merchant/${merchantSlug}/platform-subscriptions/storage`} color="bg-sky-50" textColor="text-sky-700" borderColor="border-sky-100" />
                                                <ActionBtn icon={Clock} label="Pulse" href={`/merchant/${merchantSlug}/pulse`} color="bg-blue-50" textColor="text-blue-700" borderColor="border-blue-100" />
                                                <ActionBtn icon={Megaphone} label="Marketing" href={`/merchant/${merchantSlug}/marketing`} color="bg-violet-50" textColor="text-violet-700" borderColor="border-violet-100" />
                                                <ActionBtn icon={Wallet} label="Wallet" href={`/merchant/${merchantSlug}/wallet`} color="bg-emerald-50" textColor="text-emerald-700" borderColor="border-emerald-100" />
                                                {retailActive && (
                                                    <ActionBtn icon={Store} label="Retail" href={`/merchant/${merchantSlug}/retail/dashboard`} color="bg-brand-50" textColor="text-brand-700" borderColor="border-brand-100" />
                                                )}
                                                <ActionBtn icon={Settings} label="Settings" href={`/merchant/${merchantSlug}/settings`} color="bg-slate-50" textColor="text-slate-700" borderColor="border-slate-100" />
                                            </div>
                                        </div>

                                        <Card className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Mgawanyo wa Mauzo</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <BreakdownRow label="Digital / Unlockables" count={salesBreakdown.digital} color="bg-indigo-500" total={salesBreakdown.digital + salesBreakdown.physical + salesBreakdown.services} />
                                                <BreakdownRow label="Physical Products" count={salesBreakdown.physical} color="bg-emerald-500" total={salesBreakdown.digital + salesBreakdown.physical + salesBreakdown.services} />
                                                <BreakdownRow label="Huduma (Services)" count={salesBreakdown.services} color="bg-amber-500" total={salesBreakdown.digital + salesBreakdown.physical + salesBreakdown.services} />
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <div>
                                                    <h3 className="text-xs font-bold uppercase tracking-wider">Commerce Hub</h3>
                                                    <p className="mt-1 text-xs text-slate-500">Nenda moja kwa moja kwenye sehemu unayotaka kusimamia.</p>
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
                                                        <p className="mt-1 text-[11px] font-semibold text-slate-400">Tap to manage</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Miamala ya Hivi Karibuni</h3>
                                                <Link href={`/merchant/${merchantSlug}/orders`} className="text-xs font-bold text-brand-600 hover:underline">Ona Zote</Link>
                                            </div>

                                            <div className="space-y-3">
                                                {recentOrders.length === 0 ? (
                                                    <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200">
                                                        <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                                        <p className="text-slate-400 font-medium text-sm">Huna miamala bado.</p>
                                                    </div>
                                                ) : (
                                                    recentOrders.map(order => (
                                                        <Card key={order.id} className="border border-slate-100 hover:border-brand-200 transition-all rounded-xl shadow-sm group">
                                                            <CardContent className="p-4">
                                                                <div className="flex items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 transition-colors group-hover:bg-brand-50 group-hover:border-brand-100">
                                                                            {React.createElement(iconFromKey(order.display_icon), { className: 'h-6 w-6 text-slate-500 group-hover:text-brand-600' })}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                <span className="text-[10px] font-bold text-slate-400">#{order.id}</span>
                                                                                {statusBadge(order.status)}
                                                                            </div>
                                                                            <p className="font-bold text-slate-900 truncate text-sm">{order.display_title || 'Order item'}</p>
                                                                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                                                                                {order.created_at ? new Date(order.created_at).toLocaleDateString() : ''}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <p className="font-bold text-slate-900 text-lg">
                                                                        {formatMoney(order.amount || 0)}
                                                                    </p>
                                                                </div>
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
                                                        <h2 className="text-xl font-bold text-slate-900">Taarifa zinahakikiwa</h2>
                                                        <p className="text-slate-600 text-sm max-w-sm mx-auto">
                                                            Tumeshapokea nyaraka zako. Timu yetu inazihakiki. Huu mchakato huchukua masaa 12-24.
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
                                                            <h2 className="text-lg font-bold text-slate-900">Uhakiki Umekataliwa</h2>
                                                            <p className="text-slate-600 text-sm font-medium">
                                                                Maelezo yako hayajakubaliwa kutokana na sababu ifuatayo:
                                                            </p>
                                                            <div className="mt-3 p-4 rounded-xl bg-white border border-red-100 text-red-700 font-bold text-sm italic shadow-sm">
                                                                "{merchantKyc?.rejection_reason || 'Nyaraka zako haziko wazi au hazitoshi.'}"
                                                            </div>
                                                            <div className="pt-2">
                                                                <Button
                                                                    className="h-11 px-6 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-sm hover:bg-slate-800 transition-all"
                                                                    onClick={() => {
                                                                        setRetryVerif(true);
                                                                        setVerifView('selection');
                                                                    }}
                                                                >
                                                                    Jaribu Tena
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ) : verifView === 'main' ? (
                                                <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                                    <div className="space-y-3">
                                                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                                            {activeMerchant?.type === 'personal' ? '1. Uthibitisho wa Mawasiliano' : '1. Mawasiliano ya Biashara'}
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
                                                                                <p className="font-bold text-slate-900 text-sm">Nambari ya Simu</p>
                                                                                <p className="text-xs text-slate-500">{auth?.user?.phone_number}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                                                                            <CheckCircle2 className="h-3 w-3" /> Imethibitishwa
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                                                                <Mail className="h-5 w-5" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-slate-900 text-sm">Barua Pepe</p>
                                                                                <p className="text-xs text-slate-500">{auth?.user?.email || 'Google Verification'}</p>
                                                                            </div>
                                                                        </div>
                                                                        {auth?.user?.email_verified_at ? (
                                                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                                                                                <CheckCircle2 className="h-3 w-3" /> Imethibitishwa
                                                                            </div>
                                                                        ) : (
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 flex items-center gap-2"
                                                                                onClick={() => window.location.href = '/auth/google/redirect'}
                                                                            >
                                                                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-3.5 w-3.5" alt="Google" />
                                                                                Unganisha
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
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest bg-brand-600 text-white px-2 py-0.5 rounded-full">Primary</span>
                                                                                    )}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-slate-900 text-sm truncate">{loc.name}</p>
                                                                                    <p className="text-[10px] text-slate-500 truncate">{loc.address}</p>
                                                                                </div>
                                                                                <div className="pt-2 flex items-center gap-2 text-[11px] font-bold text-slate-600">
                                                                                    <Phone className="h-3 w-3 text-slate-400" /> {loc.contact_phone || 'Hakuna Simu'}
                                                                                </div>
                                                                            </div>
                                                                        )) : (
                                                                            <div className="col-span-full p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-3">
                                                                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                                                                                    <Truck className="h-6 w-6 text-slate-400" />
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-slate-900">Hakuna Maeneo ya Biashara</p>
                                                                                    <p className="text-xs text-slate-500">Ongeza maeneo ya biashara yako kwenye mipangilio ili wateja wakupate.</p>
                                                                                </div>
                                                                                <Link href={`/merchant/${activeMerchant?.username}/settings`} className="inline-flex h-9 items-center justify-center px-4 rounded-lg bg-brand-600 text-white font-bold text-xs">
                                                                                    Weka Mipangilio
                                                                                </Link>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">2. Uthibitisho wa Utambulisho</h2>
                                                        <div className="p-6 rounded-2xl border border-brand-200 bg-brand-50/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                            <div className="flex gap-4">
                                                                <div className="h-12 w-12 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                                                                    <ShieldCheck className="h-6 w-6" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-lg font-bold text-slate-900">Uthibitisho wa KYC</h3>
                                                                    <p className="text-slate-600 text-sm font-medium mt-0.5 leading-relaxed max-w-sm">
                                                                        Hakiki utambulisho wako ili kuanza kutoa pesa na kuuza bidhaa zako kwa usalama.
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
                                                                Anza Sasa
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
                                                        <h3 className="text-xl font-bold text-slate-900">Supported business types</h3>
                                                        <p className="text-sm text-slate-500">Select your business legal structure to continue.</p>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {[
                                                            { id: 'individual', label: 'Individual / Personal', desc: 'National ID', icon: User },
                                                            { id: 'sole_proprietor', label: 'Sole Proprietor', desc: 'National ID + TIN', icon: Store },
                                                            { id: 'business', label: 'Registered Business', desc: 'BRELA + License + TIN', icon: Building2 },
                                                            { id: 'ngo', label: 'NGO / Non-Profit', desc: 'Registration Doc', icon: Landmark }
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
                                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Hatua 1 kati ya 3</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-slate-400 hover:text-slate-600"
                                                            onClick={() => setVerifView('main')}
                                                        >
                                                            Ghairi
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ) : verifView === 'selection' ? (
                                                <motion.div key="selection" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <Button variant="ghost" size="icon" onClick={() => setVerifView('business_selection')} className="rounded-lg border border-slate-200 h-9 w-9">
                                                            <ArrowLeft className="h-4 w-4" />
                                                        </Button>
                                                        <h2 className="text-lg font-bold text-slate-900">Chagua Aina ya Kitambulisho</h2>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <DocTypeCard icon={Fingerprint} title="NIDA" desc="Kitambulisho cha Taifa" onClick={() => handleDocSelect('NIDA')} />
                                                        <DocTypeCard icon={FileText} title="Pasipoti" desc="Passport ya Kimataifa" onClick={() => handleDocSelect('Passport')} />
                                                        <DocTypeCard icon={CreditCard} title="Voters ID" desc="Mpiga Kura" onClick={() => handleDocSelect('Voters ID')} />
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
                                                                ? 'Uhakiki wa Biashara'
                                                                : `Maelezo ya ${selectedDoc}`}
                                                        </h2>
                                                    </div>

                                                    <form onSubmit={handleSubmitVerification} className="space-y-6">
                                                        {/* ── IDENTITY SECTION (Only for Personal) ── */}
                                                        {(form.business_type === 'personal' || form.business_type === 'individual') && (
                                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">Jina la Kwanza</label>
                                                                        <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">Jina la Mwisho</label>
                                                                        <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">Jinsia (Gender)</label>
                                                                        <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-brand-500 outline-none" required>
                                                                            <option value="">Chagua</option>
                                                                            <option value="Male">Mwanaume</option>
                                                                            <option value="Female">Mwanamke</option>
                                                                            <option value="Other">Nyingine</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">Tarehe ya Kuzaliwa</label>
                                                                        <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} className="h-11 rounded-xl border-slate-200 text-sm" required />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 ml-1">Namba ya Kitambulisho ({selectedDoc})</label>
                                                                    <Input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 ml-1">Anwani ya Makazi</label>
                                                                    <Input placeholder="Mfano: Mbezi, Dar es Salaam" value={form.residential_address} onChange={e => setForm({ ...form, residential_address: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 ml-1">Kazi / Taaluma</label>
                                                                    <Input placeholder="Mfano: Retailer" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">Picha ya Mbele</label>
                                                                        <UploadBox id="id_front" preview={previews.id_front} onChange={(e) => handleFileChange(e, 'id_front')} />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">Picha ya Nyuma</label>
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
                                                                        <p className="font-bold text-emerald-900 text-sm">Identity Verified</p>
                                                                        <p className="text-[11px] text-emerald-700 leading-tight">Kitambulisho chako kimeshakubaliwa. Jaza nyaraka za biashara pekee.</p>
                                                                    </div>
                                                                </div>

                                                                {(form.business_type === 'sole_proprietor' || form.business_type === 'business') && (
                                                                    <div className="space-y-5">
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">Namba ya TIN</label>
                                                                            <Input placeholder="9-digit TIN number" value={form.tin_number} onChange={e => setForm({ ...form, tin_number: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">Cheti cha TIN (Upload)</label>
                                                                            <UploadBox id="tin_document" preview={previews.tin_document} onChange={(e) => handleFileChange(e, 'tin_document')} />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {form.business_type === 'business' && (
                                                                    <div className="space-y-5">
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">Namba ya Usajili wa BRELA</label>
                                                                            <Input placeholder="BRELA Registration No" value={form.brela_number} onChange={e => setForm({ ...form, brela_number: e.target.value })} className="h-11 rounded-xl border-slate-200" required />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-bold text-slate-500 ml-1">Leseni ya Biashara</label>
                                                                            <UploadBox id="business_license" preview={previews.business_license} onChange={(e) => handleFileChange(e, 'business_license')} />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {form.business_type === 'ngo' && (
                                                                    <div className="space-y-2">
                                                                        <label className="text-xs font-bold text-slate-500 ml-1">Nyaraka za Usajili wa NGO</label>
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
                                                            {submitting ? 'Inatuma...' : 'Wasilisha kwa Uhakiki'}
                                                        </Button>
                                                    </form>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {!auth?.user?.is_merchant && (
                                    <div className="p-8 rounded-2xl border border-dashed border-brand-200 bg-brand-50/10 flex flex-col items-center text-center space-y-4">
                                        <h2 className="text-xl font-bold text-slate-900">Anzisha Biashara Yako</h2>
                                        <p className="text-slate-600 font-medium text-sm max-w-sm">Anza kuuza bidhaa, huduma au maudhui leo na Takeer Instant Checkout.</p>
                                        <Link href="/merchant/register" className="h-11 px-6 rounded-xl bg-brand-600 text-white font-bold text-sm flex items-center justify-center hover:bg-brand-700 transition-all active:scale-95">
                                            Jiunge Sasa <ChevronRight className="ml-1 h-4 w-4" />
                                        </Link>
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
                                        <span className="font-bold text-slate-900 text-base">Wasifu na Usalama</span>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">Profile & Security</p>
                                    </div>
                                </div>
                                {isSecurityOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                            </button>

                            <AnimatePresence>
                                {isSecurityOpen && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-50 overflow-hidden">
                                        <div className="p-6 space-y-4">
                                            <DetailRow label="Namba ya Simu" value={auth?.user?.phone_number ? `${auth.user.phone_number.slice(0, 4)} ••• ••• ${auth.user.phone_number.slice(-3)}` : '+255 ••• ••• ***'} />
                                            <DetailRow label="Barua Pepe" value={maskEmail(auth?.user?.email) || 'Hujajaza'} />
                                            <DetailRow label="Jina la Mtumiaji" value={`@${activeMerchant?.username || 'user'}`} />
                                            <div className="flex items-center justify-between py-3">
                                                <span className="text-slate-500 font-medium text-sm">Hali ya Akaunti</span>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100">
                                                    <div className={`h-1.5 w-1.5 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                    <span className={`font-bold text-[10px] uppercase ${isVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {isVerified ? 'Verified' : 'Verification Required'}
                                                    </span>
                                                </div>
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

function StatCard({ title, value, icon: Icon, color, bgColor, borderColor, trend, onClick }) {
    const Comp = onClick ? 'button' : 'div';
    return (
        <Comp
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn(
                `p-5 rounded-2xl border ${borderColor} ${bgColor} space-y-3 shadow-sm text-left w-full`,
                onClick && 'transition-transform active:scale-[0.99] cursor-pointer'
            )}
        >
            <div className="flex items-center justify-between">
                <div className={`h-9 w-9 rounded-lg bg-white border ${borderColor} flex items-center justify-center ${color}`}>
                    <Icon className="h-4.5 w-4.5" />
                </div>
                {trend !== undefined && (
                    <div className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                        trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                        {trend >= 0 ? '+' : ''}{trend}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{title}</p>
                <p className={cn("text-xl font-bold mt-0.5 truncate", color === 'text-slate-900' ? "text-slate-900" : color)}>{value}</p>
            </div>
        </Comp>
    );
}

function ActionBtn({ icon: Icon, label, href, color, textColor, borderColor = "" }) {
    return (
        <Link href={href} className={cn("flex flex-col items-center justify-center gap-2.5 p-5 rounded-2xl border transition-all active:scale-[0.98] group shadow-sm", color, textColor, borderColor || "border-transparent")}>
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110", textColor === 'text-white' ? "bg-white/10" : "bg-white border " + borderColor)}>
                <Icon className="h-5 w-5" />
            </div>
            <span className="font-bold text-[10px] uppercase tracking-wide">{label}</span>
        </Link>
    );
}

function BreakdownRow({ label, count, color, total }) {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>{label}</span>
                <span className="text-slate-900">{count}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
}

function MiniMetric({ label, value }) {
    return (
        <div className="rounded-xl border border-white bg-white/80 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-sm md:text-base font-black text-slate-900 truncate">{value}</p>
        </div>
    );
}

function PayoutMetric({ label, value, icon: Icon, tone = 'emerald' }) {
    const toneClasses = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
    }[tone] || 'bg-slate-50 text-slate-700 border-slate-100';

    return (
        <div className={`rounded-2xl border bg-white/80 p-3 ${toneClasses}`}>
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <p className="text-[10px] font-black uppercase tracking-wider">{label}</p>
            </div>
            <p className="mt-2 text-sm md:text-base font-black text-slate-900 truncate">{value}</p>
        </div>
    );
}

function MonetizationBucketRow({ bucket, total, formatMoney }) {
    const share = Number(bucket.share ?? (total > 0 ? (Number(bucket.revenue || 0) / total) * 100 : 0));

    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{bucket.label}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                        {Number(bucket.orders || 0).toLocaleString()} orders · {Number(bucket.units || 0).toLocaleString()} units · {share.toFixed(1)}%
                    </p>
                </div>
                <div className="text-right shrink-0">
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
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">{item.title}</p>
                    <p className="text-[11px] font-semibold text-slate-500 truncate">{item.bucket_label} · {Number(item.orders || 0).toLocaleString()} orders</p>
                </div>
                <p className="text-sm font-black text-brand-600 shrink-0">{formatMoney(item.revenue || 0)}</p>
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
    return (
        <div className="relative group">
            <input type="file" id={id} className="hidden" accept="image/*" onChange={onChange} />
            <label htmlFor={id} className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all ${preview ? 'border-brand-300 bg-brand-50/10' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'}`}>
                {preview ? (
                    <div className="relative w-full h-full p-1.5">
                        <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <Camera className="h-5 w-5 text-white" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-2">
                            <Camera className="h-4.5 w-4.5" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Pakia Picha</p>
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
