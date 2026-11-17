const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-regional-flood');
const { source } = require('./helpers/drainage-source');
const copy = x => JSON.parse(JSON.stringify(x)), DAY = P.DAY, binding = { worldId: 'flood-world', runId: 'run' };
const approx = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function fixture(options, change = () => {}) { const src = source(options); change(src); return P.create(src, binding); }
const water = s => s.regions.reduce((n, r) => n + (r.stocks.waterL || 0) + (r.stocks.flowWaterL || 0)
  + (r.flood?.waterL || 0) + (r.outputs?.waterLOverflow || 0) + (r.outputs?.flowWaterLOverflow || 0), 0);
test('ordinary full-bank drainage passes real water once without flooding or erosion', () => {
  const s = fixture({ rain: 5000, outlet: 8000 }), before = water(s);
  P.advance(s, 10 * DAY, true, true);
  approx(water(s) - before, 50000); approx(s.regions[0].flood.bankDischargedL, 50000);
  approx(s.regions[1].outputs.waterLOverflow, 50000);
  approx(s.regions[0].flood.waterL, 0); approx(s.regions[0].condition.soilCover, 80); assert.ok(P.normalize(s));
});
test('finite capacity stores excessive water, charges its depth once, and never creates a second downstream copy', () => {
  const s = fixture({}), before = water(s); P.advance(s, DAY, true, true);
  approx(s.regions[0].flood.waterL, 4000); approx(s.regions[1].outputs.waterLOverflow, 8000);
  approx(s.regions[0].flood.erosionEP, .004); approx(s.regions[0].condition.soilCover, 79.996);
  approx(water(s) - before, 12000); assert.ok(P.normalize(s));
});
test('equal volumes over twice the area cause half the condition loss; equal depths cause equal loss', () => {
  const small = fixture({ outlet: null }), large = fixture({ outlet: null, areaHa: 2 }), equalDepth = fixture({ outlet: null, areaHa: 2, rain: 24000 });
  for (const s of [small, large, equalDepth]) P.advance(s, DAY, true, true);
  approx(80 - small.regions[0].condition.soilCover, 2 * (80 - large.regions[0].condition.soilCover));
  approx(small.regions[0].condition.soilCover, equalDepth.regions[0].condition.soilCover);
  approx(small.regions[0].flood.waterL, large.regions[0].flood.waterL);
});
test('closed basins receive no invented outlet and only damage above the explicit shallow-water buffer', () => {
  const s = fixture({ outlet: null, rain: 10000, safeDepthMm: 1 }), before = water(s);
  P.advance(s, DAY / 2, true, true); approx(s.regions[0].flood.waterL, 5000); approx(s.regions[0].condition.soilCover, 80);
  const saved = P.normalize(s); assert.ok(saved);
  P.advance(s, 2 * DAY, true, true); P.advance(saved, 2 * DAY, true, true);
  approx(s.regions[0].flood.waterL, 20000); approx(s.regions[0].condition.soilCover, 79.99);
  approx(water(s) - before, 20000); assert.deepEqual(s.regions, saved.regions); assert.ok(P.normalize(s));
});
test('a chain of outlets transfers the same water once and every downstream capacity remains finite', () => {
  const s = fixture({ middle: true }), before = water(s); P.advance(s, DAY, true, true);
  approx(s.regions[0].flood.waterL, 4000); approx(s.regions[1].flood.waterL, 0);
  approx(s.regions[1].flood.bankDischargedL, 8000); approx(s.regions[2].outputs.waterLOverflow, 8000);
  approx(water(s) - before, 12000); assert.ok(P.normalize(s));
});
test('river flow and bank excess share one original outlet capacity; blocked river water remains conserved', () => {
  const s = fixture({ river: 1000, outlet: 800, rain: 1200 }), before = water(s); P.advance(s, DAY, true, true);
  approx(s.regions[0].watercourseReceipts.passedL, 800);
  approx(s.regions[0].flood.riverBlockedL, 200); approx(s.regions[0].flood.waterL, 1400);
  approx(s.regions[1].outputs.waterLOverflow, 800); approx(water(s) - before, 1200); assert.ok(P.normalize(s));
});
test('original bank headroom fills before any bank discharge or overbank damage', () => {
  const s = fixture({ rain: 10000, outlet: 15000 }, src => { src.regions[0].stocks.waterL -= 5000; });
  const before = water(s); P.advance(s, DAY / 4, true, true);
  approx(s.regions[0].flood.bankDischargedL, 0); assert.equal(s.regions[1].outputs?.waterLOverflow || 0, 0);
  P.advance(s, DAY, true, true); approx(s.regions[0].flood.bankDischargedL, 5000);
  approx(water(s) - before, 10000); approx(s.regions[0].flood.waterL, 0); assert.ok(P.normalize(s));
});
test('real obstruction stops future discharge; reopening drains stored floodwater at finite elapsed rates', () => {
  const s = fixture({ rain: 5000, outlet: 10000 });
  assert.ok(P.setDrainageObstruction(s, 'upstream', true, 0, 'actual-landslide'));
  P.advance(s, DAY, true, true); approx(s.regions[0].flood.waterL, 5000);
  assert.ok(P.setDrainageObstruction(s, 'upstream', false, s.clock, 'actual-clearance'));
  const branch = P.rebind(P.normalize(s), binding, { ...binding, runId: 'continued' });
  P.advance(s, 1.5 * DAY, true, true); P.advance(branch, 1.5 * DAY, true, true);
  approx(s.regions[0].flood.waterL, 2500); approx(s.regions[0].flood.dischargedL, 5000);
  P.advance(s, 3 * DAY, true, true); P.advance(branch, 3 * DAY, true, true);
  approx(s.regions[0].flood.waterL, 0); approx(s.regions[0].flood.dischargedL, 10000);
  assert.deepEqual(s.regions, branch.regions); assert.ok(P.normalize(s));
});
test('legacy flow-only courses do not acquire imaginary unlimited bank drainage', () => {
  const s = fixture({ river: 1000 }, src => { delete src.regions[0].ecology.watercourses[0].outlet; });
  P.advance(s, DAY, true, true); approx(s.regions[0].flood.waterL, 12000);
  approx(s.regions[0].watercourseReceipts.passedL, 1000); approx(s.regions[0].flood.bankDischargedL, 0);
});
test('an explicit original flood inventory is preserved and can discharge only its actual finite water', () => {
  const s = fixture({ rain: 0, outlet: 10000 }, src => {
    src.regions[0].flood = { startedAt: 0, waterL: 5000, receivedL: 5000, dischargedL: 0,
      bankDischargedL: 0, riverBlockedL: 0, breachReceivedL: 0, erosionEP: 0 };
  });
  approx(s.regions[0].flood.waterL, 5000); const before = water(s);
  P.advance(s, DAY, true, true); approx(s.regions[0].flood.waterL, 0);
  approx(s.regions[1].outputs.waterLOverflow, 5000); approx(water(s), before); assert.ok(P.normalize(s));
});
test('malformed geometry, forged inventories and inflated cached capacity cannot normalize', () => {
  for (const change of [r => { r.ecology.watercourses[0].outlet.widthM = Infinity; },
    r => { r.ecology.watercourses[0].outlet.depthM = 100; }, r => { r.ecology.floodplain.areaHa = 100; },
    r => { r.ecology.watercourses[0].outlet.widthM = '1'; }])
    assert.throws(() => fixture({}, src => change(src.regions[0])));
  const s = fixture({}); P.advance(s, DAY / 2, true, true);
  for (const change of [s => { s.regions[0].flood.waterL++; }, s => { s.rates.upstream.drainage.capacityLDay *= 2; },
    s => { s.rates.upstream.drainage.bankDrainLDay *= 2; }, s => { s.regions[0].flood.startedAt = s.clock + DAY; },
    s => { delete s.regions[0].flood; delete s.rates.upstream.drainage; }]) {
    const bad = copy(s); change(bad); assert.equal(P.normalize(bad), null);
  }
  assert.ok(F.capacity(s.regions[0].ecology.watercourses[0]) > 0);
  const dry = fixture({ rain: 0, outlet: 8000 }), d = dry.rates.upstream.drainage;
  d.floodDrainLDay = 8000; d.floodNetLDay = -8000;
  assert.equal(P.normalize(dry), null, 'an empty flood ledger cannot supply a forged cached discharge');
});
