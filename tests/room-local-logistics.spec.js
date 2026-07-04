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

  await expect(page.locator('#inventorySummary')).toContainText('room-local stockpiles');
  await page.locator('[data-workspace-tab="foundry"]').click();
  await expect(page.locator('#synthesizeBtn')).toHaveAttribute('title', /Biomass: need 10 in Main Lab; 0 here \/ 50 known total/);
  await expect(page.locator('#synthesizeBtn')).toHaveAttribute('title', /One click will queue material hauling/);
  await page.locator('#synthesizeBtn').click();

  await page.locator('#queueToggleBtn').click();
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

test('resource overlay and selection inspector show known room supplies', async ({ page }) => {
  await startRun(page);

  const fixture = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const pit = (state.containers || []).find((item) => item.id === 'basic-11')
      || (state.containers || []).find((item) => String(item.typeId || '').includes('DirtPit'));
    if (!pit) {
      throw new Error('starter pit not found');
    }
    pit.name = 'Overlay Waste Pit';
    pit.roomId = 'pits';
    pit.waste = { amount: 3, tags: { waste: 3, hazardous: 3 } };
    state.scientist ||= {};
    state.scientist.roomId = 'mainLab';
    state.scientist.mapCell = state.labMap.rooms.mainLab.anchor;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
    return {
      mainCell: state.labMap.rooms.mainLab.anchor,
      storageCell: state.labMap.rooms.storageRoom.anchor,
      pitsCell: state.labMap.rooms.pits.anchor,
    };
  }, { key: storageKey });
  await loadSavedRun(page);

  await page.locator('[data-room-card="storageRoom"]').click();
  const inspector = page.locator('[data-selection-inspector="true"]');
  await expect(inspector).toHaveAttribute('data-selection-kind', 'room');
  await expect(inspector).toContainText('Known Supplies');
  await expect(inspector).toContainText('Last inventoried');
  await expect(inspector).toContainText('Biomass');
  await expect(inspector).toContainText('Hook pole');

  const storageTile = page.locator(`[data-map-x="${fixture.storageCell.x}"][data-map-y="${fixture.storageCell.y}"]`);
  const mainTile = page.locator(`[data-map-x="${fixture.mainCell.x}"][data-map-y="${fixture.mainCell.y}"]`);
  const pitsTile = page.locator(`[data-map-x="${fixture.pitsCell.x}"][data-map-y="${fixture.pitsCell.y}"]`);

  await page.locator('[data-map-overlay-select="true"]').selectOption('resources');
  const focusSelect = page.locator('[data-resource-overlay-focus-select="true"]');
  await expect(focusSelect).toHaveValue('resource:biomass');
  await expect(storageTile).toHaveAttribute('data-map-overlay', 'resources');
  await expect(storageTile).toHaveAttribute('data-map-overlay-label', /Storage Room: Biomass/);
  await expect(storageTile).toHaveAttribute('data-map-overlay-value', '50');
  await expect(mainTile).not.toHaveAttribute('data-map-overlay', /.+/);

  await focusSelect.selectOption('category:tools');
  await expect(storageTile).toHaveAttribute('data-map-overlay-label', /Storage Room: Tools & Supplies/);
  await expect(storageTile).toHaveAttribute('data-map-overlay-value', '4');

  await page.locator('[data-room-card="pits"]').click();
  await expect(inspector).toContainText('Pit contents: Waste');
  await expect(inspector).toContainText('3');

  await focusSelect.selectOption('resource:waste');
  await expect(pitsTile).toHaveAttribute('data-map-overlay-label', /Pits: Pit contents: Waste/);
  await expect(pitsTile).toHaveAttribute('data-map-overlay-value', '3');
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

  await page.locator('[data-workspace-tab="specimens"]').click();
  const selectedCard = page.locator('[data-slime-card="feed-delivery"]');
  const feedstockSelect = selectedCard.getByLabel('Feedstock');
  await expect(feedstockSelect.locator('option[value="organicFeedstock"]')).toContainText('0 here / 1 total');
  await feedstockSelect.selectOption('organicFeedstock');
  await selectedCard.getByRole('button', { name: 'Feed', exact: true }).click();

  await page.locator('#queueToggleBtn').click();
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
