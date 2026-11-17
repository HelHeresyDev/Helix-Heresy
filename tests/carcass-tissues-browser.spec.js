const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
test('native tissue leftovers survive browser reload and a Lantern consumes the same remaining animal mass', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixCarcassTissues);
  const partial = await page.evaluate(() => {
    const W = window.HelixWildernessBeasts, C = window.HelixBeastBehavior, F = window.HelixBeastPredation;
    const cell = { x: 0, y: 0, z: 6 };
    const actors = ['rimefang-pack', 'carrion-lantern', 'storm-kite'].map(id => W.actor(`beast:${id}`, id, cell, `original:${id}`, 0));
    const [wolf, lantern, corpse] = actors; wolf.life.stores.fatKg = lantern.life.stores.fatKg = 0;
    corpse.status = 'dead'; corpse.health = 0; corpse.diedAt = 0;
    const ctx = { alive: true, local: true, tileSizeM: 1, signal: () => true, effectLine: () => true, lightAt: () => 100 };
    const initial = F.remains(corpse, 0).initialEdibleKg;
    if (!C.consumeRemains(wolf, corpse, 600, 600, ctx)) throw Error('No actual native meal');
    localStorage.setItem('typed-carcass-test', JSON.stringify(actors));
    return { initial, flesh: corpse.life.remains.tissues.flesh.kg, hard: corpse.life.remains.tissues.hard.kg };
  });
  expect(partial.flesh).toBeCloseTo(0, 10); expect(partial.hard).toBeGreaterThan(0);
  await page.reload(); await page.waitForFunction(() => window.HelixCarcassTissues);
  const result = await page.evaluate(() => {
    const actors = JSON.parse(localStorage.getItem('typed-carcass-test')), [, lantern, corpse] = actors;
    const C = window.HelixBeastBehavior, F = window.HelixBeastPredation;
    const ctx = { alive: true, local: true, tileSizeM: 1, signal: () => true, effectLine: () => true, lightAt: () => 100 };
    const validBefore = F.validRemains(corpse);
    C.consumeRemains(lantern, corpse, 600, 1200, ctx);
    const r = corpse.life.remains, before = JSON.stringify(r);
    C.consumeRemains(lantern, corpse, 600, 1200, ctx);
    return { validBefore, valid: F.validRemains(corpse), same: before === JSON.stringify(r),
      hardEaten: r.tissues.hard.consumedKg, remaining: r.edibleKg,
      accounted: r.massKg + r.consumedKg + r.decomposedKg, minerals: lantern.life.emitted.carrionMineralsKg };
  });
  expect(result.validBefore).toBe(true); expect(result.valid).toBe(true); expect(result.same).toBe(true);
  expect(result.hardEaten).toBeGreaterThan(0); expect(result.remaining).toBeCloseTo(0, 10);
  expect(result.accounted).toBeCloseTo(partial.initial, 10); expect(result.minerals).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
