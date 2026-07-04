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

test('elemental contact clash creates observed combat and pauses to 1x', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const flameGenome = genomeForTraits({ seed, traits: { element: 'flame' } });
  const frostGenome = genomeForTraits({ seed, traits: { element: 'frost' } });

  await page.evaluate(({ key, flameGenome, frostGenome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    const roomId = jar.roomId;
    const makeSlime = (id, name, genome, stats = {}) => ({
      id,
      name,
      genome,
      source: 'Combat fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId,
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
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
        ...stats,
      },
    });
    state.paused = false;
    state.timeSpeed = 'normal';
    state.selectedSlimeId = 'flame-contact';
    state.slimes = [
      {
        ...makeSlime('flame-contact', 'FLAME-CONTACT', flameGenome),
        revealed: { element: 'flame' },
      },
      {
        ...makeSlime('frost-contact', 'FROST-CONTACT', frostGenome),
        revealed: { element: 'frost' },
      },
    ];
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    state.incidents = [];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, flameGenome, frostGenome });
  await loadSavedRun(page);

  await skipSeconds(page, 90);

  await expect(page.locator('[data-slime-combat="flame-contact"]')).toContainText('Combat: clashing');
  await page.locator('[data-map-overlay-select="true"]').selectOption('combat');
  const combatCells = await page.locator('.lab-map-cell.map-overlay-combat').count();
  expect(combatCells).toBeGreaterThan(0);
  const combatIncidentCell = page.locator('.lab-map-cell.map-overlay-combat[data-map-incident]').first();
  await expect(combatIncidentCell).toBeVisible();
  await combatIncidentCell.click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'incident');
  await expect(page.locator('[data-selection-combat-context]')).toContainText('Combat Situation');
  await expect(page.locator('[data-selection-combat-context]')).toContainText('Currently known');
  await expect(page.locator('[data-selection-combat-context]')).toContainText('FLAME-CONTACT');
  await expect(page.locator('[data-selection-combat-context]')).toContainText('FROST-CONTACT');

  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Respond');
  await expect(page.locator('[data-context-command-panel="true"]')).toContainText('Acknowledge');

  await page.locator('[data-selection-inspector-tab="summary"]').click();
  await page.locator('[data-selection-combat-context]').getByRole('button', { name: 'FLAME-CONTACT' }).click();
  await expect(page.locator('[data-selection-inspector="true"]')).toHaveAttribute('data-selection-kind', 'slime');
  await page.locator('[data-selection-inspector-tab="actions"]').click();
  await expect(page.locator('[data-context-command="slime.strike.flame-contact"]')).toBeVisible();
  await expect(page.locator('[data-context-command="slime.strike.flame-contact"]')).toBeDisabled();
  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const flame = state.slimes.find((slime) => slime.id === 'flame-contact');
    const frost = state.slimes.find((slime) => slime.id === 'frost-contact');
    return {
      paused: state.paused,
      timeSpeed: state.timeSpeed,
      combatCount: state.combat.active.length,
      incidentTypes: state.incidents.filter((incident) => incident.status === 'active').map((incident) => incident.type),
      flameIntegrity: flame.stats.bodyIntegrity.current,
      frostIntegrity: frost.stats.bodyIntegrity.current,
    };
  }, { key: storageKey });

  expect(result.paused).toBe(true);
  expect(result.timeSpeed).toBe('realtime');
  expect(result.combatCount).toBeGreaterThan(0);
  expect(result.incidentTypes).toContain('combat');
  expect(result.flameIntegrity).toBeLessThan(100);
  expect(result.frostIntegrity).toBeLessThan(100);
});

test('scientist strike damages body integrity and can create a combat corpse', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'none', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const roomId = state.scientist.roomId;
    const cell = state.scientist.mapCell;
    const makeSlime = (id, name, stats = {}) => ({
      id,
      name,
      genome,
      source: 'Combat fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId,
      mapCell: cell,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
        ...stats,
      },
    });
    state.selectedSlimeId = 'strike-target';
    state.scientist.vitals.stamina = { current: 100, max: 100 };
    state.slimes = [
      {
        ...makeSlime('strike-target', 'STRIKE-TARGET', {
          bodyIntegrity: { current: 16, max: 100 },
        }),
        revealed: { element: 'none', behavior: 'idle pooling', stability: 'placid' },
      },
    ];
    state.corpses = [];
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await expect(page.locator('[data-strike-slime-id="strike-target"]')).toBeEnabled();
  await page.locator('[data-strike-slime-id="strike-target"]').click();

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      livingCount: state.slimes.length,
      corpseCount: state.corpses.length,
      deathReason: state.corpses[0]?.deathReason,
      stamina: state.scientist.vitals.stamina.current,
      eventText: state.events.map((event) => event.message).join('\n'),
    };
  }, { key: storageKey });

  expect(result.livingCount).toBe(0);
  expect(result.corpseCount).toBe(1);
  expect(result.deathReason).toBe('combat trauma');
  expect(result.stamina).toBeLessThan(100);
  expect(result.eventText).toContain('Scientist struck STRIKE-TARGET');
});

