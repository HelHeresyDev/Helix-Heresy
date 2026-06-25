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

function stagedSlime({ id, name, genome, containerId, mature = true, matureAt = 0, stats = {} }) {
  return {
    id,
    name,
    genome,
    source: 'Collection Bay UI fixture',
    createdAt: 0,
    deathAt: 10000,
    lifecycleVersion: 1,
    matureAt,
    mature,
    status: 'contained',
    containerId,
    roomId: 'mainLab',
    job: 'idle',
    jobProgress: 0,
    jobTargetCorpseId: null,
    jobNutritionGained: 0,
    stats,
    revealed: { byproduct: true, element: true, consistency: true },
    measured: {},
    traitObservations: {},
    testsRun: [],
    jobKnowledge: {},
  };
}

async function stageCollectionBayReadoutSave(page) {
  const saveContext = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });

  const acidDropletGenome = genomeForTraits({
    seed: saveContext.seed,
    complexity: saveContext.complexity,
    baseGenome: saveContext.currentGenome,
    traits: { element: 'acid', consistency: 'watery' },
    byproductSlot: 0,
  });
  const smokeVaporGenome = genomeForTraits({
    seed: saveContext.seed,
    complexity: saveContext.complexity,
    baseGenome: saveContext.currentGenome,
    traits: { element: 'flame', consistency: 'watery' },
    byproductSlot: 1,
  });

  await page.evaluate(({ key, slimes }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const plainJar = (state.containers || []).find((item) => item.id === 'basic-1');
    const sealedTank = (state.containers || []).find((item) => item.id === 'basic-2');
    const drainageTank = (state.containers || []).find((item) => item.id === 'basic-10');
    if (!plainJar || !sealedTank || !drainageTank) {
      throw new Error('Expected starter containers were not found');
    }
    plainJar.name = 'Plain Jar';
    plainJar.roomId = 'collectionBay';
    sealedTank.name = 'Sealed Tank';
    sealedTank.roomId = 'collectionBay';
    drainageTank.name = 'Specimen Drainage Tank 1';
    drainageTank.roomId = 'collectionBay';
    state.started = true;
    state.paused = true;
    state.complexity = state.complexity || 'clean';
    state.scientist ||= {};
    state.scientist.roomId = 'collectionBay';
    state.tasks = [];
    state.selectedSlimeId = slimes[0].id;
    state.slimes = slimes;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: storageKey,
    slimes: [
      stagedSlime({ id: 'drip-vessel', name: 'DRIP-VES', genome: acidDropletGenome, containerId: 'basic-10' }),
      stagedSlime({ id: 'drip-jar', name: 'DRIP-JAR', genome: acidDropletGenome, containerId: 'basic-1' }),
      stagedSlime({ id: 'vapor-sealed', name: 'VAPOR-SEALED', genome: smokeVaporGenome, containerId: 'basic-2' }),
      stagedSlime({ id: 'vapor-vessel', name: 'VAPOR-VES', genome: smokeVaporGenome, containerId: 'basic-10' }),
    ],
  });
  await loadSavedRun(page);
}

async function stageCollectionBayAccumulationSave(page) {
  const saveContext = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });

  const acidDropletGenome = genomeForTraits({
    seed: saveContext.seed,
    complexity: saveContext.complexity,
    baseGenome: saveContext.currentGenome,
    traits: { element: 'acid', consistency: 'watery' },
    byproductSlot: 0,
  });

  await page.evaluate(({ key, slimes }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const singleTank = (state.containers || []).find((item) => item.id === 'basic-10');
    const doubleTank = (state.containers || []).find((item) => item.id === 'basic-9');
    const immatureTank = (state.containers || []).find((item) => item.id === 'basic-8');
    if (!singleTank || !doubleTank || !immatureTank) {
      throw new Error('Expected starter containers were not found');
    }
    singleTank.name = 'Single Drainage Tank';
    singleTank.typeId = 'specimenDrainageTank';
    singleTank.roomId = 'collectionBay';
    doubleTank.name = 'Double Drainage Tank';
    doubleTank.typeId = 'specimenDrainageTank';
    doubleTank.roomId = 'collectionBay';
    immatureTank.name = 'Immature Drainage Tank';
    immatureTank.typeId = 'specimenDrainageTank';
    immatureTank.roomId = 'collectionBay';
    state.started = true;
    state.paused = true;
    state.complexity = state.complexity || 'clean';
    state.collectionBay = { stations: {} };
    state.scientist ||= {};
    state.scientist.roomId = 'collectionBay';
    state.tasks = [];
    state.selectedSlimeId = slimes[0].id;
    state.slimes = slimes;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: storageKey,
    slimes: [
      stagedSlime({ id: 'single-acid', name: 'SINGLE-ACID', genome: acidDropletGenome, containerId: 'basic-10' }),
      stagedSlime({ id: 'double-acid-a', name: 'DOUBLE-ACID-A', genome: acidDropletGenome, containerId: 'basic-9' }),
      stagedSlime({ id: 'double-acid-b', name: 'DOUBLE-ACID-B', genome: acidDropletGenome, containerId: 'basic-9' }),
      stagedSlime({ id: 'immature-acid', name: 'IMMATURE-ACID', genome: acidDropletGenome, containerId: 'basic-8', mature: false, matureAt: 240 }),
    ],
  });
  await loadSavedRun(page);
}

