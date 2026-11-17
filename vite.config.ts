import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Progressive Web App: installable, works fully offline. The service worker
 * precaches the app shell and every code-split chunk, and caches Google
 * Fonts at runtime. Updates are offered to the user (never forced mid-edit).
 */
const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false, // registered from React (src/features/pwa/PwaManager.tsx)
  includeAssets: ['favicon.ico', 'favicon.svg', 'icon.svg', 'apple-touch-icon-180x180.png'],
  manifest: {
    id: '/',
    name: 'Inkwell — Novel Writing Studio',
    short_name: 'Inkwell',
    description: 'A local-first studio for writing novels: binder, corkboard, outliner, story bible, goals, compile & export. Works offline.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#283593',
    background_color: '#f7f7fb',
    categories: ['productivity', 'books', 'education'],
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press / right-click the app icon.
    shortcuts: [
      { name: 'New scene', short_name: 'New scene', url: '/?action=new-scene', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
      { name: 'Scratchpad', short_name: 'Scratchpad', url: '/?action=scratchpad', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
      { name: 'Writing goals', short_name: 'Goals', url: '/?view=goals', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
    ],
    // Installed app can open .inkwell backups directly (Chromium desktop).
    file_handlers: [{ action: '/', accept: { 'application/json': ['.inkwell'] } }],
    launch_handler: { client_mode: 'focus-existing' },
  },
  workbox: {
    // .mjs: the PDF reader's worker, so PDF import works offline too.
    globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest}'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-css' },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-files',
          expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Dictionary/thesaurus lookups: fresh when online, cached answers offline.
        urlPattern: /^https:\/\/api\.(dictionaryapi\.dev|datamuse\.com)\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'word-lookups',
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
  devOptions: { enabled: false },
});

// Vite + Vitest configuration for Inkwell.
export default defineConfig({
  plugins: [react(), ...(process.env.VITEST ? [] : [pwa])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Split heavy, rarely-needed libraries into their own chunks so the
        // writing surface loads fast.
        manualChunks: {
          react: ['react', 'react-dom'],
          mui: ['@mui/material'],
          tiptap: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/pm/state', '@tiptap/pm/view', '@tiptap/pm/model'],
          exporters: ['docx', 'jspdf', 'jszip'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
