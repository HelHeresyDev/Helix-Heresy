const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(420000);
const snapshot = page => page.evaluate(() => window.helixHeresyDebug.elementalSnapshot());
async function advance(page, seconds) { await page.evaluate(n => window.helixHeresyDebug.advanceElementalForTest(n), seconds); }
async function finish(page) {
  for (let n = 0; n < 12; n++) {
    const s = await snapshot(page), t = s.tasks.find(t => ['elementalWork', 'synthesize', 'resourceHaul', 'constructionWork'].includes(t.type)); if (!t) return;
    await advance(page, Math.max(1, t.dueAt - s.clock + 2));
  }
  throw Error(JSON.stringify((await snapshot(page)).tasks));
}
async function action(page, action, id = '') {
  console.info(`Elemental procedure: ${action} ${id}`);
  const staged = await page.evaluate(({ action, id }) => window.helixHeresyDebug.stageElementalTestSupplies(action, id), { action, id });
  if (!staged) throw Error(`Cannot stage existing ${action} supplies: ${JSON.stringify(await page.evaluate(({ action, id }) => window.helixHeresyDebug.elementalWorkPreview(action, id), { action, id }))}`);
  const tab = page.locator('[data-workspace-tab="research"]');
  if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  const button = page.locator(`[data-elemental-action="${action}"][data-elemental-target="${id}"]`);
  await button.click({ timeout: 10000 });
  if (!(await snapshot(page)).tasks.some(t => t.type === 'elementalWork')) throw Error(`Cannot queue ${action}: ${JSON.stringify((await snapshot(page)).events)}`);
  await finish(page);
  console.info(`Completed elemental procedure: ${action}`);
}
test('native starting device and performed clay research preserve finite input custody across reload', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await startLifecycleRun(page, 'elemental-native-formation');
  const before = await snapshot(page); expect(before.saved.knowledge.notes).toBe(false);
  expect(before.fixtures.find(f => f.typeId === 'animancyDevice')).toMatchObject({ condition: 100, utility: { storedMana: 24 } });
  await action(page, 'notes'); await action(page, 'characterize');
  let s = await snapshot(page); expect(s.saved.knowledge.characterized).toBe(true);
  expect(s.stacks.filter(i => i.key === 'clay').reduce((n, i) => n + i.quantity, 0)).toBe(7);
  expect(s.stacks.some(i => i.key === 'convergenceResidue')).toBe(true);
  const cells = await page.evaluate(() => window.helixHeresyDebug.elementalBuildOptions()); expect(cells.length).toBeGreaterThan(0);
  cells.sort((a, b) => Math.abs(a.x - s.scientist.x) + Math.abs(a.y - s.scientist.y) - Math.abs(b.x - s.scientist.x) - Math.abs(b.y - s.scientist.y));
  const order = await page.evaluate(cell => window.helixHeresyDebug.designateConstruction('build', [cell], { buildType: 'fixture:elementalChamber', materialPolicy: 'steel', rotation: 0 }), cells[0]);
  expect(order).toBeTruthy(); await finish(page);
  s = await snapshot(page); const chamber = s.fixtures.find(f => f.typeId === 'elementalChamber');
  expect(chamber, JSON.stringify(s.construction)).toBeTruthy();
  await action(page, 'charge', chamber.id); await action(page, 'stability', chamber.id); await action(page, 'document');
  expect((await snapshot(page)).saved.pattern.family).toBe('mudlet');
  await action(page, 'grow', chamber.id); await advance(page, 300);
  s = await snapshot(page); expect(s.saved.runs[0].status).toBe('forming'); expect(s.saved.creatures).toHaveLength(0);
  const originalStocks = s.saved.runs[0].stocks;
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  s = await snapshot(page); expect(s.saved.knowledge.characterized).toBe(true);
  expect(s.saved.evidence.map(e => e.method)).toEqual(['notes', 'characterize', 'stability', 'document']);
  expect(s.saved.runs[0].stocks).toEqual(originalStocks);
  await advance(page, 310); s = await snapshot(page);
  expect(s.saved.runs[0].status, s.saved.runs[0].reason).toBe('completed');
  const mudlet = s.saved.creatures[0]; expect(mudlet.formationSoul.present).toBe(true); expect(mudlet.waterL).toBeGreaterThan(1.9);
  await action(page, 'fillLeak', chamber.id); await action(page, 'position', mudlet.id); await advance(page, 60);
  s = await snapshot(page); expect(s.saved.leaks[chamber.id].sealed).toBe(true);
  await action(page, 'pressure', chamber.id); await advance(page, 60);
  s = await snapshot(page); expect(s.saved.leaks[chamber.id].sealed).toBe(false); expect(s.saved.creatures[0].health).toBeLessThan(100);
  await action(page, 'release', mudlet.id); await action(page, 'clear', s.saved.runs[0].id);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('soulless');
  await action(page, 'grow', chamber.id); await advance(page, 610);
  s = await snapshot(page); expect(s.saved.creatures).toHaveLength(2); expect(s.saved.creatures[1].formationSoul.present).toBe(false);
  expect(s.saved.creatures[1].independentIntent).toBe(''); expect(s.saved.creatures[0].formationSoul).toEqual(mudlet.formationSoul);
  await action(page, 'release', s.saved.creatures[1].id);
  await action(page, 'clear', (await snapshot(page)).saved.runs[1].id);
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption('souled');
  await action(page, 'grow', chamber.id); await advance(page, 300);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestDeviceEnabled(false)); await advance(page, 125);
  s = await snapshot(page); expect(s.saved.runs[2].status).toBe('failed'); expect(s.saved.creatures).toHaveLength(2);
  expect(s.stacks.some(i => i.sourceLabels.includes(s.saved.runs[2].id) && i.key === 'convergenceResidue')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestExposure(80, 0)); await advance(page, 5400);
  s = await snapshot(page); expect(s.saved.creatures.every(a => a.waterL < .35 && a.status !== 'dead')).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.setElementalTestExposure(20, 50));
  const oldWater = s.saved.creatures[1].waterL;
  await action(page, 'wet', s.saved.creatures[1].id);
  expect((await snapshot(page)).saved.creatures[1].waterL).toBeGreaterThan(oldWater + .9);
  await advance(page, 3 * 3600); expect((await snapshot(page)).saved.creatures[1].waterL).toBeLessThan(1);
  const immobileCell = (await snapshot(page)).saved.creatures[1].mapCell;
  await action(page, 'drainLeak', chamber.id); await advance(page, 180);
  s = await snapshot(page); expect(s.saved.creatures[1].mapCell).toEqual(immobileCell);
  expect(s.saved.creatures[0].mapCell).toEqual(s.saved.leaks[chamber.id].cell);
  await page.locator('[data-workspace-tab="map"]').click();
  await page.evaluate(cell => window.helixHeresyDebug.centerMapOnCell(cell), (await snapshot(page)).saved.creatures[0].mapCell);
  for (const mode of ['dom', 'canvas']) {
    expect(await page.evaluate(mode => window.helixHeresyDebug.setMapRenderer(mode), mode)).toBe(mode);
    const scene = await page.evaluate(() => window.helixHeresyDebug.mapSceneSnapshot());
    expect(scene.entities.some(e => e.id === mudlet.id && e.visual.glyph === 'M')).toBe(true);
    expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]);
    if (mode === 'canvas') await page.screenshot({ path: test.info().outputPath('mudlet-canvas.png') });
  }
  const downloadEvent = page.waitForEvent('download'); await page.locator('#exportFileBtn').click(); const download = await downloadEvent;
  const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const exported = Buffer.concat(chunks), originalRun = (await snapshot(page)).identity.runId,
    identities = (await snapshot(page)).saved.creatures.map(a => ({ id: a.id, soul: a.formationSoul }));
  expect(JSON.parse(exported).run.state.elementalLab.creatures.map(a => ({ id: a.id, soul: a.formationSoul }))).toEqual(identities);
  await test.info().attach('performed-mudlet-run.json', { body: exported, contentType: 'application/json' });
  await page.locator('#importFileInput').setInputFiles({ name: 'continued-mudlet-run.json', mimeType: 'application/json', buffer: exported });
  await expect.poll(async () => (await snapshot(page)).identity.runId, { timeout: 20000 }).not.toBe(originalRun);
  expect((await snapshot(page)).saved.creatures.map(a => ({ id: a.id, soul: a.formationSoul }))).toEqual(identities);
  const beforeWater = (await snapshot(page)).saved.creatures[1].waterL; await advance(page, 60);
  expect((await snapshot(page)).saved.creatures[1].waterL).toBeLessThan(beforeWater);
  expect((await snapshot(page)).saved.runs[2].status).toBe('failed');
  expect(errors).toEqual([]);
});

for (const souled of [true, false]) test(`native slime synthesis records ${souled ? 'a newly gathered soul' : 'an unassisted soulless body'}`, async ({ page }) => {
  await startLifecycleRun(page, `slime-creation-window-${souled}`);
  await page.locator('[data-workspace-tab="research"]').click();
  await page.getByRole('combobox', { name: 'Animancy connection for future artificial formation' }).selectOption(souled ? 'souled' : 'soulless');
  await page.locator('[data-workspace-tab="foundry"]').click(); await page.locator('#synthesizeBtn').click();
  await finish(page);
  const s = await snapshot(page), a = s.slimes.find(a => a.source === 'Synthetic');
  expect(a, JSON.stringify(s.events)).toBeTruthy(); expect(a.formationSoul.present).toBe(souled);
  const provenance = a.formationSoul; await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snapshot(page)).slimes.find(x => x.id === a.id).formationSoul).toEqual(provenance);
});
