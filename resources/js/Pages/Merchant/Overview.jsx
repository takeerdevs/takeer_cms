import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { BarChart3, BookOpenText, CalendarClock, ChevronRight, Loader2, Package, ReceiptText, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function Overview({ merchantUsername }) {
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    const loadOverview = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/merchant/${merchantUsername}/overview/api?days=${days}`);
            setData(response.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load business overview.');
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

    return (
        <AppLayout>
            <Head title="Business Overview | Takeer" />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Reports</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Business Overview</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">One owner view across sales, catalog, bookings, customers, learning, team, and bookkeeping.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={days} onChange={(event) => setDays(Number(event.target.value))}>
                            <option value={7}>7 days</option>
                            <option value={30}>30 days</option>
                            <option value={90}>90 days</option>
                            <option value={365}>365 days</option>
                        </select>
                        <Button variant="outline" onClick={loadOverview} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card><CardContent className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></CardContent></Card>
                ) : (
                    <>
                        <div className="grid gap-3 md:grid-cols-4">
                            <Metric icon={BarChart3} label="Revenue" value={money(summary.revenue)} />
                            <Metric icon={ShoppingBag} label="Paid orders" value={summary.paid_orders ?? 0} />
                            <Metric icon={Users} label="Customers" value={summary.customers ?? 0} />
                            <Metric icon={CalendarClock} label="Upcoming bookings" value={(summary.upcoming_bookings ?? 0) + (summary.upcoming_sessions ?? 0)} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                            <ReportCard title="Catalog" icon={Package} rows={[
                                ['Physical products', catalog.physical],
                                ['Digital downloads', catalog.digital],
                                ['Services', catalog.services],
                                ['Posts', catalog.posts],
                                ['Bundles/courses', catalog.bundles],
                                ['Subscriptions', catalog.subscriptions],
                                ['Low stock', catalog.low_stock],
                            ]} />
                            <ReportCard title="Operations" icon={ReceiptText} rows={[
                                ['Pending orders', operations.pending_orders],
                                ['Pending service requests', operations.pending_service_requests],
                                ['Active staff', operations.active_staff],
                                ['Bookkeeping income', money(operations.bookkeeping_income)],
                                ['Bookkeeping expenses', money(operations.bookkeeping_expenses)],
                                ['Pending review', operations.bookkeeping_pending_review],
                            ]} />
                            <ReportCard title="Learning & Members" icon={BookOpenText} rows={[
                                ['Enrollments', learning.enrollments],
                                ['Active members', learning.active_members],
                                ['Service requests', summary.service_requests],
                                ['Average order value', money(summary.average_order_value)],
                                ['Bookkeeping profit', money(summary.bookkeeping_profit)],
                            ]} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                            <Card>
                                <CardHeader><CardTitle>Mapato kwa Zana</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    {(data?.module_revenue || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No paid revenue in this period.</p>
                                    ) : data.module_revenue.map((row) => (
                                        <div key={row.key} className="rounded-lg border border-border p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="font-black">{row.label}</p>
                                                    <p className="text-xs text-muted-foreground">{row.orders} orders</p>
                                                </div>
                                                <p className="font-black">{money(row.revenue)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    {(data?.recent_activity || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No activity yet.</p>
                                    ) : data.recent_activity.map((item, index) => (
                                        <div key={index} className="rounded-lg bg-muted/40 p-3">
                                            <p className="font-semibold">{item.label}</p>
                                            <p className="text-xs text-muted-foreground">{item.status} · {money(item.amount)} · {formatDate(item.created_at)}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline"><Link href={`/merchant/${merchantUsername}/orders`}>Orders <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
                            <Button asChild variant="outline"><Link href={`/merchant/${merchantUsername}/bookings`}>Bookings <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
                            <Button asChild variant="outline"><Link href={`/merchant/${merchantUsername}/customers`}>Customers <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function Metric({ icon: Icon, label, value }) {
    return <Card><CardContent className="p-4"><Icon className="h-5 w-5 text-muted-foreground" /><p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-black">{value}</p></CardContent></Card>;
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

function money(value) {
    return `TZS ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
    return value ? new Date(value).toLocaleDateString() : 'N/A';
}
