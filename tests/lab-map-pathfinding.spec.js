// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { genomeForTraits } = require('./gene-fixtures');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';
const preferencesKey = 'helix-heresy-v1-preferences';

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function loadSavedRun(page, options = {}) {
  const restoreSelectedSlime = options.restoreSelectedSlime !== false
    ? await page.evaluate(({ key }) => {
      const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
      const state = payload.state || payload;
      if (state.selection?.kind === 'slime' && state.selection.id) {
        return state.selection.id;
      }
      return state.selectedSlimeId || null;
    }, { key: storageKey })
    : null;
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  if (restoreSelectedSlime) {
    await page.locator('[data-workspace-tab="specimens"]').click();
    await page.locator(`[data-slime-card="${restoreSelectedSlime}"]`).click();
    await page.locator('[data-workspace-tab="map"]').click();
  }
}

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

async function openOverlayMenu(page) {
  await page.locator('[data-overlay-menu-toggle="true"]').click();
  await expect(page.locator('[data-overlay-menu="true"]')).toBeVisible();
}

async function selectMapOverlay(page, overlayId) {
  await openOverlayMenu(page);
  await page.locator('[data-map-overlay-select="true"]').selectOption(overlayId);
  await expect(page.locator('[data-overlay-menu="true"]')).toHaveCount(0);
}

async function mapRoomCell(page, roomId) {
  return page.evaluate(({ key, roomId }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.labMap.rooms[roomId].anchor;
  }, { key: storageKey, roomId });
}

async function selectMapRoom(page, roomId) {
  await page.locator('[data-workspace-tab="map"]').click();
  const cell = await mapRoomCell(page, roomId);
  await page.locator(`[data-map-x="${cell.x}"][data-map-y="${cell.y}"]`).click();
  return cell;
}

async function openSelectionActions(page) {
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]')).toBeVisible();
  return page.locator('[data-context-command-panel="true"]');
}

async function runSelectionCommand(page, name) {
  const panel = await openSelectionActions(page);
  await panel.getByRole('button', { name }).click();
}

async function ensureDigTileDrafted(page, x, y) {
  await page.locator(`[data-map-x="${x}"][data-map-y="${y}"]`).click();
  const panel = await openSelectionActions(page);
  const add = panel.getByRole('button', { name: 'Add Dig Tile' });
  if (await add.count()) {
    await add.click();
    return;
  }
  await expect(panel.getByRole('button', { name: 'Remove Dig Tile' })).toBeVisible();
}

async function selectDoorActions(page, key) {
  await page.locator('[data-workspace-tab="map"]').click();
  await page.locator(`[data-map-door="${key}"]`).first().click();
  return openSelectionActions(page);
}

async function selectIncidentBySource(page, sourceId) {
  await page.evaluate(({ key, sourceId }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const incident = (state.incidents || []).find((candidate) => candidate.sourceId === sourceId);
    if (!incident) {
      throw new Error(`incident not found for ${sourceId}`);
    }
    state.selection = { kind: 'incident', id: incident.id };
    state.selectedMapTarget = { kind: 'incident', id: incident.id };
    state.ui ||= {};
    state.ui.activeWorkspaceTab = 'map';
    state.ui.selectionInspectorExpanded = true;
    state.ui.selectionInspectorTab = 'actions';
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, sourceId });
  await loadSavedRun(page, { restoreSelectedSlime: false });
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'incident');
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  const panel = page.locator('[data-context-command-panel="true"]');
  await expect(panel).toContainText('Incident');
  return panel;
}

test('slime ai record mirrors contained baseline behavior', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.selectedSlimeId = 'contained-ai';
    state.slimes = [{
      id: 'contained-ai',
      name: 'AI-001',
      genome: state.currentGenome,
      source: 'AI fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-ai="contained-ai"]')).toContainText('AI: Contained');
  await expect(page.locator('[data-slime-activity-panel="contained-ai"]')).toContainText('Activity');
  await expect(page.locator('[data-slime-activity-panel="contained-ai"]')).toContainText('State');
  await expect(page.locator('[data-slime-activity-panel="contained-ai"]')).toContainText('Contained');
  await expect(page.locator('[data-slime-activity-panel="contained-ai"]')).toContainText('Intent');
  await expect(page.locator('[data-slime-activity-panel="contained-ai"]')).toContainText('rest');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('AI-001');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('State');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('contained');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('Target raw');
  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'contained-ai');
    return slime.ai;
  }, { key: storageKey });

  expect(result).toMatchObject({
    state: 'contained',
    intent: 'rest',
    urgency: 'low',
    target: { kind: 'container' },
  });
});

test('slime ai drives summarize biological pressure without executing behavior', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const containers = state.containers || [];
    const jarFor = (index) => containers.find((container) => container.id === `basic-${index}`) || containers[index - 1] || containers[0];
    const makeSlime = (id, name, jar, stats, extra = {}) => ({
      id,
      name,
      genome: state.currentGenome,
      source: 'Drive fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      ...extra,
    });
    state.selectedSlimeId = 'drive-hungry';
    state.slimes = [
      makeSlime('drive-hungry', 'DRIVE-FOOD', jarFor(1), {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 4, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      }),
      makeSlime('drive-injured', 'DRIVE-INJURY', jarFor(4), {
        bodyIntegrity: { current: 20, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      }),
      makeSlime('drive-stressed', 'DRIVE-STRESS', jarFor(3), {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 82, max: 100 },
      }),
      makeSlime('drive-worker', 'DRIVE-WORK', jarFor(2), {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      }, { job: 'cleanup' }),
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-drive="drive-hungry"]')).toContainText('Drive: Hunger critical');
  await expect(page.locator('[data-slime-drives="drive-hungry"]')).toContainText('Hunger');
  await expect(page.locator('[data-slime-drives="drive-hungry"]')).toContainText('Critical');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const byId = Object.fromEntries((state.slimes || []).map((slime) => [slime.id, slime.ai]));
    return byId;
  }, { key: storageKey });

  expect(result['drive-hungry']).toMatchObject({
    dominantDrive: 'hunger',
    intent: 'seekFood',
    urgency: 'critical',
    drives: { hunger: { band: 'critical' } },
  });
  expect(result['drive-injured']).toMatchObject({
    dominantDrive: 'injury',
    intent: 'rest',
    urgency: 'high',
    drives: { injury: { band: 'high' } },
  });
  expect(result['drive-stressed'].drives.stress.band).toBe('high');
  expect(result['drive-stressed'].dominantDrive).toMatch(/stress|containment/);
  expect(result['drive-worker']).toMatchObject({
    dominantDrive: 'work',
    state: 'working',
    intent: 'continueJob',
    drives: { work: { band: 'moderate' } },
  });
});

test('slime threat response reflects pain, stress, and hidden response traits', async ({ page }) => {
  await startRun(page);
  const context = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { seed: state.seed, complexity: state.complexity, currentGenome: state.currentGenome };
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      behavior: 'hiding',
      stability: 'volatile',
    },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.paused = true;
    state.clock = 120;
    state.selectedSlimeId = 'response-pained';
    state.slimes = [{
      id: 'response-pained',
      name: 'RESPONSE-001',
      genome,
      source: 'Threat response fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats: {
        bodyIntegrity: { current: 45, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 50, max: 100 },
      },
      lastPainAt: 110,
      lastPainAmount: 10,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-response="response-pained"]')).toContainText(/Response: (Pained|Panicked)/);
  await expect(page.locator('[data-slime-response-panel="response-pained"]')).toContainText('Threat Response');
  await expect(page.locator('[data-slime-response-panel="response-pained"]')).toContainText('recent injury');
  await expect(page.locator('[data-slime-response-panel="response-pained"]')).toContainText('Behavior');
  await expect(page.locator('[data-slime-response-panel="response-pained"]')).toContainText('Stability');

  const response = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'response-pained');
    return slime.ai?.response;
  }, { key: storageKey });

  expect(['pained', 'panicked']).toContain(response.state);
  expect(['high', 'critical']).toContain(response.intensity);
  expect(response.reasons).toEqual(expect.arrayContaining(['rising stress', 'body integrity is weakened', 'recent injury']));
  expect(response.unknownFactors).toEqual(expect.arrayContaining(['Behavior', 'Stability']));
});

