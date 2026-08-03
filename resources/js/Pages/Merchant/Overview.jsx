import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { BarChart3, BookOpenText, CalendarClock, ChevronRight, Loader2, Package, ReceiptText, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function Overview({ merchantUsername }) {
    const { copy } = useLocale();
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const loadOverview = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/merchant/${merchantUsername}/overview/api?days=${days}`);
            setData(response.data);
        } catch (error) {
            toast.error(error.response?.data?.message || copy('Failed to load business overview.', 'Imeshindikana kupakia muhtasari wa biashara.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOverview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [days, merchantUsername]);

    const summary = data?.summary || {};
    const catalog = data?.catalog || {};
    const operations = data?.operations || {};
    const learning = data?.learning || {};
    const currencyCode = data?.currency_code || 'TZS';

    return (
        <AppLayout>
            <Head title={`${copy('Business overview', 'Muhtasari wa biashara')} | Takeer`} />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{copy('Reports', 'Ripoti')}</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">{copy('Business overview', 'Muhtasari wa biashara')}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy('One owner view across sales, catalog, bookings, customers, learning, team, and bookkeeping.', 'Mwonekano mmoja wa mmiliki wa mauzo, katalogi, miadi, wateja, kujifunza, timu na hesabu.')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={days} onChange={(event) => setDays(Number(event.target.value))}>
                            <option value={7}>7 {copy('days', 'siku')}</option>
                            <option value={30}>30 {copy('days', 'siku')}</option>
                            <option value={90}>90 {copy('days', 'siku')}</option>
                            <option value={365}>365 {copy('days', 'siku')}</option>
                        </select>
                        <Button variant="outline" onClick={loadOverview} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {copy('Refresh', 'Onyesha upya')}
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card><CardContent className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></CardContent></Card>
                ) : (
                    <>
                        <div className="grid gap-3 md:grid-cols-4">
                            <Metric icon={BarChart3} label={copy('Revenue', 'Mapato')} value={money(summary.revenue, currencyCode)} />
                            <Metric icon={ShoppingBag} label={copy('Paid orders', 'Oda zilizolipwa')} value={summary.paid_orders ?? 0} />
                            <Metric icon={Users} label={copy('Customers', 'Wateja')} value={summary.customers ?? 0} />
                            <Metric icon={Users} label={copy('Followers', 'Wafuasi')} value={summary.followers ?? 0} hint={`+${summary.new_followers ?? 0} ${copy('in period', 'katika kipindi')}`} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            <ReportCard title={copy('Catalog', 'Katalogi')} icon={Package} rows={[
                                [copy('Physical products', 'Bidhaa za kawaida'), catalog.physical],
                                [copy('Digital downloads', 'Upakuaji wa kidijitali'), catalog.digital],
                                [copy('Services', 'Huduma'), catalog.services],
                                [copy('Posts', 'Machapisho'), catalog.posts],
                                [copy('Bundles/courses', 'Vifurushi/kozi'), catalog.bundles],
                                [copy('Subscriptions', 'Usajili'), catalog.subscriptions],
                                [copy('Low stock', 'Stoo ndogo'), catalog.low_stock],
                            ]} />
                            <ReportCard title={copy('Operations', 'Uendeshaji')} icon={ReceiptText} rows={[
                                [copy('Pending orders', 'Oda zinazosubiri'), operations.pending_orders],
                                [copy('Pending service requests', 'Maombi ya huduma yanayosubiri'), operations.pending_service_requests],
                                [copy('Active staff', 'Wahudumu hai'), operations.active_staff],
                                [copy('Bookkeeping income', 'Mapato ya hesabu'), money(operations.bookkeeping_income, currencyCode)],
                                [copy('Bookkeeping expenses', 'Matumizi ya hesabu'), money(operations.bookkeeping_expenses, currencyCode)],
                                [copy('Pending review', 'Inasubiri ukaguzi'), operations.bookkeeping_pending_review],
                            ]} />
                            <ReportCard title={copy('Learning & members', 'Kujifunza na wanachama')} icon={BookOpenText} rows={[
                                [copy('Enrollments', 'Usajili'), learning.enrollments],
                                [copy('Active members', 'Wanachama hai'), learning.active_members],
                                [copy('Service requests', 'Maombi ya huduma'), summary.service_requests],
                                [copy('Average order value', 'Wastani wa thamani ya oda'), money(summary.average_order_value, currencyCode)],
                                [copy('Bookkeeping profit', 'Faida ya hesabu'), money(summary.bookkeeping_profit, currencyCode)],
                            ]} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                            <Card>
                                <CardHeader><CardTitle>{copy('Revenue by tool', 'Mapato kwa zana')}</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    {(data?.module_revenue || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">{copy('No paid revenue in this period.', 'Hakuna mapato yaliyolipwa katika kipindi hiki.')}</p>
                                    ) : data.module_revenue.map((row) => (
                                        <div key={row.key} className="rounded-lg border border-border p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-black">{row.label}</p>
                                                    <p className="text-xs text-muted-foreground">{row.orders} {copy('orders', 'oda')}</p>
                                                </div>
                                                <p className="font-black">{money(row.revenue, currencyCode)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>{copy('Recent activity', 'Shughuli za hivi karibuni')}</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    {(data?.recent_activity || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">{copy('No activity yet.', 'Hakuna shughuli bado.')}</p>
                                    ) : data.recent_activity.map((item, index) => (
                                        <div key={index} className="rounded-lg bg-muted/40 p-3">
                                            <p className="font-semibold">{item.label}</p>
                                            <p className="text-xs text-muted-foreground">{item.status} · {money(item.amount, currencyCode)} · {formatDate(item.created_at, copy)}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline"><Link href={`/merchant/${merchantUsername}/orders`}>{copy('Orders', 'Oda')} <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
                            <Button asChild variant="outline"><Link href={`/merchant/${merchantUsername}/bookings`}>{copy('Bookings', 'Miadi')} <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
                            <Button asChild variant="outline"><Link href={`/merchant/${merchantUsername}/customers`}>{copy('Customers', 'Wateja')} <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function Metric({ icon: Icon, label, value, hint }) {
    return <Card><CardContent className="p-4"><Icon className="h-5 w-5 text-muted-foreground" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-black">{value}</p>{hint && <p className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</p>}</CardContent></Card>;
}

function ReportCard({ title, icon: Icon, rows }) {
    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-black">{value ?? 0}</span>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function money(value, currency = 'TZS') {
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
            maximumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
        }).format(Number(value || 0));
    } catch {
        return `${currency} ${Number(value || 0).toLocaleString()}`;
    }
}

function formatDate(value, copy = (english) => english) {
    return value ? new Date(value).toLocaleDateString() : copy('N/A', 'Haipo');
}
