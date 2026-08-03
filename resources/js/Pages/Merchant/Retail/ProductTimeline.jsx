import React, { useEffect, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/Card';
import { ArrowLeft, Clock3, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/lib/i18n';

export default function ProductTimeline({ merchant, productId }) {
    const { copy } = useLocale();
    const [loading, setLoading] = useState(true);
    const [payload, setPayload] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await window.axios.get(`/api/retail/products/${productId}/timeline`);
                setPayload(res.data?.data || null);
            } catch (err) {
                toast.error(err.response?.data?.message || copy('Failed to load product timeline.', 'Imeshindikana kupakia historia ya bidhaa.'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [productId]);

    const fmt = (val) => {
        if (!val) return '—';
        const d = new Date(val);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString();
    };

    return (
        <AppLayout>
            <Head title={`${copy('Product timeline', 'Historia ya bidhaa')} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-24">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => router.visit(`/merchant/${merchant.username}/retail/transfers`)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                {copy('Product movement timeline', 'Historia ya uhamishaji wa bidhaa')} <ArrowRightLeft className="h-6 w-6 text-brand-600" />
                            </h1>
                            <p className="text-sm text-muted-foreground">{payload?.product?.title || copy('Loading product...', 'Inapakia bidhaa...')}</p>
                        </div>
                    </div>
                </div>

                <Card className="rounded-2xl border-brand-100/60">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Clock3 className="h-4 w-4" /> {copy('Full ledger', 'Daftari kamili')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!loading && Array.isArray(payload?.flags) && payload.flags.length > 0 && (
                            <div className="space-y-2">
                                {payload.flags.map((f, idx) => (
                                    <div
                                        key={`${f.code}-${idx}`}
                                        className={`rounded-xl border p-3 ${
                                            f.severity === 'high'
                                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                                : 'bg-amber-50 border-amber-200 text-amber-800'
                                        }`}
                                    >
                                        <p className="text-xs font-black uppercase tracking-wider">
                                            {f.title} ({f.count})
                                        </p>
                                        <p className="text-xs mt-1">{f.detail}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {loading && <p className="text-sm text-muted-foreground">{copy('Loading timeline...', 'Inapakia historia...')}</p>}
                        {!loading && (!payload?.events || payload.events.length === 0) && (
                            <p className="text-sm text-muted-foreground">{copy('No movement history found for this product.', 'Hakuna historia ya uhamishaji iliyopatikana kwa bidhaa hii.')}</p>
                        )}
                        {!loading && payload?.events?.map((e, idx) => (
                            <div key={`${e.type}-${e.at}-${idx}`} className="rounded-xl border border-input p-3 bg-white">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-black uppercase tracking-wider text-brand-700">{e.type}</p>
                                    <p className="text-xs text-muted-foreground">{fmt(e.at)}</p>
                                </div>
                                <div className="mt-1 text-sm text-slate-700 space-y-1">
                                    <p><span className="font-bold">{copy('Note', 'Dokezo')}:</span> {e.note || '—'}</p>
                                    <p><span className="font-bold">{copy('Qty', 'Idadi')}:</span> {e.qty ?? '—'}</p>
                                    <p><span className="font-bold">{copy('From', 'Kutoka')}:</span> {e.from || '—'} <span className="font-bold">{copy('To', 'Kwenda')}:</span> {e.to || '—'}</p>
                                    <p><span className="font-bold">{copy('By', 'Na')}:</span> {e.actor || '—'}</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
