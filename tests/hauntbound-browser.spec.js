const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(600000);
test.use({ actionTimeout: 15000 });
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.hauntboundSnapshot());
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceHauntboundForTest(n), n);
async function finish(page) {
  for (let n = 0; n < 8; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => t.type === 'hauntboundWork');
    if (!t) return; await advance(page, Math.max(3, t.dueAt - s.clock + 3));
  }
  const s = await snapshot(page); throw Error(JSON.stringify({ tasks: s.tasks, scientist: s.scientist, saved: s.saved, events: s.events }));
}
async function action(page, name, options) {
  console.info(`Hauntbound: ${name}`);
  if (options) expect(await page.evaluate(({ name, options }) => window.helixHeresyDebug.hauntboundAction(name, options), { name, options })).toBe(true);
  else {
    const tab = page.locator('[data-workspace-tab="research"]');
    if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
    await page.locator(`[data-hauntbound-action="${name}"]`).click();
    const s = await snapshot(page); expect(s.tasks.some(t => t.type === 'hauntboundWork'), JSON.stringify(s.events)).toBe(true);
  }
  await finish(page);
}
test('native inherited haunting, personal animancy, independent work and optional enchanted-item route', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'hauntbound-native-worker');
  await page.locator('[data-workspace-tab="research"]').click();
  await page.evaluate(() => window.helixHeresyDebug.stageHauntboundTestInputs());
  let s = await snapshot(page); expect(s.saved.contact).toBe(false); expect(s.saved.actor.soul.origin).toBe('natural-lingering-deceased');
  const soul = s.saved.actor.soul.id, objectId = s.saved.objectId, letterId = s.saved.letterId, initialAnimancyXp = s.skills.animancy.xp;
  await action(page, 'examine');
  // One XP retains an explicitly untrained level-zero entry through normalization;
  // deleting a starter skill would legitimately reintroduce the run's defaults.
  await page.evaluate(() => window.helixHeresyDebug.setHauntboundTestInputs({ animancyXp: 1 }));
  expect((await snapshot(page)).animancy).toBe(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.hauntboundAction('contact'))).toBe(false);
  // Skill input only; no contact, consent, finished work or spirit is injected.
  await page.evaluate(xp => window.helixHeresyDebug.setHauntboundTestInputs({ animancyXp: xp }), initialAnimancyXp);
  expect((await snapshot(page)).animancy).toBe(1);
  await action(page, 'contact'); await action(page, 'agreement');
  await action(page, 'letter'); await action(page, 'farewell');
  s = await snapshot(page); expect(s.saved.farewellHeard).toBe(true); expect(s.saved.actor.status).toBe('bound'); expect(s.saved.agreement).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.stageHauntboundTestInputs());
  s = await snapshot(page); const stock = s.stacks.find(i => i.key === 'metalParts' && !i.reservedTaskId && i.cell.x === s.scientist.x && i.cell.y === s.scientist.y);
  const to = await page.evaluate(() => window.helixHeresyDebug.hauntboundTestDestination()); expect(stock).toBeTruthy(); expect(to).toBeTruthy();
  const total = s.stacks.filter(i => i.key === 'metalParts').reduce((n, i) => n + i.quantity, 0);
  await action(page, 'assign', { sourceStackId: stock.id, amount: 4, destination: to });
  s = await snapshot(page); expect(s.saved.orders).toHaveLength(1); expect(s.orders.some(o => o.kind === 'hauntboundHaul')).toBe(true);
  expect(s.tasks.some(t => t.type === 'hauntboundLabor')).toBe(true);
  // Stop at the first actual pickup; continue with the very same carried stack after reload.
  for (let i = 0; i < 80 && !(await snapshot(page)).saved.orders[0].carriedStackId; i++) await advance(page, 3);
  s = await snapshot(page); expect(s.saved.orders[0].carriedStackId, JSON.stringify(s)).toBeTruthy(); const cargo = s.saved.orders[0].carriedStackId;
  expect(s.stacks.find(i => i.id === cargo).carriedBy).toBe(s.saved.actor.id);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  s = await snapshot(page); expect(s.saved.orders[0].carriedStackId).toBe(cargo); expect(s.stacks.find(i => i.id === cargo).carriedBy).toBe(s.saved.actor.id);
  const workerDownload = page.waitForEvent('download'); await page.locator('#exportFileBtn').click();
  const workerFile = await workerDownload, workerStream = await workerFile.createReadStream(), workerChunks = [];
  for await (const chunk of workerStream) workerChunks.push(chunk);
  const workerBeforeImport = await snapshot(page);
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-working-hauntbound.json', mimeType: 'application/json', buffer: Buffer.concat(workerChunks) });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(workerBeforeImport.identity.runId);
  s = await snapshot(page); expect(s.saved).toEqual(workerBeforeImport.saved); expect(s.stacks.find(i => i.id === cargo).carriedBy).toBe(s.saved.actor.id);
  // The ordinary shared simulation adapter also advances the worker. The scientist
  // can attend a separate real task while Mara completes the original assignment.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3));
  const automaticallyClaimed = (await snapshot(page)).tasks.find(t => t.type === 'stockpileHaul');
  if (automaticallyClaimed) {
    expect([objectId, letterId]).not.toContain(automaticallyClaimed.data.stackId);
    expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), automaticallyClaimed.id)).toBe(true);
  }
  await action(page, 'letter');
  await advance(page, 300); s = await snapshot(page);
  expect(s.saved.orders[0].status, JSON.stringify(s.saved.orders)).toBe('completed'); expect(s.saved.orders[0].delivered).toBe(4);
  expect(s.stacks.filter(i => i.key === 'metalParts').reduce((n, i) => n + i.quantity, 0)).toBe(total);
  expect(s.stacks.filter(i => i.key === 'metalParts' && i.cell.x === to.x && i.cell.y === to.y).reduce((n, i) => n + i.quantity, 0)).toBe(4);
  expect(s.saved.actor.experience).toBeGreaterThan(0); expect(s.saved.actor.foodHours).toBeUndefined();
  await page.evaluate(() => window.helixHeresyDebug.setHauntboundTestInputs({ damage: 40 }));
  await page.evaluate(() => window.helixHeresyDebug.stageHauntboundTestInputs());
  await action(page, 'repair'); s = await snapshot(page); expect(s.saved.actor.health).toBe(95); expect(s.saved.actor.repairs[0].sourceStackIds.length).toBeGreaterThan(0);
  expect(s.stacks.some(i => i.key === 'worn keepsake cloth' && i.quantity === .5)).toBe(true);
  await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot());
    expect(scene.entities.some(e => e.kind === 'hauntbound' && e.visual.glyph === 'HB')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('hauntbound-worker.png') });
  }
  // Retaining a useful worker remains valid even after understanding the farewell.
  await advance(page, 4 * 3600); s = await snapshot(page); expect(s.saved.actor.status).toBe('bound'); expect(s.saved.enchantment.charge).toBeGreaterThan(4);
  await action(page, 'release'); s = await snapshot(page); expect(s.saved.actor.status).toBe('departed'); expect(s.saved.actor.soul.id).toBe(soul);
  expect(s.saved.objectId).toBe(objectId); expect(s.saved.letterId).toBe(letterId);
  await action(page, 'take'); s = await snapshot(page); expect(s.stacks.find(i => i.id === objectId).carriedBy).toBe('scientist');
  const charge = s.saved.enchantment.charge;
  await page.evaluate(() => window.helixHeresyDebug.setHauntboundTestInputs({ scientistDamage: 10 }));
  s = await snapshot(page); expect(s.saved.enchantment.spent).toBe(3); expect(s.saved.enchantment.charge).toBeCloseTo(charge - 3, 6);
  const afterPhysical = s.saved.enchantment.charge;
  await page.evaluate(() => window.helixHeresyDebug.setHauntboundTestInputs({ scientistDamage: 2, damageTypes: ['soul'] }));
  expect((await snapshot(page)).saved.enchantment.charge).toBe(afterPhysical);
  await page.evaluate(() => window.helixHeresyDebug.stageHauntboundTestInputs()); await action(page, 'recharge');
  s = await snapshot(page); expect(s.saved.enchantment.supplied).toBe(8); expect(s.saved.actor.status).toBe('departed');
  const pending = page.waitForEvent('download'); await page.locator('#exportFileBtn').click(); const download = await pending, stream = await download.createReadStream(), chunks = [];
  for await (const c of stream) chunks.push(c);
  const beforeImport = await snapshot(page);
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-hauntbound.json', mimeType: 'application/json', buffer: Buffer.concat(chunks) });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(beforeImport.identity.runId);
  s = await snapshot(page); expect(s.saved).toEqual(beforeImport.saved); expect(s.stacks.find(i => i.id === objectId).carriedBy).toBe('scientist');
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snapshot(page)).saved).toEqual(s.saved);
  const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot());
  expect(scene.entities.some(e => e.kind === 'hauntbound' && e.visual.glyph === 'E')).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  await page.evaluate(() => window.helixHeresyDebug.setHauntboundTestInputs({ scientistDamage: 1000 }));
  const frozen = (await snapshot(page)).saved; await advance(page, 3600); expect((await snapshot(page)).saved).toEqual(frozen);
  expect(errors).toEqual([]);
});
