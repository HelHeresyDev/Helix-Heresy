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
const prepare = (source, runId, { editRegion, withBell = true } = {}) => {
  const { world, regionId, groupId } = fixture();
  const r = structuredClone(source.regions.find(r => r.id === regionId));
  r.edges = []; // Isolate the original habitat and body.
  editRegion?.(r);
  const binding = { worldId: world.id, runId }, groups = withBell ? [source.groups.find(g => g.id === groupId)] : [];
  return { binding, run: P.createDiagnostic({ ...source, groups, regions: [r] }, binding) };
};
const advance = (s, day) => assert.ok(P.advance(s, day * DAY, true, true));
const adults = p => p.cohorts.filter(c => c.massKg === W.profile(p).adultKg).reduce((n, c) => n + c.count, 0);
const balanced = s => {
  const summary = W.summary(s);
  assert.equal(summary.living + summary.dead + summary.hunted, summary.original + summary.born);
  assert.ok(P.normalize(s));
};

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
  const { withSchool, dispersed } = fixture();
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

test('cold-upwelling shoals pay for travel, preserve custody on reload and feed the same Bell after adult depletion', t => {
  const { withSchool } = fixture();
  const { run, binding } = prepare(withSchool, 'seasonal-shoal');
  const control = prepare(withSchool, 'same-school-without-shoaling').run;
  const r = run.regions[0], beforeSchool = school(r), left = control.regions[0];
  const first = run.calendar.monthDays[0], end = first + run.calendar.monthDays[1];
  for (let day = 1; day <= first; day++) {
    advance(run, day);
    // Same school, weather, fish, and Bell. Only suppress the initial intent
    // on this diagnostic branch, while no fish have yet left their pools.
    const plan = W.plan;
    try {
      W.plan = (here, month, at) => {
        plan(here, month, at);
        if (here === left && here.wildlife.shoal?.departed === 0) delete here.wildlife.shoal;
      };
      advance(control, day);
    } finally { W.plan = plan; }
  }
  const { shoal: s } = r.wildlife, donor = r.wildlife.pools.find(p => p.id === s.donorId);
  assert.deepEqual(run.groups, control.groups);
  assert.deepEqual(r.wildlife.pools, left.wildlife.pools);
  assert.equal(adults(beforeSchool), 0);
  assert.equal(s.departed, 0);
  assert.equal(s.plan.index, 1);
  assert.equal(s.plan.budget, Math.min(Math.floor(beforeSchool.originalCount / 2), Math.floor(s.plan.adults * .01)));
  const oldEaten = r.foraging.receipts.eatenKg, oldSchoolEaten = beforeSchool.carcass.consumedKg;
  const origin = run.groups[0].cohorts[0].originId;
  const counts = { school: beforeSchool.originalCount, donor: donor.originalCount };
  advance(run, first + 4.5);
  const [batch] = s.transit;
  assert.ok(batch && batch.departedAt < run.clock && batch.dueAt > run.clock);
  assert.equal(s.departed, batch.count); assert.equal(s.arrived, 0);
  assert.equal(adults(beforeSchool), 0);
  assert.ok(donor.cohorts.every(c => c.id !== batch.id) && beforeSchool.cohorts.every(c => c.id !== batch.id));
  const hours = Math.hypot(donor.spatial.eastM - beforeSchool.spatial.eastM, donor.spatial.northM - beforeSchool.spatial.northM) / .2 / HOUR;
  near(batch.dueAt - batch.departedAt, hours * HOUR);
  assert.ok(batch.hazard > 0);
  const withoutTransit = structuredClone(r);
  withoutTransit.wildlife.shoal.transit = [];
  const paid = { demand: {} }, standing = { demand: {} };
  W.prepare(r, run.clock, paid); W.prepare(withoutTransit, run.clock, standing);
  near(paid.demand.planktonKg - standing.demand.planktonKg, batch.count * W.profile(donor).foodDay);
  balanced(run);
  const restored = P.normalize(run, binding);
  const forged = structuredClone(run);
  const bad = forged.regions[0], q = bad.wildlife.shoal.transit[0];
  school(bad).cohorts.push({ ...q });
  assert.equal(P.normalize(forged, binding), null);
  assert.ok(P.advance(run, batch.dueAt, true, true));
  assert.ok(P.advance(restored, batch.dueAt, true, true));
  assert.ok(s.arrived > 0);
  assert.ok(adults(beforeSchool) > 0);
  for (let day = first + 6; day <= end; day++) {
    advance(run, day);
    advance(restored, day);
  }
  for (let day = first + 1; day <= end; day++) advance(control, day);
  assert.deepEqual(restored.groups, run.groups);
  assert.deepEqual(restored.regions, run.regions);
  assert.equal(control.regions[0].wildlife.shoal, undefined);
  assert.equal(adults(school(left)), 0);
  assert.equal(s.transit.length, 0);
  assert.ok(s.arrived <= s.departed && s.departed <= s.plan.budget);
  assert.equal(beforeSchool.originalCount, counts.school); assert.equal(donor.originalCount, counts.donor);
  assert.ok(beforeSchool.carcass.consumedKg - oldSchoolEaten > school(left).carcass.consumedKg - oldSchoolEaten);
  assert.ok(r.foraging.receipts.eatenKg > left.foraging.receipts.eatenKg);
  const bell = run.groups[0].cohorts[0], without = control.groups[0].cohorts[0];
  assert.equal(bell.originId, origin); assert.deepEqual(bell.ranges, without.ranges);
  balanced(run); balanced(control);
  t.diagnostic(JSON.stringify({ startDay: first, endDay: end, hours, ...Object.fromEntries(['departed', 'arrived', 'returned', 'lost'].map(k => [k, s[k]])),
    schoolKg: beforeSchool.carcass.consumedKg - oldSchoolEaten, controlSchoolKg: school(left).carcass.consumedKg - oldSchoolEaten,
    eatenKg: r.foraging.receipts.eatenKg - oldEaten, controlEatenKg: left.foraging.receipts.eatenKg - oldEaten,
    fatKg: bell.stores.fatKg, controlFatKg: without.stores.fatKg, health: bell.health, controlHealth: without.health,
    firstShortfallDay: bell.firstScarcity?.at / DAY, controlFirstShortfallDay: without.firstScarcity?.at / DAY }));
});

