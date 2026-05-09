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
    HardDrive, Wallet, ArrowLeft, ArrowUpRight, ArrowDownLeft, Store, ShieldCheck, HelpCircle, History, Clock, FileCheck
} from 'lucide-react';
import { router } from '@inertiajs/react';

export default function MerchantWallet({ merchantUsername, merchantName, wallet, merchant, retailEligible = false, initialLedgerType = null, ledgerMode = false }) {
    const { auth, flash, errors: pageErrors } = usePage().props;
    const [history, setHistory] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [ledgerType, setLedgerType] = useState(initialLedgerType);

    const storageUsedMb = merchant?.storage_used_mb || 0;
    const storageLimitMb = merchant?.storage_limit_mb || 500;
    const storagePercentage = merchant?.storage_percentage || 0;
    const tier = merchant?.subscription_tier || 'free';
    const isBusinessWallet = Boolean(retailEligible);
    const allowedLedgerTypes = isBusinessWallet
        ? [null, 'escrow', 'non-escrow', 'credit', 'wallet-entry', 'withdrawal']
        : [null, 'escrow', 'wallet-entry', 'withdrawal'];
    const effectiveLedgerType = allowedLedgerTypes.includes(ledgerType) ? ledgerType : null;

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        amount: '',
        method: 'mobile_money',
    });

    const isSalesLedger = ['escrow', 'non-escrow', 'credit'].includes(effectiveLedgerType);
    const isWalletEntryLedger = effectiveLedgerType === 'wallet-entry';
    const isWithdrawalLedger = effectiveLedgerType === 'withdrawal';
    const ledgerItems = history;

    useEffect(() => {
        fetchHistory();
    }, [merchantUsername, effectiveLedgerType]);

    useEffect(() => {
        setLedgerType(initialLedgerType);
    }, [initialLedgerType]);

    useEffect(() => {
        if (!ledgerMode && new URLSearchParams(window.location.search).get('withdraw') === '1') {
            setIsWithdrawModalOpen(true);
        }
    }, [ledgerMode, merchantUsername]);

    const fetchHistory = async (page = null) => {
        setLoading(true);
        try {
            const requestedPage = page || Number(new URLSearchParams(window.location.search).get('page') || 1);
            const params = new URLSearchParams({ page: String(requestedPage) });
            if (effectiveLedgerType) params.set('type', effectiveLedgerType);

            const res = await window.axios.get(`/merchant/${merchantUsername}/wallet/api/history?${params.toString()}`);
            setHistory(res.data.history || []);
            setMeta(res.data.meta || null);
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

    const goToLedger = (type = null, page = 1) => {
        const nextType = allowedLedgerTypes.includes(type) ? type : null;
        const params = new URLSearchParams();
        if (nextType) params.set('type', nextType);
        if (page > 1) params.set('page', String(page));

        router.visit(`/merchant/${merchantUsername}/wallet/ledger${params.toString() ? `?${params.toString()}` : ''}`, {
            preserveScroll: true,
            preserveState: false,
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

    const ledgerTypeMeta = (item) => {
        if (!isBusinessWallet && item.ledger_type === 'escrow') {
            return { label: 'Sale', cls: 'bg-brand-100 text-brand-700 border-brand-200' };
        }
        if (item.ledger_type === 'escrow') {
            return { label: 'Escrow', cls: 'bg-brand-100 text-brand-700 border-brand-200' };
        }
        if (item.ledger_type === 'credit') {
            return { label: 'Credit', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
        }
        return { label: 'Non-escrow', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    };

    const paymentModeLabel = (mode) => ({
        online_escrow: isBusinessWallet ? 'Online Escrow' : 'Online Sale',
        cash: 'Cash',
        merchant_mm: 'Merchant Mobile Money',
        store_credit: 'Store Credit',
    }[mode] || mode || 'N/A');

    const ledgerTitle = isBusinessWallet ? ({
        escrow: 'Escrow Ledger',
        'non-escrow': 'Non-escrow Ledger',
        credit: 'Credit Ledger',
        'wallet-entry': 'Wallet Entries',
        withdrawal: 'Payouts Ledger',
    }[effectiveLedgerType] || 'All Ledger') : ({
        escrow: 'Sales',
        'wallet-entry': 'Wallet Entries',
        withdrawal: 'Payouts',
    }[effectiveLedgerType] || 'All Activity');

    const ledgerSubtitle = isBusinessWallet ? ({
        escrow: 'Online escrow sales held or released through Takeer.',
        'non-escrow': 'Cash and merchant mobile money sales collected outside escrow.',
        credit: 'Store credit sales, partial payments, and outstanding balances.',
        'wallet-entry': 'Technical wallet movements such as escrow releases and fee records.',
        withdrawal: 'Withdrawal and payout requests.',
    }[effectiveLedgerType] || 'All sales and payout activity in one place.') : ({
        escrow: 'Digital product and content sales paid through Takeer.',
        'wallet-entry': 'Balance movements, fee records, and released earnings.',
        withdrawal: 'Withdrawal and payout requests.',
    }[effectiveLedgerType] || 'Digital sales, wallet movements, and payouts in one place.');

    const ledgerTabs = isBusinessWallet
        ? [
            [null, 'All'],
            ['escrow', 'Escrow'],
            ['non-escrow', 'Non-escrow'],
            ['credit', 'Credit'],
            ['wallet-entry', 'Wallet Entries'],
            ['withdrawal', 'Payouts'],
        ]
        : [
            [null, 'All'],
            ['escrow', 'Sales'],
            ['wallet-entry', 'Wallet Entries'],
            ['withdrawal', 'Payouts'],
        ];

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
                                Wallet <Wallet className="h-5 w-5 text-brand-600" />
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
                    <Card className="md:col-span-2 bg-brand-600 border-0 text-white shadow-xl shadow-brand-600/20 overflow-hidden relative">
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
                                        <p className="text-sm font-semibold opacity-90 uppercase tracking-wider">Salio Lililopo</p>
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tight">{formatMoney(wallet.balance)}</h2>
                                    <p className="text-sm opacity-80 mt-2 flex items-center gap-1">
                                        <ShieldCheck className="h-3 w-3" /> Pesa tayari kutolewa (Available)
                                    </p>
                                </div>
                                <Button
                                    className="bg-white text-brand-600 hover:bg-white/90 h-12 px-8 rounded-xl font-black shadow-lg shadow-black/5 shrink-0"
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
                            <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => router.visit(`/merchant/${merchantUsername}/platform-subscriptions/storage`)}
                                className="w-full text-[10px] font-black h-8 border-brand-200 text-brand-600 hover:bg-brand-50"
                            >
                                UPGRADE STORAGE
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Ledger / History Tabs */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-lg font-black text-slate-950">{ledgerTitle}</h2>
                            <p className="text-sm text-muted-foreground">{ledgerSubtitle}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {ledgerTabs.map(([type, label]) => (
                                <button
                                    key={type || 'all'}
                                    onClick={() => goToLedger(type)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${effectiveLedgerType === type
                                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-100'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Card className="border-border shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                                    <div className="h-8 w-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                    <p className="font-bold text-sm">Inapakia Ledger...</p>
                                </div>
                            ) : ledgerItems.length === 0 ? (
                                <div className="p-16 text-center flex flex-col items-center">
                                    <div className="h-20 w-20 bg-muted/50 rounded-3xl flex items-center justify-center mb-6 border border-border/50">
                                        <History className="h-10 w-10 text-muted-foreground opacity-30" />
                                    </div>
                                    <h3 className="font-black text-xl">Hakuna Historia</h3>
                                    <p className="text-muted-foreground text-sm mt-2 max-w-xs leading-relaxed">
                                        Miamala yako ya {ledgerTitle.toLowerCase()} itaonekana hapa pindi itakapofanyika.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-muted/30 border-b border-border">
                                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Tarehe</th>
                                                {isSalesLedger ? (
                                                    <>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Sale / Customer</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Type</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right">Amount</th>
                                                    </>
                                                ) : isWalletEntryLedger ? (
                                                    <>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Mteja / Bidhaa</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Gross</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-red-500">Takeer Fee</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-green-600">Net</th>
                                                    </>
                                                ) : isWithdrawalLedger ? (
                                                    <>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Njia ya Malipo</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right">Kiasi</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Ledger</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Details</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                                        <th className="p-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground text-right">Amount</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {ledgerItems.map((item, index) => (
                                                <tr key={index} className="hover:bg-muted/10 transition-colors group">
                                                    <td className="p-4">
                                                        <p className="text-sm font-bold text-foreground whitespace-nowrap">{formatDate(item.created_at)}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Ref: {item.reference || 'N/A'}</p>
                                                    </td>

                                                    {isSalesLedger ? (() => {
                                                        const meta = ledgerTypeMeta(item);

                                                        return (
                                                            <>
                                                                <td className="p-4">
                                                                    <p className="text-sm font-bold leading-tight">{item.customer_name}</p>
                                                                    <p className="text-xs text-muted-foreground mt-0.5 italic">{item.product_name}</p>
                                                                    {item.staff_name && (
                                                                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">Staff: {item.staff_name}</p>
                                                                    )}
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${meta.cls}`}>
                                                                        {meta.label}
                                                                    </span>
                                                                    <p className="text-[10px] text-muted-foreground mt-1 font-bold">{paymentModeLabel(item.payment_mode)}</p>
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.status === 'resolved_merchant_paid' || item.status === 'escrow_locked'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : item.status === 'pending'
                                                                            ? 'bg-amber-100 text-amber-700'
                                                                            : 'bg-muted text-muted-foreground'
                                                                        }`}>
                                                                        {item.status?.replaceAll('_', ' ') || 'N/A'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <p className="text-sm font-black">{formatMoney(item.amount)}</p>
                                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                                        Paid: {formatMoney(item.paid_amount)}
                                                                    </p>
                                                                    {item.outstanding_amount > 0 && (
                                                                        <p className="text-[10px] font-black text-amber-600 mt-0.5">
                                                                            Due: {formatMoney(item.outstanding_amount)}
                                                                        </p>
                                                                    )}
                                                                </td>
                                                            </>
                                                        );
                                                    })() : isWalletEntryLedger ? (
                                                        <>
                                                            <td className="p-4">
                                                                <p className="text-sm font-bold leading-tight">{item.customer_name}</p>
                                                                <p className="text-xs text-muted-foreground mt-0.5 italic">{item.product_name}</p>
                                                            </td>
                                                            <td className="p-4 text-sm font-semibold opacity-70">
                                                                {formatMoney(item.gross_amount)}
                                                            </td>
                                                            <td className="p-4">
                                                                <p className="text-sm font-bold text-red-500/80">-{formatMoney(item.fee_amount)}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">Platform fee</p>
                                                            </td>
                                                            <td className="p-4">
                                                                <p className="text-sm font-black text-green-600">{formatMoney(item.net_amount)}</p>
                                                                <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">Deposited</p>
                                                            </td>
                                                        </>
                                                    ) : isWithdrawalLedger ? (
                                                        <>
                                                            <td className="p-4">
                                                                <p className="text-sm font-bold capitalize">{item.method || 'Mobile Money'}</p>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.status === 'completed' || item.status === 'approved'
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
                                                    ) : (() => {
                                                        const meta = item.type === 'sale'
                                                            ? ledgerTypeMeta(item)
                                                            : item.type === 'withdrawal'
                                                                ? { label: 'Payout', cls: 'bg-slate-100 text-slate-700 border-slate-200' }
                                                                : { label: 'Wallet Entry', cls: 'bg-green-100 text-green-700 border-green-200' };

                                                        return (
                                                            <>
                                                                <td className="p-4">
                                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${meta.cls}`}>
                                                                        {meta.label}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4">
                                                                    <p className="text-sm font-bold leading-tight">{item.customer_name || item.method || 'Mobile Money'}</p>
                                                                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                                                                        {item.product_name || paymentModeLabel(item.payment_mode) || 'Payout request'}
                                                                    </p>
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.status === 'completed' || item.status === 'approved' || item.status === 'resolved_merchant_paid' || item.status === 'escrow_locked'
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : item.status === 'pending'
                                                                            ? 'bg-amber-100 text-amber-700'
                                                                            : 'bg-muted text-muted-foreground'
                                                                        }`}>
                                                                        {item.status?.replaceAll('_', ' ') || 'N/A'}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <p className="text-sm font-black">{formatMoney(item.amount)}</p>
                                                                    {item.outstanding_amount > 0 && (
                                                                        <p className="text-[10px] font-black text-amber-600 mt-0.5">
                                                                            Due: {formatMoney(item.outstanding_amount)}
                                                                        </p>
                                                                    )}
                                                                </td>
                                                            </>
                                                        );
                                                    })()
                                                    }
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    {meta && meta.last_page > 1 && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <p className="text-xs font-bold text-muted-foreground">
                                Page {meta.current_page} of {meta.last_page} • {meta.total} records
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="h-10 rounded-xl"
                                    disabled={meta.current_page <= 1}
                                    onClick={() => goToLedger(effectiveLedgerType, meta.current_page - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-10 rounded-xl"
                                    disabled={meta.current_page >= meta.last_page}
                                    onClick={() => goToLedger(effectiveLedgerType, meta.current_page + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
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
                                <span>Salio Lililopo: {formatMoney(wallet.balance)}</span>
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
