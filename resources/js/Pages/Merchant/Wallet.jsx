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
    CreditCard, HardDrive, Wallet, ArrowLeft, ArrowUpRight, Plus, Store, ShieldCheck, History, FileCheck, Loader2, Pencil, Trash2, LifeBuoy
} from 'lucide-react';
import { router } from '@inertiajs/react';
import { useMerchantPermissions } from '@/lib/merchantPermissions';
import { toast } from 'sonner';

export default function MerchantWallet({ merchantUsername, merchantName, wallet, merchant, retailEligible = false, initialLedgerType = null, ledgerMode = false }) {
    const { auth, flash, errors: pageErrors } = usePage().props;
    const [history, setHistory] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [ledgerType, setLedgerType] = useState(initialLedgerType);
    const [verificationCodeSent, setVerificationCodeSent] = useState(false);
    const [sendingVerificationCode, setSendingVerificationCode] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState('');
    const [withdrawalQuote, setWithdrawalQuote] = useState(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quoteError, setQuoteError] = useState('');
    const { can } = useMerchantPermissions(merchantUsername);
    const canWithdraw = can('wallet.withdraw');
    const canUpdateSettings = can('settings.update');
    const hasTotpEnabled = Boolean(auth?.user?.two_factor_enabled);
    const businessCurrencyCode = wallet?.currency_code || wallet?.currency?.code || 'TZS';
    const payoutChannels = Array.isArray(wallet?.payout_channels) ? wallet.payout_channels : [];
    const payoutCurrencies = Array.isArray(wallet?.payout_currencies) && wallet.payout_currencies.length
        ? wallet.payout_currencies
        : payoutChannels.map((channel) => ({ code: channel.currency_code, name: channel.label }));
    const [payoutCredentialItems, setPayoutCredentialItems] = useState(() => Array.isArray(wallet?.payout_credentials) ? wallet.payout_credentials : []);
    const payoutCredentials = payoutCredentialItems;
    const defaultPayoutCredential = payoutCredentials.find((credential) => credential.is_default) || payoutCredentials[0] || null;
    const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
    const [editingCredential, setEditingCredential] = useState(null);
    const [deletingCredential, setDeletingCredential] = useState(null);
    const [deleteVerificationCode, setDeleteVerificationCode] = useState('');
    const [deleteCredentialErrors, setDeleteCredentialErrors] = useState({});
    const [deleteCredentialSaving, setDeleteCredentialSaving] = useState(false);
    const [deleteCredentialCodeSent, setDeleteCredentialCodeSent] = useState(false);
    const [credentialSaving, setCredentialSaving] = useState(false);
    const [credentialCodeSent, setCredentialCodeSent] = useState(false);
    const [credentialErrors, setCredentialErrors] = useState({});
    const [credentialForm, setCredentialForm] = useState({
        payment_provider_channel_id: payoutChannels.find((channel) => channel.id)?.id || '',
        currency_code: payoutChannels.find((channel) => channel.id)?.currency_code || businessCurrencyCode,
        details: {},
        is_default: true,
        verification_code: '',
    });
    const selectedCredentialChannel = payoutChannels.find((channel) => String(channel.id) === String(credentialForm.payment_provider_channel_id))
        || payoutChannels.find((channel) => channel.id)
        || null;
    const credentialChannelCurrencies = Array.isArray(selectedCredentialChannel?.currencies) && selectedCredentialChannel.currencies.length
        ? selectedCredentialChannel.currencies
        : [selectedCredentialChannel?.currency_code || businessCurrencyCode];

    const storageUsedMb = merchant?.storage_used_mb || 0;
    const storageLimitMb = merchant?.storage_limit_mb || 500;
    const storagePercentage = merchant?.storage_percentage || 0;
    const tier = merchant?.subscription_tier || 'free';
    const isBusinessWallet = Boolean(retailEligible);
    const allowedLedgerTypes = isBusinessWallet
        ? [null, 'escrow', 'non-escrow', 'credit', 'wallet-entry', 'withdrawal']
        : [null, 'escrow', 'wallet-entry', 'withdrawal'];
    const effectiveLedgerType = allowedLedgerTypes.includes(ledgerType) ? ledgerType : null;

    const { data, setData, post, processing, errors, reset, clearErrors, transform } = useForm({
        amount: '',
        payout_channel_key: payoutChannels[0]?.key || '',
        method: payoutChannels[0]?.method || 'bank',
        payout_currency_code: payoutChannels[0]?.currency_code || businessCurrencyCode,
        merchant_payout_credential_id: '',
        verification_code: '',
    });
    const selectedPayoutChannel = payoutChannels.find((channel) => channel.key === data.payout_channel_key) || payoutChannels[0];
    const selectedPayoutCredential = payoutCredentials.find((credential) => String(credential.id) === String(data.merchant_payout_credential_id));
    const selectedPayoutCurrency = payoutCurrencies.find((currency) => currency.code === (selectedPayoutChannel?.currency_code || data.payout_currency_code)) || payoutCurrencies[0];
    const selectedChannelCurrencies = Array.isArray(selectedPayoutChannel?.currencies) && selectedPayoutChannel.currencies.length
        ? selectedPayoutChannel.currencies
        : [selectedPayoutChannel?.currency_code || businessCurrencyCode];
    const selectedPayoutCredentialCurrencyCode = selectedPayoutCredential?.currency_code || '';
    const hasFixedPayoutCredentialCurrency = Boolean(selectedPayoutCredentialCurrencyCode);
    const effectivePayoutCurrencyCode = hasFixedPayoutCredentialCurrency
        ? selectedPayoutCredentialCurrencyCode
        : selectedChannelCurrencies.includes(data.payout_currency_code)
            ? data.payout_currency_code
            : (selectedPayoutChannel?.currency_code || selectedPayoutCurrency?.code || businessCurrencyCode);
    const canChoosePayoutCurrency = !hasFixedPayoutCredentialCurrency && selectedChannelCurrencies.length > 1;

    const isSalesLedger = ['escrow', 'non-escrow', 'credit'].includes(effectiveLedgerType);
    const isWalletEntryLedger = effectiveLedgerType === 'wallet-entry';
    const isWithdrawalLedger = effectiveLedgerType === 'withdrawal';
    const ledgerItems = history;
    const withdrawalWalletDebit = Number(withdrawalQuote?.wallet_debit_amount || data.amount || 0);
    const withdrawalExceedsBalance = Boolean(data.amount) && withdrawalWalletDebit > Number(wallet.balance || 0);

    useEffect(() => {
        fetchHistory();
    }, [merchantUsername, effectiveLedgerType]);

    useEffect(() => {
        setLedgerType(initialLedgerType);
    }, [initialLedgerType]);

    useEffect(() => {
        if (canWithdraw && !ledgerMode && new URLSearchParams(window.location.search).get('withdraw') === '1') {
            setIsWithdrawModalOpen(true);
        }
    }, [canWithdraw, ledgerMode, merchantUsername]);

    useEffect(() => {
        setPayoutCredentialItems(Array.isArray(wallet?.payout_credentials) ? wallet.payout_credentials : []);
    }, [wallet?.payout_credentials]);

    useEffect(() => {
        if (!isWithdrawModalOpen || data.merchant_payout_credential_id || !defaultPayoutCredential) {
            return;
        }

        const credentialChannel = defaultPayoutCredential.channel;
        setData({
            ...data,
            merchant_payout_credential_id: String(defaultPayoutCredential.id),
            payout_channel_key: credentialChannel?.key || data.payout_channel_key,
            method: credentialChannel?.method || data.method,
            payout_currency_code: defaultPayoutCredential.currency_code || credentialChannel?.currency_code || data.payout_currency_code,
        });
    }, [isWithdrawModalOpen, defaultPayoutCredential?.id]);

    useEffect(() => {
        if (!isWithdrawModalOpen || !payoutCredentials.length || !data.amount || Number(data.amount) <= 0) {
            setWithdrawalQuote(null);
            setQuoteError('');
            setQuoteLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            setQuoteLoading(true);
            setQuoteError('');

            try {
                const res = await window.axios.post(`/merchant/${merchantUsername}/wallet/withdraw/quote`, {
                    amount: data.amount,
                    payout_channel_key: selectedPayoutChannel?.key || data.payout_channel_key,
                    method: data.method,
                    payout_currency_code: effectivePayoutCurrencyCode,
                    merchant_payout_credential_id: data.merchant_payout_credential_id || null,
                }, {
                    signal: controller.signal,
                });
                setWithdrawalQuote(res.data);
            } catch (error) {
                if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return;
                setWithdrawalQuote(null);
                setQuoteError(friendlyWithdrawalQuoteError(error.response?.data));
            } finally {
                setQuoteLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [isWithdrawModalOpen, payoutCredentials.length, data.amount, data.method, data.payout_channel_key, data.merchant_payout_credential_id, selectedPayoutChannel?.key, effectivePayoutCurrencyCode, merchantUsername, wallet.balance]);

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
        if (!canWithdraw) return;
        transform((payload) => ({
            ...payload,
            payout_currency_code: effectivePayoutCurrencyCode,
        }));
        post(`/merchant/${merchantUsername}/wallet/withdraw`, {
            onSuccess: () => {
                reset();
                setVerificationCodeSent(false);
                setVerificationMessage('');
                setIsWithdrawModalOpen(false);
                fetchHistory(); // Refresh history slightly later
            },
        });
    };

    const sendWithdrawalVerificationCode = async () => {
        if (!canWithdraw || sendingVerificationCode) return;

        setSendingVerificationCode(true);
        setVerificationMessage('');
        clearErrors('verification_code');

        try {
            const res = await window.axios.post('/auth/2fa/send', {
                purpose: 'merchant_wallet_withdrawal',
            });
            setVerificationCodeSent(true);
            setVerificationMessage(res.data?.message || 'Verification code imetumwa kwenye simu yako.');
        } catch (error) {
            setVerificationMessage(error.response?.data?.message || 'Imeshindwa kutuma verification code. Jaribu tena.');
        } finally {
            setSendingVerificationCode(false);
        }
    };

    const openCredentialModal = () => {
        const firstChannel = payoutChannels.find((channel) => channel.id) || null;
        setEditingCredential(null);
        setCredentialErrors({});
        setCredentialCodeSent(false);
        setCredentialForm({
            payment_provider_channel_id: firstChannel?.id || '',
            currency_code: firstChannel?.currency_code || businessCurrencyCode,
            details: {},
            is_default: payoutCredentials.length === 0,
            verification_code: '',
        });
        setIsCredentialModalOpen(true);
    };

    const credentialDetailsForEdit = (credential) => {
        const savedDetails = credential.details && typeof credential.details === 'object'
            ? credential.details
            : {};
        const maskedDetails = credential.details_masked && typeof credential.details_masked === 'object'
            ? credential.details_masked
            : {};
        const hydratedDetails = { ...maskedDetails, ...savedDetails };
        if ((!hydratedDetails.first_name || !hydratedDetails.last_name) && maskedDetails.name) {
            const [firstName = '', ...lastNameParts] = String(maskedDetails.name).trim().split(/\s+/);
            hydratedDetails.first_name = hydratedDetails.first_name || firstName;
            hydratedDetails.last_name = hydratedDetails.last_name || lastNameParts.join(' ');
        }

        return hydratedDetails;
    };

    const openEditCredentialModal = async (credential) => {
        let currentCredential = credential;
        try {
            const res = await window.axios.get(`/merchant/${merchantUsername}/wallet/payout-credentials`);
            const freshCredentials = Array.isArray(res.data?.credentials) ? res.data.credentials : [];
            if (freshCredentials.length) {
                setPayoutCredentialItems(freshCredentials);
                currentCredential = freshCredentials.find((item) => String(item.id) === String(credential.id)) || credential;
            }
        } catch (error) {
            // Use the credential already rendered on the page if a refresh is not available.
        }

        const channel = currentCredential.channel || payoutChannels.find((item) => String(item.id) === String(currentCredential.payment_provider_channel_id)) || null;
        setEditingCredential(currentCredential);
        setCredentialErrors({});
        setCredentialCodeSent(false);
        setCredentialForm({
            payment_provider_channel_id: channel?.id || '',
            currency_code: currentCredential.currency_code || channel?.currency_code || businessCurrencyCode,
            details: credentialDetailsForEdit(currentCredential),
            is_default: Boolean(currentCredential.is_default),
            verification_code: '',
        });
        setIsCredentialModalOpen(true);
    };

    const setCredentialDetail = (key, value) => {
        setCredentialForm((prev) => ({
            ...prev,
            details: {
                ...prev.details,
                [key]: value,
            },
        }));
    };

    const sendCredentialVerificationCode = async () => {
        setCredentialErrors({});
        try {
            const res = await window.axios.post('/auth/2fa/send', {
                purpose: 'merchant_payout_credential',
            });
            setCredentialCodeSent(true);
            toast.success(res.data?.message || 'Verification code sent.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send verification code.');
        }
    };

    const savePayoutCredential = async (event) => {
        event.preventDefault();
        if (!selectedCredentialChannel?.id) {
            setCredentialErrors({ payment_provider_channel_id: 'No payout channel is available for this business country yet.' });
            return;
        }
        if (!String(credentialForm.verification_code || '').trim()) {
            setCredentialErrors({ verification_code: 'Verification code is required to save payout credentials.' });
            return;
        }

        setCredentialSaving(true);
        setCredentialErrors({});

        try {
            const payload = {
                ...credentialForm,
                payment_provider_channel_id: selectedCredentialChannel.id,
                currency_code: credentialForm.currency_code || credentialChannelCurrencies[0] || businessCurrencyCode,
            };
            const url = editingCredential
                ? `/merchant/${merchantUsername}/wallet/payout-credentials/${editingCredential.id}`
                : `/merchant/${merchantUsername}/wallet/payout-credentials`;
            const res = editingCredential
                ? await window.axios.put(url, payload)
                : await window.axios.post(url, payload);
            const saved = res.data?.credential;
            if (saved) {
                setPayoutCredentialItems((prev) => {
                    const withoutSaved = prev.filter((credential) => credential.id !== saved.id);
                    return [saved, ...withoutSaved];
                });
                setData({
                    ...data,
                    merchant_payout_credential_id: saved.id,
                    payout_channel_key: saved.channel?.key || data.payout_channel_key,
                    method: saved.method || data.method,
                    payout_currency_code: saved.currency_code || data.payout_currency_code,
                });
            }
            toast.success(res.data?.message || 'Payout credential saved.');
            setIsCredentialModalOpen(false);
            setEditingCredential(null);
        } catch (error) {
            const responseErrors = error.response?.data?.errors || {};
            setCredentialErrors(responseErrors);
            toast.error(error.response?.data?.message || 'Failed to save payout credential.');
        } finally {
            setCredentialSaving(false);
        }
    };

    const openDeleteCredentialModal = (credential) => {
        setDeletingCredential(credential);
        setDeleteVerificationCode('');
        setDeleteCredentialErrors({});
        setDeleteCredentialCodeSent(false);
    };

    const sendDeleteCredentialVerificationCode = async () => {
        setDeleteCredentialErrors({});
        try {
            const res = await window.axios.post('/auth/2fa/send', {
                purpose: 'merchant_payout_credential',
            });
            setDeleteCredentialCodeSent(true);
            toast.success(res.data?.message || 'Verification code sent.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send verification code.');
        }
    };

    const deletePayoutCredential = async (event) => {
        event.preventDefault();
        if (!deletingCredential) return;
        if (!String(deleteVerificationCode || '').trim()) {
            setDeleteCredentialErrors({ verification_code: 'Verification code is required to remove payout credentials.' });
            return;
        }

        setDeleteCredentialSaving(true);
        setDeleteCredentialErrors({});

        try {
            const res = await window.axios.delete(`/merchant/${merchantUsername}/wallet/payout-credentials/${deletingCredential.id}`, {
                data: {
                    verification_code: deleteVerificationCode,
                },
            });
            setPayoutCredentialItems((prev) => prev.filter((credential) => credential.id !== deletingCredential.id));
            if (String(data.merchant_payout_credential_id) === String(deletingCredential.id)) {
                setData({
                    ...data,
                    merchant_payout_credential_id: '',
                });
            }
            toast.success(res.data?.message || 'Payout credential removed.');
            setDeletingCredential(null);
            setDeleteVerificationCode('');
        } catch (error) {
            setDeleteCredentialErrors(error.response?.data?.errors || {
                verification_code: error.response?.data?.message || 'Failed to remove payout credential.',
            });
            toast.error(error.response?.data?.message || 'Failed to remove payout credential.');
        } finally {
            setDeleteCredentialSaving(false);
        }
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

    const formatMoney = (amount, currency = businessCurrencyCode) => {
        const code = currency || businessCurrencyCode;
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: code,
                minimumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(code) ? 0 : 2,
                maximumFractionDigits: ['TZS', 'JPY', 'KRW'].includes(code) ? 0 : 2,
            }).format(Number(amount || 0));
        } catch {
            return `${code} ${Number(amount || 0).toLocaleString()}`;
        }
    };

    const formatFxRate = (rate) => {
        const value = Number(rate || 0);
        if (!Number.isFinite(value)) return '0';
        if (value === 0) return '0';

        const absolute = Math.abs(value);
        return value.toLocaleString(undefined, {
            minimumFractionDigits: absolute > 0 && absolute < 0.01 ? 6 : 0,
            maximumFractionDigits: absolute < 0.000001 ? 12 : (absolute < 1 ? 8 : 6),
        });
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
                                {canWithdraw && (
                                    <Button
                                        className="bg-white text-brand-600 hover:bg-white/90 h-12 px-8 rounded-xl font-black shadow-lg shadow-black/5 shrink-0"
                                        onClick={() => setIsWithdrawModalOpen(true)}
                                        disabled={wallet.balance < 5000}
                                    >
                                        <ArrowUpRight className="mr-2 h-5 w-5" /> Toa Pesa
                                    </Button>
                                )}
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
                            {canUpdateSettings && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => router.visit(`/merchant/${merchantUsername}/platform-subscriptions/storage`)}
                                    className="w-full text-[10px] font-black h-8 border-brand-200 text-brand-600 hover:bg-brand-50"
                                >
                                    UPGRADE STORAGE
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {canWithdraw && (
                    <Card className="border-border bg-white shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-5 w-5 text-brand-600" />
                                        <h2 className="text-base font-black text-slate-950">Payout Accounts</h2>
                                    </div>
                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                        Save mobile money or bank details before requesting payouts.
                                    </p>
                                </div>
                                <Button type="button" className="h-10 rounded-xl font-bold" onClick={openCredentialModal}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Account
                                </Button>
                            </div>
                            <div className="mt-4 grid gap-2 md:grid-cols-2">
                                {payoutCredentials.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-muted-foreground">
                                        No payout account saved yet.
                                    </div>
                                ) : payoutCredentials.map((credential) => (
                                    <div key={credential.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-black text-slate-900">{credential.label}</p>
                                            {credential.is_default && (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">Default</span>
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                            <p className="text-xs font-semibold text-muted-foreground">
                                                {String(credential.method || '').replaceAll('_', ' ')} · {credential.currency_code}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-8 rounded-lg px-2 text-xs font-bold"
                                                    onClick={() => openEditCredentialModal(credential)}
                                                >
                                                    <Pencil className="mr-1 h-3.5 w-3.5" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-8 rounded-lg border-red-200 px-2 text-xs font-bold text-red-600 hover:bg-red-50"
                                                    onClick={() => openDeleteCredentialModal(credential)}
                                                >
                                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

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
                                                                <p className="text-sm font-bold leading-tight">{item.payout_account_label || item.payout_channel_label || item.method || 'Mobile Money'}</p>
                                                                {item.payout_account_hint && (
                                                                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{item.payout_account_hint}</p>
                                                                )}
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
                                                                <p className="text-lg font-black">{formatMoney(item.payout_amount ?? item.merchant_amount ?? item.amount, item.payout_currency_code || item.merchant_currency_code || businessCurrencyCode)}</p>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Merchant receives</p>
                                                                {Number(item.withdrawal_fee_amount || 0) > 0 && (
                                                                    <p className="text-[10px] font-bold text-slate-600 mt-1">
                                                                        Wallet debit {formatMoney(item.wallet_debit_amount || item.amount, item.merchant_currency_code || businessCurrencyCode)}
                                                                        {' '}incl. fee {formatMoney(item.withdrawal_fee_amount, item.withdrawal_fee_currency_code || item.merchant_currency_code || businessCurrencyCode)}
                                                                    </p>
                                                                )}
                                                                {item.payout_currency_code && item.payout_currency_code !== (item.merchant_currency_code || businessCurrencyCode) && item.fx_rate_merchant_to_payout && (
                                                                    <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                                                        1 {item.merchant_currency_code || businessCurrencyCode} ≈ {formatFxRate(item.fx_rate_merchant_to_payout)} {item.payout_currency_code}
                                                                    </p>
                                                                )}
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
                                                                    <p className="text-sm font-bold leading-tight">{item.type === 'withdrawal' ? (item.payout_account_label || item.payout_channel_label || item.method || 'Mobile Money') : (item.customer_name || item.method || 'Mobile Money')}</p>
                                                                    <p className="text-xs text-muted-foreground mt-0.5 italic">
                                                                        {item.type === 'withdrawal' ? (item.payout_account_hint || 'Payout request') : (item.product_name || paymentModeLabel(item.payment_mode) || 'Payout request')}
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
                                                                    <p className="text-sm font-black">
                                                                        {item.type === 'withdrawal'
                                                                            ? formatMoney(item.payout_amount ?? item.merchant_amount ?? item.amount, item.payout_currency_code || item.merchant_currency_code || businessCurrencyCode)
                                                                            : formatMoney(item.amount)}
                                                                    </p>
                                                                    {item.type === 'withdrawal' && (
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Merchant receives</p>
                                                                    )}
                                                                    {item.type === 'withdrawal' && Number(item.withdrawal_fee_amount || 0) > 0 && (
                                                                        <p className="text-[10px] font-bold text-slate-600 mt-1">
                                                                            Wallet debit {formatMoney(item.wallet_debit_amount || item.amount, item.merchant_currency_code || businessCurrencyCode)}
                                                                            {' '}incl. fee {formatMoney(item.withdrawal_fee_amount, item.withdrawal_fee_currency_code || item.merchant_currency_code || businessCurrencyCode)}
                                                                        </p>
                                                                    )}
                                                                    {item.type === 'withdrawal' && item.payout_currency_code && item.payout_currency_code !== (item.merchant_currency_code || businessCurrencyCode) && item.fx_rate_merchant_to_payout && (
                                                                        <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                                                            1 {item.merchant_currency_code || businessCurrencyCode} ≈ {formatFxRate(item.fx_rate_merchant_to_payout)} {item.payout_currency_code}
                                                                        </p>
                                                                    )}
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
            <Dialog open={canWithdraw && isWithdrawModalOpen} onOpenChange={(open) => {
                setIsWithdrawModalOpen(open);
                if (!open) {
                    clearErrors();
                    setData('verification_code', '');
                    setVerificationCodeSent(false);
                    setVerificationMessage('');
                    setWithdrawalQuote(null);
                    setQuoteError('');
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Kutoa Pesa (Withdraw)</DialogTitle>
                        <DialogDescription>
                            Chagua njia na kiasi cha kutoa kutoka wallet yako ya <span className="font-bold text-foreground">{businessCurrencyCode}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleWithdraw} className="space-y-6 py-2">
                        <div className="space-y-2.5">
                            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.95fr)] sm:items-center">
                                <label className="text-sm font-semibold sm:text-base">Kiasi cha kutoa ({businessCurrencyCode})</label>
                                <Input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    max={wallet.balance}
                                    placeholder="Mf. 100.00"
                                    className="h-12 text-lg font-bold sm:text-right"
                                    value={data.amount}
                                    onChange={e => setData('amount', e.target.value)}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Salio Lililopo: <span className="font-bold text-foreground">{formatMoney(wallet.balance)}</span></span>
                                {withdrawalExceedsBalance && (
                                    <span className="text-red-500">Salio halitoshi</span>
                                )}
                            </div>
                            {errors.amount && <p className="text-sm text-red-500 mt-1 font-medium">{errors.amount}</p>}
                        </div>

                        {payoutCredentials.length > 0 ? (
                            <div className="space-y-2.5">
                                <label className="text-sm font-semibold">Payout account</label>
                                <select
                                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={data.merchant_payout_credential_id}
                                    onChange={e => {
                                        const credential = payoutCredentials.find((item) => String(item.id) === String(e.target.value));
                                        const credentialChannel = credential?.channel;
                                        setData({
                                            ...data,
                                            merchant_payout_credential_id: e.target.value,
                                            payout_channel_key: credentialChannel?.key || data.payout_channel_key,
                                            method: credentialChannel?.method || data.method,
                                            payout_currency_code: credential?.currency_code || credentialChannel?.currency_code || data.payout_currency_code,
                                        });
                                    }}
                                >
                                    {payoutCredentials.map((credential) => (
                                        <option key={credential.id} value={credential.id}>
                                            {credential.label} - {credential.currency_code}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs leading-5 text-muted-foreground">
                                    Wallet itakatwa {businessCurrencyCode}; payout itatumwa kwa {effectivePayoutCurrencyCode}.
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm font-black text-amber-950">Add a payout account first</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">
                                    Weka akaunti ya kupokea pesa ili tuweze kuchagua payout route sahihi nyuma ya pazia.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-3 h-10 rounded-xl border-amber-300 bg-white font-bold text-amber-950 hover:bg-amber-100"
                                    onClick={() => {
                                        setIsWithdrawModalOpen(false);
                                        openCredentialModal();
                                    }}
                                >
                                    Add payout account
                                </Button>
                            </div>
                        )}

                        {canChoosePayoutCurrency && (
                            <div className="space-y-2.5">
                                <label className="text-sm font-semibold">Payout currency</label>
                                <select
                                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={effectivePayoutCurrencyCode}
                                    onChange={(e) => setData('payout_currency_code', e.target.value)}
                                >
                                    {selectedChannelCurrencies.map((currency) => (
                                        <option key={currency} value={currency}>{currency}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {(data.amount && Number(data.amount) > 0) && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payout estimate</p>
                                    {quoteLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                </div>
                                {quoteError ? (
                                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                        <p className="text-sm font-black text-amber-950">{quoteError}</p>
                                        <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">
                                            Please contact Takeer support so we can check this payout route and help you complete the withdrawal.
                                        </p>
                                        <Link
                                            href={withdrawalSupportUrl({
                                                merchantName,
                                                merchantUsername,
                                                amount: data.amount,
                                                currencyCode: businessCurrencyCode,
                                                payoutCurrencyCode: effectivePayoutCurrencyCode,
                                                accountLabel: selectedPayoutCredential?.label,
                                                channelLabel: selectedPayoutChannel?.label,
                                            })}
                                            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-xs font-black uppercase tracking-widest text-amber-950 hover:bg-amber-100"
                                        >
                                            <LifeBuoy className="mr-2 h-4 w-4" />
                                            Contact support
                                        </Link>
                                    </div>
                                ) : withdrawalQuote ? (() => {
                                    const hasWithdrawalFee = Number(withdrawalQuote.withdrawal_fee_amount || 0) > 0;
                                    const hasFxSpread = Number(withdrawalQuote.fx_margin_bps || 0) > 0;
                                    const merchantCurrency = withdrawalQuote.merchant_currency_code;
                                    const payoutCurrency = withdrawalQuote.payout_currency_code;
                                    const hasCurrencyExchange = merchantCurrency && payoutCurrency && merchantCurrency !== payoutCurrency;
                                    const providerCost = Number(withdrawalQuote.provider_cost_amount || 0);
                                    const markup = Number(withdrawalQuote.takeer_markup_amount || 0);

                                    return (
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-start justify-between gap-3 text-xs font-semibold text-slate-700">
                                                <div>
                                                    <span>Withdrawal principal</span>
                                                    <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                                                        Amount to send before fees
                                                    </p>
                                                </div>
                                                <span className="text-right font-black text-slate-900">
                                                    {formatMoney(withdrawalQuote.merchant_principal_amount || withdrawalQuote.merchant_amount, withdrawalQuote.merchant_currency_code)}
                                                </span>
                                            </div>
                                            {hasCurrencyExchange && (
                                                <div className="flex items-start justify-between gap-3 text-xs font-semibold text-slate-600">
                                                    <span>Exchange rate{hasFxSpread ? ' (includes spread)' : ''}</span>
                                                    <span className="text-right">
                                                        1 {merchantCurrency} ≈ {formatFxRate(withdrawalQuote.effective_rate_merchant_to_payout)} {payoutCurrency}
                                                    </span>
                                                </div>
                                            )}
                                            {hasWithdrawalFee && (
                                                <>
                                                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-amber-700">
                                                        <span>Withdrawal fee</span>
                                                        <span>{formatMoney(withdrawalQuote.withdrawal_fee_amount, withdrawalQuote.withdrawal_fee_currency_code || withdrawalQuote.merchant_currency_code)}</span>
                                                    </div>
                                                    {(providerCost > 0 || markup > 0) && (
                                                        <p className="text-[10px] font-semibold leading-4 text-muted-foreground">
                                                            Includes provider rail cost {formatMoney(providerCost, withdrawalQuote.provider_cost_currency_code || withdrawalQuote.payout_currency_code)}
                                                            {markup > 0 ? ` + Takeer markup ${formatMoney(markup, withdrawalQuote.takeer_markup_currency_code || withdrawalQuote.merchant_currency_code)}` : ''}.
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                            <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-900">
                                                <span>Total wallet debit</span>
                                                <span className={`text-right ${withdrawalExceedsBalance ? 'text-red-600' : 'text-slate-950'}`}>
                                                    {formatMoney(withdrawalQuote.wallet_debit_amount, withdrawalQuote.merchant_currency_code)}
                                                </span>
                                            </div>
                                            {withdrawalExceedsBalance && (
                                                <p className="text-xs font-bold text-red-600">
                                                    Salio halitoshi baada ya kuongeza ada ya withdrawal.
                                                </p>
                                            )}
                                            <div className="border-t border-slate-200 pt-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-sm font-black text-slate-950">Estimated receive</span>
                                                    <span className="text-lg font-black text-brand-700">{formatMoney(withdrawalQuote.payout_amount, withdrawalQuote.payout_currency_code)}</span>
                                                </div>
                                                <p className="mt-1 text-[11px] font-semibold leading-5 text-muted-foreground">
                                                    {withdrawalQuote.note}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <p className="mt-3 text-xs font-semibold text-muted-foreground">Makadirio yataonekana baada ya kuweka kiasi.</p>
                                )}
                            </div>
                        )}

                        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black text-foreground">Security verification</p>
                                    <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                                        {hasTotpEnabled
                                            ? 'Weka code ya authenticator app yako kwa withdrawal hii.'
                                            : 'Tutatuma verification code kwenye simu yako kwa withdrawal hii.'}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <Input
                                    inputMode="numeric"
                                    placeholder="000000"
                                    className="h-11 text-center text-lg font-black tracking-[0.25em]"
                                    value={data.verification_code}
                                    onChange={e => setData('verification_code', hasTotpEnabled
                                        ? e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32)
                                        : e.target.value.replace(/\D/g, '').slice(0, 6)
                                    )}
                                />
                                {!hasTotpEnabled && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 shrink-0 rounded-xl font-bold"
                                        onClick={sendWithdrawalVerificationCode}
                                        disabled={sendingVerificationCode}
                                    >
                                        {sendingVerificationCode ? <Loader2 className="h-4 w-4 animate-spin" /> : (verificationCodeSent ? 'Tuma tena' : 'Tuma code')}
                                    </Button>
                                )}
                            </div>
                            {verificationMessage && (
                                <p className="mt-2 text-xs font-bold text-brand-700">{verificationMessage}</p>
                            )}
                            {errors.verification_code && (
                                <p className="mt-2 text-sm font-medium text-red-500">{errors.verification_code}</p>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 mt-6">
                            <Button type="button" variant="outline" className="w-full sm:w-auto h-11" onClick={() => setIsWithdrawModalOpen(false)}>
                                Ghairi
                            </Button>
                            <Button
                                type="submit"
                                className="w-full bg-brand-600 hover:bg-brand-700 h-11 font-bold"
                                disabled={processing || quoteLoading || Boolean(quoteError) || !withdrawalQuote || !payoutCredentials.length || !data.amount || Number(data.amount) <= 0 || withdrawalExceedsBalance}
                            >
                                {processing ? 'Tafadhali subiri...' : 'Tuma Ombi la Pesa'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={canWithdraw && isCredentialModalOpen} onOpenChange={(open) => {
                setIsCredentialModalOpen(open);
                if (!open) {
                    setCredentialErrors({});
                    setCredentialCodeSent(false);
                    setEditingCredential(null);
                }
            }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingCredential ? 'Edit payout account' : 'Add payout account'}</DialogTitle>
                        <DialogDescription>
                            {editingCredential
                                ? 'Re-enter the account details, then verify this change before saving.'
                                : 'Details must match the account holder. We will verify this change before saving.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={savePayoutCredential} className="space-y-5 py-2">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Payout channel</label>
                                <select
                                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={credentialForm.payment_provider_channel_id}
                                    onChange={(event) => {
                                        const nextChannel = payoutChannels.find((channel) => String(channel.id) === String(event.target.value));
                                        setCredentialForm((prev) => ({
                                            ...prev,
                                            payment_provider_channel_id: event.target.value,
                                            currency_code: nextChannel?.currency_code || businessCurrencyCode,
                                            details: {},
                                        }));
                                    }}
                                >
                                    {payoutChannels.filter((channel) => channel.id).map((channel) => (
                                        <option key={channel.id} value={channel.id}>
                                            {channel.label} · {(channel.currencies || [channel.currency_code]).join(', ')}
                                        </option>
                                    ))}
                                </select>
                                {credentialErrors.payment_provider_channel_id && <p className="text-xs font-bold text-red-500">{credentialErrors.payment_provider_channel_id}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Currency</label>
                                <select
                                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={credentialForm.currency_code}
                                    onChange={(event) => setCredentialForm((prev) => ({ ...prev, currency_code: event.target.value }))}
                                >
                                    {credentialChannelCurrencies.map((currency) => (
                                        <option key={currency} value={currency}>{currency}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {(selectedCredentialChannel?.required_fields_schema || []).map((field) => {
                                const options = field.type === 'bank_select'
                                    ? (selectedCredentialChannel?.supported_banks || [])
                                    : (field.options || []);
                                const value = credentialForm.details[field.key] || '';

                                return (
                                    <div key={field.key} className="space-y-2">
                                        <label className="text-sm font-semibold">{field.label}</label>
                                        {field.type === 'select' || field.type === 'bank_select' ? (
                                            <select
                                                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={value}
                                                onChange={(event) => setCredentialDetail(field.key, event.target.value)}
                                                required={Boolean(field.required)}
                                            >
                                                <option value="">Select {String(field.label || '').toLowerCase()}</option>
                                                {options.map((option) => {
                                                    const optionValue = option.code || option.key || option.provider_code || option.name;
                                                    return (
                                                        <option key={optionValue} value={optionValue}>
                                                            {option.name || optionValue}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        ) : (
                                            <Input
                                                type={field.type === 'phone' ? 'tel' : 'text'}
                                                value={value}
                                                onChange={(event) => setCredentialDetail(field.key, event.target.value)}
                                                required={Boolean(field.required)}
                                            />
                                        )}
                                        {credentialErrors[`details.${field.key}`] && (
                                            <p className="text-xs font-bold text-red-500">{credentialErrors[`details.${field.key}`]}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <input
                                type="checkbox"
                                checked={Boolean(credentialForm.is_default)}
                                onChange={(event) => setCredentialForm((prev) => ({ ...prev, is_default: event.target.checked }))}
                            />
                            Use as default payout account
                        </label>

                        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
                            <p className="text-sm font-black text-foreground">Security verification</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                                {hasTotpEnabled ? 'Use your authenticator code.' : 'Send a one-time code to your phone before saving.'}
                            </p>
                            <div className="mt-3 flex gap-2">
                                <Input
                                    inputMode="numeric"
                                    placeholder="000000"
                                    className="h-11 text-center text-lg font-black tracking-[0.25em]"
                                    value={credentialForm.verification_code}
                                    onChange={(event) => setCredentialForm((prev) => ({
                                        ...prev,
                                        verification_code: hasTotpEnabled
                                            ? event.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32)
                                            : event.target.value.replace(/\D/g, '').slice(0, 6),
                                    }))}
                                />
                                {!hasTotpEnabled && (
                                    <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl font-bold" onClick={sendCredentialVerificationCode}>
                                        {credentialCodeSent ? 'Send again' : 'Send code'}
                                    </Button>
                                )}
                            </div>
                            {credentialErrors.verification_code && <p className="mt-2 text-xs font-bold text-red-500">{credentialErrors.verification_code}</p>}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" className="h-11" onClick={() => setIsCredentialModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="h-11 bg-brand-600 font-bold hover:bg-brand-700" disabled={credentialSaving || !selectedCredentialChannel?.id || !String(credentialForm.verification_code || '').trim()}>
                                {credentialSaving ? 'Saving...' : (editingCredential ? 'Update account' : 'Save account')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={canWithdraw && Boolean(deletingCredential)} onOpenChange={(open) => {
                if (!open) {
                    setDeletingCredential(null);
                    setDeleteVerificationCode('');
                    setDeleteCredentialErrors({});
                    setDeleteCredentialCodeSent(false);
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remove payout account</DialogTitle>
                        <DialogDescription>
                            This disables {deletingCredential?.label || 'this payout account'} after security verification.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={deletePayoutCredential} className="space-y-5 py-2">
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                            <p className="text-sm font-black text-red-950">Security verification required</p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-red-800">
                                {hasTotpEnabled ? 'Use your authenticator code to remove this payout account.' : 'Send a one-time code to your phone before removing this payout account.'}
                            </p>
                            <div className="mt-3 flex gap-2">
                                <Input
                                    inputMode="numeric"
                                    placeholder="000000"
                                    className="h-11 text-center text-lg font-black tracking-[0.25em]"
                                    value={deleteVerificationCode}
                                    onChange={(event) => setDeleteVerificationCode(
                                        hasTotpEnabled
                                            ? event.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32)
                                            : event.target.value.replace(/\D/g, '').slice(0, 6)
                                    )}
                                />
                                {!hasTotpEnabled && (
                                    <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl bg-white font-bold" onClick={sendDeleteCredentialVerificationCode}>
                                        {deleteCredentialCodeSent ? 'Send again' : 'Send code'}
                                    </Button>
                                )}
                            </div>
                            {deleteCredentialErrors.verification_code && (
                                <p className="mt-2 text-xs font-bold text-red-600">{deleteCredentialErrors.verification_code}</p>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" className="h-11" onClick={() => setDeletingCredential(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="h-11 bg-red-600 font-bold hover:bg-red-700" disabled={deleteCredentialSaving || !String(deleteVerificationCode || '').trim()}>
                                {deleteCredentialSaving ? 'Removing...' : 'Remove account'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </AppLayout>
    );
}

function friendlyWithdrawalQuoteError(payload) {
    const reason = payload?.liquidity?.reason || payload?.error_code || '';
    const message = String(payload?.message || '').toLowerCase();

    if (
        ['missing_treasury_account', 'insufficient_provider_liquidity', 'treasury_account_inactive'].includes(reason)
        || message.includes('provider liquidity')
        || message.includes('liquidity')
        || message.includes('payout route')
    ) {
        return 'This payout method is temporarily unavailable. Your money has not been deducted.';
    }

    if (message.includes('route')) {
        return 'This payout method is not available right now. Your money has not been deducted.';
    }

    return payload?.message || 'We could not prepare this payout right now. Your money has not been deducted.';
}

function withdrawalSupportUrl({ merchantName, merchantUsername, amount, currencyCode, payoutCurrencyCode, accountLabel, channelLabel }) {
    const params = new URLSearchParams({
        category: 'payment',
        reference: merchantUsername ? `merchant:${merchantUsername}` : 'withdrawal',
        subject: 'Withdrawal payout needs support',
        message: [
            'Hello Takeer support,',
            '',
            'I tried to request a withdrawal, but the payout method was temporarily unavailable.',
            '',
            `Merchant: ${merchantName || merchantUsername || '-'}`,
            `Withdrawal amount: ${currencyCode || ''} ${amount || '-'}`.trim(),
            `Payout currency: ${payoutCurrencyCode || '-'}`,
            `Payout account: ${accountLabel || '-'}`,
            `Payout route: ${channelLabel || '-'}`,
            '',
            'Please check this payout route and help me complete the withdrawal.',
        ].join('\n'),
    });

    return `/help?${params.toString()}`;
}
