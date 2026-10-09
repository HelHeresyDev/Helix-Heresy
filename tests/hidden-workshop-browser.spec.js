const { test, expect } = require('@playwright/test');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
const Workshop = require('../hidden-workshop');
const Remote = require('../unsupported-excursions');
test.setTimeout(900000);
const destination = { id: 'remote-workshop-test', strategicCellId: 'planet-cell:00003', originCellId: 'planet-cell:00001',
  label: 'Visited Woodland', distanceKm: 42, temperatureC: 18, slopePercent: 5, precipitationMm: 500, jurisdiction: 'Wilderness', description: 'No overland return route.' };
const layout = Workshop.plan({ x: 27, y: 10, z: 8 });
const snap = p => p.evaluate(() => window.helixHeresyDebug.hiddenWorkshopSnapshot());
const remote = p => p.evaluate(() => window.helixHeresyDebug.unsupportedSnapshot());
const action = (p, name, options = {}) => p.evaluate(({ name, options }) => window.helixHeresyDebug.hiddenWorkshopAction(name, options), { name, options });
const advance = (p, seconds) => p.evaluate(seconds => window.helixHeresyDebug.advanceHiddenWorkshopForTest(seconds), seconds);
const configure = (p, options) => p.evaluate(options => window.helixHeresyDebug.configureHiddenWorkshopTest(options), options);
const canonical = p => p.evaluate(() => JSON.stringify(window.helixHeresyDebug.currentWorldRunSnapshot().world));
async function visits(p) {
  if (!await p.locator('[data-hidden-workshop]').isVisible()) await p.locator('[data-workspace-tab="visits"]').click();
}
async function finish(p) {
  for (let n = 0; n < 8; n++) {
    const s = await snap(p), t = s.tasks[0]; if (!t) return;
    expect(t.reason, JSON.stringify(t)).toBe('');
    await advance(p, Math.max(2, Math.ceil(t.dueAt - s.clock + 61)));
  }
  const unfinished = await snap(p);
  expect(unfinished.tasks.map(t => ({ id: t.id, type: t.type, action: t.data.action,
    progress: t.data.work?.progress, dueAt: t.dueAt, clock: unfinished.clock, reason: t.reason }))).toEqual([]);
}
async function walk(p, cell) {
  if (JSON.stringify((await snap(p)).scientist.cell) === JSON.stringify(cell)) return;
  expect(await p.evaluate(cell => window.helixHeresyDebug.startScientistMove('remoteSurveyLanding', { toCell: cell, urgent: true }), cell)).toBeTruthy();
  await finish(p); expect((await snap(p)).scientist.cell).toEqual(cell);
}
async function supplies(p, values, cell = layout.stagingCell) { return configure(p, { supplies: values, cell }); }
async function install(p, role, costs) {
  await supplies(p, costs); expect(await action(p, 'install', { role })).toBe(true); await finish(p);
}
async function start(p) {
  p.on('dialog', d => d.accept()); await startLifecycleRun(p, 'hidden-workshop');
  expect(await action(p, 'establish')).toBe(false);
  await p.evaluate(destination => {
    const d = window.helixHeresyDebug;
    d.setSurveyExpeditionTestContext({ network: { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', routes: [], destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Lab', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
      { id: 'city:a', kind: 'fortifiedCity', cityId: 'a', label: 'Aster', cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, jurisdiction: { kind: 'city', cityId: 'a' } }
    ] }, context: { worldId: 'test-world', siteId: 'lab-test', strategicCellId: 'planet-cell:00009', seed: 'workshop', publicProspects: {}, truth: {} } });
    d.configureWildernessTest({ destination: { ...destination, id: 'boundary', strategicCellId: 'planet-cell:00002' }, autoCare: false });
    d.configureUnsupportedTest({ destination, municipal: true, carry: ['drinkingWater'] });
  }, destination);
  await configure(p, { fabrication: 101, carryTools: ['masonryHammer', 'handSaw'] });
  // Carry a real supplied lot on the normal timed charter. The bulk endowments below
  // are explicit previously-delivered late-game inputs, not free buildings/utilities.
  const [lot] = await configure(p, { supplies: { arcaneFeedstock: 2 } });
  expect(await action(p, 'pack', { stackId: lot, amount: 1000 })).toBe(false);
  expect(await action(p, 'pack', { stackId: lot, amount: 1 })).toBe(true); await finish(p);
  expect(await p.evaluate(() => window.helixHeresyDebug.bookUnsupportedExcursion())).toBe(true); await finish(p);
  let r = await remote(p); expect(r.trip.status).toBe('outbound');
  await advance(p, r.trip.fieldAt - r.clock); r = await remote(p); expect(r.roomId).toBe(Remote.ROOM);
  await p.evaluate(() => window.helixHeresyDebug.configureUnsupportedTest({ beasts: [] }));
  await configure(p, { clearPatch: true }); await walk(p, layout.workCell);
  await visits(p);
  await p.getByRole('button', { name: 'Register inspected workshop footprint', exact: true }).click();
  expect((await snap(p)).saved.site.layout).toEqual(layout);
  expect(await action(p, 'establish')).toBe(false);
  return lot;
}
async function buildShell(p) {
  expect(await action(p, 'shell')).toBe(false); // Home supplies are not usable remotely.
  await supplies(p, Workshop.SHELL_COSTS);
  await visits(p);
  await p.getByRole('button', { name: 'Build workshop shell', exact: true }).click();
  expect((await snap(p)).tasks).toHaveLength(1);
  await advance(p, 120); const partial = (await snap(p)).tasks[0].data.work.progress;
  expect(partial).toBeGreaterThan(0); expect(partial).toBeLessThan(7200);
  await p.reload(); await p.locator('#loadLastSaveBtn').click();
  expect((await snap(p)).tasks[0].data.work.progress).toBe(partial);
  await finish(p); expect((await snap(p)).shellIntact).toBe(true); expect((await snap(p)).sheltered).toBe(true);
  expect(await action(p, 'shell')).toBe(false);
}
async function returnMunicipal(p) {
  await walk(p, Remote.LANDING); let r = await remote(p);
  expect(r.trip.pickup.status).not.toBe('missed');
  await advance(p, r.trip.pickup.opensAt - r.clock);
  expect(await p.evaluate(() => window.helixHeresyDebug.boardUnsupportedPickup())).toBe(true); await finish(p);
  r = await remote(p); expect(r.trip.status).toBe('inbound'); await advance(p, r.trip.returnAt - r.clock);
  expect((await remote(p)).active).toBe(false);
}
test('physical workshop survives two cargo-limited charters, local construction, reload, supplied utilities and original-lab damage', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page); const world = await canonical(page);
  const carried = (await snap(page)).stacks.find(s => s.key === 'arcaneFeedstock' && s.carriedBy === 'scientist');
  expect(carried.quantity).toBe(1); expect(carried.roomId).toBe(Remote.ROOM);
  expect(await action(page, 'drop', { stackId: carried.id })).toBe(true);
  await buildShell(page);
  await install(page, 'bench', { lumber: 3, metalParts: 1 });
  await install(page, 'generator', { steelPanels: 4, metalParts: 4 });
  await install(page, 'mana', { steelPanels: 2, metalParts: 2, glass: 2 });
  let s = await snap(page); expect(s.fixtures.find(f => f.typeId === 'fuelGenerator').utility.fuel).toBe(0);
  expect(s.fixtures.find(f => f.typeId === 'manaCollector').utility.storedMana).toBe(0);
  const remembered = s.view.observations, oldFixtures = s.fixtures;
  await returnMunicipal(page); const dated = (await snap(page)).view.observations;
  expect(dated.lastAt).toBeGreaterThanOrEqual(remembered.lastAt);
  await advance(page, 7201); expect((await snap(page)).view.observations).toEqual(dated);
  expect((await snap(page)).stacks.find(i => i.id === carried.id)).toMatchObject({ roomId: Remote.ROOM, carriedBy: '' });
  expect((await snap(page)).fixtures.map(f => f.id)).toEqual(oldFixtures.map(f => f.id));
  await configure(page, { needsReset: true });
  expect(await page.evaluate(() => window.helixHeresyDebug.bookUnsupportedExcursion())).toBe(true); await finish(page);
  let r = await remote(page); await advance(page, r.trip.fieldAt - r.clock); await walk(page, layout.workCell);
  expect((await snap(page)).shellIntact).toBe(true); expect((await snap(page)).saved.site.disclosures).toHaveLength(3);
  await install(page, 'water', { steelPanels: 4, metalParts: 3, rubber: 2 });
  await install(page, 'sump', { steelPanels: 4, metalParts: 2, rubber: 2 });
  await install(page, 'services', { metalParts: 20, rubber: 10 });
  await install(page, 'testStand', { metalParts: 2, glass: 2, rubber: 1 });
  expect(await action(page, 'install', { role: 'water' })).toBe(false);
  s = await snap(page); for (const components of Object.values(s.utilities)) for (const ids of components)
    if (ids.some(id => id.startsWith('hidden-workshop:'))) expect(ids.every(id => id.startsWith('hidden-workshop:'))).toBe(true);
  const ports = { generator: { x: 28, y: 18, z: 8 }, mana: { x: 30, y: 12, z: 8 }, water: { x: 32, y: 13, z: 8 }, testStand: { x: 28, y: 15, z: 8 } };
  // All loading needs staged site-local supplies at actual service ports.
  await supplies(page, { fuelReagent: 1 }, ports.generator); expect(await action(page, 'fuel', { role: 'generator' })).toBe(true); await finish(page);
  expect(await action(page, 'toggle', { role: 'generator' })).toBe(true); await finish(page);
  await supplies(page, { arcaneFeedstock: 1 }, ports.mana); expect(await action(page, 'feedstock', { role: 'mana' })).toBe(true); await finish(page);
  await supplies(page, { drinkingWater: 1 }, ports.water); expect(await action(page, 'water', { role: 'water' })).toBe(true); await finish(page);
  await supplies(page, { assayReagent: 1 }, ports.testStand);
  const before = await snap(page); expect(await action(page, 'test', { role: 'testStand' })).toBe(true);
  await advance(page, 120); s = await snap(page); expect(s.tasks[0].data.work.progress, JSON.stringify({ task: s.tasks[0], fixtures: s.fixtures, utilities: s.utilities })).toBeGreaterThan(0);
  await configure(page, { fixtureRole: 'generator', enabled: false });
  const stalled = s.tasks[0].data.work.progress; await advance(page, 240);
  expect((await snap(page)).tasks[0].data.work.progress).toBe(stalled);
  await page.reload(); await page.locator('#loadLastSaveBtn').click(); expect((await snap(page)).tasks[0].data.work.progress).toBe(stalled);
  s = await snap(page);
  expect(s.fixtures.find(f => f.typeId === 'workshopServiceStand').productionTaskId).toBe(s.tasks[0].id);
  await configure(page, { fixtureRole: 'generator', enabled: true }); await finish(page); s = await snap(page);
  expect(s.saved.receipts).toHaveLength(1); expect(s.saved.receipts[0].suppliedSeconds).toBe(900);
  expect(s.fixtures.find(f => f.typeId === 'fuelGenerator').utility.fuel).toBeLessThan(before.fixtures.find(f => f.typeId === 'fuelGenerator').utility.fuel);
  const waterAfterFirst = s.fixtures.find(f => f.typeId === 'waterCisternPump').utility.contents.cleanWater;
  const wasteAfterFirst = s.fixtures.find(f => f.typeId === 'sumpTank').utility.contents.homunculusWaste;
  // An initially insufficient mana interval can still spend partial services.
  // Only fully supplied minutes earn credit; those earlier inputs are not refunded.
  expect(waterAfterFirst).toBeLessThanOrEqual(.75 + 1e-8);
  expect(waterAfterFirst + wasteAfterFirst).toBeCloseTo(1, 5);
  expect(s.fixtures.find(f => f.typeId === 'workshopServiceStand').utility.enabled).toBe(false);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    for (const f of s.fixtures.filter(f => f.origin.z <= 1)) { f.condition = 0; if (f.utility) f.utility.enabled = false; }
    s.fixtures = s.fixtures.filter(f => f.typeId !== 'waterCisternPump' || f.id.startsWith('hidden-workshop:'));
    s.localSiteContext.water.replenishmentPerHour = 100;
    const { digest, ...context } = s.localSiteContext;
    s.localSiteContext.digest = `local-site-context-${window.HelixStrategicWorld.stableHash(context)}`;
    d.importSurveyExpeditionTestState(s); });
  expect((await snap(page)).shellIntact).toBe(true);
  await supplies(page, { assayReagent: 1 }, ports.testStand); expect(await action(page, 'test', { role: 'testStand' })).toBe(true); await finish(page);
  s = await snap(page); expect(s.saved.receipts).toHaveLength(2);
  const waterAfterSecond = s.fixtures.find(f => f.typeId === 'waterCisternPump').utility.contents.cleanWater;
  expect(waterAfterSecond).toBeLessThanOrEqual(waterAfterFirst - .25 + 1e-8);
  expect(waterAfterSecond + s.fixtures.find(f => f.typeId === 'sumpTank').utility.contents.homunculusWaste).toBeCloseTo(1, 5);
  await configure(page, { fixtureRole: 'generator', condition: 70, fault: { id: 'bearingWear' } });
  await supplies(page, { metalParts: 1, rubber: 1 }, ports.generator);
  expect(await action(page, 'repair', { role: 'generator' })).toBe(false);
  expect(await action(page, 'inspect', { role: 'generator' })).toBe(true); await finish(page);
  expect(await action(page, 'repair', { role: 'generator' })).toBe(true); await finish(page);
  s = await snap(page); expect(s.fixtures.find(f => f.typeId === 'fuelGenerator').utility.fault).toBeNull();
  expect(s.fixtures.find(f => f.typeId === 'fuelGenerator').condition).toBe(90);
  const sump = s.fixtures.find(f => f.typeId === 'sumpTank');
  const sumpPort = await page.evaluate(id => {
    const d = window.helixHeresyDebug, saved = d.exportSurveyExpeditionTestState(), f = saved.fixtures.find(f => f.id === id);
    f.utility.contents.homunculusWaste = 2.5;
    d.importSurveyExpeditionTestState(saved); return { x: f.origin.x + 1, y: f.origin.y - 1, z: f.origin.z };
  }, sump.id);
  await supplies(page, { sealedReagentBottle: 1 }, sumpPort);
  expect(await action(page, 'empty', { role: 'sump' })).toBe(true); await finish(page);
  s = await snap(page); expect(s.fixtures.find(f => f.id === sump.id).utility.contents.homunculusWaste).toBeCloseTo(1.5, 5);
  expect(s.stacks.find(i => i.key === 'sealedReagentBottle' && i.contents?.some(c => c.key === 'homunculusWaste')).contents[0].amount).toBe(1);
  await visits(page);
  await expect(page.locator('[data-hidden-workshop]')).toContainText('Historical test');
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  expect((await snap(page)).saved.receipts).toHaveLength(2); expect(await canonical(page)).toBe(world); expect(errors).toEqual([]);
});

