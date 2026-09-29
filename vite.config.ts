import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { CHANGELOG } from './src/ui/changelog';

/**
 * Publishes the release notes as changelog.json next to the game, so an
 * older version can preview them in its update banner (src/ui/changelog.ts).
 */
function changelogJson(): Plugin {
  const json = () => JSON.stringify(CHANGELOG);
  return {
    name: 'genlab-changelog',
    configureServer(server) {
      server.middlewares.use('/changelog.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(json());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'changelog.json', source: json() });
    },
  };
}

export default defineConfig({
  // Relative base so the build also works from file:// and inside Tauri/Capacitor.
  base: './',
  plugins: [
    svelte(),
    changelogJson(),
    // Installable web app with offline cache. The service worker is only
    // registered in browsers (see src/ui/platform/pwa.ts), not in the native shells.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon-64.png', 'icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Genlab – Idle-Kreaturenzucht',
        short_name: 'Genlab',
        description: 'Idle-Game rund um Kreaturenzucht und Genetik.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#071317',
        theme_color: '#0b1a1f',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // No json: changelog.json must always come fresh from the server.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        // Opens the game when a reminder is tapped (see src/ui/platform/notify.ts).
        importScripts: ['sw-notify.js'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
