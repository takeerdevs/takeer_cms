import React, { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { CheckCircle2, Cpu, Eye, EyeOff, Key, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const OPENROUTER_MODELS = [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google) - Fast and cost-efficient' },
    { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free tier)' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (Anthropic)' },
    { value: 'openai/gpt-4o', label: 'GPT-4o (OpenAI)' },
    { value: 'meta-llama/llama-3.2-11b-vision-instruct:free', label: 'Llama 3.2 Vision (Free tier)' },
];

const GEMINI_MODELS = [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
];

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

export default function AiSettings() {
    const [settings, setSettings] = useState({
        ai_provider: 'openrouter',
        openrouter_api_key: '',
        openrouter_api_key_masked: '',
        openrouter_default_model: 'google/gemini-2.5-flash',
        gemini_api_key: '',
        gemini_api_key_masked: '',
        gemini_default_model: 'gemini-1.5-flash',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showOpenKey, setShowOpenKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load AI settings.');
                return data;
            })
            .then((data) => {
                setSettings((prev) => ({ ...prev, ...data.settings }));
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });
    }, []);

    const set = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/admin/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({
                    ai_provider: settings.ai_provider,
                    openrouter_api_key: settings.openrouter_api_key,
                    openrouter_default_model: settings.openrouter_default_model,
                    gemini_api_key: settings.gemini_api_key,
                    gemini_default_model: settings.gemini_default_model,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save AI settings.');
            toast.success(data.message || 'AI settings saved');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout title="AI Settings">
                <div className="flex h-64 items-center justify-center text-slate-500">Loading AI settings...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="AI Settings">
            <Head title="AI Settings | Takeer" />

            <div className="max-w-3xl space-y-8">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                        <Settings2 className="h-6 w-6 text-brand-600" /> AI Settings
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">Configure provider selection, API keys, and default models.</p>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <h2 className="flex items-center gap-2 font-bold text-slate-900">
                            <Cpu className="h-4 w-4 text-brand-600" /> Provider
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {['openrouter', 'gemini'].map((provider) => (
                                <button
                                    key={provider}
                                    onClick={() => set('ai_provider', provider)}
                                    className={`rounded-xl border p-4 text-left transition-all ${settings.ai_provider === provider
                                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="mb-1 flex items-center gap-2">
                                        {settings.ai_provider === provider && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                                        <span className="font-bold capitalize">{provider === 'openrouter' ? 'OpenRouter' : 'Gemini Direct'}</span>
                                    </div>
                                    <p className="text-xs opacity-80">{provider === 'openrouter' ? 'One gateway for many models' : 'Use Google Gemini API directly'}</p>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {settings.ai_provider === 'openrouter' && (
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="space-y-5 p-6">
                            <h2 className="flex items-center gap-2 font-bold text-slate-900">
                                <Key className="h-4 w-4 text-brand-600" /> OpenRouter API
                            </h2>
                            <SecretInput
                                label="API Key"
                                placeholder={settings.openrouter_api_key_masked || 'sk-or-v1-...'}
                                masked={settings.openrouter_api_key_masked}
                                value={settings.openrouter_api_key}
                                visible={showOpenKey}
                                onToggle={() => setShowOpenKey(!showOpenKey)}
                                onChange={(value) => set('openrouter_api_key', value)}
                            />
                            <ModelSelect value={settings.openrouter_default_model} onChange={(value) => set('openrouter_default_model', value)} models={OPENROUTER_MODELS} />
                        </CardContent>
                    </Card>
                )}

                {settings.ai_provider === 'gemini' && (
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="space-y-5 p-6">
                            <h2 className="flex items-center gap-2 font-bold text-slate-900">
                                <Key className="h-4 w-4 text-brand-600" /> Google Gemini API
                            </h2>
                            <SecretInput
                                label="API Key"
                                placeholder={settings.gemini_api_key_masked || 'AIza...'}
                                masked={settings.gemini_api_key_masked}
                                value={settings.gemini_api_key}
                                visible={showGeminiKey}
                                onToggle={() => setShowGeminiKey(!showGeminiKey)}
                                onChange={(value) => set('gemini_api_key', value)}
                            />
                            <ModelSelect value={settings.gemini_default_model} onChange={(value) => set('gemini_default_model', value)} models={GEMINI_MODELS} />
                        </CardContent>
                    </Card>
                )}

                <Button className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white hover:bg-brand-700" onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save AI Settings'}
                </Button>
            </div>
        </AdminLayout>
    );
}

function SecretInput({ label, placeholder, masked, value, visible, onToggle, onChange }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</label>
            <div className="relative">
                <Input
                    type={visible ? 'text' : 'password'}
                    placeholder={placeholder}
                    className="border-slate-300 bg-white pr-10 font-mono text-sm text-slate-900"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700" onClick={onToggle} type="button">
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
            {masked && <p className="text-xs text-slate-500">Current key: <span className="font-mono">{masked}</span></p>}
        </div>
    );
}

function ModelSelect({ value, onChange, models }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Default Model</label>
            <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={value} onChange={(e) => onChange(e.target.value)}>
                {models.map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                ))}
            </select>
        </div>
    );
}
