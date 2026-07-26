// @ts-check
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

const smokeTestFiles = [
  '**/simulation-runtime.spec.js',
  '**/map-navigation-smoke.spec.js',
  '**/map-visual-state.spec.js',
  '**/canvas-map-renderer.spec.js',
  '**/terrain-connectivity.spec.js',
  '**/ui-state-persistence.spec.js',
];

const chromiumProject = baseConfig.projects?.find((project) => project.name === 'chromium');

if (!chromiumProject) {
  throw new Error('The smoke suite requires the Chromium project from playwright.config.js.');
}

export default defineConfig({
  ...baseConfig,
  testMatch: smokeTestFiles,
  projects: [chromiumProject],
});
