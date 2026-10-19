const { test, expect } = require('@playwright/test');
const { fixture, walk, snap, act, tick } = require('./helpers/resident-caretaker');
const { reload } = require('./helpers/field-station');
test.setTimeout(360000);
for (const renderer of ['canvas', 'dom']) test(`${renderer}: original resident separately accepts a known drinking route and consumes finite tank water`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); const f = await fixture(page, renderer);
  expect(await act(page, 'inspect')).toBe(true);
  const prepared = await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState(), site = state.fieldRefuge.site, plan = state.fieldRefuge.staffPlan;
    const b = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builder;
    const kit = state.physicalItemStacks.find(i => i.key === 'fieldShelter' && i.carriedBy === 'scientist');
    // Explicit already-paid, arrived residence is input, not an earned result.
    // Original acceptance/accompaniment have separate browser/model coverage.
    kit.carriedBy = b.actor.id; b.actor.roomId = site.roomId; b.actor.mapCell = plan.doorPort;
    b.resident = { id: 'explicit-prior-residence', actorId: b.actor.id, phase: 'resident', recognizedBodyEpoch: state.scientistIdentity.bodyEpoch,
      signedAt: state.clock, lastAt: state.clock, arrivedAt: state.clock, endsAt: state.clock + 3 * 86400, earned: 0, restSeconds: 0,
      deployed: false, service: null, reason: '', log: [], report: null, kitId: kit.id, plan };
    state.economy.money = 384; b.actor.money = 40;
    const cell = { x: site.layout.origin.x + 4, y: site.layout.origin.y + 2, z: site.layout.origin.z }, port = { ...cell, y: cell.y + 1 };
    const water = window.HelixFieldWater.create();
    window.HelixFieldWater.install(water, { worldId: site.worldId, siteId: site.siteId, roomId: site.roomId, refugeId: site.id, cell, port }, 'resident-water-input', state.clock);
    water.plant.cleanL = 4; water.history.push({ at: state.clock, kind: 'Explicit finite prior batch fixture', cleanL: 4 }); state.fieldWater = water;
    state.fixtures.push({ id: water.plant.fixtureId, typeId: 'manualFieldPurifier', origin: cell, installedAt: state.clock, condition: 100 });
    d.importSurveyExpeditionTestState(state); return { port, plan, endsAt: b.resident.endsAt };
  });
  expect(await act(page, 'waterAccess')).toBe(false); // Original point not yet inspected.
  await walk(page, f.wildRoom, prepared.port); await walk(page, f.wildRoom, prepared.plan.doorPort);
  expect(await act(page, 'waterAccess'), JSON.stringify(await snap(page))).toBe(true);
  let s = await snap(page); expect(s.saved.resident.waterAccess.fixtureId).toBe('resident-water-input');
  expect(s.saved.resident.endsAt).toBe(prepared.endsAt);
  await page.evaluate(() => {
    const d = window.helixHeresyDebug, state = d.exportSurveyExpeditionTestState();
    const b = state.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').foreignSurvey.builder;
    b.actor.needs.thirst = 60;
    for (const i of state.physicalItemStacks.filter(i => i.carriedBy === b.actor.id && i.key === 'drinkingWater')) i.reservedTaskId = 'explicit-withheld-personal-water';
    d.importSurveyExpeditionTestState(state);
  });
  // Leave the real doorway/apron free; no passing through the scientist.
  await walk(page, f.wildRoom, prepared.plan.cratePort); await tick(page, 100); s = await snap(page);
  const water = await page.evaluate(() => window.helixHeresyDebug.fieldWaterSnapshot().saved);
  expect(water.plant.cleanL, JSON.stringify(s.saved.resident)).toBe(3);
  expect(s.saved.actor.needs.thirst).toBeLessThan(45); expect(s.saved.resident.phase).toBe('resident');
  expect(water.history.filter(h => h.kind === 'drank' && h.actorId === f.workerId)).toHaveLength(1);
  expect(s.saved.resident.log.some(l => /no collection, treatment/.test(l.text))).toBe(true);
  await reload(page, renderer); expect((await page.evaluate(() => window.helixHeresyDebug.fieldWaterSnapshot().saved)).plant.cleanL).toBe(3);
  expect(errors).toEqual([]);
});
