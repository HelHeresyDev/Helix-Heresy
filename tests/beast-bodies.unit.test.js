const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../beast-bodies');
const W = require('../wilderness-beasts');
const E = require('../strategic-beast-ecology');
const Lifecycle = require('../scripts/creature-lifecycle-data');
const cell = (x = 0, y = 0) => ({ x, y, z: 6 });
const body = (suffix, at = 0) => W.actor(`beast:${suffix}`, `original:${suffix}`, cell(), `original-population:${suffix}`, at);
const clone = x => JSON.parse(JSON.stringify(x));
test('regional passive air retains both wind components, finite speed and original buoyancy', () => {
  const a = body('carrion-lantern');
  assert.equal(B.flowVelocity(body('rimefang-pack'), { x: 2, y: 0 }), null);
  assert.equal(B.flowVelocity(a, null), null);
  assert.deepEqual(B.flowVelocity(a, { x: 0, y: 0 }), { x: 0, y: 0 });
  const wind = B.flowVelocity(a, { x: -5, y: 2 });
  assert.ok(Math.abs(Math.hypot(wind.x, wind.y) - .5) < 1e-12); assert.equal(wind.x / wind.y, -2.5);
  const gentle = B.flowVelocity(a, { x: .1, y: -.2 });
  assert.ok(Math.abs(gentle.x - .1) < 1e-12 && Math.abs(gentle.y + .2) < 1e-12);
  a.bodyPhysics.parts.bladder = 0;
  assert.deepEqual(B.flowVelocity(a, { x: -5, y: 2 }), { x: 0, y: 0 });
});
function context(overrides = {}) {
  const changes = new Map();
  const terrain = c => {
    if (Math.abs(c.x) > 250 || Math.abs(c.y) > 250) return null;
    if (!changes.has(B.key(c))) changes.set(B.key(c), { floor: true, waterDepthM: 50, soilDepthM: 40,
      hardness: 1, densityKgM3: 1500, materialKg: 60000, supportKg: 1e9, wind: { x: .3, y: 0 }, current: { x: .1, y: 0 }, oxygen: true });
    return changes.get(B.key(c));
  };
  return { alive: true, local: true, tileSizeM: 1, terrain, changes, blocked: () => false,
    excavate(a, c, volume) { const t = terrain(c), kg = Math.min(t.materialKg, volume * t.densityKgM3); t.materialKg -= kg; t.rubbleKg = (t.rubbleKg || 0) + kg; return kg; },
    damage(a, n) { a.health = Math.max(0, a.health - n); if (!a.health) a.status = 'dead'; }, ...overrides };
}
const land = () => context({ terrain: c => Math.abs(c.x) <= 250 && Math.abs(c.y) <= 250 ? { floor: true, waterDepthM: 0, ceilingM: 100, supportKg: 1e9, wind: { x: .3, y: 0 } } : null });
function soil() { const c = context(), original = c.terrain; c.terrain = p => { const t = original(p); if (t) t.waterDepthM = 0; return t; }; return c; }

test('all 24 canonical species have consumed bodies, dimensions, anatomy and correct organization', () => {
  assert.deepEqual(new Set(Object.keys(B.profiles)), new Set(E.BEAST_SPECIES.map(s => s.id)));
  for (const s of E.BEAST_SPECIES) {
    const a = body(s.id.slice(6)), p = B.profiles[s.id];
    assert.ok(B.valid(a), s.id);
    assert.deepEqual(p.modes, s.movementModes);
    assert.equal(p.organization, s.socialPattern);
    assert.ok(Object.keys(a.bodyPhysics.parts).length >= 3);
    assert.ok(a.bodyPhysics.massKg > 0);
    assert.equal(Lifecycle.byId.get(s.id).adultKg, p.massKg, 'published reference mass agrees with actual baseline body');
    assert.equal(a.populationId, `original-population:${s.id.slice(6)}`);
    assert.equal(W.PROFILES[s.id].name, s.name === 'Rimefang Pack' ? 'Rimefang' : s.name);
  }
  assert.equal(body('mirror-ape').bodyPhysics.massKg, 90, 'preserve existing actual climbing mass');
  assert.equal(W.PROFILES['beast:mirror-ape'].contactOnly, true);
});

