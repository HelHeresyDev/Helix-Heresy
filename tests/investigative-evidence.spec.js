// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Evidence = require('../investigative-evidence.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#startRunSubmitBtn').click();
}

test('investigative evidence schema normalizes provenance and ages deterministic transient traces', () => {
  const record = Evidence.normalizeRecord({
    id: 'site-evidence-7', type: 'exhaustTrace', category: 'chemical', label: 'Vent trace',
    createdAt: 10, updatedAt: 10, integrity: 80,
    locus: { roomId: 'surfaceProcessing', cell: { x: 4, y: 5, z: 1 } },
    refs: { stackIds: ['stack-1', 'stack-1'], batchIds: ['batch-2'] },
    persistence: { kind: 'transient', decaySeconds: 100 },
    magnitude: { band: 'moderate', amount: 4, unit: 'load' }, discoverability: { level: 'subtle', methods: ['sampling'] },
    provenance: [{ at: 10, action: 'created', details: 'Initial discharge' }]
  });
  expect(record.refs.stackIds).toEqual(['stack-1']);
  expect(record.locus.cell).toEqual({ x: 4, y: 5, z: 1 });
  expect(record.magnitude).toEqual({ band: 'moderate', amount: 4, unit: 'load' });
  expect(record.discoverability).toEqual({ level: 'subtle', methods: ['sampling'] });
  expect(Evidence.integrityAt(record, 60)).toBeCloseTo(40);
  expect(Evidence.integrityAt(record, 110)).toBe(0);
  expect(Evidence.normalizeState({ records: [record] }).nextEvidenceNumber).toBe(8);
});

test('Chemistry Front begins with known inherited documentary evidence that persists through save reload', async ({ page }) => {
  await startRun(page);
  const initial = await page.evaluate(() => window.helixHeresyDebug.investigativeEvidenceSnapshot());
  const inherited = initial.records.find((record) => record.type === 'incompleteInheritedBooks');
  expect(inherited).toMatchObject({
    category: 'documentary', significance: 'material', lifecycle: 'present',
    persistence: { kind: 'permanent' }, knowledge: { state: 'known', sourceIdentityKnown: true },
    subject: { kind: 'startingLiability', id: 'incomplete-business-records' }
  });

  await page.locator('[data-workspace-tab="evidence"]').click();
  await expect(page.locator('#evidenceSummary')).toContainText('known active trace');
  await expect(page.locator('#evidenceSummary')).toContainText('do not assign guilt');
  await expect(page.locator('#evidenceList')).toContainText('Incomplete inherited records');

  const id = inherited.id;
  await page.reload();
  expect(await page.evaluate((recordId) => window.helixHeresyDebug.investigativeEvidenceSnapshot().records.some((record) => record.id === recordId), id)).toBe(true);
});

test('physical residue remains the overlay target and cleanup records an immutable transformation chain', async ({ page }) => {
  await startRun(page);
  const spill = await page.evaluate(() => window.helixHeresyDebug.addInvestigativeTestResidue({
    typeKey: 'slimeTrace', amount: 2, tags: ['biological', 'hazard'], sourceSlimeIds: ['slime-test-source']
  }));
  expect(spill).toBeTruthy();

  let snapshot = await page.evaluate(() => window.helixHeresyDebug.investigativeEvidenceSnapshot());
  const original = snapshot.records.find((record) => record.subject.id === spill.id);
  expect(original).toMatchObject({ category: 'biological', type: 'biologicalTrace', lifecycle: 'present' });
  expect(original.refs.stackIds).toContain(spill.id);
  expect(original.refs.slimeIds).toContain('slime-test-source');
  await page.locator('[data-workspace-tab="evidence"]').click();
  await expect(page.locator(`[data-evidence-id="${original.id}"]`)).toContainText('Source identity not established');
  await expect(page.locator(`[data-evidence-id="${original.id}"]`)).not.toContainText('slime-test-source');

  const overlay = await page.evaluate((stackId) => {
    window.helixHeresyDebug.setMapOverlay('evidence');
    return window.helixHeresyDebug.mapViewSnapshot().cells.find((cell) => cell.overlay?.target?.id === stackId)?.overlay || null;
  }, spill.id);
  expect(overlay).toMatchObject({ id: 'evidence', target: { kind: 'itemStack', id: spill.id } });

  const task = await page.evaluate((stackId) => window.helixHeresyDebug.queueInvestigativeTestCleanup(stackId), spill.id);
  expect(task).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3600));
  snapshot = await page.evaluate(() => window.helixHeresyDebug.investigativeEvidenceSnapshot());
  const transformed = snapshot.records.find((record) => record.id === original.id);
  expect(transformed.lifecycle).toBe('contained');
  expect(transformed.refs.successorEvidenceIds.length).toBeGreaterThan(0);
  const successor = snapshot.records.find((record) => transformed.refs.successorEvidenceIds.includes(record.id));
  expect(successor.refs.predecessorEvidenceIds).toContain(original.id);
  expect(transformed.provenance.some((entry) => entry.action === 'contained')).toBe(true);
});

test('contraband batches create concrete evidence with exact batch and stack references', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const offer = window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.commodityKind === 'manufactured');
    const batch = window.helixHeresyDebug.addBlackMarketManufacturedBatch(offer.id);
    return { batch, evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot() };
  });
  const record = result.evidence.records.find((entry) => entry.subject.id === result.batch.id);
  expect(record).toMatchObject({ category: 'chemical', type: 'illicitChemicalBatch', significance: 'serious' });
  expect(record.refs.stackIds).toContain(result.batch.id);
  expect(record.refs.batchIds).toContain(result.batch.chemicalBatch.id);
  expect(record.traits).toContain('contraband');
});
