const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(1200000); test.use({ actionTimeout: 15000 });
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    const storage = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))).catch(() => null);
    if (storage) {
      const checkpoint = info.outputPath('earned-duskcat-checkpoint.json');
      require('node:fs').writeFileSync(checkpoint, JSON.stringify(storage));
      await info.attach('earned-duskcat-checkpoint', { path: checkpoint, contentType: 'application/json' });
    }
  }
});
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
const feline = (page, id) => page.evaluate(id => window.helixHeresyDebug.duskcatSnapshot(id), id);
const advance = (page, seconds) => page.evaluate(seconds => window.helixHeresyDebug.advanceElementalForTest(seconds), seconds);
async function finish(page) {
  for (let n = 0; n < 20; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'constructionWork', 'resourceHaul', 'stockpileHaul', 'scientistMove', 'laborWork'].includes(t.type));
    if (!t) return; await advance(page, Math.max(2, t.dueAt - s.clock + 3));
  }
  throw Error(JSON.stringify({ tasks: (await snapshot(page)).tasks, events: (await snapshot(page)).events }));
}
async function action(page, name, id = '') {
  console.info(`Duskcat: ${name}`);
  expect(await page.evaluate(({ name, id }) => window.helixHeresyDebug.stageElementalTestSupplies(name, id), { name, id })).toBe(true);
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
  expect((await snapshot(page)).tasks.some(t => t.type === 'elementalWork'), JSON.stringify((await snapshot(page)).events)).toBe(true);
  await finish(page);
}
function conserved(a) {
  expect(a.bodyKg + a.foodKg + a.metabolizedKg).toBeCloseTo(2 + a.foodReceivedKg, 6);
  expect(a.waterL + a.waterLostL).toBeCloseTo(a.waterReceivedL, 6);
  expect(a.manaReserve + a.manaSpent).toBeCloseTo(a.manaReceived, 6);
}
test('native Duskcat tissue research, original tube, earned cues, physical pounce/custody, both souls and continued consequences', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'duskcat-native-feline');
  await page.evaluate(() => window.helixHeresyDebug.setDuskcatTestLighting(100));
  // Ordinary integration before deliberately isolated long developmental clocks.
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(3)); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.setSporecapTestClimate(20, 60));
  for (const m of ['notes', 'catCharacterize', 'catShadeTrial', 'catBrightTrial', 'catDocument']) await action(page, m);
  let s = await snapshot(page); expect(s.saved.pattern).toBeNull(); expect(s.saved.catPattern.family).toBe('duskcat');
  const shade = s.saved.evidence.find(e => e.method === 'catShadeTrial'), bright = s.saved.evidence.find(e => e.method === 'catBrightTrial');
  expect(shade.receipt.felineTrial).toBeTruthy(); expect(bright.receipt.felineTrial).toBeTruthy();
  const tube = 'synthesisTube'; await action(page, 'catHood', tube); await action(page, 'rootCharge', tube); await action(page, 'growDuskcat', tube);
  await advance(page, 3600); s = await snapshot(page); expect(s.saved.runs[0].status).toBe('forming'); const stocks = s.saved.runs[0].stocks;
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.runs[0].stocks).toEqual(stocks);
  await page.locator('[data-workspace-tab="foundry"]').click(); await expect(page.locator('#synthesizeBtn')).toBeDisabled();
  await advance(page, 25203); s = await snapshot(page); const first = s.saved.creatures[0];
  expect(first.family).toBe('duskcat'); expect(first.formationSoul.present).toBe(true); expect(first.familiarity).toBe(0);
  expect(s.saved.runs[0].manaReceived).toBeCloseTo(4, 6); expect(s.fixtures.some(f => f.typeId === 'elementalChamber')).toBe(false);
  expect(s.stacks.some(i => i.key === 'spent feline development medium' && i.sourceLabels.includes(first.runId))).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('catAttack', id), first.id)).toBe(false);
  for (let n = 0; n < 3; n++) await action(page, 'catSocialize', first.id);
  await action(page, 'catFeed', first.id);
  for (const name of ['catTrainAttack', 'catTrainRecall']) for (let n = 0; n < 4; n++) await action(page, name, first.id);
  let f = await feline(page, first.id); expect(f.actor.lessonReceipts).toHaveLength(11); conserved(f.actor);
  await action(page, 'catWater', first.id); f = await feline(page, first.id);
  expect(f.stacks.some(i => i.key === 'unused feline care water' && i.quantity > 0)).toBe(true);
  await action(page, 'catCarrier', first.id); await action(page, 'catCarry', first.id); f = await feline(page, first.id);
  const carrierId = f.actor.carryStackId; expect(carrierId).toBeTruthy();
  expect(f.stacks.find(i => i.id === carrierId).biology.duskcatCarrier.occupantId).toBe(first.id);
  await action(page, 'clear', first.runId); await action(page, 'catPut', first.id); f = await feline(page, first.id);
  expect(f.actor.chamberId).toBe(''); expect(f.actor.carryStackId).toBe(''); expect(f.stacks.find(i => i.id === carrierId).biology.duskcatCarrier.occupantId).toBe('');
  await action(page, 'catLure', first.id); s = await snapshot(page); const lureId = s.saved.catTargetId;
  expect(lureId).toBeTruthy(); const before = (await feline(page, first.id)).stacks.find(i => i.id === lureId);
  await action(page, 'catAttack', first.id); await advance(page, 12); f = await feline(page, first.id);
  expect(f.actor.cueReceipts.at(-1).targetId).toBe(lureId); expect(f.actor.attacks.length).toBeGreaterThan(0);
  expect(f.stacks.find(i => i.id === lureId).biology.duskcatLure.condition).toBeLessThan(100);
  expect(f.stacks.find(i => i.id === lureId).quantity).toBe(before.quantity); conserved(f.actor);
  await page.getByRole('combobox', { name: `Visible demonstrated target for ${first.name}` }).selectOption('scientist');
  await action(page, 'catAttack', first.id);
  await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(true));
  await advance(page, 20); f = await feline(page, first.id);
  expect(f.actor.attacks.at(-1).targetId).toBe('scientist'); expect(f.actor.attacks.at(-1).kind).toBe('shared physical combat');
  expect(f.actor.attacks.at(-1).damage).toBeLessThanOrEqual(8);
  await page.evaluate(() => window.helixHeresyDebug.setScientistGuarding(false));
  await action(page, 'catRecall', first.id); await advance(page, 12); f = await feline(page, first.id);
  expect(f.actor.cueReceipts.at(-1).kind).toBe('recall');
  // Debug intentionally reveals private truth; concealment acceptance uses the
  // ordinary player view instead of demanding that a debug view hide it.
  if (await page.locator('#debugToggleBtn').getAttribute('aria-pressed') === 'true') await page.locator('#debugToggleBtn').click();
  await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot()); expect(scene.entities.some(e => e.id === first.id && e.visual.glyph === 'D')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('duskcat-canvas.png') });
  }
  const health = f.actor.health; await page.evaluate(() => window.helixHeresyDebug.setDuskcatTestLighting(20)); await advance(page, 20);
  f = await feline(page, first.id); expect(f.environment.light).toBeLessThan(35); expect(f.actor.concealment).toBe(true);
  // Real surface daylight continues changing during this clock. The pure model
  // separately asserts that feline concealment never writes illumination.
  const light = f.environment.light; await advance(page, 30); f = await feline(page, first.id); expect(Math.abs(f.environment.light - light)).toBeLessThan(.1);
  const positions = await page.evaluate(id => window.helixHeresyDebug.duskcatObserverOptions(id), first.id); expect(positions.length).toBeGreaterThan(0);
  expect(await page.evaluate(({ cell, roomId }) => window.helixHeresyDebug.startScientistMove(roomId, { toCell: cell, allowMultiRoom: true }), { cell: positions[0], roomId: f.actor.roomId })).toBeTruthy();
  await finish(page); f = await feline(page, first.id); expect(f.observed).toBe(false);
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('examine', id), first.id)).toBe(false);
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    expect((await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot())).entities.some(e => e.id === first.id)).toBe(false);
  }
  await page.evaluate(() => window.helixHeresyDebug.setDuskcatTestLighting(100)); await advance(page, 2); f = await feline(page, first.id);
  expect(f.actor.concealment).toBe(false); expect(f.actor.health).toBe(health); expect(f.observed).toBe(true);
  await action(page, 'catFeed', first.id); await action(page, 'catCarry', first.id);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'growDuskcat', tube); await advance(page, 28803); s = await snapshot(page); const second = s.saved.creatures[1];
  expect(second.formationSoul.present).toBe(false); expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('catSocialize', id), second.id)).toBe(false);
  await action(page, 'catFeed', second.id); await action(page, 'catCarrier', second.id); await action(page, 'catCarry', second.id); await action(page, 'catPut', second.id);
  await action(page, 'clear', second.runId); const original = (await feline(page, second.id)).actor.mapCell;
  await advance(page, 120); f = await feline(page, second.id); expect(f.actor.mapCell).toEqual(original); expect(f.actor.independentIntent).toBe(''); expect(f.actor.familiarity).toBe(0);
  // Physical source, original actor, training, paid mana and custody survive a continued import.
  await page.locator('[data-workspace-tab="map"]').click(); const pending = page.waitForEvent('download'); await page.locator('#exportFileBtn').click();
  const download = await pending, stream = await download.createReadStream(), chunks = []; for await (const c of stream) chunks.push(c);
  const saved = await snapshot(page);
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-duskcat.json', mimeType: 'application/json', buffer: Buffer.concat(chunks) });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(saved.identity.runId);
  expect((await snapshot(page)).saved.creatures).toEqual(saved.saved.creatures);
  await page.evaluate(id => window.helixHeresyDebug.damageDuskcatForTest(id, 100), first.id); await advance(page, 120);
  const dead = (await feline(page, first.id)).actor; expect(dead.status).toBe('dead'); expect(dead.formationSoul).toEqual(first.formationSoul);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await feline(page, first.id)).actor).toEqual(dead);
  expect(errors).toEqual([]);
});
