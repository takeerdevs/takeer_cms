import React from 'react';
import { FileVideo, Loader2, Play, Volume2, VolumeX } from 'lucide-react';

const VIDEO_EXTENSION_RE = /\.(mp4|m4v|mov|webm|ogg)(\?|#|$)/i;
const AUTOPLAY_REQUEST_EVENT = 'takeer:social-video-autoplay-request';
const isProcessingVideo = (item) => {
    if (!item || typeof item === 'string') return false;
    return ['pending', 'processing'].includes(item.processing_status) && !item.processed_url && !item.hls_url;
};

const mediaKind = (item) => {
    if (!item) return 'image';
    if (typeof item === 'string') return VIDEO_EXTENSION_RE.test(item) ? 'video' : 'image';

    const declaredType = String(item.media_type || item.type || '').toLowerCase();
    const mime = String(item.mime || item.mime_type || '').toLowerCase();

    if (declaredType.startsWith('video') || mime.startsWith('video/')) return 'video';
    if (declaredType.startsWith('image') || mime.startsWith('image/')) return 'image';
    if (item.hls_url || item.processed_url) return 'video';

    const url = String(item.url || item.preview || '');
    return VIDEO_EXTENSION_RE.test(url) ? 'video' : 'image';
};

function AutoplayVideoThumb({ src, poster, className, onAspect, onReady, autoPlay = true }) {
    const videoRef = React.useRef(null);
    const mutedRef = React.useRef(true);
    const [muted, setMuted] = React.useState(true);

    React.useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return undefined;

        let isVisible = false;
        const attemptAutoplay = () => {
            if (!autoPlay || !isVisible || document.hidden) return;
            video.muted = mutedRef.current;
            window.dispatchEvent(new CustomEvent(AUTOPLAY_REQUEST_EVENT, { detail: { video } }));
            const playPromise = video.play?.();
            if (playPromise?.catch) playPromise.catch(() => {});
        };
        const pauseForOtherVideo = (event) => {
            if (event.detail?.video !== video) video.pause();
        };
        const pauseWhenHidden = () => {
            if (document.hidden) video.pause();
            else attemptAutoplay();
        };

        const observer = typeof IntersectionObserver !== 'undefined'
            ? new IntersectionObserver(([entry]) => {
                isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
                if (isVisible) attemptAutoplay();
                else video.pause();
            }, { threshold: [0, 0.6, 0.9] })
            : null;

        if (observer) observer.observe(video);
        else {
            isVisible = true;
            attemptAutoplay();
        }

        window.addEventListener(AUTOPLAY_REQUEST_EVENT, pauseForOtherVideo);
        document.addEventListener('visibilitychange', pauseWhenHidden);

        return () => {
            observer?.disconnect();
            window.removeEventListener(AUTOPLAY_REQUEST_EVENT, pauseForOtherVideo);
            document.removeEventListener('visibilitychange', pauseWhenHidden);
        };
    }, [autoPlay, src]);

    React.useEffect(() => {
        mutedRef.current = muted;
        const video = videoRef.current;
        if (!video) return;
        video.muted = muted;
        if (!muted) {
            const playPromise = video.play?.();
            if (playPromise?.catch) playPromise.catch(() => {});
        }
    }, [muted]);

    return (
        <>
            <video
                ref={videoRef}
                src={src}
                poster={poster || undefined}
                className={className}
                muted={muted}
                loop
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                    if (!onAspect) return;
                    const { videoWidth, videoHeight } = e.currentTarget;
                    if (videoWidth && videoHeight) onAspect(videoWidth, videoHeight);
                }}
                onLoadedData={() => onReady?.()}
                onCanPlay={() => onReady?.()}
                onPlay={(event) => {
                    window.dispatchEvent(new CustomEvent(AUTOPLAY_REQUEST_EVENT, { detail: { video: event.currentTarget } }));
                }}
            />
            <div
                aria-hidden="true"
                className="absolute inset-0 z-10 bg-transparent"
                onContextMenu={(event) => event.preventDefault()}
            />
            {autoPlay ? (
                <button
                    type="button"
                    aria-label={muted ? 'Unmute video' : 'Mute video'}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setMuted((current) => !current);
                    }}
                    className="absolute bottom-3 right-3 z-20 h-10 w-10 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center shadow-lg border border-white/10 hover:bg-black/70 transition-colors"
                >
                    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
            ) : (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/15">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg">
                        <Play className="h-5 w-5 fill-current" />
                    </span>
                </div>
            )}
        </>
    );
}

