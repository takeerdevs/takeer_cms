import React, { useEffect, useState } from 'react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
    id: null,
    name: '',
    policy: 'standard',
    window_days: '3',
    note: '',
    is_default: false,
    is_active: true,
};

const policyOptions = [
    { key: 'standard', label: 'Rudisha au badilisha', hint: 'Mteja anaweza kurudisha bidhaa au kuibadilisha ndani ya muda ulioweka.' },
    { key: 'strict', label: 'Kubadilisha tu', hint: 'Inafaa kama bidhaa imeharibika, si sahihi, au ina tatizo la ubora.' },
    { key: 'final_sale', label: 'Hairudishwi', hint: 'Inafaa kwa bidhaa zinazoharibika haraka, za usafi binafsi, au zilizoandaliwa maalum.' },
];

export default function ReturnPoliciesManager() {
    const [policies, setPolicies] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchPolicies = async () => {
        setLoading(true);
        try {
            const res = await window.axios.get('/api/merchant/return-policies');
            setPolicies(res.data.data || []);
        } catch (error) {
            toast.error('Imeshindikana kupakia return policies.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, []);

    const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                window_days: form.policy === 'final_sale' || form.window_days === '' ? null : Number(form.window_days),
            };
            if (form.id) {
                await window.axios.put(`/api/merchant/return-policies/${form.id}`, payload);
                toast.success('Sera ya kurudisha bidhaa imesasishwa.');
            } else {
                await window.axios.post('/api/merchant/return-policies', payload);
                toast.success('Sera ya kurudisha bidhaa imetengenezwa.');
            }
            setForm(emptyForm);
            fetchPolicies();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindikana kuhifadhi return policy.');
        } finally {
            setSaving(false);
        }
    };

    const setDefault = async (policy) => {
        try {
            await window.axios.post(`/api/merchant/return-policies/${policy.id}/set-default`);
            toast.success('Sera ya kawaida imesasishwa.');
            fetchPolicies();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindikana kubadilisha default policy.');
        }
    };

    const remove = async (policy) => {
        try {
            await window.axios.delete(`/api/merchant/return-policies/${policy.id}`);
            toast.success('Sera ya kurudisha bidhaa imefutwa.');
            fetchPolicies();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindikana kufuta return policy.');
        }
    };

    const policyLabel = (policyKey) => policyOptions.find((option) => option.key === policyKey)?.label || policyKey;

    return (
        <Card className="glass-card shadow-sm">
            <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                    <RotateCcw className="h-4 w-4" /> Sera za kurudisha bidhaa
                </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-wide text-muted-foreground" htmlFor="return-policy-name">
                                Jina la sera
                            </label>
                            <Input
                                id="return-policy-name"
                                value={form.name}
                                onChange={(e) => updateForm('name', e.target.value)}
                                placeholder="Mf. Kurudisha ndani ya siku 3"
                                className="h-10 rounded-xl"
                                required
                            />
                            <p className="text-[11px] font-semibold text-muted-foreground">
                                Andika jina fupi litakaloonekana kwa bidhaa.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                                Aina ya sera
                            </p>
                            {policyOptions.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => updateForm('policy', option.key)}
                                    className={`rounded-xl border px-3 py-2 text-left ${form.policy === option.key ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-border bg-white'}`}
                                >
                                    <span className="block text-xs font-black">{option.label}</span>
                                    <span className="mt-0.5 block text-[10px] font-semibold text-muted-foreground">{option.hint}</span>
                                </button>
                            ))}
                        </div>
                        {form.policy !== 'final_sale' && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-black uppercase tracking-wide text-muted-foreground" htmlFor="return-window-days">
                                    Muda wa kurudisha
                                </label>
                                <Input
                                    id="return-window-days"
                                    type="number"
                                    min="0"
                                    max="30"
                                    value={form.window_days}
                                    onChange={(e) => updateForm('window_days', e.target.value)}
                                    placeholder="Mf. 3"
                                    className="h-10 rounded-xl"
                                />
                                <p className="text-[11px] font-semibold text-muted-foreground">
                                    Idadi ya siku ambazo mteja anaweza kurudisha au kubadilisha bidhaa.
                                </p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black uppercase tracking-wide text-muted-foreground" htmlFor="return-policy-note">
                                Maelezo kwa mteja
                            </label>
                            <Textarea
                                id="return-policy-note"
                                value={form.note}
                                onChange={(e) => updateForm('note', e.target.value)}
                                placeholder="Mf. Tunakubali kubadilisha bidhaa ndani ya siku 3 kama imeharibika au si sahihi."
                                className="min-h-24 rounded-xl"
                            />
                            <p className="text-[11px] font-semibold text-muted-foreground">
                                Eleza masharti muhimu kwa lugha rahisi.
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={Boolean(form.is_default)}
                                onChange={(e) => updateForm('is_default', e.target.checked)}
                            />
                            Tumia kama sera ya kawaida kwa bidhaa za dukani
                        </label>
                        <div className="flex gap-2">
                            <Button type="submit" className="h-10 rounded-xl" disabled={saving}>
                                {form.id ? 'Hifadhi sera' : 'Tengeneza sera'}
                            </Button>
                            {form.id && (
                                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setForm(emptyForm)}>
                                    Ghairi
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className="space-y-2">
                        {loading && <p className="text-sm text-muted-foreground">Inapakia sera...</p>}
                        {!loading && policies.length === 0 && (
                            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                Tengeneza angalau sera moja ya kurudisha bidhaa. Sera ya kwanza itawekwa kuwa ya kawaida moja kwa moja.
                            </p>
                        )}
                        {policies.map((policy) => (
                            <div key={policy.id} className="rounded-2xl border border-border bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black">{policy.name}</p>
                                        <p className="text-xs font-semibold text-muted-foreground">
                                            {policyLabel(policy.policy)}{policy.window_days !== null ? ` · siku ${policy.window_days}` : ''}
                                            {policy.is_default ? ' · Kawaida' : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-red-600"
                                        aria-label={`Futa sera ${policy.name}`}
                                        onClick={() => remove(policy)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                {policy.note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{policy.note}</p>}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setForm({ ...emptyForm, ...policy, window_days: policy.window_days ?? '' })}>
                                        Hariri
                                    </Button>
                                    {!policy.is_default && (
                                        <Button type="button" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setDefault(policy)}>
                                            Weka kama kawaida
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
