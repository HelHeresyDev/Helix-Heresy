const { test, expect } = require('@playwright/test');
const Supplies = require('../foreign-supplies');
const Registry = require('../carrier-identity');
const Civic = require('../scientist-identity');
const { pathToFileURL } = require('url');
const path = require('path');
test.use({ actionTimeout: 15000 });
const copy = v => JSON.parse(JSON.stringify(v));
const def = { id: 'assayReagent', section: 'resources', label: 'Assay Reagent', buyable: true, basePrice: 31, supply: 40, liquidity: 18 };
function fixture() {
  const s = Supplies.create({ cityId: 'b', currentPopulation: 100, physicalCondition: 'intact', services: { provisioning: 'functional' } },
    [{ network: { id: 'commerce:b', category: 'commercial', roles: ['procurement'] }, standing: 'licensed',
      branch: { id: 'supplier:b', cityId: 'b', publicName: 'Neighbor Depot', capacityBand: 'functional' } }], 0, { roomId: 'hall', cell: {} });
  const m = { id: 'b', treasury: 1000, listings: { assayReagent: { supply: 8, demand: 1 } } };
  const c = { alive: true, capable: true, local: true, contact: true, atCounter: true, atOuter: false, providerCurrent: true,
    bodyEpoch: 0, visitId: 'trip', busy: false, permit: { id: 'permit', expiresAt: 21600 }, routeSeconds: 20,
    metrics: { massKg: 1, volumeL: .5 }, remaining: { massKg: 18, volumeL: 24 }, supplierRemaining: { massKg: 18, volumeL: 24 }, passengerRemaining: { massKg: 20, volumeL: 40 } };
  let allocations = 0, handoffs = 0;
  return { s, m, c, wallet: { money: 1000 }, hooks: { allocate: (id, q) => { expect(q.section).toBe('resources'); allocations++; return 'original-paid-lot'; },
    custody: () => true, move: () => ({ done: true }), collect: () => true, handoff: () => `receipt-${++handoffs}` },
    get allocations() { return allocations; }, get handoffs() { return handoffs; } };
}
function buy(f, n = 3) { const q = Supplies.quote(f.s, f.m, def, n, f.c, 0); expect(q).not.toBeNull();
  expect(Supplies.buy(f.s, f.m, def, q, f.c, f.wallet, 0, f.hooks)).toBe(true); return q; }
