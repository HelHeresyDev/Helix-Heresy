const { test } = require('node:test');
const assert = require('node:assert/strict');
const Bargains = require('../sovereign-bargains');
const World = require('../strategic-world');
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(theme = 'madcap', collective = false) {
  const office = { id: 'office:a', cityId: 'a', institutionId: 'administration:a', active: true, channelPowered: true,
    clerk: { id: 'clerk:a', status: 'alive', health: 100, locationId: 'office:a' }, power: 10, workSeconds: 7200, assignment: null, availableAt: 0 };
  const source = { cityId: 'a', charterId: 'charter:a', administrationId: office.institutionId, defenseId: 'defense:a', defenseName: 'Aster defense',
    authority: { id: 'ruler:a', name: 'Aster authority', kind: collective ? 'collective' : 'individual' },
    archive: { routeId: 'route:a', source: 'Defense archive', sourceDate: null, coverage: [{ cellId: 'cell:a', latitude: 1, longitude: 2 }], notes: ['Approach only'] } };
  return { office, source, s: Bargains.create(source, office, { theme, seed: 'test' }),
    c: { alive: true, capable: true, atCounter: true, clerkPresent: true, lineOfSight: true, cityId: 'a', visitPermission: true,
      administrationAvailable: true, defenseAvailable: true, authorityId: 'ruler:a', participantsPresent: true, busy: false, bodyEpoch: 0 } };
}
function offered(f) {
  assert.equal(Bargains.request(f.s, f.office, f.c, 0, 600), true);
  assert.equal(Bargains.attend(f.s, f.office, f.c, 599), false);
  assert.equal(Bargains.attend(f.s, f.office, f.c, 600), true);
  Bargains.advance(f.s, f.office, f.c, 1500);
  assert.equal(f.s.terms.status, 'offered');
}
function signed(f) { offered(f); assert.equal(Bargains.sign(f.s, f.office, copy(f.s.terms), f.c, 1500), true); }
const stack = (id, quantity, extra = {}) => ({ id, key: 'metalParts', quantity, knownQuantity: quantity, carriedBy: 'scientist', tags: [], ...extra });

