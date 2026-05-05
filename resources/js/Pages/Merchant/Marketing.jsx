import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import {
    BadgePercent,
    BarChart3,
    ChevronRight,
    Copy,
    ExternalLink,
    FileDown,
    Info,
    Megaphone,
    MessageSquareText,
    MousePointerClick,
    Plus,
    RadioTower,
    Save,
    Send,
    TrendingUp,
    Trash2,
    Users,
    Loader2,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const emptyCoupon = {
    id: null,
    code: '',
    name: '',
    description: '',
    discount_type: 'percent',
    discount_value: '',
    minimum_order_amount: '',
    maximum_discount_amount: '',
    applies_to_type: 'all',
    applies_to_id: '',
    usage_limit: '',
    usage_limit_per_customer: '',
    starts_at: '',
    ends_at: '',
    status: 'active',
};

const emptySmsForm = {
    name: '',
    audience_type: 'all_customers',
    audience_ref_id: '',
    message: '',
    send_mode: 'draft',
    scheduled_at: '',
};

const emptyAbandonedAutomation = {
    is_enabled: false,
    delay_minutes: 60,
    max_age_days: 7,
    coupon_code: '',
    message: 'Habari! Uliacha checkout bila kukamilisha. Rudi Takeer ukamilishe order yako.',
};

const emptyReferralForm = {
    id: null,
    code: '',
    label: '',
    target_type: 'storefront',
    target_id: '',
    reward_type: 'none',
    reward_value: '',
    starts_at: '',
    ends_at: '',
    status: 'active',
};

const emptyGroupSaleForm = {
    id: null,
    product_id: '',
    title: '',
    description: '',
    campaign_price: '',
    regular_price: '',
    goal_quantity: '',
    starts_at: '',
    ends_at: '',
    status: 'draft',
    allow_sms_updates: true,
};

const toolCards = [
    {
        key: 'coupons',
        title: 'Promo codes',
        description: 'Create launch discounts, limited drops, and creator-specific sales codes.',
        icon: BadgePercent,
        status: 'Live',
    },
    {
        key: 'sms',
        title: 'SMS campaigns',
        description: 'Sell SMS packages to merchants so they can notify customers about launches and updates.',
        icon: MessageSquareText,
        status: 'Live',
    },
    {
        key: 'group-sales',
        title: 'Group-sale broadcasts',
        description: 'Drive subscribers into limited group buys, pre-orders, and member-backed drops.',
        icon: Users,
        status: 'Live',
    },
    {
        key: 'referrals',
        title: 'Referral links',
        description: 'Track creator, affiliate, and customer referrals back to products and storefronts.',
        icon: RadioTower,
        status: 'Live',
    },
];

const sectionMeta = {
    overview: {
        title: 'Marketing',
        description: 'Choose a focused growth tool for promotions, customer messages, referrals, group sales, or analytics.',
    },
    coupons: {
        title: 'Promo Codes',
        description: 'Create and manage discount codes for launches, campaigns, and customer offers.',
    },
    sms: {
        title: 'SMS Campaigns',
        description: 'Buy credits, send customer broadcasts, and manage checkout recovery messages.',
    },
    referrals: {
        title: 'Referral Links',
        description: 'Create trackable links for social bio traffic, affiliates, and creator partners.',
    },
    'group-sales': {
        title: 'Group Sales',
        description: 'Validate demand with reservation campaigns before stocking or releasing an offer.',
    },
    analytics: {
        title: 'Marketing Analytics',
        description: 'Review campaign performance and export finance, product, campaign, and order reports.',
    },
};

const sectionTabs = [
    ['overview', 'Overview'],
    ['coupons', 'Promo codes'],
    ['sms', 'SMS'],
    ['referrals', 'Referrals'],
    ['group-sales', 'Group sales'],
    ['analytics', 'Analytics'],
];

export default function MerchantMarketing({ merchantUsername = '', merchantName = '', section = 'overview' }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [summary, setSummary] = useState({});
    const [analytics, setAnalytics] = useState({});
    const [coupons, setCoupons] = useState([]);
    const [smsPackages, setSmsPackages] = useState([]);
    const [smsBalance, setSmsBalance] = useState({ credits: 0, lifetime_purchased: 0, lifetime_used: 0 });
    const [smsCampaigns, setSmsCampaigns] = useState([]);
    const [abandonedAutomation, setAbandonedAutomation] = useState(emptyAbandonedAutomation);
    const [smsAudiences, setSmsAudiences] = useState([]);
    const [smsTargets, setSmsTargets] = useState({ products: [], subscription_plans: [] });
    const [marketingTargets, setMarketingTargets] = useState({ products: [], bundles: [], subscription_plans: [], posts: [], content_items: [] });
    const [referralLinks, setReferralLinks] = useState([]);
    const [referralForm, setReferralForm] = useState(emptyReferralForm);
    const [groupSales, setGroupSales] = useState([]);
    const [groupSaleForm, setGroupSaleForm] = useState(emptyGroupSaleForm);
    const [smsForm, setSmsForm] = useState(emptySmsForm);
    const [smsEstimate, setSmsEstimate] = useState(null);
    const [smsBusy, setSmsBusy] = useState(false);
    const [form, setForm] = useState(emptyCoupon);

    useEffect(() => {
        loadMarketing();
    }, [merchantUsername]);

    const activeCoupons = useMemo(() => coupons.filter((coupon) => coupon.status === 'active'), [coupons]);

    async function loadMarketing() {
        setLoading(true);
        try {
            const res = await axios.get(`/merchant/${merchantUsername}/marketing/api`);
            setSummary(res.data?.summary || {});
            setAnalytics(res.data?.analytics || {});
            setCoupons(res.data?.coupons || []);
            setSmsBalance(res.data?.sms_balance || { credits: 0, lifetime_purchased: 0, lifetime_used: 0 });
            setAbandonedAutomation({ ...emptyAbandonedAutomation, ...(res.data?.abandoned_checkout_automation || {}) });
            setSmsCampaigns(res.data?.sms_campaigns || []);
            setSmsAudiences(res.data?.sms_audiences || []);
            setSmsTargets(res.data?.sms_targets || { products: [], subscription_plans: [] });
            setMarketingTargets(res.data?.marketing_targets || { products: [], bundles: [], subscription_plans: [], posts: [], content_items: [] });
            setSmsPackages(res.data?.sms_packages || []);
            setReferralLinks(res.data?.referral_links || []);
            setGroupSales(res.data?.group_sales || []);
        } catch (error) {
            toast.error('Imeshindwa kupakia marketing tools.');
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setForm(emptyCoupon);
    }

    function resetReferralForm() {
        setReferralForm(emptyReferralForm);
    }

    function resetGroupSaleForm() {
        setGroupSaleForm(emptyGroupSaleForm);
    }

    function editCoupon(coupon) {
        setForm({
            ...emptyCoupon,
            ...coupon,
            discount_value: coupon.discount_value ?? '',
            minimum_order_amount: coupon.minimum_order_amount ?? '',
            maximum_discount_amount: coupon.maximum_discount_amount ?? '',
            applies_to_id: coupon.applies_to_id ?? '',
            usage_limit: coupon.usage_limit ?? '',
            usage_limit_per_customer: coupon.usage_limit_per_customer ?? '',
            starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 16) : '',
            ends_at: coupon.ends_at ? coupon.ends_at.slice(0, 16) : '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function saveCoupon() {
        setSaving(true);
        try {
            const payload = {
                ...form,
                code: String(form.code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                discount_value: Number(form.discount_value || 0),
                minimum_order_amount: form.minimum_order_amount === '' ? null : Number(form.minimum_order_amount),
                maximum_discount_amount: form.maximum_discount_amount === '' ? null : Number(form.maximum_discount_amount),
                applies_to_id: form.applies_to_type === 'all' || form.applies_to_id === '' ? null : Number(form.applies_to_id),
                usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
                usage_limit_per_customer: form.usage_limit_per_customer === '' ? null : Number(form.usage_limit_per_customer),
                starts_at: form.starts_at || null,
                ends_at: form.ends_at || null,
            };

            if (!payload.code || payload.discount_value <= 0) {
                toast.error('Weka code na discount sahihi.');
                return;
            }

            if (form.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/coupons/${form.id}/api`, payload);
                toast.success('Coupon imesasishwa.');
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/coupons/api`, payload);
                toast.success('Coupon imeundwa.');
            }

            resetForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi coupon.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteCoupon(couponId) {
        if (!window.confirm('Futa coupon hii?')) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/coupons/${couponId}/api`);
            setCoupons((current) => current.filter((coupon) => coupon.id !== couponId));
            toast.success('Coupon imefutwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kufuta coupon.');
        }
    }

    async function copyCode(code) {
        await navigator.clipboard?.writeText(code);
        toast.success('Coupon code copied.');
    }

    async function copyText(text, message = 'Copied.') {
        await navigator.clipboard?.writeText(text);
        toast.success(message);
    }

    function insertCouponIntoSms(coupon) {
        const message = smsForm.message.trim();
        const snippet = `Use code ${coupon.code} kupata ${discountLabel(coupon)}.`;
        setSmsForm((current) => ({
            ...current,
            message: message ? `${message}\n${snippet}` : snippet,
        }));
        toast.success('Coupon imeongezwa kwenye SMS.');
    }

    async function buySmsPackage(packageId) {
        setSmsBusy(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/sms/packages/api`, { package_id: packageId });
            setSmsBalance(res.data?.sms_balance || smsBalance);
            setSummary((current) => ({ ...current, sms_credits: res.data?.sms_balance?.credits ?? current.sms_credits }));
            toast.success('SMS credits zimeongezwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuongeza SMS credits.');
        } finally {
            setSmsBusy(false);
        }
    }

    async function estimateSmsCampaign() {
        setSmsBusy(true);
        try {
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/sms/estimate/api`, {
                audience_type: smsForm.audience_type,
                audience_ref_id: smsForm.audience_ref_id ? Number(smsForm.audience_ref_id) : null,
                message: smsForm.message,
            });
            setSmsEstimate(res.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kukadiria audience.');
        } finally {
            setSmsBusy(false);
        }
    }

    async function saveSmsCampaign(sendMode = smsForm.send_mode) {
        setSmsBusy(true);
        try {
            const payload = {
                ...smsForm,
                send_mode: sendMode,
                audience_ref_id: smsForm.audience_ref_id ? Number(smsForm.audience_ref_id) : null,
                scheduled_at: sendMode === 'schedule' ? smsForm.scheduled_at : null,
            };
            const res = await axios.post(`/merchant/${merchantUsername}/marketing/sms/campaigns/api`, payload);
            setSmsCampaigns((current) => [res.data?.campaign, ...current].filter(Boolean));
            setSmsBalance(res.data?.sms_balance || smsBalance);
            setSmsForm(emptySmsForm);
            setSmsEstimate(null);
            toast.success(res.data?.message || 'SMS campaign saved.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi SMS campaign.');
        } finally {
            setSmsBusy(false);
        }
    }

    async function saveAbandonedAutomation() {
        setSmsBusy(true);
        try {
            const payload = {
                ...abandonedAutomation,
                delay_minutes: Number(abandonedAutomation.delay_minutes || 60),
                max_age_days: Number(abandonedAutomation.max_age_days || 7),
                coupon_code: abandonedAutomation.coupon_code || null,
            };
            const res = await axios.put(`/merchant/${merchantUsername}/marketing/abandoned-checkout-automation/api`, payload);
            setAbandonedAutomation({ ...emptyAbandonedAutomation, ...(res.data?.automation || {}) });
            toast.success('Abandoned checkout automation saved.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi automation.');
        } finally {
            setSmsBusy(false);
        }
    }

    function editReferral(link) {
        setReferralForm({
            ...emptyReferralForm,
            ...link,
            target_id: link.target_id ?? '',
            reward_value: link.reward_value ?? '',
            starts_at: link.starts_at ? link.starts_at.slice(0, 16) : '',
            ends_at: link.ends_at ? link.ends_at.slice(0, 16) : '',
        });
    }

    async function saveReferralLink() {
        setSaving(true);
        try {
            const payload = {
                ...referralForm,
                code: String(referralForm.code || '').toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                target_id: referralForm.target_type === 'storefront' || referralForm.target_id === '' ? null : Number(referralForm.target_id),
                reward_value: referralForm.reward_type === 'none' || referralForm.reward_value === '' ? 0 : Number(referralForm.reward_value),
                starts_at: referralForm.starts_at || null,
                ends_at: referralForm.ends_at || null,
            };

            if (referralForm.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/referrals/${referralForm.id}/api`, payload);
                toast.success('Referral link imesasishwa.');
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/referrals/api`, payload);
                toast.success('Referral link imeundwa.');
            }

            resetReferralForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi referral link.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteReferralLink(linkId) {
        if (!window.confirm('Futa referral link hii?')) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/referrals/${linkId}/api`);
            setReferralLinks((current) => current.filter((link) => link.id !== linkId));
            toast.success('Referral link imefutwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kufuta referral link.');
        }
    }

    async function settleReferralCommissions(link, status = 'paid') {
        const amount = Number(link.commission_pending || 0);
        if (amount <= 0) {
            toast.info('No pending referral commission for this link.');
            return;
        }

        const label = status === 'paid' ? 'mark as paid' : 'void';
        if (!window.confirm(`${label} TZS ${amount.toLocaleString()} for ${link.label || link.code}?`)) return;

        setSaving(true);
        try {
            await axios.post(`/merchant/${merchantUsername}/marketing/referrals/${link.id}/commissions/api`, { status });
            toast.success(status === 'paid' ? 'Referral commission marked as paid.' : 'Referral commission voided.');
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kusasisha commission.');
        } finally {
            setSaving(false);
        }
    }

    function editGroupSale(campaign) {
        setGroupSaleForm({
            ...emptyGroupSaleForm,
            ...campaign,
            product_id: campaign.product_id ?? '',
            campaign_price: campaign.campaign_price ?? '',
            regular_price: campaign.regular_price ?? '',
            goal_quantity: campaign.goal_quantity ?? '',
            starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
            ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
        });
    }

    async function saveGroupSale() {
        setSaving(true);
        try {
            const payload = {
                ...groupSaleForm,
                product_id: Number(groupSaleForm.product_id),
                campaign_price: Number(groupSaleForm.campaign_price || 0),
                regular_price: groupSaleForm.regular_price === '' ? null : Number(groupSaleForm.regular_price),
                goal_quantity: Number(groupSaleForm.goal_quantity || 0),
                starts_at: groupSaleForm.starts_at || null,
                ends_at: groupSaleForm.ends_at || null,
                allow_sms_updates: Boolean(groupSaleForm.allow_sms_updates),
            };

            if (!payload.product_id || !payload.title || payload.campaign_price < 0 || payload.goal_quantity < 2 || !payload.ends_at) {
                toast.error('Choose product, title, price, target quantity, and deadline.');
                return;
            }

            if (groupSaleForm.id) {
                await axios.put(`/merchant/${merchantUsername}/marketing/group-sales/${groupSaleForm.id}/api`, payload);
                toast.success('Group-sale campaign imesasishwa.');
            } else {
                await axios.post(`/merchant/${merchantUsername}/marketing/group-sales/api`, payload);
                toast.success('Group-sale campaign imeundwa.');
            }

            resetGroupSaleForm();
            await loadMarketing();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kuhifadhi group-sale campaign.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteGroupSale(campaignId) {
        if (!window.confirm('Futa group-sale campaign hii?')) return;
        try {
            await axios.delete(`/merchant/${merchantUsername}/marketing/group-sales/${campaignId}/api`);
            setGroupSales((current) => current.filter((campaign) => campaign.id !== campaignId));
            toast.success('Group-sale campaign imefutwa.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindwa kufuta group-sale campaign.');
        }
    }

    const smsCharacters = smsForm.message.length;
    const smsSegments = Math.max(1, Math.ceil(smsCharacters / 160));
    const selectedAudience = smsAudiences.find((audience) => audience.type === smsForm.audience_type);
    const targetOptions = smsForm.audience_type === 'product_buyers'
        ? smsTargets.products || []
        : smsForm.audience_type === 'subscription_members'
            ? smsTargets.subscription_plans || []
            : [];
    const referralTargetOptions = {
        product: marketingTargets.products || [],
        bundle: marketingTargets.bundles || [],
        subscription_plan: marketingTargets.subscription_plans || [],
        post: marketingTargets.posts || [],
        content_item: marketingTargets.content_items || [],
    }[referralForm.target_type] || [];
    const productTargetOptions = marketingTargets.products || [];
    const activeSection = sectionMeta[section] ? section : 'overview';
    const activeMeta = sectionMeta[activeSection];
    const marketingBaseUrl = `/merchant/${merchantUsername}/marketing`;

    if (loading) {
        return (
            <AppLayout>
                <Head title="Marketing | Takeer" />
                <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                    <p className="text-sm text-muted-foreground">Inapakia marketing tools...</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title={`${activeMeta.title} | Takeer`} />
            <div className="max-w-6xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">{activeMeta.title}</h1>
                        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                            {activeMeta.description} {merchantName || merchantUsername ? `For ${merchantName || merchantUsername}.` : ''}
                        </p>
                    </div>
                    <Button className={`rounded-2xl font-black ${activeSection === 'coupons' ? '' : 'hidden'}`} onClick={resetForm}>
                        <Plus className="mr-2 h-4 w-4" />
                        New coupon
                    </Button>
                </div>

                <MarketingSectionNav baseUrl={marketingBaseUrl} activeSection={activeSection} />

                <div className={`${activeSection === 'overview' ? 'grid' : 'hidden'} gap-3 grid-cols-2 md:grid-cols-4`}>
                    <Metric label="Active coupons" value={summary.active_coupons ?? activeCoupons.length} />
                    <Metric label="Redemptions" value={summary.coupon_redemptions ?? 0} />
                    <Metric label="Referral sales" value={summary.referral_conversions ?? 0} />
                    <Metric label="SMS credits" value={Number(summary.sms_credits || 0).toLocaleString()} />
                </div>

                <div className={`${activeSection === 'overview' ? 'grid' : 'hidden'} gap-4 md:grid-cols-4`}>
                    {toolCards.map(({ key, title, description, icon: Icon, status }) => (
                        <Link key={title} href={`${marketingBaseUrl}/${key}`} className="block">
                            <Card className="h-full rounded-[24px] border-brand-100/70 transition hover:border-brand-300 hover:shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between">
                                        <div className="h-11 w-11 rounded-2xl bg-brand-50 flex items-center justify-center">
                                            <Icon className="h-5 w-5 text-brand-600" />
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                            {status}
                                        </span>
                                    </div>
                                    <p className="mt-4 font-black">{title}</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {activeSection === 'analytics' && <CreatorAnalytics analytics={analytics} />}

                {activeSection === 'analytics' && <AnalyticsExports merchantUsername={merchantUsername} />}

                <div className={`${activeSection === 'overview' || activeSection === 'analytics' ? 'hidden' : 'grid'} gap-5 ${activeSection === 'coupons' ? 'lg:grid-cols-[0.9fr_1.1fr]' : 'lg:grid-cols-1'} items-start`}>
                    {activeSection === 'coupons' && <Card className="rounded-[28px] border-brand-100/70">
                        <CardHeader>
                            <CardTitle className="text-base font-black uppercase tracking-wider">
                                {form.id ? 'Edit coupon' : 'Create coupon'}
                            </CardTitle>
                            <CardDescription>Start with promo codes. SMS and referrals will plug into this page later.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Code">
                                    <Input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="LAUNCH25" className="h-12 rounded-xl font-black" />
                                </Field>
                                <Field label="Name">
                                    <Input value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Launch discount" className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <Field label="Description">
                                <Textarea value={form.description || ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Internal note for this campaign..." className="min-h-20 rounded-xl" />
                            </Field>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Discount type">
                                    <select value={form.discount_type} onChange={(e) => setForm((prev) => ({ ...prev, discount_type: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                        <option value="percent">Percent</option>
                                        <option value="fixed">Fixed amount</option>
                                    </select>
                                </Field>
                                <Field label={form.discount_type === 'percent' ? 'Discount %' : 'Discount amount'}>
                                    <Input type="number" min="0" value={form.discount_value} onChange={(e) => setForm((prev) => ({ ...prev, discount_value: e.target.value }))} placeholder={form.discount_type === 'percent' ? '25' : '5000'} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Applies to">
                                    <select value={form.applies_to_type} onChange={(e) => setForm((prev) => ({ ...prev, applies_to_type: e.target.value, applies_to_id: e.target.value === 'all' ? '' : prev.applies_to_id }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                        <option value="all">All offers</option>
                                        <option value="product">Product</option>
                                        <option value="bundle">Bundle</option>
                                        <option value="subscription_plan">Subscription plan</option>
                                        <option value="post">Premium post</option>
                                        <option value="content_item">Content item</option>
                                    </select>
                                </Field>
                                <Field label="Offer ID">
                                    <Input disabled={form.applies_to_type === 'all'} type="number" value={form.applies_to_id || ''} onChange={(e) => setForm((prev) => ({ ...prev, applies_to_id: e.target.value }))} placeholder={form.applies_to_type === 'all' ? 'Not needed' : 'ID'} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Minimum order" hint="Lowest cart total before this code can be used. Leave blank for no minimum.">
                                    <Input type="number" value={form.minimum_order_amount || ''} onChange={(e) => setForm((prev) => ({ ...prev, minimum_order_amount: e.target.value }))} placeholder="Optional" className="h-12 rounded-xl" />
                                </Field>
                                <Field label="Max discount" hint="Caps percent discounts so large orders do not discount too much. Leave blank for no cap.">
                                    <Input type="number" value={form.maximum_discount_amount || ''} onChange={(e) => setForm((prev) => ({ ...prev, maximum_discount_amount: e.target.value }))} placeholder="Optional" className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Total usage limit" hint="How many times this code can be used by all customers combined. Leave blank for unlimited.">
                                    <Input type="number" value={form.usage_limit || ''} onChange={(e) => setForm((prev) => ({ ...prev, usage_limit: e.target.value }))} placeholder="Optional" className="h-12 rounded-xl" />
                                </Field>
                                <Field label="Per customer limit" hint="How many times one customer can use this code. Usually 1 for launch offers.">
                                    <Input type="number" value={form.usage_limit_per_customer || ''} onChange={(e) => setForm((prev) => ({ ...prev, usage_limit_per_customer: e.target.value }))} placeholder="Optional" className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Starts at">
                                    <Input type="datetime-local" value={form.starts_at || ''} onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-12 rounded-xl" />
                                </Field>
                                <Field label="Ends at">
                                    <Input type="datetime-local" value={form.ends_at || ''} onChange={(e) => setForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-12 rounded-xl" />
                                </Field>
                            </div>

                            <Field label="Status">
                                <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="expired">Expired</option>
                                </select>
                            </Field>

                            <div className="flex gap-2">
                                <Button onClick={saveCoupon} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save coupon
                                </Button>
                                {form.id && (
                                    <Button variant="outline" onClick={resetForm} className="h-12 rounded-2xl font-black">
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>}

                    <div className="space-y-4">
                        {activeSection === 'coupons' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">Coupons</CardTitle>
                                <CardDescription>Codes creators can share in posts, storefront bios, SMS campaigns, or social media.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {coupons.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-8 text-center">
                                        <BadgePercent className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">No coupons yet</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Create your first launch or discount code.</p>
                                    </div>
                                ) : coupons.map((coupon) => (
                                    <div key={coupon.id} className="rounded-2xl border bg-card px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-lg tracking-wide">{coupon.code}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${coupon.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {coupon.status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm font-bold">{coupon.name || discountLabel(coupon)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {discountLabel(coupon)} · {coupon.applies_to_type === 'all' ? 'All offers' : `${coupon.applies_to_type} #${coupon.applies_to_id}`} · Used {coupon.times_used}
                                                    {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}
                                                </p>
                                                {coupon.campaign_url && (
                                                    <p className="mt-2 break-all text-xs font-semibold text-brand-700">{coupon.campaign_url}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyCode(coupon.code)}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                {coupon.campaign_url && (
                                                    <>
                                                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(coupon.campaign_url, 'Campaign page copied.')}>
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => window.open(coupon.campaign_url, '_blank', 'noopener,noreferrer')}>
                                                            Page
                                                        </Button>
                                                    </>
                                                )}
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => insertCouponIntoSms(coupon)}>
                                                    Use in SMS
                                                </Button>
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editCoupon(coupon)}>
                                                    Edit
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteCoupon(coupon.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'group-sales' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">Group-sale campaigns</CardTitle>
                                        <CardDescription>Validate demand before stocking: buyers reserve, campaign progresses, and you notify them when the target is reached.</CardDescription>
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                        Live
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <InlineStat label="Active campaigns" value={Number(summary.active_group_sales || 0).toLocaleString()} />
                                    <InlineStat label="Reservations" value={Number(summary.group_sale_reservations || 0).toLocaleString()} />
                                </div>

                                <div className="rounded-2xl border bg-white p-4 space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="Product" hint="Choose the physical or digital product this campaign is validating.">
                                            <select value={groupSaleForm.product_id || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, product_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="">Choose product...</option>
                                                {productTargetOptions.map((target) => (
                                                    <option key={target.id} value={target.id}>{target.label} · {target.meta}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Campaign title">
                                            <Input value={groupSaleForm.title || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Handbag group sale" className="h-12 rounded-xl" />
                                        </Field>
                                    </div>

                                    <Field label="Description" hint="Short public pitch shown on the group-sale page.">
                                        <Textarea value={groupSaleForm.description || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Join before the deadline. If enough people reserve, we release the offer..." className="min-h-20 rounded-xl" />
                                    </Field>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <Field label="Group price">
                                            <Input type="number" min="0" value={groupSaleForm.campaign_price || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, campaign_price: e.target.value }))} placeholder="25000" className="h-12 rounded-xl" />
                                            {productTargetOptions.find((target) => Number(target.id) === Number(groupSaleForm.product_id))?.unit_label && (
                                                <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                                                    Price is per {productTargetOptions.find((target) => Number(target.id) === Number(groupSaleForm.product_id))?.unit_label}.
                                                </p>
                                            )}
                                        </Field>
                                        <Field label="Regular price" hint="Optional comparison price.">
                                            <Input type="number" min="0" value={groupSaleForm.regular_price || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, regular_price: e.target.value }))} placeholder="35000" className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Target buyers" hint="Campaign succeeds when reservations reach this number.">
                                            <Input type="number" min="2" value={groupSaleForm.goal_quantity || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, goal_quantity: e.target.value }))} placeholder="100" className="h-12 rounded-xl" />
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <Field label="Starts at">
                                            <Input type="datetime-local" value={groupSaleForm.starts_at || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Deadline">
                                            <Input type="datetime-local" value={groupSaleForm.ends_at || ''} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Status">
                                            <select value={groupSaleForm.status} onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="draft">Draft</option>
                                                <option value="active">Active</option>
                                                <option value="successful">Successful</option>
                                                <option value="expired">Expired</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </Field>
                                    </div>

                                    <label className="flex items-center justify-between gap-3 rounded-2xl border bg-slate-50 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-black">Allow SMS update opt-in</p>
                                            <p className="text-xs text-muted-foreground">Joiners can opt into progress and deadline messages.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(groupSaleForm.allow_sms_updates)}
                                            onChange={(e) => setGroupSaleForm((prev) => ({ ...prev, allow_sms_updates: e.target.checked }))}
                                            className="h-5 w-5"
                                        />
                                    </label>

                                    <div className="flex gap-2">
                                        <Button onClick={saveGroupSale} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                                            Save group sale
                                        </Button>
                                        {groupSaleForm.id && (
                                            <Button variant="outline" onClick={resetGroupSaleForm} className="h-12 rounded-2xl font-black">
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {groupSales.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                                        <Users className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">No group-sale campaigns yet</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Create a demand campaign for a product launch or pre-order.</p>
                                    </div>
                                ) : groupSales.map((campaign) => (
                                    <div key={campaign.id} className="rounded-2xl border bg-white px-4 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black text-lg">{campaign.title}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${campaign.status === 'active' ? 'bg-emerald-50 text-emerald-700' : campaign.status === 'successful' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {campaign.status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">{campaign.product_title || 'Product'} · TZS {Number(campaign.campaign_price || 0).toLocaleString()}{campaign.unit_label ? ` / ${campaign.unit_label}` : ''} · deadline {campaign.ends_at ? new Date(campaign.ends_at).toLocaleString() : '-'}</p>
                                                <div className="mt-3">
                                                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                        <span>{Number(campaign.reserved_quantity || 0).toLocaleString()} / {Number(campaign.goal_quantity || 0).toLocaleString()} reserved</span>
                                                        <span>{campaign.progress_percent || 0}%</span>
                                                    </div>
                                                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                                                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, Number(campaign.progress_percent || 0))}%` }} />
                                                    </div>
                                                </div>
                                                <p className="mt-2 break-all text-xs font-semibold text-brand-700">{campaign.url}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(campaign.url, 'Group-sale link copied.')}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => window.open(campaign.url, '_blank', 'noopener,noreferrer')}>
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editGroupSale(campaign)}>
                                                    Edit
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteGroupSale(campaign.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'referrals' && <Card className="rounded-[28px] border-dashed border-brand-200 bg-brand-50/30">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">Referral links</CardTitle>
                                        <CardDescription>Share trackable links on Instagram, TikTok, WhatsApp, affiliates, or creator partners.</CardDescription>
                                    </div>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                        Live
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <InlineStat label="Clicks" value={Number(summary.referral_clicks || 0).toLocaleString()} />
                                    <InlineStat label="Conversions" value={Number(summary.referral_conversions || 0).toLocaleString()} />
                                    <InlineStat label="Revenue" value={`TZS ${Number(summary.referral_revenue || 0).toLocaleString()}`} />
                                    <InlineStat label="Pending commissions" value={`TZS ${Number(summary.referral_commission_pending || 0).toLocaleString()}`} />
                                    <InlineStat label="Paid commissions" value={`TZS ${Number(summary.referral_commission_paid || 0).toLocaleString()}`} />
                                </div>

                                <div className="rounded-2xl border bg-white p-4 space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="Label" hint="Internal name, for example Zuchu IG bio or Partner A.">
                                            <Input value={referralForm.label || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Instagram bio link" className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Code" hint="Optional. Leave blank and Takeer will generate one.">
                                            <Input value={referralForm.code || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="PEPYA-IG" className="h-12 rounded-xl font-black" />
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="Destination" hint="Storefront works best for social bio links. Pick an offer for a focused campaign.">
                                            <select value={referralForm.target_type} onChange={(e) => setReferralForm((prev) => ({ ...prev, target_type: e.target.value, target_id: '' }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="storefront">Storefront</option>
                                                <option value="product">Product</option>
                                                <option value="bundle">Bundle / Course</option>
                                                <option value="subscription_plan">Membership plan</option>
                                                <option value="post">Premium post</option>
                                                <option value="content_item">Content item</option>
                                            </select>
                                        </Field>
                                        <Field label="Target offer" hint={referralForm.target_type === 'storefront' ? 'Not needed for storefront links.' : 'Choose the exact page this link opens.'}>
                                            {referralForm.target_type === 'storefront' ? (
                                                <Input disabled value="Storefront home" className="h-12 rounded-xl text-muted-foreground" />
                                            ) : (
                                                <select value={referralForm.target_id || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, target_id: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                    <option value="">Choose target...</option>
                                                    {referralTargetOptions.map((target) => (
                                                        <option key={target.id} value={target.id}>{target.label} · {target.meta}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-3">
                                        <Field label="Reward type" hint="Optional affiliate commission calculated on each referred sale. Tracking works even with no reward.">
                                            <select value={referralForm.reward_type} onChange={(e) => setReferralForm((prev) => ({ ...prev, reward_type: e.target.value, reward_value: e.target.value === 'none' ? '' : prev.reward_value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="none">No reward</option>
                                                <option value="percent">Percent</option>
                                                <option value="fixed">Fixed amount</option>
                                            </select>
                                        </Field>
                                        <Field label={referralForm.reward_type === 'percent' ? 'Reward %' : 'Reward amount'} hint="Percent is taken from the paid order total. Fixed amount is capped at the order total.">
                                            <Input disabled={referralForm.reward_type === 'none'} type="number" min="0" value={referralForm.reward_value || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, reward_value: e.target.value }))} placeholder={referralForm.reward_type === 'none' ? 'Not needed' : '10'} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Status">
                                            <select value={referralForm.status} onChange={(e) => setReferralForm((prev) => ({ ...prev, status: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                                <option value="active">Active</option>
                                                <option value="paused">Paused</option>
                                                <option value="expired">Expired</option>
                                            </select>
                                        </Field>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <Field label="Starts at">
                                            <Input type="datetime-local" value={referralForm.starts_at || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, starts_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                        <Field label="Ends at">
                                            <Input type="datetime-local" value={referralForm.ends_at || ''} onChange={(e) => setReferralForm((prev) => ({ ...prev, ends_at: e.target.value }))} className="h-12 rounded-xl" />
                                        </Field>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button onClick={saveReferralLink} disabled={saving} className="h-12 rounded-2xl font-black flex-1">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RadioTower className="mr-2 h-4 w-4" />}
                                            Save referral link
                                        </Button>
                                        {referralForm.id && (
                                            <Button variant="outline" onClick={resetReferralForm} className="h-12 rounded-2xl font-black">
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {referralLinks.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                                        <RadioTower className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">No referral links yet</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Create one for an Instagram bio, affiliate, or customer ambassador.</p>
                                    </div>
                                ) : referralLinks.map((link) => (
                                    <div key={link.id} className="rounded-2xl border bg-white px-4 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black text-lg">{link.label || link.code}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${link.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {link.status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 break-all text-xs font-semibold text-brand-700">{link.url}</p>
                                                {link.campaign_url && (
                                                    <p className="mt-1 break-all text-xs font-semibold text-emerald-700">Landing: {link.campaign_url}</p>
                                                )}
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Opens {targetLabel(link)} · {Number(link.clicks_count || 0).toLocaleString()} clicks · {Number(link.conversions_count || 0).toLocaleString()} sales · TZS {Number(link.revenue_amount || 0).toLocaleString()}
                                                </p>
                                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                    <MiniMoney label="Pending" value={link.commission_pending} tone="amber" />
                                                    <MiniMoney label="Paid" value={link.commission_paid} tone="emerald" />
                                                    <MiniMoney label="Void" value={link.commission_void} tone="slate" />
                                                </div>
                                                {link.commission_orders?.length > 0 && (
                                                    <div className="mt-3 rounded-xl border bg-slate-50/80 p-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent referred orders</p>
                                                        <div className="mt-2 space-y-1.5">
                                                            {link.commission_orders.slice(0, 3).map((order) => (
                                                                <div key={order.id} className="flex items-center justify-between gap-3 text-xs">
                                                                    <span className="min-w-0 truncate font-semibold">
                                                                        #{order.public_id || order.id} · {order.buyer_name || 'Buyer'}
                                                                    </span>
                                                                    <span className="shrink-0 font-black">
                                                                        TZS {Number(order.commission_amount || 0).toLocaleString()} · {order.commission_status || 'tracked'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1">
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => copyText(link.url, 'Referral link copied.')}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                {link.campaign_url && (
                                                    <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => copyText(link.campaign_url, 'Campaign page copied.')}>
                                                        Landing
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}>
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <Button variant="outline" className="h-9 rounded-xl text-xs font-black" onClick={() => editReferral(link)}>
                                                    Edit
                                                </Button>
                                                {Number(link.commission_pending || 0) > 0 && (
                                                    <>
                                                        <Button variant="outline" disabled={saving} className="h-9 rounded-xl text-xs font-black text-emerald-700" onClick={() => settleReferralCommissions(link, 'paid')}>
                                                            Mark paid
                                                        </Button>
                                                        <Button variant="outline" disabled={saving} className="h-9 rounded-xl text-xs font-black text-amber-700" onClick={() => settleReferralCommissions(link, 'void')}>
                                                            Void
                                                        </Button>
                                                    </>
                                                )}
                                                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600" onClick={() => deleteReferralLink(link.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-dashed border-brand-200 bg-brand-50/30">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">SMS packages preview</CardTitle>
                                <CardDescription>Buy SMS credits for customer broadcasts, launch alerts, and group-sale updates.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-3">
                                {smsPackages.map((pack) => (
                                    <div key={pack.id} className="rounded-2xl border bg-white p-4">
                                        <p className="font-black">{pack.name}</p>
                                        <p className="mt-1 text-2xl font-black text-brand-600">{Number(pack.credits).toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">SMS credits</p>
                                        <p className="mt-3 text-sm font-black">TZS {Number(pack.price).toLocaleString()}</p>
                                        <Button
                                            variant="outline"
                                            disabled={smsBusy}
                                            onClick={() => buySmsPackage(pack.id)}
                                            className="mt-3 h-9 w-full rounded-xl text-xs font-black"
                                        >
                                            Add credits
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-emerald-100 bg-emerald-50/25">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">Abandoned checkout recovery</CardTitle>
                                        <CardDescription>Automatically send one recovery SMS after a buyer opens checkout but does not complete.</CardDescription>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${abandonedAutomation.is_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {abandonedAutomation.is_enabled ? 'Active' : 'Off'}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <label className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3">
                                    <div>
                                        <p className="text-sm font-black">Enable recovery automation</p>
                                        <p className="text-xs text-muted-foreground">Runs every 15 minutes and uses SMS credits. Each abandoned checkout event is messaged once.</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(abandonedAutomation.is_enabled)}
                                        onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, is_enabled: e.target.checked }))}
                                        className="h-5 w-5"
                                    />
                                </label>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <Field label="Send after" hint="Minutes after checkout starts. Minimum 30.">
                                        <Input type="number" min="30" max="10080" value={abandonedAutomation.delay_minutes || 60} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, delay_minutes: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Lookback days" hint="How far back eligible abandoned checkouts are considered.">
                                        <Input type="number" min="1" max="30" value={abandonedAutomation.max_age_days || 7} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, max_age_days: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                    <Field label="Coupon code" hint="Optional. Must be one of this merchant's coupons.">
                                        <Input value={abandonedAutomation.coupon_code || ''} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, coupon_code: e.target.value.toUpperCase() }))} placeholder="Optional" className="h-12 rounded-xl font-black" />
                                    </Field>
                                </div>

                                <Field label="Recovery message" hint="Keep it short. Coupon code is appended automatically if not already included.">
                                    <Textarea value={abandonedAutomation.message || ''} onChange={(e) => setAbandonedAutomation((prev) => ({ ...prev, message: e.target.value }))} className="min-h-24 rounded-xl" maxLength={640} />
                                </Field>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        Sent recoveries: {Number(abandonedAutomation.sent_count || 0).toLocaleString()}
                                        {abandonedAutomation.last_run_at ? ` · last run ${new Date(abandonedAutomation.last_run_at).toLocaleString()}` : ''}
                                    </p>
                                    <Button disabled={smsBusy} onClick={saveAbandonedAutomation} className="h-12 rounded-2xl font-black">
                                        {smsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save automation
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base font-black uppercase tracking-wider">SMS campaign</CardTitle>
                                        <CardDescription>Provider-ready workflow for customer broadcasts and launch alerts.</CardDescription>
                                    </div>
                                    <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                        Simulated
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex gap-3">
                                    <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-black text-amber-900">SMS consent and provider status</p>
                                        <p className="mt-1 text-xs leading-5 text-amber-800">
                                            Send only to customers who have a relationship with this business or opted into updates. Real provider sending is not connected yet, so Send now and scheduled sends record simulated delivery logs.
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border bg-brand-50/50 p-4 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-600">Available SMS credits</p>
                                        <p className="text-3xl font-black">{Number(smsBalance.credits || 0).toLocaleString()}</p>
                                    </div>
                                    <MessageSquareText className="h-8 w-8 text-brand-600" />
                                </div>

                                <Field label="Campaign name" hint="Internal name, for example New handbag drop or Webinar reminder.">
                                    <Input value={smsForm.name} onChange={(e) => setSmsForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="New product launch" className="h-12 rounded-xl" />
                                </Field>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Audience" hint={selectedAudience?.requires_ref ? 'Choose the exact product or subscription plan on the right.' : 'Choose who should receive this SMS.'}>
                                        <select value={smsForm.audience_type} onChange={(e) => setSmsForm((prev) => ({ ...prev, audience_type: e.target.value, audience_ref_id: '' }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            {smsAudiences.map((audience) => (
                                                <option key={audience.type} value={audience.type}>
                                                    {audience.label}{audience.count !== null && audience.count !== undefined ? ` (${audience.count})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Target offer" hint={selectedAudience?.requires_ref ? 'Pick the exact product or plan whose customers should receive this SMS.' : 'Only needed for product buyers or one subscription plan.'}>
                                        {selectedAudience?.requires_ref ? (
                                            <select
                                                value={smsForm.audience_ref_id}
                                                onChange={(e) => setSmsForm((prev) => ({ ...prev, audience_ref_id: e.target.value }))}
                                                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground"
                                            >
                                                <option value="">Choose target...</option>
                                                {targetOptions.map((target) => (
                                                    <option key={target.id} value={target.id}>
                                                        {target.label} · {target.meta}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <Input disabled value="Not needed" className="h-12 rounded-xl text-muted-foreground" />
                                        )}
                                    </Field>
                                </div>

                                <Field label="SMS message" hint="One credit usually covers 160 characters. Longer messages use more credits per recipient.">
                                    <Textarea value={smsForm.message} onChange={(e) => setSmsForm((prev) => ({ ...prev, message: e.target.value }))} placeholder="Habari! Bidhaa mpya imefika..." className="min-h-28 rounded-xl" maxLength={640} />
                                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                                        <span>{smsCharacters}/640 characters</span>
                                        <span>{smsSegments} credit{smsSegments === 1 ? '' : 's'} per recipient</span>
                                    </div>
                                </Field>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Field label="Send mode">
                                        <select value={smsForm.send_mode} onChange={(e) => setSmsForm((prev) => ({ ...prev, send_mode: e.target.value }))} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">
                                            <option value="draft">Save draft</option>
                                            <option value="send_now">Send now</option>
                                            <option value="schedule">Schedule</option>
                                        </select>
                                    </Field>
                                    <Field label="Schedule time" hint="Only used when Send mode is Schedule.">
                                        <Input disabled={smsForm.send_mode !== 'schedule'} type="datetime-local" value={smsForm.scheduled_at} onChange={(e) => setSmsForm((prev) => ({ ...prev, scheduled_at: e.target.value }))} className="h-12 rounded-xl" />
                                    </Field>
                                </div>

                                {smsEstimate && (
                                    <div className="rounded-2xl border bg-slate-50 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estimate</p>
                                        <p className="mt-1 text-sm font-bold">
                                            {Number(smsEstimate.recipient_count || 0).toLocaleString()} recipients · {Number(smsEstimate.estimated_credits || 0).toLocaleString()} credits
                                        </p>
                                        {smsEstimate.sample?.length > 0 && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Sample: {smsEstimate.sample.map((entry) => entry.name || entry.phone).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button variant="outline" disabled={smsBusy} onClick={estimateSmsCampaign} className="h-12 rounded-2xl font-black flex-1">
                                        Estimate cost
                                    </Button>
                                    <Button disabled={smsBusy} onClick={() => saveSmsCampaign(smsForm.send_mode)} className="h-12 rounded-2xl font-black flex-1">
                                        {smsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : smsForm.send_mode === 'send_now' ? <Send className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                        {smsForm.send_mode === 'send_now' ? 'Simulate send' : 'Save campaign'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>}

                        {activeSection === 'sms' && <Card className="rounded-[28px] border-brand-100/70">
                            <CardHeader>
                                <CardTitle className="text-base font-black uppercase tracking-wider">SMS campaign history</CardTitle>
                                <CardDescription>Draft, scheduled, and simulated campaign results.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {smsCampaigns.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-8 text-center">
                                        <MessageSquareText className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">No SMS campaigns yet</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Create one above to test the workflow.</p>
                                    </div>
                                ) : smsCampaigns.map((campaign) => (
                                    <div key={campaign.id} className="rounded-2xl border p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-black">{campaign.name}</p>
                                                <p className="text-xs text-muted-foreground line-clamp-2">{campaign.message}</p>
                                                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                                                    {campaign.estimated_recipients} recipients · {campaign.estimated_credits} credits · sent {campaign.sent_count}
                                                    {campaign.scheduled_at ? ` · scheduled ${new Date(campaign.scheduled_at).toLocaleString()}` : ''}
                                                    {campaign.pending_count ? ` · pending ${campaign.pending_count}` : ''}
                                                </p>
                                                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    {campaign.provider_mode || 'queued_intent'}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                                {campaign.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function AnalyticsExports({ merchantUsername }) {
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - (29 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const [fromDate, setFromDate] = useState(thirtyDaysAgo);
    const [toDate, setToDate] = useState(today);

    const reports = [
        {
            title: 'Revenue statement',
            description: 'Paid orders, payout state, gross, fees, and net amount.',
            href: `/merchant/${merchantUsername}/exports/statement.csv`,
        },
        {
            title: 'Campaign report',
            description: 'Coupons, referrals, group sales, SMS, and recovery activity.',
            href: `/merchant/${merchantUsername}/exports/campaigns.csv`,
        },
        {
            title: 'Product performance',
            description: 'Views, orders, gross revenue, released, and pending revenue.',
            href: `/merchant/${merchantUsername}/exports/product-performance.csv`,
        },
        {
            title: 'Order report',
            description: 'Buyer, item, discount, source, gateway, and tracking fields.',
            href: `/merchant/${merchantUsername}/exports/orders.csv`,
        },
    ];
    const exportHref = (href) => {
        const params = new URLSearchParams();
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
        const query = params.toString();

        return query ? `${href}?${query}` : href;
    };
    const openExport = (href) => {
        window.location.assign(exportHref(href));
    };
    const clearDateRange = () => {
        setFromDate('');
        setToDate('');
    };

    return (
        <Card className="rounded-[28px] border-brand-100/70">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                            <FileDown className="h-3.5 w-3.5" />
                            Analytics exports
                        </div>
                        <CardTitle className="mt-3 text-xl font-black">Download CSV reports</CardTitle>
                        <CardDescription>
                            Export creator finance, campaign, product, and order data for spreadsheets or bookkeeping.
                        </CardDescription>
                    </div>
                    <div className="flex w-full flex-col gap-2 md:max-w-lg">
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Field label="From">
                                <Input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} className="h-11 rounded-xl" />
                            </Field>
                            <Field label="To">
                                <Input type="date" value={toDate} min={fromDate || undefined} max={today} onChange={(e) => setToDate(e.target.value)} className="h-11 rounded-xl" />
                            </Field>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={clearDateRange} className="self-start rounded-xl">
                            Clear range
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {reports.map((report) => (
                        <button
                            type="button"
                            key={report.href}
                            onClick={() => openExport(report.href)}
                            className="group rounded-2xl border bg-white p-4 text-left transition hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
                            aria-label={`Export ${report.title}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black">{report.title}</p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{report.description}</p>
                                </div>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white text-brand-600 group-hover:border-brand-200">
                                    <FileDown className="h-4 w-4" />
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function MarketingSectionNav({ baseUrl, activeSection }) {
    const scrollContainerRef = React.useRef(null);
    const scrollTabsRight = () => {
        scrollContainerRef.current?.scrollBy({ left: 180, behavior: 'smooth' });
    };

    return (
        <div className="relative border-b border-border">
            <div ref={scrollContainerRef} className="overflow-x-auto">
                <div className="flex min-w-max gap-1 pr-14 md:pr-0">
                    {sectionTabs.map(([key, label]) => {
                        const href = key === 'overview' ? baseUrl : `${baseUrl}/${key}`;
                        const active = activeSection === key;

                        return (
                            <Link
                                key={key}
                                href={href}
                                className={`border-b-2 px-3 py-3 text-sm font-black transition ${active
                                    ? 'border-brand-600 text-brand-700'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-gradient-to-l from-background via-background/95 to-transparent pr-1 md:hidden">
                <button
                    type="button"
                    onClick={scrollTabsRight}
                    className="flex h-8 w-8 items-center justify-center rounded-full border bg-white text-brand-700 shadow-sm"
                    aria-label="Show more marketing tabs"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

function CreatorAnalytics({ analytics = {} }) {
    const sources = analytics.source_revenue || [];
    const funnels = analytics.funnels || [];
    const topProducts = analytics.top_products || [];
    const topReferrals = analytics.top_referrals || [];
    const topCoupons = analytics.top_coupons || [];
    const gaps = analytics.tracking_gaps || [];
    const identity = analytics.identity_coverage || {};

    return (
        <Card className="rounded-[28px] border-brand-100/70 overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Creator analytics
                        </div>
                        <CardTitle className="mt-3 text-xl font-black">Sales funnel and campaign performance</CardTitle>
                        <CardDescription>
                            Revenue, conversion signals, and top offers from the data Takeer already tracks.
                        </CardDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-w-[220px]">
                        <MiniMoney label={`Revenue · ${analytics.window_label || 'All time'}`} value={analytics.revenue_total || 0} tone="emerald" />
                        <div className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-brand-800">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-75">Paid orders</p>
                            <p className="mt-1 text-sm font-black">{Number(analytics.orders_total || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-3 lg:grid-cols-4">
                    {sources.length === 0 ? (
                        <EmptyAnalytics text="No attributed sales yet." />
                    ) : sources.map((source) => (
                        <div key={source.key} className="rounded-2xl border bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{source.label}</p>
                                    <p className="mt-2 text-lg font-black">{formatCurrency(source.revenue)}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                                    {Number(source.share || 0).toLocaleString()}%
                                </span>
                            </div>
                            <p className="mt-2 text-xs font-semibold text-muted-foreground">
                                {Number(source.orders || 0).toLocaleString()} orders
                            </p>
                            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{source.note}</p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border bg-slate-50/70 p-4">
                        <div className="flex items-center gap-2">
                            <MousePointerClick className="h-4 w-4 text-brand-600" />
                            <p className="text-sm font-black uppercase tracking-wider">Conversion signals</p>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {funnels.map((funnel) => (
                                <div key={funnel.key} className="rounded-2xl border bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-black">{funnel.label}</p>
                                        <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-black text-brand-700">
                                            {funnel.conversion_rate === null ? 'Tracking' : `${Number(funnel.conversion_rate || 0).toLocaleString()}%`}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <InlineStat label={funnel.key === 'sms' ? 'Sent' : 'Views'} value={Number(funnel.views || 0).toLocaleString()} />
                                        <InlineStat label="Orders" value={funnel.orders === null ? 'Pending' : Number(funnel.orders || 0).toLocaleString()} />
                                    </div>
                                    <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{funnel.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            <p className="text-sm font-black uppercase tracking-wider">Top movers</p>
                        </div>
                        <div className="mt-3 space-y-3">
                            <TopList title="Products" rows={topProducts} empty="No product sales yet." />
                            <TopList title="Referrals" rows={topReferrals} empty="No referral conversions yet." />
                            <TopList title="Coupons" rows={topCoupons} empty="No coupon redemptions yet." />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-sm font-black uppercase tracking-wider">Identity stitching</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{identity.note || 'Buyer identity is linked after a deterministic account, phone, or checkout signal.'}</p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            {identity.confidence || 'deterministic'}
                        </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <InlineStat label="Known buyers" value={Number(identity.identified_buyers || 0).toLocaleString()} />
                        <InlineStat label="Known orders" value={Number(identity.identified_orders || 0).toLocaleString()} />
                        <InlineStat label="Order coverage" value={`${Number(identity.identified_order_rate || 0).toLocaleString()}%`} />
                        <InlineStat label="Linked sessions" value={Number(identity.linked_sessions || 0).toLocaleString()} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function TopList({ title, rows = [], empty }) {
    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
            <div className="mt-2 space-y-2">
                {rows.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-muted-foreground">{empty}</p>
                ) : rows.slice(0, 3).map((row) => (
                    <div key={`${title}-${row.id || row.code}`} className="rounded-xl border px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-black">{row.title || row.label || row.code}</p>
                            <p className="shrink-0 text-xs font-black">{formatCurrency(row.revenue || 0)}</p>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                            {row.orders !== undefined ? `${Number(row.orders || 0).toLocaleString()} orders` : ''}
                            {row.conversions !== undefined ? `${Number(row.conversions || 0).toLocaleString()} conversions` : ''}
                            {row.redemptions !== undefined ? `${Number(row.redemptions || 0).toLocaleString()} redemptions` : ''}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EmptyAnalytics({ text }) {
    return (
        <div className="rounded-2xl border border-dashed bg-white p-5 text-sm font-semibold text-muted-foreground">
            {text}
        </div>
    );
}

function Metric({ label, value }) {
    return (
        <Card className="rounded-2xl">
            <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-2 text-xl font-black">{value}</p>
            </CardContent>
        </Card>
    );
}

function InlineStat({ label, value }) {
    return (
        <div className="rounded-2xl border bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-black">{value}</p>
        </div>
    );
}

function MiniMoney({ label, value, tone = 'slate' }) {
    const toneClass = {
        amber: 'border-amber-200 bg-amber-50 text-amber-800',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        slate: 'border-slate-200 bg-slate-50 text-slate-700',
    }[tone] || 'border-slate-200 bg-slate-50 text-slate-700';

    return (
        <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
            <p className="text-[9px] font-black uppercase tracking-widest opacity-75">{label}</p>
            <p className="mt-1 text-sm font-black">TZS {Number(value || 0).toLocaleString()}</p>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <label className="space-y-1.5 block">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
            {children}
            {hint && <span className="block text-[11px] font-semibold leading-5 text-muted-foreground">{hint}</span>}
        </label>
    );
}

function formatCurrency(value) {
    return `TZS ${Number(value || 0).toLocaleString()}`;
}

function discountLabel(coupon) {
    if (coupon.discount_type === 'fixed') {
        return `TZS ${Number(coupon.discount_value || 0).toLocaleString()} off`;
    }

    return `${Number(coupon.discount_value || 0).toLocaleString()}% off`;
}

function targetLabel(link) {
    const labels = {
        storefront: 'storefront',
        product: `product #${link.target_id}`,
        bundle: `bundle #${link.target_id}`,
        subscription_plan: `membership #${link.target_id}`,
        post: `post #${link.target_id}`,
        content_item: `content #${link.target_id}`,
    };

    return labels[link.target_type] || 'destination';
}
