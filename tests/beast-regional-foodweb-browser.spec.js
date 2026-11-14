const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { source } = require('./helpers/regional-foodweb-source');
test('regional contacts and single-owner carcass feeding survive a browser reload without private-state disclosure', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastRegionalFoodweb);
  const saved = await page.evaluate(src => {
    const P = window.HelixBeastPopulations, s = P.create(src, { worldId: 'browser-world', runId: 'browser-run' });
    for (const g of [s.groups[0], s.groups[2]]) for (const c of g.cohorts) {
      const used = c.stores.fatKg * .6; c.stores.fatKg -= used; c.massKg -= used;
    }
    P.removeStock(s, 'ground', 'waterL', 0, 0, 'recorded-initial-hunger');
    P.advance(s, P.DAY + 5, true, true);
    if (!s.foodWeb.pending.length) throw Error('No actual original contact was established');
    return JSON.stringify(s);
  }, source([['glasswing-roc', 0, 1], ['storm-kite', 1, 4], ['carrion-lantern', 0, 1]]));
  await page.reload(); await page.waitForFunction(() => window.HelixBeastPopulations);
  const result = await page.evaluate(text => {
    const P = window.HelixBeastPopulations, binding = { worldId: 'browser-world', runId: 'browser-run' };
    const s = P.normalize(JSON.parse(text), binding); if (!s) throw Error('Partial contact failed to normalize');
    const continued = P.rebind(s, binding, { ...binding, runId: 'continued' });
    P.advance(continued, 3 * P.DAY, true, true);
    const before = JSON.stringify(continued); P.advance(continued, 3 * P.DAY, true, true);
    const remains = Object.values(continued.regions[0].remainsBatches);
    return { receipts: continued.foodWeb.receipts, valid: Boolean(P.normalize(continued)),
      noReplay: before === JSON.stringify(continued), independent: s.clock !== continued.clock,
      conserved: remains.every(r => Math.abs(r.initialEdibleKg - r.edibleKg - r.consumedKg - r.decomposedKg) < 1e-7),
      population: P.audit(continued)['population-1'] };
  }, saved);
  expect(result.valid).toBe(true); expect(result.noReplay).toBe(true); expect(result.independent).toBe(true);
  expect(result.conserved).toBe(true); expect(result.receipts.kills).toBeGreaterThan(0);
  expect(result.receipts.consumedKg).toBeGreaterThan(0); expect(result.population.dead).toBe(result.receipts.kills);
  await expect(page.locator('body')).not.toContainText('regional-contact:');
  await expect(page.locator('body')).not.toContainText('huntingRemaining');
  expect(errors).toEqual([]);
});

test('unequal regional clocks restore in the browser without recalculating or settling unrelated accounts', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.HelixBeastPopulationScheduler && window.HelixBeastPopulations);
  const saved = await page.evaluate(src => {
    const P = window.HelixBeastPopulations;
    src.regions.push({ ...JSON.parse(JSON.stringify(src.regions[0])), id: 'unrelated-ground' });
    const s = P.create(src, { worldId: 'regional-clock-browser', runId: 'run' });
    P.removeStock(s, 'ground', 'waterL', 1, P.DAY / 4, 'actual-local-interruption');
    return JSON.stringify(s);
  }, source([['storm-kite', 0, 2]]));
  await page.reload(); await page.waitForFunction(() => window.HelixBeastPopulations);
  const result = await page.evaluate(text => {
    const P = window.HelixBeastPopulations, before = JSON.parse(text), s = P.normalize(before);
    if (!s) throw Error('Regional clocks failed to restore');
    const untouched = JSON.stringify({ region: s.regions[1], rate: s.rates['unrelated-ground'], clock: s.regionClocks['unrelated-ground'] });
    const unchanged = JSON.stringify(s) === text, rebuilds = s.work.regionRebuilds;
    P.settleRegions(s, P.DAY / 3, ['ground']);
    return { unchanged, appliedAt: s.appliedAt, localAt: s.regionClocks.ground.appliedAt,
      noRebuild: rebuilds === s.work.regionRebuilds,
      untouched: untouched === JSON.stringify({ region: s.regions[1], rate: s.rates['unrelated-ground'], clock: s.regionClocks['unrelated-ground'] }),
      valid: Boolean(P.normalize(s)) };
  }, saved);
  expect(result).toEqual({ unchanged: true, appliedAt: 0, localAt: 86400 / 3, noRebuild: true, untouched: true, valid: true });
});
