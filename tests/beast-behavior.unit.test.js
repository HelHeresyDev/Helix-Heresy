const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../wilderness-beasts'), B = require('../beast-bodies'), H = require('../beast-habitat');
const C = require('../beast-behavior'), L = require('../creature-life'), D = require('../creature-biology');
const authored = require('../scripts/creature-lifecycle-data'), ecology = require('../scripts/creature-ecology-design');
const E = require('../strategic-beast-ecology');
const cell = (x = 0, y = 0) => ({ x, y, z: 6 });
const actor = (id, name = id, at = 0, source = {}) => W.actor(`beast:${id}`, name, cell(), `original:${id}`, at, source);
const clone = x => JSON.parse(JSON.stringify(x));
function context(actors = [], changes = {}) {
  const patches = new Map(), hits = [], waste = [];
  const patch = c => {
    const k = H.key(c);
    if (!patches.has(k)) patches.set(k, { floor: true, waterDepthM: 0, soilDepthM: 50, hardness: 1, densityKgM3: 1500,
      materialKg: 100000, supportKg: 1e9, ceilingM: 100, oxygen: true, temperatureC: 20,
      resources: {}, transfers: {}, areaHa: 1, condition: Object.fromEntries(D.ledgers.map(([id]) => [id, 40])) });
    return H.patch(patches.get(k), c);
  };
  return { alive: true, local: true, tileSizeM: 1, actors, patches, patch, terrain: patch, hits, waste,
    blocked: () => false, effectLine: () => true, signal: () => true, lightAt: () => 100, destinationSeen: () => true,
    damage(a, amount) { a.health = Math.max(0, a.health - amount); if (!a.health) a.status = 'dead'; },
    strike(a, target, effect) { hits.push({ id: a.id, target: target.id, ...effect }); target.health -= effect.damage; if (target.health <= 0) target.status = 'dead'; return { ok: true, hit: true }; },
    waste(a, kind, kg) { waste.push({ id: a.id, kind, kg }); },
    vulnerable: () => true, resistance: () => 0, sunlightFluxMJ: .001, cloudCover: 0, focusAngle: 1, noise: 0,
    habitatSuitable: true, seasonSuitable: true, mateReachable: () => true, recruit: () => true, ...changes };
}
function water(c, a, depth = 60) {
  const p = c.patch(a.mapCell); p.waterDepthM = depth; p.waterAccounted = false; H.patch(p, a.mapCell);
  a.bodyPhysics.mode = 'swimming'; a.bodyPhysics.altitudeM = -a.bodyPhysics.dimensions.heightM;
  return p;
}
function run(a, id, target, c, at = 0) {
  const result = C.begin(a, id, target, at, c); assert.equal(result.ok, true, `${id}: ${result.reason}`);
  return C.advanceAction(a, at + C.definitions[id].seconds, C.definitions[id].seconds, c);
}
test('runtime snapshots exactly retain all 36 authored life histories, rates, roles and finite 24 capabilities', () => {
  assert.equal(Object.keys(D.lifecycle).length, 36);
  for (const p of authored.profiles) assert.deepEqual(D.lifecycle[p.id], p);
  for (const p of ecology.rateProfiles) assert.deepEqual(D.rates[p.id], p);
  assert.deepEqual(D.antagonisms, ecology.antagonisms);
  assert.deepEqual(new Set(Object.keys(C.capabilities)), new Set(E.BEAST_SPECIES.map(p => p.id)));
  for (const s of E.BEAST_SPECIES) {
    const a = actor(s.id.slice(6)); assert.ok(L.valid(a)); assert.ok(C.capabilities[s.id].length);
    for (const id of C.capabilities[s.id]) assert.ok(C.definitions[id], `${s.id}:${id}`);
  }
  assert.equal(Object.keys(L.existingOwners).length, 12, 'existing laboratory/human care is not charged twice');
});
test('unattended heat and remains do not accumulate a deferred local work bill', () => {
  const a = actor('burrowing-furnace'), c = context([a]);
  a.status = 'dead'; a.life.remains = { edibleKg: 100, lastAt: 0 };
  const heat = a.life.energy.heatMJ;
  C.advanceVitals(a, 1000, 1000, { alive: true, local: false });
  C.advanceVitals(a, 2000, 1000, c);
  assert.equal(a.life.remains.edibleKg, 100); assert.equal(a.life.energy.heatMJ, heat);
  C.advanceVitals(a, 2001, 1, c);
  assert.ok(a.life.remains.edibleKg < 100 && a.life.remains.edibleKg > 99.99);
  assert.ok(a.life.energy.heatMJ < heat);
});
test('actual food and water leave finite source stocks, enter body mass and later become retained metabolism outputs', () => {
  const a = actor('gravebloom-elk'), c = context([a]), p = c.patch(a.mapCell);
  p.resources.forageKg = 1; p.resources.waterL = 2;
  a.life.stores.waterL = 0; const mass = a.bodyPhysics.massKg;
  assert.equal(C.feed(a, 60, 0, c), true);
  const taken = 1 - p.resources.forageKg + 2 - p.resources.waterL;
  assert.ok(taken > 0); assert.ok(Math.abs(a.bodyPhysics.massKg - mass - taken) < 1e-8);
  C.advanceVitals(a, 60, 60, c);
  assert.ok(a.life.consumed.foodKg > 0 && a.life.consumed.waterL > 0);
  const saved = clone(a); C.attach(saved, 10000); assert.deepEqual(saved, a);
  C.advanceVitals(a, 60, 0, c); assert.deepEqual(a, saved);
});
test('starvation, dehydration, real rest and nonattendance/death have separate persistent clocks', () => {
  const a = actor('rimefang-pack'), c = context([a]);
  B.request(a, 'walking', cell(30), c); B.advance(a, 100, c); a.bodyPhysics.motion = null;
  const spent = a.bodyPhysics.stamina;
  a.life.activity = 'rest'; C.advanceVitals(a, 110, 10, c); assert.ok(a.bodyPhysics.stamina > spent);
  C.advanceVitals(a, 1e6, 1e6 - 110, { ...c, local: false });
  const saved = clone(a); C.advanceVitals(a, 1e6 + 1, 1, c); assert.equal(a.life.consumed.foodKg, saved.life.consumed.foodKg);
  C.advanceVitals(a, 1e6 + 2, 1, { ...c, alive: false }); assert.equal(a.bodyPhysics.massKg, saved.bodyPhysics.massKg);
  const starving = actor('sunspine-basilisk'); C.advanceVitals(starving, 100 * L.DAY, 100 * L.DAY, c);
  assert.ok(starving.health < starving.maxHealth); assert.ok(starving.life.shortages.foodKg > 0);
});
test('a tired walker finishes only its committed turn or stride before recovering', () => {
  const a = actor('nullmaw-stalker'), c = context([a]), b = a.bodyPhysics;
  const goal = { behavior: 'investigate', goal: cell(0, 8) };
  b.stamina = 100;
  assert.ok(B.turn(a, 1, c).ok);
  B.advance(a, .25, c);
  assert.ok(b.turn && b.stamina < 100);
  const spent = b.spentStamina;
  C.step(a, goal, null, 2, 1.75, c);
  assert.equal(b.turn, null); assert.equal(b.heading, 1);
  assert.deepEqual(a.mapCell, cell()); assert.ok(b.spentStamina > spent);
  const tired = b.stamina;
  C.advanceVitals(a, 3, 1, c);
  assert.ok(b.stamina > tired);
  assert.ok(B.request(a, 'walking', goal.goal, c).ok);
  B.advance(a, 2.1, c);
  assert.ok(b.motion?.progressM > 0);
  const nextCell = clone(b.motion.to);
  C.step(a, goal, null, 10, 7, c);
  assert.deepEqual(a.mapCell, nextCell); assert.equal(b.motion, null);
  assert.equal(b.goal, null); assert.equal(b.lastAt, 10);
});
test('radiant fan preparation pays once, can be interrupted, damages and temporarily paralyses through real line of effect', () => {
  const a = actor('sunspine-basilisk'), target = actor('rimefang-pack'), c = context([a, target]); target.mapCell = cell(3);
  const old = a.bodyPhysics.mana;
  assert.equal(C.begin(a, 'radiantFan', target, 0, c).ok, true); assert.equal(a.bodyPhysics.mana, old - 12);
  const saved = clone(a); C.advanceAction(saved, 1, 1, c); assert.ok(saved.life.pending); assert.equal(saved.bodyPhysics.mana, old - 12);
  C.interrupt(saved, 1, 'Actual wound'); assert.equal(saved.life.pending, null); assert.equal(saved.bodyPhysics.mana, old - 12);
  C.advanceAction(a, 2, 1, c); assert.equal(c.hits.length, 1); assert.equal(C.modifiers(target, 3).incapacitated, true);
  assert.equal(C.modifiers(target, 6).incapacitated, false);
  const blocked = actor('sunspine-basilisk'); assert.equal(C.begin(blocked, 'radiantFan', target, 0, { ...c, effectLine: () => false }).ok, false);
  B.damagePart(blocked, 'radiant fan', 80, 0); assert.equal(C.begin(blocked, 'radiantFan', target, 0, c).ok, false);
});
test('short blink requires personal destination knowledge and cannot bypass walls or a later occupied volume', () => {
  const a = actor('gloam-prowler'), c = context([a]), dest = { mapCell: cell(3) };
  assert.equal(C.begin(a, 'blink', dest, 0, { ...c, destinationSeen: () => false }).ok, false);
  c.patch(cell(1)).obstacleHeightM = 5; assert.equal(C.begin(a, 'blink', dest, 0, c).ok, false);
  c.patch(cell(1)).obstacleHeightM = 0;
  assert.equal(C.begin(a, 'blink', dest, 0, c).ok, true); const saved = clone(a);
  C.advanceAction(a, 1, 1, c); C.advanceAction(saved, 1, 1, c); assert.deepEqual(saved, a); assert.deepEqual(a.mapCell, cell(3));
  assert.equal(a.bodyPhysics.mana, 40);
});
test('choruses need separate alive wet audible members and cannot double-book their exertion', () => {
  const members = ['one', 'two', 'three'].map(id => actor('mire-choir', id)), target = actor('rimefang-pack'), c = context([...members, target]);
  members.forEach((a, i) => { a.mapCell = cell(i); c.patch(a.mapCell).wetness = .8; }); target.mapCell = cell(3);
  assert.equal(C.begin(members[0], 'chorus', target, 0, { ...c, noise: 1 }).ok, false);
  assert.equal(C.begin(members[0], 'chorus', target, 0, c).ok, true);
  assert.equal(members[1].bodyPhysics.stamina, 292);
  assert.equal(C.begin(members[1], 'chorus', target, 0, c).ok, false);
  C.advanceAction(members[0], 3, 3, c); assert.ok(C.activeConditions(target, 4).some(e => e.kind === 'hypnotic'));
});
test('stored electrical energy is split across real conductive targets and grounding consumes rather than replenishes it', () => {
  for (const species of ['thunderback-grazer', 'storm-kite']) {
    const a = actor(species), t = actor('rimefang-pack'), c = context([a, t]); t.mapCell = cell(1);
    const energy = a.life.energy.chargeMJ; run(a, 'discharge', t, c);
    assert.ok(a.life.energy.chargeMJ < energy); assert.ok(c.hits.length); assert.ok(c.hits.reduce((n, h) => n + h.energyMJ, 0) <= .1);
    const grounded = actor(species); c.patch(grounded.mapCell).grounded = true; c.hits.length = 0;
    run(grounded, 'discharge', t, c); assert.equal(c.hits.length, 0); assert.ok(c.patch(grounded.mapCell).heatMJ > 0);
  }
});
test('crown combustion, heated horns and hot tunnels transfer actual tissue, soil, heat and original gas', () => {
  const candle = actor('candlecap-myriapod'), c = context([candle]); const mass = candle.bodyPhysics.massKg;
  run(candle, 'crownIgnite', null, c); const p = c.patch(candle.mapCell);
  assert.equal(candle.bodyPhysics.massKg, mass - .002); assert.ok(p.resources.ashKg > 0 && p.resources.airborneCarbonKg > 0);
  const ash = actor('ashhorn-behemoth'); run(ash, 'hornVitrify', null, c); assert.ok(p.vitrifiedKg > 0); assert.ok(p.materialKg < 100000);
  const furnace = actor('burrowing-furnace'); p.resources.geologicalGasKg = .1; p.supportKg = 10;
  run(furnace, 'hotTunnel', null, c); assert.equal(p.resources.geologicalGasKg, 0); assert.equal(p.resources.airborneGasKg, .1); assert.equal(p.floor, false);
});
test('wing pinions use existing sunlight or a once-only paid radiant emission, not universal spell reflection', () => {
  const roc = actor('glasswing-roc'), t = actor('rimefang-pack'), c = context([roc, t]); t.mapCell = cell(5);
  run(roc, 'focusPinions', t, c); assert.ok(c.hits[0].damage > 0);
  const emission = { id: 'actual-radiant-release', kind: 'radiant', energyMJ: 2 };
  assert.equal(C.receiveRadiance(roc, emission, 20, { incomingLine: true, focusAngle: 1 }), 1);
  assert.equal(emission.energyMJ, 1); assert.equal(C.receiveRadiance(roc, emission, 20, { incomingLine: true, focusAngle: 1 }), 0);
  assert.equal(C.receiveRadiance(roc, { id: 'soul-lash', kind: 'soul', energyMJ: 2 }, 20, { incomingLine: true, focusAngle: 1 }), 0);
});
test('pressure pulses and ether lures require connected actual deep water and remain resistible cues', () => {
  const bell = actor('abyssal-bell'), t = actor('reef-wyrm'), c = context([bell, t]); t.mapCell = cell(3);
  assert.equal(C.begin(bell, 'pressurePulse', t, 0, c).ok, false);
  water(c, bell); water(c, t); run(bell, 'pressurePulse', t, c); assert.ok(c.hits[0].damage > 0);
  run(bell, 'etherLure', t, c, 20); assert.ok(C.activeConditions(t, 23).some(e => e.kind === 'etherLure'));
  assert.deepEqual(t.mapCell, cell(3), 'a lure does not forcibly move its observer');
});
test('temporary tracks, cached kills and ice wakes conserve source water and thaw with finite heat', () => {
  const a = actor('rimefang-pack'), corpse = actor('rimefang-pack', 'real-remains'), c = context([a, corpse]);
  corpse.status = 'dead'; corpse.health = 0; c.patch(a.mapCell).resources.waterL = 100;
  run(a, 'frostTrail', null, c); assert.equal(c.patch(a.mapCell).resources.waterL, 99.99);
  run(a, 'iceCache', corpse, c, 20); assert.ok(corpse.life.remains.frozenUntil > 20);
  const whale = actor('frostwake-leviathan'); const p = water(c, whale); run(whale, 'iceWake', null, c, 40);
  assert.ok(p.iceKg > 0); const total = p.resources.waterL + p.iceKg; p.temperatureC = 20;
  H.thaw(p, 100, null); assert.ok(Math.abs(p.resources.waterL + p.iceKg - total) < 1e-8);
});
test('carrion light is funded by one actual corpse, affects only vulnerable visible observers and never moves them', () => {
  const a = actor('carrion-lantern'), corpse = actor('rimefang-pack', 'dead'), observer = actor('rimefang-pack', 'observer'), c = context([a, corpse, observer]);
  corpse.status = 'dead'; corpse.health = 0; observer.mapCell = cell(2);
  const old = corpse.bodyPhysics.massKg, before = a.bodyPhysics.massKg;
  assert.equal(C.consumeRemains(a, corpse, 600, 0, c), true);
  const wet = old - corpse.bodyPhysics.massKg;
  assert.ok(Math.abs(a.life.stores.foodKg - wet * .45) < 1e-10);
  assert.ok(Math.abs(wet - (a.bodyPhysics.massKg - before) - a.life.emitted.carrionWaterWasteL
    - a.life.emitted.carrionMineralsKg - a.life.emitted.carrionSolidsKg) < 1e-10);
  assert.ok(corpse.bodyPhysics.massKg < old && a.life.energy.lightKg > 0);
  run(a, 'corpseLight', null, c); C.advanceVitals(a, 2, 2, { ...c, lightAt: () => 5 });
  assert.ok(C.activeConditions(observer, 3).some(e => e.kind === 'misled')); assert.deepEqual(observer.mapCell, cell(2));
  assert.equal(C.publicEvent(a).action, 'Corpse-light display');
});
test('all seven habitat engineers consume finite compatible sources and produce only performed local effects', () => {
  for (const [species, work] of [['ironroot-colossus', 'rootStabilize'], ['mire-choir', 'tendWetland'], ['reef-wyrm', 'cultivateReef'],
    ['rivercoil', 'buildDam'], ['gravebloom-elk', 'growBlooms'], ['ember-ant', 'buildFurnace'], ['dreaming-tortoise', 'dreamWeather']]) {
    const a = actor(species, species, 0, { colonyId: species === 'ember-ant' ? 'actual-colony' : null }), c = context([a]), p = c.patch(a.mapCell);
    if (work === 'rootStabilize') a.bodyPhysics.mode = 'rooting';
    if (['tendWetland', 'cultivateReef'].includes(work)) water(c, a);
    Object.assign(p.resources, { waterL: 10000, organicKg: 1000, mineralsKg: 1000, wetlandBedKg: 1, detritusKg: 1000,
      livingReefKg: 1, calciumKg: 1000, constructionKg: 1000, flowWaterL: 1000, bloomKg: 1, carrionKg: 1000, metalKg: 1000, fuelKg: 1000, atmosphericWaterL: 10000 });
    p.downstream = cell(1); const before = clone(p.resources);
    const result = H.work(a, work, 60, 60, { ...c, dreamParticipants: [{ sleeping: true, consent: true }] });
    assert.ok(result, `${species}:${work}`); assert.ok(Object.keys(result.costs).some(k => p.resources[k] < before[k]));
    assert.equal(H.work(a, work, 60, 60, { ...c, patch: () => null }), null);
    assert.ok(Object.values(result.points).every(Number.isFinite));
  }
});
test('feeding towers scale once with living modules; mana filtration consumes real excess and does not mint mana at full capacity', () => {
  const brine = actor('brine-cathedral'), c = context([brine]), p = water(c, brine); p.resources.planktonKg = 100000;
  C.feed(brine, 1, 0, c); const amount = 100000 - p.resources.planktonKg;
  const hurt = actor('brine-cathedral', 'damaged'); ['feeding tower 1', 'feeding tower 2'].forEach(k => B.damagePart(hurt, k, 100, 0));
  C.feed(hurt, 1, 1, c); assert.ok(Math.abs(100000 - amount - p.resources.planktonKg - amount * .5) < 1e-6);
  const manta = actor('ley-manta'); B.request(manta, 'levitation', cell(2), c); B.advance(manta, 2, c);
  const reserve = manta.bodyPhysics.mana, local = c.patch(manta.mapCell); local.resources.excessMana = .1; C.feed(manta, 1, 3, c);
  assert.equal(local.resources.excessMana, 0); assert.ok(manta.bodyPhysics.mana <= reserve + .10000001);
});
test('hydra head regrowth spends biomass and mana over time and does not copy destroyed head memories', () => {
  const a = actor('marsh-hydra'), c = context([a]);
  L.remember(a, { id: 'only-left-head-knew', at: 0, cell: cell(2) }, 'head 1');
  B.damagePart(a, 'head 1', 100, 0); C.interrupt(a, 0, 'actual head injury');
  assert.deepEqual(a.life.heads['head 1'].memory, []);
  L.feed(a, 'foodKg', 40); const food = a.life.stores.foodKg, mana = a.bodyPhysics.mana;
  C.regenerate(a, 60, 60, c); assert.ok(a.life.heads['head 1'].lost); assert.ok(a.life.stores.foodKg < food && a.bodyPhysics.mana < mana);
  const saved = clone(a); C.regenerate(a, L.DAY, L.DAY, c); C.regenerate(saved, L.DAY, L.DAY, c); assert.deepEqual(saved, a);
  assert.equal(a.life.heads['head 1'].lost, false); assert.deepEqual(a.life.heads['head 1'].memory, []);
});
test('null-terrain hunting, pack reports and ecological defense use actual sensed local evidence, not role labels', () => {
  const hunter = actor('nullmaw-stalker'), prey = actor('rimefang-pack'), c = context([hunter, prey]); prey.mapCell = cell(2);
  C.advanceVitals(hunter, L.DAY * 3, L.DAY * 3, c);
  const decision = { behavior: 'roam', goal: cell() };
  C.step(hunter, decision, null, L.DAY * 3 + 1, 1, c); assert.equal(decision.preyId, prey.id);
  const root = actor('ironroot-colossus'), ant = actor('ember-ant'), env = context([root, ant]); ant.mapCell = cell(2);
  assert.deepEqual(C.biologicalOpponents(root, 10, env), []);
  H.receipt(env.patch(root.mapCell), ant, 'combustion', 10, {});
  assert.deepEqual(C.biologicalOpponents(root, 11, env).map(a => a.id), [ant.id]);
  assert.deepEqual(C.biologicalOpponents(root, 11, { ...env, signal: () => false }), []);
});
test('recruitment requires actual eligible mates, paid material, elapsed incubation and distinct persisted child identities', () => {
  const parent = actor('storm-kite', 'mother-0'), mate = actor('storm-kite', 'father');
  parent.life.bornAt = -100 * L.DAY; parent.life.ageDays = 100; mate.life.bornAt = -100 * L.DAY; mate.life.ageDays = 100;
  parent.life.opportunities = 1; const births = [], c = context([parent, mate], { recruit(child) { births.push(child); return true; } });
  assert.equal(L.beginReproduction(parent, null, 0, c), false);
  assert.equal(L.beginReproduction(parent, mate, 0, c), true);
  const r = parent.life.reproduction; assert.equal(r.success, true, 'the fixed original source seed succeeds without a success flag');
  const at = D.lifecycle[parent.speciesId].incubationDays * L.DAY;
  for (let i = 1; i <= 10; i++) { L.feed(parent, 'foodKg', r.requiredKg / 20); L.advanceReproduction(parent, at * i / 20, at / 20, c); }
  assert.equal(births.length, 0);
  const saved = clone(parent);
  for (let i = 11; i <= 20; i++) { L.feed(parent, 'foodKg', r.requiredKg / 20); L.advanceReproduction(parent, at * i / 20, at / 20, c); }
  assert.equal(births.length, D.lifecycle[parent.speciesId].offspring);
  assert.equal(new Set(births.map(b => b.id)).size, births.length); assert.ok(births.every(b => b.parentIds.includes(parent.id) && b.massKg > 0));
  const again = [];
  for (let i = 11; i <= 20; i++) { L.feed(saved, 'foodKg', r.requiredKg / 20); L.advanceReproduction(saved, at * i / 20, at / 20,
    { ...c, recruit(child) { again.push(child); return true; } }); }
  assert.deepEqual(again, births);
  L.advanceReproduction(parent, at + 1, 1, c); assert.equal(births.length, D.lifecycle[parent.speciesId].offspring);
});
test('paid queen brood keeps original colony/worker identity and large breeders retain mass-scaled needs', () => {
  const p = D.lifecycle['beast:ember-ant'];
  const queen = actor('ember-ant', 'queen', 0, { role: 'queen', colonyId: 'one-hive', massKg: p.breederKg, ageDays: p.fertileDays });
  const male = actor('ember-ant', 'male', 0, { role: 'male', colonyId: 'one-hive', ageDays: p.fertileDays });
  const births = [], c = context([queen, male], { recruit(child) { births.push(child); return true; } });
  assert.ok(L.demand(queen, L.DAY).foodKg > p.foodKgDay * 10);
  queen.life.opportunities = 1;
  assert.equal(L.beginReproduction(queen, male, 0, c), false, 'no viable furnace hive');
  c.patch(queen.mapCell).resources.furnaceKg = 1;
  // Choose an original identity with a successful deterministic outcome; the
  // runtime still generates and saves the outcome, rather than a test flag.
  let serial = 0;
  while (L.random(`${queen.life.seed}:1`) >= p.success) queen.life.seed = `original-queen-${++serial}`;
  assert.equal(L.beginReproduction(queen, male, 0, c), true);
  const required = queen.life.reproduction.requiredKg, at = p.incubationDays * L.DAY;
  for (let i = 1; i <= 100; i++) {
    L.feed(queen, 'foodKg', required / 100);
    L.advanceReproduction(queen, at * i / 100, at / 100, c);
  }
  assert.equal(births.length, p.offspring);
  assert.ok(births.every(child => child.role === 'worker' && child.colonyId === 'one-hive'));
  const child = W.actor(births[0].speciesId, births[0].id, cell(), queen.populationId, at, births[0]);
  assert.equal(child.life.colonyId, 'one-hive'); assert.equal(L.eligible(child), false);
});
test('worker ants cannot become queens by ageing; unassisted initiative and migration never gain hidden destination knowledge', () => {
  const worker = actor('ember-ant', 'worker', 0, { ageDays: 1000 }); assert.equal(L.eligible(worker), false);
  const soulless = actor('gloam-prowler', 'unassisted', 0, { will: false }), c = context([soulless]);
  assert.equal(C.step(soulless, { behavior: 'roam' }, null, 1, 1, c), true);
  assert.equal(soulless.life.activity, 'awaitingReceivedOrder');
  const a = actor('rimefang-pack'); a.life.migration = { mode: 'instinctive', traditionalDestination: 'starving-basin' };
  assert.equal(L.migrationChoice(a, [{ id: 'plentiful-unknown-place' }]), 'starving-basin');
  a.life.migration = { mode: 'forcedDispersal' }; const saved = clone(a), choices = [{ id: 'a' }, { id: 'b' }];
  assert.equal(L.migrationChoice(a, choices), L.migrationChoice(saved, choices.map(c => ({ ...c, hiddenFood: 999999 }))));
});

