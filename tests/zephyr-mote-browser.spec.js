const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(540000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
const zephyr = (page, id = '') => page.evaluate(id => window.helixHeresyDebug.zephyrSnapshot(id), id);
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceElementalForTest(n), seconds);
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'constructionWork'].includes(t.type));
    if (!t) return;
    await advance(page, Math.max(1, t.dueAt - s.clock + 2));
  }
  throw Error(`Unfinished original work: ${JSON.stringify((await snapshot(page)).tasks)}`);
}
async function action(page, action, id = '', reload = false) {
  console.info(`Zephyr procedure: ${action}`);
  expect(await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageElementalTestSupplies(action, id), { action, id })).toBe(true);
  const tab = page.locator('[data-workspace-tab="research"]');
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.locator(`[data-elemental-action="${action}"][data-elemental-target="${id}"]`).click();
  const s = await snapshot(page), task = s.tasks.find(t => t.type === 'elementalWork');
  expect(task, JSON.stringify(s.events)).toBeTruthy();
  if (reload) {
    await advance(page, 10); await page.reload(); await page.locator('#loadLastSaveBtn').click();
    const saved = await snapshot(page); expect(saved.tasks.find(t => t.id === task.id)).toBeTruthy();
    expect(saved.fixtures.find(f => f.id === task.data.vesselId).productionTaskId).toBe(task.id);
  }
  await finish(page);
}
async function build(page, typeId, anchorId = '') {
  const s = await snapshot(page);
  const cells = await page.evaluate(({ typeId, anchorId }) => window.helixHeresyDebug.elementalBuildOptions(typeId, anchorId), { typeId, anchorId });
  expect(cells.length).toBeGreaterThan(0);
  cells.sort((a, b) => Math.abs(a.x - s.scientist.x) + Math.abs(a.y - s.scientist.y) - Math.abs(b.x - s.scientist.x) - Math.abs(b.y - s.scientist.y));
  expect(await page.evaluate(({ typeId, cell }) => window.helixHeresyDebug.designateConstruction('build', [cell],
    { buildType: `fixture:${typeId}`, materialPolicy: typeId === 'moteVessel' ? 'glass' : 'steel', rotation: 0 }), { typeId, cell: cells[0] })).toBe(true);
  await finish(page); const f = (await snapshot(page)).fixtures.find(f => f.typeId === typeId);
  expect(f, 'Ordinary constructed original apparatus, not an injected fixture').toBeTruthy(); return f.id;
}
function conserved(before, after) {
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) expect(after[id] || 0, id).toBeCloseTo(before[id] || 0, 7);
}
test('native Zephyr research, finite conserved air circulation, physical vessel, both soul outcomes, collapse and continued import', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'zephyr-vortex-physical-workflow');
  await action(page, 'notes'); await action(page, 'airCharacterize');
  let s = await snapshot(page); expect(s.saved.knowledge.characterized).toBe(false); expect(s.saved.fireKnowledge.characterized).toBe(false);
  expect(await page.evaluate(() => window.helixHeresyDebug.elementalAction('airDocument'))).toBe(false);
  const chamber = await build(page, 'elementalChamber'); await action(page, 'charge', chamber);
  await action(page, 'airLow', chamber); await action(page, 'airHigh', chamber); await action(page, 'airDocument');
  s = await snapshot(page); expect(s.saved.airPattern.family).toBe('zephyrMote');
  const trials = s.saved.evidence.filter(e => ['airLow', 'airHigh'].includes(e.method));
  expect(trials.map(e => e.receipt.coherence)).toEqual([100, 25]);
  expect(trials.every(e => e.receipt.capturedAir.volumeM3 === .1 && e.receipt.manaSpent > .99)).toBe(true);
  const totalBefore = (await zephyr(page)).totals;
  await action(page, 'growZephyr', chamber); await advance(page, 300);
  s = await snapshot(page); expect(s.saved.runs[0].status).toBe('forming'); expect(s.saved.creatures).toHaveLength(0);
  const captured = s.saved.runs[0].airParcel; expect(captured.volumeM3).toBe(.1);
  expect((await zephyr(page)).chamberEnvironments[0].airVolumeDeltaM3).toBeCloseTo(-.1, 7);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snapshot(page)).saved.runs[0].airParcel).toEqual(captured);
  await advance(page, 310); s = await snapshot(page); const original = s.saved.creatures[0], soul = original.formationSoul;
  expect(soul.present).toBe(true); expect(original.family).toBe('zephyrMote'); expect(original.manaReserve).toBeLessThanOrEqual(2);
  expect(s.saved.runs[0].manaReceived).toBeCloseTo(4, 7); conserved(totalBefore, (await zephyr(page)).totals);
  const vessel = await build(page, 'moteVessel', chamber);
  await action(page, 'vesselMote', original.id, true); await action(page, 'clear', original.runId);
  expect((await snapshot(page)).saved.creatures[0].vesselId).toBe(vessel);
  for (let n = 0; n < 4 && !(await zephyr(page, original.id)).passage; n++) await action(page, 'orientMote', original.id);
  expect(await page.evaluate(id => window.helixHeresyDebug.setZephyrTestAir(id), original.id)).toBe(true);
  let air = await zephyr(page, original.id), before = air;
  await advance(page, 120); air = await zephyr(page, original.id);
  expect(air.actor.circulatedM3).toBe(0); expect(air.fromEnvironment.airborne).toEqual(before.fromEnvironment.airborne);
  expect(air.actor.manaReserve).toBeLessThan(before.actor.manaReserve);
  await action(page, 'gentleMote', original.id); before = await zephyr(page, original.id);
  await advance(page, 600); air = await zephyr(page, original.id);
  conserved(before.totals, air.totals);
  expect(air.actor.circulatedM3).toBeGreaterThan(before.actor.circulatedM3);
  expect(air.fromEnvironment.airborne['chemistry-test-fumes']).toBeLessThan(before.fromEnvironment.airborne['chemistry-test-fumes']);
  expect(air.toEnvironment.airborne['chemistry-test-fumes']).toBeGreaterThan(before.toEnvironment.airborne['chemistry-test-fumes'] || 0);
  expect(air.barriers.length).toBeGreaterThan(0); expect(air.barriers.every(b => b.body === 0)).toBe(true);
  await action(page, 'orientMote', original.id); expect((await zephyr(page, original.id)).actor.direction).toBe(1);
  await action(page, 'sealMote', original.id); before = await zephyr(page, original.id); await advance(page, 120);
  expect((await zephyr(page, original.id)).actor.circulatedM3).toBe(before.actor.circulatedM3);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'charge', chamber); await action(page, 'growZephyr', chamber); await advance(page, 610);
  const unordered = (await snapshot(page)).saved.creatures[1]; expect(unordered.formationSoul.present).toBe(false);
  await action(page, 'release', unordered.id); await action(page, 'clear', unordered.runId);
  const source = await page.evaluate(id => window.helixHeresyDebug.stageCinderlingContactTest(id, 'arcaneFeedstock', true), unordered.id);
  expect(source, JSON.stringify((await snapshot(page)).stacks.filter(i => i.key === 'arcaneFeedstock'))).toBeTruthy(); const sourceQuantity = (await snapshot(page)).stacks.find(i => i.id === source).quantity;
  const cell = (await zephyr(page, unordered.id)).actor.mapCell; await advance(page, 1800);
  air = await zephyr(page, unordered.id); expect(air.actor.mapCell).toEqual(cell); expect(air.actor.independentIntent).toBe('');
  expect(air.actor.manaReserve).toBeLessThan(unordered.manaReserve);
  expect((await snapshot(page)).stacks.find(i => i.id === source).quantity).toBe(sourceQuantity);
  // Only after the unordered body demonstrably ignores this real original
  // remaining unit does the scientist administer it to the other individual.
  await action(page, 'rechargeMote', original.id); expect((await zephyr(page, original.id)).actor.manaReserve).toBeGreaterThan(8);
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('rechargeMote', id), original.id)).toBe(false);
  await action(page, 'strongMote', original.id); before = await zephyr(page, original.id);
  await advance(page, 600); air = await zephyr(page, original.id);
  expect(air.actor.coherence).toBeLessThan(before.actor.coherence); conserved(before.totals, air.totals);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('souled');
  const beforeFailure = (await zephyr(page)).totals;
  await action(page, 'growZephyr', chamber); await advance(page, 300);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestDeviceEnabled(false)); await advance(page, 125);
  s = await snapshot(page); expect(s.saved.runs[2].status).toBe('failed'); expect(s.saved.runs[2].airParcel.released).toBe(true);
  expect(s.saved.creatures).toHaveLength(2); conserved(beforeFailure, (await zephyr(page)).totals);
  await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot());
    expect(scene.entities.some(e => e.id === unordered.id && e.visual.glyph === 'Z')).toBe(true);
    expect(scene.entities.some(e => e.id === original.id && e.visual.glyph === 'Z')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('zephyr-canvas.png') });
  }
  const downloadEvent = page.waitForEvent('download'); await page.locator('#exportFileBtn').click(); const download = await downloadEvent;
  const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const data = Buffer.concat(chunks), saved = await snapshot(page), savedAir = await zephyr(page);
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-zephyr.json', mimeType: 'application/json', buffer: data });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(saved.identity.runId);
  expect((await snapshot(page)).saved.creatures).toEqual(saved.saved.creatures); conserved(savedAir.totals, (await zephyr(page)).totals);
  expect((await snapshot(page)).saved.runs[2].airParcel.released).toBe(true);
  await advance(page, 60); expect((await zephyr(page, unordered.id)).actor.manaReserve).toBeLessThanOrEqual(saved.saved.creatures[1].manaReserve);
  const beforeCollapse = (await zephyr(page)).totals; await advance(page, 6 * 3600); air = await zephyr(page, original.id);
  expect(air.actor.status).toBe('dead'); expect(air.actor.airReturned).toBe(true);
  expect(air.actor.formationSoul).toEqual(soul); conserved(beforeCollapse, air.totals);
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('rechargeMote', id), original.id)).toBe(false);
  await action(page, 'release', original.id); await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot());
    expect(scene.entities.some(e => e.id === original.id && e.visual.glyph === '†')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  }
  expect(errors).toEqual([]);
});
