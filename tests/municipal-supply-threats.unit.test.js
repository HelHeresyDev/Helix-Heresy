const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../municipal-supply-threats');
const P = require('../city-provisioning');
const Population = require('../regional-suppression');
const Regional = require('../regional-encounters');
const Stops = require('../roadside-stops');
const Journeys = require('../strategic-journeys');
const Carrier = require('../local-exchange-carrier');
const Supremacy = require('../durable-supremacy');
const { fixture: ecology } = require('./helpers/regional-suppression-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture(count = 5, far = .1) {
  const f = ecology(count, far), binding = { worldId: 'world', runId: 'run' };
  const source = { cityId: 'a', cityName: 'Aster', populationSourceId: 'people:a', cityPopulation: 3000,
    charterId: 'charter:a', institutionId: 'works:a', satelliteId: 'farm:a', satelliteName: 'Farm', satellitePopulation: 200,
    cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00004', arableLandBand: 'productive', storageDays: 4,
    distanceKm: 1 + far, routeCellIds: ['planet-cell:00004', 'planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  const worker = { id: 'worker', institutionId: 'works:a', roles: ['publicWorksAndProvisioning'], health: 100, status: 'alive', workSeconds: 1800 };
  const succession = { source, officeId: 'office:a', leaders: [worker], agreements: [{ personId: worker.id, institutionId: worker.institutionId, roles: worker.roles }],
    handover: { id: 'handover', bodyEpoch: 0 }, control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0, sourceReceiptId: 'handover',
      commandRelationships: [{ personId: worker.id, institutionId: worker.institutionId, roles: worker.roles }] } };
  const office = { id: 'office:a', cityId: 'a' };
  const q = P.create(source, succession, office, binding, 0);
  const c = { alive: true, capable: true, local: true, atCounter: true, workerPresent: true, free: true, sourceCurrent: true,
    bodyEpoch: 0, worksCurrent: true, routeUsable: true, depotAvailable: true, productionAvailable: true, reportAllowed: true };
  const links = M.sources(f.map, source, f.geometry, [f.route]);
  const s = M.create(binding, source, links, 0), region = Regional.create(binding), population = Population.create(binding);
  Population.register(population, links[0].population, region, [], 'test', 0);
  const actors = region.beasts.actors;
  assert.equal(P.inspect(q, succession, office, c, 0), true);
  assert.equal(P.dispatch(q, succession, office, worker, c, copy(q.quote), 0), true);
  q.order.phase = 'outbound'; // Local model scene at the actual road boundary.
  q.driver.mapCell = null; q.driver.roomId = ''; q.vehicle.mapCell = null; q.vehicle.roomId = '';
  const candidate = M.candidates(s, q, population, actors, [])[0];
  const site = Stops.ensure(null, binding, links[0].population.routeId, candidate.corridorKm, 0, 21, {}).site;
  Regional.place(region, site, 0, cell => ![site.entry.x, site.entry.x + 1].includes(cell.x) || cell.y !== site.entry.y);
  candidate.meterKm = candidate.farmKm;
  return { ...f, binding, source, q, c, s, region, population, actors, links, site, candidate };
}
function open(f) { assert.ok(M.start(f.s, f.q, f.candidate, f.site, 0)); }
function hooks(f) {
  return { sight: () => true, incapacitated: () => false,
    canEnter: (a, c) => f.site.baseline.some(t => JSON.stringify(t.cell) === JSON.stringify(c))
      && !f.actors.some(b => b.id !== a.id && JSON.stringify(b.mapCell) === JSON.stringify(c)),
    strike: (a, t, p) => {
      if (t.kind === 'structure') M.vehicleImpact(f.q, p.damage, f.s.lastAt);
      else { f.q.driver.health = Math.max(0, f.q.driver.health - p.damage); if (!f.q.driver.health) f.q.driver.status = 'dead'; }
      return { ok: true };
    } };
}
test('only genuine shared interior crossings and original source-backed populations are eligible', () => {
  const f = fixture(); assert.equal(f.links.length, 1); assert.equal(f.links[0].farmKm, 1);
  assert.deepEqual(M.sources(f.map, { ...f.source, routeCellIds: ['planet-cell:00004', 'planet-cell:00001'] }, f.geometry, [f.route]), []);
  const missing = copy(f.map); missing.beastEcology.waveProfiles = [];
  assert.deepEqual(M.sources(missing, f.source, f.geometry, [f.route]), []);
  assert.equal(M.create(f.binding, f.source, [{ ...f.links[0], farmKm: 0 }], 0), null);
});
test('unarrived, dead, withdrawing, missing and already-local elsewhere originals cannot be spawned at a convoy', () => {
  for (const mutate of [a => a.campaignTravelRemainingKm = 1, a => a.status = 'dead', a => a.campaignLeg = 'withdrawing',
    a => { a.regionalPhase = 'local'; a.regionalSiteId = 'another-patch'; }]) {
    const f = fixture(); f.actors.forEach(mutate);
    assert.deepEqual(M.candidates(f.s, f.q, f.population, f.actors, [f.site]), []);
  }
  const f = fixture(); assert.deepEqual(M.candidates(f.s, f.q, f.population, [], []), []);
  assert.deepEqual(M.candidates(f.s, f.q, null, f.actors, []), []);
});
test('previously encountered originals can intersect only at their own nearby saved route position, never a replacement population', () => {
  const f = fixture(); f.population.populations[0].members.forEach(m => { m.native = false; delete m.homeIndex; });
  assert.ok(M.candidates(f.s, f.q, f.population, f.actors, [f.site]).length > 0);
  f.actors.forEach(a => { a.positionKm = 1.8; });
  assert.deepEqual(M.candidates(f.s, f.q, f.population, f.actors, [f.site]), []);
  f.actors.forEach(a => { a.positionKm = 1; a.routeId = 'unrelated-road'; });
  assert.deepEqual(M.candidates(f.s, f.q, f.population, f.actors, [f.site]), []);
});
test('exact outbound/inbound interception conserves the same order, driver, truck and animals across reload', () => {
  const f = fixture(), ids = f.actors.map(a => a.id), d = f.q.driver.id, v = f.q.vehicle.id;
  assert.equal(M.crossing(f.s, f.q, [f.candidate], 0, f.candidate.farmKm - .001), null);
  assert.ok(M.crossing(f.s, f.q, [f.candidate], 0, 1.1)); open(f);
  assert.equal(M.start(f.s, f.q, f.candidate, f.site, 1), false);
  assert.equal(M.normalize(copy(f.s), f.q).encounters[0].siteId, f.site.id);
  assert.deepEqual(f.actors.map(a => a.id), ids); assert.equal(f.q.driver.id, d); assert.equal(f.q.vehicle.id, v);
  assert.equal(M.crossing(f.s, f.q, [{ ...f.candidate, siteId: f.site.id }], 0, 1.1), null);
  f.q.order.phase = 'inbound';
  assert.ok(Math.abs(M.crossing(f.s, f.q, [f.candidate], 0, 1.1).meterKm - (1.1 - f.candidate.farmKm)) < 1e-8);
});
test('perception and physical movement precede impacts; opaque separation cannot roll a casualty', () => {
  const f = fixture(); open(f); const h = hooks(f); h.sight = () => false;
  for (let at = 1; at <= 20; at++) M.step(f.s, f.q, f.site, f.actors, at, h);
  assert.equal(f.q.driver.health, 100); assert.equal(f.q.vehicle.condition, 100);
  assert.equal(f.s.encounters[0].contacts.length, 0);
  const g = fixture(); open(g); const before = g.actors.map(a => copy(a.mapCell));
  M.step(g.s, g.q, g.site, g.actors, 1, hooks(g)); assert.equal(g.q.vehicle.condition, 100);
  for (let at = 2; at <= 60; at++) M.step(g.s, g.q, g.site, g.actors, at, hooks(g));
  assert.ok(g.q.vehicle.condition < 100); assert.ok(g.actors.some((a, i) => JSON.stringify(a.mapCell) !== JSON.stringify(before[i])));
});
test('cab damage precedes driver exposure and cargo loss; spoiled grain is conserved, never player stock', () => {
  const f = fixture(); open(f); f.q.vehicle.cargoKg = 200;
  for (let at = 1; at <= 300; at++) M.step(f.s, f.q, f.site, f.actors, at, hooks(f));
  assert.equal(f.q.vehicle.condition, 0); assert.equal(f.q.driver.status, 'dead');
  assert.equal(f.q.vehicle.cargoKg + f.q.stores.spoiledKg, 200);
  assert.equal(f.q.vehicle.cityOwnerId, 'a'); assert.equal(f.q.order.deliveredKg, 0);
  assert.ok(f.s.encounters[0].contacts.some(c => c.vehicleDamage));
  assert.ok(f.s.encounters[0].contacts.some(c => c.driverDamage));
});
test('actual neutralization permits an operable original carrier to leave, without clearing a capable unseen group', () => {
  const f = fixture(10, 60); open(f);
  for (const a of f.actors.filter(a => a.roomId === f.site.roomId)) { a.health = 0; a.status = 'dead'; }
  for (let at = 1; at <= 30; at++) M.step(f.s, f.q, f.site, f.actors, at, hooks(f));
  assert.equal(f.q.roadContactId, null); assert.equal(f.q.driver.mapCell, null); assert.equal(f.q.order.encounterReports.length, 1);
  assert.equal(M.fact(f.s, f.q, f.population, f.actors, 30)[0].state, 'unverified');
  assert.equal(f.q.receipts.length, 0); // The report has not returned to the city.
});
test('shared human opposition prevents premature wildlife-contact clearance without replacing the original encounter', () => {
  const f = fixture(); open(f);
  f.actors.forEach(a => { a.health = 0; a.status = 'dead'; });
  const encounter = f.q.roadContactId, h = { ...hooks(f), extraThreat: () => true };
  for (let at = 1; at <= 40; at++) M.step(f.s, f.q, f.site, f.actors, at, h);
  assert.equal(f.q.roadContactId, encounter); assert.equal(f.s.encounters[0].clearSeconds, 0);
  h.extraThreat = () => false;
  for (let at = 41; at <= 70; at++) M.step(f.s, f.q, f.site, f.actors, at, h);
  assert.equal(f.q.roadContactId, null); assert.equal(f.s.encounters[0].endedAt, 70);
});
test('field-party ecology acts on real local targets without damaging or releasing a distant carrier', () => {
  const f = fixture(); open(f);
  f.q.vehicle.roomId = f.q.driver.roomId = 'distant-original-depot';
  const before = copy(f.q), local = f.actors[0].mapCell;
  const encounter = { lastAt: 0, contacts: [], clearSeconds: 0 };
  let hits = 0;
  for (let at = 1; at <= 45; at++) M.step(f.s, f.q, f.site, f.actors, at, {
    ...hooks(f), encounter, campOnly: true,
    targets: [{ id: 'original-local-field-employee', kind: 'creature', cell: { ...local, x: local.x + 1 } }],
    strike: (_, target) => { assert.equal(target.id, 'original-local-field-employee'); hits++; return { ok: true }; }
  });
  assert.ok(hits > 0); assert.deepEqual(f.q, before); assert.equal(encounter.clearSeconds, 0);
});
test('wounded animals flee rather than communicate, cooperate, attack or become a new healthy pack', () => {
  const f = fixture(); open(f); f.actors.forEach(a => a.health = 10);
  const start = f.actors.map(a => copy(a.mapCell));
  for (let at = 1; at <= 10; at++) M.step(f.s, f.q, f.site, f.actors, at, hooks(f));
  assert.equal(f.q.vehicle.condition, 100); assert.equal(f.q.driver.health, 100);
  assert.ok(f.actors.some((a, i) => JSON.stringify(a.mapCell) !== JSON.stringify(start[i])));
  assert.ok(f.actors.every(a => a.health === 10));
});
test('irreversible scientist death freezes the physical contact rather than continuing an unseen battle', () => {
  const f = fixture(); open(f); const before = copy({ s: f.s, q: f.q, actors: f.actors });
  assert.equal(M.step(f.s, f.q, f.site, f.actors, 300, { ...hooks(f), alive: () => false }), false);
  assert.deepEqual({ s: f.s, q: f.q, actors: f.actors }, before);
});
test('whole-original-population incapacity retains a continuous source date; recovery, missing or extra bodies break proof', () => {
  const f = fixture(); open(f); f.actors.forEach(a => a.health = 10);
  assert.equal(M.fact(f.s, f.q, f.population, f.actors, 10)[0].since, 10);
  assert.equal(M.fact(f.s, f.q, f.population, f.actors, 20)[0].since, 10);
  f.actors[0].health = 48; assert.equal(M.fact(f.s, f.q, f.population, f.actors, 21)[0].state, 'unverified');
  f.actors[0].health = 10; assert.equal(M.fact(f.s, f.q, f.population, f.actors, 22)[0].since, 22);
  assert.equal(M.fact(f.s, f.q, f.population, f.actors.slice(1), 23)[0].state, 'unverified');
  assert.equal(M.fact(f.s, f.q, f.population, [...f.actors, { ...f.actors[0], id: 'unaccounted-original' }], 24)[0].state, 'unverified');
});
test('the owner consumer feeds only full conserved incapacity to the strategic evaluator, never a safe shipment', () => {
  const f = fixture(), target = { id: 'beast:SECRET_POPULATION', sourceId: 'SECRET_POPULATION', kind: 'beast', createdAt: 0 };
  let fact = M.fact(f.s, f.q, f.population, f.actors, 0)[0];
  assert.equal(Supremacy.factState(target, fact, f.binding, 0), 'unverified');
  f.actors.forEach(a => { a.status = 'dead'; a.health = 0; });
  fact = M.fact(f.s, f.q, f.population, f.actors, 10)[0];
  assert.equal(Supremacy.factState(target, fact, f.binding, 10), 'qualifying');
  assert.equal(fact.state, 'qualifying'); assert.notEqual(fact.state, 'retired'); // Identity and historical losses remain.
  assert.equal(Supremacy.factState({ ...target, sourceId: 'another-population' }, fact, f.binding, 10), 'unverified');
});
test('personal observation is dated, qualitative and source-bound; offsite UI cannot inspect bodies', () => {
  const f = fixture(); open(f);
  assert.equal(M.observe(f.s, f.q, f.actors, f.site, 1, () => false), false);
  assert.equal(M.observe(f.s, f.q, f.actors, f.site, 2, () => true), true);
  assert.ok(!JSON.stringify(f.s.observations).includes('SECRET_POPULATION'));
  const date = copy(f.s.observations); f.q.driver.status = 'dead'; assert.deepEqual(f.s.observations, date);
  const rebound = M.rebind(f.s, f.q, f.binding, { worldId: 'copy-world', runId: 'continued' });
  assert.equal(rebound.runId, 'continued'); assert.equal(rebound.encounters[0].siteId, f.site.id);
  assert.equal(M.normalize(f.s, { ...f.q, runId: 'independent' }), null);
});
test('held shared journeys consume real driver support and city grain without awarding cargo; death freezes advancement', () => {
  const f = fixture();
  f.q.order.phase = 'boarding'; f.q.order.handling = 0;
  P.advance(f.q, f.c, 30, { move: (a, target) => { a.mapCell = copy(target); return true; } });
  assert.equal(f.q.order.phase, 'outbound');
  const meter = f.q.order.meterKm, fuel = f.q.vehicle.fuelKm, duty = f.q.driver.workSeconds, city = f.q.stores.cityKg;
  P.advance(f.q, f.c, 330, { roadHeld: () => true });
  assert.equal(f.q.order.meterKm, meter); assert.equal(f.q.vehicle.fuelKm, fuel); assert.equal(f.q.driver.workSeconds, duty - 300);
  assert.ok(f.q.stores.cityKg < city); assert.equal(f.q.order.deliveredKg, 0);
  const snapshot = copy(f.q); P.advance(f.q, { ...f.c, alive: false }, 9999, { roadHeld: () => true }); assert.deepEqual(f.q, snapshot);
});
test('road-boundary hook splits the same measured journey instead of skipping the original crossing in catch-up', () => {
  const f = fixture(); f.q.order.phase = 'boarding'; f.q.order.handling = 0;
  let contact = null;
  const h = { roadHeld: () => contact != null, roadArrived: (q, at) => { if (q.order.meterKm >= .5 - 1e-8) contact = at; },
    roadBoundary: (q, at, dt) => {
      if (contact || q.order.phase !== 'outbound') return null;
      const j = Journeys.advance(q.network, at + dt).state.journeys.find(j => j.id === q.order.journeyId);
      const to = Carrier.distanceTravelled(j, at + dt), from = q.order.meterKm;
      return to > from && from < .5 && to >= .5 ? dt * (.5 - from) / (to - from) : null;
    } };
  P.advance(f.q, f.c, 1000, h);
  assert.ok(contact); assert.ok(Math.abs(f.q.order.meterKm - .5) < 1e-7); assert.equal(f.q.order.deliveredKg, 0);
});
test('a wrecked original carrier cannot feed the city remotely; the real finite municipal buffer eventually empties', () => {
  const f = fixture(); open(f); f.q.vehicle.cargoKg = 200;
  for (let at = 1; at <= 300; at++) M.step(f.s, f.q, f.site, f.actors, at, hooks(f));
  P.advance(f.q, f.c, 3 * 86400, { roadHeld: () => true });
  assert.equal(f.q.stores.cityKg, 0); assert.ok(f.q.demand.unmetKg > 0);
  assert.equal(f.q.order.deliveredKg, 0); assert.equal(f.q.receipts.length, 0);
  const total = f.q.stores.cityKg + f.q.stores.farmKg + f.q.vehicle.cargoKg + f.q.demand.suppliedKg + f.q.stores.spoiledKg;
  // The explicit initial loaded scene above adds 200 kg to the original quota.
  assert.ok(Math.abs(total - f.q.stores.initialKg - f.q.stores.harvestedKg - 200) < 1e-6);
  assert.equal(f.q.driver.id, 'a:agricultural-quota:driver'); assert.equal(f.q.vehicle.condition, 0);
});
test('quiet physical clearance resumes the same cargo journey; coarse/fine catch-up and reload agree without live reports', () => {
  function run(chunk, reloadAt = null) {
    let f = fixture(); f.q.order.phase = 'boarding'; f.q.order.handling = 0;
    const h = {
      move: (a, cell) => { a.mapCell = copy(cell); return true; },
      roadHeld: () => Boolean(M.active(f.s, f.q)),
      roadTick: (_, at) => M.step(f.s, f.q, f.site, f.actors, at, { ...hooks(f), sight: () => false }),
      roadArrived: (_, at) => {
        const c = f.q.order && M.crossing(f.s, f.q, M.candidates(f.s, f.q, f.population, f.actors, [f.site]), f.q.order.meterKm, f.q.order.meterKm);
        if (c) M.start(f.s, f.q, c, f.site, at);
      },
      roadBoundary: (_, at, dt) => {
        if (!f.q.order || !['outbound', 'inbound'].includes(f.q.order.phase) || f.q.roadContactId) return null;
        h.roadArrived(null, at);
        if (f.q.roadContactId) return null;
        const j = Journeys.advance(f.q.network, at + dt).state.journeys.find(j => j.id === f.q.order.journeyId);
        const to = Carrier.distanceTravelled(j, at + dt), from = f.q.order.meterKm;
        const c = M.crossing(f.s, f.q, M.candidates(f.s, f.q, f.population, f.actors, [f.site]), from, to);
        return c && to > from ? dt * (c.meterKm - from) / (to - from) : null;
      }
    };
    const received = copy(f.q.report);
    for (let at = 0; at < 1800;) {
      const next = Math.min(1800, at + chunk, reloadAt && at < reloadAt ? reloadAt : Infinity);
      P.advance(f.q, f.c, next, h); at = next;
      if (at === reloadAt) { f = { ...f, q: P.normalize(f.q), s: M.normalize(f.s, f.q), actors: copy(f.actors) }; }
    }
    assert.equal(f.q.order, null); assert.ok(f.q.receipts[0].deliveredKg > 0);
    assert.ok(f.q.receipts[0].encounterReports.length > 0); assert.deepEqual(f.q.report, received);
    assert.equal(M.fact(f.s, f.q, f.population, f.actors, 1800)[0].state, 'unverified');
    return f;
  }
  const coarse = run(1800), fine = run(1), reloaded = run(1800, 670);
  for (const f of [fine, reloaded]) {
    assert.deepEqual(f.q.receipts, coarse.q.receipts); assert.deepEqual(f.s.encounters, coarse.s.encounters);
    assert.ok(Math.abs(f.q.vehicle.fuelKm - coarse.q.vehicle.fuelKm) < 1e-7);
    assert.ok(Math.abs(f.q.stores.cityKg - coarse.q.stores.cityKg) < 1e-7);
  }
});
