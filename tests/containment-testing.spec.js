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

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

async function saveContext(page) {
  return page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      seed: state.seed,
      complexity: state.complexity || 'clean',
      currentGenome: state.currentGenome || 'A'.repeat(26),
    };
  }, { key: storageKey });
}

async function stageContainmentSlime(page, options) {
  await page.evaluate(({ key, options }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!container) {
      throw new Error('basic-1 container not found');
    }
    container.type = 'basic';
    container.typeId = options.containerTypeId || 'basicGlassJar';
    container.name = options.containerName || 'Test Containment';
    container.roomId = 'mainLab';
    container.condition = options.condition ?? 100;
    container.isOpen = Boolean(options.isOpen);
    container.breachState = 'intact';
    container.lastBreach = null;
    container.environment ||= {};
    container.environment.contamination = { current: options.contamination ?? 0, baseline: 0, recoveryPerHour: 0 };
    state.started = true;
    state.paused = true;
    state.timeSpeed = 'normal';
    state.clock = 0;
    state.tasks = [];
    state.selectedSlimeId = options.slimeId;
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    state.incidents = [];
    state.slimes = [
      {
        id: options.slimeId,
        name: options.slimeName,
        genome: options.genome,
        source: 'Containment fixture',
        createdAt: 0,
        deathAt: 100000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: container.id,
        roomId: container.roomId,
        mapCell: null,
        automationExcluded: false,
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {
          bodyIntegrity: { current: options.bodyIntegrity ?? 100, max: 100 },
          nutrition: { current: options.nutrition ?? 80, max: 100 },
          currentMass: { current: options.currentMass ?? 100, max: 100 },
          divisionPressure: { current: options.divisionPressure ?? 0, max: 100 },
          stress: { current: options.stress ?? 0, max: 100 },
        },
        skills: {},
        behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
        analyzedCapabilities: {},
        containmentTest: {},
        revealed: options.revealed || {},
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {},
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, options });
  await loadSavedRun(page);
}

test('stressed fluid slime actively seeps along weak containment', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      element: 'water',
      consistency: 'watery',
      behavior: 'edge following',
      stability: 'nervous',
    },
  });
  await stageContainmentSlime(page, {
    slimeId: 'seep-test',
    slimeName: 'SEEP-TEST',
    genome,
    containerTypeId: 'ironCage',
    containerName: 'Leaky Cage',
    nutrition: 5,
    stress: 90,
    revealed: { element: 'water', consistency: 'watery', behavior: 'edge following', stability: 'nervous' },
  });

  await skipSeconds(page, 21600);

  await expect(page.locator('[data-slime-containment-testing-panel="seep-test"]')).toContainText('Seeping along seals');
  await expect(page.locator('[data-container-testing="seep-test"]')).toContainText('testing seeping along seals');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((item) => item.id === 'seep-test');
    const container = state.containers.find((item) => item.id === 'basic-1');
    return {
      method: slime?.containmentTest?.method,
      active: slime?.containmentTest?.active,
      pressureBand: slime?.containmentTest?.pressureBand,
      progress: slime?.containmentTest?.progress,
      contamination: container?.environment?.contamination?.current,
      condition: container?.condition,
      memory: slime?.behaviorMemory?.tags?.containmentTested || 0,
    };
  }, { key: storageKey });

  expect(result.active).toBe(true);
  expect(result.method).toBe('seep');
  expect(['high', 'critical']).toContain(result.pressureBand);
  expect(result.progress).toBeGreaterThan(0);
  expect(result.contamination).toBeGreaterThan(0);
  expect(result.condition).toBeLessThan(100);
  expect(result.memory).toBeGreaterThan(0);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('elemental containment testing can use unstable ability force and practice damage skills', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      element: 'gravity',
      consistency: 'soft gelatin',
      behavior: 'idle pooling',
      stability: 'volatile',
    },
  });
  await stageContainmentSlime(page, {
    slimeId: 'ability-test',
    slimeName: 'ABILITY-TEST',
    genome,
    containerTypeId: 'basicGlassJar',
    containerName: 'Glass Jar',
    nutrition: 10,
    stress: 92,
    revealed: { element: 'gravity', consistency: 'soft gelatin', behavior: 'idle pooling', stability: 'volatile' },
  });

  await skipSeconds(page, 14400);

  await expect(page.locator('[data-slime-containment-testing-panel="ability-test"]')).toContainText('Using unstable elemental force');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((item) => item.id === 'ability-test');
    const container = state.containers.find((item) => item.id === 'basic-1');
    return {
      method: slime?.containmentTest?.method,
      pressureBand: slime?.containmentTest?.pressureBand,
      forceXp: slime?.skills?.force?.xp || 0,
      effects: slime?.containmentTest?.effects || [],
    };
  }, { key: storageKey });

  expect(result.method).toBe('ability');
  expect(['high', 'critical']).toContain(result.pressureBand);
  expect(result.forceXp).toBeGreaterThan(0);
  expect(result.effects).toContain('container wear');
});

