import React, { useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { BadgePercent, CalendarClock, Copy, ExternalLink, ShieldCheck, Store, Tag, Zap } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { toast } from 'sonner';
import { trackAttributionEvent } from '@/lib/attribution';

export default function CampaignLanding({ campaign }) {
    const merchant = campaign?.merchant || {};
    const target = campaign?.target || {};
    const isActive = Boolean(campaign?.is_active_now);
    const deadline = campaign?.ends_at ? new Date(campaign.ends_at).toLocaleString() : null;

    useEffect(() => {
        if (!campaign?.code) return;

        trackAttributionEvent(campaign.kind === 'referral' ? 'referral_landing' : 'content_view', {
            entity_type: target?.type || 'merchant',
            entity_id: target?.id || merchant?.id || undefined,
            merchant_id: merchant?.id || undefined,
            referral_code: campaign?.referral?.code || undefined,
            coupon_code: campaign?.coupon?.code || undefined,
            metadata: {
                campaign_code: campaign.code,
                campaign_kind: campaign.kind,
            },
        });
    }, [campaign?.code]);

    async function copyCode() {
        await navigator.clipboard?.writeText(campaign.code);
        toast.success('Campaign code copied.');
    }

    async function copyLink() {
        await navigator.clipboard?.writeText(window.location.href);
        toast.success('Campaign page copied.');
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <Head title={`${campaign?.title || 'Campaign'} | Takeer`} />
            <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <Link href="/" className="text-lg font-black text-brand-700">Takeer</Link>
                    {merchant?.username && (
                        <Link href={`/m/${merchant.username}`} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs font-black">
                            <Store className="h-4 w-4" />
                            {merchant.display_name || merchant.username}
                        </Link>
                    )}
                </div>

                <section className="overflow-hidden rounded-[32px] border bg-white shadow-sm">
                    <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                        <div className="p-6 md:p-10">
                            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-700">
                                {campaign.kind === 'coupon' ? <BadgePercent className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                                {campaign.kind === 'coupon' ? 'Limited offer' : 'Creator campaign'}
                            </div>
                            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                                {campaign.title || 'Special campaign'}
                            </h1>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                                {campaign.description || 'Open this focused Takeer campaign and continue to the creator offer.'}
                            </p>

                            {campaign.discount_label && (
                                <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
                                    <Tag className="h-5 w-5" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest">Campaign code</p>
                                        <p className="text-2xl font-black">{campaign.code} · {campaign.discount_label}</p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                                {isActive ? (
                                    <Button asChild className="h-12 rounded-2xl px-6 font-black">
                                        <a href={campaign.cta_url}>
                                            <Zap className="mr-2 h-4 w-4" />
                                            Open offer
                                        </a>
                                    </Button>
                                ) : (
                                    <Button disabled className="h-12 rounded-2xl px-6 font-black">
                                        <Zap className="mr-2 h-4 w-4" />
                                        Campaign inactive
                                    </Button>
                                )}
                                <Button variant="outline" onClick={copyCode} className="h-12 rounded-2xl px-6 font-black">
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy code
                                </Button>
                                <Button variant="outline" onClick={copyLink} className="h-12 rounded-2xl px-6 font-black">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Copy page
                                </Button>
                            </div>

                            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
                                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 font-bold">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                    Takeer checkout
                                </span>
                                {deadline && (
                                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 font-bold">
                                        <CalendarClock className="h-4 w-4 text-brand-600" />
                                        Ends {deadline}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="border-t bg-slate-100/70 p-5 lg:border-l lg:border-t-0 md:p-8">
                            <div className="overflow-hidden rounded-[28px] border bg-white shadow-sm">
                                <div className="aspect-[16/10] bg-slate-200">
                                    {target.image_url ? (
                                        <img src={target.image_url} alt={target.title || campaign.title} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <Store className="h-16 w-16 text-brand-600" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        {target.type === 'storefront' ? 'Creator storefront' : target.type?.replace('_', ' ') || 'Offer'}
                                    </p>
                                    <h2 className="mt-2 text-2xl font-black">{target.title || merchant.display_name || 'Campaign offer'}</h2>
                                    {target.description && (
                                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{target.description}</p>
                                    )}
                                    {target.price !== null && target.price !== undefined && (
                                        <p className="mt-4 text-2xl font-black text-brand-700">TSh {Number(target.price || 0).toLocaleString()}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
