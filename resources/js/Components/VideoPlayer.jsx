import React, { useEffect, useMemo, useRef } from 'react';

export const canPlayNativeHls = () => {
    if (typeof document === 'undefined') return false;
    const video = document.createElement('video');
    return Boolean(
        video.canPlayType('application/vnd.apple.mpegurl')
        || video.canPlayType('application/x-mpegURL')
    );
};

export const resolvePlayableVideoUrl = ({ hlsUrl, processedUrl, url, useHlsJs = false }) => {
    if (hlsUrl && canPlayNativeHls()) return hlsUrl;
    return processedUrl || url || hlsUrl || '';
};

export default function VideoPlayer({
    hlsUrl,
    processedUrl,
    src,
    poster,
    className = '',
    autoPlay = false,
    muted = false,
    loop = false,
    controls = true,
    playsInline = true,
    preload = 'metadata',
    videoRef = null,
    ...props
}) {
    const internalRef = useRef(null);
    const ref = videoRef || internalRef;
    const playableSrc = useMemo(
        () => hlsUrl || resolvePlayableVideoUrl({ hlsUrl, processedUrl, url: src, useHlsJs: true }),
        [hlsUrl, processedUrl, src],
    );

    useEffect(() => {
        const video = ref.current;
        if (!video || !playableSrc) return undefined;

        let hls = null;
        let cancelled = false;
        const fallbackSrc = processedUrl || src || '';

        if (hlsUrl && canPlayNativeHls()) {
            video.src = playableSrc;
            video.load();
        } else if (hlsUrl) {
            import('hls.js')
                .then((module) => {
                    if (cancelled) return;
                    const Hls = module.default;
                    if (!Hls?.isSupported?.()) {
                        video.src = fallbackSrc || hlsUrl;
                        video.load();
                        return;
                    }

                    hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: false,
                        backBufferLength: 30,
                    });
                    hls.loadSource(hlsUrl);
                    hls.attachMedia(video);
                })
                .catch(() => {
                    if (cancelled) return;
                    video.src = fallbackSrc || hlsUrl;
                    video.load();
                });
        } else {
            video.src = playableSrc;
            video.load();
        }

        return () => {
            cancelled = true;
            if (hls) hls.destroy();
        };
    }, [hlsUrl, playableSrc, processedUrl, ref, src]);

    return (
        <video
            ref={ref}
            src={undefined}
            poster={poster || undefined}
            className={className}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            controls={controls}
            playsInline={playsInline}
            preload={preload}
            {...props}
        />
    );
}
