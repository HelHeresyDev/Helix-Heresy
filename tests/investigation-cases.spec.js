// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Cases = require('../investigation-cases.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

function report(overrides = {}) {
  return {
    id: 'report-1', evidenceId: 'evidence-1', exposureId: 'exposure-1', sourceId: 'nearby-observer',
    institutionId: 'environmental-health', reportedAt: 100, status: 'active', reliability: 'credible',
    specificity: 'siteLinked', significanceRank: 2, summary: 'an exterior discharge anomaly',
    evidenceType: 'exteriorExhaustTrace', channel: 'exhaust', ...overrides
  };
}

async function startRun(page) {
  await page.goto(appUrl);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' }));
  });
  await page.reload();
  await page.locator('#startRunSubmitBtn').click();
}

test('a lone weak signal completes intake without opening a case', () => {
  const weak = report({ reliability: 'weak', specificity: 'generic', significanceRank: 1 });
  let result = Cases.update(Cases.defaultState(), { seed: 'intake', clock: weak.reportedAt, reports: [weak], correlations: [] });
  expect(result.state.cases).toHaveLength(0);
  expect(result.state.intakes).toHaveLength(1);
  expect(result.state.intakes[0].status).toBe('pending');
  result = Cases.update(result.state, {
    seed: 'intake', clock: result.state.intakes[0].reviewAt, reports: [weak], correlations: []
  });
  expect(result.state.cases).toHaveLength(0);
  expect(result.state.intakes[0].status).toBe('insufficient');
});

test('an attributable registry report opens one disclosed merged case with bounded leads', () => {
  const registry = report({
    id: 'registry-report', institutionId: 'commercial-registry', sourceId: 'filing-system',
    reliability: 'strong', specificity: 'identityLinked', significanceRank: 2,
    evidenceType: 'overdueCompanyFiling', channel: 'filing', summary: 'the overdue filing for a registered company'
  });
  let result = Cases.update(Cases.defaultState(), { seed: 'registry', clock: 100, reports: [registry], correlations: [] });
  expect(result.openedCaseIds).toHaveLength(1);
  expect(result.disclosedCaseIds).toHaveLength(1);
  expect(result.state.cases).toHaveLength(1);
  expect(result.state.cases[0]).toMatchObject({
    docket: 'CR-0001', institutionId: 'commercial-registry', theoryId: 'reporting-noncompliance',
    status: 'open', escalationStage: 'inquiry', strength: { bandId: 'supported' },
    disclosure: { state: 'disclosed', strengthDisclosed: false }
  });
  expect(result.state.cases[0].leads).toHaveLength(2);
  expect(result.state.cases[0].deadlines).toHaveLength(2);
  expect(result.state.cases[0].contactHistory).toHaveLength(1);

  result = Cases.update(result.state, { seed: 'changed-seed', clock: 200, reports: [registry], correlations: [] });
  expect(result.state.cases).toHaveLength(1);
  expect(result.state.intakes).toHaveLength(1);
  expect(result.state.cases[0].docket).toBe('CR-0001');
});

test('correlated environmental reports open a disclosed case without inventing a broader theory', () => {
  const first = report({ id: 'report-a', evidenceId: 'evidence-a' });
  const second = report({ id: 'report-b', evidenceId: 'evidence-b', sourceId: 'environmental-monitor', reportedAt: 200 });
  const correlation = { id: 'correlation-1', institutionId: 'environmental-health', reportIds: ['report-a', 'report-b'], createdAt: 200, status: 'active' };
  let result = Cases.update(Cases.defaultState(), { seed: 'environment', clock: 200, reports: [first, second], correlations: [correlation] });
  const reviewAt = result.state.intakes[0].reviewAt;
  result = Cases.update(result.state, { seed: 'environment', clock: reviewAt, reports: [first, second], correlations: [correlation] });
  expect(result.state.cases[0]).toMatchObject({
    theoryId: 'site-discharge', theoryLabel: 'Unusual site discharge', escalationStage: 'formal',
    strength: { bandId: 'corroborated' }, disclosure: { state: 'disclosed' }
  });
  expect(result.state.cases[0].theoryLabel).not.toMatch(/slime|laboratory/i);
});

