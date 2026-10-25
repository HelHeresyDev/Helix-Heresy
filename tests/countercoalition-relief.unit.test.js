const { test } = require('node:test');
const assert = require('node:assert/strict');
const Relief = require('../countercoalition-relief');
const Production = require('../local-market-production');
const Outer = require('../outer-approach');
const copy = x => JSON.parse(JSON.stringify(x));
const Network = require('../network-operations');
const { source: networkSource } = require('./helpers/network-operating-source');
const cell = (x, y) => ({ x, y, z: 25 });
function fixture() {
  const source = { cityId: 'b', partnerId: 'a', routeId: 'ab', interest: 'Original shared receiving corridor',
    cities: ['a', 'b'].map(cityId => ({ cityId, polityId: `polity:${cityId}`, authorityId: `ruler:${cityId}`, charterId: `charter:${cityId}`, populationSourceId: `population:${cityId}` })),
    relation: { basis: 'corridorNeighbors', posture: 'pragmatic', cooperationReadiness: 'high', communicationCompatibility: 'clear', standingObligations: ['corridorStatusExchange'], grievances: [], permanentAlliance: false } };
  const a = { id: 'defender:b', status: 'alive', health: 70, maxHealth: 100, fatigue: 0, stamina: 0, staminaCapacity: 100, wardMana: 0,
    workSeconds: 0, exceptionalCapabilities: ['city-scale ward defense'], roomId: 'checkpoint', mapCell: cell(11, 8), locationId: 'office' };
  const b = { source: { cityId: 'b', charterId: 'charter:b', defenseId: 'defense:b', populationSourceId: 'population:b', authority: { id: 'ruler:b' } }, defender: a,
    representative: { id: 'rep:b', status: 'alive', health: 100, workSeconds: 3600 }, depot: { id: 'depot:b' } };
  const g = { clerk: { id: 'clerk:b', status: 'alive', health: 100 }, foreignCivic: { bargain: b }, powerSeconds: 3600, receptionWorkSeconds: 3600 };
  const defense = { cityId: 'b', charterId: 'charter:b', institutionId: 'defense:b', populationSourceId: 'population:b', population: 100,
    installationId: 'ward:b', condition: 55, baselineEnergy: 69120 };
  const o = Outer.create(defense, b, { roomId: 'front', entry: cell(6, 16), post: cell(11, 12), receiving: cell(10, 14), service: cell(10, 13), structure: cell(10, 12) }, { worldId: 'w', runId: 'r' }, 0);
  const c = { source: defense, worldId: 'w', runId: 'r', alive: true, capable: true, free: true, local: true, observed: true, bodyEpoch: 0,
    cell: cell(10, 13), atBoth: true, clearAccess: true, defenderCanContest: false, defenderIncapacitated: false, suppressed: false,
    witnessIds: ['rep:b'], observedWitnessIds: [], sourceCurrent: true, independent: true, channel: true, witnessAtChannel: true, reportingWitnessIds: ['rep:b'],
    route: { id: 'ab', distanceKm: 2 }, routeOpen: true, restSafe: true, serviceSafe: true, atService: false,
    cargoCell: cell(11, 9), atCargo: false, unloadClear: true, atTruck: false };
  Outer.begin(o, b, c, 0); Outer.advance(o, b, 10, () => c); assert.equal(o.phase, 'held');
  const definitions = ['fieldRation', 'drinkingWater', 'metalParts', 'preparedManaCrystals'].map(id => ({ id, basePrice: 10, supply: 20 }));
  c.definitions = definitions;
  const profile = { cityId: 'a', listings: Object.fromEntries(definitions.map(d => [d.id, { targetSupply: 20 }])), productionSources: [], manufacturingFacilities: [], commodityDefinitions: definitions };
  const market = { id: 'a', treasury: 10000, reserveFraction: .6, profile, production: Production.create(profile, 10), listings: Object.fromEntries(definitions.map(d => [d.id, { supply: 20, demand: 1 }])) };
  const f = { source, a, b, g, o, c, market, at: 10, stacks: [] }; f.s = Relief.create(source, o, g, f.at);
  const move = (actor, goal) => { actor.mapCell = { ...actor.mapCell, x: actor.mapCell.x + Math.sign(goal.x - actor.mapCell.x), y: actor.mapCell.y + Math.sign(goal.y - actor.mapCell.y) }; return true; };
  f.h = {
    incapacitated: actor => actor.health < 50,
    arrive: (d, t) => { d.mapCell = cell(6, 8); t.mapCell = cell(6, 8); return true; },
    moveCargo: d => move(d, c.cargoCell), moveTruck: d => move(d, cell(6, 8)),
    unload: (cargo, id) => { f.stacks.push(...cargo.map(r => ({ ...r, quantity: r.quantity, cityOwnerId: 'b', cell: copy(c.cargoCell), reliefMissionId: id }))); return true; },
    stacks: () => f.stacks, collectService: (actor, rows) => { for (const i of rows) i.carriedBy = actor.id; return rows.length > 0; },
    moveService: actor => move(actor, o.layout.service), repair: n => { c.condition = n; return true; }
  };
  c.condition = 55;
  f.context = () => {
    const t = Relief.truck(f.s, market), d = t?.driver;
    c.atCargo = Relief.same(d?.mapCell, c.cargoCell); c.atTruck = Relief.same(d?.mapCell, t?.mapCell);
    c.atService = Relief.same(a.mapCell, o.layout.service);
    return c;
  };
  return f;
}
function tick(f, n = 1) { f.at += n; return Relief.advance(f.s, f.o, f.g, f.market, f.context, f.at, f.h); }
function dispatch(f) { tick(f, 0); assert.equal(f.s.phase, 'reporting'); tick(f, 120); assert.equal(f.s.phase, 'outbound'); }
function unload(f) { dispatch(f); tick(f, 240); for (let n = 0; n < 100 && !f.s.mission.deliveredAt; n++) tick(f); assert.ok(f.s.mission.deliveredAt); }
function sponsored(f, managed = false) {
  const source = networkSource();
  // Explicit alternative original charter, not changing a live refusal.
  if (managed) source.branches[0].charter = { ...source.branches[0].charter, mode: 'delegatedManagement', controllerId: 'original-network' };
  f.network = Network.create(source, { worldId: 'w', runId: 'r' }, 0);
  f.g.id = 'original-b';
  const contact = { worldId: 'w', runId: 'r', alive: true, capable: true, local: true, near: true, channel: true,
    cityId: 'b', bodyEpoch: 0, cell: { x: 1 }, gate: f.g, clerk: f.g.clerk };
  assert.equal(Network.begin(f.network, contact, 'original-network', 'branch:b', 0), true);
  Network.advance(f.network, () => contact, 181);
  f.at = f.s.lastAt = 181;
  f.c.equipmentSponsor = {
    quote: cost => Network.candidates(f.network, 'a').find(id => Network.host(f.network, id).money >= cost),
    pay: (branchId, cost, id, at) => Network.sponsor(f.network, branchId, cost,
      { id, cityId: 'b', payerCityId: 'a', routeId: 'ab', purpose: 'armedReceivingContest' }, at)
  };
  return f;
}
test('autonomous organizational refusal can fund actual conserved equipment on the original supported relief trip', () => {
  const f = sponsored(fixture()); f.market.treasury = 1040;
  const total = () => f.market.treasury + f.market.production.finance.money + f.market.production.finance.exchangeMoney
    + f.network.accounts.reduce((n, a) => n + a.money, 0);
  const before = total(); unload(f);
  assert.equal(Network.host(f.network, 'branch:a').reply.accepts, false);
  assert.equal(f.s.mission.equipmentSponsor.branchId, 'branch:a'); assert.equal(f.s.mission.equipmentSponsor.amount, 33);
  assert.equal(Network.host(f.network, 'branch:a').money, 207); assert.equal(f.market.treasury, 1004);
  assert.equal(f.s.mission.driverId, 'a:producer-driver-1'); assert.equal(f.market.production.trucks.length, 2);
  assert.ok(f.s.mission.deliveredAt); assert.equal(total(), before);
  assert.equal(f.stacks.find(i => i.key === 'metalParts').quantity, 2);
  f.network = Network.normalize(f.network); tick(f, 300);
  assert.equal(Network.host(f.network, 'branch:a').payments.length, 1); assert.equal(total(), before);
});
test('delegated accession prevents new discretionary network financing, not humanitarian action or independent municipal payment', () => {
  const f = sponsored(fixture(), true); f.market.treasury = 1040;
  assert.ok(Network.host(f.network, 'branch:a').mandate); tick(f, 0); tick(f, 120);
  assert.equal(f.s.phase, 'declined'); assert.equal(f.s.mission, null); assert.equal(f.market.treasury, 1040);
  assert.equal(Network.host(f.network, 'branch:a').money, 240);
  assert.equal(Network.permitted(f.network, 'branch:a', 'humanitarianProtection'), true);
  const own = sponsored(fixture(), true); dispatch(own);
  assert.equal(own.s.mission.equipmentSponsor, null); assert.equal(Network.host(own.network, 'branch:a').money, 240);
});
test('no branch money is spent when original stock, road, truck, driver, civilian funds or commission is unavailable', () => {
  for (const change of [f => f.c.routeOpen = false, f => f.market.listings.metalParts.supply = 12,
    f => f.market.production.trucks.forEach(t => t.shipment = 'existing-obligation'),
    f => f.market.production.trucks.forEach(t => t.driver.status = 'dead'), f => f.market.treasury = 1000,
    f => f.c.sourceCurrent = false]) {
    const f = sponsored(fixture()); change(f); tick(f, 0); tick(f, 120);
    assert.equal(f.s.mission, null); assert.equal(Network.host(f.network, 'branch:a').money, 240);
    assert.deepEqual(Network.host(f.network, 'branch:a').payments, []);
  }
  const offline = sponsored(fixture()); offline.market.treasury = 1040;
  Network.host(offline.network, 'branch:a').terminal.powerSeconds = 0;
  tick(offline, 0); tick(offline, 120); assert.equal(offline.s.mission, null);
  assert.equal(Network.host(offline.network, 'branch:a').money, 240);
});
test('source requires actual independent city authorities, common corridor interest and receptive relations, not proximity or heresy', () => {
  const f = fixture(); assert.ok(Relief.eligible(f.source));
  for (const change of [s => s.partnerId = 'b', s => s.cities[0].authorityId = '', s => s.relation.posture = 'hostile',
    s => s.relation.basis = 'notableInternetTie', s => s.relation.communicationCompatibility = 'adversarial', s => s.relation.standingObligations = []]) {
    const source = copy(f.source); change(source); assert.equal(Relief.create(source, f.o, f.g, f.at), null);
  }
  const map = { cityGovernments: { governments: f.source.cities.map(c => ({ cityId: c.cityId, charter: { id: c.charterId } })) },
    cityPolities: { polities: f.source.cities.map(c => ({ id: c.polityId, cityId: c.cityId })), relations: [{ ...f.source.relation, cityPolityIds: ['polity:a', 'polity:b'] }] },
    strategicPoliticalHistory: { currentControlRows: f.source.cities.map(c => ({ cityId: c.cityId, controlStatus: 'sovereign', recognizedAuthorityId: c.authorityId })) },
    strategicPlayableSettlementState: { cityRows: f.source.cities.map(c => ({ cityId: c.cityId, assetId: c.populationSourceId, currentPopulation: 100, physicalJurisdictionExists: true, physicalCondition: 'intact' })) },
    routeGraph: { routes: [{ id: 'ab', endpointIds: ['a', 'b'] }] } };
  assert.ok(Relief.eligible(Relief.sourceFromWorld(map, 'b', 'a', { id: 'ab' })));
  map.strategicPoliticalHistory.currentControlRows[0].controlStatus = 'occupied'; assert.equal(Relief.sourceFromWorld(map, 'b', 'a', { id: 'ab' }), null);
});
test('no witnessed seizure, dead defender, unavailable authority, shared staff or real channel means no response', () => {
  for (const change of [f => f.o.reports = [], f => f.o.phase = 'uncontested', f => f.a.status = 'dead', f => f.a.health = 12,
    f => f.c.independent = false, f => f.c.sourceCurrent = false, f => f.c.channel = false, f => f.c.reportingWitnessIds = [],
    f => f.g.powerSeconds = 0, f => f.g.receptionAssignment = 'other', f => f.b.representative.assignment = 'parley', f => f.c.honoredSettlement = true]) {
    const f = fixture(); change(f); tick(f, 1000); assert.equal(f.s.mission, null); assert.equal(f.market.treasury, 10000);
  }
});
test('report consumes same original clerk power and representative duty; outage pauses without backfill or private roster disclosure', () => {
  const f = fixture(); tick(f, 0); tick(f, 20); assert.equal(f.g.powerSeconds, 3580); assert.equal(f.g.receptionWorkSeconds, 3580); assert.equal(f.b.representative.workSeconds, 3580);
  assert.equal(Relief.receive(f.s, { receivedAtCounter: true }, f.at), false); f.c.channel = false; tick(f, 500); assert.equal(f.s.job.progress, 20);
  f.s = Relief.normalize(f.s); f.c.channel = true; tick(f, 500); assert.equal(f.s.job.progress, 20); tick(f, 100);
  assert.equal(f.s.attempts[0].receivedAt, f.at); assert.equal(f.s.mission.progress, 0); assert.equal(f.g.receptionAssignment, null);
  assert.ok(Relief.receive(f.s, { receivedAtCounter: true }, f.at)); assert.doesNotMatch(JSON.stringify(Relief.publicView(f.s)), /"(?:treasury|fuelKm|health|driverId|workSeconds|cargo|trucks)"\s*:/);
  const view = Relief.publicView(f.s); tick(f, 10); assert.deepEqual(Relief.publicView(f.s), view);
});
test('exact affordable inventory and original capable range-limited truck are required; no reserve theft or invented shipment', () => {
  for (const change of [f => f.market.treasury = 1000, f => f.market.listings.preparedManaCrystals.supply = 12,
    f => f.market.production.trucks.forEach(t => t.shipment = 'customer-order'), f => f.market.production.trucks.forEach(t => t.fuelKm = 3),
    f => f.market.production.trucks.forEach(t => t.driver.health = 10), f => f.c.routeOpen = false, f => f.c.route.distanceKm = 101]) {
    const f = fixture(); change(f); const before = copy(f.market); tick(f, 0); tick(f, 120);
    assert.equal(f.s.phase, 'declined'); assert.equal(f.s.mission, null); assert.deepEqual(f.market, before);
    tick(f, 10000); assert.equal(f.s.attempts.length, 1);
  }
});
test('purchase conserves funds and stock, reserves original vehicle and survives production scheduler and save', () => {
  const f = fixture(), t = f.market.production.trucks[0]; dispatch(f);
  assert.equal(Relief.truck(f.s, f.market), t); assert.equal(t.driver.id, 'a:producer-driver-1'); assert.equal(t.fuelKm, 236);
  assert.equal(f.market.listings.metalParts.supply, 18); assert.equal(f.market.listings.preparedManaCrystals.supply, 19);
  assert.equal(f.market.treasury + f.market.production.finance.money + f.market.production.finance.exchangeMoney, 17500);
  const supplier = { routeOpen: false, fuelStockKm: 0, partsStock: 0 };
  const before = copy(t); Production.advance(f.market.production, 4000, f.market.listings, supplier); assert.deepEqual(t, before);
  f.s = Relief.normalize(f.s); assert.equal(t.shipment, f.s.mission.id); tick(f, 239); assert.equal(f.s.mission.visibleOnGround, false); tick(f, 1); assert.equal(f.s.mission.visibleOnGround, true);
});
test('actual walk, sixty clear unloading seconds and accessible owned stores precede supplied rest', () => {
  const f = fixture(); dispatch(f); tick(f, 240); tick(f, 1); assert.equal(f.stacks.length, 0);
  f.c.unloadClear = false; for (let n = 0; n < 100; n++) tick(f); assert.equal(f.stacks.length, 0);
  f.c.unloadClear = true; for (let n = 0; n < 59; n++) tick(f); assert.equal(f.stacks.length, 0); tick(f);
  assert.equal(f.stacks.length, 4); assert.equal(f.s.phase, 'recovering'); assert.equal(f.a.workSeconds, 0); assert.equal(f.a.stamina, 0);
  assert.equal(f.stacks.find(i => i.key === 'fieldRation').quantity, 0); assert.equal(f.stacks.find(i => i.key === 'drinkingWater').quantity, 0);
});
test('eight supplied safe hours and physical original service restore only duty/stamina, station and actual structure', () => {
  const f = fixture(); unload(f); tick(f, Relief.REST - 1); assert.equal(f.a.stamina, 0); f.s = Relief.normalize(f.s);
  tick(f); assert.equal(f.s.phase, 'servicing'); assert.ok(f.a.stamina > 0); assert.equal(f.a.health, 70); assert.equal(f.a.wardMana, 0);
  assert.equal(f.stacks.find(i => i.key === 'metalParts').carriedBy, f.a.id);
  f.o.station.energy = 1000;
  for (let n = 0; n < 160 && f.s.phase !== 'contesting'; n++) tick(f);
  assert.equal(f.s.phase, 'contesting'); assert.equal(f.c.condition, 80); assert.equal(f.o.station.energy, 22600);
  assert.equal(f.stacks.find(i => i.key === 'metalParts').quantity, 0); assert.equal(f.stacks.find(i => i.key === 'preparedManaCrystals').quantity, 0);
  assert.equal(f.a.health, 70); assert.equal(f.a.wardMana, 0); assert.equal(f.a.assignment, null); assert.equal(f.o.phase, 'held');
  f.c.otherDuty = false; f.c.defenderCanContest = true; f.c.defenderSeesScientist = true; f.c.distanceM = 1; f.c.attackLine = true;
  let strikes = 0; Outer.advance(f.o, f.b, f.o.lastAt + 5, () => f.c, { move: f.h.moveService, strike: () => strikes++ });
  assert.ok(strikes > 0); assert.equal(f.o.phase, 'contested'); assert.equal(f.s.phase, 'contesting');
  f.o.phase = 'lost'; f.o.claim.endedAt = f.at; f.c.accessRestored = true; tick(f); assert.equal(f.s.phase, 'completed');
});
test('unsafe rest and magic suppression interrupt work without healing or free provisions', () => {
  const f = fixture(); unload(f); tick(f, 100); f.c.restSafe = false; tick(f, 100); assert.equal(f.s.recovery.progress, 0);
  f.c.restSafe = true; tick(f, 10000); assert.equal(f.s.recovery.progress, 0); tick(f, Relief.REST); assert.equal(f.s.phase, 'servicing');
  f.c.suppressed = true; tick(f, 1000); assert.equal(f.s.recovery.serviceProgress, 0); assert.equal(f.c.condition, 55);
});
test('personally perceived service obstruction releases recovered original defender into actual resistance without consuming uninstalled goods', () => {
  const f = fixture(); unload(f); f.c.serviceSafe = false; f.c.obstructsService = true; tick(f, Relief.REST);
  assert.equal(f.s.phase, 'contesting'); assert.equal(f.a.assignment, null); assert.equal(f.a.health, 70); assert.equal(f.a.wardMana, 0);
  assert.ok(f.a.stamina >= 60); assert.equal(f.c.condition, 55); assert.equal(f.stacks.find(i => i.key === 'metalParts').quantity, 2);
  assert.equal(f.o.phase, 'held'); // The real encounter must still contest access.
});
test('unseen obstruction supplies no remote danger sense: recovered original walks to service before actual contact can interrupt it', () => {
  const f = fixture(); unload(f); f.c.serviceSafe = false; f.c.obstructsService = false; tick(f, Relief.REST);
  for (let n = 0; n < 10; n++) tick(f);
  assert.deepEqual(f.a.mapCell, f.o.layout.service); assert.equal(f.s.recovery.serviceProgress, 0); assert.equal(f.s.phase, 'servicing');
  f.c.obstructsService = true; tick(f); assert.equal(f.s.phase, 'contesting'); assert.equal(f.a.assignment, null); assert.equal(f.c.condition, 55);
});
test('wounding original driver or losing road retains cargo/vehicle and can defeat the trip without another wave', () => {
  const f = fixture(); dispatch(f); tick(f, 240); const t = Relief.truck(f.s, f.market), id = t.driver.id;
  t.driver.health = 12; tick(f, 10000); assert.equal(f.s.mission.deliveredAt, null); assert.equal(f.stacks.length, 0); assert.equal(t.shipment, f.s.mission.id);
  f.s = Relief.normalize(f.s); tick(f, 10000); assert.equal(f.s.attempts.length, 1); assert.equal(Relief.truck(f.s, f.market).driver.id, id);
  assert.equal(f.market.production.trucks.length, 2); assert.equal(f.s.mission.cargo.reduce((n, r) => n + r.quantity, 0), 5);
});
test('honored withdrawal dissolves purpose, retains spent money/cargo and physically returns the same truck without touching settlement', () => {
  const f = fixture(); dispatch(f); tick(f, 50); const money = f.market.treasury, fuel = Relief.truck(f.s, f.market).fuelKm;
  f.o.settlement = { phase: 'active', paid: 125, heldFunds: 125, terms: { withdrawnAt: 123 } }; const terms = copy(f.o.settlement);
  f.c.honoredSettlement = true; f.o.phase = 'lost'; tick(f); assert.equal(f.s.phase, 'dissolved');
  tick(f, 240); tick(f, 240); assert.equal(f.s.mission.phase, 'returned'); assert.equal(Relief.truck(f.s, f.market).shipment, null);
  assert.equal(f.market.treasury, money); assert.ok(Relief.truck(f.s, f.market).fuelKm > fuel);
  assert.ok(Math.abs(f.s.mission.travelledKm - 50 / 3600 * 30 * 2) < .0001);
  const returnedFuel = Relief.truck(f.s, f.market).fuelKm; tick(f, 500); assert.equal(Relief.truck(f.s, f.market).fuelKm, returnedFuel);
  assert.deepEqual(f.o.settlement, terms);
});
test('run binding, import rebinding, original casualties and irreversible scientist death freeze are preserved', () => {
  const f = fixture(); dispatch(f); const before = copy(f.s); f.c.alive = false; tick(f, 1000); assert.deepEqual(f.s, before);
  assert.equal(Relief.rebind(f.s, { worldId: 'wrong', runId: 'r' }, { worldId: 'w', runId: 'new' }), null);
  const imported = Relief.rebind(f.s, { worldId: 'w', runId: 'r' }, { worldId: 'w', runId: 'new' }); assert.equal(imported.runId, 'new'); assert.equal(imported.mission.driverId, before.mission.driverId);
  f.c.alive = true; f.a.status = 'dead'; tick(f); assert.equal(f.s.phase, 'dissolved'); assert.equal(f.a.status, 'dead'); assert.equal(f.a.health, 70);
});
test('a new received claim and real resources are needed after refusal; waiting and reopening cannot reroll the same incident', () => {
  const f = fixture(); f.market.treasury = 1000; tick(f, 0); tick(f, 120); assert.equal(f.s.phase, 'declined');
  f.market.treasury = 10000; tick(f, 500); assert.equal(f.s.phase, 'declined'); assert.equal(f.s.attempts.length, 1);
  Outer.end(f.o, f.at, 'Actually abandoned'); assert.ok(Outer.begin(f.o, f.b, f.c, f.at));
  Outer.advance(f.o, f.b, f.at + 10, () => f.c); f.at += 10; tick(f, 0); assert.equal(f.s.phase, 'reporting');
  tick(f, 120); assert.equal(f.s.phase, 'outbound'); assert.equal(f.s.attempts.length, 2); assert.ok(f.market.treasury < 10000);
});
test('road loss, another truck assignment and interrupted unloading do not backfill travel, duplicate cargo or steal another customer vehicle', () => {
  const f = fixture(); dispatch(f); tick(f, 20); f.c.routeOpen = false; tick(f, 500); assert.equal(f.s.mission.progress, 20);
  f.c.routeOpen = true; tick(f, 500); assert.equal(f.s.mission.progress, 20); const t = Relief.truck(f.s, f.market);
  t.shipment = 'other-customer'; tick(f, 500); assert.equal(f.s.mission.progress, 20); assert.equal(t.shipment, 'other-customer');
  t.shipment = f.s.mission.id; tick(f, 500); assert.equal(f.s.mission.progress, 20); tick(f, 220);
  for (let n = 0; n < 25; n++) tick(f); assert.ok(f.s.mission.progress > 0);
  f.c.unloadClear = false; tick(f); assert.equal(f.s.mission.progress, 0); f.c.unloadClear = true;
  for (let n = 0; n < 60; n++) tick(f); assert.equal(f.stacks.length, 4); tick(f, 500); assert.equal(f.stacks.length, 4);
});
test('missing or stolen municipal cargo cannot supply recovery or remotely service the original installation', () => {
  const f = fixture(); f.c.restSafe = false; unload(f);
  const meal = f.stacks.find(i => i.key === 'fieldRation'); meal.cityOwnerId = 'scientist'; f.c.restSafe = true; tick(f, Relief.REST);
  assert.equal(f.s.recovery, null); assert.equal(f.a.stamina, 0);
  meal.cityOwnerId = 'b'; tick(f); tick(f, Relief.REST);
  assert.equal(f.s.phase, 'servicing'); f.stacks.find(i => i.key === 'metalParts').carriedBy = 'scientist';
  f.stacks.find(i => i.key === 'preparedManaCrystals').carriedBy = 'scientist';
  for (let n = 0; n < 160; n++) tick(f);
  assert.equal(f.c.condition, 55); assert.equal(f.o.station.charged || 0, 0);
});
test('dead original driver fails the undelivered attempt, deadline dissolves it, and no new vehicle/crew or refund appears', () => {
  const f = fixture(); dispatch(f); tick(f, 240); const t = Relief.truck(f.s, f.market), funds = f.market.treasury;
  t.driver.health = 0; t.driver.status = 'dead'; tick(f); assert.equal(f.s.phase, 'failed'); assert.equal(f.s.mission.phase, 'stranded');
  const remains = copy(t.driver.mapCell); tick(f, 200000); assert.equal(f.market.treasury, funds); assert.deepEqual(t.driver.mapCell, remains);
  assert.equal(f.market.production.trucks.length, 2); assert.equal(f.s.attempts.length, 1); assert.equal(f.stacks.length, 0);
  const other = fixture(); dispatch(other); tick(other, 50); other.c.routeOpen = false; tick(other, 172800); assert.equal(other.s.phase, 'dissolved');
  assert.equal(Relief.truck(other.s, other.market).shipment, other.s.mission.id);
});
test('supplied rest uses the actual safe position in original quarters, not a forced teleport to the original anchor', () => {
  const f = fixture(); f.a.mapCell.x--; unload(f); const position = copy(f.a.mapCell);
  assert.deepEqual(f.s.recovery.cell, position); tick(f, Relief.REST - 1); assert.deepEqual(f.a.mapCell, position); assert.equal(f.a.stamina, 0);
  tick(f); assert.ok(f.a.stamina > 0); assert.equal(f.a.health, 70);
});
