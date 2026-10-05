const { test, expect } = require('@playwright/test');
const { robberyFixture } = require('./helpers/corridor-robbery-fixture');
const Robbery = require('../corridor-robbery');
const Road = require('../corridor-beasts');
const Market = require('../intercity-smuggling');
const Living = require('../living-smuggling');
const copy = x => JSON.parse(JSON.stringify(x));
test('scenario presence is saved independently of cargo and never replenishes actors or ammunition', () => {
  const f = robberyFixture(), state = {};
  Robbery.provision(state, f.route, 'bandits', 0); const saved = copy(state);
  Robbery.provision(state, f.route, 'new-seed', 1000); expect(state).toEqual(saved);
  const g = Robbery.createGroup(f.route, 0); expect(g.members).toHaveLength(3);
  expect(new Set(g.members.map(p => p.id)).size).toBe(3); expect(g.truck.seats).toBe(3);
  expect(g.objective).toBe('takeLoadedVan'); expect(g.firePolicy).toBe('holdFire');
  state.roadsideGroups[0].group = g; g.members[0].status = 'dead'; g.members[1].weapon.ammunition = 0;
  const depleted = copy(state); Robbery.provision(state, f.route, 'replacement', 2000); expect(state).toEqual(depleted);
});
test('surrender precedes physical capture, inspection and actual withdrawal of the original loaded van', () => {
  const f = robberyFixture(), manifest = copy(f.sh.manifest), vehicleId = f.op.vehicleId;
  f.until('approach'); expect(f.op.controllerId).toBeUndefined(); expect(f.sh.robbery.observations).toEqual([]);
  f.until('secure'); expect(f.sh.phase).toBe('outbound'); expect(f.op.crew[0].capture).toBeUndefined();
  f.until('inspect'); expect(f.sh.phase).toBe('captured'); expect(f.op.controllerId).toBe(f.group.id);
  expect(f.sh.robbery.observations).toEqual([]); expect(f.sh.offRoadKm).toBeUndefined();
  const fuel = f.op.fuelKm; f.until('withdrawing'); expect(f.sh.robbery.observations).toHaveLength(1);
  f.until('holding'); expect(f.sh.offRoadKm).toBeCloseTo(.5); expect(f.op.fuelKm).toBeLessThan(fuel);
  expect(f.op.vehicleId).toBe(vehicleId); expect(f.sh.manifest).toEqual(manifest); expect(f.sh.custodian).toBe(vehicleId);
  expect(f.sh.owner).toBe('player'); expect(f.op.assignment).toBe(f.sh.id); expect(f.op.crew[0].capture.active).toBe(true);
  expect(f.sh.robbery.shots).toEqual([]); expect(f.op.crew[0].health).toBe(100); expect(f.sh.receiptAt).toBeNull();
  expect(f.group.truck.positionKm).toBe(1); expect(f.group.members.find(p => p.role === 'lookout').offRoadKm).toBe(0);
  expect(f.state.jailCustody).toBeUndefined();
});
test('flight and turning back are real movement, and refusal is not an automatic shot', () => {
  for (const response of ['flee', 'turnBack']) {
    const f = robberyFixture(); f.safety.robberyResponse = response; f.step(600);
    expect(f.sh.robbery.controlAt).toBeNull(); expect(f.sh.robbery.shots).toEqual([]);
    expect(f.safety.cabinIntegrity).toBe(100); expect(f.op.crew[0].capture).toBeUndefined();
    expect(f.sh.phase).toBe(response === 'turnBack' ? 'returned' : 'outbound');
  }
});
test('unseen or inaccessible attackers cannot capture; interrupted securing grants no control', () => {
  for (const defect of ['hidden', 'barrier', 'absent', 'unarmed', 'controls', 'withdrawSurrender']) {
    const f = robberyFixture();
    if (defect === 'hidden') f.group.visible = false;
    if (defect === 'barrier') f.group.barrier = true;
    if (defect === 'absent') f.group.members.forEach(p => { p.positionKm = 100; });
    if (defect === 'unarmed') f.group.members.forEach(p => { p.weapon.ammunition = 0; });
    if (defect === 'controls') f.safety.controlsAccessible = false;
    if (defect === 'withdrawSurrender') { f.until('secure'); f.safety.robberyResponse = 'flee'; }
    f.step(600); expect(f.op.controllerId, defect).toBeUndefined(); expect(f.op.crew[0].capture).toBeUndefined();
    expect(f.sh.robbery?.observations || []).toEqual([]);
  }
});
test('seized communicator prevents remote commands and reports, without revealing hidden loot or location', () => {
  const f = robberyFixture(); f.until('inspect'); const reports = copy(f.sh.corridorReports);
  expect(reports.at(-1).text).toContain('not a lawful arrest');
  expect(Road.requestAbort(f.state, f.sh.id, f.now())).toBe(false);
  expect(Road.report(f.sh, f.op, f.now(), 'not allowed')).toBe(false);
  f.until('holding'); expect(f.sh.corridorReports).toEqual(reports);
  expect(JSON.stringify(reports)).not.toMatch(/observations|refuge|offRoadKm|original-lot|ammunition/);
});
test('offline robbery remains physical and unsent messages are never backfilled', () => {
  const f = robberyFixture(); f.safety.radio.connected = false; f.until('holding');
  expect(f.sh.corridorReports).toBeUndefined(); f.safety.radio.connected = true; f.step(30);
  expect(f.sh.corridorReports).toBeUndefined(); expect(f.sh.phase).toBe('captured');
});
test('withdrawal needs actual driving skill, seats, trail, fuel and vehicle condition', () => {
  for (const defect of ['driver', 'seats', 'trail', 'fuel', 'condition']) {
    const f = robberyFixture(); f.until('inspect');
    if (defect === 'driver') f.group.members.find(p => p.canDrive).canDrive = false;
    if (defect === 'seats') f.safety.cabinSeats = 1;
    if (defect === 'trail') f.group.refuge.trailOpen = false;
    if (defect === 'fuel') f.op.fuelKm = 0;
    if (defect === 'condition') f.op.condition = 40;
    f.step(500); expect(f.sh.offRoadKm || 0, defect).toBe(0); expect(f.sh.phase).toBe('captured');
    expect(f.sh.robbery.phase).toBe('withdrawing');
  }
});
test('loss of a capable nearby armed guard ends detention without teleporting the free crew', () => {
  for (const defect of ['absent', 'health', 'provisions', 'weapon']) {
    const f = robberyFixture(); f.until('holding'); const guard = f.group.members.find(p => p.role === 'leader');
    if (defect === 'absent') guard.offRoadKm = 0;
    if (defect === 'health') guard.health = 0;
    if (defect === 'provisions') guard.provisions = 0;
    if (defect === 'weapon') guard.weapon.ammunition = 0;
    f.safety.radio.connected = false; const position = f.sh.positionKm; f.step(5);
    expect(f.op.crew[0].capture.active, defect).toBe(false); expect(f.op.controllerId).toBeUndefined();
    expect(f.sh.phase).toBe('stranded'); expect(f.sh.offRoadKm).toBeCloseTo(.5); expect(f.sh.positionKm).toBe(position);
    expect(f.safety.radio.connected).toBe(false);
    expect(f.safety.radio.custodianId).toBe(defect === 'absent' ? guard.id : undefined);
  }
});
test('optional gunfire requires ammunition and contact, hitting the exterior before an exposed occupant', () => {
  const f = robberyFixture(); f.safety.robberyResponse = 'flee'; f.group.firePolicy = 'disableVehicle';
  f.until('demand'); f.step(10); expect(f.sh.robbery.shots.length).toBeGreaterThan(0);
  expect(f.safety.cabinIntegrity).toBeLessThan(100); expect(f.op.crew[0].health).toBe(100);
  f.safety.cabinIntegrity = 0; f.op.fuelKm = 0; f.op.crew[0].health = 55; f.step(20);
  expect(f.op.crew[0].health).toBeLessThan(50); expect(f.op.crew[0].status).toBe('alive');
  expect(f.sh.manifest.entries[0].stack.id).toBe('original-lot');
  const shots = f.sh.robbery.shots.length; f.group.members.forEach(p => { p.weapon.ammunition = 0; }); f.step(20);
  expect(f.sh.robbery.shots).toHaveLength(shots);
});
test('captured living cargo consumes the same kit and wears the pod without giving captors hidden biology', () => {
  const f = robberyFixture({ living: true }); f.until('holding');
  const food = f.sh.living.foodLeft, pod = f.sh.living.podCondition, report = copy(f.sh.living.report);
  f.step(3600); expect(f.sh.living.foodLeft).toBeLessThan(food); expect(f.sh.living.podCondition).toBeLessThan(pod);
  expect(f.sh.living.report).toEqual(report); expect(f.sh.manifest.entries[0].creature.id).toBe('specimen');
  expect(JSON.stringify(f.sh.robbery.observations)).not.toMatch(/genome|bodyIntegrity|nutrition/);
  expect(f.group.members.some(p => p.trainedHandler)).toBe(false);
});
test('reload and large versus small steps preserve capture and closed-sale accounting exactly once', () => {
  const f = robberyFixture(); f.until('secure'); const saved = copy(f.state);
  f.step(700); Market.advance(saved, f.now(), [f.route]); expect(saved).toEqual(f.state);
  const small = robberyFixture(); for (let at = 0; at < f.now(); at++) small.step(); expect(small.state).toEqual(f.state);
  f.sh.deliveryDeadlineAt = f.now() + 10; f.step(20); const money = f.state.buyers[0].money;
  expect(f.sh.playerEscrow).toBe(0); expect(f.sh.phase).toBe('captured'); expect(Market.settle(f.state, f.sh.id, f.now())).toBe(0);
  f.step(20); expect(f.state.buyers[0].money).toBe(money); expect(f.op.assignment).toBe(f.sh.id);
});
test('living capture persists across reload and guard loss is not a new laboratory handoff', () => {
  const f = robberyFixture({ living: true }); f.until('holding'); const saved = copy(f.state);
  f.step(100); Living.advance(saved, f.now(), [f.route], { ok: true, cityId: 'a', distanceKm: 8 }, []);
  expect(saved).toEqual(f.state); expect(Living.receive(f.state, f.sh.id, f.now())).toBeNull();
  f.group.members.find(p => p.role === 'leader').status = 'dead'; f.step(3);
  expect(f.sh.phase).toBe('stranded'); expect(f.sh.manifest.entries[0].creature.id).toBe('specimen');
});
test('one group cannot capture two concurrent convoys or gain double movement on reload', () => {
  const f = robberyFixture(), bio = robberyFixture({ living: true });
  bio.sh.id = 'second-convoy'; bio.op.assignment = bio.sh.id; bio.sh.positionKm = .85;
  f.state.operators.push(bio.op); f.state.shipments.push(bio.sh); f.state.buyers[0].money -= 800;
  const saved = copy(f.state), local = { ok: true, cityId: 'a', distanceKm: 8 };
  Market.advanceConvoys(f.state, 600, [f.route], null, local, []);
  for (let at = 1; at <= 600; at++) Market.advanceConvoys(saved, at, [f.route], null, local, []);
  expect(saved).toEqual(f.state); expect(bio.sh.phase).toBe('captured'); expect(f.sh.robbery).toBeUndefined();
  expect(f.group.assignment).toBe(bio.sh.id); expect(f.state.roadsideGroups).toHaveLength(1);
});
test('guard supply exhaustion ends actual restraint rather than creating permanent flag-based captivity', () => {
  const f = robberyFixture(); f.until('holding');
  const guard = f.group.members.find(p => p.role === 'leader'); guard.provisions = 2 / 28800;
  f.step(5); expect(guard.provisions).toBe(0); expect(f.op.crew[0].capture.active).toBe(false);
  expect(f.sh.phase).toBe('stranded'); expect(f.sh.offRoadKm).toBeCloseTo(.5);
});
test('capture is no beast immunity, and beasts must reach the new lateral location rather than the old road position', () => {
  for (const nearby of [false, true]) {
    const f = robberyFixture(); f.until('holding');
    const beast = Road.createActor('late-beast', 'beast:rimefang-pack', 'pack', f.sh.positionKm, f.now());
    beast.offsetKm = nearby ? f.sh.offRoadKm : 0;
    f.state.corridorBeasts = [{ routeId: f.route.id, lengthKm: f.route.distanceKm, actors: [beast] }];
    const protection = f.safety.cabinIntegrity; f.step(10);
    expect(f.safety.cabinIntegrity < protection).toBe(nearby);
  }
});
test('a missing group cannot leave a permanent captive flag or teleport its confiscated radio back', () => {
  const f = robberyFixture(); f.until('holding'); const holder = f.safety.radio.custodianId;
  f.state.roadsideGroups[0].group = null; f.step(3);
  expect(f.op.crew[0].capture.active).toBe(false); expect(f.sh.phase).toBe('stranded');
  expect(f.safety.radio.custodianId).toBe(holder); expect(f.sh.offRoadKm).toBeCloseTo(.5);
});
