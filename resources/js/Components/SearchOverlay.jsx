import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Send, Loader2 } from 'lucide-react';
import { router } from '@inertiajs/react';
import { cn } from '@/lib/utils';

export default function SearchOverlay({ isOpen, onClose }) {
    const [query, setQuery] = useState('');
    const [state, setState] = useState('idle'); // 'idle', 'searching'
    const inputRef = useRef(null);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setState('idle');
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
        onClose?.();
        router.get('/search', { q: query.trim(), page: 1 });
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
