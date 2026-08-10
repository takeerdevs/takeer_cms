import { defineConfig } from 'vite';
import path from 'path';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Laravel's Vite plugin disables Vite's public directory by default. Enable
    // it for development so absolute assets used by Vite-served CSS (fonts,
    // logos, etc.) resolve on port 5173 as well as through Laravel on port 8000.
    publicDir: 'public',
    build: {
        // Laravel already owns public/. Avoid copying public back into
        // public/build during production builds.
        copyPublicDir: false,
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    server: {
        host: process.env.VITE_DEV_SERVER_HOST || 'localhost',
        port: 5173,
        hmr: {
            host: process.env.VITE_HMR_HOST || 'localhost',
        },
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
        },
    },
});
