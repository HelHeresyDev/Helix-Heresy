const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { source } = require('./helpers/drainage-source');
test('finite overbank water, obstruction and real discharge survive browser reload and continued import', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.helixHeresyDebug && window.HelixBeastRegionalFlood);
  await page.evaluate(src => {
    const P = window.HelixBeastPopulations, s = P.create(src, { worldId: 'flood-browser-world', runId: 'run' });
    P.setDrainageObstruction(s, 'upstream', true, 0, 'actual-landslide');
    P.advance(s, P.DAY, true, true);
    localStorage.setItem('finite-drainage-control', JSON.stringify(s));
  }, source({ rain: 5000, outlet: 10000 }));
  await page.reload(); await page.waitForFunction(() => window.HelixBeastRegionalFlood);
  const loaded = await page.evaluate(() => {
    const P = window.HelixBeastPopulations, s = P.normalize(JSON.parse(localStorage.getItem('finite-drainage-control')));
    if (!s) throw Error('Original flood ledger did not normalize');
    const originalWaterL = s.regions[0].flood.waterL, wasBlocked = s.regions[0].ecology.watercourses[0].outlet.blocked;
    P.setDrainageObstruction(s, 'upstream', false, s.clock, 'actual-clearance');
    const branch = P.rebind(s, { worldId: s.worldId, runId: s.runId }, { worldId: s.worldId, runId: 'continued' });
    P.advance(s, 1.5 * P.DAY, true, true); P.advance(branch, 1.5 * P.DAY, true, true);
    const partialWaterL = s.regions[0].flood.waterL;
    P.advance(s, 3 * P.DAY, true, true); P.advance(branch, 3 * P.DAY, true, true);
    return { originalWaterL, wasBlocked, partialWaterL, finalWaterL: s.regions[0].flood.waterL,
      drainedL: s.regions[0].flood.dischargedL, terminalL: s.regions[1].outputs.waterLOverflow,
      soil: s.regions[0].condition.soilCover, same: JSON.stringify(s.regions) === JSON.stringify(branch.regions), valid: Boolean(P.normalize(s)) };
  });
  expect(loaded.originalWaterL).toBeCloseTo(5000); expect(loaded.wasBlocked).toBe(true);
  expect(loaded.partialWaterL).toBeCloseTo(2500); expect(loaded.finalWaterL).toBeCloseTo(0);
  expect(loaded.drainedL).toBeCloseTo(10000); expect(loaded.terminalL).toBeCloseTo(15000);
  expect(loaded.soil).toBeCloseTo(79.995); expect(loaded.same).toBe(true); expect(loaded.valid).toBe(true);
  expect(errors).toEqual([]);
});
