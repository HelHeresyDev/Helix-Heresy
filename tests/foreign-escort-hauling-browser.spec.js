const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const Beasts = require('../wilderness-beasts');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(480000);
const snap = page => page.evaluate(() => window.helixHeresyDebug.foreignEscortHaulingSnapshot());
const act = (page, action, options = {}) => page.evaluate(({ action, options }) => window.helixHeresyDebug.foreignEscortHaulingAction(action, options), { action, options });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceForeignEscortHaulingForTest(n), n);
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  const s = await snap(page);
  await info.attach('original-hauling-state', { body: JSON.stringify({ saved: s.saved, known: s.known, context: s.context,
    actor: s.actor, cargo: s.stacks.filter(i => i.id === s.saved?.job?.stackId || i.id === s.saved?.job?.sourceId) }), contentType: 'application/json' });
});
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(renderer => window.helixHeresyDebug.setMapRenderer(renderer), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function move(page, cell) {
  expect(await page.evaluate(cell => { const d = window.helixHeresyDebug, s = d.foreignEscortHaulingSnapshot();
    return Boolean(d.startScientistMove(s.station.roomId, { toCell: cell })); }, cell)).toBe(true);
  for (let n = 0; n < 15; n++) {
    const tasks = await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().tasks);
    if (!tasks.length) return;
    expect(tasks[0].reason).toBe(''); await advance(page, Math.max(1, tasks[0].dueAt - (await snap(page)).clock + 1));
  }
  throw new Error('Scientist movement did not finish.');
}
async function until(page, predicate) {
  for (let n = 0; n < 25; n++) { const s = await snap(page); if (predicate(s)) return s; await advance(page, 2); }
  throw new Error(`Hauling condition not reached: ${JSON.stringify((await snap(page)).saved)}`);
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `foreign-escort-haul-${renderer}`);
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: city.assetId,
    cellId: 'planet-cell:00001', name: 'Birch Municipal Sampling Ground', placeId: 'foreign-survey:b' };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const escortSource = { city, standings: [{ standing: 'licensed', network: { id: 'military:b', category: 'military', roles: ['escortContracting'], prohibitions: [] },
    branch: { id: 'chapter:b', publicName: 'Birch Escort Chapter', organizationForm: 'escortChapter', currentCityId: 'b', publicPhysicalPresence: true,
      physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }] };
  const ids = await page.evaluate(({ source, carrier, escortSource, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'haul', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: {
      origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] }, candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land',
        slopePercent: 10, temperatureC: 18, precipitationMm: 100, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.fieldStationAction('register') || !d.setForeignEscortTestSource(escortSource)) return null;
    const station = d.fieldStationSnapshot().saved.site, w = d.foreignWildernessSnapshot().site;
    // Explicit initial local presence and finite cargo fixtures, not a new
    // passenger journey, free staff recruitment or an earned transport receipt.
    d.configureUnsupportedTest({ cell: { x: 13, y: 10, z: w.entry.z } });
    const funds = d.exportSurveyExpeditionTestState(); funds.economy.money = 500; d.importSurveyExpeditionTestState(funds);
    const q = d.reviewForeignEscort();
    if (!q) { const e = d.expeditionEscortSnapshot(); throw new Error(`Missing original quote: ${JSON.stringify({ actor: e.actor, source: e.source, reply: e.received, context: d.foreignSurveySnapshot().context })}`); }
    if (!d.hireExpeditionEscort()) throw new Error('Original reviewed hiring failed.');
    const adjacent = w.discovery.baseline.cells.find(c => c.y === station.layout.apron.y && Math.abs(c.x - station.layout.apron.x) === 1
      && !station.layout.footprint.some(p => p.x === c.x && p.y === c.y));
    const pickup = w.discovery.baseline.cells.find(c => c.y === station.layout.apron.y && Math.abs(c.x - station.layout.apron.x) === 4);
    if (!adjacent || !pickup) return null;
    d.configureEscortTest({ cell: adjacent, scientistCell: station.layout.apron, order: 'hold' });
    const stock = d.configureHiddenWorkshopTest({ cell: pickup, supplies: { stoneBlocks: 3, lumber: 2 } });
    // An explicit separate finite bulky-log fixture tests refusal, not a
    // claimed timber-cutting output or a free inventory-capacity upgrade.
    const prepared = d.exportSurveyExpeditionTestState(), original = prepared.physicalItemStacks.find(i => i.id === stock[1]);
    const logId = 'hauling-authored-field-log';
    prepared.physicalItemStacks.push({ ...original, id: logId, key: 'fieldLog', quantity: 1, knownQuantity: 1,
      unitMassKg: 11, unitVolumeL: 26, sourceLabels: ['Finite authored bulky log fixture'] });
    d.importSurveyExpeditionTestState(prepared);
    return { stone: stock[0], lumber: stock[1], log: logId, pickup, drop: station.layout.apron, originalActor: d.expeditionEscortSnapshot().actor.id };
  }, { source, carrier, escortSource, renderer });
  expect(ids).toBeTruthy(); expect((await snap(page)).contract.status).toBe('active');
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  await page.getByRole('button', { name: 'Mark this outdoor station drop', exact: true }).click();
  expect((await snap(page)).known.drop.cell).toEqual(ids.drop);
  return { ...ids, errors };
}
async function start(page, stackId) {
  const q = await act(page, 'review', { stackId }); expect(q).toBeTruthy();
  await page.getByRole('button', { name: 'Accept exact one-delivery hauling terms', exact: true }).click();
  return (await snap(page)).saved.job;
}

