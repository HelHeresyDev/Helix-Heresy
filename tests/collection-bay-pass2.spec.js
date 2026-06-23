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

async function stageSpecimensInCollectionBay(page) {
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const baseGenome = (state.currentGenome || 'ACGTACGTACGTACGTACGTACGTAC').slice(0, 26).padEnd(26, 'A');
    const replaceRegion = (genome, start, code) => `${genome.slice(0, start)}${code}${genome.slice(start + 2)}`;
    const byproductStart = 10;
    const elementStart = 12;
    const consistencyStart = 24;
    const container = (state.containers || []).find((item) => item.id === 'basic-1') || (state.containers || []).find((item) => item.type === 'basic');
    container.roomId = 'collectionBay';
    let acidLike = replaceRegion(baseGenome, byproductStart, 'AA');
    acidLike = replaceRegion(acidLike, elementStart, 'AA');
    acidLike = replaceRegion(acidLike, consistencyStart, 'AA');
    let vaporCandidate = replaceRegion(baseGenome, byproductStart, 'TT');
    vaporCandidate = replaceRegion(vaporCandidate, elementStart, 'TT');
    vaporCandidate = replaceRegion(vaporCandidate, consistencyStart, 'TG');
    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'collectionBay';
    state.slimes = [
      {
        id: 'collection-readout-1',
        name: 'BAY-001',
        genome: acidLike,
        source: 'QC setup',
        createdAt: 0,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: container.id,
        roomId: 'collectionBay',
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {},
        revealed: { element: true, byproduct: true, consistency: true },
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {}
      },
      {
        id: 'collection-readout-2',
        name: 'BAY-002',
        genome: vaporCandidate,
        source: 'QC setup',
        createdAt: 1,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: container.id,
        roomId: 'collectionBay',
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {},
        revealed: { element: true, byproduct: true, consistency: true },
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {}
      }
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
}

test.describe('Collection Bay Pass 2 apparatus readout', () => {
  test('source defines apparatus and method readout without collection mechanics', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const COLLECTION_BAY_APPARATUS');
    expect(source).toContain('const COLLECTION_BAY_METHOD_DEFS');
    expect(source).toContain('const BYPRODUCT_COLLECTION_TYPES');
    expect(source).toContain('function collectionBayMethodForByproduct');
    expect(source).toContain('function collectionBayReadoutEl');
    expect(source).toContain('drain channels');
    expect(source).toContain('fume hoods');
    expect(source).toContain('condensers');
    expect(source).toContain('collection plates');
    expect(source).toContain('drip-channel capture');
    expect(source).toContain('hood venting');
    expect(source).toContain('existing sealed container can be vented under hood');
    expect(source).toContain('dedicated drainage vessel');
    expect(source).toContain('This readout covers natural byproducts only; it does not include feeding residue or harvested tissue.');

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

  test('UI shows apparatus, no-specimen status, and staged specimen method readouts only', async ({ page }) => {
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

    const roomList = page.locator('#roomList');
    await expect(roomList).toContainText('Collection Bay');
    await expect(roomList).toContainText('Collection apparatus');
    await expect(roomList).toContainText('Apparatus: drain channels · sealed troughs · fume hoods · condensers · collection plates · filters · catch basins.');
    await expect(roomList).toContainText('Collection status: No specimen staged');
    await expect(roomList).toContainText('Readout only: no byproduct stock is produced here yet.');

    await visualPause(page, roomList, 'Collection Bay apparatus with no specimen staged');

    await stageSpecimensInCollectionBay(page);

    await expect(page.locator('#roomSummary')).toContainText('Current location: Collection Bay');
    await expect(roomList).toContainText('Collection status: 2 specimens staged for apparatus readout');
    await expect(roomList).toContainText('BAY-001');
    await expect(roomList).toContainText('BAY-002');
    await expect(roomList).toContainText('Byproduct:');
    await expect(roomList).toContainText('Natural output:');
    await expect(roomList).toContainText('Method:');
    await expect(roomList).toContainText('Container need:');

    const readoutTitles = await page.locator('[data-collection-bay-specimen]').evaluateAll((rows) => rows.map((row) => row.getAttribute('title') || ''));
    expect(readoutTitles.some((title) => title.includes('natural byproducts only'))).toBe(true);
    expect(readoutTitles.every((title) => !/feeding residue or harvested tissue/i.test(title) || /natural byproducts only/i.test(title))).toBe(true);

    await visualPause(page, roomList, 'Collection Bay staged specimen method readouts');

    await expect(page.locator('body')).not.toContainText('Collect byproduct');
    await expect(page.locator('body')).not.toContainText('Harvest byproduct');
    await expect(page.locator('body')).not.toContainText('Byproduct output stored');
    await expect(page.locator('body')).not.toContainText('Byproduct inventory');
    await expect(page.locator('body')).not.toContainText('output scalar');
    await expect(page.locator('body')).not.toContainText('food modifier');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
