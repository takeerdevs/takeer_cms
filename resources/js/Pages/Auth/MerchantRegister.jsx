import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Store, ArrowRight, CheckCircle2, User } from 'lucide-react';
import axios from 'axios';

export default function MerchantRegister({ countries = [], currencies = [] }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isExisting, setIsExisting] = useState(false);

    const [form, setForm] = useState({
        phone_number: '',
        otp: '',
        store_name: '', // This will be the Personal Profile Username
        display_name: '', // This will be the Personal Profile Full Name
        country_id: '',
        currency_id: ''
    });

    // Auto-detect Country on load
    useEffect(() => {
        const detectCountry = async () => {
            try {
                const res = await axios.get('https://ipapi.co/json/');
                const countryCode = res.data.country_code;

                const matchedCountry = countries.find(c => c.code === countryCode);
                if (matchedCountry) {
                    setForm(prev => ({
                        ...prev,
                        country_id: String(matchedCountry.id),
                        currency_id: matchedCountry.default_currency_id ? String(matchedCountry.default_currency_id) : prev.currency_id
                    }));
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
            const checkRes = await axios.post('/auth/merchant/check', {
                phone_number: form.phone_number
            });
            setIsExisting(checkRes.data.is_merchant);

            await axios.post('/auth/otp/send', {
                phone_number: form.phone_number
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

                <Card className="glass-card overflow-hidden border-none shadow-2xl">
                    <div className="bg-brand-600 h-1.5 w-full" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold">
                            {step === 1 ? 'Nambari ya Simu' : isExisting ? 'Karibu Tena' : 'Maelezo ya Wasifu'}
                        </CardTitle>
                        <CardDescription>
                            {step === 1
                                ? 'Ingiza nambari yako ya simu kupokea nambari ya siri (OTP).'
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
                                    <label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nambari ya Simu</label>
                                    <div className="relative">
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="07XX XXX XXX"
                                            value={form.phone_number}
                                            onChange={e => setForm({ ...form, phone_number: e.target.value })}
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
                                <div className="space-y-3">
                                    <label htmlFor="otp" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nambari ya Siri (OTP)</label>
                                    <Input
                                        id="otp"
                                        type="text"
                                        maxLength={6}
                                        placeholder="••••••"
                                        value={form.otp}
                                        onChange={e => setForm({ ...form, otp: e.target.value })}
                                        required
                                        className="h-16 text-center text-3xl font-black tracking-[1rem] rounded-2xl border-2 focus:border-brand-500 shadow-sm"
                                    />
                                </div>

                                {!isExisting && (
                                    <div className="space-y-5 pt-2 animate-in fade-in duration-700">
                                        <div className="space-y-3">
                                            <label htmlFor="store_name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Username (Yatatumika kwenye profile yako)</label>
                                            <Input
                                                id="store_name"
                                                type="text"
                                                placeholder="mf. kiddy_babe"
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
                                                placeholder="mf. Kiddo John"
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
                                                    onChange={e => setForm({ ...form, country_id: e.target.value })}
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
                                    </div>
                                )}

                                <Button type="submit" className="w-full h-16 text-xl font-black rounded-2xl bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-600/20 mt-4 active:scale-95 transition-all" disabled={loading}>
                                    {loading ? 'Inasubiri...' : isExisting ? 'Ingia Ndani' : 'Kamilisha Usajili'}
                                    {!loading && <CheckCircle2 className="ml-2 h-6 w-6" />}
                                </Button>

                                <button type="button" onClick={() => setStep(1)} className="w-full text-center text-sm text-brand-600 font-bold hover:underline transition-all">
                                    Badili nambari ya simu
                                </button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
