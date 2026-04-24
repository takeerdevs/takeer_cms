import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Crown, Lock, Store, Zap, FileText, MoreHorizontal } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';

export default function SubscriptionPlanDetail({ subscriptionPlan, contentPreview = [], totalLinkedContent = 0 }) {
    const merchant = subscriptionPlan?.merchant || {};
    const checkoutItem = {
        ...subscriptionPlan,
        title: subscriptionPlan.name,
        checkoutType: 'subscription_plan',
        merchant,
    };
    const remainingCount = Math.max(0, totalLinkedContent - contentPreview.length);
    const hasPreviewContent = contentPreview.length > 0;

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

            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
                <Link href={merchant?.slug ? `/m/${merchant.slug}` : '/'} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to store
                </Link>

                <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    {/* Left column — Plan details + content preview */}
                    <div className="space-y-6">
                        <div className="rounded-[28px] border bg-card p-6 md:p-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700">
                                <Crown className="h-3.5 w-3.5" />
                                Membership Tier
                            </div>
                            <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight">{subscriptionPlan.name}</h1>
                            <p className="mt-4 text-base leading-8 text-muted-foreground">{subscriptionPlan.description || 'Recurring access to premium knowledge, offers, and locked member-only items.'}</p>

                            {/* Plan inclusions */}
                            {(subscriptionPlan.items || []).length > 0 && (
                                <div className="mt-8 space-y-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">What's Included</p>
                                    {subscriptionPlan.items.map((item, index) => (
                                        <div key={`${item.item_type}-${item.item_id}-${index}`} className="rounded-2xl border px-4 py-4 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-black text-sm">{item.item_type.replace('_', ' ')}</p>
                                                <p className="text-xs text-muted-foreground">Unlock after {item.unlock_after_days || 0} day(s)</p>
                                            </div>
                                            <Lock className="h-4 w-4 text-emerald-600" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Content Preview Cards */}
                        {hasPreviewContent && (
                            <div className="rounded-[28px] border bg-card p-6 md:p-8">
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <FileText className="h-4 w-4 text-emerald-700" />
                                    </div>
                                    <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Member Content Preview</p>
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
                                                        {post.title || 'Locked Content'}
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
                                        <div className="rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800/50 px-4 py-4 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <p className="text-sm font-black">
                                                + {remainingCount} more content{remainingCount > 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <p className="text-[11px] text-muted-foreground mt-4 text-center">
                                    Subscribe to unlock all {totalLinkedContent} content{totalLinkedContent > 1 ? 's' : ''} in this membership.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right column — Pricing + CTA */}
                    <div className="space-y-4">
                        <div className="rounded-[28px] border bg-card p-6">
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
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recurring Price</p>
                                <p className="mt-2 text-3xl font-black text-brand-600">TZS {Number(subscriptionPlan.price || 0).toLocaleString()}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Every {subscriptionPlan.interval_count} {subscriptionPlan.billing_interval}
                                </p>
                            </div>

                            <Button className="w-full mt-5 h-12 rounded-2xl font-black" onClick={() => window.__openCheckout?.(checkoutItem)}>
                                <Zap className="mr-2 h-4 w-4" />
                                Join Membership
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