function getItemAspect(item) {
    if (!item || typeof item === 'string') return null;
    const width = Number(item.width || item.media_width || 0);
    const height = Number(item.height || item.media_height || 0);
    return width > 0 && height > 0 ? width / height : null;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function MediaThumb({ item, index, onTap, className = '', overlay = null, onAspect = null, fit = 'cover', autoPlayVideo = true }) {
    if (!item) return null;
    const video = mediaKind(item) === 'video';
    const src = typeof item === 'string' ? item : item?.processed_url ?? item?.url ?? item?.preview;
    const poster = typeof item === 'string' ? null : item?.thumbnail_url ?? item?.poster ?? null;
    const processing = video && isProcessingVideo(item);
    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        setLoaded(false);
    }, [src, video]);

    return (
        <div
            className={`relative overflow-hidden ${fit === 'contain' ? 'bg-transparent' : 'bg-zinc-900'} cursor-pointer select-none group ${className}`}
            onClick={() => onTap(index)}
        >
            {video ? (
                <>
                    {processing ? (
                        <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center gap-2 px-4 text-center">
                            <Loader2 className="h-7 w-7 text-white/70 animate-spin" />
                            <span className="text-sm font-semibold text-white">Processing video...</span>
                            <span className="text-[11px] text-white/55">Playback will be ready shortly.</span>
                        </div>
                    ) : (
                        <>
                            {src ? (
                                <AutoplayVideoThumb
                                    src={src}
                                    poster={poster}
                                    className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} group-active:brightness-90 transition-all`}
                                    onAspect={(width, height) => onAspect?.(index, width, height)}
                                    onReady={() => setLoaded(true)}
                                    autoPlay={autoPlayVideo}
                                />
                            ) : (
                                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                                    <FileVideo className="h-9 w-9 text-white/55" />
                                </div>
                            )}
                            {autoPlayVideo && src && !loaded && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-900/70">
                                    <Loader2 className="h-7 w-7 animate-spin text-white/70" />
                                </div>
                            )}
                            {!src && (
                                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/90">
                                    Video
                                </span>
                            )}
                        </>
                    )}
                </>
            ) : (
                <img
                    src={src}
                    alt=""
                    className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} group-active:brightness-90 transition-all`}
                    onLoad={(e) => {
                        if (!onAspect) return;
                        const { naturalWidth, naturalHeight } = e.currentTarget;
                        if (naturalWidth && naturalHeight) onAspect(index, naturalWidth, naturalHeight);
                    }}
                />
            )}

            {/* "+N more" overlay */}
            {overlay !== null && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                    <span className="text-white text-2xl font-black drop-shadow-lg">+{overlay}</span>
                </div>
            )}
        </div>
    );
}

/**
 * MediaGrid — replicates the Facebook multi-image grid layout.
 *
 * 1 item  → full width, 4:3 aspect
 * 2 items → 50/50 side-by-side, 1:1
 * 3 items → left half full height, right half two stacked
 * 4 items → 2 × 2 grid
 * 5+      → row of 2 + row of 3 (last shows +N overlay)
 */
