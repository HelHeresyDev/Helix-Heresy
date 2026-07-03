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

test('parent and brood siblings in contact do not attack each other', async ({ page }) => {
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
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    const roomId = jar.roomId;
    state.paused = false;
    state.timeSpeed = 'normal';
    state.clock = 0;
    state.selectedSlimeId = 'kin-child-a';
    const makeSlime = ({ id, name, parentIds = [], broodId = '' }) => ({
      id,
      name,
      genome,
      source: 'Social fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId,
      mapCell: null,
      parentIds,
      broodId,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: { behavior: 'vibration hunting', stability: 'hungry', element: 'none' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 3, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 10, max: 100 },
      },
    });
    state.slimes = [
      makeSlime({ id: 'kin-parent', name: 'KIN-PARENT' }),
      makeSlime({ id: 'kin-child-a', name: 'KIN-CHILD-A', parentIds: ['kin-parent'], broodId: 'brood-alpha' }),
      makeSlime({ id: 'kin-child-b', name: 'KIN-CHILD-B', parentIds: ['kin-parent'], broodId: 'brood-alpha' }),
    ];
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    state.incidents = [];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await skipSeconds(page, 90);

  await expect(page.locator('[data-slime-social="kin-child-a"]')).toContainText('Group: Brood Cohesion');
  await expect(page.locator('[data-slime-social-panel="kin-child-a"]')).toContainText('Brood Cohesion');
  await expect(page.locator('[data-slime-combat-panel="kin-child-a"]')).not.toContainText('Feed-attack');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return {
      attacks: (state.combat.active || []).filter((record) => record.type === 'attack').length,
      decisions: Object.fromEntries(state.slimes.map((slime) => [slime.id, slime.ai?.combatDecision?.intent])),
      social: state.slimes.find((slime) => slime.id === 'kin-child-a')?.ai?.social,
      integrities: Object.fromEntries(state.slimes.map((slime) => [slime.id, slime.stats.bodyIntegrity.current])),
    };
  }, { key: storageKey });

  expect(result.attacks).toBe(0);
  expect(Object.values(result.decisions)).not.toContain('attack');
  expect(Object.values(result.decisions)).not.toContain('feedAttack');
  expect(result.social).toMatchObject({ stance: 'kin', kinCount: 2, nonKinCount: 0 });
  expect(Object.values(result.integrities)).toEqual([100, 100, 100]);
});

test('unrelated hungry hunting slimes in contact can attack', async ({ page }) => {
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
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    const roomId = jar.roomId;
    state.paused = false;
    state.timeSpeed = 'normal';
    state.clock = 0;
    state.selectedSlimeId = 'stranger-a';
    const makeSlime = (id, name) => ({
      id,
      name,
      genome,
      source: 'Social fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId,
      mapCell: null,
      parentIds: [],
      broodId: '',
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: { behavior: 'vibration hunting', stability: 'hungry', element: 'none' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      jobKnowledge: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 3, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 10, max: 100 },
      },
    });
    state.slimes = [
      makeSlime('stranger-a', 'STRANGER-A'),
      makeSlime('stranger-b', 'STRANGER-B'),
    ];
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    state.incidents = [];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  await skipSeconds(page, 90);

  await expect(page.locator('[data-slime-social="stranger-a"]')).toContainText('Group: Hostile');
  await expect(page.locator('[data-slime-combat-panel="stranger-a"]')).toContainText('Feed-attack');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const strangerA = state.slimes.find((slime) => slime.id === 'stranger-a');
    const strangerB = state.slimes.find((slime) => slime.id === 'stranger-b');
    return {
      attacks: (state.combat.active || []).filter((record) => record.type === 'attack').length,
      aIntegrity: strangerA?.stats.bodyIntegrity.current,
      bIntegrity: strangerB?.stats.bodyIntegrity.current,
      social: strangerA?.ai?.social,
      intent: strangerA?.ai?.combatDecision?.intent,
    };
  }, { key: storageKey });

  expect(result.attacks).toBeGreaterThan(0);
  expect(Math.min(result.aIntegrity, result.bIntegrity)).toBeLessThan(100);
  expect(result.social).toMatchObject({ stance: 'hostile', kinCount: 0, nonKinCount: 1 });
  expect(result.intent).toBe('feedAttack');
});