test('canvas exact paid haul splits one unit, saves partial work, deposits physically and communicates only on reunion', async ({ page }) => {
  const { stone, lumber, log, drop, originalActor, errors } = await setup(page, 'canvas');
  const before = await snap(page), money = await page.evaluate(() => window.helixHeresyDebug.expeditionEscortSnapshot().money);
  expect(await act(page, 'accept', { expected: {} })).toBe(false);
  // A real full-kit capacity refusal, not an expanded porter inventory.
  expect(await act(page, 'review', { stackId: log })).toBeNull();
  expect((await snap(page)).known.reply.reason).toContain('does not fit');
  const job = await start(page, stone); let s = await snap(page);
  expect(s.stacks.find(i => i.id === stone)).toMatchObject({ quantity: 2, reservedTaskId: '' });
  expect(s.stacks.find(i => i.id === job.stackId)).toMatchObject({ quantity: 1, reservedTaskId: job.id, carriedBy: '' });
  expect(await page.evaluate(() => window.helixHeresyDebug.expeditionEscortSnapshot().money)).toBe(money);
  expect(await act(page, 'review', { stackId: stone })).toBeNull();
  await until(page, s => s.saved.job.phase === 'load' && s.saved.job.progress > 0);
  s = await snap(page); const partial = s.saved.job.progress;
  await reload(page, 'canvas'); s = await snap(page);
  expect(s.saved.job.progress).toBe(partial); expect(s.stacks.find(i => i.id === job.stackId).reservedTaskId).toBe(job.id);
  const publicIssued = s.known;
  // Actual walking away leaves this professional on their own instruction,
  // not following the scientist or publishing a live cargo tracker.
  const far = { x: 35, y: 12, z: drop.z }; await move(page, far); await advance(page, 60);
  s = await snap(page); expect(s.saved.job.status, JSON.stringify(s.saved.job)).toBe('delivered'); expect(s.known).toEqual(publicIssued);
  expect(await act(page, 'report')).toBe(false);
  expect(s.stacks.find(i => i.id === job.stackId)).toMatchObject({ quantity: 1, carriedBy: '', reservedTaskId: '', cell: drop });
  expect(s.stacks.find(i => i.id === stone).quantity).toBe(2); expect(s.saved.history).toHaveLength(1);
  expect(s.actor.id).toBe(originalActor); expect(s.actor.order).toBe('hold'); expect(s.contract.earned).toBeGreaterThan(before.contract.earned);
  expect(s.inventory.usage.massKg).toBeLessThanOrEqual(s.inventory.capacity.massKg);
  await move(page, drop);
  await page.getByRole('button', { name: 'Ask for hauling report', exact: true }).click();
  s = await snap(page); expect(s.known.received).toMatchObject({ id: job.id, status: 'delivered' });
  const report = s.known.received; await reload(page, 'canvas'); expect((await snap(page)).known.received).toEqual(report);
  // Real kit handoffs change the load, never the inventory capacity limit.
  for (let n = 0; n < 2; n++) expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('trailMeal', 'take'))).toBe(true);
  expect(await page.evaluate(() => window.helixHeresyDebug.transferEscortSupply('neutralizingWash', 'take'))).toBe(true);
  s = await snap(page); expect(s.inventory.remaining.volumeL).toBeGreaterThanOrEqual(12); expect(s.inventory.capacity).toEqual(before.inventory.capacity);
  const second = await start(page, lumber); await until(page, s => s.saved.job.phase === 'delivery');
  s = await snap(page); const actual = s.actor.mapCell;
  expect(s.stacks.find(i => i.id === second.stackId).carriedBy).toBe(originalActor);
  expect(await page.evaluate(() => window.helixHeresyDebug.orderExpeditionEscort('hold'))).toBe(true);
  s = await snap(page); expect(s.saved.job.status).toBe('cancelled');
  expect(s.stacks.find(i => i.id === second.stackId)).toMatchObject({ carriedBy: '', reservedTaskId: '', cell: actual });
  expect(s.stacks.filter(i => i.key === 'lumber' && i.roomId === s.station.roomId).reduce((n, i) => n + i.quantity, 0)).toBe(2);
  expect(s.known.received).toEqual(report); expect(errors).toEqual([]);
});

