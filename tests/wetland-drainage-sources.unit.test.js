const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), W = require('../strategic-world');
const F = require('../beast-regional-flood'), { run } = require('../scripts/benchmark-wetland-drainage');
const B = require('../beast-habitat-bindings'), P = require('../beast-populations');
const { source: prepared } = require('./helpers/drainage-source');
const copy = x => JSON.parse(JSON.stringify(x));
const approx = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
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
  assert.equal(legacy.wetlandDrainage, undefined);
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
  const { record, map, world } = fixture(), legacy = S.generate(record.seed, map, { wetlandDrainage: false, huntingHabitatAccess: false });
  assert.equal(legacy.id, 'beast-habitat-source:9b62d184');
  const before = JSON.stringify(legacy); S.validate(legacy, map);
  assert.ok(S.expand(legacy, map).regions.every(r => !r.ecology.floodplain && !(r.ecology.watercourses || []).some(c => c.outlet)));
  assert.equal(JSON.stringify(legacy), before); assert.equal(L.normalizeWorld(copy(world)).canonicalDigest, world.canonicalDigest);
});
test('catchment-aware generation preserves both earlier drainage sources, counts, matter and rainfall', () => {
  const { record, source, map } = fixture(); assert.equal(record.catchmentDrainage, true);
  const legacy = S.generate(record.seed, map, { catchmentDrainage: false });
  assert.equal(legacy.id, 'beast-habitat-source:6fe013ab');
  const baseline = S.generate(record.seed, map, { catchmentDrainage: false, huntingHabitatAccess: false });
  assert.equal(baseline.id, 'beast-habitat-source:a2ffef9d');
  const saved = JSON.stringify(baseline); S.validate(baseline, map); assert.equal(JSON.stringify(baseline), saved);
  assert.deepEqual(record.groupRows, legacy.groupRows); assert.deepEqual(record.populations, legacy.populations);
  assert.deepEqual(record.backgroundWildlife, legacy.backgroundWildlife);
  const old = S.expand(legacy, map);
  source.regions.forEach((r, i) => {
    assert.deepEqual(r.stocks, old.regions[i].stocks); assert.deepEqual(r.capacity, old.regions[i].capacity);
    assert.deepEqual(r.seasons, old.regions[i].seasons);
  });
  assert.equal(record.physicalBinding.catchmentDrainage.length, 62);
  for (const row of record.physicalBinding.catchmentDrainage) {
    const r = source.regions.find(r => r.id === row.regionId), c = r.ecology.watercourses[0];
    assert.ok(c.outlet.widthM <= row.widthLimitM); approx(F.capacity(c), row.capacityLDay);
    assert.ok(row.capacityLDay >= row.normalLDay);
  }
  // Downstream geometry includes tributaries, not only its own tiny rain bank.
  const row = record.physicalBinding.catchmentDrainage.find(r => r.regionId === 'habitat:117:wetland');
  assert.deepEqual(row.upstreamRegionIds, ['habitat:9:wetland']); assert.ok(row.normalLDay > 1.4e10);
  assert.ok(source.regions.find(r => r.id === row.regionId).ecology.watercourses[0].outlet.widthM > 1500);
  assert.equal(source.regions.find(r => r.id === 'habitat:2:wetland').ecology.watercourses[0].outlet.widthM, 100);
});
function fit(src) {
  for (const r of src.regions) r.seasons ||= src.calendar.monthDays.map(() => ({ temperatureC: 20, renewal: copy(r.renewalPerDay) }));
  const binding = { watercourses: src.regions.flatMap(r => (r.ecology.watercourses || []).map(course => ({ regionId: r.id, course }))),
    rainfallShares: [], issues: [] };
  B.sizeCatchmentOutlets(src, binding); return binding;
}
test('annual sizing weights real month lengths and sequential rainfall shares without duplicating tributaries', () => {
  const src = prepared({ middle: true, river: 1000, rain: 10000 }), days = src.calendar.monthDays;
  src.regions[0].seasons = days.map((_, i) => ({ renewal: { waterL: i === 0 ? 20000 : 10000 } }));
  src.regions[1].seasons = days.map(() => ({ renewal: { waterL: 5000 } }));
  src.regions[2].seasons = days.map(() => ({ renewal: {} }));
  const binding = { watercourses: src.regions.flatMap(r => (r.ecology.watercourses || []).map(course => ({ regionId: r.id, course }))),
    rainfallShares: [{ regionId: 'upstream', fraction: .1 }, { regionId: 'upstream', flowFraction: .2 }], issues: [] };
  B.sizeCatchmentOutlets(src, binding);
  const [a, b] = binding.catchmentDrainage;
  approx(a.normalLDay, (20000 * days[0] + 10000 * (120 - days[0])) / 120 * .9 * .8 + 1000);
  approx(b.normalLDay, a.normalLDay + 5000); assert.deepEqual(b.upstreamRegionIds, ['upstream']);
  assert.equal(binding.issues.length, 0);
});
test('ordinary seasonal inundation is stored and recedes without erosion; save continuation preserves finite discharge', () => {
  const src = prepared({ rain: 10000, outlet: 8000, safeDepthMm: 100 }); src.calendar.monthDays = [30, 30, 30, 30];
  src.regions[0].seasons = [5000, 15000, 15000, 5000].map(waterL => ({ temperatureC: 20, renewal: { waterL } }));
  const fitResult = fit(src); approx(fitResult.catchmentDrainage[0].normalLDay, 10000);
  const s = P.create(src, { worldId: 'seasonal-catchment', runId: 'run' });
  P.advance(s, 60 * P.DAY, true, true); approx(s.regions[0].flood.waterL, 150000);
  approx(s.regions[0].flood.erosionEP, 0);
  const branch = P.normalize(s); assert.ok(branch);
  P.advance(s, 120 * P.DAY, true, true); P.advance(branch, 120 * P.DAY, true, true);
  approx(s.regions[0].flood.waterL, 150000); approx(s.regions[0].flood.erosionEP, 0);
  assert.deepEqual(s.regions, branch.regions); assert.ok(P.normalize(s));
});
test('geographic bottlenecks and closed basins remain unsupported and damaging, never auto-widened during play', () => {
  const src = prepared({ rain: 12000, outlet: .001, safeDepthMm: 0 });
  const fitResult = fit(src), c = src.regions[0].ecology.watercourses[0];
  assert.equal(c.outlet.widthM, 100); assert.equal(fitResult.issues[0].kind, 'unsupportedCatchmentDrainage');
  const s = P.create(src, { worldId: 'bottleneck', runId: 'run' });
  P.advance(s, P.DAY, true, true); assert.ok(s.regions[0].flood.erosionEP > 0);
  assert.equal(s.regions[0].ecology.watercourses[0].outlet.widthM, 100); assert.ok(P.normalize(s));
  const closed = prepared({ outlet: null }); assert.deepEqual(fit(closed).catchmentDrainage, []);
  assert.equal(closed.regions[0].ecology.watercourses, undefined);
});
test('receiving-patch span and actual edge distance both limit generated aggregate width', () => {
  for (const change of [src => { src.regions[1].areaHa = .000001; },
    src => { src.regions[0].edges[0].distanceKm = .00005; }]) {
    const src = prepared({ rain: 12000, outlet: 8000 }); change(src);
    const b = fit(src), row = b.catchmentDrainage[0], c = src.regions[0].ecology.watercourses[0];
    assert.ok(c.outlet.widthM <= row.widthLimitM); assert.ok(row.capacityLDay < row.normalLDay);
    assert.equal(b.issues[0].kind, 'unsupportedCatchmentDrainage');
  }
});
test('re-signing a wider outlet or a changed floodplain cannot rewrite the original geographic allocation', () => {
  const { record, map } = fixture();
  for (const change of [r => { r.physicalBinding.watercourses[0].course.outlet.widthM *= 2; }, r => {
    r.physicalBinding.environments.find(e => e.ecology.floodplain).ecology.floodplain.safeDepthMm *= 2;
  }, r => { r.physicalBinding.catchmentDrainage[0].normalLDay *= 2; }]) {
    const bad = copy(record); change(bad); bad.id = ''; bad.id = `beast-habitat-source:${W.stableHash(bad)}`;
    assert.throws(() => S.validate(bad, map), /physical accounts/);
  }
});
test('generated wetland hydrology retains finite water and validates an entire seasonal interval without an ecology-success claim', () => {
  const { world } = fixture(), before = JSON.stringify(world), result = run({ world });
  assert.equal(result.days, 120); assert.equal(result.excludedOriginalStrategicBodies, 56243);
  assert.ok(Math.abs(result.errorL) <= (result.originalL + result.suppliedL) * 1e-10);
  assert.ok(result.actualOutlets > 0); assert.match(result.scope, /not food-web viability or source adoption/);
  assert.equal(result.erodedWetlands, 0); assert.equal(result.soilMaintenanceDeficits, 0); assert.equal(result.soilFloorBreaches, 0);
  assert.equal(result.unsupportedCatchments.length, 0); assert.ok(result.minimumSoilCoverWithFloor > 0);
  assert.equal(JSON.stringify(world), before);
});
test('recorded catchment control explains all 37 historical deficits without calling an isolated control a full food-web pass', () => {
  const result = require('../reference/catchment-drainage-control.json'), { record } = fixture();
  assert.equal(result.sourceId, record.id); assert.equal(result.regions, 334); assert.equal(result.wetlands, 62);
  assert.equal(result.excludedOriginalStrategicBodies, 56243); assert.equal(result.erodedWetlands, 0);
  const c = result.historicalComparison;
  assert.equal(c.sourceId, 'beast-habitat-source:a2ffef9d'); assert.equal(c.days, 120);
  assert.equal(c.soilDeficitRegions, 37); assert.equal(c.floodOnlyDestructionRegions, 35);
  assert.equal(c.otherSoilDestructionRegions, 2); assert.equal(c.positiveRecordedBalanceWithoutFloodRegions, 37);
  const compared = result.wetlandRecords.filter(r => r.historicalFullFoodWeb); assert.equal(compared.length, 37);
  for (const row of compared) {
    assert.equal(row.soilMaintenanceDeficit, false); assert.equal(row.erosionEP, 0);
    assert.ok(row.catchment.normalLDay <= row.outletCapacityLDay);
    assert.ok(row.historicalFullFoodWeb.soilBalanceWithoutRecordedFloodEP > 0);
  }
  assert.match(c.scope, /not a repeated all-species result/);
});