test('actual body masks retain colossal scale, wing sweep, corpses and immutable original mass', () => {
  const a = body('ashhorn-behemoth'), roc = body('glasswing-roc');
  assert.ok(B.cells(a).length > 200);
  assert.ok(B.footprint(a).heightLayers > 1);
  assert.ok(B.footprint(roc, 1, 'flight').mask.length > B.footprint(roc, 1, 'walking').mask.length);
  const old = clone(a.bodyPhysics); a.status = 'dead'; B.attach(a, 1000);
  assert.deepEqual(a.bodyPhysics, old);
  assert.equal(B.cells(a).length, B.cells(body('ashhorn-behemoth')).length);
  const c = land(); assert.match(B.habitatReason(a, cell(), 'walking', 0, { ...c, terrain: p => p.x < 2 ? c.terrain(p) : null }), /terrain/);
});

test('catalog-wide movement families use their actual compatible medium, not one-tile ground shortcuts', () => {
  for (const s of E.BEAST_SPECIES) {
    const a = body(s.id.slice(6)), c = a.bodyPhysics.mode === 'burrowing' ? soil() : ['swimming', 'drifting'].includes(a.bodyPhysics.mode) ? context() : land();
    const result = B.request(a, a.bodyPhysics.mode, cell(8), c);
    assert.equal(result.ok, true, `${s.id}: ${result.reason}`);
    const before = clone(a.mapCell);
    assert.equal(B.advance(a, 0.5, c), true, s.id);
    assert.ok(a.bodyPhysics.distanceM > 0, s.id);
    assert.ok(B.valid(a), s.id);
    assert.ok(s.id === 'beast:carrion-lantern' || a.bodyPhysics.stamina < 300, s.id);
    assert.ok(a.bodyPhysics.motion || a.bodyPhysics.airOffset || !same(before, a.mapCell), s.id);
  }
  function same(a, b) { return B.key(a) === B.key(b); }
});

test('swept occupancy and partial movement survive saves without reserve refill or repeated work', () => {
  const a = body('gloam-prowler'), c = land();
  assert.equal(B.request(a, 'walking', cell(4), c).ok, true);
  B.advance(a, .5, c);
  assert.equal(a.mapCell.x, 0); assert.ok(a.bodyPhysics.motion.progressM > 0);
  assert.ok(B.occupied(a).length > B.cells(a).length);
  const saved = clone(a); B.attach(saved, 100000); assert.deepEqual(saved, a);
  B.advance(a, 2, c); B.advance(saved, 2, c); assert.deepEqual(saved, a);
  const before = clone(saved); assert.equal(B.advance(saved, 2, c), false); assert.deepEqual(saved, before);
});

test('every canonical non-spell physical mode has a consumed compatible-medium path', () => {
  const physicalModes = new Set(['walking', 'flight', 'levitation', 'swimming', 'drifting', 'burrowing', 'rooting']);
  for (const species of E.BEAST_SPECIES) for (const mode of species.movementModes.filter(m => physicalModes.has(m))) {
    const a = body(species.id.slice(6));
    // Original compatible starting medium, not earned movement or reserve flags.
    a.bodyPhysics.mode = mode;
    a.bodyPhysics.altitudeM = ['swimming', 'drifting'].includes(mode) ? -a.bodyPhysics.dimensions.heightM
      : mode === 'burrowing' ? -a.bodyPhysics.dimensions.heightM - .2 : 0;
    const c = mode === 'burrowing' ? soil() : ['swimming', 'drifting'].includes(mode) ? context() : land();
    assert.equal(B.request(a, mode, cell(8), c).ok, true, `${species.id}:${mode}`);
    assert.equal(B.advance(a, .5, c), mode !== 'rooting', `${species.id}:${mode}`);
    assert.ok(B.valid(a), `${species.id}:${mode}`);
  }
});

