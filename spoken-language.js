(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./signed-language') : root.HelixSignedLanguage);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HelixSpokenLanguage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Signed) {
  'use strict';
  const INSTRUCTION = 1200, CHECK = 600, CONVERSATION = 60, REST = 3600;
  const CORE = ['self', 'you', 'food', 'water', 'rest', 'want', 'not', 'unknown'];
  const GROUPS = { core: CORE, help: ['help'], pain: ['pain'] };
  const ACTIONS = ['listenTeach', 'listenCheck', 'speakPractice', 'speakCheck', 'talk'];
  const QUESTIONS = ['want', 'wantFood', 'wantWater', 'wantRest', 'pain', 'help'];
  const copy = x => JSON.parse(JSON.stringify(x));
  function create() { return { subjects: {}, journal: [] }; }
  function normalize(s) { return s?.subjects && Array.isArray(s.journal) ? copy(s) : create(); }
  function voice(a, injuries = [], incapable = false) {
    if (!a || incapable || a.status === 'dead' || a.health < 35 || a.fatigue >= 90
      || !['larynx', 'oralArticulation', 'respiration'].every(k => a.vocalAnatomy?.[k])) return 0;
    const relevant = injuries.filter(i => i.status !== 'healed' && /head|jaw|mouth|throat|larynx|chest|torso|lung/i.test(i.location));
    if (relevant.some(i => ['severe', 'critical'].includes(i.severityId))) return 0;
    return relevant.some(i => i.severityId === 'moderate') ? .5 : 1;
  }
  function audible(distance, transmission, hearing, sensitivity, sourceVoice) {
    return Boolean(hearing && distance >= 0 && distance <= 4 && transmission > 0
      && sourceVoice * transmission * sensitivity / 100 / (1 + distance * .25) >= .18);
  }
  function mastered(r, side, group = 'core') { return Boolean(r?.[side]?.[group]?.checks.length >= 2); }
  function frame(c) { return JSON.stringify([c.food, c.water, c.scientistCell, c.actorCell]); }
  function careValid(c, a) { return Boolean(c.care && c.care.recipientId === a.id && c.care.giverId === 'scientist'
    && c.care.consumed && c.care.unconditional && c.care.inputs?.every(i => i.stackId && i.quantity > 0)
    && ['trailMeal', 'drinkingWater'].every(key => c.care.inputs.filter(i => i.key === key).reduce((n, i) => n + i.quantity, 0) === 1)); }
  function reply(a, question, painKnown, ownPain) {
    const rest = a.health < 75 || a.fatigue >= 20 || a.stress >= 30, water = a.waterHours < 12, food = a.foodHours < 12;
    let utterance, summary;
    if (question === 'help') {
      const need = water ? 'water' : food ? 'food' : ownPain && painKnown ? 'pain' : rest ? 'rest' : null;
      const help = Boolean(need || ownPain);
      utterance = ['self', ...(help ? [] : ['not']), 'want', 'help', ...(need ? [need] : [])];
      summary = help ? `“I want help${need ? ` with ${need}` : ''}.”` : '“I do not want help now.”';
    } else if (question === 'pain') {
      utterance = ['self', ...(ownPain ? [] : ['not']), 'pain']; summary = ownPain ? '“I have pain.”' : '“I do not have pain.”';
    } else if (question === 'want') {
      const need = rest ? 'rest' : water ? 'water' : food ? 'food' : null;
      utterance = need ? ['self', 'want', need] : ['self', 'not', 'want', 'food', 'water'];
      summary = need ? `“I want ${need}.”` : '“I do not want food or water now.”';
    } else {
      const object = { wantFood: 'food', wantWater: 'water', wantRest: 'rest' }[question], wants = { food, water, rest }[object];
      utterance = ['self', ...(wants ? [] : ['not']), 'want', object]; summary = `“I ${wants ? 'want' : 'do not want'} ${object}.”`;
    }
    if (rest) {
      if (question !== 'help') { utterance = ['self', 'want', 'rest']; summary = '“I want rest.”'; }
      summary += ' The individual ends this conversation.';
    }
    return { outcome: rest ? 'refused' : 'reply', summary, utterance };
  }
  function session(s, a, action, group, now, c = {}) {
    if (c.dead || !a || !ACTIONS.includes(action)) return null;
    const record = (outcome, summary, extra = {}) => {
      const e = { actorId: a.id, name: c.visible ? a.name : s.subjects[a.id]?.name || c.knownName || 'Previously met individual',
        at: now, action, group, channel: 'local-speech', outcome, summary, ...extra };
      s.journal.push(e); s.journal = s.journal.slice(-64); return copy(e);
    };
    if (!c.local || !c.safe || c.interrupted || !c.teacherToLearner || a.status === 'dead')
      return record('unavailable', 'No completed intelligible local spoken exchange; hearing, voice, attendance, distance, barriers or safety prevents it. Signing is not substituted.');
    if (!Signed.eligible(a)) return record('notDemonstrated', 'Slime tests cannot establish spoken language, regardless of biological reactions or metadata.');
    const r = s.subjects[a.id] ||= { name: a.name, listening: {}, production: {}, restUntil: 0, lastLessonAt: null, teacherVoiceId: c.teacherVoiceId };
    if (r.teacherVoiceId !== c.teacherVoiceId) return record('unavailable', 'This is not the physically familiar teacher voice; no automatic identity or language transfer.');
    if (now < Math.max(r.restUntil, c.restUntil || 0)) return record('recovering', 'Honor the saved rest request; another channel cannot bypass refusal.');
    if (a.health < 35 || a.foodHours <= 0 || a.waterHours <= 0) return record('unavailable', 'Bodily incapacity prevents a meaningful exchange.');
    if (action === 'talk') {
      if (c.attended < CONVERSATION) return record('unavailable', 'The actual conversation did not finish.');
      if (!mastered(r, 'listening') || !QUESTIONS.includes(c.question)) return record('misunderstood', 'No understanding of this spoken question is demonstrated.');
      if (!c.learnerToTeacher || !mastered(r, 'production')) return record('unintelligible', 'No intelligible spoken reply was received. Listening evidence does not prove vocal expression, and signing is not substituted.');
      const optional = ['pain', 'help'].includes(c.question) ? c.question : null;
      if (optional && (!mastered(r, 'listening', optional) || !mastered(r, 'production', optional)))
        return record('misunderstood', '“I do not understand.”', { utterance: ['self', 'unknown'] });
      const result = reply(a, c.question, mastered(r, 'production', 'pain'), c.ownPain);
      if (result.outcome === 'refused') r.restUntil = now + REST;
      a.fatigue = Math.min(100, a.fatigue + 1);
      return record(result.outcome, result.summary, { utterance: result.utterance });
    }
    if (r.lastLessonAt != null && now - r.lastLessonAt < REST || c.lastSessionAt != null && now - c.lastSessionAt < REST)
      return record('recovering', 'Allow an hour after meaningful instruction or checks in either channel.');
    if (c.refused || !Signed.willing(a)) { r.restUntil = now + REST; return record('refused', 'The individual declines further instruction; ordinary care is not conditional on learning.'); }
    const teach = ['listenTeach', 'speakPractice'].includes(action), side = action.startsWith('listen') ? 'listening' : 'production';
    if (!teach && c.cued) return record('repeated', 'A simultaneous signed or pronunciation cue is not an unguided check.');
    if (side === 'production' && !c.learnerToTeacher) return record('unintelligible', 'The actual vocal body or return sound channel cannot demonstrate intelligible expression.');
    if (c.attended < (teach ? INSTRUCTION : CHECK) || !c.visual || !c.examplesValid || !c.food?.id || !c.water?.id)
      return record('unavailable', 'Teaching and transfer checks require attended physical examples and a usable visual scaffold; conversations do not.');
    if (!GROUPS[group] || !c.signedCore || group === 'pain' && !c.signedPain)
      return record('notDemonstrated', 'Demonstrate the corresponding signed concepts first; neither hearing nor human-derived tissue supplies spoken meanings.');
    if (group === 'help' && (!mastered(r, 'listening') || !careValid(c, a)))
      return record('notDemonstrated', 'Help needs actual ordinary care received by this individual and established core listening, not an invented lesson reward.');
    if (side === 'production' && (!mastered(r, 'listening', group) || group !== 'core' && !mastered(r, 'production')))
      return record('notDemonstrated', 'First establish retained listening for these meanings and core production before wider expression.');
    const lesson = r[side][group];
    if (teach) {
      if (lesson) return record('repeated', 'This repeats an existing lesson, not new independent evidence.');
      const lexicon = Object.fromEntries(GROUPS[group].map(m => side === 'listening' ? [`word:${m}`, m] : [m, `word:${m}`]));
      r[side][group] = { lexicon, demonstration: copy({ food: c.food, water: c.water, scientistCell: c.scientistCell, actorCell: c.actorCell }),
        care: group === 'help' ? copy(c.care) : null, checks: [] };
      r.lastLessonAt = now; a.fatigue = Math.min(100, a.fatigue + 8);
      return record('practiced', side === 'listening' ? 'Paired audible spoken forms with physically demonstrated meanings; no fluent speech is granted.'
        : 'Practiced the individual’s own articulation through actual audible expression; imitation alone proves no retained proficiency.');
    }
    if (!lesson) return record('notDemonstrated', 'Complete the corresponding instruction or vocal practice first.');
    if (mastered(r, side, group)) return record('repeated', 'These checks already passed; repeated contexts grant no new competence.');
    if (c.food.id === lesson.demonstration.food.id || c.water.id === lesson.demonstration.water.id)
      return record('notDemonstrated', 'Use different actual food and water lots rather than the demonstrated objects again.');
    const current = frame(c);
    if (lesson.checks.some(e => e.frame === current) || lesson.checks.length && JSON.stringify([c.food.cell, c.water.cell, c.scientistCell, c.actorCell]) === lesson.checks[0].positions)
      return record('repeated', 'Change the actual arrangement for a second context; repeated labels or trials add no evidence.');
    const phrases = group === 'help' ? lesson.checks.length ? [['you', 'not', 'want', 'help', 'food']] : [['self', 'want', 'help', 'water']]
      : group === 'pain' ? [['self', 'not', 'pain'], ['you', 'pain']]
        : lesson.checks.length ? [['self', 'not', 'want', 'food'], ['you', 'want', 'water'], ['you', 'unknown']]
          : [['you', 'not', 'want', 'water'], ['self', 'want', 'rest'], ['self', 'unknown']];
    const lexicon = Object.assign({}, ...Object.values(r[side]).map(g => g.lexicon));
    const bind = m => ({ self: side === 'listening' ? 'scientist' : a.id, you: side === 'listening' ? a.id : 'scientist', food: c.food.id, water: c.water.id }[m] || m);
    const trials = phrases.map(p => side === 'listening'
      ? { prompt: p.map(m => `word:${m}`), expected: p.map(bind), response: p.map(m => bind(lexicon[`word:${m}`] || null)) }
      : { prompt: p, expected: p.map(m => `word:${m}`), response: p.map(m => lexicon[m] || null) });
    if (!trials.every(t => JSON.stringify(t.expected) === JSON.stringify(t.response)))
      return record(side === 'listening' ? 'misunderstood' : 'unintelligible', 'Unguided comprehension or articulation failed; no evidence is credited.');
    lesson.checks.push({ at: now, frame: current, positions: JSON.stringify([c.food.cell, c.water.cell, c.scientistCell, c.actorCell]), trials });
    r.lastLessonAt = now; a.fatigue = Math.min(100, a.fatigue + 4);
    return record(mastered(r, side, group) ? 'understood' : 'retained', `${side}, ${group}: new combinations checked without simultaneous signed or pronunciation cues. ${mastered(r, side, group) ? 'Two independent changed contexts demonstrated.' : 'A second changed context is needed.'}`);
  }
  return { INSTRUCTION, CHECK, CONVERSATION, REST, GROUPS, ACTIONS, QUESTIONS, create, normalize, voice, audible, mastered, careValid, reply, session };
});
