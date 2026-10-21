const { test } = require('node:test');
const assert = require('node:assert/strict');
const Joint = require('../joint-transit');
const Passenger = require('../intercity-passenger');
const March = require('../intercity-march');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const p = (x, y) => ({ x, y, z: 25 });
  const source = { id: 'original-fort', name: 'Original Joint Fort', corridorId: 'ab', cellId: 'middle', populationId: 'fort-population', population: 100,
    endpointCityIds: ['a', 'b'], sponsors: ['a', 'b'].map((cityId, i) => ({ cityId, charterId: `charter:${cityId}`, authorityId: `ruler:${cityId}`,
      institutionId: `works:${cityId}`, populationId: `people:${cityId}`, staffingPercent: i ? 65 : 35, upkeepPercent: i ? 65 : 35 })),
    administration: 'neutralCompactAdministration', serviceMode: 'groundConvoy', independentlySovereign: false, independentDiplomacy: false,
    physicalCondition: 'intact', services: { utilities: 'functional', provisioning: 'functional' }, distanceKm: 10, positionKm: 4 };
  const layout = { roomId: 'fort-receiving', entry: p(10, 10), desk: p(14, 10), post: p(14, 9), structure: p(15, 9),
    homes: [p(13, 8), p(16, 8)], bins: [p(12, 9), p(17, 9)] };
  const s = Joint.create(source, { worldId: 'world', runId: 'run' }, layout, 0), items = [];
  for (let i = 0; i < 2; i++) for (const key of Joint.KEYS) {
    const item = { id: `${i}:${key}`, key, quantity: i ? 13 : 7, roomId: layout.roomId, cell: layout.bins[i], cityOwnerId: source.sponsors[i].cityId, civicCustody: s.id };
    items.push(item); s.stockIds.push(item.id);
  }
  const c = { source, worldId: 'world', runId: 'run', alive: true, current: true, operational: true, local: true, near: true,
    capable: true, free: true, busy: false, bodyEpoch: 0, passageAllowed: true, journeyId: 'actual-trip', carrierId: 'actual-car', incapacitatedIds: [] };
  const receipts = [], moves = [];
  const h = { items: () => items, pass: r => receipts.push(copy(r)), move: (a, to) => {
    if (c.blocked || s.members.some(b => b.id !== a.id && Joint.same(b.mapCell, to))) return false;
    a.mapCell = { ...a.mapCell, x: a.mapCell.x + Math.sign(to.x - a.mapCell.x), y: a.mapCell.y + Math.sign(to.y - a.mapCell.y) };
    moves.push(a.id); return true;
  } };
  return { source, s, c, items, h, receipts, moves, tick: at => Joint.advance(s, at, () => c, h) };
}
const open = f => { assert.ok(Joint.request(f.s, f.c, f.items, 0)); f.tick(95); assert.ok(f.s.operation); assert.equal(f.receipts.length, 1); };
test('exactly two original shares, source, population and usable ground mode are mandatory; no new sovereign fort', () => {
  const f = fixture(); assert.deepEqual(Joint.costs(f.s), [7, 13]); assert.equal(f.s.members.length, 2); assert.equal(f.s.source.population, 100);
  for (const bad of [{ ...f.source, sponsors: [f.source.sponsors[0]] }, { ...f.source, population: 0 }, { ...f.source, independentDiplomacy: true },
    { ...f.source, positionKm: 0 }, { ...f.source, serviceMode: 'aircraft' }]) assert.equal(Joint.create(bad, { worldId: 'w', runId: 'r' }, f.s.layout, 0), null);
  assert.equal(Joint.position(f.source, 'a'), 4); assert.equal(Joint.position(f.source, 'b'), 6);
});
test('one actual source-backed inspection consumes recorded 35/65 stocks once, then requires the real posted operator', () => {
  const f = fixture(); open(f); assert.deepEqual(f.items.map(i => i.quantity), [0, 0, 0, 0]);
  assert.equal(f.s.operation.manifest.reduce((n, r) => n + r.quantity, 0), 40); assert.ok(f.moves.length);
  assert.equal(Joint.request(f.s, f.c, f.items, 96), false); f.tick(100); assert.equal(f.receipts.length, 1);
  assert.equal(Joint.service(f.s, f.c, 100), true); assert.equal(f.s.receipts[0].carrierId, 'actual-car');
});
test('one sponsor payment, spare worker, foreign run, vanished source or unavailable local consent cannot replace the joint obligation', () => {
  for (const change of ['local', 'near', 'current', 'free', 'passageAllowed']) {
    const f = fixture(); f.c[change] = false; assert.equal(Joint.request(f.s, f.c, f.items, 0), false, change);
  }
  const f = fixture(); f.items[2].quantity = 0; assert.match(Joint.openingReason(f.s, f.c, f.items), /recorded upkeep shares/);
  f.items[2].quantity = 13; f.s.members[1].assignment = 'original-other-job'; assert.match(Joint.openingReason(f.s, f.c, f.items), /staffing shares/);
  f.s.members[1].assignment = null; f.c.runId = 'other'; assert.equal(Joint.request(f.s, f.c, f.items, 0), false);
});
test('changed custody, contamination or a copied source label never supplies a missing physical sponsor bin', () => {
  for (const change of ['cell', 'cityOwnerId', 'carriedBy', 'civicCustody', 'tags']) {
    const f = fixture(); f.items[2][change] = change === 'cell' ? { x: 99, y: 99, z: 25 } : change === 'tags' ? ['contaminated'] : 'other';
    assert.equal(Joint.request(f.s, f.c, f.items, 0), false, change);
  }
  const f = fixture(); f.items[2].quantity = 0; f.items.push({ ...f.items[2], id: 'copied-label', quantity: 13 });
  assert.equal(Joint.request(f.s, f.c, f.items, 0), false);
});
test('movement/body change interrupts unfinished attendance without consuming any original stock or restoring spent work', () => {
  for (const reason of ['near', 'body']) {
    const f = fixture(); assert.ok(Joint.request(f.s, f.c, f.items, 0)); f.tick(20); const duty = f.s.members[0].workSeconds;
    if (reason === 'near') f.c.near = false; else f.c.bodyEpoch++;
    f.tick(21); assert.equal(f.s.job, null); assert.deepEqual(f.items.map(i => i.quantity), [7, 7, 13, 13]); assert.equal(f.s.members[0].workSeconds, duty);
  }
});
test('blocked physical post, incapacity and another assignment stop real service without erasing the supplied watch', () => {
  const f = fixture(); f.c.blocked = true; assert.ok(Joint.request(f.s, f.c, f.items, 0)); f.tick(95);
  assert.ok(f.s.operation); assert.equal(f.receipts.length, 0); assert.equal(Joint.service(f.s, f.c, 95), false);
  f.c.blocked = false; f.tick(130); assert.equal(f.receipts.length, 1);
  f.c.incapacitatedIds = [f.s.members[0].id]; assert.equal(Joint.service(f.s, f.c, 131), false);
  f.c.incapacitatedIds = []; f.s.members[0].assignment = 'another-original-duty'; assert.equal(Joint.service(f.s, f.c, 131), false);
});
test('four-hour window advances both distinct staffing shares, expires and never refills resources or original bodies', () => {
  const f = fixture(); open(f); const ends = f.s.operation.endsAt; f.tick(ends + 5);
  assert.equal(Joint.service(f.s, f.c, ends + 5), false); assert.equal(f.s.windows.length, 1);
  assert.ok(f.s.operation.staffSpent[0] > 5000); assert.ok(f.s.operation.staffSpent[1] > 9300);
  assert.equal(f.s.members[0].status, 'alive'); assert.ok(f.s.members[0].workSeconds < Joint.DUTY);
  f.c.journeyId = 'another-trip'; assert.equal(Joint.request(f.s, f.c, f.items, ends + 5), false);
  assert.deepEqual(f.items.map(i => i.quantity), [0, 0, 0, 0]); assert.equal(f.s.powerSeconds, Joint.WINDOW);
});
test('hostility-compatible divided facilities still honor ordinary joint passage, but cannot accept unilateral staff consolidation', () => {
  const f = fixture(); f.source.administration = f.s.source.administration = 'dividedSponsorFacilities';
  f.c.coverAuthorization = { cityId: 'a', charterId: 'charter:a', receiptId: 'actual-handover', bodyEpoch: 0 };
  assert.equal(Joint.cover(f.s, f.c, 0, 0), false); open(f); assert.equal(f.receipts.length, 1);
  f.c.passageAllowed = false; assert.equal(Joint.service(f.s, f.c, 100), false);
});
test('explicit authenticated sponsor compensation uses the same volunteer and its own full finite upkeep, never exclusive ownership', () => {
  const f = fixture(); const originals = f.s.members.map(a => a.id);
  assert.equal(Joint.cover(f.s, f.c, 0, 0), false);
  f.c.coverAuthorization = { cityId: 'a', charterId: 'charter:a', receiptId: 'actual-handover', bodyEpoch: 0 };
  assert.ok(Joint.cover(f.s, f.c, 0, 0)); assert.deepEqual(Joint.costs(f.s), [20, 0]);
  f.items[0].quantity = 20; f.items[1].quantity = 20; f.s.members[1].status = 'dead'; f.s.members[1].health = 0;
  open(f); assert.deepEqual(f.s.operation.coverage, [0, 0]); assert.deepEqual(f.s.members.map(a => a.id), originals);
  assert.equal(f.s.members[1].status, 'dead'); assert.equal(f.items[2].quantity, 13); assert.equal(f.s.source.independentlySovereign, false);
});
test('save/chunk replay preserves original members, spent physical resources, attendance and once-only passage', () => {
  const a = fixture(), b = fixture(); for (const f of [a, b]) assert.ok(Joint.request(f.s, f.c, f.items, 0));
  a.tick(100); for (let at = 1; at <= 100; at++) { Object.assign(b.s, Joint.normalize(copy(b.s))); b.tick(at); }
  assert.deepEqual(b.s, a.s); assert.deepEqual(b.items, a.items); assert.deepEqual(b.receipts, a.receipts);
});
test('death freezes and fresh/continued runs retain explicit ownership without inheriting old service', () => {
  const f = fixture(); open(f); const frozen = copy(f.s); f.c.alive = false; f.tick(1000); assert.deepEqual(f.s, frozen);
  const copied = Joint.rebind(f.s, { worldId: 'world', runId: 'run' }, { worldId: 'copy', runId: 'copy' }); assert.equal(copied.runId, 'copy');
  assert.equal(f.s.runId, 'run'); assert.equal(fixture().s.receipts.length, 0);
});
test('away knowledge remains a dated received statement, not live readiness, duty or an exposed garrison', () => {
  const f = fixture(); open(f); const report = copy(f.s.report); f.c.local = false; f.tick(200);
  assert.deepEqual(f.s.report, report); assert.doesNotMatch(JSON.stringify(report), /"(?:health|workSeconds|powerSeconds|members)":/);
});
test('world adapter retains the original fort, unequal shares and measured cell distances without using another city as sponsor', () => {
  const f = fixture(), source = f.source, route = { id: 'ab', endpointCityIds: ['a', 'b'], distanceKm: 10 };
  const map = { routeGraph: { routes: [{ id: 'ab', endpointIds: ['a', 'b'], cellPath: ['a-cell', 'middle', 'b-cell'] }] },
    cityExpansionHistory: { strongholdRows: [{ id: source.id, corridorId: 'ab', ordinal: 0, cellId: 'middle', sponsorCityIds: ['a', 'b'], sponsorContributionRows: [['a', 35, 35], ['b', 65, 65]], administration: source.administration, serviceMode: 'groundConvoy' }] },
    strategicPlayableSettlementState: { strongholdRows: [{ strongholdId: source.id, assetId: source.populationId, currentPopulation: 100, physicalCondition: 'intact', services: source.services }], cityRows: ['a', 'b'].map(cityId => ({ cityId, assetId: `people:${cityId}`, currentPopulation: 100, physicalCondition: 'intact' })) },
    cityGovernments: { governments: ['a', 'b'].map(cityId => ({ cityId, charter: { id: `charter:${cityId}` }, roleAssignments: { publicWorksAndProvisioning: `works:${cityId}` } })) },
    cityPolities: { polities: ['a', 'b'].map(cityId => ({ cityId, authority: { id: `ruler:${cityId}` } })) } };
  const derived = Joint.sourceFromWorld(map, route, a => a === 'a-cell' ? 4 : 6);
  assert.equal(derived.id, source.id); assert.equal(derived.positionKm, 4); assert.deepEqual(derived.sponsors, source.sponsors);
  map.cityExpansionHistory.strongholdRows[0].sponsorCityIds = ['a', 'c']; assert.equal(Joint.sourceFromWorld(map, route, () => 1), null);
});
function passenger() {
  const s = Passenger.create({ cityId: 'a', assetId: 'people:a', currentPopulation: 10, physicalCondition: 'intact', services: { transport: 'functional' } },
    [{ network: { category: 'transport' }, branch: { id: 'original', capacityBand: 'functional' }, standing: 'licensed' }], 0);
  const network = { destinations: ['a', 'b'].map(cityId => ({ id: `city:${cityId}`, kind: 'fortifiedCity', cityId, known: true })),
    routes: [{ id: 'ab', endpointCityIds: ['a', 'b'], supportCapable: true, continuity: 'continuous', distanceKm: 10 }] };
  assert.equal(Passenger.book(s, Passenger.quote(s, network, 'city:b'), { kg: 0, l: 0 }, { money: 1000 }, 0, 0), '');
  Passenger.board(s, 0, [], 'test'); s.trip.delaySeconds = 0;
  return { s, network };
}
test('licensed carrier stops at exact physical checkpoint and spends waiting food without earning distance, fuel use or arrival', () => {
  const { s, network } = passenger(), checkpoint = { id: 'fort', km: 4 };
  Passenger.advance(s, network, 1000, true, checkpoint); assert.equal(s.trip.distanceKm, 4); assert.equal(s.phase, 'outbound');
  const fuel = s.vehicle.fuelKm, food = s.provisionsSeconds; Passenger.advance(s, network, 1100, true, checkpoint);
  assert.equal(s.trip.distanceKm, 4); assert.equal(s.vehicle.fuelKm, fuel); assert.equal(s.provisionsSeconds, food - 100);
  s.trip.checkpoint.cleared = true; Passenger.advance(s, network, 2000, true, checkpoint); assert.equal(s.phase, 'arrival'); assert.equal(s.location, 'b');
});
test('physical partial turnaround conserves actual return distance and never teaches an uncompleted city itinerary', () => {
  const { s, network } = passenger(); Passenger.advance(s, network, 1000, true, { id: 'fort', km: 4 });
  assert.ok(Passenger.turnBack(s, 1000)); assert.equal(s.trip.km, 4); Passenger.advance(s, network, 2000);
  assert.equal(s.location, 'a'); assert.equal(s.phase, 'arrival'); assert.equal(s.vehicle.fuelKm, 2400 - 8);
  assert.equal(March.learn(March.create({ worldId: 'w', runId: 'r' }), s, 2000), false);
});
