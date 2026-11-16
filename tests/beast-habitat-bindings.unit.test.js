const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../world-run-library'), S = require('../beast-habitat-sources'), P = require('../beast-populations');
const D = require('../creature-biology'), W = require('../strategic-world');
const clone = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY;
const approx = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} != ${b}`);
let cached;
function fixture() {
  if (!cached) {
    const world = L.createWorld({ id: 'generated-binding-world', worldSeed: 'source-small', createdAt: 'test', generationVersion: 8,
      creationSettings: { strategicMap: { refinementLevel: 2 } } });
    const map = world.generatedData.strategicMap, record = map.beastHabitatSources;
    cached = { world, map, record, source: S.expand(record, map) };
  }
  return cached;
}
const binding = { worldId: 'generated-binding-world', runId: 'private-source-check' };
test('normal generation archives typed original regions, work sites and nurseries for the fixed source roster', () => {
  const { source, record } = fixture(); assert.equal(P.validateSource(source), source);
  assert.equal(new Set(source.groups.map(g => g.speciesId)).size, 24);
  assert.equal(record.physicalBinding.groupBindings.length, source.groups.length);
  assert.ok(record.physicalBinding.workSites.length > 0); assert.ok(record.physicalBinding.nurseries.length > 0);
  assert.ok(source.regions.every(r => r.ecology && r.nurseries && D.ledgers.every(([id]) => Number.isFinite(r.condition[id]))));
  assert.equal(source.diagnosticOnly, true); assert.throws(() => P.create(source, binding), /unaccepted generator/);
});
test('initial work materials partition original matter and water rather than adding a second resource budget', () => {
  const { source, record, map } = fixture(), raw = S.expand(record, map, { raw: true });
  const kg = r => Object.entries(r.stocks).filter(([k]) => k.endsWith('Kg')).reduce((n, [, v]) => n + v, 0);
  const water = r => ['waterL', 'atmosphericWaterL', 'flowWaterL'].reduce((n, k) => n + (r.stocks[k] || 0), 0);
  for (let i = 0; i < source.regions.length; i++) {
    const bodyKg = (source.regions[i].wildlife?.pools || []).reduce((n, p) => n + p.originalMassKg, 0);
    const id = source.regions[i].id;
    const moved = (record.physicalBinding.catchmentTransfers || []).reduce((n, t) => n + (t.toRegionId === id ? t.amount : 0) - (t.fromRegionId === id ? t.amount : 0), 0);
    approx(kg(source.regions[i]) + bodyKg, kg(raw.regions[i])); approx(water(source.regions[i]), water(raw.regions[i]) + moved);
    assert.equal(source.regions[i].stocks.seawaterL, raw.regions[i].stocks.seawaterL);
    assert.equal(source.regions[i].stocks.meatKg, undefined); assert.equal(source.regions[i].stocks.carrionKg, undefined);
    for (const season of source.regions[i].seasons) assert.equal(season.renewal.mineralsKg, 0);
  }
});
test('sub-hex ponds partition actual land and finite catchment water without adding rainfall or editing biome geography', () => {
  const { source, record, map } = fixture(), raw = S.expand(record, map, { raw: true });
  assert.ok(record.physicalBinding.catchmentTransfers.length > 0);
  for (const t of record.physicalBinding.catchmentTransfers) {
    const from = raw.regions.find(r => r.id === t.fromRegionId), to = raw.regions.find(r => r.id === t.toRegionId);
    assert.equal(from.cellId, to.cellId); assert.equal(from.kind, 'surface'); assert.equal(to.source.catchmentPond, true);
    approx(to.capacity.waterL - to.stocks.waterL, t.amount); assert.ok(t.amount <= from.stocks.waterL);
    const baseline = S.expandPatch(map, [from.source.cellIndex, 0, from.areaHa + to.areaHa], record.calendar, true);
    approx(from.stocks.waterL + to.stocks.waterL, baseline.stocks.waterL);
    approx(from.source.rainfallLPerDay + to.source.rainfallLPerDay, baseline.source.rainfallLPerDay);
    assert.equal(to.biome, map.biomes.classes[to.source.cellIndex]); assert.ok(to.areaHa < from.areaHa * .002);
    const filled = source.regions.find(r => r.id === to.id); approx(filled.depthM, 4);
    assert.ok(filled.stocks.waterL <= filled.capacity.waterL);
  }
  const B = require('../beast-habitat-bindings'), bad = clone(raw), transfer = record.physicalBinding.catchmentTransfers[0];
  bad.regions.find(r => r.id === transfer.fromRegionId).stocks.waterL = 0;
  assert.throws(() => B.apply(bad, record.physicalBinding, map), /Unfunded catchment pond/);
});
test('positioned proposals reject unusable starts while retaining original population counts and unavailable abilities', () => {
  const { source, record, map } = fixture(), species = new Map(require('../strategic-beast-ecology').BEAST_SPECIES.map(s => [s.id, s]));
  assert.equal(source.spatialContinuity, true); assert.equal(record.unlocated.length, 0);
  for (const g of source.groups) {
    const r = source.regions.find(r => r.id === g.regionId); assert.ok(S.usableHabitat(species.get(g.speciesId), r));
    const site = r.nurseries.find(n => n.id === g.breeding?.siteId);
    if (site) { assert.ok(site.capacity > 0); assert.equal(site.position.regionId, r.id); }
  }
  assert.ok(!record.physicalBinding.issues.some(i => ['unsupportedPhysicalNursery', 'unsupportedPhysicalWorkMedium'].includes(i.kind)));
  const before = clone(map), legacy = S.generate(record.seed, map, { physicalPlacement: false });
  assert.equal(legacy.physicalPlacement, undefined); assert.equal(legacy.physicalBinding.catchmentTransfers, undefined);
  assert.ok(S.validate(legacy, map)); assert.deepEqual(map, before);
  const prior = S.expand(legacy, map); assert.equal(prior.spatialContinuity, undefined);
  assert.ok(prior.regions.every(r => !r.source.catchmentPond));
});
test('a coarse seed without mapped warm wetlands retains all species using paid sub-hex catchments', () => {
  const world = L.createWorld({ id: 'pond-required', worldSeed: 'beast-catalog-first', generationVersion: 8, createdAt: 'test',
    creationSettings: { strategicMap: { refinementLevel: 2 } } });
  const map = world.generatedData.strategicMap, record = map.beastHabitatSources, original = JSON.stringify(world);
  const source = S.expand(record, map), populations = source.groups.filter(g => ['beast:mire-choir', 'beast:rivercoil', 'beast:marsh-hydra'].includes(g.speciesId));
  assert.equal(new Set(source.groups.map(g => g.speciesId)).size, 24); assert.equal(record.unlocated.length, 0);
  assert.ok(populations.some(g => source.regions.find(r => r.id === g.regionId).source.catchmentPond));
  assert.ok(record.physicalBinding.catchmentTransfers.length > 0); assert.ok(S.validate(record, map));
  assert.equal(L.normalizeWorld(world).canonicalDigest, world.canonicalDigest); assert.equal(JSON.stringify(world), original);
});
test('atmospheric and river rainfall shares are deducted from the same original catchment input', () => {
  for (const r of fixture().source.regions) for (const season of r.seasons) {
    const accounted = season.renewal.waterL + (season.renewal.atmosphericWaterL || 0)
      + (season.renewal.flowWaterL || 0) + season.photosyntheticWaterL;
    approx(accounted, r.source.rainfallLPerDay);
  }
});
test('marine medium is its original column volume, not freshwater; living reefs require original reef-shelf geography', () => {
  for (const r of fixture().source.regions.filter(r => r.kind === 'waterColumn')) {
    approx(r.stocks.seawaterL, r.areaHa * 10000 * r.depthM * 1000); assert.equal(r.stocks.waterL, 0);
    if (r.stocks.livingReefKg > 0) assert.equal(r.biome, 'h');
  }
});
test('work bindings retain original group identities, species, location, workforce and body counting basis', () => {
  const { source, record } = fixture(), regions = new Map(source.regions.map(r => [r.id, r]));
  for (const g of source.groups) if (g.ecology && g.ecology.action !== 'graze') {
    const r = regions.get(g.regionId), site = r.ecology.workSites.find(site => site.id === g.ecology.siteId);
    assert.equal(site.speciesId, g.speciesId); assert.equal(site.areaHa, r.areaHa);
    assert.ok(site.maxWorkers <= g.cohorts.reduce((n, c) => n + c.count, 0));
  }
  assert.ok(source.groups.some(g => g.speciesId === 'beast:thunderback-grazer' && g.ecology?.action === 'graze'));
  for (const p of record.populations) {
    const actual = source.groups.filter(g => g.populationId === p.populationId).reduce((n, g) => n + g.cohorts.reduce((v, c) => v + c.count, 0), 0);
    assert.equal(actual, p.locatedIndividualCount);
    if (p.originalIndividualCount != null) assert.equal(actual + p.unlocatedIndividualCount, p.originalIndividualCount);
  }
});
test('nurseries reserve shared finite receiving area and do not invent a mate, queen, offspring or parental fertility', () => {
  const { source } = fixture();
  const account = P.createDiagnostic(source, binding);
  for (const r of source.regions) {
    assert.ok(r.nurseries.reduce((n, site) => n + site.reservedAreaHa, 0) <= r.areaHa * .05 + 1e-7);
    for (const nursery of r.nurseries) assert.ok(nursery.capacity * nursery.slotAreaHa <= nursery.reservedAreaHa + 1e-7);
  }
  assert.ok(source.groups.every(g => g.speciesId.startsWith('beast:')));
  for (const g of source.groups) {
    const r = source.regions.find(r => r.id === g.regionId), site = r.nurseries.find(site => site.id === g.breeding?.siteId);
    if (site?.mateAccess) assert.ok(g.cohorts.some(c => c.role === 'male' && c.count > 0 && c.ageDays >= D.lifecycle[g.speciesId].fertileDays));
    for (const c of g.cohorts.filter(c => c.ageDays < D.lifecycle[c.speciesId].independentDays)) {
      assert.equal(c.nurseryId, site.id);
      assert.equal(account.groups.find(x => x.id === g.id).cohorts.find(x => x.id === c.id).nurseryId, site.id);
    }
  }
});
test('missing refined metal or original dream consent stays unavailable instead of being manufactured from potential', () => {
  const { source, record } = fixture();
  assert.ok(record.physicalBinding.issues.some(i => i.kind === 'unverifiedOriginalFurnaceMetal'));
  assert.ok(record.physicalBinding.issues.some(i => i.kind === 'unverifiedDreamParticipants'));
  assert.ok(source.groups.filter(g => g.speciesId === 'beast:dreaming-tortoise').every(g => !g.ecology && !g.activityState));
  for (const r of source.regions) assert.equal(r.stocks.metalKg, undefined);
  for (const r of source.regions) for (const n of r.nurseries.filter(n => n.speciesId === 'beast:ember-ant')) assert.equal(n.furnaceKg, 0);
});
test('real drainage bindings follow canonical adjacent outlets and partition rather than duplicate flow', () => {
  const { source, map } = fixture();
  for (const r of source.regions) for (const course of r.ecology.watercourses || []) {
    const down = source.regions.find(p => p.id === course.downstreamRegionId);
    assert.equal(W.cellIndex(down.cellId), map.hydrology.downstreamByCell[r.source.cellIndex]);
    assert.ok(r.edges.some(e => e.id === down.id)); assert.ok(r.stocks.flowWaterL > 0);
    assert.ok(course.flowPerDay > 0);
  }
});
test('large generated population streams reuse batched mortality without allocating per-body records or changing source counts', () => {
  const { source } = fixture(), s = P.createDiagnostic(source, binding), sizes = {};
  for (const g of source.groups) sizes[g.populationId] = (sizes[g.populationId] || 0) + g.cohorts.reduce((n, c) => n + c.count, 0);
  for (const g of s.groups) for (const c of g.cohorts) {
    assert.equal(P.count(c), source.groups.find(x => x.id === g.id).cohorts.find(x => x.id === c.id).count);
    if (sizes[g.populationId] > 128) assert.equal(c.aggregateMortality, true);
    else if (P.count(c) <= 128) assert.equal(c.aggregateMortality, undefined);
  }
  assert.deepEqual(s.unlocated, source.unlocated); assert.ok(P.normalize(s, binding));
});
test('re-signed inflated physical sites, materials or receiving capacity cannot validate against the original world', () => {
  const { record, map } = fixture();
  for (const change of [r => r.physicalBinding.transfers[0].amount *= 100,
    r => r.physicalBinding.nurseries[0].nursery.capacity += 100000,
    r => r.physicalBinding.workSites[0].site.maxWorkers *= 100]) {
    const altered = clone(record); change(altered); altered.id = ''; altered.id = `beast-habitat-source:${W.stableHash(altered)}`;
    assert.throws(() => S.validate(altered, map), /physical accounts/);
  }
});
test('archived sources without recorded bindings load unchanged and cannot silently acquire new sites or a diagnostic upgrade', () => {
  const { world, map: originalMap } = fixture(), old = clone(world);
  const archived = S.generate(world.worldSeed, originalMap, { physicalPlacement: false });
  delete archived.physicalBinding; archived.id = ''; archived.id = `beast-habitat-source:${W.stableHash(archived)}`;
  old.generatedData.strategicMap.beastHabitatSources = archived; delete old.canonicalDigest;
  const loaded = L.normalizeWorld(old), map = loaded.generatedData.strategicMap, before = JSON.stringify(loaded);
  assert.equal(map.beastHabitatSources.physicalBinding, undefined);
  assert.ok(S.expand(archived, map).regions.every(r => !r.ecology && !r.nurseries));
  assert.throws(() => S.replay(archived, map), /cannot silently upgrade/);
  L.normalizeWorld(loaded); assert.equal(JSON.stringify(loaded), before);
});
test('short actual generated-source execution records paid work/shortage and retains diagnostic ownership through saves and independent branches', () => {
  const { record, map, world } = fixture(), before = JSON.stringify(world);
  const first = S.replay(record, map, { binding, until: DAY / 8 });
  assert.equal(first.report.status, 'incomplete'); assert.equal(first.account.diagnosticOnly, true);
  assert.ok(Object.values(first.report.work).some(v => v > 0));
  assert.ok(first.report.work.graze > 0);
  assert.ok(first.account.regions.some(r => r.ecologicalAccount.destruction.renewableBiomass > 0));
  assert.equal(first.report.counts.background + first.report.counts.dead + first.report.counts.detailed, first.report.initialLocated + first.report.born);
  const continued = P.rebind(first.account, binding, { ...binding, runId: 'continued-replay' });
  const second = S.replay(record, map, { binding: { ...binding, runId: 'continued-replay' }, account: continued, until: DAY / 4 });
  const direct = S.replay(record, map, { binding, until: DAY / 4 });
  assert.deepEqual(second.report.counts, direct.report.counts); assert.equal(second.report.born, direct.report.born);
  for (const [key, n] of Object.entries(direct.report.work)) approx(n, second.report.work[key]);
  for (let i = 0; i < direct.account.regions.length; i++) for (const [key, n] of Object.entries(direct.account.regions[i].stocks)) approx(n, second.account.regions[i].stocks[key]);
  const fresh = S.replay(record, map, { binding: { ...binding, runId: 'fresh-replay' }, until: 0 });
  assert.equal(fresh.report.born, 0); assert.equal(fresh.report.counts.dead, 0); assert.deepEqual(fresh.report.work, {});
  assert.equal(JSON.stringify(world), before); assert.throws(() => S.runtimeSource(record, map), /Rejected/);
  assert.throws(() => S.replay(record, map, { binding, account: { ...first.account, diagnosticOnly: false }, until: DAY }), /original diagnostic/);
  const frozen = JSON.stringify(first.account); P.advance(first.account, DAY, false, true); assert.equal(JSON.stringify(first.account), frozen);
});
test('unresolved traditional habitat remains a blocked private journey, not an invented destination or an active source', () => {
  const src = clone(fixture().source), g = src.groups.find(g => g.instinct?.seasonal);
  g.instinct.seasonal.outboundRoute[1] = null;
  assert.throws(() => P.create(src, binding), /unaccepted/);
  const s = P.createDiagnostic(src, binding); assert.ok(P.normalize(s));
  const changed = clone(s); delete changed.diagnosticOnly; assert.equal(P.normalize(changed), null);
  assert.equal(s.groups.find(x => x.id === g.id).instinct.seasonal.outboundRoute[1], null);
});
