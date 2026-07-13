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

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

function jobSlime({ id, name, genome, containerId, job, jobTargetCorpseId = null, jobProgress = 0 }) {
  return {
    id,
    name,
    genome,
    source: 'Job autonomy fixture',
    createdAt: 0,
    deathAt: 100000,
    lifecycleVersion: 1,
    matureAt: 0,
    mature: true,
    status: 'contained',
    containerId,
    roomId: 'pits',
    mapCell: null,
    job,
    jobProgress,
    jobTargetCorpseId,
    jobNutritionGained: 0,
    revealed: {
      sustenance: true,
      element: true,
      consistency: true,
      behavior: true,
      stability: true,
      size: true,
      shape: true,
    },
    measured: {},
    traitObservations: {},
    testsRun: [],
    jobKnowledge: {},
    stats: {
      bodyIntegrity: { current: 100, max: 100 },
      nutrition: { current: 50, max: 100 },
      stress: { current: 0, max: 100 },
      currentMass: { current: 100, max: 100 },
      divisionPressure: { current: 0, max: 100 },
    },
  };
}

function ruinedCorpse({ id, name, genome, containerId }) {
  return {
    id,
    specimenId: id.replace('corpse-', 'slime-'),
    name,
    genome,
    source: 'Job autonomy fixture',
    deathReason: 'fixture',
    diedAt: 0,
    roomId: 'pits',
    containerId,
    storage: 'container',
    mapCell: null,
    consumedProgress: 0,
    ruined: true,
    revealed: {},
    measured: {},
    traitObservations: {},
    testsRun: [],
    necropsyReport: '',
    harvestedProcedures: {},
  };
}

