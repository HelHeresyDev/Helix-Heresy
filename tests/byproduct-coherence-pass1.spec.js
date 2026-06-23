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

function replaceRegion(genome, start, code) {
  return `${genome.slice(0, start)}${code}${genome.slice(start + 2)}`;
}

async function installElementScan(page, { elementCode = null, byproductCodes = ['AA'] } = {}) {
  await page.evaluate(({ key, codes, elementCode, byproductCodes }) => {
    const payload = JSON.parse(window.localStorage.getItem(key) || '{}');
    const state = payload.state || payload;
    const baseGenome = (state.currentGenome || 'ACGTACGTACGTACGTACGTACGTAC').slice(0, 26).padEnd(26, 'A');
    const byproductStart = 10;
    const elementStart = 12;
    const elementCodes = elementCode ? [elementCode] : codes;
    const replaceRegionInBrowser = (genome, start, code) => `${genome.slice(0, start)}${code}${genome.slice(start + 2)}`;
    state.started = true;
    state.paused = true;
    state.selectedSlimeId = null;
    state.slimes = [];
    let index = 1;
    for (const nextElementCode of elementCodes) {
      for (const byproductCode of byproductCodes) {
        let genome = replaceRegionInBrowser(baseGenome, byproductStart, byproductCode);
        genome = replaceRegionInBrowser(genome, elementStart, nextElementCode);
        state.slimes.push({
          id: `coherent-${nextElementCode}-${byproductCode}`,
          name: `COH-${String(index).padStart(3, '0')}`,
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
          revealed: { element: true, byproduct: true },
          measured: {},
          traitObservations: {},
          testsRun: [],
          jobKnowledge: {}
        });
        index += 1;
      }
    }
    window.localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }));
  }, { key: storageKey, codes: pairCodes, elementCode, byproductCodes });
  await loadSavedRun(page);
}

async function slimeIdentitySummaries(page) {
  return page.locator('[data-slime-card]').evaluateAll((cards) => cards.map((card) => ({
    id: card.getAttribute('data-slime-card') || '',
    element: card.querySelector('.identity-slot-element')?.getAttribute('title') || '',
    byproduct: card.querySelector('.identity-slot-byproduct')?.getAttribute('title') || ''
  })));
}

test.describe('Byproduct Coherence Pass 1', () => {
  test('source resolves byproduct gene pairs through element-compatible pools without player-facing gene explanation', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');

    expect(source).toContain('const BYPRODUCT_ALLELE_SLOT_GROUPS');
    expect(source).toContain('const BYPRODUCT_POOLS_BY_ELEMENT');
    expect(source).toContain('function byproductAlleleSlot');
    expect(source).toContain('function resolveByproductOutcome');
    expect(source).toContain('if (region.key === "byproduct")');
    expect(source).toContain('traits.byproduct = resolveByproductOutcome(traits.element, traits.byproduct, getRegionCode(genome, "byproduct"), traits.consistency)');

    expect(source).toContain('acid: ["acid droplets", "corrosive slime", "dissolved sludge", "sterile solvent"]');
    expect(source).toContain('water: ["clean water", "cooling brine", "watery residue", "slick gel"]');
    expect(source).not.toContain('Byproduct gene AT');
    expect(source).not.toContain('AT selects');
    expect(source).not.toContain('gene pair tooltip');
  });

  test('acid and water slimes resolve coherent byproducts while allele slots remain stable', async ({ page }) => {
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
    await installElementScan(page, { byproductCodes: ['AA'] });

    const summaries = await slimeIdentitySummaries(page);
    const acid = summaries.find((summary) => /Element: acid/i.test(summary.element));
    const water = summaries.find((summary) => /Element: water/i.test(summary.element));
    expect(acid, `Expected one generated specimen to reveal Element: acid. Found: ${JSON.stringify(summaries.map((s) => s.element))}`).toBeTruthy();
    expect(water, `Expected one generated specimen to reveal Element: water. Found: ${JSON.stringify(summaries.map((s) => s.element))}`).toBeTruthy();

    expect(acid.byproduct).toMatch(/Byproduct: (acid droplets|corrosive slime|dissolved sludge|sterile solvent)/i);
    expect(acid.byproduct).not.toMatch(/fertile silt|metallic flakes|glow mucus|clean water|numbing paste|coagulating wax/i);
    expect(water.byproduct).toMatch(/Byproduct: (clean water|cooling brine|watery residue|slick gel)/i);
    expect(water.byproduct).not.toMatch(/acid droplets|corrosive slime|dissolved sludge|sterile solvent/i);

    await visualPause(page, page.locator('[data-slime-card]').first(), 'Element-compatible byproduct scan');

    await installElementScan(page, { elementCode: acid.id.replace('coherent-', '').replace('-AA', ''), byproductCodes: ['AA', 'AT', 'CG', 'GC'] });
    const acidAlleles = await slimeIdentitySummaries(page);
    const byproductByCode = Object.fromEntries(acidAlleles.map((summary) => [summary.id.split('-').at(-1), summary.byproduct]));

    expect(byproductByCode.AA).toMatch(/Byproduct: (acid droplets|corrosive slime|dissolved sludge|sterile solvent)/i);
    expect(byproductByCode.AT).toBe(byproductByCode.AA);
    expect(byproductByCode.CG).toMatch(/Byproduct: (acid droplets|corrosive slime|dissolved sludge|sterile solvent)/i);
    expect(byproductByCode.GC).toBe(byproductByCode.CG);

    await expect(page.locator('body')).not.toContainText('Byproduct gene');
    await expect(page.locator('body')).not.toContainText('AT selects');

    await visualPause(page, page.locator('[data-slime-card]').first(), 'Stable byproduct allele slots');

    expect(consoleIssues).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
