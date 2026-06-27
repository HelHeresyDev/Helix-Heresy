// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { genomeForTraits } = require('./gene-fixtures');

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

async function saveContext(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });
}

test('synthesis queues Biomass hauling before starting the synthesis task', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  await page.locator('#queueToggleBtn').click();

  await expect(page.locator('#inventorySummary')).toContainText('room-local stockpiles');
  await page.locator('#synthesizeBtn').click();

  const haulTask = page.locator('#taskList .task-row').filter({ hasText: 'Haul materials for Synthesize slime' });
  await expect(haulTask).toBeVisible();

  let logisticsState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      biomass: state.resources?.biomass,
      mainBiomass: state.roomStockpiles?.mainLab?.resources?.biomass || 0,
      storageBiomass: state.roomStockpiles?.storageRoom?.resources?.biomass || 0,
      taskTypes: (state.tasks || []).map((task) => task.type),
    };
  }, { key: storageKey });

  expect(logisticsState.biomass).toBe(50);
  expect(logisticsState.mainBiomass).toBe(0);
  expect(logisticsState.storageBiomass).toBe(50);
  expect(logisticsState.taskTypes).toEqual(['resourceHaul']);

  await haulTask.getByRole('button', { name: 'Finish' }).click();

  const synthTask = page.locator('#taskList .task-row').filter({ hasText: 'Synthesize slime' });
  await expect(synthTask).toBeVisible();

  logisticsState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      biomass: state.resources?.biomass,
      mainBiomass: state.roomStockpiles?.mainLab?.resources?.biomass || 0,
      storageBiomass: state.roomStockpiles?.storageRoom?.resources?.biomass || 0,
      taskTypes: (state.tasks || []).map((task) => task.type),
    };
  }, { key: storageKey });

  expect(logisticsState.biomass).toBe(40);
  expect(logisticsState.mainBiomass).toBe(0);
  expect(logisticsState.storageBiomass).toBe(40);
  expect(logisticsState.taskTypes).toEqual(['synthesize']);

  await synthTask.getByRole('button', { name: 'Finish' }).click();

  const finalState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      biomass: state.resources?.biomass,
      mainBiomass: state.roomStockpiles?.mainLab?.resources?.biomass || 0,
      storageBiomass: state.roomStockpiles?.storageRoom?.resources?.biomass || 0,
      slimes: (state.slimes || []).map((slime) => ({ name: slime.name, containerId: slime.containerId })),
      taskCount: (state.tasks || []).length,
    };
  }, { key: storageKey });

  expect(finalState.biomass).toBe(40);
  expect(finalState.mainBiomass).toBe(0);
  expect(finalState.storageBiomass).toBe(40);
  expect(finalState.slimes).toHaveLength(1);
  expect(finalState.slimes[0].containerId).toBe('synthesisTube');
  expect(finalState.taskCount).toBe(0);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('manual feeding queues feedstock delivery when the stockpile is in another room', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  const context = await saveContext(page);
  const organicGenome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { sustenance: 'organic feeder' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!jar) {
      throw new Error('basic-1 container not found');
    }
    jar.name = 'Delivery Test Jar';
    jar.roomId = 'mainLab';
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'mainLab';
    state.selectedSlimeId = 'feed-delivery';
    state.resources = {
      ...(state.resources || {}),
      organicFeedstock: 1,
    };
    state.tasks = [];
    state.feedingResidues = [];
    state.slimes = [
      {
        id: 'feed-delivery',
        name: 'FEED-001',
        genome,
        source: 'Room-local logistics fixture',
        createdAt: 0,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: jar.id,
        roomId: jar.roomId,
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: { nutrition: { current: 10, max: 100 }, currentMass: { current: 50, max: 100 } },
        revealed: { sustenance: true },
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {},
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome: organicGenome });
  await loadSavedRun(page);
  await page.locator('#queueToggleBtn').click();

  const selectedCard = page.locator('[data-slime-card="feed-delivery"]');
  const feedstockSelect = selectedCard.getByLabel('Feedstock');
  await expect(feedstockSelect.locator('option[value="organicFeedstock"]')).toContainText('0 here / 1 total');
  await feedstockSelect.selectOption('organicFeedstock');
  await selectedCard.getByRole('button', { name: 'Feed', exact: true }).click();

  const haulTask = page.locator('#taskList .task-row').filter({ hasText: 'Haul materials for feeding FEED-001' });
  await expect(haulTask).toBeVisible();
  await haulTask.getByRole('button', { name: 'Finish' }).click();

  await expect(page.locator('#taskList')).toContainText('Queue is clear');
  await expect(page.locator('#containerList')).not.toContainText('Interior feeding residue');

  const finalState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'feed-delivery');
    return {
      organic: state.resources?.organicFeedstock,
      mainOrganic: state.roomStockpiles?.mainLab?.resources?.organicFeedstock || 0,
      storageOrganic: state.roomStockpiles?.storageRoom?.resources?.organicFeedstock || 0,
      nutrition: slime?.stats?.nutrition?.current,
      residues: state.feedingResidues || [],
    };
  }, { key: storageKey });

  expect(finalState.organic).toBe(0);
  expect(finalState.mainOrganic).toBe(0);
  expect(finalState.storageOrganic).toBe(0);
  expect(finalState.nutrition).toBeGreaterThan(10);
  expect(finalState.residues).toEqual([]);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
