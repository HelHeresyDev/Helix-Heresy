const { test, expect } = require('@playwright/test');
const { beastFixture } = require('./helpers/corridor-beast-fixture');
const Beasts = require('../corridor-beasts');
const Market = require('../intercity-smuggling');
const Living = require('../living-smuggling');
const copy = x => JSON.parse(JSON.stringify(x));
test('bounded materialization depends on saved regional presence, not cargo value, and never replenishes', () => {
  const route = { id: 'road', distanceKm: 30 }, population = { id: 'pack', speciesId: 'beast:rimefang-pack', populationIndex: 1000, positionKm: 15 };
  const state = {}, other = {};
  Beasts.provision(state, route, [population], 'road-seed', 0); Beasts.provision(other, route, [population], 'road-seed', 0);
  expect(state).toEqual(other); expect(state.corridorBeasts).toHaveLength(1);
  expect(state.corridorBeasts[0].actors).toHaveLength(1);
  const before = copy(state); Beasts.provision(state, route, [population], 'different-seed', 1000); expect(state).toEqual(before);
  if (state.corridorBeasts[0].actors.length) {
    state.corridorBeasts[0].actors[0].status = 'dead'; Beasts.provision(state, route, [population], 'new', 2000);
    expect(state.corridorBeasts[0].actors[0].status).toBe('dead');
  }
  const absent = {}; Beasts.provision(absent, route, [{ ...population, populationIndex: 0 }], 'road-seed', 0);
  expect(absent.corridorBeasts[0].actors).toEqual([]);
  expect(() => Beasts.createActor('new', 'invented-species', 'pack', 1, 0)).toThrow();
});
test('approach precedes contact and a faster van escapes without invented damage or cargo loss', () => {
  const f = beastFixture({ continuity: 'continuous' }), original = copy(f.sh.manifest); f.beast.offsetKm = .16; f.safety.sightKm = .2;
  f.advance(90); expect(f.beast.targetId).toBeNull(); expect(f.sh.corridorReports).toBeUndefined();
  f.advance(500); expect(f.beast.finished).toContain(f.sh.id);
  expect(f.safety.cabinIntegrity).toBe(100); expect(f.op.crew[0].health).toBe(100); expect(f.sh.manifest).toEqual(original);
  expect(f.sh.corridorReports.some(r => r.text.includes('sighted'))).toBe(true);
  expect(JSON.stringify(f.sh.corridorReports)).not.toMatch(/effortSeconds|targetId|rememberedUntil|populationId/);
});
test('contact damages the exterior before crew, may strand the exact vehicle, and never creates replacement cargo', () => {
  const f = beastFixture(), manifest = copy(f.sh.manifest), vehicleId = f.op.vehicleId;
  f.advance(500); expect(f.op.condition).toBeLessThan(50); expect(f.safety.cabinIntegrity).toBeLessThan(100);
  expect(f.op.vehicleId).toBe(vehicleId); expect(f.op.assignment).toBe(f.sh.id); expect(f.sh.receiptAt).toBeNull();
  expect(f.sh.manifest).toEqual(manifest); expect(f.sh.owner).toBe('player'); expect(f.sh.custodian).toBe(vehicleId);
  expect(f.sh.corridorReports.some(r => r.text.includes('cannot proceed'))).toBe(true);
  const position = f.sh.positionKm; f.advance(800); expect(f.sh.positionKm).toBe(position);
});
test('injury requires a breached cabin and actual reachable strikes, not a failed escape label', () => {
  const f = beastFixture({ km: .001 }); f.beast.offsetKm = 0; f.safety.cabinIntegrity = 0;
  f.op.crew[0].health = 55; f.beast.effortSeconds = 9; f.advance(20);
  expect(f.op.crew[0].health).toBeLessThan(50); expect(f.op.crew[0].status).toBe('alive');
  expect(f.op.crew[0].injuries[0].cause).toContain('breached cabin');
  expect(f.state.scientist).toBeUndefined();
  const protectedCrew = beastFixture({ km: .001 }); protectedCrew.beast.offsetKm = 0; protectedCrew.beast.effortSeconds = 2; protectedCrew.advance(5);
  expect(protectedCrew.op.crew[0].health).toBe(100); expect(protectedCrew.safety.cabinIntegrity).toBeLessThan(100);
});
test('barriers, absent sensory contact, dead or weakened beasts prevent attacks', () => {
  for (const defect of ['barrier', 'far', 'dead', 'injured']) {
    const f = beastFixture();
    if (defect === 'barrier') f.safety.barrier = true;
    if (defect === 'far') f.beast.offsetKm = 2;
    if (defect === 'dead') f.beast.status = 'dead';
    if (defect === 'injured') f.beast.health = 1;
    f.advance(500); expect(f.safety.cabinIntegrity, defect).toBe(100);
  }
});
test('driver can turn back on sight; radio requests require contact and independent acceptance', () => {
  const f = beastFixture({ continuity: 'continuous' }); f.safety.driverChoice = 'turnBack'; f.safety.sightKm = .18; f.advance(500);
  expect(f.sh.saleFailedAt).not.toBeNull(); expect(f.sh.receiptAt).toBeNull(); expect(f.sh.phase).toBe('returned');
  for (const defect of ['offline', 'power', 'charges', 'unconscious', 'refusal']) {
    const g = beastFixture();
    if (defect === 'offline') g.safety.radio.connected = false;
    if (defect === 'power') g.safety.radio.powered = false;
    if (defect === 'charges') g.safety.radio.charges = 0;
    if (defect === 'unconscious') g.op.crew[0].health = 10;
    if (defect === 'refusal') g.safety.acceptAbort = false;
    expect(Beasts.requestAbort(g.state, g.sh.id, 1)).toBe(defect === 'refusal'); expect(g.sh.returnRequestedAt).toBeUndefined();
  }
  const g = beastFixture(); expect(Beasts.requestAbort(g.state, g.sh.id, 1)).toBe(true);
  expect(g.sh.returnRequestedAt).toBe(1); g.advance(10); expect(g.sh.saleFailedAt).toBe(1);
});
test('outages suppress observations without freezing physical attacks or inventing retrospective reports', () => {
  const f = beastFixture(); f.safety.radio.connected = false; f.advance(500);
  expect(f.op.condition).toBeLessThan(50); expect(f.sh.corridorReports).toBeUndefined();
  f.safety.radio.connected = true; f.advance(700); expect(f.sh.corridorReports).toBeUndefined();
});
test('save/load and small versus large clock steps preserve the physical encounter', () => {
  const f = beastFixture(); f.advance(160); const saved = copy(f.state);
  f.advance(500); Market.advance(saved, 500, [f.route]); expect(saved).toEqual(f.state);
  const small = beastFixture(); for (let at = 1; at <= 500; at++) small.advance(at);
  expect(small.state).toEqual(f.state);
});
test('living care and pod wear continue while stranded, without treating exterior attacks as specimen hits', () => {
  const f = beastFixture({ living: true }); f.advance(500);
  expect(f.op.condition).toBeLessThan(50); expect(f.sh.manifest.entries[0].creature.id).toBe('specimen');
  expect(f.sh.manifest.entries[0].creature.stats.bodyIntegrity.current).toBe(100);
  expect(f.sh.living.podCondition).toBeGreaterThan(90);
  const position = f.sh.positionKm, food = f.sh.living.foodLeft, pod = f.sh.living.podCondition;
  f.advance(4100); expect(f.sh.positionKm).toBe(position); expect(f.sh.living.foodLeft).toBeLessThan(food);
  expect(f.sh.living.podCondition).toBeLessThan(pod); expect(f.op.assignment).toBe(f.sh.id);
  const saved = copy(f.state); f.advance(4200); Living.advance(saved, 4200, [f.route], { ok: true, cityId: 'a', distanceKm: 8 }, []);
  expect(saved).toEqual(f.state);
});
test('deadline refunds exactly once while physical recovery remains unresolved', () => {
  const f = beastFixture(); f.sh.deliveryDeadlineAt = 600; f.advance(900);
  const money = f.state.buyers[0].money; expect(f.sh.saleFailedAt).toBe(600); expect(f.sh.phase).toBe('returning');
  expect(f.sh.playerEscrow).toBe(0); expect(Market.settle(f.state, f.sh.id, 900)).toBe(0);
  f.advance(1000); expect(f.state.buyers[0].money).toBe(money); expect(f.sh.manifest.entries[0].stack.id).toBe('original-lot');
});
test('concurrent ordinary and biological convoys share one chronological beast, without double movement or starvation', () => {
  const f = beastFixture(), bio = beastFixture({ living: true });
  bio.sh.id = 'biological-convoy'; bio.op.assignment = bio.sh.id; bio.sh.positionKm = .85;
  f.state.operators.push(bio.op); f.state.shipments.push(bio.sh); f.state.buyers[0].money -= 800;
  const loaded = copy(f.state), local = { ok: true, cityId: 'a', distanceKm: 8 };
  Market.advanceConvoys(f.state, 500, [f.route], null, local, []);
  for (let at = 1; at <= 500; at++) Market.advanceConvoys(loaded, at, [f.route], null, local, []);
  expect(loaded).toEqual(f.state); expect(bio.op.condition).toBeLessThan(50);
  expect(f.safety.cabinIntegrity).toBe(100); expect(f.beast.finished).toContain(bio.sh.id);
});
test('offline living care consumes its kit without revealing a fresh condition report', () => {
  const f = beastFixture({ living: true }); f.safety.radio.connected = false;
  const food = f.sh.living.foodLeft; f.advance(500);
  expect(f.sh.living.foodLeft).toBeLessThan(food); expect(f.sh.living.report).toBeNull();
  expect(f.sh.corridorReports).toBeUndefined(); expect(f.op.condition).toBeLessThan(50);
});
