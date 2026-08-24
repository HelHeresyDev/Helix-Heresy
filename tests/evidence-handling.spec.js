// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const EvidenceHandling = require('../evidence-handling');

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
  await page.locator('#setupForm button[type="submit"]').click();
}

test('handling orders freeze deterministic qualitative risk and outcome at creation', () => {
  const candidate = {
    action: 'conceal', subject: { kind: 'physicalStack', id: 'stack-9' }, seed: 'fixed-site', createdAt: 40,
    riskContext: { action: 'conceal', hazardTags: ['chemical', 'hazardous'], publicRoute: true, toolCondition: 25 }
  };
  const first = EvidenceHandling.createOrder(EvidenceHandling.defaultState(), candidate).order;
  const second = EvidenceHandling.createOrder(EvidenceHandling.defaultState(), candidate).order;
  expect(first.risk).toMatchObject({ bandId: 'severe' });
  expect(first.risk.reasons).toEqual(expect.arrayContaining(['hazardous or sensitive subject', 'route crosses public-facing space']));
  expect(first.outcomeSeed).toBe(second.outcomeSeed);
  expect(first.outcome).toEqual(second.outcome);
  expect(EvidenceHandling.normalizeState({ orders: [first] }).orders[0].outcome).toEqual(first.outcome);
});

test('company books materialize as a locked physical packet and Evidence exposes custody actions', async ({ page }) => {
  await startRun(page);
  const snapshot = await page.evaluate(() => window.helixHeresyDebug.evidenceHandlingSnapshot());
  expect(snapshot.packets).toHaveLength(1);
  expect(snapshot.packets[0]).toMatchObject({ periodId: 'company-period-1', status: 'local' });
  expect(snapshot.packets[0].stack).toMatchObject({ key: 'companyRecordsPacket', roomId: 'surfaceStaffOperations', fixtureId: 'starter-surface-records-cabinet' });

  await page.locator('[data-workspace-tab="evidence"]').click();
  const packetRow = page.locator('[data-evidence-id]').filter({ hasText: 'Company records packet: period 1' });
  await expect(packetRow).toContainText('Secured custody');
  await expect(packetRow.getByRole('button', { name: 'Locate Map' })).toBeVisible();
  await expect(packetRow.getByRole('button', { name: 'Plan Handling' })).toBeVisible();
});

test('spill cleanup reserves compatible physical inputs and leaves successor waste plus tool contamination', async ({ page }) => {
  await startRun(page);
  const created = await page.evaluate(() => {
    const spill = window.helixHeresyDebug.addInvestigativeTestResidue({
      typeKey: 'contaminatedResidue', amount: 2, tags: ['chemical', 'hazardous', 'contaminated']
    });
    const before = window.helixHeresyDebug.evidenceHandlingSnapshot();
    const task = window.helixHeresyDebug.queueInvestigativeTestCleanup(spill.id);
    const queued = window.helixHeresyDebug.evidenceHandlingSnapshot();
    return { spill, before, task, queued };
  });
  const order = created.queued.orders.find((entry) => entry.subject.id === created.spill.id && entry.action === 'clean');
  expect(created.task).not.toBeNull();
  expect(order).toMatchObject({ status: 'queued', method: 'scrape and seal' });
  expect(order.toolIds).toHaveLength(1);
  expect(order.receptacleIds.length).toBeGreaterThan(0);
  expect(order.route.length).toBeGreaterThan(0);
  expect(created.task.data.washStackId).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2 * 60 * 60));
  const result = await page.evaluate(() => window.helixHeresyDebug.evidenceHandlingSnapshot());
  const completed = result.orders.find((entry) => entry.id === order.id);
  expect(completed.status).toBe('completed');
  expect(completed.successorEvidenceIds.length).toBeGreaterThan(0);
  expect(result.cleanupTools.find((tool) => tool.id === order.toolIds[0]).contaminationLoad).toBeGreaterThan(
    created.before.cleanupTools.find((tool) => tool.id === order.toolIds[0]).contaminationLoad
  );
});

