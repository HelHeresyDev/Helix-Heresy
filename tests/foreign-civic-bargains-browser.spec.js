const { test, expect } = require('@playwright/test');
const { openForeignWorkspace, workspace, advance, wa, finish } = require('./helpers/foreign-assay-visit');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignCivicBargainSnapshot());
const action = (page, action, expected = null) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.foreignCivicBargainAction(action, expected), { action, expected });
async function reload(page) { await page.reload(); await page.locator('#loadLastSaveBtn').click(); await page.locator('[data-workspace-tab="visits"]').click(); }
test('canvas foreign civic audience carries actual parts, shares finite clerk duty, saves interrupted work and releases only one fulfilled dated approach chart', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openForeignWorkspace(page, 'foreign-civic-bargain', 'canvas', false, false, 6);
  expect(await wa(page, 'return')).toBe(true); await finish(page);
  expect((await snap(page)).civic).toBeFalsy();
  const source = { cityId: 'b', charterId: 'charter:b', administrationId: 'admin:b', defenseId: 'defense:b', defenseName: 'B Defense',
    populationSourceId: 'population:b', authority: { id: 'ruler:b', kind: 'collective', name: 'B Council' },
    archive: { routeId: 'route:bc', source: 'B retained city-end chart', sourceDate: null,
      coverage: [{ cellId: 'planet-cell:00001', latitude: 12, longitude: 20 }, { cellId: 'planet-cell:00002', latitude: 16, longitude: 21 }], notes: ['City end only; all material surveys withheld.'] } };
  expect(await page.evaluate(source => window.helixHeresyDebug.setForeignCivicBargainTestSource(source), source)).toBe(true);
  await page.locator('[data-workspace-tab="visits"]').click(); const panel = page.locator('[data-foreign-civic-bargain]');
  const before = await snap(page), g = await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate);
  const trading = g.visitorAdmission.permits[0]; expect(before.civic.introduction).toBeNull(); expect(before.civic.bargain.depot.stock).toBe(0);
  expect(await action(page, 'request')).toBe(false); expect(before.knownAlignment).toEqual([]);
  const originalParts = before.stacks.find(i => i.key === 'metalParts' && i.carriedBy === 'scientist'); expect(originalParts.quantity).toBe(6);
  // Put the original departure consignment down at the desk and carry only two:
  // the other four remain real owned floor cargo, not a second test endowment.
  expect(await page.evaluate(id => window.helixHeresyDebug.dropActorStack('scientist', id), originalParts.id)).toBeTruthy();
  expect(await page.evaluate(id => window.helixHeresyDebug.carryActorStack('scientist', id, 2), originalParts.id)).toBeTruthy();
  await panel.getByRole('button', { name: 'Review separate foreign civic access terms', exact: true }).click();
  await advance(page, 30); let s = await snap(page); expect(s.civic.accessJob.progress).toBe(30); await reload(page);
  expect((await snap(page)).civic.accessJob.progress).toBe(30); await advance(page, 30);
  await panel.getByRole('button', { name: 'Accept exact foreign civic counter access', exact: true }).click(); await advance(page, 60);
  s = await snap(page); expect(s.civic.permits[0].scope).toBe('foreignCivicSupplyCounterOnly'); expect(s.duty).toBe(before.duty - 120);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().gate.visitorAdmission.permits[0])).toEqual(trading);
  await panel.getByRole('button', { name: 'Request foreign defense-supply audience', exact: true }).click();
  await advance(page, 300); await panel.getByRole('button', { name: 'Attend foreign defense-supply audience', exact: true }).click();
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('review', window.helixHeresyDebug.foreignReceptionSnapshot().quote))).toBe(false);
  expect(await wa(page, 'walk')).toBe(false); await advance(page, 450); expect((await snap(page)).civic.bargain.job.progress).toBe(450);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignCivic.bargain.defender.health = 0; d.importSurveyExpeditionTestState(s); });
  await advance(page, 120); expect((await snap(page)).civic.bargain.job.progress).toBe(450); await reload(page);
  expect((await snap(page)).civic.bargain.defender.health).toBe(0);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignCivic.bargain.defender.health = 100; d.importSurveyExpeditionTestState(s); });
  await advance(page, 60); expect((await snap(page)).civic.bargain.job.progress).toBe(450); await advance(page, 450);
  s = await snap(page); expect(s.civic.bargain.terms.status).toBe('offered'); expect(s.civic.bargain.terms.disclosure).toContain('opposes the gods');
  await panel.getByRole('button', { name: 'Sign exact foreign defense-supply bargain', exact: true }).click();
  await panel.getByRole('button', { name: 'Hand over carried foreign defense supplies', exact: true }).click();
  s = await snap(page); expect(s.civic.bargain.depot.stock).toBe(2); expect(s.knownAlignment).toEqual([]);
  expect(await action(page, 'claim')).toBe(false); await reload(page); expect((await snap(page)).civic.bargain.depot.stock).toBe(2);
  expect(await page.evaluate(id => window.helixHeresyDebug.carryActorStack('scientist', id, 4), originalParts.id)).toBeTruthy();
  await panel.getByRole('button', { name: 'Hand over carried foreign defense supplies', exact: true }).click();
  s = await snap(page); expect(s.civic.bargain.depot.stock).toBe(6); expect(s.civic.bargain.depot.receipts).toHaveLength(2);
  await panel.getByRole('button', { name: 'Copy fulfilled foreign restricted approach extract', exact: true }).click();
  await advance(page, 150); expect((await snap(page)).knownAlignment).toEqual([]); await reload(page); await advance(page, 150);
  s = await snap(page); expect(s.knownAlignment).toHaveLength(1); expect(s.knownAlignment[0].coverage).toEqual(source.archive.coverage);
  expect(s.money).toBe(before.money); expect(s.homeBargain).toEqual(before.homeBargain); expect(s.civic.bargain.defender.id).toBe('defense:b:ward-defender');
  expect(s.stacks.some(i => i.key === 'metalParts' && i.carriedBy === 'scientist')).toBe(false);
  await expect(panel.locator('[data-foreign-approach-extract]')).toContainText('No resource surveys');
  await expect(panel.locator('[data-foreign-approach-extract] canvas')).toHaveCount(1);
  expect(await action(page, 'claim')).toBe(false); const chart = s.knownAlignment[0]; await reload(page); expect((await snap(page)).knownAlignment).toEqual([chart]);
  expect(await wa(page, 'walk')).toBe(true); await finish(page); const dated = (await snap(page)).civic.knowledge;
  await advance(page, 60); expect((await snap(page)).civic.knowledge).toEqual(dated); expect(await action(page, 'request')).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const frozen = (await snap(page)).civic; await advance(page, 120);
  expect((await snap(page)).civic).toEqual(frozen); expect(errors).toEqual([]);
});