test('assay reagent requires its separately published typed terms, not admission or a wider chemical license', () => {
  const f = fixture(), before = JSON.stringify(f);
  expect(Supplies.quote(f.s, f.m, def, 3, f.c, 0)).toMatchObject({ section: 'resources', quantity: 3, handlingFee: 4 });
  expect(JSON.stringify(f)).toBe(before);
  for (const patch of [{ labTerms: null }, { labTerms: { ...Supplies.LAB_TERMS, good: 'other' } }, { labTerms: { ...Supplies.LAB_TERMS, maxQuantity: 12 } }])
    expect(Supplies.quote({ ...f.s, ...patch }, f.m, def, 1, f.c, 0)).toBeNull();
  expect(Supplies.quote(f.s, f.m, { ...def, section: 'inventory' }, 1, f.c, 0)).toBeNull();
  expect(Supplies.quote(f.s, f.m, { ...def, buyable: false }, 1, f.c, 0)).toBeNull();
  expect(Supplies.quote(f.s, f.m, { ...def, id: 'helixBufferSolution' }, 1, f.c, 0)).toBeNull();
});
test('finite original stock, exact current ask, funds and shared transaction slot charge and allocate once', () => {
  const f = fixture(), stale = Supplies.quote(f.s, f.m, def, 3, f.c, 0); f.m.listings.assayReagent.supply = 4;
  expect(Supplies.buy(f.s, f.m, def, stale, f.c, f.wallet, 1, f.hooks)).toBe(false); expect(f.allocations).toBe(0);
  f.m.listings.assayReagent.supply = 8; const q = buy(f);
  expect(f.wallet.money).toBe(1000 - q.total); expect(f.m.listings.assayReagent.supply).toBe(5); expect(f.handoffs).toBe(0);
  expect(f.s.orders[0]).toMatchObject({ stackId: 'original-paid-lot', status: 'collecting', delivered: 0 });
  expect(Supplies.buy(f.s, f.m, def, q, f.c, f.wallet, 1, f.hooks)).toBe(false); expect(f.allocations).toBe(1);
  expect(Supplies.quote(f.s, f.m, def, 1, f.c, 1)).toBeNull();
});
test('reagent quantity, living attendance, permit time, finite duty and backpack/passenger capacity bound purchase', () => {
  const f = fixture(); for (const n of [0, -1, 1.5, 7, 9]) expect(Supplies.quote(f.s, f.m, def, n, f.c, 0)).toBeNull();
  for (const patch of [{ alive: false }, { capable: false }, { contact: false }, { atCounter: false }, { permit: null }, { providerCurrent: false }, { busy: true },
    { remaining: { massKg: 1, volumeL: 24 } }, { supplierRemaining: { massKg: 18, volumeL: 1 } },
    { passengerRemaining: { massKg: 2, volumeL: 40 } }, { passengerRemaining: { massKg: 20, volumeL: 1 } },
    { passengerRemaining: { massKg: NaN, volumeL: 40 } }, { metrics: { massKg: NaN, volumeL: .5 } }, { routeSeconds: -1 }, { routeSeconds: Infinity }, { permit: { id: 'permit', expiresAt: 100 } }])
    expect(Supplies.quote(f.s, f.m, def, 3, { ...f.c, ...patch }, 0)).toBeNull();
  expect(Supplies.quote({ ...f.s, workSeconds: 10 }, f.m, def, 3, f.c, 0)).toBeNull();
});
test('saved partial reagent handoffs pause without backfill and finish outside after expiry; death/body guards persist', () => {
  const f = fixture(); buy(f); Supplies.advance(f.s, f.c, 90, f.hooks); expect(f.handoffs).toBe(1);
  f.s = copy(f.s); Supplies.advance(f.s, { ...f.c, atCounter: false }, 1000, f.hooks); expect(f.handoffs).toBe(1);
  f.c.permit = null; f.c.atOuter = true; f.c.atCounter = false;
  expect(Supplies.outer(f.s, { ...f.c, at: 1000 })).toBe(true); Supplies.advance(f.s, f.c, 1001, f.hooks); Supplies.advance(f.s, f.c, 1061, f.hooks);
  expect(f.s.orders[0].status).toBe('received'); expect(f.handoffs).toBe(3); expect(f.m.listings.assayReagent.supply).toBe(5);
  const g = fixture(); buy(g); const frozen = JSON.stringify(g.s); Supplies.advance(g.s, { ...g.c, alive: false }, 999, g.hooks); expect(JSON.stringify(g.s)).toBe(frozen);
  Supplies.advance(g.s, { ...g.c, bodyEpoch: 1 }, 1000, g.hooks); expect(g.s.orders[0].status).toBe('bodyLost'); expect(g.handoffs).toBe(0);
});
test('asking-price history is bounded personally received knowledge, not bids, backfill or remote live data', () => {
  const f = fixture(), v = copy(Supplies.observe(f.s, f.c, f.m, [def], 0)); expect(v.labInput.history).toEqual([{ at: 0, ask: v.labInput.ask }]);
  Supplies.observe(f.s, f.c, f.m, [def], 0); expect(f.s.askHistory).toHaveLength(1);
  f.m.listings.assayReagent.supply = 1;
  expect(Supplies.observe(f.s, { ...f.c, contact: false }, f.m, [def], 1000)).toEqual(v);
  for (let at = 60; at <= 4200; at += 60) Supplies.observe(f.s, f.c, f.m, [def], at);
  expect(f.s.askHistory).toHaveLength(60); expect(f.s.askHistory[0].at).toBe(660);
  const known = copy(f.s.askHistory); Supplies.observe(f.s, { ...f.c, permit: null }, f.m, [def], 4300); expect(f.s.askHistory).toEqual(known);
  for (const patch of [{ workSeconds: 0 }, { powerSeconds: 0 }, { provisionsSeconds: 0 }]) {
    const s = { ...copy(f.s), ...patch }, report = Supplies.observe(s, f.c, f.m, [def], 4400);
    expect(s.askHistory).toEqual(known); expect(report.listings.some(i => i.good === def.id)).toBe(false);
    expect(report.labInput.history).toEqual(known);
  }
  expect(JSON.stringify(f.s.knowledge.labInput)).not.toMatch(/treasury|production|bid/);
});
test('exact home unloading requires owned received cargo, current body, real access and whole-lot space without mutation', () => {
  const i = { id: 'received', section: 'resources', key: 'assayReagent', quantity: 1, carriedBy: 'scientist', unitMassKg: 1, unitVolumeL: .5 };
  const c = { atLab: true, alive: true, capable: true, free: true, sameBody: true, busy: false, receipt: true, accessible: true, remaining: { massKg: 10, volumeL: 10 } };
  const before = JSON.stringify({ i, c }); expect(Supplies.unloadPlan(i, c).ok).toBe(true); expect(JSON.stringify({ i, c })).toBe(before);
  for (const patch of [{ cityOwnerId: 'b' }, { civicCustody: {} }, { carryTaskId: 'borrowed' }, { reservedTaskId: 'other' }, { containerId: 'closed' }, { section: 'inventory' }, { carriedBy: '' }, { chemicalBatch: {} }])
    expect(Supplies.unloadPlan({ ...i, ...patch }, c).ok).toBe(false);
  for (const patch of [{ atLab: false }, { alive: false }, { capable: false }, { free: false }, { sameBody: false }, { busy: true }, { receipt: false }, { accessible: false }, { remaining: { massKg: 0, volumeL: 10 } }])
    expect(Supplies.unloadPlan(i, { ...c, ...patch }).ok).toBe(false);
  expect(Supplies.unloadPlan({ ...i, reservedTaskId: 'own' }, c, 'own').ok).toBe(true);
});

