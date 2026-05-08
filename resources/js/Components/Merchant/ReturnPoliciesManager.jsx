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
    { key: 'standard', label: 'Return accepted', hint: 'Returns or replacements are allowed within the window.' },
    { key: 'strict', label: 'Replacement only', hint: 'Best for damaged, wrong, or quality issue cases.' },
    { key: 'final_sale', label: 'Final sale', hint: 'Best for perishables, hygiene, or custom items.' },
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
                toast.success('Return policy updated.');
            } else {
                await window.axios.post('/api/merchant/return-policies', payload);
                toast.success('Return policy created.');
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
            toast.success('Default return policy updated.');
            fetchPolicies();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindikana kubadilisha default policy.');
        }
    };

    const remove = async (policy) => {
        try {
            await window.axios.delete(`/api/merchant/return-policies/${policy.id}`);
            toast.success('Return policy deleted.');
            fetchPolicies();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Imeshindikana kufuta return policy.');
        }
    };

    return (
        <Card className="glass-card shadow-sm">
            <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                    <RotateCcw className="h-4 w-4" /> Return Policies
                </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                        <Input
                            value={form.name}
                            onChange={(e) => updateForm('name', e.target.value)}
                            placeholder="Mf. Standard 3-day return"
                            className="h-10 rounded-xl"
                            required
                        />
                        <div className="grid gap-2">
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
                            <Input
                                type="number"
                                min="0"
                                max="30"
                                value={form.window_days}
                                onChange={(e) => updateForm('window_days', e.target.value)}
                                placeholder="Window days"
                                className="h-10 rounded-xl"
                            />
                        )}
                        <Textarea
                            value={form.note}
                            onChange={(e) => updateForm('note', e.target.value)}
                            placeholder="Mf. Replacement ndani ya saa 72 kama damaged/wrong item."
                            className="min-h-20 rounded-xl"
                        />
                        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={Boolean(form.is_default)}
                                onChange={(e) => updateForm('is_default', e.target.checked)}
                            />
                            Make default for physical products
                        </label>
                        <div className="flex gap-2">
                            <Button type="submit" className="h-10 rounded-xl" disabled={saving}>
                                {form.id ? 'Update Policy' : 'Create Policy'}
                            </Button>
                            {form.id && (
                                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setForm(emptyForm)}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className="space-y-2">
                        {loading && <p className="text-sm text-muted-foreground">Loading policies...</p>}
                        {!loading && policies.length === 0 && (
                            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                                Create at least one return policy. The first policy becomes default automatically.
                            </p>
                        )}
                        {policies.map((policy) => (
                            <div key={policy.id} className="rounded-2xl border border-border bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black">{policy.name}</p>
                                        <p className="text-xs font-semibold text-muted-foreground">
                                            {policy.policy}{policy.window_days !== null ? ` · ${policy.window_days} days` : ''}
                                            {policy.is_default ? ' · Default' : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-red-600"
                                        onClick={() => remove(policy)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                {policy.note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{policy.note}</p>}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button type="button" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setForm({ ...emptyForm, ...policy, window_days: policy.window_days ?? '' })}>
                                        Edit
                                    </Button>
                                    {!policy.is_default && (
                                        <Button type="button" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setDefault(policy)}>
                                            Set default
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
