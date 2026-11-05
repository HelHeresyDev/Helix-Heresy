const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(1200000);
test.use({ actionTimeout: 15000 });
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
const root = (page, id = '') => page.evaluate(id => window.helixHeresyDebug.rootlingSnapshot(id), id);
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceElementalForTest(n), seconds);
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'constructionWork'].includes(t.type));
    if (!t) return; await advance(page, Math.max(1, t.dueAt - s.clock + 2));
  }
  throw Error(`Unfinished original work: ${JSON.stringify((await snapshot(page)).tasks)}`);
}
async function action(page, action, id = '', reload = false) {
  console.info(`Rootling procedure: ${action}`);
  expect(await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageElementalTestSupplies(action, id), { action, id }), `Stage original ${action} inputs`).toBe(true);
  const tab = page.locator('[data-workspace-tab="research"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.locator(`[data-elemental-action="${action}"][data-elemental-target="${id}"]`).click();
  const s = await snapshot(page), task = s.tasks.find(t => t.type === 'elementalWork'); expect(task, JSON.stringify(s.events)).toBeTruthy();
  if (reload) {
    await advance(page, 10); await page.reload(); await page.locator('#loadLastSaveBtn').click();
    const saved = await snapshot(page); expect(saved.tasks.find(t => t.id === task.id)).toBeTruthy();
    if (task.data.careToolStackId) expect(saved.stacks.find(i => i.id === task.data.careToolStackId).reservedTaskId).toBe(task.id);
    await page.locator('[data-workspace-tab="research"]').click();
  }
  await finish(page);
}
async function build(page, typeId, anchorId) {
  const s = await snapshot(page), legal = await page.evaluate(({ typeId, anchorId }) => window.helixHeresyDebug.elementalBuildOptions(typeId, anchorId), { typeId, anchorId });
  const cells = legal.filter(c => c.x !== s.scientist.x || c.y !== s.scientist.y || c.z !== s.scientist.z);
  expect(cells.length, `Legal ${typeId} placements`).toBeGreaterThan(0);
  cells.sort((a, b) => Math.abs(a.x - s.scientist.x) + Math.abs(a.y - s.scientist.y) - Math.abs(b.x - s.scientist.x) - Math.abs(b.y - s.scientist.y));
  const before = s.fixtures.map(f => f.id);
  expect(await page.evaluate(({ typeId, cell }) => window.helixHeresyDebug.designateConstruction('build', [cell],
    { buildType: `fixture:${typeId}`, materialPolicy: typeId === 'rootlingPlanter' ? 'wood' : 'steel', rotation: 0 }), { typeId, cell: cells[0] })).toBe(true);
  await finish(page); const f = (await snapshot(page)).fixtures.find(f => f.typeId === typeId && !before.includes(f.id));
  expect(f, `Ordinary construction, not an endowed apparatus: ${JSON.stringify((await snapshot(page)).construction)}`).toBeTruthy(); return f.id;
}
function conserved(before, after) { for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) expect(after[id] || 0, id).toBeCloseTo(before[id] || 0, 6); }
test('native original-tube Rootling propagation, bounded air/liquid filtration, polluted maintenance, roots, both souls and continued import', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'rootling-biological-filtration');
  // Explicit climate fixture: this world's unheated starting tile is 4.6 °C.
  // Preserve all original matter, apparatus, performed work and soul outcomes.
  expect(await page.evaluate(() => window.helixHeresyDebug.setRootlingTestGrowingTemperature(20))).toBe(true);
  await action(page, 'notes'); await action(page, 'rootCharacterize'); await action(page, 'rootWetTrial'); await action(page, 'rootShadeTrial'); await action(page, 'rootDocument');
  let s = await snapshot(page), r = await root(page); expect(s.saved.rootPattern.family).toBe('rootling');
  const trials = s.saved.evidence.filter(e => ['rootWetTrial', 'rootShadeTrial'].includes(e.method));
  expect(trials[0].receipt.botanicalTrial.growthSignal).toBeGreaterThan(trials[1].receipt.botanicalTrial.growthSignal);
  expect(s.fixtures.some(f => f.typeId === 'elementalChamber')).toBe(false);
  const tube = r.tube.id; expect(r.tubeEnvironment.lightLevel).toBeGreaterThanOrEqual(20);
  await action(page, 'rootCharge', tube); await action(page, 'growRootling', tube); await advance(page, 10800);
  s = await snapshot(page); expect(s.saved.runs[0].status, JSON.stringify({ root: await root(page), run: s.saved.runs[0], device: s.fixtures.find(f => f.typeId === 'animancyDevice'), stacks: s.stacks.filter(i => i.reservedTaskId || i.sourceLabels.includes(s.saved.runs[0].id)) })).toBe('forming'); expect(s.saved.runs[0].consumed.drinkingWater).toBe(1);
  const stocks = s.saved.runs[0].stocks; expect((await root(page)).tubeBlocked).toContain('botanical');
  await page.locator('[data-workspace-tab="foundry"]').click(); await expect(page.locator('#synthesizeBtn')).toBeDisabled();
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.runs[0].stocks).toEqual(stocks);
  await advance(page, 10860); s = await snapshot(page); const original = s.saved.creatures[0], soul = original.formationSoul;
  expect(original.family).toBe('rootling'); expect(soul.present).toBe(true); expect(original.chamberId).toBe(tube);
  expect(s.saved.runs[0].manaReceived).toBeCloseTo(2, 7);
  const planter = await build(page, 'rootlingPlanter', tube);
  await action(page, 'rootPlant', original.id); await action(page, 'clear', original.runId);
  expect((await root(page)).tubeBlocked).toBe(''); expect((await root(page, original.id)).actor.planterId).toBe(planter);
  expect(await page.evaluate(id => window.helixHeresyDebug.setRootlingTestAir(id), original.id)).toBe(true);
  await action(page, 'rootAir', original.id); let before = await root(page, original.id); await advance(page, 7200); r = await root(page, original.id);
  expect(r.environment.airborne['cinderling-smoke']).toBeLessThan(before.environment.airborne['cinderling-smoke']);
  expect(r.environment.airborne['unsupported-test-gas']).toBe(before.environment.airborne['unsupported-test-gas']);
  expect(Object.values(r.actor.surfaceLoad).reduce((n, v) => n + v, 0)).toBeGreaterThan(0); conserved(before.loads, r.loads);
  await action(page, 'rootOff', original.id);
  before = await root(page, original.id); await action(page, 'rootWash', original.id); r = await root(page, original.id); expect(r.actor.surfaceLoad).toEqual({}); conserved(before.loads, r.loads);
  expect((await snapshot(page)).stacks.some(i => i.key === 'rootling washwater' && i.biology.rootlingLiquid.substances['cinderling-smoke'] > 0)).toBe(true);
  await action(page, 'rootLoad', original.id); await action(page, 'rootLiquid', original.id);
  before = await root(page, original.id); expect(before.actor.liquid.sourceIds.length).toBe(1); await advance(page, 4 * 3600); r = await root(page, original.id);
  expect(r.actor.liquid.substances['spent-assay-solute']).toBeLessThan(before.actor.liquid.substances['spent-assay-solute']);
  expect(r.actor.liquid.substances['spent-assay-solute']).toBeGreaterThan(0); conserved(before.loads, r.loads);
  const already = r.actor.liquid.substances['spent-assay-solute']; await advance(page, 3600); r = await root(page, original.id);
  expect(r.actor.liquid.substances['spent-assay-solute']).toBeGreaterThan(already - .02);
  before = r; await action(page, 'rootDrain', original.id); r = await root(page, original.id); expect(r.actor.liquid).toBeNull(); conserved(before.loads, r.loads);
  expect((await snapshot(page)).stacks.some(i => i.key === 'rootling treated nonpotable water' && i.tags.includes('nonpotable'))).toBe(true);
  before = r; await action(page, 'rootReplace', original.id); r = await root(page, original.id); conserved(before.loads, r.loads);
  expect(r.actor.substrateLoad).toEqual({}); expect(r.actor.tissueLoad).toEqual(before.actor.tissueLoad);
  expect((await snapshot(page)).stacks.some(i => i.key === 'rootling spent substrate' && i.biology.rootlingWaste.substances['spent-assay-solute'] > 0)).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.stageOriginalRootlingTestDrain(id), original.id)).toBe('starter-floor-drain');
  await action(page, 'rootGuide', original.id); await advance(page, 5 * 3600);
  r = await root(page, original.id); expect(r.actor.rootLength).toBeGreaterThan(.9); expect(r.drainFactor).toBeLessThan(.3);
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('release', id), original.id)).toBe(false);
  const beforeHealth = r.actor.health, beforeScraper = (await snapshot(page)).tools.scraper[0].current;
  before = r; await action(page, 'rootPrune', original.id, true); r = await root(page, original.id);
  expect(r.actor.rootCell).toBeNull(); expect(r.drainFactor).toBe(1); expect(r.actor.health).toBeLessThan(beforeHealth);
  expect((await snapshot(page)).tools.scraper[0].current).toBeLessThan(beforeScraper); conserved(before.loads, r.loads);
  expect(r.mass + r.actor.respiredKg + r.actor.prunedKg + r.actor.discardedMediumKg).toBeCloseTo(r.actor.materialReceivedKg, 6);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'growRootling', tube); await advance(page, 21660); const unordered = (await snapshot(page)).saved.creatures[1];
  expect(unordered.formationSoul.present).toBe(false); await action(page, 'release', unordered.id); await action(page, 'clear', unordered.runId);
  const nearWater = await page.evaluate(id => window.helixHeresyDebug.stageCinderlingContactTest(id, 'drinkingWater', true), unordered.id);
  expect(nearWater).toBeTruthy(); const waterQuantity = (await snapshot(page)).stacks.find(i => i.id === nearWater).quantity;
  await advance(page, 120); expect((await snapshot(page)).stacks.find(i => i.id === nearWater).quantity).toBe(waterQuantity);
  expect((await root(page, unordered.id)).actor.independentIntent).toBe('');
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('souled');
  await action(page, 'growRootling', tube); await advance(page, 10800); await page.evaluate(() => window.helixHeresyDebug.setElementalTestDeviceEnabled(false)); await advance(page, 1801);
  s = await snapshot(page); expect(s.saved.runs[2].status).toBe('failed'); expect(s.saved.creatures).toHaveLength(2);
  expect(s.stacks.some(i => i.key === 'failed botanical formation residue' && i.sourceLabels.includes(s.saved.runs[2].id))).toBe(true);
  await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode); const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot());
    expect(scene.entities.some(e => e.id === original.id && e.visual.glyph === 'R')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('rootling-canvas.png') });
  }
  const downloadEvent = page.waitForEvent('download'); await page.locator('#exportFileBtn').click(); const download = await downloadEvent;
  const stream = await download.createReadStream(), chunks = []; for await (const c of stream) chunks.push(c);
  const data = Buffer.concat(chunks), saved = await snapshot(page), savedLoads = (await root(page)).loads;
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-rootling.json', mimeType: 'application/json', buffer: data });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(saved.identity.runId);
  expect((await snapshot(page)).saved.creatures).toEqual(saved.saved.creatures); conserved(savedLoads, (await root(page)).loads);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestExposure(-20, 50)); await advance(page, 12 * 3600);
  s = await snapshot(page); expect(s.saved.creatures.every(a => a.status === 'dead')).toBe(true); expect(s.saved.creatures[0].formationSoul).toEqual(soul);
  const dead = s.saved.creatures; await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.creatures).toEqual(dead);
  conserved(savedLoads, (await root(page)).loads); expect(errors).toEqual([]);
});
