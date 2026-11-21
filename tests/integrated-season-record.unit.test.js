const test = require('node:test'), assert = require('node:assert/strict');
const result = require('../reference/integrated-seasonal-control.json');
const seasonal = require('../reference/seasonal-wind-integrated-control.json');
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b)), `${a} != ${b}`);
test('recorded integrated control covers the complete original roster and conserves each species through all checkpoints', () => {
  assert.equal(result.sourceId, 'beast-habitat-source:e8a02b1f'); assert.equal(result.runtimeKernelCommit, 'cb7383e');
  assert.equal(result.days, 120); assert.equal(result.regions, 334); assert.equal(result.populations, 89);
  assert.equal(result.original, 56243); assert.equal(result.coverage.species.length, 24);
  assert.equal(result.coverage.catalogRequired, true); assert.equal(result.coverage.until, result.coverage.cycleEnd);
  assert.equal(Object.keys(result.species).length, 24); assert.equal(result.reusableWorldIdenticalAcrossCheckpoints, true);
  assert.equal(result.original + result.born, result.counts.background + result.counts.detailed + result.counts.dead);
  for (const r of Object.values(result.species)) assert.equal(r.original + r.born, r.living + r.dead);
  assert.deepEqual(result.milestones.map(r => r.day), [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  for (const m of result.milestones) {
    assert.equal(m.original, 56243); assert.equal(m.original + m.born, m.living + m.dead);
    assert.equal(Object.keys(m.livingBySpecies).length, 24); assert.equal(m.receiptsReconciled, true);
  }
});
test('recorded species intake reconciles with performed receipts and never substitutes pooled feeding for Lantern meals', () => {
  const sum = key => Object.values(result.intakeAudit.bySpecies).reduce((n, r) => n + r[key], 0);
  assert.equal(result.intakeAudit.from, 0); assert.equal(result.intakeAudit.until, 120 * 86400);
  close(sum('foragedWetTissueKg'), result.foodWeb.foraging.eatenKg);
  close(sum('atmosphericWaterL'), result.atmosphericWaterTakenL);
  close(sum('careFoodDeliveredKg'), result.parentalCare.givenFoodKg);
  close(sum('careWaterDeliveredL'), result.parentalCare.givenWaterL);
  const lantern = result.intakeAudit.bySpecies['beast:carrion-lantern'];
  assert.equal(lantern.foragedWetTissueKg, 0); assert.equal(lantern.instantRemainsKg, 0);
  assert.equal(lantern.regionalFoodKg, 0); assert.equal(lantern.regionalWaterL, 0); assert.ok(lantern.atmosphericWaterL > 0);
  assert.ok(result.foodWeb.foraging.eatenKg > 0);
});
test('the integrated result retains actual feeding failures despite corrected habitat maintenance, without claiming adoption', () => {
  assert.equal(result.status, 'rejected'); assert.equal(result.measuredStatus, 'rejected');
  assert.ok(result.issueKinds.performedScarcityDeath > 0); assert.ok(result.issueKinds.performedResourceShortfall > 0);
  assert.equal(result.habitatFloorBreaches.length, 0); assert.equal(result.maintenanceDeficits.length, 0);
  assert.equal(result.floodErosionEP, 0); assert.equal(result.erodedWetlands, 0); assert.deepEqual(result.exhaustedRegions, []);
  assert.equal(result.species['beast:carrion-lantern'].living, 0); assert.equal(result.species['beast:carrion-lantern'].dead, 120);
  assert.equal(result.milestones.find(r => r.day === 80).livingBySpecies['beast:carrion-lantern'], 0);
  const dying = result.milestones.find(r => r.day === 70).lanternCondition;
  assert.equal(dying.storedFoodKg, 0); assert.equal(dying.storedFatKg, 0); assert.ok(dying.maximumLivingHealth < 1);
  assert.match(result.scope, /no balance tuning or native adoption/);
});
test('the seasonal-wind record preserves all original accounts and actual meals without claiming recovery', () => {
  const r = seasonal, id = 'beast:carrion-lantern', sum = key => Object.values(r.intakeAudit.bySpecies).reduce((n, row) => n + row[key], 0);
  assert.equal(r.seed, result.seed); assert.equal(r.refinement, result.refinement);
  assert.equal(r.original, result.original); assert.equal(r.regions, result.regions); assert.equal(r.populations, result.populations);
  assert.notEqual(r.sourceId, result.sourceId); assert.notEqual(r.canonicalWorldDigest, result.canonicalWorldDigest);
  assert.equal(r.coverage.until, r.coverage.cycleEnd); assert.equal(r.intakeAudit.until, 120 * 86400);
  assert.equal(r.reusableWorldIdenticalAcrossCheckpoints, true);
  assert.equal(r.original + r.born, r.counts.background + r.counts.detailed + r.counts.dead);
  assert.equal(Object.keys(r.species).length, 24);
  for (const bySpecies of Object.values(r.species)) assert.equal(bySpecies.original + bySpecies.born, bySpecies.living + bySpecies.dead);
  assert.deepEqual(r.milestones.map(m => m.day), result.milestones.map(m => m.day));
  assert.ok(r.milestones.every(m => m.receiptsReconciled && m.original + m.born === m.living + m.dead));
  close(sum('foragedWetTissueKg'), r.foodWeb.foraging.eatenKg);
  close(sum('atmosphericWaterL'), r.atmosphericWaterTakenL);
  const wetKg = day => r.milestones.find(m => m.day === day).lanternIntake.foragedWetTissueKg;
  assert.ok(wetKg(40) > wetKg(30)); assert.ok(wetKg(70) > wetKg(60));
  for (const day of [80, 90, 100, 110, 120]) close(wetKg(day), wetKg(70));
  close(wetKg(120), r.intakeAudit.bySpecies[id].foragedWetTissueKg);
  assert.deepEqual(r.species[id], { original: 120, born: 0, living: 1, dead: 119 });
  assert.deepEqual(r.lossesBySpecies[id], { background: 4, starvation: 96, dehydration: 19 });
  assert.equal(r.habitatFloorBreaches.length, 0); assert.equal(r.maintenanceDeficits.length, 0);
  assert.deepEqual(r.exhaustedRegions, []); assert.equal(r.foodWeb.contacts, 0);
  assert.equal(r.status, 'rejected'); assert.equal(r.measuredStatus, 'rejected');
});
