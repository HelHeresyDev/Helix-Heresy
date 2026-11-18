const test = require('node:test'), assert = require('node:assert/strict');
const result = require('../reference/integrated-seasonal-control.json');
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
