import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageCircle, Share2, ShoppingBag, Music, Play, Volume2, VolumeX, DownloadCloud, CalendarClock, Loader2 } from 'lucide-react';
import ShoppablePin from './ShoppablePin';
import { motion, AnimatePresence } from 'framer-motion';
import ShareModal from './ShareModal';
import { resolvePlayableVideoUrl } from './VideoPlayer';
import { toast } from 'sonner';
import axios from 'axios';

// ── Text size based on character count ──────────────────────────────────────
function getTextStyle(text = '') {
    const len = text.length;
    if (len <= 50) return 'text-5xl font-black leading-tight';
    if (len <= 100) return 'text-3xl font-black leading-snug';
    if (len <= 180) return 'text-2xl font-bold leading-snug';
    if (len <= 280) return 'text-xl font-semibold leading-normal';
    return 'text-base font-medium leading-relaxed overflow-y-auto';
}

const isProcessingVideoMedia = (item) => Boolean(
    item
    && typeof item !== 'string'
    && ['pending', 'processing'].includes(item.processing_status)
    && !item.processed_url
    && !item.hls_url
);

const VIDEO_EXTENSION_RE = /\.(mp4|m4v|mov|webm|ogg)(\?|#|$)/i;

const mediaKind = (item) => {
    if (!item) return 'image';
    if (typeof item === 'string') return VIDEO_EXTENSION_RE.test(item) ? 'video' : 'image';

    const declaredType = String(item.media_type || item.type || '').toLowerCase();
    const mime = String(item.mime || item.mime_type || '').toLowerCase();

    if (declaredType.startsWith('video') || mime.startsWith('video/')) return 'video';
    if (declaredType.startsWith('image') || mime.startsWith('image/')) return 'image';
    if (item.hls_url || item.processed_url) return 'video';

    return VIDEO_EXTENSION_RE.test(String(item.url || item.preview || '')) ? 'video' : 'image';
};

function ProcessingVideoLayer() {
    return (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Loader2 className="h-9 w-9 text-white/70 animate-spin" />
            <div>
                <p className="text-base font-semibold text-white">Processing video...</p>
                <p className="mt-1 text-sm text-white/55">Playback will be ready shortly.</p>
            </div>
        </div>
    );
}

// ── Default background presets ───────────────────────────────────────────────
const TEXT_BACKGROUNDS = {
    gradient_sunset: 'linear-gradient(135deg, #f97316, #ec4899)',
    gradient_ocean: 'linear-gradient(135deg, #06b6d4, #6366f1)',
    gradient_forest: 'linear-gradient(135deg, #22c55e, #14b8a6)',
    gradient_midnight: 'linear-gradient(135deg, #1e1b4b, #4c1d95)',
    solid_black: '#000000',
    solid_white: '#ffffff',
    solid_brand: '#0284c7',
};

const QUICK_REACTIONS = ['👍', '❤️', '🔥'];

// ── Floating heart particle after double-tap ─────────────────────────────────
function FloatingHeart({ x, y, id, onDone }) {
    return (
        <motion.div
            key={id}
            className="absolute pointer-events-none z-50 text-red-500 text-4xl select-none"
            style={{ left: x - 20, top: y - 20 }}
            initial={{ scale: 0, opacity: 1, y: 0 }}
            animate={{ scale: [0, 1.5, 1.2], opacity: [1, 1, 0], y: -120 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            onAnimationComplete={onDone}
        >
            ❤️
        </motion.div>
    );
}

// ── Generic action button (comment, share, product) ──────────────────────────
function ActionBtn({ icon: Icon, label, onClick, iconClass = '' }) {
    return (
        <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={onClick}
            className="flex flex-col items-center gap-1"
        >
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black/25 backdrop-blur-lg border border-white/15 active:bg-white/20 transition-colors">
                <Icon className={`h-7 w-7 text-white drop-shadow-lg ${iconClass}`} strokeWidth={1.5} />
            </div>
            {label && <span className="text-xs text-white font-bold drop-shadow-md">{label}</span>}
        </motion.button>
    );
}

function ReactionBtn({ emoji, count, active, disabled, onClick }) {
    return (
        <motion.button
            whileTap={{ scale: 0.82 }}
            onClick={onClick}
            disabled={disabled}
            className="flex flex-col items-center gap-1 disabled:opacity-60"
        >
            <div className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-lg border text-2xl transition-colors ${active ? 'bg-white text-slate-950 border-white' : 'bg-black/25 border-white/15'}`}>
                {emoji}
            </div>
            <span className="text-xs text-white font-bold drop-shadow-md tabular-nums">
                {count > 0 ? formatCompactCount(count) : ''}
            </span>
        </motion.button>
    );
}

function formatCompactCount(value) {
    const count = Number(value || 0);
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count ? String(count) : '';
}

// ── Text background post ──────────────────────────────────────────────────────
function TextPostLayer({ post }) {
    const bg = TEXT_BACKGROUNDS[post.bg_style] || TEXT_BACKGROUNDS.gradient_ocean;
    const isLight = post.bg_style === 'solid_white';
    const textClass = getTextStyle(post.caption || '');

    return (
        <div
            className="absolute inset-0 flex items-center justify-center p-10"
            style={{ background: bg }}
        >
            <p className={`${textClass} text-center ${isLight ? 'text-gray-900' : 'text-white'} drop-shadow-sm select-none max-h-[70%]`}>
                {post.caption}
            </p>
        </div>
    );
}

// ── Image carousel ────────────────────────────────────────────────────────────
function ImageLayer({ post, currentIdx, setIdx }) {
    const images = post.media?.length
        ? post.media
        : post.images?.length
            ? post.images
            : post.media_url ? [{ url: post.media_url, type: post.media_type || 'image' }] : [];
    const current = images[currentIdx];
    const currentUrl = typeof current === 'string'
        ? current
        : resolvePlayableVideoUrl({ hlsUrl: current?.hls_url, processedUrl: current?.processed_url, url: current?.url });
    const currentType = mediaKind(current);
    const processing = currentType === 'video' && isProcessingVideoMedia(current);
    const startX = useRef(null);
    const [mediaLoaded, setMediaLoaded] = useState(false);

    useEffect(() => {
        setMediaLoaded(false);
    }, [currentIdx, currentUrl, currentType]);

    const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) setIdx(i => Math.min(i + 1, images.length - 1));
        else setIdx(i => Math.max(i - 1, 0));
        startX.current = null;
    };

    return (
        <div className="absolute inset-0" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <AnimatePresence initial={false} mode="wait">
                {currentType === 'video' && processing ? (
                    <ProcessingVideoLayer />
                ) : currentType === 'video' ? (
                    <motion.video
                        key={currentIdx}
                        src={currentUrl}
                        poster={typeof current === 'string' ? undefined : current?.thumbnail_url || undefined}
                        className="w-full h-full object-cover bg-black"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        initial={{ opacity: 0.6, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.22 }}
                        onLoadedData={() => setMediaLoaded(true)}
                        onCanPlay={() => setMediaLoaded(true)}
                    />
                ) : (
                    <motion.img
                        key={currentIdx}
                        src={currentUrl}
                        alt="Post"
                        className="w-full h-full object-cover"
                        initial={{ opacity: 0.6, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.22 }}
                        onLoad={() => setMediaLoaded(true)}
                        onError={() => setMediaLoaded(true)}
                    />
                )}
            </AnimatePresence>
            {currentType === 'video' && !processing && !mediaLoaded && (
                <div className="absolute inset-0 z-20 bg-zinc-900 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                </div>
            )}
            {/* Dot indicator */}
            {images.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {images.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main PostItem ─────────────────────────────────────────────────────────────
export default function PostItem({ post, isActive, onProductTap, onComment }) {
    const videoRef = useRef(null);
    const [livePost, setLivePost] = useState(post);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [floatHearts, setFloatHearts] = useState([]);
    const lastTap = useRef(0);
    const tapTimer = useRef(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [myReaction, setMyReaction] = useState(post.my_reaction || null);
    const [reactionSyncing, setReactionSyncing] = useState(false);
    const [videoReady, setVideoReady] = useState(false);

    useEffect(() => {
        setLivePost(post);
        setMyReaction(post.my_reaction || null);
    }, [post]);

    useEffect(() => {
        if (!window.Echo || !post?.id) return;

        const channel = window.Echo.channel('posts');
        const listener = (event) => {
            if (String(event.post_id) !== String(post.id)) return;

            setLivePost((current) => ({
                ...current,
                comment_count: event.comment_count ?? current.comment_count,
                reaction_summary: Array.isArray(event.reaction_summary) ? event.reaction_summary : current.reaction_summary,
            }));
        };

        channel.listen('.post.engagement.updated', listener);

        return () => {
            channel.stopListening('.post.engagement.updated', listener);
        };
    }, [post?.id]);

    useEffect(() => {
        setVideoReady(false);
    }, [livePost.media_type, livePost.media_url, livePost.media, livePost.images]);

    // Auto-play video
    useEffect(() => {
        if (!videoRef.current) return;
        if (isActive) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => { });
            videoRef.current.currentTime = 0;
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    }, [isActive]);

    const togglePlay = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) { videoRef.current.pause(); setIsPlaying(false); }
        else { videoRef.current.play(); setIsPlaying(true); }
    }, [isPlaying]);

    // Double-tap detection for floating heart
    const handleTap = useCallback((e) => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
            // Double tap!
            clearTimeout(tapTimer.current);
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.touches?.[0]?.clientX ?? e.clientX;
            const y = e.touches?.[0]?.clientY ?? e.clientY;
            const id = now;
            setFloatHearts(h => [...h, { x: x - rect.left, y: y - rect.top, id }]);
        } else {
            // Single tap — toggle play after short delay
            tapTimer.current = setTimeout(() => {
                if (livePost.media_type === 'video') togglePlay();
            }, 200);
        }
        lastTap.current = now;
    }, [togglePlay, livePost.media_type]);

    const removeHeart = useCallback((id) => {
        setFloatHearts(h => h.filter(fh => fh.id !== id));
    }, []);

    const handleShare = () => {
        setIsShareModalOpen(true);
    };

    const handleReact = async (emoji) => {
        if (!livePost.reactions_enabled || reactionSyncing) return;
        const previousReaction = myReaction;
        const previousSummary = livePost.reaction_summary || [];
        const nextReaction = myReaction === emoji ? null : emoji;

        setMyReaction(nextReaction);
        setLivePost((current) => ({
            ...current,
            reaction_summary: applyReactionDelta(current.reaction_summary || [], previousReaction, nextReaction),
        }));

        setReactionSyncing(true);
        try {
            const res = await axios.post(`/api/posts/${livePost.id}/react`, { emoji: nextReaction });
            setMyReaction(res.data?.my_reaction || null);
            setLivePost((current) => ({
                ...current,
                reaction_summary: res.data?.reaction_summary || current.reaction_summary || [],
            }));
        } catch (error) {
            setMyReaction(previousReaction);
            setLivePost((current) => ({ ...current, reaction_summary: previousSummary }));
            toast.error(error.response?.data?.message || 'Imeshindwa kuweka reaction.');
        } finally {
            setReactionSyncing(false);
        }
    };

    const isVideo = livePost.media_type === 'video';
    const isText = livePost.media_type === 'text';
    const primaryVideoMedia = isVideo
        ? (livePost.media?.find?.((item) => (item?.media_type || item?.type) === 'video') || livePost.images?.find?.((item) => (item?.media_type || item?.type) === 'video') || null)
        : null;
    const videoProcessing = isVideo && isProcessingVideoMedia(primaryVideoMedia);
    const videoSrc = primaryVideoMedia
        ? resolvePlayableVideoUrl({
            hlsUrl: primaryVideoMedia.hls_url,
            processedUrl: primaryVideoMedia.processed_url,
            url: primaryVideoMedia.url || livePost.media_url,
        })
        : livePost.media_url;

    // Hotspots for current image
    const currentHotspots = livePost.resolved_hotspots?.[currentIdx] || [];
    const reactionCounts = Object.fromEntries((livePost.reaction_summary || []).map((entry) => [entry.emoji, Number(entry.count || 0)]));

    return (
        <div
            className="relative w-full h-[calc(100dvh-64px)] md:h-[calc(100dvh-4rem)] bg-black snap-start snap-always overflow-hidden md:rounded-2xl md:my-3 shadow-xl select-none"
            onClick={handleTap}
            onTouchEnd={handleTap}
        >
            {/* ── Media Layer ───────────────────────────────────────────────── */}
            {isText ? (
                <TextPostLayer post={livePost} />
            ) : isVideo && videoProcessing ? (
                <ProcessingVideoLayer />
            ) : isVideo ? (
                <>
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        poster={primaryVideoMedia?.thumbnail_url || undefined}
                        className="w-full h-full object-cover"
                        autoPlay
                        loop
                        muted={muted}
                        playsInline
                        preload="metadata"
                        onLoadedData={() => setVideoReady(true)}
                        onCanPlay={() => setVideoReady(true)}
                    />
                    {!videoProcessing && !videoReady && (
                        <div className="absolute inset-0 z-20 bg-zinc-900 flex items-center justify-center">
                            <Loader2 className="h-9 w-9 animate-spin text-white/70" />
                        </div>
                    )}
                </>
            ) : (
                <ImageLayer post={livePost} currentIdx={currentIdx} setIdx={setCurrentIdx} />
            )}

            {/* ── Floating double-tap hearts ────────────────────────────── */}
            {floatHearts.map(fh => (
                <FloatingHeart key={fh.id} {...fh} onDone={() => removeHeart(fh.id)} />
            ))}

            {/* ── Gradient overlay ─────────────────────────────────────── */}
            {!isText && (
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
            )}

            {/* ── Shoppable pins (Image Hotspots) ────────────────────────── */}
            {currentHotspots.map(spot => (
                <ShoppablePin 
                    key={spot.id} 
                    tag={spot} 
                    merchant={livePost.merchant}
                    onProductTap={onProductTap} 
                />
            ))}

            {/* ── Legacy fallback pin if no hotspots but has product_tag ── */}
            {!isText && !isVideo && currentHotspots.length === 0 && livePost.product_tags?.[0] && (
                <ShoppablePin tag={{ ...livePost.product_tags[0], type: 'product' }} onProductTap={onProductTap} />
            )}

            {/* ── Video controls (top-right) ────────────────────────────── */}
            {isVideo && (
                <div className="absolute top-4 right-4 z-30 flex gap-2">
                    <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
                        className="h-9 w-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/15"
                    >
                        {muted
                            ? <VolumeX className="h-4 w-4 text-white" />
                            : <Volume2 className="h-4 w-4 text-white" />
                        }
                    </motion.button>
                </div>
            )}

            {/* ── Play indicator (center) ───────────────────────────────── */}
            <AnimatePresence>
                {isVideo && !isPlaying && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                    >
                        <div className="h-18 w-18 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Play className="h-10 w-10 text-white fill-white ml-1" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Bottom overlay (caption + sidebar) ───────────────────── */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-end px-4 pb-4 md:pb-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                <div className="flex items-end justify-between gap-4">

                    {/* Left: Merchant info + caption */}
                    <div className="flex-1 min-w-0 pointer-events-auto space-y-1.5 pr-4">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-brand-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {(livePost.merchant?.name || 'M').charAt(0).toUpperCase()}
                            </div>
                            <span className="text-white font-bold text-sm drop-shadow-lg">@{livePost.merchant?.name || 'muuzaji'}</span>
                        </div>
                        {!isText && livePost.caption && (
                            <p className="text-white/90 text-sm leading-snug line-clamp-2 drop-shadow-md">
                                {livePost.caption}
                            </p>
                        )}
                        
                        {/* ── Product Format Badges ── */}
                        {livePost.product_tags?.[0]?.product && (
                            <div className="flex items-center gap-2 mt-1">
                                {livePost.product_tags[0].product.type === 'digital' && (
                                    <span className="bg-brand-500/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 w-max border border-white/20 uppercase shadow-lg">
                                        <DownloadCloud className="h-3 w-3" /> Mtandaoni
                                    </span>
                                )}
                                {livePost.product_tags[0].product.type === 'service' && (
                                    <span className="bg-purple-500/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-full flex items-center gap-1 w-max border border-white/20 uppercase shadow-lg">
                                        <CalendarClock className="h-3 w-3" /> Huduma / Booking
                                    </span>
                                )}
                            </div>
                        )}

                        {!isText && (
                            <div className="flex items-center gap-2 w-max rounded-full bg-black/40 backdrop-blur-md px-3 py-1.5 mt-2 text-[11px] text-white/90 border border-white/10">
                                <Music className="h-3 w-3 animate-spin [animation-duration:3s]" />
                                <span className="truncate max-w-[140px]">Original Audio · {livePost.merchant?.name || 'Takeer'}</span>
                            </div>
                        )}
                    </div>

                    {/* Right: Action sidebar */}
                    <div className="flex flex-col items-center gap-5 pb-2 pointer-events-auto shrink-0">
                        {livePost.reactions_enabled !== false && QUICK_REACTIONS.map((emoji) => (
                            <ReactionBtn
                                key={emoji}
                                emoji={emoji}
                                count={reactionCounts[emoji] || 0}
                                active={myReaction === emoji}
                                disabled={reactionSyncing}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(emoji);
                                }}
                            />
                        ))}

                        <ActionBtn
                            icon={MessageCircle}
                            label={livePost.comment_count ? String(livePost.comment_count) : 'Maoni'}
                            onClick={(e) => { e.stopPropagation(); onComment?.(livePost); }}
                        />

                        <ActionBtn
                            icon={Share2}
                            label="Gawana"
                            onClick={(e) => { e.stopPropagation(); handleShare(); }}
                        />

                        {livePost.product_tags?.length > 0 && (
                            <ActionBtn
                                icon={ShoppingBag}
                                label={livePost.product_tags[0]?.product?.has_access ? "Fungua" : "Nunua"}
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const p = livePost.product_tags[0]?.product;
                                    if (p?.type === 'digital' && p?.has_access) {
                                        window.dispatchEvent(new CustomEvent('takeer:digital-ready', {
                                            detail: {
                                                itemId: p.id,
                                                itemType: 'product',
                                                orderId: p.latest_order_id,
                                                productTitle: p.title,
                                            }
                                        }));
                                    } else {
                                        onProductTap?.(p); 
                                    }
                                }}
                                iconClass={livePost.product_tags[0]?.product?.has_access ? "text-green-400" : "text-brand-300"}
                            />
                        )}
                    </div>
                </div>
            </div>
            
            {/* Share Modal */}
            <ShareModal 
                post={livePost}
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
            />
        </div>
    );
}

function applyReactionDelta(summary, previousReaction, nextReaction) {
    const counts = new Map((summary || []).map((entry) => [entry.emoji, Number(entry.count || 0)]));

    if (previousReaction) {
        counts.set(previousReaction, Math.max(0, (counts.get(previousReaction) || 0) - 1));
    }

    if (nextReaction) {
        counts.set(nextReaction, (counts.get(nextReaction) || 0) + 1);
    }

    return Array.from(counts.entries())
        .filter(([, count]) => count > 0)
        .map(([emoji, count]) => ({ emoji, count }));
}