export default function MediaGrid({ items: rawItems = [], onTap }) {
    const items = React.useMemo(() => (rawItems || []).filter(Boolean), [rawItems]);
    if (!items.length) return null;

    const count = items.length;
    const autoplayVideoIndex = React.useMemo(() => {
        const videoIndexes = items
            .map((item, index) => (mediaKind(item) === 'video' ? index : -1))
            .filter((index) => index >= 0);

        return videoIndexes.length === 1 ? videoIndexes[0] : -1;
    }, [items]);
    const [aspects, setAspects] = React.useState(() => (
        Object.fromEntries(items.map((item, index) => [index, getItemAspect(item)]).filter(([, aspect]) => aspect))
    ));

    React.useEffect(() => {
        setAspects((prev) => {
            let next = prev;
            items.forEach((item, index) => {
                if (next[index]) return;
                const aspect = getItemAspect(item);
                if (!aspect) return;
                if (next === prev) next = { ...prev };
                next[index] = aspect;
            });
            return next;
        });
    }, [items]);

    const handleAspect = React.useCallback((index, width, height) => {
        setAspects((prev) => {
            const nextAspect = width / height;
            if (prev[index] && Math.abs(prev[index] - nextAspect) < 0.03) return prev;
            return { ...prev, [index]: nextAspect };
        });
    }, []);

    const ratioAt = (index) => aspects[index];
    const isLandscape = (index) => {
        const ratio = ratioAt(index);
        return ratio ? ratio >= 1.2 : false;
    };
    const isPortrait = (index) => {
        const ratio = ratioAt(index);
        return ratio ? ratio <= 0.9 : false;
    };

    // ── 1 item ──────────────────────────────────────────────────────────────
    if (count === 1) {
        const aspect = ratioAt(0) || getItemAspect(items[0]) || 4 / 3;
        const displayAspect = clamp(aspect, 0.65, 1.91);
        const maxHeight = 'min(78vh, 860px)';
        const maxWidth = aspect < 0.9
            ? `min(100%, ${Math.round(78 * displayAspect)}vh, ${Math.round(860 * displayAspect)}px)`
            : '100%';

        return (
            <div className="w-full flex justify-center bg-background">
                <div
                    className="w-full overflow-hidden bg-transparent"
                    style={{
                        aspectRatio: displayAspect,
                        maxWidth,
                        maxHeight,
                    }}
                >
                    <MediaThumb
                        item={items[0]}
                        index={0}
                        onTap={onTap}
                        className="w-full h-full"
                        onAspect={handleAspect}
                        fit="contain"
                        autoPlayVideo={0 === autoplayVideoIndex}
                    />
                </div>
            </div>
        );
    }

    // ── 2 items ─────────────────────────────────────────────────────────────
    // Fixed: 4:3 container, two columns
    if (count === 2) {
        return (
            <div className="w-full aspect-[4/3] grid grid-cols-2 gap-px overflow-hidden bg-border/10 border-y border-border/5">
                {items.slice(0, 2).map((item, i) => (
                    <MediaThumb
                        key={i}
                        item={item}
                        index={i}
                        onTap={onTap}
                        className="w-full h-full"
                        onAspect={handleAspect}
                        autoPlayVideo={i === autoplayVideoIndex}
                    />
                ))}
            </div>
        );
    }

    // ── 3 items ─────────────────────────────────────────────────────────────
    // Fixed layout based on the first image orientation:
    // landscape → two rows (top large, bottom two)
    // portrait/unknown → two columns (left large, right two)
    if (count === 3) {
        const primaryLandscape = isLandscape(0);

        if (primaryLandscape) {
            return (
                <div className="w-full aspect-[4/3] grid grid-rows-2 gap-px overflow-hidden bg-border/10 border-y border-border/5">
                    <MediaThumb item={items[0]} index={0} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={0 === autoplayVideoIndex} />
                    <div className="grid grid-cols-2 gap-px h-full">
                        <MediaThumb item={items[1]} index={1} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={1 === autoplayVideoIndex} />
                        <MediaThumb item={items[2]} index={2} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={2 === autoplayVideoIndex} />
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full aspect-[4/3] grid grid-cols-2 gap-px overflow-hidden bg-border/10 border-y border-border/5">
                <MediaThumb item={items[0]} index={0} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={0 === autoplayVideoIndex} />
                <div className="grid grid-rows-2 gap-px h-full">
                    <MediaThumb item={items[1]} index={1} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={1 === autoplayVideoIndex} />
                    <MediaThumb item={items[2]} index={2} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={2 === autoplayVideoIndex} />
                </div>
            </div>
        );
    }

    // ── 4 items or more ──────────────────────────────────────────────────────
    // Fixed: 2x2 grid inside 4:3 container (for 5+, overlay still on 4th)
    return (
        <div className="w-full aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-border/10 border-y border-border/5">
            <MediaThumb item={items[0]} index={0} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={0 === autoplayVideoIndex} />
            <MediaThumb item={items[1]} index={1} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={1 === autoplayVideoIndex} />
            <MediaThumb item={items[2]} index={2} onTap={onTap} className="h-full" onAspect={handleAspect} autoPlayVideo={2 === autoplayVideoIndex} />
            <MediaThumb
                item={items[3]}
                index={3}
                onTap={onTap}
                className="h-full"
                overlay={count > 4 ? count - 4 : null}
                onAspect={handleAspect}
                autoPlayVideo={3 === autoplayVideoIndex}
            />
        </div>
    );
}
