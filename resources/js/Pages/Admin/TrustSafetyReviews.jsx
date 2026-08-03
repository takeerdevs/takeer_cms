import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useLocale } from '@/lib/i18n';

export default function TrustSafetyReviews() {
    const { copy, locale } = useLocale();
    const [reviews, setReviews] = useState([]);
    const [status, setStatus] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [notes, setNotes] = useState({});

    const loadReviews = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/admin/api/trust-safety-reviews?status=${status}`);
            setReviews(res.data?.data || []);
        } catch (err) {
            toast.error(copy('Failed to load review requests.', 'Imeshindikana kupakia maombi ya ukaguzi.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReviews();
    }, [status]);

    const resolveReview = async (reviewId, decision) => {
        const adminNotes = (notes[reviewId] || '').trim();
        if (!adminNotes) {
            toast.error(copy('Please add admin notes before resolving.', 'Tafadhali ongeza maelezo ya msimamizi kabla ya kutatua.'));
            return;
        }

        setBusyId(reviewId);
        try {
            await axios.post(`/admin/api/trust-safety-reviews/${reviewId}`, {
                decision,
                admin_notes: adminNotes,
            });
            toast.success(copy('Review resolved.', 'Ukaguzi umetatuliwa.'));
            await loadReviews();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not resolve review.', 'Imeshindikana kutatua ukaguzi.'));
        } finally {
            setBusyId(null);
        }
    };

    const formatDate = (value) => value
        ? new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
        : copy('Unknown date', 'Tarehe haijulikani');

    return (
        <AdminLayout title={copy('Trust & Safety Reviews', 'Ukaguzi wa Uaminifu na Usalama')}>
            <Head title={`${copy('Trust & Safety Reviews', 'Ukaguzi wa Uaminifu na Usalama')} | Takeer`} />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{copy('Trust & Safety Reviews', 'Ukaguzi wa Uaminifu na Usalama')}</h1>
                            <p className="text-sm text-slate-600">{copy('Merchant explanations and appeals for POS payment-link restrictions.', 'Maelezo na rufaa za wauzaji kuhusu vizuizi vya linki za malipo za POS.')}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                            <option value="pending">{copy('Pending', 'Inasubiri')}</option>
                            <option value="reviewed">{copy('Reviewed', 'Imekaguliwa')}</option>
                            <option value="dismissed">{copy('Dismissed', 'Imeondolewa')}</option>
                            <option value="all">{copy('All', 'Zote')}</option>
                        </select>
                        <Button variant="outline" onClick={loadReviews}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            {copy('Refresh', 'Onyesha upya')}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">{copy('Loading review requests...', 'Inapakia maombi ya ukaguzi...')}</CardContent>
                    </Card>
                ) : reviews.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">{copy('No review requests for this filter.', 'Hakuna maombi ya ukaguzi kwa kichujio hiki.')}</CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => {
                            const merchant = review.merchant || {};
                            const owner = merchant.user || {};
                            const linksDisabled = Boolean(merchant.retail_settings?.disable_pos_payment_links);
                            const isPending = review.status === 'pending';

                            return (
                                <Card key={review.id} className="bg-white border-slate-200 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Store className="h-4 w-4 text-slate-500" />
                                                <p className="font-black text-slate-900">{merchant.display_name || copy('Merchant', 'Muuzaji')}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${review.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {review.status}
                                                </span>
                                                {linksDisabled && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                        {copy('POS links disabled', 'Linki za POS zimezimwa')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">@{merchant.username || '-'} · {owner.email || owner.phone_number || 'No contact'}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-1">{copy('Requested', 'Imeombwa')} {formatDate(review.created_at)}</p>
                                        </div>
                                        <Link href={`/admin/merchants/${merchant.id}/settings`}>
                                            <Button variant="outline">{copy('Merchant Settings', 'Mipangilio ya Muuzaji')}</Button>
                                        </Link>
                                    </div>

                                    <CardContent className="p-4 space-y-4">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{copy('Merchant explanation', 'Maelezo ya muuzaji')}</p>
                                            <p className="text-sm font-bold text-slate-800 mt-2 whitespace-pre-wrap">{review.merchant_message}</p>
                                        </div>

                                        {review.admin_notes && (
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                                                <p className="font-black flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{copy('Admin decision', 'Uamuzi wa msimamizi')}: {review.action_taken || copy('reviewed', 'imekaguliwa')}</p>
                                                <p className="mt-2 whitespace-pre-wrap">{review.admin_notes}</p>
                                                <p className="text-xs font-bold mt-2">{copy('Reviewed', 'Imekaguliwa')} {formatDate(review.reviewed_at)}</p>
                                            </div>
                                        )}

                                        {isPending && (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
                                                <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">{copy('Admin notes to merchant', 'Maelezo ya msimamizi kwa muuzaji')}</label>
                                                <textarea
                                                    rows={3}
                                                    value={notes[review.id] || ''}
                                                    onChange={(e) => setNotes((prev) => ({ ...prev, [review.id]: e.target.value }))}
                                                    placeholder={copy('Explain what Takeer decided and why...', 'Eleza Takeer imeamua nini na kwa nini...')}
                                                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        disabled={busyId === review.id}
                                                        onClick={() => resolveReview(review.id, 'reenable_pos_links')}
                                                    >
                                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                                        {copy('Re-enable POS Links', 'Washa tena linki za POS')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="border-amber-300 text-amber-800 hover:bg-amber-100"
                                                        disabled={busyId === review.id}
                                                        onClick={() => resolveReview(review.id, 'keep_restriction')}
                                                    >
                                                        {copy('Keep Restriction', 'Endelea na kizuizi')}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        disabled={busyId === review.id}
                                                        onClick={() => resolveReview(review.id, 'dismiss')}
                                                    >
                                                        {copy('Dismiss', 'Ondoa')}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
