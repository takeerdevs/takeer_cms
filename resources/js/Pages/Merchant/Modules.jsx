import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { AlertTriangle, Check, ChevronRight, LayoutGrid, Loader2, RefreshCw, Save, Settings2, Sparkles } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function Modules({ merchantUsername }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [payload, setPayload] = useState(null);
    const [activeModules, setActiveModules] = useState([]);
    const [commerceModes, setCommerceModes] = useState([]);

    const loadModules = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/merchant/${merchantUsername}/modules/api`);
            setPayload(response.data);
            setActiveModules(response.data?.merchant?.active_modules || []);
            setCommerceModes(response.data?.merchant?.commerce_modes || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load business modules.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadModules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [merchantUsername]);

    const groupedModules = useMemo(() => {
        const modules = payload?.business_modules || {};
        return Object.entries(modules).reduce((groups, [key, module]) => {
            const group = module.group || 'Other';
            groups[group] = groups[group] || [];
            groups[group].push([key, module]);
            return groups;
        }, {});
    }, [payload?.business_modules]);

    const selectedModeModules = useMemo(() => {
        const modes = payload?.commerce_modes || {};
        return Array.from(new Set(commerceModes.flatMap((key) => modes[key]?.modules || [])));
    }, [commerceModes, payload?.commerce_modes]);

    const recommendedModules = payload?.recommended_modules || [];
    const recommendedModes = payload?.recommended_commerce_modes || [];
    const retailEligible = Boolean(payload?.merchant?.retail_eligible);

    const toggleModule = (key) => {
        if (key === 'retail_ops' && !retailEligible && !activeModules.includes(key)) {
            toast.error('Retail ops requires a verified business profile first.');
            return;
        }

        setActiveModules((prev) => prev.includes(key)
            ? prev.filter((module) => module !== key)
            : [...prev, key]);
    };

    const toggleMode = (key) => {
        setCommerceModes((prev) => prev.includes(key)
            ? prev.filter((mode) => mode !== key)
            : [...prev, key]);
    };

    const applyCategoryPreset = () => {
        setCommerceModes(recommendedModes);
        setActiveModules((prev) => Array.from(new Set([...prev, ...recommendedModules])));
    };

    const applyModePreset = () => {
        setActiveModules((prev) => Array.from(new Set([...prev, ...selectedModeModules])));
    };

    const saveModules = async () => {
        setSaving(true);
        try {
            const response = await axios.put(`/merchant/${merchantUsername}/modules/api`, {
                active_modules: activeModules,
                commerce_modes: commerceModes,
            });
            setPayload(response.data);
            setActiveModules(response.data?.merchant?.active_modules || []);
            setCommerceModes(response.data?.merchant?.commerce_modes || []);
            toast.success('Business modules updated.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save modules.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppLayout>
            <Head title="Business Modules | Takeer" />
            <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Business setup</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Business Modules</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Choose what this business actually runs: products, bookings, menu, courses, team, reports, communications, and bookkeeping.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={loadModules} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                        <Button onClick={saveModules} disabled={saving || loading}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save modules
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <Card>
                        <CardContent className="flex min-h-72 flex-col items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="mt-3 text-sm text-muted-foreground">Loading module setup...</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Commerce modes</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-3 md:grid-cols-2">
                                    {Object.entries(payload?.commerce_modes || {}).map(([key, mode]) => {
                                        const selected = commerceModes.includes(key);
                                        return (
                                            <button key={key} type="button" onClick={() => toggleMode(key)} className={`rounded-lg border p-4 text-left transition ${selected ? 'border-brand-500 bg-brand-50 text-brand-950' : 'border-border hover:bg-muted/50'}`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-black">{mode.label}</p>
                                                        <p className="mt-1 text-sm text-muted-foreground">{mode.description}</p>
                                                    </div>
                                                    {selected && <Check className="h-5 w-5 shrink-0 text-brand-700" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            <div className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Presets</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <PresetBlock
                                            icon={Sparkles}
                                            title="Category preset"
                                            text={payload?.business_context?.subcategory_label ? `${payload.business_context.label} / ${payload.business_context.subcategory_label}` : payload?.business_context?.label || 'No category selected'}
                                            count={recommendedModules.length}
                                            onClick={applyCategoryPreset}
                                        />
                                        <PresetBlock
                                            icon={Settings2}
                                            title="Selected modes"
                                            text={`${selectedModeModules.length} suggested modules from selected commerce modes`}
                                            count={selectedModeModules.length}
                                            onClick={applyModePreset}
                                        />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Active setup</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                        <MiniStat label="Commerce modes" value={commerceModes.length} />
                                        <MiniStat label="Active modules" value={activeModules.length} />
                                        <MiniStat label="Recommended modules" value={recommendedModules.length} />
                                        {!retailEligible && (
                                            <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
                                                <div className="flex gap-2">
                                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                                    <p className="text-xs font-semibold">Retail ops unlocks after verified business KYC.</p>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {Object.entries(groupedModules).map(([group, modules]) => (
                                <section key={group} className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="text-lg font-black">{group}</h2>
                                        <p className="text-sm text-muted-foreground">{modules.filter(([key]) => activeModules.includes(key)).length}/{modules.length} active</p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {modules.map(([key, module]) => {
                                            const active = activeModules.includes(key);
                                            const recommended = recommendedModules.includes(key);
                                            const modeSuggested = selectedModeModules.includes(key);
                                            const locked = key === 'retail_ops' && !retailEligible;

                                            return (
                                                <button key={key} type="button" onClick={() => toggleModule(key)} className={`rounded-lg border p-4 text-left transition ${active ? 'border-brand-500 bg-brand-50' : 'border-border hover:bg-muted/50'} ${locked ? 'opacity-70' : ''}`}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-black">{module.label}</p>
                                                            <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                                                        </div>
                                                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-border'}`}>
                                                            {active && <Check className="h-4 w-4" />}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {recommended && <Tag>Recommended</Tag>}
                                                        {modeSuggested && <Tag>Mode</Tag>}
                                                        {module.requires_approval && <Tag>Approval</Tag>}
                                                        {locked && <Tag>Locked</Tag>}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" asChild>
                                <Link href={`/merchant/${merchantUsername}/settings`}>
                                    Business settings
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button onClick={saveModules} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LayoutGrid className="mr-2 h-4 w-4" />}
                                Save modules
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function PresetBlock({ icon: Icon, title, text, count, onClick }) {
    return (
        <div className="rounded-lg border border-border p-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <p className="mt-2 font-black">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            <Button className="mt-3 w-full" variant="outline" size="sm" onClick={onClick} disabled={count === 0}>
                Apply preset
            </Button>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-black">{value}</span>
        </div>
    );
}

function Tag({ children }) {
    return <span className="rounded-full bg-background px-2 py-1 text-[11px] font-bold uppercase text-muted-foreground">{children}</span>;
}