function network() { return { homeDestinationId: 'site:lab', nearestSettlementDestinationId: 'city:a', destinations: [
  { id: 'site:lab', kind: 'laboratorySite', cityId: 'a', label: 'Helix Laboratory', cellId: 'planet-cell:00009', supportComponentId: 'one', known: true, reachable: true, localDistanceKm: 2, routeContinuity: 'municipal', dangerBand: 'veryLow' },
  ...['a', 'b'].map(id => ({ id: `city:${id}`, kind: 'fortifiedCity', cityId: id, label: `City ${id}`, cellId: 'planet-cell:00001', supportComponentId: 'one', known: true, reachable: true, jurisdiction: { kind: 'city', cityId: id } }))
], routes: [{ id: 'route:ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 2 }] }; }
function identity() {
  const m = { homeId: 'a' }; Registry.provision(m, { institutionId: 'admin:a', cityId: 'a', name: 'Aster Registry', active: true, localDistanceKm: 2 }, -2000);
  const value = Civic.create(), office = m.identityOffices[0], c = { alive: true, capable: true, atCounter: true, cityId: 'a', clerkPresent: true, lineOfSight: true, busy: false, visibility: 'clear' };
  Civic.begin(value, office, Civic.preview(value, office, 'Mira Vale'), { money: 100 }, c, -1800); Civic.advance(value, m.identityOffices, c, 0);
  return { identity: value, offices: m.identityOffices };
}
async function start(page, renderer) {
  await page.addInitScript(() => localStorage.clear()); await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
  return page.evaluate(({ network, identity, renderer }) => {
    const d = window.helixHeresyDebug, city = { cityId: 'a', assetId: 'a', currentPopulation: 100, physicalCondition: 'intact', services: { transport: 'functional', provisioning: 'functional' } };
    // The consumer under test is import-to-assay, not wilderness prospecting.
    // One explicit original sealed home sample avoids that unrelated setup.
    const sampleId = d.configureLaboratoryAssistantTestSupport();
    d.setSurveyExpeditionTestContext({ network, context: { worldId: 'lab-input-world', siteId: 'parcel', strategicCellId: 'planet-cell:00009', seed: 'lab-input', publicProspects: { prospectBands: { ferrousOre: 'moderate' } }, truth: { potentialPermille: { ferrousOre: 900 }, typicalDepth: { ferrousOre: 'exposed' }, surfaceAccessibilityPermille: 1000, environmentalDifficultyPermille: 0 } },
      carrierSource: { strategicPlayableSettlementState: { cityRows: [city] }, cityGovernments: { governments: [{ cityId: 'a', roleAssignments: { publicWorksAndProvisioning: 'works:a' }, institutions: [{ id: 'works:a', name: 'Aster Works', capacityBand: 'functional' }] }] } },
      passengerSource: { city, standings: [{ network: { id: 'transport:a', category: 'transport' }, standing: 'licensed', branch: { id: 'branch:a', publicName: 'Aster Passenger Depot', capacityBand: 'functional' } }] } });
    d.setForeignReceptionTestContext({ source: { ...city, cityId: 'b', administrationId: 'admin:b', administrationName: 'Neighbor Administration', watchId: 'watch:b', lawId: 'law:b', currentAuthority: true, capacityBand: 'functional', recognition: 'verified', localRules: [] }, ...identity });
    d.setForeignSuppliesTestContext({ city: { ...city, cityId: 'b' }, standings: [{ network: { id: 'commerce:b', category: 'commercial', roles: ['procurement'] }, standing: 'licensed', branch: { id: 'supplier:b', cityId: 'b', publicName: 'Neighbor Depot', capacityBand: 'functional' } }],
      market: { id: 'b', listings: { assayReagent: { supply: 8, demand: 1 }, drinkingWater: { supply: 12, demand: 1 }, fieldRation: { supply: 10, demand: 1 }, metalParts: { supply: 60, demand: 1 } } } });
    // Explicitly empty the home reagent reserve so actual imported units, not starting stock, must fund the assay.
    const s = d.exportSurveyExpeditionTestState();
    // The ordinary starter shelf is over capacity. DOM exercises existing floor storage;
    // canvas uses a resource-depleted existing shelf to cover actual finite fixture space, without adding supplies.
    s.physicalItemStacks = s.physicalItemStacks.filter(i => i.key !== 'assayReagent'
      && !(renderer === 'canvas' && i.section === 'resources' && i.fixtureId === 'starter-storage-shelf'));
    d.importSurveyExpeditionTestState(s); d.setMapRenderer(renderer);
    return { stackId: sampleId };
  }, { network: network(), identity: identity(), renderer });
}
async function finish(page) { await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 12; n++) {
  const s = d.surveyExpeditionSnapshot(), t = s.tasks.find(t => !t.reason); if (!t) return; d.advanceSimulation(Math.max(1, t.dueAt - s.clock + 1));
} throw new Error('Ordinary physical work did not finish'); }); }
async function municipalTravel(page) { await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 8; n++) {
  const s = d.surveyExpeditionSnapshot(); if (!['outbound', 'inbound'].includes(s.phase)) return;
  const j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.journeyId); d.advanceSimulation(Math.max(1, j.exactArrivalAt - s.clock + 1));
} throw new Error('Municipal route did not finish'); }); }
async function passengerLeg(page, outbound) {
  const booked = await page.evaluate(() => { const d = window.helixHeresyDebug, before = d.intercityPassengerSnapshot().money;
    const ok = d.bookIntercityPassenger('city:b'), s = d.intercityPassengerSnapshot(); return { ok, before, money: s.money, booking: s.carrier.booking }; });
  expect(booked.ok).toBe(true); expect(booked.booking.outbound).toBe(outbound); expect(booked.money).toBe(booked.before - booked.booking.fee);
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerBoard'))).toBe(true); await finish(page);
  await page.evaluate(() => { const d = window.helixHeresyDebug; for (let n = 0; n < 6; n++) {
    const s = d.intercityPassengerSnapshot(); if (s.carrier.phase === 'arrival') return;
    const t = s.carrier.trip; d.advanceSimulation(Math.max(1, t.seconds - t.progressSeconds + t.delaySeconds + 1));
  } throw new Error('Paid passenger leg did not arrive'); });
  expect(await page.evaluate(() => window.helixHeresyDebug.queueIntercityPassenger('passengerDisembark'))).toBe(true); await finish(page);
}
for (const renderer of ['dom', 'canvas']) test(`foreign reagent purchase, saved physical receipt, paid return, home storage and real assay through ${renderer}`, async ({ page }) => {
  test.setTimeout(900000); const errors = []; page.on('pageerror', e => errors.push(e.message)); const sample = await start(page, renderer);
  await page.locator('[data-workspace-tab="visits"]').click();
  for (const key of ['environmentalSurveyKit', 'sealedReagentBottle', 'medicalBandage', 'fieldRation']) {
    expect(await page.evaluate(key => window.helixHeresyDebug.packSurveyItem(key), key)).toBe(true); await finish(page);
  }
  expect(await page.evaluate(() => window.helixHeresyDebug.reserveMunicipalCarrier())).toBe(true);
  await page.evaluate(() => { const d = window.helixHeresyDebug, s = d.surveyExpeditionSnapshot(), j = d.strategicJourneysSnapshot().journeys.find(j => j.id === s.carrier.journeyId); d.advanceSimulation(j.exactArrivalAt - s.clock + 1); });
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finish(page); await municipalTravel(page);
  await passengerLeg(page, true);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('walk'))).toBe(true); await finish(page);
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('review', d.foreignReceptionSnapshot().quote); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(180));
  expect(await page.evaluate(() => { const d = window.helixHeresyDebug; return d.foreignReceptionAction('accept', d.foreignReceptionSnapshot().gate.visitorAdmission.offers[0]); })).toBe(true);
  await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(60));
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('enter'))).toBe(true); await finish(page);
  await page.getByRole('button', { name: 'Walk to Visitor Provisions Counter', exact: true }).click(); await finish(page);
  const snap = () => page.evaluate(() => window.helixHeresyDebug.foreignSuppliesSnapshot('assayReagent', 3));
  await expect(page.locator('[data-foreign-ask-chart="assayReagent"]')).toHaveAttribute('aria-label', /No unseen price history/);
  await page.getByLabel('Assay Reagent purchase quantity').selectOption('3'); const before = await snap(); expect(before.quote.section).toBe('resources');
  await page.getByRole('button', { name: 'Buy Assay Reagent at Exact Quoted Total', exact: true }).click();
  const paid = await snap(); expect(paid.money).toBe(before.money - before.quote.total); expect(paid.market.listings.assayReagent.supply).toBe(before.quote.stock - 3);
  expect(paid.carried.some(i => i.key === 'assayReagent')).toBe(false); expect(paid.supplier.orders[0].delivered).toBe(0);
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(240, true));
  const partial = await snap(); expect(partial.supplier.orders[0].delivered).toBe(1);
  const carried = partial.carried.find(i => i.key === 'assayReagent'); expect(carried.section).toBe('resources'); expect(carried.sourceLabels).toContain(paid.supplier.orders[0].id);
  expect(await page.evaluate(id => window.helixHeresyDebug.unloadForeignLabInput(id, 'any'), carried.id)).toBe(false);
  await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
  await page.evaluate(() => window.helixHeresyDebug.advanceForeignReceptionTestTime(120));
  const received = await snap(); expect(received.supplier.orders[0].status).toBe('received'); expect(received.money).toBe(paid.money);
  expect(received.carried.filter(i => i.key === 'assayReagent').reduce((n, i) => n + i.quantity, 0)).toBe(3);
  expect(await page.evaluate(() => window.helixHeresyDebug.foreignReceptionAction('exit'))).toBe(true); await finish(page);
  await passengerLeg(page, false);
  expect(await page.evaluate(() => window.helixHeresyDebug.boardSurveyVehicle())).toBe(true); await finish(page); await municipalTravel(page);
  const home = () => page.evaluate(() => window.helixHeresyDebug.foreignLabUnloadingSnapshot());
  expect((await home()).context.atLab).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.startDiagnosticSampleAssay(id), sample.stackId)).toBe(false);
  const lots = (await home()).lots, destination = (await home()).destinations.find(d => renderer === 'canvas' ? d.fixtureId : !d.fixtureId); expect(destination).toBeTruthy();
  const panel = page.locator('[data-foreign-lab-unloading]'); await panel.getByLabel('Imported reagent home storage').selectOption(destination.id);
  await panel.getByRole('button', { name: `Walk to Storage and Unload ${lots[0].id}`, exact: true }).click();
  const reserved = (await home()).tasks[0]; expect(reserved.reason).toBe(''); expect((await home()).receipts).toHaveLength(0);
  // Change real saved facts while the original task is pending; no guard may move goods or issue a receipt.
  const interruptions = await page.evaluate(({ stackId, fixtureId, stockpileId }) => {
    const d = window.helixHeresyDebug, original = d.exportSurveyExpeditionTestState(), results = [];
    for (const guard of ['body', 'claim', 'receipt', 'dimensions', 'broken', 'full']) {
      const s = JSON.parse(JSON.stringify(original)), item = s.physicalItemStacks.find(i => i.id === stackId);
      if (guard === 'body') s.scientistIdentity.bodyEpoch++;
      if (guard === 'claim') item.cityOwnerId = 'b';
      if (guard === 'receipt') item.sourceLabels = [];
      if (guard === 'dimensions') item.unitMassKg++;
      if (guard === 'broken') {
        if (fixtureId) s.fixtures.find(f => f.id === fixtureId).condition = 0;
        else s.stockpileDesignations.find(p => p.id === stockpileId).cells = [];
      }
      if (guard === 'full') {
        if (fixtureId) {
          const stored = s.physicalItemStacks.find(i => !i.carriedBy && i.fixtureId);
          if (!stored) throw new Error('Capacity guard requires an existing physical storage lot');
          stored.fixtureId = fixtureId; stored.unitMassKg = 10000;
        } else s.stockpileDesignations.find(p => p.id === stockpileId).allowFloorStorage = false;
      }
      d.importSurveyExpeditionTestState(s);
      const before = d.foreignLabUnloadingSnapshot(); d.advanceSimulation(1);
      const after = d.foreignLabUnloadingSnapshot(), actual = d.physicalStockSnapshot().stacks.find(i => i.id === stackId);
      results.push({ guard, reason: before.tasks[0]?.reason, received: after.receipts.length, carriedBy: actual?.carriedBy });
    }
    d.importSurveyExpeditionTestState(original); return results;
  }, { stackId: lots[0].id, fixtureId: destination.fixtureId, stockpileId: destination.stockpileId });
  for (const r of interruptions) { expect(r.reason, r.guard).toBeTruthy(); expect(r.received, r.guard).toBe(0); expect(r.carriedBy, r.guard).toBe('scientist'); }
  await panel.getByRole('button', { name: `Cancel ${reserved.label}`, exact: true }).click(); expect((await home()).lots).toHaveLength(3);
  for (const lot of lots) {
    await panel.getByRole('button', { name: `Walk to Storage and Unload ${lot.id}`, exact: true }).click();
    if (lot.id === lots[0].id) {
      await page.evaluate(() => window.helixHeresyDebug.advanceSimulation(2));
      await page.evaluate(() => window.helixHeresyDebug.reloadSurveyExpeditionTestState());
    }
    await finish(page);
  }
  expect((await home()).receipts).toHaveLength(3); expect((await home()).lots).toHaveLength(0);
  const stored = await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks.filter(i => i.key === 'assayReagent'));
  expect(stored.every(i => i.fixtureId === destination.fixtureId && i.stockpileId === destination.stockpileId && !i.carriedBy)).toBe(true);
  expect(await page.evaluate(id => window.helixHeresyDebug.startDiagnosticSampleAssay(id), sample.stackId)).toBe(true); await finish(page);
  const after = await page.evaluate(() => window.helixHeresyDebug.physicalStockSnapshot().stacks.filter(i => i.key === 'assayReagent'));
  expect(after.reduce((n, i) => n + i.quantity, 0)).toBe(2);
  expect((await page.evaluate(() => window.helixHeresyDebug.resourceSurveySnapshot())).samples).toHaveLength(0);
  expect(await page.evaluate(() => window.helixHeresyDebug.exportSurveyExpeditionTestState().citySuccession)).toBeNull(); expect(errors).toEqual([]);
});
