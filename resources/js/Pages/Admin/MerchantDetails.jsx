import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ArrowLeft, Box, Download, CalendarClock, BookOpen, Boxes, Crown, Settings, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const typeCards = [
    { key: 'physical', label: 'Physical Products', icon: Box },
    { key: 'digital', label: 'Digital Downloads', icon: Download },
    { key: 'service', label: 'Services / Bookings', icon: CalendarClock },
    { key: 'posts', label: 'Posts', icon: BookOpen },
    { key: 'bundles', label: 'Bundles', icon: Boxes },
    { key: 'subscriptions', label: 'Subscriptions', icon: Crown },
];

const credentialReviewItems = [
    { key: 'identity_matches', label: 'Owner identity matches merchant KYC' },
    { key: 'document_readable', label: 'Document is readable and complete' },
    { key: 'category_matches', label: 'License matches selected service category' },
    { key: 'issuer_trusted', label: 'Issuer/regulator is acceptable' },
    { key: 'not_expired', label: 'Document is not expired' },
];

export default function MerchantDetails({ merchantId }) {
    const [merchant, setMerchant] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [credentialReviews, setCredentialReviews] = useState({});

    const title = useMemo(() => merchant?.display_name ? `${merchant.display_name} - Merchant Control` : 'Merchant Control', [merchant]);

    const loadMerchant = async () => {
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

    useEffect(() => {
        loadMerchant();
    }, [merchantId]);

    const handleKycAction = async (action) => {
        let reason = '';
        if (action === 'reject') {
            reason = window.prompt('Please enter the reason for rejection:');
            if (!reason) return;
        } else {
            if (!window.confirm('Are you sure you want to verify this merchant?')) return;
        }

        try {
            const res = await fetch(`/admin/api/merchants/${merchantId}/${action === 'approve' ? 'approve-kyc' : 'reject-kyc'}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({ reason }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(data.message);
            await loadMerchant();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const updateCredentialReview = (credentialId, key, value) => {
        setCredentialReviews((current) => ({
            ...current,
            [credentialId]: {
                ...(current[credentialId] || {}),
                [key]: value,
            },
        }));
    };

    const handleCredentialAction = async (credential, action) => {
        const review = credentialReviews[credential.id] || {};
        let reason = '';
        if (action === 'reject') {
            reason = window.prompt('Reason for rejection:');
            if (!reason) return;
        } else {
            const missing = credentialReviewItems.filter((item) => !review[item.key]);
            if (missing.length > 0) {
                toast.error('Complete the review checklist before approval.');
                return;
            }
            if (!window.confirm(`Approve ${credential.document_name}?`)) {
                return;
            }
        }

        try {
            const res = await fetch(`/admin/api/merchants/${merchantId}/service-credentials/${credential.id}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.head.querySelector('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify(action === 'approve'
                    ? {
                        review_checklist: credentialReviewItems.reduce((payload, item) => ({
                            ...payload,
                            [item.key]: Boolean(review[item.key]),
                        }), {}),
                        review_notes: review.notes || '',
                    }
                    : {
                        reason,
                        review_notes: review.notes || '',
                    }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to update credential.');
            toast.success(data.message);
            await loadMerchant();
        } catch (err) {
            toast.error(err.message);
        }
    };

    return (
        <AdminLayout title={title}>
            <Head title={title} />

            <div className="space-y-6">
                <div>
                    <Link href="/admin/merchants" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to merchants
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-slate-900">{merchant?.display_name || 'Merchant'}</h1>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${merchant?.type === 'business' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                {merchant?.type || 'personal'}
                            </span>
                            {summary?.retail_settings?.disable_pos_payment_links && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-100">
                                    POS links disabled
                                </span>
                            )}
                        </div>
                        <Link href={`/admin/merchants/${merchantId}/settings`}>
                            <Button variant="outline">
                                <Settings className="h-4 w-4 mr-2" />
                                Merchant Settings
                            </Button>
                        </Link>
                    </div>
                    <p className="text-sm text-slate-600">@{merchant?.username || '...'}</p>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <Metric label="Total orders" value={merchant?.orders_count ?? 0} />
                    <Metric label="Gross revenue" value={`TZS ${Number(summary?.gross_revenue || 0).toLocaleString()}`} />
                    <Metric label="Open disputes" value={`${summary?.open_disputes ?? 0} / ${summary?.total_disputes ?? 0}`} />
                    <Metric label="POS reports" value={`${summary?.open_pos_link_reports ?? 0} / ${summary?.pos_link_reports ?? 0}`} />
                </div>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5 text-amber-700" />
                                    Trust & Safety
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    Merchant has {summary?.merchant_strikes ?? 0} recorded strike{Number(summary?.merchant_strikes || 0) === 1 ? '' : 's'}.
                                </p>
                            </div>
                            <Link href={`/admin/disputes`}>
                                <Button variant="outline">View Disputes</Button>
                            </Link>
                        </div>
                        {(summary?.recent_strikes || []).length > 0 && (
                            <div className="mt-4 space-y-2">
                                {summary.recent_strikes.map((strike) => (
                                    <div key={strike.id} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm">
                                        <p className="font-black text-amber-900">{strike.severity} · {strike.type}</p>
                                        <p className="text-amber-800 mt-1">{strike.notes || 'No notes recorded.'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-5">
                        <h2 className="text-lg font-black text-slate-900 mb-3">KYC Information & Documents</h2>
                        {loading ? (
                            <p className="text-slate-500">Loading merchant profile...</p>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-3 gap-3">
                                    <Detail label="Owner name" value={merchant?.user?.name} />
                                    <Detail label="Owner phone" value={merchant?.user?.phone_number} />
                                    <Detail label="Owner email" value={merchant?.user?.email} />
                                    <Detail label="Account Type" value={merchant?.type || 'personal'} />
                                    <Detail label="Country" value={merchant?.country?.name ? `${merchant.country.name} (${merchant.country.iso_alpha2 || '-'})` : '-'} />
                                    <Detail label="Currency" value={merchant?.currency?.code || '-'} />
                                    <Detail label="KYC status" value={merchant?.kyc_status || 'unverified'} />
                                    <Detail label="Subaccount ID" value={merchant?.subaccount_id || '-'} />
                                    <Detail label="Verified" value={merchant?.is_verified ? 'Yes' : 'No'} />
                                    <Detail label="Suspended" value={merchant?.is_suspended ? 'Yes' : 'No'} />
                                </div>

                                {merchant?.kyc && (
                                    <div className="mt-6 border-t pt-6 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Submitted KYC Data</h3>
                                            <div className="flex gap-2">
                                                <Button 
                                                    size="sm" 
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                    onClick={() => handleKycAction('approve')}
                                                    disabled={merchant.kyc_status === 'verified'}
                                                >
                                                    Verify Identity
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="text-red-600 border-red-200 hover:bg-red-50 font-bold"
                                                    onClick={() => handleKycAction('reject')}
                                                    disabled={merchant.kyc_status === 'verified'}
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2 grid grid-cols-2 gap-3">
                                                <Detail label="KYC Full Name" value={`${merchant.kyc.first_name} ${merchant.kyc.last_name}`} />
                                                <Detail label="ID Type" value={merchant.kyc.id_type} />
                                                <Detail label="ID Number" value={merchant.kyc.id_number} />
                                                <Detail label="Date of Birth" value={merchant.kyc.date_of_birth ? new Date(merchant.kyc.date_of_birth).toLocaleDateString() : '-'} />
                                                <Detail label="Gender" value={merchant.kyc.gender} />
                                                <Detail label="Occupation" value={merchant.kyc.occupation} />
                                                {merchant.kyc.tin_number && <Detail label="TIN Number" value={merchant.kyc.tin_number} />}
                                                {merchant.kyc.brela_number && <Detail label="BRELA Number" value={merchant.kyc.brela_number} />}
                                                <div className="col-span-2">
                                                    <Detail label="Residential Address" value={merchant.kyc.residential_address} />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ID Documents</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {merchant.kyc.id_front_signed_url ? (
                                                        <a href={merchant.kyc.id_front_signed_url} target="_blank" rel="noreferrer" className="block relative group aspect-[3/2] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                                            <img src={merchant.kyc.id_front_signed_url} alt="ID Front" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">View Front</div>
                                                        </a>
                                                    ) : (
                                                        <div className="aspect-[3/2] flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 text-slate-400 text-xs">No Front Image</div>
                                                    )}

                                                    {merchant.kyc.id_back_signed_url ? (
                                                        <a href={merchant.kyc.id_back_signed_url} target="_blank" rel="noreferrer" className="block relative group aspect-[3/2] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                                            <img src={merchant.kyc.id_back_signed_url} alt="ID Back" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">View Back</div>
                                                        </a>
                                                    ) : (
                                                        <div className="aspect-[3/2] flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 text-slate-400 text-xs">No Back Image</div>
                                                    )}

                                                    {merchant.kyc.business_license_signed_url && (
                                                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Business License</p>
                                                            <a href={merchant.kyc.business_license_signed_url} target="_blank" rel="noreferrer" className="block relative group aspect-[3/2] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                                                <img src={merchant.kyc.business_license_signed_url} alt="License" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">View License</div>
                                                            </a>
                                                        </div>
                                                    )}

                                                    {merchant.kyc.registration_doc_signed_url && (
                                                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registration Document</p>
                                                            <a href={merchant.kyc.registration_doc_signed_url} target="_blank" rel="noreferrer" className="block relative group aspect-[3/2] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                                                <img src={merchant.kyc.registration_doc_signed_url} alt="Reg Doc" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">View Document</div>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!merchant?.kyc && (
                                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                                        <p className="text-sm text-slate-600 font-medium">No KYC documents submitted yet.</p>
                                        <p className="text-xs text-slate-400 mt-1">Merchant has not started the verification process.</p>
                                    </div>
                                )}

                                <div className="mt-6 border-t pt-6 space-y-3">
                                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Service Credentials</h3>
                                    {(merchant?.service_credentials || []).length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                                            No service credentials submitted.
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {merchant.service_credentials.map((credential) => (
                                                <div key={credential.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                                        <div>
                                                            <p className="font-black text-slate-900">{credential.document_name}</p>
                                                            <p className="text-xs font-bold text-slate-500">
                                                                {credential.subcategory_name ? `${credential.category_name} / ${credential.subcategory_name}` : credential.category_name}
                                                            </p>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                {credential.document_type} · {credential.document_number || 'no number'} · {credential.issuer || 'no issuer'}
                                                                {credential.expires_at ? ` · expires ${new Date(credential.expires_at).toLocaleDateString()}` : ''}
                                                            </p>
                                                            {credential.rejection_reason && (
                                                                <p className="mt-2 text-xs font-bold text-red-700">{credential.rejection_reason}</p>
                                                            )}
                                                        </div>
                                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Review checklist</p>
                                                            <div className="mt-2 grid md:grid-cols-2 gap-2">
                                                                {credentialReviewItems.map((item) => (
                                                                    <label key={item.key} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={Boolean((credentialReviews[credential.id] || credential.review_checklist || {})[item.key])}
                                                                            disabled={credential.status === 'verified'}
                                                                            onChange={(event) => updateCredentialReview(credential.id, item.key, event.target.checked)}
                                                                        />
                                                                        {item.label}
                                                                    </label>
                                                                ))}
                                                            </div>
                                                            <textarea
                                                                className="mt-3 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                                                                placeholder="Admin review notes"
                                                                value={(credentialReviews[credential.id]?.notes ?? credential.review_notes) || ''}
                                                                disabled={credential.status === 'verified'}
                                                                onChange={(event) => updateCredentialReview(credential.id, 'notes', event.target.value)}
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                                                                credential.status === 'verified'
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : credential.status === 'expired'
                                                                        ? 'bg-slate-200 text-slate-700'
                                                                    : credential.status === 'rejected'
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {credential.status}
                                                            </span>
                                                            {credential.document_signed_url && (
                                                                <a href={credential.document_signed_url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-brand-700">
                                                                    View document
                                                                </a>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                                disabled={credential.status === 'verified'}
                                                                onClick={() => handleCredentialAction(credential, 'approve')}
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 border-red-200 hover:bg-red-50 font-bold"
                                                                disabled={credential.status === 'verified'}
                                                                onClick={() => handleCredentialAction(credential, 'reject')}
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
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