test('cancelled or missing-input work creates no equipment or XP; remote observations and death remain frozen', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page); await buildShell(page);
  await supplies(page, { steelPanels: 4, metalParts: 4 });
  const xp = (await snap(page)).scientist.fabricationXp;
  expect(await action(page, 'install', { role: 'generator' })).toBe(true); await advance(page, 120);
  let s = await snap(page), task = s.tasks[0], missing = task.data.reservedStackIds[0];
  await page.evaluate(() => window.helixHeresyDebug.advanceTestRunTime(120));
  expect((await snap(page)).tasks[0].data.work.progress).toBeGreaterThan(task.data.work.progress);
  await configure(page, { removeInputId: missing }); const progress = (await snap(page)).tasks[0].data.work.progress;
  await advance(page, 3600); s = await snap(page);
  expect(s.tasks[0].data.work.progress).toBe(progress); expect(s.tasks[0].reason).toContain('original staged input');
  expect(s.fixtures.some(f => f.typeId === 'fuelGenerator')).toBe(false);
  expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), task.id)).toBe(true);
  s = await snap(page); expect(s.stacks.some(i => i.reservedTaskId === task.id)).toBe(false);
  expect(s.scientist.fabricationXp).toBe(xp);
  expect(await action(page, 'install', { role: 'generator' })).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.inflictTestScientistDamage()); const dead = await snap(page);
  await advance(page, 86400); s = await snap(page); expect(s.saved).toEqual(dead.saved); expect(s.clock).toBe(dead.clock);
  expect(await action(page, 'shell')).toBe(false); expect(errors).toEqual([]);
});
