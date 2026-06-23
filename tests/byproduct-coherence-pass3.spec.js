// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const storageKey = 'helix-heresy-v1-save';
const visualPauseMs = Number(process.env.VISUAL_PAUSE_MS || 0);
const pairCodes = ['AA', 'AC', 'AG', 'AT', 'CA', 'CC', 'CG', 'CT', 'GA', 'GC', 'GG', 'GT', 'TA', 'TC', 'TG', 'TT'];
const acidByproducts = ['acid droplets', 'corrosive slime', 'dissolved sludge', 'sterile solvent'];

async function visualPause(page, locator, label) {
  if (!Number.isFinite(visualPauseMs) || visualPauseMs <= 0) return;
  await locator.scrollIntoViewIfNeeded();
  console.log(`Visual pause: ${label} (${visualPauseMs}ms)`);
  await page.waitForTimeout(visualPauseMs);
}

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

async function installSlimeScan(page, { elementCodes = pairCodes, byproductCodes = ['AA'], consistencyCodes = ['AA'], duplicateFirst = false } = {}) {
  await page.evaluate(({ key, elementCodes, byproductCodes, consistencyCodes, duplicateFirst }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const baseGenome = (state.currentGenome || 'ACGTACGTACGTACGTACGTACGTAC').slice(0, 26).padEnd(26, 'A');
    const replaceRegionInBrowser = (genome, start, code) => `${genome.slice(0, start)}${code}${genome.slice(start + 2)}`;
    const byproductStart = 10;
    const elementStart = 12;
    const consistencyStart = 24;
    state.started = true;
    state.paused = true;
    state.selectedSlimeId = null;
    state.slimes = [];
    let index = 1;
    const addSlime = (elementCode, byproductCode, consistencyCode, suffix = '') => {
      let genome = replaceRegionInBrowser(baseGenome, byproductStart, byproductCode);
      genome = replaceRegionInBrowser(genome, elementStart, elementCode);
      genome = replaceRegionInBrowser(genome, consistencyStart, consistencyCode);
      const id = `out-${elementCode}-${byproductCode}-${consistencyCode}${suffix}`;
      state.slimes.push({
        id,
        name: `OUT-${String(index).padStart(3, '0')}`,
        genome,
        source: 'Synthetic',
        createdAt: index,
        deathAt: 10000,
        lifecycleVersion: 1,
        matureAt: 0,
        mature: true,
        status: 'contained',
        containerId: null,
        roomId: 'mainLab',
        job: 'idle',
        jobProgress: 0,
        jobTargetCorpseId: null,
        jobNutritionGained: 0,
        stats: {},
        revealed: { element: true, byproduct: true, consistency: true },
        measured: {},
        traitObservations: {},
        testsRun: [],
        jobKnowledge: {}
      });
      index += 1;
    };
    for (const elementCode of elementCodes) {
      for (const byproductCode of byproductCodes) {
        for (const consistencyCode of consistencyCodes) {
          addSlime(elementCode, byproductCode, consistencyCode);
          if (duplicateFirst && index === 2) {
            addSlime(elementCode, byproductCode, consistencyCode, '-duplicate');
          }
        }
      }
    }
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, elementCodes, byproductCodes, consistencyCodes, duplicateFirst });
  await loadSavedRun(page);
}

async function slimeIdentitySummaries(page) {
  return page.locator('[data-slime-card]').evaluateAll((cards) => cards.map((card) => ({
    id: card.getAttribute('data-slime-card') || '',
    element: card.querySelector('.identity-slot-element')?.getAttribute('title') || '',
    byproduct: card.querySelector('.identity-slot-byproduct')?.getAttribute('title') || '',
    text: card.textContent || ''
  })));
}

function byproductLabel(summary) {
  return String(summary.byproduct || '').split('\n')[0].replace(/^Byproduct:\s*/i, '').trim().toLowerCase();
}

