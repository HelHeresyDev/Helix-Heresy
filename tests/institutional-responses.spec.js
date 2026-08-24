// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Responses = require('../institutional-responses.js');

const projectRoot = path.resolve(__dirname, '..');
const appUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;

function authorityCase(overrides = {}) {
  return {
    id: 'authority-case-1', docket: 'CR-0001', institutionId: 'commercial-registry',
    theoryId: 'reporting-noncompliance', status: 'open', escalationStage: 'inquiry',
    strength: { bandId: 'supported' },
    disclosure: { state: 'disclosed', knownEvidenceLinkIds: ['authority-evidence-1'] },
    authorityEvidence: [{
      id: 'authority-evidence-1', evidenceId: 'evidence-1', reliability: 'strong',
      specificity: 'identityLinked', significanceRank: 2, summary: 'an attributable filing gap'
    }],
    ...overrides
  };
}

function citation(id, tags) {
  return { id, sourceKind: 'companyRecord', sourceId: id, label: `Record ${id}`, at: 100, tags };
}

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

async function discloseRegistryCase(page) {
  return page.evaluate(() => {
    const evidence = window.helixHeresyDebug.investigativeEvidenceSnapshot().records
      .find((entry) => entry.type === 'incompleteInheritedBooks');
    window.helixHeresyDebug.registerExternalDetectionOpportunity(evidence.id, {
      opportunityKey: 'institutional-response-case', sourceId: 'filing-system',
      institutionId: 'commercial-registry', channel: 'filing', observed: true,
      willReport: true, reportDelaySeconds: 0, reliability: 'strong',
      specificity: 'identityLinked', knowledge: 'known',
      summary: 'an attributable gap in required company records'
    });
    window.helixHeresyDebug.updateInvestigationCases();
    return window.helixHeresyDebug.institutionalResponsesSnapshot().demands[0];
  });
}

test('disclosed cases receive deterministic saved demands with stable deadlines', () => {
  const currentCase = authorityCase();
  const first = Responses.update(Responses.defaultState(), { seed: 'world', clock: 100, cases: [currentCase] });
  const second = Responses.update(Responses.defaultState(), { seed: 'world', clock: 100, cases: [currentCase] });
  expect(first.createdDemandIds).toHaveLength(1);
  expect(first.state.demands[0]).toMatchObject({
    caseId: currentCase.id, family: 'companyRecords', status: 'pending', sequence: 1
  });
  expect(first.state.demands[0].dueAt).toBe(second.state.demands[0].dueAt);
  expect(Responses.normalizeState(JSON.parse(JSON.stringify(first.state)))).toEqual(first.state);
  expect(Responses.nextEvent(first.state, 100)).toMatchObject({
    time: first.state.demands[0].dueAt, type: 'institutionDemand'
  });
});

test('cited records can support an immutable accepted response', () => {
  const currentCase = authorityCase();
  let state = Responses.update(Responses.defaultState(), { seed: 'accepted', clock: 100, cases: [currentCase] }).state;
  const demand = state.demands[0];
  const citations = [citation('record-a', ['records', 'filing']), citation('record-b', ['identity', 'registration'])];
  const prepared = Responses.prepareResponse(state, {
    demandId: demand.id, claimId: 'documentedCompliance', citationIds: citations.map((entry) => entry.id),
    citations, playerNote: 'These are the retained books.', clock: 200
  });
  state = prepared.state;
  const submitted = Responses.submitResponse(state, prepared.response.id, { clock: 300, cases: [currentCase] });
  expect(submitted.response).toMatchObject({
    status: 'submitted', immutable: true,
    evaluation: { outcome: 'accepted', supportBand: 'substantial', contradictionBand: 'none' }
  });
  expect(submitted.action).toMatchObject({ kind: 'acceptance', status: 'completed' });
  expect(submitted.response.playerNote).toBe('These are the retained books.');
});

