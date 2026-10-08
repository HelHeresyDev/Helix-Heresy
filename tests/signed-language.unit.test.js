const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../signed-language');
function fixture() {
  const f = { s: L.create(), now: 0, a: { id: 'person', name: 'Learner', actorKind: 'homunculus', family: 'homunculus', maturity: 1,
    chamberId: '', status: 'stable', health: 100, foodHours: 24, waterHours: 24, fatigue: 0, stress: 0, language: null, agreement: null, skills: {} } };
  f.context = (phase = 0) => ({ local: true, vision: true, gesture: true, safe: true, contactUnderstood: true, examplesValid: true,
    food: { id: phase ? 'meal-b' : 'meal-a', cell: [phase === 2 ? 1 : 0, 0] }, water: { id: phase ? 'water-b' : 'water-a', cell: [phase === 2 ? 1 : 0, 0] },
    scientistCell: [0, 0], actorCell: [1, 0], attended: 1200 });
  f.run = (action, group, phase = 0, extra = {}) => {
    f.now += action === 'instruct' ? 1200 : action === 'check' ? 600 : 60;
    return L.session(f.s, f.a, action, group, f.now, { ...f.context(phase), ...extra });
  };
  f.rest = () => { f.now += 3600; f.a.fatigue = 0; };
  f.train = group => { assert.equal(f.run('instruct', group).outcome, 'practiced'); f.rest();
    assert.equal(f.run('check', group, 1).outcome, 'retained'); f.rest(); assert.equal(f.run('check', group, 2).outcome, 'understood'); f.rest(); };
  return f;
}
test('capacity, first contact and carrying vocabulary never supply broader language; slime tests always fail', () => {
  const f = fixture(); assert.equal(f.run('talk', '', 0, { question: 'want' }).outcome, 'misunderstood'); assert.equal(f.a.language, null);
  const prior = JSON.stringify(f.s.subjects); f.a.genome = 'slime'; f.a.actorKind = 'homunculus';
  for (const action of ['instruct', 'check', 'talk']) assert.equal(f.run(action, 'references', 0, { question: 'want' }).outcome, 'notDemonstrated');
  assert.equal(JSON.stringify(f.s.subjects), prior); assert.equal(f.a.language, null);
});
test('real examples, attendance and established first contact are necessary; no fabricated lessons', () => {
  for (const extra of [{ contactUnderstood: false }, { examplesValid: false }, { food: null }, { attended: 1199 }, { vision: false }, { gesture: false }, { interrupted: true }]) {
    const f = fixture(); assert.notEqual(f.run('instruct', 'references', 0, extra).outcome, 'practiced'); assert.equal(f.s.subjects.person?.groups.references, undefined);
  }
});
test('instruction does not prove understanding; changed actual lots and positions produce grounded untaught combinations', () => {
  const f = fixture(); assert.equal(f.run('instruct', 'references').outcome, 'practiced'); assert.equal(f.a.language, null); f.rest();
  assert.equal(f.run('check', 'references').outcome, 'notDemonstrated');
  assert.equal(f.run('check', 'references', 1).outcome, 'retained'); f.rest();
  assert.equal(f.run('check', 'references', 1).outcome, 'repeated');
  const c = f.context(1); c.food.id = 'meal-c'; c.water.id = 'water-c';
  assert.equal(f.run('check', 'references', 1, c).outcome, 'repeated');
  assert.equal(f.run('check', 'references', 2).outcome, 'understood');
  const evidence = f.s.subjects.person.groups.references.checks;
  assert.equal(evidence.length, 2); assert.deepEqual(evidence[0].trials[0].response, ['person', 'meal-b']);
  assert.deepEqual(evidence[1].trials[0].response, ['scientist', 'meal-b']);
  assert.deepEqual(f.a.language.concepts, ['self', 'you', 'food', 'water']); assert.equal(f.a.agreement, null); assert.deepEqual(f.a.skills, {});
});
test('wrong retained distinctions fail checks rather than a vocabulary-count unlock', () => {
  const f = fixture(); f.run('instruct', 'references'); f.rest(); f.s.subjects.person.lexicon['sign:water'] = 'food';
  assert.equal(f.run('check', 'references', 1).outcome, 'notDemonstrated'); assert.equal(f.s.subjects.person.groups.references.checks.length, 0);
});
test('recovery, real refusal and repeated tests do not manufacture learning or reroll assent', () => {
  const f = fixture(); f.run('instruct', 'references');
  assert.equal(f.run('check', 'references', 1).outcome, 'recovering'); f.rest(); f.a.stress = 40;
  assert.equal(f.run('check', 'references', 1).outcome, 'refused'); f.a.stress = 0;
  const saved = L.normalize(f.s); assert.equal(L.session(saved, f.a, 'check', 'references', f.now + 10, f.context(1)).outcome, 'recovering');
  assert.equal(saved.subjects.person.groups.references.checks.length, 0);
});
test('compositional needs conversation gives qualitative dated statements, not automatic feeding or permission', () => {
  const f = fixture(); f.train('references'); f.train('preferences'); f.a.waterHours = 8;
  const e = f.run('talk', '', 0, { question: 'want' }); assert.deepEqual(e.utterance, ['self', 'want', 'water']); assert.equal(e.outcome, 'reply');
  assert.equal(f.a.waterHours, 8); assert.equal(f.a.agreement, null);
  assert.deepEqual(f.run('talk', '', 0, { question: 'wantFood' }).utterance, ['self', 'not', 'want', 'food']);
  const saved = L.normalize(f.s), journal = JSON.stringify(saved.journal); f.a.waterHours = 24;
  assert.equal(JSON.stringify(saved.journal), journal); assert.equal(Object.hasOwn(e, 'waterHours'), false);
  assert.deepEqual(f.run('talk', '', 0, { question: 'pain' }).utterance, ['self', 'unknown']);
});
test('distress ends a learned conversation with rest rather than hiding refusal or accepting work', () => {
  const f = fixture(); f.train('references'); f.train('preferences'); f.a.health = 65;
  const e = f.run('talk', '', 0, { question: 'wantWater' }); assert.equal(e.outcome, 'refused'); assert.deepEqual(e.utterance, ['self', 'want', 'rest']);
  f.a.health = 100; assert.equal(f.run('talk', '', 0, { question: 'wantWater' }).outcome, 'recovering'); assert.equal(f.a.agreement, null);
});
test('pain vocabulary requires an actual example but is optional for ordinary requests', () => {
  const f = fixture(); f.train('references'); f.train('preferences'); assert.equal(f.run('instruct', 'pain').outcome, 'unavailable');
  assert.equal(f.run('instruct', 'pain', 0, { painExample: { actorId: 'scientist', cause: 'Existing injury' } }).outcome, 'practiced'); f.rest();
  for (const phase of [1, 2]) { f.run('check', 'pain', phase, { painExample: { actorId: 'scientist', cause: 'Existing injury' } }); f.rest(); }
  assert.deepEqual(f.run('talk', '', 0, { question: 'pain', ownPain: true }).utterance, ['self', 'pain']);
});
test('channel loss and death preserve retained personal meanings without remote replies or transferred knowledge', () => {
  const f = fixture(); f.train('references'); f.train('preferences'); const groups = JSON.stringify(f.s.subjects.person.groups);
  assert.equal(f.run('talk', '', 0, { local: false, question: 'want' }).outcome, 'unavailable'); assert.equal(JSON.stringify(f.s.subjects.person.groups), groups);
  const journal = f.s.journal.length; assert.equal(f.run('talk', '', 0, { dead: true, question: 'want' }), null); assert.equal(f.s.journal.length, journal);
  f.a.id = 'replacement'; f.a.language = null; assert.equal(f.run('talk', '', 0, { question: 'want' }).outcome, 'misunderstood');
});
