import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { 
    Users, 
    Search, 
    Smartphone, 
    TrendingUp, 
    Calendar, 
    ChevronRight,
    UserCircle2,
    ShoppingBag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { toast } from 'sonner';

export default function Customers({ merchant }) {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total_customers: 0,
        repeat_customers: 0,
    });

    const fetchCustomers = async (q = '') => {
        setLoading(true);
        try {
            const res = await window.axios.get('/api/retail/customers', { params: { q } });
            setCustomers(res.data.data || []);
            setStats({
                total_customers: res.data.total || 0,
                repeat_customers: (res.data.data || []).filter(c => c.order_count > 1).length
            });
        } catch (err) {
            console.error('Failed to load customers', err);
            toast.error('Imeshindwa kupakia orodha ya wateja.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchCustomers(searchQuery);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: merchant.currency?.code || 'TZS',
            minimumFractionDigits: 0,
        }).format(val);
    };

    return (
        <AppLayout>
            <Head title={`Customers | ${merchant.display_name}`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                            Customer Base <Users className="h-8 w-8 text-brand-600" />
                        </h1>
                        <p className="text-muted-foreground">Analyze and manage your store's customer database.</p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="glass-card border-brand-50 shadow-sm bg-white">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center">
                                <Users className="h-6 w-6 text-brand-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Customers</p>
                                <h3 className="text-2xl font-black text-gray-900">{stats.total_customers}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card border-brand-50 shadow-sm bg-white">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Repeat Buyers</p>
                                <h3 className="text-2xl font-black text-gray-900">{stats.repeat_customers}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="glass-card border-brand-50 shadow-sm bg-white">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                                <ShoppingBag className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer Retention</p>
                                <h3 className="text-2xl font-black text-gray-900">
                                    {stats.total_customers > 0 ? Math.round((stats.repeat_customers / stats.total_customers) * 100) : 0}%
                                </h3>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            placeholder="Search by name or phone number..."
                            className="pl-10 h-12 rounded-2xl border-brand-100 shadow-sm focus:ring-brand-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Customer List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="py-20 text-center flex flex-col items-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mb-4"></div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pakia Wateja...</p>
                        </div>
                    ) : customers.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {customers.map((c) => (
                                <Card key={c.id} className="group hover:border-brand-500 cursor-pointer transition-all shadow-sm border-brand-50 bg-white">
                                    <CardContent className="p-6 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100">
                                                {c.user?.avatar_url ? (
                                                    <img src={c.user.avatar_url} className="h-full w-full object-cover rounded-2xl" />
                                                ) : (
                                                    <UserCircle2 className="h-8 w-8" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-black text-lg text-gray-900 flex items-center gap-2">
                                                    {c.name || 'Anonymous Guest'}
                                                    {c.order_count > 3 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">VIP</span>}
                                                </h3>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Smartphone className="h-3 w-3" /> {c.phone}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" /> Last order: {c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right flex items-center gap-8">
                                            <div className="hidden md:block">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Spent</p>
                                                <p className="text-xl font-black text-brand-600">{formatCurrency(c.total_spent)}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase mt-1">{c.order_count} Orders</p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-brand-300 group-hover:text-brand-600 transition-colors" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center flex flex-col items-center opacity-40">
                            <Users className="h-20 w-20 mb-4" />
                            <h3 className="text-xl font-black">No Customers Found</h3>
                            <p className="text-sm">Start making sales to build your customer database.</p>
                        </div>
                    )}
                </div>

            </div>
        </AppLayout>
    );
}
