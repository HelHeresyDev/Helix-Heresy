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

async function openCollectionStations(page) {
  await page.locator('[data-workspace-tab="resources"]').click();
  await page.locator('[data-stores-menu-tab="stations"]').click();
  return page.locator('#collectionStationInventoryList');
}

async function openSelectedContainerActions(page, containerId) {
  await page.locator('[data-workspace-tab="map"]').click();
  await page.locator(`[data-map-target-id="${containerId}"]`).first().click();
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]')).toBeVisible();
  return page.locator('[data-context-command-panel="true"]');
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

async function stageCollectionBayTransferSave(page) {
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const transferTank = (state.containers || []).find((item) => item.id === 'basic-10');
    if (!transferTank) {
      throw new Error('Expected starter container was not found');
    }
    transferTank.name = 'Transfer Drainage Tank';
    transferTank.typeId = 'specimenDrainageTank';
    transferTank.roomId = 'collectionBay';
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'collectionBay';
    state.tasks = [];
    state.slimes = [];
    state.collectionBay = {
      stations: {
        'basic-10': {
          containerId: 'basic-10',
          material: 'acid droplets',
          methodType: 'drip',
          receptacle: { label: 'sealed collection jar', amount: 4, capacity: 10 },
          overflow: { amount: 3, capacity: 3 },
          sourceMaterials: ['acid droplets'],
          sourceSlimes: ['TRANSFER-ACID'],
        },
      },
    };
    state.collectedByproducts = {};
    state.collectedByproductHistory = {};
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
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

  const stations = await openCollectionStations(page);
  await expect(stations).toContainText('Collection status: 3 collection stations; 4 specimens ready for readout');
  await expect(stations).toContainText('DRIP-VES');
  await expect(stations).toContainText('in Specimen Drainage Tank 1');
  await expect(stations).toContainText('DRIP-JAR');
  await expect(stations).toContainText('in Plain Jar');
  await expect(stations).toContainText('VAPOR-SEALED');
  await expect(stations).toContainText('in Sealed Tank');

  await expect(stations).toContainText('Byproduct: acid droplets');
  await expect(stations).toContainText('Byproduct: smoke vapor');
  await expect(stations).toContainText('Output: Trace');
  await expect(stations).toContainText('Method: drip-channel capture');
  await expect(stations).toContainText('Method: hood venting');
  await expect(stations).toContainText('Need: dedicated drainage vessel');
  await expect(stations).toContainText('Need: existing sealed container can be vented under hood');
  await expect(stations).toContainText('Support: Specimen Drainage Tank fitted');
  await expect(stations).toContainText('Support: Specimen Drainage Tank recommended');
  await expect(stations).toContainText('Support: hood-compatible sealed container');
  await expect(stations).toContainText('Support: hood venting required; drainage tank does not solve vapor');
  await expect(stations).toContainText('Output: mixed collection residue');
  await expect(stations).toContainText('Support: improvised mixed collection');
  await expect(stations).toContainText('Collecting mixed output');

  await expect(stations).not.toContainText('Container support:');
  await expect(stations).not.toContainText('Hood support:');
  await expect(stations).not.toContainText('Collect byproduct');
  await expect(stations).not.toContainText('Byproduct inventory');
  await expect(stations).not.toContainText('Paused: mixed output');
  await expect(stations).not.toContainText('Separate specimens');
  await expect(stations).not.toContainText('output scalar');
  await expect(stations).not.toContainText('food modifier');

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

  const stations = await openCollectionStations(page);
  await expect(stations).toContainText('Collection status: 3 collection stations; 4 specimens ready for readout');
  await expect(stations).toContainText('Single Drainage Tank station');
  await expect(stations).toContainText('Double Drainage Tank station');
  await expect(stations).toContainText('Immature Drainage Tank station');
  await expect(stations).toContainText('Expression: Steady');
  await expect(stations).toContainText('Expression: Trace');
  await expect(stations).toContainText('Receptacle: sealed collection jar 0 / 10');
  await expect(stations).toContainText('Overflow: apparatus buffer 0 / 3');

  await page.locator('#queueToggleBtn').click();
  await page.locator('#skipAmountInput').fill('60');
  await page.locator('#skipTimeBtn').click();

  await openCollectionStations(page);
  await expect(stations).toContainText('Receptacle: sealed collection jar');
  await expect(stations).toContainText('Transfer is a contextual command on the selected station container');

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

test('Collection Bay transfer creates a filled physical vessel and installs a replacement', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  await stageCollectionBayTransferSave(page);

  const stations = await openCollectionStations(page);
  const station = stations.locator('[data-collection-bay-station="basic-10"]');
  await expect(station).toContainText('Transfer Drainage Tank station');
  await expect(station).toContainText('Awaiting transfer');
  await expect(station).toContainText('Receptacle: sealed collection jar 4 / 10');
  await expect(station).toContainText('Overflow: apparatus buffer 3 / 3');

  let actions = await openSelectedContainerActions(page, 'basic-10');
  await actions.getByRole('button', { name: 'Transfer Receptacle' }).click();
  await page.locator('#queueToggleBtn').click();

  const transferTask = page.locator('#taskList .task-row').filter({ hasText: 'Transfer Transfer Drainage Tank receptacle' });
  await expect(transferTask).toBeVisible();
  actions = await openSelectedContainerActions(page, 'basic-10');
  const transferButton = actions.getByRole('button', { name: 'Transfer Receptacle' });
  await expect(transferButton).toBeDisabled();
  await expect(transferButton).toHaveAttribute('title', /Receptacle transfer already queued/);
  await page.locator('#queueToggleBtn').click();
  await transferTask.getByRole('button', { name: 'Finish' }).click();

  await openCollectionStations(page);
  const inventory = page.locator('#inventoryList');
  await expect(inventory).toContainText('Collected Byproducts');
  await expect(inventory).toContainText('acid droplets');
  await expect(station).toContainText('Receptacle: sealed collection jar 3 / 10');
  await expect(station).toContainText('Overflow: apparatus buffer 0 / 3');

  const transferState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const stationState = state.collectionBay?.stations?.['basic-10'];
    const filledVessel = (state.physicalItemStacks || []).find((stack) =>
      stack.form === 'receptacle'
      && (stack.contents || []).some((content) => content.kind === 'byproduct' && content.label === 'acid droplets')
    );
    return {
      collected: Number(state.collectedByproducts?.['acid droplets']) || 0,
      physicalAmount: (filledVessel?.contents || []).find((content) => content.label === 'acid droplets')?.amount || 0,
      vesselKey: filledVessel?.key || '',
      historySource: state.collectedByproductHistory?.['acid droplets']?.[0]?.source || '',
      receptacle: Number(stationState?.receptacle?.amount) || 0,
      overflow: Number(stationState?.overflow?.amount) || 0,
    };
  }, { key: storageKey });

  expect(transferState.collected).toBe(4);
  expect(transferState.physicalAmount).toBe(4);
  expect(transferState.vesselKey).toBe('sealedCollectionJar');
  expect(transferState.historySource).toContain('Transfer Drainage Tank station');
  expect(transferState.historySource).toContain('TRANSFER-ACID');
  expect(transferState.receptacle).toBe(3);
  expect(transferState.overflow).toBe(0);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
