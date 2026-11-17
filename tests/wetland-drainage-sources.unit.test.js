const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), W = require('../strategic-world');
const F = require('../beast-regional-flood'), { run } = require('../scripts/benchmark-wetland-drainage');
const copy = x => JSON.parse(JSON.stringify(x));
let cached;
function fixture() {
  if (!cached) {
    const world = L.createWorld({ id: 'wetland-drainage-test', worldSeed: 'source-small', createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    const map = world.generatedData.strategicMap, record = map.beastHabitatSources;
    cached = { world, map, record, source: S.expand(record, map) };
  }
  return cached;
}
test('new sources record finite physical outlet dimensions and original downstream geography without altering animals', () => {
  const { record, source, map } = fixture(); assert.equal(record.wetlandDrainage, true);
  const legacy = S.generate(record.seed, map, { wetlandDrainage: false });
  assert.equal(legacy.id, 'beast-habitat-source:9b62d184');
  assert.deepEqual(record.groupRows, legacy.groupRows); assert.deepEqual(record.populations, legacy.populations);
  for (const r of source.regions) {
    const c = r.ecology.watercourses?.[0]; if (!c) continue;
    assert.ok(c.outlet); assert.ok(Number.isFinite(F.capacity(c)) && F.capacity(c) > 0);
    const target = source.regions.find(x => x.id === c.downstreamRegionId);
    assert.equal(target.source.cellIndex, map.hydrology.downstreamByCell[r.source.cellIndex]);
    assert.ok(r.edges.some(e => e.id === target.id)); assert.ok(c.outlet.widthM <= Math.sqrt(r.areaHa * 10000));
    assert.ok(c.outlet.depthM <= r.depthM); F.validateDefinition(r);
  }
  assert.ok(source.regions.filter(r => map.hydrology.downstreamByCell[r.source.cellIndex] < 0).every(r => !r.ecology.watercourses));
});
test('unmarked archived source geometry and reusable world storage remain immutable', () => {
  const { record, map, world } = fixture(), legacy = S.generate(record.seed, map, { wetlandDrainage: false });
  const before = JSON.stringify(legacy); S.validate(legacy, map);
  assert.ok(S.expand(legacy, map).regions.every(r => !r.ecology.floodplain && !(r.ecology.watercourses || []).some(c => c.outlet)));
  assert.equal(JSON.stringify(legacy), before); assert.equal(L.normalizeWorld(copy(world)).canonicalDigest, world.canonicalDigest);
});
test('re-signing a wider outlet or a changed floodplain cannot rewrite the original geographic allocation', () => {
  const { record, map } = fixture();
  for (const change of [r => { r.physicalBinding.watercourses[0].course.outlet.widthM *= 2; }, r => {
    r.physicalBinding.environments.find(e => e.ecology.floodplain).ecology.floodplain.safeDepthMm *= 2;
  }]) {
    const bad = copy(record); change(bad); bad.id = ''; bad.id = `beast-habitat-source:${W.stableHash(bad)}`;
    assert.throws(() => S.validate(bad, map), /physical accounts/);
  }
});
test('generated wetland hydrology retains finite water and validates an entire seasonal interval without an ecology-success claim', () => {
  const { world } = fixture(), before = JSON.stringify(world), result = run({ world });
  assert.equal(result.days, 120); assert.equal(result.excludedOriginalStrategicBodies, 56243);
  assert.ok(Math.abs(result.errorL) <= (result.originalL + result.suppliedL) * 1e-10);
  assert.ok(result.actualOutlets > 0); assert.match(result.scope, /not food-web viability or source adoption/);
  assert.equal(JSON.stringify(world), before);
});
