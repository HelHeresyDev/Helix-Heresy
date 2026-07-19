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

async function openWorkspace(page, tabId) {
  await page.locator(`[data-workspace-tab="${tabId}"]`).click();
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
  await expect(skillList).toContainText('Perception');
  await expect(skillList).toContainText('Arcane Senses');
  await expect(skillList).toContainText('Animancy');
  await expect(skillList).not.toContainText('Materials Science');

  const firstBreakthrough = xpToNextLevel(0);

  await openWorkspace(page, 'cheats');
  await page.locator('#xpCommandInput').fill(`materialsScience ${firstBreakthrough - 1}`);
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('Analysis');
  await expect(skillList).not.toContainText('Materials Science');

  await page.locator('#xpCommandInput').fill('materialsScience 1');
  await page.locator('#xpCommandBtn').click();
  await expect(skillList).toContainText('Analysis');
  await expect(skillList).toContainText('Materials Science');
  await expect(skillList).toContainText('[Initiate], level 1');
  await expect(skillList).not.toContainText('Observation');

  const savedSkills = await page.evaluate(() => {
    const payload = JSON.parse(window.localStorage.getItem('helix-heresy-v1-save') || '{}');
    const state = payload.state || payload;
    return {
      analysis: state.scientist?.skills?.analysis || null,
      materialsScience: state.scientist?.skills?.materialsScience || null,
    };
  });

  expect(savedSkills.analysis?.xp).toBe(firstBreakthrough);
  expect(savedSkills.analysis?.practiceTags?.starter).toBe(firstBreakthrough);
  expect(savedSkills.materialsScience?.xp).toBe(firstBreakthrough);
  expect(savedSkills.materialsScience?.practiceTags?.cheatcommand).toBe(firstBreakthrough);
  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('low-confidence diagnostic grants reduced XP', async ({ page }) => {
  await startRun(page);
  const firstBreakthrough = xpToNextLevel(0);

  await openWorkspace(page, 'resources');
  await page.locator('[data-stores-menu-tab="scientist"]').click();
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
  await openWorkspace(page, 'cheats');
  await page.locator('#xpCommandInput').fill(`materialsScience ${firstBreakthrough - 1}`);
  await page.locator('#xpCommandBtn').click();

  await skipSeconds(page, 60 * 60 * 48);

  const skill = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    return state.scientist?.skills?.materialsScience || null;
  }, { key: storageKey });

  const expected = (firstBreakthrough - 1) - firstBreakthrough * 0.1;
  expect(skill?.xp).toBeCloseTo(expected, 4);
  expect(skill?.lastBreakthroughDecayAt).toBe(60 * 60 * 48);
  await expect(page.locator('#skillList')).toContainText('Analysis');
  await expect(page.locator('#skillList')).not.toContainText('Materials Science');
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

  expect(result.scientistSkills).toEqual(expect.arrayContaining(['analysis', 'perception', 'animancy', 'arcaneSenses']));
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

  await openWorkspace(page, 'specimens');
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
      practiceTags: { analyze: analysisXp },
      evolvedLabel: '',
      evolvedTierId: '',
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
          evolvedTierId: '',
          lastPracticedAt: 0,
          lastBreakthroughDecayAt: 0,
        },
        thermal: {
          xp: hiddenThermalXp,
          practiceTags: { fixture: hiddenThermalXp },
          evolvedLabel: '',
          evolvedTierId: '',
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
    analysisXp: totalXpForLevel(51),
    toughnessXp: totalXpForLevel(3),
    hiddenThermalXp: totalXpForLevel(2),
  });
  await loadSavedRun(page);

  await openWorkspace(page, 'specimens');
  await expect(page.locator('#skillList')).toContainText('Creature Analysis');
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
  expect(result.analysisXp).toBe(totalXpForLevel(51) + 6);
  expect(result.knownSkills).toEqual(['toughness']);
  expect(result.toughnessExactLevel).toBe(3);
  expect(result.thermalKnown).toBe(false);
  expect(result.advancedAttempts).toBe(1);
});

test('Analysis evolves into Combat Analysis and unlocks Combat Analyze', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'flame', behavior: 'vibration hunting', stability: 'predatory' } });

  await page.evaluate(({ key, genome, analysisXp }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.scientist.vitals.mana = { current: 100, max: 100 };
    state.scientist.skills.analysis = {
      xp: analysisXp,
      practiceTags: { combatattack: analysisXp },
      evolvedLabel: '',
      evolvedTierId: '',
      lastPracticedAt: 0,
      lastBreakthroughDecayAt: 0,
    };
    state.selectedSlimeId = 'combat-analyze-target';
    state.slimes = [{
      id: 'combat-analyze-target',
      name: 'COMBAT-ANALYZE',
      genome,
      source: 'Combat Analyze fixture',
      createdAt: 0,
      deathAt: 1000000,
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
      revealed: { element: 'flame', behavior: 'vibration hunting', stability: 'predatory' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      skills: {},
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      analyzedCapabilities: {},
      nextPerceptionPracticeAt: 999999,
      stats: {
        bodyIntegrity: { current: 100, max: 100 },
        nutrition: { current: 5, max: 100 },
        currentMass: { current: 80, max: 100 },
        divisionPressure: { current: 0, max: 100 },
        stress: { current: 90, max: 100 },
      },
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome, analysisXp: totalXpForLevel(51) });
  await loadSavedRun(page);

  await openWorkspace(page, 'specimens');
  await expect(page.locator('#skillList')).toContainText('Combat Analysis');
  const panel = page.locator('[data-slime-analyze-panel="combat-analyze-target"]');
  await page.locator('[data-combat-analyze-slime-id="combat-analyze-target"]').click();

  await expect(panel).toContainText('Combat read');
  await expect(panel).toContainText('Damage tags');
  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((entry) => entry.id === 'combat-analyze-target');
    return {
      mana: state.scientist.vitals.mana.current,
      analysisXp: state.scientist.skills.analysis.xp,
      evolvedLabel: state.scientist.skills.analysis.evolvedLabel,
      combatAttempts: slime?.analyzedCapabilities?.combatAttempts || 0,
      combatThreat: slime?.analyzedCapabilities?.combat?.threat || '',
      damageTags: slime?.analyzedCapabilities?.combat?.damageTags || '',
    };
  }, { key: storageKey });

  expect(result.mana).toBe(86);
  expect(result.analysisXp).toBe(totalXpForLevel(51) + 7);
  expect(result.evolvedLabel).toBe('Combat Analysis');
  expect(result.combatAttempts).toBe(1);
  expect(result.combatThreat).not.toBe('');
  expect(result.damageTags).toContain('Heat');
});

