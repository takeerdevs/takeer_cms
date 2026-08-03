import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { ArrowLeft, Box, Download, CalendarClock, BookOpen, Boxes, Crown, Settings, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

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
    const { copy } = useLocale();
    const [merchant, setMerchant] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [credentialReviews, setCredentialReviews] = useState({});

    const title = useMemo(() => merchant?.display_name ? `${merchant.display_name} - ${copy('Merchant control', 'Udhibiti wa mfanyabiashara')}` : copy('Merchant control', 'Udhibiti wa mfanyabiashara'), [merchant, copy]);
    const kycDocuments = useMemo(() => buildKycDocuments(merchant?.kyc), [merchant]);
    const identityDocuments = useMemo(() => kycDocuments.filter((document) => document.group === 'identity'), [kycDocuments]);
    const businessDocuments = useMemo(() => kycDocuments.filter((document) => document.group === 'business'), [kycDocuments]);
    const inheritedIdentitySource = merchant?.kyc?.inherited_identity_source;

    const loadMerchant = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/admin/api/merchants/${merchantId}`, { headers: { Accept: 'application/json' } });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || copy('Failed to load merchant details.', 'Imeshindikana kupakia maelezo ya mfanyabiashara.'));
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
            reason = window.prompt(copy('Please enter the reason for rejection:', 'Weka sababu ya kukataa:'));
            if (!reason) return;
        } else {
            if (!window.confirm(copy('Are you sure you want to verify this merchant?', 'Una uhakika unataka kumthibitisha mfanyabiashara huyu?'))) return;
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
                toast.error(copy('Complete the review checklist before approval.', 'Kamilisha orodha ya ukaguzi kabla ya kuidhinisha.'));
                return;
            }
            if (!window.confirm(`${copy('Approve', 'Idhinisha')} ${credential.document_name}?`)) {
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
            if (!res.ok) throw new Error(data.message || copy('Failed to update credential.', 'Imeshindikana kusasisha hati ya uthibitisho.'));
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
                        <ArrowLeft className="h-4 w-4 mr-1" /> {copy('Back to merchants', 'Rudi kwa wafanyabiashara')}
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-slate-900">{merchant?.display_name || copy('Merchant', 'Mfanyabiashara')}</h1>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${merchant?.type === 'business' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                                {merchant?.type || 'personal'}
                            </span>
                            {summary?.retail_settings?.disable_pos_payment_links && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-100">
                                {copy('POS links disabled', 'Viungo vya POS vimezimwa')}
                                </span>
                            )}
                            {hasReleaseOverrides(summary) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-100">
                                    {copy('Release override active', 'Marekebisho ya kutolewa yamewashwa')}
                                </span>
                            )}
                        </div>
                        <Link href={`/admin/merchants/${merchantId}/settings`}>
                            <Button variant="outline">
                                <Settings className="h-4 w-4 mr-2" />
                                {copy('Merchant settings', 'Mipangilio ya mfanyabiashara')}
                            </Button>
                        </Link>
                    </div>
                    <p className="text-sm text-slate-600">@{merchant?.username || '...'}</p>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <Metric label={copy('Total orders', 'Jumla ya oda')} value={merchant?.orders_count ?? 0} />
                    <Metric label={copy('Gross revenue', 'Mapato ghafi')} value={`TZS ${Number(summary?.gross_revenue || 0).toLocaleString()}`} />
                    <Metric label={copy('Open disputes', 'Migogoro wazi')} value={`${summary?.open_disputes ?? 0} / ${summary?.total_disputes ?? 0}`} />
                    <Metric label={copy('POS reports', 'Ripoti za POS')} value={`${summary?.open_pos_link_reports ?? 0} / ${summary?.pos_link_reports ?? 0}`} />
                </div>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5 text-amber-700" />
                                    {copy('Trust & safety', 'Uaminifu na usalama')}
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    {copy('Merchant has', 'Mfanyabiashara ana')} {summary?.merchant_strikes ?? 0} {copy('recorded strike(s).', 'onyo lililorekodiwa.')}
                                </p>
                            </div>
                            <Link href={`/admin/disputes`}>
                                <Button variant="outline">{copy('View disputes', 'Tazama migogoro')}</Button>
                            </Link>
                        </div>
                        {(summary?.recent_strikes || []).length > 0 && (
                            <div className="mt-4 space-y-2">
                                {summary.recent_strikes.map((strike) => (
                                    <div key={strike.id} className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm">
                                        <p className="font-black text-amber-900">{strike.severity} · {strike.type}</p>
                                        <p className="text-amber-800 mt-1">{strike.notes || copy('No notes recorded.', 'Hakuna dokezo lililorekodiwa.')}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200">
                    <CardContent className="p-5">
                        <h2 className="text-lg font-black text-slate-900 mb-3">{copy('KYC information & documents', 'Taarifa na hati za KYC')}</h2>
                        {loading ? (
                            <p className="text-slate-500">{copy('Loading merchant profile...', 'Inapakia wasifu wa mfanyabiashara...')}</p>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-3 gap-3">
                                    <Detail label={copy('Owner name', 'Jina la mmiliki')} value={merchant?.user?.name} />
                                    <Detail label={copy('Owner phone', 'Simu ya mmiliki')} value={merchant?.user?.phone_number} />
                                    <Detail label={copy('Owner email', 'Barua pepe ya mmiliki')} value={merchant?.user?.email} />
                                    <Detail label={copy('Account type', 'Aina ya akaunti')} value={merchant?.type || 'personal'} />
                                    <Detail label={copy('Country', 'Nchi')} value={merchant?.country?.name ? `${merchant.country.name} (${merchant.country.iso_alpha2 || '-'})` : '-'} />
                                    <Detail label={copy('Currency', 'Sarafu')} value={merchant?.currency?.code || '-'} />
                                    <Detail label={copy('KYC status', 'Hali ya KYC')} value={merchant?.kyc_status || 'unverified'} />
                                    <Detail label={copy('Subaccount ID', 'Namba ya subaccount')} value={merchant?.subaccount_id || '-'} />
                                    <Detail label={copy('Verified', 'Imethibitishwa')} value={merchant?.is_verified ? copy('Yes', 'Ndiyo') : copy('No', 'Hapana')} />
                                    <Detail label={copy('Suspended', 'Imesimamishwa')} value={merchant?.is_suspended ? copy('Yes', 'Ndiyo') : copy('No', 'Hapana')} />
                                </div>

                                {merchant?.kyc && (
                                    <div className="mt-6 border-t pt-6 space-y-6">
                                        <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">{copy('Submitted KYC Data', 'Taarifa za KYC zilizowasilishwa')}</h3>
                                                        {inheritedIdentitySource && (
                                                            <p className="mt-1 text-xs font-semibold text-slate-500">
                                                                {copy('Identity is already verified from', 'Utambulisho tayari umethibitishwa kutoka')} {' '}
                                                                <Link href={`/admin/merchants/${inheritedIdentitySource.merchant_id}`} className="text-brand-700 underline underline-offset-2">
                                                                    {inheritedIdentitySource.display_name}
                                                                </Link>
                                                                . {copy('Review the new business data and documents for this merchant.', 'Kagua taarifa mpya za biashara na nyaraka za mfanyabiashara huyu.')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button 
                                                            size="sm" 
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                            onClick={() => handleKycAction('approve')}
                                                            disabled={merchant.kyc_status === 'verified'}
                                                        >
                                                    {inheritedIdentitySource ? copy('Verify Business KYC', 'Thibitisha KYC ya biashara') : copy('Verify Identity', 'Thibitisha utambulisho')}
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="outline"
                                                    className="text-red-600 border-red-200 hover:bg-red-50 font-bold"
                                                    onClick={() => handleKycAction('reject')}
                                                    disabled={merchant.kyc_status === 'verified'}
                                                >
                                                    {copy('Reject', 'Kataa')}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2 grid grid-cols-2 gap-3">
                                                <Detail label={copy('KYC Full Name', 'Jina kamili la KYC')} value={`${merchant.kyc.first_name} ${merchant.kyc.last_name}`} />
                                                <Detail label={copy('Business Type', 'Aina ya biashara')} value={merchant.kyc.business_type || merchant.type || '-'} />
                                                <Detail label={copy('ID Type', 'Aina ya kitambulisho')} value={merchant.kyc.id_type} />
                                                <Detail label={copy('ID Number', 'Namba ya kitambulisho')} value={merchant.kyc.id_number} />
                                                <Detail label={copy('Date of Birth', 'Tarehe ya kuzaliwa')} value={merchant.kyc.date_of_birth ? new Date(merchant.kyc.date_of_birth).toLocaleDateString() : '-'} />
                                                <Detail label={copy('Gender', 'Jinsia')} value={merchant.kyc.gender} />
                                                <Detail label={copy('Occupation', 'Kazi')} value={merchant.kyc.occupation} />
                                                {merchant.kyc.tin_number && <Detail label={copy('TIN number', 'Namba ya TIN')} value={merchant.kyc.tin_number} />}
                                                {merchant.kyc.brela_number && <Detail label={copy('BRELA number', 'Namba ya BRELA')} value={merchant.kyc.brela_number} />}
                                                {merchant.kyc.rejection_reason && <Detail label={copy('Rejection Reason', 'Sababu ya kukataa')} value={merchant.kyc.rejection_reason} />}
                                                <div className="col-span-2">
                                                    <Detail label={copy('Residential Address', 'Anwani ya makazi')} value={merchant.kyc.residential_address} />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                            {inheritedIdentitySource ? copy('Verified identity documents', 'Nyaraka za utambulisho zilizothibitishwa') : copy('ID documents', 'Nyaraka za kitambulisho')}
                                                        </p>
                                                        {inheritedIdentitySource && (
                                                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-100">
                                                                {copy('Inherited', 'Zimerithiwa')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 grid grid-cols-1 gap-2">
                                                        {identityDocuments.map((document) => (
                                                            <KycDocumentCard key={document.key} document={document} />
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="border-t border-slate-100 pt-4">
                                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{copy('Business documents to review', 'Nyaraka za biashara za kukagua')}</p>
                                                    <div className="mt-2 grid grid-cols-1 gap-2">
                                                        {businessDocuments.length > 0 ? (
                                                            businessDocuments.map((document) => (
                                                                <KycDocumentCard key={document.key} document={document} />
                                                            ))
                                                        ) : (
                                                            <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-400">
                                                                {copy('No extra business documents submitted.', 'Hakuna nyaraka za ziada za biashara zilizowasilishwa.')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!merchant?.kyc && (
                                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                                        <p className="text-sm text-slate-600 font-medium">{copy('No KYC documents submitted yet.', 'Hakuna nyaraka za KYC zilizowasilishwa bado.')}</p>
                                        <p className="text-xs text-slate-400 mt-1">{copy('Merchant has not started the verification process.', 'Mfanyabiashara bado hajaianza mchakato wa uthibitishaji.')}</p>
                                    </div>
                                )}

                                <div className="mt-6 border-t pt-6 space-y-3">
                                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">{copy('Service Credentials', 'Hati za huduma')}</h3>
                                    {(merchant?.service_credentials || []).length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                                            {copy('No service credentials submitted.', 'Hakuna hati za huduma zilizowasilishwa.')}
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
                                                                {credential.document_type} · {credential.document_number || copy('no number', 'hakuna namba')} · {credential.issuer || copy('no issuer', 'hakuna mtoaji')}
                                                                {credential.expires_at ? ` · ${copy('expires', 'inaisha')} ${new Date(credential.expires_at).toLocaleDateString()}` : ''}
                                                            </p>
                                                            {credential.rejection_reason && (
                                                                <p className="mt-2 text-xs font-bold text-red-700">{credential.rejection_reason}</p>
                                                            )}
                                                        </div>
                                                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{copy('Review checklist', 'Orodha ya ukaguzi')}</p>
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
                                                                placeholder={copy('Admin review notes', 'Maelezo ya ukaguzi wa admin')}
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
                                                                    {copy('View document', 'Tazama hati')}
                                                                </a>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                                                disabled={credential.status === 'verified'}
                                                                onClick={() => handleCredentialAction(credential, 'approve')}
                                                            >
                                                                {copy('Approve', 'Idhinisha')}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 border-red-200 hover:bg-red-50 font-bold"
                                                                disabled={credential.status === 'verified'}
                                                                onClick={() => handleCredentialAction(credential, 'reject')}
                                                            >
                                                                {copy('Reject', 'Kataa')}
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
                                    <p className="mt-3 font-black text-slate-900">{copy(label, label === 'Physical Products' ? 'Bidhaa halisi' : label === 'Digital Downloads' ? 'Upakuaji wa kidijitali' : label === 'Services / Bookings' ? 'Huduma / Booking' : label === 'Posts' ? 'Machapisho' : label === 'Bundles' ? 'Vifurushi' : 'Usajili')}</p>
                                    <p className="text-xs text-slate-600 mt-1">{copy('Read-only admin review and validation', 'Ukaguzi na uthibitishaji wa admin wa kusoma tu')}</p>
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

function hasReleaseOverrides(summary) {
    const overrides = summary?.retail_settings?.payment_release_controls?.overrides || {};
    return Object.values(overrides).some((mode) => mode && mode !== 'platform_default');
}

function buildKycDocuments(kyc) {
    if (!kyc) return [];

    return [
        {
            key: 'id_front',
            label: 'ID Front',
            group: 'identity',
            signedUrl: kyc.id_front_signed_url,
            storedUrl: kyc.id_front_url,
        },
        {
            key: 'id_back',
            label: 'ID Back',
            group: 'identity',
            signedUrl: kyc.id_back_signed_url,
            storedUrl: kyc.id_back_url,
        },
        {
            key: 'tin_document',
            label: 'TIN Document',
            group: 'business',
            signedUrl: kyc.tin_document_signed_url,
            storedUrl: kyc.tin_document_url,
        },
        {
            key: 'business_license',
            label: 'Business License',
            group: 'business',
            signedUrl: kyc.business_license_signed_url,
            storedUrl: kyc.business_license_url,
        },
        {
            key: 'registration_doc',
            label: 'Registration Document',
            group: 'business',
            signedUrl: kyc.registration_doc_signed_url,
            storedUrl: kyc.registration_doc_url,
        },
    ].filter((document) => document.group === 'identity' || document.signedUrl || document.storedUrl);
}

function KycDocumentCard({ document }) {
    if (!document.signedUrl) {
        return (
            <div className="flex aspect-[3/2] items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-center text-xs font-semibold text-slate-400">
                {document.storedUrl ? `${document.label} preview unavailable` : `No ${document.label}`}
            </div>
        );
    }

    return (
        <a href={document.signedUrl} target="_blank" rel="noreferrer" className="block relative group aspect-[3/2] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <img src={document.signedUrl} alt={document.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 shadow-sm">
                {document.label}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                View {document.label}
            </div>
        </a>
    );
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
