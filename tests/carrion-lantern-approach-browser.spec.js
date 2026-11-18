const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { windSource } = require('./helpers/wind-source');
test('sensed regional and native approaches retain partial movement, paid effort and independent reload branches', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixCarrionLanternApproach);
  await page.evaluate(source => {
    const P = window.HelixBeastPopulations, W = window.HelixWildernessBeasts, C = window.HelixBeastBehavior, B = window.HelixBeastBodies;
    const account = P.create(source, { worldId: 'approach-browser', runId: 'original' });
    account.groups[0].cohorts[0].regional.stamina = 300;
    P.kill(account, account.groups[1].id, account.groups[1].cohorts[0].id, 0, 0, 'real-carcass');
    P.advance(account, 20, true, true);
    if (account.groups[0].cohorts[0].foraging.phase !== 'approach' || !P.normalize(account)) throw Error('No valid earned regional approach');
    const a = W.actor('beast:carrion-lantern', 'native-lantern', { x: 0, y: 0, z: 6 }, 'original', 0);
    const corpse = W.actor('beast:rimefang-pack', 'native-corpse', { x: 20, y: 12, z: 6 }, 'prey', 0);
    corpse.status = 'dead'; corpse.health = 0; corpse.diedAt = 0; a.life.stores.fatKg = 0;
    const terrain = () => ({ floor: true, ceilingM: 100, supportKg: 1e8, oxygen: true, wind: { x: 0, y: 0 }, resources: {} });
    const ctx = { alive: true, local: true, actors: [a, corpse], tileSizeM: 1, terrain, patch: terrain,
      signal: () => true, effectLine: () => true, lightAt: () => 100, blocked: () => false };
    for (let at = 1; at <= 20; at++) { C.step(a, { behavior: 'roam' }, null, at, 1, ctx); B.advance(a, at, ctx); }
    if (!a.life.carrionApproach || !(a.bodyPhysics.spentStamina > 0) || a.life.stores.foodKg) throw Error('Invalid partial native approach');
    if (!(B.position(a).eastM > 0 && B.position(a).northM > 0 && B.valid(a))) throw Error('Native vector motion lost a component');
    localStorage.setItem('lantern-approach-test', JSON.stringify({ account, a, corpse }));
  }, windSource({ preyX: 20, wind: { x: 0, y: .2 } }));
  await page.reload(); await page.waitForFunction(() => window.HelixCarrionLanternApproach);
  const result = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('lantern-approach-test')), P = window.HelixBeastPopulations;
    const original = { worldId: 'approach-browser', runId: 'original' }, account = P.normalize(saved.account, original);
    const branch = P.rebind(account, original, { ...original, runId: 'continued' });
    P.advance(account, 250, true, true); P.advance(branch, 250, true, true);
    const native = [saved, JSON.parse(JSON.stringify(saved))];
    for (const { a, corpse } of native) {
      const terrain = () => ({ floor: true, ceilingM: 100, supportKg: 1e8, oxygen: true, wind: { x: 0, y: 0 }, resources: {} });
      const ctx = { alive: true, local: true, actors: [a, corpse], tileSizeM: 1, terrain, patch: terrain,
        signal: () => true, effectLine: () => true, lightAt: () => 100, blocked: () => false };
      for (let at = 21; at <= 100 && !a.life.stores.foodKg; at++) { window.HelixBeastBehavior.step(a, { behavior: 'roam' }, null, at, 1, ctx); window.HelixBeastBodies.advance(a, at, ctx); }
    }
    const same = JSON.stringify(account.groups) === JSON.stringify(branch.groups) && JSON.stringify(native[0].a) === JSON.stringify(native[1].a);
    const frozen = JSON.stringify(account); P.advance(account, P.DAY, false, true);
    return { same, valid: Boolean(P.normalize(account) && P.normalize(branch)), frozen: frozen === JSON.stringify(account),
      nativeFood: native[0].a.life.stores.foodKg, nativeCost: native[0].a.bodyPhysics.spentStamina,
      regionalFood: account.groups[0].cohorts[0].stores.foodKg,
      approachSeconds: window.HelixBeastForaging.summary(account).approachSeconds };
  });
  expect(result.same).toBe(true); expect(result.valid).toBe(true); expect(result.frozen).toBe(true);
  expect(result.nativeFood).toBeGreaterThan(0); expect(result.nativeCost).toBeGreaterThan(0);
  expect(result.regionalFood).toBeGreaterThan(0); expect(result.approachSeconds).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