test('DOM original hauling pauses at actual blocked ground, never replaces missing cargo, and drops a carried load before defense', async ({ page }) => {
  const { stone, originalActor, errors } = await setup(page, 'dom');
  let job = await start(page, stone), s = await snap(page);
  // Let the worker leave the apron before obstructing them, so the fixture
  // blocks the route rather than accidentally building a wall on the drop.
  await advance(page, 2);
  const ring = await page.evaluate(() => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), a = d.expeditionEscortSnapshot().actor;
    const cells = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ ...a.mapCell, x: a.mapCell.x + dx, y: a.mapCell.y + dy }));
    for (const cell of cells) s.labMap.terrain.constructedWalls.push({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock });
    d.importSurveyExpeditionTestState(s); return cells;
  });
  const position = (await snap(page)).actor.mapCell; await advance(page, 120); s = await snap(page);
  expect(s.saved.job.progress).toBe(0); expect(s.actor.mapCell).toEqual(position); expect(s.saved.job.reason).toContain('blocked');
  await reload(page, 'dom'); expect((await snap(page)).stacks.find(i => i.id === job.stackId).reservedTaskId).toBe(job.id);
  await page.evaluate(ring => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !ring.some(c => c.x === w.cell.x && c.y === w.cell.y && c.z === w.cell.z));
    d.importSurveyExpeditionTestState(s);
  }, ring);
  // Removing this original reserved slice cannot nominate another stack.
  await page.evaluate(id => window.helixHeresyDebug.configureHiddenWorkshopTest({ removeInputId: id }), job.stackId);
  await advance(page, 1); s = await snap(page); expect(s.saved.job.status).toBe('interrupted');
  expect(s.stacks.find(i => i.id === job.stackId)).toBeUndefined(); expect(s.stacks.find(i => i.id === stone).quantity).toBe(2);
  job = await start(page, stone); await until(page, s => s.saved.job.phase === 'delivery'); s = await snap(page);
  const at = s.actor.mapCell, beast = Beasts.actor('beast:rimefang-pack', 'hauling-threat', { ...at, x: at.x + 1 }, 'actual-test-population', s.clock);
  await page.evaluate(beast => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState(), g = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b');
    Object.assign(beast, { roomId: g.foreignSurvey.wilderness.roomId, nextMoveAt: s.clock + 1000, nextAttackAt: s.clock + 1000,
      targetId: g.foreignSurvey.escort.actor.id, behavior: 'pursue' }); g.foreignSurvey.wilderness.beasts.actors = [beast];
    d.importSurveyExpeditionTestState(s);
  }, beast);
  await advance(page, 1); s = await snap(page);
  expect(s.saved.job.status).toBe('interrupted'); expect(s.saved.job.reason).toContain('danger');
  expect(s.stacks.find(i => i.id === job.stackId)).toMatchObject({ carriedBy: '', reservedTaskId: '', cell: at, quantity: 1 });
  const e = await page.evaluate(() => window.helixHeresyDebug.expeditionEscortSnapshot());
  expect(e.actor.id).toBe(originalActor); expect(e.gearCondition[e.stacks.find(i => i.key === 'escortBaton').id]).toBeLessThan(100);
  await reload(page, 'dom'); expect((await snap(page)).saved.history.filter(h => h.status === 'delivered')).toHaveLength(0);
  expect(errors).toEqual([]);
});
