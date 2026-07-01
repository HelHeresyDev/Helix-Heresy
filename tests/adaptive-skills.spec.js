// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const { genomeForTraits } = require('./gene-fixtures');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';

function normalXpToNextLevel(level) {
  return Math.round(25 + Math.pow(level + 1, 1.25) * 4);
}

function xpToNextLevel(level) {
  return [0, 50, 100, 150, 200, 250, 300].includes(level)
    ? normalXpToNextLevel(level + 20)
    : normalXpToNextLevel(level);
}

function totalXpForLevel(level) {
  let total = 0;
  for (let current = 0; current < level; current += 1) {
    total += xpToNextLevel(current);
  }
  return total;
}

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.locator('#setupForm button[type="submit"]').click();
}

async function skipSeconds(page, seconds) {
  await page.locator('#skipAmountInput').evaluate((element, value) => {
    element.value = String(value);
  }, seconds);
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());
}

async function loadSavedRun(page) {
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
}

test('skill sheet hides level-zero practice and reveals Initiate skills', async ({ page }) => {
  const consoleIssues = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await startRun(page);

  const skillList = page.locator('#skillList');
  await expect(skillList).toContainText('Analysis');
  await expect(skillList).toContainText('[Initiate], level 1');
  await expect(skillList).toContainText(`0 / ${xpToNextLevel(1)} XP to level 2`);
  await expect(skillList).not.toContainText('No learned skills yet');
  await expect(skillList).not.toContainText('Observation');
  await expect(skillList).not.toContainText('Perception');

  const firstBreakthrough = xpToNextLevel(0);

  await page.locator('#xpCommandInput').fill(`perception ${firstBreakthrough - 1}`);
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('Analysis');
  await expect(skillList).not.toContainText('Perception');

  await page.locator('#xpCommandInput').fill('perception 1');
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('Analysis');
  await expect(skillList).toContainText('Perception');
  await expect(skillList).toContainText('[Initiate], level 1');
  await expect(skillList).not.toContainText('Observation');

  const savedSkills = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    return {
      analysis: state.scientist?.skills?.analysis || null,
      perception: state.scientist?.skills?.perception || null,
    };
  });

  expect(savedSkills.analysis?.xp).toBe(firstBreakthrough);
  expect(savedSkills.analysis?.practiceTags?.starter).toBe(firstBreakthrough);
  expect(savedSkills.perception?.xp).toBe(firstBreakthrough);
  expect(savedSkills.perception?.practiceTags?.cheatcommand).toBe(firstBreakthrough);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('low-confidence diagnostic grants reduced XP', async ({ page }) => {
  await startRun(page);
  const firstBreakthrough = xpToNextLevel(0);

  await page.locator('[data-physical-diagnostic-test-id="selfCheck"]').click();
  await page.locator('#skipAmountInput').evaluate((element) => {
    element.value = '300';
  });
  await page.locator('#skipTimeBtn').evaluate((element) => element.click());

  const skill = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.scientist?.skills?.analysis || null;
  }, { key: storageKey });

  expect(skill?.xp).toBe(firstBreakthrough + 3);
  expect(skill?.practiceTags?.selfcheck).toBe(3);
  await expect(page.locator('#skillList')).toContainText('Analysis');
});

test('breakthrough progress decays after sustained idle time', async ({ page }) => {
  await startRun(page);

  const firstBreakthrough = xpToNextLevel(0);
  await page.locator('#xpCommandInput').fill(`perception ${firstBreakthrough - 1}`);
  await page.locator('#xpCommandBtn').click();

  await skipSeconds(page, 60 * 60 * 48);

  const skill = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.scientist?.skills?.perception || null;
  }, { key: storageKey });

  const expected = (firstBreakthrough - 1) - firstBreakthrough * 0.1;
  expect(skill?.xp).toBeCloseTo(expected, 4);
  expect(skill?.lastBreakthroughDecayAt).toBe(60 * 60 * 48);
  await expect(page.locator('#skillList')).toContainText('Analysis');
  await expect(page.locator('#skillList')).not.toContainText('Perception');
});

