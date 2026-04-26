import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ShieldCheck, Clock, UserCheck, AlertCircle, ExternalLink, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

export default function AdminVerifications() {
    const [merchants, setMerchants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);

    const fetchPendingVerifications = (nextPage = 1) => {
        setLoading(true);
        fetch(`/admin/api/merchants?page=${nextPage}&status=pending`, { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load verifications.');
                return data;
            })
            .then(data => {
                const paged = data.merchants || {};
                setMerchants(paged.data || []);
                setPage(paged.current_page || 1);
                setLastPage(paged.last_page || 1);
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });
    };

    useEffect(() => { fetchPendingVerifications(1); }, []);

    return (
        <AdminLayout title="Identity Verifications">
            <Head title="Admin Verifications | Takeer" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-indigo-700" /> Identity Verifications
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">Review and approve pending KYC submissions from merchants.</p>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/50">
                                    <th className="p-4 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Merchant</th>
                                    <th className="p-4 text-center font-bold text-slate-500 uppercase tracking-wider text-[10px]">Type</th>
                                    <th className="p-4 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Owner Details</th>
                                    <th className="p-4 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">Submission Date</th>
                                    <th className="p-4 text-center font-bold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                                    <th className="p-4 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-12 text-slate-500 font-medium">Loading verifications...</td></tr>
                                ) : merchants.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 space-y-3">
                                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                                                <UserCheck className="h-6 w-6" />
                                            </div>
                                            <p className="text-slate-500 font-medium text-base">No pending verifications found.</p>
                                        </td>
                                    </tr>
                                ) : merchants.map((merchant) => (
                                    <tr key={merchant.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                                    {merchant.display_name?.charAt(0) || 'M'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{merchant.display_name}</p>
                                                    <p className="text-xs text-slate-500 font-medium">@{merchant.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                merchant.type === 'business' ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                            )}>
                                                {merchant.type || 'personal'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-medium text-slate-700">{merchant.user?.name || '—'}</p>
                                            <p className="text-xs text-slate-500">{merchant.user?.phone_number || merchant.user?.email || '—'}</p>
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                {merchant.updated_at ? new Date(merchant.updated_at).toLocaleDateString() : '—'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase border border-amber-100">
                                                <AlertCircle className="h-3 w-3" /> Pending Review
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link 
                                                href={`/admin/merchants/${merchant.id}`}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
                                            >
                                                Review <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {lastPage > 1 && (
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchPendingVerifications(page - 1)}>Prev</Button>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Page {page} of {lastPage}</span>
                        <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => fetchPendingVerifications(page + 1)}>Next</Button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
