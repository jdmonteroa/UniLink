import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, statSync } from 'node:fs';

// https://vitejs.dev/config/
// Tamaño del APK en MB, calculado al compilar para que la página de descarga nunca quede desfasada
const APK_PATH = fileURLToPath(new URL('./public/downloads/unilink.apk', import.meta.url));
const apkSizeMb = existsSync(APK_PATH) ? (statSync(APK_PATH).size / 1024 / 1024).toFixed(1) : '';

export default defineConfig({
  define: { __APK_SIZE_MB__: JSON.stringify(apkSizeMb) },
  plugins: [
    react(),
    tailwindcss(),
    // App instalable (PWA): manifiesto, íconos y service worker para que abra
    // rápido, funcione sin conexión y avise cuando hay una versión nueva.
    VitePWA({
      registerType: 'prompt', // la app muestra "Hay una versión nueva" en vez de recargar sola
      injectRegister: null, // el registro lo hace src/components/PwaPrompts.tsx
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'favicon-48x48.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'UniLink',
        short_name: 'UniLink',
        description:
          'Conecta con estudiantes de tu campus para estudio, amistad o pareja de forma segura y verificada.',
        lang: 'es-MX',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F4F0',
        theme_color: '#F5F4F0',
        categories: ['social', 'education', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        // El APK y la verificación de Android no son páginas de la app: sin esto el service worker
        // contestaría con index.html y la descarga bajaría la web en vez del APK.
        navigateFallbackDenylist: [/^\/downloads\//, /^\/\.well-known\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Tipografías de Google: se guardan para que la app se vea igual sin conexión
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
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Fotos de perfil (bucket público de Supabase). Cada foto tiene un nombre
          // único y nunca cambia, así que se pueden guardar sin riesgo.
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'profile-photos',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Todo lo demás de Supabase (sesión, datos, chat) va siempre a la red.
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Separa las librerías grandes en archivos propios (carga más rápida y
        // evita el aviso de "chunk > 500 kB").
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
