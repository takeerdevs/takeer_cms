import { useEffect, useState } from 'react';

const pad = (value) => String(value).padStart(2, '0');

export function formatSubscriptionCountdown(date) {
    const target = date instanceof Date ? date : new Date(date);
    const secondsLeft = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
    const days = Math.floor(secondsLeft / 86400);
    const hours = Math.floor((secondsLeft % 86400) / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    if (!Number.isFinite(target.getTime())) return '';
    if (secondsLeft <= 0) return 'Access expires soon';
    if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s left`;

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} left`;
}

export function useSubscriptionCountdown(expiresAt) {
    const [label, setLabel] = useState(() => expiresAt ? formatSubscriptionCountdown(expiresAt) : null);

    useEffect(() => {
        if (!expiresAt) {
            setLabel(null);
            return undefined;
        }

        const tick = () => setLabel(formatSubscriptionCountdown(expiresAt));
        tick();
        const interval = window.setInterval(tick, 1000);

        return () => window.clearInterval(interval);
    }, [expiresAt]);

    return label;
}