test('slime combat practice stores hidden component skills and pain memory', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const flameGenome = genomeForTraits({ seed, traits: { element: 'flame', behavior: 'idle pooling', stability: 'placid' } });
  const frostGenome = genomeForTraits({ seed, traits: { element: 'frost', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, flameGenome, frostGenome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    const makeSlime = (id, name, genome) => ({
      id,
      name,
      genome,
      source: 'Adaptive skill fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      automationExcluded: false,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: { element: genome === flameGenome ? 'flame' : 'frost' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      skills: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      nextPerceptionPracticeAt: 999999,
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 20, max: 100 },
        currentMass: { current: 50, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    });
    state.paused = false;
    state.timeSpeed = 'normal';
    state.selectedSlimeId = 'flame-skill';
    state.slimes = [
      makeSlime('flame-skill', 'FLAME-SKILL', flameGenome),
      makeSlime('frost-skill', 'FROST-SKILL', frostGenome),
    ];
    state.combat = { active: [], cooldowns: {}, lastAwareCombatAt: null, lastAwareCombatKey: '' };
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, flameGenome, frostGenome });
  await loadSavedRun(page);

  await skipSeconds(page, 90);

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const flame = state.slimes.find((slime) => slime.id === 'flame-skill');
    const frost = state.slimes.find((slime) => slime.id === 'frost-skill');
    return {
      scientistSkills: Object.keys(state.scientist?.skills || {}),
      flameThermal: flame?.skills?.thermal?.xp || 0,
      frostCold: frost?.skills?.cold?.xp || 0,
      flameToughness: flame?.skills?.toughness?.xp || 0,
      frostToughness: frost?.skills?.toughness?.xp || 0,
      flameMemory: flame?.behaviorMemory?.tags?.combatHurt || 0,
      frostMemory: frost?.behaviorMemory?.tags?.combatHurt || 0,
    };
  }, { key: storageKey });

  expect(result.scientistSkills).toEqual(['analysis']);
  expect(result.flameThermal).toBeGreaterThan(0);
  expect(result.frostCold).toBeGreaterThan(0);
  expect(result.flameToughness).toBeGreaterThan(0);
  expect(result.frostToughness).toBeGreaterThan(0);
  expect(result.flameMemory).toBeGreaterThan(0);
  expect(result.frostMemory).toBeGreaterThan(0);
  await expect(page.locator('#skillList')).toContainText('Analysis');
});

