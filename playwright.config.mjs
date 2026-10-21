import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://localhost:3100', reducedMotion: 'reduce', channel: process.env.BILAD_TEST_BROWSER_CHANNEL || undefined, trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 3100', url: 'http://localhost:3100/ai/', reuseExistingServer: false, timeout: 120000,
    env: { BILAD_NEXT_DIST_DIR: '.next-playwright', NEXT_PUBLIC_BILAD_AI_API_URL: 'http://127.0.0.1:5000', NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: '' },
  },
});
