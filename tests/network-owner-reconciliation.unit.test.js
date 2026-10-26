const { test } = require('node:test');
const assert = require('node:assert/strict');
const O = require('../network-owner-reconciliation');
const C = require('../network-capabilities');
const N = require('../network-operations');
const Passenger = require('../intercity-passenger');
const Mechanic = require('../passenger-maintenance');
const Carrier = require('../local-exchange-carrier');
const Porter = require('../field-porter');
const Escort = require('../foreign-expedition-escort');
const Workspace = require('../foreign-assay-workspace');
const Production = require('../local-market-production');
const Fuel = require('../municipal-fuel-service');
const { world } = require('./helpers/network-operating-source');
const copy = x => JSON.parse(JSON.stringify(x));
const binding = { worldId: 'w', runId: 'r' };
function fixture(consolidate = false) {
  const map = world(), h = map.strategicNonStateNetworkHistory;
  for (const [networkId, category, originCityId] of [['transport', 'transport', 'a'], ['research', 'research', 'b']])
    h.networkRows.push({ networkId, name: networkId, category, originCityId, organizationalContinuity: true, lifecycleStatus: 'active' });
  for (const [name, networkId, currentCityId] of [['carrier:a', 'transport', 'a'], ['mechanic:a', 'transport', 'a'], ['depot:b', 'transport', 'b'], ['lab:b', 'research', 'b']])
    h.branchRows.push({ ...h.branchRows[0], id: name, networkId, currentCityId,
      ...(consolidate && name === 'carrier:a' ? { consolidatedIntoBranchId: 'depot:b' } : {}) });
  const s = N.create(N.sources(map, 'fixed-owner-source'), binding, 0);
  const city = cityId => ({ cityId, assetId: `population:${cityId}`, currentPopulation: 100,
    physicalCondition: 'intact', services: { transport: 'functional' } });
  const entry = (id, category, networkId, cityId, organizationForm, roles = []) => ({ standing: 'licensed',
    network: { id: networkId, category, roles }, branch: { id, cityId, currentCityId: cityId, publicName: id,
      organizationForm, publicPhysicalPresence: true, operationalStatus: 'active', physicalCondition: 'intact', capacityBand: 'functional' } });
  const p = Passenger.create(city('a'), [entry('carrier:a', 'transport', 'transport', 'a', 'contractDepot')], 0);
  const fleet = Carrier.create('a'); Carrier.support(fleet, 0);
  fleet.support.passengerMaintenance = Mechanic.create(city('a'), [entry('mechanic:a', 'transport', 'transport', 'a', 'contractDepot')], 0);
  const e = { source: { cityId: 'b', populationSourceId: 'population:b' }, entry: { z: 21 }, roomId: 'ground',
    wilderness: { roomId: 'wild', gate: { x: 20, y: 12, z: 21 } } };
  e.porter = Porter.create(Porter.source(city('b'), [entry('depot:b', 'transport', 'transport', 'b', 'contractDepot', ['courierDispatch'])], e), e, 0);
  e.escort = Escort.create(Escort.source(city('b'), [entry('branch:b', 'military', 'original-network', 'b', 'escortChapter', ['escortContracting'])], e), e, 'seed', 0);
  const standings = [entry('lab:b', 'research', 'research', 'b', 'localLaboratory')];
  const authority = { cityId: 'b', currentAuthority: true, administrationId: 'admin:b' };
  const w = Workspace.create(city('b'), standings, authority, { cityName: 'B', representativeCell: { x: 9, y: 13, z: 21 } }, 'seed', 0, 'madcap');
  const run = { intercityPassenger: p, economy: { exchangeCarrier: fleet },
    penalFlights: { assistance: { cityApproach: { gates: [{ cityId: 'b', foreignSurvey: e, foreignWorkspace: w }] } } },
    fixtures: [{ id: w.benchId, condition: 100 }], physicalItemStacks: [] };
  const refresh = () => O.reconcile(s.capabilityAccounting, s, run, binding);
  const views = () => s.source.networks.map(n => C.assess(s.capabilityAccounting, s, n.id));
  return { s, run, p, fleet, e, w, refresh, views, city, standings, authority };
}
const ownerAssets = f => f.views().flatMap(v => v.ownerAccount.assets);
const record = (f, id) => f.s.capabilityAccounting.ownerReconciliation.records.find(r => r.assetId === id);
test('all five real owner models reconcile without allocating people, property, work, money or command', () => {
  const f = fixture(), original = copy(f.run), accounts = copy(f.s.accounts);
  assert.ok(f.p && f.e.porter && f.e.escort && f.w && f.fleet.support.passengerMaintenance);
  assert.equal(f.refresh(), true); assert.deepEqual(f.run, original); assert.deepEqual(f.s.accounts, accounts);
  const assets = ownerAssets(f); assert.equal(assets.length, 9);
  assert.ok(assets.every(r => r.state === 'linked'));
  assert.equal(assets.find(r => r.kind === 'mechanic.actor').owner.branchId, 'mechanic:a');
  assert.equal(assets.find(r => r.kind === 'passenger.vehicle').owner.branchId, 'carrier:a');
  assert.ok(f.views().every(v => !v.strategicComplete && v.state === 'unverified'));
  assert.ok(f.s.accounts.every(a => !a.mandate && !a.mandates && a.money === a.initialMoney));
  const once = copy(f.s); f.refresh(); assert.deepEqual(f.s, once);
  assert.doesNotMatch(JSON.stringify(f.s.capabilityAccounting.ownerReconciliation), /"(?:money|health|condition|fuelKm|workSeconds|depositHeld|escrowCents)":/);
});
test('consolidated lineages and saved aliases reference one original asset, not extra vehicles or hosts', () => {
  const f = fixture(true); f.run.passengerConnection = { otherCarrier: copy(f.p) };
  f.p.location = 'b'; f.run.passengerConnection.otherCarrier.location = 'b'; f.refresh();
  const v = O.view(f.s.capabilityAccounting, f.s, 'transport');
  assert.equal(v.assets.filter(r => r.assetId === f.p.vehicle.id).length, 1);
  const ref = v.references.find(r => r.assetId === f.p.vehicle.id);
  assert.equal(ref.accountId, 'depot:b'); assert.deepEqual(ref.branchIds, ['carrier:a']);
  assert.equal(ref.owner.cityId, 'a'); assert.equal(record(f, f.p.vehicle.id).locations.length, 2);
  const saved = N.normalize(copy(f.s)); assert.deepEqual(O.view(saved.capabilityAccounting, saved, 'transport'), v);
});
test('conflicting aliases, changed source parents and replacement identities remain explicit, sticky gaps', () => {
  for (const change of [f => { f.run.passengerConnection = { otherCarrier: copy(f.p) }; f.run.passengerConnection.otherCarrier.vehicle.fuelKm--; },
    f => f.p.source.populationId = 'other-population', f => f.p.source.networkId = 'other-network',
    f => f.p.vehicle.id = 'replacement-car']) {
    const f = fixture(); f.refresh(); const id = f.p.vehicle.id, before = copy(f.s.accounts); change(f); f.refresh();
    assert.notEqual(record(f, id).state, 'linked'); assert.deepEqual(f.s.accounts, before);
    assert.equal(O.view(f.s.capabilityAccounting, f.s, 'transport').references.some(r => r.assetId === id), false);
    if (f.run.passengerConnection) { delete f.run.passengerConnection; f.refresh(); assert.equal(record(f, id).state, 'conflict'); }
  }
});
test('missing objects, fixtures, saved records or initialized books never heal or regenerate owner resources', () => {
  for (const change of [f => delete f.run.intercityPassenger, f => delete f.p.vehicle,
    f => f.s.capabilityAccounting.ownerReconciliation.records.splice(1, 1)]) {
    const f = fixture(); f.refresh(); const id = f.p.vehicle.id, original = copy(f.run); change(f); f.refresh();
    assert.notEqual(record(f, id).state, 'linked'); f.run.intercityPassenger = original.intercityPassenger; f.refresh();
    assert.notEqual(record(f, id).state, 'linked'); assert.equal(N.host(f.s, 'carrier:a').money, 240);
  }
  const f = fixture(); f.refresh(); f.run.fixtures = []; f.refresh(); assert.equal(record(f, f.w.benchId).state, 'missingOwnerObject');
  f.s.capabilityAccounting.ownerReconciliation = null; f.refresh();
  assert.equal(O.view(f.s.capabilityAccounting, f.s, 'transport').state, 'missingAccounting');
  assert.equal(f.s.capabilityAccounting.ownerReconciliation.invalid, true);
});
test('actual repair payments and workspace rent/deposit remain solely in original owner ledgers', () => {
  const f = fixture(), wallet = { money: 1000 }; f.p.vehicle.condition = 65;
  const c = { local: true, atStand: true, sameBody: true, alive: true, capable: true, free: true, busy: false,
    sourceCurrent: true, bodyEpoch: 0, distanceKm: 4, stand: { roomId: 'stand', cell: { x: 1, y: 1, z: 6 } } };
  const q = Mechanic.quote(f.p, f.fleet.support, c, 0); assert.ok(q);
  assert.equal(Mechanic.request(f.p, f.fleet.support, c, q, wallet, 0), true);
  const wc = { city: f.city('b'), standings: f.standings, authority: f.authority, alive: true, capable: true,
    originalBody: true, custody: false, local: true, cityId: 'b', bodyEpoch: 0, visitId: 'visit', tenant: 'Mira',
    atProperty: true, atDesk: true, contact: true, busy: false,
    visitorPermit: { cityId: 'b', bodyEpoch: 0, visitId: 'visit', issuedAt: 0, expiresAt: 21600, scope: 'visitorHallOnly' } };
  assert.equal(Workspace.invite(f.w, wc, 100), true);
  const leaseQuote = Workspace.request(f.w, wc, 100); assert.equal(Workspace.sign(f.w, wc, leaseQuote, wallet, 100).ok, true);
  const run = copy(f.run), accounts = copy(f.s.accounts), cash = wallet.money;
  for (let i = 0; i < 3; i++) f.refresh();
  assert.deepEqual(f.run, run); assert.deepEqual(f.s.accounts, accounts); assert.equal(wallet.money, cash);
  assert.equal(f.fleet.support.passengerMaintenance.job.escrowCents, 2000); assert.equal(f.w.lease.depositHeld, 150);
  const commitments = f.views().flatMap(v => v.ownerAccount.commitments);
  assert.ok(commitments.some(c => c.kind === 'job')); assert.ok(commitments.some(c => c.kind === 'lease'));
});
test('wounds, dead workers, spent fuel and broken benches are references, not readiness certificates or refreshed copies', () => {
  const f = fixture(); f.refresh(); f.p.vehicle.fuelKm = 0; f.p.driver.health = 0;
  f.e.porter.actor.status = 'dead'; f.e.escort.actor.health = 9; f.run.fixtures[0].condition = 0;
  const original = copy(f.run); f.refresh(); assert.deepEqual(f.run, original);
  assert.ok(ownerAssets(f).every(r => r.state === 'linked'));
  assert.ok(f.views().every(v => v.strategicComplete === false));
});
test('original escort kit is linked to actual stacks; porter cargo and workspace tenant belongings prove custody only', () => {
  const f = fixture(), e = f.e.escort;
  f.run.physicalItemStacks.push({ id: 'original-worn-vest', carriedBy: e.actor.id, condition: 8 },
    { id: 'borrowed-tool', carriedBy: f.e.porter.actor.id }, { id: 'tenant-sample', roomId: f.w.roomId });
  e.gearCondition['original-worn-vest'] = 8; f.refresh();
  assert.equal(record(f, 'original-worn-vest').state, 'linked');
  assert.deepEqual(record(f, 'original-worn-vest').custodianIds, [e.actor.id]);
  assert.equal(record(f, 'borrowed-tool'), undefined); assert.equal(record(f, 'tenant-sample'), undefined);
  const b = O.view(f.s.capabilityAccounting, f.s, 'research').boundaries;
  assert.ok(b.some(r => r.assetId === 'tenant-sample' && r.ownerKind === 'custodyOnly'));
  f.run.physicalItemStacks.push({ ...f.run.physicalItemStacks[0], condition: 100 }); f.refresh();
  assert.equal(record(f, 'original-worn-vest').state, 'conflict');
});
test('shared independent producer is resolved once across real broker registrations; allocation IDs cannot replace missing trucks', () => {
  const f = fixture(), p = Production.create({ cityId: 'b', manufacturingFacilities: [{ id: 'crystal-works:b', kind: 'crystalWorks', condition: 100,
    labour: 1, utilities: 1, routeOpen: true, expertise: ['crystalPreparation'] }] }, 0);
  f.run.economy.commodityMarket = { localProduction: p };
  const rows = [['branch:b', 'original-network'], ['depot:b', 'transport']].map(([branchId, networkId]) => ({ id: `${branchId}:local-power-fuel`, branchId,
    networkId, cityId: 'b', populationSourceId: 'population:b', powerId: 'power:b', facilityId: p.facilities[0].id, label: branchId }));
  const rule = { ...binding, id: 'rule:b', source: { cityId: 'b', populationSourceId: 'population:b', powerId: 'power:b' }, handoverId: 'handover' };
  const service = Fuel.create(rows, rule, 0, p); assert.ok(service); Fuel.register(service, f.s, p);
  f.refresh(); const v = O.view(f.s.capabilityAccounting, f.s, 'original-network');
  const ref = v.references.find(r => r.assetId === p.trucks[0].id); assert.ok(ref);
  assert.deepEqual(ref.branchIds, ['branch:b']); assert.equal(ref.owner.kind, 'independentProducer');
  assert.deepEqual(O.view(f.s.capabilityAccounting, f.s, 'transport').references.find(r => r.assetId === p.trucks[0].id).branchIds, ['depot:b']);
  assert.equal(f.s.capabilityAccounting.ownerReconciliation.originals.filter(r => r.assetId === p.trucks[0].id).length, 1);
  assert.equal(v.assets.filter(r => r.assetId === p.trucks[0].id).length, 1);
  assert.equal(v.references.filter(r => r.assetId === p.trucks[0].id).length, 1);
  p.trucks.splice(0, 1); f.refresh();
  assert.equal(C.references(f.s, 'original-network').some(r => r.assetId === ref.assetId), false);
});
test('municipal generic branchIds, licensed fleets, broker sponsorship and contact aircraft do not establish network title', () => {
  const f = fixture(); f.w.municipalAssay = { source: { branchId: 'lab:b' }, money: 77 };
  f.run.economy.localCovertMarket = { couriers: [{ id: 'courier' }] };
  f.run.economy.intercitySmuggling = { paymentProviders: [{ id: 'escrow' }] };
  f.run.penalFlights.assistance.services = [{ aircraft: { id: 'aircraft', ownerId: 'contact' } }];
  f.refresh(); const v = O.view(f.s.capabilityAccounting, f.s, 'research');
  for (const fragment of ['municipalAssay', 'localCovertMarket', 'intercitySmuggling', 'assistance.services'])
    assert.ok(v.boundaries.some(r => r.location.includes(fragment)));
  assert.ok(!ownerAssets(f).some(a => ['aircraft', 'courier', 'escrow'].includes(a.assetId)));
  delete f.w.source.populationId; f.refresh(); assert.notEqual(record(f, f.w.property.id).state, 'linked');
});
test('legacy migration, save/copy rebinding, independent runs, public accounts and final death stay isolated', () => {
  const f = fixture(), publicBefore = N.publicView(f.s), statement = C.statement(f.s, N.host(f.s, 'branch:b'));
  f.p.vehicle.fuelKm = 11; f.refresh();
  const saved = N.normalize(f.s), next = N.rebind(saved, binding, { worldId: 'copy-w', runId: 'copy-r' });
  assert.equal(next.capabilityAccounting.ownerReconciliation.runId, 'copy-r');
  assert.equal(O.reconcile(next.capabilityAccounting, next, f.run, binding), false);
  assert.equal(O.reconcile(next.capabilityAccounting, next, f.run, next), true);
  assert.deepEqual(N.publicView(f.s), publicBefore); assert.deepEqual(C.statement(f.s, N.host(f.s, 'branch:b')), statement);
  const frozen = copy(f.s); f.p.vehicle.fuelKm = 0; assert.equal(O.reconcile(f.s.capabilityAccounting, f.s, f.run, binding, false), false);
  assert.deepEqual(f.s, frozen);
  const independent = N.create(f.s.source, { worldId: 'w', runId: 'new' }, 0);
  O.reconcile(independent.capabilityAccounting, independent, {}, independent);
  assert.deepEqual(independent.capabilityAccounting.ownerReconciliation.originals, []);
  const corrupt = copy(f.s); corrupt.capabilityAccounting.ownerReconciliation.records.push(copy(corrupt.capabilityAccounting.ownerReconciliation.records[0]));
  assert.equal(N.normalize(corrupt).capabilityAccounting.ownerReconciliation.invalid, true);
});
test('wrong city/category/population, lost original source and different run frames cannot supply attribution', () => {
  for (const change of [f => f.p.homeCityId = 'b', f => delete f.p.source.populationId,
    f => f.s.source.branches.find(b => b.id === 'carrier:a').category = 'military',
    f => f.s.capabilityAccounting.records.find(r => r.id === 'branch:carrier:a').lost = true]) {
    const f = fixture(); change(f); f.refresh();
    assert.equal(record(f, f.p.vehicle.id).state, 'unknownAttribution');
    assert.equal(C.references(f.s, 'transport').some(r => r.assetId === f.p.vehicle.id), false);
  }
  for (const frame of [{ worldReference: { worldId: 'other' } }, { runIdentity: { runId: 'other' } }]) {
    const f = fixture(), before = copy(f.s); Object.assign(f.run, frame);
    assert.equal(f.refresh(), false); assert.deepEqual(f.s, before);
  }
});
test('missing office accounting cannot erase actual branch property or fabricate a replacement working account', () => {
  const f = fixture(); f.refresh(); f.s.accounts.find(a => a.id === 'carrier:a').lost = true; f.refresh();
  const ref = O.view(f.s.capabilityAccounting, f.s, 'transport').references.find(r => r.assetId === f.p.vehicle.id);
  assert.equal(ref.owner.branchId, 'carrier:a'); assert.equal(ref.accountId, null); assert.deepEqual(ref.accountIds, []);
  assert.equal(record(f, f.p.vehicle.id).state, 'linked'); assert.ok(f.s.accounts.find(a => a.id === 'carrier:a').lost);
});
test('public workspace source stays unchanged and malformed/missing arrays do not create provider objects', () => {
  const f = fixture();
  assert.equal(f.w.source.populationId, 'population:b');
  assert.equal(Workspace.publicView(f.w, 0).source.populationId, undefined);
  const frame = { economy: { commodityMarket: { intercityTrade: { neighbors: {} } }, intercitySmuggling: {
    paymentProviders: [null, { id: 'original-settlement-office' }] } },
    penalFlights: { assistance: { cityApproach: { gates: [null] } } }, physicalItemStacks: {}, fixtures: {} };
  const original = copy(frame), refs = O.collect(frame);
  assert.deepEqual(frame, original); assert.deepEqual(refs.assets, []);
  assert.ok(refs.boundaries.some(r => r.ownerId === 'original-settlement-office'
    && r.location === 'economy.intercitySmuggling.paymentProviders[1]'));
  const unidentified = O.collect({ intercityPassenger: { label: 'Not proof of a parent' } });
  assert.deepEqual(unidentified.assets, []);
  assert.ok(unidentified.boundaries.some(r => r.location === 'intercityPassenger' && r.ownerKind === 'unknownAttribution'));
});