test('slime ai perception stays local and respects containment limits', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const containers = state.containers || [];
    const jarFor = (index) => containers.find((container) => container.id === `basic-${index}`) || containers[index - 1] || containers[0];
    const mainLab = (state.rooms || []).find((room) => room.id === 'mainLab');
    if (mainLab?.attributes?.contamination) {
      mainLab.attributes.contamination.current = 55;
    }
    const mainPitDoor = Object.values(state.doors || {}).find((door) => {
      const ids = door.roomIds || [];
      return ids.includes('mainLab') && ids.includes('pits');
    });
    if (mainPitDoor) {
      mainPitDoor.state = 'open';
      mainPitDoor.lockState = 'unlocked';
      mainPitDoor.sealState = 'unsealed';
    }
    state.roomStockpiles ||= {};
    state.roomStockpiles.mainLab ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    state.roomStockpiles.mainLab.resources ||= {};
    state.roomStockpiles.mainLab.resources.waste = 6;
    state.resources ||= {};
    state.resources.waste = 6;
    state.nextResidueNumber = Math.max(2, Number(state.nextResidueNumber) || 1);
    state.feedingResidues = [{
      id: 'residue-perception',
      typeKey: 'looseBiomatter',
      amount: 5,
      location: { type: 'room', roomId: 'mainLab' },
      tags: ['organic'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    const now = Number(state.clock) || 0;
    state.corpses = [{
      id: 'corpse-perception',
      specimenId: 'dead-perception',
      name: 'PERCEPT-DEAD',
      genome: state.currentGenome,
      source: 'Perception fixture',
      deathReason: 'fixture',
      diedAt: now,
      roomId: 'mainLab',
      containerId: null,
      storage: 'room',
      mapCell: { x: 20, y: 14 },
      consumedProgress: 0,
      ruined: false,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      necropsyReport: '',
      harvestedProcedures: {},
    }];
    const stats = {
      bodyIntegrity: { current: 100, max: 100 },
      nutrition: { current: 80, max: 100 },
      currentMass: { current: 100, max: 100 },
      divisionPressure: { current: 0, max: 100 },
      stress: { current: 0, max: 100 },
    };
    const makeSlime = (id, name, extra = {}) => ({
      id,
      name,
      genome: state.currentGenome,
      source: 'Perception fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: { x: 20, y: 15 },
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      ...extra,
    });
    const sealedJar = jarFor(2);
    state.selectedSlimeId = 'perception-loose';
    state.slimes = [
      makeSlime('perception-loose', 'PERCEPT-LOOSE'),
      makeSlime('perception-contained', 'PERCEPT-SEALED', {
        status: 'contained',
        containerId: sealedJar.id,
        roomId: sealedJar.roomId,
        mapCell: null,
      }),
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-perception="perception-loose"]')).toContainText('Perceives:');
  await expect(page.locator('[data-slime-perception-panel="perception-loose"]')).toContainText('Loose biomatter');
  await expect(page.locator('[data-slime-perception-panel="perception-loose"]')).toContainText('corpse');
  await expect(page.locator('[data-slime-perception-panel="perception-loose"]')).toContainText('open air from Pits');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return Object.fromEntries((state.slimes || []).map((slime) => [slime.id, slime.ai?.perception]));
  }, { key: storageKey });

  const looseLabels = result['perception-loose'].entries.map((entry) => entry.label);
  expect(result['perception-loose'].scope).toBe('room-local');
  expect(looseLabels).toEqual(expect.arrayContaining([
    'Loose biomatter',
    'waste stores',
    'scientist nearby',
    'open air from Pits',
  ]));
  expect(looseLabels.some((label) => label.includes('corpse'))).toBe(true);
  expect(result['perception-loose'].entries.map((entry) => entry.kind)).toEqual(expect.arrayContaining(['food', 'corpse', 'waste', 'actor', 'door']));

  const containedLabels = result['perception-contained'].entries.map((entry) => entry.label);
  expect(result['perception-contained'].scope).toBe('container-local');
  expect(containedLabels).toContain('container muffles room cues');
  expect(containedLabels).not.toContain('Loose biomatter');
});

test('known habitat fit appears on selected slimes and bad habitat raises stress', async ({ page }) => {
  await startRun(page);
  const context = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { seed: state.seed, complexity: state.complexity, currentGenome: state.currentGenome };
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      element: 'water',
      consistency: 'watery',
      sustenance: 'moisture absorber',
      behavior: 'idle pooling',
      stability: 'nervous',
    },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    jar.environment ||= {};
    for (const def of ['temperature', 'light', 'ambientMana', 'moisture', 'contamination', 'electricalCharge']) {
      jar.environment[def] ||= { current: 50, baseline: 50, recoveryPerHour: 0 };
    }
    jar.environment.moisture.current = 0;
    jar.environment.moisture.baseline = 0;
    jar.environment.temperature.current = 85;
    jar.environment.temperature.baseline = 85;
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'habitat-contained';
    state.slimes = [{
      id: 'habitat-contained',
      name: 'HAB-CONTAINED',
      genome,
      source: 'Habitat fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 90, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: { element: true, consistency: true, sustenance: true, behavior: true, stability: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-habitat="habitat-contained"]')).toContainText('Habitat: Hostile');
  await expect(page.locator('[data-slime-habitat-panel="habitat-contained"]')).toContainText('Moisture is below');
  await skipSeconds(page, 21600);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'habitat-contained');
    return {
      stress: slime.stats.stress.current,
      habitat: slime.habitat,
    };
  }, { key: storageKey });

  expect(result.stress).toBeGreaterThan(0.5);
  expect(['Hostile', 'Poor Fit']).toContain(result.habitat.label);
});

test('released slimes can seek better adjacent habitat when no food is available', async ({ page }) => {
  await startRun(page);
  const context = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { seed: state.seed, complexity: state.complexity, currentGenome: state.currentGenome };
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      element: 'water',
      consistency: 'watery',
      sustenance: 'moisture absorber',
      behavior: 'idle pooling',
      stability: 'nervous',
    },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const main = (state.rooms || []).find((room) => room.id === 'mainLab');
    const menagerie = (state.rooms || []).find((room) => room.id === 'menagerie');
    main.attributes.moisture.current = 0;
    main.attributes.moisture.baseline = 0;
    menagerie.attributes.moisture.current = 95;
    menagerie.attributes.moisture.baseline = 95;
    const door = state.doors?.['mainLab::menagerie'] || state.doors?.['menagerie::mainLab'];
    if (door) {
      door.state = 'open';
      door.lockState = 'unlocked';
      door.sealState = 'unsealed';
      door.breached = false;
    }
    state.paused = true;
    state.clock = 0;
    state.feedingResidues = [];
    state.resources ||= {};
    state.resources.waste = 0;
    state.roomStockpiles ||= {};
    for (const stockpile of Object.values(state.roomStockpiles)) {
      stockpile.resources ||= {};
      stockpile.resources.waste = 0;
    }
    state.selectedSlimeId = 'habitat-seeker';
    state.slimes = [{
      id: 'habitat-seeker',
      name: 'HAB-SEEKER',
      genome,
      source: 'Habitat fixture',
      createdAt: 0,
      deathAt: 100000,
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
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 100, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: { element: true, consistency: true, sustenance: true, behavior: true, stability: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);
  await skipSeconds(page, 1);

  await expect(page.locator('[data-slime-card="habitat-seeker"]')).toContainText(/better habitat|moving/i);
  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'habitat-seeker');
    return {
      ai: slime.ai,
      movement: slime.autonomousMovement,
      activity: slime.roomActivity,
      perception: slime.ai?.perception,
    };
  }, { key: storageKey });

  expect(result.ai.intent).toBe('seekHabitat');
  expect(result.ai.target.kind).toBe('habitat');
  expect(result.movement.targetRoomId).toBe('menagerie');
  expect(result.activity.type).toBe('seekingHabitat');
  expect(result.perception.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'environment',
      targetKind: 'room',
      targetId: 'menagerie',
    }),
  ]));
});

