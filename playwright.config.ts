import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

/** Testy czysto API-owe mają sufiks `.api.spec.ts` i chodzą bez przeglądarki. */
const API_SPEC = /.*\.api\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 2 : 0,
  // Każdy test loguje się osobno (argon2 po stronie API), a backend
  // deweloperski chodzi na tej samej maszynie — nie zalewamy go.
  workers: env.isCI ? 2 : 4,
  reporter: env.isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  // Środowisko wstaje przed testami: Docker, kontenery, migracje, seed i
  // `pnpm dev`. Playwright podnosi `webServer` przed `globalSetup`, więc to tu,
  // a nie w global-setup. Gdy aplikacja już odpowiada, skrypt nie rusza
  // niczego, a Playwright nie zamknie po testach serwera, którego nie stawiał.
  webServer: env.startEnvironment
    ? {
        name: 'Testarium',
        command: 'node scripts/environment.mts',
        url: `${env.baseUrl}/api/health`,
        reuseExistingServer: !env.isCI,
        // Zimny start: Docker Desktop do 4 min, potem migracje, seed i kompilacja.
        timeout: 8 * 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
      }
    : undefined,
  globalSetup: './src/global-setup.ts',
  // Spowolnione akcje (`E2E_SLOW_MO`) nie mieszczą się w domyślnych 30 s na test.
  timeout: env.slowMo ? 180_000 : 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: env.baseUrl,
    launchOptions: { slowMo: env.slowMo },
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: API_SPEC,
    },
    {
      name: 'chromium',
      testIgnore: API_SPEC,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
