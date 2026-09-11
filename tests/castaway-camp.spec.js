const { test, expect } = require('@playwright/test');
const Camp = require('../castaway-camp');
const { pathToFileURL } = require('url');
const path = require('path');
const destination = { id: 'camp-test', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001', label: 'Camp', distanceKm: 90, temperatureC: 18, precipitationMm: 500, slopePercent: 10 };
async function setup(page, companions = []) {
  page.on('dialog', d => d.accept());
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.reload();
  await page.evaluate(() => window.helixHeresyDebug.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
  ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'penal-test', publicProspects: {}, truth: {} } }));
  const warrant = await page.evaluate(() => window.helixHeresyDebug.issueTestWarrant('law-enforcement', { immediate: true }));
  await page.evaluate(id => { const d = window.helixHeresyDebug; d.placeScientistAtRaidEntry(id); d.updateLawEnforcementRaids(1); d.surrenderToRaid(id); for (let i = 0; i < 8; i++) d.updateLawEnforcementRaids(1, { defer: i < 7 }); }, warrant.raidId);
  expect(await page.evaluate(({ destination, companions }) => window.helixHeresyDebug.preparePenalFlightForTest(destination, companions), { destination, companions })).toBe(true);
}

test('finite climate-dependent resources and reload-safe collar outcomes', () => {
  const camp = Camp.create(destination);
  expect([camp.water, camp.food, camp.filtersRemaining]).toEqual([3, 2, 3]);
  expect(Camp.create({ temperatureC: -10, precipitationMm: 0 })).toMatchObject({ water: 0, food: 0 });
  camp.collarInspected = true;
  expect(Camp.collarAttempt(camp, 2)).toMatchObject({ ok: true, success: false, injury: 4 });
  const saved = JSON.parse(JSON.stringify(camp));
  expect(Camp.collarAttempt(saved, 2).ok).toBe(false); expect(saved.toolCondition).toBe(65);
  expect(Camp.collarAttempt(saved, 5)).toMatchObject({ ok: true, success: true });
  expect(saved.toolCondition).toBe(45);
});
test('agreements require willingness, ability and prior conduct rather than conviction-based allegiance', () => {
  const actor = { id: 'named', health: 80, status: 'alive', relationship: {}, needs: {} }, camp = Camp.create(destination);
  expect(Camp.agree(camp, actor, 'watch', 0).ok).toBe(false);
  expect(Camp.agree(camp, actor, 'shelter', 0).ok).toBe(true);
  actor.relationship.trust = 1;
  expect(Camp.agree(camp, actor, 'watch', 30).ok).toBe(true);
  expect(camp.agreements.find(a => a.kind === 'watch').until).toBe(3630);
  actor.needs.thirst = 80; expect(Camp.willingness(actor, 'watch')).toContain('survival');
  actor.relationship.trust = -2; expect(Camp.willingness(actor, 'shelter')).toContain('distrust');
});
test('physical camp work, conservation, cancellation, agreements and collar removal', async ({ page }) => {
  test.setTimeout(600000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await setup(page, [{ name: 'Dara Fen' }]);
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.advancePenalFlightForTest(8000); d.configureCastawayForTest({ analysis: 2, disableAutoCare: true }); });
  const snap = () => page.evaluate(() => window.helixHeresyDebug.penalFlightSnapshot());
  const camp = () => page.evaluate(() => window.helixHeresyDebug.castawaySnapshot());
  async function work(kind, partnerId = '') {
    console.log('Camp action:', kind);
    expect(await page.evaluate(({ kind, partnerId }) => window.helixHeresyDebug.queueCastawayWork(kind, partnerId, { deferRender: true }), { kind, partnerId }), kind).toBe(true);
    await page.evaluate(() => { const d = window.helixHeresyDebug; return d.advanceCastawayForTest(Math.ceil(d.castawaySnapshot().tasks[0].dueAt - d.penalFlightSnapshot().clock) + 30, { deferRender: true }); });
    expect((await camp()).tasks, kind).toEqual([]);
  }
  let s = await snap(); expect(s.flights[0].stage).toBe('released'); const id = s.actors[0].id;
  await work('inspect'); await work('salvage');
  expect((await snap()).flights[0].craft.status).toBe('dismantled');
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCastawayWork('salvage'))).toBe(false);
  const waterTotal = s => s.stacks.filter(x => x.key === 'drinkingWater').reduce((n,x) => n+x.quantity, 0);
  const before = waterTotal(await snap());
  await work('offer', id); expect(waterTotal(await snap())).toBe(before);
  await work('shelter', id); await work('watch', id);
  expect((await camp()).camp.agreements.some(a => a.kind === 'watch')).toBe(true);
  await work('take', id); expect(waterTotal(await snap())).toBe(before);
  expect((await camp()).camp.agreements).toEqual([]);
  await work('search');
  const water = (await camp()).camp.water;
  expect(await page.evaluate(() => window.helixHeresyDebug.queueCastawayWork('water'))).toBe(true);
  await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), (await camp()).tasks[0].id);
  expect((await camp()).camp.water).toBe(water);
  await work('water'); expect((await camp()).camp.water).toBe(water - 1);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await camp()).camp.water).toBe(water - 1);
  await work('inspectCollar'); await work('removeCollar');
  expect((await camp()).camp.attempts).toMatchObject([{ success: false }]);
  await work('removeCollar'); expect((await camp()).camp.attempts).toHaveLength(1);
  await page.evaluate(() => window.helixHeresyDebug.configureCastawayForTest({ analysis: 5 }));
  await work('removeCollar');
  s = await snap(); expect(s.flights[0].suppressor.suppressionActive).toBe(false);
  expect(s.stacks.find(x => x.id === s.flights[0].suppressor.physicalStackId).carriedBy).toBe('');
  expect(s.banishments).toHaveLength(2); expect(s.health).toBeGreaterThan(0);
  await page.evaluate(() => window.helixHeresyDebug.advanceCastawayForTest(0));
  await page.locator('[data-workspace-tab="visits"]').click();
  await expect(page.locator('[data-castaway-camp]')).toContainText('physical collar is removed');
  expect(errors).toEqual([]);
});
