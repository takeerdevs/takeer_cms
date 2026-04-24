import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Image as ImageIcon, X, Send, Store, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { Input } from '@/Components/ui/Input';
import { Button } from '@/Components/ui/Button';
import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';

export default function SearchOverlay({ isOpen, onClose }) {
    const [query, setQuery] = useState('');
    const [state, setState] = useState('idle'); // 'idle', 'searching', 'results'
    const [results, setResults] = useState([]);
    const inputRef = useRef(null);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setState('idle');
            setResults([]);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Handle body scroll locking
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setState('searching');

        // Add user query to "results/chat" temporarily if we wanted a true chat look, 
        // but for now let's just show products.

        // Simulate API call for search
        setTimeout(() => {
            // TODO: implement real full-text query search API for products and merchants
            setResults([]);
            setState('results');
        }, 1200);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-2xl flex flex-col"
                >
                    {/* Top Bar / Close Button */}
                    <div className="flex justify-end p-4 shrink-0">
                        <button
                            onClick={onClose}
                            className="h-10 w-10 bg-accent/50 hover:bg-accent rounded-full flex items-center justify-center transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto px-4 relative overflow-hidden">

                        {/* Results / Feed Area */}
                        {state !== 'idle' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex-1 overflow-y-auto pb-24 pt-4 scrollbar-hide"
                            >
                                {/* Loading State */}
                                {state === 'searching' && (
                                    <div className="flex justify-center py-10">
                                        <div className="flex items-center gap-3 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                                            <span className="font-medium">Inatafuta...</span>
                                        </div>
                                    </div>
                                )}

                                {/* Results Grid */}
                                {state === 'results' && (
                                    <div className="flex flex-col items-center">
                                        <div className="w-full max-w-[95%]">

                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                                {results.map((product) => (
                                                    <div key={product.id} className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group">
                                                        <Link href={`/product/${product.id}`} className="relative aspect-[4/5] block overflow-hidden">
                                                            <img
                                                                src={product.images[0]}
                                                                alt={product.title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                        </Link>

                                                        <div className="p-3 sm:p-4 flex flex-col flex-1 bg-gradient-to-b from-background to-accent/20">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full overflow-hidden bg-brand-100 shrink-0 border border-border/50">
                                                                    {product.merchant.avatar_url ? (
                                                                        <img src={product.merchant.avatar_url} alt={product.merchant.display_name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-brand-700">
                                                                            {product.merchant.display_name.charAt(0)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <span className="text-[11px] sm:text-xs font-bold text-foreground truncate">
                                                                        {product.merchant.display_name}
                                                                    </span>
                                                                    <span className="text-[9px] font-black text-green-600 truncate mt-0.5">
                                                                        <span className="bg-green-50 border border-green-100 px-1.5 py-[1px] rounded flex items-center gap-0.5 w-max">
                                                                            <ShieldCheck className="h-2.5 w-2.5" />
                                                                            {Math.round((product.merchant.successful_sales / ((product.merchant.successful_sales + product.merchant.unsuccessful_sales) || 1)) * 100)}% Trust
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <Link href={`/product/${product.id}`} className="hover:text-brand-600 transition-colors mb-1">
                                                                <h3 className="font-semibold text-sm sm:text-[15px] line-clamp-2 leading-tight">
                                                                    {product.title}
                                                                </h3>
                                                            </Link>

                                                            <div className="mt-auto pt-3 flex flex-col gap-2.5">
                                                                <div className="flex flex-col gap-0.5">
                                                                    {product.compare_at_price && (
                                                                        <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground line-through decoration-muted-foreground/50">
                                                                            TZS {product.compare_at_price.toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                    <span className="font-black text-brand-600 text-[15px] sm:text-base leading-none">
                                                                        <span className="text-[10px] sm:text-xs font-bold mr-0.5 align-top">TZS</span>
                                                                        {product.price.toLocaleString()}
                                                                    </span>
                                                                </div>

                                                                <Button
                                                                    size="sm"
                                                                    className="w-full h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-brand-500/20 active:scale-[0.98] transition-all"
                                                                    disabled={!product.in_stock}
                                                                    onClick={() => window.__openCheckout?.(product)}
                                                                >
                                                                    Nunua Sasa
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Input Area (Idle is centered, Active is floating bottom) */}
                        <motion.div
                            layout
                            className={cn(
                                "w-full",
                                state === 'idle' ? "flex-1 flex flex-col justify-center pb-20" : "absolute bottom-6 left-0 right-0 px-4 bg-gradient-to-t from-background via-background/90 to-transparent pt-10"
                            )}
                        >
                            {state === 'idle' && (
                                <motion.div layoutId="search-header" className="text-center mb-8">
                                    <h2 className="text-3xl font-black text-foreground mb-2">Unatafuta nini?</h2>
                                    <p className="text-muted-foreground">Tafuta nguo, viatu, urembo, vitabu, huduma nk.</p>
                                </motion.div>
                            )}

                            <form onSubmit={handleSearch} className="relative max-w-lg mx-auto w-full group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Andika hapa..."
                                    className="w-full pl-12 pr-14 py-4 rounded-3xl bg-accent/60 border-transparent focus:bg-background focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 transition-all text-lg shadow-sm"
                                />
                                {query.trim() && (
                                    <button
                                        type="submit"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95"
                                    >
                                        <Send className="h-4 w-4 ml-0.5" />
                                    </button>
                                )}
                            </form>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
