const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { source } = require('./helpers/carcass-source');
const P = require('../beast-populations'), C = require('../wildlife-carcasses');
test('local wildlife carcass custody, paid holding and independent branches survive an actual browser reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const raw = source({ animals: true, wind: { x: .5, y: 0 } }), probe = P.create(raw, { worldId: 'probe', runId: 'probe' });
  const pool = probe.regions[0].wildlife.pools.find(p => p.guild === 'smallAnimals' && p.sizeClass === 'large' && p.habitatPatch === 'hotspot-0');
  const p = { regionId: 'ground', eastM: pool.spatial.eastM, northM: pool.spatial.northM, altitudeM: 0 };
  const site = C.query(pool, p, pool.spatial.radiusM * 2).sites[0];
  Object.assign(raw.groups[0].home, { eastKm: site.position.eastM / 1000, northKm: site.position.northM / 1000 });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixWildlifeCarcasses);
  const before = await page.evaluate(raw => {
    const P = window.HelixBeastPopulations, F = window.HelixBeastForaging;
    const binding = { worldId: 'carcass-browser', runId: 'original' }, s = P.create(raw, binding);
    P.advance(s, 180, true, true);
    if (!P.normalize(s, binding)) throw Error('Invalid held carcass');
    localStorage.setItem('private-carcass-fixture', JSON.stringify(s));
    return { eaten: F.summary(s).eatenKg, holding: Boolean(s.groups[0].cohorts[0].windDrift.hold) };
  }, raw);
  expect(before.eaten).toBeGreaterThan(0); expect(before.holding).toBe(true);
  await page.reload(); await page.waitForFunction(() => window.helixHeresyDebug && window.HelixWildlifeCarcasses);
  const after = await page.evaluate(() => {
    const P = window.HelixBeastPopulations, F = window.HelixBeastForaging, W = window.HelixBackgroundWildlife;
    const binding = { worldId: 'carcass-browser', runId: 'original' }, text = localStorage.getItem('private-carcass-fixture');
    const saved = P.normalize(JSON.parse(text), binding);
    if (!saved) throw Error('Carcass custody failed to reload');
    const source = JSON.stringify(saved), a = P.normalize(saved, binding), b = P.rebind(saved, binding, { ...binding, runId: 'continued' });
    P.advance(a, P.DAY, true, true); P.advance(b, P.DAY, true, true);
    const continued = JSON.stringify(a.regions) === JSON.stringify(b.regions) && JSON.stringify(a.groups) === JSON.stringify(b.groups);
    const stopped = JSON.stringify(b); P.advance(b, 2 * P.DAY, false, true);
    return { continued, sourceUnchanged: source === JSON.stringify(saved), frozen: stopped === JSON.stringify(b),
      valid: Boolean(P.normalize(b)), eaten: F.summary(b).eatenKg, wildlifeEaten: W.summary(b).consumedKg,
      hunted: W.summary(b).hunted, heldPositions: Object.values(saved.regions[0].foraging.meals).every(m => !m.field) };
  });
  expect(after).toMatchObject({ continued: true, sourceUnchanged: true, frozen: true, valid: true, hunted: 0, heldPositions: true });
  expect(after.eaten).toBeGreaterThan(before.eaten); expect(after.wildlifeEaten).toBeCloseTo(after.eaten, 7);
  await expect(page.locator('body')).not.toContainText(':corpse:'); expect(errors).toEqual([]);
});
