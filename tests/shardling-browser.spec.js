const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const { activeRunStorageKey } = require('./helpers/active-run-storage');
test.setTimeout(900000); test.use({ actionTimeout: 15000 });
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
const mineral = (page, id) => page.evaluate(id => window.helixHeresyDebug.shardlingSnapshot(id), id);
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceElementalForTest(seconds), seconds);
async function finish(page) {
  for (let n = 0; n < 20; n++) { const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'constructionWork', 'resourceHaul', 'stockpileHaul', 'scientistMove', 'laborWork'].includes(t.type));
    if (!t) return; await advance(page, Math.max(2, t.dueAt - s.clock + 3)); }
  throw Error(JSON.stringify({ tasks: (await snapshot(page)).tasks, events: (await snapshot(page)).events }));
}
async function action(page, name, id = '') {
  console.info(`Shardling: ${name}`);
  expect(await page.evaluate(({ name, id }) => window.helixHeresyDebug.stageElementalTestSupplies(name, id), { name, id }), JSON.stringify((await snapshot(page)).events)).toBe(true);
  const current = await snapshot(page), body = current.saved.creatures.find(a => a.id === id);
  if (body) {
    const p = await page.evaluate(({ name, id }) => window.helixHeresyDebug.elementalWorkPreview(name, id), { name, id });
    if (p.cell && JSON.stringify(p.cell) !== JSON.stringify(current.scientist)) {
      expect(await page.evaluate(({ roomId, cell }) => window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, allowMultiRoom: true }), { roomId: body.roomId, cell: p.cell })).toBeTruthy();
      await finish(page);
    }
  }
  const tab = page.locator('[data-workspace-tab="research"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.locator(`[data-elemental-action="${name}"][data-elemental-target="${id}"]`).click();
  expect((await snapshot(page)).tasks.some(t => t.type === 'elementalWork'), JSON.stringify((await snapshot(page)).events)).toBe(true); await finish(page);
}
function conserved(a) { expect(a.bodyKg + Object.values(a.spentMaterials).reduce((n, v) => n + v, 0) + a.brokenKg + a.removedKg).toBeCloseTo(a.materialReceivedKg, 6); }
test('native Quartz Shardling formation, slow real mining, mineral-specific growth, both souls, custody and continued depletion', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'shardling-miner-native');
  for (const m of ['notes', 'shardCharacterize', 'shardStoneTrial', 'shardQuartzTrial', 'shardDocument']) await action(page, m);
  let s = await snapshot(page); expect(s.saved.pattern).toBeNull(); expect(s.saved.shardPattern.material).toBe('quartz');
  const cells = await page.evaluate(() => window.helixHeresyDebug.elementalBuildOptions()); expect(cells.length).toBeGreaterThan(0);
  const cell = cells.sort((a, b) => Math.abs(a.x - s.scientist.x) + Math.abs(a.y - s.scientist.y) - Math.abs(b.x - s.scientist.x) - Math.abs(b.y - s.scientist.y))[0];
  expect(await page.evaluate(cell => window.helixHeresyDebug.designateConstruction('build', [cell], { buildType: 'fixture:elementalChamber', materialPolicy: 'steel', rotation: 0 }), cell)).toBeTruthy();
  await finish(page); const chamber = (await snapshot(page)).fixtures.find(f => f.typeId === 'elementalChamber'); expect(chamber).toBeTruthy();
  await action(page, 'charge', chamber.id); await action(page, 'growShardling', chamber.id); await advance(page, 1800);
  s = await snapshot(page); expect(s.saved.runs[0].consumed.quartz).toBe(1); expect(s.saved.runs[0].status).toBe('forming'); const stocks = s.saved.runs[0].stocks;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.runs[0].stocks).toEqual(stocks);
  await advance(page, 1803); s = await snapshot(page); const first = s.saved.creatures[0]; expect(first.family).toBe('quartzShardling'); expect(first.formationSoul.present).toBe(true);
  // Exercise the ordinary integration before the deliberately isolated multi-day
  // quarry clock, so unrelated city production is not made to catch up days.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(5));
  expect((await mineral(page, first.id)).actor.status).toBe('alive');
  await finish(page); // Physically finish any ordinary automatic stock hauling before staging care.
  await action(page, 'shardFeedStone', first.id); const before = (await mineral(page, first.id)).actor; await advance(page, 3600);
  let a = (await mineral(page, first.id)).actor; expect(a.reserveHours).toBeGreaterThan(before.reserveHours); expect(a.bodyKg).toBe(1); conserved(a);
  await action(page, 'shardRemoveFeed', first.id); await action(page, 'shardFeedQuartz', first.id); await advance(page, 3600);
  a = (await mineral(page, first.id)).actor; expect(a.grownKg).toBeGreaterThan(0); conserved(a);
  await page.evaluate(id => window.helixHeresyDebug.damageShardlingForTest(id, 20), first.id); await advance(page, 3600);
  a = (await mineral(page, first.id)).actor; expect(a.repairedKg).toBeGreaterThan(0); expect(a.health).toBeGreaterThan(80); conserved(a);
  await action(page, 'shardRemoveFeed', first.id); await action(page, 'shardCarry', first.id); await action(page, 'clear', first.runId);
  s = await snapshot(page); expect(s.stacks.find(i => i.id === s.saved.creatures[0].carryStackId).carriedBy).toBe('scientist');
  // Obtain an unassisted original without a magical worker or hidden order grant.
  const tab = page.locator('[data-workspace-tab="research"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'growShardling', chamber.id); await advance(page, 3603); s = await snapshot(page); const second = s.saved.creatures[1]; expect(second.formationSoul.present).toBe(false);
  await action(page, 'shardOrder', second.id); await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await mineral(page, second.id)).actor.order.channel).toBe('physical-core-contact'); await action(page, 'shardStop', second.id);
  const idle = (await mineral(page, second.id)).actor; await advance(page, 3600); a = (await mineral(page, second.id)).actor;
  expect(a.order).toBeNull(); expect(a.mapCell).toEqual(idle.mapCell); expect(a.independentIntent).toBe(''); expect(a.materialReceivedKg).toBe(idle.materialReceivedKg);
  const options = await page.evaluate(() => window.helixHeresyDebug.shardlingQuarryOptions()); expect(options.length, JSON.stringify(options)).toBeGreaterThan(0);
  const quarry = options[0]; console.info('Generated quarry journey', JSON.stringify(quarry));
  expect(await page.evaluate(o => window.helixHeresyDebug.startScientistMove(o.roomId, { toCell: o.stand, allowMultiRoom: true }), quarry)).toBeTruthy(); await finish(page);
  await action(page, 'shardPut', first.id); let q = await mineral(page, first.id); expect(q.actor.mapCell).toEqual(quarry.cell);
  expect(q.actor.carryStackId).toBe(''); const oldCell = q.actor.mapCell;
  await advance(page, 240); q = await mineral(page, first.id); expect(q.actor.mapCell).toEqual(oldCell); expect(q.actor.sensed).toBeTruthy();
  expect(q.actor.sensed.cell).not.toEqual(oldCell); expect(q.actor.mode).toMatch(/digging|approaching/);
  // Ordinary observation must never reveal the private target coordinates.
  await action(page, 'examine', first.id); expect((await snapshot(page)).saved.observations[first.id].mineral.sensed).toBeUndefined();
  await advance(page, 12 * 3600); q = await mineral(page, first.id); conserved(q.actor);
  const originalSoul = q.actor.formationSoul, originalGround = q.ground;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await mineral(page, first.id)).ground).toEqual(originalGround);
  // This generated approach is hard basalt: ordinary material resistance makes
  // it take several days. Advance that actual work, never soften/inject a tunnel.
  for (let n = 0; n < 8 && (await mineral(page, first.id)).actor.mode !== 'feeding-at-source'; n++) {
    await advance(page, 24 * 3600); const current = await mineral(page, first.id);
    console.info('Quarry progress', JSON.stringify({ at: current.clock, cell: current.actor.mapCell, mode: current.actor.mode }));
  }
  q = await mineral(page, first.id); expect(q.actor.mode, JSON.stringify({ cell: q.actor.mapCell, mode: q.actor.mode, ground: q.ground })).toBe('feeding-at-source');
  expect(Object.values(q.ground).some(g => g.excavated)).toBe(true); expect(q.rubble.length).toBeGreaterThan(0);
  await advance(page, 3600); q = await mineral(page, first.id);
  expect(q.actor.foodSources.some(r => r.sourceIds.includes(q.actor.sensed.id))).toBe(true);
  expect(q.actor.consumedMaterials.quartz).toBeGreaterThan(.02); conserved(q.actor); expect(q.actor.formationSoul).toEqual(originalSoul);
  // Actual ordinary mining of the still-substantial reached vein, then hauling
  // its remaining mineral stock. No deposit/tunnel/result is injected.
  const target = q.actor.sensed.cell;
  expect(await page.evaluate(cell => window.helixHeresyDebug.designateConstruction('mine', [cell]), target)).toBeTruthy(); await finish(page);
  q = await mineral(page, first.id); const pile = q.rubble.find(p => p.cell.x === target.x && p.cell.y === target.y && p.materials.some(m => m.id === 'quartz'));
  expect(pile).toBeTruthy(); expect(pile.materials.find(m => m.id === 'quartz').amount).toBeGreaterThan(8);
  const destination = { x: quarry.stand.x, y: quarry.stand.y, z: 0 };
  expect(await page.evaluate(({ pile, destination, roomId }) => window.helixHeresyDebug.createLaborOrder({ kind: 'rubbleHaul', category: 'hauling', label: 'Recover actual quartz remainder', target: { id: pile.id }, destination: { roomId, cell: destination }, dedupeKey: 'quartz-native-recovery' }), { pile, destination, roomId: quarry.roomId })).toBeTruthy(); await finish(page);
  q = await mineral(page, first.id); expect(q.stacks.some(i => i.key === 'quartz' && i.sourceLabels.some(s => /shardling|excavation/i.test(s)))).toBe(true);
  expect(q.stacks.filter(i => i.key === 'quartz' && i.sourceLabels.includes(pile.id)).reduce((n, i) => n + i.quantity * i.unitMassKg, 0)).toBeCloseTo(pile.materials.find(m => m.id === 'quartz').amount, 3);
  await page.locator('[data-workspace-tab="map"]').click();
  await page.evaluate(cell => window.helixHeresyDebug.centerMapOnCell(cell), q.actor.mapCell);
  for (const mode of ['dom', 'canvas']) { await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    expect((await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot())).entities.some(e => e.id === first.id && e.visual.glyph === 'Q')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('quartz-shardling-mining.png') }); }
  const pending = page.waitForEvent('download'); await page.locator('#exportFileBtn').click(); const file = await pending, stream = await file.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk); const previous = await mineral(page, first.id);
  await test.info().attach('performed-quartz-shardling-quarry.json', { body: Buffer.concat(chunks), contentType: 'application/json' });
  console.info('Continuing the actual exported quarry run');
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-shardling-quarry.json', mimeType: 'application/json', buffer: Buffer.concat(chunks) });
  await expect.poll(async () => (await mineral(page, first.id)).identity.runId, { timeout: 20000 }).not.toBe(previous.identity.runId);
  expect((await mineral(page, first.id)).actor).toEqual(previous.actor); expect((await mineral(page, first.id)).ground).toEqual(previous.ground);
  console.info('Continued actor and ground match; applying declared lethal impact');
  const impact = await page.evaluate(id => window.helixHeresyDebug.damageShardlingForTest(id, 1000), first.id);
  expect(impact.changed).toBe(true); expect(impact.afterDamage.status).toBe('dead'); expect(impact.afterRender.status).toBe('dead');
  expect((await mineral(page, first.id)).actor.status).toBe('dead');
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await mineral(page, first.id)).actor.status).toBe('dead'); expect(errors).toEqual([]);
});
test('queued creature care reroutes from the scientist actual position after earlier walking', async ({ page }) => {
  await startLifecycleRun(page, 'declared-elemental-routing-fixture');
  await page.evaluate(key => {
    // Declared body fixture isolates the task-routing adapter; it is NOT proof
    // of earned research, formation, a natural sighting or source-backed mining.
    const L = window.HelixWorldRunLibrary, saved = JSON.parse(L.decompressStorageText(localStorage.getItem(key)));
    const s = saved.state; s.elementalLab = window.HelixCreatureFormation.create(s.clock);
    s.elementalLab.creatures.push({ ...window.HelixShardlings.body(), id: 'declared-routing-body', family: 'quartzShardling', actorKind: 'quartzShardling',
      mapCell: { ...s.scientist.mapCell, x: s.scientist.mapCell.x + 1 }, roomId: s.scientist.roomId, status: 'alive', health: 100, maxHealth: 100,
      chamberId: '', name: 'Declared routing fixture', injuries: [], formationSoul: { present: false }, independentIntent: '' });
    localStorage.setItem(key, L.compressStorageText(JSON.stringify(saved)));
  }, await activeRunStorageKey(page));
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  const initial = await mineral(page, 'declared-routing-body');
  const options = await page.evaluate(() => window.helixHeresyDebug.shardlingWalkOptions());
  let moved = false;
  for (const cell of options) if (await page.evaluate(({ cell, roomId }) => window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, allowMultiRoom: true }), { cell, roomId: initial.actor.roomId })) { moved = true; break; }
  expect(moved).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.elementalAction('examine', 'declared-routing-body'))).toBe(true);
  expect((await snapshot(page)).tasks.filter(t => ['scientistMove', 'elementalWork'].includes(t.type))).toHaveLength(2);
  await finish(page);
  const after = await snapshot(page); expect(after.saved.observations['declared-routing-body'].at).toBeGreaterThan(initial.clock + 30);
  expect(after.scientist).toEqual(initial.scientist); expect(after.saved.creatures[0].independentIntent).toBe('');
});
