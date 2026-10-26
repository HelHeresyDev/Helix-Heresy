const { test } = require('node:test');
const assert = require('node:assert/strict');
const I = require('../network-interdiction');
const N = require('../network-operations');
const P = require('../city-provisioning');
const M = require('../municipal-supply-threats');
const W = require('../wilderness-beasts');
const Rule = require('../city-rule');
const Defense = require('../city-defense');
const { world } = require('./helpers/network-operating-source');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const map = world(); map.strategicNonStateNetworkHistory.networkRows[0].actualCapacityBand = 'strong';
  map.strategicNonStateNetworkHistory.branchRows.forEach(b => { b.organizationForm = 'escortChapter'; b.currentStanding = 'licensed'; });
  map.routeGraph = { routes: [{ id: 'ab', endpointIds: ['a', 'b'], cellPath: ['city', 'crossing', 'b'] }] };
  const route = { id: 'ab', distanceKm: .2, endpointCityIds: ['a', 'b'], continuity: 'continuous', supportCapable: true };
  const binding = { worldId: 'w', runId: 'r' }, networks = N.create(N.sources(map, 'seed'), binding, 0);
  const source = I.sources(map).find(s => s.branchId === 'branch:b');
  const s = I.create([source], binding, 'seed', 0), u = s.units[0], account = N.host(networks, source.branchId);
  I.reserve(s, networks);
  const farm = { cityId: 'a', cityName: 'A', cityPopulation: 3000, populationSourceId: 'population:a', charterId: 'charter:a',
    institutionId: 'works', satelliteId: 'farm', satelliteName: 'Farm', satellitePopulation: 200, arableLandBand: 'productive', storageDays: 4,
    cityCellId: 'city', satelliteCellId: 'farm-cell', distanceKm: .2, routeCellIds: ['farm-cell', 'crossing', 'city'], routeUsable: true };
  const worker = { id: 'worker', institutionId: 'works', roles: ['publicWorksAndProvisioning'], health: 100, status: 'alive', workSeconds: 1800 };
  const succession = { source: farm, officeId: 'office', leaders: [worker], agreements: [{ personId: worker.id, institutionId: 'works', roles: worker.roles }],
    handover: { id: 'handover', bodyEpoch: 0 }, control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0, sourceReceiptId: 'handover',
      commandRelationships: [{ personId: worker.id, institutionId: 'works', roles: worker.roles }] } };
  const office = { id: 'office', cityId: 'a' }, q = P.create(farm, succession, office, binding, 0);
  const link = I.links(map, farm, { distance: () => .1, land: () => true }, [route])[0]; s.links = [link];
  const c = { account, gate: { powerSeconds: 1800, receptionWorkSeconds: 1800 }, clerk: { id: 'original-clerk', status: 'alive', health: 100 }, quota: q,
    sourceCurrent: true, witnessCurrent: true, channel: true, routeOpen: true, link, targetControlled: true, targetReceiptId: 'handover',
    breach: { id: 'original-signed-withdrawal:breach', promiseId: 'original-signed-withdrawal', clerkId: 'original-clerk', at: 0 } };
  const site = { id: 'crossing-site', roomId: 'crossing-room', entry: { x: 10, y: 10, z: 21 } };
  const f = { map, binding, networks, s, u, c, q, source, link, site, at: 0, alive: true, succession, office, worker };
  const can = (a, p) => p.x >= 8 && p.x < 20 && p.y >= 6 && p.y < 16 && !u.actors.some(x => x.id !== a.id && x.mapCell && W.key(x.mapCell) === W.key(p))
    && ![q.vehicle, q.driver].some(x => x.mapCell && W.key(x.mapCell) === W.key(p));
  f.h = { alive: () => f.alive, sight: () => true, incapacitated: x => x.health < 35,
    arrive: u => { u.deployment.siteId = site.id; u.deployment.entry = copy(site.entry);
      u.actors.forEach((a, i) => { a.mapCell = { x: 8, y: 9 + i * 2, z: 21 }; a.fieldHome = copy(a.mapCell); a.roomId = site.roomId; }); return true; },
    move: (a, goal) => { const p = W.nextStep(a.mapCell, goal, p => can(a, p)); if (!p) return false; a.mapCell = p; return true; },
    adjacent: (a, goal) => W.neighbors(goal).filter(p => can(a, p)).sort((x, y) => W.distance(a.mapCell, x) - W.distance(a.mapCell, y))[0],
    strike: (a, t) => { const before = q.vehicle.condition; M.vehicleImpact(q, 8, f.at); return { ok: true, vehicleDamage: before - q.vehicle.condition }; },
    repairContext: () => f.repairContext };
  f.tick = n => { f.at += n; I.advance(f.s, f.networks, () => f.c, f.at, f.h); };
  return f;
}
function deployed(f = fixture()) { f.tick(120); assert.equal(f.u.phase, 'outbound'); f.tick(151); assert.equal(f.u.phase, 'deployed'); return f; }
function contact(f = deployed()) {
  const pc = { alive: true, capable: true, local: true, atCounter: true, workerPresent: true, free: true, sourceCurrent: true,
    bodyEpoch: 0, worksCurrent: true, routeUsable: true, depotAvailable: true, productionAvailable: true, reportAllowed: true };
  assert.equal(P.inspect(f.q, f.succession, f.office, pc, f.at), true);
  assert.equal(P.dispatch(f.q, f.succession, f.office, f.worker, pc, f.q.quote, f.at), true);
  f.q.order.phase = 'inbound'; f.q.vehicle.cargoKg = 100; f.q.vehicle.mapCell = null; f.q.driver.mapCell = null;
  const crossing = I.crossing(f.s, f.q, 0, .2); assert.ok(crossing);
  assert.ok(I.contact(f.s, f.q, crossing, f.site, f.at)); return f;
}
test('only actual backed licensed military branches reserve two original employees, without another municipal population or fleet', () => {
  const f = fixture(); assert.equal(f.s.units[0].actors.length, 2); assert.equal(f.c.account.allocations.length, 1);
  assert.ok(f.u.actors.every(a => a.id.startsWith(f.u.id) && !a.exceptionalCapabilities));
  for (const change of [m => m.strategicNonStateNetworkHistory.networkRows[0].actualCapacityBand = 'limited',
    m => m.strategicNonStateNetworkHistory.networkRows[0].category = 'commercial',
    m => m.strategicNonStateNetworkHistory.branchRows.forEach(b => b.currentStanding = 'proscribed'),
    m => m.strategicNonStateNetworkHistory.branchRows.forEach(b => b.physicalCondition = 'ruined'),
    m => m.strategicPlayableSettlementState.cityRows.forEach(c => c.currentPopulation = 16)]) {
    const m = copy(f.map); change(m); assert.deepEqual(I.sources(m), []);
  }
  assert.equal(f.u.actors[0].mapCell, null); assert.equal(f.u.radioSeconds, 3600); assert.ok(!f.u.truck);
});
test('unseen allegation, unavailable authority, wrong source, shared work, absent money or blocked road cannot mobilize', () => {
  for (const change of [f => f.c.breach = null, f => f.c.witnessCurrent = false, f => f.c.targetControlled = false,
    f => f.c.sourceCurrent = false, f => f.c.routeOpen = false, f => f.c.account.money = 119,
    f => f.c.clerk.assignment = 'other', f => f.c.gate.powerSeconds = 0, f => f.c.account.operator.assignment = 'other',
    f => f.q.runId = 'another-run']) {
    const f = fixture(); change(f); const before = f.c.account.money; f.tick(300);
    assert.equal(f.u.deployment, null); assert.equal(f.c.account.money, before); assert.equal(f.u.actors[0].mapCell, null);
  }
});
test('partial original-clerk transmission consumes actual work and power and survives a real state round trip', () => {
  const f = fixture(); f.tick(40); assert.equal(f.u.job.progress, 40); assert.equal(f.c.gate.powerSeconds, 1760);
  assert.equal(f.c.account.money, 240); assert.equal(f.c.account.operator.workSeconds, 14360);
  f.s = I.normalize(f.s); f.u = f.s.units[0]; f.tick(80);
  assert.equal(f.u.phase, 'outbound'); assert.equal(f.c.account.money, 120); assert.equal(f.c.account.payments.length, 1);
  assert.equal(f.u.deployment.positionKm, 0); assert.equal(f.c.clerk.assignment, null);
});
test('lost witness/channel interrupts only its own reservations, and the same actual dispute cannot reroll', () => {
  const f = fixture(); f.tick(40); f.c.channel = false; f.c.clerk.assignment = 'other-original-duty'; f.tick(100);
  assert.equal(f.u.job, null); assert.equal(f.c.clerk.assignment, 'other-original-duty'); assert.equal(f.c.account.money, 240);
  f.c.channel = true; f.c.clerk.assignment = null; f.tick(200); assert.equal(f.u.deployment, null);
});
test('a completed network contact or reply cannot share its operator second with a new report or radio order', () => {
  const f = fixture(), work = f.c.account.operator.workSeconds;
  f.c.account.operator.lastOperatingWorkAt = 1;
  f.tick(1); assert.equal(f.u.job, null); assert.equal(f.c.account.operator.workSeconds, work);
  f.tick(1); assert.equal(f.u.job.progress, 1); assert.equal(f.c.account.operator.workSeconds, work - 1);
  const g = contact();
  g.c.account.mandates = { [I.PURPOSE]: { id: 'actual-supply-order', at: g.at } };
  g.c.account.operator.lastOperatingWorkAt = g.at + 1;
  g.tick(1); assert.equal(g.u.deployment.recall.progress, 0);
  g.tick(1); assert.equal(g.u.deployment.recall.progress, 1);
});
test('distance, finite foot travel, surviving people and real entry access precede physical arrival', () => {
  const f = fixture(); f.tick(120); f.tick(75); assert.equal(f.u.actors[0].mapCell, null);
  assert.ok(Math.abs(f.u.deployment.positionKm - .05) < 1e-8); const remaining = f.u.actors[0].workSeconds;
  f.c.routeOpen = false; f.tick(20); assert.equal(f.u.actors[0].workSeconds, remaining - 20);
  assert.ok(Math.abs(f.u.deployment.positionKm - .05) < 1e-8);
  f.c.routeOpen = true; f.h.arrive = () => false; f.tick(100); assert.equal(f.u.actors[0].mapCell, null);
  const far = fixture(); far.c.link.distanceKm = 100; far.tick(120); assert.equal(far.u.phase, 'declined'); assert.equal(far.c.account.money, 240);
});
test('only the genuinely shared interior road can be selected, not distant or endpoint coordinates', () => {
  const f = fixture(); assert.equal(f.link.farmKm, .1); assert.equal(f.link.corridorKm, .1);
  assert.equal(f.link.routeId, 'intercity-march:ab'); assert.equal(f.link.networkRouteId, 'ab');
  assert.deepEqual(I.links(f.map, { ...f.q.source, routeCellIds: ['farm-cell', 'city'] }, { distance: () => .1, land: () => true }, []), []);
  assert.equal(I.crossing(f.s, f.q, 0, 10), null);
  f.c.link.strongholds = [{ id: 'uncontracted-joint-fort', corridorKm: .15 }];
  assert.equal(I.routeClear(f.c.link, 'b'), false); assert.equal(I.routeClear(f.c.link, 'a'), true);
  f.tick(300); assert.equal(f.u.deployment, null); assert.equal(f.c.account.money, 240);
});
test('actual movement and close impacts disable the original running gear without destroying cargo or killing the driver', () => {
  const f = contact(), ids = f.u.actors.map(a => a.id); const initial = copy(f.u.actors.map(a => a.mapCell));
  f.tick(1); assert.equal(f.q.vehicle.condition, 100); assert.notDeepEqual(f.u.actors.map(a => a.mapCell), initial); f.tick(60);
  assert.ok(f.q.vehicle.condition < 50); assert.equal(f.q.driver.health, 100); assert.equal(f.q.vehicle.cargoKg, 100);
  assert.equal(f.q.order.deliveredKg, 0);
  const condition = f.q.vehicle.condition; f.tick(50); assert.equal(f.q.vehicle.condition, condition);
  assert.ok(f.u.actors.some(a => a.fieldKit.toolCondition < 100)); assert.deepEqual(f.u.actors.map(a => a.id), ids);
});
test('opaque separation, lost tools and incapacitation prevent magical offscreen damage or replacement people', () => {
  const f = contact(); f.h.sight = () => false; f.tick(120); assert.equal(f.q.vehicle.condition, 100);
  f.h.sight = () => true; f.u.actors.forEach(a => a.fieldKit.toolCondition = 0); f.tick(120); assert.equal(f.q.vehicle.condition, 100);
  f.u.actors.forEach(a => { a.health = 0; a.status = 'dead'; }); const cells = copy(f.u.actors.map(a => a.mapCell));
  f.tick(120); assert.equal(f.u.phase, 'losses'); assert.deepEqual(f.u.actors.map(a => a.mapCell), cells);
});
test('old receiving-only terms cannot authorize this new scope; a new mandate prevents a not-yet-funded launch', () => {
  const f = fixture(); f.c.account.mandate = { id: 'old', at: 0 }; f.tick(120); assert.equal(f.u.phase, 'outbound');
  const g = fixture(); g.c.account.mandates = { [I.PURPOSE]: { id: 'supply-specific', at: 0 } };
  g.tick(120); assert.equal(g.u.phase, 'declined'); assert.equal(g.c.account.money, 240);
});
test('new stand-down needs actual operator/terminal/radio time; outage does not recall, heal or teleport deployed originals', () => {
  const f = contact(); f.tick(20); f.c.account.mandates = { [I.PURPOSE]: { id: 'supply-specific', at: f.at } };
  f.tick(20); assert.equal(f.u.deployment.recall.progress, 20); assert.equal(f.u.phase, 'deployed');
  f.c.account.terminal.powerSeconds = 0; f.tick(100); assert.equal(f.u.deployment.recall.progress, 20);
  f.c.account.terminal.powerSeconds = 100; f.tick(40); assert.ok(f.u.deployment.ceasefire);
  assert.equal(f.u.radioSeconds, 3540); assert.ok(['withdrawing', 'returning'].includes(f.u.phase));
  f.tick(200); assert.equal(f.u.phase, 'returned'); assert.equal(f.c.account.money, 120);
});
test('a ceasefire alone cannot repair a disabled carrier; actual materials and attended work restore only that vehicle', () => {
  const f = contact(); f.tick(80); assert.ok(f.q.vehicle.condition < 50);
  f.c.account.mandates = { [I.PURPOSE]: { id: 'supply-specific', at: f.at } }; f.tick(90);
  const before = f.q.vehicle.condition;
  f.repairContext = { quota: f.q, ready: true, bodyEpoch: 0, cell: copy(f.site.entry) };
  let spent = 0; assert.equal(I.beginRepair(f.s, f.q, f.repairContext, f.at, () => { spent++; return { parts: 2, rubber: 1, toolId: 'original-tool' }; }), true);
  f.tick(40); assert.equal(f.q.vehicle.condition, before); assert.equal(spent, 1);
  f.s = I.normalize(f.s); f.u = f.s.units[0]; f.tick(80); assert.equal(f.q.vehicle.condition, Math.min(100, before + 30));
  for (let n = 0; n < 31; n++) I.tickCarrier(f.s, f.q, f.at + n, { sight: () => true, incapacitated: () => false });
  assert.equal(f.q.roadContactId, null); assert.equal(f.q.vehicle.mapCell, null); assert.equal(f.q.order.encounterReports.length, 1);
});
test('interrupted repair retains incorporated materials but grants no repair or partial refund', () => {
  const f = contact(); f.q.vehicle.condition = 40; f.repairContext = { quota: f.q, ready: true, bodyEpoch: 0, cell: copy(f.site.entry) };
  I.beginRepair(f.s, f.q, f.repairContext, f.at, () => ({ parts: 2, rubber: 1 })); f.tick(40);
  f.repairContext.bodyEpoch = 1; f.tick(100); assert.equal(f.s.repair, null); assert.equal(f.q.vehicle.condition, 40);
  assert.equal(f.s.repairs[0].progress, 40); assert.equal(f.s.repairs[0].inputs.parts, 2);
  f.repairContext.bodyEpoch = 0;
  I.beginRepair(f.s, f.q, f.repairContext, f.at, () => ({ parts: 2, rubber: 1 })); f.tick(10);
  assert.equal(I.cancelRepair(f.s, false, f.at), false); assert.ok(f.s.repair);
  assert.equal(I.cancelRepair(f.s, true, f.at), true); assert.equal(f.s.repairs.at(-1).progress, 10);
  assert.equal(f.q.vehicle.condition, 40);
});
test('dated observations disclose only personally visible people and truck condition, never a private deployment roster', () => {
  const f = contact(); assert.equal(I.observe(f.s, f.q, f.at, () => false), false);
  assert.equal(I.observe(f.s, { ...f.q, runId: 'unrelated-run' }, f.at, () => true), false);
  assert.equal(I.observe(f.s, f.q, f.at, () => true), true); const view = I.publicView(f.s);
  assert.doesNotMatch(JSON.stringify(view), /workSeconds|radioSeconds|populationSourceId|money|distanceKm|powerSeconds/);
  f.tick(50); assert.deepEqual(I.publicView(f.s), view);
});
test('coarse/fine/save continuation conserve the same original deployment and budget; death freezes both', () => {
  const a = fixture(), b = fixture(); a.tick(271); for (let n = 0; n < 271; n++) b.tick(1);
  assert.deepEqual(a.s, b.s); assert.deepEqual(a.networks, b.networks);
  const saved = copy(a.s); a.alive = false; a.tick(1000); assert.deepEqual(a.s, saved);
  assert.equal(I.rebind(saved, { worldId: 'other', runId: 'r' }, { worldId: 'w', runId: 'copy' }), null);
  assert.equal(I.rebind(saved, saved, { worldId: 'w', runId: 'copy' }).runId, 'copy');
});
test('missing original field accounts remain named unknown gaps, never fresh people, equipment or capital', () => {
  const f = fixture(), source = copy(f.s.sourceRegistry); f.s.units = [];
  I.sync(f.s, source); assert.equal(f.s.units.length, 1); assert.equal(f.s.units[0].lost, true);
  assert.deepEqual(f.s.units[0].actors.map(a => a.id), [`${f.source.id}:1`, `${f.source.id}:2`]);
  assert.ok(f.s.units[0].actors.every(a => a.status === 'unknown' && a.workSeconds === 0 && a.fieldKit.toolCondition === 0));
  f.tick(400); assert.equal(f.s.units[0].deployment, null); assert.equal(f.c.account.money, 240);
});
test('an intercepted truck does not instantly defeat government; actual original buffer depletion compromises its necessary provisioning function', () => {
  const f = contact(); f.tick(80); assert.ok(f.q.vehicle.condition < 50);
  const institutions = Rule.ROLES.map(role => ({ role, id: role === 'publicWorksAndProvisioning' ? 'works' : role }));
  const people = institutions.map(i => i.role === 'publicWorksAndProvisioning' ? f.worker : ({ id: `${i.role}:person`, institutionId: i.id,
    roles: [i.role], status: 'alive', health: 100, workSeconds: 3600, stamina: 80,
    exceptionalCapabilities: i.role === 'militaryDefenseCommand' ? ['city-scale ward defense'] : [] }));
  const agreements = people.map(p => ({ personId: p.id, institutionId: p.institutionId, roles: p.roles, termsId: 'terms' }));
  f.succession.agreements = agreements; f.succession.control.commandRelationships = copy(agreements);
  f.succession.handover.termsId = 'terms'; f.succession.leaders = people.slice(0, -1);
  const defense = Defense.create({ cityId: 'a', charterId: 'charter:a', institutionId: 'militaryDefenseCommand', populationSourceId: 'population:a',
    population: 3000, condition: 80, installationId: 'original-ward', baselineEnergy: 69120 }, f.succession, people.at(-1), f.office, f.binding, 0, 80);
  const rule = Rule.create({ cityId: 'a', charterId: 'charter:a', populationSourceId: 'population:a', population: 3000,
    institutions, worksId: 'original-water', powerId: 'original-power', reserveDays: 4, farms: [f.q.source] }, f.succession, f.q, defense, f.binding, 0);
  const c = { sourceCurrent: true, bodyEpoch: 0, institutionsAvailable: true, coverageVerified: true, counterpower: 'noEstablishedChallenge',
    pilotSupplied: true, pilotDefended: true, defenseAvailable: true, alive: true, capable: true, local: true, free: true, atCounter: true, reportersPresent: true };
  assert.equal(Rule.order(rule, f.succession, people, c, 0), true);
  Rule.advance(rule, f.succession, people, () => c, 3600);
  assert.equal(Rule.condition(rule, f.succession, people, c), null);
  const municipal = { alive: true, sourceCurrent: true, routeUsable: true, depotAvailable: true, productionAvailable: true };
  P.advance(f.q, municipal, P.DAY, { roadHeld: () => Boolean(f.q.roadContactId) });
  assert.ok(f.q.stores.cityKg > 0); assert.equal(f.q.demand.unmetKg, 0);
  assert.equal(Rule.condition(rule, f.succession, people, { ...c, pilotSupplied: f.q.stores.cityKg > 1e-7 }), null);
  P.advance(f.q, municipal, 2 * P.DAY + 60, { roadHeld: () => Boolean(f.q.roadContactId) });
  assert.ok(f.q.stores.cityKg < 1e-7); assert.ok(f.q.demand.unmetKg > 0); assert.equal(f.q.order.deliveredKg, 0);
  assert.ok(rule.foodKg > 0); // It is the actually required pilot quota, not an invented whole-city food reset.
  assert.equal(Rule.condition(rule, f.succession, people, { ...c, pilotSupplied: f.q.stores.cityKg > 1e-7 }), 'supply');
});