test('Analyze spends mana and reveals only level-one creature capabilities', async ({ page }) => {
  await startRun(page);
  const firstBreakthrough = xpToNextLevel(0);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'flame', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome, firstBreakthrough }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.selectedSlimeId = 'analyze-target';
    state.scientist.vitals.mana = { current: 100, max: 100 };
    state.slimes = [{
      id: 'analyze-target',
      name: 'ANALYZE-TARGET',
      genome,
      source: 'Analyze fixture',
      createdAt: 0,
      deathAt: 1000000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      automationExcluded: false,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      skills: {
        toughness: {
          xp: firstBreakthrough,
          practiceTags: { fixture: firstBreakthrough },
          evolvedLabel: '',
          lastPracticedAt: 0,
          lastBreakthroughDecayAt: 0,
        },
        thermal: {
          xp: firstBreakthrough - 1,
          practiceTags: { fixture: firstBreakthrough - 1 },
          evolvedLabel: '',
          lastPracticedAt: 0,
          lastBreakthroughDecayAt: 0,
        },
      },
      behaviorMemory: {
        tags: { attackWorked: 30 },
        recent: [{ key: 'attackWorked', reason: 'fixture', amount: 30, at: 0 }],
        lastUpdatedAt: 0,
      },
      analyzedCapabilities: { skills: {}, behaviors: {}, attempts: 0, lastAnalyzedAt: null, lastResult: '' },
      nextPerceptionPracticeAt: 999999,
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 80, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome, firstBreakthrough });
  await loadSavedRun(page);

  const panel = page.locator('[data-slime-analyze-panel="analyze-target"]');
  await expect(panel).toContainText('Not analyzed');
  await expect(panel).not.toContainText('Toughness');
  await expect(panel).not.toContainText('Thermal');

  await page.locator('[data-analyze-slime-id="analyze-target"]').click();

  await expect(panel).toContainText('Toughness [Initiate]');
  await expect(panel).toContainText('Successful attack habit');
  await expect(panel).not.toContainText('Thermal');
  await expect(panel).not.toContainText('level 1');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((entry) => entry.id === 'analyze-target');
    return {
      mana: state.scientist.vitals.mana.current,
      analysisXp: state.scientist.skills.analysis.xp,
      analyzedSkills: Object.keys(slime?.analyzedCapabilities?.skills || {}),
      analyzedBehaviors: Object.keys(slime?.analyzedCapabilities?.behaviors || {}),
      thermalHiddenXp: slime?.skills?.thermal?.xp || 0,
    };
  }, { key: storageKey });

  expect(result.mana).toBe(92);
  expect(result.analysisXp).toBe(firstBreakthrough + 4);
  expect(result.analyzedSkills).toEqual(['toughness']);
  expect(result.analyzedBehaviors).toEqual(['attackWorked']);
  expect(result.thermalHiddenXp).toBe(firstBreakthrough - 1);
});

test('Advanced Analyze reveals exact levels only for already analyzed creature skills', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'flame', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome, analysisXp, toughnessXp, hiddenThermalXp }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.selectedSlimeId = 'advanced-analyze-target';
    state.scientist.vitals.mana = { current: 100, max: 100 };
    state.scientist.skills.analysis = {
      xp: analysisXp,
      practiceTags: { fixture: analysisXp },
      evolvedLabel: '',
      lastPracticedAt: 0,
      lastBreakthroughDecayAt: 0,
    };
    state.slimes = [{
      id: 'advanced-analyze-target',
      name: 'ADVANCED-ANALYZE-TARGET',
      genome,
      source: 'Advanced Analyze fixture',
      createdAt: 0,
      deathAt: 1000000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      automationExcluded: false,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      skills: {
        toughness: {
          xp: toughnessXp,
          practiceTags: { fixture: toughnessXp },
          evolvedLabel: '',
          lastPracticedAt: 0,
          lastBreakthroughDecayAt: 0,
        },
        thermal: {
          xp: hiddenThermalXp,
          practiceTags: { fixture: hiddenThermalXp },
          evolvedLabel: '',
          lastPracticedAt: 0,
          lastBreakthroughDecayAt: 0,
        },
      },
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      analyzedCapabilities: {
        skills: {
          toughness: {
            skillId: 'toughness',
            label: 'Toughness',
            tierId: 'initiate',
            tierLabel: 'Initiate',
            observedAt: 0,
          },
        },
        behaviors: {},
        attempts: 1,
        advancedAttempts: 0,
        lastAnalyzedAt: 0,
        lastAdvancedAnalyzedAt: null,
        lastResult: '1 practiced capability perceived',
        lastAdvancedResult: '',
      },
      nextPerceptionPracticeAt: 999999,
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 80, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, {
    key: storageKey,
    genome,
    analysisXp: totalXpForLevel(21),
    toughnessXp: totalXpForLevel(3),
    hiddenThermalXp: totalXpForLevel(2),
  });
  await loadSavedRun(page);

  const panel = page.locator('[data-slime-analyze-panel="advanced-analyze-target"]');
  await expect(panel).toContainText('Toughness [Initiate]');
  await expect(panel).not.toContainText('level 3');
  await expect(panel).not.toContainText('Thermal');

  await page.locator('[data-advanced-analyze-slime-id="advanced-analyze-target"]').click();

  await expect(panel).toContainText('Toughness [Initiate]');
  await expect(panel).toContainText('level 3');
  await expect(panel).toContainText('Last exact read');
  await expect(panel).not.toContainText('Thermal');
  await expect(panel).not.toContainText('level 2');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((entry) => entry.id === 'advanced-analyze-target');
    return {
      mana: state.scientist.vitals.mana.current,
      analysisXp: state.scientist.skills.analysis.xp,
      knownSkills: Object.keys(slime?.analyzedCapabilities?.skills || {}),
      toughnessExactLevel: slime?.analyzedCapabilities?.skills?.toughness?.exactLevel || 0,
      thermalKnown: Boolean(slime?.analyzedCapabilities?.skills?.thermal),
      advancedAttempts: slime?.analyzedCapabilities?.advancedAttempts || 0,
    };
  }, { key: storageKey });

  expect(result.mana).toBe(84);
  expect(result.analysisXp).toBe(totalXpForLevel(21) + 6);
  expect(result.knownSkills).toEqual(['toughness']);
  expect(result.toughnessExactLevel).toBe(3);
  expect(result.thermalKnown).toBe(false);
  expect(result.advancedAttempts).toBe(1);
});

