const { test, expect } = require('@playwright/test');
const { fixture, walk, snap, act, tick } = require('./helpers/resident-caretaker');
const { reload } = require('./helpers/field-station');
test.setTimeout(1080000);
for (const renderer of ['canvas', 'dom']) test(`${renderer}: resident consent, physical arrival, saved independent fuel tending and dated reports`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await fixture(page, renderer);
  expect(await act(page, 'inspect'), JSON.stringify((await snap(page)).context)).toBe(true);
  console.info('Inspected the original supplied refuge and connected route.');
  await walk(page, f.room, { ...f.home, x: f.home.x + 1 });
  await page.getByRole('button', { name: 'Give original sleeping kit to craftsperson', exact: true }).click();
  let s = await snap(page); expect(s.context.kitId).toBeTruthy(); const kitId = s.context.kitId;
  await page.getByRole('button', { name: 'Review separate resident caretaker terms', exact: true }).click(); s = await snap(page);
  expect(s.saved.residentQuote, JSON.stringify(s.context)).toBeTruthy();
  expect(await act(page, 'accept', { expected: {} })).toBe(false);
  await page.getByRole('button', { name: 'Accept exact three-day resident agreement', exact: true }).click();
  s = await snap(page); expect(s.money).toBe(384); expect(s.saved.actor.id).toBe(f.workerId);
  console.info('Accepted the separate resident agreement with original kit and finite escrow.');
  expect(await page.evaluate(() => window.helixHeresyDebug.fieldBuilderAction('review'))).toBe(false);
  await tick(page, 5); expect((await snap(page)).saved.resident.arrivedAt).toBeNull();
  const route = s.saved.resident.plan.route;
  for (let i = 1; i < route.length; i += 3) {
    await walk(page, i < 6 ? f.room : f.wildRoom, route[i]); await tick(page, 7);
  }
  // Finish at an adjacent nonblocking interior tile, leaving the sleeping
  // position and actual heater/crate access free for the original worker.
  await walk(page, f.wildRoom, f.l.rest); await tick(page, 30);
  s = await snap(page); expect(s.saved.resident.phase, JSON.stringify({ pos: s.saved.actor.mapCell, reason: s.saved.resident.reason })).toBe('resident');
  console.info('Physically accompanied the original worker to the refuge.');
  await tick(page, 80); s = await snap(page); expect(s.saved.resident.service?.progress).toBeGreaterThan(0);
  const partial = s.saved.resident.service; await reload(page, renderer); s = await snap(page);
  expect(s.saved.resident.service).toEqual(partial); expect(s.saved.resident.kitId).toBe(kitId);
  await walk(page, f.wildRoom, f.l.apron); await tick(page, 180);
  s = await snap(page); const heater = s.fixtures.find(i => i.id === s.saved.resident.plan.heaterId);
  expect(heater.utility.enabled, JSON.stringify({ worker: s.saved.actor.mapCell, r: s.saved.resident, context: s.context })).toBe(true);
  expect(heater.utility.fuel).toBeGreaterThan(.9); expect(heater.utility.fuel).toBeLessThan(1);
  expect(s.stacks.find(i => i.fixtureId === s.saved.resident.plan.cacheId && i.key === 'fuelReagent').quantity).toBe(1);
  expect(s.stacks.find(i => i.id === kitId).reservedTaskId).toBe(s.saved.resident.id);
  expect(s.saved.resident.report).toBeNull();
  const q = s.saved.resident.plan;
  await walk(page, f.wildRoom, q.cratePort); expect(await act(page, 'report')).toBe(true);
  const report = (await snap(page)).saved.resident.report;
  await walk(page, f.wildRoom, f.l.apron); await tick(page, 30); expect((await snap(page)).saved.resident.report).toEqual(report);
  await reload(page, renderer); expect((await snap(page)).saved.resident.report).toEqual(report);
  expect(errors).toEqual([]);
});
