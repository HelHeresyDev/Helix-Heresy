const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../beast-habitat-sources'), W = require('../background-wildlife'), P = require('../beast-populations');
const L = require('../world-run-library');
const World = require('../strategic-world'), Behavior = require('../beast-behavior');
const copy = x => JSON.parse(JSON.stringify(x)), seed = 'source-small', calendar = { epochAt: 0, monthDays: [30, 30, 30, 30] };
function estimate(change = () => {}, used = new Map()) {
  const patch = { id: 'field', areaHa: 100, kind: 'surface', depthM: 0 };
  const pos = W.initialPosition(patch, seed, 'family', true);
  const pool = { id: 'prey', guild: 'smallAnimals', sizeClass: 'medium', originalMassKg: 1000,
    areaHa: 1, habitatDepthM: 0, spatial: { ...pos, radiusM: Math.sqrt(10000 / Math.PI), depthTopM: 0 } };
  change(pool, patch);
  const before = JSON.stringify({ patch, pool }), result = S.huntingSupport(patch, [pool], 'beast:rimefang-pack', 'family', 5, seed, calendar, used);
  assert.equal(JSON.stringify({ patch, pool }), before); return result;
}
test('initial hunting support bounds finite original compatible flesh and never funds it from plants or unborn prey', () => {
  const result = estimate(); assert.ok(result.foodKgDay > 0 && result.foodKgDay <= 1000 * .6 / 120);
  assert.deepEqual(result.candidates.map(c => c.poolId), ['prey']);
  assert.equal(estimate(pool => { pool.originalMassKg = 0; }).foodKgDay, 0);
  const used = new Map([['prey', 600]]); assert.equal(estimate(() => {}, used).foodKgDay, 0);
  assert.deepEqual([...used], [['prey', 600]], 'reading support does not spend or refill the planning ledger');
});
test('unreachable herds, wrong media and too-large prey cannot support an initially placed hunter', () => {
  for (const change of [pool => { pool.spatial.eastM += 100000; },
    pool => { pool.guild = 'fish'; }, pool => { pool.sizeClass = 'large'; }]) assert.equal(estimate(change).foodKgDay, 0);
});
let cached;
function fixture() {
  if (!cached) {
    const world = L.createWorld({ id: 'hunting-habitat-control', worldSeed: seed, createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    const map = world.generatedData.strategicMap, current = map.beastHabitatSources;
    cached = { world, map, current, prior: S.generate(seed, map, { huntingHabitatAccess: false }) };
  }
  return cached;
}
test('new hunting placement preserves calibration, original populations, wildlife and old archived placement', () => {
  const { world, map, current, prior } = fixture(), old = JSON.stringify(prior), canonical = JSON.stringify(world);
  assert.equal(current.huntingHabitatAccess, true); assert.equal(prior.huntingHabitatAccess, undefined);
  // This is a newly generated non-hunting control, including current drainage
  // rules, not a frozen pre-drainage historical source fixture.
  assert.equal(prior.id, S.generate(seed, map, { huntingHabitatAccess: false }).id);
  assert.equal(current.calibration, prior.calibration);
  assert.deepEqual(current.populations, prior.populations); assert.deepEqual(current.unlocated, prior.unlocated);
  // A different coastal Wyrm placement may settle fish at a different
  // original reef nursery, but cannot change the archived prey allocation.
  const foundingWildlife = ({ reefSchoolRows, ...budgets }) => budgets;
  assert.deepEqual(foundingWildlife(current.backgroundWildlife), foundingWildlife(prior.backgroundWildlife));
  const nextGroups = S.expand(current, map).groups, oldGroups = S.expand(prior, map).groups;
  assert.equal(new Set(nextGroups.map(g => g.speciesId)).size, 24);
  for (const g of nextGroups) if (!Behavior.capabilities[g.speciesId]?.includes('hunt')
    || Behavior.foodKeys({ speciesId: g.speciesId }).some(k => !['meatKg', 'carrionKg'].includes(k)))
    assert.equal(g.regionId, oldGroups.find(old => old.id === g.id).regionId, 'other source families keep their placement');
  S.validate(prior, map); S.validate(current, map);
  assert.equal(JSON.stringify(prior), old); assert.equal(JSON.stringify(world), canonical);
  assert.equal(L.normalizeWorld(world).canonicalDigest, world.canonicalDigest);
  assert.equal(S.runtimeSource(current, map).ecologicalStatus, 'unverified');
  const forged = copy(prior); forged.huntingHabitatAccess = true; forged.id = '';
  forged.id = `beast-habitat-source:${World.stableHash(forged)}`;
  assert.throws(() => S.validate(forged, map), /physical accounts|placement/, 'an old world cannot acquire the correction by re-signing its marker');
});
function localControl(record, map, together) {
  // Deliberately isolated diagnostic copies, not reduced-roster claims of world
  // support. Retain the recorded bodies, food, positions, nurseries and wildlife.
  const src = S.expand(record, map), g = src.groups.find(g => g.id === 'natural-group:beast-population:rimefang-pack:01:0');
  const r = src.regions.find(r => r.id === g.regionId); r.edges = [];
  return { ...src, id: `local-hunting-control:${record.id}:${together}`, regions: [r],
    groups: together ? src.groups.filter(group => group.regionId === r.id) : [g] };
}
test('a failing original family survives real hunting and care in a supplied original-territory placement without extra prey', () => {
  const { map, prior, current } = fixture(), outcomes = [];
  for (const record of [prior, current]) {
    const src = localControl(record, map, false), before = JSON.stringify(src);
    const s = P.createDiagnostic(src, { worldId: 'local-hunters', runId: 'original' });
    P.advance(s, 15 * P.DAY, true, true);
    outcomes.push({ alive: Object.values(P.audit(s)).reduce((n, r) => n + r.background, 0),
      scarcity: [...s.losses, ...s.lossBatches].filter(l => ['starvation', 'dehydration'].includes(l.cause)) });
    assert.ok(P.normalize(s)); assert.equal(JSON.stringify(src), before);
    if (record === current) {
      assert.ok(s.groups[0].cohorts.every(c => c.health > .99));
      assert.ok(s.regions[0].foraging.receipts.eatenKg > 400); assert.equal(s.regions[0].stocks.meatKg || 0, 0);
      assert.ok(s.regions[0].careReceipts.givenWaterL > 0); assert.ok(s.regions[0].careReceipts.givenFoodKg > 0);
    }
  }
  assert.equal(outcomes[0].alive, 0); assert.equal(outcomes[1].alive, 6); assert.deepEqual(outcomes[1].scarcity, []);
});
test('all actually coallocated hunters share finite prey through paid care, partial saves and continued branches', () => {
  const { map, current } = fixture(), src = localControl(current, map, true);
  assert.equal(src.groups.length, 19);
  const s = P.createDiagnostic(src, { worldId: 'shared-hunters', runId: 'original' });
  P.advance(s, 10 * P.DAY, true, true);
  const snapshot = JSON.stringify(s), saved = P.normalize(copy(s)); assert.ok(saved);
  const branch = P.rebind(saved, saved, { worldId: saved.worldId, runId: 'continued' });
  P.advance(s, 30 * P.DAY, true, true); P.advance(branch, 30 * P.DAY, true, true);
  assert.deepEqual(P.audit(s), P.audit(branch)); assert.deepEqual(s.regions[0].careReceipts, branch.regions[0].careReceipts);
  assert.deepEqual(s.regions[0].wildlife, branch.regions[0].wildlife);
  assert.equal(JSON.stringify(saved), snapshot);
  assert.equal([...s.losses, ...s.lossBatches].some(l => ['starvation', 'dehydration'].includes(l.cause)), false);
  assert.equal(Object.values(P.audit(s)).reduce((n, r) => n + r.background, 0), 113);
  assert.ok(s.regions[0].foraging.receipts.eatenKg > 15000); assert.ok(P.normalize(s));
});
