const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(1200000); test.use({ actionTimeout: 15000 });
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))).catch(() => null);
    if (storage) { const path = info.outputPath('earned-wisp-checkpoint.json'); require('node:fs').writeFileSync(path, JSON.stringify(storage)); await info.attach('earned-wisp-checkpoint', { path, contentType: 'application/json' }); }
  }
});
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
const wisp = (page, id) => page.evaluate(id => window.helixHeresyDebug.wispSnapshot(id), id);
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceElementalForTest(seconds), seconds);
async function finish(page) {
  for (let n = 0; n < 20; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'constructionWork', 'resourceHaul', 'stockpileHaul', 'scientistMove', 'laborWork'].includes(t.type));
    if (!t) return; await advance(page, Math.max(2, t.dueAt - s.clock + 3));
  }
  throw Error(JSON.stringify({ tasks: (await snapshot(page)).tasks, events: (await snapshot(page)).events }));
}
async function action(page, name, id = '') {
  console.info(`Wisp: ${name}`);
  expect(await page.evaluate(({ name, id }) => window.helixHeresyDebug.stageElementalTestSupplies(name, id), { name, id })).toBe(true);
  const current = await snapshot(page), body = current.saved.creatures.find(a => a.id === id);
  if (body) {
    const p = await page.evaluate(({ name, id }) => window.helixHeresyDebug.elementalWorkPreview(name, id), { name, id });
    if (p.cell && JSON.stringify(p.cell) !== JSON.stringify(current.scientist)) {
      expect(await page.evaluate(({ roomId, cell }) => window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, allowMultiRoom: true }), { roomId: body.roomId, cell: p.cell })).toBeTruthy(); await finish(page);
    }
  }
  const tab = page.locator('[data-workspace-tab="research"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.locator(`[data-elemental-action="${name}"][data-elemental-target="${id}"]`).click();
  expect((await snapshot(page)).tasks.some(t => t.type === 'elementalWork'), JSON.stringify((await snapshot(page)).events)).toBe(true); await finish(page);
}
function conserved(a) { expect(a.bodyKg + a.brokenKg).toBeCloseTo(.1, 7); expect(a.manaReserve + a.manaSpent).toBeCloseTo(a.manaReceived, 6); }
async function walkAway(page, id) {
  const options = await page.evaluate(id => window.helixHeresyDebug.wispWalkOptions(id), id); expect(options.length).toBeGreaterThan(0);
  expect(await page.evaluate(({ roomId, cell }) => window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, allowMultiRoom: true }), options[0])).toBeTruthy(); await finish(page);
}
test('native Lantern Wisp research, original formation, earned following, real light/shutter/custody, both souls, failure and continued death state', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'lantern-wisp-native-light');
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3)); await finish(page);
  for (const m of ['notes', 'wispCharacterize']) await action(page, m);
  let s = await snapshot(page); expect(s.saved.pattern).toBeNull();
  const cells = await page.evaluate(() => window.helixHeresyDebug.elementalBuildOptions());
  const cell = cells.sort((a, b) => Math.abs(a.x - s.scientist.x) + Math.abs(a.y - s.scientist.y) - Math.abs(b.x - s.scientist.x) - Math.abs(b.y - s.scientist.y))[0]; expect(cell).toBeTruthy();
  expect(await page.evaluate(cell => window.helixHeresyDebug.designateConstruction('build', [cell], { buildType: 'fixture:elementalChamber', materialPolicy: 'steel', rotation: 0 }), cell)).toBeTruthy(); await finish(page);
  const chamber = (await snapshot(page)).fixtures.find(f => f.typeId === 'elementalChamber'); expect(chamber).toBeTruthy();
  for (const m of ['charge', 'wispFocus', 'wispStable', 'wispOvercharge']) await action(page, m, chamber.id);
  await action(page, 'wispDocument'); s = await snapshot(page);
  const stable = s.saved.evidence.find(e => e.method === 'wispStable'), overloaded = s.saved.evidence.find(e => e.method === 'wispOvercharge');
  expect(stable.receipt.wispTrial.coherence).toBeGreaterThan(overloaded.receipt.wispTrial.coherence);
  expect(overloaded.receipt.wispTrial.manaSpent).toBeCloseTo(2, 6);
  const focus = s.saved.wispFocus[chamber.id]; expect(s.stacks.find(i => i.id === focus.stackId).fixtureId).toBe(chamber.id);
  await action(page, 'growWisp', chamber.id); await advance(page, 300); s = await snapshot(page); expect(s.saved.runs[0].status).toBe('forming'); const stocks = s.saved.runs[0].stocks;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.runs[0].stocks).toEqual(stocks);
  await advance(page, 303); s = await snapshot(page); const first = s.saved.creatures[0], soul = first.formationSoul;
  expect(first.family).toBe('lanternWisp'); expect(soul.present).toBe(true); expect(first.familiarity).toBe(0); expect(s.saved.runs[0].manaReceived).toBeCloseTo(4, 6);
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('wispFollow', id), first.id)).toBe(false);
  await action(page, 'wispRecharge', first.id);
  for (const name of ['wispFamiliar', 'wispLearnFollow', 'wispLearnStay']) for (let n = 0; n < 3; n++) await action(page, name, first.id);
  let f = await wisp(page, first.id); expect(f.actor.lessonReceipts).toHaveLength(9); expect(f.actor.feedReceipts[0].sourceIds.length).toBeGreaterThan(0); conserved(f.actor);
  await action(page, 'release', first.id); await action(page, 'clear', first.runId);
  await page.evaluate(() => window.helixHeresyDebug.setDuskcatTestLighting(0));
  if (await page.locator('#debugToggleBtn').getAttribute('aria-pressed') === 'true') await page.locator('#debugToggleBtn').click();
  f = await wisp(page, first.id); expect(f.source.light).toBe(60); expect(f.environment.lightLevel).toBeGreaterThanOrEqual(60);
  const original = f.actor.mapCell; await action(page, 'wispFollow', first.id); await walkAway(page, first.id); await advance(page, 15);
  f = await wisp(page, first.id); expect(f.actor.mapCell).not.toEqual(original); expect(f.actor.moves.length).toBeGreaterThan(0);
  expect(Math.abs(f.actor.mapCell.x - f.scientist.x) + Math.abs(f.actor.mapCell.y - f.scientist.y)).toBeLessThanOrEqual(1);
  await action(page, 'wispStay', first.id); const held = (await wisp(page, first.id)).actor.mapCell;
  await walkAway(page, first.id); await advance(page, 15); expect((await wisp(page, first.id)).actor.mapCell).toEqual(held);
  await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot()); expect(scene.entities.some(e => e.id === first.id && e.visual.glyph === 'W')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('lantern-wisp-canvas.png') });
  }
  await action(page, 'wispHousing', first.id); await action(page, 'wispHouse', first.id); await action(page, 'wispTake', first.id);
  f = await wisp(page, first.id); const housingId = f.actor.carryStackId; expect(f.stacks.find(i => i.id === housingId).carriedBy).toBe('scientist');
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await wisp(page, first.id)).actor.carryStackId).toBe(housingId);
  await action(page, 'wispPut', first.id); f = await wisp(page, first.id); const openLight = f.environment.lightLevel, spent = f.actor.manaSpent;
  await action(page, 'wispShutter', first.id); await advance(page, 30); f = await wisp(page, first.id);
  expect(f.source.light).toBe(0); expect(f.environment.lightLevel).toBeLessThan(openLight - 20); expect(f.actor.manaSpent).toBeGreaterThan(spent);
  await action(page, 'wispShutter', first.id); expect((await wisp(page, first.id)).source.light).toBe(60);
  await action(page, 'wispOpen', first.id); expect((await wisp(page, first.id)).actor.carryStackId).toBe(''); await action(page, 'wispHouse', first.id);
  const health = (await wisp(page, first.id)).actor.health;
  await page.evaluate(id => window.helixHeresyDebug.damageWispForTest(id, 5), first.id); expect((await wisp(page, first.id)).actor.health).toBe(health);
  await page.evaluate(id => window.helixHeresyDebug.damageWispForTest(id, 30), first.id); f = await wisp(page, first.id);
  expect(f.actor.carryStackId).toBe(''); expect(f.actor.health).toBeLessThan(health); expect(f.stacks.find(i => i.id === housingId).biology.wispHousing.condition).toBe(0); conserved(f.actor);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'charge', chamber.id); await action(page, 'growWisp', chamber.id); await advance(page, 603); s = await snapshot(page); const second = s.saved.creatures[1];
  expect(second.formationSoul.present).toBe(false); expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('wispFamiliar', id), second.id)).toBe(false);
  await action(page, 'release', second.id); await action(page, 'clear', second.runId); const inert = (await wisp(page, second.id)).actor.mapCell;
  await advance(page, 60); expect((await wisp(page, second.id)).actor.mapCell).toEqual(inert); expect((await wisp(page, second.id)).actor.independentIntent).toBe('');
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('souled');
  await action(page, 'growWisp', chamber.id); await advance(page, 300); await page.evaluate(() => window.helixHeresyDebug.setElementalTestDeviceEnabled(false)); await advance(page, 121);
  s = await snapshot(page); expect(s.saved.runs[2].status).toBe('failed'); expect(s.saved.creatures).toHaveLength(2);
  expect(s.stacks.some(i => i.key === 'failed luminous mineral core' && i.sourceLabels.includes(s.saved.runs[2].id))).toBe(true);
  await page.locator('[data-workspace-tab="map"]').click(); const pending = page.waitForEvent('download'); await page.locator('#exportFileBtn').click();
  const download = await pending, stream = await download.createReadStream(), chunks = []; for await (const c of stream) chunks.push(c); const saved = await snapshot(page);
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-wisps.json', mimeType: 'application/json', buffer: Buffer.concat(chunks) });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(saved.identity.runId);
  expect((await snapshot(page)).saved.creatures).toEqual(saved.saved.creatures);
  await page.evaluate(id => window.helixHeresyDebug.damageWispForTest(id, 100), first.id); await advance(page, 60);
  f = await wisp(page, first.id); expect(f.actor.status).toBe('dead'); expect(f.source.light).toBe(0); expect(f.actor.formationSoul).toEqual(soul); conserved(f.actor);
  const dead = f.actor; await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await wisp(page, first.id)).actor).toEqual(dead); expect(errors).toEqual([]);
});
