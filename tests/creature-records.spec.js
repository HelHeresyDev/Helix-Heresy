// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const { activeRunStorageKey } = require('./helpers/active-run-storage');

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

function slimeFixture({ id, name, genome, status = 'contained', containerId = 'basic-1', roomId = 'mainLab', parentIds = [], broodId = '', generation = 0, reproductionEventId = '', inheritance = null }) {
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
    generation,
    reproductionEventId,
    inheritance,
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
  }, { key: await activeRunStorageKey(page) });

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
    key: await activeRunStorageKey(page),
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

  await page.locator('[data-slime-card="contained-record"]').click();
  const welfarePanel = page.locator('[data-slime-welfare-panel="contained-record"]');
  await expect(welfarePanel).toContainText('Welfare');
  await expect(welfarePanel.locator('[data-slime-welfare-need]')).toHaveCount(5);
  await expect(welfarePanel.locator('[data-slime-care-plan="contained-record"] option')).toHaveCount(4);
  await welfarePanel.locator('[data-slime-care-plan="contained-record"]').selectOption('recovery');
  const welfare = await page.evaluate(() => window.helixHeresyDebug.welfareSnapshot('contained-record'));
  expect(welfare.record.carePlanId).toBe('recovery');
  expect(welfare.workFactor).toBe(0);
  expect(Object.keys(welfare.assessment.needs)).toEqual(['nourishment', 'recovery', 'habitat', 'social', 'stimulation']);

  const scrollingCard = await page.locator('[data-slime-card="contained-record"]').elementHandle();
  if (!scrollingCard) throw new Error('Living creature card was not rendered.');
  const scrollProbe = await scrollingCard.evaluate((element) => {
    document.querySelector('#slimeList')?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 90 }));
    return {
      connected: element.isConnected,
      render: window.helixHeresyDebug.managementRenderProbe(),
    };
  });
  expect(scrollProbe).toEqual({
    connected: true,
    render: { tab: 'specimens', scrollInputActive: true, deferred: true },
  });
  await page.waitForTimeout(350);
  expect(await scrollingCard.evaluate((element) => element.isConnected)).toBe(false);

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
  }, { key: await activeRunStorageKey(page) });

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
      generation: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      harvestedProcedures: {},
      nextOverflowEventAt: null,
    }];
    state.heredity = {
      version: 1,
      nextEventNumber: 2,
      events: [{
        id: 'reproduction-1',
        methodId: 'naturalDivision',
        priorityId: 'balanced',
        broodId: 'brood-records',
        createdAt: 30,
        targetCount: 1,
        parents: [{ id: 'parent-dead', name: 'REC-PARENT', genome, generation: 0 }],
        children: [{ id: 'child-record', name: 'REC-CHILD', genome, generation: 1, inheritance: child.inheritance }],
        environment: { contamination: 0, ambientMana: 50 },
        summary: 'Natural Division produced one recorded offspring.',
      }],
    };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: await activeRunStorageKey(page),
    genome,
    child: slimeFixture({
      id: 'child-record',
      name: 'REC-CHILD',
      genome,
      parentIds: ['parent-dead'],
      broodId: 'brood-records',
      generation: 1,
      reproductionEventId: 'reproduction-1',
      inheritance: {
        methodId: 'naturalDivision',
        priorityId: 'balanced',
        mutationBand: 'variable',
        contributions: [{ parentId: 'parent-dead', start: 1, end: 26 }],
        mutations: [],
      },
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
  await expect(page.locator('#lineageList')).toContainText('generation 1');
  await expect(page.locator('#lineageEventList')).toContainText('Natural Division');
  await expect(page.locator('#lineageEventList')).toContainText('0 mutations');
  await expect(page.locator('#lineageList')).not.toContainText('Undiscovered');

  const heredityResult = await page.evaluate(async () => {
    const debug = window.helixHeresyDebug;
    const parent = debug.livingHereditySnapshot().find((entry) => entry.id === 'child-record');
    const options = {
      methodId: 'forcedRecombination',
      priorityId: 'balanced',
      seed: 'creature-record-heredity',
      parents: [
        { id: 'left', genome: parent.genome },
        { id: 'right', genome: parent.genome.replace(/[ACGT]/g, (base) => ({ A: 'C', C: 'G', G: 'T', T: 'A' })[base]) },
      ],
      stabilityRisk: 5,
      stress: 0,
      integrity: 100,
      contamination: 0,
      ambientMana: 50,
    };
    const first = debug.inheritGenomeForTest(options);
    const second = debug.inheritGenomeForTest(options);
    const hasExactClone = Array.from({ length: 80 }, (_, index) => debug.inheritGenomeForTest({
      ...options,
      methodId: 'inducedDivision',
      priorityId: 'fidelity',
      seed: `exact-clone-${index}`,
      parents: [options.parents[0]],
    })).some((outcome) => outcome.mutations.length === 0);

    debug.addResearchResource('geneticMaterial', 1);
    const queued = debug.queueControlledReproduction({
      methodId: 'inducedDivision',
      priorityId: 'novelty',
      parentAId: 'child-record',
      targetCount: 2,
    });
    for (let step = 0; step < 4; step += 1) {
      const task = debug.taskStatusSnapshot().find((entry) => entry.type === 'resourceHaul' || entry.type === 'breed');
      if (!task) break;
      debug.advanceSimulation(Math.max(1, task.dueAt - task.createdAt + 5));
    }
    const naturalParent = debug.createSpatialTestSlime({ size: 'seedling', roomId: 'mainLab' });
    const naturalDivided = debug.forceNaturalDivisionForTest(naturalParent.id);
    return {
      deterministic: JSON.stringify(first) === JSON.stringify(second),
      contributions: first.contributions,
      hasExactClone,
      queued,
      naturalParentId: naturalParent.id,
      naturalDivided,
      heredity: debug.hereditySnapshot(),
      living: debug.livingHereditySnapshot(),
    };
  });

  expect(heredityResult.deterministic).toBe(true);
  expect(new Set(heredityResult.contributions.map((entry) => entry.parentId))).toEqual(new Set(['left', 'right']));
  expect(heredityResult.hasExactClone).toBe(true);
  expect(heredityResult.queued).toBe(true);
  const controlledEvent = heredityResult.heredity.events.find((event) => event.methodId === 'inducedDivision');
  expect(controlledEvent?.children).toHaveLength(2);
  expect(controlledEvent?.children.every((child) => child.generation === 2 && child.inheritance)).toBe(true);
  const controlledBodies = heredityResult.living.filter((slime) => slime.id === 'child-record' || slime.reproductionEventId === controlledEvent.id);
  expect(controlledBodies).toHaveLength(3);
  expect(controlledBodies.reduce((total, slime) => total + slime.mass, 0)).toBeCloseTo(100, 5);
  expect(heredityResult.naturalDivided).toBe(true);
  const naturalEvent = [...heredityResult.heredity.events].reverse().find((event) => event.methodId === 'naturalDivision' && event.parents[0]?.id === heredityResult.naturalParentId);
  expect(naturalEvent?.children.length).toBeGreaterThan(0);
  const naturalBodies = heredityResult.living.filter((slime) => slime.id === heredityResult.naturalParentId || slime.reproductionEventId === naturalEvent.id);
  expect(naturalBodies.reduce((total, slime) => total + slime.mass, 0)).toBeCloseTo(100, 5);

  await page.locator('[data-creature-record-tab="lineage"]').click();
  await expect(page.locator('#lineageEventList')).toContainText('Induced Division');
  await expect(page.locator('#lineageList')).toContainText('generation 2');
});
