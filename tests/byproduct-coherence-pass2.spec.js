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
const waterByproducts = ['clean water', 'cooling brine', 'watery residue', 'slick gel'];

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

async function installSlimeScan(page, { elementCodes = pairCodes, byproductCodes = ['AA'], consistencyCodes = ['AA'] } = {}) {
  await page.evaluate(({ key, elementCodes, byproductCodes, consistencyCodes }) => {
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
    for (const elementCode of elementCodes) {
      for (const byproductCode of byproductCodes) {
        for (const consistencyCode of consistencyCodes) {
          let genome = replaceRegionInBrowser(baseGenome, byproductStart, byproductCode);
          genome = replaceRegionInBrowser(genome, elementStart, elementCode);
          genome = replaceRegionInBrowser(genome, consistencyStart, consistencyCode);
          const id = `phys-${elementCode}-${byproductCode}-${consistencyCode}`;
          state.slimes.push({
            id,
            name: `BYP-${String(index).padStart(3, '0')}`,
            genome,
            source: 'Synthetic',
            createdAt: 0,
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
        }
      }
    }
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, elementCodes, byproductCodes, consistencyCodes });
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
  return String(summary.byproduct || '').replace(/^Byproduct:\s*/i, '').trim().toLowerCase();
}

function expectAllByproductsInPool(summaries, pool) {
  const allowed = new Set(pool.map((item) => item.toLowerCase()));
  for (const summary of summaries) {
    expect(allowed.has(byproductLabel(summary)), `${summary.id} produced ${summary.byproduct}; expected one of ${pool.join(', ')}`).toBe(true);
  }
}

test.describe('Byproduct Coherence Pass 2', () => {
  test('source narrows coherent byproduct pools by physiology without using jobs or adding player-facing gene explanations', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const BYPRODUCT_CONSISTENCY_PROFILES');
    expect(source).toContain('const BYPRODUCT_PHYSIOLOGY_SLOT_ORDERS');
    expect(source).toContain('const BYPRODUCT_PHYSIOLOGY_POOL_OVERRIDES');
    expect(source).toContain('function byproductPhysiologyProfile');
    expect(source).toContain('function byproductPoolForElementAndPhysiology');
    expect(source).toContain('resolveByproductOutcome(traits.element, traits.byproduct, getRegionCode(genome, "byproduct"), traits.consistency)');

    expect(source).not.toContain('currentOutputSimulation');
    expect(source).not.toContain('harvestByproduct');
    expect(source).not.toContain('byproductInventoryOutput');
    expect(source).not.toContain('Byproduct gene AT');
    expect(source).not.toContain('AT selects');
    expect(source).not.toContain('allele slot tooltip');
  });

  test('physiology changes natural byproduct within element-compatible pools while gene slots stay stable', async ({ page }) => {
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
    const water = elementScan.find((summary) => /Element: water/i.test(summary.element));
    expect(acid, `Expected acid element in scan. Found: ${JSON.stringify(elementScan.map((s) => s.element))}`).toBeTruthy();
    expect(water, `Expected water element in scan. Found: ${JSON.stringify(elementScan.map((s) => s.element))}`).toBeTruthy();
    const acidElementCode = acid.id.split('-')[1];
    const waterElementCode = water.id.split('-')[1];

    await installSlimeScan(page, { elementCodes: [acidElementCode], byproductCodes: ['AA'], consistencyCodes: pairCodes });
    const acidPhysiology = await slimeIdentitySummaries(page);
    expectAllByproductsInPool(acidPhysiology, acidByproducts);
    expect(new Set(acidPhysiology.map(byproductLabel)).size).toBeGreaterThan(1);

    await installSlimeScan(page, { elementCodes: [waterElementCode], byproductCodes: ['AA'], consistencyCodes: pairCodes });
    const waterPhysiology = await slimeIdentitySummaries(page);
    expectAllByproductsInPool(waterPhysiology, waterByproducts);
    expect(new Set(waterPhysiology.map(byproductLabel)).size).toBeGreaterThan(1);

    await visualPause(page, page.locator('[data-slime-card]').first(), 'Physiology-compatible byproduct scan');

    await installSlimeScan(page, { elementCodes: [acidElementCode], byproductCodes: ['AA', 'AT', 'CG', 'GC'], consistencyCodes: ['AA'] });
    const acidAlleles = await slimeIdentitySummaries(page);
    const byproductByCode = Object.fromEntries(acidAlleles.map((summary) => [summary.id.split('-')[2], summary.byproduct]));
    expect(byproductByCode.AT).toBe(byproductByCode.AA);
    expect(byproductByCode.GC).toBe(byproductByCode.CG);
    expectAllByproductsInPool(acidAlleles, acidByproducts);

    await expect(page.locator('body')).not.toContainText('Byproduct gene');
    await expect(page.locator('body')).not.toContainText('AT selects');
    await expect(page.locator('body')).not.toContainText('allele slot');

    await visualPause(page, page.locator('[data-slime-card]').first(), 'Stable slots with physiology-compatible pool');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
