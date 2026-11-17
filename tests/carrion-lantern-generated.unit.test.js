// Isolated species diagnostic on generated geography/finite wildlife, not an
// all-species viability certificate or a native-game adoption test.
const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations');
const F = require('../beast-foraging'), C = require('../carrion-lantern-biology');
test('generated Carrion Lantern originals execute 120 days with corrected biology and finite moisture', t => {
  const world = L.createWorld({ id: 'lantern-isolation', worldSeed: 'source-small', generationVersion: 8,
    createdAt: 'test', creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, original = JSON.stringify(world);
  const source = S.expand(record, map); source.groups = source.groups.filter(C.is); source.unlocated = [];
  // Other strategic species neither work nor compete in this explicit control.
  // Their finite anonymous wildlife and geographic water pools remain original.
  for (const r of source.regions) { r.ecology.workSites = []; r.nurseries = r.nurseries.filter(n => n.speciesId === C.ID); }
  const s = P.createDiagnostic(source, { worldId: world.id, runId: 'isolated' });
  const initial = Object.values(s.originalCounts).reduce((a, b) => a + b, 0);
  let day20;
  for (let day = 1; day <= 120; day++) {
    if (process.env.HELIX_LANTERN_PROGRESS === '1' && (day === 1 || day % 20 === 0))
      process.stderr.write(`Lantern diagnostic entering day ${day}; ${s.work.boundaries} boundaries\n`);
    P.advance(s, day * P.DAY, true, true);
    if (day % 20 === 0) {
      assert.ok(P.normalize(s), `invalid generated account at day ${day}`);
      const living = Object.values(P.audit(s)).reduce((n, p) => n + p.background, 0);
      if (day === 20) day20 = living;
      t.diagnostic(JSON.stringify({ day, living, airTakenL: s.regions.reduce((n, r) => n + (r.airMoistureTakenL || 0), 0) }));
    }
  }
  const audit = Object.values(P.audit(s)), living = audit.reduce((n, p) => n + p.background, 0), dead = audit.reduce((n, p) => n + p.dead, 0);
  const born = s.births.reduce((n, b) => n + b.count, 0);
  assert.equal(initial + born, living + dead); assert.ok(day20 > 0); assert.equal(F.summary(s).searchSeconds, 0);
  assert.equal(JSON.stringify(world), original); assert.throws(() => S.runtimeSource(record, map));
  const causes = {}; for (const loss of [...s.losses, ...s.lossBatches]) causes[loss.cause] = (causes[loss.cause] || 0) + (loss.count ?? 1);
  t.diagnostic(JSON.stringify({ initial, born, living, dead, causes, cohorts: s.groups.reduce((n, g) => n + g.cohorts.length, 0),
    foodKg: F.summary(s).eatenKg, airTakenL: s.regions.reduce((n, r) => n + (r.airMoistureTakenL || 0), 0), work: s.work }));
});
