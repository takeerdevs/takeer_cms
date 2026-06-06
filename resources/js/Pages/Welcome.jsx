import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import {
    ArrowRight, ShieldCheck,
    User, Store, CheckCircle2, ChevronRight,
    Sparkles, TrendingUp, Loader2,
    Smartphone, KeyRound, FileText, BriefcaseBusiness,
    PackageCheck, RefreshCcw, MapPin
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import axios from 'axios';

function PasswordlessEntry({ intended }) {
    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [totpMode, setTotpMode] = useState('authenticator');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const safeRedirect = intended && intended.startsWith('/') && !intended.startsWith('//') ? intended : '/feed';

    const sendOtp = async (event) => {
        event.preventDefault();
        if (!phone.trim()) {
            setError('Andika namba yako ya simu.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await axios.post('/auth/otp/send', {
                phone_number: phone.trim(),
                purpose: 'login',
            });

            if (res.data?.requires_totp) {
                setStep('totp');
                setTotpMode('authenticator');
                setTotpCode('');
                setNotice('Akaunti hii inalindwa na authenticator app.');
            } else {
                setStep('otp');
                setNotice('');
            }
        } catch (e) {
            setError(e.response?.data?.message || 'Imeshindwa kutuma verification code. Jaribu tena.');
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async (event) => {
        event.preventDefault();
        if (otp.trim().length !== 6) {
            setError('Weka verification code yenye tarakimu 6.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await axios.post('/auth/otp/verify', {
                phone_number: phone.trim(),
                otp: otp.trim(),
                purpose: step === 'recoveryOtp' ? 'totp_recovery' : 'login',
            });

            if (res.data?.token) {
                localStorage.setItem('takeer_token', res.data.token);
            }

            router.visit(safeRedirect);
        } catch (e) {
            if (e.response?.data?.requires_totp) {
                setStep('totp');
                setTotpMode('authenticator');
                setOtp('');
                setNotice('Akaunti hii inalindwa na authenticator app.');
                setError('');
                return;
            }
            setError(e.response?.data?.message || 'Verification code si sahihi au imeisha muda wake.');
        } finally {
            setLoading(false);
        }
    };

    const verifyTotp = async (event) => {
        event.preventDefault();
        if (!totpCode.trim()) {
            setError(totpMode === 'recovery' ? 'Weka recovery code.' : 'Weka authenticator code.');
            return;
        }

        if (totpMode === 'authenticator' && totpCode.trim().length !== 6) {
            setError('Weka authenticator code yenye tarakimu 6.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await axios.post('/auth/2fa/totp/login', {
                phone_number: phone.trim(),
                code: totpCode.trim(),
            });

            if (res.data?.token) {
                localStorage.setItem('takeer_token', res.data.token);
            }

            router.visit(safeRedirect);
        } catch (e) {
            setError(e.response?.data?.message || 'Authenticator au recovery code si sahihi.');
        } finally {
            setLoading(false);
        }
    };

    const sendRecoveryOtp = async () => {
        if (!phone.trim()) {
            setStep('phone');
            setError('Andika namba yako ya simu.');
            return;
        }

        setLoading(true);
        setError('');
        setNotice('');

        try {
            await axios.post('/auth/otp/send', {
                phone_number: phone.trim(),
                purpose: 'totp_recovery',
            });
            setOtp('');
            setStep('recoveryOtp');
            setNotice('Recovery OTP imetumwa. Ukithibitisha, 2FA itaondolewa na utahitaji kuiweka tena.');
        } catch (e) {
            setError(e.response?.data?.message || 'Imeshindwa kutuma recovery OTP.');
        } finally {
            setLoading(false);
        }
    };

    const resetToPhone = () => {
        setStep('phone');
        setOtp('');
        setTotpCode('');
        setTotpMode('authenticator');
        setError('');
        setNotice('');
    };

    const showAuthenticatorInput = () => {
        setStep('totp');
        setTotpMode('authenticator');
        setTotpCode('');
        setError('');
        setNotice('Akaunti hii inalindwa na authenticator app.');
    };

    const showRecoveryCodeInput = () => {
        setTotpMode('recovery');
        setTotpCode('');
        setError('');
        setNotice('Tumia recovery code uliyoihifadhi wakati uliweka 2FA.');
    };

    const showSmsRecoveryConfirm = () => {
        setStep('recoveryConfirm');
        setOtp('');
        setTotpCode('');
        setError('');
        setNotice('');
    };

    const title = {
        phone: 'Karibu Takeer',
        otp: 'Thibitisha namba',
        totp: totpMode === 'recovery' ? 'Weka recovery code' : 'Weka authenticator code',
        recoveryConfirm: 'Recover account',
        recoveryOtp: 'Recover account',
    }[step];

    const description = {
        phone: 'Tumia namba yako kuingia, kununua, kuuza, au kuendelea ulipoishia.',
        otp: `Tumeituma verification code kwenye ${phone}.`,
        totp: totpMode === 'recovery'
            ? 'Tumia moja kati ya recovery codes ulizohifadhi.'
            : 'Tumia code ya tarakimu 6 kutoka kwenye authenticator app.',
        recoveryConfirm: 'Tutakutumia SMS OTP kuthibitisha umiliki wa namba. Ukifanikiwa, 2FA ya zamani itaondolewa.',
        recoveryOtp: `Tumeituma recovery OTP kwenye ${phone}.`,
    }[step];

    const formSubmitHandler = {
        phone: sendOtp,
        totp: verifyTotp,
        recoveryConfirm: (event) => {
            event.preventDefault();
            sendRecoveryOtp();
        },
    }[step] || verifyOtp;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="rounded-[2rem] border border-brand-100 bg-white/95 p-5 shadow-2xl shadow-brand-900/10 dark:border-brand-900/60 dark:bg-slate-950/90"
        >
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    {step === 'phone' ? <Smartphone className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
                </div>
                <div>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                        {title}
                    </h2>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>

            <form onSubmit={formSubmitHandler} className="space-y-3">
                {step === 'phone' ? (
                    <Input
                        value={phone}
                        onChange={(e) => {
                            setPhone(e.target.value);
                            setError('');
                        }}
                        type="tel"
                        inputMode="tel"
                        placeholder="07XX XXX XXX"
                        className="h-14 rounded-2xl border-brand-100 px-5 text-lg font-black shadow-sm"
                    />
                ) : step === 'totp' ? (
                    <>
                        {totpMode === 'authenticator' ? (
                            <Input
                                value={totpCode}
                                onChange={(e) => {
                                    setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                    setError('');
                                }}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                name="one-time-code"
                                pattern="[0-9]*"
                                placeholder="000000"
                                className="h-14 rounded-2xl border-brand-100 px-5 text-center text-2xl font-black tracking-[0.35em] shadow-sm"
                            />
                        ) : (
                            <Input
                                value={totpCode}
                                onChange={(e) => {
                                    setTotpCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32));
                                    setError('');
                                }}
                                type="text"
                                autoCapitalize="characters"
                                autoComplete="off"
                                spellCheck="false"
                                placeholder="Recovery code"
                                className="h-14 rounded-2xl border-brand-100 px-5 text-center text-base font-black tracking-[0.12em] shadow-sm"
                            />
                        )}
                    </>
                ) : step === 'recoveryConfirm' ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm font-bold leading-6 text-amber-900">
                        SMS recovery ni kwa wakati umebadilisha au umepoteza authenticator app. Baada ya kuthibitisha OTP, tutazima 2FA ya sasa ili uiweke upya.
                    </div>
                ) : (
                    <Input
                        value={otp}
                        onChange={(e) => {
                            setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                            setError('');
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        name="one-time-code"
                        pattern="[0-9]*"
                        placeholder="000000"
                        className="h-14 rounded-2xl border-brand-100 px-5 text-center text-2xl font-black tracking-[0.35em] shadow-sm"
                    />
                )}

                {notice && (
                    <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                        {notice}
                    </p>
                )}

                {error && (
                    <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                        {error}
                    </p>
                )}

                <Button
                    type="submit"
                    disabled={loading}
                    className="h-14 w-full rounded-2xl bg-brand-600 text-base font-black text-white shadow-xl shadow-brand-600/20 hover:bg-brand-700"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (step === 'phone' || step === 'recoveryConfirm' ? 'Tuma code' : 'Ingia Takeer')}
                    {!loading && <ChevronRight className="ml-2 h-5 w-5" />}
                </Button>
            </form>

            {step !== 'phone' && (
                <div className="mt-3 space-y-2">
                    {step === 'totp' && (
                        <>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={totpMode === 'authenticator' ? showRecoveryCodeInput : showAuthenticatorInput}
                                className="w-full text-center text-xs font-black uppercase tracking-widest text-brand-600 disabled:opacity-50"
                            >
                                {totpMode === 'authenticator' ? 'Tumia recovery code' : 'Tumia authenticator app'}
                            </button>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={showSmsRecoveryConfirm}
                                className="w-full text-center text-xs font-black uppercase tracking-widest text-amber-700 disabled:opacity-50"
                            >
                                Siwezi kufikia authenticator
                            </button>
                        </>
                    )}
                    {step === 'recoveryConfirm' && (
                        <button
                            type="button"
                            disabled={loading}
                            onClick={showAuthenticatorInput}
                            className="w-full text-center text-xs font-black uppercase tracking-widest text-brand-600 disabled:opacity-50"
                        >
                            Rudi kwenye authenticator
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={resetToPhone}
                        className="w-full text-center text-xs font-black uppercase tracking-widest text-brand-600"
                    >
                        Badilisha namba
                    </button>
                </div>
            )}

            <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">au</span>
                <div className="h-px flex-1 bg-border" />
            </div>

            <a
                href="/auth/google/redirect"
                className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background text-sm font-black text-foreground shadow-sm transition hover:bg-accent"
            >
                <span className="text-lg font-black text-blue-500">G</span>
                Endelea na Google
            </a>
        </motion.div>
    );
}

