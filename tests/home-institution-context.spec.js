const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const Context = require('../home-institution-context');
const Cases = require('../investigation-cases');
const Responses = require('../institutional-responses');
const Visits = require('../site-visits');

const clone = value => JSON.parse(JSON.stringify(value));
const profile = () => ({ cityId: 'city-a', cityName: 'Aster', productionSources: [{ family: 'chemicalFeedstock' }],
  lawRules: [{ offenseId: 'corporateLicensing', label: 'Licensing', legalStatus: 'regulated' }],
  faiths: [{ name: 'Maker Chapter', prohibitions: ['fraudulent workmanship'] }], hiddenPriority: 'secret' });
const offices = () => Object.values(Context.ROLES).map(role => ({ role, id: role, capacityBand: 'functional', status: 'operational', workload: 0 }));
const context = () => Context.create(profile(), offices(), 0);
const registry = () => ({ id: 'report-1', evidenceId: 'evidence-1', sourceId: 'filing-system',
  institutionId: 'commercial-registry', reportedAt: 100, status: 'active', reliability: 'strong',
  specificity: 'identityLinked', significanceRank: 2, summary: 'Overdue filing', evidenceType: 'overdueCompanyFiling', channel: 'filing' });

test('world binding uses current home offices and private practice without mutating the canonical world or granting foreign powers', () => {
  const map = {
    cityGovernments: { governments: [{ cityId: 'city-a', roleAssignments: { centralAdministration: 'registry', civilWatch: 'watch' }, institutions: [
      { id: 'registry', capacityBand: 'strong' }, { id: 'watch', capacityBand: 'strong' }
    ] }] },
    strategicCivicHistory: { currentInstitutionRows: [{ institutionId: 'registry', currentCapacityBand: 'fragile', operationalStatus: 'strained' }] },
    strategicEnforcementPracticeHistory: {
      pipelineRows: [{ cityId: 'city-a', responsibleInstitutionId: 'watch', operationalState: 'suspended', exactWorkloadIndex: 8 }],
      practiceRows: [{ cityId: 'city-a', offenseId: 'corporateLicensing', actualPriority: 'critical' }, { cityId: 'foreign', offenseId: 'contrabandCommerce', actualPriority: 'critical' }]
    }
  };
  const before = clone(map), state = Context.fromWorld(profile(), map);
  expect(state.offices.registry.workSeconds).toBe(86400);
  expect(Context.permit(state, 'law-enforcement', 'check', 999999)).toBe(false);
  expect(Context.permit(state, 'environmental-health', 'missing', 999999)).toBe(false);
  expect(Context.priority(state, 'reporting-noncompliance')).toBe(1.5);
  expect(Context.priority(state, 'off-books-commerce')).toBe(1);
  expect(JSON.stringify(Context.publicView(state))).not.toMatch(/critical|fragile|suspended|priorities/);
  expect(map).toEqual(before);
  expect(Context.fromWorld({ cityId: 'foreign' }, map)).toBeNull();
});

test('office allocation is finite, shared across roles, deterministic and saved without changing world facts', () => {
  const source = offices(); source[1].id = source[0].id;
  const before = clone(source), world = profile();
  const state = Context.create(world, source);
  expect(Context.create(world, source)).toEqual(state);
  expect(Context.permit(state, 'commercial-registry', 'first', 0)).toBe(false);
  expect(Context.permit(state, 'environmental-health', 'second', 0)).toBe(false);
  const office = state.offices.centralAdministration;
  expect(office.jobs.second.readyAt).toBe(office.jobs.first.readyAt * 2);
  const saved = clone(state);
  for (let i = 0; i < 10; i++) Context.permit(state, 'commercial-registry', 'first', 0);
  expect(state).toEqual(saved);
  expect(Context.permit(saved, 'commercial-registry', 'first', office.jobs.first.readyAt)).toBe(true);
  expect(Context.permit(saved, 'environmental-health', 'second', office.jobs.first.readyAt)).toBe(false);
  expect(source).toEqual(before);
  expect(world).toEqual(profile());
});

