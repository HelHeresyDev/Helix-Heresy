const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), E = require('../beast-regional-ecology'), H = require('../beast-habitat');
const G = require('../beast-demography');
const { source, vector, run } = require('../scripts/benchmark-beast-regional-ecology');
const clone = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'world', runId: 'run' };
const approx = (a, b, eps = 1e-7) => assert.ok(Math.abs(a - b) < eps * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(change = () => {}) {
  const src = source(); change(src);
  const s = P.create(src, binding);
  // Isolate causal habitat damage from the separately tested stochastic death
  // clocks. This is a prepared workface, not a generated-world balance claim.
  for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  return s;
}
const field = s => s.regions[0], root = s => s.groups[0].cohorts[0];
function localRootFixture(change = () => {}) {
  return fixture(src => {
    src.regionalFoodWeb = true; src.nativeEncounters = true;
    for (const r of src.regions) { r.kind = 'surface'; r.floor = true; }
    change(src);
  });
}
const positionAt = regionId => ({ regionId, eastM: 20, northM: 20, altitudeM: 0 });
function claimRoot(s, g = s.groups[0], c = g.cohorts[0]) {
  const pos = positionAt(g.regionId), actorId = c.personalActor?.id || 'original-ironroot';
  const actor = P.claimLocal(s, g.id, c.id, 0, actorId, s.clock, { alive: true, local: true, tileSizeM: 1,
    terrain: () => ({ floor: true, oxygen: true, waterDepthM: 0, supportKg: 1e12 }),
    originalPosition: () => ({ regionId: pos.regionId, cell: { x: 20, y: 20, z: 0 }, altitudeM: 0, mode: 'walking' }),
    originalReserves: () => ({ mana: c.regional.mana, stamina: c.regional.stamina, energy: clone(c.regional.energy) }) });
  assert.ok(actor);
  actor.nativePopulation = { sourceId: s.sourceId, regionId: pos.regionId, sourcePosition: pos, siteId: 'root-site',
    frame: { eastM: 0, northM: 0 }, bounds: { x: 0, y: 0, z: 0, width: 100, height: 100 }, tileSizeM: 1, background: false };
  return actor;
}
function localDeath(s, actorId) {
  const a = s.details[actorId].actor;
  Object.assign(a, { health: 0, status: 'dead', diedAt: s.clock });
  assert.ok(P.settleLocalLoss(s, actorId, s.clock, 'physical-death'));
  return a;
}
test('source declarations require all six ledgers, original substrate, actual affected area and a supported action', () => {
  for (const change of [src => delete src.regions[0].condition.soilCover,
    src => src.regions[0].ecology.workSites[0].areaHa = 1,
    src => src.regions[0].stocks.watershedHabitatKg = 0,
    src => src.regions[0].ecology.renewalDependencies.mineralsKg = ['soilCover'],
    src => src.groups[0].ecology.action = 'createNewForest']) assert.throws(() => fixture(change));
  const src = source(), before = clone(src); P.create(src, binding); assert.deepEqual(src, before);
});
test('paid rooting uses the same physical recipe as a local body and maintenance is debited only once', () => {
  const s = fixture(), r = field(s), before = clone(r.stocks), spec = H.workSpec('rootStabilize');
  P.advance(s, DAY, true, true);
  approx(before.mineralsKg - r.stocks.mineralsKg, 1200 + spec.costs.mineralsKg);
  approx(r.outputs.rootedBiomassKg, spec.outputs.rootedBiomassKg);
  approx(r.outputs.atmosphericWaterL, spec.outputs.atmosphericWaterL);
  approx(r.activityReceipts.excessMana, 40); approx(r.activityReceipts.chargeMJ, 50);
  approx(r.ecologicalAccount.nurturing.soilCover, 40);
  approx(r.ecologicalAccount.destruction.soilCover, 8);
  approx(r.ecologicalAccount.nurturing.freshwaterQuantity, 0);
  approx(r.condition.soilCover, 83.2); assert.ok(P.normalize(s, binding));
});
test('shared time reduces growth and restoration together instead of allowing full simultaneous work', () => {
  const s = fixture(src => src.groups[0].cohorts[0].massKg = 282000), c = root(s);
  assert.ok(s.extraRates.some(q => q.kind === 'growth'));
  const work = s.extraRates.find(q => q.kind === 'ecology' && q.groupId === 'root');
  assert.ok(work.workPerDay > 0 && work.workPerDay <= .5);
  P.advance(s, DAY, true, true); assert.ok(c.structuralKg > 234000);
  assert.ok(field(s).outputs.rootedBiomassKg <= 75); assert.ok(P.normalize(s));
});
test('missing materials, missing living bed, unwillingness and missing work energy grant no restoration', () => {
  for (const change of [src => src.regions[0].stocks.mineralsKg = 0,
    src => src.regions[0].stocks.rootBedKg = 0,
    src => src.groups[0].willing = false,
    src => { src.regions[0].stocks.excessMana = 0; for (const season of src.regions[0].seasons) season.renewal.excessMana = 0; }]) {
    const s = fixture(change); P.advance(s, DAY, true, true);
    assert.equal(field(s).ecologicalAccount.nurturing.soilCover, 0);
    assert.equal(field(s).outputs.rootedBiomassKg || 0, 0);
    assert.equal(field(s).exhausted, false);
  }
});
test('work-site capacity is shared by actual cohorts and excess group count cannot multiply it', () => {
  const s = fixture(src => {
    const second = clone(src.groups[0]); second.id = 'second'; second.populationId = 'second'; second.cohorts[0].id = 'second-original'; src.groups.push(second);
  });
  P.advance(s, DAY, true, true); approx(field(s).outputs.rootedBiomassKg, 150);
  approx(field(s).ecologicalAccount.nurturing.soilCover, 40);
});
test('depletion interrupts only unpaid work and leaves no delayed full-day restoration credit', () => {
  const s = fixture(src => src.regions[0].stocks.mineralsKg = 660);
  P.advance(s, DAY / 4, true, true); approx(field(s).outputs.rootedBiomassKg, 37.5);
  const saved = P.normalize(s); assert.ok(saved);
  P.advance(s, DAY, true, true); P.advance(saved, DAY, true, true);
  approx(field(s).outputs.rootedBiomassKg, 75);
  approx(field(s).outputs.rootedBiomassKg, field(saved).outputs.rootedBiomassKg);
  approx(field(s).stocks.mineralsKg, 0); assert.ok(root(s).health < 1);
  const work = field(s).outputs.rootedBiomassKg; P.advance(s, 2 * DAY, true, true);
  approx(field(s).outputs.rootedBiomassKg, work);
});
test('feeding pressure stops when no compatible food is actually consumed, rather than debiting food twice', () => {
  const s = fixture(src => {
    src.groups = [src.groups[1]]; src.regions[0].stocks.forageKg = 0;
    for (const season of src.regions[0].seasons) season.renewal.forageKg = 0;
  });
  P.advance(s, DAY, true, true);
  assert.equal(field(s).ecologicalAccount.destruction.renewableBiomass, 0);
  assert.ok(s.groups[0].cohorts[0].stores.fatKg < 490);
});
test('a supplied workface withstands seasonal lows without inventing a healthy-world verdict', () => {
  const s = fixture(); P.advance(s, 120 * DAY, true, true);
  assert.equal(field(s).condition.soilCover, 100); assert.equal(field(s).exhausted, false);
  assert.ok(field(s).stocks.forageKg > 100000); assert.equal(s.losses.length, 0);
  assert.equal(field(s).ecologicalAccount.sourceLosses.length, 0);
  assert.ok(P.normalize(s));
});
test('an actual paid original nurturer loss causes accumulated decline, exhausted buffers and reduced food renewal', () => {
  const s = fixture(); P.advance(s, 10 * DAY, true, true);
  const before = field(s).condition.soilCover;
  assert.ok(P.kill(s, 'root', 'root-originals', 0, s.clock, 'original-tree-killed'));
  assert.equal(field(s).exhausted, false); assert.equal(field(s).condition.soilCover, before);
  P.advance(s, 110 * DAY, true, true);
  approx(field(s).condition.soilCover, before - 40); assert.equal(field(s).exhausted, false);
  assert.ok(s.rates.field.renewal.forageKg < 800);
  P.advance(s, 200 * DAY, true, true);
  assert.equal(field(s).exhausted, true);
  const a = field(s).ecologicalAccount; assert.equal(a.episodes.length, 1);
  assert.ok(a.episodes[0].exhaustedAt > a.sourceLosses[0].firstAt);
  assert.equal(a.sourceLosses[0].ref, 'root-originals:0'); assert.ok(a.sourceLosses[0].damageAfter.soilCover > 0);
  assert.equal(P.audit(s).root.dead, 1); assert.ok(P.normalize(s));
  assert.equal(a.sourceLosses[0].count, 1);
});
test('a paid original Ironroot killed locally causes the same later decline as its regional death', t => {
  const s = localRootFixture();
  P.advance(s, 10 * DAY, true, true);
  const work = root(s).ecologyHistory.field, cover = field(s).condition.soilCover;
  assert.ok(work > 0);
  const regional = P.normalize(s, binding);
  assert.ok(P.kill(regional, 'root', root(regional).id, 0, regional.clock, 'physical-death'));
  const a = claimRoot(s), member = a.life.originalMemberId;
  assert.deepEqual(s.details[a.id].returnCohort.ecologyHistory, { field: work });
  assert.equal(field(s).ecologicalAccount.sourceLosses.length, 0, 'a live handoff is not a loss');
  const forged = clone(s);
  forged.details[a.id].returnCohort.ecologyHistory['unvisited-region'] = work;
  assert.equal(P.normalize(forged, binding), null);
  const local = P.normalize(clone(s), binding); assert.ok(local);
  localDeath(local, a.id);
  assert.equal(field(local).condition.soilCover, cover);
  assert.equal(field(local).exhausted, false, 'death only records the lost contributor');
  const losses = account => field(account).ecologicalAccount.sourceLosses;
  assert.deepEqual(losses(local), losses(regional));
  assert.equal(losses(local)[0].ref, member);
  assert.equal(losses(local)[0].count, 1);

  const saved = P.normalize(clone(local), binding), body = saved.details[a.id].actor;
  assert.equal(P.settleLocalLoss(saved, a.id, saved.clock, 'physical-death'), false);
  assert.ok(P.releaseCorpse(saved, a.id, saved.clock, positionAt('field')));
  body.nativePopulation.background = true;
  const revisited = P.normalize(clone(saved), binding); assert.ok(revisited);
  assert.ok(P.claimCorpse(revisited, a.id, revisited.clock));
  assert.equal(P.settleLocalLoss(revisited, a.id, revisited.clock, 'physical-death'), false);
  assert.equal(revisited.losses.filter(l => l.memberId === member).length, 1);
  assert.equal(losses(revisited)[0].count, 1);

  for (const day of [110, 200]) {
    for (const account of [revisited, regional]) P.advance(account, day * DAY, true, true);
    assert.deepEqual(field(revisited).ecologicalAccount, field(regional).ecologicalAccount);
    assert.deepEqual(field(revisited).condition, field(regional).condition);
    assert.equal(revisited.rates.field.renewal.forageKg, regional.rates.field.renewal.forageKg);
  }
  const r = field(revisited), [{ exhaustedAt }] = r.ecologicalAccount.episodes;
  assert.ok(r.exhausted && exhaustedAt > 10 * DAY);
  assert.ok(r.ecologicalAccount.sourceLosses[0].damageAfter.soilCover > 0);
  assert.deepEqual(P.audit(revisited).root, { background: 0, detailed: 0, dead: 1 });
  assert.ok(P.normalize(revisited, binding));
  t.diagnostic(JSON.stringify({ diedDay: 10, exhaustedDay: exhaustedAt / DAY, soilBeforeLoss: cover, soilDay200: r.condition.soilCover }));
});
test('local deaths do not credit unworked regions or exhaust a workface without later pressure', () => {
  const inactive = localRootFixture(src => {
    src.groups[0].willing = false; src.regions[0].condition.soilCover = 31;
  });
  P.advance(inactive, DAY, true, true);
  localDeath(inactive, claimRoot(inactive).id);
  P.advance(inactive, 20 * DAY, true, true);
  assert.ok(field(inactive).condition.soilCover < 30);
  assert.equal(field(inactive).exhausted, false);
  assert.equal(field(inactive).ecologicalAccount.sourceLosses.length, 0);

  const elsewhere = localRootFixture();
  P.advance(elsewhere, 10 * DAY, true, true);
  const traveler = claimRoot(elsewhere);
  assert.ok(P.returnLocal(elsewhere, traveler.id, elsewhere.clock, positionAt('reserve')));
  const owner = elsewhere.groups.find(g => g.cohorts.some(c => c.personalActor?.id === traveler.id));
  const heir = owner.cohorts.find(c => c.personalActor?.id === traveler.id);
  assert.ok(heir.ecologyHistory.field > 0);
  assert.equal(heir.ecologyHistory.reserve, undefined);
  localDeath(elsewhere, claimRoot(elsewhere, owner, heir).id);
  assert.equal(elsewhere.losses.find(l => l.memberId === traveler.life.originalMemberId).regionId, 'reserve');
  assert.ok(elsewhere.regions.every(r => !r.ecologicalAccount.sourceLosses.length));
  assert.ok(P.normalize(elsewhere));

  const unpressured = localRootFixture(src => { src.groups = src.groups.filter(g => g.id !== 'herd'); });
  P.advance(unpressured, 10 * DAY, true, true);
  localDeath(unpressured, claimRoot(unpressured).id);
  P.advance(unpressured, 200 * DAY, true, true);
  assert.equal(field(unpressured).ecologicalAccount.sourceLosses.length, 1);
  assert.equal(field(unpressured).ecologicalAccount.sourceLosses[0].damageAfter.soilCover, 0);
  assert.equal(field(unpressured).exhausted, false);
  assert.ok(P.normalize(unpressured));
});
test('unperformed work and a loss in unrelated ledgers cannot certify exhausted soil', () => {
  const s = fixture(src => {
    src.groups[0].willing = false; src.regions[0].condition.soilCover = 31;
    src.regions[0].ecology.renewalSites[0].ledgerShares = { arcaneStability: 1 };
    src.regions[0].ecology.renewalSites[0].renewalShares = {};
    src.regions[0].ecology.naturalRenewalEP = { ...vector(0), arcaneStability: 5 };
  });
  P.advance(s, DAY, true, true);
  P.kill(s, 'root', 'root-originals', 0, s.clock, 'inactive-original-killed');
  assert.equal(field(s).ecologicalAccount.sourceLosses.length, 0);
  P.destroyRenewalSite(s, 'field', 'field-watershed', s.clock, 'original-arcane-source-lost');
  P.advance(s, 20 * DAY, true, true);
  assert.ok(field(s).condition.soilCover < 30); assert.equal(field(s).exhausted, false);
});
test('bad initial allocation, low natural terrain and shortage alone are not causal exhaustion', () => {
  const poor = fixture(src => { src.groups.shift(); src.regions[0].condition.soilCover = 31; });
  P.advance(poor, 30 * DAY, true, true); assert.ok(field(poor).condition.soilCover < 30);
  assert.equal(field(poor).exhausted, false); assert.equal(field(poor).ecologicalAccount.sourceLosses.length, 0);
  const dry = fixture(src => {
    src.groups = []; const r = src.regions[0]; r.condition = vector(0); r.ecology.referenceCondition = vector(0);
    r.ecology.viabilityFloors = {}; r.ecology.naturalRenewalEP = vector(0);
    for (const season of r.seasons) season.renewal = {};
  });
  P.advance(dry, 365 * DAY, true, true); assert.equal(field(dry).exhausted, false);
  assert.deepEqual(field(dry).condition, vector(0));
});
test('actual watershed destruction debits original material once, loses only its share and retains diverted water', () => {
  const s = fixture(); P.advance(s, DAY, true, true); const r = field(s), water = r.stocks.waterL;
  assert.ok(P.destroyRenewalSite(s, r.id, 'field-watershed', s.clock, 'watershed-burned'));
  assert.equal(r.stocks.watershedHabitatKg, 0); assert.equal(r.outputs['destroyedSite:watershedHabitatKg'], 100000);
  assert.equal(r.stocks.waterL, water); assert.equal(s.rates.field.renewal.waterL, 0);
  assert.equal(r.exhausted, false);
  assert.equal(P.destroyRenewalSite(s, r.id, 'field-watershed', s.clock, 'again'), false);
  P.advance(s, 2 * DAY, true, true); approx(r.outputs.unusableWaterL, 20000);
  assert.ok(P.normalize(s));
});
test('a destroyed actual water catchment causes discovered shortage, physical dispersal and possible death at an equally poor arrival', () => {
  const s = fixture(src => {
    src.groups = [src.groups[1]];
    src.calendar.monthDays = [2, 3, 2, 3];
    for (const r of src.regions) { r.stocks.waterL = r.capacity.waterL = 1600; }
    for (const season of src.regions[1].seasons) season.renewal.waterL = 0;
    src.regions[1].stocks.waterL = 0;
  });
  P.destroyRenewalSite(s, 'field', 'field-watershed', 0, 'catchment-collapsed');
  P.advance(s, 100 * DAY, true, true);
  assert.ok(s.events.some(e => e.kind === 'observedShortage'));
  assert.ok(s.events.some(e => e.kind === 'arrival' && e.regionId === 'reserve'));
  assert.ok(s.losses.some(l => l.cause === 'dehydration'));
  assert.equal(P.audit(s).herd.dead, 10); assert.ok(P.normalize(s));
});
test('all six condition channels are independent and EP cannot replenish ore, usable water or meat', () => {
  const s = fixture(src => {
    src.groups = []; const r = src.regions[0]; r.stocks.mineralsKg = 0; r.stocks.waterL = 0;
    r.ecology.naturalRenewalEP = { ...vector(0), arcaneStability: 5 };
    r.ecology.renewalSites[0].ledgerShares.arcaneStability = 1;
    for (const season of r.seasons) season.renewal = {};
  });
  P.advance(s, DAY, true, true); const r = field(s);
  approx(r.condition.arcaneStability, 80.5); approx(r.condition.soilCover, 80);
  assert.equal(r.stocks.waterL, 0); assert.equal(r.stocks.mineralsKg, 0); assert.equal(r.stocks.meatKg || 0, 0);
});
test('a surviving original must physically travel back and pay elapsed restoration before recovery', () => {
  const s = fixture(); P.advance(s, 10 * DAY, true, true);
  P.kill(s, 'root', 'root-originals', 0, s.clock, 'original-tree-killed');
  P.advance(s, 200 * DAY, true, true); assert.equal(field(s).exhausted, true);
  const returning = s.groups[2], before = field(s).condition.soilCover;
  // An explicit departure by this original body into its already known adjacent
  // workface uses the shared journey engine; no replacement or relocation flag.
  returning.intention = { destination: 'field', chosenAt: s.clock, departAt: s.clock + 1 };
  P.removeStock(s, 'reserve', 'waterL', 0, s.clock, 'original-return-departure');
  P.advance(s, 201 * DAY, true, true); assert.ok(returning.transit);
  assert.equal(field(s).ecologicalAccount.nurturing.soilCover, 400);
  assert.ok(field(s).condition.soilCover < before);
  P.advance(s, 205 * DAY, true, true); assert.equal(returning.regionId, 'field');
  assert.ok(s.events.some(e => e.kind === 'arrival' && e.groupId === returning.id));
  P.advance(s, 230 * DAY, true, true); assert.equal(field(s).exhausted, false);
  assert.ok(field(s).ecologicalAccount.episodes[0].recoveredAt > 202 * DAY);
  assert.equal(P.audit(s)['returning-root'].background, 1); assert.equal(s.births.length, 0);
  assert.ok(P.normalize(s));
});
test('partial elapsed work, chunking, cached monthly plans, reload, continued binding and final death preserve accounts', () => {
  const direct = fixture(), chunked = fixture(); P.advance(direct, 35.25 * DAY, true, true);
  for (let day = .25; day <= 35.25; day += .25) P.advance(chunked, day * DAY, true, true);
  for (const k of E.channels) approx(field(direct).condition[k], field(chunked).condition[k]);
  approx(field(direct).stocks.mineralsKg, field(chunked).stocks.mineralsKg);
  const saved = P.normalize(clone(chunked), binding); assert.ok(saved);
  const before = JSON.stringify(saved); P.advance(saved, saved.clock, true, true); assert.equal(JSON.stringify(saved), before);
  P.advance(direct, 60 * DAY, true, true); P.advance(saved, 60 * DAY, true, true);
  approx(field(direct).condition.soilCover, field(saved).condition.soilCover);
  const continued = P.rebind(saved, binding, { worldId: 'world', runId: 'continued' }); assert.ok(continued); assert.equal(continued.runId, 'continued');
  assert.equal(JSON.stringify(continued.regions), JSON.stringify(saved.regions));
  const frozen = JSON.stringify(saved); assert.equal(P.advance(saved, 120 * DAY, false, true), false); assert.equal(JSON.stringify(saved), frozen);
  const invalid = clone(saved); invalid.regions[0].ecologicalAccount.nurturing.soilCover = -1; assert.equal(P.normalize(invalid), null);
  const unsupported = clone(saved); unsupported.extraRates.find(q => q.kind === 'ecology').outputs.waterL = 1000000;
  assert.equal(P.normalize(unsupported), null);
  const fresh = fixture(); assert.equal(field(fresh).ecologicalAccount.nurturing.soilCover, 0);
});
test('detailing removes that original from background work without manufacturing a source death or a second ecological worker', () => {
  const s = fixture(); P.advance(s, DAY, true, true);
  assert.ok(P.detail(s, 'root', 'root-originals', 0, 'local-root', s.clock));
  P.advance(s, 3 * DAY, true, true); approx(field(s).ecologicalAccount.nurturing.soilCover, 40);
  assert.equal(field(s).ecologicalAccount.sourceLosses.length, 0);
});
test('compaction cannot lend paid contributor provenance to an original that never worked there', () => {
  const s = fixture(src => src.groups[0].cohorts[0].count = 2), c = root(s), other = clone(c);
  c.generated = other.generated = true; c.ranges = [[0, 1]]; other.ranges = [[1, 2]]; other.id = 'same-stream-unworked';
  c.ecologyHistory = { field: 1 }; s.groups[0].cohorts.push(other);
  G.compact(s.groups[0], DAY); assert.equal(s.groups[0].cohorts.length, 2);
  assert.equal(s.groups[0].cohorts[1].ecologyHistory, undefined);
  other.ecologyHistory = { field: 3 };
  G.compact(s.groups[0], DAY); assert.equal(s.groups[0].cohorts.length, 1);
  approx(root(s).ecologyHistory.field, 2); assert.equal(P.audit(s).root.background, 2);
});
test('million-body ecology stays cohort-batched with pooled original source loss records', () => {
  const small = run(1000, 40), large = run(100000, 40);
  assert.equal(large.initialBodies, 1200000); assert.ok(large.cohorts <= 3);
  assert.ok(large.cohortIntervals < small.cohortIntervals * 3);
  assert.ok(large.serializedBytes < 70000); assert.ok(large.sourceLossRecords <= 3);
});