test('lab blueprint stores room footprints and queues scientist movement with map paths', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);

  await expect(page.locator('[data-workspace-tab="map"]')).toHaveClass(/active-workspace-tab/);
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-workspace-panel="map"]')).toHaveClass(/active-workspace-panel/);
  await expect(page.locator('[data-workspace-category="lab"]')).toContainText('Lab');
  await expect(page.locator('[data-workspace-category="work"]')).toContainText('Work');
  await expect(page.locator('[data-workspace-category="creatures"]')).toContainText('Creatures');
  await expect(page.locator('[data-workspace-category="stores"]')).toContainText('Stores');
  await expect(page.locator('[data-workspace-category="policy"]')).toContainText('Policy');
  await expect(page.locator('[data-workspace-category="records"]')).toContainText('Records');
  await expect(page.locator('[data-workspace-category="debug"]')).toContainText('Debug');

  await page.locator('[data-workspace-tab="specimens"]').click();
  await expect(page.locator('[data-workspace-tab="specimens"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-workspace-panel="specimens"]')).toHaveClass(/active-workspace-panel/);
  await expect(page.locator('[data-workspace-panel="map"]')).not.toHaveClass(/active-workspace-panel/);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-workspace-panel="map"]')).toHaveClass(/active-workspace-panel/);

  await page.locator('#queueToggleBtn').click();
  await expect(page.locator('#queueToggleBtn')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-workspace-panel="tasks"]')).toHaveClass(/active-workspace-panel/);
  await expect(page.locator('#taskList')).toContainText('Queue is clear');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');

  await page.locator('[data-workspace-tab="map"]').click();
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-workspace-panel="map"]')).toHaveClass(/active-workspace-panel/);
  await expect(page.locator('[data-workspace-tab="cheats"]')).toBeVisible();
  await expect(page.locator('[data-lab-map-panel="true"] > .lab-map-legend')).toHaveCount(0);
  await openOverlayMenu(page);
  await expect(page.locator('[data-overlay-legend="none"]')).toContainText('Base blueprint only');
  await expect(page.locator('#mapOverlaySelect option[value="debug"]')).toHaveCount(1);
  await page.locator('[data-overlay-menu="true"]').getByRole('button', { name: 'Close' }).click();
  await page.locator('#debugToggleBtn').click();
  await expect(page.locator('#debugToggleBtn')).toHaveText('Debug Off');
  await expect(page.locator('[data-workspace-tab="cheats"]')).toBeHidden();
  await expect(page.locator('[data-workspace-category="debug"]')).toBeHidden();
  await openOverlayMenu(page);
  await expect(page.locator('#mapOverlaySelect option[value="debug"]')).toHaveCount(0);
  await page.locator('[data-overlay-menu="true"]').getByRole('button', { name: 'Close' }).click();
  const debugOffState = await page.evaluate(({ key, prefsKey }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const prefs = JSON.parse(window.localStorage.getItem(prefsKey) || '{}');
    return {
      hasSavedDebugFlag: Object.prototype.hasOwnProperty.call(state.ui || {}, 'debugEnabled'),
      preferenceKeys: Object.keys(prefs),
      activeWorkspaceTab: state.ui.activeWorkspaceTab,
    };
  }, { key: storageKey, prefsKey: preferencesKey });
  expect(debugOffState).toEqual({
    hasSavedDebugFlag: false,
    preferenceKeys: ['version', 'compactFeedVisible', 'compactFeedFades', 'compactMessageLimit'],
    activeWorkspaceTab: 'map',
  });
  await page.reload();
  await expect(page.locator('#debugToggleBtn')).toHaveText('Debug On');
  await page.locator('#loadLastSaveBtn').click();
  await expect(page.locator('[data-workspace-tab="cheats"]')).toBeVisible();
  await page.locator('[data-workspace-tab="policies"]').click();
  await expect(page.locator('[data-policy-menu-tab="overview"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-policy-menu-panel="overview"]')).toBeVisible();
  await page.locator('[data-policy-menu-tab="feeding"]').click();
  await expect(page.locator('[data-policy-menu-panel="feeding"]')).toBeVisible();
  await expect(page.locator('#feedingPolicyList')).toContainText('Feed below');
  await page.locator('[data-policy-menu-tab="handling"]').click();
  await expect(page.locator('[data-policy-menu-panel="handling"]')).toBeVisible();
  await expect(page.locator('#handlingPolicyList')).toContainText('Handling method');
  await page.locator('[data-policy-menu-tab="automation"]').click();
  await expect(page.locator('[data-policy-menu-panel="automation"]')).toBeVisible();
  await expect(page.locator('#automationPolicyList')).toContainText(/No living specimens|Global automation exclusions/);
  await page.locator('[data-workspace-tab="cheats"]').click();
  await expect(page.locator('[data-debug-menu-tab="cheats"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-debug-menu-panel="cheats"]')).toBeVisible();
  await expect(page.locator('#xpCommandInput')).toBeVisible();
  await page.locator('[data-debug-menu-tab="ai"]').click();
  await expect(page.locator('[data-debug-menu-panel="ai"]')).toBeVisible();
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('Slime AI Debug');
  await page.locator('[data-workspace-tab="map"]').click();

  await expect(page.locator('[data-lab-map-panel="true"]')).toBeVisible();
  await expect(page.locator('#clockReadout')).toContainText('Day 1 00:00:00');
  await expect(page.locator('#roomSummary')).toContainText('Blueprint: 40 x 25 m; 6 mapped rooms');
  await expect(page.locator('.lab-map-cell.object-cell').first()).toBeVisible();

  const initial = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`
    ]));
    return {
      map: state.labMap,
      scientist: state.scientist,
      containers: state.containers,
      containerCellsValid: (state.containers || []).every((container) =>
        container.mapCell
        && (state.labMap.rooms[container.roomId]?.cells || []).some((cell) => cell.x === container.mapCell.x && cell.y === container.mapCell.y)
        && !doorCells.has(`${container.mapCell.x},${container.mapCell.y}`)
      )
    };
  }, { key: storageKey });

  expect(initial.map.tileSizeM).toBe(1);
  await expect(page.locator('.lab-map-cell')).toHaveCount(initial.map.width * initial.map.height);
  expect(initial.map.rooms.mainLab).toMatchObject({ x: 16, y: 10, width: 12, height: 10 });
  expect(initial.map.rooms.storageRoom).toMatchObject({ x: 18, y: 5, width: 7, height: 5 });
  expect(initial.map.rooms.pits.cells.length).toBeLessThan(initial.map.rooms.pits.width * initial.map.rooms.pits.height);
  expect(initial.map.doors['mainLab::storageRoom']).toMatchObject({
    from: { x: 21, y: 9 },
    to: { x: 21, y: 10 }
  });
  expect(initial.scientist.roomId).toBe('mainLab');
  expect(initial.scientist.mapCell).toEqual(initial.map.rooms.mainLab.anchor);
  expect(initial.scientist.physicalPresence.moveSpeedMps).toBeGreaterThan(0);
  expect(initial.containerCellsValid).toBe(true);
  expect(initial.containers.find((container) => container.id === 'basic-11').mapCell).toBeTruthy();
  expect(await page.locator('.lab-map-cell.blocking-object-cell').count()).toBeGreaterThan(initial.containers.length);

  const semanticMap = await page.evaluate(() => window.helixHeresyDebug.mapViewSnapshot());
  expect(semanticMap.cells).toHaveLength(initial.map.width * initial.map.height);
  const scientistCell = semanticMap.cells.find((cell) => cell.scientist);
  expect(scientistCell).toMatchObject({
    base: { kind: 'room', roomId: 'mainLab' },
    visual: { glyph: 'S', spriteKey: 'actor.scientist' },
    target: { kind: 'scientist' },
  });
  expect(scientistCell.tooltip.parts).toContain('Scientist');
  expect(scientistCell).not.toHaveProperty('classNames');
  expect(scientistCell).not.toHaveProperty('dataset');
  expect(scientistCell).not.toHaveProperty('title');

  const objectCell = semanticMap.cells.find((cell) => cell.object?.blocking);
  expect(objectCell).toBeTruthy();
  expect(objectCell.object).toMatchObject({
    symbols: expect.arrayContaining(['C']),
    blocking: true,
  });
  expect(objectCell.spriteKey).toBeTruthy();
  const objectDomSnapshot = await page.evaluate(({ x, y }) => {
    return window.helixHeresyDebug
      .mapDomSnapshot()
      .find((cell) => cell.dataset.mapX === String(x) && cell.dataset.mapY === String(y));
  }, objectCell.cell);
  expect(objectDomSnapshot.classNames).toEqual(expect.arrayContaining(['lab-map-cell', 'object-cell', 'blocking-object-cell']));
  const objectTile = page.locator(`[data-map-x="${objectCell.cell.x}"][data-map-y="${objectCell.cell.y}"]`);
  await expect(objectTile).toHaveText(objectCell.visual.glyph);
  await expect(objectTile).toHaveAttribute('title', objectCell.tooltip.text);

  await selectMapRoom(page, 'storageRoom');
  await runSelectionCommand(page, 'Move Scientist Here');

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'scientistMove');
    return { task, storageAnchor: state.labMap.rooms.storageRoom.anchor };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.fromRoomId).toBe('mainLab');
  expect(queued.task.data.toRoomId).toBe('storageRoom');
  expect(queued.task.data.mapPath.length).toBeGreaterThan(1);
  expect(queued.task.data.toCell).toEqual(queued.storageAnchor);
  expect(queued.task.data.doorTransit.some((step) => step.fromRoomId === 'mainLab' && step.toRoomId === 'storageRoom')).toBe(true);
  expect(queued.task.dueAt - queued.task.createdAt).toBeLessThan(60);
  await expect(page.locator('.lab-map-cell.queued-path-cell')).toHaveCount(0);
  await selectMapOverlay(page, 'movement');
  await expect(page.locator('.lab-map-cell.queued-path-cell')).toHaveCount(queued.task.data.mapPath.length);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Move scientist to Storage Room' }).getByRole('button', { name: 'Finish' }).click();

  const arrived = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      scientist: state.scientist,
      storageAnchor: state.labMap.rooms.storageRoom.anchor
    };
  }, { key: storageKey });

  expect(arrived.scientist.roomId).toBe('storageRoom');
  expect(arrived.scientist.mapCell).toEqual(arrived.storageAnchor);
  await expect(page.locator('.lab-map-cell.scientist-cell')).toHaveAttribute('data-map-room', 'storageRoom');

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('released slimes move toward accessible residue without raiding packaged storage supplies', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'none', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'loose-seeker';
    state.resources = { ...(state.resources || {}), organicFeedstock: 5 };
    state.roomStockpiles ||= {};
    state.roomStockpiles.storageRoom ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    state.roomStockpiles.storageRoom.resources = {
      ...(state.roomStockpiles.storageRoom.resources || {}),
      organicFeedstock: 5,
    };
    state.roomStockpiles.mainLab ||= { resources: {}, inventory: {}, collectedByproducts: {}, specimenMaterials: {} };
    delete state.roomStockpiles.mainLab.resources?.organicFeedstock;
    state.feedingResidues = [{
      id: 'residue-menagerie',
      typeKey: 'looseBiomatter',
      amount: 4,
      location: { type: 'room', roomId: 'menagerie' },
      tags: ['organic', 'mess'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'loose-seeker',
      name: 'LOOSE-001',
      genome,
      source: 'Autonomous movement fixture',
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
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        currentMass: { current: 50, max: 100 },
      },
      revealed: { shape: true, consistency: true, appendages: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await expect(page.locator('[data-slime-card="loose-seeker"]')).toContainText('uncontained');
  await skipSeconds(page, 1);
  await expect(page.locator('[data-slime-card="loose-seeker"]')).toContainText(/seeking|moving/i);
  await expect(page.locator('[data-slime-ai="loose-seeker"]')).toContainText(/AI: (Moving|Seeking)/);
  await expect(page.locator('[data-slime-movement="loose-seeker"]')).toContainText('Move:');
  await expect(page.locator('[data-slime-activity-panel="loose-seeker"]')).toContainText('Activity');
  await expect(page.locator('[data-slime-activity-panel="loose-seeker"]')).toContainText('seek food');
  await expect(page.locator('[data-slime-activity-panel="loose-seeker"]')).toContainText('Path');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('LOOSE-001');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('Intent');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('seekFood');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('Perception 1');
  await expect(page.locator('[data-ai-debug-panel="true"]')).toContainText('Movement record');

  const earlyAi = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'loose-seeker');
    const movement = slime.autonomousMovement;
    const crossingStates = [];
    for (let index = 0; index < (movement?.path || []).length - 1; index += 1) {
      const current = movement.path[index];
      const next = movement.path[index + 1];
      const mapDoor = Object.values(state.labMap?.doors || {}).find((door) =>
        (door.from.x === current.x && door.from.y === current.y && door.to.x === next.x && door.to.y === next.y)
        || (door.to.x === current.x && door.to.y === current.y && door.from.x === next.x && door.from.y === next.y)
      );
      if (mapDoor) {
        const door = state.doors?.[mapDoor.key] || mapDoor;
        crossingStates.push({
          key: mapDoor.key,
          state: door.state,
          lockState: door.lockState,
          sealState: door.sealState,
          breached: Boolean(door.breached || door.condition <= 0),
        });
      }
    }
    return { ai: slime.ai, movement, crossingStates };
  }, { key: storageKey });
  expect(['moving', 'seeking']).toContain(earlyAi.ai.state);
  expect(earlyAi.ai.intent).toBe('seekFood');
  expect(earlyAi.ai.target.kind).toBe('residue');
  expect(earlyAi.ai.target.label).toMatch(/trace from Menagerie/);
  expect(earlyAi.ai.perception.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'trace',
      targetKind: 'room',
      targetId: 'menagerie',
    }),
  ]));
  expect(earlyAi.movement.distanceMeters).toBeGreaterThan(0);
  expect(earlyAi.movement.speedMps).toBeGreaterThan(0);
  expect(earlyAi.movement.movementFactors).toEqual(expect.arrayContaining(['reduced mass']));
  expect(earlyAi.crossingStates.every((door) => door.breached || (door.state === 'open' && door.sealState !== 'sealed'))).toBe(true);

  await skipSeconds(page, 1800);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'loose-seeker');
    return {
      slime,
      storageOrganic: state.roomStockpiles?.storageRoom?.resources?.organicFeedstock || 0,
      residueAmount: (state.feedingResidues || []).find((residue) => residue.id === 'residue-menagerie')?.amount || 0,
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(result.slime.roomId).toBe('menagerie');
  expect(result.residueAmount).toBeLessThan(4);
  expect(result.storageOrganic).toBe(5);
  expect(result.tasks.some((task) => /creature|slime|autonomous/i.test(task.type))).toBe(false);
  await expect(page.locator('[data-map-target-kind="slime"][data-map-target-id="loose-seeker"]').first()).toHaveAttribute('title', /feeding|seeking|loose/i);
});

test('released slime movement stops if an open route closes ahead of it', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'none', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const menagerieDoor = state.doors?.['mainLab::menagerie'] || state.doors?.['menagerie::mainLab'];
    if (menagerieDoor) {
      menagerieDoor.state = 'open';
      menagerieDoor.lockState = 'unlocked';
      menagerieDoor.sealState = 'unsealed';
    }
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'door-route';
    state.feedingResidues = [{
      id: 'residue-menagerie-route',
      typeKey: 'looseBiomatter',
      amount: 4,
      location: { type: 'room', roomId: 'menagerie' },
      tags: ['organic', 'mess'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'door-route',
      name: 'ROUTE-001',
      genome,
      source: 'Mid-route door fixture',
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
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        bodyIntegrity: { current: 100, max: 100 },
        currentMass: { current: 20, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: { shape: true, consistency: true, appendages: true },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await skipSeconds(page, 1);
  const started = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'door-route');
    return {
      movement: slime.autonomousMovement,
      ai: slime.ai,
    };
  }, { key: storageKey });
  expect(started.movement).toBeTruthy();
  expect(started.ai.intent).toBe('seekFood');

  const doorActions = await selectDoorActions(page, 'mainLab::menagerie');
  await doorActions.getByRole('button', { name: 'Close Door' }).click();
  const doorAfterClose = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors?.['mainLab::menagerie'] || state.doors?.['menagerie::mainLab'];
  }, { key: storageKey });
  expect(doorAfterClose.state).toBe('closed');
  await skipSeconds(page, 1);

  await expect(page.locator('[data-slime-card="door-route"]')).toContainText('pressing against closed door');
  const blocked = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'door-route');
    return {
      roomId: slime.roomId,
      movement: slime.autonomousMovement,
      activity: slime.roomActivity,
      ai: slime.ai,
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(blocked.roomId).toBe('mainLab');
  expect(blocked.movement).toBeNull();
  expect(blocked.activity).toMatchObject({
    type: 'pressingClosedDoor',
    targetKind: 'residue',
  });
  expect(blocked.ai).toMatchObject({
    state: 'blocked',
    intent: 'blocked',
    target: { kind: 'door' },
  });
  expect(blocked.tasks.some((task) => /creature|slime|autonomous/i.test(task.type))).toBe(false);
});

test('released slimes press blocked doors and expose possible intent instead of queueing movement', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed,
    traits: { element: 'none', behavior: 'idle pooling', stability: 'placid' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.selectedSlimeId = 'door-seeker';
    state.feedingResidues = [{
      id: 'residue-storage',
      typeKey: 'looseBiomatter',
      amount: 3,
      location: { type: 'room', roomId: 'storageRoom' },
      tags: ['organic', 'mess'],
      sourceLabels: ['test spill'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    state.slimes = [{
      id: 'door-seeker',
      name: 'DOOR-001',
      genome,
      source: 'Blocked door fixture',
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
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        currentMass: { current: 50, max: 100 },
      },
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await skipSeconds(page, 1);

  await expect(page.locator('[data-slime-card="door-seeker"]')).toContainText('pressing against closed door');
  await expect(page.locator('[data-slime-card="door-seeker"]')).toContainText('Possible intent: seeking accessible food');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'door-seeker');
    return {
      activity: slime.roomActivity,
      ai: slime.ai,
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(result.activity.type).toBe('pressingClosedDoor');
  expect(result.activity.targetKind).toBe('residue');
  expect(result.ai).toMatchObject({
    state: 'blocked',
    intent: 'blocked',
    target: { kind: 'door' },
  });
  expect(result.ai.perception.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'trace',
      targetKind: 'room',
      targetId: 'storageRoom',
    }),
  ]));
  expect(result.ai.reason).toContain('blocked');
  expect(result.tasks.some((task) => /creature|slime|autonomous/i.test(task.type))).toBe(false);
});

test('spatial incidents appear as map alerts with manual response controls', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.tasks = [];
    state.incidents = [];
    state.nextIncidentNumber = 1;
    state.rooms = (state.rooms || []).map((room) => {
      if (room.id !== 'mainLab') {
        return room;
      }
      return {
        ...room,
        attributes: {
          ...room.attributes,
          contamination: {
            ...(room.attributes?.contamination || {}),
            current: 62,
            baseline: 10,
          },
        },
      };
    });
    state.feedingResidues = [{
      id: 'residue-alert',
      typeKey: 'hazardousSludge',
      amount: 3,
      location: { type: 'room', roomId: 'mainLab' },
      tags: ['hazardous', 'mess'],
      sourceLabels: ['alert fixture'],
      sourceSlimeIds: [],
      createdAt: 0,
      updatedAt: 0,
    }];
    state.nextResidueNumber = 2;
    const alertContainer = (state.containers || []).find((container) => container.id === 'basic-1')
      || (state.containers || []).find((container) => container.type !== 'synthesis');
    if (alertContainer) {
      alertContainer.roomId = 'mainLab';
      alertContainer.breachState = 'compromised';
      alertContainer.lastBreach = {
        type: 'seepedSeal',
        label: 'Seeped seal',
        summary: 'A test seam is leaking containment residue.',
        at: 0,
        reusable: true,
      };
    }
    const mainAnchor = state.labMap.rooms.mainLab.anchor;
    state.slimes = [{
      id: 'alert-slime',
      name: 'ALERT-001',
      genome: state.currentGenome,
      source: 'Incident alert fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'mainLab',
      mapCell: { x: mainAnchor.x + 2, y: mainAnchor.y },
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 10000,
      roomActivity: {
        type: 'pressingClosedDoor',
        label: 'pressing against closed door',
        roomId: 'mainLab',
        targetRoomId: 'storageRoom',
        targetKind: 'residue',
        targetId: 'residue-storage',
        targetLabel: 'Loose biomatter',
        doorKey: 'mainLab::storageRoom',
        updatedAt: 0,
      },
      roomBehavior: { seeksContamination: false, eatsContamination: false },
      stats: {
        nutrition: { current: 20, max: 100 },
        currentMass: { current: 50, max: 100 },
      },
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await expect(page.locator('.lab-map-cell.incident-alert-cell')).toHaveCount(0);
  await selectMapOverlay(page, 'incidents');
  const incidentSummary = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return (state.incidents || [])
      .filter((incident) => incident.status !== 'resolved')
      .map((incident) => ({ label: incident.label, status: incident.status, sourceId: incident.sourceId }));
  }, { key: storageKey });
  expect(incidentSummary).toHaveLength(4);
  expect(incidentSummary.map((incident) => incident.label)).toEqual(expect.arrayContaining([
    'ALERT-001 pressing against a blocked door',
    'Main Lab contamination is fouled',
    'Hazardous sludge in Main Lab',
    'Basic Glass Jar 1 compromised'
  ]));
  const highlightedAlerts = await page.locator('.lab-map-cell.incident-alert-cell').count();
  expect(highlightedAlerts).toBeGreaterThan(0);
  const stackedAlerts = await page.locator('.lab-map-cell.incident-stack-cell').count();
  expect(stackedAlerts).toBeGreaterThan(0);

  const tasks = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.tasks || [];
  }, { key: storageKey });
  expect(tasks).toEqual([]);

  let incidentActions = await selectIncidentBySource(page, 'alert-slime');
  await incidentActions.getByRole('button', { name: /Acknowledge/ }).click();

  const acknowledged = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const incident = (state.incidents || []).find((candidate) => candidate.sourceId === 'alert-slime');
    return {
      acknowledgedAt: incident?.acknowledgedAt,
      responseTaskId: incident?.responseTaskId || '',
      tasks: state.tasks || [],
    };
  }, { key: storageKey });
  expect(acknowledged.acknowledgedAt).toBe(0);
  expect(acknowledged.responseTaskId).toBe('');
  expect(acknowledged.tasks).toEqual([]);

  incidentActions = await selectIncidentBySource(page, 'alert-slime');
  await expect(incidentActions.getByRole('button', { name: /Acknowledged/ })).toBeDisabled();
  await incidentActions.getByRole('button', { name: /Respond/ }).click();
  const response = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const incident = (state.incidents || []).find((candidate) => candidate.sourceId === 'alert-slime');
    const task = (state.tasks || []).find((candidate) => candidate.type === 'scientistMove' && candidate.data?.incidentId === incident?.id);
    return { incident, task };
  }, { key: storageKey });
  expect(response.task).toBeTruthy();
  expect(response.task.label).toContain('Respond to ALERT-001 pressing against a blocked door');
  expect(response.task.data.toRoomId).toBe('mainLab');
  expect(response.task.data.toCell).toEqual({ x: response.incident.cell.x, y: response.incident.cell.y });
  expect(response.incident.responseTaskId).toBe(response.task.id);
  await expect(page.locator('.lab-map-cell.queued-path-cell')).toHaveCount(0);
  await selectMapOverlay(page, 'movement');
  expect(await page.locator('.lab-map-cell.queued-path-cell').count()).toBeGreaterThan(0);

  incidentActions = await selectIncidentBySource(page, 'residue-alert');
  await incidentActions.getByRole('button', { name: 'Mark Resolved' }).click();
  const manuallyResolved = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const incident = (state.incidents || []).find((candidate) => candidate.sourceId === 'residue-alert');
    const unresolvedCount = (state.incidents || []).filter((candidate) => candidate.status !== 'resolved').length;
    return {
      status: incident?.status,
      manualResolvedAt: incident?.manualResolvedAt,
      signature: incident?.manualResolveSignature || '',
      unresolvedCount,
    };
  }, { key: storageKey });
  expect(manuallyResolved.status).toBe('resolved');
  expect(manuallyResolved.manualResolvedAt).toBe(0);
  expect(manuallyResolved.signature.length).toBeGreaterThan(0);
  expect(manuallyResolved.unresolvedCount).toBe(3);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((candidate) => candidate.id === 'alert-slime');
    if (slime) {
      slime.status = 'contained';
      slime.containerId = 'basic-1';
      slime.roomActivity = { type: 'idle', label: 'contained', updatedAt: state.clock || 0 };
    }
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
  await selectIncidentBySource(page, 'alert-slime');
  await page.locator('[data-selection-inspector-tab="details"]').click();
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Stale');
  await selectMapOverlay(page, 'incidents');
  await expect(page.locator('.lab-map-cell.incident-stale')).not.toHaveCount(0);
});

test('room contamination diffuses through connected doors according to seal quality', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = true;
    state.clock = 0;
    state.tasks = [];
    state.slimes = [];
    state.corpses = [];
    state.feedingResidues = [];
    state.rooms = (state.rooms || []).map((room) => {
      const current = room.id === 'mainLab' ? 80 : 0;
      return {
        ...room,
        attributes: {
          ...room.attributes,
          contamination: {
            ...(room.attributes?.contamination || {}),
            current,
            baseline: current,
            recoveryPerHour: 0,
          },
        },
      };
    });
    state.doors['mainLab::storageRoom'] = {
      ...state.doors['mainLab::storageRoom'],
      typeId: 'wardedContainmentDoor',
      condition: 100,
      state: 'closed',
      lockState: 'unlocked',
      sealState: 'sealed',
      wardIds: ['sealTightening'],
      breached: false,
    };
    state.doors['bedroom::mainLab'] = {
      ...state.doors['bedroom::mainLab'],
      typeId: 'roughWoodDoor',
      condition: 30,
      state: 'closed',
      lockState: 'unlocked',
      sealState: 'sealed',
      wardIds: [],
      breached: false,
    };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);
  await skipSeconds(page, 3600);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const roomValue = (roomId) => (state.rooms || []).find((room) => room.id === roomId)?.attributes?.contamination?.current;
    return {
      main: roomValue('mainLab'),
      storage: roomValue('storageRoom'),
      bedroom: roomValue('bedroom'),
      tasks: state.tasks || [],
    };
  }, { key: storageKey });

  expect(result.main).toBeLessThan(80);
  expect(result.storage).toBeLessThan(0.1);
  expect(result.bedroom).toBeGreaterThan(1);
  expect(result.bedroom).toBeGreaterThan(result.storage + 1);
  expect(result.tasks).toEqual([]);
});

test('door access states block routing and show physical door data', async ({ page }) => {
  await startRun(page);

  const initialDoors = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors;
  }, { key: storageKey });

  expect(initialDoors['mainLab::storageRoom']).toMatchObject({
    typeId: 'reinforcedWoodDoor',
    condition: 100,
    lockState: 'unlocked',
    sealState: 'unsealed',
    breached: false
  });
  expect(initialDoors['collectionBay::mainLab'].typeId).toBe('glassObservationDoor');
  expect(initialDoors['mainLab::pits'].wardIds).toContain('sealTightening');
  let doorActions = await selectDoorActions(page, 'mainLab::storageRoom');
  await expect(doorActions.getByRole('button', { name: /Open Door|Close Door/ })).toHaveAttribute('title', /Reinforced Wood Door/);

  await doorActions.getByRole('button', { name: 'Lock Door' }).click();
  await selectMapRoom(page, 'storageRoom');
  let roomActions = await openSelectionActions(page);
  await expect(roomActions.getByRole('button', { name: 'Move Scientist Here' })).toBeDisabled();
  await expect(roomActions.getByRole('button', { name: 'Move Scientist Here' })).toHaveAttribute('title', /locked/i);
  await expect(page.locator('[data-map-door="mainLab::storageRoom"].door-locked').first()).toBeVisible();

  let door = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors['mainLab::storageRoom'];
  }, { key: storageKey });
  expect(door.state).toBe('closed');
  expect(door.lockState).toBe('locked');

  doorActions = await selectDoorActions(page, 'mainLab::storageRoom');
  await doorActions.getByRole('button', { name: 'Unlock Door' }).click();
  await selectMapRoom(page, 'storageRoom');
  roomActions = await openSelectionActions(page);
  await expect(roomActions.getByRole('button', { name: 'Move Scientist Here' })).toBeEnabled();

  doorActions = await selectDoorActions(page, 'mainLab::storageRoom');
  await doorActions.getByRole('button', { name: 'Seal Door' }).click();
  await selectMapRoom(page, 'storageRoom');
  roomActions = await openSelectionActions(page);
  await expect(roomActions.getByRole('button', { name: 'Move Scientist Here' })).toBeDisabled();
  await expect(roomActions.getByRole('button', { name: 'Move Scientist Here' })).toHaveAttribute('title', /sealed/i);
  await expect(page.locator('[data-map-door="mainLab::storageRoom"].door-sealed').first()).toBeVisible();

  door = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors['mainLab::storageRoom'];
  }, { key: storageKey });
  expect(door.state).toBe('closed');
  expect(door.lockState).toBe('unlocked');
  expect(door.sealState).toBe('sealed');

  doorActions = await selectDoorActions(page, 'mainLab::storageRoom');
  await doorActions.getByRole('button', { name: 'Unseal Door' }).click();
  await selectMapRoom(page, 'storageRoom');
  roomActions = await openSelectionActions(page);
  await expect(roomActions.getByRole('button', { name: 'Move Scientist Here' })).toBeEnabled();
});

test('container hauling reserves a footprint and routes to adjacent access cells', async ({ page }) => {
  await startRun(page);

  const before = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((candidate) => candidate.id === 'basic-1');
    return { container };
  }, { key: storageKey });

  expect(before.container.mapCell).toBeTruthy();

  await page.locator('[data-workspace-tab="containers"]').click();
  await page.locator('[data-container-room-select="basic-1"]').selectOption('collectionBay');

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'containerHaul');
    return { task };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.fromCell).toEqual(before.container.mapCell);
  expect(queued.task.data.mapPath[0]).toEqual(queued.task.data.fromAccessCell);
  expect(queued.task.data.mapPath.at(-1)).toEqual(queued.task.data.toAccessCell);
  expect(queued.task.data.toCell).not.toEqual(queued.task.data.toAccessCell);
  expect(Math.abs(queued.task.data.toCell.x - queued.task.data.toAccessCell.x)
    + Math.abs(queued.task.data.toCell.y - queued.task.data.toAccessCell.y)).toBe(1);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Haul Basic Glass Jar 1 to Collection Bay' }).getByRole('button', { name: 'Finish' }).click();

  const arrived = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((candidate) => candidate.id === 'basic-1');
    return { container };
  }, { key: storageKey });

  expect(arrived.container.roomId).toBe('collectionBay');
  expect(arrived.container.mapCell).toEqual(queued.task.data.toCell);
});

test('lab blueprint clicks focus existing room door and object selections', async ({ page }) => {
  await startRun(page);

  await page.locator('[data-map-target-kind="container"][data-map-target-id="basic-1"]').first().click();
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'container');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', 'basic-1');

  let selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      selection: state.selection,
      selectedMapTarget: state.selectedMapTarget,
      selectedSlimeId: state.selectedSlimeId,
    };
  }, { key: storageKey });
  expect(selected.selection).toMatchObject({ kind: 'container', id: 'basic-1' });
  expect(selected.selectedMapTarget).toMatchObject({ kind: 'container', id: 'basic-1' });
  expect(selected.selectedSlimeId).toBeNull();

  await page.locator('[data-map-door="mainLab::storageRoom"]').first().click();
  await expect(page.locator('[data-map-door="mainLab::storageRoom"]').first()).toHaveClass(/selected-map-cell/);
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selection;
  }, { key: storageKey });
  expect(selected.kind).toBe('door');
  expect(selected.key).toBe('mainLab::storageRoom');

  const bedroomCell = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const bedroom = state.labMap.rooms.bedroom;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`
    ]));
    return bedroom.cells.find((cell) => !doorCells.has(`${cell.x},${cell.y}`));
  }, { key: storageKey });

  const bedroomTile = page.locator(`[data-map-x="${bedroomCell.x}"][data-map-y="${bedroomCell.y}"]`);
  await bedroomTile.click();
  await expect(bedroomTile).toHaveClass(/selected-map-cell/);
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).selection;
  }, { key: storageKey });
  expect(selected).toMatchObject({ kind: 'room', roomId: 'bedroom' });
});

