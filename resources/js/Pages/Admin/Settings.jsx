import React, { useState, useEffect } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Settings2, Eye, EyeOff, Save, CheckCircle2, Cpu, Key, ShieldCheck } from 'lucide-react';
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

export default function AdminSettings() {
    const [settings, setSettings] = useState({
        ai_provider: 'openrouter',
        openrouter_api_key: '',
        openrouter_api_key_masked: '',
        openrouter_default_model: 'google/gemini-2.5-flash',
        gemini_api_key: '',
        gemini_api_key_masked: '',
        gemini_default_model: 'gemini-1.5-flash',
        kyc_enforcement_mode: 'off',
        kyc_trigger_gmv_tzs: '0',
        kyc_trigger_order_count: '0',
        kyc_trigger_withdrawal_tzs: '0',
        catalog_item_picker_default_limit: '5',
        upload_allowed_extensions: 'jpg,jpeg,png,webp,gif,mp4,mov,webm,pdf,zip,doc,docx,xls,xlsx,ppt,pptx,csv,txt',
        upload_allowed_mime_types: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain',
        upload_max_file_mb: '500',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showOpenKey, setShowOpenKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);

    useEffect(() => {
        fetch('/admin/api/settings', { headers: { Accept: 'application/json' } })
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.message || 'Failed to load settings.');
                return data;
            })
            .then(data => {
                setSettings(prev => ({ ...prev, ...data.settings }));
                setLoading(false);
            })
            .catch((err) => {
                toast.error(err.message);
                setLoading(false);
            });
    }, []);

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
                    kyc_enforcement_mode: settings.kyc_enforcement_mode,
                    kyc_trigger_gmv_tzs: settings.kyc_trigger_gmv_tzs,
                    kyc_trigger_order_count: settings.kyc_trigger_order_count,
                    kyc_trigger_withdrawal_tzs: settings.kyc_trigger_withdrawal_tzs,
                    catalog_item_picker_default_limit: settings.catalog_item_picker_default_limit,
                    upload_allowed_extensions: settings.upload_allowed_extensions,
                    upload_allowed_mime_types: settings.upload_allowed_mime_types,
                    upload_max_file_mb: settings.upload_max_file_mb,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(data.message || 'Settings saved');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

    if (loading) {
        return (
            <AdminLayout title="AI Settings">
                <div className="flex items-center justify-center h-64 text-slate-500">Loading settings...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="AI Settings">
            <Head title="Admin Settings | Takeer" />

            <div className="space-y-8 max-w-3xl">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Settings2 className="h-6 w-6 text-brand-600" /> AI Settings
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm">Configure provider selection, API keys, and default models.</p>
                </div>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-brand-600" /> Provider
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            {['openrouter', 'gemini'].map(provider => (
                                <button
                                    key={provider}
                                    onClick={() => set('ai_provider', provider)}
                                    className={`p-4 rounded-xl border text-left transition-all ${settings.ai_provider === provider
                                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {settings.ai_provider === provider && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                                        <span className="font-bold capitalize">{provider === 'openrouter' ? 'OpenRouter' : 'Gemini Direct'}</span>
                                    </div>
                                    <p className="text-xs opacity-80">
                                        {provider === 'openrouter' ? 'One gateway for many models' : 'Use Google Gemini API directly'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {settings.ai_provider === 'openrouter' && (
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="p-6 space-y-5">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                <Key className="h-4 w-4 text-brand-600" /> OpenRouter API
                            </h2>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">API Key</label>
                                <div className="relative">
                                    <Input
                                        type={showOpenKey ? 'text' : 'password'}
                                        placeholder={settings.openrouter_api_key_masked || 'sk-or-v1-...'}
                                        className="bg-white border-slate-300 text-slate-900 pr-10 font-mono text-sm"
                                        value={settings.openrouter_api_key}
                                        onChange={e => set('openrouter_api_key', e.target.value)}
                                    />
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                                        onClick={() => setShowOpenKey(!showOpenKey)}
                                        type="button"
                                    >
                                        {showOpenKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {settings.openrouter_api_key_masked && (
                                    <p className="text-xs text-slate-500">Current key: <span className="font-mono">{settings.openrouter_api_key_masked}</span></p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Default Model</label>
                                <select
                                    className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                                    value={settings.openrouter_default_model}
                                    onChange={e => set('openrouter_default_model', e.target.value)}
                                >
                                    {OPENROUTER_MODELS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {settings.ai_provider === 'gemini' && (
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="p-6 space-y-5">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                <Key className="h-4 w-4 text-brand-600" /> Google Gemini API
                            </h2>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">API Key</label>
                                <div className="relative">
                                    <Input
                                        type={showGeminiKey ? 'text' : 'password'}
                                        placeholder={settings.gemini_api_key_masked || 'AIza...'}
                                        className="bg-white border-slate-300 text-slate-900 pr-10 font-mono text-sm"
                                        value={settings.gemini_api_key}
                                        onChange={e => set('gemini_api_key', e.target.value)}
                                    />
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                                        type="button"
                                    >
                                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {settings.gemini_api_key_masked && (
                                    <p className="text-xs text-slate-500">Current key: <span className="font-mono">{settings.gemini_api_key_masked}</span></p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Default Model</label>
                                <select
                                    className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                                    value={settings.gemini_default_model}
                                    onChange={e => set('gemini_default_model', e.target.value)}
                                >
                                    {GEMINI_MODELS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <h2 className="font-bold text-slate-900">Commerce Defaults</h2>
                        <p className="text-xs text-slate-600">Control default list size in bundle/subscription item pickers for merchants.</p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Item Picker Default Limit</label>
                            <Input
                                type="number"
                                min="1"
                                max="20"
                                value={settings.catalog_item_picker_default_limit}
                                onChange={(e) => set('catalog_item_picker_default_limit', e.target.value)}
                            />
                            <p className="text-xs text-slate-500">Used when no search term is entered in bundle/subscription create forms.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-brand-600" /> Upload Policy
                        </h2>
                        <p className="text-xs text-slate-600">Allow only the file types merchants can upload for products, posts, chat attachments, and digital content.</p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Max File Size (MB)</label>
                            <Input
                                type="number"
                                min="1"
                                max="500"
                                value={settings.upload_max_file_mb}
                                onChange={(e) => set('upload_max_file_mb', e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Allowed Extensions</label>
                            <textarea
                                className="w-full min-h-20 rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                                value={settings.upload_allowed_extensions}
                                onChange={(e) => set('upload_allowed_extensions', e.target.value)}
                            />
                            <p className="text-xs text-slate-500">Comma or newline separated. Example: jpg,png,pdf,mp4</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Allowed MIME Types</label>
                            <textarea
                                className="w-full min-h-28 rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                                value={settings.upload_allowed_mime_types}
                                onChange={(e) => set('upload_allowed_mime_types', e.target.value)}
                            />
                            <p className="text-xs text-slate-500">Server detected MIME types must match this list.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <h2 className="font-bold text-slate-900">KYC Threshold Controls</h2>
                        <p className="text-xs text-slate-600">Allow new merchants to sell first, then enforce KYC once thresholds are crossed.</p>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Enforcement Mode</label>
                            <select
                                className="w-full rounded-xl border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                                value={settings.kyc_enforcement_mode}
                                onChange={(e) => set('kyc_enforcement_mode', e.target.value)}
                            >
                                <option value="off">Off</option>
                                <option value="withdrawals_only">Withdrawals Only</option>
                                <option value="listings_and_withdrawals">Listings + Withdrawals</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">GMV Threshold (TZS)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={settings.kyc_trigger_gmv_tzs}
                                    onChange={(e) => set('kyc_trigger_gmv_tzs', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Order Count Threshold</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={settings.kyc_trigger_order_count}
                                    onChange={(e) => set('kyc_trigger_order_count', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Withdrawal Threshold (TZS)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={settings.kyc_trigger_withdrawal_tzs}
                                    onChange={(e) => set('kyc_trigger_withdrawal_tzs', e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Button
                    className="w-full h-12 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl"
                    onClick={handleSave}
                    disabled={saving}
                >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </AdminLayout>
    );
}
