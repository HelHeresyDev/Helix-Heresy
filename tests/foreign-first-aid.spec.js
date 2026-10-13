const { test, expect } = require('@playwright/test');
const Supplies = require('../foreign-supplies');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
test.use({ actionTimeout: 15000 });
const copy = x => JSON.parse(JSON.stringify(x));
const city = () => ({ cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', services: { provisioning: 'functional', transport: 'functional' } });
const standings = () => [{ network: { id: 'commerce:b', category: 'commercial', roles: ['procurement'] }, standing: 'licensed',
  branch: { id: 'supplier:b', cityId: 'b', publicName: 'Neighbor Depot', capacityBand: 'functional', operationalStatus: 'active' } }];
const defs = [
  { id: 'medicalBandage', section: 'inventory', label: 'Medical Bandage', basePrice: 16, supply: 45, liquidity: 20, buyable: true },
  { id: 'neutralizingWash', section: 'inventory', label: 'Neutralizing Wash', basePrice: 22, supply: 35, liquidity: 16, buyable: true }
];
function fixture() {
  const s = Supplies.create(city(), standings(), 0, { roomId: 'hall', cell: {} });
  const m = { id: 'b', treasury: 1000, listings: Object.fromEntries(defs.map(d => [d.id, { supply: 8, demand: 1 }])) };
  const c = { alive: true, capable: true, local: true, contact: true, atCounter: true, atOuter: false, providerCurrent: true,
    bodyEpoch: 0, visitId: 'original-trip', busy: false, permit: { id: 'permit', expiresAt: 21600 }, routeSeconds: 20,
    metrics: { massKg: .1, volumeL: .2 }, remaining: { massKg: 20, volumeL: 30 }, supplierRemaining: { massKg: 18, volumeL: 24 }, passengerRemaining: { massKg: 20, volumeL: 40 } };
  let allocated = 0, received = 0;
  return { s, m, c, wallet: { money: 1000 }, hooks: { allocate: (id, q) => { expect(q.section).toBe('inventory'); allocated++; return 'original-medical-lot'; },
    custody: () => true, move: () => ({ done: true }), collect: () => true, handoff: () => `received-${++received}` },
    get allocated() { return allocated; }, get received() { return received; } };
}
function buy(f, d = defs[0], quantity = 2) {
  const q = Supplies.quote(f.s, f.m, d, quantity, f.c, 0); expect(q).toBeTruthy();
  expect(Supplies.buy(f.s, f.m, d, q, f.c, f.wallet, 0, f.hooks)).toBe(true); return q;
}
test('first-aid goods require separately published typed terms and never provide a wider chemical or clinical license', () => {
  const f = fixture(); expect(f.s.medicalTerms).toEqual(Supplies.MEDICAL_TERMS);
  for (const d of defs) expect(Supplies.quote(f.s, f.m, d, 2, f.c, 0)).toMatchObject({ section: 'inventory', medicalTerms: Supplies.MEDICAL_TERMS, handlingFee: 4 });
  for (const change of [s => s.medicalTerms = null, s => s.medicalTerms.goods.push('membraneSealant'), s => s.medicalTerms.maxQuantity = 12,
    s => s.medicalTerms.handlingFee = 0, s => s.medicalTerms.scope = 'Hospital treatment included']) {
    const g = fixture(); change(g.s); expect(Supplies.quote(g.s, g.m, defs[0], 1, g.c, 0)).toBeNull();
  }
  for (const d of [{ ...defs[0], section: 'resources' }, { ...defs[0], buyable: false }, { ...defs[0], id: 'membraneSealant' }])
    expect(Supplies.quote(f.s, f.m, d, 1, f.c, 0)).toBeNull();
  const unsupported = standings(); unsupported[0].standing = 'unlicensed'; expect(Supplies.create(city(), unsupported, 0, { cell: {} })).toBeNull();
});
test('first-aid exact asks, original stock, funds and shared transaction slot reserve and charge once without care', () => {
  const f = fixture(), stale = Supplies.quote(f.s, f.m, defs[0], 2, f.c, 0); f.m.listings.medicalBandage.supply = 4;
  expect(Supplies.quote(f.s, f.m, defs[0], 2, f.c, 0).unitPrice).toBeGreaterThan(stale.unitPrice);
  expect(Supplies.buy(f.s, f.m, defs[0], stale, f.c, f.wallet, 1, f.hooks)).toBe(false); expect(f.allocated).toBe(0);
  f.m.listings.medicalBandage.supply = 8;
  for (const money of [0, NaN, Infinity]) { f.wallet.money = money; expect(Supplies.buy(f.s, f.m, defs[0], stale, f.c, f.wallet, 1, f.hooks)).toBe(false); }
  f.wallet.money = 1000; const q = buy(f); expect(f.wallet.money).toBe(1000 - q.total); expect(f.m.listings.medicalBandage.supply).toBe(6);
  expect(f.s.handlingRevenue).toBe(4); expect(f.received).toBe(0); expect(f.s).not.toHaveProperty('clinician');
  expect(Supplies.buy(f.s, f.m, defs[0], q, f.c, f.wallet, 1, f.hooks)).toBe(false);
  expect(Supplies.quote(f.s, f.m, defs[1], 1, f.c, 1)).toBeNull(); expect(f.allocated).toBe(1);
  expect(Supplies.quote({ ...fixture().s, orders: [{ status: 'delivering', kind: 'sale' }] }, f.m, defs[1], 1, f.c, 1)).toBeNull();
});
test('first-aid stock, current permission, real route and finite staff/backpack/passenger capacity bound quotes', () => {
  for (const change of [f => f.c.local = false, f => f.c.contact = false, f => f.c.alive = false, f => f.c.capable = false,
    f => f.c.atCounter = false, f => f.c.permit = null, f => f.c.providerCurrent = false, f => f.c.busy = true,
    f => f.c.permit.expiresAt = 100, f => f.c.routeSeconds = -1, f => f.c.routeSeconds = Infinity,
    f => f.c.metrics.massKg = NaN, f => f.c.remaining.massKg = .1, f => f.c.supplierRemaining.volumeL = .1,
    f => f.c.passengerRemaining.massKg = .1, f => f.c.passengerRemaining.volumeL = .1, f => f.c.passengerRemaining.massKg = NaN,
    f => f.m.listings.medicalBandage.supply = 0, f => f.m.listings.medicalBandage.demand = NaN,
    f => f.s.actor.health = 49, f => f.s.workSeconds = 30, f => f.s.provisionsSeconds = 30, f => f.s.powerSeconds = 0]) {
    const f = fixture(); change(f); expect(Supplies.quote(f.s, f.m, defs[0], 2, f.c, 0)).toBeNull();
  }
  const f = fixture(); for (const n of [0, -1, 1.5, 7]) expect(Supplies.quote(f.s, f.m, defs[0], n, f.c, 0)).toBeNull();
});
test('first-aid saved partial handoffs require actual custody and finish outside after expiry without backfill or healing', () => {
  const f = fixture(); buy(f); Supplies.advance(f.s, f.c, 90, f.hooks); expect(f.received).toBe(1);
  f.s = copy(f.s); Supplies.advance(f.s, { ...f.c, atCounter: false }, 1000, f.hooks); expect(f.received).toBe(1);
  f.c.permit = null; f.c.atCounter = false; f.c.atOuter = true;
  expect(Supplies.outer(f.s, { ...f.c, at: 1000 })).toBe(true); Supplies.advance(f.s, f.c, 1001, f.hooks);
  expect(f.received).toBe(1); f.hooks.custody = () => false; Supplies.advance(f.s, f.c, 1031, f.hooks); expect(f.received).toBe(1);
  f.hooks.custody = () => true; Supplies.advance(f.s, f.c, 1032, f.hooks); Supplies.advance(f.s, f.c, 1062, f.hooks);
  expect(f.received).toBe(2); expect(f.s.orders[0].status).toBe('received'); expect(f.m.listings.medicalBandage.supply).toBe(6);
  const receipts = copy(f.s.orders[0].receipts); Supplies.advance(f.s, f.c, 2000, f.hooks); expect(f.s.orders[0].receipts).toEqual(receipts);
  const h = fixture(); buy(h); const frozen = copy(h.s); Supplies.advance(h.s, { ...h.c, alive: false }, 1000, h.hooks); expect(h.s).toEqual(frozen);
  Supplies.advance(h.s, { ...h.c, bodyEpoch: 1 }, 1000, h.hooks); expect(h.s.orders[0].status).toBe('bodyLost'); expect(h.received).toBe(0);
});
test('first-aid personal supplies exclude remote, reserved, borrowed, civic, altered or contained lots', () => {
  const item = { id: 'owned-bandage', section: 'inventory', key: 'medicalBandage', carriedBy: 'scientist', quantity: 2 };
  expect(Supplies.medicalSupplyLot(item)).toBe(true); expect(Supplies.medicalSupplyLot({ ...item, key: 'neutralizingWash' })).toBe(true);
  for (const patch of [{ carriedBy: '' }, { carriedBy: 'attendant' }, { section: 'resources' }, { key: 'membraneSealant' },
    { quantity: 0 }, { quantity: 1.5 }, { reservedTaskId: 'other' }, { cityOwnerId: 'b' }, { civicCustody: true },
    { carryTaskId: 'claimed' }, { toolInstanceId: 'borrowed' }, { containerId: 'closed' }, { chemicalBatch: {} }, { biology: {} }, { contents: [{}] }])
    expect(Supplies.medicalSupplyLot({ ...item, ...patch })).toBe(false);
  expect(Supplies.medicalSupplyLot({ ...item, reservedTaskId: 'care' }, 'care')).toBe(true);
});
test('first-aid published prices and terms require permitted counter contact and remain dated while away', () => {
  const f = fixture(); expect(Supplies.observe(f.s, { ...f.c, permit: null }, f.m, defs, 0).listings).toEqual([]);
  const report = copy(Supplies.observe(f.s, f.c, f.m, defs, 10)); expect(report.medicalTerms).toEqual(Supplies.MEDICAL_TERMS); expect(report.listings).toHaveLength(2);
  f.m.listings.medicalBandage.supply = 1;
  expect(Supplies.observe(f.s, { ...f.c, local: false }, f.m, defs, 100)).toEqual(report);
  const outside = Supplies.observe(f.s, { ...f.c, atCounter: false, atOuter: true, permit: null }, f.m, defs, 100);
  expect(outside.medical).toEqual(report.medical); expect(outside.medical.at).toBe(10); expect(outside.listings).toEqual([]);
  expect(copy(f.s).medicalKnowledge).toEqual(report.medical);
  expect(JSON.stringify(report)).not.toContain('treasury');
});

function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = m.identityOffices[0], c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(identity, m.identityOffices, c, 0);
  return { identity, offices: m.identityOffices };
}
async function finish(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
    const s = d.intercityPassengerSnapshot(), task = s.tasks.find(t => !t.reason); if (!task) return;
    d.advanceSimulation(Math.max(1, task.dueAt - s.clock + 1));
  } throw new Error('Ordinary physical work did not finish'); });
}
const care = page => page.evaluate(() => window.helixHeresyDebug.foreignSelfCareSnapshot());
const supply = (page, good = 'medicalBandage', n = 2) => page.evaluate(({ good, n }) => window.helixHeresyDebug.foreignSuppliesSnapshot(good, n), { good, n });
async function enter(page, renderer) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ identity, city, standings, renderer }) => {
    const d = window.helixHeresyDebug, network = { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
      { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', known: true, supportComponentId: 'one', localDistanceKm: 2, routeContinuity: 'municipal', cellId: 'planet-cell:00009' },
      ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, known: true, supportComponentId: 'one', jurisdiction: { kind: 'city', cityId: id }, cellId: 'planet-cell:00001' }))
    ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
    d.setIntercityPassengerTestContext({ city: { ...city, cityId: 'a' }, network,
      standings: [{ network: { category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Transport', capacityBand: 'functional', operationalStatus: 'active' } }] });
    d.setMapRenderer(renderer); d.setForeignReceptionTestContext({ source: { ...city, administrationId: 'admin:b', administrationName: 'Neighbor Administration',
      watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, capacityBand: 'functional', recognition: 'verified', localRules: [] }, ...identity });
    d.setForeignSuppliesTestContext({ city, standings, market: { id: 'b', listings: { medicalBandage: { supply: 8, demand: 1 }, neutralizingWash: { supply: 8, demand: 1 },
      drinkingWater: { supply: 12, demand: 1 }, fieldRation: { supply: 10, demand: 1 }, metalParts: { supply: 60, demand: 1 } } } });
    // Remove home medical stock so only physically received imported lots can fund this scenario.
    const s = d.exportSurveyExpeditionTestState(); s.physicalItemStacks = s.physicalItemStacks.filter(i => !['medicalBandage', 'neutralizingWash'].includes(i.key));
    d.importSurveyExpeditionTestState(s);
    if (!d.bookIntercityPassenger('city:b') || !d.queueIntercityPassenger('passengerBoard')) throw new Error('Unable to board');
  }, { identity: identity(), city: city(), standings: standings(), renderer });
  await finish(page); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(180));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('enter'))).toBe(true); await finish(page);
  if (!await page.locator('[data-intercity-passenger]').isVisible()) await page.locator('[data-workspace-tab="visits"]').click();
  await page.getByRole('button', { name: 'Walk to Visitor Provisions Counter', exact: true }).click(); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
    s.injuries = [{ id: 'first-aid-wound', actorKind: 'scientist', actorId: 'scientist', typeId: 'bruising', severityId: 'moderate',
      location: 'left arm', status: 'active', createdAt: s.clock, updatedAt: s.clock, observedAt: s.clock, cause: 'Explicit original wound fixture' },
      { id: 'first-aid-burn', actorKind: 'scientist', actorId: 'scientist', typeId: 'burn', severityId: 'moderate',
        location: 'right arm', status: 'active', createdAt: s.clock, updatedAt: s.clock, observedAt: s.clock, cause: 'Explicit original burn fixture' },
      { id: 'first-aid-internal', actorKind: 'scientist', actorId: 'scientist', typeId: 'fracture', severityId: 'moderate',
        location: 'left leg', status: 'active', createdAt: s.clock, updatedAt: s.clock, observedAt: s.clock, cause: 'Explicit undiagnosed internal fixture' }];
    d.importSurveyExpeditionTestState(s); });
}
async function purchase(page, good, n = 2) {
  await page.getByLabel(`${good === 'medicalBandage' ? 'Medical Bandage' : 'Neutralizing Wash'} purchase quantity`).selectOption(String(n));
  const before = await supply(page, good, n); expect(before.quote).toBeTruthy();
  await page.getByRole('button', { name: `Buy ${good === 'medicalBandage' ? 'Medical Bandage' : 'Neutralizing Wash'} at Exact Quoted Total`, exact: true }).click();
  return { before, paid: await supply(page, good, n) };
}
for (const renderer of ['dom', 'canvas']) test(`first-aid controls buy actual supplies and perform saved ordinary self-care through ${renderer}`, async ({ page }) => {
  test.setTimeout(300000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await enter(page, renderer);
  const panel = page.locator('[data-foreign-self-care]'), wound = panel.locator('[data-foreign-care-injury="first-aid-wound"]');
  await expect(wound.getByRole('button', { name: /^Treat Own Injury/ })).toBeDisabled();
  await expect(panel.locator('[data-foreign-care-injury="first-aid-internal"]')).not.toContainText('Fracture');
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSelfCareAction('treat', 'first-aid-internal'))).toBe(false);
  const original = await care(page), { before, paid } = await purchase(page, 'medicalBandage');
  expect(paid.money).toBe(before.money - before.quote.total); expect(paid.market.listings.medicalBandage.supply).toBe(before.quote.stock - 2);
  expect(paid.carried.some(i => i.key === 'medicalBandage')).toBe(false); expect((await care(page)).injuries).toEqual(original.injuries);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(240, true));
  const partial = await supply(page); expect(partial.supplier.orders[0].delivered).toBe(1);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await care(page)).injuries.find(i => i.id === 'first-aid-internal').diagnosedAt).toBeNull();
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(120));
  const received = await supply(page); expect(received.supplier.orders[0].status).toBe('received');
  const lot = received.carried.find(i => i.key === 'medicalBandage'); expect(lot.sourceLabels).toContain(paid.supplier.orders[0].id);
  await wound.getByRole('button', { name: /^Stabilize Own Injury/ }).click();
  const queued = await care(page); expect(queued.tasks[0].data.supplyStackId).toBe(lot.id); expect(queued.injuries.find(i => i.id === 'first-aid-wound').status).toBe('active');
  await panel.getByRole('button', { name: /^Cancel Personal First Aid/ }).click();
  expect((await care(page)).carried.find(i => i.id === lot.id).reservedTaskId).toBe('');
  await wound.getByRole('button', { name: /^Stabilize Own Injury/ }).click();
  await page.evaluate(() => { window.helixHeresyDebug.advanceSimulation(5); window.helixHeresyDebug.reloadSurveyExpeditionTestState(); });
  await finish(page); const stabilized = await care(page); expect(stabilized.injuries.find(i => i.id === 'first-aid-wound').status).toBe('stabilized');
  expect(stabilized.carried.filter(i => i.key === 'medicalBandage').reduce((n, i) => n + i.quantity, 0)).toBe(1);
  await wound.getByRole('button', { name: /^Treat Own Injury/ }).click(); await finish(page);
  const treated = await care(page); expect(treated.injuries.find(i => i.id === 'first-aid-wound')).toMatchObject({ status: 'recovering', severityId: 'moderate' });
  expect(treated.carried.some(i => i.key === 'medicalBandage')).toBe(false);
  await purchase(page, 'neutralizingWash', 1); await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(300));
  await panel.locator('[data-foreign-care-injury="first-aid-burn"]').getByRole('button', { name: /^Treat Own Injury/ }).click(); await finish(page);
  expect((await care(page)).injuries.find(i => i.id === 'first-aid-burn').status).toBe('recovering');
  expect((await care(page)).carried.some(i => i.key === 'neutralizingWash')).toBe(false);
  await panel.locator('[data-foreign-care-injury="first-aid-internal"]').getByRole('button', { name: /^Examine Own Injury/ }).click(); await finish(page);
  expect((await care(page)).injuries.find(i => i.id === 'first-aid-internal').diagnosedAt).not.toBeNull();
  expect((await care(page)).carried).toEqual(treated.carried); expect(errors).toEqual([]);
});
test('first-aid controls retain exact supplies under changed custody, position, body and visit and freeze unfinished care on death', async ({ page }) => {
  test.setTimeout(240000); await enter(page, 'dom'); await purchase(page, 'medicalBandage', 1);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(300));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSelfCareAction('treat', 'first-aid-wound'))).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(5));
  const task = (await care(page)).tasks[0]; expect(task.reason).toBe('');
  expect(task.data.foreignSelfCare.progressSeconds).toBe(5);
  const results = await page.evaluate(({ taskId, stackId }) => {
    const d = window.helixHeresyDebug, original = d.exportSurveyExpeditionTestState(), results = [];
    for (const kind of ['supplyKey', 'claim', 'custody', 'dimensions', 'body', 'visit', 'position']) {
      const s = JSON.parse(JSON.stringify(original)), item = s.physicalItemStacks.find(i => i.id === stackId);
      if (kind === 'supplyKey') item.key = 'neutralizingWash';
      if (kind === 'claim') item.cityOwnerId = 'b';
      if (kind === 'custody') item.carriedBy = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').visitorSupplies.actor.id;
      if (kind === 'dimensions') item.unitMassKg++;
      if (kind === 'body') s.scientistIdentity.bodyEpoch++;
      if (kind === 'visit') s.intercityPassenger.trip.id += ':changed';
      if (kind === 'position') s.scientist.mapCell.x--;
      d.importSurveyExpeditionTestState(s); const before = d.foreignSelfCareSnapshot();
      d.advanceSimulation(Math.max(1, before.tasks[0].dueAt - before.clock + 1)); const after = d.foreignSelfCareSnapshot();
      results.push({ kind, reason: before.tasks[0]?.reason, taskId: after.tasks[0]?.id, status: after.injuries.find(i => i.id === 'first-aid-wound').status,
        quantity: d.physicalStockSnapshot().stacks.find(i => i.id === stackId)?.quantity });
    }
    d.importSurveyExpeditionTestState(original); return results;
  }, { taskId: task.id, stackId: task.data.supplyStackId });
  for (const r of results) { expect(r.reason, r.kind).toBeTruthy(); expect(r.taskId, r.kind).toBe(task.id); expect(r.status, r.kind).toBe('active'); expect(r.quantity, r.kind).toBe(1); }
  const attendance = await page.evaluate(stackId => {
    const d = window.helixHeresyDebug, original = d.exportSurveyExpeditionTestState(), s = JSON.parse(JSON.stringify(original));
    const supplier = s.penalFlights.assistance.cityApproach.gates.find(g => g.cityId === 'b').visitorSupplies.actor.id;
    s.physicalItemStacks.find(i => i.id === stackId).carriedBy = supplier; d.importSurveyExpeditionTestState(s);
    d.advanceSimulation(300); const held = d.foreignSelfCareSnapshot();
    const resumed = d.exportSurveyExpeditionTestState(); resumed.physicalItemStacks.find(i => i.id === stackId).carriedBy = 'scientist';
    d.importSurveyExpeditionTestState(resumed); d.advanceSimulation(1); const rearmed = d.foreignSelfCareSnapshot();
    const work = rearmed.tasks[0].data.foreignSelfCare; d.advanceSimulation(work.requiredSeconds - work.progressSeconds + 1);
    const finished = d.foreignSelfCareSnapshot(); d.importSurveyExpeditionTestState(original);
    return { held: held.tasks[0].data.foreignSelfCare.progressSeconds, rearmed: work.progressSeconds,
      finishedStatus: finished.injuries.find(i => i.id === 'first-aid-wound').status, remainingTasks: finished.tasks.length,
      carriedBandages: finished.carried.filter(i => i.key === 'medicalBandage').reduce((n, i) => n + i.quantity, 0) };
  }, task.data.supplyStackId);
  expect(attendance).toEqual({ held: 5, rearmed: 5, finishedStatus: 'recovering', remainingTasks: 0, carriedBandages: 0 });
  await page.evaluate(() => { const d = window.helixHeresyDebug; d.inflictTestScientistDamage(); });
  const frozen = await care(page); await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(300));
  const dead = await care(page); expect(dead.tasks).toEqual(frozen.tasks); expect(dead.injuries).toEqual(frozen.injuries); expect(dead.carried).toEqual(frozen.carried);
  expect(await page.evaluate(id => window.helixHeresyDebug.foreignSelfCareAction('cancel', id), task.id)).toBe(false);
});
test('first-aid controls use carried supplies after trading expiry, support paid berth recovery and collect the paid remainder outside', async ({ page }) => {
  test.setTimeout(300000); await enter(page, 'dom'); const { before, paid } = await purchase(page, 'medicalBandage', 2);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(240, true));
  expect((await supply(page)).supplier.orders[0].delivered).toBe(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignLodgingAction('book', d.foreignLodgingSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(60));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignLodgingAction('walk'))).toBe(true); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.foreignReceptionSnapshot();
    d.advanceForeignReceptionTestTime(s.gate.visitorAdmission.permits.at(-1).expiresAt - s.clock); });
  expect((await supply(page)).quote).toBeNull(); expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionSnapshot().permission)).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSelfCareAction('treat', 'first-aid-wound'))).toBe(true); await finish(page);
  const treated = (await care(page)).injuries.find(i => i.id === 'first-aid-wound'); expect(treated.status).toBe('recovering');
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignLodgingAction('rest'))).toBe(true); await finish(page);
  const rested = (await care(page)).injuries.find(i => i.id === 'first-aid-wound'); expect(rested.nextRecoveryAt).toBeLessThan(treated.nextRecoveryAt);
  expect(rested.status).toBe('recovering'); expect(rested.severityId).toBe('moderate');
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('exit'))).toBe(true); await finish(page);
  await page.getByRole('button', { name: 'Request Paid Goods at Outer Stand', exact: true }).click();
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(600));
  const received = await supply(page); expect(received.supplier.orders[0]).toMatchObject({ status: 'received', target: 'outer', delivered: 2 });
  expect(received.money).toBe(paid.money - 20); expect(received.market.listings.medicalBandage.supply).toBe(before.quote.stock - 2);
  expect(received.carried.filter(i => i.key === 'medicalBandage').reduce((n, i) => n + i.quantity, 0)).toBe(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSelfCareAction('stabilize', 'first-aid-internal'))).toBe(false);
});
