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

function residueTestSlime({ id, name, genome, containerId, roomId = 'mainLab', job = 'idle', jobProgress = 0, stats = {} }) {
  return {
    id,
    name,
    genome,
    source: 'Feeding residue fixture',
    createdAt: 0,
    deathAt: 10000,
    lifecycleVersion: 1,
    matureAt: 0,
    mature: true,
    status: 'contained',
    containerId,
    roomId,
    job,
    jobProgress,
    jobTargetCorpseId: null,
    jobNutritionGained: 0,
    stats,
    revealed: { sustenance: true, element: true, consistency: true },
    measured: {},
    traitObservations: {},
    testsRun: [],
    jobKnowledge: {},
  };
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

test('intended feedstock stays clean while mismatched feedstock leaves local residue', async ({ page }) => {
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
    jar.name = 'Residue Test Jar';
    jar.roomId = 'mainLab';
    state.started = true;
    state.paused = true;
    state.selectedSlimeId = 'residue-clean';
    state.resources = {
      ...(state.resources || {}),
      organicFeedstock: 2,
      metalFeedstock: 2,
      waste: 0,
    };
    state.roomStockpiles ||= {};
    state.roomStockpiles.mainLab ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    state.roomStockpiles.mainLab.resources = {
      ...(state.roomStockpiles.mainLab.resources || {}),
      organicFeedstock: 2,
      metalFeedstock: 2,
    };
    state.feedingResidues = [];
    state.nextResidueNumber = 1;
    state.slimes = [
      {
        id: 'residue-clean',
        name: 'RES-CLEAN',
        genome,
        source: 'Feeding residue fixture',
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

  const selectedCard = page.locator('[data-slime-card="residue-clean"]');
  const feedstockSelect = selectedCard.getByLabel('Feedstock');
  await feedstockSelect.selectOption('organicFeedstock');
  await selectedCard.getByRole('button', { name: 'Feed', exact: true }).click();

  await expect(page.locator('#containerList')).not.toContainText('Interior feeding residue');
  let residueState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.feedingResidues || [];
  }, { key: storageKey });
  expect(residueState).toEqual([]);

  await feedstockSelect.selectOption('metalFeedstock');
  await selectedCard.getByRole('button', { name: 'Feed', exact: true }).click();

  await expect(page.locator('#containerList')).toContainText('Interior feeding residue');
  await expect(page.locator('#containerList')).toContainText('Inert residue');
  await expect(page.locator('#jobSummary')).toContainText('1 local residue');

  residueState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.feedingResidues || [];
  }, { key: storageKey });
  expect(residueState).toEqual(expect.arrayContaining([
    expect.objectContaining({
      typeKey: 'inertResidue',
      amount: 1,
      location: expect.objectContaining({ type: 'container', containerId: 'basic-1' }),
    }),
  ]));

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('waste disposal can leave local feeding residue apart from elemental residue stockpiles', async ({ page }) => {
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
  const hazardGenome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      sustenance: 'hazard feeder',
      element: 'none',
      consistency: 'soft gelatin',
      behavior: 'idle pooling',
      stability: 'steady',
    },
  });
  const workerSlime = residueTestSlime({
    id: 'residue-worker',
    name: 'RES-WORKER',
    genome: hazardGenome,
    containerId: 'basic-11',
    roomId: 'pits',
    job: 'disposal',
    jobProgress: 999999,
    stats: { bodyIntegrity: { current: 100, max: 100 }, nutrition: { current: 50, max: 100 } },
  });

  await page.evaluate(({ key, slime }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const pit = (state.containers || []).find((item) => item.id === 'basic-11');
    if (!pit) {
      throw new Error('basic-11 pit container not found');
    }
    pit.name = 'Residue Pit';
    pit.roomId = 'pits';
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'pits';
    state.selectedSlimeId = 'residue-worker';
    state.resources = {
      ...(state.resources || {}),
      waste: 1,
      elementalResidue: 0,
    };
    state.feedingResidues = [];
    state.nextResidueNumber = 1;
    state.tasks = [];
    state.slimes = [slime];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, slime: workerSlime });
  await loadSavedRun(page);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#skipAmountInput').fill('1');
  await page.locator('#skipTimeBtn').click();

  await expect(page.locator('#containerList')).toContainText('Interior feeding residue');
  await expect(page.locator('#containerList')).toContainText('Inert residue');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      waste: state.resources?.waste,
      elementalResidue: state.resources?.elementalResidue,
      residues: state.feedingResidues || [],
    };
  }, { key: storageKey });

  expect(result.waste).toBe(0);
  expect(result.elementalResidue).toBe(0);
  expect(result.residues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      typeKey: 'inertResidue',
      amount: 1,
      location: expect.objectContaining({ type: 'container', containerId: 'basic-11' }),
    }),
  ]));

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
