const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.cityRuleSnapshot());
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityRuleForTest(n, n !== 0), n);
async function setup(page, renderer) {
  page.setDefaultTimeout(15000); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `city-rule-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'city-account', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    d.configureWildernessTest({ destination: { id: 'original-approach', label: 'Original approach', strategicCellId: 'planet-cell:00002', jurisdiction: 'Unclaimed wilderness', description: 'Existing approach' } });
    if (!d.citySuccessionAction('walk')) throw new Error('Original counter route refused');
    for (let n = 0; n < 45; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) break; d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
    }
    const action = (a, e) => { if (!d.citySuccessionAction(a, e)) throw new Error(`Succession refused ${a}`); };
    d.configureCitySuccessionTest({ retirement: true }); action('request'); d.advanceCitySuccessionForTest(30);
    action('hear'); d.advanceCitySuccessionForTest(180); action('sign', d.citySuccessionSnapshot().succession.terms);
    d.configureSovereignBargainTest({ supply: 18, carried: true }); action('deliver');
    const s = d.citySuccessionSnapshot();
    for (const a of [...s.succession.leaders, s.bargain.defender]) { action('agree', a.id); d.advanceCitySuccessionForTest(60); }
    action('handover'); d.advanceCitySuccessionForTest(180);
    const after = d.citySuccessionSnapshot(), source = after.succession.source;
    const farm = { cityId: 'a', cityName: 'Aster', charterId: source.charterId, populationSourceId: source.populationSourceId,
      cityPopulation: 3000, satelliteId: 'original-farm:a', satelliteName: 'Original farm', satellitePopulation: 600,
      institutionId: source.institutions.find(i => i.role === 'publicWorksAndProvisioning').id,
      cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002', arableLandBand: 'productive', storageDays: 3,
      distanceKm: 5, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
    if (!d.configureCityProvisioningTest(farm)) throw new Error('Original farm source refused');
    if (!d.configureCityDefenseTest({ cityId: 'a', cityName: 'Aster', charterId: source.charterId,
      populationSourceId: source.populationSourceId, population: 3000, institutionId: after.bargain.defender.institutionId,
      installationId: 'original-approach:a', condition: 80, baselineEnergy: 69120 })) throw new Error('Original defense source refused');
    if (!d.configureCityRuleTest({ cityId: 'a', cityName: 'Aster', charterId: source.charterId, populationSourceId: source.populationSourceId,
      population: 3000, institutions: source.institutions.map(i => ({ role: i.role, id: i.id })),
      worksId: 'original-water-walls:a', powerId: 'original-power:a', reserveDays: 4, farms: [farm] })) throw new Error('City-wide source refused');
  }, renderer);
  await page.locator('[data-workspace-tab="visits"]').click();
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: actual succession, finite city account, completed priority, stale reports, lost supply and real save`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await setup(page, renderer);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const panel = page.locator('[data-city-rule]'); await expect(panel).toContainText('Sustained city-power assessment');
  let s = await snap(page); expect(s.saved).toBeTruthy(); expect(s.context.reportersPresent).toBe(true);
  expect(s.context.institutionsAvailable).toBe(true); expect(s.authority).toBe(true);
  expect(s.saved.report).toBeNull(); expect(s.campaign.cityPower.rule).toBeNull();
  await panel.locator('[data-city-rule-action="operate"]').click(); await tick(page, 1800);
  s = await snap(page); expect(s.saved.command.progress).toBe(1800); expect(s.saved.since).toBeNull();
  await panel.locator('[data-city-rule-action="report"]').click(); const dated = (await snap(page)).saved.report;
  const supremacy = page.locator('[data-durable-supremacy]');
  await supremacy.locator('[data-supremacy-action="review"]').click();
  const knownSupremacy = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().public);
  expect(knownSupremacy.review.evidence).toHaveLength(1); expect(knownSupremacy.review.evidence[0].observedAt).toBe(dated.at);
  expect(knownSupremacy.review.evidence[0].status).toBe('unverified');
  await tick(page, 0); await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snap(page)).saved.command.progress).toBe(1800); await tick(page, 1800);
  s = await snap(page); expect(s.saved.command).toBeNull(); expect(s.saved.receipts[0].kind).toBe('operatingPriority');
  expect(s.saved.since).toBe(s.saved.allocatedAt + 3600); expect(s.saved.report).toEqual(dated);
  await tick(page, 2 * 86400); s = await snap(page);
  expect(s.saved.status).toBe('contested'); expect(s.saved.since).toBeNull(); expect(s.saved.accomplishment).toBeNull();
  expect(s.saved.farms[0].deliveredKg).toBeGreaterThan(0); expect(s.saved.report).toEqual(dated);
  expect(s.campaign.cityPower.rule).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().public)).toEqual(knownSupremacy);
  await tick(page, 0); await panel.locator('[data-city-rule-action="report"]').click();
  s = await snap(page); await expect(panel).toContainText('Contested / no longer sustained'); expect(s.saved.report.at).toBe(s.clock);
  const final = s.saved; await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.locator('[data-workspace-tab="visits"]').click(); expect((await snap(page)).saved).toEqual(final);
  await supremacy.locator('[data-supremacy-action="review"]').click();
  const reviewed = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot());
  const latest = reviewed.public.review.evidence.find(e => e.id === final.report.receiptId);
  expect(latest.status).toBe('challenge'); expect(reviewed.saved.phase).not.toBe('qualified');
  expect(latest.observedAt).toBe(final.report.at);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(errors).toEqual([]);
});
