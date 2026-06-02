import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.headers.common['Accept'] = 'application/json';

function localAppUrl(url) {
    if (!url || typeof url !== 'string' || url.startsWith('/')) {
        return url;
    }

    try {
        const parsed = new URL(url);
        if (parsed.hostname === window.location.hostname) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
    } catch {
        return url;
    }

    return url;
}

// Request interceptor to attach bearer token
window.axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('takeer_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.url = localAppUrl(config.url);
    return config;
});

import './echo';
