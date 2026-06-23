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

async function installCorpseProcessingScenario(page, { freshness = 'fresh' } = {}) {
  await page.evaluate(({ key, freshness }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const genome = state.currentGenome || 'ACGTACGTACGTACGTACGTACGTACGTACGT';
    const corpseId = `corpse-${freshness}`;
    const ruined = freshness === 'ruined';
    state.clock = 120;
    state.paused = true;
    state.inventory ||= {};
    state.inventory.biomass = 0;
    state.inventory.ruinedOrganicMatter = 0;
    state.inventoryHistory ||= {};
    state.inventoryHistory.biomass = [];
    state.inventoryHistory.ruinedOrganicMatter = [];
    state.events = [];
    state.corpses = [{
      id: corpseId,
      name: ruined ? 'Ruined specimen' : 'Fresh specimen',
      genome,
      storage: 'drum',
      roomId: 'pits',
      diedAt: 0,
      freshUntil: ruined ? 0 : 10000,
      spoiledAt: ruined ? 0 : 20000,
      ruined,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      lastFreshness: freshness
    }];
    state.slimes = [{
      id: 'slime-worker',
      name: 'RG-099',
      genome,
      source: 'Synthetic',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'pits',
      job: 'corpse',
      jobProgress: 9999,
      jobTargetCorpseId: corpseId,
      jobNutritionGained: 0,
      stats: {},
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {}
    }];
    state.selectedSlimeId = 'slime-worker';
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, freshness });
  await loadSavedRun(page);
}

async function advanceOneMinute(page) {
  await page.locator('#skipAmountInput').fill('1');
  await page.locator('#skipTimeBtn').click();
}

test.describe('Inventory Pass 8 corpse material recovery', () => {
  test('source routes corpse processing recovery into inventory history without accounting events', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('function corpseProcessingInventoryRecovery');
    expect(source).toContain('function addCorpseProcessingInventoryRecovery');
    expect(source).toContain('addCorpseProcessingInventoryRecovery(target)');
    expect(source).toContain('source: "corpse processing"');
    expect(source).toContain('key: "ruinedOrganicMatter"');
    expect(source).toContain('key: "biomass"');
    expect(source).toContain('addInventoryItem(recovery.key, recovery.amount, recovery.source)');

    expect(source).not.toContain('Recovered material:');
    expect(source).not.toContain('Recovery logged:');
    expect(source).not.toContain('recovering ${CORPSE_PROCESSING_BIOMASS_GAIN} Biomass');
  });

  test('corpse processing adds inventory history and does not spam event-log accounting', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 2);
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

    await installCorpseProcessingScenario(page, { freshness: 'fresh' });
    await advanceOneMinute(page);
    const biomassRow = page.locator('[data-inventory-item-key="biomass"]');
    await expect(biomassRow.locator('strong')).toHaveText('1');
    await expect(biomassRow).toHaveAttribute('title', /\+1 corpse processing/);
    await expect(page.locator('#eventLog')).not.toContainText('Recovered material');
    await expect(page.locator('#eventLog')).not.toContainText('Recovery logged');
    await expect(page.locator('#eventLog')).not.toContainText('+1 corpse processing');
    await expect(page.locator('#eventLog')).not.toContainText('recovering 3 Biomass');

    await visualPause(page, page.locator('.inventory-panel'), 'Fresh corpse inventory recovery history');

    await installCorpseProcessingScenario(page, { freshness: 'ruined' });
    await advanceOneMinute(page);
    const ruinedRow = page.locator('[data-inventory-item-key="ruinedOrganicMatter"]');
    await expect(ruinedRow.locator('strong')).toHaveText('1');
    await expect(ruinedRow).toHaveAttribute('title', /\+1 corpse processing/);
    await expect(page.locator('#eventLog')).not.toContainText('Recovered material');
    await expect(page.locator('#eventLog')).not.toContainText('Recovery logged');
    await expect(page.locator('#eventLog')).not.toContainText('+1 corpse processing');

    await visualPause(page, page.locator('.inventory-panel'), 'Ruined corpse inventory recovery history');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
