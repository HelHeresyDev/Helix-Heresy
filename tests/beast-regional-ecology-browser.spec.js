const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { source } = require('../scripts/benchmark-beast-regional-ecology');
const { source: workSource } = require('./helpers/regional-work-source');

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

test('all eight browser work adapters retain paid transfers and original structures across a partial-work reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const actions = ['tendWetland', 'cultivateReef', 'buildDam', 'growBlooms', 'buildFurnace', 'dreamWeather', 'filterMana', 'filterPlankton'];
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastRegionalWork);
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const saved = await page.evaluate(sources => {
    const P = window.HelixBeastPopulations;
    return sources.map(src => {
      const s = P.create(src, { worldId: 'browser-world', runId: src.id });
      P.advance(s, P.DAY / 2, true, true); return JSON.stringify(s);
    });
  }, actions.map(action => workSource(action)));
  await page.reload(); await page.waitForFunction(() => window.HelixBeastRegionalWork);
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'beast-populations.js') });
  const results = await page.evaluate(records => records.map(text => {
    const P = window.HelixBeastPopulations, s = P.normalize(JSON.parse(text));
    if (!s) throw Error('Unsupported partial regional work');
    P.advance(s, P.DAY, true, true);
    const r = s.regions[0], action = s.groups[0].ecology.action;
    return { action, valid: Boolean(P.normalize(s)), work: r.ecologicalReceipts[action],
      reef: r.stocks.livingReefKg, bloom: r.stocks.bloomKg, mana: r.stocks.excessMana,
      plankton: r.stocks.planktonKg, passed: r.watercourseReceipts?.passedL || 0 };
  }), saved);
  expect(results.map(r => r.action)).toEqual(actions); expect(results.every(r => r.valid && r.work > 0)).toBe(true);
  expect(results.find(r => r.action === 'cultivateReef').reef).toBeCloseTo(125);
  expect(results.find(r => r.action === 'growBlooms').bloom).toBeCloseTo(102);
  expect(results.find(r => r.action === 'filterMana').mana).toBeCloseTo(9940);
  expect(results.find(r => r.action === 'filterPlankton').plankton).toBeCloseTo(960000);
  expect(results.find(r => r.action === 'buildDam').passed).toBeCloseTo(2000);
  expect(errors).toEqual([]);
});