test('corpse processing only targets remains inside the worker pit', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  const context = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      sustenance: 'carrion feeder',
      element: 'none',
      consistency: 'mucous',
      behavior: 'idle pooling',
      stability: 'steady',
    },
  });
  const workerSlime = jobSlime({
    id: 'pit-worker',
    name: 'PIT-WORKER',
    genome,
    containerId: 'basic-11',
    job: 'corpse',
    jobTargetCorpseId: null,
    jobProgress: 0,
  });
  const sameCorpse = ruinedCorpse({ id: 'same-corpse', name: 'SAME-CORPSE', genome, containerId: 'basic-11' });
  const otherCorpse = ruinedCorpse({ id: 'other-corpse', name: 'OTHER-CORPSE', genome, containerId: 'basic-12' });
  sameCorpse.diedAt = 10;
  otherCorpse.diedAt = 0;

  await page.evaluate(({ key, workerSlime, sameCorpse, otherCorpse }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const workerPit = (state.containers || []).find((item) => item.id === 'basic-11');
    const otherPit = (state.containers || []).find((item) => item.id === 'basic-12');
    if (!workerPit || !otherPit) {
      throw new Error('pit containers not found');
    }
    workerPit.name = 'Worker Pit';
    workerPit.roomId = 'pits';
    workerPit.waste = { amount: 0, tags: {} };
    otherPit.name = 'Other Pit';
    otherPit.roomId = 'pits';
    otherPit.waste = { amount: 0, tags: {} };
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'pits';
    state.tasks = [];
    state.policies ||= {};
    state.policies.corpseProcessingTargets = { fresh: true, decaying: true, spoiled: true, ruined: true };
    state.selectedSlimeId = 'pit-worker';
    state.slimes = [workerSlime];
    state.corpses = [sameCorpse, otherCorpse];
    state.feedingResidues = [];
    state.nextResidueNumber = 1;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, workerSlime, sameCorpse, otherCorpse });
  await loadSavedRun(page);

  await skipSeconds(page, 1);

  await expect(page.locator('#jobList')).toContainText('site Worker Pit');
  await expect(page.locator('#containerList')).toContainText('pit Waste');

  let result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const worker = state.slimes.find((slime) => slime.id === 'pit-worker');
    return {
      corpseIds: state.corpses.map((corpse) => corpse.id),
      workerTarget: worker?.jobTargetCorpseId || null,
    };
  }, { key: storageKey });

  expect(result.corpseIds).toEqual(['same-corpse', 'other-corpse']);
  expect(result.workerTarget).toBe('same-corpse');

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const worker = state.slimes.find((slime) => slime.id === 'pit-worker');
    if (!worker) {
      throw new Error('pit-worker not found');
    }
    worker.jobProgress = 999999;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
  await skipSeconds(page, 1);

  result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const worker = state.slimes.find((slime) => slime.id === 'pit-worker');
    const workerPit = state.containers.find((item) => item.id === 'basic-11');
    const otherPit = state.containers.find((item) => item.id === 'basic-12');
    return {
      corpseIds: state.corpses.map((corpse) => corpse.id),
      workerTarget: worker?.jobTargetCorpseId || null,
      workerPitWaste: workerPit?.waste?.amount || 0,
      otherPitWaste: otherPit?.waste?.amount || 0,
    };
  }, { key: storageKey });

  expect(result.corpseIds).toEqual(['other-corpse']);
  expect(result.workerTarget).toBeNull();
  expect(result.workerPitWaste).toBeGreaterThanOrEqual(1);
  expect(result.otherPitWaste).toBe(0);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('waste disposal consumes Waste from the assigned pit instead of the room stockpile', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  const context = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });
  const genome = genomeForTraits({
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
  const disposerSlime = jobSlime({
    id: 'pit-disposer',
    name: 'PIT-DISPOSER',
    genome,
    containerId: 'basic-11',
    job: 'disposal',
    jobProgress: 999999,
  });

  await page.evaluate(({ key, disposerSlime }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const pit = (state.containers || []).find((item) => item.id === 'basic-11');
    if (!pit) {
      throw new Error('basic-11 pit container not found');
    }
    pit.name = 'Disposal Pit';
    pit.roomId = 'pits';
    pit.waste = { amount: 1, tags: { hazardous: 1, chemical: 1, waste: 1 } };
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'pits';
    state.selectedSlimeId = 'pit-disposer';
    state.resources = {
      ...(state.resources || {}),
      waste: 4,
      elementalResidue: 0,
    };
    state.roomStockpiles ||= {};
    state.roomStockpiles.pits ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    state.roomStockpiles.pits.resources = {
      ...(state.roomStockpiles.pits.resources || {}),
      waste: 4,
    };
    state.physicalItemStacks = (state.physicalItemStacks || []).filter((stack) => !(stack.section === 'resources' && stack.key === 'waste'));
    state.physicalItemStacks.push({
      id: 'stack-disposal-waste',
      section: 'resources',
      key: 'waste',
      quantity: 4,
      knownQuantity: 4,
      unitVolumeL: 2,
      unitMassKg: 1.5,
      roomId: 'pits',
      cell: { ...state.labMap.rooms.pits.anchor },
      fixtureId: '',
      stockpileId: '',
      observedAt: state.clock,
      reservedTaskId: '',
    });
    state.slimes = [disposerSlime];
    state.corpses = [];
    state.tasks = [];
    state.feedingResidues = [];
    state.nextResidueNumber = 1;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, disposerSlime });
  await loadSavedRun(page);

  await skipSeconds(page, 1);

  await expect(page.locator('#jobList')).toContainText('site Disposal Pit');
  await expect(page.locator('#jobSummary')).toContainText('4 stockpiled Waste');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const pit = state.containers.find((item) => item.id === 'basic-11');
    const slime = state.slimes.find((item) => item.id === 'pit-disposer');
    return {
      stockpiledWaste: state.resources?.waste || 0,
      roomWaste: state.roomStockpiles?.pits?.resources?.waste || 0,
      pitWaste: pit?.waste?.amount || 0,
      slimeJob: slime?.job || '',
      residues: state.feedingResidues || [],
    };
  }, { key: storageKey });

  expect(result.stockpiledWaste).toBe(4);
  expect(result.roomWaste).toBe(4);
  expect(result.pitWaste).toBe(0);
  expect(result.slimeJob).toBe('disposal');
  expect(result.residues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      location: expect.objectContaining({ type: 'container', containerId: 'basic-11' }),
    }),
  ]));
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