function ProtectedFlow() {
    const steps = [
        {
            title: 'Lipa salama',
            icon: ShieldCheck,
            tone: 'text-brand-600 bg-brand-50',
        },
        {
            title: 'Oda itimizwe',
            icon: PackageCheck,
            tone: 'text-orange-600 bg-orange-50',
        },
        {
            title: 'Pesa itolewe',
            icon: CheckCircle2,
            tone: 'text-green-600 bg-green-50',
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
            className="mt-5 rounded-3xl border border-border/70 bg-white/80 p-4 shadow-lg shadow-slate-900/5 backdrop-blur dark:bg-slate-950/70"
        >
            <div className="relative grid grid-cols-3 gap-3">
                <div className="absolute left-[17%] right-[17%] top-6 hidden h-px bg-gradient-to-r from-brand-200 via-orange-200 to-green-200 sm:block" />
                {steps.map((step) => {
                    const Icon = step.icon;

                    return (
                        <div key={step.title} className="relative z-10 flex flex-col items-center gap-2 text-center">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${step.tone}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-black leading-tight text-foreground">
                                {step.title}
                            </p>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}

export default function Welcome({ auth, intended }) {
    const heroImage = "/images/welcome/hero.png";
    const sellingOptions = [
        {
            title: 'Bidhaa za kidijitali',
            description: 'Uza ujuzi wako kama kozi, templates, downloads, files, mafunzo, au kazi nyingine ya kidigitali.',
            icon: FileText,
            tone: 'brand',
        },
        {
            title: 'Huduma',
            description: 'Pokea oda za huduma, bookings, kazi za ubunifu, ushauri, ufundi, au huduma yoyote inayohitaji makubaliano.',
            icon: BriefcaseBusiness,
            tone: 'blue',
        },
        {
            title: 'Bidhaa halisi',
            description: 'Weka bidhaa zako sokoni, pokea malipo salama, na fikisha package kwa mteja popote Tanzania.',
            icon: PackageCheck,
            tone: 'orange',
        },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.6, ease: "easeOut" }
        }
    };

    return (
        <AppLayout>
            <Head title="Uza na Ununue kwa Usalama | Takeer" />

            <div className="relative min-h-screen overflow-hidden bg-background">
                {/* ── Dynamic Background ── */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/10 blur-[120px] animate-pulse" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                    {/* ── Hero Section ── */}
                    <section className="pt-16 pb-24 md:pt-24">
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="space-y-10"
                        >
                            <motion.h1 variants={itemVariants} className="max-w-5xl text-5xl md:text-6xl xl:text-7xl font-black text-foreground tracking-tighter leading-[1.08]">
                                Uza Ujuzi, Huduma na Bidhaa{' '}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-orange-500">
                                    kwa Usalama
                                </span>
                            </motion.h1>

                            <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] xl:gap-14">
                                <div className="space-y-7">
                                    <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                                        Takeer ni soko la digital products, services, na physical products lenye malipo yanayolindwa na Takeer. Muuzaji analipwa akitimiza oda, na mnunuzi analindwa mpaka apokee alichoagiza.
                                    </motion.p>

                                    <motion.div variants={itemVariants} className="flex flex-col gap-3 border-y border-border/70 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-3">
                                        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                            Unaweza kuuza
                                        </span>
                                        {['Digital products', 'Services', 'Physical products'].map((label) => (
                                            <span key={label} className="inline-flex items-center gap-2 text-sm font-black text-foreground">
                                                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
                                                {label}
                                            </span>
                                        ))}
                                    </motion.div>

                                    <motion.div variants={itemVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        {!auth?.user ? (
                                            <>
                                                <Button
                                                    size="lg"
                                                    className="h-14 px-7 rounded-2xl text-base font-black bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-600/20 active:scale-95 transition-all sm:min-w-60"
                                                    onClick={() => router.visit('/merchant/register')}
                                                >
                                                    Fungua Akaunti (Bure)
                                                    <ChevronRight className="ml-2 h-5 w-5" />
                                                </Button>
                                                <Button
                                                    size="lg"
                                                    variant="outline"
                                                    className="h-14 px-7 rounded-2xl text-base font-black border-2 hover:bg-muted active:scale-95 transition-all sm:min-w-48"
                                                    onClick={() => router.visit('/feed')}
                                                >
                                                    Anza Kununua
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                size="lg"
                                                className="h-14 px-8 rounded-2xl text-lg font-bold bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-600/20 active:scale-95 transition-all"
                                                onClick={() => router.visit('/profile')}
                                            >
                                                Nenda Kwenye Profile
                                                <ArrowRight className="ml-2 h-5 w-5" />
                                            </Button>
                                        )}
                                    </motion.div>

                                    <motion.div variants={itemVariants} className="flex items-center gap-6 pt-6">
                                        <div className="flex -space-x-3">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div key={i} className="h-10 w-10 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden">
                                                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt="" />
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-sm font-medium text-muted-foreground">
                                            <span className="text-foreground font-bold">10,000+</span> wauzaji na wanunuzi tayari wanatumia Takeer
                                        </p>
                                    </motion.div>
                                </div>

                                {!auth?.user ? (
                                    <div className="relative mx-auto w-full max-w-md lg:ml-auto">
                                        <PasswordlessEntry intended={intended} />
                                        <ProtectedFlow />
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
                                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="relative hidden lg:block"
                                    >
                                        <div className="absolute inset-0 bg-brand-500/20 blur-[100px] rounded-full" />
                                        <div className="relative z-10 p-8 glass-card border-white/20 dark:border-white/10 rounded-[3rem] shadow-2xl overflow-hidden group">
                                            <img
                                                src={heroImage}
                                                alt="Takeer Ecosystem"
                                                className="w-full h-auto rounded-[2rem] transition-transform duration-700 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                                        </div>

                                        {/* Floating Stats */}
                                        <motion.div
                                            animate={{ y: [0, -10, 0] }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                            className="absolute -top-6 -right-6 p-4 glass-card rounded-2xl shadow-xl z-20 border-white/20"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600">
                                                    <TrendingUp className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Growth</p>
                                                    <p className="text-xl font-black text-foreground">+142%</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </section>

                    {/* ── What You Can Sell ── */}
                    <section className="pb-20">
                        <div className="mb-10 max-w-3xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300">
                                <Sparkles className="h-4 w-4" />
                                Selling enabled
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                                Kila mtu ana kitu cha kuuza
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                                Ukiwa na skill, service, bidhaa ya kidigitali, au stock ya dukani, Takeer inakupa sehemu moja ya kuuza, kupokea oda, malipo salama ndani ya Takeer, na kumhakikishia mteja kuwa hatapoteza fedha.
                            </p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            {sellingOptions.map((option) => {
                                const Icon = option.icon;
                                const toneClass = {
                                    brand: 'bg-brand-100 text-brand-600 dark:bg-brand-900/40',
                                    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40',
                                    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-950/40',
                                }[option.tone];

                                return (
                                    <motion.div
                                        key={option.title}
                                        whileHover={{ y: -6 }}
                                        className="rounded-[2rem] border border-border/70 bg-white/80 p-6 shadow-lg shadow-slate-900/5 dark:bg-card/80"
                                    >
                                        <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <h3 className="text-xl font-black tracking-tight">{option.title}</h3>
                                        <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">
                                            {option.description}
                                        </p>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </section>

                    {/* ── Account Types Section ── */}
                    <section className="py-24 border-t border-border/50">
                        <div className="text-center space-y-4 mb-16">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Chagua Jinsi ya Kuanza</h2>
                            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                                Anza kuuza mara moja kama mtu binafsi, au jenga biashara yenye wasifu, timu, maeneo, na tools za usimamizi kadiri unavyokua.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            <motion.div
                                whileHover={{ y: -10 }}
                                className="p-8 rounded-[2.5rem] bg-gradient-to-br from-white to-brand-50 dark:from-card dark:to-brand-950/20 border border-brand-100 dark:border-brand-900/50 shadow-xl relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-12 bg-brand-500/5 rounded-full -mr-12 -mt-12 transition-transform duration-500 group-hover:scale-150" />

                                <div className="h-16 w-16 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 mb-8">
                                    <User className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-black mb-4">Akaunti ya Binafsi</h3>
                                <p className="text-muted-foreground mb-8 leading-relaxed">
                                    Akaunti ya kuanzia kwa kila mtumiaji. Uza skill production yako, huduma, bidhaa za kidijitali, au bidhaa halisi ukitumia profile yako ya binafsi, huku malipo yakilindwa mpaka oda itimizwe.
                                </p>
                                <ul className="space-y-3 mb-8">
                                    {['Kuuza kumewezeshwa moja kwa moja', 'Escrow inalinda pande zote', 'Digital, services na physical products', 'Payout baada ya oda kuthibitishwa'].map(feat => (
                                        <li key={feat} className="flex items-center gap-3 text-sm font-bold text-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-brand-500" /> {feat}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>

                            <motion.div
                                whileHover={{ y: -10 }}
                                className="p-8 rounded-[2.5rem] bg-gradient-to-br from-white to-blue-50 dark:from-card dark:to-blue-950/20 border border-blue-100 dark:border-blue-900/50 shadow-xl relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-12 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform duration-500 group-hover:scale-150" />

                                <div className="h-16 w-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 mb-8">
                                    <Store className="h-8 w-8" />
                                </div>
                                <h3 className="text-2xl font-black mb-4">Akaunti ya Biashara</h3>
                                <p className="text-muted-foreground mb-8 leading-relaxed">
                                    Peleka biashara yako ngazi nyingine. Unda wasifu maalum wa biashara, simamia oda na timu, na wajengee wateja imani kuwa Takeer inasimamia malipo, delivery, na mawasiliano ya oda.
                                </p>
                                <ul className="space-y-3 mb-8">
                                    {['Wasifu wa biashara unaoaminika', 'Support ya maeneo mengi', 'Team management', 'Analytics na usimamizi wa oda'].map(feat => (
                                        <li key={feat} className="flex items-center gap-3 text-sm font-bold text-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-blue-500" /> {feat}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        </div>
                    </section>

                    {/* ── Features & Trust ── */}
                    <section className="py-24 grid md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <h4 className="text-xl font-black tracking-tight">Malipo Yanalindwa</h4>
                            <p className="text-muted-foreground leading-relaxed">
                                Takeer inakaa katikati ya mteja na merchant. Pesa hushikiliwa salama mpaka package, digital product, au huduma ithibitishwe kuwa imetolewa vizuri.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                                <RefreshCcw className="h-6 w-6" />
                            </div>
                            <h4 className="text-xl font-black tracking-tight">Refund Ikihitajika</h4>
                            <p className="text-muted-foreground leading-relaxed">
                                Kama mteja hajapokea alichoagiza, refund process inaweza kuanzishwa. Hivyo mteja hapotezi fedha kwa muuzaji asiyetimiza ahadi.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-600">
                                <MapPin className="h-6 w-6" />
                            </div>
                            <h4 className="text-xl font-black tracking-tight">Popote Tanzania</h4>
                            <p className="text-muted-foreground leading-relaxed">
                                Nunua kutoka merchant yeyote ndani ya Takeer ukiwa na uhakika kuwa oda yako inafuatiliwa mpaka ufikishiwe package au huduma yako.
                            </p>
                        </div>
                    </section>

                    {/* ── Final CTA ── */}
                    <section>
                        <div className="p-8 md:p-16 rounded-[3rem] bg-brand-600 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[50%] h-full bg-white/10 skew-x-[-20deg] transition-transform duration-1000 group-hover:translate-x-20" />
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white">
                                <div className="space-y-4 text-center md:text-left">
                                    <h3 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">Uko tayari kuuza <br /> au kununua salama?</h3>
                                    <p className="text-brand-100 text-lg opacity-90 font-medium">Jiunge na soko ambalo muuzaji hupata anachostahili, na mteja hulindwa mpaka apokee alichoagiza.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                                    <Button
                                        className="h-16 px-10 rounded-2xl bg-white text-brand-600 hover:bg-brand-50 text-xl font-black shadow-xl"
                                        onClick={() => router.visit('/merchant/register')}
                                    >
                                        Jiunge Sasa
                                    </Button>
                                    <Button
                                        className="h-16 px-10 rounded-2xl bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white text-xl font-black transition-all"
                                        onClick={() => router.visit('/feed')}
                                    >
                                        Gundua Bidhaa
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <p className="mt-8 text-center text-xs font-semibold leading-6 text-muted-foreground">
                            Takeer is a product of Avly Tech Group Limited.
                        </p>
                    </section>

                </div>
            </div>
        </AppLayout>
    );
}
