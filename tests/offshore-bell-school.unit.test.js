const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations');
const W = require('../background-wildlife'), World = require('../strategic-world');
const DAY = P.DAY, HOUR = 3600, BELL = 'beast:abyssal-bell', PATCH = 'offshore-school';
const seed = 'source-small', near = (n, m) => assert.ok(Math.abs(n - m) < 1e-12 * Math.max(1, Math.abs(m)), `${n} != ${m}`);
let setup;
function fixture() {
  if (setup) return setup;
  const world = L.createWorld({ id: 'offshore-bell-control', worldSeed: seed, createdAt: 'test', generationVersion: 8,
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, active = map.beastHabitatSources;
  const archived = S.generate(seed, map, { offshoreSchool: false });
  const [regionId, site] = active.backgroundWildlife.offshoreSchoolRows[0];
  const withSchool = S.expand(active, map), dispersed = S.expand(archived, map);
  const group = withSchool.groups.find(g => g.speciesId === BELL && g.regionId === regionId
    && g.home.eastKm * 1000 === site.eastM && g.home.northKm * 1000 === site.northM);
  assert.ok(group);
  return setup = { world, map, active, archived, regionId, site, withSchool, dispersed, groupId: group.id };
}
const school = r => r.wildlife.pools.find(p => p.habitatPatch === PATCH);
const originalFields = ['originalCount', 'originalMassKg', 'capacityCount'];

test('one generated offshore school transfers existing large fish and capacity without rewriting archives or Bell homes', () => {
  const { map, active, archived, regionId, site, withSchool, dispersed } = fixture(), before = JSON.stringify(archived);
  assert.equal(active.backgroundWildlife.offshoreSchoolRows.length, 1);
  assert.equal(archived.backgroundWildlife.offshoreSchoolRows, undefined);
  assert.equal(S.validate(archived, map), archived);
  assert.equal(S.validate(active, map), active);
  assert.equal(JSON.stringify(archived), before);
  assert.deepEqual(active.backgroundWildlife.spatialRows, archived.backgroundWildlife.spatialRows);
  assert.deepEqual(active.populations, archived.populations);
  assert.deepEqual(active.physicalBinding, archived.physicalBinding);
  assert.deepEqual(withSchool.groups, dispersed.groups);
  const r = withSchool.regions.find(r => r.id === regionId), old = dispersed.regions.find(r => r.id === regionId);
  const moved = school(r), donor = r.wildlife.pools.find(p => p.habitatPatch === 'background' && p.guild === 'fish' && p.sizeClass === 'large');
  const original = old.wildlife.pools.find(p => p.id === donor.id);
  assert.ok(W.validOffshoreSchoolSite(r, site));
  assert.ok(!W.validOffshoreSchoolSite({ ...r, depthM: 199 }, site));
  assert.equal(map.climate.oceanCurrentClasses[r.source.cellIndex], 'U');
  assert.ok(moved.originalCount > 0 && moved.originalCount <= .02 * original.originalCount);
  assert.ok(moved.originalMassKg / moved.areaHa <= 1200);
  for (const key of originalFields) assert.equal(donor[key] + moved[key], original[key]);
  assert.deepEqual(r.wildlife.pools.filter(p => p !== moved && p !== donor), old.wildlife.pools.filter(p => p !== original));
  for (const key of Object.keys(r.stocks)) near(r.stocks[key], old.stocks[key]);
  assert.deepEqual(r.capacity, old.capacity);
  assert.deepEqual(r.seasons, old.seasons);
  assert.deepEqual(S.runtimeSource(active, map, { deferUnused: true }).regions.find(p => p.id === regionId).wildlife, r.wildlife);
  assert.ok(!school(old));
  const forged = structuredClone(active);
  forged.backgroundWildlife.offshoreSchoolRows[0][1].eastM++;
  forged.id = ''; forged.id = `beast-habitat-source:${World.stableHash(forged)}`;
  assert.throws(() => S.validate(forged, map), /physical accounts/);
});

test('the same original Bell catches and eats from the finite school on separate days in a paced month', t => {
  const { world, withSchool, dispersed, regionId, groupId } = fixture();
  const prepare = (source, runId) => {
    const r = structuredClone(source.regions.find(r => r.id === regionId)), g = source.groups.find(g => g.id === groupId);
    r.edges = []; // Isolated original habitat/body, no new prey, no seasonal adequacy claim.
    const binding = { worldId: world.id, runId };
    return { binding, run: P.createDiagnostic({ ...source, groups: [g], regions: [r] }, binding) };
  };
  const { run, binding } = prepare(withSchool, 'school'), control = prepare(dispersed, 'dispersed').run;
  const r = run.regions[0], current = school(r), c = run.groups[0].cohorts[0];
  const startRanges = structuredClone(c.ranges), startFat = c.stores.fatKg, end = run.calendar.monthDays[0] * DAY;
  for (let day = 1; day <= 10; day++) P.advance(run, day * DAY, true, true);
  const firstHunted = current.huntedCount, firstEaten = current.carcass.consumedKg;
  assert.ok(firstHunted > 0 && firstEaten > 0);
  for (let day = 11; day <= 15; day++) P.advance(run, day * DAY, true, true);
  const saved = P.normalize(run, binding); assert.ok(saved);
  for (let day = 16; day <= 20; day++) {
    P.advance(run, day * DAY, true, true);
    P.advance(saved, day * DAY, true, true);
  }
  assert.ok(current.huntedCount > firstHunted && current.carcass.consumedKg > firstEaten);
  assert.deepEqual(saved.groups, run.groups);
  assert.deepEqual(saved.regions, run.regions);
  for (let at = 21 * DAY; at <= end; at += DAY) P.advance(run, at, true, true);
  for (let at = DAY; at <= end; at += DAY) P.advance(control, at, true, true);
  const unserved = control.groups[0].cohorts[0];
  assert.equal(c.originId, unserved.originId);
  assert.deepEqual(c.ranges, startRanges);
  assert.equal(c.health, 1);
  assert.equal(c.firstScarcity, undefined);
  assert.ok(c.stores.fatKg < startFat, 'original fat helped cover maintenance');
  assert.ok(unserved.health < c.health && unserved.firstScarcity);
  assert.ok(r.foraging.receipts.eatenKg > control.regions[0].foraging.receipts.eatenKg);
  assert.ok(r.foraging.receipts.searchSeconds <= end / DAY * 6 * HOUR);
  assert.equal(r.stocks.meatKg || 0, 0);
  assert.ok(current.cohorts.every(p => p.massKg < W.profile(current).adultKg), 'original adult fish were depleted');
  for (const p of r.wildlife.pools) assert.equal(W.total(p) + p.deadCount + p.huntedCount, p.originalCount + p.bornCount);
  assert.ok(P.normalize(run)); assert.ok(P.normalize(control));
  t.diagnostic(JSON.stringify({ days: end / DAY, schoolHunts: current.huntedCount, schoolKg: current.carcass.consumedKg,
    eatenKg: r.foraging.receipts.eatenKg, dispersedEatenKg: control.regions[0].foraging.receipts.eatenKg,
    searchHours: r.foraging.receipts.searchSeconds / HOUR, dispersedSearchHours: control.regions[0].foraging.receipts.searchSeconds / HOUR,
    remainingFatKg: c.stores.fatKg, dispersedHealth: unserved.health, dispersedFirstShortfallDay: unserved.firstScarcity.at / DAY }));
});