test('lead review deadlines resolve or stall deterministically and persist their history', () => {
  const registry = report({
    id: 'registry-report', institutionId: 'commercial-registry', sourceId: 'filing-system',
    reliability: 'strong', specificity: 'identityLinked', significanceRank: 2,
    evidenceType: 'overdueCompanyFiling', channel: 'filing'
  });
  let result = Cases.update(Cases.defaultState(), { seed: 'deadlines', clock: 100, reports: [registry], correlations: [] });
  const dueAt = Math.max(...result.state.cases[0].leads.map((lead) => lead.dueAt));
  result = Cases.update(result.state, { seed: 'deadlines', clock: dueAt, reports: [registry], correlations: [] });
  const authorityCase = result.state.cases[0];
  expect(authorityCase.leads.find((lead) => lead.kind === 'verifyFilingHistory').status).toBe('resolved');
  expect(authorityCase.leads.find((lead) => lead.kind === 'compareDeclaredRecords').status).toBe('stalled');
  expect(authorityCase.deadlines.map((deadline) => deadline.status).sort()).toEqual(['met', 'missed']);
  expect(authorityCase.deadlines.every((deadline) => deadline.history.length === 2)).toBe(true);
  expect(Cases.normalizeState(JSON.parse(JSON.stringify(result.state)))).toEqual(result.state);

  const laterReport = report({
    id: 'registry-report-2', evidenceId: 'evidence-2', institutionId: 'commercial-registry', sourceId: 'filing-system',
    reportedAt: dueAt + 1, reliability: 'credible', specificity: 'identityLinked', significanceRank: 2,
    evidenceType: 'overdueCompanyFiling', channel: 'filing'
  });
  result = Cases.update(result.state, { seed: 'deadlines', clock: dueAt + 1, reports: [registry, laterReport], correlations: [] });
  expect(result.state.cases[0].leads.find((lead) => lead.kind === 'compareDeclaredRecords').status).toBe('resolved');
  expect(result.state.cases[0].deadlines.find((deadline) => deadline.status === 'missed')).toBeTruthy();
});

test('disclosed cases show only stated claims and contacts and persist through save loading', async ({ page }) => {
  await startRun(page);
  const docket = await page.evaluate(() => {
    const evidence = window.helixHeresyDebug.investigativeEvidenceSnapshot().records.find((entry) => entry.type === 'incompleteInheritedBooks');
    window.helixHeresyDebug.registerExternalDetectionOpportunity(evidence.id, {
      opportunityKey: 'registry-case-test', sourceId: 'filing-system', institutionId: 'commercial-registry', channel: 'filing',
      observed: true, willReport: true, reportDelaySeconds: 0, reliability: 'strong', specificity: 'identityLinked',
      knowledge: 'known', summary: 'an attributable gap in required company records'
    });
    window.helixHeresyDebug.updateInvestigationCases();
    return window.helixHeresyDebug.investigationCasesSnapshot().visibleCases[0].docket;
  });
  expect(docket).toBe('CR-0001');
  await page.locator('[data-workspace-tab="evidence"]').click();
  const section = page.locator('[data-investigation-cases]');
  await expect(section).toContainText('CR-0001');
  await expect(section).toContainText('Commercial Registry');
  await expect(section).toContainText('No response has been requested');
  await expect(section).not.toContainText('Supported');
  await expect(section).not.toContainText('Verify the company');
  await expect(section).not.toContainText('case-lead-');

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.investigationCasesSnapshot());
  expect(reloaded.visibleCases[0].docket).toBe(docket);
});

test('an undisclosed law-enforcement case adds pressure without leaking a case card', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const evidence = window.helixHeresyDebug.investigativeEvidenceSnapshot().records.find((entry) => entry.type === 'incompleteInheritedBooks');
    window.helixHeresyDebug.registerExternalDetectionOpportunity(evidence.id, {
      opportunityKey: 'hidden-law-case-test', sourceId: 'criminal-informant', institutionId: 'law-enforcement', channel: 'covertHandoff',
      observed: true, willReport: true, reportDelaySeconds: 0, reliability: 'strong', specificity: 'identityLinked',
      knowledge: 'hidden', summary: 'suspected off-books activity attributed to the site'
    });
    window.helixHeresyDebug.updateInvestigationCases();
    window.helixHeresyDebug.advanceSimulation(13 * 3600);
    return window.helixHeresyDebug.investigationCasesSnapshot();
  });
  expect(result.cases).toHaveLength(1);
  expect(result.cases[0]).toMatchObject({ institutionId: 'law-enforcement', theoryId: 'off-books-commerce', disclosure: { state: 'hidden' } });
  expect(result.visibleCases).toHaveLength(0);
  expect(result.casePressure).toBeGreaterThan(0);

  await page.locator('[data-workspace-tab="evidence"]').click();
  await expect(page.locator('[data-investigation-cases]')).toContainText('No authority investigation has been disclosed');
  await expect(page.locator('[data-investigation-cases]')).not.toContainText(result.cases[0].docket);
  await expect(page.locator('[data-investigation-cases]')).not.toContainText('Off-books commercial activity');
});
