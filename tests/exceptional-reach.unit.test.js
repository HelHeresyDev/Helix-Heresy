const { test } = require('node:test');
const assert = require('node:assert/strict');
const X = require('../exceptional-reach');
const I = require('../network-inventories');
const N = require('../network-operations');
const C = require('../castaway-assistance');
const E = require('../component-expedition');
const A = require('../city-approach');
const Civic = require('../civic-communications');
const { world, Definitions, binding } = require('./helpers/institutional-inventory-source');
const copy = x => JSON.parse(JSON.stringify(x));
function commissioning(map) {
  map.strategicCapabilityHistory = { historicalHorizonYear: 1000, milestoneRows: Object.entries(X.FUNCTIONS).map(([capabilityId, kind]) => ({
    capabilityId, standardizationYear: 100, institution: { id: `institute:${capabilityId}` }, infrastructureRows: [{
      id: `commissioned:${capabilityId}`, capabilityId, function: kind, cityId: 'city:0', cellId: 'cell:0',
      operatingInstitutionId: `institute:${capabilityId}`, commissionedYear: 200, operationalAtPlayableYear: true }] })) };
  map.strategicNonStateNetworkHistory.eventRows.push({ id: 'original-activation', kind: 'advancedServiceActivated',
    networkIds: ['original:0'], cityId: 'city:0', year: 300, exactFactors: { capabilityId: 'orbitalArcaneRelayMesh', orbitalRoles: ['orbitalRelayOperations'] } });
  return map;
}
function accounts(category = 'transport') {
  const map = commissioning(world([Definitions.find(d => d.category === category)]));
  return { map, n: N.create(N.sources(map, 'exceptional-originals'), binding, 0, { originalInventory: true }) };
}
function flight() {
  const p = C.service({ id: 'known-contact' }, { id: 'original-pad', cityId: 'a', cellId: 'original-cell' }, 'Original Pilot', 0);
  Object.assign(p, { dutySeconds: 28800, provisionsSeconds: 43200, radioSeconds: 14400 });
  const c = { alive: true, capable: true, free: true, atOrigin: true, pilotPresent: true,
    departurePermission: true, receivingPermission: true, surfaceRoadConnected: false, cargoKg: 2, cargoL: 3 };
  return { p, c };
}
test('commissioning identities, operating institutions and service activations are fixed evidence, never a second fleet or body allocation', () => {
  const { map, n } = accounts(), before = copy(map), assets = copy(n.inventories.assets);
  assert.equal(n.source.exceptionalSources.sites.length, 5); assert.deepEqual(n.source.exceptionalSources.gaps, []);
  assert.ok(n.source.exceptionalSources.sites.every(s => s.state === 'commissionedOperationOnly'));
  assert.equal(n.source.exceptionalSources.activations[0].state, 'activatedServiceOnly');
  assert.deepEqual(X.sources(map), X.sources(copy(map))); assert.deepEqual(map, before);
  const result = X.outcomes(n, {}, I.assess); assert.equal(result.strategicComplete, false);
  assert.ok(result.owners.every(o => o.activations[0].scope.includes('not a hardware deed')));
  assert.deepEqual(n.inventories.assets, assets); assert.ok(!assets.some(a => ['rocket', 'satellite', 'flyingMount', 'aircraft'].includes(a.kind)));
});
test('missing, conflicting or invalid commissioning/activation never becomes a working rocket, satellite command or space-capable individual', () => {
  assert.equal(X.sources({}).state, 'unverified');
  for (const change of [m => m.strategicCapabilityHistory.milestoneRows[0].infrastructureRows[0].operatingInstitutionId = 'another-institute',
    m => m.strategicCapabilityHistory.milestoneRows[0].infrastructureRows[0].commissionedYear = 1,
    m => m.strategicCapabilityHistory.milestoneRows.push(copy(m.strategicCapabilityHistory.milestoneRows[0]))]) {
    const { map } = accounts(); change(map); const s = X.sources(map);
    assert.ok(s.gaps.length || s.sites.some(s => s.state === 'unverifiedCommissioning'));
  }
  const { n } = accounts(); n.source.exceptionalSources.sites = null;
  assert.equal(N.normalize(n).invalid, true); assert.equal(X.outcomes(n, {}, I.assess).state, 'unverified');
  const { map } = accounts(); map.strategicNonStateNetworkHistory.eventRows[0].year = 1;
  assert.equal(X.sources(map).activations[0].state, 'unverifiedActivation');
});
test('a real independent provider is not appropriated by an advertised orbital role or a network membership field', () => {
  const { n } = accounts(), { p } = flight(); p.networkId = 'original:0';
  const run = { penalFlights: { assistance: { services: [p], cityApproach: { trips: [] } } } }, before = copy([n, run]);
  const result = X.outcomes(n, run, I.assess);
  assert.equal(result.providers[0].state, 'independentOriginalProvider'); assert.equal(result.providers[0].originalOwner.ownerId, 'known-contact');
  assert.ok(result.owners.every(o => !o.interfaces.some(i => i.id === p.aircraft.id))); assert.deepEqual(copy([n, run]), before);
  run.penalFlights.assistance.services.push(copy(p));
  assert.equal(X.providerViews(run).length, 1); assert.equal(X.providerViews(run)[0].state, 'conflictingProviderAliases');
});
test('actual flight can cross disconnected surface networks, but requires original owners, range, full return support and independent permissions', () => {
  const f = flight(); assert.equal(X.flightReach(f.p, 200, f.c, 0).state, 'supportedCivilianFlight');
  assert.equal(X.flightReach(f.p, 200, { ...f.c, surfaceRoadConnected: true }, 0).state, 'supportedCivilianFlight');
  for (const change of [f => f.p.aircraft.rangeKm = 199, f => f.p.aircraft.fuelKm = 449,
    f => f.p.aircraft.reservedBy = 'medical-rescue', f => f.p.pilot.health = 10, f => f.p.dutySeconds = 1,
    f => f.p.provisionsSeconds = 1, f => f.c.cargoKg = 41, f => f.c.cargoL = 61, f => f.c.passengers = 3,
    f => f.c.receivingPermission = false, f => f.c.departurePermission = false, f => f.c.weatherReason = 'storm',
    f => f.p.aircraft.condition = 49, f => f.p.aircraft.readyAt = 1, f => f.c.alive = false]) {
    const f = flight(); change(f); assert.notEqual(X.flightReach(f.p, 200, f.c, 0).state, 'supportedCivilianFlight');
  }
});
test('lost original ownership, employment, source pad or accounting cannot be repaired by a new charter or replacement person', () => {
  for (const change of [p => delete p.originalOwner, p => p.aircraft.ownerId = 'network', p => p.pilot.employerId = 'another-employer',
    p => p.pilot.id = 'replacement', p => p.pad.ownerId = 'another-operator', p => p.pad.cellId = 'another-continent']) {
    const { p, c } = flight(); const booked = X.charter(p, 'trip'); change(p);
    assert.equal(X.originalProvider(p), false); assert.equal(X.current(booked, p, 'trip'), false);
    assert.equal(X.charter(p, 'new-trip'), null); assert.equal(X.flightReach(p, 1, c, 0).state, 'unverified');
  }
  const { p } = flight(), booked = X.charter(p, 'trip');
  p.contactId = p.aircraft.ownerId = p.pilot.employerId = p.pad.ownerId = 'new-owner';
  p.originalOwner.ownerId = p.originalOwner.employerId = p.originalOwner.padOperatorId = 'new-owner';
  assert.equal(X.originalProvider(p), true); assert.equal(X.current(booked, p, 'trip'), false);
});
test('orbital gateway interfaces retain their real port and shared infrastructure references, never constellation title or fresh power', () => {
  const map = commissioning(world([Definitions.find(d => d.category === 'media' && d.roles.includes('relayOperations'))]));
  map.strategicNonStateNetworkHistory.branchRows[0].organizationForm = 'orbitalRelayGateway';
  const n = N.create(N.sources(map, 'original-relay'), binding, 0, { originalInventory: true });
  const s = Civic.create(Civic.sources(map, Definitions), binding, 0); assert.ok(s.sources.length);
  assert.ok(I.adopt(n, 'communications', s, binding)); s.ports[0].powerSeconds = 0;
  const before = copy([n, s]), r = X.outcomes(n, { civicCommunications: s }, I.assess);
  const owner = r.owners.find(o => o.id === 'branch:branch:0');
  assert.equal(owner.interfaces[0].current.powerSeconds, 0); assert.equal(owner.interfaces[0].siteId, 'commissioned:orbitalArcaneRelayMesh');
  assert.match(owner.interfaces[0].scope, /not ownership/); assert.equal(owner.state, 'unverifiedExceptionalMeans');
  assert.ok(owner.issues.some(s => s.includes('commissioning manifest'))); assert.deepEqual(copy([n, s]), before);
  assert.ok(!n.inventories.assets.some(a => a.id === 'commissioned:orbitalArcaneRelayMesh'));
});
test('new exceptional claims and missing owner facts remain named unknowns, not an absence-of-threat certificate', () => {
  const { n } = accounts(); const worker = n.inventories.assets.find(a => a.kind === 'person');
  worker.state.exceptionalCapabilities = ['individualSpaceflight'];
  const out = X.outcomes(n, {}, I.assess); assert.ok(out.owners.find(o => o.id === worker.ownerId).issues.some(s => s.includes(worker.id)));
  assert.equal(out.strategicComplete, false);
  delete n.source.exceptionalSources; assert.equal(X.outcomes(n, {}, I.assess).state, 'unverified');
  N.sync(n); assert.equal(n.source.exceptionalSources, undefined); // No retroactive source facts or assets.
});
test('every original advertised orbital role is scoped, and physical launch/interception/spacefarer claims retain specific missing-means issues', () => {
  const map = commissioning(world()), n = N.create(N.sources(map, 'all-original-orbital-roles'), binding, 0, { originalInventory: true });
  const result = X.outcomes(n, {}, I.assess);
  assert.equal(result.owners.length, Definitions.length * 4);
  for (let i = 0; i < Definitions.length; i++) {
    const owner = result.owners.find(o => o.kind === 'network' && o.networkId === `original:${i}`);
    assert.deepEqual(owner.roleScopes.map(r => r.role), Definitions[i].orbitalRoles);
    for (const r of owner.roleScopes.filter(r => ['individualSpacefarerRescue', 'orbitalThreatInterception', 'rocketLaunchServices'].includes(r.role))) {
      assert.equal(r.state, 'unverifiedOperationalMeans'); assert.ok(owner.issues.some(i => i.includes(r.role)));
    }
  }
  assert.equal(result.strategicComplete, false);
});
test('a departed original charter rejects changed owner facts without teleporting passengers or rewriting held knowledge', () => {
  const { p } = flight(), saved = A.create(), g = A.gate({ id: 'gate', cityId: 'b', institutionId: 'office', createdAt: 0,
    clerk: { id: 'clerk', status: 'alive', health: 100 }, guard: { id: 'guard', status: 'alive', health: 100 } });
  const t = A.request(saved, g.id, p.id, [{ id: 'scientist' }], 200, 0), c = { ...binding, bodyEpoch: 0, alive: true, atOrigin: true, pilotPresent: true };
  assert.ok(E.attach(t, g, p, { originCityId: 'a', destinationCityId: 'b', originComponentId: 'one', destinationComponentId: 'two' }, c,
    { roomId: 'original-origin', cell: { x: 1, y: 1, z: 6 } }, 0));
  E.receive(t, c, 0); const held = E.publicView(t); t.departedAt = 1; A.stage(t, 'outbound', 1, 100, 'Actually boarded');
  p.pilot.location = 'cityOutbound'; p.aircraft.reservedBy = t.id; p.aircraft.ownerId = 'another-owner';
  const fuel = p.aircraft.fuelKm; E.advance(t, g, p, c, 2);
  assert.equal(t.status, 'flightInterrupted'); assert.equal(p.pilot.location, 'cityOutbound'); assert.equal(p.aircraft.fuelKm, fuel);
  assert.deepEqual(E.publicView(t), held); assert.equal(t.returnedAt, undefined);
  const frozen = copy([t, p]); E.advance(t, g, p, { ...c, alive: false }, 10000); assert.deepEqual(copy([t, p]), frozen);
});