test('starving hunting slime feed-attacks a contacted scientist', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed,
    traits: { element: 'none', behavior: 'vibration hunting', stability: 'hungry' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = false;
    state.timeSpeed = 'normal';
    state.clock = 0;
    state.selectedSlimeId = 'feed-attacker';
    state.scientist.vitals.health = { current: 100, max: 100 };
    state.slimes = [{
      id: 'feed-attacker',
      name: 'FEED-ATTACKER',
      genome,
      source: 'Combat behavior fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: state.scientist.roomId,
      mapCell: state.scientist.mapCell,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 0,
      revealed: { element: 'none', behavior: 'vibration hunting', stability: 'hungry' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 3, max: 100 },
        currentMass: { current: 80, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 10, max: 100 },
      },
    }];
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    state.incidents = [];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await skipSeconds(page, 90);

  await expect(page.locator('[data-slime-combat-intent="feed-attacker"]')).toContainText('Combat intent: Feed-attack');
  await expect(page.locator('[data-slime-combat-panel="feed-attacker"]')).toContainText('Feed-attack');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((entry) => entry.id === 'feed-attacker');
    return {
      scientistHealth: state.scientist.vitals.health.current,
      paused: state.paused,
      timeSpeed: state.timeSpeed,
      ai: slime.ai,
      roomActivity: slime.roomActivity,
      activeCombatTypes: (state.combat.active || []).map((record) => `${record.type}:${record.combatIntent}`),
    };
  }, { key: storageKey });

  expect(result.scientistHealth).toBeLessThan(100);
  expect(result.paused).toBe(true);
  expect(result.timeSpeed).toBe('realtime');
  expect(result.ai.state).toBe('combat');
  expect(result.ai.intent).toBe('feedAttack');
  expect(result.ai.combatDecision.intent).toBe('feedAttack');
  expect(result.ai.combatDecision.reasons).toEqual(expect.arrayContaining(['critical hunger', 'hunting behavior']));
  expect(result.roomActivity).toMatchObject({
    type: 'combatAttack',
    combatIntent: 'feedAttack',
    targetId: 'scientist',
  });
  expect(result.activeCombatTypes).toContain('attack:feedAttack');
});

test('injured placid slime flees contact instead of attacking', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({
    seed,
    traits: { element: 'none', behavior: 'hiding', stability: 'placid' },
  });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.paused = false;
    state.timeSpeed = 'normal';
    state.clock = 100;
    state.selectedSlimeId = 'fleeing-slime';
    state.scientist.vitals.health = { current: 100, max: 100 };
    state.slimes = [{
      id: 'fleeing-slime',
      name: 'FLEEING-SLIME',
      genome,
      source: 'Combat behavior fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: state.scientist.roomId,
      mapCell: state.scientist.mapCell,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      nextAutonomousDecisionAt: 100,
      revealed: { element: 'none', behavior: 'hiding', stability: 'placid' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      behaviorMemory: { tags: { scientistPain: 45 }, recent: [], lastUpdatedAt: 95 },
      lastPainAt: 95,
      lastPainAmount: 12,
      lastCombatAttackerId: 'scientist',
      lastCombatAttackedAt: 95,
      stats: {
        bodyIntegrity: { current: 24, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 80, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 20, max: 100 },
      },
    }];
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    state.incidents = [];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await skipSeconds(page, 1);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((entry) => entry.id === 'fleeing-slime');
    return {
      scientistHealth: state.scientist.vitals.health.current,
      activeCombatCount: (state.combat.active || []).length,
      ai: slime.ai,
      roomActivity: slime.roomActivity,
      moving: Boolean(slime.autonomousMovement),
      evasionXp: slime.skills?.evasion?.xp || 0,
      fledMemory: slime.behaviorMemory?.tags?.fledThreat || 0,
    };
  }, { key: storageKey });

  expect(result.scientistHealth).toBe(100);
  expect(result.activeCombatCount).toBe(0);
  expect(result.ai.state).not.toBe('combat');
  expect(result.evasionXp).toBeGreaterThan(0);
  expect(result.fledMemory).toBeGreaterThan(0);
});
