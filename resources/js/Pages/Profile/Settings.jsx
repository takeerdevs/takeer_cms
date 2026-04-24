import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import {
    ArrowLeft, Mail, Smartphone, MapPin, CheckCircle2, ShieldCheck, Globe
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import UserAddressManager from '@/Components/UserAddressManager';

const MAP_CONTAINER_STYLE = {
    width: '100%',
    height: '300px',
    borderRadius: '12px',
};

const DEFAULT_CENTER = {
    lat: -6.7924, // Dar es Salaam
    lng: 39.2083,
};

export default function ProfileSettings({ oneClickProfile }) {
    const { auth, flash } = usePage().props;
    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: googleMapsApiKey,
        libraries: ['places']
    });

    const { data, setData, post, processing, errors, isDirty } = useForm({
        email: auth?.user?.email || '',
        payment_provider: oneClickProfile?.payment_provider || 'mobile_money',
        payment_number: oneClickProfile?.payment_number || '',
        delivery_landmark: oneClickProfile?.delivery_landmark || '',
        latitude: parseFloat(oneClickProfile?.latitude) || DEFAULT_CENTER.lat,
        longitude: parseFloat(oneClickProfile?.longitude) || DEFAULT_CENTER.lng,
    });

    const [markerPosition, setMarkerPosition] = useState({
        lat: parseFloat(oneClickProfile?.latitude) || DEFAULT_CENTER.lat,
        lng: parseFloat(oneClickProfile?.longitude) || DEFAULT_CENTER.lng,
    });

    const onMarkerDragEnd = useCallback((e) => {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        setMarkerPosition({ lat: newLat, lng: newLng });
        setData(prev => ({ ...prev, latitude: newLat, longitude: newLng }));
    }, [setData]);

    const submit = (e) => {
        e.preventDefault();
        post('/profile/settings', {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout>
            <Head title="Mipangilio | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/profile"
                        className="h-10 w-10 bg-muted/50 hover:bg-muted text-foreground flex items-center justify-center rounded-xl transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-foreground">Mipangilio Yako</h1>
                        <p className="text-sm text-muted-foreground">Weka taarifa za msingi kurahisisha manunuzi.</p>
                    </div>
                </div>

                {flash?.success && (
                    <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200 flex items-center gap-3 font-medium animate-in slide-in-from-top-2">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <div>{flash.success}</div>
                    </div>
                )}

                <form onSubmit={submit} className="space-y-6">

                    {/* Section 1: Email via Google */}
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4 text-brand-700">
                                <Mail className="h-5 w-5" />
                                <h2 className="font-bold text-lg text-foreground">Barua Pepe (Email)</h2>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Unganisha na Google ili kupata barua pepe sahihi kwa ajili ya kupokea risiti za malipo na link za kupakua bidhaa za kidijitali.
                            </p>

                            {auth?.user?.email ? (
                                <div className="flex items-center justify-between p-4 bg-muted/30 border border-input rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /><path fill="none" d="M1 1h22v22H1z" /></svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold truncate">{auth.user.email}</p>
                                            <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Imeunganishwa</p>
                                        </div>
                                    </div>
                                    <a href="/auth/google/redirect" className="text-sm font-semibold text-brand-600 hover:text-brand-700 ml-2">Badili</a>
                                </div>
                            ) : (
                                <a
                                    href="/auth/google/redirect"
                                    className="w-full flex items-center justify-center gap-3 h-12 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-semibold text-gray-700"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /><path fill="none" d="M1 1h22v22H1z" /></svg>
                                    Unganisha na Google
                                </a>
                            )}
                        </CardContent>
                    </Card>

                    {/* Section 2: 1-Tap Checkout */}
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-brand-700">
                                    <Smartphone className="h-5 w-5" />
                                    <h2 className="font-bold text-lg text-foreground">Njia ya Malipo (1-Tap Buy)</h2>
                                </div>
                                <ShieldCheck className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Hifadhi njia yako pendwa ya malipo kuokoa muda wakati wa kufanya manunuzi.
                            </p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Chagua Njia (Payment Method)</label>
                                    <select
                                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        value={data.payment_provider}
                                        onChange={e => setData('payment_provider', e.target.value)}
                                    >
                                        <option value="mobile_money">Mobile Money (M-Pesa, Tigo, Airtel, MTN, n.k)</option>
                                        <option value="card" disabled>Kadi ya Benki (Hivi Karibuni)</option>
                                    </select>
                                    {errors.payment_provider && <p className="text-sm text-red-500 font-medium">{errors.payment_provider}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">Namba ya Malipo (Anza na Koodi ya Nchi mf. +255 au +254)</label>
                                    <Input
                                        type="tel"
                                        placeholder="Mf. +255755000000"
                                        className="h-12 bg-muted/30 font-mono"
                                        value={data.payment_number || ''}
                                        onChange={e => setData('payment_number', e.target.value)}
                                    />
                                    {errors.payment_number && <p className="text-sm text-red-500 font-medium">{errors.payment_number}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section 3: Shipping Addresses */}
                    <Card className="border-border shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-2 mb-4 text-brand-700">
                                <MapPin className="h-5 w-5" />
                                <h2 className="font-bold text-lg text-foreground">Anuani ya Kufikishiwa</h2>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Unaweza kuwa na anuani nyingi, mfano anuani ya nyumbani na anuani ya wakala wako wa kusafirisha (Forwarder).
                            </p>

                            <UserAddressManager mode="manage" />
                        </CardContent>
                    </Card>

                    <Button
                        type="submit"
                        disabled={processing || !isDirty}
                        className="w-full h-14 rounded-xl text-lg font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-lg transition-transform active:scale-[0.98]"
                    >
                        {processing ? 'Inahifadhi...' : 'Hifadhi Mipangilio'}
                    </Button>

                </form>
            </div>
        </AppLayout>
    );
}

