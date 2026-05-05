import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CalendarClock, CheckCircle2, Crown, FileText, Lock, MessageCircle, MoreHorizontal, ShieldCheck, Sparkles, Store, Users, Zap } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import PostCard from '@/Components/PostCard';

export default function SubscriptionPlanDetail({ subscriptionPlan, hasAccess = false, communityPosts = [], communityStats = {}, contentPreview = [], totalLinkedContent = 0 }) {
    const merchant = subscriptionPlan?.merchant || {};
    const items = Array.isArray(subscriptionPlan?.items) ? subscriptionPlan.items : [];
    const memberPosts = Array.isArray(communityPosts) ? communityPosts : [];
    const cadenceLabel = `${subscriptionPlan.interval_count || 1} ${subscriptionPlan.billing_interval || 'monthly'}`;
    const trialDays = Number(subscriptionPlan.trial_days || 0);
    const checkoutItem = {
        ...subscriptionPlan,
        title: subscriptionPlan.name,
        checkoutType: 'subscription_plan',
        merchant,
    };
    const remainingCount = Math.max(0, totalLinkedContent - contentPreview.length);
    const hasPreviewContent = contentPreview.length > 0;
    const recentMembers = Array.isArray(communityStats?.recent_members) ? communityStats.recent_members : [];

    const timeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'sasa hivi';
        if (diff < 3600) return `dakika ${Math.floor(diff / 60)} zilizopita`;
        if (diff < 86400) return `saa ${Math.floor(diff / 3600)} zilizopita`;
        if (diff < 2592000) return `siku ${Math.floor(diff / 86400)} zilizopita`;
        return new Date(dateStr).toLocaleDateString('sw-TZ', { month: 'short', day: 'numeric' });
    };

    return (
        <AppLayout hideTabBar>
            <Head title={`${subscriptionPlan.name} | Takeer`} />

            <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-24">
                <Link href={merchant?.slug ? `/m/${merchant.slug}` : '/'} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Rudi dukani
                </Link>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
                    <div className="space-y-6">
                        <section className="rounded-[28px] border bg-card p-6 md:p-8 shadow-sm">
                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
                                <Crown className="h-3.5 w-3.5" />
                                Uanachama
                            </div>
                            <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-tight">{subscriptionPlan.name}</h1>
                            <p className="mt-4 text-base md:text-lg leading-8 text-muted-foreground">
                                {subscriptionPlan.description || 'Jiunge kupata maudhui ya wanachama, masomo, downloads, na updates mpya kadri zinavyoongezwa.'}
                            </p>

                            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border bg-background px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Maudhui</p>
                                    <p className="mt-1 text-2xl font-black">{totalLinkedContent || items.length}</p>
                                </div>
                                <div className="rounded-2xl border bg-background px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Wanachama</p>
                                    <p className="mt-1 text-2xl font-black">{Number(communityStats.active_members || 0).toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl border bg-background px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Malipo</p>
                                    <p className="mt-1 text-xl font-black capitalize">{cadenceLabel}</p>
                                </div>
                            </div>

                            {items.length > 0 && (
                                <div className="mt-8 space-y-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Utakachopata</p>
                                    {items.map((item, index) => (
                                        <div key={`${item.item_type}-${item.item_id}-${index}`} className="rounded-2xl border px-4 py-4 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-black text-sm">{item.title || item.item_type.replace('_', ' ')}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.unlock_after_days > 0
                                                        ? `Unlock after ${item.unlock_after_days} day(s)`
                                                        : item.item_type === 'bundle'
                                                            ? (item.is_course ? 'Course content included' : 'Bundle content included')
                                                            : 'Member content included'}
                                                </p>
                                            </div>
                                            <Lock className="h-4 w-4 text-emerald-600" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {hasAccess && (
                            <section id="community" className="space-y-4">
                                <div className="rounded-[28px] border bg-card p-6 md:p-8 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-brand-700">
                                                <Crown className="h-3.5 w-3.5" />
                                                Member community
                                            </div>
                                            <h2 className="mt-4 text-2xl md:text-3xl font-black tracking-tight">Subscriber-only feed</h2>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                Updates, drops, discussions, and premium posts attached to this membership.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid gap-3 sm:grid-cols-4">
                                        <CommunityStat icon={Users} label="Active members" value={communityStats.active_members || 0} />
                                        <CommunityStat icon={Sparkles} label="New 30d" value={communityStats.new_members_30d || 0} />
                                        <CommunityStat icon={Crown} label="Member posts" value={communityStats.posts_count || memberPosts.length} />
                                        <CommunityStat icon={MessageCircle} label="Comments" value={communityStats.comments_count || 0} />
                                    </div>

                                    {recentMembers.length > 0 && (
                                        <div className="mt-6 rounded-2xl border bg-background p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recent members</p>
                                                <p className="text-[11px] font-bold text-muted-foreground">Private to subscribers</p>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {recentMembers.map((member) => (
                                                    <div key={member.id} className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-2">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-black text-brand-700">
                                                            {initials(member.name)}
                                                        </span>
                                                        <span className="text-xs font-black">{member.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

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

                        {hasPreviewContent && (
                            <section className="rounded-[28px] border bg-card p-6 md:p-8 shadow-sm">
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <FileText className="h-4 w-4 text-emerald-700" />
                                    </div>
                                    <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Preview ya wanachama</p>
                                </div>

                                <div className="space-y-3">
                                    {contentPreview.map((post) => (
                                        <div
                                            key={post.id}
                                            className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900 px-4 py-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-black text-sm leading-tight truncate">
                                                        {post.title || 'Maudhui ya wanachama'}
                                                    </p>
                                                    {post.excerpt && (
                                                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                                                            {post.excerpt}
                                                        </p>
                                                    )}
                                                    <p className="text-[10px] text-muted-foreground/70 mt-2">
                                                        {timeAgo(post.created_at)}
                                                    </p>
                                                </div>
                                                <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                                                    <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {remainingCount > 0 && (
                                        <div className="rounded-2xl border border-dashed border-emerald-200 px-4 py-4 flex items-center justify-center gap-2 text-emerald-700">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <p className="text-sm font-black">
                                                + {remainingCount} zaidi
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <p className="text-[11px] text-muted-foreground mt-4 text-center">
                                    Jiunge kufungua maudhui yote yaliyopo na mapya yatakayoongezwa kwenye subscription hii.
                                </p>
                            </section>
                        )}

                        {!hasPreviewContent && (
                            <section className="rounded-[28px] border border-dashed bg-card p-6 md:p-8 text-center">
                                <CalendarClock className="mx-auto h-9 w-9 text-emerald-600" />
                                <p className="mt-3 font-black">Maudhui yataendelea kuongezwa</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Mtoa huduma anaweza kuongeza posts, downloads, au course bundles mpya kadri subscription inavyoendelea.
                                </p>
                            </section>
                        )}
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-6">
                        <div className="rounded-[28px] border bg-card p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                                    <Store className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-black">{merchant.display_name || merchant.name}</p>
                                    <p className="text-sm text-muted-foreground">@{merchant.slug || merchant.username || 'merchant'}</p>
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl bg-accent/40 px-4 py-4">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Bei ya subscription</p>
                                <p className="mt-2 text-3xl font-black text-brand-600">TZS {Number(subscriptionPlan.price || 0).toLocaleString()}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Kila {cadenceLabel}
                                </p>
                            </div>

                            <Button className="w-full mt-5 h-12 rounded-2xl font-black" onClick={() => window.__openCheckout?.(checkoutItem)}>
                                <Zap className="mr-2 h-4 w-4" />
                                {hasAccess ? 'Renew / Manage Access' : 'Jiunge Sasa'}
                            </Button>

                            {hasAccess && (
                                <a
                                    href="#community"
                                    className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl border text-sm font-black hover:bg-accent transition-colors"
                                >
                                    Open member feed
                                </a>
                            )}

                            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span>Access hufunguka baada ya malipo kukamilika.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    <span>Malipo yanalindwa na Takeer checkout.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4 text-emerald-600" />
                                    <span>Maudhui mapya yanaweza kuongezwa baadaye.</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}

function CommunityStat({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl border bg-background px-4 py-3">
            <div className="flex items-center gap-2 text-brand-700">
                <Icon className="h-4 w-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
            </div>
            <p className="mt-2 text-2xl font-black">{Number(value || 0).toLocaleString()}</p>
        </div>
    );
}

function initials(name = '') {
    const parts = String(name || 'Member').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M';
}
