const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(360000);
const atlas = page => page.evaluate(() => window.helixHeresyDebug.expansionAtlasSnapshot());
const map = page => page.evaluate(() => window.helixHeresyDebug.municipalMapSnapshot());
const act = (page, action, id, purpose) => page.evaluate(({ action, id, purpose }) => window.helixHeresyDebug.expansionAtlasAction(action, id, purpose), { action, id, purpose });
async function visits(page) {
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await visits(page); }
async function effects(page) {
  return page.evaluate(() => {
    const s = window.helixHeresyDebug.exportSurveyExpeditionTestState();
    return { clock: s.clock, scientist: s.scientist, money: s.economy.money, stacks: s.physicalItemStacks, tasks: s.tasks,
      survey: s.surveyExpeditions, claims: s.citySuccession, conditions: s.runStrategicConditions, campaign: s.campaign };
  });
}
test('Canvas real acquired map, dated personal knowledge, free objective and existing local focus survive real reload without revealing pending/private sources', async ({ page }) => {
  page.setDefaultTimeout(15000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, 'atlas-canvas');
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await page.evaluate(() => {
    const d = window.helixHeresyDebug; d.setMapRenderer('canvas');
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } },
      { id: 'city:hidden', kind: 'fortifiedCity', cityId: 'hidden', label: 'SECRET_UNDISCOVERED_CITY', known: false }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'atlas', publicProspects: {}, truth: { secret: 'SECRET_RESERVES' } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    if (!d.municipalMapAction('walk')) throw new Error('Actual counter walk refused');
    for (let i = 0; i < 30; i++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return;
      d.advanceBoundaryTravelForTest(Math.max(1, t.dueAt - s.clock + 1));
    }
    throw new Error('Walk unfinished');
  });
  await visits(page); const before = await map(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapAction('request', 'groundPlan'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(300));
  let m = await map(page); expect(m.service.job).not.toBeNull(); expect(m.money).toBe(before.money - 25);
  expect((await atlas(page)).entries.flatMap(e => e.facts).some(f => f.id.endsWith(':copy'))).toBe(false);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.sovereignBargains.source.archive.privateMarker = 'SECRET_WITHHELD_ARCHIVE';
    s.surveyExpeditions.mapService.archive.privateMarker = 'SECRET_UNRELEASED_PLAN';
    s.surveyExpeditions.mapService.job.contents.privateMarker = 'SECRET_PENDING_JOB';
    d.importSurveyExpeditionTestState(s);
    if (!d.expansionAtlasAction('select', 'survey:a', 'investigate')) throw new Error('Known-site planning/save refused');
  });
  expect(JSON.stringify(await atlas(page))).not.toMatch(/SECRET_/);
  const partial = (await map(page)).service.job;
  await reload(page); expect((await map(page)).service.job).toEqual(partial);
  expect(JSON.stringify(await atlas(page))).not.toMatch(/SECRET_/);
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapAction('cancel'))).toBe(true);
  expect((await atlas(page)).entries.flatMap(e => e.facts).some(f => f.id.endsWith(':copy'))).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapAction('request', 'groundPlan'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(600));
  m = await map(page); expect(m.service.copies).toHaveLength(1); const copy = m.service.copies[0];
  const entry = (await atlas(page)).entries.find(e => e.id === 'survey:a');
  expect(entry.globeCellId).toBe('planet-cell:00001');
  expect(entry.facts.find(f => f.id === copy.id)).toMatchObject({ sourceAt: null, receivedAt: copy.issuedAt });
  expect(entry.facts.some(f => f.category === 'terrain')).toBe(true);
  const card = page.locator('[data-atlas-site="survey:a"]'); await card.locator('summary').click();
  await expect(card).toContainText('source date unknown');
  const original = await effects(page);
  await card.getByRole('button', { name: 'Investigate this place', exact: true }).click();
  expect((await atlas(page)).objective).toMatchObject({ siteId: 'survey:a', purpose: 'investigate' });
  expect(await effects(page)).toEqual(original); expect(await act(page, 'select', 'undiscovered', 'revisit')).toBe(false);
  expect(await act(page, 'focus', 'city:a')).toBe(false); expect(await act(page, 'travel', 'survey:a')).toBe(true);
  expect(await effects(page)).toEqual(original);
  await card.locator('summary').click();
  await card.getByRole('button', { name: 'Focus known local landmark', exact: true }).click();
  await expect(page.locator('[data-workspace-tab="map"]')).toHaveAttribute('aria-current', 'page');
  expect(await effects(page)).toEqual(original); await visits(page);
  const saved = await atlas(page); await reload(page); expect(await atlas(page)).toEqual(saved);
  expect(await act(page, 'clear')).toBe(true); expect((await atlas(page)).objective).toBeNull();
  expect(JSON.stringify(await atlas(page))).not.toMatch(/SECRET_/);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(errors).toEqual([]);
});
test('DOM actual adjoining exploration, received stale operational/resource accounts, death and independent same-world restart keep their knowledge boundaries', async ({ page }) => {
  page.setDefaultTimeout(15000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, 'atlas-adjoining');
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b', cellId: 'planet-cell:00001', name: 'Birch Ground', placeId: 'foreign-survey:b' };
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: { governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  await page.evaluate(({ source, carrier }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer('dom');
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'atlas-adjoining', truth: { potentialPermille: { constructionStone: 1000 }, typicalDepth: { constructionStone: 'exposed' }, surfaceAccessibilityPermille: 1000 } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: { origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) throw new Error('Local field fixture unavailable');
  }, { source, carrier });
  await visits(page);
  const original = await page.evaluate(() => window.helixHeresyDebug.foreignWildernessSnapshot());
  expect((await atlas(page)).entries.some(e => e.kind === 'adjoining')).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSurveyAction('walkWildernessEdge'))).toBe(true);
  const finish = async () => {
    for (let i = 0; i < 30; i++) {
      const s = await page.evaluate(() => window.helixHeresyDebug.foreignWildernessSnapshot());
      if (!s.tasks.length) return;
      expect(s.tasks[0].reason).toBe('');
      await page.evaluate(n => window.helixHeresyDebug.advanceAdjoiningWildernessForTest(n), Math.max(1, s.tasks[0].dueAt - s.clock + 1));
    }
    throw new Error('Real adjoining walk unfinished');
  };
  await finish(); expect(await page.evaluate(() => window.helixHeresyDebug.foreignSurveyAction('exploreAdjoining'))).toBe(true);
  expect((await atlas(page)).entries.some(e => e.kind === 'adjoining')).toBe(false);
  await finish();
  const explored = await page.evaluate(() => window.helixHeresyDebug.foreignWildernessSnapshot()), extension = explored.site.extension;
  const known = (await atlas(page)).entries.find(e => e.id === extension.discovery.placeId);
  expect(known.kind).toBe('adjoining'); expect(known.globeCellId).toBe(explored.site.destination.strategicCellId);
  expect(known.facts.some(f => f.category === 'terrain')).toBe(true);
  expect(await act(page, 'select', known.id, 'revisit')).toBe(true);
  const physical = await effects(page); expect(await act(page, 'focus', original.site.discovery.placeId)).toBe(false);
  expect(await effects(page)).toEqual(physical);
  // Explicit already-received archival accounts exercise indexing, not new
  // service/resource acquisition. Actual private truth is deliberately different.
  await page.evaluate(siteId => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), run = d.currentWorldRunSnapshot().run;
    const binding = { worldId: 'lifecycle-world', runId: run.id, cityId: 'b', officeId: 'office:b', installationId: 'office:b:service-channel', maintenanceId: 'upkeep:b' };
    const u = { id: 'upkeep:b', cityId: 'b', officeId: 'office:b', installation: { id: binding.installationId }, handoverId: 'old-receipt', lastAt: 0, dueAt: 1, graceUntil: 2, receipts: [] };
    let c = window.HelixRunStrategicConditions.advance(null, binding, u, 0);
    c = window.HelixRunStrategicConditions.observe(c, binding, 'Counter service available', 0, true);
    s.runStrategicConditions = window.HelixRunStrategicConditions.advance(c, binding, u, Math.max(3, s.clock));
    s.resourceSurveys.observations.push({ id: 'received-old-survey', worldId: 'lifecycle-world', siteId, strategicCellId: 'planet-cell:00002', cell: s.scientist.mapCell, methodId: 'reconnaissance', sampledAt: 0, recordedAt: 1,
      coverage: 'One recorded surface point', depth: 'surface indicators', evidenceKey: 'SECRET_MEASUREMENT_SEED', findings: [{ familyId: 'constructionStone', label: 'Construction stone', result: 'indicatorsDetected', confidence: 'low', summary: 'Local indicators only; yield unconfirmed' }] });
    const privateSite = s.penalFlights.assistance.cityApproach.gates.find(g => g.foreignSurvey?.wilderness?.extension?.discovery?.placeId === siteId)?.foreignSurvey.wilderness.extension.context;
    if (!privateSite?.truth) throw new Error('The actually explored site lacks its saved private context');
    privateSite.truth.privateMarker = 'SECRET_HIDDEN_GEOLOGY';
    s.resourceSurveys.context = JSON.parse(JSON.stringify(privateSite));
    s.resourceSurveys.sites[siteId] = JSON.parse(JSON.stringify(privateSite));
    d.importSurveyExpeditionTestState(s);
    // The debug import is in-memory only. Save via an ordinary free planning
    // action before testing the real title-screen load path.
    if (!d.expansionAtlasAction('select', siteId, 'revisit')) throw new Error('Known-site planning/save refused');
  }, known.id);
  let a = await atlas(page);
  expect(a.entries.find(e => e.id === 'city:b').facts.find(f => f.category === 'operations').text).toBe('Counter service available');
  expect(a.entries.find(e => e.id === known.id).facts.some(f => f.category === 'resources')).toBe(true);
  expect(JSON.stringify(a)).not.toMatch(/SECRET_|maintenanceOffline|maintenance grace expired/);
  await reload(page); expect(await atlas(page)).toEqual(a);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage());
  a = await atlas(page); expect(await act(page, 'clear')).toBe(false); expect(await atlas(page)).toEqual(a);
  await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
  await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
  const fresh = await atlas(page); expect(fresh.objective).toBeNull(); expect(fresh.runId).not.toBe(a.runId);
  expect(fresh.entries.flatMap(e => e.facts).some(f => ['terrain', 'resources', 'operations'].includes(f.category))).toBe(false);
  expect(errors).toEqual([]);
});
