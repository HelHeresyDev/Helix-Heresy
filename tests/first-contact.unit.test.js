const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../first-contact');
const body = () => ({ id: 'independent-person', name: 'Individual', family: 'homunculus', actorKind: 'homunculus', maturity: 1,
  status: 'stabilizing', health: 100, foodHours: 24, waterHours: 24, fatigue: 0, stress: 0, injuries: [], language: null, agreement: null, skills: {} });
const local = { local: true, vision: true, gesture: true, safe: true };
function learned() {
  const s = C.create(), a = body();
  for (const [n, action] of ['demonstrate', 'demonstrate', 'probe', 'probe'].entries()) {
    a.fatigue = 0; C.session(s, a, action, n * C.REST, local);
  }
  return { s, a, now: 4 * C.REST };
}
test('body capacity grants no initial shared language; demonstrations require retention and two changed contexts', () => {
  const s = C.create(), a = body();
  assert.equal(C.session(s, a, 'ask', 0, local).outcome, 'notDemonstrated');
  assert.equal(C.session(s, a, 'probe', C.REST, local).outcome, 'notDemonstrated');
  for (let n = 2; n <= 3; n++) { a.fatigue = 0; assert.equal(C.session(s, a, 'demonstrate', n * C.REST, local).outcome, 'practiced'); }
  a.fatigue = 0; assert.equal(C.session(s, a, 'probe', 4 * C.REST, local).outcome, 'retained');
  assert.equal(s.subjects[a.id].understood, false);
  a.fatigue = 0; assert.equal(C.session(s, a, 'probe', 5 * C.REST, local).outcome, 'understood');
  a.fatigue = 0; assert.equal(C.session(s, a, 'ask', 6 * C.REST, local).response, 'continue');
  assert.equal(a.language, null); assert.equal(a.agreement, null); assert.deepEqual(a.skills, {});
});
test('slimes may undergo every test indefinitely but never learn, refuse intelligently or agree even with false cognitive metadata', () => {
  for (const actor of [{ ...body(), family: 'slime', actorKind: 'slime' }, { ...body(), genome: 'mislabeled-slime' }]) {
    const s = C.create(), before = JSON.stringify(actor);
    for (let n = 0; n < 30; n++) assert.equal(C.session(s, actor, C.ACTIONS[n % 3], n * C.REST, local).outcome, 'notDemonstrated');
    assert.equal(s.subjects[actor.id].demonstrations, 0); assert.equal(s.subjects[actor.id].understood, false);
    assert.equal(JSON.stringify(actor), before);
  }
});
test('visual channels and bodily gesture capacity are actual prerequisites; absence and death provide no remote learning', () => {
  for (const blocked of [{ vision: false }, { gesture: false }, { safe: false }]) {
    const s = C.create(), a = body(); assert.equal(C.session(s, a, 'demonstrate', 0, { ...local, ...blocked }).outcome, 'unavailable');
    assert.equal(s.subjects[a.id].demonstrations, 0); assert.equal(a.fatigue, 0);
  }
  const s = C.create(), a = body();
  assert.equal(C.session(s, a, 'demonstrate', 0, { ...local, local: false }), null);
  assert.equal(C.session(s, a, 'demonstrate', 0, { ...local, dead: true }), null); assert.deepEqual(s, C.create());
  a.status = 'dead'; assert.equal(C.session(s, a, 'probe', 0, local).outcome, 'unavailable');
});
test('a developing organism and unmet bodily needs cannot be trained by clicking', () => {
  for (const changes of [{ status: 'developing', maturity: 0 }, { health: 20 }, { waterHours: 0 }]) {
    const s = C.create(), a = { ...body(), ...changes };
    for (let n = 0; n < 5; n++) assert.equal(C.session(s, a, 'demonstrate', n * C.REST, local).outcome, 'unavailable');
    assert.equal(s.subjects[a.id].demonstrations, 0);
  }
});
test('repeated sessions without recovery yield no additional practice or evidence', () => {
  const s = C.create(), a = body(); C.session(s, a, 'demonstrate', 0, local);
  for (let n = 1; n < 6; n++) assert.equal(C.session(s, a, 'demonstrate', n * C.SESSION, local).outcome, 'recovering');
  assert.equal(s.subjects[a.id].demonstrations, 1); assert.equal(a.fatigue, 8);
});
test('an understood refusal is causal, persistent after reload and not overridden by repeated requests or demonstration', () => {
  const f = learned(); f.a.stress = 40;
  assert.equal(C.session(f.s, f.a, 'ask', f.now, local).outcome, 'refused');
  const saved = C.normalize(f.s); f.a.stress = 0;
  for (const action of C.ACTIONS) assert.equal(C.session(saved, f.a, action, f.now + C.SESSION, local).outcome, 'recovering');
  assert.equal(saved.subjects[f.a.id].understood, true);
  assert.equal(C.session(saved, f.a, 'ask', f.now + C.REST, local).response, 'continue');
});
test('injury makes learning more demanding without creating hostility or erasing acquired understanding', () => {
  const s = C.create(), a = body(); a.injuries.push({ cause: 'Developmental injury', damage: 10 });
  for (let n = 0; n < 2; n++) { a.fatigue = 0; C.session(s, a, 'demonstrate', n * C.REST, local); }
  assert.equal(C.session(s, a, 'probe', 2 * C.REST, local).outcome, 'notDemonstrated');
  a.fatigue = 0; C.session(s, a, 'demonstrate', 3 * C.REST, local);
  for (let n = 4; n <= 5; n++) { a.fatigue = 0; C.session(s, a, 'probe', n * C.REST, local); }
  assert.equal(s.subjects[a.id].understood, true); a.health = 65;
  assert.equal(C.session(s, a, 'ask', 6 * C.REST, local).outcome, 'refused'); assert.equal(s.subjects[a.id].understood, true);
});
test('save/load preserves personal learning and refusal independently of bodily identity; observations are dated snapshots', () => {
  const f = learned(), saved = C.normalize(f.s); assert.deepEqual(saved, f.s);
  const previous = JSON.stringify(saved.journal), other = { ...body(), id: 'other-person' };
  C.session(saved, other, 'ask', f.now, local); assert.equal(saved.subjects[other.id].understood, false);
  assert.equal(JSON.stringify(saved.journal.slice(0, -1)), previous);
  assert.equal('stress' in saved.journal[0], false); assert.equal('demonstrations' in saved.journal[0], false);
});
