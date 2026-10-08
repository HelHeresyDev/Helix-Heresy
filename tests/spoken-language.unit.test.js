const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../spoken-language');
const H = require('../homunculi');
function fixture() {
  const f = { s: S.create(), now: 0, a: { id: 'learner', name: 'Learner', family: 'homunculus', actorKind: 'homunculus', maturity: 1, chamberId: '',
    status: 'stable', health: 100, foodHours: 24, waterHours: 24, fatigue: 0, stress: 0, vocalAnatomy: { ...H.VOCAL_ANATOMY }, agreement: null, skills: {} } };
  f.context = (phase = 0) => ({ local: true, safe: true, visible: true, visual: true, teacherToLearner: true, learnerToTeacher: true,
    signedCore: true, signedPain: true, teacherVoiceId: 'teacher-body', attended: 1200, examplesValid: true,
    food: { id: phase ? 'meal-b' : 'meal-a', cell: [phase === 2 ? 1 : 0, 0] }, water: { id: phase ? 'water-b' : 'water-a', cell: [phase === 2 ? 1 : 0, 0] },
    scientistCell: [0, 0], actorCell: [1, 0], care: { id: 'care-actual', giverId: 'scientist', recipientId: 'learner', consumed: true, unconditional: true,
      inputs: [{ stackId: 'consumed-meal', key: 'trailMeal', quantity: 1 }, { stackId: 'consumed-water', key: 'drinkingWater', quantity: 1 }] } });
  f.run = (action, group = 'core', phase = 0, extra = {}) => {
    f.now += action === 'talk' ? 60 : action.endsWith('Check') ? 600 : 1200;
    return S.session(f.s, f.a, action, group, f.now, { ...f.context(phase), ...extra });
  };
  f.rest = () => { f.now += 3600; f.a.fatigue = 0; };
  f.train = (side, group = 'core') => {
    assert.equal(f.run(side === 'listening' ? 'listenTeach' : 'speakPractice', group).outcome, 'practiced'); f.rest();
    for (const phase of [1, 2]) { assert.equal(f.run(side === 'listening' ? 'listenCheck' : 'speakCheck', group, phase).outcome, phase === 1 ? 'retained' : 'understood'); f.rest(); }
  };
  return f;
}
test('human vocal anatomy is physical capacity, not inherited comprehension or vocal proficiency; slime tests always fail', () => {
  const f = fixture(); assert.equal(S.voice(f.a), 1); assert.equal(f.run('talk', 'core', 0, { question: 'want' }).outcome, 'misunderstood');
  assert.equal(f.run('listenTeach', 'core', 0, { signedCore: false }).outcome, 'notDemonstrated');
  const before = JSON.stringify(f.s.subjects); f.a.genome = 'slime';
  for (const action of S.ACTIONS) assert.equal(f.run(action, 'core', 0, { question: 'want' }).outcome, 'notDemonstrated');
  assert.equal(JSON.stringify(f.s.subjects), before); assert.equal(f.a.agreement, null);
});
test('voice depends on organs, breathing, health and relevant injuries, not hand use or sign vocabulary', () => {
  const f = fixture(); f.a.vocalAnatomy.respiration = false; assert.equal(S.voice(f.a), 0); f.a.vocalAnatomy.respiration = true;
  assert.equal(S.voice(f.a, [{ location: 'throat', severityId: 'severe' }]), 0);
  assert.equal(S.voice(f.a, [{ location: 'torso', severityId: 'moderate' }]), .5);
  assert.equal(S.voice(f.a, [{ location: 'hand', severityId: 'critical' }]), 1);
  assert.equal(S.voice(f.a, [{ location: 'jaw', severityId: 'critical', status: 'healed' }]), 1);
  assert.equal(S.voice(f.a, [], true), 0);
});
test('two-way intelligibility uses real distance, barrier transmission, hearing and source voice', () => {
  assert.equal(S.audible(4, 1, true, 68, 1), true); assert.equal(S.audible(5, 1, true, 100, 1), false);
  assert.equal(S.audible(2, .03, true, 68, 1), false); assert.equal(S.audible(1, 1, false, 100, 1), false);
  assert.equal(S.audible(4, 1, true, 68, .5), false); assert.equal(S.audible(1, 1, true, 68, .5), true);
});
test('retained listening needs real transfer, recovery and no concurrent cues; it grants no production', () => {
  const f = fixture(); f.run('listenTeach'); assert.equal(f.run('listenCheck', 'core', 1).outcome, 'recovering'); f.rest();
  assert.equal(f.run('listenCheck').outcome, 'notDemonstrated'); assert.equal(f.run('listenCheck', 'core', 1, { cued: true }).outcome, 'repeated');
  assert.equal(f.run('listenCheck', 'core', 1).outcome, 'retained'); f.rest();
  assert.equal(f.run('listenCheck', 'core', 1).outcome, 'repeated'); assert.equal(f.run('listenCheck', 'core', 2).outcome, 'understood');
  const r = f.s.subjects.learner; assert.equal(S.mastered(r, 'listening'), true); assert.equal(S.mastered(r, 'production'), false);
  assert.deepEqual(r.listening.core.checks[0].trials[0].response, ['learner', 'not', 'want', 'water-b']);
  assert.equal(f.run('talk', 'core', 0, { question: 'want' }).outcome, 'unintelligible');
});
test('own articulation requires separate practice and changed-context expression; bad pronunciation fails', () => {
  const f = fixture(); assert.equal(f.run('speakPractice').outcome, 'notDemonstrated'); f.train('listening');
  assert.equal(f.run('speakPractice').outcome, 'practiced'); f.rest(); f.s.subjects.learner.production.core.lexicon.water = 'word:food';
  assert.equal(f.run('speakCheck', 'core', 2).outcome, 'unintelligible'); assert.equal(f.s.subjects.learner.production.core.checks.length, 0);
});
test('darkness or unavailable signing does not erase learned speech; deafness or lost voice gives no fallback', () => {
  const f = fixture(); f.train('listening'); f.train('production'); f.a.waterHours = 8;
  assert.deepEqual(f.run('talk', 'core', 0, { question: 'want', visual: false, visible: false }).utterance, ['self', 'want', 'water']);
  assert.equal(f.run('talk', 'core', 0, { question: 'want', teacherToLearner: false }).outcome, 'unavailable');
  assert.equal(f.run('talk', 'core', 0, { question: 'want', learnerToTeacher: false }).outcome, 'unintelligible');
  assert.equal(f.a.waterHours, 8); assert.equal(f.a.agreement, null); assert.deepEqual(f.a.skills, {});
});
test('help requires actual unconditional care received; payment, labels and another individual’s care cannot teach it', () => {
  const f = fixture(); f.train('listening'); f.train('production');
  for (const care of [null, { ...f.context().care, consumed: false }, { ...f.context().care, unconditional: false }, { ...f.context().care, recipientId: 'other' }])
    assert.equal(f.run('listenTeach', 'help', 0, { care }).outcome, 'notDemonstrated');
  f.train('listening', 'help'); f.train('production', 'help'); f.a.waterHours = 8;
  const e = f.run('talk', 'help', 0, { question: 'help' }); assert.deepEqual(e.utterance, ['self', 'want', 'help', 'water']);
  assert.equal(f.a.waterHours, 8); assert.equal(f.a.agreement, null); assert.equal(f.s.subjects.learner.listening.help.care.id, 'care-actual');
});
test('unknown meanings, fatigue, refusal and channel switching preserve identity-bound recovery and dated knowledge', () => {
  const f = fixture(); f.train('listening'); f.train('production');
  assert.deepEqual(f.run('talk', 'core', 0, { question: 'help' }).utterance, ['self', 'unknown']);
  f.a.stress = 35; assert.equal(f.run('talk', 'core', 0, { question: 'want' }).outcome, 'refused');
  const saved = S.normalize(f.s), journal = JSON.stringify(saved.journal); f.a.stress = 0;
  assert.equal(S.session(saved, f.a, 'talk', 'core', f.now + 60, { ...f.context(), question: 'want' }).outcome, 'recovering');
  assert.equal(JSON.stringify(f.s.journal), journal); assert.equal(f.a.agreement, null);
});
test('interrupted attendance, unfamiliar teacher voice and irreversible death supply no new observations or borrowed language', () => {
  const f = fixture(); assert.equal(f.run('listenTeach', 'core', 0, { interrupted: true }).outcome, 'unavailable');
  assert.equal(f.s.subjects.learner, undefined); f.train('listening'); f.train('production');
  assert.equal(f.run('talk', 'core', 0, { teacherVoiceId: 'replacement-body', question: 'want' }).outcome, 'unavailable');
  const saved = JSON.stringify(f.s); assert.equal(f.run('talk', 'core', 0, { dead: true, question: 'want' }), null); assert.equal(JSON.stringify(f.s), saved);
  f.a.id = 'new-body'; assert.equal(f.run('talk', 'core', 0, { question: 'want' }).outcome, 'misunderstood');
});
