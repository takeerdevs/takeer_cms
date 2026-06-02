import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

const broadcastEnabled = String(import.meta.env.VITE_BROADCAST_ENABLED ?? 'true') === 'true';
const broadcastDriver = import.meta.env.VITE_BROADCAST_DRIVER ?? 'pusher';
const hasPusherConfig = Boolean(
    import.meta.env.VITE_PUSHER_APP_KEY
    && import.meta.env.VITE_PUSHER_HOST
    && import.meta.env.VITE_PUSHER_PORT
);

window.Echo = broadcastEnabled && broadcastDriver === 'pusher' && hasPusherConfig
    ? new Echo({
        broadcaster: 'pusher',
        key: import.meta.env.VITE_PUSHER_APP_KEY,
        cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1',
        wsHost: import.meta.env.VITE_PUSHER_HOST,
        wsPort: import.meta.env.VITE_PUSHER_PORT,
        wssPort: import.meta.env.VITE_PUSHER_PORT,
        forceTLS: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
    })
    : null;
