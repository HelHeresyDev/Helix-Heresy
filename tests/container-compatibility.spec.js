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

async function stageCompatibilitySlime(page, { genome, revealed = {} }) {
  await page.evaluate(({ key, genome, revealed }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const container = (state.containers || []).find((item) => item.id === 'basic-1');
    if (!container) {
      throw new Error('basic-1 container not found');
    }
    container.typeId = 'basicGlassJar';
    container.name = 'Compatibility Jar';
    container.roomId = 'mainLab';
    container.condition = 100;
    container.environment ||= {};
    container.environment.contamination = { current: 0, baseline: 0 };
    state.started = true;
    state.paused = true;
    state.clock = 0;
    state.tasks = [];
    state.selectedSlimeId = 'compat-slime';
    state.slimes = [
      {
        id: 'compat-slime',
        name: 'CMP-001',
        genome,
        source: 'Compatibility fixture',
        createdAt: 0,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: container.id,
        roomId: container.roomId,
        automationExcluded: false,
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {
          bodyIntegrity: { current: 100, max: 100 },
          nutrition: { current: 70, max: 100 },
          currentMass: { current: 100, max: 100 },
          divisionPressure: { current: 0, max: 100 },
          stress: { current: 0, max: 100 },
        },
        revealed,
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {},
      },
    ];
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, genome, revealed });
  await loadSavedRun(page);
}

test('known material and support problems appear in container compatibility readout', async ({ page }) => {
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
    traits: { element: 'acid', consistency: 'watery' },
  });
  await stageCompatibilitySlime(page, {
    genome,
    revealed: { element: true, consistency: true, size: true, shape: true, appendages: true },
  });

  const compatibility = page.locator('[data-container-compatibility-range]').filter({ hasText: 'Compatibility:' }).first();
  await expect(compatibility).toBeVisible();
  await expect(compatibility).toContainText(/Questionable|Poor|Unsafe/);
  const title = await compatibility.getAttribute('title');
  expect(title).toContain('corrosive exposure');
  expect(title).toContain('lacks drainage');
  await expect(page.locator('[data-slime-elemental-hazard="compat-slime"]')).toContainText('Hazard: Corrosive');
  await expect(page.locator('[data-slime-elemental-hazards="compat-slime"]')).toContainText('Corrosive');
  await expect(page.locator('[data-slime-elemental-hazards="compat-slime"]')).toContainText('corrosive exposure');

  const resistance = page.locator('[data-container-damage-resistance="basic-1"]');
  await expect(resistance).toBeVisible();
  await expect(resistance).toContainText('Material resistance:');
  const resistanceTitle = await resistance.getAttribute('title');
  expect(resistanceTitle).toContain('Corrosive');
  expect(resistanceTitle).toContain('Physical');

  await page.locator('[data-handling-method-select="true"]').selectOption('thickGloves');
  const handlingNote = page.locator('[data-handling-inventory-note="true"]');
  await expect(handlingNote).toContainText('Tool resistance:');
  await expect(handlingNote).toContainText('Physical');
  const handlingTitle = await handlingNote.getAttribute('title');
  expect(handlingTitle).toContain('Thick gloves hazard resistance');
  expect(handlingTitle).toContain('Toxic');

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('undiscovered traits widen compatibility without naming hidden hazards', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'acid', consistency: 'watery' },
  });
  await stageCompatibilitySlime(page, { genome, revealed: {} });

  const compatibility = page.locator('[data-container-compatibility-range]').filter({ hasText: 'Compatibility:' }).first();
  await expect(compatibility).toBeVisible();
  const title = await compatibility.getAttribute('title');
  expect(title).toContain('Unknown factors');
  expect(title).toContain('elemental material hazard');
  expect(title).not.toContain('corrosive exposure');
  expect(title).not.toContain('acid');
  await expect(page.locator('[data-slime-elemental-hazards="compat-slime"]')).toHaveCount(0);
});

test('none element displays physical hazard when discovered', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'none' },
  });
  await stageCompatibilitySlime(page, { genome, revealed: { element: true } });

  await expect(page.locator('[data-slime-elemental-hazard="compat-slime"]')).toContainText('Hazard: Physical');
  await expect(page.locator('[data-slime-elemental-hazards="compat-slime"]')).toContainText('Physical');
  await expect(page.locator('[data-slime-elemental-hazards="compat-slime"]')).toContainText('physical impact and abrasion');
});

test('bad hidden compatibility slowly stresses specimen and fouls container', async ({ page }) => {
  await startRun(page);
  const context = await saveContext(page);
  const genome = genomeForTraits({
    seed: context.seed,
    complexity: context.complexity,
    baseGenome: context.currentGenome,
    traits: { element: 'acid', consistency: 'watery' },
  });
  await stageCompatibilitySlime(page, { genome, revealed: {} });

  await page.locator('#queueToggleBtn').click();
  await page.locator('#skipAmountInput').fill('1440');
  await page.locator('#skipTimeBtn').click();

  const result = await page.evaluate(({ key }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const slime = (state.slimes || []).find((item) => item.id === 'compat-slime');
    const container = (state.containers || []).find((item) => item.id === 'basic-1');
    return {
      stress: slime?.stats?.stress?.current,
      contamination: container?.environment?.contamination?.current,
      condition: container?.condition,
    };
  }, { key: storageKey });

  expect(result.stress).toBeGreaterThan(0);
  expect(result.contamination).toBeGreaterThan(0);
  expect(result.condition).toBeLessThan(100);
});
