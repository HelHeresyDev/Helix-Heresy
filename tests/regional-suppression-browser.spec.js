const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { fixture } = require('./helpers/regional-suppression-source');
const Suppression = require('../regional-suppression');
test.setTimeout(600000);
const snap = p => p.evaluate(() => window.helixHeresyDebug.suppressionSnapshot());
const walk = p => p.evaluate(() => window.helixHeresyDebug.overlandSnapshot());
const tick = (p, n) => p.evaluate(n => window.helixHeresyDebug.advanceOverlandForTest(n), n);
async function visits(p) { const tab = p.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function reload(p) { await p.reload(); await p.locator('#loadLastSaveBtn').click(); await visits(p); }
async function finish(p, passenger = false) {
  for (let n = 0; n < 30; n++) {
    const s = await walk(p); if (!s.tasks.length) return; expect(s.tasks[0].reason, JSON.stringify(s.tasks[0])).toBe('');
    const seconds = Math.max(1, s.tasks[0].dueAt - s.clock + 1);
    if (passenger) await p.evaluate(n => window.helixHeresyDebug.advanceForeignReceptionTestTime(n), seconds); else await tick(p, seconds);
  }
  throw new Error('Original movement or reconnaissance unfinished');
}
async function journey(p) {
  expect(await p.evaluate(() => window.helixHeresyDebug.bookIntercityPassenger('city:b'))).toBe(true);
  expect(await p.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(p, true);
  await p.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(1600));
  expect(await p.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(p, true);
}
for (const renderer of ['dom', 'canvas']) test(`${renderer} population-backed corridor expedition, actual combat suppression, original survivors, saved partial recon and physical withdrawal`, async ({ page }) => {
  page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `suppression-${renderer}`);
  const f = fixture(6); f.map.beastEcology.populations[0].territory = { rangeMask: Buffer.from([4]).toString('base64'), rangeCellCount: 1 };
  const source = Suppression.sourceFromWorld(f.map, f.route, 'a', f.geometry)[0];
  await page.evaluate(({ renderer, route, map, source }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', assetId: 'people:a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'original-driver', publicName: 'Original Carrier', capacityBand: 'functional', operationalStatus: 'active' } }],
      network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [route], destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 1, routeContinuity: 'municipal', cellId: 'planet-cell:00001' },
        ...['a', 'b'].map((id, i) => ({ id: `city:${id}`, cityId: id, label: `City ${id}`, kind: 'fortifiedCity', known: true,
          jurisdiction: { kind: 'city', cityId: id }, supportComponentId: 'one', cellId: `planet-cell:0000${i ? 3 : 1}` })) ] } });
    d.configureUnsupportedTest({ municipal: true, carry: ['drinkingWater', 'trailMeal'] }); d.configureWildernessTest({ autoCare: false, thirst: 5, hunger: 5 });
    d.configureScientistIdentityTest({ office: true, money: 1000 });
    if (!d.setBeastPowerTestSource(map) || !d.setSuppressionTestSources([source])) throw new Error('Original source refused');
    // A prepared late-game scientist is an input, not an awarded campaign outcome.
    const s = d.exportSurveyExpeditionTestState();
    s.scientist.vitals.mana = { current: 1000, max: 1000 }; s.scientist.vitals.health = { current: 1000, max: 1000 };
    d.importSurveyExpeditionTestState(s);
  }, { renderer, route: f.route, map: f.map, source });
  await visits(page); expect((await snap(page)).saved).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.beastPowerAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.beastPowerAction('request'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(181));
  const dossier = await page.evaluate(() => window.helixHeresyDebug.beastPowerSnapshot().public.dossiers[0]); expect(dossier).toBeTruthy();
  expect(await page.evaluate(id => window.helixHeresyDebug.beastPowerAction('select', id), dossier.report.id)).toBe(true);
  expect((await snap(page)).saved).toBeNull(); // Planning did not spawn a fight.
  await journey(page); await journey(page);
  console.info(`${renderer}: original dossier and personally completed paid itinerary ready.`);
  const before = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    money: s.economy.money, campaign: s.campaign, guards: s.penalFlights?.assistance, clock: s.clock,
    world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), mana: s.scientist.vitals.mana.current }; });
  const plans = await page.evaluate(() => window.helixHeresyDebug.intercityMarchSnapshot().plans); expect(plans).toHaveLength(1);
  expect(await page.evaluate(id => window.helixHeresyDebug.suppressionAction('march', id), plans[0].id)).toBe(true); await finish(page);
  let s = await snap(page); expect(s.saved.populations[0].members).toHaveLength(6); expect(s.regional.beasts.actors).toHaveLength(6);
  const identities = s.regional.beasts.actors.map(a => a.id); expect(s.assessments[0].status).toBe('capable');
  for (let stop = 0; stop < 12; stop++) {
    await tick(page, 8000); s = await snap(page); const w = await walk(page);
    if (!s.site) throw new Error('Actual corridor contact was not reached');
    await visits(page); expect(JSON.stringify(s.public)).not.toMatch(/SECRET|individualCount|suppressedSince/);
    for (let hit = 0; hit < 60; hit++) {
      const outcome = await page.evaluate(() => {
        const d = window.helixHeresyDebug, s = d.suppressionSnapshot(), k = d.regionalEncounterSnapshot().knowledge;
        const seen = s.regional.beasts.actors.filter(a => k.sightings.some(o => o.id === a.id && o.current) && a.status !== 'dead' && a.health >= a.maxHealth * .3);
        const target = seen.find(a => d.wildernessBeastActionReason('soulLash', a.id) === '');
        if (!target) return { seen: seen.length, acted: false };
        return { seen: seen.length, acted: d.startScientistCombatAction('soulLash', target.id) };
      });
      if (!outcome.seen) break;
      if (!outcome.acted) break;
      await tick(page, 2);
    }
    s = await snap(page);
    if (s.assessments[0].status === 'suppressed') break;
    expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true); await finish(page);
    if (w.saved.trip.positionKm === 2) throw new Error(`Unresolved original groups after full passage: ${JSON.stringify(s.regional.beasts.actors)}`);
  }
  s = await snap(page); expect(s.assessments[0].status).toBe('suppressed'); expect(s.regional.beasts.actors.some(a => a.status === 'alive')).toBe(true);
  console.info(`${renderer}: actual shared-combat wounds suppressed the original pool; survivors remain.`);
  expect(s.regional.beasts.actors.map(a => a.id)).toEqual(identities);
  const wounded = s.regional.beasts.actors.map(a => ({ id: a.id, health: a.health, status: a.status }));
  await reload(page); expect((await snap(page)).regional.beasts.actors.map(a => ({ id: a.id, health: a.health, status: a.status }))).toEqual(wounded);
  expect(await page.evaluate(() => window.helixHeresyDebug.suppressionAction('recon'))).toBe(true); await tick(page, 20);
  const partial = (await snap(page)).tasks[0]; expect(partial).toBeTruthy(); await reload(page);
  expect((await snap(page)).tasks[0].id).toBe(partial.id);
  expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), partial.id)).not.toBe(false);
  expect((await snap(page)).public.reports).toEqual([]);
  expect(await page.evaluate(() => window.helixHeresyDebug.suppressionAction('recon'))).toBe(true); await finish(page);
  const report = (await snap(page)).public; expect(report.reports.length).toBe(1); expect(report.reports[0].text).toContain('broken for now');
  await expect(page.locator('[data-regional-suppression]')).toContainText('Unseen replacements');
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('reverse'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true); await finish(page);
  for (let n = 0; n < 12; n++) {
    await tick(page, 8000); const w = await walk(page); if (w.roomId === 'supportedSurveyGround') break;
    expect(await page.evaluate(() => window.helixHeresyDebug.overlandAction('resume'))).toBe(true); await finish(page);
  }
  expect((await walk(page)).roomId).toBe('supportedSurveyGround'); expect((await snap(page)).public).toEqual(report);
  const result = await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(); return {
    money: s.economy.money, mana: s.scientist.vitals.mana.current, campaign: s.campaign, guards: s.penalFlights?.assistance,
    world: localStorage.getItem('helix-heresy-v2-world:lifecycle-world'), valid: d.validateMapScene() }; });
  expect(result.money).toBe(before.money); expect(result.mana).toBeLessThan(before.mana); expect(result.campaign).toEqual(before.campaign);
  expect(result.guards).toEqual(before.guards); expect(result.world).toBe(before.world); expect(result.valid).toEqual([]);
  await reload(page); expect((await snap(page)).regional.beasts.actors.map(a => a.id)).toEqual(identities);
  const frozen = (await snap(page)).saved; await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); await tick(page, 100);
  expect((await snap(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
  if (renderer === 'dom') {
    await page.reload(); await page.locator('#titleWorldLibraryBtn').click(); await page.locator('[data-library-action="review-run"]').click();
    await page.locator('#runOutcomeRestartBtn').click(); await page.locator('[data-starting-site-input]').first().check(); await page.locator('#startRunSubmitBtn').click();
    await expect(page.locator('#setupOverlay')).toHaveClass(/hidden/);
    expect((await snap(page)).saved).toBeNull(); expect((await snap(page)).public.reports).toEqual([]);
    expect((await snap(page)).regional).toBeNull();
  }
});