test('misleading package labels are workstation work that create a saved company contradiction', async ({ page }) => {
  await startRun(page);
  const created = await page.evaluate(() => {
    const offer = window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.commodityKind === 'manufactured');
    const stack = window.helixHeresyDebug.addBlackMarketManufacturedBatch(offer.id);
    const task = window.helixHeresyDebug.queueEvidenceHandling(stack.id, 'relabel');
    return { stack, task };
  });
  expect(created.task).not.toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(4 * 60 * 60));
  const result = await page.evaluate(() => ({
    handling: window.helixHeresyDebug.evidenceHandlingSnapshot(),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot(),
    company: window.helixHeresyDebug.companySnapshot(),
  }));
  expect(result.handling.orders.find((entry) => entry.subject.id === created.stack.id && entry.action === 'relabel')).toMatchObject({
    status: 'completed', method: 'misleading package label', workstationId: 'starter-surface-packaging'
  });
  expect(result.evidence.records.find((entry) => entry.subject.id === created.stack.id)).toMatchObject({ discoverability: { level: 'concealed' } });
  expect(result.company.company.variances).toContainEqual(expect.objectContaining({ kind: 'packageLabelMismatch', status: 'open' }));
});

test('concealment uses routed locked storage without erasing reports, cases, or provenance', async ({ page }) => {
  await startRun(page);
  const created = await page.evaluate(() => {
    const offer = window.helixHeresyDebug.economySnapshot().deals.find((deal) => deal.offerKind === 'contract' && deal.commodityKind === 'manufactured');
    const stack = window.helixHeresyDebug.addBlackMarketManufacturedBatch(offer.id);
    const before = window.helixHeresyDebug.evidenceHandlingSnapshot();
    const reason = window.helixHeresyDebug.evidenceHandlingBlockReason(stack.id, 'conceal');
    const task = window.helixHeresyDebug.queueEvidenceHandling(stack.id, 'conceal');
    return { stack, before, reason, task };
  });
  expect(created.reason).toBe('');
  expect(created.task).toMatchObject({ type: 'evidenceHandling', data: { action: 'conceal' } });

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(4 * 60 * 60));
  const result = await page.evaluate((stackId) => ({
    handling: window.helixHeresyDebug.evidenceHandlingSnapshot(),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot(),
    storage: window.helixHeresyDebug.physicalStockSnapshot(),
  }), created.stack.id);
  const order = result.handling.orders.find((entry) => entry.subject.id === created.stack.id && entry.action === 'conceal');
  const stack = result.handling.stacks.find((entry) => entry.id === created.stack.id);
  const evidence = result.evidence.records.find((entry) => entry.subject.id === created.stack.id);
  const fixture = result.storage.fixtures.find((entry) => entry.id === stack.fixtureId);
  expect(order).toMatchObject({ status: 'completed' });
  expect(order.route.length).toBeGreaterThan(1);
  expect(stack.fixtureId).toBeTruthy();
  expect(fixture.accessState).toBe('locked');
  expect(evidence).toMatchObject({ lifecycle: 'contained', discoverability: { level: 'concealed' } });
  expect(evidence.provenance.some((entry) => entry.action === 'conceal')).toBe(true);
  expect(result.handling.authorityReportCount).toBe(created.before.authorityReportCount);
  expect(result.handling.investigationCaseCount).toBe(created.before.investigationCaseCount);
});

