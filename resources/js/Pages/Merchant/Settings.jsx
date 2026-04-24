import React, { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Globe, User, Save, ArrowLeft, UploadCloud, MessageCircle, Heart, Clock3, MapPin } from 'lucide-react';
import { router } from '@inertiajs/react';
import ShopLocationsManager from '@/Components/Merchant/ShopLocationsManager';

const weekDays = [
    { key: 'mon', label: 'Mon' },
    { key: 'tue', label: 'Tue' },
    { key: 'wed', label: 'Wed' },
    { key: 'thu', label: 'Thu' },
    { key: 'fri', label: 'Fri' },
    { key: 'sat', label: 'Sat' },
    { key: 'sun', label: 'Sun' },
];

export default function Settings({ merchant, merchantUsername, countries = [], currencies = [], storefrontSettings = {} }) {
    const [locations, setLocations] = useState([]);
    const [loadingLocations, setLoadingLocations] = useState(true);
    const [profiles, setProfiles] = useState([]);
    const [loadingProfiles, setLoadingProfiles] = useState(true);

    const fetchLocations = async () => {
        try {
            const res = await window.axios.get('/api/merchant/locations');
            setLocations(res.data.data || []);
        } catch (err) {
            console.error('Failed to load locations', err);
        } finally {
            setLoadingLocations(false);
        }
    };

    const fetchProfiles = async () => {
        try {
            const res = await window.axios.get('/api/merchant/shipping-profiles');
            setProfiles(res.data.data || []);
        } catch (err) {
            console.error('Failed to load profiles', err);
        } finally {
            setLoadingProfiles(false);
        }
    };


    React.useEffect(() => {
        fetchLocations();
        fetchProfiles();
    }, []);

    const defaultProfile = profiles.find(p => p.is_default) || profiles[0];


    const [uploading, setUploading] = useState(false);
    const { auth } = usePage().props;
    const merchantSlug = merchantUsername || auth?.user?.merchant_profiles?.[0]?.username || '';
    const incomingHours = Array.isArray(storefrontSettings.service_hours) ? storefrontSettings.service_hours : [];
    const mergedHours = weekDays.map((day) => {
        const match = incomingHours.find((row) => row?.day === day.key);
        return {
            day: day.key,
            is_open: Boolean(match?.is_open),
            open: match?.open || '08:00',
            close: match?.close || '18:00',
        };
    });

    const { data, setData, post, processing, errors } = useForm({
        display_name: merchant.display_name || '',
        bio: merchant.bio || '',
        country_id: merchant.country_id ? String(merchant.country_id) : '',
        currency_id: merchant.currency_id ? String(merchant.currency_id) : '',
        avatar_url: merchant.avatar_url || '',
        allow_post_comments: storefrontSettings.allow_post_comments ?? true,
        allow_post_reactions: storefrontSettings.allow_post_reactions ?? true,
        service_timezone: storefrontSettings.service_timezone || 'Africa/Dar_es_Salaam',
        service_area_type: storefrontSettings.service_area_type || 'onsite',
        service_locations: Array.isArray(storefrontSettings.service_locations) ? storefrontSettings.service_locations.join('\n') : '',
        service_hours: mergedHours,
    });

    const setHourRow = (day, patch) => {
        setData('service_hours', data.service_hours.map((row) => (
            row.day === day ? { ...row, ...patch } : row
        )));
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'public');
        formData.append('folder', 'avatars');

        try {
            // Wait, we need axios. import it if not present.
            // Let's add import axios at the top if needed.
            const res = await window.axios.post('/merchant/upload/media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setData('avatar_url', res.data.url);
        } catch (err) {
            console.error('Upload failed', err);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(`/merchant/${merchantSlug}/settings`, {
            onSuccess: () => {
                // Flash message or redirect as needed
            }
        });
    };

    return (
        <AppLayout>
            <Head title="Mipangilio ya Biashara | Takeer" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">

                {/* Header with Back Button */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8"
                        onClick={() => router.visit(`/merchant/${merchantSlug}/dashboard`)}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Mipangilio ya Biashara ⚙️</h1>
                        <p className="text-sm text-muted-foreground">Hariri taarifa za biashara yako na upendeleo.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center justify-center gap-2 space-y-6">
                        <label className="text-sm font-bold text-muted-foreground">Nembo ya Biashara (Logo)</label>

                        <div
                            className="relative h-32 w-32 rounded-full bg-muted flex items-center justify-center overflow-hidden border-4 border-background shadow-md cursor-pointer group hover:border-brand-200 transition-all hover:shadow-lg"
                            onClick={() => document.getElementById('avatar-upload').click()}
                        >
                            {data.avatar_url ? (
                                <img src={data.avatar_url} alt="Avatar" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                                <User className="h-10 w-10 text-muted-foreground group-hover:text-brand-600 transition-colors" />
                            )}

                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <UploadCloud className="h-6 w-6 text-white" />
                                <span className="text-[10px] font-bold text-white mt-1">Badilisha</span>
                            </div>
                        </div>

                        <input
                            id="avatar-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                            disabled={uploading}
                        />
                        {uploading && <p className="text-xs text-brand-600 font-bold animate-pulse">Inapakia...</p>}
                    </div>

                    <Card className="glass-card shadow-sm">
                        <CardHeader className="p-5 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                                <User className="h-4 w-4" /> Taarifa za Biashara
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-muted-foreground">Jina la Biashara</label>
                                <Input
                                    id="display_name"
                                    value={data.display_name}
                                    onChange={e => setData('display_name', e.target.value)}
                                    placeholder="Mf. Biashara ya Viatu"
                                    className="rounded-xl mt-1"
                                />
                                {errors.display_name && <p className="text-xs text-red-500 mt-0.5">{errors.display_name}</p>}
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-muted-foreground">Maelezo Mafupi (Bio)</label>
                                <Textarea
                                    id="bio"
                                    value={data.bio}
                                    onChange={e => setData('bio', e.target.value)}
                                    placeholder="Tueleze kidogo kuhusu biashara yako..."
                                    className="rounded-xl min-h-[100px] mt-1"
                                />
                                {errors.bio && <p className="text-xs text-red-500 mt-0.5">{errors.bio}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card shadow-sm">
                        <CardHeader className="p-5 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                                <Globe className="h-4 w-4" /> Maeneo na Fedha
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-muted-foreground">Nchi</label>
                                <select
                                    value={data.country_id}
                                    onChange={e => setData('country_id', e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                                >
                                    <option value="" disabled>Chagua Nchi</option>
                                    {countries.map(country => (
                                        <option key={country.id} value={String(country.id)}>
                                            {country.name} ({country.code})
                                        </option>
                                    ))}
                                </select>
                                {errors.country_id && <p className="text-xs text-red-500 mt-0.5">{errors.country_id}</p>}
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-muted-foreground">Sarafu (Currency)</label>
                                <select
                                    value={data.currency_id}
                                    onChange={e => setData('currency_id', e.target.value)}
                                    className="flex h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                                >
                                    <option value="" disabled>Chagua Sarafu</option>
                                    {currencies.map(currency => (
                                        <option key={currency.id} value={String(currency.id)}>
                                            {currency.code} - {currency.name} ({currency.symbol})
                                        </option>
                                    ))}
                                </select>
                                {errors.currency_id && <p className="text-xs text-red-500 mt-0.5">{errors.currency_id}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card shadow-sm">
                        <CardHeader className="p-5 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                                <MessageCircle className="h-4 w-4" /> Uwezeshaji wa Maoni na Reactions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <label className="rounded-2xl border border-input bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold">Allow Comments in posts</p>
                                    <p className="text-xs text-muted-foreground">Ikiwa imezimwa, post zote mpya na za zamani zitafunga maoni isipokuwa override ya post.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={Boolean(data.allow_post_comments)}
                                    onChange={e => setData('allow_post_comments', e.target.checked)}
                                />
                            </label>

                            <label className="rounded-2xl border border-input bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                                <div className="flex-1">
                                    <p className="text-sm font-bold flex items-center gap-2">
                                        <Heart className="h-4 w-4 text-brand-600" />
                                        Allow Reactions in posts
                                    </p>
                                    <p className="text-xs text-muted-foreground">Ikiwa imezimwa, users hawataweza kuweka emoji reactions kwenye post isipokuwa override ya post.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={Boolean(data.allow_post_reactions)}
                                    onChange={e => setData('allow_post_reactions', e.target.checked)}
                                />
                            </label>
                        </CardContent>
                    </Card>

                    <Card className="glass-card shadow-sm">
                        <CardHeader className="p-5 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                                <Clock3 className="h-4 w-4" /> Service Availability
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-muted-foreground">Service Timezone</label>
                                    <Input
                                        value={data.service_timezone}
                                        onChange={(e) => setData('service_timezone', e.target.value)}
                                        placeholder="Africa/Dar_es_Salaam"
                                        className="rounded-xl mt-1"
                                    />
                                    {errors.service_timezone && <p className="text-xs text-red-500 mt-0.5">{errors.service_timezone}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-muted-foreground">Service Area Type</label>
                                    <select
                                        value={data.service_area_type}
                                        onChange={(e) => setData('service_area_type', e.target.value)}
                                        className="flex h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm mt-1"
                                    >
                                        <option value="onsite">On-site only</option>
                                        <option value="remote">Remote only</option>
                                        <option value="hybrid">Hybrid (both)</option>
                                    </select>
                                    {errors.service_area_type && <p className="text-xs text-red-500 mt-0.5">{errors.service_area_type}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm font-bold text-muted-foreground">Weekly Service Hours</p>
                                <div className="space-y-2">
                                    {weekDays.map((day) => {
                                        const row = data.service_hours.find((entry) => entry.day === day.key);
                                        if (!row) return null;
                                        return (
                                            <div key={day.key} className="rounded-xl border border-input px-3 py-2 flex items-center gap-3">
                                                <label className="w-14 text-sm font-bold">{day.label}</label>
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4"
                                                    checked={Boolean(row.is_open)}
                                                    onChange={(e) => setHourRow(day.key, { is_open: e.target.checked })}
                                                />
                                                <span className="text-xs text-muted-foreground">Open</span>
                                                <Input
                                                    type="time"
                                                    value={row.open || '08:00'}
                                                    onChange={(e) => setHourRow(day.key, { open: e.target.value })}
                                                    disabled={!row.is_open}
                                                    className="w-32 rounded-lg"
                                                />
                                                <span className="text-xs text-muted-foreground">to</span>
                                                <Input
                                                    type="time"
                                                    value={row.close || '18:00'}
                                                    onChange={(e) => setHourRow(day.key, { close: e.target.value })}
                                                    disabled={!row.is_open}
                                                    className="w-32 rounded-lg"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> Service Locations
                                </label>
                                <Textarea
                                    rows={4}
                                    value={data.service_locations}
                                    onChange={(e) => setData('service_locations', e.target.value)}
                                    placeholder={'Dar es Salaam - Mikocheni\nDar es Salaam - Kariakoo\nArusha City'}
                                    className="rounded-xl mt-1"
                                />
                                <p className="text-xs text-muted-foreground">One location per line. Helps buyers search by nearby service area.</p>
                                {errors.service_locations && <p className="text-xs text-red-500 mt-0.5">{errors.service_locations}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        type="submit"
                        className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
                        disabled={processing}
                    >
                        <Save className="h-4 w-4" /> {processing ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
                    </Button>
                </form>

                <ShopLocationsManager
                    locations={locations}
                    onRefresh={fetchLocations}
                    loading={loadingLocations}
                    profiles={profiles}
                    onRefreshZones={fetchProfiles}
                />

            </div>
        </AppLayout>
    );
}