test('denials are contradicted only by evidence the institution actually knows', () => {
  const knownCase = authorityCase();
  let state = Responses.update(Responses.defaultState(), { seed: 'denial', clock: 100, cases: [knownCase] }).state;
  let prepared = Responses.prepareResponse(state, {
    demandId: state.demands[0].id, claimId: 'denyResponsibility', clock: 200, citations: []
  });
  let submitted = Responses.submitResponse(prepared.state, prepared.response.id, { clock: 300, cases: [knownCase] });
  expect(submitted.response.evaluation).toMatchObject({ outcome: 'contradicted', contradictionBand: 'material' });
  expect(submitted.response.evaluation.publicReasons.join(' ')).not.toContain('an attributable filing gap');

  const noEvidenceCase = authorityCase({ authorityEvidence: [], disclosure: { state: 'disclosed', knownEvidenceLinkIds: [] } });
  state = Responses.update(Responses.defaultState(), { seed: 'denial-clear', clock: 100, cases: [noEvidenceCase] }).state;
  prepared = Responses.prepareResponse(state, {
    demandId: state.demands[0].id, claimId: 'denyResponsibility', clock: 200, citations: []
  });
  submitted = Responses.submitResponse(prepared.state, prepared.response.id, { clock: 300, cases: [noEvidenceCase] });
  expect(submitted.response.evaluation).toMatchObject({ outcome: 'provisional', contradictionBand: 'none' });
});

test('missed demands and unpaid fines escalate without rerolling on normalization', () => {
  const currentCase = authorityCase({ strength: { bandId: 'corroborated' } });
  let state = Responses.update(Responses.defaultState(), { seed: 'escalate', clock: 100, cases: [currentCase] }).state;
  let prepared = Responses.prepareResponse(state, {
    demandId: state.demands[0].id, claimId: 'limitedDisclosure', clock: 200, citations: []
  });
  let submitted = Responses.submitResponse(prepared.state, prepared.response.id, { clock: 300, cases: [currentCase] });
  expect(submitted.action).toMatchObject({ kind: 'fine', status: 'active' });
  const fine = submitted.action;
  const advanced = Responses.update(submitted.state, { seed: 'changed', clock: fine.dueAt, cases: [currentCase] });
  expect(advanced.state.actions.find((entry) => entry.id === fine.id).status).toBe('overdue');
  expect(advanced.state.actions).toContainEqual(expect.objectContaining({ kind: 'operatingRestriction', status: 'active', restrictionId: 'noFullOperation' }));
  expect(Responses.normalizeState(JSON.parse(JSON.stringify(advanced.state)))).toEqual(advanced.state);

  state = Responses.update(Responses.defaultState(), { seed: 'missed', clock: 100, cases: [authorityCase()] }).state;
  const missed = Responses.update(state, { seed: 'missed', clock: state.demands[0].dueAt, cases: [authorityCase()] });
  expect(missed.state.responses[0]).toMatchObject({ status: 'missed', immutable: true, evaluation: { outcome: 'missed' } });
  expect(missed.state.actions[0].kind).toBe('operatingRestriction');
});

test('compelling contradictions issue warrants and later evidence reopens accepted explanations', () => {
  const compelling = authorityCase({ strength: { bandId: 'compelling' } });
  let state = Responses.update(Responses.defaultState(), { seed: 'warrant', clock: 100, cases: [compelling] }).state;
  let prepared = Responses.prepareResponse(state, {
    demandId: state.demands[0].id, claimId: 'denyResponsibility', clock: 200, citations: []
  });
  let submitted = Responses.submitResponse(prepared.state, prepared.response.id, { clock: 300, cases: [compelling] });
  expect(submitted.action).toMatchObject({ kind: 'warrant', status: 'issued' });
  expect(Responses.actionPressure(submitted.state)).toBeGreaterThan(0);

  const initialCase = authorityCase();
  state = Responses.update(Responses.defaultState(), { seed: 'new-evidence', clock: 100, cases: [initialCase] }).state;
  const citations = [citation('record-a', ['records', 'filing']), citation('record-b', ['identity', 'registration'])];
  prepared = Responses.prepareResponse(state, {
    demandId: state.demands[0].id, claimId: 'documentedCompliance', citationIds: citations.map((entry) => entry.id),
    citations, clock: 200
  });
  submitted = Responses.submitResponse(prepared.state, prepared.response.id, { clock: 300, cases: [initialCase] });
  expect(submitted.response.evaluation.outcome).toBe('accepted');
  const expandedCase = authorityCase({
    authorityEvidence: [
      ...initialCase.authorityEvidence,
      { id: 'authority-evidence-2', evidenceId: 'evidence-2', reliability: 'credible', specificity: 'identityLinked', significanceRank: 2 }
    ]
  });
  const reopened = Responses.update(submitted.state, { seed: 'new-evidence', clock: 400, cases: [expandedCase] });
  expect(reopened.createdDemandIds).toHaveLength(1);
  expect(reopened.state.demands.at(-1)).toMatchObject({ sequence: 2, status: 'pending', priorResponseIds: [submitted.response.id] });
});

