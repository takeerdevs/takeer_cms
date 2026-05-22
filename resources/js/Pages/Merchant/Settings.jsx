import React, { useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Globe, User, Save, ArrowLeft, UploadCloud, MessageCircle, Heart, ShoppingBag, LayoutDashboard } from 'lucide-react';
import { router } from '@inertiajs/react';
import ShopLocationsManager from '@/Components/Merchant/ShopLocationsManager';
import ReturnPoliciesManager from '@/Components/Merchant/ReturnPoliciesManager';
import { useMerchantPermissions } from '@/lib/merchantPermissions';

export default function Settings({ merchant, merchantUsername, countries = [], currencies = [], storefrontSettings = {}, retailEligible = false, businessCategories = {}, businessOperations = {}, businessModules = {}, commerceModes = {}, businessContext = null }) {
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
    const { can } = useMerchantPermissions(merchantSlug);
    const canUpdateSettings = can('settings.update');
    const selectedCountry = countries.find(country => String(country.id) === String(merchant.country_id));
    const selectedCountryTimezones = selectedCountry?.settings?.timezones || (selectedCountry?.timezone ? [selectedCountry.timezone] : []);
    const configurableModuleKeys = Object.keys(businessModules || {});
    const initialActiveModules = (merchant.active_modules || []).filter((module) => configurableModuleKeys.includes(module));

    const { data, setData, post, processing, errors } = useForm({
        display_name: merchant.display_name || '',
        bio: merchant.bio || '',
        country_id: merchant.country_id ? String(merchant.country_id) : '',
        currency_id: merchant.currency_id ? String(merchant.currency_id) : '',
        timezone: merchant.timezone || selectedCountry?.timezone || selectedCountryTimezones[0] || '',
        avatar_url: merchant.avatar_url || '',
        business_category_key: merchant.business_category_key || '',
        business_subcategory_key: merchant.business_subcategory_key || '',
        business_profile: merchant.business_profile || {},
        active_modules: initialActiveModules,
        allow_post_comments: storefrontSettings.allow_post_comments ?? true,
        allow_post_reactions: storefrontSettings.allow_post_reactions ?? true,
    });

    const currentCountry = countries.find(country => String(country.id) === String(data.country_id));
    const currentCountryTimezones = currentCountry?.settings?.timezones || (currentCountry?.timezone ? [currentCountry.timezone] : []);
    const showTimezoneSelect = currentCountryTimezones.length > 1;
    const isPersonal = merchant?.type === 'personal';
    const operationProfile = data.business_profile || {};
    const selectedOperationKeys = Array.from(new Set([
        operationProfile.primary_operation,
        ...(operationProfile.operations || []),
    ].filter(Boolean)));
    const selectedOperations = selectedOperationKeys.map((key) => businessOperations?.[key]).filter(Boolean);
    const selectedBusinessContext = selectedOperations.length > 0
        ? {
            label: selectedOperations[0]?.label || 'Business operations',
            operation_labels: selectedOperations.map((operation) => operation.label),
            recommended_modules: Array.from(new Set(selectedOperations.flatMap((operation) => operation.modules || []))),
            recommended_commerce_modes: Array.from(new Set(selectedOperations.flatMap((operation) => operation.commerce_modes || []))),
            offer_types: selectedOperationKeys,
        }
        : null;
    const activeModules = (data.active_modules || []).filter((module) => configurableModuleKeys.includes(module));
    const recommendedModules = (selectedBusinessContext?.recommended_modules || []).filter((module) => configurableModuleKeys.includes(module));
    const selectedCommerceModes = data.business_profile?.commerce_modes || [];
    const recommendedCommerceModes = selectedBusinessContext?.recommended_commerce_modes || [];
    const commerceModeModules = selectedCommerceModes
        .flatMap((key) => commerceModes?.[key]?.modules || [])
        .filter((module) => configurableModuleKeys.includes(module));
    const groupedBusinessModules = Object.entries(businessModules || {}).reduce((groups, [key, module]) => {
        const group = module.group || 'Other';
        groups[group] = groups[group] || [];
        groups[group].push([key, module]);
        return groups;
    }, {});
    const [bioBuilder, setBioBuilder] = useState({
        roleOrCategory: '',
        certifications: '',
        degreeOrTraining: '',
        yearsExperience: '',
        businessesOrCustomersHelped: '',
        outcomeOrStrength: '',
        founderOrProof: '',
        productsOrServices: '',
    });

    const buildTrustBio = () => {
        const name = data.display_name?.trim() || merchant?.display_name || merchant?.name || 'Creator';
        const countryName = countries.find((country) => String(country.id) === String(data.country_id))?.name || '';
        const years = bioBuilder.yearsExperience?.trim();
        const helped = bioBuilder.businessesOrCustomersHelped?.trim();
        const category = bioBuilder.roleOrCategory?.trim();
        const certs = bioBuilder.certifications?.trim();
        const degree = bioBuilder.degreeOrTraining?.trim();
        const outcome = bioBuilder.outcomeOrStrength?.trim();
        const proof = bioBuilder.founderOrProof?.trim();
        const products = bioBuilder.productsOrServices?.trim();

        if (isPersonal) {
            const professionalLine = [
                category || 'Professional',
                years ? `${years}+ years experience` : '',
            ].filter(Boolean).join(' • ');
            const parts = [
                professionalLine ? `${name} — ${professionalLine}.` : `${name}.`,
                certs ? `Certified in ${certs}${degree ? `, with ${degree}` : ''}.` : (degree ? `${degree}.` : ''),
                helped ? `Helped ${helped}${outcome ? ` achieve ${outcome}` : ''}.` : (outcome ? `Focused on delivering ${outcome}.` : ''),
                proof ? `${proof}.` : '',
            ].filter(Boolean);
            return parts.join(' ');
        }

        const parts = [
            `${name}${category ? ` is a ${category}` : ''}${years ? ` business with ${years}+ years of experience` : ''}.`,
            products ? `We provide ${products}.` : '',
            helped ? `Served ${helped}.` : '',
            outcome ? `Known for ${outcome}.` : '',
            proof ? `${proof}.` : '',
            countryName ? `Based in ${countryName}.` : '',
        ].filter(Boolean);
        return parts.join(' ');
    };

    const applyGeneratedBio = (mode = 'replace') => {
        const generated = buildTrustBio();
        if (!generated) return;
        if (mode === 'append' && data.bio?.trim()) {
            setData('bio', `${data.bio.trim()}\n\n${generated}`);
            return;
        }
        setData('bio', generated);
    };

    const updateCountry = (countryId) => {
        const country = countries.find(item => String(item.id) === String(countryId));
        const timezones = country?.settings?.timezones || (country?.timezone ? [country.timezone] : []);

        setData({
            ...data,
            country_id: countryId,
            timezone: timezones.includes(data.timezone) ? data.timezone : (country?.timezone || timezones[0] || ''),
        });
    };

    const handleAvatarUpload = async (e) => {
        if (!canUpdateSettings) return;
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
            const uploadUrl = merchantSlug ? `/merchant/${merchantSlug}/upload/media` : '/merchant/upload/media';
            const res = await window.axios.post(uploadUrl, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setData('avatar_url', res.data.url);
        } catch (err) {
            console.error('Upload failed', err);
        } finally {
            setUploading(false);
        }
    };

    const handleToggleModule = async (module, active) => {
        if (!canUpdateSettings) return;
        try {
            if (active) {
                await window.axios.post('/api/merchant/modules/retail-ops/activate');
            } else {
                await window.axios.post('/api/merchant/modules/retail-ops/deactivate');
            }
            // Reload the page via Inertia so the fresh `merchant.active_modules` prop is returned
            router.reload({ only: ['merchant'] });
        } catch (err) {
            console.error('Failed to toggle module', err);
            const payload = err.response?.data || {};
            if (payload.requires_subscription && payload.redirect_url) {
                router.visit(payload.redirect_url);
                return;
            }
            alert('Failed to toggle module: ' + (payload.message || err.message));
        }
    };

    const toggleModuleInForm = (moduleKey) => {
        if (!canUpdateSettings) return;
        setData('active_modules', activeModules.includes(moduleKey)
            ? activeModules.filter((key) => key !== moduleKey)
            : [...activeModules, moduleKey]
        );
    };

    const applyRecommendedModules = () => {
        if (!canUpdateSettings) return;
        setData('active_modules', Array.from(new Set([...activeModules, ...recommendedModules])));
    };

    const setPrimaryOperation = (operationKey) => {
        if (!canUpdateSettings) return;
        setData('business_profile', {
            ...(data.business_profile || {}),
            primary_operation: operationKey,
            operations: Array.from(new Set([operationKey, ...((data.business_profile || {}).operations || [])])),
        });
    };

    const toggleBusinessOperation = (operationKey) => {
        if (!canUpdateSettings) return;
        const primary = data.business_profile?.primary_operation || operationKey;
        const current = new Set(data.business_profile?.operations || []);
        if (current.has(operationKey) && operationKey !== primary) {
            current.delete(operationKey);
        } else {
            current.add(operationKey);
        }
        current.add(primary);

        setData('business_profile', {
            ...(data.business_profile || {}),
            primary_operation: primary,
            operations: Array.from(current),
        });
    };

    const toggleCommerceMode = (modeKey) => {
        if (!canUpdateSettings) return;
        const nextModes = selectedCommerceModes.includes(modeKey)
            ? selectedCommerceModes.filter((key) => key !== modeKey)
            : [...selectedCommerceModes, modeKey];

        setData({
            ...data,
            business_profile: {
                ...(data.business_profile || {}),
                commerce_modes: nextModes,
            },
        });
    };

    const applyRecommendedCommerceModes = () => {
        if (!canUpdateSettings) return;
        setData('business_profile', {
            ...(data.business_profile || {}),
            commerce_modes: Array.from(new Set([...selectedCommerceModes, ...recommendedCommerceModes])),
        });
    };

    const applyCommerceModeModules = () => {
        if (!canUpdateSettings) return;
        setData('active_modules', Array.from(new Set([...activeModules, ...commerceModeModules])));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canUpdateSettings) return;
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
                        <label className="text-sm font-bold text-muted-foreground">Nembo ya {data.display_name} (Logo)</label>

                        <div
                            className="relative h-32 w-32 rounded-full bg-muted flex items-center justify-center overflow-hidden border-4 border-background shadow-md cursor-pointer group hover:border-brand-200 transition-all hover:shadow-lg"
                            onClick={() => canUpdateSettings && document.getElementById('avatar-upload').click()}
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
                            disabled={uploading || !canUpdateSettings}
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
                                    placeholder={`Elezea kuhusu ${data.display_name}, mnafanya nini...`}
                                    className="rounded-xl min-h-[100px] mt-1"
                                />
                                {errors.bio && <p className="text-xs text-red-500 mt-0.5">{errors.bio}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {!isPersonal && (
                        <Card className="glass-card shadow-sm border-blue-100">
                            <CardHeader className="p-5 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-blue-700 uppercase tracking-wider">
                                    <LayoutDashboard className="h-4 w-4" /> Operations & Modules
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <div className="space-y-3">
                                    {selectedOperationKeys.length === 0 && (
                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                            <p className="text-sm font-black text-amber-900">Choose this business setup when you are ready.</p>
                                            <p className="mt-1 text-xs font-semibold text-amber-800">
                                                New businesses start without default modules. Pick the main operation here, then turn on only the tools this business actually uses.
                                            </p>
                                        </div>
                                    )}
                                    <label className="space-y-1 block">
                                        <span className="text-sm font-bold text-muted-foreground">Primary operation</span>
                                        <select
                                            className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                                            value={data.business_profile?.primary_operation || ''}
                                            onChange={(e) => setPrimaryOperation(e.target.value)}
                                            disabled={!canUpdateSettings}
                                        >
                                            <option value="">Choose what this business mainly does</option>
                                            {Object.entries(businessOperations || {}).map(([key, operation]) => (
                                                <option key={key} value={key}>{operation.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {Object.entries(businessOperations || {}).map(([key, operation]) => {
                                            const selected = selectedOperationKeys.includes(key);
                                            const isPrimary = data.business_profile?.primary_operation === key;

                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => toggleBusinessOperation(key)}
                                                    disabled={!canUpdateSettings}
                                                    className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${selected
                                                        ? 'border-blue-300 bg-blue-50 text-blue-900'
                                                        : 'border-border bg-background text-muted-foreground hover:border-blue-200'
                                                        }`}
                                                >
                                                    <span className="font-black">{operation.label}</span>
                                                    <span className="block mt-1 leading-snug">{operation.description}</span>
                                                    {isPrimary && <span className="mt-1 inline-flex rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">Primary</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <Textarea
                                    value={data.business_profile?.description || ''}
                                    onChange={(e) => setData('business_profile', { ...(data.business_profile || {}), description: e.target.value })}
                                    placeholder="What does this business actually do day to day?"
                                    className="rounded-xl min-h-[86px]"
                                    disabled={!canUpdateSettings}
                                />

                                {selectedBusinessContext && (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 space-y-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-blue-700">Business operating preset</p>
                                            <p className="text-sm font-black text-blue-950 mt-1">
                                                {(selectedBusinessContext.operation_labels || []).join(' · ') || selectedBusinessContext.label}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Recommended commerce modes</p>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {recommendedCommerceModes.map((mode) => (
                                                        <span key={mode} className="rounded-full bg-white border border-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800">
                                                            {commerceModes?.[mode]?.label || mode.replace(/_/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Recommended modules</p>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {recommendedModules.map((module) => (
                                                        <span key={module} className="rounded-full bg-white border border-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800">
                                                            {businessModules?.[module]?.label || module.replace(/_/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Offerings this business can create</p>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {(selectedBusinessContext.offer_types || []).map((offerType) => (
                                                        <span key={offerType} className="rounded-full bg-white border border-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800">
                                                            {offerType.replace(/_/g, ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-blue-800/80">
                                            Commerce modes describe what the business sells. Modules are the tools enabled from those modes.
                                        </p>
                                    </div>
                                )}

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">What does this business sell?</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Choose all that apply. Physical products keep using the product categories, variants, stock, and delivery flow.
                                            </p>
                                        </div>
                                        {recommendedCommerceModes.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-lg text-xs font-bold"
                                                onClick={applyRecommendedCommerceModes}
                                                disabled={!canUpdateSettings}
                                            >
                                                Apply recommended
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {Object.entries(commerceModes || {}).map(([key, mode]) => {
                                            const isSelected = selectedCommerceModes.includes(key);
                                            const isRecommended = recommendedCommerceModes.includes(key);

                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => toggleCommerceMode(key)}
                                                    disabled={!canUpdateSettings}
                                                    className={`rounded-xl border p-3 text-left transition-all ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:bg-white'} ${!canUpdateSettings ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900">{mode.label}</p>
                                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{mode.description}</p>
                                                        </div>
                                                        <input type="checkbox" className="mt-1 h-4 w-4" checked={isSelected} readOnly />
                                                    </div>
                                                    {isRecommended && (
                                                        <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">Recommended</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {selectedCommerceModes.length > 0 && (
                                        <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <p className="text-xs font-bold text-brand-800">
                                                Selected modes suggest {Array.from(new Set(commerceModeModules)).length} modules for this business.
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-lg bg-white text-xs font-bold"
                                                onClick={applyCommerceModeModules}
                                                disabled={!canUpdateSettings}
                                            >
                                                Add mode modules
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">Business modules</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Modules decide what this business can manage: menus, rooms, bookings, courses, orders, bookkeeping, and more.
                                            </p>
                                        </div>
                                        {recommendedModules.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-lg text-xs font-bold"
                                                onClick={applyRecommendedModules}
                                                disabled={!canUpdateSettings}
                                            >
                                                Apply recommended
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        {Object.entries(groupedBusinessModules).map(([group, modules]) => (
                                            <div key={group} className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group}</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {modules.map(([key, module]) => {
                                                        const isActive = activeModules.includes(key);
                                                        const isRecommended = recommendedModules.includes(key);
                                                        const isDisabled = !canUpdateSettings;

                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => !isDisabled && toggleModuleInForm(key)}
                                                                disabled={isDisabled}
                                                                className={`rounded-xl border p-3 text-left transition-all ${isActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:bg-white'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="text-sm font-black text-slate-900">{module.label}</p>
                                                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{module.description}</p>
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="mt-1 h-4 w-4"
                                                                        checked={isActive}
                                                                        readOnly
                                                                    />
                                                                </div>
                                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                                    {isRecommended && (
                                                                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">Recommended</span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

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
                                    onChange={e => updateCountry(e.target.value)}
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

                            {showTimezoneSelect && (
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-muted-foreground">Timezone</label>
                                    <select
                                        value={data.timezone}
                                        onChange={e => setData('timezone', e.target.value)}
                                        className="flex h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                                    >
                                        {currentCountryTimezones.map(timezone => (
                                            <option key={timezone} value={timezone}>
                                                {timezone}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.timezone && <p className="text-xs text-red-500 mt-0.5">{errors.timezone}</p>}
                                </div>
                            )}

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

                    {retailEligible && (
                        <Card className="glass-card shadow-sm border-brand-200 bg-brand-50/20">
                            <CardHeader className="p-5 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-brand-700 uppercase tracking-wider">
                                    <ShoppingBag className="h-4 w-4" /> Business Tools
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <div className="rounded-2xl border border-brand-200 bg-white/50 p-4 flex items-center justify-between gap-4">
                                    <div className="flex gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
                                            <LayoutDashboard className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">Takeer Retail Ops</p>
                                            <p className="text-xs text-muted-foreground">Manage multi-location inventory, staff PINs, and in-store POS sales.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {merchant.active_modules?.includes('retail_ops') && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-lg h-8 text-xs font-bold border-brand-200 text-brand-700 hover:bg-brand-50"
                                                onClick={() => router.visit(`/merchant/${merchantSlug}/retail/dashboard`)}
                                            >
                                                Dashboard
                                            </Button>
                                        )}
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={merchant.active_modules?.includes('retail_ops')}
                                                onChange={(e) => handleToggleModule('retail_ops', e.target.checked)}
                                                disabled={!canUpdateSettings}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {canUpdateSettings && (
                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
                            disabled={processing}
                        >
                            <Save className="h-4 w-4" /> {processing ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
                        </Button>
                    )}
                </form>

                {canUpdateSettings && (
                    <>
                        <ShopLocationsManager
                            locations={locations}
                            onRefresh={fetchLocations}
                            loading={loadingLocations}
                            profiles={profiles}
                            onRefreshZones={fetchProfiles}
                            personalMode={merchant?.type === 'personal'}
                        />

                        <ReturnPoliciesManager />
                    </>
                )}

            </div>
        </AppLayout>
    );
}
