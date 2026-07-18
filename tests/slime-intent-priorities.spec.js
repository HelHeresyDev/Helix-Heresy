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

test('job tags create no biological drive and a full slime remains quiescent', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = state.containers.find((container) => container.type === 'basic') || state.containers[0];
    state.slimes = [{
      id: 'tagged-full', name: 'TAGGED-001', genome: state.currentGenome, source: 'Intent fixture',
      createdAt: 0, deathAt: 100000, lifecycleVersion: 1, matureAt: 0, mature: true,
      status: 'contained', containerId: jar.id, roomId: jar.roomId, mapCell: null,
      job: 'cleanup', jobProgress: 0, jobTargetCorpseId: null, jobNutritionGained: 0,
      stats: {
        bodyIntegrity: { current: 100, max: 100 }, nutrition: { current: 100, max: 100 },
        currentMass: { current: 100, max: 100 }, divisionPressure: { current: 100, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: {}, measured: {}, traitObservations: {}, testsRun: [], jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  const snapshot = await page.evaluate(() => window.helixHeresyDebug.slimeAiSnapshot('tagged-full'));
  expect(snapshot.actual).toMatchObject({ state: 'quiescent', intent: 'quiesce' });
  expect(snapshot.actual.drives).not.toHaveProperty('work');
  expect(snapshot.actual.drives.division.band).toBe('critical');
  expect(snapshot.actual.target.kind).toBe('container');
});

test('recent pain interrupts feeding movement with fight flight or freeze', async ({ page }) => {
  await startRun(page);
  const context = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return { seed: state.seed, genome: state.currentGenome };
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed: context.seed,
    baseGenome: context.genome,
    traits: { behavior: 'hiding', stability: 'nervous', element: 'none' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.clock = 60;
    const origin = { ...state.labMap.rooms.mainLab.anchor };
    const destination = { x: origin.x + 1, y: origin.y };
    state.scientist.roomId = 'mainLab';
    state.scientist.mapCell = { ...origin };
    state.slimes = [{
      id: 'pain-interrupt', name: 'PAIN-001', genome, source: 'Intent fixture',
      createdAt: 0, deathAt: 100000, lifecycleVersion: 1, matureAt: 0, mature: true,
      status: 'released', containerId: null, roomId: 'mainLab', mapCell: origin,
      job: 'idle', jobProgress: 0, jobTargetCorpseId: null, jobNutritionGained: 0,
      nextAutonomousDecisionAt: 120,
      autonomousMovement: {
        intent: 'seekFood', label: 'seeking loose biomatter', targetKind: 'residue', targetId: 'food-1',
        targetLabel: 'loose biomatter', fromRoomId: 'mainLab', targetRoomId: 'mainLab', targetCell: destination,
        path: [origin, destination], distanceMeters: 1, speedMps: 0.02, baseSpeedMps: 0.02,
        conditionFactor: 1, movementStyle: 'oozes', movementFactors: [], startAt: 50, arriveAt: 100, updatedAt: 50,
      },
      ai: {
        state: 'moving', intent: 'seekFood', target: { kind: 'residue', id: 'food-1', label: 'loose biomatter', roomId: 'mainLab', cell: destination },
        reason: 'seeking food', urgency: 'medium', commitment: {
          intent: 'seekFood', target: { kind: 'residue', id: 'food-1', label: 'loose biomatter', roomId: 'mainLab', cell: destination },
          startedAt: 50, committedUntil: 400, lastEvaluatedAt: 50,
        },
      },
      lastPainAt: 60, lastPainAmount: 12, lastCombatAttackerId: 'scientist', lastCombatAttackedAt: 60,
      stats: {
        bodyIntegrity: { current: 60, max: 100 }, nutrition: { current: 20, max: 100 },
        currentMass: { current: 80, max: 100 }, divisionPressure: { current: 0, max: 100 },
        stress: { current: 45, max: 100 },
      },
      revealed: { behavior: 'hiding', stability: 'nervous' }, measured: {}, traitObservations: {}, testsRun: [], jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1));

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((candidate) => candidate.id === 'pain-interrupt');
    return { slime, messages: state.events.filter((entry) => entry.sourceId === slime.id) };
  }, { key: storageKey });
  expect(result.slime.autonomousMovement).toBeNull();
  expect(['fight', 'flee', 'freeze']).toContain(result.slime.ai.intent);
  expect(result.slime.ai.intent).not.toBe('feed');
  expect(result.slime.ai.intent).not.toBe('seekFood');
  expect(result.messages.some((entry) => /changed intent/.test(entry.message))).toBe(true);
});

test('painful failures create longer avoidance than harmless failures', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = state.containers.find((container) => container.type === 'basic') || state.containers[0];
    state.slimes = [{
      id: 'failure-memory', name: 'MEMORY-001', genome: state.currentGenome, source: 'Intent fixture',
      createdAt: 0, deathAt: 100000, lifecycleVersion: 1, matureAt: 0, mature: true,
      status: 'contained', containerId: jar.id, roomId: jar.roomId, mapCell: null,
      job: 'idle', jobProgress: 0, jobTargetCorpseId: null, jobNutritionGained: 0,
      stats: {
        bodyIntegrity: { current: 100, max: 100 }, nutrition: { current: 50, max: 100 },
        currentMass: { current: 80, max: 100 }, divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
      revealed: {}, measured: {}, traitObservations: {}, testsRun: [], jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  const failures = await page.evaluate(() => {
    const harmless = window.helixHeresyDebug.rememberSlimeFailure('failure-memory', 'seekFood', {
      kind: 'door', id: 'door-a', label: 'closed door', roomId: 'mainLab',
    }, { reason: 'blocked by closed door' });
    const painful = window.helixHeresyDebug.rememberSlimeFailure('failure-memory', 'feed', {
      kind: 'waste', id: 'waste-a', label: 'hazardous waste', roomId: 'mainLab',
    }, { reason: 'hurt while feeding', painful: true });
    return { harmless, painful, snapshot: window.helixHeresyDebug.slimeAiSnapshot('failure-memory') };
  });

  expect(failures.painful.retryAt - failures.painful.at).toBeGreaterThan(failures.harmless.retryAt - failures.harmless.at);
  expect(failures.snapshot.actual.failures).toEqual(expect.arrayContaining([
    expect.objectContaining({ severity: 'harmless' }),
    expect.objectContaining({ severity: 'painful' }),
  ]));
});

test('an unobserved slime exposes no live intent before the scientist observes it', async ({ page }) => {
  await startRun(page);
  await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const room = state.labMap.rooms.storageRoom;
    state.scientist.roomId = 'mainLab';
    state.scientist.mapCell = { ...state.labMap.rooms.mainLab.anchor };
    state.slimes = [{
      id: 'unobserved-injured', name: 'UNKNOWN-001', genome: state.currentGenome, source: 'Intent fixture',
      createdAt: 0, deathAt: 100000, lifecycleVersion: 1, matureAt: 0, mature: true,
      status: 'released', containerId: null, roomId: 'storageRoom', mapCell: { ...room.anchor },
      job: 'idle', jobProgress: 0, jobTargetCorpseId: null, jobNutritionGained: 0,
      stats: {
        bodyIntegrity: { current: 20, max: 100 }, nutrition: { current: 80, max: 100 },
        currentMass: { current: 80, max: 100 }, divisionPressure: { current: 0, max: 100 },
        stress: { current: 20, max: 100 },
      },
      revealed: {}, measured: {}, traitObservations: {}, testsRun: [], jobKnowledge: {},
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey });
  await loadSavedRun(page);

  const snapshot = await page.evaluate(() => window.helixHeresyDebug.slimeAiSnapshot('unobserved-injured'));
  expect(snapshot.actual.intent).toBe('recover');
  expect(snapshot.observed).toMatchObject({
    state: 'idle',
    intent: 'none',
    reason: 'not currently observed',
    urgency: 'none',
  });
  expect(snapshot.observed.drives.injury.band).toBe('none');
});
