import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Bell, ShieldAlert, Users, ArrowDownToLine, Settings2, TrendingUp, Store, Flag, Shapes, Wallet, ShieldCheck, Tags, Ruler } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load dashboard stats.');
                return data;
            })
            .then(data => {
                setStats(data.stats);
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });
    }, []);

    const quickLinks = [
        { name: 'Disputes', href: '/admin/disputes', icon: ShieldAlert, desc: 'Review and resolve order disputes' },
        { name: 'Service Risk', href: '/admin/service-risk', icon: ShieldCheck, desc: 'Monitor service credentials, disputes, and regulated listings' },
        { name: 'Notifications', href: '/admin/notifications', icon: Bell, desc: 'Monitor SMS, WhatsApp, and email outbox logs' },
        { name: 'Users', href: '/admin/users', icon: Users, desc: 'Manage all platform users' },
        { name: 'Merchants', href: '/admin/merchants', icon: Store, desc: 'Control merchant account access and trust' },
        { name: 'Content Reports', href: '/admin/content-reports', icon: Flag, desc: 'Moderate reported content' },
        { name: 'Categories', href: '/admin/categories', icon: Shapes, desc: 'Manage category tree and attributes' },
        { name: 'Brands & Models', href: '/admin/brands', icon: Tags, desc: 'Manage reusable brand and model catalog' },
        { name: 'Sellable Units', href: '/admin/sellable-units', icon: Ruler, desc: 'Manage units, conversions, and quick quantities' },
        { name: 'Platform Wallet', href: '/admin/platform-wallet', icon: Wallet, desc: 'Track Takeer fees, GMV, and transaction proof' },
        { name: 'Withdrawals', href: '/admin/withdrawals', icon: ArrowDownToLine, desc: 'Approve pending payout requests' },
        { name: 'Payout Settings', href: '/admin/payout-settings', icon: Wallet, desc: 'Control default payout release schedules' },
        { name: 'General Settings', href: '/admin/settings', icon: Settings2, desc: 'Configure platform-wide non-AI defaults' },
        { name: 'AI Settings', href: '/admin/ai-settings', icon: Settings2, desc: 'Configure AI providers and keys' },
    ];

    return (
        <AdminLayout title="Admin Dashboard">
            <Head title="Admin Dashboard | Takeer" />

            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Platform Control Center</h1>
                    <p className="text-slate-600 mt-1 text-sm">Live overview and quick access to core admin controls.</p>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                        <p className="text-sm font-bold text-slate-900">Global Platform Search</p>
                        <div className="flex gap-2">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search users, merchants, products, posts, orders..."
                                className="bg-white border-slate-300 text-slate-900"
                            />
                            <Button
                                variant="outline"
                                disabled={searching}
                                onClick={async () => {
                                    if ((search || '').trim().length < 2) {
                                        toast.error('Enter at least 2 characters.');
                                        return;
                                    }
                                    setSearching(true);
                                    try {
                                        const res = await fetch(`/admin/api/search?q=${encodeURIComponent(search)}`, { headers: { Accept: 'application/json' } });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.message || 'Search failed.');
                                        setSearchResults(data);
                                    } catch (err) {
                                        toast.error(err.message);
                                    } finally {
                                        setSearching(false);
                                    }
                                }}
                            >
                                {searching ? 'Searching...' : 'Search'}
                            </Button>
                        </div>
                        {searchResults && (
                            <div className="grid md:grid-cols-2 gap-3 text-sm">
                                <SearchGroup title="Users" items={(searchResults.users || []).map((x) => `${x.name || '-'} (${x.phone_number || '-'})`)} />
                                <SearchGroup title="Merchants" items={(searchResults.merchants || []).map((x) => `${x.display_name || '-'} (@${x.username || '-'})`)} />
                                <SearchGroup title="Products" items={(searchResults.products || []).map((x) => `${x.title || '-'} [${x.type || '-'}]`)} />
                                <SearchGroup title="Posts" items={(searchResults.posts || []).map((x) => `${x.title || x.caption || '-'} (id:${x.id})`)} />
                                <SearchGroup title="Orders" items={(searchResults.orders || []).map((x) => `#${x.id} - ${x.payment_status || '-'}`)} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Total Users', key: 'total_users', icon: Users, tone: 'text-sky-700' },
                        { label: 'Total Merchants', key: 'total_merchants', icon: Store, tone: 'text-indigo-700' },
                        { label: 'Total Orders', key: 'total_orders', icon: TrendingUp, tone: 'text-emerald-700' },
                        { label: 'Open Disputes', key: 'open_disputes', icon: ShieldAlert, tone: 'text-red-700' },
                        { label: 'Pending Withdrawals', key: 'pending_withdrawals', icon: ArrowDownToLine, tone: 'text-amber-700' },
                        { label: 'Admin Accounts', key: 'total_admins', icon: Settings2, tone: 'text-purple-700' },
                    ].map(({ label, key, icon: Icon, tone }) => (
                        <Card key={key} className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
                                    <Icon className={`h-4 w-4 ${tone}`} />
                                </div>
                                <p className={`text-3xl font-black ${tone}`}>
                                    {loading ? '—' : (stats?.[key] ?? 0)}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div>
                    <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-widest mb-4">Quick Links</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {quickLinks.map(({ name, href, icon: Icon, desc }) => (
                            <Link key={href} href={href}>
                                <Card className="border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                                            <Icon className="h-6 w-6 text-brand-700" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900">{name}</p>
                                            <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function SearchGroup({ title, items }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-900 mb-2">{title}</p>
            {items.length === 0 ? (
                <p className="text-slate-500 text-xs">No matches</p>
            ) : (
                <div className="space-y-1">
                    {items.slice(0, 6).map((item, idx) => (
                        <p key={`${title}-${idx}`} className="text-xs text-slate-700">{item}</p>
                    ))}
                </div>
            )}
        </div>
    );
}
