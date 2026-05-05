const STORAGE_KEY = 'takeer_attribution_session';

export function getAttributionSessionId() {
    if (typeof window === 'undefined') return '';

    let sessionId = window.localStorage?.getItem(STORAGE_KEY);
    if (!sessionId) {
        const random = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessionId = `atk_${String(random).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
        window.localStorage?.setItem(STORAGE_KEY, sessionId);
    }

    return sessionId;
}

export function attributionPayload(extra = {}) {
    if (typeof window === 'undefined') return extra;

    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get('ref') || params.get('r') || '';

    return {
        session_id: getAttributionSessionId(),
        landing_url: window.location.href,
        referrer_url: document.referrer || '',
        source: params.get('source') || (referralCode ? 'referral' : ''),
        source_url: window.location.href,
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '',
        utm_term: params.get('utm_term') || '',
        referral_code: referralCode,
        ...extra,
    };
}

export function checkoutAttributionFields() {
    const payload = attributionPayload();

    return {
        attribution_session_id: payload.session_id,
        attribution_source: payload.source || undefined,
        landing_url: payload.landing_url || undefined,
        referrer_url: payload.referrer_url || undefined,
        utm_source: payload.utm_source || undefined,
        utm_medium: payload.utm_medium || undefined,
        utm_campaign: payload.utm_campaign || undefined,
        utm_content: payload.utm_content || undefined,
        utm_term: payload.utm_term || undefined,
        referral_code: payload.referral_code || undefined,
    };
}

export function trackAttributionEvent(eventType, extra = {}) {
    if (typeof window === 'undefined') return;

    const body = attributionPayload({
        event_type: eventType,
        ...extra,
    });

    const json = JSON.stringify(body);

    if (navigator.sendBeacon) {
        const blob = new Blob([json], { type: 'application/json' });
        navigator.sendBeacon('/api/analytics/events', blob);
        return;
    }

    fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: json,
        keepalive: true,
        credentials: 'include',
    }).catch(() => {});
}

export const trackPlatformEvent = trackAttributionEvent;
