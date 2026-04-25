import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, usePage, useForm } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/Components/ui/Dialog';
import {
    Wallet, ArrowLeft, ArrowUpRight, ArrowDownLeft, Store, ShieldCheck, HelpCircle, History, Clock, FileCheck
} from 'lucide-react';
import { router } from '@inertiajs/react';

export default function MerchantWallet({ merchantUsername, merchantName, wallet, merchant }) {
    const { auth, flash, errors: pageErrors } = usePage().props;
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('earnings');

    const storageUsedMb = merchant?.storage_used_mb || 0;
    const storageLimitMb = merchant?.storage_limit_mb || 500;
    const storagePercentage = merchant?.storage_percentage || 0;
    const tier = merchant?.subscription_tier || 'free';

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        amount: '',
        method: 'mobile_money',
    });

    const getFilteredHistory = () => {
        if (activeTab === 'earnings') {
            return history.filter(item => item.type === 'order_revenue' || item.type === 'platform_fee');
        }
        return history.filter(item => item.type === 'withdrawal');
    };

    useEffect(() => {
        fetchHistory();
    }, [merchantUsername]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // Adjust the URL if you change where the axios object lives, assuming window.axios
            const res = await window.axios.get(`/merchant/${merchantUsername}/wallet/api/history`);
            setHistory(res.data.history || []);
        } catch (error) {
            console.error('Failed to fetch wallet history', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = (e) => {
        e.preventDefault();
        post(`/merchant/${merchantUsername}/wallet/withdraw`, {
            onSuccess: () => {
                reset();
                setIsWithdrawModalOpen(false);
                fetchHistory(); // Refresh history slightly later
            },
        });
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-TZ', {
            style: 'currency',
            currency: 'TZS',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('sw-TZ', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    return (
        <AppLayout>
            <Head title={`Pochi ya ${merchantName || 'Biashara Yangu'} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.visit(`/merchant/${merchantUsername}/dashboard`)}
                            className="rounded-xl h-10 w-10 shrink-0 bg-muted/50 hover:bg-muted"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                                Pochi Yangu <Wallet className="h-5 w-5 text-brand-600" />
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Usimamizi wa mapato ya <span className="font-semibold text-foreground">{merchantName || 'Biashara'}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status Messages */}
                {flash?.success && (
                    <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex items-center gap-3 font-medium">
                        <FileCheck className="h-5 w-5 shrink-0" />
                        <div>{flash.success}</div>
                    </div>
                )}
                {pageErrors?.amount && (
                    <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 font-medium">
                        {pageErrors.amount}
                    </div>
                )}

                {/* Balances & Storage */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="md:col-span-2 bg-gradient-to-br from-brand-600 to-brand-800 border-0 text-white shadow-xl shadow-brand-600/20 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Wallet className="w-32 h-32" />
                        </div>
                        <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between gap-6">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm">
                                            <Wallet className="h-4 w-4" />
                                        </div>
                                        <p className="text-sm font-semibold opacity-90 uppercase tracking-wider">Salio Lipatikano</p>
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tight">{formatMoney(wallet.balance)}</h2>
                                    <p className="text-sm opacity-80 mt-2 flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" /> Pesa tayari kutolewa (Available)
                                    </p>
                                </div>
                                <Button
                                    className="bg-white text-brand-700 hover:bg-brand-50 h-12 px-8 rounded-xl font-bold shadow-md shrink-0"
                                    onClick={() => setIsWithdrawModalOpen(true)}
                                    disabled={wallet.balance < 5000}
                                >
                                    <ArrowUpRight className="mr-2 h-5 w-5" /> Toa Pesa
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-muted/30">
                        <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-brand-100 dark:bg-brand-900/30 rounded-md text-brand-600 dark:text-brand-400">
                                            <HardDrive className="h-4 w-4" />
                                        </div>
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Storage Pro</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${tier === 'free' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {tier} PLAN
                                    </span>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Nafasi ya Mafaili</span>
                                        <span className="text-muted-foreground">{storagePercentage}% used</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
                                        <div 
                                            className="h-full bg-brand-500 rounded-full transition-all duration-1000" 
                                            style={{ width: `${storagePercentage}%`, boxShadow: `0 0 8px rgba(var(--brand-500), 0.5)` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">{storageUsedMb} MB kati ya {storageLimitMb} MB</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="w-full text-[10px] font-bold h-8 border-brand-200 text-brand-700 hover:bg-brand-50">
                                UPGRADE STORAGE
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Ledger / History Tabs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit border border-border">
                        <button
                            onClick={() => setActiveTab('earnings')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeTab === 'earnings' 
                                ? 'bg-white shadow-sm text-brand-700' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Mapato (Earnings)
                        </button>
                        <button
                            onClick={() => setActiveTab('payouts')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeTab === 'payouts' 
                                ? 'bg-white shadow-sm text-brand-700' 
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Payouts
                        </button>
                    </div>

                    <Card className="border-border shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                    <p className="font-bold text-sm">Inapakia Ledger...</p>
                                </div>
                            ) : getFilteredHistory().length === 0 ? (
                                <div className="p-16 text-center flex flex-col items-center">
                                    <div className="h-20 w-20 bg-muted/50 rounded-3xl flex items-center justify-center mb-6 border border-border/50">
                                        <History className="h-10 w-10 text-muted-foreground opacity-30" />
                                    </div>
                                    <h3 className="font-black text-xl">Hakuna Historia</h3>
                                    <p className="text-muted-foreground text-sm mt-2 max-w-xs leading-relaxed">
                                        Miamala yako ya {activeTab === 'earnings' ? 'mapato ya mauzo' : 'kutoa pesa'} itaonekana hapa pindi itakapofanyika.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-muted/30 border-b border-border">
                                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Tarehe</th>
                                                {activeTab === 'earnings' ? (
                                                    <>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Mteja / Bidhaa</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Gross</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-red-500">Fee</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-green-600">Net</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Njia ya Malipo</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right">Kiasi</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {getFilteredHistory().map((item, index) => (
                                                <tr key={index} className="hover:bg-muted/10 transition-colors group">
                                                    <td className="p-4">
                                                        <p className="text-sm font-bold text-foreground whitespace-nowrap">{formatDate(item.created_at)}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Ref: {item.reference || 'N/A'}</p>
                                                    </td>
                                                    
                                                    {activeTab === 'earnings' ? (
                                                        <>
                                                            <td className="p-4">
                                                                <p className="text-sm font-bold leading-tight">{item.customer_name}</p>
                                                                <p className="text-xs text-muted-foreground mt-0.5 italic">{item.product_name}</p>
                                                            </td>
                                                            <td className="p-4 text-sm font-semibold opacity-70">
                                                                {formatMoney(item.gross_amount)}
                                                            </td>
                                                            <td className="p-4 text-sm font-bold text-red-500/80">
                                                                -{formatMoney(item.fee_amount)}
                                                            </td>
                                                            <td className="p-4">
                                                                <p className="text-sm font-black text-green-600">{formatMoney(item.net_amount)}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">Deposited</p>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="p-4">
                                                                <p className="text-sm font-bold capitalize">{item.method || 'Mobile Money'}</p>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                                                    item.status === 'completed' || item.status === 'approved'
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : item.status === 'pending'
                                                                    ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-muted text-muted-foreground'
                                                                }`}>
                                                                    {item.status === 'completed' ? 'Tayari' : item.status === 'pending' ? 'Inasubiri' : item.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <p className="text-lg font-black">{formatMoney(item.amount)}</p>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Withdraw Modal */}
            <Dialog open={isWithdrawModalOpen} onOpenChange={(open) => {
                setIsWithdrawModalOpen(open);
                if (!open) clearErrors();
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Kutoa Pesa (Withdraw)</DialogTitle>
                        <DialogDescription>
                            Chagua njia na kiasi unachotaka kutoa. Kima cha chini ni <span className="font-bold text-foreground">TZS 5,000</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleWithdraw} className="space-y-6 py-2">
                        <div className="space-y-2.5">
                            <label className="text-sm font-semibold">Kiasi (TZS)</label>
                            <Input
                                type="number"
                                required
                                min="5000"
                                max={wallet.balance}
                                placeholder="Mf. 10000"
                                className="h-12 text-lg font-bold"
                                value={data.amount}
                                onChange={e => setData('amount', e.target.value)}
                            />
                            <div className="flex justify-between text-xs font-medium text-muted-foreground">
                                <span>Salio Lipatikano: {formatMoney(wallet.balance)}</span>
                                {data.amount && parseInt(data.amount) > wallet.balance && (
                                    <span className="text-red-500">Salio halitoshi</span>
                                )}
                            </div>
                            {errors.amount && <p className="text-sm text-red-500 mt-1 font-medium">{errors.amount}</p>}
                        </div>

                        <div className="space-y-2.5">
                            <label className="text-sm font-semibold">Njia ya Malipo</label>
                            <select
                                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={data.method}
                                onChange={e => setData('method', e.target.value)}
                            >
                                <option value="mobile_money">Mobile Money (M-Pesa, Tigo Pesa, n.k)</option>
                                <option value="bank">Akaunti ya Benki</option>
                                <option value="paypal">PayPal</option>
                            </select>
                            <p className="text-xs text-muted-foreground">
                                Njia za malipo zinaweza kusetiwa katika ukurasa wako wa mipangilio.
                            </p>
                            {errors.method && <p className="text-sm text-red-500 mt-1 font-medium">{errors.method}</p>}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-6">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-11" onClick={() => setIsWithdrawModalOpen(false)}>
                                Ghairi
                            </Button>
                            <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 h-11 font-bold" disabled={processing || !data.amount || parseInt(data.amount) < 5000 || parseInt(data.amount) > wallet.balance}>
                                {processing ? 'Tafadhali subiri...' : 'Tuma Ombi la Pesa'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </AppLayout>
    );
}
