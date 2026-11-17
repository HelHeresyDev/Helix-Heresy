const test = require('node:test'), assert = require('node:assert/strict');
const S = require('../beast-habitat-sources'), P = require('../beast-populations'), E = require('../beast-regional-ecology');
const { source } = require('../scripts/benchmark-beast-regional-ecology');
const { source: foragers } = require('./helpers/sustenance-source');
const copy = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'control', runId: 'measured' };
const approx = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(change = () => {}) {
  const src = source(); change(src); const s = P.create(src, binding);
  for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  return { src, s };
}
const result = (src, s, extra = {}) => S.assess(src, null, { account: s, binding, ...extra });
test('a preliminary estimate cannot become a measured pass or alter originals', () => {
  const { src } = fixture(), before = JSON.stringify(src), report = S.assess(src, null);
  assert.equal(report.stage, 'preliminary'); assert.equal(report.status, 'unverified');
  assert.equal(JSON.stringify(src), before);
});
test('supplied original workers and measured nurturing sustain a complete seasonal interval', () => {
  const { src, s } = fixture(), original = JSON.stringify(src);
  P.advance(s, 120 * DAY, true, true);
  const saved = JSON.stringify(s), report = result(src, s);
  assert.equal(report.status, 'supported'); assert.deepEqual(report.issues, []);
  const field = report.ecology.find(r => r.regionId === 'field');
  approx(field.nurturing.soilCover, 4800); assert.ok(field.balanceEP.soilCover > 0);
  assert.equal(report.coverage.originalLocated, 12); assert.equal(report.coverage.until, 120 * DAY);
  assert.equal(JSON.stringify(s), saved); assert.equal(JSON.stringify(src), original);
  assert.equal(result(src, s, { requireCatalog: true }).status, 'rejected', 'a small control cannot stand for all 24 species');
});
test('temporary seasonal drawdown can be supplied by later performed work without crossing viable floors', () => {
  const { src, s } = fixture(src => { src.groups[0].activityState = { sleeping: true, dreamConsent: false }; });
  P.advance(s, 29 * DAY, true, true);
  assert.ok(P.setEcologicalActivity(s, 'root', { sleeping: false, dreamConsent: false }, s.clock, 'awake'));
  P.advance(s, 120 * DAY, true, true);
  assert.equal(result(src, s).status, 'supported');
  approx(s.regions[0].ecologicalAccount.viabilityHistory.minimumCondition.soilCover, 68.4);
});
test('unperformed potential work cannot cover actual destructive pressure or silently declare exhaustion', () => {
  const { src, s } = fixture(src => { src.groups[0].willing = false; });
  P.advance(s, 120 * DAY, true, true);
  const report = result(src, s); assert.equal(report.status, 'rejected');
  assert.ok(report.issues.some(i => i.kind === 'performedMaintenanceDeficit' && i.channel === 'soilCover'));
  assert.equal(report.issues.some(i => i.kind === 'performedHabitatFloorBreach'), false, 'a negative cycle can fail maintenance before crossing a floor');
  assert.equal(s.regions[0].ecologicalAccount.nurturing.soilCover, 0);
  assert.equal(s.regions[0].exhausted, false);
  const missingCycleDetail = copy(s); missingCycleDetail.regions[0].ecologicalAccount.viabilityHistory.maintenanceFailures = {};
  assert.equal(result(src, missingCycleDetail).status, 'rejected', 'an observed negative aggregate cannot turn into support when cycle details are missing');
});
test('later restoration cannot erase an earlier actual floor breach', () => {
  const { src, s } = fixture(src => {
    src.groups[0].activityState = { sleeping: true, dreamConsent: false }; src.groups[1].cohorts[0].count = 20;
  });
  P.advance(s, 70 * DAY, true, true);
  approx(s.regions[0].condition.soilCover, 24);
  P.setEcologicalActivity(s, 'root', { sleeping: false, dreamConsent: false }, s.clock, 'restorer-awoke');
  const saved = P.normalize(s); assert.ok(saved);
  P.advance(s, 120 * DAY, true, true); P.advance(saved, 120 * DAY, true, true);
  assert.equal(s.regions[0].condition.soilCover, 100);
  const report = result(src, s), breach = report.issues.find(i => i.kind === 'performedHabitatFloorBreach');
  assert.equal(report.status, 'rejected'); approx(breach.firstAt, 62.5 * DAY); approx(breach.minimum, 24);
  assert.deepEqual(report, result(src, saved)); assert.equal(s.regions[0].exhausted, false);
});
test('later good cycles cannot average away an earlier completed-cycle maintenance deficit', () => {
  const { src, s } = fixture(src => {
    src.groups[0].activityState = { sleeping: true, dreamConsent: false }; src.groups[1].cohorts[0].count = 1;
  });
  P.advance(s, 120 * DAY, true, true);
  assert.ok(s.regions[0].condition.soilCover > 30);
  P.setEcologicalActivity(s, 'root', { sleeping: false, dreamConsent: false }, s.clock, 'later-restoration');
  P.advance(s, 240 * DAY, true, true);
  const report = result(src, s), failure = report.issues.find(i => i.kind === 'performedMaintenanceDeficit');
  assert.equal(report.status, 'rejected'); assert.equal(failure.cycles, 1); approx(failure.firstAt, 120 * DAY);
  assert.ok(report.ecology[0].balanceEP.soilCover > 0);
});
test('elapsed food scarcity is rejected even if later reserves would be adequate', () => {
  const { src, s } = fixture(src => {
    for (const r of src.regions) { r.stocks.forageKg = 0; r.seasons.forEach(s => { s.renewal.forageKg = 0; }); }
  });
  P.advance(s, 120 * DAY, true, true);
  const report = result(src, s);
  assert.equal(report.status, 'rejected'); assert.ok(report.issues.some(i => i.kind === 'performedResourceShortfall'));
  assert.ok(report.firstFailures.length > 0);
  assert.ok(report.firstFailures.every(f => f.inventory && f.inventory.snapshotAt >= f.at));
  assert.ok(report.firstFailures.some(f => f.supplyEvidence === 'no-recorded-regional-stock-at-first-shortfall'));
  assert.ok(report.ecology.every(r => r.exhausted === false));
});
function hunting(change = () => {}) {
  const src = foragers({ members: 1, cohorts: 1 });
  const r = src.regions[0]; r.condition = Object.fromEntries(E.channels.map(k => [k, 80]));
  r.ecology = { referenceCondition: copy(r.condition), viabilityFloors: { renewableBiomass: 30 },
    naturalRenewalEP: Object.fromEntries(E.channels.map(k => [k, 0])), renewalDependencies: {}, workSites: [], renewalSites: [] };
  change(src); const s = P.create(src, binding);
  for (const g of s.groups) for (const c of g.cohorts) c.deathThreshold = 1e12;
  return { src, s };
}
test('actual background-prey ingestion can pass with permanently empty generic meat stock', () => {
  const { src, s } = hunting(); P.advance(s, 120 * DAY, true, true);
  const report = result(src, s);
  assert.equal(s.regions[0].stocks.meatKg, 0); assert.ok(P.foodWebSummary(s).foraging.eatenKg > 0);
  assert.equal(report.status, 'supported'); assert.deepEqual(report.issues, []);
});
test('regional animal matter is not treated as an accessible meal for a blocked hunter', () => {
  const { src, s } = hunting(src => { src.regions[0].contactBarriers = [{ minEastM: -100, maxEastM: 100,
    minNorthM: -100, maxNorthM: 100, bottomM: -100, topM: 100 }]; });
  P.advance(s, 40 * DAY, true, true);
  const report = result(src, s); assert.equal(report.status, 'rejected');
  assert.ok(report.firstFailures.some(f => f.inventory.regionalAnimalMatterKg > 0
    && f.supplyEvidence === 'regional-matter-present-access-or-compatibility-unresolved'));
  assert.ok(report.issues.some(i => i.kind === 'performedScarcityDeath'));
  assert.equal(P.foodWebSummary(s).foraging.eatenKg, 0);
});
test('partial execution, absent historical minima and changed source scope cannot certify support', () => {
  const { src, s } = fixture(); P.advance(s, 60 * DAY, true, true);
  assert.equal(result(src, s).status, 'incomplete');
  const partial = P.normalize(s); assert.ok(partial);
  P.advance(s, 120 * DAY, true, true);
  const legacy = copy(s); for (const r of legacy.regions) delete r.ecologicalAccount.viabilityHistory;
  assert.ok(P.normalize(legacy)); assert.equal(result(src, legacy).status, 'unverified');
  const changed = copy(src); changed.groups[1].cohorts[0].count++;
  assert.ok(result(changed, s).issues.some(i => i.kind === 'measuredSourceScopeMismatch'));
  assert.ok(result(src, { ...s, runId: 'another-run' }).issues.some(i => i.kind === 'invalidMeasuredAccount'));
  const futureStart = P.create(src, binding, DAY); P.advance(futureStart, 120 * DAY, true, true);
  assert.notEqual(result(src, futureStart).status, 'supported');
  const fresh = P.create(src, { ...binding, runId: 'independent' }); assert.equal(fresh.clock, 0);
  assert.equal(S.assess(src, null, { account: fresh }).status, 'incomplete');
});
test('malformed or future-dated habitat and scarcity history is rejected on import', () => {
  const { s } = fixture(); P.advance(s, DAY, true, true);
  for (const change of [s => { s.regions[0].ecologicalAccount.viabilityHistory.minimumCondition.soilCover = -1; },
    s => { s.regions[0].ecologicalAccount.viabilityHistory.startedAt = 2 * DAY; },
    s => { s.regions[0].ecologicalAccount.viabilityHistory.completedCycles = 4; },
    s => { s.regions[0].ecologicalAccount.viabilityHistory.floorBreaches.soilCover = { firstAt: DAY, belowDays: 2 }; }]) {
    const bad = copy(s); change(bad); assert.equal(P.normalize(bad), null);
  }
});
