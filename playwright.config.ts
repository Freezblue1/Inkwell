/**
 * End-to-end tests (Playwright).
 *
 * - `web`: the whiteboard in a real browser (Microsoft Edge, already on Windows),
 *   against a production build served by `vite preview`.
 * - `desktop`: the Electron app (main process, preload, IPC, file access),
 *   launched from this checkout with a throwaway profile folder.
 *
 * Both use the build in dist/, made by the web server step below.
 * Run: `npm run e2e` (or `npm run e2e:web`, `npm run e2e:desktop`).
 */
import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'web',
      testDir: 'e2e/web',
      use: {
        channel: 'msedge',
        baseURL: `http://localhost:${PORT}`,
        viewport: { width: 1400, height: 900 },
        // The PWA service worker would cache between tests.
        serviceWorkers: 'block',
      },
    },
    {
      name: 'desktop',
      testDir: 'e2e/desktop',
    },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always build and serve fresh, so the tests never run against an old build.
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
  },
});
