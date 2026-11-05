const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
const advance = (page, seconds) => page.evaluate(n => window.helixHeresyDebug.advanceElementalForTest(n), seconds);
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'constructionWork'].includes(t.type));
    if (!t) return;
    await advance(page, Math.max(1, t.dueAt - s.clock + 2));
  }
  throw Error(`Unfinished original work: ${JSON.stringify((await snapshot(page)).tasks)}`);
}
async function action(page, action, id = '') {
  console.info(`Cinderling procedure: ${action}`);
  expect(await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageElementalTestSupplies(action, id), { action, id }), `Stage original ${action} inputs`).toBe(true);
  const tab = page.locator('[data-workspace-tab="research"]');
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.locator(`[data-elemental-action="${action}"][data-elemental-target="${id}"]`).click({ timeout: 10000 });
  const s = await snapshot(page);
  expect(s.tasks.some(t => t.type === 'elementalWork'), JSON.stringify(s.events)).toBe(true);
  await finish(page);
}
async function build(page, typeId, anchorId = '') {
  const s = await snapshot(page);
  const candidates = await page.evaluate(({ typeId, anchorId }) => window.helixHeresyDebug.elementalBuildOptions(typeId, anchorId), { typeId, anchorId });
  expect(candidates.length, `Actual legal ${typeId} placement`).toBeGreaterThan(0);
  candidates.sort((a, b) => Math.abs(a.x - s.scientist.x) + Math.abs(a.y - s.scientist.y) - Math.abs(b.x - s.scientist.x) - Math.abs(b.y - s.scientist.y));
  expect(await page.evaluate(({ typeId, cell }) => window.helixHeresyDebug.designateConstruction('build', [cell],
    { buildType: `fixture:${typeId}`, materialPolicy: typeId === 'emberBrazier' ? 'stone' : 'steel', rotation: 0 }), { typeId, cell: candidates[0] })).toBe(true);
  await finish(page);
  const result = (await snapshot(page)).fixtures.find(f => f.typeId === typeId);
  expect(result, `Constructed ${typeId}, no fixture endowment`).toBeTruthy(); return result.id;
}
test('performed Cinderling formation, finite light/heat/fuel, original fireproof handling, quenching and continued import', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'cinderling-physical-workflow');
  await action(page, 'notes'); await action(page, 'fireCharacterize');
  let s = await snapshot(page); expect(s.saved.knowledge.characterized).toBe(false);
  expect(s.stacks.filter(i => i.key === 'clay').reduce((n, i) => n + i.quantity, 0)).toBe(8);
  const chamber = await build(page, 'elementalChamber');
  await action(page, 'charge', chamber); await action(page, 'fireStability', chamber); await action(page, 'fireDocument');
  expect((await snapshot(page)).saved.firePattern.family).toBe('cinderling');
  await action(page, 'growCinderling', chamber); await advance(page, 300);
  s = await snapshot(page); const loaded = s.saved.runs[0];
  expect(loaded.consumed.charcoal).toBe(1); expect(s.saved.creatures).toHaveLength(0);
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snapshot(page)).saved.runs[0].stocks).toEqual(loaded.stocks);
  await advance(page, 310); s = await snapshot(page);
  const original = s.saved.creatures[0], soul = original.formationSoul;
  expect(original.family).toBe('cinderling'); expect(soul.present).toBe(true);
  expect(s.saved.runs[0].status).toBe('completed');
  await page.evaluate(() => window.helixHeresyDebug.darkCinderlingTestInputs());
  expect((await snapshot(page)).environments[0].environment.lightLevel).toBeGreaterThan(0);
  // No hot-body handling can use a remote tool count as actual protection.
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('release', id), original.id)).toBe(false);
  const brazier = await build(page, 'emberBrazier', chamber);
  await action(page, 'brazier', original.id); await action(page, 'clear', loaded.id);
  s = await snapshot(page); expect(s.saved.creatures[0].brazierId).toBe(brazier);
  const wood = await page.evaluate(id => window.helixHeresyDebug.stageCinderlingContactTest(id, 'lumber'), original.id);
  expect(wood).toBeTruthy(); const woodBefore = (await snapshot(page)).stacks.find(i => i.id === wood).quantity;
  const fuelBefore = (await snapshot(page)).saved.creatures[0].fuelUnits;
  await advance(page, 600); s = await snapshot(page);
  expect(s.saved.creatures[0].fuelUnits).toBeLessThan(fuelBefore);
  expect(s.stacks.find(i => i.id === wood).quantity).toBe(woodBefore);
  expect(s.saved.ignitions[wood]).toBeUndefined();
  await action(page, 'feedCinderling', original.id); await action(page, 'feedCinderling', original.id);
  await action(page, 'release', original.id);
  expect(await page.evaluate(id => window.helixHeresyDebug.stageCinderlingContactTest(id, 'lumber'), original.id)).toBe(wood);
  const temperature = (await snapshot(page)).environments[0].environment.temperatureC;
  await advance(page, 7200); s = await snapshot(page);
  expect(s.saved.ignitions[wood].consumed).toBeGreaterThanOrEqual(1);
  expect(s.stacks.find(i => i.id === wood).quantity).toBeLessThan(woodBefore);
  expect(s.environments[0].environment.temperatureC).toBeGreaterThan(temperature);
  expect(s.saved.creatures[0].fuelUnits + s.saved.creatures[0].ashUnits + s.saved.creatures[0].emittedUnits).toBeCloseTo(s.saved.creatures[0].fuelReceived, 6);
  expect(s.tools.longTongs[0].current).toBeLessThan(s.tools.longTongs[0].max);
  const light = s.environments[0].environment.lightLevel;
  await action(page, 'quenchCinderling', original.id); s = await snapshot(page);
  expect(s.saved.creatures[0].status).toBe('dead'); expect(s.saved.creatures[0].formationSoul).toEqual(soul);
  expect(s.environments[0].light).toBe(0); expect(s.environments[0].environment.lightLevel).toBeLessThan(light);
  expect(await page.evaluate(id => window.helixHeresyDebug.elementalAction('feedCinderling', id), original.id)).toBe(false);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'growCinderling', chamber); await advance(page, 610);
  const unassisted = (await snapshot(page)).saved.creatures[1]; expect(unassisted.formationSoul.present).toBe(false);
  await action(page, 'release', unassisted.id); await action(page, 'clear', (await snapshot(page)).saved.runs[1].id);
  await advance(page, 5600); const cell = (await snapshot(page)).saved.creatures[1].mapCell;
  const fuelStock = await page.evaluate(id => window.helixHeresyDebug.stageCinderlingContactTest(id, 'charcoal', true), unassisted.id);
  expect(fuelStock).toBeTruthy(); const fuelQuantity = (await snapshot(page)).stacks.find(i => i.id === fuelStock).quantity;
  await advance(page, 120); s = await snapshot(page);
  expect(s.saved.creatures[1].mapCell).toEqual(cell); expect(s.saved.creatures[1].independentIntent).toBe('');
  expect(s.stacks.find(i => i.id === fuelStock).quantity).toBe(fuelQuantity);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('souled');
  await action(page, 'growCinderling', chamber); await advance(page, 300);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestDeviceEnabled(false)); await advance(page, 125);
  s = await snapshot(page); expect(s.saved.runs[2].status).toBe('failed'); expect(s.saved.creatures).toHaveLength(2);
  expect(s.stacks.some(i => i.key === 'failed ember formation residue' && i.sourceLabels.includes(s.saved.runs[2].id))).toBe(true);
  await page.locator('[data-workspace-tab="map"]').click();
  for (const mode of ['dom', 'canvas']) {
    await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot());
    expect(scene.entities.some(e => e.id === unassisted.id && e.visual.glyph === 'C')).toBe(true);
    expect(scene.entities.some(e => e.id === original.id && e.visual.glyph === '†')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
  }
  const nextDownload = page.waitForEvent('download'); await page.locator('#exportFileBtn').click(); const download = await nextDownload;
  const stream = await download.createReadStream(), chunks = []; for await (const c of stream) chunks.push(c);
  const data = Buffer.concat(chunks), before = await snapshot(page);
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-cinderling.json', mimeType: 'application/json', buffer: data });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(before.identity.runId);
  s = await snapshot(page); expect(s.saved.creatures.map(a => [a.id, a.formationSoul, a.fuelUnits, a.ashUnits])).toEqual(before.saved.creatures.map(a => [a.id, a.formationSoul, a.fuelUnits, a.ashUnits]));
  expect(s.saved.ignitions).toEqual(before.saved.ignitions); expect(s.saved.runs[2].status).toBe('failed');
  await advance(page, 60); expect((await snapshot(page)).saved.creatures[1].fuelUnits).toBeLessThan(s.saved.creatures[1].fuelUnits);
  expect(errors).toEqual([]);
});
