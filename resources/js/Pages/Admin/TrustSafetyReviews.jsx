import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

export default function TrustSafetyReviews() {
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
            toast.error('Failed to load review requests.');
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
            toast.error('Please add admin notes before resolving.');
            return;
        }

        setBusyId(reviewId);
        try {
            await axios.post(`/admin/api/trust-safety-reviews/${reviewId}`, {
                decision,
                admin_notes: adminNotes,
            });
            toast.success('Review resolved.');
            await loadReviews();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not resolve review.');
        } finally {
            setBusyId(null);
        }
    };

    const formatDate = (value) => value
        ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
        : 'Unknown date';

    return (
        <AdminLayout title="Trust & Safety Reviews">
            <Head title="Trust & Safety Reviews | Takeer" />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Trust & Safety Reviews</h1>
                            <p className="text-sm text-slate-600">Merchant explanations and appeals for POS payment-link restrictions.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                        >
                            <option value="pending">Pending</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="dismissed">Dismissed</option>
                            <option value="all">All</option>
                        </select>
                        <Button variant="outline" onClick={loadReviews}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">Loading review requests...</CardContent>
                    </Card>
                ) : reviews.length === 0 ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">No review requests for this filter.</CardContent>
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
                                                <p className="font-black text-slate-900">{merchant.display_name || 'Merchant'}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${review.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {review.status}
                                                </span>
                                                {linksDisabled && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                        POS links disabled
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">@{merchant.username || '-'} · {owner.email || owner.phone_number || 'No contact'}</p>
                                            <p className="text-xs font-bold text-slate-400 mt-1">Requested {formatDate(review.created_at)}</p>
                                        </div>
                                        <Link href={`/admin/merchants/${merchant.id}/settings`}>
                                            <Button variant="outline">Merchant Settings</Button>
                                        </Link>
                                    </div>

                                    <CardContent className="p-4 space-y-4">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Merchant explanation</p>
                                            <p className="text-sm font-bold text-slate-800 mt-2 whitespace-pre-wrap">{review.merchant_message}</p>
                                        </div>

                                        {review.admin_notes && (
                                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                                                <p className="font-black flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Admin decision: {review.action_taken || 'reviewed'}</p>
                                                <p className="mt-2 whitespace-pre-wrap">{review.admin_notes}</p>
                                                <p className="text-xs font-bold mt-2">Reviewed {formatDate(review.reviewed_at)}</p>
                                            </div>
                                        )}

                                        {isPending && (
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
                                                <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">Admin notes to merchant</label>
                                                <textarea
                                                    rows={3}
                                                    value={notes[review.id] || ''}
                                                    onChange={(e) => setNotes((prev) => ({ ...prev, [review.id]: e.target.value }))}
                                                    placeholder="Explain what Takeer decided and why..."
                                                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        disabled={busyId === review.id}
                                                        onClick={() => resolveReview(review.id, 'reenable_pos_links')}
                                                    >
                                                        <ShieldCheck className="h-4 w-4 mr-2" />
                                                        Re-enable POS Links
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="border-amber-300 text-amber-800 hover:bg-amber-100"
                                                        disabled={busyId === review.id}
                                                        onClick={() => resolveReview(review.id, 'keep_restriction')}
                                                    >
                                                        Keep Restriction
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        disabled={busyId === review.id}
                                                        onClick={() => resolveReview(review.id, 'dismiss')}
                                                    >
                                                        Dismiss
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
