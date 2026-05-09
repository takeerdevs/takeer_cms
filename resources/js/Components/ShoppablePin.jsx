import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ExternalLink, Info, X, ChevronRight } from 'lucide-react';

export default function ShoppablePin({ tag, onProductTap, merchant }) {
    const [isOpen, setIsOpen] = useState(false);

    // tag.x and tag.y are floats representing percentages (e.g. 50 = 50% left)
    const leftPercent = `${tag.x}%`;
    const topPercent = `${tag.y}%`;

    const handlePinClick = (e) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    };

    const linkDomain = (() => {
        if (tag.type !== 'link' || !tag.data) return '';

        try {
            const url = new URL(tag.data);
            return url.hostname.replace(/^www\./, '');
        } catch {
            return String(tag.data).replace(/^https?:\/\//, '').split('/')[0];
        }
    })();

    const renderPopoverContent = () => {
        if (tag.type === 'product' && tag.product) {
            const p = tag.product;
            return (
                <div className="flex flex-col w-56 bg-white rounded-2xl overflow-hidden shadow-2xl border border-black/5 ring-1 ring-black/5">
                    <div className="flex p-3 gap-3">
                        <div className="h-14 w-14 bg-accent overflow-hidden shrink-0 border border-black/5">
                            <img src={p.image_url || '/placeholder.png'} className="w-full h-full object-cover" alt={p.title} />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className="text-[11px] font-black leading-tight text-foreground truncate uppercase tracking-tight">{p.title}</h4>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs font-black text-brand-600">TZS {Number(p.price).toLocaleString()}</span>
                                {p.compare_at_price > p.price && (
                                    <span className="text-[9px] text-muted-foreground line-through opacity-60">TZS {Number(p.compare_at_price).toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (p.type === 'digital' && p.has_access) {
                                window.dispatchEvent(new CustomEvent('takeer:digital-ready', {
                                    detail: {
                                        itemId: p.id,
                                        itemType: 'product',
                                        orderId: p.latest_order_id,
                                        productTitle: p.title,
                                    }
                                }));
                            } else {
                                onProductTap(p);
                            }
                        }}
                        className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                    >
                        <ShoppingBag className="h-3 w-3" />
                        {p.has_access ? 'Fungua Sasa' : 'Nunua Sasa'}
                    </button>

                    <div className="px-3 py-1.5 bg-accent/30 border-t border-black/5 flex items-center justify-between">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">@{merchant?.name || 'muuzaji'}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-30" />
                    </div>
                </div>
            );
        }

        if (tag.type === 'link') {
            return (
                <div className="w-56 bg-white rounded-2xl p-3 shadow-2xl border border-black/5 ring-1 ring-black/5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                            <ExternalLink className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-black text-foreground truncate">{linkDomain || 'Fungua kiungo'}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 leading-relaxed">
                        {tag.data}
                    </p>
                    <a
                        href={tag.data}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-colors mt-1"
                    >
                        Fungua
                    </a>
                </div>
            );
        }

        if (tag.type === 'text') {
            return (
                <div className="w-64 rounded-2xl bg-white p-4 shadow-2xl border border-black/5 ring-1 ring-black/5">
                    <p className="text-xs font-medium leading-relaxed text-foreground/80">
                        {tag.data}
                    </p>
                </div>
            );
        }

        return null;
    };

    return (
        <div
            className="absolute z-20 group"
            style={{ left: leftPercent, top: topPercent, transform: 'translate(-50%, -50%)' }}
        >
            {/* The interactive dot/pin */}
            <motion.button
                onClick={handlePinClick}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
                className={`relative flex items-center justify-center h-8 w-8 rounded-full shadow-[0_10px_28px_rgba(2,132,199,0.35),0_0_0_1px_rgba(15,23,42,0.18)] transition-all duration-300 ${isOpen ? 'bg-brand-700 text-white scale-110 z-40' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                aria-label={`Hotspot ${tag.type}`}
            >
                {/* Ripple Effect Background - only when closed */}
                {!isOpen && <span className="absolute inline-flex h-full w-full rounded-full bg-white/50 opacity-75 animate-hotspot-ping" />}

                {isOpen ? <X className="h-4 w-4 relative z-50" /> : (
                    <>
                        {tag.type === 'product' && <ShoppingBag className="h-4 w-4 relative z-10" />}
                        {tag.type === 'link' && <ExternalLink className="h-4 w-4 relative z-10" />}
                        {tag.type === 'text' && <Info className="h-4 w-4 relative z-10" />}
                    </>
                )}
            </motion.button>

            {/* Rich Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: -15, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {renderPopoverContent()}

                        {/* Triangle Pointer */}
                        <div className="absolute top-[99%] left-1/2 -translate-x-1/2 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-white drop-shadow-sm" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Simple label for preview if closed (optional/on hover) */}
            {!isOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-3 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded shadow-sm">
                    {tag.type === 'product' ? (tag.product?.title || 'Bidhaa') : tag.type}
                </div>
            )}
        </div>
    );
}
