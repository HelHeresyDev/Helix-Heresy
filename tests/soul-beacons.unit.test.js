const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../soul-beacons');
const D = require('../scientist-death');
const R = require('../research-system');
const Jail = require('../jail-custody');
const Raids = require('../law-enforcement-raids');
const HOUR = 3600;
const context = () => ({ local: true, animancy: 151, medicine: 151, alchemy: 151, fabrication: 101,
  research: true, beaconResearch: true, integration: true, inspected: true, condition: 100, services: true,
  quality: 90, template: { family: 'human', donorId: 'scientist', examined: true, quality: 90 },
  location: { roomId: 'lab', cell: { x: 1, y: 2, z: 0 } }, siteId: 'main-lab', label: 'Main laboratory',
  paired: true, siteIntact: true, siteControlled: true, space: true, upkeep: true,
  destination: { roomId: 'lab', cell: { x: 1, y: 2, z: 0 } } });
function fixture() {
  const s = S.create(), supplied = { ...S.INPUTS }, maintenance = { quantity: 10 }, support = { ok: true }, chargeSupport = { ok: true };
  const use = { power: 0, mana: 0, water: 0, chargeMana: 0 }, releases = [];
  const hooks = { support: (_, seconds) => { if (support.ok) { use.power += 4 * seconds / HOUR; use.mana += 2 * seconds / HOUR; use.water += seconds / HOUR; } return support; },
    consume: (_, amounts) => {
      if (Object.entries(amounts).some(([key, n]) => supplied[key] < n)) return false;
      for (const [key, n] of Object.entries(amounts)) supplied[key] -= n;
      return true;
    }, upkeep: (_, amount) => { assert.equal(Number.isInteger(amount), true); if (maintenance.quantity < amount) return false; maintenance.quantity -= amount; return true; },
    chargeSupport: (_, seconds) => { if (chargeSupport.ok) use.chargeMana += 4 * seconds / HOUR; return chargeSupport; }, release: r => releases.push(r.id) };
  const r = S.begin(s, 'chamber', context(), 0, (_, inputs) => Object.entries(inputs).map(([key, quantity]) => ({ stackId: key, key, quantity }))).receiver;
  function advance(hours, care = true) {
    let left = hours * HOUR;
    while (left > 0) { if (care && r.status === 'growing') S.care(s, r.id, s.lastAt); const step = Math.min(left, 11 * HOUR); S.advance(s, s.lastAt + step, hooks); left -= step; }
  }
  function ready() {
    advance(168); assert.equal(r.status, 'ready');
    const b = S.charge(s, 'apparatus', 'chamber', context(), s.lastAt).beacon;
    advance(6); assert.equal(S.arm(s, b.id, r.id, context(), s.lastAt).ok, true); return b;
  }
  return { s, r, hooks, supplied, maintenance, support, chargeSupport, use, releases, advance, ready };
}
test('late-game skill, evidence, locality, self-template and services gates precede material loading', () => {
  for (const change of [{ dead: true }, { local: false }, { suppressed: true }, { animancy: 150 }, { medicine: 150 }, { alchemy: 150 }, { fabrication: 100 },
    { research: false }, { inspected: false }, { condition: 79 }, { services: false }, { quality: 74 },
    { template: { family: 'slime', examined: true } }, { template: { family: 'human', donorId: 'another-person', examined: true } }]) {
    let calls = 0; assert.equal(S.begin(S.create(), 'chamber', { ...context(), ...change }, 0, () => calls++).ok, false); assert.equal(calls, 0);
  }
  assert.equal(S.begin(S.create(), 'chamber', context(), 0, () => null).ok, false);
});
test('seven supported days consume exact original inputs, finite utilities and produce no independent soul', () => {
  const f = fixture(); f.advance(167); assert.equal(f.r.status, 'growing'); f.advance(1);
  assert.equal(f.r.status, 'ready'); assert.equal(f.r.progressSeconds, S.GROWTH);
  assert.deepEqual(f.r.consumed, S.INPUTS); assert.deepEqual(f.supplied, Object.fromEntries(Object.keys(S.INPUTS).map(k => [k, 0])));
  assert.equal(f.r.soulId, null); assert.equal(f.r.soulFormationPrevented, true);
  assert.ok(Math.abs(f.use.water - 168) < .00001); assert.ok(Math.abs(f.use.mana - 336) < .00001);
  assert.equal(S.begin(f.s, 'chamber', context(), f.s.lastAt, () => []).ok, false);
});
test('ready upkeep prepays integral packets and saves the exact remaining support duration', () => {
  const f = fixture(); f.advance(168); f.advance(1); assert.equal(f.maintenance.quantity, 9); assert.equal(f.r.supportSeconds, 23 * HOUR);
  f.s = S.normalize(f.s); const saved = f.s.receivers[0];
  S.advance(f.s, f.s.lastAt + 23 * HOUR, f.hooks); assert.equal(f.maintenance.quantity, 9); assert.equal(saved.supportSeconds, 0);
  S.advance(f.s, f.s.lastAt + 60, f.hooks); assert.equal(f.maintenance.quantity, 8); assert.equal(saved.supportConsumed, 2);
});
test('outages never refill the interruption buffer; neglect and equipment destruction defeat it', () => {
  const f = fixture(); f.advance(2); const before = f.r.progressSeconds; f.support.ok = false; f.advance(1 / 6);
  assert.equal(f.r.health, 100); assert.equal(f.r.buffer, 600); assert.equal(f.r.progressSeconds, before);
  f.support.ok = true; f.advance(1); f.support.ok = false; f.advance(1 / 3); assert.equal(f.r.buffer, 0); assert.ok(f.r.health < 100);
  f.advance(10); assert.equal(f.r.status, 'failed'); assert.deepEqual(f.releases, [f.r.id]);
  const neglected = fixture(); neglected.advance(13, false); assert.ok(neglected.r.health < 100); assert.equal(neglected.r.buffer, 1200);
  const destroyed = fixture(); destroyed.support.ok = false; destroyed.support.destroyed = true; destroyed.advance(1 / 6); assert.ok(destroyed.r.health < 100);
});
test('missing original lots, depleted maintenance and injury never regenerate through reload or care', () => {
  const f = fixture(); f.supplied.humanTissueTemplate = 0; f.advance(1); assert.equal(f.r.progressSeconds, 0); assert.ok(f.r.health < 100);
  const health = f.r.health; S.care(f.s, f.r.id, f.s.lastAt); assert.equal(f.r.health, health); assert.deepEqual(S.normalize(f.s), f.s);
  const g = fixture(); g.advance(168); g.maintenance.quantity = 0; g.advance(1); assert.ok(g.r.health < 100); assert.equal(g.r.supportConsumed, 0);
});
test('charging requires six actually supplied hours and reload cannot refill or reroll charge', () => {
  const f = fixture(); const b = S.charge(f.s, 'apparatus', 'chamber', context(), 0).beacon;
  f.advance(2); f.chargeSupport.ok = false; f.advance(5); assert.equal(b.charge, 8); assert.equal(b.status, 'charging');
  assert.deepEqual(S.normalize(f.s), f.s); f.chargeSupport.ok = true; f.advance(4); assert.equal(b.status, 'charged'); assert.equal(b.charge, 24);
  assert.ok(Math.abs(f.use.chargeMana - 24) < .00001); assert.equal(S.charge(f.s, 'apparatus', 'chamber', context(), f.s.lastAt).ok, false);
});
test('only named soul-affecting causes damage integrity; repeat causation and bodily death do not', () => {
  const f = fixture(), b = f.ready();
  assert.equal(S.damageSoul(f.s, 10, '', f.s.lastAt, 'ordinary-body-injury'), false);
  assert.equal(S.damageSoul(f.s, 25, 'Explicit animantic feedback', f.s.lastAt, 'feedback-1'), true);
  assert.equal(S.damageSoul(f.s, 25, 'Same event', f.s.lastAt, 'feedback-1'), false); assert.equal(S.eligibility(f.s, b, context()), '');
  S.damageSoul(f.s, 1, 'Another soul wound', f.s.lastAt, 'feedback-2'); assert.match(S.eligibility(f.s, b, context()), /75/);
  S.damageSoul(f.s, 1000, 'Soul destruction', f.s.lastAt, 'feedback-3'); assert.equal(f.s.soul.integrity, 0); assert.equal(S.choices(f.s, context).length, 0);
});
test('readiness rejects occupied souled bodies and actual failed receiving conditions', () => {
  const f = fixture(), b = f.ready();
  for (const change of [{ siteIntact: false }, { siteControlled: false }, { space: false }, { paired: false }, { services: false }, { condition: 79 }, { upkeep: false }])
    assert.notEqual(S.eligibility(f.s, b, { ...context(), ...change }), '');
  f.r.soulId = 'existing-homunculus-soul'; assert.match(S.eligibility(f.s, b, context()), /soul-free/); assert.equal(S.choices(f.s, context).length, 0);
});
test('saved post-death choice freezes work and consumes exactly one original receiver and charge', () => {
  const f = fixture(), b = f.ready();
  S.prepareHandoff(f.s, 'death-1', f.s.lastAt, context); assert.equal(f.s.handoff.selectedId, '');
  assert.equal(S.recover(f.s, 'death-1', f.s.lastAt, context).ok, false);
  const before = JSON.stringify(f.s); S.advance(f.s, f.s.lastAt + 100 * HOUR, f.hooks); assert.equal(JSON.stringify(f.s), before);
  assert.equal(S.select(f.s, 'other-death', b.id).ok, false); assert.equal(S.select(f.s, 'death-1', b.id).ok, true);
  const restored = S.normalize(f.s); assert.equal(restored.handoff.selectedId, b.id);
  const recovered = S.recover(restored, 'death-1', restored.lastAt, context); assert.equal(recovered.ok, true);
  assert.equal(recovered.receipt.soulIntegrity, 100); assert.equal(recovered.receipt.memoryTier, 'imperfect');
  assert.equal(restored.receivers[0].status, 'embodied'); assert.equal(restored.receivers[0].soulId, restored.soul.id); assert.equal(restored.beacons[0].charge, 0);
  assert.equal(S.recover(restored, 'death-1', restored.lastAt, context).ok, false); assert.equal(restored.transfers.length, 1);
});
test('confirmation rechecks site and finite charge without consuming an invalid destination', () => {
  const f = fixture(), b = f.ready(); S.prepareHandoff(f.s, 'death', f.s.lastAt, context); S.select(f.s, 'death', b.id);
  assert.equal(S.recover(f.s, 'death', f.s.lastAt, () => ({ ...context(), services: false })).ok, false);
  assert.equal(f.s.handoff.status, 'unavailable'); assert.equal(f.r.status, 'ready'); assert.equal(b.charge, 24); assert.equal(f.s.transfers.length, 0);
});
test('a failed selection retains another saved choice and only the chosen preparation is consumed', () => {
  const f = fixture(), first = f.ready(), g = fixture(), second = g.ready();
  g.r.id = 'receiver-other'; g.r.chamberId = 'other-chamber';
  second.id = 'other-beacon'; second.fixtureId = 'other-apparatus'; second.chamberId = g.r.chamberId; second.receiverId = g.r.id;
  f.s.receivers.push(g.r); f.s.beacons.push(second);
  S.prepareHandoff(f.s, 'death', f.s.lastAt, context); assert.equal(f.s.handoff.choices.length, 2);
  S.select(f.s, 'death', first.id);
  const contexts = b => ({ ...context(), services: b.id !== first.id });
  assert.equal(S.recover(f.s, 'death', f.s.lastAt, contexts).ok, false);
  assert.equal(f.s.handoff.status, 'pending'); assert.equal(f.s.handoff.selectedId, ''); assert.equal(f.s.handoff.choices.length, 1);
  S.select(f.s, 'death', second.id); assert.equal(S.recover(f.s, 'death', f.s.lastAt, contexts).ok, true);
  assert.equal(first.charge, 24); assert.equal(first.armed, true); assert.equal(f.r.status, 'ready');
  assert.equal(second.charge, 0); assert.equal(g.r.status, 'embodied'); assert.equal(f.s.transfers.length, 1);
});
test('death records preserve remains, soul, legal consequences and allow a new body to die at the same clock', () => {
  const first = D.recordDeath(D.defaultState(), { body: { bodyId: 'old-body' }, soul: { integrity: 90 }, legal: { caseId: 'case' }, verifiedContingencies: [{ id: 'beacon' }] }, 20);
  const returned = D.resolveHandoff(first.state, first.record.id, { bodyId: 'receiver' }); assert.equal(returned.changed, true);
  assert.equal(returned.record.body.bodyId, 'old-body'); assert.equal(returned.record.legal.caseId, 'case'); assert.equal(returned.record.soul.integrity, 90);
  const again = D.recordDeath(D.normalizeState(returned.state), { body: { bodyId: 'receiver' }, verifiedContingencies: [] }, 20);
  assert.equal(again.created, true); assert.equal(again.terminal, true); assert.equal(again.state.records.length, 2);
  assert.equal(D.resolveHandoff(returned.state, first.record.id, {}).changed, false);
});

