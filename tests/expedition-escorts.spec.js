const { test, expect } = require('@playwright/test');
const Escorts = require('../expedition-escorts');
const { pathToFileURL } = require('url');
const path = require('path');
const cell = (x, y = 12) => ({ x, y, z: 6 });
test('escort identity, fees, bounded wage accrual, and exactly-once refunds persist', () => {
  const actor = Escorts.candidate('seed', { id: 'city:a', label: 'Aster' });
  expect(Escorts.candidate('seed', { id: 'city:a', label: 'Aster' })).toEqual(actor);
  const contract = Escorts.start(1, 0, 2);
  expect(contract.upfront).toBe(100);
  Escorts.accrue(contract, 8000); expect(contract.earned).toBe(40); expect(contract.status).toBe('returning');
  expect(Escorts.finish(contract, 9000)).toBe(0); expect(Escorts.finish(contract, 10000)).toBe(0);
  const early = Escorts.start(2, 100, 4); expect(Escorts.finish(early, 1900)).toBe(70);
  expect(Escorts.normalizeState({ actor, contract: early }).actor).toEqual(actor);
});
test('refusal and dragging depend on wounds, exhaustion, threat, and real load', () => {
  const actor = Escorts.candidate('seed', { id: 'a', label: 'A' }); actor.needs = { exertion: 0 };
  expect(Escorts.refusal(actor, 3)).toContain('overwhelming');
  expect(Escorts.canDrag(actor, { health: 5 }, 20)).toBe(true);
  expect(Escorts.canDrag(actor, { health: 5 }, 110)).toBe(false);
  actor.health = 20; expect(Escorts.refusal(actor)).toContain('wounds'); expect(Escorts.canDrag(actor, { health: 5 })).toBe(false);
  actor.health = 100; actor.needs.exertion = 90; expect(Escorts.canDrag(actor, { health: 5 })).toBe(false);
});
async function start(page, beasts = []) {
  page.on('dialog', (dialog) => dialog.accept());
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('helix-heresy-v1-preferences', JSON.stringify({ mapRendererMode: 'dom' })); });
  await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate((beasts) => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'world-test', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'escort-test', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { id: 'wilderness:planet-cell:00002', strategicCellId: 'planet-cell:00002', approachCellId: 'planet-cell:00001', label: 'Woodland Boundary', temperatureC: 18, slopePercent: 20, precipitationMm: 500, terrain: 'broken ground', jurisdiction: 'Wilderness', description: 'Bounded test sector.' }, mode: 'wilderness', autoCare: false });
    d.configureWildernessBeastsTest({ actors: beasts });
    d.configureEscortTest({ cell: { x: 12, y: 10, z: 6 }, scientistCell: { x: 11, y: 10, z: 6 } });
  }, beasts);
}
const snap = (page) => page.evaluate(() => window.helixHeresyDebug.expeditionEscortSnapshot());
test.describe('physical expedition escort', () => {
  test.setTimeout(240000);
  test('local hiring, finite transfers and care, recall, settlement, and rehire preserve the same person and kit', async ({ page }) => {
    await start(page);
    const before = await snap(page);
    expect(before.stacks.map((s) => s.key)).toContain('escortBaton');
    expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(true);
    let saved = await snap(page); expect(saved.money).toBe(before.money - 140);
    expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('drinkingWater', 'take'))).toBe(true);
    expect((await snap(page)).stacks.find((s) => s.key === 'drinkingWater').quantity).toBe(3);
    expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('drinkingWater', 'give'))).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ needs: { thirst: 60 }, order: 'hold' }));
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(1));
    saved = await snap(page); expect(saved.actor.care.key).toBe('drinkingWater');
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(21));
    saved = await snap(page); expect(saved.actor.needs.thirst).toBeLessThan(25);
    expect(saved.stacks.filter((s) => s.key === 'drinkingWater').reduce((n, s) => n + s.quantity, 0)).toBe(3);
    expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.settleEscortContract())).toBe(true);
    const returned = await snap(page); expect(returned.contract.status).toBe('completed');
    expect(await page.evaluate(() => window.helixHeresyDebug.settleEscortContract())).toBe(false);
    expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(true);
    saved = await snap(page); expect(saved.actor.id).toBe(before.actor.id); expect(saved.stacks.find((s) => s.key === 'escortBaton').id).toBe(before.stacks.find((s) => s.key === 'escortBaton').id);
    await page.locator('[data-workspace-tab="visits"]').click(); await expect(page.locator('[data-expedition-escort]')).toContainText('Reserved wages');
  });
  test('orders, physical follow and return, spending cap, and proximity are enforced', async ({ page }) => {
    await start(page); await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort());
    await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ cell: { x: 22, y: 12, z: 6 }, scientistCell: { x: 27, y: 12, z: 6 } }));
    expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('drinkingWater', 'take'))).toBe(false);
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(5));
    expect((await snap(page)).actor.mapCell.x).toBeGreaterThan(22);
    expect(await page.evaluate(() => window.helixHeresyDebug.orderExpeditionEscort('hold'))).toBe(true);
    const held = (await snap(page)).actor.mapCell;
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(4)); expect((await snap(page)).actor.mapCell).toEqual(held);
    await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ remainingSeconds: 1 }));
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(1));
    let saved = await snap(page); expect(saved.contract.status).toBe('returning'); expect(saved.contract.earned).toBe(saved.contract.wageReserve);
    expect(await page.evaluate(() => window.helixHeresyDebug.orderExpeditionEscort('follow'))).toBe(false);
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(50));
    saved = await snap(page); expect(saved.actor.roomId).toBe('supportedSurveyGround'); expect(saved.actor.mapCell.x).toBeLessThan(15);
  });
  test('beasts target the escort, protection uses real gear, first aid uses injury-specific supplies, and escort death is not scientist death', async ({ page }) => {
    await start(page, [{ id: 'wolf', cell: cell(24), nextMoveAt: 1000, nextAttackAt: 1 }]);
    await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort());
    await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ cell: { x: 23, y: 12, z: 6 }, scientistCell: { x: 22, y: 12, z: 6 }, order: 'defend' }));
    const before = await snap(page);
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(1));
    let saved = await snap(page); expect(saved.beasts[0].targetId).toBe(saved.actor.id); expect(saved.actor.health).toBeLessThan(100); expect(saved.beasts[0].health).toBeLessThan(48);
    expect(saved.gearCondition[saved.stacks.find((s) => s.key === 'escortVest').id]).toBeLessThan(100);
    await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ cell: { x: 12, y: 10, z: 6 }, scientistCell: { x: 11, y: 10, z: 6 }, order: 'hold' }));
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(50));
    saved = await snap(page); expect(saved.stacks.some((s) => s.key === 'neutralizingWash')).toBe(false); expect(saved.injuries.some((i) => i.actorKind === 'expeditionEscort' && i.status === 'stabilized')).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.damageEscortForTest(500));
    saved = await snap(page); expect(saved.actor.status).toBe('dead'); expect(saved.stacks).toHaveLength(0); expect(saved.contract.status).toBe('fatality'); expect(saved.scientistHealth).toBe(before.scientistHealth);
  });
  test('casualty assistance moves both bodies one physical step at a time and survives reload', async ({ page }) => {
    await start(page); await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort());
    await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ cell: { x: 23, y: 12, z: 6 }, scientistCell: { x: 22, y: 12, z: 6 }, health: 5 }));
    expect(await page.evaluate(() => window.helixHeresyDebug.startEscortDrag('scientist'))).toBe(true);
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(3)); expect((await snap(page)).scientistCell).toEqual(cell(22));
    await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(2));
    let saved = await snap(page); expect(saved.scientistCell.x).toBe(21); expect(saved.actor.mapCell).toEqual(cell(22));
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(90));
    saved = await snap(page); expect(saved.actor.roomId).toBe('supportedSurveyGround'); expect(saved.drag).toBeNull(); expect(saved.actor.health).toBeGreaterThan(0);
    await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ cell: { x: 22, y: 12, z: 6 }, scientistCell: { x: 23, y: 12, z: 6 }, health: 100, scientistHealth: 5 }));
    await page.evaluate(() => window.helixHeresyDebug.advanceEscortForTest(7));
    saved = await snap(page); expect(saved.drag.helperId).toBe(saved.actor.id); expect(saved.scientistCell.x).toBeLessThan(23);
  });
});
