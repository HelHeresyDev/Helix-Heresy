const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const Beasts = require('../wilderness-beasts');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.cityDefenseSnapshot());
const act = (page, action, expected = null) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.cityDefenseAction(action, expected), { action, expected });
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceCityDefenseForTest(n, n !== 0), n);
async function walk(page, cell = null, room = 'supportedSurveyGround') {
  if (cell) expect(await page.evaluate(({ cell, room }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell, urgent: true, allowMultiRoom: true })), { cell, room })).toBe(true);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    for (let n = 0; n < 45; n++) {
      const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason);
      if (!t) return;
      d.advanceCityDefenseForTest(Math.max(1, t.dueAt - s.clock + 1), true);
    }
    throw new Error('Actual walking did not finish');
  });
  await tick(page, 0);
}
async function reload(page) {
  await tick(page, 0); await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function setup(page, renderer) {
  page.setDefaultTimeout(15000); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `city-defense-${renderer}`);
  await page.evaluate(renderer => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'lifecycle-world', siteId: 'lab', strategicCellId: 'planet-cell:00009', seed: 'station', publicProspects: {}, truth: {} } });
    d.configureScientistIdentityTest({ office: true, money: 1000 }); d.configureSovereignBargainTest(); d.configureUnsupportedTest({ municipal: true });
    d.configureWildernessTest({ destination: { id: 'original-approach', label: 'Original approach', strategicCellId: 'planet-cell:00002', jurisdiction: 'Unclaimed wilderness', description: 'Existing municipal outward approach' } });
    if (!d.citySuccessionAction('walk')) throw new Error('Original counter route refused');
  }, renderer);
  await walk(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, action = (a, e) => { if (!d.citySuccessionAction(a, e)) throw new Error(`Succession refused ${a}`); };
    d.configureCitySuccessionTest({ retirement: true }); action('request'); d.advanceCitySuccessionForTest(30);
    action('hear'); d.advanceCitySuccessionForTest(180); action('sign', d.citySuccessionSnapshot().succession.terms);
    d.configureSovereignBargainTest({ supply: 18, carried: true }); action('deliver');
    const s = d.citySuccessionSnapshot();
    for (const a of [...s.succession.leaders, s.bargain.defender]) { action('agree', a.id); d.advanceCitySuccessionForTest(60); }
    action('handover'); d.advanceCitySuccessionForTest(180);
    const after = d.citySuccessionSnapshot();
    d.configureCityDefenseTest({ cityId: 'a', cityName: 'Aster', charterId: after.succession.source.charterId,
      populationSourceId: after.succession.source.populationSourceId, population: 3000, institutionId: after.bargain.defender.institutionId,
      installationId: 'population:a:existing-approach-ward', condition: 80, baselineEnergy: 60000 });
  });
  await page.locator('[data-workspace-tab="visits"]').click();
  const s = await snap(page); expect(s.saved).toBeTruthy(); return s;
}
for (const renderer of ['dom', 'canvas']) test(`${renderer}: original approach station, finite independent energy, physical watch, shared damage, service and real saves`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const initial = await setup(page, renderer);
  const world = await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'));
  const panel = page.locator('[data-city-defense]'); await expect(panel).toContainText('Continuing approach-station defense');
  const home = initial.defender.mapCell, mana = initial.defender.wardMana;
  await panel.locator('[data-city-defense-action="walk"]').click(); await walk(page);
  await panel.locator('[data-city-defense-action="inspect"]').click(); let s = await snap(page); const quote = s.saved.quote;
  expect(quote.condition).toBe(80); expect(await act(page, 'order', { ...quote, seconds: 1 })).toBe(false);
  await panel.locator('[data-city-defense-action="order"]').click(); await tick(page, 1);
  const partial = await snap(page); expect(partial.saved.duty.phase).toBe('outward');
  await reload(page); expect((await snap(page)).defender.mapCell).toEqual(partial.defender.mapCell);
  await tick(page, 8); s = await snap(page); expect(s.saved.duty.phase).toBe('watch'); expect(s.defender.mapCell).toEqual({ x: 19, y: 12, z: 6 });
  expect(await page.evaluate(() => window.helixHeresyDebug.defenseRecognitionAction('order', {}))).toBe(false);
  const report = s.saved.report;
  // Actual pre-existing animal fixture; the station itself spawns no attack.
  const beast = { ...Beasts.actor('beast:rimefang-pack', 'original-approach-animal', { x: 21, y: 12, z: 6 }, 'original-population', s.clock), roomId: 'wildernessSurveySector' };
  await page.evaluate(beast => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.wildernessBeasts.materialized = true; s.wildernessBeasts.actors = [beast]; d.importSurveyExpeditionTestState(s);
  }, beast);
  const strike = await page.evaluate(() => window.helixHeresyDebug.cityDefenseTestStrike('original-approach-animal', { kind: 'structure', cell: { x: 20, y: 12, z: 6 } }, { baseDamage: 40, damageTypes: ['physical'] }));
  expect(strike.ok).toBe(true); s = await snap(page); expect(s.door.condition).toBeLessThan(80);
  expect(strike.damage).toBeCloseTo(80 - s.door.condition, 5);
  expect(s.saved.combatSpent).toBe(1200); expect(s.defender.wardMana).toBe(mana); expect(s.saved.report).toEqual(report);
  await reload(page); expect((await snap(page)).door.condition).toBe(s.door.condition);
  expect(await act(page, 'release')).toBe(true); await tick(page, 10); s = await snap(page);
  expect(s.saved.duty).toBeNull(); expect(s.defender.mapCell).toEqual(home); expect(s.defender.assignment).toBeNull();
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    for (const [id, key, quantity] of [['owned-parts', 'metalParts', 2], ['owned-feed', 'arcaneFeedstock', 1]])
      s.physicalItemStacks.push({ id, key, quantity, section: 'resources', carriedBy: 'scientist', roomId: s.scientist.roomId, cell: s.scientist.mapCell });
    d.importSurveyExpeditionTestState(s);
  });
  expect(await act(page, 'inspect')).toBe(true); expect(await act(page, 'repair')).toBe(true); await tick(page, 60);
  s = await snap(page); expect(s.saved.job.progress).toBe(60); expect(s.stacks.find(i => i.id === 'owned-parts').quantity).toBe(2);
  await reload(page); await tick(page, 60); s = await snap(page); expect(s.saved.job).toBeNull();
  expect(s.stacks.find(i => i.id === 'owned-parts')?.quantity || 0).toBe(0);
  expect(s.door.condition).toBeGreaterThan(initial.door.condition - 40);
  expect(await act(page, 'inspect')).toBe(true); expect(await act(page, 'charge')).toBe(true);
  await tick(page, 30); await reload(page); await tick(page, 30); s = await snap(page);
  expect(s.saved.charged).toBe(21600); expect(s.stacks.find(i => i.id === 'owned-feed')?.quantity || 0).toBe(0);
  expect(s.defender.wardMana).toBe(mana); expect(s.saved.energy + s.saved.standbySpent + s.saved.combatSpent).toBeCloseTo(s.saved.initialEnergy + s.saved.charged, 5);
  expect(await act(page, 'report')).toBe(true); s = await snap(page); const dated = s.saved.report;
  await tick(page, 60); expect((await snap(page)).saved.report).toEqual(dated);
  expect(s.saved.contacts.length).toBe(1); expect(s.saved.receipts.map(r => r.kind)).toEqual(['watch', 'repair', 'charge']);
  expect(s.succession.handover).toEqual(initial.succession.handover); expect(s.campaign).toEqual(initial.campaign);
  await reload(page); expect((await snap(page)).saved.receipts).toEqual(s.saved.receipts);
  // A second explicit threat placement tests the same real beast against a
  // person on the disclosed outer tiles, using ordinary shared accuracy and
  // bodily damage. Nothing in the station generates this fixture encounter.
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.wildernessBeasts.actors[0].mapCell = { x: 22, y: 12, z: 6 }; d.importSurveyExpeditionTestState(s);
  });
  expect(await act(page, 'inspect')).toBe(true); const second = await snap(page);
  expect(await act(page, 'order', second.saved.quote)).toBe(true); await tick(page, 8);
  expect((await snap(page)).saved.duty.phase).toBe('watch');
  await walk(page, { x: 21, y: 12, z: 6 }, 'wildernessSurveySector');
  expect(await page.evaluate(() => window.helixHeresyDebug.wildernessSnapshot().scientistCell)).toEqual({ x: 21, y: 12, z: 6 });
  const bodyBefore = await page.evaluate(() => window.helixHeresyDebug.wildernessSnapshot().health);
  const incoming = await page.evaluate(() => window.helixHeresyDebug.cityDefenseTestStrike('original-approach-animal',
    { kind: 'creature', id: 'scientist' }, { baseDamage: 12, damageTypes: ['physical'], sequence: 1 }));
  expect(incoming.ok).toBe(true); expect(incoming.hit).toBe(true); expect(incoming.absorbed).toBe(12);
  expect(await page.evaluate(() => window.helixHeresyDebug.wildernessSnapshot().health)).toBe(bodyBefore);
  await walk(page, { x: 19, y: 13, z: 6 }); expect(await act(page, 'release')).toBe(true); await tick(page, 10);
  expect((await snap(page)).saved.duty).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('helix-heresy-v2-world:lifecycle-world'))).toBe(world);
  expect(errors).toEqual([]);
});
