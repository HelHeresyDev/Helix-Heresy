// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Optional visual QC environment variables:
 *
 * VISUAL_MONITOR=2
 *   Moves headed Chromium windows to the second monitor, assuming monitor 2
 *   is arranged to the right of monitor 1 in Windows display settings.
 *
 * VISUAL_WINDOW_X=2560
 * VISUAL_WINDOW_Y=0
 *   Override the headed browser window position.
 *   Use a negative X value if monitor 2 is arranged to the left.
 *
 * VISUAL_WINDOW_WIDTH=2560
 * VISUAL_WINDOW_HEIGHT=1440
 *   Optional headed browser window size hints.
 *
 * VISUAL_MAXIMIZED=1
 *   Starts the headed Chromium window maximized.
 *
 * Example PowerShell:
 *   $env:VISUAL_MONITOR="2"
 *   $env:VISUAL_PAUSE_MS=8000
 *   npx playwright test tests/bedroom-doors-pass1.spec.js --project=chromium --headed
 */

const isVisualMonitorMode = process.env.VISUAL_MONITOR === '2' || Boolean(process.env.VISUAL_WINDOW_X);
const visualWindowX = process.env.VISUAL_WINDOW_X ?? (process.env.VISUAL_MONITOR === '2' ? '2560' : '0');
const visualWindowY = process.env.VISUAL_WINDOW_Y ?? '0';
const visualWindowWidth = process.env.VISUAL_WINDOW_WIDTH ?? '2560';
const visualWindowHeight = process.env.VISUAL_WINDOW_HEIGHT ?? '1440';
const shouldMaximizeVisualWindow = process.env.VISUAL_MAXIMIZED !== '0';

// Desktop Chrome device settings include deviceScaleFactor.
// Playwright does not allow deviceScaleFactor when viewport is null, so visual
// monitor mode intentionally strips viewport/deviceScaleFactor and lets the
// real headed browser window define the viewport.
const { viewport, deviceScaleFactor, ...desktopChromeWithoutViewport } = devices['Desktop Chrome'];

const visualChromiumLaunchOptions = isVisualMonitorMode
  ? {
      args: [
        `--window-position=${visualWindowX},${visualWindowY}`,
        `--window-size=${visualWindowWidth},${visualWindowHeight}`,
        ...(shouldMaximizeVisualWindow ? ['--start-maximized'] : []),
      ],
    }
  : undefined;

const chromiumUse = isVisualMonitorMode
  ? {
      ...desktopChromeWithoutViewport,
      viewport: null,
      launchOptions: visualChromiumLaunchOptions,
    }
  : {
      ...devices['Desktop Chrome'],
    };

export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: chromiumUse,
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
