const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { familySource, travelSource } = require('./helpers/beast-care-sources');
test('browser reload and continued branches preserve partial route stops and actual parental provisioning without public census leaks', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastParentalCare);
  const before = await page.evaluate(({ family, travel }) => {
    const P = window.HelixBeastPopulations, C = window.HelixBeastParentalCare;
    const a = P.create(family, { worldId: 'care-browser', runId: 'original' });
    for (const c of a.groups[0].cohorts) c.deathThreshold = 1e12;
    while (!a.groups[0].cohorts.some(c => c.caregiving)) P.advance(a, a.nextEventAt, true, true);
    const donor = a.groups[0].cohorts.find(c => c.caregiving); P.advance(a, (a.clock + donor.caregiving.until) / 2, true, true);
    const b = P.create(travel, { worldId: 'journey-browser', runId: 'original' }), g = b.groups[0], c = g.cohorts[0];
    const spent = c.stores.fatKg - 2; c.stores.fatKg = 2; c.massKg -= spent; c.deathThreshold = 1e12; c.regional.stamina = 300;
    b.regions[0].outputs = { metabolicWasteKg: spent };
    g.intention = { destination: 'away', chosenAt: 0, departAt: 10 };
    P.removeStock(b, 'ground', 'waterL', 0, 0, 'prepared-real-journey'); P.advance(b, 10, true, true);
    P.advance(b, g.transit.nextStopCheckAt + 100, true, true);
    localStorage.setItem('focused-care-account', JSON.stringify(a)); localStorage.setItem('focused-journey-account', JSON.stringify(b));
    return { paid: C.summary(a), careClock: a.clock, stop: g.transit.stop, journeyClock: b.clock };
  }, { family: familySource(), travel: travelSource() });
  expect(before.paid.givenFoodKg).toBeGreaterThan(0); expect(before.stop.reason).toBe('hunger');
  await page.reload(); await page.waitForFunction(() => window.HelixBeastParentalCare);
  const after = await page.evaluate(() => {
    const P = window.HelixBeastPopulations, C = window.HelixBeastParentalCare, W = window.HelixBackgroundWildlife;
    const a = P.normalize(JSON.parse(localStorage.getItem('focused-care-account'))), b = P.normalize(JSON.parse(localStorage.getItem('focused-journey-account')));
    if (!a || !b) return { valid: false };
    const paid = C.summary(a), careClock = a.clock, journeyClock = b.clock, stop = JSON.parse(JSON.stringify(b.groups[0].transit.stop));
    const ac = P.rebind(a, a, { worldId: a.worldId, runId: 'continued' }), bc = P.rebind(b, b, { worldId: b.worldId, runId: 'continued' });
    P.advance(a, 3 * P.DAY, true, true); P.advance(ac, 3 * P.DAY, true, true);
    P.advance(b, 6 * P.DAY, true, true); P.advance(bc, 6 * P.DAY, true, true);
    const same = JSON.stringify(P.audit(a)) === JSON.stringify(P.audit(ac)) && JSON.stringify(C.summary(a)) === JSON.stringify(C.summary(ac))
      && JSON.stringify(P.audit(b)) === JSON.stringify(P.audit(bc)) && JSON.stringify(W.summary(b)) === JSON.stringify(W.summary(bc));
    const frozen = JSON.stringify(a); P.advance(a, 10 * P.DAY, false, true);
    return { valid: !!P.normalize(a) && !!P.normalize(b), paid, careClock, journeyClock, stop, same,
      frozen: JSON.stringify(a) === frozen, eaten: W.summary(b).consumedKg };
  });
  expect(after).toMatchObject({ valid: true, paid: before.paid, careClock: before.careClock, journeyClock: before.journeyClock, stop: before.stop, same: true, frozen: true });
  expect(after.eaten).toBeGreaterThan(0); expect(errors).toEqual([]);
  await expect(page.locator('body')).not.toContainText('knownLivingCaregivers');
  await expect(page.locator('body')).not.toContainText('firstScarcity');
});

test('browser reload retains independent water delivery during a real food shortage and charges shared care once', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.HelixBeastParentalCare && window.HelixBeastPopulations);
  const before = await page.evaluate(source => {
    const P = window.HelixBeastPopulations, C = window.HelixBeastParentalCare;
    const s = P.create(source, { worldId: 'independent-care-browser', runId: 'original' });
    for (const c of s.groups[0].cohorts) c.deathThreshold = 1e12;
    for (let i = 0; i < 2000 && !s.groups[0].cohorts.some(c => c.caregiving); i++) P.advance(s, s.nextEventAt, true, true);
    const donor = s.groups[0].cohorts.find(c => c.caregiving);
    P.removeStock(s, 'ground', 'meatKg', s.regions[0].stocks.meatKg, s.clock, 'actual-food-loss');
    P.advance(s, s.clock + 10, true, true);
    localStorage.setItem('focused-independent-care', JSON.stringify(s));
    return { paid: C.summary(s), rates: s.extraRates.filter(q => q.kind === 'care'), stamina: donor.regional.stamina };
  }, familySource());
  expect(before.rates.map(q => [q.resource, q.factor])).toEqual([['foodKg', 0], ['waterL', 1]]);
  await page.reload(); await page.waitForFunction(() => window.HelixBeastPopulations);
  const after = await page.evaluate(() => {
    const P = window.HelixBeastPopulations, C = window.HelixBeastParentalCare;
    const s = P.normalize(JSON.parse(localStorage.getItem('focused-independent-care')));
    if (!s) return { valid: false };
    const paid = C.summary(s), rates = s.extraRates.filter(q => q.kind === 'care');
    const branch = P.rebind(s, s, { worldId: s.worldId, runId: 'continued' }), donor = s.groups[0].cohorts[0];
    P.advance(s, s.clock + 15, true, true); P.advance(branch, branch.clock + 15, true, true);
    return { valid: !!P.normalize(s), paid, rates, afterPaid: C.summary(s), stamina: donor.regional.stamina,
      same: JSON.stringify(C.summary(s)) === JSON.stringify(C.summary(branch)) && JSON.stringify(P.audit(s)) === JSON.stringify(P.audit(branch)) };
  });
  expect(after).toMatchObject({ valid: true, same: true, paid: before.paid, rates: before.rates });
  expect(after.afterPaid.foodInputKg).toBe(before.paid.foodInputKg);
  expect(after.afterPaid.waterInputL).toBeGreaterThan(before.paid.waterInputL);
  expect(after.afterPaid.memberSeconds - before.paid.memberSeconds).toBeCloseTo(30, 8);
  expect(before.stamina - after.stamina).toBeCloseTo(1.5, 8); expect(errors).toEqual([]);
});