test('charge damage requires earned shared-body movement and cannot pass an actual obstacle', () => {
  for (const blocked of [false, true]) {
    const a = actor('thunderback-grazer'), t = actor('rimefang-pack'), c = context([a, t]); t.mapCell = cell(10);
    if (blocked) for (let y = 0; y < 3; y++) c.patch(cell(5, y)).obstacleHeightM = 4;
    c.chargeStep = (a, target, at) => {
      if (!a.bodyPhysics.motion) B.request(a, 'walking', cell(9), c);
      B.advance(a, at, { ...c, speedMultiplier: 2 });
    };
    run(a, 'charge', t, c);
    assert.equal(c.hits.length > 0, !blocked);
    assert.ok(a.bodyPhysics.stamina < 300, 'failed charge preparation is not refunded');
    if (blocked) assert.equal(a.bodyPhysics.distanceM, 0);
    else assert.ok(a.bodyPhysics.distanceM >= 2);
  }
});
test('a lost hydra head cannot see, but the surviving heads retain independent fresh observations', () => {
  const a = actor('marsh-hydra'), t = actor('rimefang-pack'), c = context([a, t]); t.mapCell = cell(3);
  B.damagePart(a, 'head 1', 100, 0); C.interrupt(a, 0, 'Head lost');
  assert.equal(C.canSense(a, t, 'sight', c), true);
  C.observe(a, 1, { ...c, signal: (from, to, channel, head) => head !== 'head 1' });
  assert.deepEqual(a.life.heads['head 1'].memory, []);
  assert.equal(a.life.heads['head 2'].memory[0].id, t.id);
});
test('an ether cue can guide a willing swimmer gradually, and felt pressure triggers local escape without an oracle', () => {
  const bell = actor('abyssal-bell'), prey = actor('reef-wyrm'), c = context([bell, prey]);
  const originalPatch = c.patch;
  c.patch = c.terrain = position => { const p = originalPatch(position); p.waterDepthM = 1000; p.waterAccounted = true; p.resources.waterL = 1e6; return p; };
  bell.bodyPhysics.mode = prey.bodyPhysics.mode = 'swimming';
  bell.bodyPhysics.altitudeM = -205; prey.bodyPhysics.altitudeM = -190;
  prey.mapCell = cell(-4); prey.bodyPhysics.heading = 1;
  C.condition(prey, 'etherLure', bell.id, 0, 100);
  // Actual pressure/hearing must localize the source; a hidden target grants nothing.
  const decision = { behavior: 'roam', goal: cell() };
  C.step(prey, decision, null, 1, 1, { ...c, signal: () => false }); assert.equal(prey.bodyPhysics.motion, null);
  C.step(prey, decision, null, 2, 1, c);
  assert.equal(prey.bodyPhysics.motion?.transition?.dive, true); assert.ok(prey.bodyPhysics.altitudeM > -205);
  let reachedAt = 0;
  for (let at = 3; at < 25; at++) {
    C.advanceVitals(prey, at, 1, c);
    if (prey.life.pressureDangerAt) { reachedAt = at; break; }
    B.advance(prey, at, c);
  }
  assert.ok(reachedAt > 0); assert.ok(prey.health < prey.maxHealth);
  const depth = prey.bodyPhysics.altitudeM;
  C.step(prey, decision, null, reachedAt + 1, 1, c);
  assert.equal(prey.life.activity, 'escapePressure'); assert.ok(prey.bodyPhysics.altitudeM > depth);
});
test('calm causes actual landing and distress, while real colony trails decay and cannot transmit global commands', () => {
  const kite = actor('storm-kite'), c = context([kite]), p = c.patch(kite.mapCell);
  kite.bodyPhysics.mode = 'flight'; kite.bodyPhysics.altitudeM = 4; p.wind = { x: 0, y: 0 };
  C.advanceVitals(kite, 1, 1, c); assert.equal(kite.bodyPhysics.mode, 'landing'); assert.ok(kite.life.disturbedUntil > 1);
  const ant = actor('ember-ant', 'forager', 0, { colonyId: 'actual-hive' });
  ant.life.lastForageCell = cell(); ant.life.previousTrailCell = cell(); ant.mapCell = cell(1);
  C.advanceVitals(ant, 1, 1, c); const trail = c.patch(ant.mapCell).chemicalTrail;
  assert.equal(trail.colonyId, 'actual-hive'); assert.deepEqual(trail.nextCell, cell());
  c.patch(ant.mapCell).waterDepthM = .2; C.advanceVitals(ant, 2, 1, c); assert.equal(c.patch(ant.mapCell).chemicalTrail, null);
});
test('actual dream weather refuses absent/nonconsenting sleepers and transfers moisture instead of conjuring rain', () => {
  const a = actor('dreaming-tortoise'), c = context([a]), p = c.patch(a.mapCell); p.resources.atmosphericWaterL = 2;
  assert.equal(H.work(a, 'dreamWeather', 60, 60, c), null);
  assert.equal(H.work(a, 'dreamWeather', 60, 60, { ...c, dreamParticipants: [{ sleeping: true, consent: false }] }), null);
  const before = p.resources.atmosphericWaterL;
  assert.ok(H.work(a, 'dreamWeather', 60, 60, { ...c, dreamParticipants: [{ sleeping: true, consent: true }] }));
  assert.ok(Math.abs(p.resources.atmosphericWaterL + p.resources.waterL - before) < 1e-9);
});
test('newborn bodies receive paid mass, no copied memories and no free adult mana or electrical reservoir', () => {
  const a = actor('gloam-prowler', 'actual-child', 10, { origin: 'naturalBirth', ageDays: 0, massKg: 3 });
  assert.equal(a.bodyPhysics.massKg, 3); assert.equal(a.bodyPhysics.mana, 0); assert.deepEqual(a.life.memories, []);
  const ant = actor('storm-kite', 'new-chargeless-body', 10, { origin: 'naturalBirth', ageDays: 0, massKg: .002 });
  assert.equal(ant.life.energy.chargeMJ, 0);
});
