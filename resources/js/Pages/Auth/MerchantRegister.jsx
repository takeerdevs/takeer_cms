import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Store, ArrowRight, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export default function MerchantRegister({ countries = [], currencies = [] }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isExisting, setIsExisting] = useState(false);

    const [form, setForm] = useState({
        phone_number: '',
        otp: '',
        store_name: '',
        display_name: '',
        country_id: '',
        currency_id: ''
    });

    // Auto-detect Country on load
    useEffect(() => {
        const detectCountry = async () => {
            try {
                const res = await axios.get('https://ipapi.co/json/');
                const countryCode = res.data.country_code; // e.g., 'TZ', 'KE'

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
            // First check if they belong to an existing merchant account
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

            // Set token and refresh page to pick up auth context via session
            // Note: Since Takeer frontend isn't explicitly configured with Sanctum SPA cookies here,
            // we will store token in localStorage and immediately redirect.
            localStorage.setItem('takeer_token', res.data.token);
            window.axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;

            // Navigate to merchant-scoped dashboard
            const username = res.data.merchant?.username || res.data.user?.merchant_profiles?.[0]?.username;
            window.location.href = username ? `/merchant/${username}/dashboard` : '/merchant/dashboard';
        } catch (err) {
            setError(err.response?.data?.message || 'Maelezo sio sahihi. Tafadhali jaribu tena.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <Head title="Fungua Biashara Yako | Takeer" />

            <div className="max-w-md mx-auto py-10 px-4">
                <div className="text-center mb-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 mb-4 shadow-sm border border-brand-200">
                        <Store className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-black text-foreground">Anzisha Biashara Yako</h1>
                    <p className="text-muted-foreground mt-2">Uza bidhaa za kawaida, za kidijitali (Vitabu, Elimu, Chimbo la bidhaa, n.k), au huduma (Bookings) ujipatie kipato cha ziada.</p>
                </div>

                <Card className="glass-card">
                    <CardHeader>
                        <CardTitle>
                            {step === 1 ? 'Nambari ya Simu' : isExisting ? 'Karibu Tena' : 'Kamilisha Usajili'}
                        </CardTitle>
                        <CardDescription>
                            {step === 1
                                ? 'Ingiza nambari yako ya simu kupokea nambari ya siri (OTP).'
                                : isExisting
                                    ? 'Ingiza nambari ya siri kukamilisha mchakato huu na kuingia kwenye biashara yako.'
                                    : 'Ingiza nambari ya siri uliyotumiwa pamoja na jina la biashara yako.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
                                {error}
                            </div>
                        )}

                        {step === 1 ? (
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="phone" className="text-sm font-semibold text-foreground">Nambari ya Simu ya Akaunti (Mfano: 0755...)</label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="07XX XXX XXX"
                                        value={form.phone_number}
                                        onChange={e => setForm({ ...form, phone_number: e.target.value })}
                                        required
                                        className="h-12"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Namba hii itatumika kuingia kwenye akaunti yako, kupokea OTP, na kurejesha access. Unaweza kulipia oda kwa namba tofauti wakati wa checkout.
                                    </p>
                                </div>
                                <Button type="submit" className="w-full h-12 text-md" disabled={loading}>
                                    {loading ? 'Inatuma...' : 'Tuma Nambari ya Siri (OTP)'}
                                    {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="otp" className="text-sm font-semibold text-foreground">Nambari ya Siri (OTP)</label>
                                    <Input
                                        id="otp"
                                        type="text"
                                        maxLength={6}
                                        placeholder="Ingiza tarakimu 6"
                                        value={form.otp}
                                        onChange={e => setForm({ ...form, otp: e.target.value })}
                                        required
                                        className="h-12 text-center text-xl tracking-widest"
                                    />
                                </div>

                                {!isExisting && (
                                    <>
                                        <div className="space-y-2 pt-2">
                                            <label htmlFor="store_name" className="text-sm font-semibold text-foreground">Jina fupi la Biashara (Kama Username, mfano: takeershop)</label>
                                            <Input
                                                id="store_name"
                                                type="text"
                                                placeholder="takeershop"
                                                value={form.store_name}
                                                onChange={e => setForm({ ...form, store_name: e.target.value })}
                                                required={!isExisting}
                                                className="h-12"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="display_name" className="text-sm font-semibold text-foreground">Jina la Biashara Yako (Linaloonekana kwa wateja)</label>
                                            <Input
                                                id="display_name"
                                                type="text"
                                                placeholder="Takeer Official Store"
                                                value={form.display_name}
                                                onChange={e => setForm({ ...form, display_name: e.target.value })}
                                                required={!isExisting}
                                                className="h-12"
                                            />
                                        </div>

                                        <div className="space-y-2 pt-1">
                                            <label className="text-sm font-semibold text-foreground">Nchi</label>
                                            <select
                                                value={form.country_id}
                                                onChange={e => setForm({ ...form, country_id: e.target.value })}
                                                className="flex h-12 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            >
                                                <option value="" disabled>Chagua Nchi</option>
                                                {countries.map(country => (
                                                    <option key={country.id} value={String(country.id)}>
                                                        {country.name} ({country.code})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2 pt-1">
                                            <label className="text-sm font-semibold text-foreground">Sarafu (Currency)</label>
                                            <select
                                                value={form.currency_id}
                                                onChange={e => setForm({ ...form, currency_id: e.target.value })}
                                                className="flex h-12 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            >
                                                <option value="" disabled>Chagua Sarafu</option>
                                                {currencies.map(currency => (
                                                    <option key={currency.id} value={String(currency.id)}>
                                                        {currency.code} - {currency.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                <Button type="submit" className="w-full h-12 text-md mt-4" disabled={loading}>
                                    {loading ? 'Inasubiri...' : isExisting ? 'Ingia Ndani' : 'Kamilisha Usajili'}
                                    {!loading && <CheckCircle2 className="ml-2 h-5 w-5" />}
                                </Button>

                                <button type="button" onClick={() => setStep(1)} className="w-full text-center text-sm text-brand-600 font-medium py-2">
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
