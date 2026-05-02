import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { AlertTriangle, BadgeCheck, RefreshCw, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

export default function ServiceRisk() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyMerchantId, setBusyMerchantId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/api/service-risk');
            setData(res.data || {});
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load service risk dashboard.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const suspendMerchant = async (merchant, context = 'service risk') => {
        if (!merchant?.id || merchant.is_suspended) return;

        const confirmed = window.confirm(`Suspend ${merchant.display_name || merchant.username || 'this merchant'} for ${context}?`);
        if (!confirmed) return;

        setBusyMerchantId(merchant.id);
        try {
            await axios.post(`/admin/api/merchants/${merchant.id}/service-risk/suspend`, {
                reason: `Suspended from Service Risk dashboard: ${context}.`,
            });
            toast.success('Merchant suspended and strike recorded.');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not suspend merchant.');
        } finally {
            setBusyMerchantId(null);
        }
    };

    const summary = data?.summary || {};

    return (
        <AdminLayout title="Service Risk">
            <Head title="Service Risk | Takeer" />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Service Risk</h1>
                            <p className="text-sm text-slate-600">Operational view for service trust, credentials, disputes, and regulated listings.</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <Metric label="Pending Credentials" value={summary.pending_credentials || 0} tone="text-amber-700" />
                    <Metric label="Expiring Soon" value={summary.expiring_credentials || 0} tone="text-orange-700" />
                    <Metric label="Missing Credentials" value={summary.regulated_services_missing_credentials || 0} tone="text-red-700" />
                    <Metric label="Service Disputes" value={summary.open_service_disputes || 0} tone="text-red-700" />
                    <Metric label="Repeat Risk" value={summary.repeat_dispute_merchants || 0} tone="text-purple-700" />
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">Loading service risk...</CardContent>
                    </Card>
                ) : (
                    <div className="grid xl:grid-cols-2 gap-4">
                        <Panel title="Credentials Waiting Review" icon={BadgeCheck} empty="No credentials waiting for review.">
                            {(data?.pending_credentials || []).map((credential) => (
                                <RiskRow
                                    key={credential.id}
                                    title={credential.document_name}
                                    subtitle={`${credential.subcategory_name ? `${credential.category_name} / ${credential.subcategory_name}` : credential.category_name} · ${credential.issuer || 'No issuer'}`}
                                    badge="pending"
                                    merchant={credential.merchant}
                                    href={credential.merchant?.id ? `/admin/merchants/${credential.merchant.id}` : null}
                                />
                            ))}
                        </Panel>

                        <Panel title="Regulated Services Missing Credential" icon={AlertTriangle} empty="No regulated service is missing credentials.">
                            {(data?.regulated_services_missing_credentials || []).map((service) => (
                                <RiskRow
                                    key={service.id}
                                    title={service.title}
                                    subtitle={`${service.service_category || '-'} / ${service.service_subcategory || '-'} · ${service.required_documents?.join(', ') || service.risk_level}`}
                                    badge={service.risk_level}
                                    merchant={service.merchant}
                                    href={service.merchant?.id ? `/admin/merchants/${service.merchant.id}` : null}
                                    action={service.merchant?.is_suspended ? null : {
                                        label: 'Suspend',
                                        onClick: () => suspendMerchant(service.merchant, `regulated service missing ${service.required_documents?.join(', ') || 'credential'}`),
                                        disabled: busyMerchantId === service.merchant?.id,
                                    }}
                                />
                            ))}
                        </Panel>

                        <Panel title="Credentials Expiring Soon" icon={AlertTriangle} empty="No verified credential expires in the next 30 days.">
                            {(data?.expiring_credentials || []).map((credential) => (
                                <RiskRow
                                    key={credential.id}
                                    title={credential.document_name}
                                    subtitle={`${credential.subcategory_name ? `${credential.category_name} / ${credential.subcategory_name}` : credential.category_name} · expires ${credential.expires_at}`}
                                    badge="expiring"
                                    merchant={credential.merchant}
                                    href={credential.merchant?.id ? `/admin/merchants/${credential.merchant.id}` : null}
                                />
                            ))}
                        </Panel>

                        <Panel title="Open Service Disputes" icon={ShieldAlert} empty="No open service disputes.">
                            {(data?.disputed_requests || []).map((request) => (
                                <RiskRow
                                    key={request.id}
                                    title={request.product?.title || `Request ${request.public_id}`}
                                    subtitle={`${request.customer_name || 'Customer'} · ${request.payment_status}/${request.delivery_status} · TZS ${Number(request.quoted_amount || 0).toLocaleString()}`}
                                    badge="disputed"
                                    merchant={request.merchant}
                                    href="/admin/disputes"
                                />
                            ))}
                        </Panel>

                        <Panel title="Merchants With Repeat Service Disputes" icon={Store} empty="No repeated service dispute pattern yet.">
                            {(data?.repeat_dispute_merchants || []).map((row) => (
                                <RiskRow
                                    key={row.merchant_id}
                                    title={row.merchant?.display_name || `Merchant ${row.merchant_id}`}
                                    subtitle={`${row.disputes_count} service disputes`}
                                    badge="watch"
                                    merchant={row.merchant}
                                    href={row.merchant?.id ? `/admin/merchants/${row.merchant.id}` : null}
                                    action={row.merchant?.is_suspended ? null : {
                                        label: 'Suspend',
                                        onClick: () => suspendMerchant(row.merchant, `${row.disputes_count} service disputes`),
                                        disabled: busyMerchantId === row.merchant?.id,
                                    }}
                                />
                            ))}
                        </Panel>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function Metric({ label, value, tone }) {
    return (
        <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                <p className={`text-3xl font-black mt-2 ${tone}`}>{value}</p>
            </CardContent>
        </Card>
    );
}

function Panel({ title, icon: Icon, empty, children }) {
    const items = React.Children.toArray(children).filter(Boolean);

    return (
        <Card className="bg-white border-slate-200">
            <CardContent className="p-4 space-y-3">
                <h2 className="font-black text-slate-900 flex items-center gap-2">
                    <Icon className="h-5 w-5 text-brand-700" />
                    {title}
                </h2>
                {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm font-semibold text-slate-500">
                        {empty}
                    </div>
                ) : (
                    <div className="space-y-2">{items}</div>
                )}
            </CardContent>
        </Card>
    );
}

function RiskRow({ title, subtitle, badge, merchant, href, action }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 hover:bg-slate-100 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate">{title}</p>
                    <p className="text-xs font-semibold text-slate-600 mt-1">{subtitle}</p>
                    {merchant && (
                        <p className="text-xs text-slate-500 mt-1">@{merchant.username || '-'} · {merchant.is_suspended ? 'suspended' : 'active'}</p>
                    )}
                </div>
                <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700 shrink-0">
                    {badge}
                </span>
            </div>
            {(href || action) && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {href && (
                        <Link
                            href={href}
                            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-100"
                        >
                            Open
                        </Link>
                    )}
                    {action && (
                        <button
                            type="button"
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {action.disabled ? 'Working...' : action.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
