/**
 * Generates PWA icons from public/icon.svg:
 *   npm run generate-pwa-assets
 * Output: pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
 * maskable-icon-512x512.png, apple-touch-icon-180x180.png, favicon.ico
 */
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const background = '#283593';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