test('walls, roofs, wards, load capacity and other bodies obstruct the complete physical volume', () => {
  const a = body('gravebloom-elk');
  for (const [fields, expected] of [[{ obstacleHeightM: 4 }, /obstruction/], [{ ceilingM: 1 }, /overhead/], [{ protected: true }, /Protected/], [{ supportKg: 1 }, /load/]]) {
    assert.match(B.habitatReason(a, cell(), 'walking', 0, { ...land(), terrain: () => ({ floor: true, ...fields }) }), expected);
  }
  assert.match(B.habitatReason(a, cell(), 'walking', 0, { ...land(), blocked: () => true }), /Another body/);
});

test('elongated bodies turn with finite elapsed effort and reserve their entire swept rectangle', () => {
  const a = body('rivercoil'), c = context(); a.bodyPhysics.mode = 'swimming'; a.bodyPhysics.altitudeM = -3;
  const narrow = { ...c, terrain: p => p.y >= 4 ? null : c.terrain(p) };
  assert.equal(B.turn(a, 1, narrow).ok, false, 'a long body cannot pivot in a narrow channel');
  assert.equal(B.turn(a, 1, c).ok, true);
  assert.equal(B.footprint(a).mask.length, 14 * 14);
  B.advance(a, 1, c); assert.ok(a.bodyPhysics.turn.progress > 0); assert.ok(a.bodyPhysics.stamina < 300);
  const saved = clone(a); B.advance(a, 10, c); B.advance(saved, 10, c); assert.deepEqual(saved, a);
  assert.equal(a.bodyPhysics.heading, 1); assert.equal(B.footprint(a).height, 14); assert.equal(a.bodyPhysics.turn, null);
});

test('actual carried items consume load capacity and slow movement rather than being free mass', () => {
  const a = body('gloam-prowler'), unladen = clone(a), c = land();
  assert.match(B.habitatReason(a, a.mapCell, 'walking', 0, { ...c, cargoKg: () => 1000 }), /carried mass/);
  const loaded = { ...c, cargoKg: () => 50 };
  B.request(a, 'walking', cell(5), loaded); B.request(unladen, 'walking', cell(5), c);
  B.advance(a, .5, loaded); B.advance(unladen, .5, c);
  assert.ok(a.bodyPhysics.distanceM < unladen.bodyPhysics.distanceM);
});

test('flight cannot hover winged bodies, phase through ceilings, or ignore wing injury and gravity', () => {
  const a = body('glasswing-roc'), c = land();
  assert.equal(B.request(a, 'flight', null, c).ok, false);
  assert.equal(B.request(a, 'flight', cell(80), c).ok, true);
  B.advance(a, 2, c); assert.ok(a.bodyPhysics.altitudeM > 0);
  const altitude = a.bodyPhysics.altitudeM;
  B.damagePart(a, 'left wing', 70, 2);
  assert.equal(B.capable(a, 'flight'), false); assert.equal(a.bodyPhysics.mode, 'falling');
  B.advance(a, 4, c); assert.equal(a.bodyPhysics.altitudeM, 0); assert.ok(a.health < a.maxHealth);
  assert.equal(a.bodyPhysics.lastEvent.metres, altitude);
  const roof = body('glasswing-roc');
  assert.equal(B.request(roof, 'flight', cell(5), { ...c, terrain: () => ({ floor: true, ceilingM: 3 }) }).ok, false);
  const exhausted = body('storm-kite'); exhausted.bodyPhysics.mode = 'flight'; exhausted.bodyPhysics.altitudeM = 5;
  exhausted.bodyPhysics.stamina = 0; B.advance(exhausted, .5, c);
  assert.equal(exhausted.bodyPhysics.mode, 'falling'); assert.equal(exhausted.bodyPhysics.altitudeM, 3);
});

test('levitation and idle hovering pay original finite mana; suppression causes a saved fall', () => {
  const a = body('ley-manta'), c = land();
  assert.equal(B.request(a, 'levitation', cell(5), c).ok, true);
  B.advance(a, 2, c); assert.ok(a.bodyPhysics.spentMana > 0);
  a.bodyPhysics.goal = clone(a.mapCell); a.bodyPhysics.motion = null;
  const reserve = a.bodyPhysics.mana; B.advance(a, 4, c); assert.ok(a.bodyPhysics.mana < reserve);
  a.magicSuppressed = true; B.advance(a, 5, c); assert.equal(a.bodyPhysics.altitudeM, 0);
  assert.ok(a.bodyPhysics.lastEvent.kind === 'fall');
});

