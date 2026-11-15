const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { source } = require('./helpers/sustenance-source');
for (const phase of ['search', 'eating']) test(`background wildlife and partial ${phase} survive browser reload and continued branching privately`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const src = source({ members: 2, cohorts: 2 });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBackgroundWildlife && window.HelixBeastPopulations);
  const saved = await page.evaluate(({ src, phase }) => {
    const P = window.HelixBeastPopulations, s = P.create(src, { worldId: 'background-browser', runId: 'run' });
    for (const c of s.groups[0].cohorts) c.deathThreshold = 1e12;
    for (let i = 0; i < 1000 && s.nextEventAt < 10 * P.DAY; i++) {
      P.advance(s, s.nextEventAt, true, true);
      const c = s.groups[0].cohorts.find(c => c.foraging?.phase === phase);
      if (c) {
        P.advance(s, s.clock + Math.min(100, (c.foraging.nextAt - s.clock) / 2), true, true);
        return JSON.stringify(s);
      }
    }
    throw Error('No actual wildlife search');
  }, { src, phase });
  await page.reload(); await page.waitForFunction(() => window.HelixBeastPopulations && window.HelixBackgroundWildlife);
  const result = await page.evaluate(text => {
    const P = window.HelixBeastPopulations, W = window.HelixBackgroundWildlife, F = window.HelixBeastForaging;
    const binding = { worldId: 'background-browser', runId: 'run' }, s = P.normalize(JSON.parse(text), binding);
    if (!s) throw Error('Background state failed to normalize');
    const unchanged = JSON.stringify(s) === text, branchBinding = { ...binding, runId: 'continued' };
    const branch = P.rebind(s, binding, branchBinding), oldEaten = F.summary(branch).eatenKg;
    P.advance(branch, 60 * P.DAY, true, true);
    const state = W.summary(branch), before = JSON.stringify(branch);
    P.advance(branch, 70 * P.DAY, false, true);
    return { unchanged, state, paidFeeding: F.summary(branch).eatenKg > oldEaten,
      healthy: branch.groups[0].cohorts.every(c => c.health > .99),
      frozen: before === JSON.stringify(branch), valid: Boolean(P.normalize(branch, branchBinding)),
      independent: JSON.stringify(s) === text, strategic: P.audit(branch)['population-0'] };
  }, saved);
  expect(result.unchanged).toBe(true); expect(result.independent).toBe(true); expect(result.frozen).toBe(true); expect(result.valid).toBe(true);
  expect(result.paidFeeding).toBe(true); expect(result.healthy).toBe(true);
  expect(result.state.born).toBeGreaterThan(0); expect(result.state.hunted).toBeGreaterThan(0); expect(result.state.consumedKg).toBeGreaterThan(0);
  expect(result.state.living + result.state.hunted + result.state.dead).toBe(result.state.original + result.state.born);
  expect(result.strategic.background + result.strategic.dead + result.strategic.detailed).toBe(2);
  await expect(page.locator('body')).not.toContainText('original-prey:smallAnimals');
  await expect(page.locator('body')).not.toContainText('forage-meal:'); expect(errors).toEqual([]);
});
