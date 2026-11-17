const test = require('node:test'), assert = require('node:assert/strict');
const F = require('../beast-predation'), C = require('../beast-behavior'), W = require('../wilderness-beasts');
const P = require('../beast-populations'), D = require('../creature-biology'), B = require('../beast-bodies');
const clone = x => JSON.parse(JSON.stringify(x)), cell = (x = 0, y = 0) => ({ x, y, z: 6 });
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function actor(species, id = species, x = 0, massKg) {
  const a = W.actor(`beast:${species}`, id, cell(x), `original:${species}`, 0, { massKg });
  a.life.stores.fatKg = 0; return a;
}
function context(actors = []) {
  const waste = [], terrain = () => ({ floor: true, waterDepthM: 0, ceilingM: 100, supportKg: 1e9, oxygen: true, wind: { x: 1, y: 0 } });
  return { alive: true, local: true, actors, terrain, tileSizeM: 1, foodKeys: C.foodKeys,
    originalReserves: () => ({ mana: 0, stamina: 250, energy: { heatMJ: 0, chargeMJ: 0, focus: 0, crownKg: 0, lightKg: 0 } }),
    canHunt: a => C.capabilities[a.speciesId]?.includes('hunt'),
    signal: () => true, lightAt: () => 100, effectLine: () => true, blocked: () => false,
    waste: (a, kind, kg) => waste.push({ actorId: a.id, kind, kg }), wasteRows: waste };
}
function source() {
  return { id: 'original-physical-accounts', calendar: { epochAt: 0, monthDays: [29, 31, 28, 32] },
    regions: [{ id: 'home', areaHa: 100, stocks: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 },
      capacity: { foodKg: 10000, waterL: 10000, mineralsKg: 10000 }, renewalPerDay: {}, edges: [] }],
    groups: ['beast:rimefang-pack', 'beast:gravebloom-elk'].map((speciesId, i) => ({ id: `group-${i}`, populationId: `population-${i}`, speciesId,
      regionId: 'home', cohorts: [{ id: `cohort-${i}`, speciesId, count: 2, ageDays: D.lifecycle[speciesId].adultDays,
        massKg: D.lifecycle[speciesId].adultKg }] })) };
}
test('local claims require established original positions and full-body habitat, not a shared regional range', () => {
  const s = P.create(source(), { worldId: 'world', runId: 'run' }), c = context();
  assert.equal(P.claimLocal(s, 'group-0', 'cohort-0', 0, 'wolf', 0, c), null);
  c.originalPosition = () => ({ regionId: 'other-region', cell: cell() });
  assert.equal(P.claimLocal(s, 'group-0', 'cohort-0', 0, 'wolf', 0, c), null);
  c.originalPosition = () => ({ regionId: 'home', cell: cell() });
  assert.equal(P.claimLocal(s, 'group-0', 'cohort-0', 0, 'wolf', 0, { ...c, originalReserves: undefined }), null);
  assert.equal(P.claimLocal(s, 'group-0', 'cohort-0', 0, 'wolf', 0, { ...c, terrain: () => ({ floor: true, supportKg: 1 }) }), null);
  assert.equal(P.count(s.groups[0].cohorts[0]), 2);
  s.groups[0].cohorts[0].health = .6;
  const a = P.claimLocal(s, 'group-0', 'cohort-0', 0, 'wolf', 0, c);
  assert.equal(a, s.details.wolf.actor); assert.equal(a.health / a.maxHealth, .6);
  assert.equal(a.life.originalMemberId, 'cohort-0:0'); assert.equal(P.count(s.groups[0].cohorts[0]), 1);
  assert.deepEqual(a.life.stores, s.details.wolf.stores);
  assert.equal(a.bodyPhysics.mana, 0); assert.equal(a.bodyPhysics.stamina, 250);
  assert.equal(P.claimLocal(s, 'group-0', 'cohort-0', 0, 'copy', 0, c), null);
  const tired = P.claimLocal(s, 'group-0', 'cohort-0', 1, 'exhausted-original', 0,
    { ...c, originalPosition: () => ({ regionId: 'home', cell: cell(5) }),
      originalReserves: () => ({ ...c.originalReserves(), stamina: 0 }) });
  assert.ok(tired); assert.equal(tired.bodyPhysics.stamina, 0); assert.equal(B.capable(tired, 'walking'), false);
  assert.ok(P.normalize(s));
});
test('actual original local deaths debit membership once and keep the only edible corpse with its actor', () => {
  const original = source(), s = P.create(original, { worldId: 'world', runId: 'run' }), c = context();
  c.originalPosition = () => ({ regionId: 'home', cell: cell() });
  const a = P.claimLocal(s, 'group-1', 'cohort-1', 1, 'original-elk', 0, c);
  a.health = 0; a.status = 'dead'; a.diedAt = 5;
  assert.equal(P.settleLocalLoss(s, a.id, 5, 'physical-predation'), true);
  assert.equal(P.settleLocalLoss(s, a.id, 5, 'duplicate-kill'), false);
  assert.deepEqual(P.audit(s)['population-1'], { background: 1, detailed: 0, dead: 1 });
  assert.equal(s.regions[0].remains, undefined); assert.equal(s.regions[0].stocks.meatKg, undefined);
  assert.equal(s.losses[0].detailOwner, a.id); assert.ok(a.life.remains.edibleKg > 0);
  const saved = P.normalize(clone(s)); assert.ok(saved);
  saved.details[a.id].actor.life.remains.edibleKg++;
  assert.equal(P.normalize(saved), null);
  assert.deepEqual(original, source());
});
test('hunts need sensed, reachable-scale live prey; carcasses, wood bodies and huge adults are not prey', () => {
  const hunter = actor('glasswing-roc'), calf = actor('ashhorn-behemoth', 'calf', 5, 1000), adult = actor('ashhorn-behemoth', 'adult', 5);
  const wood = actor('ironroot-colossus', 'small-wood', 5, 10), c = context([hunter, calf, adult, wood]);
  assert.equal(F.eligible(hunter, calf, c), true); assert.equal(F.eligible(hunter, adult, c), false);
  assert.equal(F.eligible(hunter, wood, c), false);
  assert.equal(F.eligible(hunter, calf, { ...c, signal: () => false }), false);
  assert.equal(F.eligible(hunter, calf, { ...c, protectedTarget: () => true }), false);
  calf.status = 'dead'; assert.equal(F.eligible(hunter, calf, c), false);
});
test('pack support requires actual heard capable members perceiving the same prey, not a population count', () => {
  const a = actor('rimefang-pack', 'a'), b = actor('rimefang-pack', 'b', 1), prey = actor('gravebloom-elk', 'prey', 3, 100);
  const c = context([a, b, prey]);
  assert.equal(F.eligible(a, prey, c), true);
  b.mapCell = cell(1000); assert.equal(F.eligible(a, prey, c), false);
  b.mapCell = cell(1); b.life.will = false; assert.equal(F.eligible(a, prey, c), false);
  b.life.will = true; b.life.willing = false; assert.equal(F.eligible(a, prey, c), false);
  b.life.willing = true; b.life.originalGroupId = 'a-different-original-pack'; assert.equal(F.eligible(a, prey, c), false);
  delete b.life.originalGroupId; b.bodyPhysics.parts.head = 0; assert.equal(F.eligible(a, prey, c), false);
});
test('finite hunts retain last personally seen coordinates and fail after contact loss or expended time', () => {
  const a = actor('nullmaw-stalker'), prey = actor('rimefang-pack', 'prey', 2), c = context([a, prey]);
  assert.equal(C.huntingTarget(a, 0, c), prey);
  const choice = clone(a.life.hunt); prey.mapCell = cell(1000);
  assert.equal(C.huntingTarget(a, 5, c), null); assert.deepEqual(a.life.hunt.lastCell, choice.lastCell);
  assert.equal(C.huntingTarget(a, 13, c), null); assert.equal(a.life.hunt.outcome, 'lostContact');
  prey.mapCell = cell(2); assert.equal(C.huntingTarget(a, 14, c), null);
  assert.equal(C.huntingTarget(a, 314, c), prey);
  assert.equal(C.huntingTarget(a, 614, c), null); assert.equal(a.life.hunt.outcome, 'timeBudgetSpent');
  assert.equal(prey.status, 'alive');
});
test('injury, depleted effort, paralysis and absent will interrupt hunts instead of awarding kills', () => {
  for (const change of [a => a.health = 1, a => a.bodyPhysics.stamina = 0, a => a.life.will = false,
    a => C.condition(a, 'paralysis', 'real-strike', 1, 30)]) {
    const a = actor('nullmaw-stalker'), prey = actor('rimefang-pack', 'prey', 2), c = context([a, prey]);
    C.huntingTarget(a, 0, c); change(a);
    assert.equal(C.huntingTarget(a, 2, c), null); assert.equal(a.life.hunt.outcome, 'unable');
    assert.equal(prey.health, prey.maxHealth);
  }
});
test('scavengers never select live prey, and locating carrion requires actual sensory contact', () => {
  const a = actor('carrion-lantern'), prey = actor('storm-kite', 'live-food', 2), c = context([a, prey]);
  assert.equal(C.huntingTarget(a, 0, c), null); assert.equal(F.carcass(a, 0, c), null);
  prey.status = 'dead'; prey.health = 0;
  assert.equal(F.carcass(a, 0, c), prey);
  assert.equal(F.carcass(a, 0, { ...c, signal: () => false }), null);
  assert.equal(C.consumeRemains(a, prey, 10, 10, { ...c, signal: () => false }), false);
  a.life.will = false; assert.equal(F.carcass(a, 0, c), null);
  assert.equal(C.consumeRemains(a, prey, 1, 1, c), false);
  assert.equal(C.consumeRemains(a, prey, 1, 1, { ...c, receivedOrder: { actorId: a.id, kind: 'feed' } }), true);
});
test('predators and scavengers spend one shared edible mass; repeated calls cannot repeat a feeding interval', () => {
  const a = actor('rimefang-pack', 'eater-a'), b = actor('carrion-lantern', 'eater-b'), corpse = actor('storm-kite', 'actual-kill');
  corpse.status = 'dead'; corpse.health = 0; corpse.diedAt = 0;
  const c = context([a, b, corpse]), r = F.remains(corpse, 0), original = r.edibleKg;
  assert.equal(C.consumeRemains(a, corpse, 1, 0, c), false, 'no food before the actual death');
  assert.equal(C.consumeRemains(a, corpse, 1, 1, c), true);
  const consumed = r.consumedKg; C.consumeRemains(a, corpse, 1, 1, c); assert.equal(r.consumedKg, consumed);
  C.consumeRemains(b, corpse, 600, 600, c);
  F.decay(corpse, 10000, c);
  approx(r.edibleKg + r.consumedKg + r.decomposedKg, original);
  assert.ok(r.consumedKg <= original); assert.ok(F.validRemains(corpse));
  assert.ok(corpse.bodyPhysics.massKg < .08);
});
test('a native predator finishing the flesh leaves a usable corpse for a Lantern, including hard remains', () => {
  const wolf = actor('rimefang-pack'), lantern = actor('carrion-lantern'), corpse = actor('storm-kite', 'real-corpse');
  corpse.status = 'dead'; corpse.health = 0; corpse.diedAt = 0;
  const ctx = context([wolf, lantern, corpse]), row = F.remains(corpse, 0);
  assert.equal(C.consumeRemains(wolf, corpse, 600, 600, ctx), true);
  approx(row.tissues.flesh.kg, 0); assert.ok(row.tissues.hard.kg > 0); assert.ok(row.tissues.liver.kg > 0);
  assert.equal(F.carcass(wolf, 600, ctx), null); assert.equal(F.carcass(lantern, 600, ctx), corpse);
  assert.equal(C.consumeRemains(lantern, corpse, 600, 1200, ctx), true);
  assert.ok(row.tissues.hard.consumedKg > 0); approx(row.edibleKg, 0);
  approx(row.massKg + row.consumedKg + row.decomposedKg, row.massKgAtDeath);
  assert.ok(lantern.life.emitted.carrionMineralsKg > 0); assert.ok(F.validRemains(corpse));
});
test('native scavenging cannot consume another owner\'s reserved organs or turn wood into carrion', () => {
  const lantern = actor('carrion-lantern'), corpse = actor('storm-kite', 'reserved-corpse'), wood = actor('ironroot-colossus');
  corpse.status = wood.status = 'dead'; corpse.health = wood.health = 0;
  const ctx = context([lantern, corpse, wood]), row = F.remains(corpse, 0);
  const claims = F.tissues.reserve(row, { carrionDiet: F.tissues.animalKeys }, 100);
  assert.ok(claims.length > 1); assert.equal(C.consumeRemains(lantern, corpse, 600, 600, ctx), false);
  assert.equal(C.consumeRemains(lantern, wood, 600, 1200, ctx), false); approx(row.consumedKg, 0);
});
test('one eater cannot claim the same elapsed feeding time from two different corpses', () => {
  const a = actor('carrion-lantern'), x = actor('rimefang-pack', 'x'), y = actor('rimefang-pack', 'y'), c = context([a, x, y]);
  for (const body of [x, y]) { body.status = 'dead'; body.health = 0; body.diedAt = 0; }
  assert.equal(C.consumeRemains(a, x, 1, 1, c), true);
  assert.equal(C.consumeRemains(a, y, 1, 1, c), false);
});
test('frozen carcasses decay only after their real thaw time; chunking and reload conserve the same tissue', () => {
  const a = actor('rimefang-pack'); a.status = 'dead'; a.health = 0;
  F.remains(a, 0).frozenUntil = 100;
  const b = clone(a), c = context(); F.decay(a, 200, c);
  for (let at = 10; at <= 200; at += 10) F.decay(b, at, c);
  approx(a.life.remains.edibleKg, b.life.remains.edibleKg);
  approx(a.life.remains.decomposedKg, b.life.remains.decomposedKg);
  assert.ok(F.validRemains(a)); const saved = clone(a); F.decay(a, 200, c); assert.deepEqual(a, saved);
});
test('a failed local meal does not supply ecological repair or avert real starvation', () => {
  const a = actor('carrion-lantern'), prey = actor('storm-kite', 'only-living-body'), c = context([a, prey]);
  c.patch = () => ({ oxygen: true, resources: {} }); c.damage = (t, damage) => { t.health = Math.max(0, t.health - damage); if (!t.health) t.status = 'dead'; };
  assert.equal(F.carcass(a, 0, c), null);
  C.advanceVitals(a, 30 * P.DAY, 30 * P.DAY, c);
  assert.ok(a.life.shortages.foodKg > 0); assert.equal(a.status, 'dead');
  assert.equal(prey.status, 'alive'); assert.equal(c.patch().condition, undefined);
});
test('continued imports retain local claimed bodies and partial hunts, while separate branches and final death stay independent', () => {
  const binding = { worldId: 'world', runId: 'run' }, original = source(), s = P.create(original, binding), c = context();
  c.originalPosition = (g, body, ordinal) => ({ regionId: 'home', cell: cell(ordinal * 2) });
  const a = P.claimLocal(s, 'group-0', 'cohort-0', 0, 'original-hunter', 0, c);
  a.life.stores.fatKg = 0;
  const prey = actor('storm-kite', 'original-observed-small-prey', 2); c.actors = [a, prey];
  C.huntingTarget(a, 10, c); P.advance(s, 10, true, true);
  const normalized = P.normalize(clone(s), binding); assert.ok(normalized);
  const imported = P.rebind(normalized, binding, { worldId: 'world', runId: 'continued-run' });
  assert.deepEqual(imported.details['original-hunter'].actor.life.hunt, a.life.hunt);
  imported.details['original-hunter'].actor.health--;
  assert.equal(a.health, a.maxHealth);
  const bad = clone(s); bad.details['original-hunter'].actor.life.hunt.deadlineAt = 0; assert.equal(P.normalize(bad), null);
  const before = clone(s); P.advance(s, 100, false, true); assert.deepEqual(s, before);
  assert.equal(P.audit(P.create(original, { ...binding, runId: 'fresh-run' }))['population-0'].background, 2);
});
test('an unseen prey death cannot end a hunt with clairvoyant knowledge, and final-death updates do nothing', () => {
  const a = actor('rimefang-pack'), prey = actor('storm-kite', 'prey', 2), c = context([a, prey]);
  C.huntingTarget(a, 0, c); prey.status = 'dead'; prey.health = 0;
  assert.equal(C.huntingTarget(a, 1, { ...c, signal: () => false }), null);
  assert.equal(a.life.hunt.endedAt, undefined);
  C.huntingTarget(a, 13, { ...c, signal: () => false }); assert.equal(a.life.hunt.outcome, 'lostContact');
  F.remains(prey, 0); const before = clone([a, prey]);
  C.huntingTarget(a, 100, { ...c, alive: false }); F.decay(prey, 100, { ...c, alive: false });
  assert.deepEqual([a, prey], before);
});
test('an airborne scavenger descends through the actual body movement before reaching a ground meal', () => {
  const a = actor('carrion-lantern'), corpse = actor('rimefang-pack', 'ground-corpse'), c = context([a, corpse]);
  corpse.status = 'dead'; corpse.health = 0; corpse.diedAt = 0;
  a.bodyPhysics.altitudeM = 6;
  c.patch = c.terrain;
  const decision = { behavior: 'roam', goal: cell(10) };
  assert.equal(C.step(a, decision, null, 1, 1, c), false);
  assert.equal(a.bodyPhysics.mode, 'landing'); assert.equal(a.bodyPhysics.altitudeM, 6);
  assert.equal(a.life.stores.foodKg, 0);
  assert.equal(B.advance(a, 10, c), true); assert.equal(a.bodyPhysics.altitudeM, 1);
  C.step(a, decision, null, 11, 1, c);
  assert.ok(a.life.stores.foodKg > 0); assert.equal(a.life.activity, 'feed');
});
