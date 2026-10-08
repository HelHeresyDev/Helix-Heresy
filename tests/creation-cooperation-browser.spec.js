const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.creationCooperationSnapshot());
const advance = (page, seconds, until = '') => page.evaluate(({ seconds, until }) => window.helixHeresyDebug.advanceCreationCooperationForTest(seconds, until), { seconds, until });
const action = (page, kind, setup, extra = {}) => page.evaluate(({ kind, setup, extra }) => window.helixHeresyDebug.creationCooperationAction(kind, setup.id, { ...setup, ...extra }), { kind, setup, extra });
async function train(page, setup) {
  for (const kind of ['demonstrate', 'check', 'check']) {
    if (!await action(page, kind, setup)) throw new Error(`${kind}: ${JSON.stringify(await snapshot(page))}`);
    await advance(page, 610); const s = await snapshot(page);
    expect(s.saved.lessons.at(-1).status, s.saved.lessons.at(-1).reason).toBe('completed');
    await advance(page, 3600);
  }
}
test('real demonstrated carrying, informed finite agreement, partial custody reload, away work and original reward handoff', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await startLifecycleRun(page, 'creation-cooperation-physical');
  const initial = await snapshot(page), setup = await page.evaluate(() => window.helixHeresyDebug.prepareCreationCooperationTest());
  expect(setup?.destination).toBeTruthy(); expect((await snapshot(page)).campaign).toEqual(initial.campaign);
  expect(await action(page, 'offer', setup)).toBe(false); await train(page, setup);
  let s = await snapshot(page); expect(s.individuals[0].skills.handling).toBe(2); expect(s.individuals[0].language).toBeNull();
  await page.locator('[data-workspace-tab="research"]').click(); await expect(page.locator('[data-creation-cooperation]')).toContainText('Two unguided carrying checks observed');
  expect(await action(page, 'offer', setup)).toBe(true); s = await snapshot(page); const orderId = s.saved.orders[0].id;
  expect(s.stacks.filter(s => s.reservedTaskId === orderId)).toHaveLength(3);
  await advance(page, 600, 'carried'); s = await snapshot(page); expect(s.saved.orders[0].carriedStackId).toBeTruthy();
  const held = s.stacks.find(item => item.id === s.saved.orders[0].carriedStackId); expect(held.carriedBy).toBe(setup.id); expect(held.quantity).toBe(1);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  let loaded = await snapshot(page); expect(loaded.saved.orders[0]).toEqual(s.saved.orders[0]); expect(loaded.stacks.find(s => s.id === held.id).carriedBy).toBe(setup.id);
  await advance(page, 600, 'partial'); s = await snapshot(page); expect(s.saved.orders[0].delivered).toBe(1);
  const known = s.saved.knowledge; await page.evaluate(() => window.helixHeresyDebug.setCreationCooperationTest({ away: true }));
  await advance(page, 600); s = await snapshot(page); expect(s.saved.orders[0].status, s.saved.orders[0].reason).toBe('awaitingReward');
  expect(s.saved.orders[0].delivered).toBe(2); expect(s.saved.knowledge).toEqual(known);
  expect(s.stacks.filter(s => s.key === 'drinkingWater' && !s.carriedBy && s.cell.x === setup.destination.x && s.cell.y === setup.destination.y).reduce((n, s) => n + s.quantity, 0)).toBe(2);
  expect(await action(page, 'pay', setup, { orderId })).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.setCreationCooperationTest({ returnToOrder: true }));
  expect(await action(page, 'report', setup)).toBe(true); const before = (await snapshot(page)).individuals[0].foodHours;
  expect(await action(page, 'pay', setup, { orderId })).toBe(true); s = await snapshot(page);
  expect(s.saved.orders[0].paid).toBe(true); expect(s.individuals[0].foodHours).toBeCloseTo(before + 24, 5);
  expect(s.stacks.some(item => [s.saved.orders[0].stocks.meal, s.saved.orders[0].stocks.water].includes(item.id))).toBe(false);
  expect(await action(page, 'pay', setup, { orderId })).toBe(false); expect(s.individuals[0].agreement).toBeNull(); expect(errors).toEqual([]);
});
test('a withdrawn started delivery retains real partial work, held cargo and reward debt; no free reauthorization', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await startLifecycleRun(page, 'creation-cooperation-interruption');
  const setup = await page.evaluate(() => window.helixHeresyDebug.prepareCreationCooperationTest()); expect(setup?.destination).toBeTruthy(); await train(page, setup);
  expect(await action(page, 'offer', setup)).toBe(true); await advance(page, 600, 'partial');
  let s = await snapshot(page); const o = s.saved.orders[0];
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { health: 65 }), setup.id); await advance(page, 10);
  s = await snapshot(page); expect(s.saved.orders[0].status).toBe('paused'); expect(s.saved.orders[0].delivered).toBe(1);
  expect(await action(page, 'resume', setup, { orderId: o.id })).toBe(false);
  expect(await action(page, 'cancel', setup, { orderId: o.id })).toBe(true);
  s = await snapshot(page); expect(s.stacks.filter(s => s.reservedTaskId === o.id).map(s => s.id).sort()).toEqual([o.stocks.meal, o.stocks.water].sort());
  expect(s.saved.relationships[setup.id].brokenPromises).toEqual([o.id]);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.relationships).toEqual(s.saved.relationships);
  expect(await action(page, 'pay', setup, { orderId: o.id })).toBe(true); expect((await snapshot(page)).saved.relationships[setup.id].brokenPromises).toEqual([]);
  await page.evaluate(id => window.helixHeresyDebug.setFirstContactTestCondition(id, { killScientist: true }), setup.id);
  const frozen = (await snapshot(page)).saved; await advance(page, 1000); expect((await snapshot(page)).saved).toEqual(frozen); expect(errors).toEqual([]);
});
