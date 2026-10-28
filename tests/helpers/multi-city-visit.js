const { expect } = require('@playwright/test');
const { startLifecycleRun } = require('./start-lifecycle-run');
const { prepareHome } = require('./multi-city-home');
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceForeignReceptionTestTime(n), seconds);
async function finish(page) {
  for (let i = 0; i < 15; i++) {
    const s = await page.evaluate(() => window.helixHeresyDebug.surveyExpeditionSnapshot());
    const t = s.tasks.find(t => !t.reason); if (!t) return;
    await advance(page, Math.max(1, t.dueAt - s.clock + 1));
  }
  throw new Error('Original passenger movement did not finish');
}
async function visit(page, renderer, options = {}) {
  page.setDefaultTimeout(30000); await startLifecycleRun(page, `multi-city-${renderer}`);
  if (options.prepareHome) await options.prepareHome(page, renderer);
  else await prepareHome(page, renderer);
  if (options.beforeDeparture) await options.beforeDeparture(page);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug;
    d.setIntercityPassengerTestContext({ city: { cityId: 'a', currentPopulation: 3000, physicalCondition: 'intact', services: { transport: 'functional' } },
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'original-carrier:a', publicName: 'Original Carrier', capacityBand: 'functional', operationalStatus: 'active' } }],
      network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [
        { id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }], destinations: [
        { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
        ...['a', 'b'].map(id => ({ id: `city:${id}`, cityId: id, label: `City ${id}`, kind: 'fortifiedCity', known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' })) ] } });
    d.setForeignReceptionTestContext({ source: { cityId: 'b', currentPopulation: 3000, physicalCondition: 'intact', administrationId: 'admin:b', administrationName: 'B Administration',
      capacityBand: 'functional', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, recognition: 'verified', localRules: [] } });
    // Explicit original departure cargo; normal packing and passenger limits
    // remain unchanged. No assay equipment or extra vehicle capacity is added.
    const ids = d.configureHiddenWorkshopTest({ supplies: { metalParts: 18 } });
    if (!d.carryActorStack('scientist', ids[0], 18)) throw new Error('Original maintenance cargo does not fit the actual backpack');
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Original paid passenger booking refused');
  });
  await finish(page); await advance(page, 1600);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await advance(page, 180);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await advance(page, 60);
}
module.exports = { visit, finish };