test('licensed Loading Bay disposal externalizes material and leaves paid permanent custody records', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setMarketCash(500));
  const created = await page.evaluate(() => {
    const stack = window.helixHeresyDebug.addContainedEvidenceWasteForTest({ amount: 3 });
    const before = window.helixHeresyDebug.evidenceHandlingSnapshot();
    const money = window.helixHeresyDebug.economySnapshot().money;
    const task = window.helixHeresyDebug.queueEvidenceHandling(stack.id, 'dispose');
    return { stack, before, money, task };
  });
  expect(created.task).not.toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(4 * 60 * 60));
  const result = await page.evaluate(() => ({
    handling: window.helixHeresyDebug.evidenceHandlingSnapshot(),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot(),
    company: window.helixHeresyDebug.companySnapshot(),
    money: window.helixHeresyDebug.economySnapshot().money,
  }));
  const source = result.evidence.records.find((entry) => entry.subject.id === created.stack.id);
  const manifest = result.handling.manifests.at(-1);
  const manifestEvidence = result.evidence.records.find((entry) => entry.subject.id === manifest.stackId);
  expect(source.lifecycle).toBe('externalized');
  expect(source.refs.successorEvidenceIds).toContain(manifestEvidence.id);
  expect(manifest).toMatchObject({ subjectId: created.stack.id, service: 'Licensed hazardous-material carrier' });
  expect(manifestEvidence).toMatchObject({ type: 'licensedDisposalManifest', persistence: { kind: 'permanent' } });
  expect(result.company.company.records).toContainEqual(expect.objectContaining({ kind: 'licensedDisposal', lawful: true }));
  expect(result.money).toBe(created.money - manifest.fee);
  expect(result.handling.authorityReportCount).toBe(created.before.authorityReportCount);
  expect(result.handling.investigationCaseCount).toBe(created.before.investigationCaseCount);
});

test('compatible treatment transforms biological evidence into physical treated residue', async ({ page }) => {
  await startRun(page);
  const created = await page.evaluate(() => {
    const stack = window.helixHeresyDebug.addContainedEvidenceWasteForTest({
      label: 'Contained biological residue', amount: 2, tags: ['waste', 'biological', 'contaminated']
    });
    const task = window.helixHeresyDebug.queueEvidenceHandling(stack.id, 'treat');
    return { stack, task };
  });
  expect(created.task).not.toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(4 * 60 * 60));
  const result = await page.evaluate(() => ({
    handling: window.helixHeresyDebug.evidenceHandlingSnapshot(),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot(),
  }));
  const source = result.evidence.records.find((entry) => entry.subject.id === created.stack.id);
  const output = result.handling.stacks.find((stack) => stack.key === 'contaminatedResidue' && stack.tags.includes('treated'));
  expect(source.lifecycle).toBe('transformed');
  expect(output).toMatchObject({ section: 'residue', phase: 'sludge' });
  expect(output.tags).toContain('biological');
  expect(source.refs.successorEvidenceIds.length).toBeGreaterThan(0);
});

test('record amendments append without rewriting, while packet destruction creates fragments and missing-record evidence', async ({ page }) => {
  await startRun(page);
  const created = await page.evaluate(() => {
    const variance = window.helixHeresyDebug.addCompanyVarianceForHandlingTest({ supported: true });
    const before = window.helixHeresyDebug.companySnapshot();
    const task = window.helixHeresyDebug.queueCompanyRecordAmendment(variance.id);
    return { variance, before, task };
  });
  expect(created.task).not.toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(4 * 60 * 60));
  let result = await page.evaluate(() => ({
    handling: window.helixHeresyDebug.evidenceHandlingSnapshot(),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot(),
    company: window.helixHeresyDebug.companySnapshot(),
  }));
  expect(result.company.company.variances.find((entry) => entry.id === created.variance.id).status).toBe('resolved');
  expect(result.company.company.records.find((entry) => entry.id === created.variance.sourceId)).toEqual(expect.objectContaining({ id: created.variance.sourceId }));
  expect(result.company.company.records).toContainEqual(expect.objectContaining({ kind: 'recordAmendment' }));

  const packet = result.handling.packets.find((entry) => entry.periodId === result.company.company.activePeriodId);
  const destroyTask = await page.evaluate((stackId) => window.helixHeresyDebug.queueEvidenceHandling(stackId, 'destroy'), packet.stackId);
  expect(destroyTask).not.toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(4 * 60 * 60));
  result = await page.evaluate(() => ({
    handling: window.helixHeresyDebug.evidenceHandlingSnapshot(),
    evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot(),
  }));
  expect(result.handling.packets.find((entry) => entry.id === packet.id).status).toBe('destroyed');
  expect(result.handling.stacks).toContainEqual(expect.objectContaining({ key: 'shreddedRecords' }));
  expect(result.evidence.records).toContainEqual(expect.objectContaining({ type: 'missingCompanyRecords', persistence: expect.objectContaining({ kind: 'permanent' }) }));
});
