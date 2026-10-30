const { test } = require('node:test'), assert = require('node:assert/strict');
const Library = require('../world-run-library'), Journeys = require('../strategic-journeys');
const Survey = require('../survey-expeditions'), Municipal = require('../municipal-carrier');
const Passenger = require('../intercity-passenger'), Networks = require('../strategic-non-state-network-history');
const Authority = require('../city-authority');
const NetworksBook = require('../network-operations'), Inventories = require('../network-inventories');
const Field = require('../network-interdiction'), Offensive = require('../offensive-mandates');
test('generated municipal-first starts preserve real distance/endurance and collective refusal rather than fabricating a concurrent governing route', () => {
  const world = Library.createWorld({ id: 'generated-city-access', worldSeed: 'charter-foundation', worldTheme: 'madcap', createdAt: 'test' });
  const map = world.generatedData.strategicMap, before = JSON.stringify(map);
  const starts = map.publicStartingSiteDirectory.scenarioRows.find(r => r.scenarioId === 'chemistryFront').candidates;
  const reachable = [];
  for (const site of starts) {
    const cityId = site.nearestSettlement.cityId, network = Journeys.defaultState({ strategicMap: map, startingSite: site });
    const collection = Journeys.routePlan(network, network.nearestSettlementDestinationId, network.homeDestinationId, 'hiredFreightRoad');
    const survey = Survey.destinationFor(network); if (!survey || !collection.ok) continue;
    network.destinations.push(survey);
    const outward = Survey.quote(Journeys.routePlan(network, network.homeDestinationId, survey.id, 'hiredFreightRoad'));
    const carrier = Municipal.fromWorld(map, cityId, 0);
    const reason = Municipal.reason(carrier, collection.legs.reduce((n, l) => n + l.distanceKm, 0), outward.distanceKm, 0);
    if (!reason) reachable.push({ site, cityId, network, carrier });
    // A genuinely long approach is not shortened to its municipal final leg.
    if (site.distance.practicalTravelKm > 50 && carrier) assert(reason.includes('finite'));
  }
  assert.equal(reachable.length, 4);
  const cities = [...new Set(reachable.map(r => r.cityId))].sort();
  assert.deepEqual(cities, ['city:09381', 'city:09512']);
  for (const cityId of cities) {
    const source = Authority.sourceFromWorld(map, cityId), counter = Authority.counterSource(map, cityId);
    assert(source && counter); assert.equal(source.parties[0].kind, 'collective');
    const book = Authority.create({ worldId: world.id, runId: 'original-run' }), e = Authority.register(book, source);
    const office = { id: counter.institutionId, clerk: { id: `${counter.institutionId}:original-clerk`, status: 'alive', health: 100 },
      power: 28800, workSeconds: 28800, assignment: null };
    let at = 0;
    // This is a best-case contact-input/model rejection check, not a claim of
    // physical attendance or full-game earnability. No result flags are set.
    const context = () => ({ alive: true, capable: true, local: true, atCounter: true, free: true, permission: true,
      sourceCurrent: true, clerkPresent: true, clerkId: office.clerk.id, bodyEpoch: 0, cityId, at });
    for (const action of ['inspect', 'negotiate']) {
      assert(Authority.begin(book, e, action, context(), office, at)); at += book.job.seconds;
      assert(Authority.advance(book, context(), office, at));
    }
    assert.equal(e.phase, 'refused'); assert.equal(e.operation, null); assert.deepEqual(e.resolutions, []);
    assert(!Authority.authorizes(e, book.authorities, context(), at));
    assert(book.authorities[0].members.some(m => m.policy === 'retainIndependence'));
    assert(book.authorities[0].members.every(m => m.status === 'alive' && m.dutySeconds < 1800));
    assert(!Authority.begin(book, e, 'negotiate', context(), office, at)); // Same original refusal cannot reroll.
  }
  // Physical travel from Lumenwell to Highrest is independently possible;
  // that fact is not authority over the refusing departure government.
  const r = reachable.find(r => r.cityId === 'city:09512');
  const city = map.strategicPlayableSettlementState.cityRows.find(c => c.cityId === r.cityId);
  const passenger = Passenger.create(city, Networks.cityCurrentNetworkProfile(map, city.cityId).standings, 0); assert(passenger);
  const q = Passenger.quote(passenger, r.network, 'city:city:09434'); assert(q.ok); assert.equal(q.km, 894);
  assert.equal(Passenger.reason(passenger, q, { kg: 0, l: 0 }, q.fee), '');
  assert.equal(Passenger.reason(passenger, q, { kg: 0, l: 0 }, 0), 'The exact fare is not available.');
  // The new preparation contract may not invent employees/desk capacity at
  // these reachable cities. This is original-source coverage, not a paid
  // player acquisition/muster or city-conquest positive scenario.
  const binding = { worldId: world.id, runId: 'original-force-branch' };
  const networks = NetworksBook.create(NetworksBook.sources(map, world.worldSeed), binding, 0, { originalInventory: true });
  const field = Field.create(Field.originalSources(networks), binding, world.worldSeed, 0);
  assert(Inventories.adopt(networks, 'interdiction', field, binding));
  assert.equal(field.units.length, 10);
  const people = field.units.flatMap(u => u.actors); assert.equal(new Set(people.map(a => a.id)).size, 20);
  for (const cityId of cities) assert.deepEqual(Offensive.sources(networks, field, cityId), []);
  assert(people.every(a => !a.mapCell && !a.assignment));
  assert.equal(JSON.stringify(map), before);
});
