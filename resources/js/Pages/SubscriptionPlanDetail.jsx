import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CalendarClock, CheckCircle2, Crown, Lock, ShieldCheck, Store, Zap } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import PostCard from '@/Components/PostCard';
import { useSubscriptionCountdown } from '@/lib/subscriptionCountdown';

export default function SubscriptionPlanDetail({ subscriptionPlan, hasAccess = false, viewerSubscription = null, communityPosts = [], totalLinkedContent = 0 }) {
    const merchant = subscriptionPlan?.merchant || {};
    const items = Array.isArray(subscriptionPlan?.items) ? subscriptionPlan.items : [];
    const hasAssignedItems = items.length > 0;
    const memberPosts = Array.isArray(communityPosts) ? communityPosts : [];
    const cadenceLabel = formatBillingCadence(subscriptionPlan.billing_interval, subscriptionPlan.interval_count);
    const durationLabel = formatMembershipDuration(subscriptionPlan.billing_interval, subscriptionPlan.interval_count);
    const trialDays = Number(subscriptionPlan.trial_days || 0);
    const checkoutItem = {
        ...subscriptionPlan,
        title: subscriptionPlan.name,
        checkoutType: 'subscription_plan',
        merchant,
    };
    const hasMembership = Boolean(viewerSubscription?.current_period_end);
    const membershipEndsAt = viewerSubscription?.current_period_end ? new Date(viewerSubscription.current_period_end) : null;
    const membershipEndsLabel = membershipEndsAt
        ? membershipEndsAt.toLocaleString('sw-TZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;
    const timeLeftLabel = useSubscriptionCountdown(viewerSubscription?.current_period_end);

    return (
        <AppLayout hideTabBar>
            <Head title={`${subscriptionPlan.name} | Takeer`} />

            <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-24">
                <Link href={merchant?.slug ? `/m/${merchant.slug}` : '/'} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Rudi dukani
                </Link>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] items-start">
                    <div className="space-y-6">
                        <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
                            <div className="border-b border-border/60 bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-6 py-7 md:px-8 md:py-8">
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm">
                                            <Crown className="h-3.5 w-3.5" />
                                            Membership
                                        </div>
                                        <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-4xl">
                                            {subscriptionPlan.name}
                                        </h1>
                                    </div>
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-700 shadow-sm">
                                        <Crown className="h-6 w-6" strokeWidth={2.5} />
                                    </div>
                                </div>

                                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                                    {subscriptionPlan.description || 'Jiunge kupata maudhui ya wanachama, masomo, downloads, na updates mpya kadri zinavyoongezwa.'}
                                </p>

                                <div className="mt-6 flex flex-wrap gap-2">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700">
                                        <CalendarClock className="h-4 w-4 text-brand-600" />
                                        {durationLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                        Safe checkout
                                    </span>
                                </div>
                            </div>

                            {hasAssignedItems && (
                                <div className="px-6 py-6 md:px-8">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Utakachopata</p>
                                            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Included access</h2>
                                        </div>
                                        <p className="max-w-sm text-xs font-semibold leading-5 text-muted-foreground sm:text-right">
                                            Available in <Link href="/orders" className="font-black text-brand-600 hover:underline">Orders</Link> while your membership is active.
                                        </p>
                                    </div>

                                    <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border bg-background">
                                        {items.map((item, index) => (
                                            <div key={`${item.item_type}-${item.item_id}-${index}`} className="flex items-center justify-between gap-4 px-4 py-4">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black text-slate-950">{item.title || item.item_type.replace('_', ' ')}</p>
                                                    <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                                                        {item.unlock_after_days > 0
                                                            ? `Unlocks after ${item.unlock_after_days} day(s), then stays in Orders while active.`
                                                            : item.item_type === 'bundle'
                                                                ? (item.is_course ? 'Course access in Orders while active.' : 'Bundle access in Orders while active.')
                                                                : 'Access in Orders while active.'}
                                                    </p>
                                                </div>
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                                    {hasMembership ? (
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    ) : (
                                                        <Lock className="h-5 w-5" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-600">
                                        Membership ikiisha, subscription access inaisha. Items ulizonunua moja kwa moja hubaki zako.
                                    </p>
                                </div>
                            )}
                        </section>

                        {hasAccess && (
                            <section id="community" className="space-y-4">
                                {memberPosts.length > 0 ? (
                                    <div className="space-y-4">
                                        {memberPosts.map((post) => (
                                            <PostCard
                                                key={post.public_id || post.id}
                                                post={post}
                                                detailHref={`/p/${post.public_id || post.id}`}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-[28px] border border-dashed bg-card p-6 md:p-8 text-center">
                                        <CalendarClock className="mx-auto h-9 w-9 text-brand-600" />
                                        <p className="mt-3 font-black">No member posts yet</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                            New subscriber-only posts will appear here when the creator publishes them to this plan.
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-6">
                        <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
                            <div className="p-6">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                        <Store className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate font-black text-slate-950">{merchant.display_name || merchant.name}</p>
                                        <p className="truncate text-sm text-muted-foreground">@{merchant.slug || merchant.username || 'merchant'}</p>
                                    </div>
                                </div>

                                <div className="mt-6 rounded-[24px] bg-slate-50 px-5 py-5">
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Bei ya subscription</p>
                                    <p className="mt-2 text-4xl font-black tracking-tight text-brand-600">
                                        TZS {Number(subscriptionPlan.price || 0).toLocaleString()}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-500">{cadenceLabel}</p>
                                </div>

                                {hasMembership && (
                                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700">
                                                <Crown className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Membership active</p>
                                                <p className="mt-1 text-sm font-black tabular-nums text-foreground">{timeLeftLabel}</p>
                                                <p className="mt-1 text-xs font-semibold text-muted-foreground">Ends {membershipEndsLabel}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button className="mt-5 h-12 w-full rounded-2xl font-black shadow-lg shadow-brand-600/15" onClick={() => window.__openCheckout?.(checkoutItem)}>
                                    <Zap className="mr-2 h-4 w-4" />
                                    {hasMembership ? 'Renew access' : (hasAccess ? 'Renew / Manage Access' : 'Jiunge Sasa')}
                                </Button>

                                {hasAccess && (
                                    <a
                                        href="#community"
                                        className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border text-sm font-black transition-colors hover:bg-accent"
                                    >
                                        Open member feed
                                    </a>
                                )}
                            </div>

                            <div className="border-t border-border/70 bg-slate-50/70 px-6 py-5">
                                <div className="space-y-3 text-sm font-semibold leading-6 text-slate-600">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                        <span>Access hufunguka baada ya malipo kukamilika.</span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                        <span>Malipo yanalindwa na Takeer checkout.</span>
                                    </div>
                                    {hasAssignedItems && (
                                        <div className="flex items-start gap-3">
                                            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                            <span>Subscription items stay in Orders until membership ends.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
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
