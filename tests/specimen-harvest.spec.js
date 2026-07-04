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

function livingSlimeFixture({ id, name, genome, containerId = 'basic-1', roomId = 'mainLab', stats = {} }) {
  return {
    id,
    name,
    genome,
    source: 'Specimen harvest fixture',
    createdAt: 0,
    deathAt: 10000,
    lifecycleVersion: 1,
    matureAt: 0,
    mature: true,
    status: 'contained',
    containerId,
    roomId,
    automationExcluded: false,
    job: 'idle',
    jobProgress: 0,
    jobTargetCorpseId: null,
    jobNutritionGained: 0,
    stats,
    revealed: {},
    measured: {},
    traitObservations: {},
    testsRun: [],
    jobKnowledge: {},
  };
}

async function finishQueuedTask(page, label) {
  await page.locator('#queueToggleBtn').click();
  const taskRow = page.locator('#taskList .task-row').filter({ hasText: label }).first();
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole('button', { name: 'Finish' }).click();
}

test('sampling a living specimen stores harvested material and worsens condition', async ({ page }) => {
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
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'acid', consistency: 'watery' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!jar) {
      throw new Error('basic-1 container not found');
    }
    jar.roomId = 'mainLab';
    state.started = true;
    state.paused = true;
    state.selectedSlimeId = 'harvest-live';
    state.tasks = [];
    state.specimenMaterials = {};
    state.scientist ||= {};
    state.scientist.vitals ||= {};
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.slimes = [
      {
        id: 'harvest-live',
        name: 'HAR-LIVE',
        genome,
        source: 'Specimen harvest fixture',
        createdAt: 0,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: jar.id,
        roomId: jar.roomId,
        automationExcluded: false,
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {
          bodyIntegrity: { current: 80, max: 100 },
          nutrition: { current: 50, max: 100 },
          currentMass: { current: 100, max: 100 },
          divisionPressure: { current: 0, max: 100 },
          stress: { current: 5, max: 100 },
        },
        revealed: {},
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {},
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  const selectedCard = page.locator('[data-slime-card="harvest-live"]');
  await selectedCard.getByRole('button', { name: /Sample Living Tissue/ }).click();
  await finishQueuedTask(page, 'Sample Living Tissue');

  await expect(page.locator('#inventoryList')).toContainText('Harvested Specimen Materials');
  await expect(page.locator('#inventoryList')).toContainText('Caustic tissue');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((item) => item.id === 'harvest-live');
    return {
      entries: Object.values(state.specimenMaterials || {}),
      bodyIntegrity: slime?.stats?.bodyIntegrity?.current,
      currentMass: slime?.stats?.currentMass?.current,
      stress: slime?.stats?.stress?.current,
    };
  }, { key: storageKey });

  expect(result.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: 'Caustic tissue',
      amount: expect.any(Number),
      tags: expect.arrayContaining(['caustic', 'fluid', 'living', 'sample']),
    }),
  ]));
  expect(result.entries[0].amount).toBeGreaterThan(0);
  expect(result.bodyIntegrity).toBe(78);
  expect(result.currentMass).toBe(99);
  expect(result.stress).toBeGreaterThanOrEqual(9);
  expect(result.stress).toBeLessThan(9.1);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('breaking down a living specimen consumes it and stores specimen material', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'none', consistency: 'fibrous gel' },
  });

  await page.evaluate(({ key, slime }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!jar) {
      throw new Error('basic-1 container not found');
    }
    state.started = true;
    state.paused = true;
    state.selectedSlimeId = slime.id;
    state.tasks = [];
    state.specimenMaterials = {};
    state.scientist ||= {};
    state.scientist.vitals ||= {};
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.slimes = [{ ...slime, containerId: jar.id, roomId: jar.roomId }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: storageKey,
    slime: livingSlimeFixture({
      id: 'harvest-terminal',
      name: 'HAR-END',
      genome,
      stats: {
        bodyIntegrity: { current: 90, max: 100 },
        nutrition: { current: 70, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    }),
  });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-slime-card="harvest-terminal"]').getByRole('button', { name: /Break Down Specimen/ }).click();
  await finishQueuedTask(page, 'Break Down Specimen');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      livingIds: (state.slimes || []).map((slime) => slime.id),
      entries: Object.values(state.specimenMaterials || {}),
    };
  }, { key: storageKey });

  expect(result.livingIds).not.toContain('harvest-terminal');
  expect(result.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: 'Slime fibers',
      tags: expect.arrayContaining(['fibrous', 'living', 'breakdown']),
    }),
  ]));
});

test('breaking down a corpse removes the corpse and stores harvested material', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'none', consistency: 'crystalline gel' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.started = true;
    state.paused = true;
    state.clock = 10;
    state.tasks = [];
    state.slimes = [];
    state.specimenMaterials = {};
    state.scientist ||= {};
    state.scientist.vitals ||= {};
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.corpses = [
      {
        id: 'corpse-harvest',
        specimenId: 'dead-harvest',
        name: 'HAR-DEAD',
        genome,
        source: 'Specimen harvest fixture',
        deathReason: 'fixture',
        diedAt: 0,
        roomId: 'mainLab',
        containerId: null,
        storage: 'drum',
        consumedProgress: 0,
        ruined: false,
        harvestedProcedures: {},
        revealed: {},
        measured: {},
        traitObservations: {},
        testsRun: [],
        necropsyReport: '',
        freshUntil: 120 * 60,
        spoiledAt: 240 * 60,
        lastFreshness: 'fresh',
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-corpse-card="corpse-harvest"]').getByRole('button', { name: /Break Down Corpse/ }).click();
  await finishQueuedTask(page, 'Break Down Corpse');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      corpseIds: (state.corpses || []).map((corpse) => corpse.id),
      entries: Object.values(state.specimenMaterials || {}),
    };
  }, { key: storageKey });

  expect(result.corpseIds).not.toContain('corpse-harvest');
  expect(result.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: 'Crystal shards',
      tags: expect.arrayContaining(['crystalline', 'corpse', 'fresh', 'breakdown']),
    }),
  ]));
});
