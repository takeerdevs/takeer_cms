import React from 'react';
import { trackPlatformEvent } from '@/lib/attribution';

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
const URL_START_PATTERN = /^(?:https?:\/\/|www\.)/i;

function normalizeUrl(rawUrl) {
    if (!rawUrl) return '#';
    return rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
        ? rawUrl
        : `https://${rawUrl}`;
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
}) {
    const normalizedText = String(text || '');
    if (!normalizedText) return null;

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