test('a distant hotspot cannot refill depleted offshore adults', () => {
  const { withSchool } = fixture();
  const { run } = prepare(withSchool, 'unreachable-shoal-donor', { editRegion(r) {
    const target = school(r).spatial;
    for (const p of r.wildlife.pools.filter(p => p.habitatPatch?.startsWith('hotspot-') && p.guild === 'fish' && p.sizeClass === 'large')) {
      const site = p.spatial;
      if (Math.hypot(site.eastM - target.eastM, site.northM - target.northM) > 25000) continue;
      site.eastM = -site.eastM; site.northM = -site.northM;
      assert.ok(Math.hypot(site.eastM - target.eastM, site.northM - target.northM) > 25000);
    }
  } });
  const r = run.regions[0], end = run.calendar.monthDays[0] + run.calendar.monthDays[1];
  for (let day = 1; day <= end; day++) advance(run, day);
  assert.equal(r.wildlife.shoal, undefined);
  assert.ok(adults(r.wildlife.pools.find(p => p.habitatPatch === 'hotspot-1' && p.sizeClass === 'large' && p.guild === 'fish')) > 0);
  assert.equal(adults(school(r)), 0);
  balanced(run);
});

test('a full school sends fish back; a batch that dies swimming leaves one real positioned corpse ledger', () => {
  const { withSchool } = fixture();
  const { run } = prepare(withSchool, 'shoal-return', { withBell: false });
  advance(run, 34.5);
  const r = run.regions[0], s = r.wildlife.shoal, [batch] = s.transit;
  const donor = r.wildlife.pools.find(p => p.id === s.donorId), target = school(r);
  const duration = batch.dueAt - batch.departedAt;
  const blocked = P.normalize(run);
  assert.ok(blocked);
  assert.ok(P.advance(run, batch.dueAt, true, true));
  assert.equal(s.arrived, 0);
  assert.equal(s.transit[0].returning, true);
  near(s.transit[0].dueAt, batch.departedAt + 2 * duration);
  balanced(run);
  assert.ok(P.advance(run, s.transit[0].dueAt, true, true));
  assert.equal(s.returned, batch.count);
  assert.equal(s.transit.length, 0);
  balanced(run);

  // Isolate the shortage rule with a nearly exhausted batch and unavailable
  // passage. A fully healthy batch can survive these short pilot routes.
  const rr = blocked.regions[0], ss = rr.wildlife.shoal, q = ss.transit[0], count = q.count;
  q.health = .01;
  const at = blocked.clock + q.health / .2 * DAY;
  rr.contactBarriers = [{ minEastM: target.spatial.eastM - 1, maxEastM: target.spatial.eastM + 1,
    minNorthM: target.spatial.northM - 1, maxNorthM: target.spatial.northM + 1, bottomM: -20, topM: -5 }];
  assert.ok(P.removeStock(blocked, rr.id, 'planktonKg', 0, blocked.clock, 'diagnostic passage closes'));
  assert.ok(P.advance(blocked, at, true, true));
  const source = rr.wildlife.pools.find(p => p.id === ss.donorId);
  assert.equal(ss.lost, count);
  assert.equal(ss.arrived, 0);
  assert.equal(ss.transit.length, 0);
  assert.equal(source.huntedCount, 0);
  const remains = Object.values(source.carcassSpace.sites).filter(p => p.transitDeaths);
  assert.equal(remains.length, 1);
  const [site] = remains, progress = (at - batch.departedAt) / duration;
  assert.equal(site.transitDeaths, ss.lost);
  near(site.initialMassKg, ss.lost * W.profile(source).adultKg);
  near(site.position.eastM, donor.spatial.eastM + (target.spatial.eastM - donor.spatial.eastM) * progress);
  near(site.position.northM, donor.spatial.northM + (target.spatial.northM - donor.spatial.northM) * progress);
  balanced(blocked);
});
