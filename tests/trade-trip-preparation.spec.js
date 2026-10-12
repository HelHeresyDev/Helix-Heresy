const { test, expect } = require('@playwright/test');
const Packing = require('../trade-trip-preparation');
const Supplies = require('../foreign-supplies');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
test.use({ actionTimeout: 15000 });
const item = () => ({ id: 'owned', section: 'resources', key: 'metalParts', quantity: 10, unitMassKg: 1, unitVolumeL: .5, carriedBy: '', reservedTaskId: '' });
const ctx = () => ({ atLab: true, alive: true, capable: true, free: true, busy: false, accessible: true,
  remaining: { massKg: 18, volumeL: 24 }, manifest: Packing.manifest([]) });
test('exact owned floor/store metal-parts slices use the same exclusions as lawful sale', () => {
  const i = item(), c = ctx(), before = JSON.stringify({ i, c });
  expect(Packing.plan(i, 3, c)).toMatchObject({ ok: true, stackId: 'owned', quantity: 3, massKg: 3, volumeL: 1.5 });
  expect(Supplies.saleLot({ ...i, carriedBy: 'scientist' })).toBe(true); expect(JSON.stringify({ i, c })).toBe(before);
  for (const patch of [{ carriedBy: 'scientist' }, { carriedBy: 'other' }, { reservedTaskId: 'other-task' }, { cityOwnerId: 'a' },
    { civicCustody: {} }, { carryTaskId: 'loan' }, { toolInstanceId: 'claimed' }, { containerId: 'sealed' }, { chemicalBatch: {} },
    { contents: [{}] }, { biology: {} }, { section: 'chemicalBatches' }, { key: 'fieldRation' }]) expect(Packing.plan({ ...i, ...patch }, 1, c).ok).toBe(false);
});
test('one-to-six exact quantities never silently shrink, merge lots or change source stock', () => {
  const i = item(), c = ctx();
  for (const n of [0, -1, 1.5, 7, NaN]) expect(Packing.plan(i, n, c).ok).toBe(false);
  expect(Packing.plan({ ...i, quantity: 2 }, 3, c).ok).toBe(false);
  c.manifest = Packing.manifest([{ ...i, carriedBy: 'scientist', quantity: 4 }]);
  expect(Packing.plan(i, 3, c).ok).toBe(false); expect(Packing.plan(i, 2, c).ok).toBe(true); expect(i.quantity).toBe(10);
});
test('physical lab, freedom, life, capability, attendance and accessible storage are required without civic authority', () => {
  for (const patch of [{ atLab: false }, { free: false }, { alive: false }, { capable: false }, { busy: true }, { accessible: false }])
    expect(Packing.plan(item(), 1, { ...ctx(), ...patch }).ok).toBe(false);
  expect(Packing.plan(item(), 1, ctx()).ok).toBe(true); // No charter, appointment, endorsement or market access input.
});
test('actual backpack limits and shared passenger mass/volume prevent throwing away supplies or overpacking', () => {
  const c = ctx(); c.remaining.massKg = 1; expect(Packing.plan(item(), 2, c).reason).toContain('backpack');
  c.remaining = { massKg: 100, volumeL: 100 };
  c.manifest = Packing.manifest([{ id: 'survival', key: 'drinkingWater', quantity: 19, unitMassKg: 1, unitVolumeL: 1, carriedBy: 'scientist' }]);
  expect(Packing.plan(item(), 2, c).reason).toContain('passenger');
  c.manifest = Packing.manifest([{ id: 'bulky', quantity: 1, key: 'shelter', unitMassKg: 1, unitVolumeL: 40, carriedBy: 'scientist' }]);
  expect(Packing.plan(item(), 1, c).ok).toBe(false);
  expect(Packing.plan({ ...item(), unitMassKg: NaN }, 1, ctx()).ok).toBe(false);
});
test('only the original task may revalidate its reserved slice, and new claims still block pickup', () => {
  const i = { ...item(), quantity: 3, reservedTaskId: 'packing' };
  expect(Packing.plan(i, 3, ctx(), 'packing').ok).toBe(true);
  expect(Packing.plan(i, 3, ctx(), 'another').ok).toBe(false);
  expect(Packing.plan({ ...i, cityOwnerId: 'a' }, 3, ctx(), 'packing').ok).toBe(false);
});
test('manifest contains actual carried goods only, labels claims/reservations and grants no future prices or return', () => {
  const stacks = [{ ...item(), carriedBy: 'scientist', quantity: 2 }, { ...item(), id: 'civic', carriedBy: 'scientist', quantity: 1, cityOwnerId: 'a', reservedTaskId: 'civic-order' }, item()];
  const before = JSON.stringify(stacks), m = Packing.manifest(stacks);
  expect(m.massKg).toBe(3); expect(m.volumeL).toBe(1.5); expect(m.items).toHaveLength(2);
  expect(m.items[1]).toMatchObject({ claimed: true, reserved: true }); expect(m.reserved).toBe(true);
  expect(m.passengerRemaining).toEqual({ massKg: 17, volumeL: 38.5 }); expect(JSON.stringify(stacks)).toBe(before);
  expect(Packing.WARNING).toContain('may not cover'); expect(Packing.WARNING).toContain('never guaranteed');
  expect(JSON.stringify(m)).not.toContain('bid');
});

