import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Volume2, VolumeX, Heart, MessageCircle, MapPin, Link as LinkIcon, Edit3, ShoppingBag } from 'lucide-react';
import { Button } from '@/Components/ui/Button';
import { Card, CardContent } from '@/Components/ui/Card';

const isVideo = (item) => {
    const url = typeof item === 'string' ? item : item?.url ?? '';
    return /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url) || item?.type?.startsWith?.('video');
};

const getUrl = (item) => typeof item === 'string' ? item : item?.url ?? item?.preview ?? '';

function VideoPlayer({ src }) {
    const ref = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);

    const toggle = () => {
        if (!ref.current) return;
        if (playing) { ref.current.pause(); setPlaying(false); }
        else { ref.current.play().then(() => setPlaying(true)).catch(() => { }); }
    };

    return (
        <div className="relative w-full flex items-center justify-center bg-black min-h-[50vh]" onClick={toggle}>
            <video
                ref={ref}
                src={src}
                className="w-full h-auto max-h-[90vh] object-contain"
                muted={muted}
                playsInline
                loop
            />
            {!playing && (
                <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                    <div className="h-16 w-16 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="h-8 w-8 text-white fill-white ml-1" />
                    </div>
                </motion.div>
            )}
            <button
                className="absolute bottom-4 right-4 h-9 w-9 rounded-full bg-black/60 flex items-center justify-center z-10"
                onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
            >
                {muted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
            </button>
        </div>
    );
}

/**
 * MediaLightbox — Facebook-style vertical scroll viewer.
 * All media items are stacked vertically. Scrolls to clicked item on open.
 */
