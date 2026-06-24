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

async function stageHoodVentingSpecimens(page) {
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const baseGenome = (state.currentGenome || 'ACGTACGTACGTACGTACGTACGTAC').slice(0, 26).padEnd(26, 'A');
    const replaceRegion = (genome, start, code) => `${genome.slice(0, start)}${code}${genome.slice(start + 2)}`;
    const byproductStart = 10;
    const elementStart = 12;
    const consistencyStart = 24;
    const sealedContainer = (state.containers || []).find((item) => item.typeId === 'sealedGlassTank');
    const openContainer = (state.containers || []).find((item) => item.typeId === 'openTray');
    const collectionVessel = (state.containers || []).find((item) => item.typeId === 'collectionVessel');
    for (const container of [sealedContainer, openContainer, collectionVessel]) {
      if (container) container.roomId = 'collectionBay';
    }

    // AC byproduct slot + flame element + fluid consistency resolves to smoke vapor.
    const vaporGenome = (() => {
      let genome = replaceRegion(baseGenome, byproductStart, 'AC');
      genome = replaceRegion(genome, elementStart, 'AC');
      genome = replaceRegion(genome, consistencyStart, 'AA');
      return genome;
    })();

    const makeSlime = (id, name, container) => ({
      id,
      name,
      genome: vaporGenome,
      source: 'QC setup',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: container?.id || null,
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
    });

    state.started = true;
    state.paused = true;
    state.scientist ||= {};
    state.scientist.roomId = 'collectionBay';
    state.slimes = [
      makeSlime('hood-venting-1', 'HVD-001', sealedContainer),
      makeSlime('hood-venting-2', 'HVD-002', openContainer),
      makeSlime('hood-venting-3', 'HVD-003', collectionVessel)
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
}

test.describe('Collection Bay Pass 4 hood venting foundation', () => {
  test('source defines hood venting support without adding collection mechanics', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function isHoodVentableContainer');
    expect(source).toContain('function collectionBayHoodSupport');
    expect(source).toContain('Hood support: compatible sealed container');
    expect(source).toContain('Hood support: sealed ventable container recommended');
    expect(source).toContain('Hood support: hood venting still required');
    expect(source).toContain('Number(type.seal || 0) >= 65');
    expect(source).toContain('fume hood and condenser');
    expect(source).toContain('existing sealed container can be vented under hood');
    expect(source).toContain('Hood venting applies only to vapor, haze, fume, and mist byproducts');

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
      'craftInventoryItem',
      'startHoodVentingTask',
      'hoodVentingTask'
    ];
    for (const term of forbidden) {
      expect(source).not.toContain(term);
    }
  });

  test('UI distinguishes sealed-container hood support from poor fit and Collection Vessel mismatch', async ({ page }) => {
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
    await stageHoodVentingSpecimens(page);

    const roomList = page.locator('#roomList');
    await expect(page.locator('#roomSummary')).toContainText('Current location: Collection Bay');
    await expect(roomList).toContainText('Collection apparatus');
    await expect(roomList).toContainText('HVD-001');
    await expect(roomList).toContainText('HVD-002');
    await expect(roomList).toContainText('HVD-003');
    await expect(roomList).toContainText('Byproduct: smoke vapor');
    await expect(roomList).toContainText('Method: hood venting');
    await expect(roomList).toContainText('Container need: existing sealed container can be vented under hood');
    await expect(roomList).toContainText('Hood support: hood venting still required');
    await expect(roomList).toContainText('Hood support: compatible sealed container');
    await expect(roomList).toContainText('Hood support: sealed ventable container recommended');
    await expect(roomList).toContainText('Hood support: hood venting still required');
    await expect(roomList).toContainText('Readout only: no byproduct stock is produced here yet.');

    const readoutTitles = await page.locator('[data-collection-bay-specimen]').evaluateAll((rows) => rows.map((row) => row.getAttribute('title') || ''));
    expect(readoutTitles.some((title) => title.includes('Hood venting applies only to vapor, haze, fume, and mist byproducts'))).toBe(true);
    expect(readoutTitles.every((title) => title.includes('natural byproducts only'))).toBe(true);

    await visualPause(page, roomList, 'Hood venting support readouts');

    await expect(page.locator('body')).not.toContainText('Collect byproduct');
    await expect(page.locator('body')).not.toContainText('Harvest byproduct');
    await expect(page.locator('body')).not.toContainText('Byproduct output stored');
    await expect(page.locator('body')).not.toContainText('Byproduct inventory');
    await expect(page.locator('body')).not.toContainText('output scalar');
    await expect(page.locator('body')).not.toContainText('food modifier');
    await expect(page.locator('body')).not.toContainText('Start hood venting');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