test('damage, missing staff and existing workload restrict throughput rather than create officials', () => {
  const sources = offices(); sources[0].status = 'disrupted'; sources[1].workload = 8;
  const state = Context.create(profile(), sources);
  expect(Context.permit(state, 'commercial-registry', 'blocked', 999999)).toBe(false);
  expect(Context.permit(state, 'foreign-office', 'blocked', 999999)).toBe(false);
  expect(Object.keys(state.offices.centralAdministration.jobs)).toHaveLength(0);
  expect(Context.reserve(state, 'environmental-health', 'busy', 0)).toBe(18 * 3600);
  expect(Context.reserve(context(), 'environmental-health', 'normal', 0)).toBe(6 * 3600);
  expect(Context.permit(null, 'commercial-registry', 'legacy', 0)).toBe(true);
});

test('public plausibility and doctrine omit private capacity, never declare crime and require records for explanations', () => {
  const state = context(); Context.permit(state, 'law-enforcement', 'secret-case', 0);
  const view = Context.publicView(state);
  expect(view.plausibility).toContain('fits');
  expect(view.faiths[0].prohibitions).toEqual(['fraudulent workmanship']);
  expect(JSON.stringify(view)).not.toMatch(/jobs|workSeconds|reservedUntil|hiddenPriority|secret-case|available/);
  state.publicContext.resources = ['ferrousOre'];
  expect(Context.publicView(state).plausibility).toContain('not a violation');
  expect(Context.publicView(state, { periods: [{ status: 'filed' }], records: [{ kind: 'production', lawful: true }] }).documentation).toContain('must still receive and verify');
  expect(Context.publicView(state, { periods: [{ status: 'filed' }], records: [{ kind: 'production', lawful: false }] }).documentation).not.toContain('provide a business explanation');
});

test('familiar local processing changes review time, never invents reports or strengthens evidence', () => {
  const state = context(), signal = registry();
  let clock = 100;
  const permitWork = (institution, job, theory) => Context.permit(state, institution, job, clock, Context.priority(state, theory));
  expect(Cases.update(Cases.defaultState(), { clock, reports: [], permitWork }).state.cases).toEqual([]);
  let result = Cases.update(Cases.defaultState(), { clock, reports: [signal], permitWork });
  expect(result.state.cases).toHaveLength(0);
  const ready = state.offices.centralAdministration.jobs['intake:case-intake-1:0'].readyAt;
  clock = ready;
  result = Cases.update(result.state, { clock, reports: [signal], permitWork });
  const baseline = Cases.update(Cases.defaultState(), { clock, reports: [signal] });
  expect(result.state.cases[0].strength).toEqual(baseline.state.cases[0].strength);
  expect(result.state.cases[0].authorityEvidence).toEqual(baseline.state.cases[0].authorityEvidence);
  expect(Context.priority(state, 'site-discharge')).toBe(2);
  expect(Context.priority(state, 'reporting-noncompliance')).toBe(1);
  const weak = { ...signal, reliability: 'weak', specificity: 'generic', significanceRank: 0 };
  let unsupported = Cases.update(Cases.defaultState(), { clock, reports: [weak] });
  unsupported = Cases.update(unsupported.state, { clock: clock + 100000, reports: [weak], permitWork: () => true });
  expect(unsupported.state.cases).toHaveLength(0);
});

test('institutional delay neither misses a lead deadline nor starts a player response clock', () => {
  const signal = registry();
  let result = Cases.update(Cases.defaultState(), { clock: 100, reports: [signal] });
  const due = Math.max(...result.state.cases[0].leads.map(row => row.dueAt));
  result = Cases.update(result.state, { clock: due + 50000, reports: [signal], permitWork: () => false });
  expect(result.state.cases[0].leads.every(row => row.status === 'open')).toBe(true);
  expect(result.state.cases[0].deadlines.every(row => row.status === 'pending')).toBe(true);
  const cases = result.state.cases;
  let responses = Responses.update(Responses.defaultState(), { clock: due, cases, permitWork: () => false });
  expect(responses.state.demands).toHaveLength(0);
  responses = Responses.update(responses.state, { clock: due + 50000, cases, permitWork: () => true });
  const demand = responses.state.demands[0];
  expect(demand.dueAt).toBeGreaterThan(due + 50000);
  responses = Responses.update(responses.state, { clock: demand.dueAt + 1, cases, permitWork: () => false });
  expect(responses.evaluatedResponseIds).toHaveLength(1); // Issued deadlines remain binding.
});

