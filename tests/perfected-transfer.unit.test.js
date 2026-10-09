const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../soul-beacons');
const E = require('../embodied-skills');
const Research = require('../research-system');
const context = () => ({ local: true, animancy: 201, medicine: 201, alchemy: 201, fabrication: 151, perfectedResearch: true,
  integration: true, siteIntact: true, siteControlled: true, space: true, paired: true, services: true, upkeep: true, condition: 100,
  destination: { roomId: 'lab', cell: { x: 1, y: 1, z: 0 } } });
function pair() {
  const s = S.create();
  const r = { id: 'actual-receiver', chamberId: 'chamber', status: 'ready', health: 100, soulId: null, soulFormationPrevented: true, donorSoulId: s.soul.id };
  const b = { id: 'actual-beacon', fixtureId: 'fixture', chamberId: r.chamberId, status: 'charged', charge: 24, armed: false, label: 'Lab', location: { roomId: 'lab' } };
  s.receivers.push(r); s.beacons.push(b); return { s, r, b };
}
function perfect(f) {
  assert.equal(S.preparePerfected(f.s, f.b.id, f.r.id, context(), 10).ok, true);
  assert.equal(S.validatePerfected(f.s, f.b.id, context(), 20).ok, true);
  assert.equal(S.arm(f.s, f.b.id, f.r.id, context(), 30).ok, true);
}
test('advanced evidence-backed projects cite actual tests and do not grant an upgraded apparatus', () => {
  const r = Research.defaultState();
  for (const id of ['soulTransferIntegration', 'receivingBodyDevelopment']) r.projects[id].status = 'completed';
  assert.equal(Research.projectEvaluation('memoryContinuityPreservation', r).evidenceMet, false);
  assert.deepEqual(Research.PROJECT_BY_ID.memoryContinuityPreservation.minimumSkills, { animancy: 201, medicine: 201, alchemy: 201, fabrication: 151 });
  assert.deepEqual(Research.PROJECT_BY_ID.receivingNeuralIntegration.prerequisites, ['memoryContinuityPreservation', 'receivingBodyDevelopment']);
  const f = pair(); assert.equal(f.b.memoryTier, undefined); assert.equal(S.validatePerfected(f.s, f.b.id, context(), 0).ok, false);
});
test('actual high-skill local controlled supplied preparation is required before validation', () => {
  for (const change of [{ dead: true }, { local: false }, { suppressed: true }, { animancy: 200 }, { medicine: 200 }, { alchemy: 200 }, { fabrication: 150 },
    { perfectedResearch: false }, { condition: 89 }, { services: false }, { upkeep: false }, { siteControlled: false }, { paired: false }, { space: false }]) {
    const f = pair(); assert.equal(S.preparePerfected(f.s, f.b.id, f.r.id, { ...context(), ...change }, 10).ok, false, JSON.stringify(change));
    assert.equal(f.b.preparation, undefined);
  }
  const f = pair(); f.b.armed = true; assert.equal(S.preparePerfected(f.s, f.b.id, f.r.id, context(), 10).ok, false);
});
test('no souled person, foreign donor, unhealthy body or substitute apparatus can become a perfected pair', () => {
  for (const change of [{ soulId: 'homunculus-soul' }, { donorSoulId: 'other-soul' }, { soulFormationPrevented: false }, { health: 89 }, { status: 'growing' }]) {
    const f = pair(); Object.assign(f.r, change); assert.equal(S.preparePerfected(f.s, f.b.id, f.r.id, context(), 1).ok, false);
  }
  const f = pair(); S.preparePerfected(f.s, f.b.id, f.r.id, context(), 10); f.b.fixtureId = 'substitute';
  assert.equal(S.validatePerfected(f.s, f.b.id, context(), 20).ok, false);
});
test('a validated perfected handoff saves the selected exact pairing and consumes it exactly once', () => {
  const f = pair(); perfect(f);
  assert.equal(S.choices(f.s, context)[0].memoryTier, 'perfected');
  S.prepareHandoff(f.s, 'death', 40, context); S.select(f.s, 'death', f.b.id);
  const saved = S.normalize(JSON.parse(JSON.stringify(f.s)));
  const result = S.recover(saved, 'death', 40, context);
  assert.equal(result.ok, true); assert.equal(result.receipt.memoryTier, 'perfected'); assert.equal(saved.soul.integrity, 100);
  assert.equal(saved.receivers[0].soulId, saved.soul.id); assert.equal(saved.beacons[0].charge, 0);
  assert.equal(S.recover(saved, 'death', 40, context).ok, false); assert.equal(saved.transfers.length, 1);
});
test('perfected revalidation never silently falls back to an imperfect transfer', () => {
  for (const change of [{ condition: 89 }, { services: false }, { upkeep: false }, { siteControlled: false }]) {
    const f = pair(); perfect(f); S.prepareHandoff(f.s, 'death', 40, context); S.select(f.s, 'death', f.b.id);
    assert.equal(S.recover(f.s, 'death', 40, () => ({ ...context(), ...change })).ok, false);
    assert.equal(f.b.charge, 24); assert.equal(f.r.soulId, null); assert.equal(f.s.transfers.length, 0);
  }
  const f = pair(); perfect(f); f.b.preparation.receiverId = 'different-body'; assert.match(S.eligibility(f.s, f.b, context()), /exact validated/);
});
test('perfected transfer neither heals soul wounds nor bypasses the surviving-soul threshold', () => {
  const f = pair(); perfect(f); S.damageSoul(f.s, 25, 'Soul-affecting wound', 31, 'wound');
  S.prepareHandoff(f.s, 'death', 40, context); S.select(f.s, 'death', f.b.id); assert.equal(S.recover(f.s, 'death', 40, context).receipt.soulIntegrity, 75);
  for (const damage of [26, 100]) { const g = pair(); perfect(g); S.damageSoul(g.s, damage, 'Explicit soul wound', 31, 'wound'); assert.equal(S.choices(g.s, context).length, 0); }
});
test('a new charging cycle cannot inherit the consumed receiver validation', () => {
  const f = pair(); perfect(f); S.prepareHandoff(f.s, 'death', 40, context); S.select(f.s, 'death', f.b.id); S.recover(f.s, 'death', 40, context);
  const charged = S.charge(f.s, f.b.fixtureId, f.r.chamberId, { ...context(), beaconResearch: true, location: context().destination }, 50);
  assert.equal(charged.ok, true); assert.equal(charged.beacon.memoryTier, 'imperfect'); assert.equal(charged.beacon.preparation, null);
});
const oldSkills = { analysis: { xp: 120, evolvedLabel: 'Forensic Analysis', practiceTags: { necropsy: 50 } }, animancy: { xp: 150 },
  medicine: { xp: 100, evolvedLabel: 'Surgery' }, striking: { xp: 200 }, perception: { xp: 70 }, arcaneSenses: { xp: 50 } };
