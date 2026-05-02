import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, CheckCircle2, Copy, ExternalLink, Gavel, Link as LinkIcon, MessageCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { toast } from 'sonner';

export default function TrustSafety({ merchant }) {
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
            toast.error(err.response?.data?.message || 'Imeshindwa kupakia Trust & Safety.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const formatDate = (val) => {
        if (!val) return 'Unknown date';
        return new Intl.DateTimeFormat('en-GB', {
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
            toast.error('Andika ujumbe mfupi kwa timu ya Takeer.');
            return;
        }

        setSending(true);
        try {
            const res = await window.axios.post('/api/retail/trust-safety/review-request', { message: body });
            toast.success(res.data?.message || 'Ombi limetumwa.');
            setMessage('');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Ombi halikuweza kutumwa.');
        } finally {
            setSending(false);
        }
    };

    const copyLink = async (url) => {
        if (!url) return;

        try {
            await navigator.clipboard.writeText(url);
            toast.success('POS payment link copied.');
        } catch (err) {
            toast.error('Could not copy link.');
        }
    };

    const status = data?.status || {};
    const isGood = status.standing === 'good';
    const actionLabel = (action) => ({
        reenable_pos_links: 'POS links re-enabled',
        keep_restriction: 'Restriction remains',
        dismiss: 'Request dismissed',
    }[action] || action || 'Reviewed');

    return (
        <AppLayout>
            <Head title={`Trust & Safety | ${merchant.display_name}`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                <div className="space-y-3">
                    <Button
                        variant="ghost"
                        className="h-9 px-2 text-slate-500 hover:text-slate-900"
                        onClick={() => router.visit(`/merchant/${merchant.username}/retail/dashboard`)}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" /> Retail Dashboard
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            Trust & Safety <Gavel className="h-8 w-8 text-amber-600" />
                        </h1>
                        <p className="text-muted-foreground">Angalia hali ya akaunti, ripoti za POS links, na maonyo kutoka Takeer.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-sm font-bold text-muted-foreground">Loading Trust & Safety...</div>
                ) : (
                    <>
                        <Card className={`${isGood ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'} shadow-sm`}>
                            <CardContent className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`h-12 w-12 rounded-xl grid place-items-center ${isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {isGood ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account status</p>
                                        <h2 className="text-2xl font-black text-slate-950 mt-1">
                                            {isGood ? 'Account in good standing' : 'Action may be needed'}
                                        </h2>
                                        <p className="text-sm font-bold text-slate-600 mt-1">
                                            {status.pos_payment_links_disabled
                                                ? 'POS payment links are currently disabled. You can still record cash or manual payments.'
                                                : 'POS payment links are currently available.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
                                    <Metric label="Strikes" value={status.strike_count || 0} />
                                    <Metric label="Open reports" value={status.open_pos_reports || 0} />
                                    <Metric label="POS reports" value={status.total_pos_reports || 0} />
                                </div>
                            </CardContent>
                        </Card>

                        {status.pos_payment_links_disabled && (
                            <Card className="bg-red-50 border-red-100">
                                <CardContent className="p-5 flex gap-3">
                                    <LinkIcon className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-black text-red-950">POS payment links zimezimwa kwa muda.</p>
                                        <p className="text-sm font-bold text-red-800 mt-1">
                                            Wateja hawataweza kulipa kupitia links za POS mpaka Takeer ikague na kuruhusu tena.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid lg:grid-cols-2 gap-5">
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardContent className="p-5 space-y-4">
                                    <h2 className="text-lg font-black text-slate-900">Warnings & Strikes</h2>
                                    {(data?.strikes || []).length === 0 ? (
                                        <EmptyState icon={CheckCircle2} title="No strikes" text="Hakuna onyo au strike iliyorekodiwa kwa akaunti hii." />
                                    ) : (
                                        <div className="space-y-3">
                                            {data.strikes.map((strike) => (
                                                <div key={strike.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="font-black text-amber-950 capitalize">{strike.severity}</p>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">{formatDate(strike.created_at)}</span>
                                                    </div>
                                                    <p className="text-sm font-bold text-amber-800 mt-2">{strike.notes || 'Takeer recorded a Trust & Safety action.'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardContent className="p-5 space-y-4">
                                    <h2 className="text-lg font-black text-slate-900">POS Link Reports</h2>
                                    {(data?.pos_reports || []).length === 0 ? (
                                        <EmptyState icon={ShieldCheck} title="No customer reports" text="Hakuna mteja aliyeripoti POS payment link." />
                                    ) : (
                                        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                                            {data.pos_reports.map((report) => (
                                                <div key={report.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-black text-slate-950">POS #{report.order?.public_id || report.order?.id || '-'}</p>
                                                            <p className="text-xs font-bold text-slate-500">{report.order?.customer_name || 'Customer'} · {report.order?.customer_phone || 'No phone'}</p>
                                                        </div>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {report.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700 mt-3">{report.reason}</p>
                                                    {report.admin_notes && <p className="text-xs font-bold text-slate-500 mt-2">Takeer note: {report.admin_notes}</p>}
                                                    {report.order?.payment_url && (
                                                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer payment link</p>
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
                                                                        Copy
                                                                    </Button>
                                                                    <a href={report.order.payment_url} target="_blank" rel="noreferrer">
                                                                        <Button type="button" variant="outline" className="h-10 rounded-lg">
                                                                            <ExternalLink className="h-4 w-4 mr-2" />
                                                                            Open
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
                                <h2 className="text-lg font-black text-slate-900">Review Requests</h2>
                                {(data?.reviews || []).length === 0 ? (
                                    <EmptyState icon={MessageCircle} title="No review requests" text="Hujatuma ombi la review bado." />
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
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Takeer response</p>
                                                        <p className="text-sm font-bold text-emerald-900 mt-1 whitespace-pre-wrap">{review.admin_notes}</p>
                                                        {review.action_taken && <p className="text-xs font-black text-emerald-700 mt-2">Action: {actionLabel(review.action_taken)}</p>}
                                                    </div>
                                                )}
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">
                                                    Sent {formatDate(review.created_at)}
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
                                        <h2 className="text-lg font-black text-slate-900">Request Review</h2>
                                        <p className="text-sm text-slate-600">Tuma maelezo kwa Takeer kama unaamini ripoti au restriction inahitaji kupitiwa upya.</p>
                                    </div>
                                </div>
                                <textarea
                                    rows={4}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                                    placeholder="Eleza kilichotokea na hatua ulizochukua..."
                                />
                                <Button
                                    className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
                                    onClick={requestReview}
                                    disabled={sending}
                                >
                                    {sending ? 'Inatuma...' : 'Request Review'}
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
