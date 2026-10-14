const { test, expect } = require('@playwright/test');
const Civic = require('../foreign-civic-bargains');
const World = require('../strategic-world');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const g = { id: 'receiving:b', cityId: 'b', label: 'B Receiving', institutionId: 'admin:b', z: 22, materialized: true,
    checkpointRoomId: 'checkpoint:b', visitorAdmission: {}, powerSeconds: 86400, receptionWorkSeconds: 14400, receptionAssignment: null,
    clerk: { id: 'clerk:b', status: 'alive', health: 100, fatigue: 0, present: true } };
  const source = { cityId: 'b', charterId: 'charter:b', administrationId: 'admin:b', defenseId: 'defense:b', defenseName: 'B Defense',
    populationSourceId: 'population:b', authority: { id: 'ruler:b', kind: 'individual', name: 'B Authority' },
    archive: { routeId: 'route:bc', source: 'B retained chart', sourceDate: null,
      coverage: [{ cellId: 'planet-cell:00001', latitude: 1, longitude: 2 }, { cellId: 'planet-cell:00002', latitude: 3, longitude: 4 }],
      notes: ['City end only; no safe passage promised.'] } };
  const c = { source: copy(source), alive: true, capable: true, originalBody: true, custodyActive: false, local: true, atDesk: true,
    clerkPresent: true, lineOfSight: true, cityId: 'b', bodyEpoch: 0, visitId: 'visit-b', authorityCurrent: true, otherBusy: false, participantsPresent: true, bans: [] };
  g.foreignCivic = Civic.create(g, source, { theme: 'unbound', seed: 'foreign-civic' });
  return { g, c };
}
const act = (f, kind, expected = null, now = 0, stacks = []) => Civic.action(f.g, f.c, kind, expected, now, stacks);
function permit(f) {
  expect(act(f, 'reviewAccess', Civic.quote(f.g, f.c, 0))).toBe(true); Civic.advance(f.g, f.c, 60);
  expect(act(f, 'acceptAccess', copy(f.g.foreignCivic.accessOffer), 60)).toBe(true); Civic.advance(f.g, f.c, 120);
  expect(Civic.permission(f.g, f.c, 120)).toBeTruthy();
}
function offered(f) {
  permit(f); expect(act(f, 'request', null, 120)).toBe(true);
  expect(act(f, 'attend', null, 419)).toBe(false); expect(act(f, 'attend', null, 420)).toBe(true);
  Civic.advance(f.g, f.c, 1320); expect(f.g.foreignCivic.bargain.terms.status).toBe('offered');
}
function sign(f) { offered(f); expect(act(f, 'sign', copy(f.g.foreignCivic.bargain.terms), 1321)).toBe(true); }
const part = (id, quantity, extra = {}) => ({ id, key: 'metalParts', quantity, knownQuantity: quantity, carriedBy: 'scientist', tags: [], ...extra });
test('foreign source uses existing independent charter, functional offices and its own end of an actual globe route', () => {
  const map = World.createStrategicMap('foreign-civic-source', { refinementLevel: 1 });
  const a = World.cellSnapshot(map, 1), b = a.neighborIds[0], c = World.cellSnapshot(map, World.cellIndex(b)).neighborIds.find(id => id !== a.id);
  map.routeGraph.routes = [{ id: 'bc', endpointIds: ['c', 'b'], cellPath: [c, b, a.id] }];
  map.humanGeography = { cities: [{ id: 'b', name: 'Birch' }] };
  map.cityGovernments = { governments: [{ cityId: 'b', sovereigntyScope: 'cityOnly', charter: { id: 'charter:b' },
    roleAssignments: { centralAdministration: 'admin:b', militaryDefenseCommand: 'defense:b' },
    institutions: [{ id: 'admin:b', name: 'B Administration', capacityBand: 'functional' }, { id: 'defense:b', name: 'B Defense', capacityBand: 'strong' }] }] };
  map.cityPolities = { polities: [{ cityId: 'b', authority: { id: 'ruler:b', kind: 'collective' } }] };
  map.strategicPlayableSettlementState = { cityRows: [{ cityId: 'b', assetId: 'population:b', currentPopulation: 100, physicalCondition: 'intact', services: { fortifications: 'functional' } }] };
  const g = fixture().g, original = copy(map), source = Civic.sourceFromWorld(map, g);
  expect(source.archive.coverage.map(c => c.cellId)).toEqual([a.id, b]); expect(source.authority.kind).toBe('collective'); expect(map).toEqual(original);
  for (const change of [m => m.cityGovernments.governments[0].sovereigntyScope = 'jointStronghold', m => m.cityGovernments.governments[0].institutions[1].capacityBand = 'fragile',
    m => m.cityPolities.polities = [], m => m.routeGraph.routes = [], m => m.routeGraph.routes[0].cellPath = [b, a.id], m => m.strategicPlayableSettlementState.cityRows[0].currentPopulation = 5,
    m => m.strategicCivicHistory = { currentInstitutionRows: [] },
    m => m.strategicCivicHistory = { currentInstitutionRows: ['admin:b', 'defense:b'].map(institutionId => ({ institutionId, currentCapacityBand: 'strong', operationalStatus: 'displaced', actualControlStatus: 'displacedCharter' })) }]) {
    const bad = copy(map); change(bad); expect(Civic.sourceFromWorld(bad, g)).toBeNull();
  }
});
test('foreign people and installation are city-backed original actors at the real desk, not home clones or free stock', () => {
  const f = fixture(), s = f.g.foreignCivic;
  expect(s.bargain.representative).toMatchObject({ id: 'ruler:b:supply-representative', roomId: 'checkpoint:b', mapCell: { x: 9, y: 8, z: 22 }, workSeconds: 3600 });
  expect(s.bargain.defender).toMatchObject({ id: 'defense:b:ward-defender', roomId: 'checkpoint:b', physicalStrength: 80 });
  expect(s.bargain.allocation).toEqual({ populationSourceId: 'population:b', people: 2, institutionId: 'defense:b' }); expect(s.bargain.depot.stock).toBe(0);
  expect(Civic.create(f.g, { ...s.bargain.source, cityId: 'home' })).toBeNull(); expect(copy(f.g).foreignCivic).toEqual(s);
});
test('a municipal introduction needs explicit exact disclosure, spends finite clerk work once and grants neither civic access nor a bargain', () => {
  const f = fixture(); expect(act(f, 'introduce')).toBe(false); expect(f.g.foreignCivic.introduction).toBeNull();
  f.c.introduction = { cityId: 'b', bodyEpoch: 0, reportId: 'actual-received-municipal-report', officerId: 'original-officer', receivedAt: 0 };
  expect(act(f, 'introduce', { ...f.c.introduction, reportId: 'substitute' })).toBe(false);
  expect(act(f, 'introduce', copy(f.c.introduction))).toBe(true); expect(f.g.receptionWorkSeconds).toBe(14340);
  expect(act(f, 'introduce', copy(f.c.introduction))).toBe(false); expect(f.g.foreignCivic.permits).toEqual([]); expect(f.g.foreignCivic.bargain.terms).toBeNull();
});
test('separate reviewed access spends shared original clerk work and power without needing or extending visitor trading or lodging', () => {
  const f = fixture(); f.c.visitorPermit = { scope: 'visitorHallOnly', expiresAt: 1000 }; f.c.lodgingPermit = { expiresAt: 2000 };
  expect(act(f, 'request')).toBe(false); const q = Civic.quote(f.g, f.c, 0);
  expect(q.position).toMatch(/opposes the gods/); expect(q.scope).toMatch(/No visitor-hall trading/);
  expect(act(f, 'reviewAccess', { ...q, window: 999 })).toBe(false); permit(f);
  expect(f.g.receptionWorkSeconds).toBe(14280); expect(f.g.powerSeconds).toBe(86280); expect(f.g.receptionAssignment).toBeNull();
  expect(Civic.permission(f.g, f.c, 120)).toMatchObject({ issuedAt: 120, expiresAt: 120 + Civic.ACCESS_WINDOW, scope: 'foreignCivicSupplyCounterOnly' });
  expect(f.c.visitorPermit.expiresAt).toBe(1000); expect(f.c.lodgingPermit.expiresAt).toBe(2000);
  expect(Civic.permission(f.g, { ...f.c, visitId: 'next-visit' }, 121)).toBeNull();
});
test('access fails closed on absent original people, changed source, custody, exclusion or occupied reception queue', () => {
  for (const change of [f => f.c.atDesk = false, f => f.c.originalBody = false, f => f.c.custodyActive = true, f => f.c.source.authority.id = 'other',
    f => f.c.bans = [{ cityId: 'b', status: 'active' }], f => f.c.otherBusy = true, f => f.g.clerk.id = 'replacement', f => f.g.clerk.status = 'dead',
    f => f.g.receptionAssignment = 'visitor-review', f => f.g.receptionWorkSeconds = 119, f => f.g.powerSeconds = NaN]) {
    const f = fixture(); change(f); expect(Civic.quote(f.g, f.c, 0)).toBeNull(); expect(f.g.foreignCivic.permits).toEqual([]);
  }
});
test('access work survives absence and reload without backfill; changed body cannot finish or inherit it', () => {
  let f = fixture(); act(f, 'reviewAccess', Civic.quote(f.g, f.c, 0)); Civic.advance(f.g, f.c, 30); f = copy(f);
  f.c.atDesk = false; Civic.advance(f.g, f.c, 1000); expect(f.g.foreignCivic.accessJob.progress).toBe(30);
  f.c.atDesk = true; Civic.advance(f.g, f.c, 2000); expect(f.g.foreignCivic.accessJob.progress).toBe(30);
  Civic.advance(f.g, f.c, 2030); expect(f.g.foreignCivic.accessOffer.issuedAt).toBe(2030);
  act(f, 'acceptAccess', copy(f.g.foreignCivic.accessOffer), 2030); f.c.bodyEpoch++; Civic.advance(f.g, f.c, 2090);
  expect(f.g.foreignCivic.accessJob).toBeNull(); expect(f.g.foreignCivic.permits).toEqual([]); expect(f.g.receptionWorkSeconds).toBe(14340);
});
test('exact unsigned access expiry grants no permission, including absent attendance and a completion at the boundary', () => {
  for (const absent of [false, true]) {
    const f = fixture(); act(f, 'reviewAccess', Civic.quote(f.g, f.c, 0)); Civic.advance(f.g, f.c, 60);
    const offer = copy(f.g.foreignCivic.accessOffer), at = offer.expiresAt - 60;
    expect(act(f, 'acceptAccess', offer, at)).toBe(true); f.c.atDesk = !absent;
    Civic.advance(f.g, f.c, offer.expiresAt); expect(f.g.foreignCivic.accessJob).toBeNull(); expect(f.g.foreignCivic.permits).toEqual([]);
    expect(f.g.foreignCivic.message).toMatch(/no permission granted/);
  }
});
test('fractional clock rounding cannot strand fully attended access or copying a few trillionths short', () => {
  const f = fixture(); act(f, 'reviewAccess', Civic.quote(f.g, f.c, 0));
  f.g.foreignCivic.accessJob.progress = 30 - 1e-12; Civic.advance(f.g, f.c, 30);
  expect(f.g.foreignCivic.accessJob).toBeNull(); expect(f.g.foreignCivic.accessOffer).toBeTruthy();
  const g = fixture(); sign(g); act(g, 'deliver', null, 1322, [part('real', 6)]); act(g, 'claim', null, 1323);
  g.g.foreignCivic.bargain.job.progress = 150 - 1e-12; Civic.advance(g.g, g.c, 1473);
  expect(Civic.knownAlignment(g.g.foreignCivic)).toHaveLength(1);
});
test('audience uses original foreign authority and defender and holds partially spent work through outages', () => {
  let f = fixture(); permit(f); expect(act(f, 'request', null, 120)).toBe(true); expect(act(f, 'attend', null, 420)).toBe(true);
  Civic.advance(f.g, f.c, 870); expect(f.g.foreignCivic.bargain.job.progress).toBe(450); f = copy(f);
  f.g.foreignCivic.bargain.defender.health = 0; Civic.advance(f.g, f.c, 1170); expect(f.g.foreignCivic.bargain.job.progress).toBe(450);
  f.g.foreignCivic.bargain.defender.health = 100; Civic.advance(f.g, f.c, 1670); expect(f.g.foreignCivic.bargain.job.progress).toBe(450);
  Civic.advance(f.g, f.c, 2120); const s = f.g.foreignCivic;
  expect(s.bargain.terms.status).toBe('offered'); expect(s.bargain.terms.disclosure).toMatch(/fundamentally opposes/);
  expect(s.bargain.defender.workSeconds).toBe(2700); expect(f.g.receptionWorkSeconds).toBe(13380); expect(f.g.powerSeconds).toBe(85379);
  expect(s.bargain.contacts.every(p => p.location.includes('B Receiving'))).toBe(true); expect(s.bargain.copies).toEqual([]);
});
test('full carried supply receipt and attended copying alone yield one dated alignment; partial, unowned or tainted goods buy nothing', () => {
  let f = fixture(); sign(f); const b = f.g.foreignCivic.bargain;
  const goods = [part('lab-stock', 20, { carriedBy: '' }), part('reserved', 6, { reservedTaskId: 'other' }), part('dirty', 6, { tags: ['contaminated'] }), part('first', 2)];
  expect(act(f, 'deliver', null, 1322, goods)).toBe(true); expect(goods.map(i => i.quantity)).toEqual([20, 6, 6, 0]); expect(b.depot.stock).toBe(2);
  expect(act(f, 'claim', null, 1323)).toBe(false); expect(Civic.knownAlignment(f.g.foreignCivic)).toEqual([]);
  expect(JSON.stringify(f.g.foreignCivic.knowledge)).not.toMatch(/latitude|longitude|workSeconds|health|exceptionalCapabilities/);
  f = copy(f); const rest = [part('second', 4)]; expect(act(f, 'deliver', null, 1324, rest)).toBe(true); expect(rest[0].quantity).toBe(0);
  expect(act(f, 'claim', null, 1325)).toBe(true); Civic.advance(f.g, f.c, 1475); expect(Civic.knownAlignment(f.g.foreignCivic)).toEqual([]);
  f = copy(f); Civic.advance(f.g, f.c, 1625); const records = Civic.knownAlignment(f.g.foreignCivic);
  expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ cityId: 'b', issuerId: 'defense:b', issuedAt: 1625, sourceDate: null });
  expect(records[0].coverage).toEqual(f.g.foreignCivic.bargain.source.archive.coverage); expect(records[0].limitations).toMatch(/No resource surveys/);
  expect(act(f, 'claim', null, 1626)).toBe(false); expect(f.g.foreignCivic.bargain.depot.receipts).toHaveLength(2);
});
test('missed deadline retains partial installation custody, while civic access expiry never automatically renews or lets a new body claim', () => {
  const f = fixture(); sign(f); const b = f.g.foreignCivic.bargain; act(f, 'deliver', null, 1322, [part('partial', 2)]);
  const due = b.terms.deliverBy; Civic.advance(f.g, f.c, due + 1); expect(b.terms.status).toBe('expired'); expect(b.depot.stock).toBe(2);
  expect(Civic.permission(f.g, f.c, due + 1)).toBeNull(); expect(act(f, 'deliver', null, due + 1, [part('late', 4)])).toBe(false);
  expect(Civic.knownAlignment(f.g.foreignCivic)).toEqual([]);
  const g = fixture(); sign(g); g.c.bodyEpoch++; expect(act(g, 'deliver', null, 1322, [part('newbody', 6)])).toBe(false);
});
test('original queue is never preempted; absence or death cannot remotely disclose or complete a copy', () => {
  const f = fixture(); sign(f); const before = copy(f.g.foreignCivic.knowledge);
  f.c.atDesk = false; Civic.advance(f.g, f.c, 2000); expect(f.g.foreignCivic.knowledge).toEqual(before);
  f.c.atDesk = true; f.g.receptionAssignment = 'other-original-work'; expect(act(f, 'deliver', null, 2001, [part('supply', 6)])).toBe(false);
  expect(f.g.receptionAssignment).toBe('other-original-work');
  f.g.receptionAssignment = null; act(f, 'deliver', null, 2002, [part('supply', 6)]); act(f, 'claim', null, 2003);
  const frozen = copy(f.g); f.c.alive = false; expect(Civic.advance(f.g, f.c, 900000)).toBe(false); expect(f.g).toEqual(frozen);
  expect(Civic.knownAlignment(f.g.foreignCivic)).toEqual([]);
});