const baseline = { analysis: { xp: 10 }, perception: { xp: 10 }, animancy: { xp: 10 }, arcaneSenses: { xp: 10 } };
const restored = () => E.restore(oldSkills, baseline, 'new-body', 1000, xp => Math.floor(xp / 10) * 10);
const apply = (xp, amount) => ({ xp: xp + amount, applied: amount, discarded: 0 });
test('explicit components retain conceptual specializations but reset every body-bound component', () => {
  const skills = restored();
  assert.equal(Object.keys(E.COMPONENTS).length, 15);
  assert.equal(skills.analysis.xp, 120); assert.equal(skills.animancy.xp, 150); assert.equal(skills.analysis.embodiment, undefined);
  assert.equal(skills.medicine.evolvedLabel, 'Surgery'); assert.equal(E.executionXp(skills.medicine, 'medicine'), 0);
  assert.equal(E.executionXp(skills.striking, 'striking'), 0); assert.equal(E.executionXp(skills.perception, 'perception'), 10);
  assert.equal(E.executionXp(skills.arcaneSenses, 'arcaneSenses'), 10); assert.equal(skills.medicine.embodiment.bodyId, 'new-body');
  skills.analysis.practiceTags.necropsy = 0; assert.equal(oldSkills.analysis.practiceTags.necropsy, 50);
});
test('reading or waiting cannot train a body; actual practice gets four times gains only below prior earned mastery', () => {
  const skill = restored().medicine;
  assert.equal(E.practice(skill, 10, 1001, apply, false), null); assert.equal(skill.embodiment.xp, 0);
  E.practice(skill, 10, 1002, apply, true); assert.equal(skill.embodiment.xp, 40);
  skill.embodiment.xp = 96; const award = E.practice(skill, 10, 1003, apply, true);
  assert.equal(award.applied, 13); assert.equal(skill.embodiment.xp, 109);
  assert.equal(E.practice(skill, 10, 1004, apply, true).applied, 10);
});
test('a previously unlearned mixed domain cannot gain manual competence from post-return theory', () => {
  const skills = restored(), entry = skills.materialsScience;
  assert.equal(entry.xp, 0); assert.equal(entry.embodiment.retainedXp, 0);
  entry.xp = 80; E.practice(entry, 80, 1001, apply, false);
  assert.equal(E.executionXp(entry, 'materialsScience'), 0);
  assert.equal(E.practice(entry, 10, 1002, apply, true).applied, 10);
  assert.equal(E.executionXp(entry, 'materialsScience'), 10);
});
test('retraining respects breakthrough discard rather than skipping thresholds with surplus XP', () => {
  const skill = restored().striking;
  const result = E.practice(skill, 60, 1001, (_, n) => ({ xp: 10, applied: 10, discarded: n - 10 }), true);
  assert.equal(skill.embodiment.xp, 10); assert.equal(result.discarded, 200);
});
test('repeat perfected returns remember knowledge but never import a previous body’s practice', () => {
  const skills = restored(); E.practice(skills.medicine, 10, 1001, apply, true);
  const again = E.restore(JSON.parse(JSON.stringify(skills)), baseline, 'third-body', 2000, xp => xp);
  assert.equal(again.medicine.xp, skills.medicine.xp); assert.equal(again.medicine.embodiment.xp, 0);
  assert.equal(again.medicine.embodiment.bodyId, 'third-body');
  assert.equal(E.normalize(skills.medicine, 'medicine', 'another-body').xp, 0);
  assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(again.medicine)), 'medicine', 'third-body'), again.medicine.embodiment);
});
