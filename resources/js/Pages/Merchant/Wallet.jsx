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

export default function MerchantWallet({ merchantUsername, merchantName, wallet }) {
    const { auth, flash, errors: pageErrors } = usePage().props;
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        amount: '',
        method: 'mobile_money',
    });

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

                {/* Balances */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-brand-600 to-brand-800 border-0 text-white shadow-xl shadow-brand-600/20 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Wallet className="w-32 h-32" />
                        </div>
                        <CardContent className="p-6 relative z-10 flex flex-col h-full justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-white/20 rounded-md backdrop-blur-sm">
                                        <Wallet className="h-4 w-4" />
                                    </div>
                                    <p className="text-sm font-semibold opacity-90 uppercase tracking-wider">Salio Lako</p>
                                </div>
                                <h2 className="text-4xl font-black tracking-tight">{formatMoney(wallet.balance)}</h2>
                                <p className="text-sm opacity-80 mt-2">Pesa inayoanza kutolewa (Available)</p>
                            </div>

                            <Button
                                className="w-full bg-white text-brand-700 hover:bg-brand-50 h-12 rounded-xl font-bold shadow-md"
                                onClick={() => setIsWithdrawModalOpen(true)}
                                disabled={wallet.balance < 5000}
                            >
                                <ArrowUpRight className="mr-2 h-5 w-5" /> Toa Pesa (Withdraw)
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700/30">
                        <CardContent className="p-6 flex flex-col justify-between h-full">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-amber-200/50 dark:bg-amber-900/50 rounded-md text-amber-700 dark:text-amber-400">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Escrow Balance</p>
                                </div>
                                <h2 className="text-3xl font-black text-amber-800 dark:text-amber-500">{formatMoney(wallet.frozen_balance)}</h2>
                                <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-2">
                                    Pesa iliyoshikiliwa kusubiri wateja wapokee bidhaa.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* History */}
                <Card className="border-border shadow-sm">
                    <div className="p-5 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2 text-lg">
                            <History className="h-5 w-5 text-muted-foreground" /> Miamala ya Hivi Karibuni
                        </h3>
                    </div>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">Inapakia miamala...</div>
                        ) : history.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center">
                                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <History className="h-8 w-8 text-muted-foreground opacity-50" />
                                </div>
                                <h3 className="font-bold text-lg">Hakuna Miamala</h3>
                                <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                                    Miamala yako yote na historia ya kutoa pesa itaonekana hapa.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {history.map((item, index) => (
                                    <div key={index} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${item.type === 'withdrawal'
                                                ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30'
                                                : 'bg-green-100 text-green-600 dark:bg-green-900/30'
                                                }`}>
                                                {item.type === 'withdrawal' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold">
                                                    {item.type === 'withdrawal' ? 'Kutoa Pesa (Withdraw)' : 'Mauzo ya Bidhaa'}
                                                </p>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {formatDate(item.created_at)}
                                                    </span>
                                                    {item.reference && (
                                                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                            Ref: {item.reference}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`font-black text-lg ${item.type === 'withdrawal'
                                                ? 'text-foreground'
                                                : 'text-green-600 dark:text-green-500'
                                                }`}>
                                                {item.type === 'withdrawal' ? '-' : '+'}{formatMoney(item.amount)}
                                            </p>
                                            {item.status === 'pending' ? (
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full inline-block mt-1">Inasubiri (Pending)</p>
                                            ) : item.status === 'completed' ? (
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full inline-block mt-1">Tayari (Done)</p>
                                            ) : (
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-block mt-1">{item.status}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
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
