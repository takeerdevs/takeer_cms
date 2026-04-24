import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/Card';
import { Button } from '@/Components/ui/Button';
import {
    Package, Plus, Search, Loader2,
    CheckCircle2, Clock, Archive, ShoppingBag,
    Image as ImageIcon, FileText, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import axios from 'axios';

export default function MerchantProducts({ merchantUsername, redirectToStudio = false, typeScope = 'all' }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, published, draft, archived
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const normalizedTypeScope = ['physical', 'digital', 'service'].includes(typeScope) ? typeScope : 'all';

    useEffect(() => {
        if (redirectToStudio) {
            router.visit(`/merchant/${merchantUsername}/content?tab=products`);
            return;
        }
        fetchProducts();
    }, [filter, page, redirectToStudio, merchantUsername, normalizedTypeScope]);

    useEffect(() => {
        setPage(1);
    }, [filter, normalizedTypeScope]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') params.set('status', filter);
            if (normalizedTypeScope !== 'all') params.set('type', normalizedTypeScope);
            params.set('page', String(page));
            const response = await axios.get(`/merchant/products/api${params.toString() ? `?${params.toString()}` : ''}`);
            setProducts(response.data.data || []);
            setMeta(response.data.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
        }
    };

    const statusBadge = (status) => {
        switch (status) {
            case 'published':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full"><CheckCircle2 className="h-3 w-3" /> IMEWEKWA</span>;
            case 'draft':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full"><Clock className="h-3 w-3" /> RASIMU</span>;
            case 'archived':
                return <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 px-2 py-0.5 rounded-full"><Archive className="h-3 w-3" /> IMEZUIWA</span>;
            default:
                return null;
        }
    };

    const typeIcon = (type) => {
        switch (type) {
            case 'physical': return <ImageIcon className="h-3.5 w-3.5" />;
            case 'digital': return <FileText className="h-3.5 w-3.5" />;
            case 'service': return <Calendar className="h-3.5 w-3.5" />;
            default: return <Package className="h-3.5 w-3.5" />;
        }
    };
    const facetValue = (entry) => {
        if (entry?.value_text !== null && entry?.value_text !== undefined && entry?.value_text !== '') return entry.value_text;
        if (entry?.value_number !== null && entry?.value_number !== undefined && entry?.value_number !== '') {
            const unit = entry?.value_json && typeof entry.value_json === 'object' ? entry.value_json.unit : null;
            return unit ? `${entry.value_number} ${unit}` : entry.value_number;
        }
        if (entry?.value_boolean !== null && entry?.value_boolean !== undefined) return entry.value_boolean ? 'Yes' : 'No';
        if (Array.isArray(entry?.value_json)) return entry.value_json.join(', ');
        if (entry?.value_json && typeof entry.value_json === 'object' && entry.value_json.unit) return `Unit: ${entry.value_json.unit}`;
        return '-';
    };

    const filteredProducts = products.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pageMeta = (() => {
        if (normalizedTypeScope === 'digital') {
            return {
                title: 'Digital Downloads',
                subtitle: 'Simamia faili za kidigitali na link za kupakua.',
                createLabel: 'Ongeza Download',
                createType: 'digital',
                icon: FileText,
            };
        }
        if (normalizedTypeScope === 'service') {
            return {
                title: 'Services & Bookings',
                subtitle: 'Simamia huduma, namba za mawasiliano, na booking links.',
                createLabel: 'Ongeza Service',
                createType: 'service',
                icon: Calendar,
            };
        }
        if (normalizedTypeScope === 'physical') {
            return {
                title: 'Physical Products',
                subtitle: 'Simamia bidhaa za stoo na mauzo ya usafirishaji.',
                createLabel: 'Ongeza Product',
                createType: 'physical',
                icon: ShoppingBag,
            };
        }
        return {
            title: 'Bidhaa Zangu',
            subtitle: 'Simamia hesabu na maelezo ya bidhaa zako zote.',
            createLabel: 'Ongeza Bidhaa',
            createType: null,
            icon: Package,
        };
    })();

    return (
        <AppLayout>
            <Head title={`${pageMeta.title} | Takeer`} />
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 space-y-6">
                {redirectToStudio && (
                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        <p className="text-sm font-medium">Tunakupeleka Commerce Studio...</p>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">{pageMeta.title}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {pageMeta.subtitle}
                        </p>
                    </div>
                    <Button
                        onClick={() => router.visit(`/merchant/${merchantUsername}/upload${pageMeta.createType ? `?type=${pageMeta.createType}` : ''}`)}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl h-12 px-6 shadow-lg shadow-brand-600/20"
                    >
                        <Plus className="mr-2 h-5 w-5" /> {pageMeta.createLabel}
                    </Button>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex bg-muted/50 p-1 rounded-xl w-fit">
                        {['all', 'published', 'draft'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === f
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {f === 'all' ? 'Zote' : f === 'published' ? 'Zilizopo' : 'Rasimu'}
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Tafuta bidhaa..."
                            className="w-full pl-10 pr-4 h-11 bg-muted/30 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Product List */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        <p className="text-sm font-medium">Inapakia bidhaa...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-20 text-center bg-card/40 rounded-3xl border border-dashed border-border flex flex-col items-center">
                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold">Hakuna {pageMeta.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                            Hujampandisha bidhaa yoyote bado au utafutaji wako hauna matokeo.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredProducts.map((product) => (
                            <Card
                                key={product.id}
                                className="overflow-hidden border-border/60 hover:border-brand-500/40 transition-colors group cursor-pointer"
                                role="button"
                                tabIndex={0}
                                onClick={() => router.visit(`/merchant/${merchantUsername}/products/${product.id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        router.visit(`/merchant/${merchantUsername}/products/${product.id}`);
                                    }
                                }}
                            >
                                <CardContent className="p-3 space-y-3">
                                    {/* Thumbnail */}
                                    <div className="aspect-[4/3] rounded-xl bg-muted overflow-hidden shrink-0 border border-border/10">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                className="h-full w-full object-cover transition-transform group-hover:scale-110"
                                                alt={product.title}
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center">
                                                <Package className="h-6 w-6 text-muted-foreground/30" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                            {statusBadge(product.status)}
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                {typeIcon(product.type)} {product.type}
                                            </span>
                                        </div>
                                        <p className="font-bold text-sm line-clamp-2 text-left hover:text-brand-700">
                                            {product.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                            <span className="font-black text-foreground">TZS {parseFloat(product.price).toLocaleString()}</span>
                                            {product.type === 'physical' && (
                                                <span className="flex items-center gap-1">
                                                    <Package className="h-3 w-3" /> {product.inventory_count} kwenye stoo
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {!!product?.attributes?.category && (
                                                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                    {product.attributes.category}
                                                </span>
                                            )}
                                            {!!product?.attributes?.sub_category && (
                                                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700">
                                                    {product.attributes.sub_category}
                                                </span>
                                            )}
                                            {(product.category_attribute_values || [])
                                                .slice(0, 2)
                                                .map((entry) => {
                                                    const label = entry?.attribute?.label || entry?.attribute?.key || 'Facet';
                                                    const value = facetValue(entry);
                                                    return (
                                                        <span key={`${product.id}-${entry.category_attribute_id}`} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700">
                                                            {label}: {String(value)}
                                                        </span>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {meta.last_page > 1 && (
                        <div className="flex items-center justify-center gap-3 pt-1">
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={meta.current_page <= 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {meta.current_page} / {meta.last_page}
                            </span>
                            <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => setPage((prev) => Math.min(meta.last_page, prev + 1))}
                                disabled={meta.current_page >= meta.last_page}
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    )}
                    <p className="text-center text-xs text-muted-foreground">
                        Inaonyesha page {meta.current_page} ya {meta.last_page} · jumla {meta.total} bidhaa
                    </p>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
