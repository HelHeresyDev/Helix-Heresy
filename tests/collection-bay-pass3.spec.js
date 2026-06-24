// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';
const visualPauseMs = Number(process.env.VISUAL_PAUSE_MS || 0);

async function visualPause(page, locator, label) {
  if (!Number.isFinite(visualPauseMs) || visualPauseMs <= 0) return;
  await locator.scrollIntoViewIfNeeded();
  console.log(`Visual pause: ${label} (${visualPauseMs}ms)`);
  await page.waitForTimeout(visualPauseMs);
}

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

async function stageCollectionVesselSpecimens(page) {
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const baseGenome = (state.currentGenome || 'ACGTACGTACGTACGTACGTACGTAC').slice(0, 26).padEnd(26, 'A');
    const replaceRegion = (genome, start, code) => `${genome.slice(0, start)}${code}${genome.slice(start + 2)}`;
    const byproductStart = 10;
    const elementStart = 12;
    const consistencyStart = 24;
    const collectionVessel = (state.containers || []).find((item) => item.typeId === 'collectionVessel');
    const basicContainer = (state.containers || []).find((item) => item.id === 'basic-1') || (state.containers || []).find((item) => item.typeId === 'basicGlassJar');
    const sealedContainer = (state.containers || []).find((item) => item.typeId === 'sealedGlassTank') || basicContainer;
    for (const container of [collectionVessel, basicContainer, sealedContainer]) {
      if (container) container.roomId = 'collectionBay';
    }
    const buildGenome = ({ byproduct, element, consistency }) => {
      let genome = replaceRegion(baseGenome, byproductStart, byproduct);
      genome = replaceRegion(genome, elementStart, element);
      genome = replaceRegion(genome, consistencyStart, consistency);
      return genome;
    };
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'collectionBay';
    state.slimes = [
      {
        id: 'collection-vessel-1',
        name: 'VES-001',
        genome: buildGenome({ byproduct: 'AA', element: 'AA', consistency: 'AA' }),
        source: 'QC setup', createdAt: 0, deathAt: 10000, lifecycleVersion: 1, matureAt: 0, mature: true,
        status: 'contained', containerId: collectionVessel?.id || null, roomId: 'collectionBay', job: 'idle', jobProgress: 0,
        jobTargetCorpseId: null, jobNutritionGained: 0, stats: {}, revealed: { element: true, byproduct: true, consistency: true },
        measured: {}, traitObservations: {}, testsRun: [], jobKnowledge: {}
      },
      {
        id: 'collection-vessel-2',
        name: 'VES-002',
        genome: buildGenome({ byproduct: 'AA', element: 'AA', consistency: 'AA' }),
        source: 'QC setup', createdAt: 1, deathAt: 10000, lifecycleVersion: 1, matureAt: 0, mature: true,
        status: 'contained', containerId: basicContainer?.id || null, roomId: 'collectionBay', job: 'idle', jobProgress: 0,
        jobTargetCorpseId: null, jobNutritionGained: 0, stats: {}, revealed: { element: true, byproduct: true, consistency: true },
        measured: {}, traitObservations: {}, testsRun: [], jobKnowledge: {}
      },
      {
        id: 'collection-vessel-3',
        name: 'VES-003',
        genome: buildGenome({ byproduct: 'TT', element: 'TT', consistency: 'TG' }),
        source: 'QC setup', createdAt: 2, deathAt: 10000, lifecycleVersion: 1, matureAt: 0, mature: true,
        status: 'contained', containerId: sealedContainer?.id || null, roomId: 'collectionBay', job: 'idle', jobProgress: 0,
        jobTargetCorpseId: null, jobNutritionGained: 0, stats: {}, revealed: { element: true, byproduct: true, consistency: true },
        measured: {}, traitObservations: {}, testsRun: [], jobKnowledge: {}
      }
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
}

test.describe('Collection Bay Pass 3 collection vessel foundation', () => {
  test('source defines Collection Vessel without byproduct collection mechanics', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('id: "collectionVessel"');
    expect(source).toContain('label: "Collection Vessel"');
    expect(source).toContain('collectionVessel: true');
    expect(source).toContain('collectionMethods: ["drip", "sludge"]');
    expect(source).toContain('"Collection Vessel 1", roomId: COLLECTION_BAY_ROOM_ID');
    expect(source).toContain('function isCollectionVessel');
    expect(source).toContain('function collectionBayContainerSupport');
    expect(source).toContain('Container support: Collection Vessel fitted');
    expect(source).toContain('Container support: dedicated Collection Vessel recommended');
    expect(source).toContain('Container support: hood venting still required');
    expect(source).toContain('Sloped plates');
    expect(source).toContain('Drain grooves');
    expect(source).toContain('Catch basins');

    const forbidden = [
      'byproductCollectionRate',
      'collectByproduct',
      'harvestByproduct',
      'byproductInventoryOutput',
      'currentOutputSimulation',
      'feedingResidue',
      'harvestableMaterial',
      'acidDamage',
      'toolCorrosion',
      'inventoryRecipes',
      'craftInventoryItem'
    ];
    for (const term of forbidden) {
      expect(source).not.toContain(term);
    }
  });

  test('UI shows Collection Vessel support readouts without producing byproduct stock', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 3);
    }

    const consoleIssues = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await startRun(page);

    const body = page.locator('body');
    await expect(body).toContainText('Collection Vessel 1');
    await expect(body).toContainText('Collection Bay');

    await stageCollectionVesselSpecimens(page);

    const roomList = page.locator('#roomList');
    await expect(page.locator('#roomSummary')).toContainText('Current location: Collection Bay');
    await expect(roomList).toContainText('Collection apparatus');
    await expect(roomList).toContainText('VES-001');
    await expect(roomList).toContainText('VES-002');
    await expect(roomList).toContainText('Container support:');
    await expect(roomList).toContainText('Container support: Collection Vessel fitted');
    await expect(roomList).toContainText('Container support: dedicated Collection Vessel recommended');
    await expect(roomList).toContainText('Readout only: no byproduct stock is produced here yet.');

    await visualPause(page, roomList, 'Collection Vessel support readouts');

    await expect(body).not.toContainText('Collect byproduct');
    await expect(body).not.toContainText('Harvest byproduct');
    await expect(body).not.toContainText('Byproduct output stored');
    await expect(body).not.toContainText('Byproduct inventory');
    await expect(body).not.toContainText('output scalar');
    await expect(body).not.toContainText('food modifier');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
