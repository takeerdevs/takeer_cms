import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Loader2, Users, Clock, Store, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';
import PublicHeader from '@/Components/PublicHeader';

export default function GroupSaleCampaign({ campaign }) {
    const { t, copy } = useLocale();
    const [data, setData] = useState(campaign || {});
    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        quantity: 1,
        wants_sms_updates: true,
    });
    const [joining, setJoining] = useState(false);
    const [joined, setJoined] = useState(false);

    async function joinCampaign() {
        setJoining(true);
        try {
            const res = await axios.post(`/group-sale/${data.slug}/join`, {
                ...form,
                quantity: Number(form.quantity || 1),
            });
            setData(res.data?.campaign || data);
            setJoined(true);
            toast.success(res.data?.message || t('publicCommerce.reservationSaved'));
        } catch (error) {
            toast.error(error.response?.data?.message || t('publicCommerce.campaignJoinFailed'));
        } finally {
            setJoining(false);
        }
    }

    const progress = Math.min(100, Number(data.progress_percent || 0));
    const deadline = data.ends_at ? new Date(data.ends_at).toLocaleString() : '';
    const isJoinable = Boolean(data.is_joinable);
    const isCheckoutOpen = Boolean(data.is_checkout_open || data.status === 'successful');
    const buyUrl = data.product?.slug ? `/product/${data.product.slug}?group_sale=${data.slug}` : null;
    const unitSuffix = data.unit_label ? ` / ${data.unit_label}` : '';

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <Head title={`${data.title || t('publicCommerce.groupPrice')} | Takeer`} />
            <PublicHeader>
                {data.merchant?.username && (
                    <Link href={`/m/${data.merchant.username}`} className="inline-flex max-w-[48vw] items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-black">
                        <Store className="h-4 w-4 shrink-0" />
                        <span className="truncate">{data.merchant.display_name || data.merchant.username}</span>
                    </Link>
                )}
            </PublicHeader>
            <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">
                <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
                    <div className="overflow-hidden rounded-[28px] border bg-white shadow-sm">
                        <div className="aspect-[16/10] bg-slate-100">
                            {data.product?.image_url ? (
                                <img src={data.product.image_url} alt={data.product.title || data.title} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <Users className="h-16 w-16 text-brand-600" />
                                </div>
                            )}
                        </div>
                        <div className="p-5 md:p-7">
                            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-700">
                                <Users className="h-3.5 w-3.5" />
                                {copy('Group sale', 'Mauzo ya kikundi')}
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{data.title}</h1>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{data.description || copy('Join this campaign before the deadline. If enough buyers reserve, the merchant can unlock the offer.', 'Jiunge na kampeni hii kabla ya muda kuisha. Wanunuzi wakitosha kuweka nafasi, mfanyabiashara anaweza kufungua ofa.')}</p>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <div className="rounded-2xl border bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('publicCommerce.groupPrice')}</p>
                                    <p className="mt-1 text-2xl font-black text-brand-700">TSh {Number(data.campaign_price || 0).toLocaleString()}{unitSuffix}</p>
                                </div>
                                {data.regular_price ? (
                                    <div className="rounded-2xl border bg-slate-50 px-4 py-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('publicCommerce.regularPrice')}</p>
                                        <p className="mt-1 text-2xl font-black text-slate-500 line-through">TSh {Number(data.regular_price || 0).toLocaleString()}{unitSuffix}</p>
                                    </div>
                                ) : null}
                                <div className="rounded-2xl border bg-slate-50 px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('publicCommerce.deadline')}</p>
                                    <p className="mt-1 flex items-center gap-2 text-sm font-black"><Clock className="h-4 w-4" />{deadline}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="rounded-[28px] border bg-white p-5 shadow-sm md:p-6">
                        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
                            <span>{Number(data.reserved_quantity || 0).toLocaleString()} / {Number(data.goal_quantity || 0).toLocaleString()} {copy('reserved', 'zimehifadhiwa')}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
                        </div>

                        {isCheckoutOpen && buyUrl ? (
                            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                                <CheckCircle2 className="h-8 w-8" />
                                <p className="mt-3 font-black">{t('publicCommerce.targetReached')}</p>
                                <p className="mt-1 text-sm">{t('publicCommerce.buyGroupPrice')}</p>
                                <Link href={buyUrl} className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-brand-600 px-5 text-sm font-black text-white shadow-sm">
                                    {copy('Buy at group price', 'Nunua kwa bei ya kikundi')}
                                </Link>
                            </div>
                        ) : joined ? (
                            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                                <CheckCircle2 className="h-8 w-8" />
                                <p className="mt-3 font-black">{t('publicCommerce.joinedGroup')}</p>
                                <p className="mt-1 text-sm">{t('publicCommerce.merchantNotify')}</p>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-3">
                                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('publicCommerce.yourName')} className="h-12 rounded-xl" />
                                <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder={t('publicCommerce.phoneUpdates')} className="h-12 rounded-xl" />
                                <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder={t('publicCommerce.emailOptional')} className="h-12 rounded-xl" />
                                <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} placeholder={t('publicCommerce.quantity')} className="h-12 rounded-xl" />
                                {data.allow_sms_updates && (
                                    <label className="flex items-center gap-3 rounded-xl border bg-slate-50 px-3 py-3 text-sm font-bold">
                                        <input type="checkbox" checked={form.wants_sms_updates} onChange={(e) => setForm((prev) => ({ ...prev, wants_sms_updates: e.target.checked }))} className="h-5 w-5" />
                                        {copy('Send me SMS updates', 'Nitume taarifa kwa SMS')}
                                    </label>
                                )}
                                <Button disabled={!isJoinable || joining} onClick={joinCampaign} className="h-12 w-full rounded-2xl font-black">
                                    {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                                    {isJoinable ? copy('Join group sale', 'Jiunge na mauzo ya kikundi') : copy('Campaign closed', 'Kampeni imefungwa')}
                                </Button>
                            </div>
                        )}
                    </aside>
                </section>
            </main>
        </div>
    );
}
