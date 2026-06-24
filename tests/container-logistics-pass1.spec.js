// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

async function stageContainerLogisticsSave(page) {
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!container) {
      throw new Error('basic-1 container not found');
    }
    container.roomId = 'mainLab';
    container.name = 'Logistics Jar';
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'mainLab';
    state.tasks = [];
    state.selectedSlimeId = 'logistics-slime-1';
    state.slimes = [
      {
        id: 'logistics-slime-1',
        name: 'LOG-001',
        genome: (state.currentGenome || 'ACGTACGTACGTACGTACGTACGTAC').slice(0, 26).padEnd(26, 'A'),
        source: 'QC setup',
        createdAt: 0,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: container.id,
        // Deliberately stale: contained specimen location should come from the container.
        roomId: 'menagerie',
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {},
        revealed: { byproduct: true, element: true, consistency: true },
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {},
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
}

test('queued container hauling stages contained specimens by container location', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  await stageContainerLogisticsSave(page);

  await expect(page.locator('#selectedSlimeSummary')).toContainText('LOG-001');
  await expect(page.locator('#selectedSlimeSummary')).toContainText('Contained in Logistics Jar');
  await expect(page.locator('#selectedSlimeSummary')).toContainText('Room: Main Lab');
  await expect(page.locator('#roomList')).toContainText('Collection status: No staged containers');

  await page.locator('[data-container-room-select="basic-1"]').selectOption('collectionBay');

  await page.locator('#queueToggleBtn').click();
  const taskRow = page.locator('#taskList .task-row').filter({ hasText: 'Haul Logistics Jar to Collection Bay' });
  await expect(taskRow).toBeVisible();
  await expect(page.locator('#selectedSlimeSummary')).toContainText('hauling to Collection Bay');
  await taskRow.getByRole('button', { name: 'Finish' }).click();

  await expect(page.locator('#selectedSlimeSummary')).toContainText('Room: Collection Bay');
  await expect(page.locator('#roomList')).toContainText('Collection status: 1 collection station; 1 specimen ready for readout');
  await expect(page.locator('#roomList')).toContainText('LOG-001 in Logistics Jar');

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