test('all themes use the shared bounded exchange; a collective is represented, not replaced', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) {
    const f = fixture(theme, true);
    assert.match(f.s.representative.role, /collective/); assert.equal(f.s.source.authority.kind, 'collective');
    assert.equal(f.s.sourceTheme, 'shared'); assert.equal(f.s.depot.stock, 0);
    assert.equal(Bargains.create(f.source, { ...f.office, institutionId: 'other' }), null);
    assert.equal(Bargains.normalize(null), null);
  }
});
test('audiences require local capable people, current authority and unoccupied shared counter, without assay qualification', () => {
  for (const key of ['alive', 'capable', 'atCounter', 'clerkPresent', 'lineOfSight', 'visitPermission', 'administrationAvailable', 'defenseAvailable', 'participantsPresent']) {
    const f = fixture(); assert.equal(Bargains.request(f.s, f.office, { ...f.c, [key]: false }, 0, 600), false); assert.equal(f.s.audience, null);
  }
  const f = fixture(); f.office.assignment = 'map-copy';
  assert.equal(Bargains.request(f.s, f.office, f.c, 0, 600), false);
  f.office.assignment = null; assert.equal(Bargains.request(f.s, f.office, f.c, 0, null), false);
  assert.equal(Bargains.request(f.s, f.office, f.c, 0, 600), true);
  assert.equal(Bargains.request(f.s, f.office, f.c, 1, 601), false);
  assert.equal(f.s.contacts.length, 2); assert.equal(f.s.copies.length, 0); assert.equal(f.office.power, 10);
});
test('attended work consumes finite shared resources; reload preserves progress and interrupted actors cannot backfill', () => {
  const f = fixture(); Bargains.request(f.s, f.office, f.c, 0, 600); Bargains.attend(f.s, f.office, f.c, 600);
  Bargains.advance(f.s, f.office, f.c, 900); assert.equal(f.s.job.progress, 300);
  f.s = Bargains.normalize(f.s); f.s.defender.health = 0;
  Bargains.advance(f.s, f.office, f.c, 1200); assert.equal(f.s.job.progress, 300); assert.equal(f.office.assignment, null);
  f.s.defender.health = 100; Bargains.advance(f.s, f.office, f.c, 1500); assert.equal(f.s.job.progress, 300);
  Bargains.advance(f.s, f.office, f.c, 2100); assert.equal(f.s.job, null); assert.equal(f.s.terms.offeredAt, 2100);
  assert.equal(f.office.workSeconds, 7200 - 900); assert.equal(f.s.defender.workSeconds, 3600 - 900);
  assert.equal(f.office.power, 9); assert.equal(Bargains.attend(f.s, f.office, f.c, 2200), false);
});
test('changed exact terms, expired offers and refusal move no supplies or information and invent no crime', () => {
  const f = fixture(); offered(f); const altered = { ...copy(f.s.terms), quantity: 1 };
  assert.equal(Bargains.sign(f.s, f.office, altered, f.c, 1500), false);
  assert.equal(Bargains.sign(f.s, f.office, copy(f.s.terms), f.c, f.s.terms.expiresAt), false);
  assert.equal(Bargains.decline(f.s, f.office, f.c, 1500), true);
  assert.equal(f.s.terms.status, 'declined'); assert.equal(f.s.depot.stock, 0); assert.deepEqual(f.s.copies, []);
  assert.match(f.s.message, /without a criminal allegation/);
});
test('only actual clean carried unreserved whole portions transfer once; partial receipts cannot buy a map', () => {
  const f = fixture(); signed(f);
  const goods = [stack('home', 10, { carriedBy: '' }), stack('reserved', 10, { reservedTaskId: 'task' }), stack('dirty', 10, { tags: ['contaminated'] }), stack('first', 2)];
  assert.equal(Bargains.deliver(f.s, f.office, goods, f.c, 1501), true);
  assert.equal(f.s.depot.stock, 2); assert.deepEqual(goods.map(i => i.quantity), [10, 10, 10, 0]);
  assert.equal(Bargains.claim(f.s, f.office, f.c, 1502), false);
  f.s = Bargains.normalize(f.s); assert.equal(f.s.depot.receipts.length, 1);
  goods.push(stack('remaining', 5)); assert.equal(Bargains.deliver(f.s, f.office, goods, f.c, 1502), true);
  assert.equal(goods.at(-1).quantity, 1); assert.equal(f.s.depot.stock, 6);
  assert.equal(Bargains.deliver(f.s, f.office, goods, f.c, 1503), false);
  assert.equal(Bargains.claim(f.s, f.office, f.c, f.s.terms.deliverBy + 10), true);
  Bargains.advance(f.s, f.office, f.c, f.s.terms.deliverBy + 310);
  assert.equal(f.s.terms.status, 'fulfilled'); assert.equal(f.s.copies.length, 1);
  assert.equal(Bargains.claim(f.s, f.office, f.c, f.s.terms.deliverBy + 311), false);
  assert.equal(f.s.copies[0].sourceDate, null); assert.match(f.s.copies[0].limitations, /joint-stronghold/);
});
test('leaving cancels attended work, missed partial delivery retains custody, and bodily change does not inherit the bargain', () => {
  const f = fixture(); signed(f); const goods = [stack('partial', 2)]; Bargains.deliver(f.s, f.office, goods, f.c, 1501);
  assert.equal(Bargains.deliver(f.s, f.office, [stack('replacement', 4)], { ...f.c, bodyEpoch: 1 }, 1502), false);
  Bargains.advance(f.s, f.office, { ...f.c, atCounter: false }, f.s.terms.deliverBy + 1);
  assert.equal(f.s.terms.status, 'expired'); assert.equal(f.s.depot.stock, 2); assert.equal(f.s.copies.length, 0);
  const g = fixture(); offered(g);
  // Leaving midway through an audience preserves its allocation and spent work.
  const h = fixture(); Bargains.request(h.s, h.office, h.c, 0, 1); Bargains.attend(h.s, h.office, h.c, 1);
  Bargains.advance(h.s, h.office, h.c, 101); Bargains.advance(h.s, h.office, { ...h.c, atCounter: false }, 201);
  assert.equal(h.s.job, null); assert.equal(h.s.audience.status, 'interrupted'); assert.equal(h.s.terms, null);
  assert.equal(h.office.workSeconds, 7100);
});
test('unreleased archive, live supplies and actor state stay private; death freezes rather than finishing the work', () => {
  const f = fixture(); signed(f); const view = Bargains.publicView(f.s);
  assert.equal(JSON.stringify(view).includes('latitude'), false); assert.equal(JSON.stringify(view).includes('workSeconds'), false);
  assert.equal(JSON.stringify(view).includes('health'), false); assert.equal(JSON.stringify(view).includes('exceptionalCapabilities'), false);
  const frozen = copy(f.s); assert.equal(Bargains.advance(f.s, f.office, { ...f.c, alive: false }, 1000000), false); assert.deepEqual(f.s, frozen);
});
test('saved geodesic charter binding takes only the home end of a corridor and never mutates the reusable world', () => {
  // Generate actual globe geometry, but fixture just the charter dependencies:
  // this test needs no unrelated civilization-history simulation.
  const map = World.createStrategicMap('audience-route-foundation', { refinementLevel: 1 });
  const origin = World.cellSnapshot(map, 1), neighbor = origin.neighborIds[0];
  map.routeGraph.routes = [{ id: 'corridor:a-b', endpointIds: ['a', 'b'], cellPath: [origin.id, neighbor] }];
  map.humanGeography = { cities: [{ id: 'a', name: 'Aster' }, { id: 'b', name: 'Birch' }] };
  map.cityGovernments = { governments: ['a', 'b'].map(id => ({ cityId: id, sovereigntyScope: 'cityOnly',
    charter: { id: `charter:${id}`, successionPrinciple: 'Recorded appointment' },
    roleAssignments: { centralAdministration: `administration:${id}`, militaryDefenseCommand: `defense:${id}` },
    institutions: [{ id: `administration:${id}`, name: 'Administration' }, { id: `defense:${id}`, name: 'Defense Command' }] })) };
  map.cityPolities = { polities: ['a', 'b'].map(id => ({ cityId: id, authority: { id: `ruler:${id}`, kind: 'individual', name: id } })) };
  map.strategicPlayableSettlementState = { cityRows: ['a', 'b'].map(id => ({ cityId: id, assetId: id, currentPopulation: 100,
    physicalCondition: 'intact', services: { fortifications: 'functional' } })) };
  map.strategicCivicHistory = { currentInstitutionRows: ['a', 'b'].flatMap(id => ['administration', 'defense'].map(role => ({
    institutionId: `${role}:${id}`, operationalStatus: 'operational', actualControlStatus: 'localCharter' }))) };
  const before = JSON.stringify(map); let supported = 0;
  for (const g of map.cityGovernments.governments) {
    const office = { cityId: g.cityId, institutionId: g.roleAssignments.centralAdministration };
    const source = Bargains.sourceFromWorld(map, g.cityId, office);
    if (!source) continue;
    supported++;
    const route = map.routeGraph.routes.find(r => r.id === source.archive.routeId);
    const ordered = route.endpointIds[0] === g.cityId ? route.cellPath : [...route.cellPath].reverse();
    assert.deepEqual(source.archive.coverage.map(c => c.cellId), ordered.slice(0, 3));
    const first = World.cellSnapshot(map, World.cellIndex(ordered[0])); assert.equal(source.archive.coverage[0].latitude, first.latitude);
    assert.equal(Bargains.sourceFromWorld(map, g.cityId, { ...office, institutionId: 'foreign' }), null);
  }
  assert.ok(supported > 0); assert.equal(JSON.stringify(map), before);
  assert.equal(Bargains.sourceFromWorld(map, 'stronghold:unsupported', { cityId: 'stronghold:unsupported' }), null);
  const office = { cityId: 'a', institutionId: 'administration:a' };
  map.strategicPlayableSettlementState.cityRows[0].currentPopulation = 0;
  assert.equal(Bargains.sourceFromWorld(map, 'a', office), null);
  map.strategicPlayableSettlementState.cityRows[0].currentPopulation = 100;
  map.strategicCivicHistory.currentInstitutionRows[0].actualControlStatus = 'overtOccupation';
  assert.equal(Bargains.sourceFromWorld(map, 'a', office), null);
});
test('a fresh explicit audience keeps old partial custody and fixed archive, without replenishing actors or shared resources', () => {
  const f = fixture(); signed(f); Bargains.deliver(f.s, f.office, [stack('old', 2)], f.c, 1501);
  const work = f.s.defender.workSeconds, archive = copy(f.s.source.archive);
  Bargains.decline(f.s, f.office, f.c, 1502);
  assert.equal(Bargains.request(f.s, f.office, f.c, 1503, 1800), true);
  assert.equal(f.s.priorTerms[0].status, 'declined'); assert.equal(f.s.priorAudiences.length, 1);
  assert.equal(f.s.depot.stock, 2); assert.equal(f.s.depot.receipts.length, 1);
  assert.equal(f.s.defender.workSeconds, work); assert.deepEqual(f.s.source.archive, archive);
});
