const { test } = require('node:test');
const assert = require('node:assert/strict');
const I = require('../network-inventories');
const N = require('../network-operations');
const C = require('../network-capabilities');
const Passenger = require('../intercity-passenger');
const Mechanic = require('../passenger-maintenance');
const Porter = require('../field-porter');
const Escort = require('../foreign-expedition-escort');
const Workspace = require('../foreign-assay-workspace');
const Protection = require('../chapter-protection');
const Interdiction = require('../network-interdiction');
const Maintenance = require('../powerworks-maintenance');
const Standards = require('../powerworks-standards');
const Civic = require('../civic-communications');
const { fixture, world, Definitions, binding } = require('./helpers/institutional-inventory-source');
const copy = x => JSON.parse(JSON.stringify(x));
const selected = category => [Definitions.find(d => d.category === category)];
const asset = (f, id) => f.s.inventories.assets.find(a => a.id === id);
function serviceFixture(category) {
  const f = fixture(selected(category)), city = f.map.strategicPlayableSettlementState.cityRows[0], raw = f.map.strategicNonStateNetworkHistory.branchRows[0];
  const entry = { standing: 'licensed', network: { id: raw.networkId, category, roles: selected(category)[0].roles },
    branch: { ...raw, cityId: city.cityId, capacityBand: raw.currentCapacityBand } };
  const excursion = { source: { cityId: city.cityId, populationSourceId: city.assetId }, roomId: 'ground', entry: { z: 21 },
    wilderness: { roomId: 'wild', gate: { x: 20, y: 12, z: 21 } } };
  const rule = { ...binding, id: 'original-rule', source: { cityId: city.cityId, powerId: 'power:0', populationSourceId: city.assetId }, powerMaintenance: {} };
  return { ...f, city, entry, excursion, rule };
}
test('all 21 definitions and every original source kind receive seven explicit private family accounts with bounded real assets', () => {
  const f = fixture(), before = copy(f.map);
  assert.equal(f.s.inventories.owners.length, Definitions.length * 4);
  assert.deepEqual(f.map, before);
  for (const n of f.s.source.networks) {
    const v = I.assess(f.s, n.id);
    assert.equal(v.complete, true, JSON.stringify(v.sources)); assert.equal(v.sources.length, 4);
    assert.ok(v.sources.every(s => s.families.length === 7));
    assert.ok(v.sources.some(s => s.families.some(f => f.state === 'empty')));
    assert.equal(C.assess(f.s.capabilityAccounting, f.s, n.id).strategicComplete, false);
    const own = v.sources.filter(s => s.kind !== 'network').flatMap(s => s.families.flatMap(f => f.assetIds));
    assert.ok(v.assets.every(a => own.includes(a.id)));
  }
  assert.equal(new Set(f.s.inventories.assets.map(a => a.id)).size, f.s.inventories.assets.length);
  assert.ok(f.s.inventories.assets.some(a => a.kind === 'funds' && a.state.money === 1200));
  assert.ok(f.s.inventories.assets.some(a => a.kind === 'archive' && a.state.entries.length > 0));
  assert.ok(f.s.inventories.assets.filter(a => a.kind === 'access').every(a => !a.state.governmentAccess && !a.state.carrierRights && a.state.credential === null));
  assert.ok(f.s.accounts.every(a => a.money === a.initialMoney));
});
test('original allocation is fixed before conflict; capacity ratings, integrity and private hostility do not scale quantities', () => {
  const a = world(), b = copy(a);
  b.strategicNonStateNetworkHistory.networkRows.forEach(n => { n.actualCapacityBand = 'exceptional'; n.integrityBand = 'corrupt'; n.privatePriority = 'overthrowScientist'; });
  assert.deepEqual(N.sources(a, 'same').inventoryPlan, N.sources(b, 'same').inventoryPlan);
  const f = fixture(), original = copy(f.s.inventories);
  asset(f, 'branch:0:non-office-reserve').state.money = 0;
  N.sync(f.s); N.sync(f.s); assert.equal(asset(f, 'branch:0:non-office-reserve').state.money, 0);
  assert.equal(f.s.inventories.assets.length, original.assets.length);
});
test('all sources share finite original city people and premises budgets; unsupported allocation is a named gap, never an empty proof', () => {
  const f = fixture(Definitions, 16);
  assert.ok(f.source.inventoryPlan.budgets.every(b => b.usedPeople <= b.people && b.usedPremises <= b.premises));
  assert.ok(f.s.inventories.owners.some(o => o.gaps.some(g => g.includes('budget'))));
  for (const o of f.s.inventories.owners.filter(o => o.gaps.length))
    assert.ok(I.assess(f.s, o.networkId).sources.find(s => s.id === o.id).families.every(f => f.state === 'unverified'));
  assert.equal(f.s.inventories.assets.filter(a => a.kind === 'person').length,
    f.source.inventoryPlan.assets.reduce((n, a) => n + a.people, 0));
});
test('consolidated branches reference one physical host inventory without manufacturing a second reserve or transferring title', () => {
  const map = world(selected('transport')), h = map.strategicNonStateNetworkHistory;
  h.branchRows.push({ ...h.branchRows[0], id: 'old-lineage', consolidatedIntoBranchId: 'branch:0' });
  const s = N.create(N.sources(map, 'fixed'), binding, 0, { originalInventory: true });
  const v = I.assess(s, 'original:0'), old = v.sources.find(s => s.id === 'branch:old-lineage');
  assert.equal(old.sharedHost, 'branch:branch:0'); assert.ok(old.families.some(f => f.assetIds.includes('branch:0:passenger-road-car')));
  assert.equal(v.assets.filter(a => a.id === 'branch:0:passenger-road-car').length, 1);
  assert.ok(v.assets.filter(a => a.id.startsWith('branch:0:')).every(a => a.ownerId === 'branch:branch:0'));
});
test('passenger and callout mechanic materialize the exact original identities and remaining resources once', () => {
  const f = serviceFixture('transport');
  asset(f, 'branch:0:passenger-road-car').state.fuelKm = 19;
  asset(f, 'branch:0:callout-mechanic').state.health = 47;
  asset(f, 'branch:0:mechanic-toolkit').state.condition = 12;
  const p = Passenger.create(f.city, [f.entry], 0), m = Mechanic.create(f.city, [f.entry], 0);
  assert.equal(I.adopt(f.s, 'passenger', p, binding), p); assert.equal(p.vehicle.fuelKm, 19);
  assert.equal(I.adopt(f.s, 'mechanic', m, binding), m); assert.equal(m.actor.health, 47); assert.equal(m.toolkit.condition, 12);
  assert.equal(asset(f, p.vehicle.id).state, null); assert.equal(asset(f, p.vehicle.id).ledger, 'service');
  const original = copy(f.s), second = Passenger.create(f.city, [f.entry], 0);
  assert.equal(I.adopt(f.s, 'passenger', second, binding), null); assert.deepEqual(f.s, original);
  p.vehicle.fuelKm = 0;
  const run = { intercityPassenger: p, economy: { exchangeCarrier: { support: { passengerMaintenance: m } } } }, before = copy(run);
  I.observe(f.s, run, binding); assert.deepEqual(run, before); assert.equal(asset(f, p.vehicle.id).lost, false);
});
test('porters and survey professionals transfer finite duty and physical supplies rather than add another kit', () => {
  for (const [category, kind, Model] of [['transport', 'porter', Porter], ['military', 'escort', Escort]]) {
    const f = serviceFixture(category), source = Model.source(f.city, [f.entry], f.excursion);
    const m = kind === 'porter' ? Model.create(source, f.excursion, 0) : Model.create(source, f.excursion, 'seed', 0);
    assert.ok(m); assert.equal(I.adopt(f.s, kind, m, binding), m);
    const issued = I.takeSupplies(m, ['drinkingWater', 'trailMeal'], []);
    assert.deepEqual(issued, kind === 'porter' ? [['drinkingWater', 3], ['trailMeal', 2]] : [['drinkingWater', 4], ['trailMeal', 3]]);
    assert.deepEqual(I.takeSupplies(m, ['drinkingWater', 'trailMeal'], []), []);
    assert.equal(m.inventorySupplies.drinkingWater, 0);
    if (kind === 'escort') assert.deepEqual(I.takeSupplies(m, ['fieldShelter'], []), [['fieldShelter', 1]]);
  }
});
test('workspace property, actual fixture and representative reuse their original states without touching the rent/deposit ledger', () => {
  const f = serviceFixture('research'), authority = { cityId: f.city.cityId, currentAuthority: true, administrationId: 'admin' };
  const w = Workspace.create(f.city, [f.entry], authority, { cityName: 'Original City', representativeCell: { x: 9, y: 13, z: 21 } }, 'seed', 0, 'madcap');
  const bench = { id: w.benchId, condition: 100 }, money = copy(w.property.landlord);
  asset(f, bench.id).state.condition = 31;
  assert.equal(I.adopt(f.s, 'workspace', w, binding, bench), w); assert.equal(bench.condition, 31);
  assert.deepEqual(w.property.landlord, money); assert.equal(w.lease, null);
  assert.equal(I.adopt(f.s, 'workspace', Workspace.create(f.city, [f.entry], authority,
    { cityName: 'Original City', representativeCell: { x: 9, y: 13, z: 21 } }, 'seed', 0, 'madcap'), binding, bench), null);
});
test('original protection, field team, regulator specialist and metrologist claim their separate real service allocations', () => {
  const military = serviceFixture('military'), backing = Protection.source(military.city, [military.entry]);
  const client = { id: 'official', roomId: 'receiving', mapCell: { x: 3, y: 3, z: 21 } };
  const protection = Protection.create(backing, binding, { roomId: 'receiving', roomIds: ['receiving'],
    home: { x: 1, y: 1, z: 21 }, refuge: { x: 2, y: 2, z: 21 } }, client, { id: 'clerk' }, 'seed', 0);
  assert.ok(protection); assert.equal(I.adopt(military.s, 'protection', protection, binding), protection);
  const team = Interdiction.create(Interdiction.sources(military.map), binding, 'seed', 0); assert.equal(team.units.length, 1);
  assert.equal(I.adopt(military.s, 'interdiction', team, binding), team);
  assert.notEqual(protection.actor.id, team.units[0].actors[0].id);
  for (const [category, kind, Model] of [['research', 'maintenance', Maintenance], ['standards', 'standards', Standards]]) {
    const f = serviceFixture(category), rows = Model.sources(f.map, f.rule.source, Definitions);
    assert.equal(rows.length, 1); const m = Model.create(rows, f.rule, 0);
    assert.equal(I.adopt(f.s, kind, m, binding), m);
    assert.equal(m.providers[0].bench.workSeconds, 14400);
    if (kind === 'standards') assert.equal(m.providers[0].reviewer.qualification, rows[0].qualification);
  }
});
test('actual commissioned relay interface is narrow access, never ownership of the shared backbone', () => {
  const map = world(selected('media')), h = map.strategicNonStateNetworkHistory;
  h.branchRows[0].organizationForm = 'orbitalRelayGateway';
  h.eventRows.push({ kind: 'advancedServiceActivated', networkIds: ['original:0'], exactFactors: { capabilityId: 'orbitalArcaneRelayMesh' } });
  map.strategicCapabilityHistory.milestoneRows[0].infrastructureRows.push({ id: 'original-gateway', cityId: 'city:0', function: 'orbitalControlGateway', operationalAtPlayableYear: true });
  const s = N.create(N.sources(map, 'fixed'), binding, 0, { originalInventory: true });
  const rows = Civic.sources(map, Definitions), m = Civic.create(rows, binding, 0); assert.equal(rows.length, 1);
  assert.equal(I.adopt(s, 'communications', m, binding), m);
  assert.equal(s.inventories.assets.some(a => a.id === 'original-gateway'), false);
  assert.equal(I.assess(s, 'original:0').complete, false); // Wider exceptional means still unverified.
});
test('missing records, lost service owners and conflicting aliases cannot refill or silently heal resources', () => {
  const f = serviceFixture('transport'), p = Passenger.create(f.city, [f.entry], 0);
  I.adopt(f.s, 'passenger', p, binding); I.observe(f.s, { intercityPassenger: p }, binding);
  const id = p.vehicle.id; I.observe(f.s, {}, binding); assert.equal(asset(f, id).lost, true);
  assert.equal(I.adopt(f.s, 'passenger', Passenger.create(f.city, [f.entry], 0), binding), null);
  I.observe(f.s, { intercityPassenger: p }, binding); assert.equal(asset(f, id).lost, true);
  const g = fixture(selected('commercial')), money = 'branch:0:non-office-reserve';
  g.s.inventories.assets = g.s.inventories.assets.filter(a => a.id !== money); N.sync(g.s);
  assert.equal(asset(g, money).lost, true); assert.deepEqual(asset(g, money).state, {});
  assert.equal(I.assess(g.s, 'original:0').complete, false);
  g.s.inventories.owners.pop(); assert.equal(I.assess(g.s, 'original:0').complete, false);
  g.s.inventories = null; N.sync(g.s); assert.equal(g.s.inventories, null);
});
test('unsupported functions, historical inactivity and missing premises/definitions stay explicit, not silently empty', () => {
  for (const change of [m => m.strategicNonStateNetworkHistory.networkRows[0].sourceDefinitionId = 'missing',
    m => m.strategicNonStateNetworkHistory.branchRows[0].physicalCondition = 'ruined',
    m => m.strategicNonStateNetworkHistory.branchRows[0].organizationForm = 'unsupported',
    m => m.strategicNonStateNetworkHistory.affiliateRows[0].lifecycleStatus = 'defunct',
    m => m.strategicNonStateNetworkHistory.covertRows[0].status = 'dormant']) {
    const map = world(selected('research')); change(map);
    const s = N.create(N.sources(map, 'fixed'), binding, 0, { originalInventory: true }), v = I.assess(s, 'original:0');
    assert.equal(v.complete, false); assert.ok(v.sources.some(o => o.gaps.length));
  }
});
test('legacy saves, source-plan migration, copies and independent starts conserve resources and public accounts', () => {
  const f = serviceFixture('transport'), legacy = N.create(f.source, binding, 0), original = copy(legacy.accounts);
  legacy.accounts[0].money = 7; delete legacy.inventories; delete legacy.inventoriesInitialized;
  N.sync(legacy, f.source); assert.equal(legacy.inventories.mode, 'legacyUnknown'); assert.deepEqual(legacy.inventories.assets, []);
  assert.equal(legacy.accounts[0].money, 7); assert.equal(I.assess(legacy, 'original:0').complete, false);
  const p = Passenger.create(f.city, [f.entry], 0); p.vehicle.fuelKm = 3; I.adopt(legacy, 'passenger', p, binding);
  const before = copy(p); I.observe(legacy, { intercityPassenger: p }, binding); assert.deepEqual(p, before);
  const publicBefore = N.publicView(f.s), statement = C.statement(f.s, f.s.accounts[0]);
  asset(f, 'branch:0:non-office-reserve').state.money = 1;
  const resumed = N.rebind(N.normalize(f.s), binding, { worldId: 'copy', runId: 'copy' });
  assert.equal(resumed.inventories.runId, 'copy'); assert.equal(resumed.inventories.assets.find(a => a.id === 'branch:0:non-office-reserve').state.money, 1);
  assert.equal(I.adopt(resumed, 'passenger', p, binding), null);
  const independent = N.create(f.source, { worldId: binding.worldId, runId: 'independent' }, 0, { originalInventory: true });
  assert.notEqual(independent.inventories.assets.find(a => a.id === 'branch:0:non-office-reserve').state.money, 1);
  assert.deepEqual(N.publicView(f.s), publicBefore); assert.deepEqual(C.statement(f.s, f.s.accounts[0]), statement);
  assert.deepEqual(f.s.accounts, original);
  const frozen = copy(f.s); assert.equal(I.observe(f.s, {}, binding, false), false); assert.deepEqual(f.s, frozen);
});
test('corrupt reserves, duplicate records, conflicting owners and changed population proof remain unverified without healing', () => {
  for (const value of [NaN, -1, '240']) {
    const f = serviceFixture('transport'); asset(f, 'branch:0:non-office-reserve').state.money = value;
    assert.equal(N.normalize(f.s).inventories.invalid, true);
    assert.equal(I.assess(f.s, 'original:0').complete, false);
  }
  const f = serviceFixture('transport'); f.s.inventories.assets.push(copy(f.s.inventories.assets[0]));
  assert.equal(N.normalize(f.s).inventories.invalid, true);
  const g = serviceFixture('transport'), p = Passenger.create(g.city, [g.entry], 0);
  assert.equal(I.adopt(g.s, 'passenger', p, binding), p);
  p.source.populationId = 'unrelated-population'; I.observe(g.s, { intercityPassenger: p }, binding);
  assert.equal(asset(g, p.vehicle.id).lost, true);
  const h = serviceFixture('transport'); h.s.inventories.owners[0].networkId = 'unrelated-owner';
  assert.equal(I.assess(h.s, 'original:0').complete, false);
  const bad = copy(h.source); bad.inventoryPlan.owners.pop();
  assert.equal(N.create(bad, binding, 0, { originalInventory: true }), null);
});
test('missing nested service objects and conflicting physical fixture aliases become losses, never exceptions or replacements', () => {
  const f = serviceFixture('transport'), p = Passenger.create(f.city, [f.entry], 0);
  I.adopt(f.s, 'passenger', p, binding); const id = p.driver.id; delete p.driver;
  assert.equal(I.observe(f.s, { intercityPassenger: p }, binding), true); assert.equal(asset(f, id).lost, true);
  const g = serviceFixture('research'), w = Workspace.create(g.city, [g.entry], { cityId: g.city.cityId, currentAuthority: true,
    administrationId: 'admin' }, { cityName: 'Original City', representativeCell: { x: 9, y: 13, z: 21 } }, 'seed', 0, 'madcap');
  const bench = { id: w.benchId, condition: 100 }; I.adopt(g.s, 'workspace', w, binding, bench);
  const run = { penalFlights: { assistance: { cityApproach: { gates: [{ foreignWorkspace: w }] } } }, fixtures: [bench, { ...bench, condition: 1 }] };
  I.observe(g.s, run, binding); assert.equal(asset(g, bench.id).lost, true);
  assert.equal(I.assess(g.s, 'original:0').complete, false);
});
test('network summaries propagate unresolved consolidated hosts and descendant losses rather than hiding them behind a complete parent', () => {
  const map = world(selected('transport')); map.strategicNonStateNetworkHistory.branchRows[0].consolidatedIntoBranchId = 'missing-host';
  const s = N.create(N.sources(map, 'fixed'), binding, 0, { originalInventory: true }), v = I.assess(s, 'original:0');
  assert.equal(v.complete, false); assert.ok(v.sources.find(r => r.kind === 'network').gaps.length);
  assert.ok(v.sources.find(r => r.kind === 'branch').gaps.length);
});
