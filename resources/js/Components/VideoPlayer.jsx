import React, { useEffect, useMemo, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

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

const AUTOPLAY_REQUEST_EVENT = 'takeer:social-video-autoplay-request';

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
    preferMp4 = false,
    overlayMuteToggle = false,
    videoRef = null,
    ...props
}) {
    const internalRef = useRef(null);
    const ref = videoRef || internalRef;
    const mutedRef = useRef(muted);
    const [isMuted, setIsMuted] = React.useState(muted);
    const playableSrc = useMemo(
        () => preferMp4
            ? (processedUrl || (!hlsUrl ? src : '') || hlsUrl || src || '')
            : (hlsUrl || resolvePlayableVideoUrl({ hlsUrl, processedUrl, url: src, useHlsJs: true })),
        [hlsUrl, preferMp4, processedUrl, src],
    );

    useEffect(() => {
        const video = ref.current;
        if (!video || !playableSrc) return undefined;

        let hls = null;
        let cancelled = false;
        let isVisible = false;
        let observer = null;
        const fallbackSrc = processedUrl || src || '';
        const attemptAutoplay = () => {
            if (!autoPlay || cancelled || !isVisible || document.hidden) return;
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

        if (autoPlay && typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver(([entry]) => {
                isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
                if (isVisible) attemptAutoplay();
                else video.pause();
            }, { threshold: [0, 0.6, 0.9] });
            observer.observe(video);
        } else {
            isVisible = true;
        }

        window.addEventListener(AUTOPLAY_REQUEST_EVENT, pauseForOtherVideo);
        document.addEventListener('visibilitychange', pauseWhenHidden);

        if (!preferMp4 && hlsUrl && canPlayNativeHls()) {
            video.src = playableSrc;
            video.load();
            video.addEventListener('canplay', attemptAutoplay, { once: true });
        } else if (!preferMp4 && hlsUrl) {
            import('hls.js')
                .then((module) => {
                    if (cancelled) return;
                    const Hls = module.default;
                    if (!Hls?.isSupported?.()) {
                        video.src = fallbackSrc || hlsUrl;
                        video.load();
                        video.addEventListener('canplay', attemptAutoplay, { once: true });
                        return;
                    }

                    hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: false,
                        backBufferLength: 30,
                    });
                    hls.loadSource(hlsUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, attemptAutoplay);
                })
                .catch(() => {
                    if (cancelled) return;
                    video.src = fallbackSrc || hlsUrl;
                    video.load();
                    video.addEventListener('canplay', attemptAutoplay, { once: true });
                });
        } else {
            video.src = playableSrc;
            video.load();
            video.addEventListener('canplay', attemptAutoplay, { once: true });
        }

        return () => {
            cancelled = true;
            observer?.disconnect();
            window.removeEventListener(AUTOPLAY_REQUEST_EVENT, pauseForOtherVideo);
            document.removeEventListener('visibilitychange', pauseWhenHidden);
            video.removeEventListener('canplay', attemptAutoplay);
            if (hls) hls.destroy();
        };
    }, [autoPlay, hlsUrl, playableSrc, preferMp4, processedUrl, ref, src]);

    useEffect(() => {
        setIsMuted(muted);
    }, [muted]);

    useEffect(() => {
        mutedRef.current = isMuted;
        const video = ref.current;
        if (!video) return;
        video.muted = isMuted;
        if (!isMuted) {
            const playPromise = video.play?.();
            if (playPromise?.catch) playPromise.catch(() => {});
        }
    }, [isMuted, ref]);

    const videoElement = (
        <video
            ref={ref}
            src={undefined}
            poster={poster || undefined}
            className={className}
            autoPlay={autoPlay}
            muted={isMuted}
            loop={loop}
            controls={controls && !overlayMuteToggle}
            playsInline={playsInline}
            preload={preload}
            {...props}
        />
    );

    if (overlayMuteToggle) {
        return (
            <div className="relative bg-black">
                {videoElement}
                <div
                    aria-hidden="true"
                    className="absolute inset-0 z-10 bg-transparent"
                    onContextMenu={(event) => event.preventDefault()}
                />
                <button
                    type="button"
                    aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsMuted((current) => !current);
                    }}
                    className="absolute bottom-4 right-4 z-20 h-11 w-11 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center shadow-lg border border-white/10 hover:bg-black/70 transition-colors"
                >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
            </div>
        );
    }

    return (
        videoElement
    );
}