test('Analysis evolves into Forensic Analysis and reads corpse evidence', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'frost', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome, analysisXp }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    state.scientist.vitals.mana = { current: 100, max: 100 };
    state.scientist.skills.analysis = {
      xp: analysisXp,
      practiceTags: { necropsy: analysisXp },
      evolvedLabel: '',
      evolvedTierId: '',
      lastPracticedAt: 0,
      lastBreakthroughDecayAt: 0,
    };
    state.slimes = [];
    state.corpses = [{
      id: 'corpse-forensic',
      specimenId: 'forensic-dead',
      name: 'FORENSIC-CORPSE',
      genome,
      source: 'Forensic Analyze fixture',
      deathReason: 'combat trauma',
      diedAt: 0,
      roomId: 'mainLab',
      containerId: null,
      storage: 'drum',
      mapCell: null,
      consumedProgress: 0,
      ruined: false,
      revealed: { element: 'frost' },
      measured: {},
      traitObservations: {},
      testsRun: [],
      harvestedProcedures: {},
      nextOverflowEventAt: null,
    }];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome, analysisXp: totalXpForLevel(51) });
  await loadSavedRun(page);

  await openWorkspace(page, 'specimens');
  await expect(page.locator('#skillList')).toContainText('Forensic Analysis');
  await page.locator('[data-forensic-analyze-corpse-id="corpse-forensic"]').click();
  await expect(page.locator('[data-forensic-report="corpse-forensic"]')).toContainText('Cause: combat trauma');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const corpse = state.corpses.find((entry) => entry.id === 'corpse-forensic');
    return {
      mana: state.scientist.vitals.mana.current,
      analysisXp: state.scientist.skills.analysis.xp,
      evolvedLabel: state.scientist.skills.analysis.evolvedLabel,
      forensicSummary: corpse?.forensicReport?.summary || '',
    };
  }, { key: storageKey });

  expect(result.mana).toBe(88);
  expect(result.analysisXp).toBe(totalXpForLevel(51) + 7);
  expect(result.evolvedLabel).toBe('Forensic Analysis');
  expect(result.forensicSummary).toContain('combat trauma');
  expect(result.forensicSummary).toContain('contained evidence');
});

test('Analyze displays evolved creature skill labels after breakthrough', async ({ page }) => {
  await startRun(page);
  const seed = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    return (payload.state || payload).seed;
  }, { key: storageKey });
  const genome = genomeForTraits({ seed, traits: { element: 'none', behavior: 'idle pooling', stability: 'placid' } });

  await page.evaluate(({ key, genome, strikingXp }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const jar = (state.containers || []).find((container) => container.id === 'basic-1') || state.containers?.[0];
    state.scientist.vitals.mana = { current: 100, max: 100 };
    state.selectedSlimeId = 'evolved-skill-target';
    state.slimes = [{
      id: 'evolved-skill-target',
      name: 'EVOLVED-SKILL',
      genome,
      source: 'Creature skill evolution fixture',
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
        striking: {
          xp: strikingXp,
          practiceTags: { combatattack: strikingXp },
          evolvedLabel: '',
          evolvedTierId: '',
          lastPracticedAt: 0,
          lastBreakthroughDecayAt: 0,
        },
      },
      behaviorMemory: { tags: {}, recent: [], lastUpdatedAt: null },
      analyzedCapabilities: {},
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
  }, { key: storageKey, genome, strikingXp: totalXpForLevel(51) });
  await loadSavedRun(page);

  await openWorkspace(page, 'specimens');
  await page.locator('[data-analyze-slime-id="evolved-skill-target"]').click();
  await expect(page.locator('[data-slime-analyze-panel="evolved-skill-target"]')).toContainText('Lashing Strikes [Novice]');

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = state.slimes.find((entry) => entry.id === 'evolved-skill-target');
    return {
      evolvedLabel: slime?.skills?.striking?.evolvedLabel || '',
      analyzedLabel: slime?.analyzedCapabilities?.skills?.striking?.label || '',
    };
  }, { key: storageKey });

  expect(result.evolvedLabel).toBe('Lashing Strikes');
  expect(result.analyzedLabel).toBe('Lashing Strikes');
});

test('slime breakthrough progress decays at the same threshold as scientist skills', async ({ page }) => {
  test.slow();
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
      splitBlocked: true,
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
