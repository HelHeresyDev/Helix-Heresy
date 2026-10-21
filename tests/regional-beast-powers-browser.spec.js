const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { fixture } = require('./helpers/regional-beast-power-source');
test.setTimeout(300000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.beastPowerSnapshot());
const act = (p, action, id = '') => p.evaluate(({ action, id }) => window.helixHeresyDebug.beastPowerAction(action, id), { action, id });
const advance = (p, n) => p.evaluate(n => window.helixHeresyDebug.advanceSimulation(n), n);
async function visits(p) { const tab = p.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(p) { await p.reload(); await p.locator('#loadLastSaveBtn').click(); await visits(p); }
async function finishWalk(p) {
  for (let i = 0; i < 30; i++) {
    const s = await p.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot());
    if (!s.tasks.length) return;
    expect(s.tasks[0].reason).toBe('');
    await p.evaluate(n => window.helixHeresyDebug.advanceBoundaryTravelForTest(n), Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Original civic-counter walk did not complete');
}
for (const renderer of ['dom', 'canvas']) test(`${renderer} original civic beast account conserves finite work, private evidence and saved investigation without granting power`, async ({ page }) => {
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `beast-dossier-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'beast-dossier', publicProspects: {}, truth: { private: 'SECRET_GEOLOGY' } } });
    d.configureScientistIdentityTest({ office: true, money: 1000 });
    d.configureUnsupportedTest({ municipal: true });
  }, renderer);
  expect(await page.evaluate(map => window.helixHeresyDebug.setBeastPowerTestSource(map), fixture().map)).toBe(true);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  await visits(page); expect(await act(page, 'request')).toBe(false); expect((await snap(page)).saved.dossiers).toEqual([]);
  await page.locator('[data-beast-power-action="walk"]').click(); await finishWalk(page);
  const before = await snap(page); expect(before.context.atCounter).toBe(true);
  await page.locator('[data-beast-power-action="request"]').click(); let s = await snap(page);
  expect(s.saved.job).not.toBeNull(); expect(s.public.dossiers).toEqual([]); expect(s.office.power).toBe(before.office.power - 1);
  await expect(page.locator('[data-beast-powers]')).not.toContainText('Rimefang Pack');
  expect(await page.evaluate(() => window.helixHeresyDebug.municipalMapAction('request', 'groundPlan'))).toBe(false);
  await advance(page, 60); s = await snap(page); expect(s.saved.job.progress).toBeCloseTo(60);
  await reload(page); expect((await snap(page)).saved.job.progress).toBeCloseTo(60);
  expect(await act(page, 'cancel')).toBe(true); s = await snap(page); expect(s.office.workSeconds).toBeCloseTo(before.office.workSeconds - 60);
  expect(s.public.dossiers).toEqual([]);
  expect(await page.evaluate(map => window.helixHeresyDebug.setBeastPowerTestSource(map), fixture().map)).toBe(true);
  expect(await act(page, 'request')).toBe(true); await advance(page, 181); s = await snap(page);
  expect(s.saved.job).toBeNull(); expect(s.public.dossiers).toHaveLength(1); expect(s.office.clerk.id).toBe(before.office.clerk.id);
  expect(s.office.workSeconds).toBeCloseTo(before.office.workSeconds - 240); expect(s.office.power).toBe(before.office.power - 2);
  const dossier = s.public.dossiers[0], card = page.locator('[data-beast-dossier]');
  await expect(card).toContainText('source date unknown'); await expect(page.locator('[data-beast-powers]')).toContainText('not an attack in progress');
  expect(JSON.stringify(s.public)).not.toMatch(/SECRET|populationIds|profileIds|lairCellId|cellPath/);
  expect(await act(page, 'select', 'unknown')).toBe(false);
  const physical = async () => page.evaluate(() => { const s = window.helixHeresyDebug.exportSurveyExpeditionTestState(); return { clock: s.clock, money: s.economy.money,
    body: s.scientist, tasks: s.tasks, stacks: s.physicalItemStacks, journeys: s.strategicJourneys, survey: s.surveyExpeditions, campaign: s.campaign }; });
  const original = await physical();
  await page.locator('[data-beast-power-action="select"]').click(); expect((await snap(page)).public.objective.id).toBe(dossier.report.id);
  expect(await physical()).toEqual(original);
  const atlas = await page.evaluate(() => window.helixHeresyDebug.expansionAtlasSnapshot());
  expect(atlas.entries.flatMap(e => e.facts).some(f => f.id === dossier.report.id)).toBe(true); expect(JSON.stringify(atlas)).not.toMatch(/SECRET/);
  await reload(page); expect((await snap(page)).public.dossiers).toEqual(s.public.dossiers);
  expect((await snap(page)).public.objective.id).toBe(dossier.report.id);
  expect(await act(page, 'clear')).toBe(true); expect((await snap(page)).public.objective).toBeNull();
  await page.evaluate(() => { const d = window.helixHeresyDebug, at = d.beastPowerSnapshot().clock;
    // Original local encounter inputs, not a completed research/campaign outcome.
    d.configureWildernessTest({ destination: { id: 'wilderness:a', label: 'Aster wilderness edge', strategicCellId: 'planet-cell:00002',
      approachCellId: 'planet-cell:00001', temperatureC: 18, slopePercent: 20, precipitationMm: 500, terrain: 'broken ground', jurisdiction: 'Wilderness' }, mode: 'wilderness', autoCare: false });
    d.configureWildernessBeastsTest({ scientistCell: { x: 22, y: 12, z: 6 },
      actors: [{ id: 'personally-seen-rimefang', cell: { x: 23, y: 12, z: 6 }, nextMoveAt: at + 1000, nextAttackAt: at + 1000 }] });
  });
  let seen = (await snap(page)).public.dossiers[0].observations;
  expect(seen).toHaveLength(1); expect(seen[0].id).toBe('personally-seen-rimefang'); expect(seen[0].association).toContain('unconfirmed');
  await expect(card).toContainText('Personally witnessed'); expect(JSON.stringify((await snap(page)).public)).not.toMatch(/population-test|SECRET/);
  await reload(page); expect((await snap(page)).public.dossiers[0].observations).toEqual(seen);
  const acquired = (await snap(page)).public.dossiers;
  await page.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ municipal: true }));
  await advance(page, 40); expect((await snap(page)).public.dossiers).toEqual(acquired);
  const frozen = (await snap(page)).saved;
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await advance(page, 100);
  expect((await snap(page)).saved).toEqual(frozen); expect(await act(page, 'select', dossier.report.id)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(errors).toEqual([]);
  if (renderer === 'dom') {
    await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
    await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
    expect((await snap(page)).saved).toBeNull();
    const freshAtlas = await page.evaluate(() => window.helixHeresyDebug.expansionAtlasSnapshot());
    expect(freshAtlas.entries.flatMap(e => e.facts).some(f => f.id === dossier.report.id)).toBe(false);
  }
});
