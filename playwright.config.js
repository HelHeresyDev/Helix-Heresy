// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Optional visual QC environment variables:
 *
 * VISUAL_WINDOW_X=1920
 * VISUAL_WINDOW_Y=0
 *   Request a headed browser window position. Coordinates depend on the
 *   Ubuntu display layout; use a negative X value for a monitor on the left.
 *
 * VISUAL_WINDOW_WIDTH=1600
 * VISUAL_WINDOW_HEIGHT=1000
 *   Optional headed browser window size hints.
 *
 * VISUAL_MAXIMIZED=1
 *   Starts the headed Chromium window maximized.
 *
 * Example Bash:
 *   VISUAL_WINDOW_X=1920 VISUAL_WINDOW_Y=0 npm run test:headed -- tests/canvas-map-renderer.spec.js
 *
 * Some Wayland compositors may ignore requested window positions. Running
 * VS Code under XWayland or moving the window manually remains a valid fallback.
 */

const visualWindowVariables = [
  'VISUAL_WINDOW_X',
  'VISUAL_WINDOW_Y',
  'VISUAL_WINDOW_WIDTH',
  'VISUAL_WINDOW_HEIGHT',
  'VISUAL_MAXIMIZED',
];
const isVisualWindowMode = visualWindowVariables.some((name) => process.env[name] !== undefined);
const visualWindowX = process.env.VISUAL_WINDOW_X ?? '0';
const visualWindowY = process.env.VISUAL_WINDOW_Y ?? '0';
const visualWindowWidth = process.env.VISUAL_WINDOW_WIDTH ?? '1600';
const visualWindowHeight = process.env.VISUAL_WINDOW_HEIGHT ?? '1000';
const shouldMaximizeVisualWindow = process.env.VISUAL_MAXIMIZED !== '0';

// Desktop Chrome device settings include deviceScaleFactor.
// Playwright does not allow deviceScaleFactor when viewport is null, so visual
// visual window mode intentionally strips viewport/deviceScaleFactor and lets the
// real headed browser window define the viewport.
const { viewport, deviceScaleFactor, ...desktopChromeWithoutViewport } = devices['Desktop Chrome'];

const visualChromiumLaunchOptions = isVisualWindowMode
  ? {
      args: [
        `--window-position=${visualWindowX},${visualWindowY}`,
        `--window-size=${visualWindowWidth},${visualWindowHeight}`,
        ...(shouldMaximizeVisualWindow ? ['--start-maximized'] : []),
      ],
    }
  : undefined;

const chromiumUse = isVisualWindowMode
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
  /* Keep local browser load predictable; CI remains fully serial. */
  workers: process.env.CI ? 1 : 4,
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
