const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../beast-populations'), F = require('../beast-foraging'), Care = require('../beast-parental-care');
const Intake = require('../scripts/replay-intake-audit');
const { source } = require('./helpers/sustenance-source'), { familySource } = require('./helpers/beast-care-sources');
const { windSource } = require('./helpers/wind-source');
const binding = { worldId: 'intake-observer', runId: 'private' }, copy = x => JSON.parse(JSON.stringify(x));
const approx = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function execute(src, days) {
  const observed = P.create(copy(src), binding), ordinary = P.create(copy(src), binding), original = F.integrate;
  const observer = Intake.observe(observed); let audit;
  try { P.advance(observed, days * P.DAY, true, true); audit = observer.snapshot(); }
  finally { observer.stop(); }
  assert.equal(F.integrate, original);
  P.advance(ordinary, days * P.DAY, true, true);
  assert.deepEqual(copy(observed), copy(ordinary), 'observation must not alter any game-account field');
  assert.ok(P.normalize(observed)); return { s: observed, audit };
}
test('private observer attributes actual ingested prey and regional drinking without changing the simulation', () => {
  const { s, audit } = execute(source(), 20), row = audit.bySpecies['beast:rimefang-pack'];
  assert.ok(row.foragedWetTissueKg > 0); approx(row.foragedWetTissueKg, F.summary(s).eatenKg);
  approx(row.foragedFoodEquivalentKg, row.foragedWetTissueKg);
  assert.ok(row.regionalWaterL > 0); assert.equal(row.regionalFoodKg, 0);
  assert.equal(row.atmosphericWaterL, 0); assert.equal(audit.unattributedInstantRemainsKg, 0);
});
test('private observer separates actual delivered family rations from direct adult intake', () => {
  const { s, audit } = execute(familySource(), 2), row = audit.bySpecies['beast:rimefang-pack'], care = Care.summary(s);
  assert.ok(row.careFoodDeliveredKg > 0); approx(row.careFoodDeliveredKg, care.givenFoodKg);
  approx(row.careWaterDeliveredL, care.givenWaterL); assert.ok(row.regionalFoodKg > 0);
});
test('Lantern atmospheric uptake is actual paid water, never reported as remote drinking or food', () => {
  const src = windSource({ members: 2, cohorts: 1, wind: { x: .5, y: 0 }, preyX: 100000 });
  src.groups = src.groups.slice(0, 1); const r = src.regions[0]; r.humidity = 70;
  r.seasons.forEach(s => { s.humidity = 70; }); r.stocks.atmosphericWaterL = r.capacity.atmosphericWaterL = 100;
  const { s, audit } = execute(src, 10), row = audit.bySpecies['beast:carrion-lantern'];
  approx(row.atmosphericWaterL, s.regions.reduce((n, r) => n + (r.airMoistureTakenL || 0), 0));
  assert.ok(row.atmosphericWaterL > 0); assert.equal(row.regionalWaterL, 0);
  assert.equal(row.foragedWetTissueKg, 0); assert.equal(row.foragedFoodEquivalentKg, 0);
});
test('a genuinely feeding Lantern registers wet tissue, food-equivalent and carrion water rather than a false zero', () => {
  const s = P.create(windSource({ preyX: 20, wind: { x: 0, y: .2 }, members: 1, cohorts: 1 }), binding);
  P.kill(s, s.groups[1].id, s.groups[1].cohorts[0].id, 0, 0, 'prepared-original-carcass');
  const observer = Intake.observe(s); let audit;
  try { P.advance(s, 250, true, true); audit = observer.snapshot(); } finally { observer.stop(); }
  const row = audit.bySpecies['beast:carrion-lantern'];
  assert.ok(row.foragedWetTissueKg > 0); approx(row.foragedWetTissueKg, F.summary(s).eatenKg);
  assert.ok(row.foragedFoodEquivalentKg > 0); assert.ok(row.foragedCarrionWaterL > 0);
  assert.equal(row.regionalWaterL, 0); assert.ok(P.normalize(s));
});
test('audit resumption requires this exact source/time and reports missing older history without reconstruction', () => {
  const s = P.create(source(), binding), observer = Intake.observe(s);
  P.advance(s, P.DAY, true, true); const audit = observer.snapshot(); observer.stop();
  const original = F.integrate;
  for (const change of [a => a.sourceId += ':wrong', a => a.until++, a => a.bySpecies['beast:rimefang-pack'].regionalWaterL = -1]) {
    const bad = copy(audit); change(bad); assert.throws(() => Intake.observe(s, bad), /exact checkpoint/);
  }
  assert.equal(F.integrate, original);
  const fresh = Intake.observe(s); const newAudit = fresh.snapshot(); fresh.stop();
  assert.equal(newAudit.from, P.DAY); assert.equal(newAudit.bySpecies['beast:rimefang-pack'].regionalWaterL, 0);
});