test('Collection Bay specimen readout uses compact facts and one support line', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  await stageCollectionBayReadoutSave(page);

  const roomList = page.locator('#roomList');
  await expect(roomList).toContainText('Collection status: 3 collection stations; 4 specimens ready for readout');
  await expect(roomList).toContainText('DRIP-VES');
  await expect(roomList).toContainText('in Specimen Drainage Tank 1');
  await expect(roomList).toContainText('DRIP-JAR');
  await expect(roomList).toContainText('in Plain Jar');
  await expect(roomList).toContainText('VAPOR-SEALED');
  await expect(roomList).toContainText('in Sealed Tank');

  await expect(roomList).toContainText('Byproduct: acid droplets');
  await expect(roomList).toContainText('Byproduct: smoke vapor');
  await expect(roomList).toContainText('Output: Trace');
  await expect(roomList).toContainText('Method: drip-channel capture');
  await expect(roomList).toContainText('Method: hood venting');
  await expect(roomList).toContainText('Need: dedicated drainage vessel');
  await expect(roomList).toContainText('Need: existing sealed container can be vented under hood');
  await expect(roomList).toContainText('Support: Specimen Drainage Tank fitted');
  await expect(roomList).toContainText('Support: Specimen Drainage Tank recommended');
  await expect(roomList).toContainText('Support: hood-compatible sealed container');
  await expect(roomList).toContainText('Support: hood venting required; drainage tank does not solve vapor');

  await expect(roomList).not.toContainText('Container support:');
  await expect(roomList).not.toContainText('Hood support:');
  await expect(roomList).not.toContainText('Collect byproduct');
  await expect(roomList).not.toContainText('Byproduct inventory');
  await expect(roomList).not.toContainText('output scalar');
  await expect(roomList).not.toContainText('food modifier');

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('Collection Bay stations passively accumulate per-container receptacles', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  await stageCollectionBayAccumulationSave(page);

  const roomList = page.locator('#roomList');
  await expect(roomList).toContainText('Collection status: 3 collection stations; 4 specimens ready for readout');
  await expect(roomList).toContainText('Single Drainage Tank station');
  await expect(roomList).toContainText('Double Drainage Tank station');
  await expect(roomList).toContainText('Immature Drainage Tank station');
  await expect(roomList).toContainText('Expression: Steady');
  await expect(roomList).toContainText('Expression: Trace');
  await expect(roomList).toContainText('Receptacle: sealed collection jar 0 / 10');
  await expect(roomList).toContainText('Overflow: apparatus buffer 0 / 3');

  await page.locator('#queueToggleBtn').click();
  await page.locator('#skipAmountInput').fill('60');
  await page.locator('#skipTimeBtn').click();

  await expect(roomList).toContainText('Receptacle: sealed collection jar');
  await expect(roomList).toContainText('Collected material remains in station receptacles');

  const stationAmounts = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      single: Number(state.collectionBay?.stations?.['basic-10']?.receptacle?.amount) || 0,
      double: Number(state.collectionBay?.stations?.['basic-9']?.receptacle?.amount) || 0,
      immature: Number(state.collectionBay?.stations?.['basic-8']?.receptacle?.amount) || 0,
      singleMaterial: state.collectionBay?.stations?.['basic-10']?.material,
      doubleMaterial: state.collectionBay?.stations?.['basic-9']?.material,
      immatureMaterial: state.collectionBay?.stations?.['basic-8']?.material,
    };
  }, { key: storageKey });

  expect(stationAmounts.singleMaterial).toBe('acid droplets');
  expect(stationAmounts.doubleMaterial).toBe('acid droplets');
  expect(stationAmounts.immatureMaterial).toBe('acid droplets');
  expect(stationAmounts.single).toBeGreaterThan(0);
  expect(stationAmounts.double).toBeGreaterThan(stationAmounts.single);
  expect(stationAmounts.immature).toBeGreaterThan(0);
  expect(stationAmounts.immature).toBeLessThan(stationAmounts.single);

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
