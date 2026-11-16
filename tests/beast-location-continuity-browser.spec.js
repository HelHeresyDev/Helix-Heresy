const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url'), path = require('node:path');
const { source } = require('../scripts/benchmark-beast-demography');
test('paid nursery positions survive browser reload and hand the same newborn to the shared physical body owner', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const src = source(200, 'beast:storm-kite'); src.regionalFoodWeb = src.spatialContinuity = true;
  const r = src.regions[0]; Object.assign(r, { floor: true, oxygen: true, kind: 'surface' });
  r.nurseries[0].position = { regionId: r.id, eastM: 17, northM: 29, altitudeM: 0 };
  src.groups[0].home = { patchId: r.id, cellId: 'test', eastKm: .017, northKm: .029, depthM: 0 };
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.waitForFunction(() => window.HelixBeastPopulations && window.helixHeresyDebug);
  const saved = await page.evaluate(src => {
    const P = window.HelixBeastPopulations, s = P.create(src, { worldId: 'browser-locations', runId: 'original' });
    P.advance(s, 20 * P.DAY, true, true); return JSON.stringify(s);
  }, src);
  await page.reload(); await page.waitForFunction(() => window.HelixBeastPopulations);
  const result = await page.evaluate(saved => {
    const P = window.HelixBeastPopulations, F = window.HelixBeastRegionalFoodweb;
    const binding = { worldId: 'browser-locations', runId: 'original' }, s = P.normalize(JSON.parse(saved), binding);
    if (!s) throw Error('Positions did not restore');
    const snapshot = JSON.stringify(s), branch = P.rebind(s, binding, { ...binding, runId: 'continued' });
    const g = branch.groups[0], c = g.cohorts.find(c => c.generated && P.count(c)), r = branch.regions[0], ordinal = c.ranges[0][0];
    const before = P.audit(branch)['original-population'], pos = F.position(g, r, c, ordinal), body = F.actor(g, c, ordinal, r, branch.clock);
    const ctx = F.context(r, [body], 0);
    ctx.originalPosition = () => ({ regionId: r.id, cell: body.mapCell, altitudeM: body.bodyPhysics.altitudeM, mode: body.bodyPhysics.mode });
    ctx.originalReserves = () => ({ stamina: c.regional.stamina, mana: c.regional.mana, energy: c.regional.energy });
    const actor = P.claimLocal(branch, g.id, c.id, ordinal, 'actual-nursery-original', branch.clock, ctx);
    if (!actor) throw Error('Original body handoff failed');
    actor.health = 0; actor.status = 'dead'; actor.diedAt = branch.clock;
    P.settleLocalLoss(branch, actor.id, branch.clock, 'actual-local-trauma');
    const after = P.audit(branch)['original-population'];
    const frozen = JSON.stringify(branch); P.advance(branch, 30 * P.DAY, false, true);
    return { position: pos, samePosition: actor.mapCell.x === Math.round(pos.eastM) && actor.mapCell.y === Math.round(pos.northM),
      conserved: after.background === before.background - 1 && after.dead === before.dead + 1,
      original: actor.life.originalMemberId, corpseOwner: branch.details[actor.id].status,
      unchanged: snapshot === saved && JSON.stringify(s) === saved, frozen: JSON.stringify(branch) === frozen,
      valid: Boolean(P.normalize(branch, { ...binding, runId: 'continued' })) };
  }, saved);
  expect(result.position).toMatchObject({ eastM: 17, northM: 29, regionId: 'habitat' });
  expect(result.samePosition).toBe(true); expect(result.conserved).toBe(true); expect(result.corpseOwner).toBe('dead');
  expect(result.original).toContain('birth-stream:'); expect(result.unchanged).toBe(true); expect(result.frozen).toBe(true); expect(result.valid).toBe(true);
  await expect(page.locator('body')).not.toContainText('birth-stream:'); expect(errors).toEqual([]);
});
