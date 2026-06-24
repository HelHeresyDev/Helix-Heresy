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

function stagedSlime({ id, name, genome, containerId }) {
  return {
    id,
    name,
    genome,
    source: 'Collection Bay UI fixture',
    createdAt: 0,
    deathAt: 10000,
    lifecycleVersion: 1,
    matureAt: 0,
    mature: true,
    status: 'contained',
    containerId,
    roomId: 'mainLab',
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
    const collectionVessel = (state.containers || []).find((item) => item.id === 'basic-10');
    if (!plainJar || !sealedTank || !collectionVessel) {
      throw new Error('Expected starter containers were not found');
    }
    plainJar.name = 'Plain Jar';
    plainJar.roomId = 'collectionBay';
    sealedTank.name = 'Sealed Tank';
    sealedTank.roomId = 'collectionBay';
    collectionVessel.name = 'Collection Vessel 1';
    collectionVessel.roomId = 'collectionBay';
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
  await expect(roomList).toContainText('Collection status: 3 staged containers; 4 specimens ready for readout');
  await expect(roomList).toContainText('DRIP-VES');
  await expect(roomList).toContainText('in Collection Vessel 1');
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
  await expect(roomList).toContainText('Support: Collection Vessel fitted');
  await expect(roomList).toContainText('Support: Collection Vessel recommended');
  await expect(roomList).toContainText('Support: hood-compatible sealed container');
  await expect(roomList).toContainText('Support: hood venting required; Collection Vessel does not solve vapor');

  await expect(roomList).not.toContainText('Container support:');
  await expect(roomList).not.toContainText('Hood support:');
  await expect(roomList).not.toContainText('Collect byproduct');
  await expect(roomList).not.toContainText('Byproduct inventory');
  await expect(roomList).not.toContainText('output scalar');
  await expect(roomList).not.toContainText('food modifier');

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});
