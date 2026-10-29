const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { sourceMap } = require('./helpers/city-authority-source');
test.setTimeout(900000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.cityAuthoritySnapshot());
const tick = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceCityRuleForTest(seconds), seconds);
for (const renderer of ['dom', 'canvas']) test(`${renderer}: collective political resolution, actual client operation, withdrawal and historical reports survive saves and continued copies`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept()); page.setDefaultTimeout(25000);
  await startLifecycleRun(page, `city-authority-${renderer}`);
  const prepared = sourceMap();
  await page.evaluate(({ renderer, prepared }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true,
        localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Original city', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true,
        jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'political-settlement', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest({ collective: true }); d.configureUnsupportedTest({ municipal: true });
    d.configureWildernessTest({ destination: { id: 'original-approach', label: 'Original approach', strategicCellId: 'planet-cell:00002', jurisdiction: 'Unclaimed wilderness', description: 'Existing approach' } });
    const original = d.sovereignBargainSnapshot().bargain.source, p = prepared.political, op = prepared.operation, defense = prepared.defense;
    p.charterId = op.charterId = defense.charterId = original.charterId;
    p.parties[0] = { ...p.parties[0], authorityId: original.authority.id, name: original.authority.name, charterId: original.charterId };
    for (const list of [p.institutions, op.institutions]) for (const i of list) {
      if (i.role === 'centralAdministration') i.id = original.administrationId;
      if (i.role === 'militaryDefenseCommand') i.id = original.defenseId;
    }
    defense.institutionId = original.defenseId; op.baselineAuthorityId = original.authority.id;
    for (const farm of op.farms) farm.charterId = original.charterId;
    if (!d.configureCityAuthorityTest([{ political: p, operation: op, defense }])) throw Error('Prior original political sources refused');
    if (!d.scientistIdentityAction('walk')) throw Error('Original civic walk refused');
    for (let n = 0; n < 50; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) break;
      d.advanceCityRuleForTest(Math.max(1, t.dueAt - s.clock + 1), true);
    }
    d.advanceCityRuleForTest(0);
  }, { renderer, prepared });
  await page.locator('[data-workspace-tab="visits"]').click();
  const panel = page.locator('[data-city-authority]'); await expect(panel).toBeVisible();
  const action = name => panel.locator(`[data-city-authority-action="${name}"][data-city-authority-target="a"]`).click();
  await action('inspect'); await tick(page, 60);
  let s = await snapshot(page); expect(s.saved.entries[0].phase).toBe('unreceived');
  expect(s.saved.entries[0].knowledge, JSON.stringify({ context: s.counter.context, office: s.counter.office, job: s.saved.job })).toBeTruthy();
  expect(s.saved.entries[0].knowledge.parties[0].kind).toBe('collective');
  await action('negotiate'); await tick(page, 60); s = await snapshot(page);
  expect(s.saved.job.progress).toBe(60); expect(s.saved.entries[0].terms).toBeNull();
  const partial = s.saved.authorities;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click();
  expect((await snapshot(page)).saved.authorities).toEqual(partial); await tick(page, 120);
  s = await snapshot(page); expect(s.saved.entries[0].phase).toBe('offered');
  expect(s.saved.entries[0].operation).toBeNull(); expect(s.saved.authorities[0].decisions[0].voters).toHaveLength(3);
  await action('accept'); await tick(page, 60); s = await snapshot(page);
  expect(s.saved.entries[0].phase).toBe('active'); expect(s.saved.entries[0].resolutions[0].members).toHaveLength(3);
  await action('operate');
  await page.evaluate(() => window.helixHeresyDebug.advanceCityRuleForTest(3600 + 3 * 86400, true)); await tick(page, 0);
  s = await snapshot(page); expect(s.saved.entries[0].operation.status).toBe('established');
  expect(s.saved.entries[0].operation.authorityKind).toBe('subordinateLocalGovernment');
  await action('receiveOperation');
  const history = await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(e => e.temporal === 'historical'));
  expect(history.period.endAt - history.period.startAt).toBe(3 * 86400);
  await action('withdraw'); await tick(page, 60); s = await snapshot(page);
  expect(s.saved.entries[0].phase).toBe('withdrawn'); expect(s.saved.entries[0].operation.status).toBe('contested');
  await action('receiveOperation');
  expect(await page.evaluate(() => window.helixHeresyDebug.supremacySnapshot().saved.cityReports.find(e => e.temporal === 'historical'))).toEqual(history);
  const saved = (await snapshot(page)).saved;
  const bundle = await page.evaluate(() => ({ format: 'helix-heresy-run-bundle', version: 2, ...window.helixHeresyDebug.currentWorldRunSnapshot() }));
  await page.locator('#newRunBtn').click(); await page.locator('#titleImportFileInput').setInputFiles({ name: 'continued-city-authority.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/, { timeout: 60000 }); await page.locator('[data-workspace-tab="visits"]').click(); s = await snapshot(page);
  expect(s.saved.runId).not.toBe(saved.runId); expect(s.saved.entries[0].knowledge).toEqual(saved.entries[0].knowledge);
  expect(s.saved.authorities).toEqual(saved.authorities); expect(s.saved.entries[0].operation.foodKg).toBe(saved.entries[0].operation.foodKg);
  expect(s.saved.entries[0].operation.runId).toBe(s.saved.runId); expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  const frozen = s.saved;
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); d.advanceSimulation(100); });
  expect((await snapshot(page)).saved).toEqual(frozen);
});