function network() {
  return { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
    { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Helix Laboratory', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
    ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: id } }))
  ], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] };
}
function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const identity = Civic.create(), office = m.identityOffices[0], c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(identity, office, Civic.preview(identity, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(identity, m.identityOffices, c, 0);
  return { identity, offices: m.identityOffices };
}
async function start(page, renderer) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  await page.evaluate(({ network, identity, renderer }) => {
    const d = window.helixHeresyDebug, city = { cityId: 'a', assetId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional', provisioning: 'functional' } };
    d.setSurveyExpeditionTestContext({ network, context: { worldId: 'packing-world', siteId: 'parcel', strategicCellId: 'planet-cell:00009', seed: 'packing', publicProspects: { prospectBands: {} }, truth: {} },
      carrierSource: { strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster Works', capacityBand: 'functional' }] }] } },
      passengerSource: { city, standings: [{ network: { id: 'transport:a', category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Passenger Depot', capacityBand: 'functional', operationalStatus: 'active' } }] } });
    d.setMapRenderer(renderer);
    d.setForeignReceptionTestContext({ source: { ...city, cityId: 'b', administrationId: 'admin:b', administrationName: 'Neighbor Administration', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, capacityBand: 'functional', recognition: 'verified', localRules: [] }, ...identity });
    d.setForeignSuppliesTestContext({ city: { ...city, cityId: 'b' }, standings: [{ network: { id: 'commerce:b', category: 'commercial', roles: ['procurement'] }, standing: 'licensed', branch: { id: 'supplier:b', cityId: 'b', publicName: 'Neighbor Provision Depot', capacityBand: 'functional', operationalStatus: 'active' } }],
      market: { id: 'b', listings: { metalParts: { supply: 60, demand: 1 }, drinkingWater: { supply: 12, demand: 1 }, fieldRation: { supply: 10, demand: 1 } } } });
  }, { network: network(), identity: identity(), renderer });
  await page.locator('[data-workspace-tab="visits"]').click();
}
async function finish(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let i = 0; i < 12; i++) {
    const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return;
    d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
  } throw new Error('Ordinary physical work failed to finish'); });
}
async function municipalTravel(page) {
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let i = 0; i < 8; i++) {
    const s = d.surveyExpeditionSnapshot(); if (!['outbound', 'inbound'].includes(s.phase)) return;
    const j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.journeyId);
    if (j.status === 'stranded') d.controlSurveyJourney('recover'); else d.advanceSimulation(Math.max(1, j.exactArrivalAt - s.clock + 1));
  } throw new Error('Municipal journey did not finish'); });
}
async function bookPaidPassenger(page, outbound) {
  const result = await page.evaluate(() => {
    const d = window.helixHeresyDebug, before = d.intercityPassengerSnapshot().money;
    const ok = d.bookIntercityPassenger('city:b'), after = d.intercityPassengerSnapshot();
    return { ok, before, money: after.money, booking: after.carrier.booking };
  });
  expect(result.ok).toBe(true); expect(result.booking.outbound).toBe(outbound);
  expect(result.booking.fee).toBeGreaterThan(0); expect(result.money).toBe(result.before - result.booking.fee);
}
test('saved trade pickup blocks changed ownership, dimensions and body and cancels only its own reservation', async ({ page }) => {
  test.setTimeout(180000); await start(page, 'dom');
  const before = await page.evaluate(() => window.helixHeresyDebug.tradePackingSnapshot());
  const lot = before.lots.find(i => i.quantity >= 4);
  expect(await page.evaluate(id => window.helixHeresyDebug.packTradeCargo(id, 3), lot.id)).toBe(true);
  const saved = await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState());
  const task = saved.tasks.find(t => t.data?.tradePacking);
  for (const change of ['claim', 'dimensions', 'access', 'body']) {
    await page.evaluate(({ saved, change, stackId }) => {
      const d = window.helixHeresyDebug, s = JSON.parse(JSON.stringify(saved));
      const i = s.physicalItemStacks.find(i => i.id === stackId);
      if (change === 'claim') i.cityOwnerId = 'a';
      if (change === 'dimensions') i.unitMassKg += .5;
      if (change === 'access') s.fixtures.find(f => f.id === i.fixtureId).condition = 0;
      if (change === 'body') s.scientistIdentity.bodyEpoch += 1;
      d.importSurveyExpeditionTestState(s);
    }, { saved, change, stackId: task.data.stackId });
    const blocked = await page.evaluate(() => window.helixHeresyDebug.tradePackingSnapshot());
    expect(blocked.tasks[0].reason).toContain(['claim', 'access'].includes(change) ? 'player-owned' : change === 'dimensions' ? 'dimensions changed' : 'original body');
    expect(blocked.context.manifest.metalParts).toBe(0);
    // Another task's later reservation is not ours to clear.
    if (change === 'body') await page.evaluate(id => {
      const d = window.helixHeresyDebug, s = d.exportSurveyExpeditionTestState();
      s.physicalItemStacks.find(i => i.id === id).reservedTaskId = 'other-task';
      d.importSurveyExpeditionTestState(s);
    }, task.data.stackId);
    expect(await page.evaluate(id => window.helixHeresyDebug.cancelTask(id), task.id)).toBe(true);
    const stack = (await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks)).find(i => i.id === task.data.stackId);
    expect(stack.quantity).toBe(3); expect(stack.carriedBy).toBe(''); expect(stack.cell).toEqual(lot.cell);
    expect(stack.reservedTaskId).toBe(change === 'body' ? 'other-task' : '');
  }
});
for (const renderer of ['dom', 'canvas']) test(`ordinary exact packing, saved pickup, foreign sale and paid physical return through ${renderer}`, async ({ page }) => {
  test.setTimeout(420000); const errors = []; page.on('pageerror', e => errors.push(e.message)); await start(page, renderer);
  const snap = () => page.evaluate(() => window.helixHeresyDebug.tradePackingSnapshot());
  const before = await snap(), lot = before.lots.find(i => i.quantity >= 4);
  expect(lot).toBeTruthy(); expect(before.context.manifest.metalParts).toBe(0);
  const panel = page.locator('[data-trade-trip-preparation]'); await expect(panel).toContainText('may not cover travel');
  await panel.getByLabel('Exact trade-cargo lot').selectOption(lot.id); await panel.getByLabel('Trade-cargo packing quantity').selectOption('3');
  await panel.getByRole('button', { name: 'Walk to and Pack Exact Trade Cargo', exact: true }).click();
  const booked = await snap(), task = booked.tasks[0]; expect(task).toBeTruthy(); expect(task.reason).toBe('');
  expect(task.data.stackId).not.toBe(lot.id); expect(booked.context.manifest.metalParts).toBe(0);
  const stacks = await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks);
  expect(stacks.find(i => i.id === lot.id)).toMatchObject({ quantity: lot.quantity - 3, reservedTaskId: '' });
  expect(stacks.find(i => i.id === task.data.stackId)).toMatchObject({ quantity: 3, reservedTaskId: task.id, carriedBy: '' });
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(5));
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  expect((await snap()).tasks[0].data.stackId).toBe(task.data.stackId); await finish(page);
  const packed = await snap(); expect(packed.context.manifest.metalParts).toBe(3); expect(packed.context.manifest.fitsPassenger).toBe(true);
  expect(packed.tasks).toHaveLength(0); expect(packed.cell).not.toEqual(before.cell);
  // A cancelled second slice never unpacks the already carried lot or releases somebody else's claim.
  expect(await page.evaluate(id => window.helixHeresyDebug.packTradeCargo(id, 1), lot.id)).toBe(true);
  const cancelled = (await snap()).tasks[0];
  await panel.getByRole('button', { name: `Cancel ${cancelled.label}`, exact: true }).click();
  expect((await snap()).tasks).toHaveLength(0);
  expect((await snap()).context.manifest.metalParts).toBe(3);
  expect((await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks)).find(i => i.id === cancelled.data.stackId).reservedTaskId).toBe('');
  for (const key of ['environmentalSurveyKit', 'sealedReagentBottle', 'medicalBandage', 'fieldRation']) {
    expect(await page.evaluate(key => window.helixHeresyDebug.packSurveyItem(key), key)).toBe(true); await finish(page);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().citySuccession)).toBeNull();
  expect(await page.evaluate(() => window.helixHeresyDebug.reserveMunicipalCarrier())).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.surveyExpeditionSnapshot(), j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.carrier.journeyId); d.advanceSimulation(j.exactArrivalAt - s.clock + 1); });
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finish(page); await municipalTravel(page);
  await bookPaidPassenger(page, true);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(180));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('enter'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignSupplyAction('walk'))).toBe(true); await finish(page);
  const sale = await page.evaluate(id => window.helixHeresyDebug.foreignSaleSnapshot(id, 2), task.data.stackId); expect(sale.quote).not.toBeNull();
  expect(await page.evaluate(q => window.helixHeresyDebug.foreignSupplyAction('sell', { quote: q }), sale.quote)).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(300));
  const settled = await page.evaluate(() => window.helixHeresyDebug.foreignSaleSnapshot());
  expect(settled.money).toBe(sale.money + sale.quote.net); expect(settled.supplier.orders[0].status).toBe('received');
  expect(settled.carried.filter(i => i.key === 'metalParts').reduce((n, i) => n + i.quantity, 0)).toBe(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('exit'))).toBe(true); await finish(page);
  await bookPaidPassenger(page, false);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(1600));
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finish(page); await municipalTravel(page);
  const home = await snap(); expect(home.context.atLab).toBe(true); expect(home.context.manifest.metalParts).toBe(1);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().citySuccession)).toBeNull(); expect(errors).toEqual([]);
});
