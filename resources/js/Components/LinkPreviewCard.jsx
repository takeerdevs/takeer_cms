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
    const [imageAspect, setImageAspect] = useState(null);
    if (!preview) return null;

    const href = preview.tracked_url || preview.final_url || preview.url;
    const host = hostFromUrl(preview.final_url || preview.url || href);
    const siteLabel = preview.site_name || host;
    const embed = preview.embed;
    const unavailable = Boolean(preview.link_unavailable || preview.tracked_link_status === 'disabled');
    const canEmbed = !unavailable && playable && Boolean(embed?.url && embed?.type === 'video');
    const compactMarketplacePreview = shouldUseCompactMarketplacePreview(preview, host);
    const fallbackTitle = unavailable && siteLabel ? `Open on ${siteLabel}` : '';
    const titleText = compactMarketplacePreview && isBlockedPreviewText(String(preview.title || '').toLowerCase())
        ? `Open on ${siteLabel || 'external shop'}`
        : (preview.title || fallbackTitle);
    const descriptionText = compactMarketplacePreview && isBlockedPreviewText(String(preview.description || '').toLowerCase())
        ? ''
        : preview.description;
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

    const Root = linkMode === 'external' && !preview.tracked_url && !unavailable ? 'a' : 'div';
    const rootProps = linkMode === 'external' && !preview.tracked_url && !unavailable
        ? { href, target: '_blank', rel: 'noopener noreferrer' }
        : {};
    const previewAspect = clampAspect(imageAspect || 1.91, 0.95, 3.4);
    const stateClass = unavailable
        ? 'cursor-not-allowed border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
        : 'border-border bg-background hover:bg-accent/40';

    return (
        <Root
            {...rootProps}
            onClick={handleClick}
            className={`group block overflow-hidden rounded-xl border transition-colors ${stateClass} ${className}`}
            aria-disabled={unavailable || undefined}
        >
            {unavailable ? (
                <div className="relative flex min-h-[200px] items-center justify-center bg-white px-6 py-10 text-center sm:min-h-[250px]">
                    <Flag className="absolute right-5 top-5 h-5 w-5 text-orange-700" />
                    <div className="mx-auto max-w-lg">
                        <p className="text-base font-medium leading-7 text-slate-500 sm:text-lg sm:leading-8">
                            This link is unavailable while Takeer reviews a safety issue.
                        </p>
                    </div>
                </div>
            ) : isPlaying && playableUrl ? (
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
            ) : preview.image_url && !compactMarketplacePreview && (
                <div
                    className="relative max-h-[420px] w-full overflow-hidden bg-muted"
                    style={{ aspectRatio: previewAspect }}
                >
                    <img
                        src={preview.image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                        onLoad={(event) => {
                            const { naturalWidth, naturalHeight } = event.currentTarget;
                            if (naturalWidth > 0 && naturalHeight > 0) {
                                setImageAspect(naturalWidth / naturalHeight);
                            }
                        }}
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
            {!unavailable && (
                <div className={`flex items-start gap-3 ${compactMarketplacePreview ? 'p-4' : 'p-3'}`}>
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
                        {titleText && (
                            <p className="mt-0.5 text-sm font-black leading-snug text-foreground line-clamp-2">
                                {titleText}
                            </p>
                        )}
                        {descriptionText && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">
                                {descriptionText}
                            </p>
                        )}
                    </div>
                    {canEmbed && !isPlaying ? (
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
            )}
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

function clampAspect(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 1.91;
    return Math.min(max, Math.max(min, n));
}

function shouldUseCompactMarketplacePreview(preview, host) {
    if (!isMarketplaceHost(host)) return false;

    const title = String(preview?.title || '').trim().toLowerCase();
    const description = String(preview?.description || '').trim().toLowerCase();

    if (!preview?.image_url) return true;
    if (isBlockedPreviewText(title) || isBlockedPreviewText(description)) return true;
    if (['amazon', 'ebay', 'aliexpress', 'alibaba'].includes(title)) return true;

    return false;
}

function isMarketplaceHost(host = '') {
    const normalized = String(host || '').replace(/^www\./i, '').toLowerCase();
    return [
        'amazon.',
        'ebay.',
        'aliexpress.',
        'alibaba.',
        'etsy.',
        'temu.',
        'jumia.',
        'walmart.',
    ].some((domain) => normalized === domain.replace('.', '') || normalized.includes(domain));
}

function isBlockedPreviewText(value = '') {
    return [
        'pardon our interruption',
        'robot check',
        'captcha',
        'access denied',
        'blocked',
        'unusual traffic',
    ].some((needle) => value.includes(needle));
}
