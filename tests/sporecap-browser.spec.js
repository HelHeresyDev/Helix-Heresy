const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(900000);
test.use({ actionTimeout: 15000 });
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
const fungus = (page, id) => page.evaluate(id => window.helixHeresyDebug.sporecapSnapshot(id), id);
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceElementalForTest(n), n);
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'constructionWork'].includes(t.type));
    if (!t) return; await advance(page, Math.max(1, t.dueAt - s.clock + 2));
  }
  throw Error(JSON.stringify((await snapshot(page)).tasks));
}
async function researchTab(page) { const tab = page.locator('[data-workspace-tab="research"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click(); }
async function action(page, action, id = '', reload = false) {
  console.info(`Sporecap procedure: ${action}`);
  expect(await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageElementalTestSupplies(action, id), { action, id })).toBe(true);
  await researchTab(page);
  await page.locator(`[data-elemental-action="${action}"][data-elemental-target="${id}"]`).click();
  const task = (await snapshot(page)).tasks.find(t => t.type === 'elementalWork'); expect(task, JSON.stringify((await snapshot(page)).events)).toBeTruthy();
  if (reload) {
    await advance(page, 10); await page.reload(); await page.locator('#loadLastSaveBtn').click();
    const s = await snapshot(page); expect(s.tasks.find(t => t.id === task.id)).toBeTruthy();
    for (const stack of task.data.reservedStackIds) expect(s.stacks.find(i => i.id === stack).reservedTaskId).toBe(task.id);
    await researchTab(page);
  }
  await finish(page);
}
function conserved(a, mass) { expect(mass + a.respiredKg + a.emittedSporeKg + a.washedSporeKg + a.discardedSpentKg).toBeCloseTo(a.materialReceivedKg, 6); }
test('native Sporecap research, original tube, both souls, supplied decomposition, spore containment/cleaning and continued death state', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'sporecap-contained-decomposition');
  // Explicit environmental input, not a granted heater, research or creature.
  expect(await page.evaluate(() => window.helixHeresyDebug.setSporecapTestClimate(20, 60))).toBe(true);
  for (const m of ['notes', 'fungusCharacterize', 'fungusWetTrial', 'fungusDryTrial', 'fungusDocument']) await action(page, m);
  let s = await snapshot(page); expect(s.saved.rootPattern).toBeNull(); expect(s.saved.fungalPattern.family).toBe('sporecap');
  const wet = s.saved.evidence.find(e => e.method === 'fungusWetTrial'), dry = s.saved.evidence.find(e => e.method === 'fungusDryTrial');
  expect(wet.receipt.fungalTrial.colonizationSignal).toBeGreaterThan(dry.receipt.fungalTrial.colonizationSignal);
  const tube = 'synthesisTube'; await action(page, 'rootCharge', tube); await action(page, 'growSporecap', tube); await advance(page, 3600);
  s = await snapshot(page); expect(s.saved.runs[0].status).toBe('forming'); expect(s.saved.runs[0].consumed.fungalStarter).toBe(1);
  const stocks = s.saved.runs[0].stocks; await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snapshot(page)).saved.runs[0].stocks).toEqual(stocks);
  await page.locator('[data-workspace-tab="foundry"]').click(); await expect(page.locator('#synthesizeBtn')).toBeDisabled();
  await advance(page, 10860); s = await snapshot(page); const first = s.saved.creatures[0], soul = first.formationSoul;
  expect(soul.present).toBe(true); expect(first.family).toBe('sporecap'); expect(s.saved.runs[0].manaReceived).toBeCloseTo(2, 6);
  expect(s.fixtures.some(f => f.typeId === 'elementalChamber')).toBe(false);
  const options = await page.evaluate(() => window.helixHeresyDebug.elementalBuildOptions('rootlingPlanter', 'synthesisTube'));
  const cell = options.filter(c => c.x !== s.scientist.x || c.y !== s.scientist.y).sort((a, b) => Math.abs(a.x - s.scientist.x) + Math.abs(a.y - s.scientist.y) - Math.abs(b.x - s.scientist.x) - Math.abs(b.y - s.scientist.y))[0];
  expect(cell).toBeTruthy(); expect(await page.evaluate(cell => window.helixHeresyDebug.designateConstruction('build', [cell], { buildType: 'fixture:rootlingPlanter', materialPolicy: 'wood', rotation: 0 }), cell)).toBe(true);
  await finish(page); expect((await snapshot(page)).fixtures.some(f => f.typeId === 'rootlingPlanter')).toBe(true);
  await action(page, 'fungusPlant', first.id); await action(page, 'clear', first.runId);
  await advance(page, 3600); let f = await fungus(page, first.id);
  expect(f.actor.digestedKg).toBeGreaterThan(.04); expect(f.airGrams).toBeGreaterThan(0); expect(f.patches.length).toBeGreaterThan(0); conserved(f.actor, f.mass);
  expect(f.airGrams + f.patches.reduce((n, i) => n + i.quantity, 0)).toBeCloseTo(f.actor.emittedSporeKg * 1000, 5);
  await action(page, 'fungusFitCover', first.id); f = await fungus(page, first.id); const air = f.airGrams;
  await advance(page, 5 * 3600); f = await fungus(page, first.id); expect(f.airGrams).toBeCloseTo(air, 7); expect(f.actor.coverSporeKg).toBeCloseTo(.02, 7); conserved(f.actor, f.mass);
  const total = f.sporeGrams; await action(page, 'fungusWash', first.id); f = await fungus(page, first.id);
  expect(f.washGrams).toBeGreaterThanOrEqual(20); expect(f.actor.coverSporeKg).toBeLessThan(.001);
  await action(page, 'fungusCleanResidue', first.id); f = await fungus(page, first.id); expect(f.patches).toEqual([]);
  // New sporulation during attended care is finite; washing transfers rather than deletes.
  expect(f.sporeGrams).toBeGreaterThanOrEqual(total); conserved(f.actor, f.mass);
  const before = f.actor.materialReceivedKg; await action(page, 'fungusFeed', first.id, true); f = await fungus(page, first.id);
  expect(f.actor.materialReceivedKg).toBeCloseTo(before + .25, 6); expect(f.actor.feedSources.at(-1).sourceIds.length).toBeGreaterThan(0); conserved(f.actor, f.mass);
  await action(page, 'fungusSpent', first.id); expect((await snapshot(page)).stacks.some(i => i.key === 'sporecap spent compost' && i.tags.includes('nonpotable'))).toBe(true);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'growSporecap', tube); await advance(page, 14460); const second = (await snapshot(page)).saved.creatures[1];
  expect(second.formationSoul.present).toBe(false); await action(page, 'release', second.id); await action(page, 'clear', second.runId);
  const loose = await page.evaluate(id => window.helixHeresyDebug.stageCinderlingContactTest(id, 'plantCompost', true), second.id);
  expect(loose).toBeTruthy(); const quantity = (await snapshot(page)).stacks.find(i => i.id === loose).quantity;
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestExposure(20, 20)); await advance(page, 120);
  expect((await fungus(page, first.id)).actor.gillsClosed).toBe(true); expect((await fungus(page, second.id)).actor.gillsClosed).toBe(false);
  expect((await snapshot(page)).stacks.find(i => i.id === loose).quantity).toBe(quantity);
  expect((await fungus(page, second.id)).actor.independentIntent).toBe('');
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('souled');
  await action(page, 'growSporecap', tube); await advance(page, 7200);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestDeviceEnabled(false)); await advance(page, 1801);
  s = await snapshot(page); expect(s.saved.runs[2].status).toBe('failed'); expect(s.saved.creatures).toHaveLength(2);
  expect(s.stacks.some(i => i.key === 'failed fungal formation residue' && i.sourceLabels.includes(s.saved.runs[2].id))).toBe(true);
  await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot()); expect(scene.entities.some(e => e.id === first.id && e.visual.glyph === 'S')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('sporecap-canvas.png') });
  }
  const pending = page.waitForEvent('download'); await page.locator('#exportFileBtn').click(); const download = await pending, stream = await download.createReadStream(), chunks = [];
  for await (const c of stream) chunks.push(c); const saved = await snapshot(page), spores = (await fungus(page, first.id)).sporeGrams;
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-sporecap.json', mimeType: 'application/json', buffer: Buffer.concat(chunks) });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(saved.identity.runId);
  expect((await snapshot(page)).saved.creatures).toEqual(saved.saved.creatures); expect((await fungus(page, first.id)).sporeGrams).toBeCloseTo(spores, 6);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestExposure(-20, 50)); await advance(page, 12 * 3600);
  s = await snapshot(page); expect(s.saved.creatures.every(a => a.status === 'dead')).toBe(true); expect(s.saved.creatures[0].formationSoul).toEqual(soul);
  const dead = s.saved.creatures; await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snapshot(page)).saved.creatures).toEqual(dead);
  expect((await fungus(page, first.id)).sporeGrams).toBeCloseTo(spores, 6); expect(errors).toEqual([]);
});