test('failed handoff cannot add a newly prepared destination and successful context is read exactly once', () => {
  const f = fixture(), first = f.ready(), g = fixture(), later = g.ready();
  S.prepareHandoff(f.s, 'death', f.s.lastAt, context);
  g.r.id = 'late-receiver'; g.r.chamberId = 'late-chamber'; later.id = 'late-beacon';
  later.chamberId = g.r.chamberId; later.receiverId = g.r.id;
  f.s.receivers.push(g.r); f.s.beacons.push(later); S.select(f.s, 'death', first.id);
  assert.equal(S.recover(f.s, 'death', f.s.lastAt, b => ({ ...context(), services: b.id !== first.id })).ok, false);
  assert.deepEqual(f.s.handoff.choices, []); assert.equal(first.charge, 24); assert.equal(later.charge, 24);
  const h = fixture(), b = h.ready(); S.prepareHandoff(h.s, 'next-death', h.s.lastAt, context); S.select(h.s, 'next-death', b.id);
  let calls = 0;
  const receipt = S.recover(h.s, 'next-death', h.s.lastAt, () => {
    calls++; return { ...context(), destination: { roomId: 'remoteSurveyLanding', cell: { x: 23, y: 17, z: 8 }, remote: true } };
  }).receipt;
  assert.equal(calls, 1); assert.equal(receipt.location.remote, true); assert.equal(receipt.location.cell.z, 8);
});
test('verified empty physical destinations override unsupported legacy readiness flags', () => {
  const fake = D.addContingency(D.defaultState(), { preparedBodyId: 'not-real', siteId: 'not-real' }, 0);
  assert.equal(D.recordDeath(fake.state, { verifiedContingencies: [] }, 5).terminal, true);
});
test('three projects require actual original, culture, grown-body and charge evidence; no campaign gate', () => {
  const s = R.defaultState(); s.projects.tissueCultureMethods.status = 'completed'; s.projects.homunculusMorphogenesis.status = 'completed';
  assert.equal(R.projectEvaluation('soulBeaconReconstruction', s).evidenceMet, false);
  s.evidence.push({ id: 'e1', sourceKey: 'original-apparatus-exam', methodId: 'exhaustedBeaconExam', specimenId: 'exhausted-apparatus' });
  assert.equal(R.projectEvaluation('soulBeaconReconstruction', s).evidenceMet, true);
  for (const id of ['soulBeaconReconstruction', 'receivingBodyDevelopment', 'soulTransferIntegration']) {
    assert.deepEqual(R.PROJECT_BY_ID[id].minimumSkills, { animancy: 151, medicine: 151, alchemy: 151, fabrication: 101 });
    assert.equal(R.projectEvaluation(id, s).completed, false);
  }
  assert.deepEqual(R.PROJECT_BY_ID.soulTransferIntegration.evidence.map(e => e.methods[0]), ['receivingBodyExam', 'beaconCalibration']);
});
test('all world themes select the shared definition and dated examination does not leak supplies', () => {
  for (const theme of ['madcap', 'grim', 'unbound']) assert.equal(S.create(0, { theme }).sourceTheme, 'shared');
  const f = fixture(); f.advance(1); const v = S.examine(f.s, f.r.id, f.s.lastAt); f.advance(1);
  assert.deepEqual(f.s.observations[f.r.id], v); assert.equal('stocks' in v, false); assert.equal('quality' in v, false);
});
test('deceased jail and raid custody remain ended after serialization, not acquitted or released', () => {
  const jail = Jail.normalizeState({ stays: [{ id: 'stay', status: 'deceased', history: [{ action: 'physicalDeath', at: 20, summary: 'Case remains.' }] }] });
  assert.equal(jail.stays[0].status, 'deceased'); assert.equal(Jail.normalizeState(jail).stays[0].status, 'deceased');
  const raids = Raids.normalizeState({ raids: [{ id: 'raid', status: 'booked', custody: { status: 'deceased' }, detention: { status: 'deceased' } }] });
  assert.equal(raids.raids[0].custody.status, 'deceased'); assert.equal(raids.raids[0].detention.status, 'deceased');
});