test('contextual commands operate on selected doors and rooms', async ({ page }) => {
  await startRun(page);

  const initialDoor = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors['mainLab::storageRoom'];
  }, { key: storageKey });

  await page.locator('[data-map-door="mainLab::storageRoom"]').first().click();
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-menu="true"]')).toBeVisible();
  await expect(page.locator('[data-context-command-panel="true"]')).toBeVisible();
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Door');
  const doorCommandLabel = initialDoor.state === 'open' ? 'Close Door' : 'Open Door';
  await page.locator('[data-context-command-panel="true"]').getByRole('button', { name: doorCommandLabel }).click();

  const changedDoor = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.doors['mainLab::storageRoom'];
  }, { key: storageKey });
  expect(changedDoor.state).toBe(initialDoor.state === 'open' ? 'closed' : 'open');

  const bedroomCell = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const bedroom = state.labMap.rooms.bedroom;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`
    ]));
    return bedroom.cells.find((cell) => !doorCells.has(`${cell.x},${cell.y}`));
  }, { key: storageKey });

  await page.locator(`[data-map-x="${bedroomCell.x}"][data-map-y="${bedroomCell.y}"]`).click();
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await page.locator('[data-context-command-panel="true"]').getByRole('button', { name: 'Move Scientist Here' }).click();
  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return (state.tasks || []).find((task) => task.type === 'scientistMove');
  }, { key: storageKey });
  expect(queued).toBeTruthy();
  expect(queued.data.toRoomId).toBe('bedroom');

  const moveTaskRow = page.locator('#taskList .task-row').filter({ hasText: 'Move scientist to Bedroom' });
  if (await page.locator('#queueToggleBtn').getAttribute('aria-current') !== 'page') {
    await page.locator('#queueToggleBtn').click();
  }
  await expect(moveTaskRow).toBeVisible();
  await moveTaskRow.click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'task');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', queued.id);
  await page.locator('[data-selection-inspector-tab="details"]').click();
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Scientist');
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Route');
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await page.locator('[data-context-command-panel="true"]').getByRole('button', { name: 'Cancel Task' }).click();
  const canceled = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      task: (state.tasks || []).find((task) => task.id === state.selection?.id),
      scientistMoves: (state.tasks || []).filter((task) => task.type === 'scientistMove'),
      selection: state.selection,
    };
  }, { key: storageKey });
  expect(canceled.task).toBeFalsy();
  expect(canceled.scientistMoves).toHaveLength(0);
  expect(canceled.selection).toBeNull();
});

test('keyboard cursor selects map targets and command mode activates contextual commands', async ({ page }) => {
  await startRun(page);

  const initial = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      cursor: state.ui.mapCursor,
      scientistCell: state.scientist.mapCell,
      timeSpeed: state.timeSpeed,
      door: state.doors['mainLab::storageRoom'],
    };
  }, { key: storageKey });
  expect(initial.cursor).toEqual(initial.scientistCell);
  await expect(page.locator('[data-overlay-menu-toggle="true"]')).toContainText('None');
  await page.keyboard.press('O');
  await expect(page.locator('[data-overlay-menu-toggle="true"]')).toContainText('Contamination');
  let overlayState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).ui.mapOverlay;
  }, { key: storageKey });
  expect(overlayState).toBe('contamination');
  await page.keyboard.press('Shift+O');
  await expect(page.locator('[data-overlay-menu-toggle="true"]')).toContainText('None');
  await expect(page.locator('[data-map-cursor="true"]')).toHaveAttribute('data-map-x', String(initial.cursor.x));
  await expect(page.locator('[data-map-cursor="true"]')).toHaveAttribute('data-map-y', String(initial.cursor.y));

  await page.keyboard.press('ArrowUp');
  const moved = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.ui.mapCursor;
  }, { key: storageKey });
  expect(moved).toEqual({ x: initial.cursor.x, y: initial.cursor.y - 1 });
  const movedTile = page.locator(`[data-map-x="${moved.x}"][data-map-y="${moved.y}"]`);
  await expect(movedTile).toHaveClass(/map-cursor-cell/);
  const cursorTarget = {
    kind: await movedTile.getAttribute('data-map-target-kind'),
    id: await movedTile.getAttribute('data-map-target-id'),
    roomId: await movedTile.getAttribute('data-map-target-room'),
    key: await movedTile.getAttribute('data-map-target-door'),
  };

  await page.keyboard.press('Enter');
  let uiState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      selection: state.selection,
      selectedMapTarget: state.selectedMapTarget,
    };
  }, { key: storageKey });
  expect(uiState.selection.kind).toBe(cursorTarget.kind);
  expect(uiState.selectedMapTarget.kind).toBe(cursorTarget.kind);
  if (cursorTarget.id) {
    expect(uiState.selection.id).toBe(cursorTarget.id);
    expect(uiState.selectedMapTarget.id).toBe(cursorTarget.id);
  }
  if (cursorTarget.roomId) {
    expect(uiState.selection.roomId).toBe(cursorTarget.roomId);
    expect(uiState.selectedMapTarget.roomId).toBe(cursorTarget.roomId);
  }
  if (cursorTarget.key) {
    expect(uiState.selection.key).toBe(cursorTarget.key);
    expect(uiState.selectedMapTarget.key).toBe(cursorTarget.key);
  }

  await page.keyboard.press('Escape');
  uiState = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { selection: state.selection, selectedMapTarget: state.selectedMapTarget };
  }, { key: storageKey });
  expect(uiState.selection).toBeNull();
  expect(uiState.selectedMapTarget).toBeNull();

  await page.locator('[data-map-door="mainLab::storageRoom"]').first().click();
  await page.keyboard.press('A');
  await expect(page.locator('[data-keyboard-mode="command"]')).toContainText('Command mode');
  await expect(page.locator('[data-context-command-menu="true"]')).toBeVisible();
  await expect(page.locator('[data-context-command-panel="true"]')).toHaveAttribute('data-command-mode', 'true');
  const doorCommandLabel = initial.door.state === 'open' ? 'Close Door' : 'Open Door';
  await expect(page.locator('[data-context-command-shortcut="1"]')).toContainText(doorCommandLabel);

  await page.keyboard.press('1');
  const commandResult = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      door: state.doors['mainLab::storageRoom'],
      mode: state.ui.mode,
      timeSpeed: state.timeSpeed,
    };
  }, { key: storageKey });
  expect(commandResult.door.state).toBe(initial.door.state === 'open' ? 'closed' : 'open');
  expect(commandResult.mode).toBe('navigation');
  expect(commandResult.timeSpeed).toBe(initial.timeSpeed);

  await page.keyboard.press('3');
  let speedResult = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).timeSpeed;
  }, { key: storageKey });
  expect(speedResult).toBe(initial.timeSpeed);

  await page.keyboard.press('Shift+Period');
  speedResult = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).timeSpeed;
  }, { key: storageKey });
  expect(speedResult).toBe('fast');

  await page.keyboard.press('Shift+Comma');
  speedResult = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).timeSpeed;
  }, { key: storageKey });
  expect(speedResult).toBe(initial.timeSpeed);

  await page.keyboard.press('Shift+/');
  await expect(page.locator('[data-keyboard-help="true"]')).toBeVisible();
  await expect(page.locator('[data-keyboard-help="true"]')).toContainText('< / >');
  await expect(page.locator('[data-keyboard-help="true"]')).toContainText('T/S/C/P/R/D');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-keyboard-help="true"]')).toHaveCount(0);
});

test('letter key paths open management menus and nested tabs', async ({ page }) => {
  await startRun(page);

  await expect(page.locator('[data-workspace-tab="tasks"]')).toHaveAttribute('data-hotkey', 'T');
  await page.keyboard.press('T');
  await expect(page.locator('[data-workspace-tab="tasks"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-task-menu-tab="blocked"]')).toHaveAttribute('data-hotkey', 'T B');
  await page.keyboard.press('B');
  await expect(page.locator('[data-task-menu-tab="blocked"]')).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('S');
  await expect(page.locator('[data-workspace-tab="resources"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-stores-menu-tab="stations"]')).toHaveAttribute('data-hotkey', 'S C');
  await page.keyboard.press('C');
  await expect(page.locator('[data-stores-menu-tab="stations"]')).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('P');
  await expect(page.locator('[data-workspace-tab="policies"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-policy-menu-tab="feeding"]')).toHaveAttribute('data-hotkey', 'P F');
  await page.keyboard.press('F');
  await expect(page.locator('[data-policy-menu-tab="feeding"]')).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('C');
  await expect(page.locator('[data-workspace-tab="specimens"]')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('C');
  await expect(page.locator('[data-workspace-tab="containers"]')).toHaveAttribute('aria-current', 'page');

  await page.keyboard.press('R');
  await expect(page.locator('[data-workspace-tab="journal"]')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('M');
  await expect(page.locator('[data-workspace-tab="log"]')).toHaveAttribute('aria-current', 'page');

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
});

test('map overlays avoid unobserved room information unless debug is active', async ({ page }) => {
  await startRun(page);

  const fixture = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const doorCells = new Set(Object.values(state.labMap.doors || {}).flatMap((door) => [
      `${door.from.x},${door.from.y}`,
      `${door.to.x},${door.to.y}`,
    ]));
    const pickRoomCell = (roomId) =>
      (state.labMap.rooms[roomId]?.cells || []).find((cell) => !doorCells.has(`${cell.x},${cell.y}`));
    const mainCell = pickRoomCell('mainLab');
    const storageCell = pickRoomCell('storageRoom');
    const storageRoom = (state.rooms || []).find((room) => room.id === 'storageRoom');
    const mainRoom = (state.rooms || []).find((room) => room.id === 'mainLab');
    if (!mainCell || !storageCell || !storageRoom || !mainRoom) {
      throw new Error('Map fixture rooms not found');
    }
    mainRoom.attributes.contamination.current = 10;
    storageRoom.attributes.contamination.current = 92;
    storageRoom.observation = null;
    state.roomObservations ||= {};
    delete state.roomObservations.storageRoom;
    state.scientist.roomId = 'mainLab';
    state.scientist.mapCell = state.labMap.rooms.mainLab.anchor;
    state.slimes = [{
      id: 'hidden-storage-slime',
      name: 'HIDDEN-STORAGE',
      genome: state.currentGenome,
      source: 'Map knowledge fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: 'storageRoom',
      mapCell: storageCell,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
    return { mainCell, storageCell };
  }, { key: storageKey });
  await loadSavedRun(page);

  const mainTile = page.locator(`[data-map-x="${fixture.mainCell.x}"][data-map-y="${fixture.mainCell.y}"]`);
  const storageTile = page.locator(`[data-map-x="${fixture.storageCell.x}"][data-map-y="${fixture.storageCell.y}"]`);

  await selectMapOverlay(page, 'contamination');
  await expect(mainTile).toHaveAttribute('data-map-overlay', 'contamination');
  await expect(mainTile).toHaveAttribute('data-map-overlay-label', /Main Lab: Low/);
  await expect(storageTile).not.toHaveAttribute('data-map-overlay', /.+/);
  await expect(storageTile).not.toHaveAttribute('data-map-target-id', 'hidden-storage-slime');
  await expect(storageTile).not.toHaveClass(/living-object-cell/);

  await selectMapOverlay(page, 'debug');
  await expect(storageTile).toHaveAttribute('data-map-overlay', 'debug');
  await expect(storageTile).toHaveAttribute('data-map-overlay-label', /Storage Room: Hazardous/);
  await expect(storageTile).toHaveAttribute('data-map-overlay-value', '92.0');
  await expect(storageTile).toHaveAttribute('data-map-target-id', 'hidden-storage-slime');
  await expect(storageTile).toHaveClass(/living-object-cell/);
});

test('selection inspector links contained specimens from a selected container', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.selection = null;
    state.selectedMapTarget = null;
    state.selectedSlimeId = null;
    state.slimes = [{
      id: 'contained-selection',
      name: 'SEL-001',
      genome: state.currentGenome,
      source: 'Selection fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  const occupiedTile = page.locator('[data-map-target-kind="slime"][data-map-target-id="contained-selection"]').first();
  await expect(occupiedTile).toBeVisible();
  await occupiedTile.click();
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'slime');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', 'contained-selection');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-inspector-expanded', 'false');
  await page.locator('[data-selection-inspector-tab="details"]').click();
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Container Context');
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Basic Glass Jar 1');
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Feeding');
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Feed Organic Feedstock');
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Job');
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Stage Container in Collection Bay');
  await page.locator('[data-selection-inspector-tab="related"]').click();
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Basic Glass Jar 1');
  await page.locator('[data-selection-inspector="true"]').getByRole('button', { name: 'Basic Glass Jar 1' }).first().click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'container');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', 'basic-1');
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Interior');
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('SEL-001');

  const selected = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      selection: state.selection,
      selectedMapTarget: state.selectedMapTarget,
      selectedSlimeId: state.selectedSlimeId,
    };
  }, { key: storageKey });

  expect(selected.selection).toMatchObject({ kind: 'container', id: 'basic-1' });
  expect(selected.selectedMapTarget).toMatchObject({ kind: 'container', id: 'basic-1' });
  expect(selected.selectedSlimeId).toBeNull();
});

test('selected slime death transfers selection to its corpse', async ({ page }) => {
  await startRun(page);

  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.slimes = [{
      id: 'doomed-selection',
      name: 'DOOM-001',
      genome: state.currentGenome,
      source: 'Selection death fixture',
      createdAt: 0,
      deathAt: 10000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      deathCause: 'body integrity failure',
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      stats: {
        bodyIntegrity: { current: 0, max: 100 },
        nutrition: { current: 50, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
    }];
    state.corpses = [];
    state.selection = { kind: 'slime', id: 'doomed-selection', source: 'panel', pinned: false };
    state.selectedMapTarget = { kind: 'slime', id: 'doomed-selection' };
    state.selectedSlimeId = 'doomed-selection';
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  await skipSeconds(page, 1);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      slimes: state.slimes,
      corpses: state.corpses,
      selection: state.selection,
      selectedMapTarget: state.selectedMapTarget,
      selectedSlimeId: state.selectedSlimeId,
    };
  }, { key: storageKey });

  expect(result.slimes).toHaveLength(0);
  expect(result.corpses).toHaveLength(1);
  expect(result.corpses[0].specimenId).toBe('doomed-selection');
  expect(result.selection).toMatchObject({ kind: 'corpse', id: result.corpses[0].id, source: 'auto' });
  expect(result.selectedMapTarget).toMatchObject({ kind: 'corpse', id: result.corpses[0].id });
  expect(result.selectedSlimeId).toBeNull();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'corpse');
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-id', result.corpses[0].id);

  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await page.locator('[data-context-command-panel="true"]').getByRole('button', { name: 'Dump Outside' }).click();
  const dumped = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      corpses: state.corpses,
      selection: state.selection,
      selectedMapTarget: state.selectedMapTarget,
      suspicion: state.suspicion,
    };
  }, { key: storageKey });
  expect(dumped.corpses).toHaveLength(0);
  expect(dumped.selection).toBeNull();
  expect(dumped.selectedMapTarget).toBeNull();
  expect(dumped.suspicion).toBeGreaterThan(0);
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('No selection');
});

test('construction designations become unassigned rooms that can receive a purpose', async ({ page }) => {
  await startRun(page);

  for (let y = 6; y < 10; y += 1) {
    for (let x = 25; x < 29; x += 1) {
      await ensureDigTileDrafted(page, x, y);
    }
  }
  await expect(page.locator('.lab-map-cell.draft-excavation-cell')).toHaveCount(16);
  await runSelectionCommand(page, 'Confirm Dig Designation');

  const queued = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const task = (state.tasks || []).find((candidate) => candidate.type === 'excavate');
    return {
      task,
      map: state.labMap,
      construction: state.construction
    };
  }, { key: storageKey });

  expect(queued.task).toBeTruthy();
  expect(queued.task.data.rect).toEqual({ x: 25, y: 6, width: 4, height: 4 });
  expect(queued.task.data.cells).toHaveLength(16);
  expect(queued.map.width).toBeGreaterThanOrEqual(40);
  expect(queued.construction.lastDigRect).toEqual({ x: 25, y: 6, width: 4, height: 4 });
  expect(queued.construction.draftCells).toHaveLength(0);
  await expect(page.locator('.lab-map-cell.planned-excavation-cell')).toHaveCount(16);

  await page.locator('#queueToggleBtn').click();
  await page.locator('#taskList .task-row').filter({ hasText: 'Excavate 4 x 4 chamber' }).getByRole('button', { name: 'Finish' }).click();
  await page.locator('#queueToggleBtn').click();

  const excavated = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = (state.rooms || []).find((candidate) => candidate.role === 'excavated');
    const doorKeys = room
      ? Object.keys(state.doors || {}).filter((keyName) => keyName.includes(room.id))
      : [];
    return {
      room,
      mapRoom: room ? state.labMap.rooms[room.id] : null,
      doorKeys,
      doors: state.doors
    };
  }, { key: storageKey });

  expect(excavated.room).toBeTruthy();
  expect(excavated.room.name).toBe('Unassigned Excavation 1');
  expect(excavated.room.connections).toEqual(expect.arrayContaining(['mainLab']));
  expect(excavated.mapRoom.cells).toHaveLength(16);
  expect(excavated.doorKeys.length).toBeGreaterThan(0);
  expect(excavated.doorKeys.some((keyName) => excavated.doors[keyName].state === 'open')).toBe(true);
  await expect(page.locator('.lab-map-cell.planned-excavation-cell')).toHaveCount(0);
  await page.locator(`.lab-map-cell.room-cell[data-map-room="${excavated.room.id}"]:not(.door-cell)`).first().click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'room');
  await expect(page.locator('[data-selection-inspector="true"]')).toContainText('Unassigned Excavation 1');

  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Room Purpose');
  await page.locator('[data-context-command-panel="true"]').getByRole('button', { name: 'Assign Storage Room' }).click();

  const assigned = await page.evaluate(({ key, roomId }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = (state.rooms || []).find((candidate) => candidate.id === roomId);
    return { room };
  }, { key: storageKey, roomId: excavated.room.id });

  expect(assigned.room.role).toBe('materialStorage');
  expect(assigned.room.name).toBe('Storage Room 1');
  await page.locator(`.lab-map-cell.room-cell[data-map-room="${excavated.room.id}"]:not(.door-cell)`).first().click();
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]')).not.toContainText('Room Purpose');
});
