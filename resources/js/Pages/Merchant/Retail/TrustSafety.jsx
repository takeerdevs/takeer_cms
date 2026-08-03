import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, CheckCircle2, Copy, ExternalLink, Gavel, Link as LinkIcon, MessageCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function TrustSafety({ merchant }) {
    const { copy, locale } = useLocale();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const loadStatus = async () => {
        setLoading(true);
        try {
            delete window.axios.defaults.headers.common.Authorization;
            const res = await window.axios.get('/api/retail/trust-safety', { params: { merchant_id: merchant.id } });
            setData(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Failed to load Trust & Safety.', 'Imeshindikana kupakia Uaminifu na Usalama.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const formatDate = (val) => {
        if (!val) return copy('Unknown date', 'Tarehe haijulikani');
        return new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(val));
    };

    const requestReview = async () => {
        const body = message.trim();
        if (!body) {
            toast.error(copy('Write a short message for the Takeer team.', 'Andika ujumbe mfupi kwa timu ya Takeer.'));
            return;
        }

        setSending(true);
        try {
            const res = await window.axios.post('/api/retail/trust-safety/review-request', { message: body });
            toast.success(res.data?.message || copy('Request sent.', 'Ombi limetumwa.'));
            setMessage('');
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Request could not be sent.', 'Ombi halikuweza kutumwa.'));
        } finally {
            setSending(false);
        }
    };

    const copyLink = async (url) => {
        if (!url) return;

        try {
            await navigator.clipboard.writeText(url);
            toast.success(copy('POS payment link copied.', 'Linki ya malipo ya POS imenakiliwa.'));
        } catch (err) {
            toast.error(copy('Could not copy link.', 'Imeshindikana kunakili linki.'));
        }
    };

    const status = data?.status || {};
    const isGood = status.standing === 'good';
    const actionLabel = (action) => ({
        reenable_pos_links: copy('POS links re-enabled', 'Linki za POS zimewashwa tena'),
        keep_restriction: copy('Restriction remains', 'Kizuizi kinaendelea'),
        dismiss: copy('Request dismissed', 'Ombi limeondolewa'),
    }[action] || action || copy('Reviewed', 'Imekaguliwa'));

    return (
        <AppLayout>
            <Head title={`${copy('Trust & Safety', 'Uaminifu na Usalama')} | ${merchant.display_name}`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                <div className="space-y-3">
                    <Button
                        variant="ghost"
                        className="h-9 px-2 text-slate-500 hover:text-slate-900"
                        onClick={() => router.visit(`/merchant/${merchant.username}/retail/dashboard`)}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" /> {copy('Retail Dashboard', 'Dashibodi ya Rejareja')}
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            {copy('Trust & Safety', 'Uaminifu na Usalama')} <Gavel className="h-8 w-8 text-amber-600" />
                        </h1>
                        <p className="text-muted-foreground">{copy('Review account status, POS link reports, and Takeer warnings.', 'Angalia hali ya akaunti, ripoti za POS links, na maonyo kutoka Takeer.')}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-sm font-bold text-muted-foreground">{copy('Loading Trust & Safety...', 'Inapakia Uaminifu na Usalama...')}</div>
                ) : (
                    <>
                        <Card className={`${isGood ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'} shadow-sm`}>
                            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`h-12 w-12 rounded-xl grid place-items-center ${isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {isGood ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Account status', 'Hali ya akaunti')}</p>
                                        <h2 className="text-2xl font-black text-slate-950 mt-1">
                                            {isGood ? copy('Account in good standing', 'Akaunti iko katika hali nzuri') : copy('Action may be needed', 'Hatua inaweza kuhitajika')}
                                        </h2>
                                        <p className="text-sm font-bold text-slate-600 mt-1">
                                            {status.pos_payment_links_disabled
                                                ? copy('POS payment links are currently disabled. You can still record cash or manual payments.', 'Linki za malipo za POS zimezimwa kwa sasa. Bado unaweza kuhifadhi malipo ya fedha au ya mkono.')
                                                : copy('POS payment links are currently available.', 'Linki za malipo za POS zinapatikana kwa sasa.')}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
                                    <Metric label={copy('Strikes', 'Maonyo')} value={status.strike_count || 0} />
                                    <Metric label={copy('Open reports', 'Ripoti zilizo wazi')} value={status.open_pos_reports || 0} />
                                    <Metric label={copy('POS reports', 'Ripoti za POS')} value={status.total_pos_reports || 0} />
                                </div>
                            </CardContent>
                        </Card>

                        {status.pos_payment_links_disabled && (
                            <Card className="bg-red-50 border-red-100">
                                <CardContent className="p-5 flex gap-3">
                                    <LinkIcon className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-black text-red-950">{copy('POS payment links are temporarily disabled.', 'POS payment links zimezimwa kwa muda.')}</p>
                                        <p className="text-sm font-bold text-red-800 mt-1">
                                            {copy('Customers cannot pay through POS links until Takeer reviews and re-enables them.', 'Wateja hawataweza kulipa kupitia links za POS mpaka Takeer ikague na kuruhusu tena.')}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid lg:grid-cols-2 gap-5">
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardContent className="p-5 space-y-4">
                                    <h2 className="text-lg font-black text-slate-900">{copy('Warnings & Strikes', 'Maonyo na Strikes')}</h2>
                                    {(data?.strikes || []).length === 0 ? (
                                        <EmptyState icon={CheckCircle2} title={copy('No strikes', 'Hakuna maonyo')} text={copy('No warning or strike has been recorded for this account.', 'Hakuna onyo au strike iliyorekodiwa kwa akaunti hii.')} />
                                    ) : (
                                        <div className="space-y-3">
                                            {data.strikes.map((strike) => (
                                                <div key={strike.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="font-black text-amber-950 capitalize">{strike.severity}</p>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">{formatDate(strike.created_at)}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-amber-800 mt-2">{strike.notes || copy('Takeer recorded a Trust & Safety action.', 'Takeer imeandika hatua ya Uaminifu na Usalama.')}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardContent className="p-5 space-y-4">
                                    <h2 className="text-lg font-black text-slate-900">{copy('POS Link Reports', 'Ripoti za Linki za POS')}</h2>
                                    {(data?.pos_reports || []).length === 0 ? (
                                        <EmptyState icon={ShieldCheck} title={copy('No customer reports', 'Hakuna ripoti za wateja')} text={copy('No customer has reported a POS payment link.', 'Hakuna mteja aliyeripoti POS payment link.')} />
                                    ) : (
                                        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                                            {data.pos_reports.map((report) => (
                                                <div key={report.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-black text-slate-950">POS #{report.order?.public_id || report.order?.id || '-'}</p>
                                                            <p className="text-xs font-bold text-slate-500">{report.order?.customer_name || copy('Customer', 'Mteja')} · {report.order?.customer_phone || copy('No phone', 'Hakuna simu')}</p>
                                                        </div>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {report.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700 mt-3">{report.reason}</p>
                                                    {report.admin_notes && <p className="text-xs font-bold text-slate-500 mt-2">{copy('Takeer note:', 'Maelezo ya Takeer:')} {report.admin_notes}</p>}
                                                    {report.order?.payment_url && (
                                                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy('Customer payment link', 'Kiungo cha malipo cha mteja')}</p>
                                                            <div className="flex flex-col sm:flex-row gap-2">
                                                                <input
                                                                    readOnly
                                                                    value={report.order.payment_url}
                                                                    className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600"
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="h-10 rounded-lg"
                                                                        onClick={() => copyLink(report.order.payment_url)}
                                                                    >
                                                                        <Copy className="h-4 w-4 mr-2" />
                                                                        {copy('Copy', 'Nakili')}
                                                                    </Button>
                                                                    <a href={report.order.payment_url} target="_blank" rel="noreferrer">
                                                                        <Button type="button" variant="outline" className="h-10 rounded-lg">
                                                                            <ExternalLink className="h-4 w-4 mr-2" />
                                                                            {copy('Open', 'Fungua')}
                                                                        </Button>
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">
                                                        <CalendarDays className="h-3.5 w-3.5" />
                                                        {formatDate(report.created_at)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-5 space-y-4">
                                <h2 className="text-lg font-black text-slate-900">{copy('Review Requests', 'Maombi ya Ukaguzi')}</h2>
                                {(data?.reviews || []).length === 0 ? (
                                    <EmptyState icon={MessageCircle} title={copy('No review requests', 'Hakuna maombi ya ukaguzi')} text={copy('You have not sent a review request yet.', 'Hujatuma ombi la review bado.')} />
                                ) : (
                                    <div className="space-y-3">
                                        {data.reviews.map((review) => (
                                            <div key={review.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-black text-slate-950">Request #{review.id}</p>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${review.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {review.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-700 mt-2 whitespace-pre-wrap">{review.merchant_message}</p>
                                                {review.admin_notes && (
                                                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{copy('Takeer response', 'Jibu la Takeer')}</p>
                                                        <p className="text-sm font-bold text-emerald-900 mt-1 whitespace-pre-wrap">{review.admin_notes}</p>
                                                        {review.action_taken && <p className="text-xs font-black text-emerald-700 mt-2">{copy('Action', 'Hatua')}: {actionLabel(review.action_taken)}</p>}
                                                    </div>
                                                )}
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">
                                                    {copy('Sent', 'Imetumwa')} {formatDate(review.created_at)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-start gap-3">
                                    <MessageCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                                    <div>
                                <h2 className="text-lg font-black text-slate-900">{copy('Request Review', 'Omba Ukaguzi')}</h2>
                                <p className="text-sm text-slate-600">{copy('Send details to Takeer if you believe a report or restriction needs review.', 'Tuma maelezo kwa Takeer kama unaamini ripoti au restriction inahitaji kupitiwa upya.')}</p>
                                    </div>
                                </div>
                                <textarea
                                    rows={4}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                    placeholder={copy('Explain what happened and what steps you took...', 'Eleza kilichotokea na hatua ulizochukua...')}
                                />
                                <Button
                                    className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
                                    onClick={requestReview}
                                    disabled={sending}
                                >
                                    {sending ? copy('Sending...', 'Inatuma...') : copy('Request Review', 'Omba Ukaguzi')}
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function Metric({ label, value }) {
    return (
        <div className="rounded-xl bg-white/70 border border-white p-3">
            <p className="text-[9px] font-black uppercase text-slate-400">{label}</p>
            <p className="text-lg font-black text-slate-950">{value}</p>
        </div>
    );
}

function EmptyState({ icon: Icon, title, text }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <Icon className="h-8 w-8 mx-auto text-slate-400 mb-2" />
            <p className="font-black text-slate-900">{title}</p>
            <p className="text-sm text-slate-500 mt-1">{text}</p>
        </div>
    );
}
