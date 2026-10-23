const { test, expect } = require('@playwright/test');
const { reload } = require('./helpers/field-station');
const { snap, detail, act, tick, walk, setup } = require('./helpers/founding-expedition');
test.setTimeout(900000);
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('founding-ground', {
    body: JSON.stringify(await snap(page)), contentType: 'application/json' });
});
for (const renderer of ['canvas', 'dom']) test(`${renderer}: original protector physically accompanies a supplied attended founding camp; no city is conjured`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const f = await setup(page, renderer); let s = await snap(page);
  const money = s.money, health = s.protector.health, mana = s.protector.wardMana;
  expect(await act(page, 'accept', { expected: { ...s.saved.quote, fee: 0 } })).toBe(false);
  await page.getByRole('button', { name: 'Accept exactly this founding release', exact: true }).click();
  s = await snap(page); expect(s.money).toBe(money - 240); expect(s.protector.id).toBe(f.defenderId); expect(s.protector.assignment).toBe(s.saved.id);
  expect(await page.evaluate(() => window.helixHeresyDebug.sovereignBargainAction('request'))).toBe(false);
  const initialCell = s.protector.mapCell;
  await tick(page, 3); s = await snap(page); expect(s.protector.mapCell).not.toEqual(f.work); expect(s.protector.mapCell).not.toEqual(initialCell);
  await walk(page, f.work);
  for (let n = 0; n < 20 && (await snap(page)).saved.phase !== 'camp'; n++) await tick(page, 5);
  s = await snap(page); expect(s.saved.phase, detail(s)).toBe('camp'); expect(s.protector.mapCell).toEqual(s.saved.plan.post);
  console.info(`${renderer}: same original protector physically arrived`);
  expect(s.protector.health).toBe(health); expect(s.protector.wardMana).toBe(mana);
  await page.getByRole('button', { name: 'Build supplied temporary founding camp (11 minutes)', exact: true }).click();
  await tick(page, 335); s = await snap(page); expect(s.saved.job.progress).toBeGreaterThan(320); expect(s.saved.camp).toBeNull();
  const partial = s.saved.job.progress, hammer = s.tools.find(t => t.tool.id === s.saved.job.claims.toolId).tool.current;
  expect(s.fixtures.find(i => i.id === s.saved.job.claims.crateId).operationalState).toBe('unfinished');
  await page.getByRole('button', { name: 'Pause construction and release hammer claim', exact: true }).click();
  await tick(page, 90); expect((await snap(page)).saved.job.progress).toBe(partial);
  await reload(page, renderer); s = await snap(page); expect(s.saved.job.progress).toBe(partial);
  await page.getByRole('button', { name: 'Resume same unfinished founding construction', exact: true }).click();
  await tick(page, 340); s = await snap(page); expect(s.saved.job).toBeNull(); expect(s.saved.camp).toBeTruthy();
  expect(s.tools.find(t => t.tool.id === s.tools.find(t => t.key === 'masonryHammer').tool.id).tool.current).toBeLessThan(hammer);
  expect(s.items.filter(i => s.saved.camp.kitIds.includes(i.id)).every(i => !i.carriedBy && i.quantity === 1)).toBe(true);
  expect(s.items.filter(i => i.key === 'lumber' && i.carriedBy === 'scientist').reduce((n, i) => n + i.quantity, 0)).toBe(0);
  await tick(page, 610); expect((await snap(page)).saved.demonstratedAt).toBeNull();
  const waterBefore = s.items.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0);
  await page.getByRole('button', { name: 'Share carried founding provisions (20 seconds)', exact: true }).click();
  await tick(page, 22); s = await snap(page); expect(s.saved.mealAt).not.toBeNull();
  expect(s.items.filter(i => i.key === 'drinkingWater').reduce((n, i) => n + i.quantity, 0)).toBe(waterBefore - 2);
  await tick(page, 605); s = await snap(page); expect(s.saved.demonstratedAt).not.toBeNull();
  await page.getByRole('button', { name: 'Personally inspect founding account', exact: true }).click();
  const dated = (await snap(page)).saved.report; expect(dated.demonstratedAt).not.toBeNull();
  await reload(page, renderer); expect((await snap(page)).saved.report).toEqual(dated);
  const earnedCamp = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  await page.getByRole('button', { name: 'Personally end release and withdraw protector', exact: true }).click();
  for (let n = 0; n < 25 && (await snap(page)).saved.phase !== 'returned'; n++) await tick(page, 5);
  s = await snap(page); expect(s.saved.phase).toBe('returned'); expect(s.protector.id).toBe(f.defenderId); expect(s.protector.assignment).toBeNull();
  expect(s.protector.mapCell).toEqual(s.saved.plan.home.cell); expect(s.saved.camp).toBeTruthy(); expect(s.money).toBe(money - 240);
  expect(s.saved.report).toEqual(dated); expect(s.protector.health).toBe(health); expect(s.protector.stamina).toBeLessThan(100);
  const raw = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  expect(raw.runEnded).toBeFalsy(); expect(raw.foundingExpedition.city).toBeUndefined(); expect(raw.regionalOperations.nodes).toHaveLength(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  // Branch only the actually earned camp for a separate physical danger fault.
  // One explicit pre-existing local beast, not a wave supplied by founding.
  await page.evaluate(saved => {
    const d = window.helixHeresyDebug, p = saved.foundingExpedition.plan, a = saved.sovereignBargains.defender;
    const beast = window.HelixWildernessBeasts.actor('beast:rimefang-pack', 'original-founding-encounter',
      { ...p.post, y: p.post.y - 1 }, 'original-boundary-population', saved.clock);
    Object.assign(beast, { targetId: a.id, provokedUntil: saved.clock + 90, nextAttackAt: saved.clock, nextMoveAt: saved.clock + 600 });
    saved.wildernessBeasts.actors = [beast]; d.importSurveyExpeditionTestState(saved);
  }, earnedCamp);
  const guardBefore = (await snap(page)).protector;
  await tick(page, 12); s = await snap(page);
  expect(s.protector.id).toBe(f.defenderId); expect(s.protector.stamina).toBeLessThan(guardBefore.stamina);
  const encountered = await page.evaluate(() => window.helixHeresyDebug.wildernessBeastSnapshot().actors[0]);
  expect(encountered.targetId).toBe(f.defenderId); expect(encountered.nextAttackAt).toBeGreaterThan(earnedCamp.clock);
  expect(s.protector.health).toBeLessThanOrEqual(guardBefore.health); expect(s.protector.wardMana).toBeLessThanOrEqual(guardBefore.wardMana);
  expect(s.saved.demonstratedAt).toBe(earnedCamp.foundingExpedition.demonstratedAt); // Historical, not current safety.
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.sovereignBargains.defender.health = 0; s.sovereignBargains.defender.status = 'dead'; d.importSurveyExpeditionTestState(s); });
  await tick(page, 1); s = await snap(page); expect(s.saved.phase).toBe('fatality'); expect(s.protector.id).toBe(f.defenderId);
  expect(s.saved.camp.crateId).toBe(earnedCamp.foundingExpedition.camp.crateId); expect(s.money).toBe(money - 240);
  expect((await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState())).runEnded).toBeFalsy();
  expect(await act(page, 'review')).toBe(false); expect(errors).toEqual([]);
});
