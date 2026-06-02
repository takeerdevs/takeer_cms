import './bootstrap';
import '../css/app.css';
import { route as ziggyRoute } from 'ziggy-js';

function appRoute(name, params, absolute = false, config) {
    return ziggyRoute(name, params, absolute, config);
}

Object.assign(appRoute, ziggyRoute);

window.route = appRoute;

import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';

const appName = import.meta.env.VITE_APP_NAME || 'Takeer';

createInertiaApp({
    title: (title) => `${title} — ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },
    progress: {
        color: '#10b981', // Emerald green — Takeer brand
    },
});