test.describe('Byproduct Coherence Pass 3', () => {
  test('source adds rolled output intensity and small metabolic modifier without exposing exact values', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const BYPRODUCT_OUTPUT_BANDS');
    expect(source).toContain('function byproductOutputBandForCode');
    expect(source).toContain('function rollByproductExpression');
    expect(source).toContain('function normalizeByproductExpression');
    expect(source).toContain('function slimeFoodDemandModifier');
    expect(source).toContain('function adjustedSlimeNutritionGain');
    expect(source).toContain('Natural output:');
    expect(source).toContain('Metabolic demand:');
    expect(source).toContain('0.96');
    expect(source).toContain('1.05');
    expect(source).toContain('adjustedMassRegrowthNutritionCost(slime)');
    expect(source).toContain('adjustedSlimeNutritionGain(slime, effects.nutrition)');
    expect(source).toContain('state?.seed || "seed"}:byproduct-expression:${slime?.id');

    expect(source).not.toContain('Byproduct gene AT');
    expect(source).not.toContain('AT selects');
    expect(source).not.toContain('allele slot tooltip');
    expect(source).not.toContain('harvestByproduct');
    expect(source).not.toContain('byproductInventoryOutput');
    expect(source).not.toContain('currentOutputSimulation');
  });

  test('output bands appear as broad UI labels and food modifier remains hidden', async ({ page }) => {
    if (Number.isFinite(visualPauseMs) && visualPauseMs > 0) {
      test.setTimeout(30000 + visualPauseMs * 2);
    }

    const consoleIssues = [];
    const pageErrors = [];
    page.on('console', (message) => {
      if (['warning', 'error'].includes(message.type())) consoleIssues.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await startRun(page);
    await installSlimeScan(page, { byproductCodes: ['AA'], consistencyCodes: ['AA'] });
    const elementScan = await slimeIdentitySummaries(page);
    const acid = elementScan.find((summary) => /Element: acid/i.test(summary.element));
    expect(acid, `Expected acid element in scan. Found: ${JSON.stringify(elementScan.map((s) => s.element))}`).toBeTruthy();
    const acidElementCode = acid.id.split('-')[1];

    await installSlimeScan(page, { elementCodes: [acidElementCode], byproductCodes: ['AA', 'AT', 'TA', 'TT'], consistencyCodes: ['AA'], duplicateFirst: true });
    const summaries = await slimeIdentitySummaries(page);
    for (const summary of summaries) {
      expect(acidByproducts.includes(byproductLabel(summary)), `${summary.id} produced ${summary.byproduct}`).toBe(true);
      expect(summary.byproduct).toContain('Natural output:');
      expect(summary.byproduct).toContain('Metabolic demand:');
    }

    const titleByCode = Object.fromEntries(summaries.map((summary) => [summary.id.split('-')[2], summary.byproduct]));
    expect(titleByCode.AA).toContain('Natural output: Trace');
    expect(titleByCode.AA).toContain('Metabolic demand: Slightly reduced');
    expect(titleByCode.AT).toContain('Natural output: Low');
    expect(titleByCode.AT).toContain('Metabolic demand: Mild');
    expect(titleByCode.TA).toContain('Natural output: Moderate');
    expect(titleByCode.TA).toContain('Metabolic demand: Baseline');
    expect(titleByCode.TT).toContain('Natural output: High');
    expect(titleByCode.TT).toContain('Metabolic demand: Elevated');

    await visualPause(page, page.locator('[data-slime-card]').first(), 'Byproduct output intensity bands');

    const body = page.locator('body');
    await expect(body).not.toContainText('Byproduct gene');
    await expect(body).not.toContainText('AT selects');
    await expect(body).not.toContainText('allele slot');
    await expect(body).not.toContainText('food modifier');
    await expect(body).not.toContainText('output scalar');

    await visualPause(page, page.locator('[data-slime-card]').first(), 'Hidden numeric output values not exposed');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