test('critical attack testing cracks a fragile container and removes it from service', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      element: 'none',
      consistency: 'rubbery',
      behavior: 'vibration hunting',
      stability: 'predatory',
    },
  });
  await stageContainmentSlime(page, {
    slimeId: 'breach-test',
    slimeName: 'BREACH-TEST',
    genome,
    containerTypeId: 'basicGlassJar',
    containerName: 'Ruined Jar',
    condition: 5,
    nutrition: 4,
    stress: 96,
    revealed: { element: 'none', consistency: 'rubbery', behavior: 'vibration hunting', stability: 'predatory' },
  });

  await skipSeconds(page, 7200);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((item) => item.id === 'breach-test');
    const container = state.containers.find((item) => item.id === 'basic-1');
    return {
      status: slime?.status,
      containerId: slime?.containerId,
      roomId: slime?.roomId,
      breachState: container?.breachState,
      lastBreachType: container?.lastBreach?.type,
      reusable: container?.lastBreach?.reusable,
      condition: container?.condition,
      escapedMemory: slime?.behaviorMemory?.tags?.containmentEscaped || 0,
      events: state.events.slice(0, 5).map((event) => event.message || String(event)).join(' | '),
    };
  }, { key: storageKey });

  expect(result.status).toBe('released');
  expect(result.containerId).toBe(null);
  expect(result.roomId).toBe('mainLab');
  expect(result.breachState).toBe('breached');
  expect(result.lastBreachType).toBe('crackedContainer');
  expect(result.reusable).toBe(false);
  expect(result.condition).toBe(0);
  expect(result.escapedMemory).toBeGreaterThan(0);
  expect(result.events).toContain('cracked Ruined Jar');
  await expect(page.locator('[data-container-breach="basic-1"]')).toContainText('breach breached');
  await expect(page.locator('[data-container-breach-summary="basic-1"]')).toContainText('Cracked container');
});

test('seeped seal breach leaves a compromised container physically usable', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: {
      element: 'water',
      consistency: 'watery',
      behavior: 'edge following',
      stability: 'nervous',
    },
  });
  await stageContainmentSlime(page, {
    slimeId: 'seep-breach-test',
    slimeName: 'SEEP-BREACH',
    genome,
    containerTypeId: 'ironCage',
    containerName: 'Gap Cage',
    condition: 5,
    nutrition: 4,
    stress: 96,
    revealed: { element: 'water', consistency: 'watery', behavior: 'edge following', stability: 'nervous' },
  });

  await skipSeconds(page, 7200);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((item) => item.id === 'seep-breach-test');
    const container = state.containers.find((item) => item.id === 'basic-1');
    return {
      status: slime?.status,
      breachState: container?.breachState,
      lastBreachType: container?.lastBreach?.type,
      reusable: container?.lastBreach?.reusable,
      condition: container?.condition,
      roomContamination: state.rooms.find((room) => room.id === 'mainLab')?.attributes?.contamination?.current,
      containerContamination: container?.environment?.contamination?.current,
      eventText: state.events.slice(0, 5).map((event) => event.message || String(event)).join(' | '),
    };
  }, { key: storageKey });

  expect(result.status).toBe('released');
  expect(result.breachState).toBe('compromised');
  expect(result.lastBreachType).toBe('seepedSeal');
  expect(result.reusable).toBe(true);
  expect(result.condition).toBeGreaterThan(0);
  expect(result.roomContamination).toBeGreaterThan(0);
  expect(result.containerContamination).toBeGreaterThan(0);
  expect(result.eventText).toContain('seeped through a weak seal or gap');
  await expect(page.locator('[data-container-breach="basic-1"]')).toContainText('breach compromised');
  await expect(page.locator('[data-container-breach-summary="basic-1"]')).toContainText('Seeped seal');
});
