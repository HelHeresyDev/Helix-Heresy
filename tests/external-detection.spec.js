// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Detection = require('../external-detection.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#titleNewRunBtn').click();
  await page.locator('#startRunSubmitBtn').click();
}

test('detection opportunities and witness outcomes are seeded, saved, and non-rerollable', () => {
  const first = Detection.createOpportunity(Detection.defaultState(), {
    seed: 'fixed-run', opportunityKey: 'vent:1', evidenceId: 'evidence-1', sourceId: 'nearby-observer',
    opportunityAt: 100, detectionChance: 0.5, reportChance: 0.7, reportDelaySeconds: 50,
    reliability: 'credible', specificity: 'siteLinked', knowledge: 'inferred'
  });
  const repeated = Detection.createOpportunity(first.state, {
    seed: 'different-seed-cannot-reroll', opportunityKey: 'vent:1', evidenceId: 'evidence-1',
    sourceId: 'nearby-observer', opportunityAt: 100, detectionChance: 1
  });
  expect(repeated.created).toBe(false);
  expect(repeated.exposure).toEqual(first.exposure);
  expect(Detection.normalizeState(JSON.parse(JSON.stringify(first.state))).exposures[0]).toEqual(first.exposure);
});

test('due reports create institutional memory and compatible reports create correlation', () => {
  let state = Detection.defaultState();
  state = Detection.createOpportunity(state, {
    seed: 'reports', opportunityKey: 'report:a', evidenceId: 'evidence-a', sourceId: 'filing-system',
    opportunityAt: 10, observed: true, willReport: true, reportDelaySeconds: 0,
    reliability: 'strong', specificity: 'identityLinked', knowledge: 'known', significanceRank: 3
  }).state;
  let processed = Detection.processDue(state, 10);
  expect(processed.createdReports).toHaveLength(1);
  expect(processed.state.memory).toHaveLength(1);

  state = Detection.createOpportunity(processed.state, {
    seed: 'reports', opportunityKey: 'report:b', evidenceId: 'evidence-b', sourceId: 'filing-system',
    opportunityAt: 20, observed: true, willReport: true, reportDelaySeconds: 0,
    reliability: 'credible', specificity: 'siteLinked', knowledge: 'known', significanceRank: 2
  }).state;
  processed = Detection.processDue(state, 20);
  expect(processed.createdReports).toHaveLength(1);
  expect(processed.createdCorrelations).toHaveLength(1);
  expect(Detection.attentionScore(processed.state, 20, { activeEvidenceIds: new Set(['evidence-a', 'evidence-b']) })).toBeGreaterThan(20);
});

test('institutional memory fades fully without a permanent historical floor', () => {
  const state = Detection.addLegacyMemory(Detection.defaultState(), 20, 0);
  expect(Detection.attentionScore(state, 0, { activeEvidenceIds: new Set() })).toBe(20);
  expect(Detection.attentionScore(state, Detection.MEMORY_DECAY_SECONDS, { activeEvidenceIds: new Set() })).toBe(0);
});

test('internal evidence creates no attention until an external source observes and reports it', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const spill = window.helixHeresyDebug.addInvestigativeTestResidue({ amount: 2 });
    window.helixHeresyDebug.advanceSimulation(2);
    const evidence = window.helixHeresyDebug.investigativeEvidenceSnapshot().records.find((entry) => entry.subject.id === spill.id);
    return { evidence, detection: window.helixHeresyDebug.externalDetectionSnapshot() };
  });
  expect(result.evidence).toBeTruthy();
  expect(result.detection.exposures).toHaveLength(0);
  expect(result.detection.attention).toBe(0);

  await page.evaluate((evidenceId) => window.helixHeresyDebug.registerExternalDetectionOpportunity(evidenceId, {
    opportunityKey: 'test-known-report', sourceId: 'nearby-observer', channel: 'publicTraffic',
    observed: true, willReport: true, reportDelaySeconds: 0, reliability: 'credible',
    specificity: 'siteLinked', knowledge: 'known', summary: 'an unusual biological residue near the public entrance'
  }), result.evidence.id);
  const observed = await page.evaluate(() => window.helixHeresyDebug.externalDetectionSnapshot());
  expect(observed.reports).toHaveLength(1);
  expect(observed.attention).toBeGreaterThan(0);

  await page.locator('[data-workspace-tab="evidence"]').click();
  await expect(page.locator('[data-external-signals]')).toContainText('Known external report');
  await expect(page.locator('[data-external-signals]')).toContainText('Environmental and Public Health');
  await expect(page.locator('[data-external-signals]')).not.toContainText('nearby-observer');
  await expect(page.locator('[data-external-signals]')).not.toContainText('reportDelaySeconds');

  const reportId = observed.reports[0].id;
  const saved = await page.evaluate(() => window.helixHeresyDebug.currentWorldRunSnapshot().run.state.externalDetection);
  expect(saved.reports.some((report) => report.id === reportId)).toBe(true);
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.externalDetectionSnapshot());
  expect(reloaded.reports.some((report) => report.id === reportId)).toBe(true);
  expect(reloaded.attention).toBe(observed.attention);
});

test('an overdue filing is automatically known to the registry and raises derived attention', async ({ page }) => {
  await startRun(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.makeCompanyPeriodDue())).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(86401));
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.externalDetectionSnapshot());
  expect(snapshot.exposures).toContainEqual(expect.objectContaining({
    sourceId: 'filing-system', institutionId: 'commercial-registry', channel: 'filing', observed: true, status: 'reported'
  }));
  expect(snapshot.reports).toContainEqual(expect.objectContaining({
    institutionId: 'commercial-registry', reliability: 'strong', specificity: 'identityLinked', knowledge: 'known'
  }));
  expect(snapshot.attention).toBeGreaterThan(0);
  expect(snapshot.band.id).not.toBe('quiet');
});