test('slime breakthrough progress decays at the same threshold as scientist skills', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'none', behavior: 'idle pooling', stability: 'placid' } });
  const firstBreakthrough = xpToNextLevel(0);

  await page.evaluate(({ key, genome, firstBreakthrough }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.slimes = [{
      id: 'threshold-slime',
      name: 'THRESHOLD-SLIME',
      genome,
      source: 'Adaptive skill fixture',
      createdAt: 0,
      deathAt: 10000000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'contained',
      containerId: jar.id,
      roomId: jar.roomId,
      mapCell: null,
      automationExcluded: false,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: {},
      measured: {},
      traitObservations: {},
      testsRun: [],
      skills: {
        perception: {
          xp: firstBreakthrough - 1,
          practiceTags: { fixture: firstBreakthrough - 1 },
          evolvedLabel: '',
          lastPracticedAt: 0,
          lastBreakthroughDecayAt: 0,
        },
      },
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      nextPerceptionPracticeAt: 999999,
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome, firstBreakthrough });
  await loadSavedRun(page);

  await skipSeconds(page, 60 * 60 * 48);

  const skill = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.slimes.find((slime) => slime.id === 'threshold-slime')?.skills?.perception || null;
  }, { key: storageKey });

  const expected = (firstBreakthrough - 1) - firstBreakthrough * 0.1;
  expect(skill?.xp).toBeCloseTo(expected, 4);
  expect(skill?.lastBreakthroughDecayAt).toBe(60 * 60 * 48);
});

test('slime pain memory biases loose threat response toward fleeing', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'none', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.slimes = [{
      id: 'memory-slime',
      name: 'MEMORY-SLIME',
      genome,
      source: 'Adaptive skill fixture',
      createdAt: 0,
      deathAt: 100000,
      lifecycleVersion: 1,
      matureAt: 0,
      mature: true,
      status: 'released',
      containerId: null,
      roomId: state.scientist.roomId,
      mapCell: state.scientist.mapCell,
      automationExcluded: false,
      job: 'idle',
      jobProgress: 0,
      jobTargetCorpseId: null,
      jobNutritionGained: 0,
      revealed: { behavior: 'idle pooling', stability: 'placid' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      skills: {},
      behaviorMemory: {
        tags: { combatHurt: 80 },
        recent: [{ key: 'combatHurt', reason: 'fixture pain memory', amount: 80, at: 0 }],
        lastUpdatedAt: 0,
      },
      nextPerceptionPracticeAt: 999999,
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 80, max: 100 },
        currentMass: { current: 100, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 0, max: 100 },
      },
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome });
  await loadSavedRun(page);

  const response = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.slimes[0]?.ai?.response || null;
  }, { key: storageKey });

  expect(response?.intent).toBe('flee');
  expect(response?.reasons).toContain('remembered combat pain');
});
