const { test, expect } = require('@playwright/test');
const Carrier = require('../municipal-carrier');
const { startLifecycleRun } = require('./helpers/start-lifecycle-run');
test.setTimeout(720000);
const escort = page => page.evaluate(() => window.helixHeresyDebug.expeditionEscortSnapshot());
const scope = page => page.evaluate(() => window.helixHeresyDebug.foreignEscortScopeSnapshot());
const wild = page => page.evaluate(() => window.helixHeresyDebug.foreignWildernessSnapshot());
const act = (page, action, expected) => page.evaluate(({ action, expected }) => window.helixHeresyDebug.foreignEscortScopeAction(action, expected), { action, expected });
const advance = (page, n) => page.evaluate(n => window.helixHeresyDebug.advanceAdjoiningWildernessForTest(n), n);
async function finish(page) {
  for (let n = 0; n < 20; n++) {
    const s = await wild(page); if (!s.tasks.length) return;
    expect(s.tasks[0].reason, JSON.stringify(s.tasks[0])).toBe('');
    await advance(page, Math.max(1, s.tasks[0].dueAt - s.clock + 1));
  }
  throw new Error('Actual physical movement or acceptance did not finish.');
}
async function move(page, room, cell) {
  expect(await page.evaluate(({ room, cell }) => Boolean(window.helixHeresyDebug.startScientistMove(room, { toCell: cell, allowMultiRoom: true, urgent: true })), { room, cell })).toBe(true);
  await finish(page);
}
async function meet(page) {
  const s = await escort(page), w = await wild(page);
  if (Math.max(Math.abs(s.actor.mapCell.x - w.cell.x), Math.abs(s.actor.mapCell.y - w.cell.y)) <= 1) return;
  const near = { ...s.actor.mapCell, x: s.actor.mapCell.x - 1 };
  await move(page, s.actor.roomId, near);
}
async function reload(page, renderer) {
  await page.reload(); await page.locator('#loadLastSaveBtn').click();
  await page.evaluate(r => window.helixHeresyDebug.setMapRenderer(r), renderer);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
}
async function setup(page, renderer) {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await startLifecycleRun(page, `escort-adjoining-${renderer}`);
  const source = { cityId: 'b', administrationId: 'admin:b', worksId: 'works:b', charterId: 'charter:b', populationSourceId: 'population:b',
    cellId: 'planet-cell:00001', name: 'Birch Ground', placeId: 'foreign-survey:b' };
  const city = { cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional' } };
  const carrier = Carrier.fromWorld({ strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: {
    governments: [{ cityId: 'b', roleAssignments: { publicWorksAndProvisioning: 'works:b' }, institutions: [{ id: 'works:b', capacityBand: 'functional' }] }] } }, 'b', 0);
  const f = await page.evaluate(({ source, city, carrier, renderer }) => {
    const d = window.helixHeresyDebug; d.setMapRenderer(renderer);
    const context = { worldId: 'lifecycle-world', siteId: source.placeId, strategicCellId: source.cellId, seed: 'scope-test', truth: { potentialPermille: {} } };
    if (!d.configureFieldStationMaintenanceTest({ source, carrier, context, wilderness: { origin: { id: source.cellId, neighborIds: ['planet-cell:00002'] },
      candidates: [{ id: 'planet-cell:00002', surfaceClass: 'land', slopePercent: 10, temperatureC: 18, precipitationMm: 500, biomeLabel: 'Woodland' }], occupied: [], context } })) return null;
    if (!d.setForeignEscortTestSource({ city, standings: [{ standing: 'licensed', network: { id: 'military:b', category: 'military', roles: ['escortContracting'], prohibitions: ['claiming police authority'] },
      branch: { id: 'chapter:b', publicName: 'Birch Escort Chapter', organizationForm: 'escortChapter', currentCityId: 'b', publicPhysicalPresence: true, physicalCondition: 'intact', operationalStatus: 'active', capacityBand: 'functional' } }] })) return null;
    // Explicit original local presence and finite money, not an earned
    // passenger trip or a replenished professional/encounter pool.
    const state = d.exportSurveyExpeditionTestState(); state.economy.money = 500; d.importSurveyExpeditionTestState(state);
    const s = d.foreignSurveySnapshot().excursion;
    return { ground: s.roomId, room: s.wilderness.roomId, seam: { x: 36, y: 12, z: s.entry.z }, entry: { x: 37, y: 12, z: s.entry.z }, carrier: s.carrier };
  }, { source, city, carrier, renderer });
  expect(f).toBeTruthy(); await move(page, f.ground, { x: 13, y: 10, z: f.seam.z });
  expect(await page.evaluate(() => window.helixHeresyDebug.reviewForeignEscort())).toBeTruthy();
  expect(await page.evaluate(() => window.helixHeresyDebug.hireExpeditionEscort())).toBe(true);
  expect(await act(page, 'review')).toBeNull();
  const original = await escort(page);
  await move(page, f.room, f.seam);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSurveyAction('exploreAdjoining'))).toBe(true); await finish(page);
  await move(page, f.room, { ...f.entry, x: 41 }); await advance(page, 10);
  expect((await escort(page)).actor.mapCell.x).toBeLessThan(37); // No automatic extension.
  expect(await act(page, 'review')).toBeNull();
  await move(page, f.room, { ...f.seam, x: 35, y: 8 }); await meet(page);
  const tab = page.locator('[data-workspace-tab="visits"]'); if (await tab.getAttribute('aria-current') !== 'page') await tab.click();
  return { ...f, errors, original };
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) await info.attach('escort-scope', {
    body: JSON.stringify({ scope: await scope(page), escort: await escort(page), wild: await wild(page) }), contentType: 'application/json' });
});
test('Canvas separately accepted scouted patch preserves partial consent and original resources across reload, then supports physical follow and casualty assistance', async ({ page }) => {
  const f = await setup(page, 'canvas');
  await page.getByRole('button', { name: 'Review adjoining-patch protection terms', exact: true }).click();
  const q = (await scope(page)).agreement.quote, before = await escort(page);
  expect(q.patch.observations.length).toBeGreaterThan(0); expect(q.patch.truth).toBeUndefined(); expect(q.patch.beasts).toBeUndefined();
  expect(await act(page, 'accept', { ...q, contractId: 'substitute' })).toBe(false);
  await page.getByRole('button', { name: 'Accept exact adjoining-patch protection terms', exact: true }).click();
  await advance(page, 20); const partial = (await scope(page)).agreement.job.progressSeconds; expect(partial).toBe(20);
  expect((await scope(page)).agreement.authorization).toBeUndefined();
  await reload(page, 'canvas'); expect((await scope(page)).agreement.job.progressSeconds).toBe(partial);
  await finish(page); let s = await escort(page); const auth = s.contract.adjoining.authorization;
  expect(auth).toBeTruthy(); expect(s.contract.adjoining.history).toHaveLength(1); expect(s.actor.id).toBe(f.original.actor.id);
  expect(s.money).toBe(before.money); expect(s.contract.startedAt).toBe(before.contract.startedAt); expect(s.contract.wageReserve).toBe(before.contract.wageReserve);
  expect(s.dutySeconds).toBeLessThan(before.dutySeconds); expect(s.gearCondition).toEqual(before.gearCondition); expect(s.actor.health).toBe(before.actor.health);
  expect(s.stacks.map(i => i.id)).toEqual(before.stacks.map(i => i.id));
  await move(page, f.room, { ...f.entry, x: 41 }); await advance(page, 10); s = await escort(page);
  expect(s.actor.mapCell.x).toBeGreaterThanOrEqual(37); expect(s.actor.roomId).toBe(f.room);
  expect(await page.evaluate(() => window.helixHeresyDebug.orderExpeditionEscort('hold'))).toBe(true);
  const held = (await escort(page)).actor.mapCell; await advance(page, 5); expect((await escort(page)).actor.mapCell).toEqual(held);
  // Explicit living incapacitated-body fixture, not healing, replacement or
  // a generated rescue team. The same escort executes production dragging.
  await page.evaluate(({ z }) => window.helixHeresyDebug.configureEscortTest({ cell: { x: 40, y: 12, z }, scientistCell: { x: 41, y: 12, z }, scientistHealth: 5, order: 'follow' }), f.entry);
  await advance(page, 2); expect((await escort(page)).drag.helperId).toBe(f.original.actor.id);
  await reload(page, 'canvas'); await advance(page, 220); s = await escort(page);
  expect(s.drag).toBeNull(); expect(s.actor.roomId).toBe(f.ground); expect(s.scientistHealth).toBe(5);
  expect(s.contract.adjoining.authorization).toEqual(auth); expect(s.contract.adjoining.history).toHaveLength(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSurveySnapshot().excursion.carrier)).toEqual(f.carrier);
  expect(await page.evaluate(() => window.helixHeresyDebug.validateMapScene())).toEqual([]); expect(f.errors).toEqual([]);
});
test('DOM cancelled and obstructed consent grants no scope or backfill; spent wages require actual blocked-then-cleared withdrawal and once-only settlement', async ({ page }) => {
  const f = await setup(page, 'dom'); let q = await act(page, 'review'); expect(q).toBeTruthy();
  expect(await act(page, 'accept', q)).toBe(true); await advance(page, 20); expect(await act(page, 'cancel')).toBe(true);
  await reload(page, 'dom'); expect((await scope(page)).agreement.job.status).toBe('cancelled'); expect((await scope(page)).agreement.authorization).toBeUndefined();
  q = await act(page, 'review'); expect(await act(page, 'accept', q)).toBe(true); await advance(page, 20);
  const cell = (await wild(page)).cell;
  const walls = async (cells, add) => page.evaluate(({ cells, add }) => {
    const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    const same = (a, b) => a.x === b.x && a.y === b.y && a.z === b.z;
    s.labMap.terrain.constructedWalls = s.labMap.terrain.constructedWalls.filter(w => !cells.some(c => same(c, w.cell)));
    if (add) s.labMap.terrain.constructedWalls.push(...cells.map(cell => ({ cell, materialId: 'stoneBlocks', condition: 100, builtAt: s.clock })));
    d.importSurveyExpeditionTestState(s);
  }, { cells, add });
  await walls([cell], true); await advance(page, 30); expect((await scope(page)).agreement.job.progressSeconds).toBe(20);
  await reload(page, 'dom'); await advance(page, 30); expect((await scope(page)).agreement.authorization).toBeUndefined();
  await walls([cell], false); await advance(page, 1); expect((await scope(page)).agreement.job.progressSeconds).toBe(20);
  await finish(page); expect((await scope(page)).agreement.history.map(j => j.status)).toEqual(['cancelled', 'completed']);
  await move(page, f.room, { ...f.entry, x: 41 }); await advance(page, 10); let s = await escort(page);
  expect(s.actor.mapCell.x).toBeGreaterThanOrEqual(37);
  const position = s.actor.mapCell, ring = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ ...position, x: position.x + dx, y: position.y + dy }));
  await walls(ring, true);
  // Age only the original wage calendar to three seconds before its finite
  // end, rather than running unrelated systems for four simulated hours.
  await page.evaluate(() => window.helixHeresyDebug.configureEscortTest({ remainingSeconds: 3 }));
  const blocked = await escort(page); await advance(page, 10); s = await escort(page);
  expect(s.contract.status).toBe('returning'); expect(s.contract.earned).toBe(s.contract.wageReserve); expect(s.actor.mapCell).toEqual(position);
  expect(s.dutySeconds).toBeLessThan(blocked.dutySeconds); expect(await act(page, 'review')).toBeNull();
  await reload(page, 'dom'); expect((await escort(page)).actor.mapCell).toEqual(position);
  await walls(ring, false); await advance(page, 120); s = await escort(page); expect(s.actor.roomId).toBe(f.ground);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSurveyAction('withdraw'))).toBe(true); await finish(page);
  await meet(page); const before = await escort(page); expect(await page.evaluate(() => window.helixHeresyDebug.settleEscortContract())).toBe(true);
  s = await escort(page); expect(s.money).toBe(before.money); expect(s.contract.refund).toBe(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.settleEscortContract())).toBe(false);
  expect(s.actor.id).toBe(f.original.actor.id); expect(s.actor.health).toBe(f.original.actor.health); expect(f.errors).toEqual([]);
});
