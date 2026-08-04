import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { CheckCircle2, Cpu, Eye, EyeOff, Key, Pencil, Plus, Save, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

const csrf = () => document.head.querySelector('meta[name="csrf-token"]')?.content || '';

const emptyCredential = { name: '', api_key: '', priority: '100', weight: '100' };
const emptyModel = { model_key: '', label: '', capabilities: 'text,vision,structured_output,tools', input_cost_per_million: '', output_cost_per_million: '' };
const emptyPlan = { key: '', scope_type: 'user', name: '', feature_group: '', price: '0', currency_code: 'TZS', billing_interval: 'monthly', claim_frequency: 'monthly', included_credits: '0', overage_allowed: false, overage_credit_price: '' };

export default function AiSettings() {
    const { t, copy } = useLocale();
    const [data, setData] = useState({ provider: null, credentials: [], models: [], tasks: [], legacy: {} });
    const [credential, setCredential] = useState(emptyCredential);
    const [model, setModel] = useState(emptyModel);
    const [plan, setPlan] = useState(emptyPlan);
    const [showKey, setShowKey] = useState(false);
    const [loading, setLoading] = useState(true);
    const [savingCredential, setSavingCredential] = useState(false);
    const [savingModel, setSavingModel] = useState(false);
    const [savingPlan, setSavingPlan] = useState(false);
    const [editingModelId, setEditingModelId] = useState(null);
    const [editingCapabilities, setEditingCapabilities] = useState('');
    const [savingModelCapabilities, setSavingModelCapabilities] = useState(false);

    const load = async () => {
        try {
            const response = await fetch('/admin/api/ai', { headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.message || copy('Failed to load AI control plane.', 'Imeshindikana kupakia udhibiti wa AI.'));
            setData(payload);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const request = async (url, options = {}) => {
        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrf(),
                ...(options.headers || {}),
            },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || copy('The AI settings request failed.', 'Ombi la mipangilio ya AI limeshindikana.'));
        return payload;
    };

    const addCredential = async (event) => {
        event.preventDefault();
        setSavingCredential(true);
        try {
            await request('/admin/api/ai/credentials', {
                method: 'POST',
                body: JSON.stringify({ ...credential, priority: Number(credential.priority), weight: Number(credential.weight) }),
            });
            setCredential(emptyCredential);
            setShowKey(false);
            await load();
            toast.success(copy('OpenRouter key added securely.', 'Funguo ya OpenRouter imeongezwa kwa usalama.'));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSavingCredential(false);
        }
    };

    const addModel = async (event) => {
        event.preventDefault();
        setSavingModel(true);
        try {
            await request('/admin/api/ai/models', {
                method: 'POST',
                body: JSON.stringify({
                    model_key: model.model_key,
                    label: model.label,
                    capabilities: model.capabilities.split(',').map((value) => value.trim()).filter(Boolean),
                    input_cost_per_million: model.input_cost_per_million || null,
                    output_cost_per_million: model.output_cost_per_million || null,
                }),
            });
            setModel(emptyModel);
            await load();
            toast.success(copy('AI model added.', 'Model ya AI imeongezwa.'));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSavingModel(false);
        }
    };

    const addPlan = async (event) => {
        event.preventDefault();
        setSavingPlan(true);
        try {
            await request('/admin/api/ai/plans', {
                method: 'POST',
                body: JSON.stringify({ ...plan, price: Number(plan.price), included_credits: Number(plan.included_credits), overage_credit_price: plan.overage_credit_price || null }),
            });
            setPlan(emptyPlan);
            await load();
            toast.success(copy('AI plan added.', 'Mpango wa AI umeongezwa.'));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSavingPlan(false);
        }
    };

    const togglePlan = async (item) => {
        try {
            await request(`/admin/api/ai/plans/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !item.is_active }) });
            await load();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const updatePlan = async (item, changes) => {
        try {
            await request(`/admin/api/ai/plans/${item.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
            await load();
            toast.success(copy('AI plan updated.', 'Mpango wa AI umeboreshwa.'));
        } catch (error) {
            toast.error(error.message);
        }
    };

    const savePlanLimit = async (planItem, taskKey, changes) => {
        try {
            await request(`/admin/api/ai/plans/${planItem.id}/limits/${taskKey}`, {
                method: 'PUT',
                body: JSON.stringify(changes),
            });
            await load();
            toast.success(copy('Plan task allowance updated.', 'Allowance ya kazi ya mpango imesasishwa.'));
        } catch (error) {
            toast.error(error.message);
        }
    };

    const updateCredential = async (item, changes) => {
        try {
            await request(`/admin/api/ai/credentials/${item.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
            await load();
            toast.success(copy('Credential updated.', 'Credential imebadilishwa.'));
        } catch (error) {
            toast.error(error.message);
        }
    };

    const removeCredential = async (item) => {
        if (!window.confirm(copy(`Remove ${item.name}?`, `Ondoa ${item.name}?`))) return;
        try {
            await request(`/admin/api/ai/credentials/${item.id}`, { method: 'DELETE' });
            await load();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const toggleModel = async (item) => {
        try {
            await request(`/admin/api/ai/models/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !item.is_active }) });
            await load();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const startModelEdit = (item) => {
        setEditingModelId(item.id);
        setEditingCapabilities((item.capabilities || []).join(','));
    };

    const saveModelCapabilities = async (item) => {
        const capabilities = editingCapabilities.split(',').map((value) => value.trim()).filter(Boolean);
        if (capabilities.length === 0) return;
        setSavingModelCapabilities(true);
        try {
            await request(`/admin/api/ai/models/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ capabilities }),
            });
            setEditingModelId(null);
            setEditingCapabilities('');
            await load();
            toast.success(copy('Model capabilities updated.', 'Uwezo wa model umeboreshwa.'));
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSavingModelCapabilities(false);
        }
    };

    const removeModel = async (item) => {
        if (!window.confirm(copy(`Remove ${item.label}?`, `Ondoa ${item.label}?`))) return;
        try {
            await request(`/admin/api/ai/models/${item.id}`, { method: 'DELETE' });
            await load();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const updateTask = async (task, changes) => {
        try {
            await request(`/admin/api/ai/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
            await load();
            toast.success(copy('Task route updated.', 'Njia ya kazi imebadilishwa.'));
        } catch (error) {
            toast.error(error.message);
        }
    };

    const activeModels = useMemo(() => data.models.filter((item) => item.is_active), [data.models]);

    if (loading) {
        return (
            <AdminLayout title={t('adminUi.aiSettings')}>
                <div className="flex h-64 items-center justify-center text-slate-500">{copy('Loading AI control plane...', 'Inapakia udhibiti wa AI...')}</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={t('adminUi.aiSettings')}>
            <Head title={`${t('adminUi.aiSettings')} | Takeer`} />

            <div className="max-w-6xl space-y-6">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                        <Settings2 className="h-6 w-6 text-brand-600" /> {copy('AI Control Plane', 'Udhibiti wa AI')}
                    </h1>
                    <p className="mt-1 max-w-3xl text-sm text-slate-600">
                        {copy('OpenRouter is the platform gateway. Add multiple encrypted keys, register the models you pay for, and assign each model to a specific Takeer AI capability.', 'OpenRouter ndiyo gateway ya jukwaa. Ongeza funguo nyingi zilizofichwa, sajili models unazolipia, na gawa kila model kwa uwezo maalum wa AI wa Takeer.')}
                    </p>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck className="h-5 w-5" /></span>
                            <div>
                                <h2 className="font-black text-slate-900">{data.provider?.name || 'OpenRouter'}</h2>
                                <p className="text-xs text-slate-500">{data.provider?.base_url}</p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            {copy('Keys are encrypted at rest and are never returned to this page. The environment key remains only as a compatibility fallback.', 'Funguo huhifadhiwa kwa usimbaji na hazirudishwi kwenye ukurasa huu. Fungu la mazingira linabaki kama njia ya muda ya uokoaji.')}
                        </div>
                        <form onSubmit={addCredential} className="grid gap-3 md:grid-cols-[1.2fr_2fr_110px_110px_auto] md:items-end">
                            <Field label={copy('Key name', 'Jina la funguo')}>
                                <Input required value={credential.name} onChange={(e) => setCredential({ ...credential, name: e.target.value })} placeholder="Primary production" />
                            </Field>
                            <Field label={copy('OpenRouter API key', 'Funguo ya API ya OpenRouter')}>
                                <div className="relative">
                                    <Input required type={showKey ? 'text' : 'password'} value={credential.api_key} onChange={(e) => setCredential({ ...credential, api_key: e.target.value })} placeholder="sk-or-v1-..." className="pr-10 font-mono" />
                                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                                </div>
                            </Field>
                            <Field label={copy('Priority', 'Kipaumbele')}><Input type="number" min="0" value={credential.priority} onChange={(e) => setCredential({ ...credential, priority: e.target.value })} /></Field>
                            <Field label={copy('Weight', 'Uzito')}><Input type="number" min="1" value={credential.weight} onChange={(e) => setCredential({ ...credential, weight: e.target.value })} /></Field>
                            <Button type="submit" disabled={savingCredential}><Plus className="mr-2 h-4 w-4" />{savingCredential ? '...' : copy('Add key', 'Ongeza')}</Button>
                        </form>
                        <div className="space-y-2">
                            {data.credentials.length === 0 && <p className="text-sm text-slate-500">{copy('No database key configured yet.', 'Hakuna funguo ya database iliyowekwa bado.')}</p>}
                            {data.credentials.map((item) => (
                                <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3"><Key className="h-4 w-4 text-brand-600" /><div><p className="text-sm font-bold text-slate-900">{item.name}</p><p className="font-mono text-xs text-slate-500">{item.key_hint} · priority {item.priority} · failures {item.failure_count}</p></div></div>
                                    <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span><Button variant="outline" size="sm" onClick={() => updateCredential(item, { status: item.status === 'active' ? 'disabled' : 'active' })}>{item.status === 'active' ? copy('Disable', 'Zima') : copy('Enable', 'Washa')}</Button><Button variant="outline" size="sm" onClick={() => removeCredential(item)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="space-y-4 p-6">
                            <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-brand-600" /><h2 className="font-black text-slate-900">{copy('Model catalog', 'Orodha ya models')}</h2></div>
                            <p className="text-xs text-slate-500">{copy('Register model IDs exactly as OpenRouter exposes them. Capabilities prevent a text-only model from being assigned to image work. Conversational AI Search also needs tools or function_calling.', 'Sajili model IDs kama zinavyoonekana OpenRouter. Uwezo huzuia model ya maandishi pekee kugawiwa kazi ya picha. AI Search ya mazungumzo pia inahitaji tools au function_calling.')}</p>
                            <form onSubmit={addModel} className="space-y-3">
                                <Field label={copy('Model ID', 'Model ID')}><Input required value={model.model_key} onChange={(e) => setModel({ ...model, model_key: e.target.value })} placeholder="provider/model-name" /></Field>
                                <Field label={copy('Display name', 'Jina la kuonyesha')}><Input required value={model.label} onChange={(e) => setModel({ ...model, label: e.target.value })} placeholder="Fast vision model" /></Field>
                                <Field label={copy('Capabilities, comma-separated', 'Uwezo, tenga kwa koma')}><Input required value={model.capabilities} onChange={(e) => setModel({ ...model, capabilities: e.target.value })} placeholder="text,vision,structured_output,tools" /></Field>
                                <div className="grid grid-cols-2 gap-3"><Field label="Input cost / 1M"><Input type="number" min="0" step="0.000001" value={model.input_cost_per_million} onChange={(e) => setModel({ ...model, input_cost_per_million: e.target.value })} /></Field><Field label="Output cost / 1M"><Input type="number" min="0" step="0.000001" value={model.output_cost_per_million} onChange={(e) => setModel({ ...model, output_cost_per_million: e.target.value })} /></Field></div>
                                <Button type="submit" disabled={savingModel}><Plus className="mr-2 h-4 w-4" />{savingModel ? '...' : copy('Register model', 'Sajili model')}</Button>
                            </form>
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                                {data.models.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{item.label}</p><p className="truncate font-mono text-[11px] text-slate-500">{item.model_key}</p><div className="mt-1 flex flex-wrap gap-1">{(item.capabilities || []).map((capability) => <span key={capability} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{capability}</span>)}</div>{editingModelId === item.id && <div className="mt-3 flex flex-wrap gap-2"><Input value={editingCapabilities} onChange={(event) => setEditingCapabilities(event.target.value)} placeholder="text,structured_output,tools" className="min-w-[220px] flex-1 font-mono text-xs" /><Button size="sm" onClick={() => saveModelCapabilities(item)} disabled={savingModelCapabilities}><Save className="mr-1 h-3.5 w-3.5" />{savingModelCapabilities ? '...' : copy('Save', 'Hifadhi')}</Button><Button variant="outline" size="sm" onClick={() => setEditingModelId(null)}>{copy('Cancel', 'Ghairi')}</Button></div>}</div><div className="flex shrink-0 flex-wrap justify-end gap-1"><Button variant="outline" size="sm" onClick={() => editingModelId === item.id ? setEditingModelId(null) : startModelEdit(item)}><Pencil className="mr-1 h-3.5 w-3.5" />{copy('Capabilities', 'Uwezo')}</Button><Button variant="outline" size="sm" onClick={() => toggleModel(item)}>{item.is_active ? copy('Disable', 'Zima') : copy('Enable', 'Washa')}</Button><Button variant="outline" size="sm" onClick={() => removeModel(item)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></div>)}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="space-y-4 p-6">
                            <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-brand-600" /><h2 className="font-black text-slate-900">{copy('Task routing', 'Ugawaji wa kazi')}</h2></div>
                            <p className="text-xs text-slate-500">{copy('Choose a primary model and optional fallbacks for every AI capability. Credit cost is the amount reserved from a user before the job starts.', 'Chagua model kuu na za akiba kwa kila uwezo wa AI. Gharama ya credit ndiyo kiasi kinachowekwa kutoka kwa mtumiaji kabla ya kazi kuanza.')}</p>
                            <div className="space-y-3">
                                {data.tasks.map((task) => <TaskRoute key={task.id} task={task} models={activeModels} onSave={updateTask} />)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="space-y-4 p-6">
                        <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-600" /><h2 className="font-black text-slate-900">{copy('Platform AI credit plans', 'Mipango ya credits za AI')}</h2></div>
                        <p className="text-xs text-slate-500">{copy('Create separate user and merchant-business AI plans. Credits are deposited into the matching wallet after payment or an admin grant.', 'Tengeneza mipango tofauti ya user na biashara ya merchant. Credits huwekwa kwenye wallet sahihi baada ya malipo au grant ya admin.')}</p>
                        <form onSubmit={addPlan} className="grid gap-3 md:grid-cols-4 md:items-end">
                            <Field label={copy('Plan key', 'Key ya mpango')}><Input required value={plan.key} onChange={(e) => setPlan({ ...plan, key: e.target.value })} placeholder="creator" /></Field>
                            <Field label={copy('Wallet owner', 'Mmiliki wa wallet')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={plan.scope_type} onChange={(e) => setPlan({ ...plan, scope_type: e.target.value })}><option value="user">{copy('User', 'User')}</option><option value="merchant">{copy('Merchant business', 'Biashara ya merchant')}</option></select></Field>
                            <Field label={copy('Plan name', 'Jina la mpango')}><Input required value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} placeholder="Creator AI" /></Field>
                            <Field label={copy('Feature group', 'Kundi la feature')}><Input value={plan.feature_group} onChange={(e) => setPlan({ ...plan, feature_group: e.target.value })} placeholder="Search and try-on" /></Field>
                            <Field label={copy('Price (TZS)', 'Bei (TZS)')}><Input type="number" min="0" value={plan.price} onChange={(e) => setPlan({ ...plan, price: e.target.value })} /></Field>
                            <Field label={copy('Included credits', 'Credits zilizojumuishwa')}><Input type="number" min="0" step="0.0001" value={plan.included_credits} onChange={(e) => setPlan({ ...plan, included_credits: e.target.value })} /></Field>
                            <Field label={copy('Billing', 'Bili')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={plan.billing_interval} onChange={(e) => setPlan({ ...plan, billing_interval: e.target.value })}><option value="monthly">{copy('Monthly', 'Kila mwezi')}</option><option value="annual">{copy('Annual', 'Kila mwaka')}</option><option value="one_time">{copy('One time', 'Mara moja')}</option></select></Field>
                            <Field label={copy('Claim frequency', 'Marudio ya claim')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={plan.claim_frequency} onChange={(e) => setPlan({ ...plan, claim_frequency: e.target.value })}><option value="once">{copy('Once ever', 'Mara moja tu')}</option><option value="daily">{copy('Daily', 'Kila siku')}</option><option value="weekly">{copy('Weekly', 'Kila wiki')}</option><option value="monthly">{copy('Monthly', 'Kila mwezi')}</option></select><p className="mt-1 text-[10px] text-slate-500">{copy('Self-service claim reset window', 'Window ya kujidai upya')}</p></Field>
                            <Field label={copy('Overage price / credit', 'Bei ya ziada / credit')}><Input type="number" min="0" step="0.0001" value={plan.overage_credit_price} onChange={(e) => setPlan({ ...plan, overage_credit_price: e.target.value, overage_allowed: e.target.value !== '' })} /></Field>
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={plan.overage_allowed} onChange={(e) => setPlan({ ...plan, overage_allowed: e.target.checked })} />{copy('Allow overage', 'Ruhusu ziada')}</label>
                            <Button type="submit" disabled={savingPlan}><Plus className="mr-2 h-4 w-4" />{savingPlan ? '...' : copy('Add plan', 'Ongeza mpango')}</Button>
                        </form>
                        <div className="grid gap-3 md:grid-cols-2">
                            {(data.plans || []).map((item) => <PlanCard key={item.id} item={item} tasks={data.tasks || []} onToggle={togglePlan} onSavePlan={updatePlan} onSaveLimit={savePlanLimit} />)}
                        </div>
                    </CardContent>
                </Card>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                    {copy('The next billing screen can use these task credit costs with platform AI plans. Provider spending is recorded separately from user charges so Takeer can enforce margins, quotas, retries, and refunds.', 'Ukurasa wa bili unaweza kutumia gharama hizi za credits pamoja na mipango ya AI ya jukwaa. Matumizi ya provider yanarekodiwa tofauti na malipo ya mtumiaji ili Takeer idhibiti faida, viwango, retries na refunds.')}
                </div>
            </div>
        </AdminLayout>
    );
}

function TaskRoute({ task, models, onSave }) {
    const { copy } = useLocale();
    const [primary, setPrimary] = useState(task.primary_model_id || '');
    const [fallbacks, setFallbacks] = useState((task.fallback_model_ids || []).map(String));
    const [cost, setCost] = useState(task.credit_cost ?? 1);
    const [active, setActive] = useState(Boolean(task.is_active));
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            await onSave(task, { primary_model_id: primary ? Number(primary) : null, fallback_model_ids: fallbacks.map(Number), credit_cost: Number(cost), is_active: active });
        } finally {
            setSaving(false);
        }
    };

    return <div className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-sm font-black text-slate-900">{task.label}</p><p className="mt-1 text-xs text-slate-500">{task.description}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{task.task_key} · requires {task.required_capability || 'general'}</p>{task.task_key === 'ai_search' && <p className="mt-1 text-[10px] font-semibold text-brand-700">{copy('Conversational search additionally requires tools/function_calling.', 'Search ya mazungumzo pia inahitaji tools/function_calling.')}</p>}</div><label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{copy('Active', 'Hai')}</label></div><div className="grid gap-3 md:grid-cols-3"><Field label={copy('Primary model', 'Model kuu')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={primary} onChange={(e) => setPrimary(e.target.value)}><option value="">{copy('Not assigned', 'Haijagawiwa')}</option>{models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label={copy('Fallback models', 'Models za akiba')}><select multiple className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" value={fallbacks} onChange={(e) => setFallbacks(Array.from(e.target.selectedOptions).map((option) => option.value))}>{models.filter((item) => String(item.id) !== String(primary)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field><Field label={copy('Credits per use', 'Credits kwa matumizi')}><Input type="number" min="0" step="0.0001" value={cost} onChange={(e) => setCost(e.target.value)} /><p className="mt-1 text-[10px] text-slate-500">{copy('Reserved before execution', 'Huwekwa kabla ya utekelezaji')}</p></Field></div><div className="mt-3 flex justify-end"><Button size="sm" onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? '...' : copy('Save route', 'Hifadhi njia')}</Button></div></div>;
}

function PlanCard({ item, tasks, onToggle, onSavePlan, onSaveLimit }) {
    const { copy } = useLocale();
    const [values, setValues] = useState({});
    const [savingFrequency, setSavingFrequency] = useState(false);

    useEffect(() => {
        const next = {};
        tasks.forEach((task) => {
            const limit = (item.limits || []).find((candidate) => candidate.task_key === task.task_key);
            next[task.task_key] = {
                enabled: limit ? Boolean(limit.is_enabled) : true,
                units: limit?.included_units ?? '',
                credit_cost: limit?.credit_cost_override ?? '',
            };
        });
        setValues(next);
    }, [item.id, JSON.stringify(item.limits || []), JSON.stringify(tasks.map((task) => task.task_key))]);

    const setValue = (taskKey, key, value) => setValues((current) => ({
        ...current,
        [taskKey]: { ...(current[taskKey] || {}), [key]: value },
    }));

    const saveFrequency = async (value) => {
        setSavingFrequency(true);
        try {
            await onSavePlan(item, { claim_frequency: value });
        } finally {
            setSavingFrequency(false);
        }
    };

    return <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-900">{item.name}</p><p className="font-mono text-[10px] text-slate-500">{item.key} · {item.scope_type} · {item.billing_interval}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.is_active ? 'active' : 'disabled'}</span></div><p className="mt-3 text-sm text-slate-700">{item.price} {item.currency_code} · {item.included_credits} credits</p><div className="mt-2 flex items-center gap-2"><label className="text-xs font-bold text-slate-600">{copy('Claim frequency', 'Marudio ya claim')}</label><select disabled={savingFrequency} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-800" value={item.claim_frequency || 'monthly'} onChange={(event) => saveFrequency(event.target.value)}><option value="once">{copy('Once ever', 'Mara moja tu')}</option><option value="daily">{copy('Daily', 'Kila siku')}</option><option value="weekly">{copy('Weekly', 'Kila wiki')}</option><option value="monthly">{copy('Monthly', 'Kila mwezi')}</option></select></div><p className="mt-1 text-xs text-slate-500">{item.feature_group || copy('Configure task access below', 'Sanidi access ya kazi hapa chini')} · {item.overage_allowed ? `${item.overage_credit_price || 0} ${item.currency_code} / credit overage` : copy('No overage', 'Hakuna ziada')}</p><div className="mt-4 space-y-2 border-t border-slate-100 pt-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{copy('Task allowances', 'Allowances za kazi')}</p>{tasks.map((task) => { const current = values[task.task_key] || { enabled: true, units: '', credit_cost: '' }; return <div key={task.task_key} className="rounded-lg bg-slate-50 p-2"><div className="flex items-center justify-between gap-2"><label className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={current.enabled} onChange={(event) => setValue(task.task_key, 'enabled', event.target.checked)} /> <span className="truncate">{task.label}</span></label><Button variant="outline" size="sm" onClick={() => onSaveLimit(item, task.task_key, { is_enabled: current.enabled, included_units: current.units === '' ? null : Number(current.units), credit_cost_override: current.credit_cost === '' ? null : Number(current.credit_cost) })}>{copy('Save', 'Hifadhi')}</Button></div><div className="mt-2 grid grid-cols-2 gap-2"><Input type="number" min="0" step="0.0001" value={current.units} onChange={(event) => setValue(task.task_key, 'units', event.target.value)} placeholder={copy('Units unlimited', 'Units bila kikomo')} /><Input type="number" min="0" step="0.0001" value={current.credit_cost} onChange={(event) => setValue(task.task_key, 'credit_cost', event.target.value)} placeholder={copy('Route cost', 'Gharama ya route')} /></div></div>; })}</div><Button variant="outline" size="sm" className="mt-3" onClick={() => onToggle(item)}>{item.is_active ? copy('Disable plan', 'Zima mpango') : copy('Enable plan', 'Washa mpango')}</Button></div>;
}

function Field({ label, children }) {
    return <div className="space-y-1.5"><label className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</label>{children}</div>;
}
