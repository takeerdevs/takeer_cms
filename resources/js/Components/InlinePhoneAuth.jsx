import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

export default function InlinePhoneAuth({ open, onClose, onAuthenticated, audience = 'buyer' }) {
    const { copy } = useLocale();
    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setError('');
    }, [open]);

    if (!open) return null;

    async function sendCode(event) {
        event.preventDefault();
        if (!phone.trim()) return;
        setBusy(true);
        setError('');
        try {
            const response = await axios.post('/auth/otp/send', { phone_number: phone.trim(), purpose: 'login' });
            setStep(response.data?.requires_totp ? 'totp' : 'otp');
            setCode('');
        } catch (exception) {
            setError(exception.response?.data?.message || copy('We could not send the verification code.', 'Imeshindikana kutuma namba ya uthibitisho.'));
        } finally {
            setBusy(false);
        }
    }

    async function verifyCode(event) {
        event.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        setError('');
        try {
            const endpoint = step === 'totp' ? '/auth/2fa/totp/login' : '/auth/otp/verify';
            const payload = step === 'totp'
                ? { phone_number: phone.trim(), code: code.trim() }
                : { phone_number: phone.trim(), otp: code.trim(), purpose: 'login' };
            const response = await axios.post(endpoint, payload);
            if (response.data?.token) localStorage.setItem('takeer_token', response.data.token);
            onAuthenticated?.(response.data?.user || { phone_number: phone.trim(), phone_verified_at: new Date().toISOString() });
            onClose?.();
        } catch (exception) {
            if (exception.response?.data?.requires_totp) {
                setStep('totp');
                setCode('');
                return;
            }
            setError(exception.response?.data?.message || copy('The verification code is incorrect or expired.', 'Namba ya uthibitisho si sahihi au imeisha muda.'));
        } finally {
            setBusy(false);
        }
    }

    const isSeller = audience === 'seller';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={copy('Phone verification', 'Uthibitisho wa simu')}>
            <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-br from-brand-50 via-white to-orange-50 p-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
                            {step === 'phone' ? <Smartphone className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                        </span>
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">Takeer secure access</p>
                            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                                {step === 'phone'
                                    ? copy(isSeller ? 'Continue as the seller' : 'Continue without leaving', isSeller ? 'Endelea kama muuzaji' : 'Endelea bila kuondoka hapa')
                                    : copy('Enter your verification code', 'Weka namba ya uthibitisho')}
                            </h2>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-slate-900" aria-label={copy('Close', 'Funga')}><X className="h-5 w-5" /></button>
                </div>

                <div className="p-5">
                    {step === 'phone' ? (
                        <form onSubmit={sendCode} className="space-y-4">
                            <p className="text-sm font-medium leading-6 text-slate-600">
                                {copy(
                                    isSeller ? 'Use your phone number. Existing accounts sign in; new accounts are created securely before seller setup continues.' : 'Use your phone number. If you are new, Takeer creates a buyer account automatically—no KYC or extra registration page.',
                                    isSeller ? 'Tumia namba yako ya simu. Akaunti iliyopo itaingia; akaunti mpya itatengenezwa salama kabla ya kuendelea na seller setup.' : 'Tumia namba yako ya simu. Kama ni mpya, Takeer itatengeneza akaunti ya mnunuzi moja kwa moja—hakuna KYC wala ukurasa mwingine wa usajili.'
                                )}
                            </p>
                            <Input value={phone} onChange={(event) => { setPhone(event.target.value); setError(''); }} type="tel" inputMode="tel" autoComplete="tel" autoFocus placeholder="07XX XXX XXX" className="h-14 rounded-2xl px-4 text-lg font-black" />
                            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{copy('Your product details stay on this page while you verify.', 'Maelezo yako ya bidhaa yatabaki hapa wakati unathibitisha.')}</div>
                            {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                            <Button type="submit" disabled={busy || !phone.trim()} className="h-12 w-full rounded-xl font-black">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}{copy('Send code', 'Tuma namba')}</Button>
                        </form>
                    ) : (
                        <form onSubmit={verifyCode} className="space-y-4">
                            <p className="text-sm font-medium leading-6 text-slate-600">{step === 'totp' ? copy('This account uses an authenticator app. Enter its current code.', 'Akaunti hii inatumia authenticator app. Weka namba ya sasa.') : copy(`We sent a 6-digit code to ${phone}.`, `Tumetuma namba yenye tarakimu 6 kwenda ${phone}.`)}</p>
                            <Input value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" className="h-16 rounded-2xl text-center text-2xl font-black tracking-[0.35em]" />
                            {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                            <Button type="submit" disabled={busy || code.length !== 6} className="h-12 w-full rounded-xl font-black">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{copy('Verify and continue', 'Thibitisha na endelea')}</Button>
                            <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(''); }} className="inline-flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />{copy('Use another number', 'Tumia namba nyingine')}</button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
