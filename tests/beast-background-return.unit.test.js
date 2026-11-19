const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-regional-foodweb');
const { source } = require('./helpers/regional-foodweb-source');
const copy = x => JSON.parse(JSON.stringify(x)), binding = { worldId: 'world', runId: 'return' };
function setup(count = 3, prepare = () => {}, species = 'gravebloom-elk') {
  const original = source([[species, 0, count]]); original.nativeEncounters = true; prepare(original);
  const s = P.create(original, binding), g = s.groups[0], c = g.cohorts[0];
  const ctx = { alive: true, local: true, tileSizeM: 1, terrain: () => ({ floor: true, oxygen: true, waterDepthM: 0, supportKg: 1e12 }),
    originalPosition: () => ({ regionId: 'ground', cell: { x: 20, y: 20, z: 0 }, altitudeM: 0, mode: 'walking' }),
    originalReserves: () => ({ stamina: c.regional.stamina, mana: c.regional.mana, energy: copy(c.regional.energy) }) };
  const actor = P.claimLocal(s, g.id, c.id, 0, 'original-elk', 0, ctx);
  actor.nativePopulation = { sourceId: s.sourceId, regionId: 'ground', siteId: 'site', frame: { eastM: 0, northM: 0 },
    bounds: { x: 0, y: 0, z: 0, width: 100, height: 100 }, tileSizeM: 1 };
  return { s, actor, ctx };
}
const position = { regionId: 'ground', eastM: 20, northM: 20, altitudeM: 0 };
test('an encountered individual returns once, consumes elapsed resources and retains identity and wounds on reclaim', () => {
  const { s, actor, ctx } = setup(1000000), originalId = actor.life.originalMemberId;
  actor.name = 'Recognizable elk'; actor.health -= 4; actor.bodyPhysics.parts['left foreleg'] = 41;
  actor.life.memories.push({ id: 'heard-scientist', cell: { x: 19, y: 20, z: 0 }, at: 0 });
  const before = copy(actor), water = s.regions[0].stocks.waterL;
  assert.equal(P.returnLocal(s, actor.id, 0, position), true);
  assert.equal(P.returnLocal(s, actor.id, 0, position), false);
  assert.equal(P.audit(s)['population-0'].background, 1000000);
  assert.equal(s.groups[0].cohorts.filter(c => c.personalActor).length, 1);
  assert.ok(P.normalize(s, binding));
  P.advance(s, 3600, true, true);
  const c = s.groups[0].cohorts.find(c => c.personalActor && P.count(c)); assert.ok(c);
  assert.ok(s.regions[0].stocks.waterL < water); assert.equal(c.health, before.health / before.maxHealth);
  const restored = P.normalize(copy(s), binding); assert.ok(restored);
  const body = P.claimLocal(restored, 'group-0', c.id, 0, actor.id, restored.clock, {
    ...ctx, originalReserves: () => ({ stamina: c.regional.stamina, mana: c.regional.mana, energy: copy(c.regional.energy) }) });
  assert.ok(body); assert.equal(body.id, actor.id); assert.equal(body.life.originalMemberId, originalId);
  assert.equal(body.name, before.name); assert.equal(body.health, before.health);
  assert.deepEqual(body.life.memories, before.life.memories); assert.equal(body.bodyPhysics.parts['left foreleg'], 41);
  assert.ok(body.life.ageDays > before.life.ageDays); assert.equal(P.audit(restored)['population-0'].detailed, 1);
});
test('a returned original can actually die, and its finite corpse has one owner and one death', () => {
  const { s, actor } = setup();
  assert.equal(P.returnLocal(s, actor.id, 0, position), true);
  const c = s.groups[0].cohorts.find(c => c.personalActor);
  assert.equal(P.kill(s, 'group-0', c.id, 0, 1, 'actual-habitat-loss'), true);
  assert.equal(P.kill(s, 'group-0', c.id, 0, 1, 'actual-habitat-loss'), false);
  assert.equal(s.details[actor.id].actor.status, 'dead');
  assert.equal(P.audit(s)['population-0'].dead, 1);
  assert.equal(Object.values(s.regions[0].remainsBatches || {}).filter(row => row.sourceKey === actor.life.originalMemberId).length, 1);
  assert.ok(P.normalize(copy(s), binding));
});
test('actual unsupported absence causes starvation rather than freezing or healing the original', () => {
  const { s, actor } = setup();
  actor.health = actor.maxHealth * .01;
  actor.life.stores = { foodKg: 0, waterL: 0, fatKg: 0, mineralsKg: 0 };
  actor.bodyPhysics.massKg = actor.life.structuralKg;
  for (const key of ['forageKg', 'waterL']) P.removeStock(s, 'ground', key, s.regions[0].stocks[key], 0, 'actual-catchment-loss');
  P.returnLocal(s, actor.id, 0, position);
  P.advance(s, P.DAY / 4, true, true);
  assert.equal(s.details[actor.id]?.actor.status, 'dead');
  assert.equal(s.losses.filter(l => l.memberId === actor.life.originalMemberId).length, 1);
  assert.ok(P.normalize(copy(s), binding));
});
test('repeated leave/reclaim preserves funded brood identity, investment, cooldown and personal memories', () => {
  const { s, actor, ctx } = setup();
  s.regions[0].stocks.forageKg -= 2;
  actor.life.populationBroods = [{ id: 'original-funded-brood', startedAt: 0, dueAt: 30 * P.DAY,
    investedKg: 2, requiredKg: 5, investedMana: 0, requiredMana: 0, fragment: false, materialRecipe: { forageKg: 1 },
    parentIds: [actor.id, 'original-mate'], success: true, emitted: [], ready: false,
    externalNursery: true, sourceRegionId: 'ground', sourceNurseryId: 'unavailable-original-nest' }];
  actor.life.lastAttemptAt = 0; actor.life.opportunities = .25;
  let current = actor;
  for (let i = 0; i < 3; i++) {
    assert.equal(P.returnLocal(s, current.id, s.clock, position), true);
    P.advance(s, s.clock + 60, true, true);
    const c = s.groups[0].cohorts.find(c => c.personalActor && P.count(c));
    assert.equal(c.demography.broods[0].investedKg, 2);
    current = P.claimLocal(s, 'group-0', c.id, 0, actor.id, s.clock, {
      ...ctx, originalReserves: () => ({ stamina: c.regional.stamina, mana: c.regional.mana, energy: copy(c.regional.energy) }) });
    assert.ok(current); assert.equal(current.life.populationBroods[0].id, 'original-funded-brood');
    assert.deepEqual(current.life.populationBroods[0].parentIds, [actor.id, 'original-mate']);
    assert.equal(current.life.lastAttemptAt, 0); assert.equal(current.life.populationBroods[0].investedKg, 2);
    assert.equal(s.births.length, 0); assert.ok(P.normalize(copy(s), binding));
  }
});
test('returned originals move along actual routes and cannot reappear in a vacated window', () => {
  const { s, actor, ctx } = setup(4, src => {
    const next = copy(src.regions[0]); next.id = 'downstream';
    src.spatialContinuity = true;
    src.regions.push(next); src.regions[0].edges = [{ id: next.id, distanceKm: .1, traversable: true,
      departurePosition: position, arrivalPosition: { ...position, regionId: next.id, eastM: 65 } }];
    src.groups[0].instinct = { mode: 'instinctive', route: [next.id] };
  });
  assert.equal(P.returnLocal(s, actor.id, 0, position), true);
  const g = s.groups[0]; g.intention.departAt = 1;
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'rate-refresh');
  P.advance(s, 1); assert.ok(g.transit);
  P.advance(s, g.transit.edgeArriveAt);
  const c = g.cohorts.find(c => c.personalActor);
  assert.equal(g.regionId, 'downstream');
  assert.equal(F.position(g, s.regions[1], c, 0).regionId, 'downstream');
  assert.equal(P.claimLocal(s, g.id, c.id, 0, actor.id, s.clock, ctx), null);
  assert.ok(P.normalize(copy(s), binding));
});
test('a locally held original does not teleport after the rest of its group migrates', () => {
  const { s, actor } = setup(4, src => {
    const next = copy(src.regions[0]); next.id = 'downstream';
    src.regions.push(next); src.regions[0].edges = [{ id: next.id, distanceKm: .1, traversable: true }];
    src.groups[0].instinct = { mode: 'instinctive', route: [next.id] };
  });
  const g = s.groups[0]; g.intention.departAt = 1;
  P.removeStock(s, 'ground', 'waterL', 0, 0, 'rate-refresh');
  P.advance(s, 1); P.advance(s, g.transit.edgeArriveAt);
  assert.equal(g.regionId, 'downstream'); assert.equal(g.knowledge[0].regionId, 'downstream');
  assert.equal(P.returnLocal(s, actor.id, s.clock, position), true);
  const individualGroup = s.groups.find(g => g.cohorts.some(c => c.personalActor));
  assert.equal(individualGroup.regionId, 'ground'); assert.deepEqual(individualGroup.knowledge, []);
  assert.equal(F.position(individualGroup, s.regions[0], individualGroup.cohorts[0], 0).eastM, position.eastM);
  assert.equal(P.audit(s)['population-0'].background, 4);
  assert.ok(P.normalize(copy(s), binding));
});
test('a learned ability and its already paid casting ledger survive absence together', () => {
  const Spell = require('../beast-spell-imitation');
  const { s, actor, ctx } = setup(1, () => {}, 'mirror-ape');
  // A previously learned original with one already paid, completed cast.
  const spell = actor.spellImitation, cost = Spell.SPELL.manaCost;
  spell.known = [{ spellId: Spell.SPELL.id, castId: 'witnessed', casterId: 'scientist',
    roomId: actor.roomId, casterCell: actor.mapCell, observedAt: 0 }];
  spell.mana = Spell.MANA - cost; spell.spent = cost;
  spell.casts = [{ id: 'paid-original-cast', at: 0, targetId: 'target', state: 'released' }];
  assert.ok(Spell.valid(actor)); const learned = copy(spell);
  assert.equal(P.returnLocal(s, actor.id, 0, position), true);
  P.advance(s, 60, true, true);
  const restored = P.normalize(copy(s), binding); assert.ok(restored);
  const c = restored.groups[0].cohorts.find(c => c.personalActor);
  const reclaimed = P.claimLocal(restored, 'group-0', c.id, 0, actor.id, 60, {
    ...ctx, originalReserves: () => ({ stamina: c.regional.stamina, mana: c.regional.mana, energy: copy(c.regional.energy) }) });
  assert.ok(Spell.valid(reclaimed)); assert.deepEqual(reclaimed.spellImitation, learned);
});
