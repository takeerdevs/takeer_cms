import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Bell, ShieldAlert, Users, Settings2, TrendingUp, Store, Flag, Shapes, ShieldCheck, Tags, Ruler, Activity, Gauge, BarChart3, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function AdminDashboard() {
    const { copy } = useLocale();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState(null);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || copy('Failed to load dashboard stats.', 'Imeshindikana kupakia takwimu za dashibodi.'));
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
        }, [copy]);

    const quickLinks = [
        { name: copy('Attention Center', 'Kituo cha Uangalizi'), href: '/admin/attention', icon: Bell, desc: copy('Review admin work that needs action', 'Kagua kazi za msimamizi zinazohitaji hatua') },
        { name: copy('Disputes', 'Migogoro'), href: '/admin/disputes', icon: ShieldAlert, desc: copy('Review and resolve order disputes', 'Kagua na tatua migogoro ya oda') },
        { name: copy('Service Risk', 'Hatari za Huduma'), href: '/admin/service-risk', icon: ShieldCheck, desc: copy('Monitor service credentials, disputes, and regulated listings', 'Fuatilia sifa za huduma, migogoro na matangazo yaliyodhibitiwa') },
        { name: copy('Notifications', 'Arifa'), href: '/admin/notifications', icon: Bell, desc: copy('Monitor SMS, WhatsApp, and email outbox logs', 'Fuatilia kumbukumbu za SMS, WhatsApp na barua pepe') },
        { name: copy('Users', 'Watumiaji'), href: '/admin/users', icon: Users, desc: copy('Manage all platform users', 'Simamia watumiaji wote wa jukwaa') },
        { name: copy('Merchants', 'Wauzaji'), href: '/admin/merchants', icon: Store, desc: copy('Control merchant account access and trust', 'Dhibiti ufikiaji na uaminifu wa akaunti za wauzaji') },
        { name: copy('Content Reports', 'Ripoti za Maudhui'), href: '/admin/content-reports', icon: Flag, desc: copy('Moderate reported content', 'Simamia maudhui yaliyoripotiwa') },
        { name: copy('System Health', 'Afya ya Mfumo'), href: '/health', icon: Activity, desc: copy('View current platform readiness checks', 'Angalia ukaguzi wa utayari wa jukwaa'), external: true },
        { name: 'Horizon', href: '/admin/horizon', icon: Gauge, desc: copy('Monitor queues, workers, failed jobs, and throughput', 'Fuatilia foleni, wafanyakazi, kazi zilizoshindikana na mtiririko'), external: true },
        { name: copy('Categories', 'Kategoria'), href: '/admin/categories', icon: Shapes, desc: copy('Manage category tree and attributes', 'Simamia mti wa kategoria na sifa') },
        { name: copy('Brands & Models', 'Chapa na Miundo'), href: '/admin/brands', icon: Tags, desc: copy('Manage reusable brand and model catalog', 'Simamia orodha ya chapa na miundo inayotumika tena') },
        { name: copy('Sellable Units', 'Vipimo vya Uuzaji'), href: '/admin/sellable-units', icon: Ruler, desc: copy('Manage units, conversions, and quick quantities', 'Simamia vipimo, ubadilishaji na kiasi cha haraka') },
        { name: copy('Payment Operations', 'Uendeshaji wa Malipo'), href: '/admin/payment-operations', icon: Activity, desc: copy('Review provider payouts, callbacks, and reconciliation breaks', 'Kagua malipo ya PSP, callbacks na tofauti za upatanisho') },
        { name: copy('Legal Documents', 'Nyaraka za Sheria'), href: '/admin/legal-documents', icon: FileText, desc: copy('Approve and activate documents required before merchant publishing', 'Idhinisha na washe nyaraka zinazohitajika kabla ya merchant kuchapisha') },
        { name: copy('General Settings', 'Mipangilio ya Jumla'), href: '/admin/settings', icon: Settings2, desc: copy('Configure platform-wide non-AI defaults', 'Sanidi mipangilio ya jumla ya jukwaa isiyo ya AI') },
        { name: copy('AI Settings', 'Mipangilio ya AI'), href: '/admin/ai-settings', icon: Settings2, desc: copy('Configure AI providers and keys', 'Sanidi watoa huduma na funguo za AI') },
        { name: copy('AI Usage Audit', 'Ukaguzi wa matumizi ya AI'), href: '/admin/ai-usage', icon: BarChart3, desc: copy('Compare model cost and task usage over time', 'Linganisha gharama za model na matumizi kwa muda') },
    ];

    return (
        <AdminLayout title={copy('Admin Dashboard', 'Dashibodi ya Msimamizi')}>
            <Head title={`${copy('Admin Dashboard', 'Dashibodi ya Msimamizi')} | Takeer`} />

            <div className="space-y-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900">{copy('Platform Control Center', 'Kituo cha Udhibiti wa Jukwaa')}</h1>
                    <p className="text-slate-600 mt-1 text-sm">{copy('Live overview and quick access to core admin controls.', 'Muhtasari wa moja kwa moja na ufikiaji wa haraka wa udhibiti muhimu wa msimamizi.')}</p>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                        <p className="text-sm font-bold text-slate-900">{copy('Global Platform Search', 'Utafutaji wa Jukwaa Zima')}</p>
                        <div className="flex gap-2">
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={copy('Search users, merchants, products, posts, orders...', 'Tafuta watumiaji, wauzaji, bidhaa, machapisho, oda...')}
                                className="bg-white border-slate-300 text-slate-900"
                            />
                            <Button
                                variant="outline"
                                disabled={searching}
                                onClick={async () => {
                                    if ((search || '').trim().length < 2) {
                                        toast.error(copy('Enter at least 2 characters.', 'Ingiza angalau herufi 2.'));
                                        return;
                                    }
                                    setSearching(true);
                                    try {
                                        const res = await fetch(`/admin/api/search?q=${encodeURIComponent(search)}`, { headers: { Accept: 'application/json' } });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.message || copy('Search failed.', 'Utafutaji umeshindikana.'));
                                        setSearchResults(data);
                                    } catch (err) {
                                        toast.error(err.message);
                                    } finally {
                                        setSearching(false);
                                    }
                                }}
                            >
                                {searching ? copy('Searching...', 'Inatafuta...') : copy('Search', 'Tafuta')}
                            </Button>
                        </div>
                        {searchResults && (
                            <div className="grid md:grid-cols-2 gap-3 text-sm">
                                <SearchGroup title={copy('Users', 'Watumiaji')} items={(searchResults.users || []).map((x) => `${x.name || '-'} (${x.phone_number || '-'})`)} copy={copy} />
                                <SearchGroup title={copy('Merchants', 'Wauzaji')} items={(searchResults.merchants || []).map((x) => `${x.display_name || '-'} (@${x.username || '-'})`)} copy={copy} />
                                <SearchGroup title={copy('Products', 'Bidhaa')} items={(searchResults.products || []).map((x) => `${x.title || '-'} [${x.type || '-'}]`)} copy={copy} />
                                <SearchGroup title={copy('Posts', 'Machapisho')} items={(searchResults.posts || []).map((x) => `${x.title || x.caption || '-'} (id:${x.id})`)} copy={copy} />
                                <SearchGroup title={copy('Orders', 'Oda')} items={(searchResults.orders || []).map((x) => `#${x.id} - ${x.payment_status || '-'}`)} copy={copy} />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { label: copy('Total Users', 'Watumiaji Wote'), key: 'total_users', icon: Users, tone: 'text-sky-700' },
                        { label: copy('Total Merchants', 'Wauzaji Wote'), key: 'total_merchants', icon: Store, tone: 'text-indigo-700' },
                        { label: copy('Total Orders', 'Oda Zote'), key: 'total_orders', icon: TrendingUp, tone: 'text-emerald-700' },
                        { label: copy('Open Disputes', 'Migogoro Inayoendelea'), key: 'open_disputes', icon: ShieldAlert, tone: 'text-red-700' },
                        { label: copy('Pending Provider Payouts', 'Malipo ya PSP Yanayosubiri'), key: 'pending_provider_payouts', icon: Activity, tone: 'text-amber-700' },
                        { label: copy('Admin Accounts', 'Akaunti za Wasimamizi'), key: 'total_admins', icon: Settings2, tone: 'text-purple-700' },
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
                    <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-widest mb-4">{copy('Quick Links', 'Viungo vya Haraka')}</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {quickLinks.map(({ name, href, icon: Icon, desc, external }) => {
                            const content = (
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
                            );

                            return external ? (
                                <a key={href} href={href}>
                                    {content}
                                </a>
                            ) : (
                                <Link key={href} href={href}>
                                    {content}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function SearchGroup({ title, items, copy }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-900 mb-2">{title}</p>
            {items.length === 0 ? (
                <p className="text-slate-500 text-xs">{copy('No matches', 'Hakuna matokeo')}</p>
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
