import React, { useState } from 'react';
import { ExternalLink, Flag, Play } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

function hostFromUrl(url) {
    try {
        return new URL(url).hostname.replace(/^www\./i, '');
    } catch {
        return '';
    }
}

export default function LinkPreviewCard({
    preview,
    className = '',
    playable = false,
    linkMode = 'external',
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [reporting, setReporting] = useState(false);
    if (!preview) return null;

    const href = preview.tracked_url || preview.final_url || preview.url;
    const siteLabel = preview.site_name || hostFromUrl(href);
    const embed = preview.embed;
    const unavailable = Boolean(preview.link_unavailable || preview.tracked_link_status === 'disabled');
    const canEmbed = !unavailable && playable && Boolean(embed?.url && embed?.type === 'video');
    const playableUrl = canEmbed
        ? `${embed.url}${embed.url.includes('?') ? '&' : '?'}autoplay=1`
        : null;

    const handleClick = (event) => {
        if (unavailable) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (canEmbed) {
            event.stopPropagation();
            event.preventDefault();
            setIsPlaying(true);
            return;
        }

        if (linkMode === 'external') {
            event.stopPropagation();
            if (preview.tracked_url) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        }
    };

    const handleReport = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!preview.tracked_url || reporting) return;

        const code = trackedCode(preview.tracked_url);
        if (!code) return;

        setReporting(true);
        try {
            await axios.post(`/go/${code}/report`, {
                reason: 'misleading',
                reason_code: 'harmful_or_misleading_link',
                notes: `Reported from link preview: ${preview.title || href}`,
            });
            toast.success('Thanks. Takeer safety will review this link.');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not report this link.');
        } finally {
            setReporting(false);
        }
    };

    const Root = linkMode === 'external' && !preview.tracked_url ? 'a' : 'div';
    const rootProps = linkMode === 'external' && !preview.tracked_url
        ? { href, target: '_blank', rel: 'noopener noreferrer' }
        : {};

    return (
        <Root
            {...rootProps}
            onClick={handleClick}
            className={`group block overflow-hidden rounded-lg border border-border bg-background transition-colors hover:bg-accent/40 ${className}`}
        >
            {isPlaying && playableUrl ? (
                <div className="aspect-video w-full overflow-hidden bg-black">
                    <iframe
                        src={playableUrl}
                        title={preview.title || `${siteLabel || 'Video'} player`}
                        className="h-full w-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                </div>
            ) : preview.image_url && (
                <div className="relative aspect-[1.91/1] w-full overflow-hidden bg-muted">
                    <img
                        src={preview.image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                    />
                    {canEmbed && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-transform group-hover:scale-105">
                                <Play className="ml-1 h-7 w-7 fill-current" />
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-start gap-3 p-3">
                {preview.favicon_url && (
                    <img
                        src={preview.favicon_url}
                        alt=""
                        className="mt-0.5 h-4 w-4 shrink-0 rounded-sm"
                        loading="lazy"
                    />
                )}
                <div className="min-w-0 flex-1">
                    {siteLabel && (
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">
                            {siteLabel}
                        </p>
                    )}
                    {preview.title && (
                        <p className="mt-0.5 text-sm font-black leading-snug text-foreground line-clamp-2">
                            {preview.title}
                        </p>
                    )}
                    {preview.description && (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">
                            {preview.description}
                        </p>
                    )}
                    {unavailable && (
                        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">
                            This link is unavailable while Takeer reviews a safety issue.
                        </p>
                    )}
                </div>
                {unavailable ? (
                    <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                ) : canEmbed && !isPlaying ? (
                    <Play className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                ) : (
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                )}
                {preview.tracked_url && (
                    <button
                        type="button"
                        onClick={handleReport}
                        disabled={reporting}
                        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                        aria-label="Report link"
                        title="Report link"
                    >
                        <Flag className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </Root>
    );
}

function trackedCode(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        const match = parsed.pathname.match(/^\/go\/([^/]+)/);
        return match?.[1] || '';
    } catch {
        return '';
    }
}