export default function MediaLightbox({ post, items = [], startIndex = 0, isOpen, onClose }) {
    const scrollRef = useRef(null);
    const itemRefs = useRef([]);
    const [activeHotspot, setActiveHotspot] = useState(null);
    const [isLiked, setIsLiked] = useState(post?.is_liked || false);

    const hotspots = post?.hotspots || {};

    // Scroll to the selected image when opened
    useEffect(() => {
        if (isOpen && itemRefs.current[startIndex]) {
            // Small delay to ensure the modal is rendered
            setTimeout(() => {
                itemRefs.current[startIndex]?.scrollIntoView({ behavior: 'auto', block: 'start' });
            }, 10);
        }
    }, [isOpen, startIndex]);

    if (!items.length) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="lightbox"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col"
                >
                    {/* Top Bar - Sticky */}
                    <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md z-50 shrink-0">
                        <button
                            onClick={onClose}
                            className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center transition-colors hover:bg-white/20"
                        >
                            <X className="h-6 w-6 text-white" />
                        </button>
                        <div className="flex-1 text-center">
                            <span className="text-white text-sm font-bold uppercase tracking-widest">Picha & Video</span>
                        </div>
                        <div className="w-10" />
                    </div>

                    {/* Vertical Scroll Container */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto no-scrollbar space-y-2 py-4"
                    >
                        {items.map((item, i) => (
                            <div
                                key={i}
                                ref={el => itemRefs.current[i] = el}
                                className="w-full bg-zinc-900 flex flex-col"
                            >
                                {isVideo(item) ? (
                                    <VideoPlayer src={getUrl(item)} />
                                ) : (
                                    <div className="relative w-full max-w-[100vw] mx-auto overflow-hidden flex items-center justify-center bg-black min-h-[50vh]">
                                        <img
                                            src={getUrl(item)}
                                            alt=""
                                            className="w-full h-auto max-h-[90vh] object-contain block relative z-0"
                                            draggable={false}
                                        />

                                        {/* Hotpots overlay */}
                                        <div className="absolute inset-0 z-10 pointer-events-none">
                                            {(hotspots[i] || []).map((spot, idx) => (
                                                <div
                                                    key={idx}
                                                    className="absolute -translate-x-1/2 -translate-y-1/2 group/spot pointer-events-auto"
                                                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveHotspot(spot);
                                                    }}
                                                >
                                                    <div className="relative">
                                                        <div className="absolute inset-0 bg-white/40 rounded-full animate-ping" />
                                                        <div className="h-8 w-8 bg-black/80 backdrop-blur-md rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-brand-600 transition-colors">
                                                            {spot.type === 'product' && <MapPin className="h-4 w-4 text-white" />}
                                                            {spot.type === 'link' && <LinkIcon className="h-4 w-4 text-white" />}
                                                            {spot.type === 'text' && <Edit3 className="h-4 w-4 text-white" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Overlay Actions (Like/Chat) */}
                                        <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-4">
                                            <button
                                                onClick={() => setIsLiked(!isLiked)}
                                                className="h-12 w-12 rounded-full bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all active:scale-95"
                                            >
                                                <Heart className={`h-6 w-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Open chat interaction here
                                                    alert("Hii itafungua chat na " + (post?.merchant_profile?.display_name || "muuzaji") + " kuuliza kuhusu picha hii.");
                                                }}
                                                className="h-12 w-12 rounded-full bg-black/50 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-black/70 transition-all active:scale-95"
                                            >
                                                <MessageCircle className="h-6 w-6" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {/* Indicator for multi-media posts */}
                                {items.length > 1 && (
                                    <div className="py-2 text-center border-t border-white/5 bg-zinc-950">
                                        <span className="text-white/40 text-[10px] font-bold uppercase tracking-tighter">
                                            {i + 1} / {items.length}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Bottom Spacer */}
                        <div className="h-20 shrink-0" />
                    </div>

                    {/* Active Hotspot Preview Modal */}
                    <AnimatePresence>
                        {activeHotspot && (
                            <motion.div
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 50 }}
                                className="absolute bottom-4 left-4 right-4 z-[110]"
                            >
                                <Card className="bg-white shadow-2xl overflow-hidden border-0 relative">
                                    <button
                                        onClick={() => setActiveHotspot(null)}
                                        className="absolute top-2 right-2 h-8 w-8 bg-accent/50 hover:bg-accent rounded-full flex items-center justify-center"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                    <CardContent className="p-4 flex items-center gap-4">
                                        {activeHotspot.type === 'product' && (
                                            <>
                                                <div className="h-16 w-16 bg-muted rounded-xl flex items-center justify-center shrink-0">
                                                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate">{activeHotspot.product?.title || `Bidhaa #${activeHotspot.data}`}</p>
                                                    <Button
                                                        size="sm"
                                                        className="mt-2 w-full h-8 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                                                        onClick={() => {
                                                            if (activeHotspot.product?.has_access) {
                                                                if (activeHotspot.product.type === 'digital') {
                                                                    window.dispatchEvent(new CustomEvent('takeer:digital-ready', {
                                                                        detail: {
                                                                            itemId: activeHotspot.product.id,
                                                                            itemType: 'product',
                                                                            orderId: activeHotspot.product.latest_order_id,
                                                                            productTitle: activeHotspot.product.title,
                                                                        }
                                                                    }));
                                                                } else {
                                                                    window.location.href = `/product/${activeHotspot.product.slug || activeHotspot.product.id}`;
                                                                }
                                                            } else {
                                                                window.__openCheckout?.({
                                                                    id: activeHotspot.product?.id || activeHotspot.data,
                                                                    title: activeHotspot.product?.title || 'Product',
                                                                    price: activeHotspot.product?.price || 0,
                                                                    checkoutType: 'product'
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        {activeHotspot.product?.has_access ? 'Fungua' : 'Nunua Sasa'}
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                        {activeHotspot.type === 'link' && (
                                            <div className="flex-1 min-w-0 py-2">
                                                <div className="flex items-center gap-2 text-brand-600 font-bold mb-1">
                                                    <LinkIcon className="h-4 w-4" />
                                                    <span>Kiungo (Link)</span>
                                                </div>
                                                <a href={activeHotspot.data} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                                                    {activeHotspot.data}
                                                </a>
                                            </div>
                                        )}
                                        {activeHotspot.type === 'text' && (
                                            <div className="flex-1 min-w-0 py-2">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Edit3 className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-bold text-sm">Maelezo</span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {activeHotspot.data}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
