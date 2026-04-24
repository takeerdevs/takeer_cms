import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { ArrowLeft, Box, Download, CalendarClock, BookOpen, Boxes, Crown } from 'lucide-react';
import { toast } from 'sonner';

const typeCards = [
    { key: 'physical', label: 'Physical Products', icon: Box },
    { key: 'digital', label: 'Digital Downloads', icon: Download },
    { key: 'service', label: 'Services / Bookings', icon: CalendarClock },
    { key: 'posts', label: 'Posts', icon: BookOpen },
    { key: 'bundles', label: 'Bundles', icon: Boxes },
    { key: 'subscriptions', label: 'Subscriptions', icon: Crown },
];

export default function MerchantDetails({ merchantId }) {
    const [merchant, setMerchant] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const title = useMemo(() => merchant?.display_name ? `${merchant.display_name} - Merchant Control` : 'Merchant Control', [merchant]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/admin/api/merchants/${merchantId}`, { headers: { Accept: 'application/json' } });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to load merchant details.');
                setMerchant(data.merchant);
                setSummary(data.summary || {});
            } catch (err) {
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [merchantId]);

    return (
        <AdminLayout title={title}>
            <Head title={title} />

            <div className="space-y-6">
                <div>
                    <Link href="/admin/merchants" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to merchants
                    </Link>
                    <h1 className="text-2xl font-black text-slate-900 mt-2">{merchant?.display_name || 'Merchant'}</h1>
                    <p className="text-sm text-slate-600">@{merchant?.username || '...'}</p>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <Metric label="Total orders" value={merchant?.orders_count ?? 0} />
                    <Metric label="Gross revenue" value={`TZS ${Number(summary?.gross_revenue || 0).toLocaleString()}`} />
                    <Metric label="Paid orders" value={summary?.paid_orders ?? 0} />
                    <Metric label="Open disputes" value={summary?.open_disputes ?? 0} />
                </div>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-5">
                        <h2 className="text-lg font-black text-slate-900 mb-3">KYC Information & Documents</h2>
                        {loading ? (
                            <p className="text-slate-500">Loading merchant profile...</p>
                        ) : (
                            <>
                                <div className="grid md:grid-cols-3 gap-3">
                                    <Detail label="Owner name" value={merchant?.user?.name} />
                                    <Detail label="Owner phone" value={merchant?.user?.phone_number} />
                                    <Detail label="Owner email" value={merchant?.user?.email} />
                                    <Detail label="Country" value={merchant?.country?.name ? `${merchant.country.name} (${merchant.country.iso_alpha2 || '-'})` : '-'} />
                                    <Detail label="Currency" value={merchant?.currency?.code || '-'} />
                                    <Detail label="KYC status" value={merchant?.kyc_status || 'unverified'} />
                                    <Detail label="Subaccount ID" value={merchant?.subaccount_id || '-'} />
                                    <Detail label="Verified" value={merchant?.is_verified ? 'Yes' : 'No'} />
                                    <Detail label="Suspended" value={merchant?.is_suspended ? 'Yes' : 'No'} />
                                </div>
                                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                                    No dedicated KYC document table is currently wired in the backend yet. This block is ready and can display IDs/files once you add the document model/storage links.
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {typeCards.map(({ key, label, icon: Icon }) => (
                        <Link key={key} href={key === 'posts' ? `/admin/feed?merchant=${merchantId}` : `/admin/merchants/${merchantId}/catalog/${key}`}>
                            <Card className="bg-white border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                                            <Icon className="h-5 w-5 text-brand-700" />
                                        </div>
                                        <span className="text-2xl font-black text-slate-900">
                                            {countForType(summary?.content_types, key)}
                                        </span>
                                    </div>
                                    <p className="mt-3 font-black text-slate-900">{label}</p>
                                    <p className="text-xs text-slate-600 mt-1">Read-only admin review and validation</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

function countForType(types, key) {
    if (!types) return 0;
    if (key === 'physical') return types.physical_products || 0;
    if (key === 'digital') return types.digital_downloads || 0;
    if (key === 'service') return types.service_bookings || 0;
    if (key === 'posts') return types.posts || 0;
    if (key === 'bundles') return types.bundles || 0;
    if (key === 'subscriptions') return types.subscriptions || 0;
    return 0;
}

function Metric({ label, value }) {
    return (
        <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="text-xl font-black text-slate-900">{value}</p>
            </CardContent>
        </Card>
    );
}

function Detail({ label, value }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="font-semibold text-slate-900">{value ?? '-'}</p>
        </div>
    );
}
