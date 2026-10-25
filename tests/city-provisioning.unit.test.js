const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../city-provisioning');
const World = require('../strategic-world');
const copy = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const source = { cityId: 'a', cityName: 'Aster', populationSourceId: 'population:a', cityPopulation: 3000,
    charterId: 'charter:a', institutionId: 'works:a', satelliteId: 'farm:a', satelliteName: 'Aster Farm',
    satellitePopulation: 200, cityCellId: 'planet-cell:00001', satelliteCellId: 'planet-cell:00002',
    arableLandBand: 'productive', storageDays: 4, distanceKm: 10, routeCellIds: ['planet-cell:00002', 'planet-cell:00001'], routeUsable: true };
  const worker = { id: 'worker:a', institutionId: 'works:a', roles: ['publicWorksAndProvisioning'], status: 'alive', health: 100, workSeconds: 1800 };
  const succession = { source: { cityId: 'a', charterId: 'charter:a' }, officeId: 'office:a', leaders: [worker],
    agreements: [{ personId: worker.id, institutionId: 'works:a', roles: worker.roles, at: 0 }],
    handover: { id: 'authentic-handover', bodyEpoch: 0 }, control: { recognizedAuthorityId: 'scientist', bodyEpoch: 0,
      sourceReceiptId: 'authentic-handover', commandRelationships: [{ personId: worker.id, institutionId: 'works:a', roles: worker.roles }] } };
  const office = { id: 'office:a', cityId: 'a' };
  const c = { alive: true, capable: true, local: true, atCounter: true, workerPresent: true, free: true,
    sourceCurrent: true, bodyEpoch: 0, worksCurrent: true, routeUsable: true, depotAvailable: true, atDepot: true, productionAvailable: true, reportAllowed: true };
  const s = P.create(source, succession, office, { worldId: 'world', runId: 'run:a' }, 0);
  return { source, worker, succession, office, s, c, at: 0 };
}
const inspect = f => assert.equal(P.inspect(f.s, f.succession, f.office, f.c, f.at), true);
const order = f => { inspect(f); assert.equal(P.dispatch(f.s, f.succession, f.office, f.worker, f.c, copy(f.s.quote), f.at), true); };
const move = (a, goal) => { a.mapCell = copy(goal); return true; };
function step(f, seconds, hooks = { move }) { f.at += seconds; P.advance(f.s, f.c, f.at, hooks); }
function complete(f) {
  for (let i = 0; i < 300 && f.s.order; i++) {
    const j = f.s.network.journeys.find(j => j.id === f.s.order.journeyId);
    if (j?.status === 'stranded') assert.equal(P.recover(f.s, f.succession, f.office, f.c, f.at), true);
    step(f, 30);
  }
  assert.equal(f.s.order, null);
}
const total = s => s.stores.cityKg + s.stores.farmKg + s.vehicle.cargoKg + s.demand.suppliedKg;
test('standing priority requires original local authority; later pickups use the same finite worker, driver, truck and quota without a remote report', () => {
  for (const mutate of [f => f.c.local = false, f => f.c.atCounter = false, f => f.c.workerPresent = false, f => f.c.bodyEpoch++]) {
    const f = fixture(); mutate(f); assert.equal(P.standing(f.s, f.succession, f.office, f.c, true, 0), false);
  }
  const f = fixture(); assert.equal(P.standing(f.s, f.succession, f.office, f.c, true, 0), true);
  inspect(f); const dated = copy(f.s.report), driver = f.s.driver.id, truck = f.s.vehicle.id;
  Object.assign(f.c, { local: false, atCounter: false, workerPresent: false, standingAuthorized: true, standingWorkerAvailable: true, standingWorker: f.worker });
  step(f, 3000); assert.ok(f.s.order || f.s.receipts.length); assert.equal(f.worker.workSeconds, 1770);
  assert.equal(f.s.driver.id, driver); assert.equal(f.s.vehicle.id, truck); assert.deepEqual(f.s.report, dated);
  assert.ok(Math.abs(total(f.s) - f.s.stores.initialKg - f.s.stores.harvestedKg) < 1e-7);
});
test('standing dispatch cannot bypass withdrawn authority, a blocked depot/route, occupied or exhausted original worker or vehicle', () => {
  for (const mutate of [f => f.c.standingAuthorized = false, f => f.c.standingWorkerAvailable = false,
    f => f.c.depotAvailable = false, f => f.c.routeUsable = false, f => f.worker.workSeconds = 0,
    f => f.worker.assignment = 'other-original-job', f => f.s.vehicle.fuelKm = 0, f => f.s.driver.status = 'dead',
    f => f.s.stores.farmKg = 0, f => f.s.standing.handoverId = 'other']) {
    const f = fixture(); P.standing(f.s, f.succession, f.office, f.c, true, 0);
    Object.assign(f.c, { standingAuthorized: true, standingWorkerAvailable: true, standingWorker: f.worker, productionAvailable: false });
    mutate(f); step(f, 60); assert.equal(f.s.order, null); assert.equal(f.s.receipts.length, 0);
  }
});
function sourceMap() {
  const map = World.createStrategicMap('quota-source', { refinementLevel: 1, radiusKm: 100 });
  const cityIndex = 0, farmIndex = World.topologyForMap(map).neighbors[cityIndex][0];
  const cityCell = World.cellId(cityIndex), farmCell = World.cellId(farmIndex);
  map.humanGeography = { cities: [{ id: 'a', name: 'Aster', cellId: cityCell }] };
  map.publicSettlementDirectory = { strongholdCodes: [], foundationRows: [], satelliteCodes: [`c000${farmIndex.toString(36).padStart(3, '0')}012z00100`],
    satelliteRoutePaths: [`${farmIndex.toString(36)}.${cityIndex.toString(36)}`], cellFeatures: [] };
  map.routeGraph = { routes: [] };
  map.cityGovernments = { governments: [{ cityId: 'a', charter: { id: 'charter:a' }, roleAssignments: { publicWorksAndProvisioning: 'works:a' },
    institutions: [{ id: 'works:a', name: 'Existing Works', capacityBand: 'functional' }] }] };
  map.strategicPlayableSettlementState = { cityRows: [{ cityId: 'a', assetId: 'population:a', name: 'Aster', cellId: cityCell,
    currentPopulation: 3000, physicalJurisdictionExists: true, physicalCondition: 'intact', services: { provisioning: 'functional', transport: 'functional' } }],
    satelliteRows: [{ assetId: 'satellite:c:0:0', parentId: 'a', function: 'agriculture', currentPopulation: 200,
      physicalCondition: 'intact', localRouteUsable: true, services: { provisioning: 'functional', transport: 'functional' } }] };
  return map;
}
test('source adapter decodes actual satellite identity, agricultural capacity and measured globe route without changing the world', () => {
  const map = sourceMap(), before = copy(map), source = P.sourceFromWorld(map, 'a');
  assert.equal(source.satelliteId, 'satellite:c:0:0'); assert.equal(source.institutionId, 'works:a');
  assert.equal(source.satellitePopulation, 200); assert.equal(source.storageDays, 3); assert.equal(source.arableLandBand, 'productive');
  assert.ok(source.distanceKm > 0 && source.distanceKm < 250); assert.deepEqual(map, before);
});
test('ruined, foreign, non-agricultural, unusable or unsupported assets produce no substituted farm or free convoy', () => {
  for (const change of [m => m.strategicPlayableSettlementState.cityRows[0].currentPopulation = 0,
    m => m.strategicPlayableSettlementState.cityRows[0].physicalCondition = 'ruined',
    m => m.strategicPlayableSettlementState.satelliteRows[0].parentId = 'other-city',
    m => m.strategicPlayableSettlementState.satelliteRows[0].function = 'hunting',
    m => m.strategicPlayableSettlementState.satelliteRows[0].localRouteUsable = false,
    m => m.strategicPlayableSettlementState.satelliteRows[0].currentPopulation = 0,
    m => m.strategicPlayableSettlementState.satelliteRows[0].services.transport = 'failed',
    m => m.publicSettlementDirectory.satelliteCodes = [], m => delete m.publicSettlementDirectory]) {
    const map = sourceMap(); change(map); assert.equal(P.sourceFromWorld(map, 'a'), null);
  }
});
test('supported source and authentic existing institution allocate once, with buffered contribution not whole-city coverage', () => {
  const f = fixture(); assert.equal(f.s.demand.population, 200); assert.equal(f.s.demand.kgPerDay, 100);
  assert.equal(f.s.stores.cityKg, 200); assert.equal(f.s.demand.unmetKg, 0);
  assert.equal(P.create({ ...f.source, satelliteId: '' }, f.succession, f.office, { worldId: 'w', runId: 'r' }, 0), null);
  for (const change of [f => f.source.distanceKm = 300, f => f.source.satellitePopulation = 0, f => f.source.storageDays = NaN,
    f => f.succession.handover = null, f => f.succession.control.commandRelationships = [], f => f.office.cityId = 'other']) {
    const g = fixture(); change(g); assert.equal(P.create(g.source, g.succession, g.office, { worldId: 'w', runId: 'r' }, 0), null);
  }
});
test('no orders from seizure, remote access, expired quotes, changed bodies or withdrawn relationships', () => {
  for (const change of [f => f.c.local = false, f => f.c.atCounter = false, f => f.c.workerPresent = false,
    f => f.c.free = false, f => f.c.sourceCurrent = false, f => f.c.bodyEpoch++, f => f.c.worksCurrent = false,
    f => f.c.violence = true, f => f.succession.control = null,
    f => f.worker.officeStatus = { status: 'replacedByReviewedAppointment' },
    f => f.succession.agreements[0].suspendedRoles = ['publicWorksAndProvisioning']]) {
    const f = fixture(); inspect(f); change(f);
    assert.equal(P.dispatch(f.s, f.succession, f.office, f.worker, f.c, copy(f.s.quote), 0), false);
    assert.equal(f.s.vehicle.cargoKg, 0); assert.equal(f.worker.workSeconds, 1800);
  }
  const f = fixture(); inspect(f);
  assert.equal(P.dispatch(f.s, f.succession, f.office, f.worker, f.c, { ...f.s.quote, kg: 1000 }, 0), false);
  assert.equal(P.dispatch(f.s, f.succession, f.office, f.worker, f.c, f.s.quote, 3600), false);
});
test('a command moves no food; the same original driver, finite vehicle and actual cargo complete shared road legs', () => {
  const f = fixture(), goods = total(f.s); order(f); assert.equal(f.s.vehicle.cargoKg, 0); assert.equal(f.s.stores.farmKg, 400);
  assert.equal(f.worker.workSeconds, 1770); const driver = f.s.driver.id, truck = f.s.vehicle.id;
  complete(f); assert.equal(f.s.receipts.length, 1); assert.equal(f.s.receipts[0].deliveredKg, 400);
  assert.equal(f.s.receipts[0].ownerId, 'a'); assert.equal(f.s.driver.id, driver); assert.equal(f.s.vehicle.id, truck);
  assert.equal(f.s.vehicle.location, 'city'); assert.deepEqual(f.s.driver.mapCell, P.HOME); assert.ok(f.s.vehicle.fuelKm < 600);
  assert.ok(Math.abs(total(f.s) - goods - f.s.stores.harvestedKg) < 1e-7); const receipt = copy(f.s.receipts);
  step(f, 3600); assert.deepEqual(f.s.receipts, receipt);
});
test('partial loading, hidden crop and spent resources survive normalization without remote knowledge or duplication', () => {
  const f = fixture(); order(f); const report = copy(f.s.report), farmReport = copy(f.s.farmAccount);
  for (let i = 0; i < 200 && f.s.order.phase !== 'loading'; i++) step(f, 30);
  assert.equal(f.s.order.phase, 'loading'); const half = (30 - f.s.order.handling) / 2, progress = f.s.order.handling;
  step(f, half); assert.equal(f.s.order.handling, progress + half); assert.equal(f.s.vehicle.cargoKg, 0);
  f.s = P.normalize(f.s); step(f, half); assert.equal(f.s.vehicle.cargoKg, 50);
  assert.deepEqual(f.s.report, report); assert.deepEqual(f.s.farmAccount, farmReport); complete(f);
  assert.equal(f.s.receipts.length, 1); assert.equal(f.s.receipts[0].deliveredKg, 400);
});
test('blocked departure and blocked city arrival retain actual positions without backfill or a teleport through the dock', () => {
  const f = fixture(); order(f); const home = copy(f.s.driver.mapCell); step(f, 20, { move: () => false });
  assert.deepEqual(f.s.driver.mapCell, home); assert.equal(f.s.order.phase, 'approaching');
  for (let i = 0; i < 150 && f.s.order.phase !== 'inbound'; i++) step(f, 30);
  assert.equal(f.s.order.phase, 'inbound'); f.c.depotAvailable = false; step(f, 1800);
  assert.equal(f.s.order.phase, 'inbound'); assert.equal(f.s.driver.mapCell, null); assert.equal(f.s.vehicle.mapCell, null);
  assert.equal(f.s.order.deliveredKg, 0); f.s = P.normalize(f.s); f.c.depotAvailable = true; complete(f);
  assert.equal(f.s.receipts[0].deliveredKg, 400);
});
test('route loss pauses the original road position; restoration supplies no fuel or missed handling', () => {
  const f = fixture(); order(f); step(f, 300); const fuel = f.s.vehicle.fuelKm, phase = f.s.order.phase;
  const food = f.s.driver.foodSeconds;
  assert.equal(phase, 'outbound'); f.c.routeUsable = false; const position = f.s.order.meterKm;
  step(f, 7200); assert.equal(f.s.order.meterKm, position); assert.equal(f.s.vehicle.fuelKm, fuel); assert.equal(f.s.order.deliveredKg, 0);
  assert.equal(f.s.driver.foodSeconds, food - 7200);
  f.c.routeUsable = true; step(f, 30); assert.ok(f.s.order.meterKm - position < 1); complete(f);
});
test('a genuine shared stranding retains convoy and cargo until original route recovery', () => {
  const f = fixture(); order(f); step(f, 32); const j = f.s.network.journeys[0];
  j.route.legs[0].interruption = { kind: 'stranding', triggerFraction: .2, delaySeconds: 600, revealed: false, resolved: false };
  step(f, 600); assert.equal(f.s.network.journeys[0].status, 'stranded'); const d = copy(f.s.driver), fuel = f.s.vehicle.fuelKm;
  f.s = P.normalize(f.s); step(f, 300); assert.equal(f.s.vehicle.fuelKm, fuel); assert.equal(f.s.driver.id, d.id);
  assert.equal(P.recover(f.s, f.succession, f.office, f.c, f.at), true); complete(f);
});
test('an exactly funded round trip can spend its final measured fuel increment without a free overrun or false stranding', () => {
  const f = fixture(); f.s.vehicle.fuelKm = 20; order(f); complete(f);
  assert.ok(f.s.vehicle.fuelKm < 1e-7); assert.equal(f.s.receipts[0].deliveredKg, 400);
});
test('clock chunking and an interrupted save preserve the same delivery date, custody and finite resources', () => {
  const coarse = fixture(), fine = fixture(); order(coarse); order(fine);
  step(coarse, 5000);
  for (let n = 0; n < 5000; n++) { step(fine, 1); if (n === 700) fine.s = P.normalize(fine.s); }
  assert.deepEqual(coarse.s.receipts, fine.s.receipts);
  for (const key of ['cityKg', 'farmKg', 'harvestedKg']) assert.ok(Math.abs(coarse.s.stores[key] - fine.s.stores[key]) < 1e-6);
  assert.ok(Math.abs(coarse.s.vehicle.fuelKm - fine.s.vehicle.fuelKm) < 1e-6);
  assert.ok(Math.abs(coarse.s.driver.workSeconds - fine.s.driver.workSeconds) < 1e-6);
});
test('death, incapacity, duty and supplies preserve original stalled bodies, cargo and appointments', () => {
  for (const change of [f => f.s.driver.status = 'dead', f => f.c.driverIncapacitated = true,
    f => f.s.driver.workSeconds = 0, f => f.s.driver.foodSeconds = 0, f => f.s.vehicle.condition = 0]) {
    const f = fixture(); order(f); step(f, 32); change(f); const fuel = f.s.vehicle.fuelKm;
    step(f, 5000); assert.equal(f.s.vehicle.fuelKm, fuel); assert.equal(f.s.receipts.length, 0);
    assert.equal(f.succession.handover.id, 'authentic-handover');
  }
});
test('finite original harvest, storage capacity, consumption and unmet contribution conserve food without whole-city deaths', () => {
  const f = fixture(); step(f, 5 * P.DAY);
  assert.ok(f.s.demand.unmetKg > 0); assert.equal(f.s.stores.farmKg, f.s.stores.farmCapacityKg);
  assert.equal(f.s.stores.harvestedKg, 0); // full store cannot create extra harvest
  assert.equal(f.s.stores.cityKg, 0); assert.equal(f.s.source.cityPopulation, 3000);
  assert.equal(f.succession.control.recognizedAuthorityId, 'scientist');
  f.s.stores.farmKg -= 300; step(f, 5 * P.DAY); assert.ok(Math.abs(f.s.stores.harvestedKg - 300) < 1e-6);
  assert.ok(Math.abs(f.s.stores.standingCropKg) < 1e-6); const quantity = f.s.stores.farmKg; step(f, 2 * P.DAY);
  assert.ok(Math.abs(f.s.stores.farmKg - quantity) < 1e-6);
});
test('counter inspection does not invent a fresh remote harvest account; received reports omit private reserves', () => {
  const f = fixture(); f.s.stores.farmKg = 200; step(f, 10000); inspect(f);
  assert.equal(f.s.quote.farmKg, 400); assert.equal(f.s.quote.farmAccountAt, 0); assert.equal(f.s.report.farmAccount.at, 0);
  assert.doesNotMatch(JSON.stringify(f.s.report), /fuelKm|health|workSeconds|standingCropKg|journeyId|skills/);
  const saved = copy(f.s.report); f.c.local = false; step(f, 3600); assert.equal(P.receive(f.s, f.c, f.at), false); assert.deepEqual(f.s.report, saved);
});
test('rest is finite supplied eight-hour recovery, not healing, a fuel reset or an instant ration-to-duty conversion', () => {
  const f = fixture(); f.s.driver.workSeconds = 0; f.s.driver.health = 70;
  assert.equal(P.rest(f.s, f.succession, f.office, f.c, 0), true); step(f, 14400);
  assert.equal(f.s.driver.workSeconds, 0); f.s = P.normalize(f.s); f.c.depotAvailable = false; step(f, 14400);
  assert.equal(f.s.rest.progress, 14400); f.c.depotAvailable = true; step(f, 14400);
  assert.equal(f.s.rest, null); assert.equal(f.s.driver.workSeconds, 28800); assert.equal(f.s.driver.health, 70);
  assert.equal(f.s.vehicle.fuelKm, 600); assert.equal(f.s.driver.foodSeconds, 57600);
});
test('actual clean carried resupply is consumed once, capped and cannot launder city goods or create paid employment', () => {
  const f = fixture(), stacks = [{ key: 'fuelReagent', quantity: 2, carriedBy: 'scientist' }]; f.s.vehicle.fuelKm = 200;
  assert.equal(P.replenish(f.s, f.succession, f.office, f.c, 'fuelReagent', stacks, 0), true);
  assert.equal(f.s.vehicle.fuelKm, 400); assert.equal(stacks[0].quantity, 1);
  stacks[0].cityOwnerId = 'a'; assert.equal(P.replenish(f.s, f.succession, f.office, f.c, 'fuelReagent', stacks, 0), false);
});
test('remote cancellation is not recall or cargo deletion; original actual return settles once', () => {
  const f = fixture(); order(f); step(f, 400); const cell = f.s.driver.mapCell;
  assert.equal(P.cancel(f.s, f.succession, f.office, f.c, f.at), true); assert.equal(f.s.driver.mapCell, cell);
  complete(f); assert.equal(f.s.receipts[0].retainedCargoKg, 0); assert.equal(f.s.vehicle.cargoKg, 0);
  assert.equal(f.succession.handover.id, 'authentic-handover');
});
test('irreversible scientist death freezes all production, need, travel and work; independent runs inherit no allocation', () => {
  const f = fixture(); order(f); step(f, 300); f.c.alive = false; const saved = copy(f.s); step(f, P.DAY);
  assert.deepEqual(f.s, saved); const other = P.create(f.source, f.succession, f.office, { worldId: 'world', runId: 'run:other' }, 0);
  assert.equal(other.runId, 'run:other'); assert.equal(other.order, null); assert.deepEqual(other.receipts, []);
});