test('new routine inspectors need office capacity; ordinary deliveries and issued notices are unchanged on reload', () => {
  const state = context(); state.offices.publicWorksAndProvisioning.available = false;
  const schedule = Visits.seedInitialSchedule(Visits.defaultState(), { clock: 0 });
  const ordinary = clone(schedule.visits.filter(row => ['routineCourier', 'wasteCarrier'].includes(row.typeId)));
  const original = schedule.visits.find(row => row.typeId === 'registryAuditor').arrivalAt;
  schedule.visits = Context.initialInspections(state, schedule.visits, 0);
  expect(schedule.visits.some(row => row.typeId === 'environmentalInspector')).toBe(false);
  expect(schedule.visits.find(row => row.typeId === 'registryAuditor').arrivalAt).toBe(original + 21600);
  expect(schedule.visits.filter(row => ['routineCourier', 'wasteCarrier'].includes(row.typeId))).toEqual(ordinary);
  expect(Context.initialInspections(clone(state), clone(schedule.visits), 100)).toEqual(schedule.visits);
});

test('Company context UI and queued work survive save normalization without exposing private office state', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setStrategicServiceTestNetwork({
    homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [],
    destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'city-a', label: 'Test laboratory', cellId: 'cell:1', known: true, reachable: true, localDistanceKm: 8, routeContinuity: 'municipal', dangerBand: 'low' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'city-a', label: 'Aster', cellId: 'cell:1', known: true, reachable: true }
    ]
  }));
  const savedContext = context(); Context.permit(savedContext, 'law-enforcement', 'hidden-case-work', 0);
  await page.evaluate(value => {
    const debug = window.helixHeresyDebug, saved = debug.exportSurveyExpeditionTestState();
    saved.company.homeInstitutionContext = value;
    debug.importSurveyExpeditionTestState(saved);
    debug.setCompanyOperatingState('limited');
  }, savedContext);
  await page.keyboard.press('B');
  await page.locator('[data-economy-menu-tab="company"]').click();
  const panel = page.locator('[data-economy-category="homeInstitutionContext"]');
  await expect(panel).toContainText('Aster');
  await expect(panel).toContainText('Maker Chapter');
  await expect(panel).toContainText('not automatically city law');
  await expect(panel).not.toContainText('hidden-case-work');
  await expect(panel).not.toContainText('21600');
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect(await page.evaluate(() => window.helixHeresyDebug.companySnapshot().company.homeInstitutionContext)).toEqual(savedContext);
  const queued = await page.evaluate(() => {
    const debug = window.helixHeresyDebug;
    const evidence = debug.investigativeEvidenceSnapshot().records.find(row => row.type === 'incompleteInheritedBooks');
    debug.registerExternalDetectionOpportunity(evidence.id, {
      opportunityKey: 'home-office-test', sourceId: 'filing-system', institutionId: 'commercial-registry', channel: 'filing',
      observed: true, willReport: true, reportDelaySeconds: 0, reliability: 'strong', specificity: 'identityLinked', knowledge: 'known', summary: 'an attributable filing gap'
    });
    debug.updateInvestigationCases();
    return debug.exportSurveyExpeditionTestState();
  });
  expect(queued.investigations.cases).toHaveLength(0);
  const jobs = Object.values(queued.company.homeInstitutionContext.offices.centralAdministration.jobs);
  expect(jobs).toHaveLength(1);
  queued.clock = jobs[0].readyAt;
  await page.evaluate(saved => {
    const debug = window.helixHeresyDebug;
    debug.importSurveyExpeditionTestState(saved);
    debug.updateInvestigationCases();
  }, queued);
  const processed = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(processed.investigations.cases).toHaveLength(1);
  expect(processed.institutionalResponses.demands).toHaveLength(0); // Demand preparation is a separate office allocation.
});
