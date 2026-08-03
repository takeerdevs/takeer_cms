import React, { useState } from 'react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Card, CardContent } from '@/Components/ui/Card';
import { CheckCircle2, Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, ShieldX } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

export default function TotpSecurityPanel({ initialEnabled = false }) {
    const { t } = useLocale();
    const [totpSetup, setTotpSetup] = useState(null);
    const [totpCode, setTotpCode] = useState('');
    const [totpBusy, setTotpBusy] = useState(false);
    const [totpMessage, setTotpMessage] = useState('');
    const [totpError, setTotpError] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [totpEnabled, setTotpEnabled] = useState(Boolean(initialEnabled));

    const startTotpSetup = async () => {
        setTotpBusy(true);
        setTotpError('');
        setTotpMessage('');
        setRecoveryCodes([]);

        try {
            const res = await window.axios.post('/auth/2fa/totp/start');
            setTotpSetup(res.data);
            setTotpMessage(t('security.scanAndCode'));
        } catch (error) {
            setTotpError(error.response?.data?.message || t('security.setupFailed'));
        } finally {
            setTotpBusy(false);
        }
    };

    const confirmTotpSetup = async () => {
        setTotpBusy(true);
        setTotpError('');
        setTotpMessage('');

        try {
            const res = await window.axios.post('/auth/2fa/totp/confirm', {
                code: totpCode,
            });
            setTotpEnabled(true);
            setTotpSetup(null);
            setTotpCode('');
            setRecoveryCodes(res.data?.recovery_codes || []);
            setTotpMessage(res.data?.message || t('security.enabledMessage'));
        } catch (error) {
            setTotpError(error.response?.data?.message || t('security.invalidCode'));
        } finally {
            setTotpBusy(false);
        }
    };

    const regenerateRecoveryCodes = async () => {
        setTotpBusy(true);
        setTotpError('');
        setTotpMessage('');

        try {
            const res = await window.axios.post('/auth/2fa/totp/recovery-codes', {
                code: totpCode,
            });
            setRecoveryCodes(res.data?.recovery_codes || []);
            setTotpCode('');
            setTotpMessage(res.data?.message || t('security.newCodes'));
        } catch (error) {
            setTotpError(error.response?.data?.message || t('security.enterCode'));
        } finally {
            setTotpBusy(false);
        }
    };

    const disableTotp = async () => {
        setTotpBusy(true);
        setTotpError('');
        setTotpMessage('');

        try {
            const res = await window.axios.delete('/auth/2fa/totp', {
                data: { code: totpCode },
            });
            setTotpEnabled(false);
            setTotpCode('');
            setTotpSetup(null);
            setRecoveryCodes([]);
            setTotpMessage(res.data?.message || t('security.disabledMessage'));
        } catch (error) {
            setTotpError(error.response?.data?.message || t('security.verificationFailed'));
        } finally {
            setTotpBusy(false);
        }
    };

    const copyRecoveryCodes = async () => {
        if (!recoveryCodes.length || !navigator?.clipboard) return;
        await navigator.clipboard.writeText(recoveryCodes.join('\n'));
        setTotpMessage(t('security.copied'));
    };

    return (
        <Card id="security" className="border-border shadow-sm">
            <CardContent className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-700">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-foreground">{t('security.title')}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t('security.description')}
                            </p>
                        </div>
                    </div>
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${totpEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {totpEnabled && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {totpEnabled ? t('security.enabled') : t('security.disabled')}
                    </span>
                </div>

                {totpMessage && (
                    <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                        {totpMessage}
                    </div>
                )}
                {totpError && (
                    <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                        {totpError}
                    </div>
                )}

                {!totpEnabled && !totpSetup && (
                    <Button type="button" disabled={totpBusy} onClick={startTotpSetup} className="mt-5 h-11 rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700">
                        {totpBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        {t('security.enable')}
                    </Button>
                )}

                {totpSetup && (
                    <div className="mt-5 grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
                        <div className="rounded-2xl border border-input bg-white p-3" dangerouslySetInnerHTML={{ __html: totpSetup.qr_svg }} />
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('security.manualSecret')}</label>
                                <p className="mt-1 break-all rounded-xl bg-muted/40 px-3 py-2 font-mono text-sm font-bold">{totpSetup.secret}</p>
                            </div>
                            <Input
                                inputMode="numeric"
                                placeholder="000000"
                                className="h-12 text-center text-xl font-black tracking-[0.3em]"
                                value={totpCode}
                                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" disabled={totpBusy || totpCode.length !== 6} onClick={confirmTotpSetup} className="h-11 rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700">
                                    {totpBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('security.confirm')}
                                </Button>
                                <Button type="button" variant="outline" disabled={totpBusy} onClick={() => { setTotpSetup(null); setTotpCode(''); }}>
                                    {t('security.cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {totpEnabled && (
                    <div className="mt-5 space-y-3">
                        <Input
                            inputMode="numeric"
                            placeholder={t('security.codePlaceholder')}
                            className="h-12 font-bold"
                            value={totpCode}
                            onChange={e => setTotpCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32))}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" disabled={totpBusy || !totpCode} onClick={regenerateRecoveryCodes} className="h-11 rounded-xl font-bold">
                                {totpBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                {t('security.newRecovery')}
                            </Button>
                            <Button type="button" variant="outline" disabled={totpBusy || !totpCode} onClick={disableTotp} className="h-11 rounded-xl border-red-200 font-bold text-red-700 hover:bg-red-50">
                                {totpBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldX className="mr-2 h-4 w-4" />}
                                {t('security.disable')}
                            </Button>
                        </div>
                    </div>
                )}

                {recoveryCodes.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-black text-amber-950">{t('security.recoveryCodes')}</p>
                                <p className="mt-1 text-xs font-semibold text-amber-800">{t('security.recoveryWarning')}</p>
                            </div>
                            <Button type="button" variant="outline" className="h-9 shrink-0 rounded-xl bg-white" onClick={copyRecoveryCodes}>
                                <Copy className="mr-2 h-4 w-4" />
                                {t('security.copy')}
                            </Button>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {recoveryCodes.map((code) => (
                                <code key={code} className="rounded-lg bg-white px-3 py-2 text-sm font-black text-slate-900">
                                    {code}
                                </code>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
