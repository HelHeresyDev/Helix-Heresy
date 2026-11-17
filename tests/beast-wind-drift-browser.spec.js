const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { windSource } = require('./helpers/wind-source');
test('actual index dependencies preserve partial wind drift, finite meals and independent continued bindings', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.HelixBeastWindDrift && window.helixHeresyDebug);
  await page.evaluate(src => {
    const P = window.HelixBeastPopulations, s = P.create(src, { worldId: 'wind-browser', runId: 'original' });
    const c = s.groups[0].cohorts[0], spent = c.stores.fatKg - 1;
    c.stores.fatKg = 1; c.massKg -= spent; c.regional.stamina = 300;
    s.regions[0].outputs = { preparedMetabolicWasteKg: spent };
    P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'actual-original-death');
    P.advance(s, 150, true, true); if (!P.normalize(s)) throw Error('Invalid partial advection');
    localStorage.setItem('wind-model-test', JSON.stringify(s));
  }, windSource());
  await page.reload(); await page.waitForFunction(() => window.HelixBeastWindDrift);
  const result = await page.evaluate(() => {
    const P = window.HelixBeastPopulations, original = { worldId: 'wind-browser', runId: 'original' };
    const s = P.normalize(JSON.parse(localStorage.getItem('wind-model-test')), original);
    const branch = P.rebind(s, original, { ...original, runId: 'continued' });
    P.advance(s, 400, true, true); P.advance(branch, 400, true, true);
    const before = JSON.stringify(s), c = s.groups[0].cohorts[0];
    P.advance(s, P.DAY, false, true);
    const same = JSON.stringify(s.groups) === JSON.stringify(branch.groups) && JSON.stringify(s.regions) === JSON.stringify(branch.regions);
    P.advance(branch, 1000, true, true);
    return { same, frozen: JSON.stringify(s) === before, independent: JSON.stringify(s.groups) !== JSON.stringify(branch.groups),
      valid: Boolean(P.normalize(s) && P.normalize(branch)), east: c.regionalPosition.eastM,
      food: c.stores.foodKg, held: Boolean(c.windDrift.hold), meals: Object.keys(s.regions[0].foraging.meals).length };
  });
  expect(result.same).toBe(true); expect(result.valid).toBe(true); expect(result.frozen).toBe(true); expect(result.independent).toBe(true);
  expect(result.east).toBeCloseTo(100, 5); expect(result.food).toBeGreaterThan(0); expect(result.held).toBe(true); expect(result.meals).toBe(1);
  expect(errors).toEqual([]);
});
test('passive biology and finite atmospheric water survive browser reload and continued bindings', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.HelixCarrionLanternBiology && window.helixHeresyDebug);
  const src = windSource({ preyX: 100000 }); src.groups = src.groups.slice(0, 1);
  const r = src.regions[0]; r.humidity = 70; r.seasons.forEach(s => { s.humidity = 70; });
  r.stocks.atmosphericWaterL = r.capacity.atmosphericWaterL = 10;
  await page.evaluate(source => {
    const P = window.HelixBeastPopulations, s = P.create(source, { worldId: 'passive-browser', runId: 'original' });
    P.advance(s, P.DAY / 2, true, true);
    if (!P.normalize(s)) throw Error('Invalid partial moisture transfer');
    localStorage.setItem('passive-lantern-test', JSON.stringify(s));
  }, src);
  await page.reload(); await page.waitForFunction(() => window.HelixCarrionLanternBiology);
  const result = await page.evaluate(() => {
    const P = window.HelixBeastPopulations, original = { worldId: 'passive-browser', runId: 'original' };
    const s = P.normalize(JSON.parse(localStorage.getItem('passive-lantern-test')), original), branch = P.rebind(s, original, { ...original, runId: 'continued' });
    P.advance(s, 2 * P.DAY, true, true); P.advance(branch, 2 * P.DAY, true, true);
    const body = window.HelixWildernessBeasts.actor('beast:carrion-lantern', 'native-original', { x: 0, y: 0, z: 6 }, 'native-population', 0);
    const patch = { humidity: 70, temperatureC: 20, resources: { atmosphericWaterL: 1 } };
    window.HelixCreatureLife.advance(body, P.DAY, { alive: true, local: true, travelling: true, patch: () => patch });
    return { same: JSON.stringify(s.groups) === JSON.stringify(branch.groups) && JSON.stringify(s.regions) === JSON.stringify(branch.regions),
      valid: Boolean(P.normalize(s) && P.normalize(branch)), water: s.regions[0].airMoistureTakenL,
      pool: s.regions[0].stocks.atmosphericWaterL, search: window.HelixBeastForaging.summary(s).searchSeconds,
      nativePool: patch.resources.atmosphericWaterL, nativeMass: body.bodyPhysics.massKg };
  });
  expect(result.same).toBe(true); expect(result.valid).toBe(true); expect(result.search).toBe(0);
  expect(result.water).toBeGreaterThan(.05); expect(result.pool + result.water).toBeCloseTo(10, 8);
  expect(result.nativePool).toBeCloseTo(.97, 8); expect(result.nativeMass).toBeCloseTo(29.95, 8);
  expect(errors).toEqual([]);
});
