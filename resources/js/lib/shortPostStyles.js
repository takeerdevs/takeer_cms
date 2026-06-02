const BG_MAP = {
    gradient_sunset: 'linear-gradient(135deg, #f97316, #ec4899)',
    gradient_ocean: 'linear-gradient(135deg, #06b6d4, #6366f1)',
    gradient_forest: 'linear-gradient(135deg, #22c55e, #14b8a6)',
    gradient_midnight: 'linear-gradient(135deg, #1e1b4b, #4c1d95)',
    gradient_fire: 'linear-gradient(135deg, #ef4444, #f97316)',
    solid_black: '#000000',
    solid_brand: '#0284c7',
};

export function getShortPostPresentation({ text = '', bgStyle = null, hasMedia = false }) {
    const trimmed = String(text || '').trim();
    const isTextLong = trimmed.length >= 80;
    const disableStyles = isTextLong || hasMedia;
    const effectiveBg = disableStyles ? null : bgStyle;
    const hasBg = Boolean(effectiveBg);
    const explicitLineCount = trimmed ? trimmed.split(/\r?\n/).length : 1;
    const isVeryShortPoster = trimmed.length <= 45 && explicitLineCount <= 2;
    const isCompactPoster = trimmed.length <= 100 && explicitLineCount <= 3;

    const textClass = disableStyles
        ? 'text-base sm:text-lg font-normal text-left text-foreground'
        : hasBg
            ? 'text-3xl sm:text-4xl font-bold text-center text-white drop-shadow-md'
            : 'text-xl sm:text-2xl font-medium text-left text-foreground';
    const canvasClass = hasBg
        ? isVeryShortPoster
            ? 'min-h-[220px] sm:min-h-[280px]'
            : isCompactPoster
                ? 'min-h-[280px] sm:min-h-[340px]'
                : 'min-h-[340px] sm:min-h-[420px]'
        : '';
    const lineHeightClass = hasBg
        ? explicitLineCount <= 4
            ? 'leading-[1.5]'
            : 'leading-[1.18]'
        : 'leading-[1.4]';

    return {
        hasBg,
        bgValue: hasBg ? (BG_MAP[effectiveBg] || BG_MAP.gradient_ocean) : null,
        textClass,
        canvasClass,
        lineHeightClass,
        disableStyles,
    };
}
