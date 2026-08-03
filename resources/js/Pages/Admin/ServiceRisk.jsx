import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { AlertTriangle, BadgeCheck, RefreshCw, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useLocale } from '@/lib/i18n';

export default function ServiceRisk() {
    const { copy } = useLocale();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyMerchantId, setBusyMerchantId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/api/service-risk');
            setData(res.data || {});
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Failed to load service risk dashboard.', 'Imeshindikana kupakia dashibodi ya hatari za huduma.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const suspendMerchant = async (merchant, context = 'service risk') => {
        if (!merchant?.id || merchant.is_suspended) return;

        const confirmed = window.confirm(`${copy('Suspend', 'Simamisha')} ${merchant.display_name || merchant.username || copy('this merchant', 'muuzaji huyu')} ${copy('for', 'kwa')} ${context}?`);
        if (!confirmed) return;

        setBusyMerchantId(merchant.id);
        try {
            await axios.post(`/admin/api/merchants/${merchant.id}/service-risk/suspend`, {
                reason: `Suspended from Service Risk dashboard: ${context}.`,
            });
            toast.success(copy('Merchant suspended and strike recorded.', 'Muuzaji amesimamishwa na onyo limehifadhiwa.'));
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || copy('Could not suspend merchant.', 'Imeshindikana kumsimamisha muuzaji.'));
        } finally {
            setBusyMerchantId(null);
        }
    };

    const summary = data?.summary || {};

    return (
        <AdminLayout title={copy('Service Risk', 'Hatari za Huduma')}>
            <Head title={`${copy('Service Risk', 'Hatari za Huduma')} | Takeer`} />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{copy('Service Risk', 'Hatari za Huduma')}</h1>
                            <p className="text-sm text-slate-600">{copy('Operational view for service trust, credentials, disputes, and regulated listings.', 'Mwonekano wa uendeshaji wa uaminifu wa huduma, nyaraka, migogoro na matangazo yaliyodhibitiwa.')}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {copy('Refresh', 'Onyesha upya')}
                    </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <Metric label={copy('Pending Credentials', 'Nyaraka Zinazosubiri')} value={summary.pending_credentials || 0} tone="text-amber-700" />
                    <Metric label={copy('Expiring Soon', 'Zinaisha Hivi Karibuni')} value={summary.expiring_credentials || 0} tone="text-orange-700" />
                    <Metric label={copy('Missing Credentials', 'Nyaraka Zinazokosekana')} value={summary.regulated_services_missing_credentials || 0} tone="text-red-700" />
                    <Metric label={copy('Service Disputes', 'Migogoro ya Huduma')} value={summary.open_service_disputes || 0} tone="text-red-700" />
                    <Metric label={copy('Repeat Risk', 'Hatari Inayojirudia')} value={summary.repeat_dispute_merchants || 0} tone="text-purple-700" />
                </div>

                {loading ? (
                    <Card className="bg-white border-slate-200">
                        <CardContent className="py-14 text-center text-slate-500">{copy('Loading service risk...', 'Inapakia hatari za huduma...')}</CardContent>
                    </Card>
                ) : (
                    <div className="grid xl:grid-cols-2 gap-4">
                        <Panel title={copy('Credentials Waiting Review', 'Nyaraka Zinazosubiri Ukaguzi')} icon={BadgeCheck} empty={copy('No credentials waiting for review.', 'Hakuna nyaraka zinazosubiri ukaguzi.')} copy={copy}>
                            {(data?.pending_credentials || []).map((credential) => (
                                <RiskRow
                                    key={credential.id}
                                    title={credential.document_name}
                                    subtitle={`${credential.subcategory_name ? `${credential.category_name} / ${credential.subcategory_name}` : credential.category_name} · ${credential.issuer || copy('No issuer', 'Hakuna mtoa hati')}`}
                                    badge="pending"
                                    merchant={credential.merchant}
                                    href={credential.merchant?.id ? `/admin/merchants/${credential.merchant.id}` : null}
                                    copy={copy}
                                />
                            ))}
                        </Panel>

                        <Panel title={copy('Regulated Services Missing Credential', 'Huduma Zilizodhibitiwa Zisizo na Nyaraka')} icon={AlertTriangle} empty={copy('No regulated service is missing credentials.', 'Hakuna huduma iliyodhibitiwa isiyo na nyaraka.')} copy={copy}>
                            {(data?.regulated_services_missing_credentials || []).map((service) => (
                                <RiskRow
                                    key={service.id}
                                    title={service.title}
                                    subtitle={`${service.service_category || '-'} / ${service.service_subcategory || '-'} · ${service.required_documents?.join(', ') || service.risk_level}`}
                                    badge={service.risk_level}
                                    merchant={service.merchant}
                                    href={service.merchant?.id ? `/admin/merchants/${service.merchant.id}` : null}
                                    action={service.merchant?.is_suspended ? null : {
                                        label: copy('Suspend', 'Simamisha'),
                                        onClick: () => suspendMerchant(service.merchant, `${copy('regulated service missing', 'huduma iliyodhibitiwa haina')} ${service.required_documents?.join(', ') || copy('credential', 'hati')}`),
                                        disabled: busyMerchantId === service.merchant?.id,
                                    }}
                                    copy={copy}
                                />
                            ))}
                        </Panel>

                        <Panel title={copy('Credentials Expiring Soon', 'Nyaraka Zinazoisha Hivi Karibuni')} icon={AlertTriangle} empty={copy('No verified credential expires in the next 30 days.', 'Hakuna nyaraka iliyothibitishwa inayoisha ndani ya siku 30.')} copy={copy}>
                            {(data?.expiring_credentials || []).map((credential) => (
                                <RiskRow
                                    key={credential.id}
                                    title={credential.document_name}
                                    subtitle={`${credential.subcategory_name ? `${credential.category_name} / ${credential.subcategory_name}` : credential.category_name} · ${copy('expires', 'inaisha')} ${credential.expires_at}`}
                                    badge="expiring"
                                    merchant={credential.merchant}
                                    href={credential.merchant?.id ? `/admin/merchants/${credential.merchant.id}` : null}
                                    copy={copy}
                                />
                            ))}
                        </Panel>

                        <Panel title={copy('Open Service Disputes', 'Migogoro ya Huduma Iliyo Wazi')} icon={ShieldAlert} empty={copy('No open service disputes.', 'Hakuna migogoro ya huduma iliyo wazi.')} copy={copy}>
                            {(data?.disputed_requests || []).map((request) => (
                                <RiskRow
                                    key={request.id}
                                    title={request.product?.title || `${copy('Request', 'Ombi')} ${request.public_id}`}
                                    subtitle={`${request.customer_name || copy('Customer', 'Mteja')} · ${request.payment_status}/${request.delivery_status} · TZS ${Number(request.quoted_amount || 0).toLocaleString()}`}
                                    badge="disputed"
                                    merchant={request.merchant}
                                    href="/admin/disputes"
                                    copy={copy}
                                />
                            ))}
                        </Panel>

                        <Panel title={copy('Merchants With Repeat Service Disputes', 'Wauzaji Wenye Migogoro ya Huduma Inayojirudia')} icon={Store} empty={copy('No repeated service dispute pattern yet.', 'Hakuna muundo wa migogoro ya huduma unaojirudia bado.')} copy={copy}>
                            {(data?.repeat_dispute_merchants || []).map((row) => (
                                <RiskRow
                                    key={row.merchant_id}
                                    title={row.merchant?.display_name || `${copy('Merchant', 'Muuzaji')} ${row.merchant_id}`}
                                    subtitle={`${row.disputes_count} ${copy(row.disputes_count === 1 ? 'service dispute' : 'service disputes', row.disputes_count === 1 ? 'mgogoro wa huduma' : 'migogoro ya huduma')}`}
                                    badge="watch"
                                    merchant={row.merchant}
                                    href={row.merchant?.id ? `/admin/merchants/${row.merchant.id}` : null}
                                    action={row.merchant?.is_suspended ? null : {
                                        label: copy('Suspend', 'Simamisha'),
                                        onClick: () => suspendMerchant(row.merchant, `${row.disputes_count} service disputes`),
                                        disabled: busyMerchantId === row.merchant?.id,
                                    }}
                                    copy={copy}
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

function RiskRow({ title, subtitle, badge, merchant, href, action, copy }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 hover:bg-slate-100 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate">{title}</p>
                    <p className="text-xs font-semibold text-slate-600 mt-1">{subtitle}</p>
                    {merchant && (
                        <p className="text-xs text-slate-500 mt-1">@{merchant.username || '-'} · {merchant.is_suspended ? copy('suspended', 'imesimamishwa') : copy('active', 'hai')}</p>
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
                            {copy('Open', 'Fungua')}
                        </Link>
                    )}
                    {action && (
                        <button
                            type="button"
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {action.disabled ? copy('Working...', 'Inafanya kazi...') : action.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