test('unresolved corrective orders schedule follow-up inspection actions', () => {
  const preliminary = authorityCase({ strength: { bandId: 'preliminary' } });
  let state = Responses.update(Responses.defaultState(), { seed: 'inspection', clock: 100, cases: [preliminary] }).state;
  const prepared = Responses.prepareResponse(state, {
    demandId: state.demands[0].id, claimId: 'limitedDisclosure', clock: 200, citations: []
  });
  const submitted = Responses.submitResponse(prepared.state, prepared.response.id, { clock: 300, cases: [preliminary] });
  expect(submitted.action).toMatchObject({ kind: 'correctiveOrder', status: 'active' });
  const advanced = Responses.update(submitted.state, {
    seed: 'inspection', clock: submitted.action.dueAt, cases: [preliminary]
  });
  expect(advanced.state.actions.find((entry) => entry.id === submitted.action.id).status).toBe('overdue');
  expect(advanced.state.actions).toContainEqual(expect.objectContaining({
    kind: 'followUpInspection', status: 'active', visitTypeId: 'registryAuditor'
  }));
});

test('@smoke response packets use physical Staff Operations work and survive save loading', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => {
    window.helixHeresyDebug.setCompanyOperatingState('limited');
    window.helixHeresyDebug.setCompanyOperatingState('renovation');
  });
  const demand = await discloseRegistryCase(page);
  expect(demand).toMatchObject({ family: 'companyRecords', status: 'pending' });

  await page.locator('[data-workspace-tab="evidence"]').click();
  const demandRow = page.locator(`[data-institutional-demand="${demand.id}"]`);
  await expect(demandRow).toContainText('Required company records');
  const form = demandRow.locator(`[data-institutional-response-form="${demand.id}"]`);
  await form.locator('[data-institutional-claim]').selectOption('documentedCompliance');
  const citations = form.locator('[data-institutional-citation]');
  expect(await citations.count()).toBeGreaterThanOrEqual(2);
  await citations.nth(0).check();
  await citations.nth(1).check();
  await form.locator('[data-institutional-note]').fill('A role-play note that is retained but not parsed.');
  await form.getByRole('button', { name: 'Queue Response Packet' }).click();

  const preparing = await page.evaluate(() => window.helixHeresyDebug.institutionalResponsesSnapshot());
  expect(preparing.responses[0]).toMatchObject({ status: 'preparing', claimId: 'documentedCompliance' });
  const queued = await page.evaluate(() => window.helixHeresyDebug.taskStatusSnapshot().find((entry) => entry.type === 'institutionalResponse'));
  expect(queued).toMatchObject({ data: { responseId: preparing.responses[0].id, toRoomId: 'surfaceStaffOperations' } });

  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2 * 60 * 60));
  const submitted = await page.evaluate(() => ({
    responses: window.helixHeresyDebug.institutionalResponsesSnapshot(),
    company: window.helixHeresyDebug.companySnapshot().company
  }));
  expect(submitted.responses.responses[0]).toMatchObject({
    status: 'submitted', immutable: true, evaluation: { outcome: 'accepted', supportBand: 'substantial' }
  });
  expect(submitted.responses.actions[0]).toMatchObject({ kind: 'acceptance', status: 'completed' });
  expect(submitted.company.records).toContainEqual(expect.objectContaining({ kind: 'institutionalResponse' }));

  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const reloaded = await page.evaluate(() => window.helixHeresyDebug.institutionalResponsesSnapshot());
  expect(reloaded.responses[0]).toMatchObject({ status: 'submitted', immutable: true });
});

test('a contradicted denial enforces Limited Operations without exposing hidden evidence text', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.helixHeresyDebug.setCompanyOperatingState('open'));
  const demand = await discloseRegistryCase(page);
  const task = await page.evaluate((demandId) => window.helixHeresyDebug.queueInstitutionalResponse(
    demandId, 'denyResponsibility', [], 'The company denies responsibility.'
  ), demand.id);
  expect(task).toBeTruthy();
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2 * 60 * 60));
  const result = await page.evaluate(() => ({
    responseState: window.helixHeresyDebug.institutionalResponsesSnapshot(),
    company: window.helixHeresyDebug.companySnapshot().company
  }));
  expect(result.responseState.responses[0].evaluation).toMatchObject({ outcome: 'contradicted', contradictionBand: 'material' });
  expect(result.responseState.actions[0]).toMatchObject({ kind: 'operatingRestriction', status: 'active' });
  expect(result.company.operatingState).toBe('limited');
  expect(result.responseState.responses[0].evaluation.publicReasons.join(' ')).not.toContain('attributable gap');
});
