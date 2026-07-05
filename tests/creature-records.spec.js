// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

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

function slimeFixture({ id, name, genome, status = 'contained', containerId = 'basic-1', roomId = 'mainLab', parentIds = [], broodId = '' }) {
  return {
    id,
    name,
    genome,
    source: 'Creature records fixture',
    createdAt: 0,
    deathAt: 999999,
    lifecycleVersion: 1,
    matureAt: 0,
    mature: true,
    status,
    containerId: status === 'released' ? null : containerId,
    roomId,
    mapCell: status === 'released' ? { x: 18, y: 14 } : null,
    parentIds,
    broodId,
    automationExcluded: false,
    job: 'idle',
    jobProgress: 0,
    jobTargetCorpseId: null,
    jobNutritionGained: 0,
    revealed: {},
    measured: {},
    traitObservations: {},
    testsRun: [],
    jobKnowledge: {},
  };
}

test('creature records split confirmed living from stale unknown loose creatures', async ({ page }) => {
  await startRun(page);
  const genome = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.currentGenome || 'A'.repeat(26);
  }, { key: storageKey });

  await page.evaluate(({ key, genome, contained, loose }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!jar) {
      throw new Error('basic-1 container not found');
    }
    jar.roomId = 'mainLab';
    state.started = true;
    state.paused = true;
    state.clock = 3 * 60 * 60;
    state.scientist ||= {};
    state.scientist.roomId = 'mainLab';
    state.slimes = [
      { ...contained, genome, containerId: jar.id, roomId: jar.roomId },
      { ...loose, genome },
    ];
    state.corpses = [];
    state.creatureRecords = {
      'loose-stale': {
        specimenId: 'loose-stale',
        name: 'REC-LOOSE',
        lastObservedAt: 0,
        lastKnownRoomId: 'menagerie',
        lastKnownContainerId: '',
        lastKnownStatus: 'released',
        lastKnownMapCell: { x: 18, y: 14 },
        lastKnownActivity: 'wandering',
      },
    };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: storageKey,
    genome,
    contained: slimeFixture({ id: 'contained-record', name: 'REC-CONTAINED', genome }),
    loose: slimeFixture({ id: 'loose-stale', name: 'REC-LOOSE', genome, status: 'released', roomId: 'menagerie' }),
  });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  await expect(page.locator('[data-creature-record-tab="living"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#livingRecordBadge')).toHaveText('1');
  await expect(page.locator('#unknownRecordBadge')).toHaveText('1');
  await expect(page.locator('#slimeList')).toContainText('REC-CONTAINED');
  await expect(page.locator('#slimeList')).not.toContainText('REC-LOOSE');

  await page.locator('[data-creature-record-tab="unknown"]').click();
  await expect(page.locator('#unknownCreatureList')).toContainText('REC-LOOSE');
  await expect(page.locator('#unknownCreatureList')).toContainText('last seen');
  await page.locator('[data-unknown-creature-card="loose-stale"]').getByRole('button', { name: /Focus Last Known/ }).click();
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'room');
});

test('creature records expose deceased and lineage files without revealing hidden traits', async ({ page }) => {
  await startRun(page);
  const genome = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.currentGenome || 'A'.repeat(26);
  }, { key: storageKey });

  await page.evaluate(({ key, genome, child }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.started = true;
    state.paused = true;
    state.clock = 60;
    state.slimes = [{ ...child, genome }];
    state.corpses = [{
      id: 'corpse-parent',
      specimenId: 'parent-dead',
      name: 'REC-PARENT',
      genome,
      source: 'Creature records fixture',
      deathReason: 'fixture',
      diedAt: 0,
      roomId: 'mainLab',
      containerId: null,
      storage: 'drum',
      consumedProgress: 0,
      ruined: false,
      parentIds: [],
      broodId: 'brood-records',
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      harvestedProcedures: {},
      nextOverflowEventAt: null,
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: storageKey,
    genome,
    child: slimeFixture({
      id: 'child-record',
      name: 'REC-CHILD',
      genome,
      parentIds: ['parent-dead'],
      broodId: 'brood-records',
    }),
  });
  await loadSavedRun(page);

  await page.locator('[data-workspace-tab="specimens"]').click();
  await page.locator('[data-creature-record-tab="deceased"]').click();
  await expect(page.locator('#corpseList')).toContainText('REC-PARENT');

  await page.locator('[data-creature-record-tab="lineage"]').click();
  await expect(page.locator('#lineageList')).toContainText('REC-CHILD');
  await expect(page.locator('#lineageList')).toContainText('REC-PARENT');
  await expect(page.locator('#lineageList')).toContainText('brood brood-records');
  await expect(page.locator('#lineageList')).not.toContainText('Undiscovered');
});
