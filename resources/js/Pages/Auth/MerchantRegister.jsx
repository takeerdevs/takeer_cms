import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router, usePage } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Store, ArrowRight, CheckCircle2, User } from 'lucide-react';
import axios from 'axios';

export default function MerchantRegister({ countries = [], currencies = [] }) {
    const { auth } = usePage().props;
    const hasVerifiedPhone = Boolean(auth?.user?.phone_number && auth?.user?.phone_verified_at);
    const hasVerifiedEmail = Boolean(auth?.user?.email && auth?.user?.email_verified_at);
    const existingUserName = auth?.user?.name && !String(auth.user.name).startsWith('User ') ? auth.user.name : '';
    const [step, setStep] = useState(hasVerifiedPhone ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isExisting, setIsExisting] = useState(false);
    const [useVerifiedPhone, setUseVerifiedPhone] = useState(hasVerifiedPhone);

    const [form, setForm] = useState({
        phone_number: auth?.user?.phone_number || '',
        otp: '',
        store_name: existingUserName ? existingUserName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '', // This will be the Personal Profile Username
        display_name: existingUserName, // This will be the Personal Profile Full Name
        country_id: '',
        currency_id: '',
        timezone: ''
    });

    const selectedCountry = countries.find(country => String(country.id) === String(form.country_id));
    const selectedCountryTimezones = selectedCountry?.settings?.timezones || (selectedCountry?.timezone ? [selectedCountry.timezone] : []);
    const showTimezoneSelect = selectedCountryTimezones.length > 1;

    const updateCountry = (countryId) => {
        const country = countries.find(item => String(item.id) === String(countryId));
        const timezones = country?.settings?.timezones || (country?.timezone ? [country.timezone] : []);

        setForm(prev => ({
            ...prev,
            country_id: countryId,
            currency_id: country?.default_currency_id ? String(country.default_currency_id) : prev.currency_id,
            timezone: timezones.includes(prev.timezone) ? prev.timezone : (country?.timezone || timezones[0] || '')
        }));
    };

    // Auto-detect Country on load
    useEffect(() => {
        const detectCountry = async () => {
            try {
                const res = await axios.get('https://ipapi.co/json/');
                const countryCode = res.data.country_code;

                const matchedCountry = countries.find(c => c.code === countryCode);
                if (matchedCountry) {
                    updateCountry(String(matchedCountry.id));
                }
            } catch (err) {
                console.log("Country detection failed", err);
            }
        };

        if (countries.length > 0 && !form.country_id) {
            detectCountry();
        }
    }, [countries, form.country_id]);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            setUseVerifiedPhone(false);
            const checkRes = await axios.post('/auth/merchant/check', {
                phone_number: form.phone_number,
                country_id: form.country_id
            });
            setIsExisting(checkRes.data.is_existing_account ?? checkRes.data.is_merchant);

            await axios.post('/auth/otp/send', {
                phone_number: form.phone_number,
                country_id: form.country_id
            });
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Kuna tatizo wakati wa kutuma OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await axios.post('/auth/merchant/register', form);
            localStorage.setItem('takeer_token', res.data.token);
            window.axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;

            const username = res.data.merchant?.username || res.data.user?.merchant_profiles?.[0]?.username;
            window.location.href = '/profile';
        } catch (err) {
            setError(err.response?.data?.message || 'Maelezo sio sahihi. Tafadhali jaribu tena.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <Head title="Fungua Akaunti Yako | Takeer" />

            <div className="max-w-md mx-auto py-10 px-4">
                <div className="text-center mb-8">
                    <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white mb-6 shadow-xl shadow-brand-600/20 border-4 border-white dark:border-muted animate-in zoom-in duration-500">
                        <User className="h-10 w-10" />
                    </div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Fungua Akaunti Yako</h1>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        Anza safari yako kwa wasifu wa binafsi. Utapata uwezo wa kuuza, kununua, na kuongeza biashara zako baadaye.
                    </p>
                </div>

                {auth?.user && !hasVerifiedEmail ? (
                    <Card className="glass-card overflow-hidden border-none shadow-2xl">
                        <div className="bg-amber-500 h-1.5 w-full" />
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-bold">Unganisha Google Kwanza</CardTitle>
                            <CardDescription>
                                Tunahitaji email iliyothibitishwa kabla ya kuanza kuuza ili utumie risiti, taarifa muhimu na usalama wa akaunti.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <a
                                href="/auth/google/redirect"
                                className="w-full h-14 rounded-2xl bg-white border border-slate-200 text-slate-900 text-lg font-black shadow-sm hover:bg-slate-50 flex items-center justify-center gap-3"
                            >
                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="h-5 w-5" alt="Google" />
                                Unganisha Google
                            </a>
                            <p className="text-xs text-muted-foreground text-center">
                                Ukimaliza, utarudi kuendelea na kufungua personal profile yako.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                <Card className="glass-card overflow-hidden border-none shadow-2xl">
                    <div className="bg-brand-600 h-1.5 w-full" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold">
                            {step === 1 ? 'Nambari ya Simu' : useVerifiedPhone ? 'Simu Imethibitishwa' : isExisting ? 'Karibu Tena' : 'Maelezo ya Wasifu'}
                        </CardTitle>
                        <CardDescription>
                            {step === 1
                                ? 'Ingiza nambari yako ya simu kupokea nambari ya siri (OTP).'
                                : useVerifiedPhone
                                    ? 'Tutatumia nambari ya simu ambayo tayari umethibitisha.'
                                : isExisting
                                    ? 'Ingiza nambari ya siri kukamilisha mchakato huu.'
                                    : 'Kamilisha usajili wa wasifu wako wa binafsi.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-2xl bg-destructive/10 text-destructive text-sm font-bold border border-destructive/20 animate-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        {step === 1 ? (
                            <form onSubmit={handleSendOtp} className="space-y-6">
                                <div className="space-y-3">
                                    <label htmlFor="country" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nchi</label>
                                    <select
                                        id="country"
                                        value={form.country_id}
                                        onChange={e => updateCountry(e.target.value)}
                                        required
                                        className="flex h-14 w-full rounded-2xl border-2 bg-background/50 px-4 py-2 text-base font-bold focus:outline-none focus:border-brand-500 shadow-sm"
                                    >
                                        <option value="" disabled>Chagua nchi yako</option>
                                        {countries.map(country => (
                                            <option key={country.id} value={String(country.id)}>
                                                {country.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nambari ya Simu</label>
                                    <div className="relative">
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="07XX XXX XXX"
                                            value={form.phone_number}
	                                            onChange={e => {
                                                    setUseVerifiedPhone(false);
                                                    setForm({ ...form, phone_number: e.target.value });
                                                }}
                                            required
                                            className="h-14 px-5 text-lg font-bold rounded-2xl border-2 focus:border-brand-500 transition-all shadow-sm"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground italic">
                                        * Namba hii itatumika kuingia na kurejesha access ya akaunti yako.
                                    </p>
                                </div>
                                <Button type="submit" className="w-full h-14 text-lg font-black rounded-2xl bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/20 active:scale-95 transition-all" disabled={loading}>
                                    {loading ? 'Inatuma...' : 'Tuma OTP'}
                                    {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleRegister} className="space-y-5">
                                {useVerifiedPhone ? (
                                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 flex items-start gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-sm font-black text-emerald-900">Nambari ya simu imethibitishwa</p>
                                            <p className="text-xs font-semibold text-emerald-700 mt-1">{form.phone_number}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <label htmlFor="otp" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nambari ya Siri (OTP)</label>
                                        <Input
                                            id="otp"
                                            type="tel"
                                            maxLength={6}
                                            placeholder="••••••"
                                            value={form.otp}
                                            onChange={e => setForm({ ...form, otp: e.target.value })}
                                            required
                                            className="h-16 text-center text-3xl font-black tracking-[1rem] rounded-2xl border-2 focus:border-brand-500 shadow-sm"
                                        />
                                    </div>
                                )}

                                {!isExisting && (
                                    <div className="space-y-5 pt-2 animate-in fade-in duration-700">
                                        <div className="space-y-3">
                                            <label htmlFor="store_name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Username (Yatatumika kwenye profile yako)</label>
                                            <Input
                                                id="store_name"
                                                type="text"
                                                placeholder="mf. james_peter"
                                                value={form.store_name}
                                                onChange={e => setForm({ ...form, store_name: e.target.value })}
                                                required={!isExisting}
                                                className="h-14 px-5 font-bold rounded-2xl border-2 shadow-sm"
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label htmlFor="display_name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Jina lako Kamili</label>
                                            <Input
                                                id="display_name"
                                                type="text"
                                                placeholder="mf. James Peter"
                                                value={form.display_name}
                                                onChange={e => setForm({ ...form, display_name: e.target.value })}
                                                required={!isExisting}
                                                className="h-14 px-5 font-bold rounded-2xl border-2 shadow-sm"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nchi</label>
                                                <select
                                                    value={form.country_id}
                                                    onChange={e => updateCountry(e.target.value)}
                                                    className="flex h-14 w-full rounded-2xl border-2 bg-background/50 px-3 py-2 text-sm font-bold focus:outline-none focus:border-brand-500 shadow-sm"
                                                >
                                                    <option value="" disabled>Chagua Nchi</option>
                                                    {countries.map(country => (
                                                        <option key={country.id} value={String(country.id)}>
                                                            {country.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sarafu</label>
                                                <select
                                                    value={form.currency_id}
                                                    onChange={e => setForm({ ...form, currency_id: e.target.value })}
                                                    className="flex h-14 w-full rounded-2xl border-2 bg-background/50 px-3 py-2 text-sm font-bold focus:outline-none focus:border-brand-500 shadow-sm"
                                                >
                                                    <option value="" disabled>Sarafu</option>
                                                    {currencies.map(currency => (
                                                        <option key={currency.id} value={String(currency.id)}>
                                                            {currency.code}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {showTimezoneSelect && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Timezone</label>
                                                <select
                                                    value={form.timezone}
                                                    onChange={e => setForm({ ...form, timezone: e.target.value })}
                                                    className="flex h-14 w-full rounded-2xl border-2 bg-background/50 px-3 py-2 text-sm font-bold focus:outline-none focus:border-brand-500 shadow-sm"
                                                >
                                                    {selectedCountryTimezones.map(timezone => (
                                                        <option key={timezone} value={timezone}>
                                                            {timezone}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <Button type="submit" className="w-full h-16 text-xl font-black rounded-2xl bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-600/20 mt-4 active:scale-95 transition-all" disabled={loading}>
                                    {loading ? 'Inasubiri...' : useVerifiedPhone ? 'Endelea' : isExisting ? 'Ingia Ndani' : 'Kamilisha Usajili'}
                                    {!loading && <CheckCircle2 className="ml-2 h-6 w-6" />}
                                </Button>

                                <button type="button" onClick={() => {
                                    setUseVerifiedPhone(false);
                                    setStep(1);
                                }} className="w-full text-center text-sm text-brand-600 font-bold hover:underline transition-all">
                                    Badili nambari ya simu
                                </button>
                            </form>
                        )}
                    </CardContent>
                </Card>
                )}
            </div>
        </AppLayout>
    );
}
