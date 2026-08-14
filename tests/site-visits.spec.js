// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');
const Visits = require('../site-visits.js');

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

test('visit state normalizes stable identities, agendas, requests, observations, and findings', () => {
  let state = Visits.seedInitialSchedule(Visits.defaultState(), { clock: 100 });
  expect(state.visits.map((visit) => visit.typeId)).toEqual([
    'routineCourier', 'registryAuditor', 'wasteCarrier', 'environmentalInspector'
  ]);
  const original = JSON.parse(JSON.stringify(state));
  state = Visits.normalizeState(original);
  expect(state).toEqual(original);

  let requested = Visits.ensureAccessRequest(state, 'site-visit-2', {
    targetKind: 'room', targetId: 'surfaceStaffOperations', label: 'Staff Operations', requestedAt: 200
  });
  let decided = Visits.decideAccess(requested.state, 'site-visit-2', requested.request.id, 'denied', 201);
  expect(decided.visit.requests[0]).toMatchObject({ decision: 'denied', obstructionRecorded: true });
  expect(decided.visit.obstructionIds).toEqual([`obstruction:${requested.request.id}`]);

  const observed = Visits.recordObservation(decided.state, 'site-visit-2', {
    evidenceId: 'evidence-9', agendaId: 'records', method: 'recordsReview', threshold: 30,
    progress: 30, clock: 240, label: 'Company packet', summary: 'Records conflict.', reliability: 'strong'
  });
  expect(observed.confirmed).toBe(true);
  expect(observed.observation).toMatchObject({ status: 'confirmed', progress: 30 });
  expect(observed.finding).toMatchObject({ label: 'Company packet', reliability: 'strong' });
  expect(Visits.normalizeState(observed.state).visits[1].findings).toEqual(observed.state.visits[1].findings);
});

test('Records exposes noticed arrival windows and persists the seeded schedule', async ({ page }) => {
  await startRun(page);
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('#visitsSummary')).toContainText('4 upcoming');
  await expect(page.locator('#visitsList')).toContainText('Commercial Registry auditor');
  await expect(page.locator('#visitsList')).toContainText('Environmental and public-health inspector');
  await expect(page.locator('#visitsList')).toContainText('Arrival window');

  const before = await page.evaluate(() => window.helixHeresyDebug.siteVisitsSnapshot());
  await page.reload();
  await page.locator('#loadLastSaveBtn').click();
  const after = await page.evaluate(() => window.helixHeresyDebug.siteVisitsSnapshot());
  expect(after.visits.map((visit) => ({ id: visit.id, typeId: visit.typeId, arrivalAt: visit.arrivalAt })))
    .toEqual(before.visits.map((visit) => ({ id: visit.id, typeId: visit.typeId, arrivalAt: visit.arrivalAt })));
});

test('a registry auditor walks a saved route, waits for real access, and reports locally reviewed records', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const visit = window.helixHeresyDebug.scheduleSiteVisit('registryAuditor');
    window.helixHeresyDebug.updateSiteVisits(60);
    window.helixHeresyDebug.updateSiteVisits(60);
    let snapshot = window.helixHeresyDebug.siteVisitsSnapshot();
    const active = snapshot.visits.find((entry) => entry.id === visit.id);
    window.helixHeresyDebug.grantSiteVisitMandate(active.id);
    window.helixHeresyDebug.updateSiteVisits(60);
    window.helixHeresyDebug.updateSiteVisits(60);
    const unlockTask = window.helixHeresyDebug.queueSiteVisitFixtureAccess(active.id, 'starter-surface-records-cabinet');
    window.helixHeresyDebug.advanceSimulation(60 * 60);
    const openTask = window.helixHeresyDebug.queueSiteVisitFixtureAccess(active.id, 'starter-surface-records-cabinet');
    window.helixHeresyDebug.advanceSimulation(60 * 60);
    for (let index = 0; index < 6; index += 1) window.helixHeresyDebug.updateSiteVisits(60);
    snapshot = window.helixHeresyDebug.siteVisitsSnapshot();
    return {
      visit: snapshot.visits.find((entry) => entry.id === visit.id),
      reports: window.helixHeresyDebug.externalDetectionSnapshot().reports,
      map: window.helixHeresyDebug.mapViewSnapshot(), unlockTask, openTask
    };
  });
  expect(result.visit.routeHistory.length).toBeGreaterThan(3);
  expect(result.unlockTask).toMatchObject({ type: 'visitFixtureAccess', data: { nextAccessState: 'closed' } });
  expect(result.openTask).toMatchObject({ type: 'visitFixtureAccess', data: { nextAccessState: 'open' } });
  expect(result.visit.agenda.filter((item) => item.status === 'completed').length).toBeGreaterThanOrEqual(1);
  expect(result.visit.findings).toContainEqual(expect.objectContaining({
    kind: 'recordsFinding', reliability: 'strong', reportId: expect.stringMatching(/^witness-report-/)
  }));
  expect(result.reports).toContainEqual(expect.objectContaining({
    institutionId: 'commercial-registry', reliability: 'strong', specificity: 'identityLinked'
  }));
});

test('denied in-mandate access records obstruction without inventing inaccessible contents', async ({ page }) => {
  await startRun(page);
  const result = await page.evaluate(() => {
    const visit = window.helixHeresyDebug.scheduleSiteVisit('environmentalInspector');
    window.helixHeresyDebug.updateSiteVisits(60);
    window.helixHeresyDebug.updateSiteVisits(60);
    let active = window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visit.id);
    const request = active.requests.find((entry) => entry.decision === 'pending');
    window.helixHeresyDebug.decideSiteVisitAccess(active.id, request.id, 'denied');
    active = window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visit.id);
    return {
      visit: active,
      evidence: window.helixHeresyDebug.investigativeEvidenceSnapshot().records,
      reports: window.helixHeresyDebug.externalDetectionSnapshot().reports
    };
  });
  expect(result.visit.obstructionIds).toHaveLength(1);
  expect(result.visit.findings).toHaveLength(0);
  expect(result.evidence).toContainEqual(expect.objectContaining({ type: 'inspectionObstruction', traits: expect.arrayContaining(['access denied']) }));
  expect(result.reports).toContainEqual(expect.objectContaining({ institutionId: 'environmental-health', reliability: 'strong' }));
});

test('the locked freight portal blocks a carrier until the saved door request is granted', async ({ page }) => {
  await startRun(page);
  const waiting = await page.evaluate(() => {
    const visit = window.helixHeresyDebug.scheduleSiteVisit('wasteCarrier');
    window.helixHeresyDebug.updateSiteVisits(5);
    return window.helixHeresyDebug.siteVisitsSnapshot().visits.find((entry) => entry.id === visit.id);
  });
  expect(waiting.phase).toBe('waiting');
  expect(waiting.requests).toContainEqual(expect.objectContaining({ targetKind: 'door', targetId: 'door-surface-loading', decision: 'pending' }));
  expect(waiting.routeHistory).toHaveLength(1);
});
