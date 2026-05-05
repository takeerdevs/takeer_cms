import React, { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';

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
    if (!preview) return null;

    const href = preview.final_url || preview.url;
    const siteLabel = preview.site_name || hostFromUrl(href);
    const embed = preview.embed;
    const canEmbed = playable && Boolean(embed?.url && embed?.type === 'video');
    const playableUrl = canEmbed
        ? `${embed.url}${embed.url.includes('?') ? '&' : '?'}autoplay=1`
        : null;

    const handleClick = (event) => {
        if (canEmbed) {
            event.stopPropagation();
            event.preventDefault();
            setIsPlaying(true);
            return;
        }

        if (linkMode === 'external') {
            event.stopPropagation();
        }
    };

    const Root = linkMode === 'external' ? 'a' : 'div';
    const rootProps = linkMode === 'external'
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
                </div>
                {canEmbed && !isPlaying ? (
                    <Play className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                ) : (
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                )}
            </div>
        </Root>
    );
}
