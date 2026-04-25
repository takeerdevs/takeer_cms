import React from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent } from '@/Components/ui/Card';
import { Plus, Link as LinkIcon, Edit, Trash2, ExternalLink, MousePointerClick, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function PaymentPagesIndex({ merchantUsername, pages }) {
    const [copiedId, setCopiedId] = useState(null);

    const copyLink = (slug, id) => {
        const url = `${window.location.origin}/pay/${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <AppLayout>
            <Head title="Payment Pages | Takeer Commerce Pro" />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            Payment Pages <span className="text-[10px] bg-brand-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">PRO</span>
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Tengeneza link maalum za malipo kwa ajili ya kampeni zako za Instagram au WhatsApp.
                        </p>
                    </div>
                    <Button 
                        onClick={() => router.visit(`/merchant/${merchantUsername}/payment-pages/create`)}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-brand-600/20"
                    >
                        <Plus className="mr-2 h-5 w-5" /> Tengeneza Page Mpya
                    </Button>
                </div>

                {/* Grid */}
                {pages.length === 0 ? (
                    <Card className="border-dashed border-2 bg-muted/20">
                        <CardContent className="p-12 text-center flex flex-col items-center">
                            <div className="h-20 w-20 bg-muted rounded-3xl flex items-center justify-center mb-6">
                                <LinkIcon className="h-10 w-10 text-muted-foreground opacity-30" />
                            </div>
                            <h3 className="font-bold text-xl">Bado huna Payment Page</h3>
                            <p className="text-muted-foreground text-sm mt-2 max-w-sm">
                                Payment pages zinakusaidia kuuza bidhaa moja kwa moja kupitia link bila mteja kupotelea kwenye store nzima.
                            </p>
                            <Button 
                                variant="outline" 
                                className="mt-6 border-brand-200 text-brand-700 font-bold"
                                onClick={() => router.visit(`/merchant/${merchantUsername}/payment-pages/create`)}
                            >
                                Anza Sasa
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {pages.map((page) => (
                            <Card key={page.id} className="group hover:border-brand-300 transition-all hover:shadow-xl hover:shadow-brand-600/5 overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-black text-lg group-hover:text-brand-600 transition-colors">{page.title}</h3>
                                                <p className="text-xs text-muted-foreground font-mono mt-1">/pay/{page.slug}</p>
                                            </div>
                                            <div className={`h-2.5 w-2.5 rounded-full ${page.is_active ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-muted/30">
                                            <div className="text-center">
                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Views</p>
                                                <p className="font-black text-slate-900">{page.views_count || 0}</p>
                                            </div>
                                            <div className="text-center border-x border-muted/30">
                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Conv %</p>
                                                <p className="font-black text-slate-900">
                                                    {page.views_count > 0 ? ((page.orders_count / page.views_count) * 100).toFixed(1) : '0.0'}%
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Revenue</p>
                                                <p className="font-black text-green-600">
                                                    {new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(page.revenue || 0).replace('TZS', '')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <MousePointerClick className="h-3.5 w-3.5" />
                                                {page.items_count} Items
                                            </div>
                                            <div className="flex items-center gap-1.5 text-green-600">
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                {page.orders_count} Sales
                                            </div>
                                        </div>

                                        <div className="pt-2 flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                className="flex-1 font-bold h-10 text-xs border-muted group-hover:border-brand-200"
                                                onClick={() => copyLink(page.slug, page.id)}
                                            >
                                                {copiedId === page.id ? (
                                                    <><Check className="mr-1.5 h-3.5 w-3.5 text-green-600" /> Copied!</>
                                                ) : (
                                                    <><Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Link</>
                                                )}
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-10 w-10 shrink-0 border-muted group-hover:border-brand-200"
                                                onClick={() => window.open(`/pay/${page.slug}`, '_blank')}
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-10 w-10 shrink-0 border-muted group-hover:border-brand-200"
                                                onClick={() => router.visit(`/merchant/${merchantUsername}/payment-pages/${page.id}/edit`)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div 
                                        className="h-1.5 w-full" 
                                        style={{ backgroundColor: page.theme_color || '#059669' }}
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
