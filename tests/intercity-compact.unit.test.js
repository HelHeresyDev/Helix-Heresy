const { test } = require('node:test');
const assert = require('node:assert/strict');
const Compact = require('../intercity-compact');
const Production = require('../local-market-production');
const Bargains = require('../sovereign-bargains');
const Trade = require('../intercity-trade');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'b', homeId: 'a', charterId: 'charter:b', authorityId: 'ruler:b', institutionId: 'defense:b',
    depotId: 'defense:b:maintenance-receiving', populationSourceId: 'population:b', routeId: 'route:ab', originalCondition: 80, requiredParts: 6 };
  const b = Bargains.create({ cityId: 'b', charterId: 'charter:b', authority: { id: 'ruler:b', name: 'B Council', kind: 'collective' },
    administrationId: 'admin:b', defenseId: 'defense:b', populationSourceId: 'population:b', defenseName: 'B Ward Office',
    archive: { coverage: [{ cellId: 'one' }] } }, { id: 'office:b', cityId: 'b', institutionId: 'admin:b' });
  const g = { id: 'gate:b', cityId: 'b', materialized: true, foreignCivic: { bargain: b, accessJob: null },
    clerk: { id: 'clerk:b', status: 'alive', health: 100 }, receptionWorkSeconds: 14400, powerSeconds: 86400, receptionAssignment: null };
  const market = { id: 'b', treasury: 1000, listings: { metalParts: { supply: 2, demand: 1 }, assayReagent: { supply: 4, demand: 1 } },
    production: Production.create({ cityId: 'b', manufacturingFacilities: [{ id: 'works:b', kind: 'chemicalWorks', condition: 95,
      labour: 1, utilities: 1, routeOpen: true, expertise: ['chemicalProcessing'] }] }, 0) };
  market.production.workshops.find(w => w.id === 'assayReagent').stock = 4;
  const c = { alive: true, capable: true, originalBody: true, local: true, atDesk: true, lineOfSight: true,
    clerkPresent: true, participantsPresent: true, authorityCurrent: true, visitorPermit: true,
    worldId: 'world', runId: 'run', source: copy(source), bodyEpoch: 0, routeOpen: true, reagentAsk: 20, partsAsk: 10, bans: [] };
  const s = Compact.create(source, g, { worldId: 'world', runId: 'run' }, 0); g.intercityCompact = s;
  const stacks = [{ id: 'original-parts', section: 'resources', key: 'metalParts', quantity: 6, carriedBy: 'scientist' }];
  const h = { stacks: () => stacks,
    stage: (r, receipt) => { const i = { id: `${r.id}:original-reagent`, section: 'resources', key: receipt.cargo, quantity: receipt.quantity,
      unitMassKg: .5, unitVolumeL: .5, sourceLabels: [s.id, r.id, s.source.cityId] }; stacks.push(i); return i; },
    collect: r => { const i = stacks.find(i => i.id === r.stackId); if (!i) return false; i.carriedBy = 'scientist'; return true; } };
  const supplier = { routeOpen: true, fuelStockKm: 0, partsStock: 0, operatingFuelKm: 0, vehicle: { condition: 100 } };
  return { s, source, g, b, market, c, stacks, h, supplier, at: 0 };
}
function tick(f, seconds, production = true) {
  f.at += seconds;
  if (production) Production.advance(f.market.production, f.at, f.market.listings, f.supplier);
  Compact.advance(f.s, f.g, f.market, () => f.c, f.at, f.h);
}
function negotiate(f) { assert.equal(Compact.propose(f.s, f.g, f.market, f.c, f.at), true); tick(f, Compact.WORK); }
function sign(f) { negotiate(f); assert.equal(Compact.sign(f.s, f.g, f.market, f.c, copy(f.s.offer), f.at), true); tick(f, 60); assert.equal(f.s.status, 'active'); }
function supply(f) { assert.equal(Compact.supply(f.s, f.g, f.c, f.stacks, f.at), true); tick(f, Compact.WORK); }
function report(f) { return Compact.receive(f.s, f.g, f.c, f.at); }
test('original source binds distinct cities, original authorized people, depot and run; no new officials or politics', () => {
  const f = fixture(); assert.ok(f.s); assert.equal(f.s.representativeId, f.b.representative.id); assert.equal(f.s.defenderId, f.b.defender.id);
  for (const change of [s => s.homeId = 'b', s => s.originalCondition = 100, s => s.requiredParts = 99, s => s.charterId = 'other']) {
    const source = copy(f.source); change(source); assert.equal(Compact.create(source, f.g, { worldId: 'w', runId: 'r' }, 0), null);
  }
  assert.equal(Compact.normalize(null), null); assert.match(Compact.SCOPE, /no map.*political submission/);
});
test('a source-backed need and actual alternatives, factory stock, treasury, prices and freight determine refusal', () => {
  for (const change of [f => f.market.listings.metalParts.supply = 6, f => f.market.production.workshops.find(w => w.id === 'assayReagent').stock = 3,
    f => f.market.treasury = 2, f => f.market.production.facilities[0].condition = 0,
    f => f.market.production.facilities[0].routeOpen = false, f => f.c.routeOpen = false,
    f => f.c.reagentAsk = 1000, f => f.market.production.trucks.forEach(t => t.driver.health = 0),
    f => f.b.depot.stock = 3, f => f.b.audience = { status: 'queued' }]) {
    const f = fixture(); change(f); const before = copy(f.market);
    assert.equal(Compact.propose(f.s, f.g, f.market, f.c, 0), false); assert.ok(f.s.refusal); assert.deepEqual(f.market, before);
  }
});
test('world adapter requires actual sovereign political/civic backing, worn defenses and a distinct direct connection', () => {
  const f = fixture();
  const map = { strategicPlayableSettlementState: { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100,
    physicalJurisdictionExists: true, physicalCondition: 'intact', services: { fortifications: 'functional' } }] },
    cityGovernments: { governments: [{ cityId: 'b', charter: { id: 'charter:b' }, roleAssignments: { militaryDefenseCommand: 'defense:b' }, institutions: [{ id: 'defense:b' }] }] },
    strategicCivicHistory: { currentInstitutionRows: [{ institutionId: 'defense:b', operationalStatus: 'operational', actualControlStatus: 'localCharter' }] },
    cityPolities: { polities: [{ cityId: 'b', authority: { id: 'ruler:b' } }] },
    strategicPoliticalHistory: { currentControlRows: [{ cityId: 'b', recognizedAuthorityId: 'ruler:b', controlStatus: 'sovereign' }] },
    routeGraph: { routes: [{ id: 'route:ab', endpointIds: ['a', 'b'] }] } };
  const before = copy(map); assert.deepEqual(Compact.sourceFromWorld(map, f.g, 'a'), { ...f.source,
    provenance: 'Existing worn fortifications and original unfilled municipal ward-maintenance requisition, not a new disaster or replacement installation.' });
  assert.deepEqual(map, before); assert.equal(Compact.sourceFromWorld(map, f.g, 'b'), null);
  for (const change of [m => m.strategicPoliticalHistory.currentControlRows[0].controlStatus = 'occupied',
    m => m.cityPolities.polities[0].authority.id = 'other', m => m.routeGraph.routes = [],
    m => m.strategicPlayableSettlementState.cityRows[0].services.fortifications = 'strong']) {
    const bad = copy(map); change(bad); assert.equal(Compact.sourceFromWorld(bad, f.g, 'a'), null);
  }
  const op = { route: { supportCapable: true, continuity: 'continuous', endpointCityIds: ['a', 'b'] },
    permit: { approvals: [{ cityId: 'a', allowed: true }, { cityId: 'b', allowed: true }] } };
  assert.equal(Trade.access(op), true); op.permit.approvals[1].allowed = false; assert.equal(Trade.access(op), false);
});
test('no offer from a remote clerk, different authority/body/run, bans, custody, unavailable originals or another shared job', () => {
  for (const change of [f => f.c.local = false, f => f.c.atDesk = false, f => f.c.authorityCurrent = false,
    f => f.c.source.authorityId = 'other', f => f.c.runId = 'new', f => f.c.visitorPermit = false,
    f => f.c.originalBody = false, f => f.c.custodyActive = true, f => f.c.bans = [{ status: 'active' }],
    f => f.g.receptionAssignment = 'other', f => f.b.representative.health = 0]) {
    const f = fixture(); change(f); assert.equal(Compact.propose(f.s, f.g, f.market, f.c, 0), false);
  }
});
test('two attended stages share existing people and queues; only completed exact signature procures finite private output', () => {
  const f = fixture(), initialTreasury = f.market.treasury, finance = f.market.production.finance.money;
  negotiate(f); assert.equal(f.s.cityStock, 0); assert.equal(f.market.treasury, initialTreasury);
  assert.equal(Compact.sign(f.s, f.g, f.market, f.c, { ...f.s.offer, inputQuantity: 1 }, f.at), false);
  assert.equal(Compact.sign(f.s, f.g, f.market, f.c, f.s.offer, f.at), true); tick(f, 30);
  assert.equal(f.s.terms, null); f.s = Compact.normalize(f.s); f.g.intercityCompact = f.s; tick(f, 30);
  assert.equal(f.s.cityStock, 2); assert.equal(f.market.treasury, initialTreasury - 56);
  assert.equal(f.market.production.finance.money, finance + 40);
  assert.equal(f.market.production.workshops.find(w => w.id === 'assayReagent').stock, 2);
  assert.equal(f.s.freightEscrow, 16); assert.equal(f.g.receptionAssignment, null); assert.equal(f.b.representative.assignment, null);
  assert.equal(Bargains.canRequest(f.b), false); assert.equal(f.b.copies.length, 0);
});
test('changed factory, alternatives, stock or terms at signature completion cannot spend funds or create rights', () => {
  for (const change of [f => f.market.production.facilities[0].condition = 0,
    f => f.market.production.workshops.find(w => w.id === 'assayReagent').stock = 0,
    f => f.market.listings.metalParts.supply = 10, f => f.c.reagentAsk = 21]) {
    const f = fixture(); negotiate(f); assert.equal(Compact.sign(f.s, f.g, f.market, f.c, f.s.offer, f.at), true);
    change(f); tick(f, 60); assert.equal(f.s.terms, null); assert.equal(f.market.treasury, 1000);
  }
});
test('original carried inputs are reserved until real completion, consumed once and never counted in the old map bargain', () => {
  const f = fixture(); sign(f); assert.equal(Compact.supply(f.s, f.g, f.c, f.stacks, f.at), true);
  tick(f, 60); assert.equal(f.stacks[0].quantity, 6); assert.ok(f.stacks[0].reservedTaskId);
  f.s = Compact.normalize(f.s); f.g.intercityCompact = f.s; tick(f, 60);
  assert.equal(f.stacks[0].quantity, 3); assert.equal(f.stacks[0].reservedTaskId, ''); assert.equal(f.s.preparedFittings, 1);
  assert.equal(f.b.depot.compactConsumed, 3); assert.equal(f.b.depot.stock, 0); assert.equal(f.s.cityStock, 1);
  assert.ok(f.s.cycles[0].shipmentId); assert.equal(f.s.cycles[0].stackId, undefined);
  assert.equal(f.market.production.trucks[0].fuelKm, 232); assert.equal(f.s.freightEscrow, 8);
});
test('foreign, contaminated, reserved or changed lots and interrupted attendance cannot install free supplies', () => {
  for (const change of [i => i.cityOwnerId = 'a', i => i.civicCustody = {}, i => i.carriedBy = '',
    i => i.reservedTaskId = 'other', i => i.tags = ['contaminated']]) {
    const f = fixture(); sign(f); change(f.stacks[0]); assert.equal(Compact.supply(f.s, f.g, f.c, f.stacks, f.at), false);
  }
  const f = fixture(); sign(f); Compact.supply(f.s, f.g, f.c, f.stacks, f.at); tick(f, 60);
  f.c.atDesk = false; tick(f, 60); assert.equal(f.s.job, null); assert.equal(f.stacks[0].quantity, 6);
  assert.equal(f.s.preparedFittings, 0); assert.equal(f.stacks[0].reservedTaskId, '');
});
test('existing producer freight makes actual delivery, preserves provenance and shares the same unavailable crew', () => {
  const f = fixture(); sign(f); supply(f);
  const sh = f.market.production.shipments.find(sh => sh.id === f.s.cycles[0].shipmentId);
  assert.equal(sh.destination.propertyId, f.source.depotId); assert.equal(sh.compactId, f.s.id);
  f.market.production.trucks[0].driver.health = 0; tick(f, 3700); assert.equal(f.s.cycles[0].stackId, undefined);
  const arrival = sh.arriveAt; assert.ok(arrival > 3600); f.market.production.trucks[0].driver.health = 100;
  tick(f, 7400); assert.ok(f.s.cycles[0].stackId); const id = f.s.cycles[0].stackId;
  assert.equal(f.stacks.find(i => i.id === id).carriedBy, undefined);
  assert.equal(f.market.production.serviceDepot[sh.id], undefined);
  tick(f, 60); assert.equal(f.stacks.filter(i => i.id === id).length, 1);
});
test('contamination of the exact reserved lot interrupts unfinished fitting preparation without consuming the original goods', () => {
  const f = fixture(); sign(f); Compact.supply(f.s, f.g, f.c, f.stacks, f.at); tick(f, 60);
  f.stacks[0].tags = ['contaminated']; tick(f, 60);
  assert.equal(f.s.job, null); assert.equal(f.stacks[0].quantity, 6); assert.equal(f.s.preparedFittings, 0);
  assert.equal(f.stacks[0].reservedTaskId, '');
});
test('completed arrangements retain exact earned property and collection after visitor-hall expiry', () => {
  const f = fixture(); sign(f); supply(f); tick(f, 7200); supply(f); tick(f, 7200);
  assert.equal(f.s.status, 'completed'); assert.equal(f.s.preparedFittings, 2); assert.equal(f.stacks[0].quantity, 0);
  f.c.visitorPermit = false; assert.equal(Compact.collect(f.s, f.g, f.c, f.s.cycles[0].id, f.at), true); tick(f, 30);
  assert.equal(f.stacks.find(i => i.id === f.s.cycles[0].stackId).carriedBy, 'scientist');
  assert.equal(Compact.collect(f.s, f.g, f.c, f.s.cycles[0].id, f.at), false);
  assert.equal(report(f), true); assert.match(f.s.report.scope, /no map/);
});
test('early termination refunds only unused freight, preserves city purchases, earned debt and original cargo', () => {
  const f = fixture(); sign(f); supply(f); const treasury = f.market.treasury;
  assert.equal(Compact.terminate(f.s, f.g, f.market, f.c, f.at), true);
  assert.equal(f.market.treasury, treasury + 8); assert.equal(f.s.cityRetained, 1); assert.equal(f.s.freightEscrow, 0);
  assert.equal(f.s.cycles[0].titleOwner, 'scientist'); tick(f, 7200); assert.ok(f.s.cycles[0].stackId);
  assert.equal(Compact.supply(f.s, f.g, f.c, f.stacks, f.at), false);
  const money = f.market.treasury; assert.equal(Compact.terminate(f.s, f.g, f.market, f.c, f.at), false); assert.equal(f.market.treasury, money);
});
test('unfulfilled terms enter remedy and end without treating material obstruction as deliberate refusal or guilt', () => {
  const f = fixture(); sign(f); f.c.routeOpen = false;
  tick(f, Compact.DAY); assert.equal(f.s.status, 'cure'); assert.equal(f.s.cityStock, 2);
  tick(f, Compact.CURE); assert.equal(f.s.status, 'breached'); assert.equal(f.s.cityRetained, 2);
  assert.match(f.s.message, /Material route obstruction/); assert.equal(f.s.preparedFittings, 0);
  assert.equal(f.market.treasury, 960); // Factory purchase remains real; both unused freights returned.
});
test('an intercity closure cannot forbid handing over goods already physically carried at the original depot', () => {
  const f = fixture(); sign(f); f.c.routeOpen = false;
  supply(f); assert.equal(f.s.preparedFittings, 1); assert.equal(f.stacks[0].quantity, 3);
});
test('personal reports stay dated while absent; canonical completion cannot leak remote inventory or hidden motives', () => {
  const f = fixture(); sign(f); report(f); const reportBefore = copy(f.s.report);
  supply(f); f.c.local = false; tick(f, 7200); assert.ok(f.s.cycles[0].stackId);
  assert.deepEqual(f.s.report, reportBefore); assert.equal(report(f), false);
  f.c.local = true; assert.equal(report(f), true); assert.notEqual(f.s.report.at, reportBefore.at);
  for (const key of ['treasury', 'production', 'privateMotives', 'fuelKm', 'worldId']) assert.equal(f.s.report[key], undefined);
});
test('irreversible death freezes work and assets; new same-world runs cannot operate or adopt the old agreement', () => {
  const f = fixture(); sign(f); const before = copy(f.s); f.c.alive = false;
  tick(f, 3600, false); assert.deepEqual(f.s, before);
  f.c.alive = true; f.c.runId = 'another-run'; assert.equal(Compact.current(f.s, f.g, f.c), false);
  assert.equal(Compact.propose(f.s, f.g, f.market, f.c, f.at), false);
  const current = copy(f.s); tick(f, 3600, false); assert.deepEqual(f.s, current);
});
test('single-unit original earned import receipt rejects copied labels, uncollected or altered lots and preserves actual metrics', () => {
  const f = fixture(); sign(f); supply(f); tick(f, 7200); const r = f.s.cycles[0], item = f.stacks.find(i => i.id === r.stackId);
  assert.equal(Compact.inputReceipt(f.s, item), null);
  assert.equal(Compact.collect(f.s, f.g, f.c, r.id, f.at), true); tick(f, 30);
  assert.equal(Compact.inputReceipt(f.s, item).kind, 'compactReagent');
  for (const patch of [{ id: 'copy' }, { quantity: 2 }, { unitMassKg: 1 }, { sourceLabels: [] }, { key: 'metalParts' }])
    assert.equal(Compact.inputReceipt(f.s, { ...item, ...patch }), null);
});
test('city purchases, unused freight and prepared materials conserve across once-only termination', () => {
  const f = fixture(); sign(f); supply(f); tick(f, 7200); Compact.terminate(f.s, f.g, f.market, f.c, f.at);
  assert.equal(f.s.procurement.quantity, f.s.cityStock + f.s.cityRetained + f.s.cycles.filter(c => c.titleOwner === 'scientist').length);
  assert.equal(f.s.preparedFittings * 3 + f.stacks[0].quantity, 6);
  assert.equal(f.market.treasury + f.s.procurement.cost + f.market.production.finance.transportEarned + f.s.freightEscrow, 1000);
});
