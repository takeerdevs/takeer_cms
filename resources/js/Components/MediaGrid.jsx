import React from 'react';
import { FileVideo, Play } from 'lucide-react';

// Determine if a URL is a video
const isVideo = (url = '') => /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url) || url.includes('video');

function MediaThumb({ item, index, onTap, className = '', overlay = null, onAspect = null }) {
    if (!item) return null;
    const video = typeof item === 'string'
        ? isVideo(item)
        : item?.type?.startsWith?.('video') || item?.media_type === 'video';
    const src = typeof item === 'string' ? item : item?.url ?? item?.preview;
    const poster = typeof item === 'string' ? null : item?.thumbnail_url ?? item?.poster ?? null;

    return (
        <div
            className={`relative overflow-hidden bg-zinc-900 cursor-pointer select-none group ${className}`}
            onClick={() => onTap(index)}
        >
            {video ? (
                <>
                    {poster ? (
                        <img
                            src={poster}
                            alt=""
                            className="w-full h-full object-cover group-active:brightness-90 transition-all"
                            onLoad={(e) => {
                                if (!onAspect) return;
                                const { naturalWidth, naturalHeight } = e.currentTarget;
                                if (naturalWidth && naturalHeight) onAspect(index, naturalWidth, naturalHeight);
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <FileVideo className="h-9 w-9 text-white/55" />
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-10 w-10 rounded-full bg-black/55 flex items-center justify-center">
                            <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                        </div>
                    </div>
                    {!poster && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/90">
                            Video
                        </span>
                    )}
                </>
            ) : (
                <img
                    src={src}
                    alt=""
                    className={`w-full h-full object-cover group-active:brightness-90 transition-all`}
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
    const [aspects, setAspects] = React.useState({});

    const handleAspect = React.useCallback((index, width, height) => {
        setAspects((prev) => {
            if (prev[index]) return prev;
            return { ...prev, [index]: width / height };
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
        return (
            <div className="w-full aspect-[4/3] overflow-hidden bg-zinc-900">
                <MediaThumb item={items[0]} index={0} onTap={onTap} className="w-full h-full" onAspect={handleAspect} />
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
                    <MediaThumb item={items[0]} index={0} onTap={onTap} className="h-full" onAspect={handleAspect} />
                    <div className="grid grid-cols-2 gap-px h-full">
                        <MediaThumb item={items[1]} index={1} onTap={onTap} className="h-full" onAspect={handleAspect} />
                        <MediaThumb item={items[2]} index={2} onTap={onTap} className="h-full" onAspect={handleAspect} />
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full aspect-[4/3] grid grid-cols-2 gap-px overflow-hidden bg-border/10 border-y border-border/5">
                <MediaThumb item={items[0]} index={0} onTap={onTap} className="h-full" onAspect={handleAspect} />
                <div className="grid grid-rows-2 gap-px h-full">
                    <MediaThumb item={items[1]} index={1} onTap={onTap} className="h-full" onAspect={handleAspect} />
                    <MediaThumb item={items[2]} index={2} onTap={onTap} className="h-full" onAspect={handleAspect} />
                </div>
            </div>
        );
    }

    // ── 4 items or more ──────────────────────────────────────────────────────
    // Fixed: 2x2 grid inside 4:3 container (for 5+, overlay still on 4th)
    return (
        <div className="w-full aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-border/10 border-y border-border/5">
            <MediaThumb item={items[0]} index={0} onTap={onTap} className="h-full" onAspect={handleAspect} />
            <MediaThumb item={items[1]} index={1} onTap={onTap} className="h-full" onAspect={handleAspect} />
            <MediaThumb item={items[2]} index={2} onTap={onTap} className="h-full" onAspect={handleAspect} />
            <MediaThumb
                item={items[3]}
                index={3}
                onTap={onTap}
                className="h-full"
                overlay={count > 4 ? count - 4 : null}
                onAspect={handleAspect}
            />
        </div>
    );
}
