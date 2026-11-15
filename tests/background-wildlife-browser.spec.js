const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { source } = require('./helpers/regional-foodweb-source');
const W = require('../background-wildlife');
test('background wildlife and a pending paid search survive browser reload and continued branching privately', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const src = source([['rimefang-pack', 0, 2]]), r = src.regions[0]; r.areaHa = 1;
  r.seasons = Array.from({ length: 4 }, () => ({ temperatureC: 20, renewal: {} }));
  W.apply(src, { allocations: [{ regionId: r.id, pools: [{ id: 'original-background-animals', guild: 'smallAnimals',
    foodKey: 'forageKg', areaHa: 1, habitatDepthM: 0, originalCount: 1000, originalMassKg: 2000, capacityCount: 1500 }] }] });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBackgroundWildlife && window.HelixBeastPopulations);
  const saved = await page.evaluate(src => {
    const P = window.HelixBeastPopulations, s = P.create(src, { worldId: 'background-browser', runId: 'run' });
    const c = s.groups[0].cohorts[0], spent = c.stores.fatKg * .6; c.stores.fatKg -= spent; c.massKg -= spent;
    P.removeStock(s, 'ground', 'waterL', 0, 0, 'original-paid-hunger');
    for (let day = 1; day <= 10; day++) {
      P.advance(s, day * P.DAY, true, true);
      const pending = s.regions[0].wildlife.pending[0];
      if (pending) { P.advance(s, pending.startedAt + 100, true, true); return JSON.stringify(s); }
    }
    throw Error('No actual wildlife search');
  }, src);
  await page.reload(); await page.waitForFunction(() => window.HelixBeastPopulations && window.HelixBackgroundWildlife);
  const result = await page.evaluate(text => {
    const P = window.HelixBeastPopulations, W = window.HelixBackgroundWildlife;
    const binding = { worldId: 'background-browser', runId: 'run' }, s = P.normalize(JSON.parse(text), binding);
    if (!s) throw Error('Background state failed to normalize');
    const unchanged = JSON.stringify(s) === text, branchBinding = { ...binding, runId: 'continued' };
    const branch = P.rebind(s, binding, branchBinding);
    P.advance(branch, 60 * P.DAY, true, true);
    const state = W.summary(branch), before = JSON.stringify(branch);
    P.advance(branch, 70 * P.DAY, false, true);
    return { unchanged, state, frozen: before === JSON.stringify(branch), valid: Boolean(P.normalize(branch, branchBinding)),
      independent: JSON.stringify(s) === text, strategic: P.audit(branch)['population-0'] };
  }, saved);
  expect(result.unchanged).toBe(true); expect(result.independent).toBe(true); expect(result.frozen).toBe(true); expect(result.valid).toBe(true);
  expect(result.state.born).toBeGreaterThan(0); expect(result.state.hunted).toBeGreaterThan(0); expect(result.state.consumedKg).toBeGreaterThan(0);
  expect(result.state.living + result.state.hunted + result.state.dead).toBe(result.state.original + result.state.born);
  expect(result.strategic.background + result.strategic.dead + result.strategic.detailed).toBe(2);
  await expect(page.locator('body')).not.toContainText('original-background-animals');
  await expect(page.locator('body')).not.toContainText('wildlife-search:'); expect(errors).toEqual([]);
});