test('falls land on actual raised surfaces and dead spread wings do not disappear', () => {
  const a = body('glasswing-roc'), c = land(); B.request(a, 'flight', cell(40), c);
  a.bodyPhysics.altitudeM = 8; a.bodyPhysics.pendingFallM = 8; a.bodyPhysics.mode = 'falling'; a.status = 'dead';
  const before = B.cells(a).length, roof = { ...c, terrain: () => ({ floor: true, obstacleHeightM: 4, ceilingM: 100 }) };
  B.advance(a, 2, roof);
  assert.equal(a.bodyPhysics.altitudeM, 4); assert.equal(a.bodyPhysics.mode, 'grounded');
  assert.equal(a.bodyPhysics.lastEvent.metres, 4); assert.equal(B.cells(a).length, before);
});

test('aerostats and drifting superorganisms follow physical wind/current rather than their chosen goal', () => {
  for (const suffix of ['carrion-lantern', 'brine-cathedral']) {
    const a = body(suffix), c = context(); if (suffix === 'carrion-lantern') c.terrain(cell()).waterDepthM = 0;
    const mode = suffix === 'carrion-lantern' ? 'flight' : 'drifting';
    assert.equal(B.request(a, mode, cell(-20), c).ok, true);
    B.advance(a, 10, c); assert.ok(a.mapCell.x > 0, suffix);
  }
});

test('swimmers require real connected depth and amphibians cross shores gradually', () => {
  const fish = body('reef-wyrm');
  assert.equal(B.request(fish, 'swimming', cell(4), land()).ok, false);
  assert.equal(B.request(fish, 'walking', cell(4), land()).ok, false);
  const a = body('mire-choir'), c = context({ terrain: p => ({ floor: true, waterDepthM: p.x < 1 ? 0 : 5, oxygen: true }) });
  assert.equal(B.transition(a, 'swimming', cell(1), c).ok, true);
  B.advance(a, 1, c); assert.ok(a.bodyPhysics.altitudeM < 0); assert.equal(a.mapCell.x, 0);
  assert.ok(B.valid(a));
  const saved = clone(a); B.advance(a, 4, c); B.advance(saved, 4, c); assert.deepEqual(saved, a);
  assert.equal(a.mapCell.x, 1); assert.equal(a.bodyPhysics.mode, 'swimming');
  assert.equal(B.transition(a, 'walking', cell(), c).ok, true); B.advance(a, 8, c); assert.equal(a.bodyPhysics.altitudeM, 0);
});

test('burrowing performs finite actual excavation and a vertical entry spends time and material', () => {
  const a = body('burrowing-furnace'), c = soil();
  const before = c.terrain(cell(6)).materialKg;
  assert.equal(B.request(a, 'burrowing', cell(3), c).ok, true);
  B.advance(a, 5, c);
  assert.ok(a.bodyPhysics.motion.excavatedKg > 0);
  assert.ok(c.terrain(cell(6)).materialKg < before);
  const total = [...c.changes.values()].reduce((sum, t) => sum + (t.rubbleKg || 0), 0);
  assert.ok(total > 0);
  for (const t of c.changes.values()) assert.equal(t.materialKg + (t.rubbleKg || 0), 60000);
  const n = body('nullmaw-stalker'), entry = context();
  for (const p of B.cells(n)) entry.terrain(p).waterDepthM = 0;
  assert.equal(B.transition(n, 'burrowing', cell(), entry).ok, true);
  B.advance(n, .5, entry); assert.ok(n.bodyPhysics.altitudeM < 0); assert.ok(n.bodyPhysics.motion);
  assert.equal(B.request(n, 'walking', cell(3), entry).ok, false);
});

