import React, { useState, useEffect } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { Button } from '@/Components/ui/Button';
import { Input } from '@/Components/ui/Input';
import { Textarea } from '@/Components/ui/Textarea';
import { Card, CardContent } from '@/Components/ui/Card';
import { 
    ArrowLeft, Save, Trash2, Search, Plus, 
    GripVertical, Package, Box, ExternalLink, Sparkles 
} from 'lucide-react';

export default function PaymentPageEditor({ merchantUsername, pageData = null }) {
    const isEditing = !!pageData;
    const { data, setData, post, put, processing, errors } = useForm({
        title: pageData?.title || '',
        slug: pageData?.slug || '',
        description: pageData?.description || '',
        amount: pageData?.amount || '',
        currency: pageData?.currency || 'TZS',
        theme_color: pageData?.theme_color || '#059669',
        is_active: pageData?.is_active ?? true,
        items: pageData?.items?.map(i => ({
            id: i.item_id,
            type: i.item_type,
            title: i.item?.title || 'Unknown Item',
            sub: i.item?.type || 'bundle'
        })) || [],
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (searchTerm.length < 2) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await window.axios.get(`/merchant/${merchantUsername}/payment-pages/api/search?q=${searchTerm}`);
                setSearchResults(res.data.results);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const addItem = (item) => {
        if (data.items.find(i => i.id === item.id && i.type === item.type)) return;
        setData('items', [...data.items, item]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const removeItem = (index) => {
        const newItems = [...data.items];
        newItems.splice(index, 1);
        setData('items', newItems);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            put(`/merchant/${merchantUsername}/payment-pages/${pageData.id}`);
        } else {
            post(`/merchant/${merchantUsername}/payment-pages`);
        }
    };

    const colors = [
        '#059669', // Takeer Green
        '#2563eb', // Blue
        '#7c3aed', // Violet
        '#db2777', // Pink
        '#ea580c', // Orange
        '#111827', // Black
    ];

    return (
        <AppLayout>
            <Head title={isEditing ? 'Hariri Payment Page' : 'Tengeneza Payment Page'} />
            
            <form onSubmit={handleSubmit} className="max-w-5xl mx-auto p-4 md:p-8 pb-32">
                
                {/* Fixed Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => router.visit(`/merchant/${merchantUsername}/payment-pages`)}
                            className="rounded-xl h-10 w-10 shrink-0 bg-muted/50"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight">
                            {isEditing ? 'Hariri Page' : 'Page Mpya'}
                        </h1>
                    </div>
                    <Button 
                        type="submit" 
                        disabled={processing}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-black px-8 rounded-xl h-12 shadow-lg shadow-brand-600/20"
                    >
                        {processing ? 'Inahifadhi...' : (
                            <><Save className="mr-2 h-5 w-5" /> Hifadhi Page</>
                        )}
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">Jina la Kampeni (Title)</label>
                                    <Input 
                                        placeholder="Mf: Black Friday Offer 2026"
                                        className="h-12 text-lg font-bold"
                                        value={data.title}
                                        onChange={e => {
                                            setData('title', e.target.value);
                                            if (!isEditing) {
                                                setData('slug', e.target.value.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''));
                                            }
                                        }}
                                    />
                                    {errors.title && <p className="text-xs text-red-500 font-bold">{errors.title}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold">Custom Link Slug</label>
                                    <div className="flex items-center">
                                        <div className="h-12 px-4 bg-muted border border-r-0 rounded-l-xl flex items-center text-muted-foreground text-sm font-mono">
                                            takeer.me/pay/
                                        </div>
                                        <Input 
                                            placeholder="slug-yako"
                                            className="h-12 rounded-l-none font-mono text-brand-600 font-bold"
                                            value={data.slug}
                                            onChange={e => setData('slug', e.target.value)}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-medium italic">Hii ndio link utakayo-share kwa wateja wako.</p>
                                    {errors.slug && <p className="text-xs text-red-500 font-bold">{errors.slug}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold">Maelezo Mafupi (Optional)</label>
                                    <Textarea 
                                        placeholder="Andika ujumbe kwa wateja watakaofungua link hii..."
                                        className="min-h-[100px] resize-none"
                                        value={data.description}
                                        onChange={e => setData('description', e.target.value)}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Item Selector */}
                        <Card className="border-brand-100 bg-brand-50/10">
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-lg flex items-center gap-2">
                                        <Package className="h-5 w-5 text-brand-600" /> Bidhaa Kwenye Page
                                    </h3>
                                    <span className="text-[10px] font-bold bg-white border border-brand-200 px-2 py-0.5 rounded-full">
                                        {data.items.length} Zimeongezwa
                                    </span>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <Input 
                                        className="pl-10 h-12 bg-white"
                                        placeholder="Tafuta bidhaa au bundle..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    
                                    {/* Search Dropdown */}
                                    {searchResults.length > 0 && (
                                        <div className="absolute z-50 w-full mt-2 bg-white border border-border rounded-xl shadow-2xl overflow-hidden divide-y divide-border">
                                            {searchResults.map(result => (
                                                <button
                                                    key={`${result.type}-${result.id}`}
                                                    type="button"
                                                    className="w-full p-4 flex items-center justify-between hover:bg-brand-50 text-left transition-colors"
                                                    onClick={() => addItem(result)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-muted rounded-lg">
                                                            {result.type === 'App\\Models\\Product' ? <Box className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold">{result.title}</p>
                                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{result.sub}</p>
                                                        </div>
                                                    </div>
                                                    <Plus className="h-4 w-4 text-brand-600" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Added Items List */}
                                <div className="space-y-2">
                                    {data.items.length === 0 ? (
                                        <div className="py-12 border-2 border-dashed border-brand-100 rounded-xl flex flex-col items-center opacity-40">
                                            <Package className="h-8 w-8 mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-widest text-center">Hakuna bidhaa iliyochaguliwa</p>
                                        </div>
                                    ) : (
                                        data.items.map((item, index) => (
                                            <div key={index} className="bg-white border border-border p-3 rounded-xl flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing opacity-20 group-hover:opacity-100 transition-opacity" />
                                                    <div className="p-1.5 bg-muted rounded-md">
                                                        {item.type === 'App\\Models\\Product' ? <Box className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                                                    </div>
                                                    <span className="text-sm font-bold">{item.title}</span>
                                                </div>
                                                <Button 
                                                    type="button"
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg"
                                                    onClick={() => removeItem(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Settings */}
                    <div className="space-y-6">
                        <Card>
                            <CardContent className="p-6 space-y-6">
                                <h3 className="font-black text-lg">Muonekano (Theme)</h3>
                                
                                <div className="space-y-3">
                                    <label className="text-sm font-bold">Rangi ya Page</label>
                                    <div className="flex flex-wrap gap-3">
                                        {colors.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`h-10 w-10 rounded-full border-2 transition-all ${data.theme_color === color ? 'border-brand-600 scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setData('theme_color', color)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold">Page Is Active</span>
                                        <button 
                                            type="button"
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${data.is_active ? 'bg-brand-600' : 'bg-muted'}`}
                                            onClick={() => setData('is_active', !data.is_active)}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${data.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-0 shadow-xl shadow-indigo-600/20">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-indigo-200" />
                                    <h4 className="font-black">Campaign Pro Tip</h4>
                                </div>
                                <p className="text-sm text-indigo-100 leading-relaxed">
                                    Tumia link hii kwenye <strong>Bio yako ya Instagram</strong> au kwenye <strong>WhatsApp Status</strong>. Wateja wataweza kulipia bila kuhangaika.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
