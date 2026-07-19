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
    state.physicalItemStacks = (state.physicalItemStacks || []).filter((stack) => !['organicFeedstock', 'metalFeedstock'].includes(stack.key));
    state.physicalItemStacks.push(
      {
        id: 'stack-residue-organic', section: 'resources', key: 'organicFeedstock', quantity: 2, knownQuantity: 2,
        unitVolumeL: 1, unitMassKg: 0.8, roomId: 'mainLab', cell: { ...state.labMap.rooms.mainLab.anchor },
        fixtureId: '', stockpileId: '', observedAt: state.clock, reservedTaskId: '',
      },
      {
        id: 'stack-residue-metal', section: 'resources', key: 'metalFeedstock', quantity: 2, knownQuantity: 2,
        unitVolumeL: 1, unitMassKg: 1, roomId: 'mainLab', cell: { ...state.labMap.rooms.mainLab.anchor },
        fixtureId: '', stockpileId: '', observedAt: state.clock, reservedTaskId: '',
      },
    );
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

  await page.locator('[data-workspace-tab="specimens"]').click();
  const selectedCard = page.locator('[data-slime-card="residue-clean"]');
  const feedstockSelect = selectedCard.getByLabel('Feedstock');
  await feedstockSelect.selectOption('organicFeedstock');
  await selectedCard.getByRole('button', { name: 'Feed', exact: true }).click();

  await expect(page.locator('#containerList')).not.toContainText('Interior feeding residue');
  let residueState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return (state.physicalItemStacks || []).filter((stack) => stack.section === 'residue');
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
    return (state.physicalItemStacks || []).filter((stack) => stack.section === 'residue');
  }, { key: storageKey });
  expect(residueState).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'inertResidue',
      quantity: 1,
      form: 'spill',
      containerId: 'basic-1',
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
    stats: { bodyIntegrity: { current: 100, max: 100 }, nutrition: { current: 20, max: 100 } },
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
    state.physicalItemStacks = (state.physicalItemStacks || []).filter((stack) => stack.key !== 'waste' && stack.section !== 'residue');
    state.physicalItemStacks.push({
      id: 'stack-pit-hazard-waste', section: 'resources', key: 'waste', quantity: 1, knownQuantity: 1,
      unitVolumeL: 2, unitMassKg: 1.5, roomId: 'pits', cell: { ...pit.mapCell }, fixtureId: '',
      stockpileId: '', observedAt: state.clock, reservedTaskId: '', containerId: pit.id, form: 'waste',
      phase: 'sludge', tags: ['waste', 'hazardous', 'chemical'], contents: [], sourceLabels: ['test waste'],
      sourceSlimeIds: [], createdAt: state.clock, updatedAt: state.clock,
      processingProgress: 0.9999999, processingResidueProgress: 2.9,
    });
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
      pitWaste: (state.physicalItemStacks || []).filter((stack) => stack.containerId === 'basic-11' && stack.key === 'waste').reduce((total, stack) => total + stack.quantity, 0),
      elementalResidue: state.resources?.elementalResidue,
      residues: (state.physicalItemStacks || []).filter((stack) => stack.section === 'residue'),
    };
  }, { key: storageKey });

  expect(result.waste).toBe(0);
  expect(result.pitWaste).toBe(0);
  expect(result.elementalResidue).toBeGreaterThanOrEqual(1);
  expect(result.residues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'inertResidue',
      quantity: 1,
      form: 'spill',
      containerId: 'basic-11',
    }),
  ]));

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('loose scavenging uses Sustenance match quality for local residue', async ({ page }) => {
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
    traits: { sustenance: 'organic feeder', behavior: 'idle pooling', stability: 'placid', element: 'none' },
  });
  const metalGenome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { sustenance: 'metal feeder', behavior: 'idle pooling', stability: 'placid', element: 'none' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.started = true;
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'loose-good-feed';
    state.physicalItemStacks = (state.physicalItemStacks || []).filter((stack) => stack.section !== 'residue');
    state.physicalItemStacks.push({
      id: 'local-good-food', section: 'residue', key: 'looseBiomatter', quantity: 2, knownQuantity: 2,
      unitVolumeL: 1, unitMassKg: 1, roomId: 'mainLab', cell: { ...state.labMap.rooms.mainLab.anchor },
      fixtureId: '', stockpileId: '', observedAt: 0, reservedTaskId: '', containerId: '', form: 'spill', phase: 'sludge',
      tags: ['organic', 'mess'],
      sourceLabels: ['local spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    });
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'loose-good-feed',
      name: 'LOOSE-GOOD',
      genome,
      source: 'Loose feeding fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: state.labMap.rooms.mainLab.anchor,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 0,
      roomBehavior: { hunting: false, seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 10, max: 100 },
        currentMass: { current: 50, max: 100 },
        bodyIntegrity: { current: 100, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: { sustenance: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome: organicGenome });
  await loadSavedRun(page);
  await skipSeconds(page, 1200);

  const goodResult = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'loose-good-feed');
    return {
      nutrition: slime.stats.nutrition.current,
      stress: slime.stats.stress.current,
      residues: (state.physicalItemStacks || []).filter((stack) => stack.section === 'residue'),
    };
  }, { key: storageKey });

  expect(goodResult.nutrition).toBeGreaterThan(10);
  expect(goodResult.stress).toBe(0);
  expect(goodResult.residues.some((residue) => residue.key === 'contaminatedResidue' || residue.key === 'hazardousSludge')).toBe(false);

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.started = true;
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'loose-bad-feed';
    state.physicalItemStacks = (state.physicalItemStacks || []).filter((stack) => stack.section !== 'residue');
    state.physicalItemStacks.push({
      id: 'local-bad-food', section: 'residue', key: 'looseBiomatter', quantity: 2, knownQuantity: 2,
      unitVolumeL: 1, unitMassKg: 1, roomId: 'mainLab', cell: { ...state.labMap.rooms.mainLab.anchor },
      fixtureId: '', stockpileId: '', observedAt: 0, reservedTaskId: '', containerId: '', form: 'spill', phase: 'sludge',
      tags: ['organic', 'mess'],
      sourceLabels: ['local spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    });
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'loose-bad-feed',
      name: 'LOOSE-BAD',
      genome,
      source: 'Loose feeding fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: state.labMap.rooms.mainLab.anchor,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 0,
      roomBehavior: { hunting: false, seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 10, max: 100 },
        currentMass: { current: 50, max: 100 },
        bodyIntegrity: { current: 100, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: { sustenance: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome: metalGenome });
  await loadSavedRun(page);
  await skipSeconds(page, 2000);

  const badResult = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'loose-bad-feed');
    return {
      nutrition: slime.stats.nutrition.current,
      stress: slime.stats.stress.current,
      residues: (state.physicalItemStacks || []).filter((stack) => stack.section === 'residue'),
    };
  }, { key: storageKey });

  expect(badResult.nutrition).toBeGreaterThan(10);
  expect(badResult.stress).toBeGreaterThan(0);
  expect(badResult.residues).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'contaminatedResidue',
      roomId: 'mainLab',
      form: 'spill',
    }),
  ]));

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
