import React from 'react';
import { trackPlatformEvent } from '@/lib/attribution';
import { useLocale } from '@/lib/i18n';

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
const URL_START_PATTERN = /^(?:https?:\/\/|www\.)/i;

function normalizeUrl(rawUrl) {
    if (!rawUrl) return '#';
    return rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
        ? rawUrl
        : `https://${rawUrl}`;
}

function comparableUrl(rawUrl) {
    try {
        const cleaned = String(rawUrl || '').trim().replace(/[),.;:!?]+$/, '');
        const parsed = new URL(normalizeUrl(cleaned));
        parsed.hash = '';
        const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
        return `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}${pathname}${parsed.search}`;
    } catch {
        return String(rawUrl || '').trim().toLowerCase();
    }
}

function isExternalUrl(url) {
    if (typeof window === 'undefined') return true;
    try {
        return new URL(url).hostname !== window.location.hostname;
    } catch {
        return false;
    }
}

function truncateUrl(rawUrl, maxLength) {
    if (!rawUrl) return '';
    if (rawUrl.length <= maxLength) return rawUrl;
    return `${rawUrl.slice(0, Math.max(0, maxLength - 1))}…`;
}

export default function LinkifiedText({
    text,
    className = '',
    linkClassName = '',
    maxLinkLength = 44,
    stopPropagationOnLinkClick = false,
    analyticsContext = {},
    disabledUrls = [],
    disabledLinkMessage = null,
}) {
    const { copy } = useLocale();
    const normalizedText = String(text || '');
    if (!normalizedText) return null;

    const resolvedDisabledLinkMessage = disabledLinkMessage || copy(
        'This link is unavailable while Takeer reviews a safety issue.',
        'Kiungo hiki hakipatikani wakati Takeer inakagua suala la usalama.',
    );

    const disabledUrlSet = new Set(
        (disabledUrls || [])
            .filter(Boolean)
            .map(comparableUrl)
    );
    const lines = normalizedText.split('\n');

    return (
        <span className={className}>
            {lines.map((line, lineIndex) => {
                const parts = line.split(URL_PATTERN);
                return (
                    <React.Fragment key={`line-${lineIndex}`}>
                        {parts.map((part, index) => {
                            const isUrl = URL_START_PATTERN.test(part);
                            if (!isUrl) {
                                return <React.Fragment key={`text-${lineIndex}-${index}`}>{part}</React.Fragment>;
                            }
                            const href = normalizeUrl(part);
                            const isDisabled = disabledUrlSet.has(comparableUrl(part)) || disabledUrlSet.has(comparableUrl(href));

                            if (isDisabled) {
                                return (
                                    <span
                                        key={`url-${lineIndex}-${index}`}
                                        aria-disabled="true"
                                        className={`${linkClassName || 'underline underline-offset-2 break-all'} cursor-not-allowed decoration-dotted opacity-70`}
                                        title={resolvedDisabledLinkMessage}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            if (stopPropagationOnLinkClick) {
                                                event.stopPropagation();
                                            }
                                        }}
                                    >
                                        {truncateUrl(part, maxLinkLength)}
                                    </span>
                                );
                            }

                            return (
                                <a
                                    key={`url-${lineIndex}-${index}`}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => {
                                        if (stopPropagationOnLinkClick) {
                                            event.stopPropagation();
                                        }
                                        if (isExternalUrl(href)) {
                                            trackPlatformEvent('outbound_click', {
                                                source: 'linkified_text',
                                                landing_url: href,
                                                metadata: {
                                                    destination_url: href,
                                                    ...analyticsContext,
                                                },
                                            });
                                        }
                                    }}
                                    className={linkClassName || 'underline underline-offset-2 break-all'}
                                    title={part}
                                >
                                    {truncateUrl(part, maxLinkLength)}
                                </a>
                            );
                        })}
                        {lineIndex < lines.length - 1 && <br />}
                    </React.Fragment>
                );
            })}
        </span>
    );
}
