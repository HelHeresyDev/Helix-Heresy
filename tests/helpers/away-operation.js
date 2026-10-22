const { expect } = require('@playwright/test');
const { fixture: refugeFixture } = require('./resident-caretaker');
const snap = page => page.evaluate(() => window.helixHeresyDebug.awayOperationSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.awayOperationAction(action, options), { action, options });
const tick = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceAwayOperationForTest(n), n);
async function walk(page, room, cell) {
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell })), { room, cell })).toBe(true);
  for (let n = 0; n < 8; n++) {
    if (!(await snap(page)).tasks.length) return;
    await page.evaluate(() => window.helixHeresyDebug.advanceAwayOperationForTest(120, { stopOnIdle: true }));
  }
  throw Error(`Scientist walk blocked: ${JSON.stringify((await snap(page)).tasks)}`);
}
async function until(page, predicate, limit = 180, step = 10) {
  let previousPhase = null;
  for (let n = 0; n < limit; n++) {
    const s = await snap(page); if (predicate(s)) return s;
    if (s.saved.mission.phase !== previousPhase || n % 30 === 0) console.info(`Local freight: ${s.saved.mission.phase}, ${JSON.stringify(s.driver?.mapCell)}, ${s.saved.mission.progress}`);
    previousPhase = s.saved.mission.phase;
    await tick(page, step);
  }
  const s = await snap(page);
  throw Error(`Local operation stalled: ${JSON.stringify({ saved: s.saved, driver: s.driver, context: { ...s.context, definitions: undefined }, items: s.items })}`);
}
async function setup(page, renderer, prepare = null, afterInspection = null) {
  page.setDefaultTimeout(30000);
  const f = await refugeFixture(page, renderer);
  console.info(`${renderer}: original refuge fixture ready`);
  if (prepare) await prepare(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.residentCaretakerAction('inspect'))).toBe(true);
  const result = await page.evaluate(f => {
    const d = window.helixHeresyDebug;
    const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional', provisioning: 'functional' } };
    const standings = [{ standing: 'licensed', network: { id: 'commercial:b', category: 'commercial', roles: ['procurement'], prohibitions: [] },
      branch: { id: 'supplier:b', publicName: 'Birch Supply', currentCityId: 'b', publicPhysicalPresence: true,
        physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }];
    d.setForeignSuppliesTestContext({ city, standings, market: { listings: { drinkingWater: { supply: 50, demand: 1 }, trailMeal: { supply: 50, demand: 1 } } } });
    const s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b'), e = g.foreignSurvey;
    const dest = s.fieldRefuge.site, b = e.builder, at = s.clock, plan = s.fieldRefuge.staffPlan;
    // Explicit prior residence and finite original stock are inputs, not outcomes.
    const kit = s.physicalItemStacks.find(i => i.key === 'fieldShelter' && i.carriedBy === 'scientist');
    b.actor.mapCell = plan.sleep; b.actor.roomId = dest.roomId;
    b.resident = { id: 'original-prior-residence', actorId: b.actor.id, phase: 'resident', recognizedBodyEpoch: s.scientistIdentity.bodyEpoch,
      signedAt: at, lastAt: at, arrivedAt: at, endsAt: at + 3 * 86400, earned: 0, restSeconds: 0, deployed: true, service: null, reason: '', log: [], report: null,
      kitId: kit.id, plan };
    kit.carriedBy = ''; kit.roomId = dest.roomId; kit.cell = plan.sleep; kit.reservedTaskId = b.resident.id;
    for (const i of s.physicalItemStacks) if (['drinkingWater', 'trailMeal'].includes(i.key) && (i.carriedBy === b.actor.id || i.fixtureId === dest.cacheId)) i.quantity = i.knownQuantity = 1;
    const heater = s.fixtures.find(i => i.id === dest.heaterId); heater.utility.enabled = true; heater.utility.fuel = 1;
    const counter = { x: 12, y: 10, z: e.entry.z }, stand = { ...counter, x: 13 }, away = { ...counter, y: 12, x: 15 };
    g.visitorSupplies = window.HelixForeignSupplies.create(city, standings, at, { roomId: e.roomId, cell: counter });
    for (const key of ['drinkingWater', 'trailMeal']) s.physicalItemStacks.push({ id: `stack-${s.nextPhysicalItemStackNumber++}`, key, quantity: 6, knownQuantity: 6,
      section: 'inventory', carriedBy: 'scientist', roomId: dest.roomId, cell: dest.layout.rest, sourceLabels: ['Original paid personal provisions fixture'] });
    s.wildernessSurvival.autoCare = true;
    d.importSurveyExpeditionTestState(s);
    return { ...f, stand, away, counter, plan };
  }, f);
  expect(await act(page, 'inspect'), JSON.stringify(await snap(page))).toBe(true);
  console.info(`${renderer}: original staffed refuge inspected`);
  if (afterInspection) await afterInspection(page);
  await walk(page, result.room, result.stand);
  console.info(`${renderer}: personally reached original local supplier`);
  return result;
}
module.exports = { setup, snap, act, tick, walk, until };
