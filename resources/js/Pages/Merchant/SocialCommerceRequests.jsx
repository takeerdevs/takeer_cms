import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { ArrowRight, BarChart3, Globe2, Inbox, Loader2, RefreshCw, Store } from 'lucide-react';

export default function SocialCommerceRequests() {
    const { copy } = useLocale();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [allSourceSummary, setAllSourceSummary] = useState([]);

    async function loadRequests() {
        setLoading(true);
        setError('');
        try {
            const { data } = await axios.get('/api/merchant/social-commerce/requests', { params: { page } });
            setItems(data.data || []);
            setMeta(data.meta || { current_page: page, last_page: 1, total: (data.data || []).length });
            setAllSourceSummary(data.source_summary || []);
        } catch (exception) {
            setError(exception.response?.data?.message || copy('Unable to load social-commerce requests.', 'Imeshindikana kupakia maombi ya social commerce.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadRequests();
    }, [page]);

    const pageSourceSummary = useMemo(() => Object.entries(items.reduce((summary, item) => {
        const label = item.source?.label || item.platform || copy('Unknown source', 'Chanzo hakijulikani');
        summary[label] = (summary[label] || 0) + 1;
        return summary;
    }, {})).sort((left, right) => right[1] - left[1]), [items, copy]);

    return (
        <AppLayout>
            <Head title={`${copy('Online buyer requests', 'Maombi ya wanunuzi mtandaoni')} | Takeer`} />
            <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 sm:pt-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">{copy('Business tools', 'Zana za biashara')}</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl"><Store className="h-6 w-6 text-brand-600" />{copy('Online buyer requests', 'Maombi ya wanunuzi mtandaoni')}</h1><p className="mt-2 text-sm text-muted-foreground">{copy('Track secure buyer requests and see which platforms or websites generated customer traffic.', 'Fuatilia maombi salama ya wanunuzi na uone platform au tovuti zilizoleta wateja.')}</p></div>
                    <Button variant="outline" onClick={loadRequests} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{copy('Refresh', 'Refresh')}</Button>
                </div>
                {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                {!loading && items.length > 0 && <section className="space-y-3"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-brand-600" /><h2 className="text-sm font-black">{copy('Customer traffic sources', 'Vyanzo vya wateja')}</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(allSourceSummary.length ? allSourceSummary.map((source) => [source.label, source.count]) : pageSourceSummary).map(([label, count]) => <div key={label} className="rounded-2xl border border-border/70 bg-card px-4 py-4"><div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Globe2 className="h-4 w-4 text-brand-600" />{label}</div><p className="mt-2 text-2xl font-black">{count}</p><p className="text-[11px] font-semibold text-muted-foreground">{copy('buyer requests', 'maombi ya wanunuzi')}</p></div>)}</div></section>}
                {loading ? <Card><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></CardContent></Card> : items.length === 0 ? <Card><CardContent className="flex flex-col items-center justify-center p-10 text-center"><Inbox className="h-10 w-10 text-muted-foreground" /><p className="mt-4 font-black">{copy('No online buyer requests yet', 'Bado hakuna maombi ya wanunuzi mtandaoni')}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{copy('When a customer sends a secure request from an online listing, it will appear here.', 'Mteja akituma ombi salama kutoka tangazo la mtandaoni, litaonekana hapa.')}</p></CardContent></Card> : <div className="grid gap-3">{items.map((item) => <Link key={item.public_id} href={`/merchant/social-commerce/requests/${item.public_id}`} className="group"><Card className="transition hover:border-brand-300 hover:shadow-md"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">{formatStatus(item.status)}</span><span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Globe2 className="h-3.5 w-3.5" />{item.source?.label || item.platform}</span></div><p className="mt-2 truncate font-black">{item.buyer_notes?.product || item.preview?.snapshot?.title || item.public_id}</p><p className="mt-1 text-sm text-muted-foreground">{item.destination?.summary || copy('Destination pending', 'Destination inasubiri')} · {copy('Quantity', 'Kiasi')} {item.buyer_notes?.quantity || 1}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-brand-600" /></CardContent></Card></Link>)}</div>}
                {meta.last_page > 1 && <div className="flex items-center justify-between gap-3"><Button variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>{copy('Previous', 'Iliyopita')}</Button><p className="text-sm font-semibold text-muted-foreground">{copy('Page', 'Ukurasa')} {meta.current_page} / {meta.last_page}</p><Button variant="outline" onClick={() => setPage((value) => Math.min(meta.last_page, value + 1))} disabled={page >= meta.last_page || loading}>{copy('Next', 'Inayofuata')}</Button></div>}
            </div>
        </AppLayout>
    );
}

function formatStatus(status) {
    return String(status || '').replaceAll('_', ' ');
}