test('unknown geology, foundations, flooding and oxygen loss prevent unsupported tunneling', () => {
  const a = body('burrowing-furnace');
  for (const override of [{ soilDepthM: 0 }, { hardness: 9 }, { foundation: true }, { waterDepthM: 1 }, { oxygen: false }]) {
    const c = context({ terrain: () => ({ floor: true, waterDepthM: 0, soilDepthM: 10, hardness: 1, densityKgM3: 1500, ...override }) });
    assert.equal(B.request(a, 'burrowing', cell(3), c).ok, false, JSON.stringify(override));
  }
});

test('rooting is an actual stationary state; injured locomotor parts constrain action', () => {
  const a = body('ironroot-colossus'), c = land();
  assert.equal(B.request(a, 'rooting', cell(5), c).ok, true); B.advance(a, 20, c); assert.deepEqual(a.mapCell, cell());
  B.damagePart(a, 'root bank', 80, 20); assert.equal(B.capable(a, 'rooting'), false);
  const wolf = body('rimefang-pack'); B.damagePart(wolf, 'left foreleg', 90, 0);
  assert.equal(B.capable(wolf, 'walking'), false);
  const hive = body('brine-cathedral'); B.damagePart(hive, 'core', 100, 0);
  assert.equal(B.capable(hive, 'drifting'), false, 'lost central anatomy is not just a cosmetic wound');
});

test('ice-breaking consumes actual contacting ice and finite effort, not a permanent free ocean road', () => {
  const a = body('frostwake-leviathan'), c = context();
  for (const p of B.cells(a)) Object.assign(c.terrain(p), { iceThicknessM: .01, iceDensityKgM3: 900 });
  assert.match(B.habitatReason(a, a.mapCell, 'swimming', a.bodyPhysics.altitudeM, c), /ice/);
  c.breakIce = (actor, p, volume, t) => { const kg = volume * t.iceDensityKgM3; t.brokenIceKg = kg; t.iceThicknessM = 0; return kg; };
  const result = B.breakIce(a, 1, c); assert.equal(result.ok, true);
  assert.ok(result.kg > 0 && a.bodyPhysics.stamina < 300);
  assert.equal(B.breakIce(a, 2, c).ok, false);
  assert.equal(B.breakIce(body('reef-wyrm'), 1, c).ok, false);
});

test('signals require the actual medium, channel, local range and callback; no remote knowledge grant', () => {
  const a = body('nullmaw-stalker'), target = { mapCell: cell(3) };
  assert.equal(B.perceive(a, target, 'sight', { signal: () => false }), false);
  assert.equal(B.perceive(a, target, 'sight', { signal: () => true, light: 0 }), false);
  assert.equal(B.perceive(a, target, 'vibration', { signal: () => true }), true);
  assert.equal(B.perceive(a, { mapCell: cell(70) }, 'vibration', { signal: () => true }), false);
  assert.equal(B.perceive(a, target, 'pressure', { signal: () => true }), false);
  const bell = body('abyssal-bell'), underwater = body('reef-wyrm');
  assert.equal(B.perceive(bell, underwater, 'pressure', { signal: () => true }), true);
  B.damagePart(bell, 'pressure organs', 90, 0);
  assert.equal(B.perceive(bell, underwater, 'pressure', { signal: () => true }), false);
});

test('nonattendance, final death, zero elapsed reads and invalid saved reserves never backfill work', () => {
  const a = body('storm-kite'), c = land(); B.request(a, 'flight', cell(20), c);
  B.advance(a, 1, c); const distance = a.bodyPhysics.distanceM;
  B.advance(a, 1000, { ...c, local: false }); B.advance(a, 1001, c); assert.equal(a.bodyPhysics.distanceM, distance);
  const before = clone(a); B.advance(a, 1002, { ...c, alive: false }); assert.equal(a.bodyPhysics.distanceM, before.bodyPhysics.distanceM);
  const invalid = clone(a); invalid.bodyPhysics.mana = null; assert.equal(B.valid(invalid), false);
  B.attach(invalid, 10000); assert.equal(invalid.bodyPhysics.mana, null);
});
