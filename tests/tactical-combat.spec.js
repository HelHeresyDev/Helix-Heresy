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

async function seedCombatSlime(page, id, options = {}) {
  const seed = await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, storageKey);
  const behavior = options.behavior || 'idle pooling';
  const stability = options.stability || 'placid';
  const genome = genomeForTraits({ seed, traits: { element: options.element || 'none', behavior, stability } });
  await page.evaluate(({ key, id, genome, options }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const scientistCell = state.scientist.mapCell;
    const cell = options.diagonal
      ? { x: scientistCell.x + 1, y: scientistCell.y + 1, z: scientistCell.z }
      : { ...scientistCell };
    state.slimes = [{
      id,
      name: options.name || id.toUpperCase(),
      genome,
      source: 'Tactical combat fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: state.scientist.roomId,
      mapCell: cell,
      job: 'idle',
      jobProgress: 0,
      revealed: { element: options.element || 'none', behavior: options.behavior || 'idle pooling', stability: options.stability || 'placid' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      stats: {
        bodyIntegrity: { current: options.integrity || 100, max: 100 },
        nutrition: { current: options.nutrition ?? 80, max: 100 },
        currentMass: { current: 80, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    }];
    state.creatureRecords = {};
    state.combat = { active: [], cooldowns: {}, actorRecoveryUntil: {}, pendingActions: {}, guarding: {}, nextActionNumber: 1 };
    state.incidents = [];
    state.selectedSlimeId = id;
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, id, genome, options });
  await loadSavedRun(page);
}

test('Soul Lash is a map command that spends Mana and deals Arcane damage', async ({ page }) => {
  await startRun(page);
  await seedCombatSlime(page, 'soul-target', { name: 'SOUL-TARGET' });

  await page.evaluate(() => window.helixHeresyDebug.selectMapTarget({ kind: 'slime', id: 'soul-target' }));
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  const soulLash = page.locator('[data-context-command="slime.soulLash.soul-target"]');
  await expect(soulLash).toBeEnabled();
  await soulLash.click();

  const result = await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      integrity: state.slimes.find((slime) => slime.id === 'soul-target').stats.bodyIntegrity.current,
      mana: state.scientist.vitals.mana.current,
      animancyXp: state.scientist.skills.animancy.xp,
      recoveryUntil: state.combat.actorRecoveryUntil.scientist,
      eventText: state.events.map((event) => event.message).join('\n'),
    };
  }, storageKey);

  expect(result.integrity).toBe(86);
  expect(result.mana).toBe(88);
  expect(result.animancyXp).toBeGreaterThan(0);
  expect(result.recoveryUntil).toBeGreaterThan(0);
  expect(result.eventText).toContain('Scientist used Soul Lash on SOUL-TARGET');
});

test('diagonal footprints count as adjacent for a scientist Strike', async ({ page }) => {
  await startRun(page);
  await seedCombatSlime(page, 'diagonal-target', { name: 'DIAGONAL-TARGET', diagonal: true, integrity: 16 });

  await page.evaluate(() => window.helixHeresyDebug.selectMapTarget({ kind: 'slime', id: 'diagonal-target' }));
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  const strike = page.locator('[data-context-command="slime.strike.diagonal-target"]');
  await expect(strike).toBeEnabled();
  await strike.click();

  const result = await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      living: state.slimes.some((slime) => slime.id === 'diagonal-target'),
      strikingXp: state.scientist.skills.striking?.xp || 0,
      handlingXp: state.scientist.skills.creatureHandling?.xp || 0,
    };
  }, storageKey);

  expect(result.living).toBe(false);
  expect(result.strikingXp).toBeGreaterThan(0);
  expect(result.handlingXp).toBe(0);
});

test('Guard suspends and then preserves the remaining scientist task schedule', async ({ page }) => {
  await startRun(page);
  await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.tasks = [{
      id: 'routine-analysis',
      type: 'test',
      label: 'Routine analysis',
      createdAt: 0,
      dueAt: 100,
      data: { slimeId: 'missing-fixture', testId: 'visual', staminaCost: 0 },
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, storageKey);
  await loadSavedRun(page);

  await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(true));
  await skipSeconds(page, 10);
  await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(false));

  const result = await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      clock: state.clock,
      dueAt: state.tasks.find((task) => task.id === 'routine-analysis')?.dueAt,
      guarding: Boolean(state.combat.guarding.scientist),
      suspension: state.combat.routineSuspension,
    };
  }, storageKey);

  expect(result.clock).toBe(10);
  expect(result.dueAt).toBe(110);
  expect(result.guarding).toBe(false);
  expect(result.suspension).toBeNull();
});

test('Guard reduces incoming attack damage and practices Guarding when struck', async ({ page }) => {
  await startRun(page);
  await seedCombatSlime(page, 'guard-attacker', {
    name: 'GUARD-ATTACKER',
    behavior: 'vibration hunting',
    stability: 'hungry',
    nutrition: 3,
  });

  await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(true));
  await skipSeconds(page, 1);

  const result = await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      health: state.scientist.vitals.health.current,
      guardingXp: state.scientist.skills.guarding?.xp || 0,
      guarding: Boolean(state.combat.guarding.scientist),
    };
  }, storageKey);

  expect(result.health).toBe(97);
  expect(result.guardingXp).toBeGreaterThan(2);
  expect(result.guarding).toBe(true);
});

test('urgent movement runs ahead of routine work and resumes the preserved queue', async ({ page }) => {
  await startRun(page);
  await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.tasks = [{
      id: 'routine-analysis',
      type: 'test',
      label: 'Routine analysis',
      createdAt: 0,
      dueAt: 100,
      data: { slimeId: 'missing-fixture', testId: 'visual', staminaCost: 0 },
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, storageKey);
  await loadSavedRun(page);

  const started = await page.evaluate(() => {
    const view = window.helixHeresyDebug.mapViewSnapshot();
    const scientist = view.cells.find((entry) => entry.scientist);
    const target = view.cells.find((entry) => entry.known
      && entry.roomId === scientist.roomId
      && ['room', 'floor'].includes(entry.base.kind)
      && !entry.scientist
      && !entry.object
      && !entry.door);
    const task = window.helixHeresyDebug.startScientistMove(target.roomId, {
      toCell: target.cell,
      allowMultiRoom: true,
      urgent: true,
    });
    return { taskId: task?.id, target: target.cell };
  });
  expect(started.taskId).toBeTruthy();

  const queued = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot());
  expect(queued[0]).toMatchObject({ id: started.taskId, data: { combatPriority: true } });

  await skipSeconds(page, 100);
  const result = await page.evaluate((key) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      scientistCell: state.scientist.mapCell,
      routineDueAt: state.tasks.find((task) => task.id === 'routine-analysis')?.dueAt,
      urgentStillQueued: state.tasks.some((task) => task.id !== 'routine-analysis'),
      suspension: state.combat.routineSuspension,
    };
  }, storageKey);

  expect(result.scientistCell).toEqual(started.target);
  expect(result.routineDueAt).toBe(200);
  expect(result.urgentStillQueued).toBe(false);
  expect(result.suspension).toBeNull();
});
