import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { BarChart3, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { useLocale } from '@/lib/i18n';

const isoDate = (date) => date.toISOString().slice(0, 10);
const initialFrom = isoDate(new Date(Date.now() - (29 * 24 * 60 * 60 * 1000)));
const initialTo = isoDate(new Date());

export default function AiUsage() {
    const { copy } = useLocale();
    const [filters, setFilters] = useState({ from: initialFrom, to: initialTo, group_by: 'day', task_key: '', model_key: '', scope_type: '' });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async (nextFilters = filters) => {
        setLoading(true);
        try {
            const response = await axios.get('/admin/api/ai/usage', { params: Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value !== '')) });
            setData(response.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const summary = data?.summary || {};
    const maxSeriesCost = useMemo(() => Math.max(1, ...(data?.series || []).map((item) => Number(item.provider_cost || 0))), [data]);

    const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
    const apply = (event) => {
        event.preventDefault();
        load(filters);
    };

    return (
        <AdminLayout title={copy('AI usage audit', 'Ukaguzi wa matumizi ya AI')}>
            <Head title={`${copy('AI usage audit', 'Ukaguzi wa matumizi ya AI')} | Takeer`} />

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-brand-700"><Sparkles className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">{copy('AI control plane', 'Udhibiti wa AI')}</span></div>
                        <h1 className="mt-2 text-2xl font-black text-slate-900">{copy('Model cost and task usage', 'Gharama za model na matumizi kwa kazi')}</h1>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{copy('Compare provider spending by model, task, scope, and time period. Failed attempts and fallback calls are included so routing decisions are based on the actual bill.', 'Linganisha matumizi ya provider kwa model, kazi, scope na muda. Attempts zilizoshindikana na fallback calls zinajumuishwa ili maamuzi ya routing yatokane na bili halisi.')}</p>
                    </div>
                    <Button variant="outline" onClick={() => load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{copy('Refresh', 'Pakia upya')}</Button>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <form onSubmit={apply} className="grid gap-3 md:grid-cols-3 xl:grid-cols-6 xl:items-end">
                            <Field label={copy('From', 'Kuanzia')}><Input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} /></Field>
                            <Field label={copy('To', 'Hadi')}><Input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} /></Field>
                            <Field label={copy('Group by', 'Panga kwa')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.group_by} onChange={(event) => setFilter('group_by', event.target.value)}><option value="day">{copy('Day', 'Siku')}</option><option value="month">{copy('Month', 'Mwezi')}</option></select></Field>
                            <Field label={copy('Task', 'Kazi')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.task_key} onChange={(event) => setFilter('task_key', event.target.value)}><option value="">{copy('All tasks', 'Kazi zote')}</option>{(data?.options?.tasks || []).map((task) => <option key={task.task_key} value={task.task_key}>{task.label}</option>)}</select></Field>
                            <Field label={copy('Model', 'Model')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.model_key} onChange={(event) => setFilter('model_key', event.target.value)}><option value="">{copy('All models', 'Models zote')}</option>{(data?.options?.models || []).map((model) => <option key={model.model_key} value={model.model_key}>{model.label || model.model_key}</option>)}</select></Field>
                            <Field label={copy('Wallet scope', 'Scope ya wallet')}><select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={filters.scope_type} onChange={(event) => setFilter('scope_type', event.target.value)}><option value="">{copy('All scopes', 'Scopes zote')}</option><option value="user">{copy('User', 'User')}</option><option value="merchant">{copy('Merchant business', 'Biashara')}</option></select></Field>
                            <Button type="submit" className="xl:col-span-6 md:w-fit" disabled={loading}><BarChart3 className="mr-2 h-4 w-4" />{copy('Apply filters', 'Tumia filters')}</Button>
                        </form>
                    </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Metric label={copy('Provider cost', 'Gharama ya provider')} value={`$${Number(summary.provider_cost || 0).toFixed(6)}`} />
                    <Metric label={copy('Requests', 'Requests')} value={summary.requests || 0} />
                    <Metric label={copy('Failed attempts', 'Attempts zilizoshindikana')} value={summary.failed_requests || 0} tone="rose" />
                    <Metric label={copy('Credits charged', 'Credits zilizotozwa')} value={Number(summary.charged_credits || 0).toFixed(2)} />
                    <Metric label={copy('Average latency', 'Latency ya wastani')} value={`${summary.average_latency_ms || 0} ms`} />
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <SectionTitle>{copy('Spend over time', 'Matumizi kwa muda')}</SectionTitle>
                        <div className="mt-4 space-y-3">
                            {(data?.series || []).map((item) => <div key={item.key} className="grid grid-cols-[90px_1fr_90px] items-center gap-3 text-xs"><span className="font-mono text-slate-500">{item.key}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(3, (Number(item.provider_cost || 0) / maxSeriesCost) * 100)}%` }} /></div><span className="text-right font-bold text-slate-700">${Number(item.provider_cost || 0).toFixed(6)}</span></div>)}
                            {!data?.series?.length && <Empty />}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                    <Breakdown title={copy('Cost by task', 'Gharama kwa kazi')} rows={data?.by_task || []} labelKey="key" />
                    <Breakdown title={copy('Cost by model', 'Gharama kwa model')} rows={data?.by_model || []} labelKey="key" />
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-5">
                        <SectionTitle>{copy('Recent attempts', 'Attempts za hivi karibuni')}</SectionTitle>
                        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="py-2">{copy('Time', 'Muda')}</th><th>Task</th><th>Model</th><th>Scope</th><th>Status</th><th>Tokens</th><th>Provider cost</th><th>Credits</th></tr></thead><tbody>{(data?.recent || []).map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 font-mono text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</td><td className="font-semibold text-slate-800">{item.task_key}</td><td className="font-mono text-slate-600">{item.model_key || 'unresolved'}</td><td>{item.scope_type}{item.merchant_id ? ` #${item.merchant_id}` : item.user_id ? ` #${item.user_id}` : ''}</td><td><span className={`rounded-full px-2 py-1 font-bold ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{item.status}</span></td><td>{Number(item.input_units || 0).toLocaleString()} / {Number(item.output_units || 0).toLocaleString()}</td><td>${Number(item.provider_cost || 0).toFixed(6)}</td><td>{Number(item.charged_credits || 0).toFixed(2)}</td></tr>)}</tbody></table>{!data?.recent?.length && <Empty />}</div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}

function Metric({ label, value, tone = 'blue' }) {
    return <Card className={`border-slate-200 bg-white shadow-sm ${tone === 'rose' ? 'border-rose-200' : ''}`}><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-xl font-black ${tone === 'rose' ? 'text-rose-700' : 'text-slate-900'}`}>{value}</p></CardContent></Card>;
}

function Breakdown({ title, rows, labelKey }) {
    return <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-5"><SectionTitle>{title}</SectionTitle><div className="mt-4 space-y-3">{rows.slice(0, 12).map((row) => <div key={row[labelKey]} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-mono text-slate-700">{row[labelKey]}</span><span className="shrink-0 font-bold text-slate-900">${Number(row.provider_cost || 0).toFixed(6)} <span className="font-normal text-slate-500">· {row.requests} req</span></span></div>)}{!rows.length && <Empty />}</div></CardContent></Card>;
}

function SectionTitle({ children }) {
    return <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">{children}</h2>;
}

function Field({ label, children }) {
    return <label className="space-y-1.5"><span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}

function Empty() {
    return <p className="py-4 text-sm text-slate-500">No AI usage records match these filters.</p>;
}
