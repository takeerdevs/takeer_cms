import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import { useLocale } from '@/lib/i18n';
import { ArrowRight, Inbox, Loader2, RefreshCw, Store } from 'lucide-react';

export default function SocialCommerceRequests() {
    const { copy } = useLocale();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    async function loadRequests() {
        setLoading(true);
        setError('');
        try {
            const { data } = await axios.get('/api/merchant/social-commerce/requests');
            setItems(data.data || []);
        } catch (exception) {
            setError(exception.response?.data?.message || copy('Unable to load social-commerce requests.', 'Imeshindikana kupakia maombi ya social commerce.'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadRequests();
    }, []);

    return (
        <AppLayout>
            <Head title={`${copy('Social-commerce requests', 'Maombi ya social commerce')} | Takeer`} />
            <div className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6 sm:pt-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">{copy('Business tools', 'Zana za biashara')}</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl"><Store className="h-6 w-6 text-brand-600" />{copy('Social-commerce requests', 'Maombi ya social commerce')}</h1><p className="mt-2 text-sm text-muted-foreground">{copy('Turn customer requests from social media into seller-confirmed Takeer offers.', 'Badilisha maombi ya wateja kutoka mitandao ya kijamii kuwa offer zilizothibitishwa na Muuzaji ndani ya Takeer.')}</p></div>
                    <Button variant="outline" onClick={loadRequests} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{copy('Refresh', 'Refresh')}</Button>
                </div>
                {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                {loading ? <Card><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></CardContent></Card> : items.length === 0 ? <Card><CardContent className="flex flex-col items-center justify-center p-10 text-center"><Inbox className="h-10 w-10 text-muted-foreground" /><p className="mt-4 font-black">{copy('No social-commerce requests yet', 'Bado hakuna maombi')}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{copy('When a customer asks for an item from social media, the request will appear here.', 'Mteja akiomba bidhaa kutoka mitandao ya kijamii, ombi litaonekana hapa.')}</p></CardContent></Card> : <div className="grid gap-3">{items.map((item) => <Link key={item.public_id} href={`/merchant/social-commerce/requests/${item.public_id}`} className="group"><Card className="transition hover:border-brand-300 hover:shadow-md"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-700">{formatStatus(item.status)}</span><span className="text-xs font-semibold text-muted-foreground">{item.platform}</span></div><p className="mt-2 truncate font-black">{item.buyer_notes?.product || item.preview?.snapshot?.title || item.public_id}</p><p className="mt-1 text-sm text-muted-foreground">{item.destination?.summary || copy('Destination pending', 'Destination inasubiri')} · {copy('Quantity', 'Kiasi')} {item.buyer_notes?.quantity || 1}</p></div><ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-brand-600" /></CardContent></Card></Link>)}</div>}
            </div>
        </AppLayout>
    );
}

function formatStatus(status) {
    return String(status || '').replaceAll('_', ' ');
}
