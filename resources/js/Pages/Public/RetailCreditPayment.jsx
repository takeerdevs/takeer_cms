import React, { useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import { AlertTriangle, Banknote, CalendarDays, CheckCircle2, CreditCard, Phone, ReceiptText, ShieldAlert, ShieldCheck, Store } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent } from '@/Components/ui/Card';
import { Input } from '@/Components/ui/Input';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';
import LanguageSwitcher from '@/Components/LanguageSwitcher';

export default function RetailCreditPayment({ order, merchant, paymentLinksDisabled = false }) {
    const { locale, t, copy } = useLocale();
    const [mode, setMode] = useState('full');
    const [customAmount, setCustomAmount] = useState('');
    const [paymentNumber, setPaymentNumber] = useState(order.customer_phone || '');
    const [buyerName, setBuyerName] = useState(order.customer_name || '');
    const [receivedConfirmation, setReceivedConfirmation] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [reported, setReported] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const currency = merchant?.currency?.code || 'TZS';
    const outstanding = Number(order.outstanding_balance || 0);
    const amount = useMemo(() => {
        if (mode === 'full') return outstanding;
        return Number(customAmount || 0);
    }, [mode, customAmount, outstanding]);

    const formatCurrency = (val) => new Intl.NumberFormat(locale === 'sw' ? 'sw-TZ' : 'en-TZ', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
    }).format(Number(val || 0));

    const formatDateTime = (val) => {
        if (!val) return t('retailCredit.unknownDate');

        return new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(val));
    };

    const submitPayment = async () => {
        if (submitting || sent) return;
        if (!paymentNumber.trim()) {
            toast.error(t('product.phoneEmailRequired'));
            return;
        }
        if (!amount || amount <= 0 || amount > outstanding) {
            toast.error(t('retailCredit.maxAmount', { amount: formatCurrency(outstanding) }));
            return;
        }
        if (!receivedConfirmation) {
            toast.error(t('retailCredit.receivedTitle'));
            return;
        }

        setSubmitting(true);
        try {
            const res = await window.axios.post(`/api/retail-credit-payments/${order.public_id}/pay`, {
                amount,
                payment_number: paymentNumber,
                buyer_name: buyerName,
                received_confirmation: receivedConfirmation,
            });
            setSent(true);
            toast.success(res.data?.message || t('retailCredit.paymentSaved'));
        } catch (err) {
            toast.error(err.response?.data?.message || t('retailCredit.savingPayment'));
        } finally {
            setSubmitting(false);
        }
    };

    const reportRequest = async (reason = 'not_received') => {
        if (reporting || reported) return;

        setReporting(true);
        try {
            const res = await window.axios.post(`/api/retail-credit-payments/${order.public_id}/report`, {
                reporter_name: buyerName,
                reporter_phone: paymentNumber || order.customer_phone,
                reason,
                notes: null,
            });
            setReported(true);
            toast.success(res.data?.message || t('retailCredit.reportReceived'));
        } catch (err) {
            toast.error(err.response?.data?.message || t('retailCredit.reporting'));
        } finally {
            setReporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <Head title={`${t('retailCredit.title')} | ${merchant?.display_name || 'Takeer'}`}>
                <meta name="description" content={t('retailCredit.description')} />
            </Head>
            <div className="fixed right-3 top-3 z-[60]"><LanguageSwitcher /></div>

            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-amber-600 text-white grid place-items-center font-black">
                            <Store className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('retailCredit.paymentRequest')}</p>
                            <p className="font-black truncate">{merchant?.display_name || copy('Merchant', 'Mfanyabiashara')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <ShieldCheck className="h-5 w-5" />
                        <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{t('retailCredit.posRecord')}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 pb-20 space-y-5">
                <section className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
                        <ReceiptText className="h-4 w-4" />
                        POS #{order.public_id}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight">{t('retailCredit.payShopBalance')}</h1>
                    {paymentLinksDisabled && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
                            <ShieldAlert className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="font-black text-red-950">{t('retailCredit.disabledTitle')}</p>
                                <p className="text-sm font-bold text-red-800">{t('retailCredit.disabledDescription')}</p>
                            </div>
                        </div>
                    )}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="font-black text-amber-950">{t('retailCredit.receivedTitle')}</p>
                            <p className="text-sm font-bold text-amber-800">{t('retailCredit.receivedDescription')}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            {t('retailCredit.collected')} {formatDateTime(order.created_at)}
                        </span>
                        {order.pos_staff && <span>{t('retailCredit.servedBy')} {order.pos_staff}</span>}
                    </div>
                </section>

                <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                        <div className="p-5 md:p-6 border-b border-slate-100">
                            <p className="text-sm font-bold text-slate-500">{t('retailCredit.customer')}</p>
                            <h2 className="text-2xl font-black mt-1">{order.customer_name || t('retailCredit.customer')}</h2>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500 mt-1">
                                <Phone className="h-4 w-4" />
                                {order.customer_phone || t('retailCredit.numberNotSaved')}
                            </div>
                        </div>

                        <div className="p-5 md:p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-xl bg-slate-50 p-3">
                                    <p className="text-[9px] font-black uppercase text-slate-400">{t('retailCredit.total')}</p>
                                    <p className="text-sm font-black">{formatCurrency(order.payable_total)}</p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 p-3">
                                    <p className="text-[9px] font-black uppercase text-emerald-600">{t('retailCredit.paid')}</p>
                                    <p className="text-sm font-black text-emerald-700">{formatCurrency(order.total_paid)}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 p-3">
                                    <p className="text-[9px] font-black uppercase text-amber-700">{t('retailCredit.balance')}</p>
                                    <p className="text-sm font-black text-amber-800">{formatCurrency(outstanding)}</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100">
                                {(order.items || []).map((item) => (
                                    <div key={item.id} className="p-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-black truncate">
                                                {item.product_title}{item.variant_name ? ` (${item.variant_name})` : ''}
                                            </p>
                                            <p className="text-xs font-bold text-slate-500">{formatCurrency(item.unit_price)} {t('retailCredit.each')}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-xs font-black text-slate-500">{copy('Qty', 'Kiasi')} {item.quantity}</p>
                                            <p className="font-black">{formatCurrency(item.line_total)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {!paymentLinksDisabled && (
                <Card className="bg-white border-slate-200 shadow-sm rounded-2xl">
                    <CardContent className="p-5 md:p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('full')}
                                className={`h-12 rounded-xl border text-sm font-black ${mode === 'full' ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}
                            >
                                {t('retailCredit.payFull')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('partial')}
                                className={`h-12 rounded-xl border text-sm font-black ${mode === 'partial' ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}
                            >
                                {t('retailCredit.payOther')}
                            </button>
                        </div>

                        {mode === 'partial' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('retailCredit.amountToPay')}</label>
                                <Input
                                    type="number"
                                    min="100"
                                    max={outstanding}
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    className="h-12 rounded-xl font-black"
                                    placeholder={t('retailCredit.maxAmount', { amount: formatCurrency(outstanding) })}
                                />
                            </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('retailCredit.yourName')}</label>
                                <Input
                                    value={buyerName}
                                    onChange={(e) => setBuyerName(e.target.value)}
                                    className="h-12 rounded-xl"
                                    placeholder={t('retailCredit.yourName')}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('retailCredit.paymentPhone')}</label>
                                <Input
                                    value={paymentNumber}
                                    onChange={(e) => setPaymentNumber(e.target.value)}
                                    className="h-12 rounded-xl"
                                    placeholder={copy('07XXXXXXXX / +255...', '07XXXXXXXX / +255...')}
                                />
                            </div>
                        </div>

                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('retailCredit.amountDue')}</p>
                                <p className="text-2xl font-black">{formatCurrency(amount)}</p>
                            </div>
                            <CreditCard className="h-6 w-6 text-amber-600" />
                        </div>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={receivedConfirmation}
                                onChange={(e) => setReceivedConfirmation(e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm font-bold text-slate-700 leading-relaxed">
                                {t('retailCredit.confirmation', { merchant: merchant?.display_name || t('retailCredit.customer') })}
                            </span>
                        </label>

                        {sent ? (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex gap-3">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-black text-emerald-900">{t('retailCredit.paymentSaved')}</p>
                                    <p className="text-sm font-bold text-emerald-700 mt-1">{t('retailCredit.paymentSavedDescription')}</p>
                                </div>
                            </div>
                        ) : (
                            <Button
                                className="w-full h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black"
                                onClick={submitPayment}
                                disabled={submitting || outstanding <= 0 || !receivedConfirmation}
                            >
                                <Banknote className="h-4 w-4 mr-2" />
                                {submitting ? t('retailCredit.savingPayment') : t('retailCredit.payBalance')}
                            </Button>
                        )}

                        <div className="pt-2 border-t border-slate-100">
                            {reported ? (
                                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm font-bold text-red-800">
                                    {t('retailCredit.reportReceived')}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => reportRequest('not_received')}
                                    disabled={reporting}
                                    className="w-full text-sm font-black text-red-700 hover:text-red-800 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 h-11"
                                >
                                    {reporting ? t('retailCredit.reporting') : t('retailCredit.notReceived')}
                                </button>
                            )}
                        </div>
                    </CardContent>
                </Card>
                )}
            </main>
        </div>
    );
}
