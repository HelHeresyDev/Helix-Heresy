const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { source } = require('../scripts/benchmark-beast-regional-ecology');

test('browser dependency order and internal regional work survive a serialized partial-work continuation', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastRegionalEcology);
  // The model is deliberately not adopted into live encounters. Exercise its
  // actual browser dependencies and its own serializer, not a fake native save.
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const saved = await page.evaluate(src => {
    const P = window.HelixBeastPopulations, binding = { worldId: 'browser-world', runId: 'browser-run' };
    const s = P.create(src, binding); P.advance(s, P.DAY / 2, true, true);
    return JSON.stringify(s);
  }, source());
  await page.reload(); await page.waitForFunction(() => window.HelixBeastRegionalEcology);
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const result = await page.evaluate(saved => {
    const P = window.HelixBeastPopulations, binding = { worldId: 'browser-world', runId: 'browser-run' };
    const s = P.normalize(JSON.parse(saved), binding);
    if (!s) throw Error('Regional partial work did not normalize');
    const planCount = s.plans.length;
    P.advance(s, P.DAY, true, true);
    return { soil: s.regions[0].condition.soilCover, biomass: s.regions[0].outputs.rootedBiomassKg,
      samePlan: s.plans.length === planCount, exhausted: s.regions[0].exhausted,
      minerals: s.regions[0].stocks.mineralsKg, valid: Boolean(P.normalize(s)) };
  }, saved);
  expect(result.soil).toBeCloseTo(83.2, 6); expect(result.biomass).toBeCloseTo(150, 6);
  expect(result.minerals).toBeCloseTo(2000000 - 1320, 6);
  expect(result.samePlan).toBe(true); expect(result.exhausted).toBe(false); expect(result.valid).toBe(true);
  expect(errors).toEqual([]);
});
